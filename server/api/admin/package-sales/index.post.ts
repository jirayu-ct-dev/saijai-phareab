import { addDays } from "date-fns";
import { requireRole } from "~~/server/utils/auth";
import { createPaymentNo } from "~~/server/utils/paymentNo";
import { createReceiptNo } from "~~/server/utils/receiptNo";
import { prisma } from "~~/server/utils/prisma";
import { getBusinessSetting } from "~~/server/utils/businessSetting";
import { computeVat } from "~~/server/utils/vat";
import { notifyReceipt } from "~~/server/utils/notify";

type CreatePackageSaleBody = {
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  discountAmount?: number;
  note?: string | null;
  slipImageId?: string | null;
  method?: "CASH" | "TRANSFER" | null;
  status?: "UNPAID" | "PENDING_VERIFICATION" | "PAID" | "CANCELLED" | null;
};

const packageSaleStatusByPaymentStatus = {
  UNPAID: "PENDING",
  PENDING_VERIFICATION: "PENDING",
  PAID: "PAID",
  CANCELLED: "CANCELLED",
} as const;

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
  const body = await readBody<CreatePackageSaleBody>(event);

  if (!body.customerId) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาเลือกลูกค้า" });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาเลือกสินค้าอย่างน้อย 1 รายการ" });
  }

  const normalizedItems = body.items
    .map((item) => ({ productId: item.productId, quantity: Number(item.quantity ?? 1) }))
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
    const customer = await prisma.user.findFirst({
      where: { id: body.customerId, deletedAt: null },
      select: { id: true },
    });

    if (!customer) {
      throw createError({ statusCode: 404, statusMessage: "ไม่พบลูกค้าที่เลือก" });
    }

    const productIds = [...new Set(normalizedItems.map((item) => item.productId))];
    const products = await prisma.packageProduct.findMany({
      where: { id: { in: productIds }, deletedAt: null, isActive: true },
    });

    if (products.length !== productIds.length) {
      throw createError({ statusCode: 404, statusMessage: "มี package บางรายการไม่ถูกต้องหรือถูกปิดใช้งาน" });
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    const saleItems = normalizedItems.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) throw createError({ statusCode: 404, statusMessage: "ไม่พบ package ที่เลือก" });
      const unitPrice = Number(product.price);
      return { product, quantity: item.quantity, unitPrice, totalPrice: unitPrice * item.quantity };
    });

    const subtotalAmount = saleItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const discountAmount = Math.min(Number(body.discountAmount ?? 0), subtotalAmount);
    const beforeVat = subtotalAmount - discountAmount;
    const business = await getBusinessSetting();
    const vat = computeVat({ amount: beforeVat, rate: business.vatRate, included: business.vatIncluded });
    const totalAmount = vat.totalAmount;
    const now = new Date();

    const allowedStatuses = ["UNPAID", "PENDING_VERIFICATION", "PAID", "CANCELLED"] as const;
    const paymentStatus = allowedStatuses.includes(body.status as typeof allowedStatuses[number])
      ? (body.status as typeof allowedStatuses[number])
      : "PAID";
    const isPaid = paymentStatus === "PAID";

    const created = await prisma.$transaction(async (tx) => {
      const packageSale = await tx.packageSale.create({
        data: {
          customerId: body.customerId,
          soldById: actor.id,
          status: packageSaleStatusByPaymentStatus[paymentStatus],
          subtotalAmount,
          discountAmount,
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
              ...buildEntitlementState(saleItem.product.validityDays, saleItem.product.credits),
            },
          });
        }
      }

      const method: "CASH" | "TRANSFER" = body.method === "TRANSFER" || body.method === "CASH"
        ? body.method
        : body.slipImageId
          ? "TRANSFER"
          : "CASH";
      const payment = await tx.paymentRecord.create({
        data: {
          paymentNo: await createPaymentNo(),
          receiptNo: isPaid ? await createReceiptNo(now) : null,
          userId: body.customerId,
          packageSaleId: packageSale.id,
          amount: totalAmount,
          status: paymentStatus,
          method,
          slipImageId: body.slipImageId ?? null,
          note: body.note?.trim() || null,
          paidAt: isPaid ? now : null,
          confirmedAt: isPaid ? now : null,
          confirmedById: isPaid ? actor.id : null,
          metadata: {
            createdByAdminId: actor.id,
            source: "admin-package-sales",
            subtotalAmount,
            discountAmount,
            vat: { rate: vat.vatRate, amount: vat.vatAmount, included: vat.vatIncluded, baseAmount: vat.baseAmount },
          },
        },
      });

      await tx.paymentAuditLog.create({
        data: {
          paymentId: payment.id,
          action: isPaid ? "CONFIRMED" : "CREATED",
          actorId: actor.id,
          afterJson: { status: paymentStatus, method, source: "admin-package-sales" },
        },
      });

      return { id: packageSale.id, paymentId: payment.id };
    });

    if (isPaid) {
      void notifyReceipt({ paymentId: created.paymentId }).catch((err) => {
        console.error("[package-sales] notifyReceipt failed", err);
      });
    }

    return created;
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("[POST /api/admin/package-sales]", error);
    throw createError({ statusCode: 500, statusMessage: "Unable to create package sale" });
  }
});
