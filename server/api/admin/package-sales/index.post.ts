import { addDays } from "date-fns";
import type { PaymentMethod, PaymentStatus } from "~~/shared/types/enums";
import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

type CreatePackageSaleBody = {
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
  const body = await readBody<CreatePackageSaleBody>(event);

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

    const created = await prisma.$transaction(async (tx) => {
      const packageSale = await tx.packageSale.create({
        data: {
          customerId: body.customerId,
          soldById: actor.id,
          status: getSaleStatus(status),
          subtotalAmount: totalAmount,
          discountAmount: 0,
          totalAmount,
          note: body.note?.trim() || null,
        },
      });

      const createdSaleItems = [];
      for (const item of saleItems) {
        const createdItem = await tx.packageSaleItem.create({
          data: {
            packageSaleId: packageSale.id,
            productId: item.product.id,
            itemType: item.product.packageType,
            qty: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          },
        });
        createdSaleItems.push({ ...createdItem, product: item.product });
      }

      for (const saleItem of createdSaleItems) {
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

      const payment = await tx.paymentRecord.create({
        data: {
          userId: body.customerId,
          packageSaleId: packageSale.id,
          amount: totalAmount,
          paymentMethod: body.paymentMethod,
          slipImageId: body.slipImageId ?? null,
          status,
          note: body.note?.trim() || null,
          paidAt: isVerified ? new Date() : null,
          verifiedById: isVerified ? actor.id : null,
          verifiedAt: isVerified ? new Date() : null,
          rejectionReason: status === "FAILED" ? "บันทึกรายการไม่สำเร็จ" : null,
          metadata: {
            createdByAdminId: actor.id,
            source: "admin-package-sales",
          },
        },
      });

      return { id: packageSale.id, paymentId: payment.id };
    });

    return created;
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    console.error("[POST /api/admin/package-sales]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Unable to create package sale",
    });
  }
});
