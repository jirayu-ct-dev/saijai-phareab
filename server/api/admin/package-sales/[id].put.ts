import { addDays } from "date-fns";
import { requireRole } from "~~/server/utils/auth";
import { createPaymentNo } from "~~/server/utils/paymentNo";
import { prisma } from "~~/server/utils/prisma";
import { getBusinessSetting } from "~~/server/utils/businessSetting";
import { computeVat } from "~~/server/utils/vat";

type UpdatePackageSaleBody = {
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  discountAmount?: number;
  note?: string | null;
  slipImageId?: string | null;
};

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
  const actor = requireRole(event, ["EMPLOYEE", "ADMIN"]);
  const id = getRouterParam(event, "id");
  const body = await readBody<UpdatePackageSaleBody>(event);

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "ไม่พบรหัสรายการขาย" });
  }

  if (!body.customerId) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาเลือกลูกค้า" });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาเลือกสินค้าอย่างน้อย 1 รายการ" });
  }

  const normalizedItems = body.items
    .map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity ?? 1),
    }))
    .filter((item) => item.productId);

  if (normalizedItems.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาเลือกสินค้าอย่างน้อย 1 รายการ" });
  }

  if (normalizedItems.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) {
    throw createError({ statusCode: 400, statusMessage: "จำนวนสินค้าต้องมากกว่า 0" });
  }

  if (body.discountAmount !== undefined && (!Number.isFinite(Number(body.discountAmount)) || Number(body.discountAmount) < 0)) {
    throw createError({ statusCode: 400, statusMessage: "ส่วนลดต้องมากกว่าหรือเท่ากับ 0" });
  }

  try {
    const existingSale = await prisma.packageSale.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        customerId: true,
        items: {
          select: {
            id: true,
            memberEntitlements: {
              where: { deletedAt: null },
              select: {
                id: true,
                serviceOrders: {
                  where: { deletedAt: null },
                  select: { id: true },
                  take: 1,
                },
                serviceOrderAddonUsages: {
                  where: {
                    refundedAt: null,
                    serviceOrder: { deletedAt: null },
                  },
                  select: { id: true },
                  take: 1,
                },
              },
            },
          },
        },
        payments: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        },
      },
    });

    if (!existingSale) {
      throw createError({ statusCode: 404, statusMessage: "ไม่พบรายการขายที่ต้องการแก้ไข" });
    }

    const hasUsedEntitlement = existingSale.items.some((item) =>
      item.memberEntitlements.some((entitlement) =>
        entitlement.serviceOrders.length > 0 || entitlement.serviceOrderAddonUsages.length > 0,
      ),
    );

    if (hasUsedEntitlement) {
      throw createError({
        statusCode: 409,
        statusMessage: "ไม่สามารถแก้ไขรายการขายที่มีการใช้งานสิทธิ์ไปแล้ว",
      });
    }

    const customer = await prisma.user.findFirst({
      where: { id: body.customerId, deletedAt: null },
      select: { id: true },
    });

    if (!customer) {
      throw createError({ statusCode: 404, statusMessage: "ไม่พบลูกค้าที่เลือก" });
    }

    const productIds = [...new Set(normalizedItems.map((item) => item.productId))];
    const products = await prisma.packageProduct.findMany({
      where: {
        id: { in: productIds },
        deletedAt: null,
        isActive: true,
      },
    });

    if (products.length !== productIds.length) {
      throw createError({ statusCode: 404, statusMessage: "มีแพ็กเกจบางรายการไม่ถูกต้องหรือถูกปิดใช้งาน" });
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    const saleItems = normalizedItems.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw createError({ statusCode: 404, statusMessage: "ไม่พบแพ็กเกจที่เลือก" });
      }

      const unitPrice = Number(product.price);
      return {
        product,
        quantity: item.quantity,
        unitPrice,
        totalPrice: unitPrice * item.quantity,
      };
    });

    const subtotalAmount = saleItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const discountAmount = Math.min(Number(body.discountAmount ?? 0), subtotalAmount);
    const beforeVat = subtotalAmount - discountAmount;
    const business = await getBusinessSetting();
    const vat = computeVat({ amount: beforeVat, rate: business.vatRate, included: business.vatIncluded });
    const totalAmount = vat.totalAmount;
    const existingItemIds = existingSale.items.map((item) => item.id);

    await prisma.$transaction(async (tx) => {
      if (existingItemIds.length > 0) {
        await tx.memberEntitlement.updateMany({
          where: {
            sourceSaleItemId: { in: existingItemIds },
            deletedAt: null,
          },
          data: {
            deletedAt: new Date(),
            deletedById: actor.id,
          },
        });

        await tx.packageSaleItem.deleteMany({
          where: { id: { in: existingItemIds } },
        });
      }

      await tx.packageSale.update({
        where: { id },
        data: {
          customerId: body.customerId,
          status: "PAID",
          subtotalAmount,
          discountAmount,
          totalAmount,
          note: body.note?.trim() || null,
        },
      });

      const createdItems: Array<{
        id: string;
        qty: number;
        product: (typeof saleItems)[number]["product"];
      }> = [];

      for (const item of saleItems) {
        const createdItem = await tx.packageSaleItem.create({
          data: {
            packageSaleId: id,
            productId: item.product.id,
            itemType: item.product.packageType,
            qty: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          },
        });

        createdItems.push({
          id: createdItem.id,
          qty: createdItem.qty,
          product: item.product,
        });
      }

      for (const saleItem of createdItems) {
        for (let count = 0; count < saleItem.qty; count += 1) {
          await tx.memberEntitlement.create({
            data: {
              customerId: body.customerId,
              sourceSaleItemId: saleItem.id,
              productId: saleItem.product.id,
              ...buildEntitlementState(saleItem.product.validityDays, saleItem.product.credits),
            },
          });
        }
      }

      if (existingSale.payments.length > 0) {
        await tx.paymentRecord.updateMany({
          where: {
            id: { in: existingSale.payments.map((payment) => payment.id) },
          },
          data: {
            userId: body.customerId,
            memberEntitlementId: null,
            amount: totalAmount,
            slipImageId: body.slipImageId ?? null,
            note: body.note?.trim() || null,
            paidAt: new Date(),
            metadata: {
              updatedByAdminId: actor.id,
              source: "admin-package-sales",
              subtotalAmount,
              discountAmount,
              vat: {
                rate: vat.vatRate,
                amount: vat.vatAmount,
                included: vat.vatIncluded,
                baseAmount: vat.baseAmount,
              },
            },
          },
        });
      } else {
        await tx.paymentRecord.create({
          data: {
            paymentNo: await createPaymentNo(),
            userId: body.customerId,
            packageSaleId: id,
            amount: totalAmount,
            slipImageId: body.slipImageId ?? null,
            note: body.note?.trim() || null,
            paidAt: new Date(),
            metadata: {
              updatedByAdminId: actor.id,
              source: "admin-package-sales",
              subtotalAmount,
              discountAmount,
              vat: {
                rate: vat.vatRate,
                amount: vat.vatAmount,
                included: vat.vatIncluded,
                baseAmount: vat.baseAmount,
              },
            },
          },
        });
      }
    });

    return { success: true };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    console.error("[PUT /api/admin/package-sales/:id]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "ไม่สามารถแก้ไขรายการขายแพ็กเกจได้",
    });
  }
});
