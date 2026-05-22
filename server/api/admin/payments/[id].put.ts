import { addDays } from "date-fns";
import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

interface UpdatePaymentBody {
  customerId?: string;
  productId?: string;
  amount?: number;
  note?: string | null;
  slipImageId?: string | null;
}

const buildEntitlementState = (validityDays: number | null | undefined, credits: number | null | undefined) => {
  const startAt = new Date();
  const creditTotal = credits ?? 0;
  return {
    status: "ACTIVE" as const,
    startAt,
    endAt: validityDays ? addDays(startAt, validityDays) : null,
    activatedAt: startAt,
    suspendedAt: null,
    creditInitial: creditTotal,
    creditRemaining: creditTotal,
  };
};

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["ADMIN"]);
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "ไม่พบรหัสรายการชำระเงิน" });
  }

  const body = await readBody<UpdatePaymentBody>(event);

  try {
    const existing = await prisma.paymentRecord.findFirst({
      where: { id, deletedAt: null },
      include: {
        packageSale: {
          select: {
            id: true,
            customerId: true,
            note: true,
            discountAmount: true,
            items: {
              orderBy: [{ createdAt: "asc" }],
              select: {
                id: true,
                productId: true,
                qty: true,
                totalPrice: true,
                product: {
                  select: {
                    id: true,
                    packageType: true,
                    credits: true,
                    validityDays: true,
                  },
                },
                memberEntitlements: {
                  where: { deletedAt: null },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });

    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: "ไม่พบรายการชำระเงินที่ต้องการแก้ไข" });
    }

    if (!existing.packageSale) {
      const nextNote = body.note !== undefined ? body.note?.trim() || null : (existing.note ?? null);
      const nextSlipImageId = body.slipImageId !== undefined ? body.slipImageId : existing.slipImageId;

      const updated = await prisma.paymentRecord.update({
        where: { id },
        data: {
          slipImageId: nextSlipImageId ?? null,
          note: nextNote,
          paidAt: existing.paidAt ?? new Date(),
          metadata: { updatedByAdminId: actor.id },
        },
      });

      return updated;
    }

    const existingPackageSale = existing.packageSale;
    const saleItems = existingPackageSale.items;
    const primarySaleItem = saleItems[0] ?? null;
    const primaryEntitlementId =
      existing.memberEntitlementId
      ?? primarySaleItem?.memberEntitlements[0]?.id
      ?? null;

    const nextCustomerId = body.customerId ?? existingPackageSale.customerId ?? existing.userId;
    const nextProductId = body.productId ?? primarySaleItem?.productId ?? null;
    const nextAmount = body.amount ?? Number(existing.amount);
    const nextNote =
      body.note !== undefined
        ? body.note?.trim() || null
        : (existing.note ?? existingPackageSale.note ?? null);
    const nextSlipImageId = body.slipImageId !== undefined ? body.slipImageId : existing.slipImageId;
    const nextDiscountAmount = Number(existingPackageSale.discountAmount ?? 0);
    const isStructureUpdateRequested =
      body.customerId !== undefined
      || body.productId !== undefined
      || body.amount !== undefined;

    if (!Number.isFinite(Number(nextAmount)) || Number(nextAmount) < 0) {
      throw createError({ statusCode: 400, statusMessage: "กรุณาระบุจำนวนเงินให้ถูกต้อง" });
    }

    if (isStructureUpdateRequested && (!primarySaleItem || saleItems.length !== 1 || primarySaleItem.qty !== 1)) {
      throw createError({
        statusCode: 400,
        statusMessage: "การแก้ไขลูกค้า แพ็กเกจ หรือจำนวนเงิน รองรับเฉพาะรายการขายแพ็กเกจเดี่ยวเท่านั้น",
      });
    }

    if (body.productId !== undefined && !nextProductId) {
      throw createError({ statusCode: 400, statusMessage: "กรุณาเลือกแพ็กเกจที่ต้องการ" });
    }

    const customer = await prisma.user.findFirst({
      where: { id: nextCustomerId, deletedAt: null },
      select: { id: true },
    });

    if (!customer) {
      throw createError({ statusCode: 404, statusMessage: "ไม่พบลูกค้าที่เลือก" });
    }

    let nextPrimaryProduct = primarySaleItem?.product ?? null;
    if (body.productId !== undefined) {
      nextPrimaryProduct = await prisma.packageProduct.findFirst({
        where: { id: nextProductId!, deletedAt: null, isActive: true },
      });

      if (!nextPrimaryProduct) {
        throw createError({ statusCode: 404, statusMessage: "ไม่พบแพ็กเกจที่เลือก" });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const currentSubtotalAmount = saleItems.reduce((sum, item) => sum + Number(item.totalPrice), 0);
      const nextSubtotalAmount = isStructureUpdateRequested ? nextAmount + nextDiscountAmount : currentSubtotalAmount;
      const nextTotalAmount = isStructureUpdateRequested ? nextAmount : currentSubtotalAmount - nextDiscountAmount;

      await tx.packageSale.update({
        where: { id: existingPackageSale.id },
        data: {
          customerId: nextCustomerId,
          status: "PAID",
          subtotalAmount: nextSubtotalAmount,
          discountAmount: nextDiscountAmount,
          totalAmount: nextTotalAmount,
          note: nextNote,
        },
      });

      if (isStructureUpdateRequested && primarySaleItem && nextPrimaryProduct) {
        await tx.packageSaleItem.update({
          where: { id: primarySaleItem.id },
          data: {
            productId: nextProductId!,
            itemType: nextPrimaryProduct.packageType,
            qty: 1,
            unitPrice: nextAmount,
            totalPrice: nextAmount,
          },
        });
      }

      for (const saleItem of saleItems) {
        const itemProduct =
          saleItem.id === primarySaleItem?.id && nextPrimaryProduct
            ? nextPrimaryProduct
            : saleItem.product;
        const itemProductId =
          saleItem.id === primarySaleItem?.id && nextProductId
            ? nextProductId
            : saleItem.productId;

        for (const entitlement of saleItem.memberEntitlements) {
          await tx.memberEntitlement.update({
            where: { id: entitlement.id },
            data: {
              customerId: nextCustomerId,
              productId: itemProductId,
              ...buildEntitlementState(itemProduct.validityDays, itemProduct.credits),
              deletedAt: null,
              deletedById: null,
            },
          });
        }
      }

      return tx.paymentRecord.update({
        where: { id },
        data: {
          userId: nextCustomerId,
          memberEntitlementId: primaryEntitlementId,
          packageSaleId: existingPackageSale.id,
          amount: nextTotalAmount,
          slipImageId: nextSlipImageId ?? null,
          note: nextNote,
          paidAt: new Date(),
          metadata: { updatedByAdminId: actor.id },
        },
      });
    });

    return updated;
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    console.error("[PUT /api/admin/payments/:id]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "ไม่สามารถอัปเดตรายการชำระเงินได้",
    });
  }
});
