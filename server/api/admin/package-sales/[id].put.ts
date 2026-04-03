import { addDays } from "date-fns";
import type { PaymentMethod, PaymentStatus } from "~~/shared/types/enums";
import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

type UpdatePackageSaleBody = {
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  paymentMethod: PaymentMethod;
  status?: PaymentStatus;
  note?: string | null;
  slipImageId?: string | null;
};

const buildEntitlementState = (
  validityDays: number | null | undefined,
  credits: number | null | undefined,
  paymentStatus: PaymentStatus,
) => {
  if (paymentStatus === "FAILED") {
    return {
      status: "CANCELLED" as const,
      startAt: null,
      endAt: null,
      activatedAt: null,
      suspendedAt: null,
      creditInitial: null,
      creditRemaining: null,
    };
  }

  if (paymentStatus !== "VERIFIED") {
    return {
      status: "PENDING" as const,
      startAt: null,
      endAt: null,
      activatedAt: null,
      suspendedAt: null,
      creditInitial: null,
      creditRemaining: null,
    };
  }

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

const getSaleStatus = (status: PaymentStatus) => {
  if (status === "VERIFIED") return "PAID" as const;
  if (status === "FAILED") return "CANCELLED" as const;
  return "PENDING" as const;
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
  if (body.paymentMethod !== "CASH" && body.paymentMethod !== "TRANSFER") {
    throw createError({ statusCode: 400, statusMessage: "ช่องทางการชำระเงินไม่ถูกต้อง" });
  }
  if (body.paymentMethod === "TRANSFER" && !body.slipImageId) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาอัปโหลดสลิปสำหรับรายการโอน" });
  }

  const status: PaymentStatus = body.status ?? (body.paymentMethod === "CASH" ? "VERIFIED" : "PENDING");
  const isVerified = status === "VERIFIED";

  try {
    const existingSale = await prisma.packageSale.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
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
      item.memberEntitlements.some((entitlement) => entitlement.serviceOrders.length > 0),
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
      throw createError({ statusCode: 404, statusMessage: "มี package บางรายการไม่ถูกต้องหรือถูกปิดใช้งาน" });
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    const saleItems = normalizedItems.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw createError({ statusCode: 404, statusMessage: "ไม่พบ package ที่เลือก" });
      }

      const unitPrice = Number(product.price);
      return {
        product,
        quantity: item.quantity,
        unitPrice,
        totalPrice: unitPrice * item.quantity,
      };
    });

    const totalAmount = saleItems.reduce((sum, item) => sum + item.totalPrice, 0);
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
          status: getSaleStatus(status),
          subtotalAmount: totalAmount,
          discountAmount: 0,
          totalAmount,
          note: body.note?.trim() || null,
        },
      });

      const createdItems = [];
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
        createdItems.push({ ...createdItem, product: item.product });
      }

      for (const saleItem of createdItems) {
        for (let count = 0; count < saleItem.qty; count += 1) {
          await tx.memberEntitlement.create({
            data: {
              customerId: body.customerId,
              sourceSaleItemId: saleItem.id,
              productId: saleItem.product.id,
              ...buildEntitlementState(saleItem.product.validityDays, saleItem.product.credits, status),
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
            paymentMethod: body.paymentMethod,
            slipImageId: body.slipImageId ?? null,
            status,
            note: body.note?.trim() || null,
            paidAt: isVerified ? new Date() : null,
            verifiedById: isVerified ? actor.id : null,
            verifiedAt: isVerified ? new Date() : null,
            rejectionReason: status === "FAILED" ? "ระบุโดยผู้ดูแลระบบ" : null,
            metadata: {
              updatedByAdminId: actor.id,
              source: "admin-package-sales",
            },
          },
        });
      } else {
        await tx.paymentRecord.create({
          data: {
            userId: body.customerId,
            packageSaleId: id,
            amount: totalAmount,
            paymentMethod: body.paymentMethod,
            slipImageId: body.slipImageId ?? null,
            status,
            note: body.note?.trim() || null,
            paidAt: isVerified ? new Date() : null,
            verifiedById: isVerified ? actor.id : null,
            verifiedAt: isVerified ? new Date() : null,
            rejectionReason: status === "FAILED" ? "ระบุโดยผู้ดูแลระบบ" : null,
            metadata: {
              updatedByAdminId: actor.id,
              source: "admin-package-sales",
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
      statusMessage: "Unable to update package sale",
    });
  }
});
