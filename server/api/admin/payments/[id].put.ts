import { COMPAT_METRICS, emitCompatFailure, emitCompatTelemetry } from "~~/server/utils/compatTelemetry";
import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import { packageSaleStatusByPaymentStatus } from "~~/server/utils/paymentStateTransition";
import { buildPaymentEntitlementEdit } from "~~/server/utils/paymentEntitlementEdit";

interface UpdatePaymentBody {
  customerId?: string;
  productId?: string;
  amount?: number;
  note?: string | null;
  slipImageId?: string | null;
}

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
                  select: {
                    id: true,
                    serviceOrders: { where: { deletedAt: null }, select: { id: true }, take: 1 },
                    serviceOrderAddonUsages: {
                      where: { refundedAt: null, serviceOrder: { deletedAt: null } },
                      select: { id: true },
                      take: 1,
                    },
                  },
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

    // Editing a cancelled payment must not resurrect its entitlements or sale.
    if (existing.status === "CANCELLED") {
      throw createError({ statusCode: 409, statusMessage: "ไม่สามารถแก้ไขรายการชำระเงินที่ถูกยกเลิกแล้วได้" });
    }

    if (!existing.packageSale) {
      const nextNote = body.note !== undefined ? body.note?.trim() || null : (existing.note ?? null);
      const nextSlipImageId = body.slipImageId !== undefined ? body.slipImageId : existing.slipImageId;

      const updated = await prisma.$transaction(async (tx) => {
        const { count } = await tx.paymentRecord.updateMany({
          where: { id, status: existing.status, updatedAt: existing.updatedAt, deletedAt: null },
          data: {
            slipImageId: nextSlipImageId ?? null,
            note: nextNote,
            paidAt: existing.status === "PAID" ? existing.paidAt ?? new Date() : existing.paidAt,
            metadata: { updatedByAdminId: actor.id },
          },
        });
        if (count !== 1) {
          throw createError({ statusCode: 409, statusMessage: "รายการชำระเงินถูกแก้ไขโดยผู้ใช้อื่น กรุณาลองใหม่" });
        }

        await tx.paymentAuditLog.create({
          data: {
            paymentId: id,
            action: "UPDATED",
            actorId: actor.id,
            beforeJson: {
              note: existing.note,
              slipImageId: existing.slipImageId,
            },
            afterJson: {
              note: nextNote,
              slipImageId: nextSlipImageId ?? null,
            },
          },
        });

        return tx.paymentRecord.findUniqueOrThrow({ where: { id } });
      });

      return updated;
    }

    const existingPackageSale = existing.packageSale;
    const saleItems = existingPackageSale.items;
    const primarySaleItem = saleItems[0] ?? null;
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
    const changesEntitlementIdentity =
      (body.customerId !== undefined && nextCustomerId !== existingPackageSale.customerId)
      || (body.productId !== undefined && nextProductId !== primarySaleItem?.productId);
    const hasUsedEntitlement = saleItems.some((item) =>
      item.memberEntitlements.some((entitlement) =>
        entitlement.serviceOrders.length > 0 || entitlement.serviceOrderAddonUsages.length > 0,
      ),
    );
    const productChanged = body.productId !== undefined && nextProductId !== primarySaleItem?.productId;

    if (changesEntitlementIdentity && hasUsedEntitlement) {
      throw createError({
        statusCode: 409,
        statusMessage: "ไม่สามารถเปลี่ยนลูกค้าหรือแพ็กเกจของสิทธิ์ที่ถูกใช้งานแล้ว",
      });
    }

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

      // Mirror the sale status from the payment status instead of forcing PAID —
      // editing an unpaid payment must not mark the sale (or the receipt trail)
      // as paid, and editing a cancelled one is rejected above.
      const nextSaleStatus = packageSaleStatusByPaymentStatus[existing.status];

      await tx.packageSale.update({
        where: { id: existingPackageSale.id },
        data: {
          customerId: nextCustomerId,
          status: nextSaleStatus,
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
              // Rebuild credit state only when the package product really
              // changes. Editing amount/note/slip must never reset used credit.
              ...buildPaymentEntitlementEdit({
                paymentStatus: existing.status,
                productChanged,
                validityDays: itemProduct.validityDays,
                credits: itemProduct.credits,
              }),
              deletedAt: null,
              deletedById: null,
            },
          });
        }
      }

      const { count } = await tx.paymentRecord.updateMany({
        where: { id, status: existing.status, updatedAt: existing.updatedAt, deletedAt: null },
        data: {
          userId: nextCustomerId,
          memberEntitlementId: null,
          packageSaleId: existingPackageSale.id,
          amount: nextTotalAmount,
          slipImageId: nextSlipImageId ?? null,
          note: nextNote,
          paidAt: existing.status === "PAID" ? existing.paidAt ?? new Date() : existing.paidAt,
          metadata: { updatedByAdminId: actor.id },
        },
      });
      if (count !== 1) {
        throw createError({ statusCode: 409, statusMessage: "รายการชำระเงินถูกแก้ไขโดยผู้ใช้อื่น กรุณาลองใหม่" });
      }

      await tx.paymentAuditLog.create({
        data: {
          paymentId: id,
          action: "UPDATED",
          actorId: actor.id,
          beforeJson: {
            userId: existing.userId,
            amount: Number(existing.amount),
            note: existing.note,
            slipImageId: existing.slipImageId,
            packageSaleCustomerId: existingPackageSale.customerId,
            productId: primarySaleItem?.productId ?? null,
          },
          afterJson: {
            userId: nextCustomerId,
            amount: nextTotalAmount,
            note: nextNote,
            slipImageId: nextSlipImageId ?? null,
            packageSaleCustomerId: nextCustomerId,
            productId: nextProductId,
          },
        },
      });

      return tx.paymentRecord.findUniqueOrThrow({ where: { id } });
    });

    // The payment → package-sale status mirror is a compatibility path during
    // consolidation; report it only after the transaction has committed.
    emitCompatTelemetry({ metric: COMPAT_METRICS.paymentStatusSync, path: "edit", result: "success" });

    return updated;
  } catch (error) {
    emitCompatFailure(COMPAT_METRICS.paymentStatusSync, "edit", error);
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
