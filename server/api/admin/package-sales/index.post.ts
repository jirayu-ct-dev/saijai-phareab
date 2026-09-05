import { addDays } from "date-fns";
import { requireRole } from "~~/server/utils/auth";
import { createPaymentNo } from "~~/server/utils/paymentNo";
import { createReceiptNo } from "~~/server/utils/receiptNo";
import { prisma } from "~~/server/utils/prisma";
import { getBusinessSetting } from "~~/server/utils/appSetting";
import { computeVat } from "~~/server/utils/vat";
import { notifyReceipt } from "~~/server/utils/notify";
import { backdatedSaleSchema } from "~~/shared/utils/backdatedOrder";
import { createOfflineCustomer, isCustomerUniqueConflict, resolveOfflineCustomerConflict } from "~~/server/utils/customerAccount";

type CreatePackageSaleBody = {
  customerId: string;
  newCustomer?: { name?: string | null; phoneNumber?: string | null; email?: string | null } | null;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  discountAmount?: number;
  note?: string | null;
  slipImageId?: string | null;
  method?: "CASH" | "TRANSFER" | null;
  status?: "UNPAID" | "PENDING_VERIFICATION" | "PAID" | "CANCELLED" | null;
  backdated?: unknown;
};

const buildEntitlementState = (
  validityDays: number | null | undefined,
  credits: number | null | undefined,
  active: boolean,
  startAt: Date = new Date(),
) => {
  const creditTotal = credits ?? 0;
  if (!active) {
    return {
      status: "PENDING" as const,
      startAt: null,
      endAt: null,
      activatedAt: null,
      suspendedAt: null,
      creditInitial: creditTotal,
      creditRemaining: creditTotal,
    };
  }

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
  const recordedAt = new Date();
  const historyResult = backdatedSaleSchema(recordedAt).optional().safeParse(body.backdated);
  if (!historyResult.success) {
    throw createError({ statusCode: 400, statusMessage: historyResult.error.issues[0]?.message || "ข้อมูลย้อนหลังไม่ถูกต้อง" });
  }
  const history = historyResult.data;

  const customerId = body.customerId?.trim() || null;
  const newCustomer = body.newCustomer ?? null;

  if (!customerId && !newCustomer) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาเลือกลูกค้า" });
  }
  if (customerId && newCustomer) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาเลือกลูกค้าเดิมหรือเพิ่มลูกค้าใหม่อย่างใดอย่างหนึ่ง" });
  }
  if (newCustomer && !newCustomer.name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: "กรุณากรอกชื่อลูกค้า" });
  }
  if (newCustomer && !newCustomer.phoneNumber?.trim()) {
    throw createError({ statusCode: 400, statusMessage: "กรุณากรอกเบอร์โทรลูกค้า" });
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
    if (customerId) {
      const customer = await prisma.user.findFirst({
        where: { id: customerId, deletedAt: null },
        select: { id: true },
      });

      if (!customer) {
        throw createError({ statusCode: 404, statusMessage: "ไม่พบลูกค้าที่เลือก" });
      }
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
    const soldAt = history?.soldAt ?? now;

    if (body.status === "CANCELLED") {
      throw createError({
        statusCode: 400,
        statusMessage: "ไม่สามารถสร้างรายการขายในสถานะยกเลิกได้ กรุณาสร้างรายการก่อนแล้วจึงยกเลิก",
      });
    }
    const allowedStatuses = ["UNPAID", "PENDING_VERIFICATION", "PAID"] as const;
    const paymentStatus = history
      ? (history.payment ? "PAID" as const : "UNPAID" as const)
      : allowedStatuses.includes(body.status as typeof allowedStatuses[number])
        ? (body.status as typeof allowedStatuses[number])
        : "PAID";
    const isPaid = paymentStatus === "PAID";

    let activationToken: string | null = null;
    const created = await prisma.$transaction(async (tx) => {
      let paymentUserId = customerId!;
      if (newCustomer) {
        const offlineCustomer = await createOfflineCustomer(tx, {
          name: newCustomer.name!.trim(),
          phoneNumber: newCustomer.phoneNumber!.trim(),
          email: newCustomer.email?.trim() || null,
          createdByStaffId: actor.id,
        });
        paymentUserId = offlineCustomer.customer.id;
        activationToken = offlineCustomer.activationToken;
      }

      const packageSale = await tx.packageSale.create({
        data: {
          customerId: paymentUserId,
          soldById: actor.id,
          ...(history ? { createdAt: soldAt } : {}),
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
              customerId: paymentUserId,
              sourceSaleItemId: saleItem.id,
              productId: saleItem.product.id,
              ...buildEntitlementState(saleItem.product.validityDays, saleItem.product.credits, isPaid, soldAt),
            },
          });
        }
      }

      const method: "CASH" | "TRANSFER" | null = history
        ? history.payment?.method ?? null
        : body.method === "TRANSFER" || body.method === "CASH"
          ? body.method
          : body.slipImageId
            ? "TRANSFER"
            : "CASH";
      const payment = await tx.paymentRecord.create({
        data: {
          paymentNo: await createPaymentNo(),
          receiptNo: isPaid ? await createReceiptNo(now, tx) : null,
          userId: paymentUserId,
          packageSaleId: packageSale.id,
          amount: totalAmount,
          status: paymentStatus,
          method,
          slipImageId: body.slipImageId ?? null,
          note: body.note?.trim() || null,
          paidAt: history?.payment?.paidAt ?? (isPaid ? now : null),
          confirmedAt: isPaid ? now : null,
          confirmedById: isPaid ? actor.id : null,
          metadata: {
            createdByAdminId: actor.id,
            source: "admin-package-sales",
            ...(history ? { backdated: { recordedAt: recordedAt.toISOString(), recordedById: actor.id, soldAt: soldAt.toISOString() } } : {}),
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
          afterJson: {
            status: paymentStatus,
            method,
            source: "admin-package-sales",
            ...(history ? { backdated: true, soldAt: soldAt.toISOString(), paidAt: history.payment?.paidAt.toISOString() ?? null, recordedAt: recordedAt.toISOString() } : {}),
          },
        },
      });

      return { id: packageSale.id, paymentId: payment.id };
    });

    if (isPaid && !history) {
      void notifyReceipt({ paymentId: created.paymentId }).catch((err) => {
        console.error("[package-sales] notifyReceipt failed", err);
      });
    }
    return { ...created, activationToken };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;

    const duplicateCustomer = await resolveOfflineCustomerConflict(error, newCustomer ?? undefined);
    if (duplicateCustomer) {
      throw createError({
        statusCode: 409,
        statusMessage: "เบอร์โทรหรืออีเมลนี้มีบัญชีลูกค้าอยู่แล้ว",
        data: { customer: duplicateCustomer },
      });
    }
    if (isCustomerUniqueConflict(error)) {
      throw createError({ statusCode: 409, statusMessage: "เบอร์โทรหรืออีเมลนี้มีบัญชีอยู่แล้ว" });
    }

    console.error("[POST /api/admin/package-sales]", error);
    throw createError({ statusCode: 500, statusMessage: "Unable to create package sale" });
  }
});
