import { addDays } from "date-fns";
import type { PaymentMethod, PaymentStatus } from "~~/shared/types/enums";
import { requireRole } from "~~/server/utils/auth";
import { createPaymentNo } from "~~/server/utils/paymentNo";
import { prisma } from "~~/server/utils/prisma";

interface CreatePaymentBody {
  customerId: string;
  productId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  status?: PaymentStatus;
  note?: string | null;
  slipImageId?: string | null;
}

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

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["ADMIN"]);
  const body = await readBody<CreatePaymentBody>(event);

  if (!body.customerId) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาเลือกลูกค้า" });
  }
  if (!body.productId) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาเลือก package" });
  }
  if (!Number.isFinite(Number(body.amount)) || Number(body.amount) < 0) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาระบุจำนวนเงินให้ถูกต้อง" });
  }

  const paymentMethod = body.paymentMethod;
  if (paymentMethod !== "CASH" && paymentMethod !== "TRANSFER") {
    throw createError({ statusCode: 400, statusMessage: "ช่องทางการชำระเงินไม่ถูกต้อง" });
  }
  if (paymentMethod === "TRANSFER" && !body.slipImageId) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาอัปโหลดสลิปสำหรับรายการโอน" });
  }

  const status: PaymentStatus = body.status ?? (paymentMethod === "CASH" ? "VERIFIED" : "PENDING");
  const isVerified = status === "VERIFIED";
  const paidAt = isVerified ? new Date() : null;

  try {
    const customer = await prisma.user.findFirst({
      where: { id: body.customerId, deletedAt: null },
      select: { id: true },
    });

    if (!customer) {
      throw createError({ statusCode: 404, statusMessage: "ไม่พบลูกค้าที่เลือก" });
    }

    const pkg = await prisma.packageProduct.findFirst({
      where: { id: body.productId, deletedAt: null, isActive: true },
    });

    if (!pkg) {
      throw createError({ statusCode: 404, statusMessage: "ไม่พบ package ที่เลือก" });
    }

    const created = await prisma.$transaction(async (tx) => {
      const packageSale = await tx.packageSale.create({
        data: {
          customerId: body.customerId,
          soldById: actor.id,
          status: status === "VERIFIED" ? "PAID" : status === "FAILED" ? "CANCELLED" : "PENDING",
          subtotalAmount: body.amount,
          discountAmount: 0,
          totalAmount: body.amount,
          note: body.note?.trim() || null,
          items: {
            create: {
              productId: pkg.id,
              itemType: pkg.packageType,
              qty: 1,
              unitPrice: body.amount,
              totalPrice: body.amount,
            },
          },
        },
        include: {
          items: true,
        },
      });

      const mainItem = packageSale.items[0];
      if (!mainItem) {
        throw createError({ statusCode: 500, statusMessage: "Unable to initialize package sale item" });
      }

      const mainEntitlement = await tx.memberEntitlement.create({
        data: {
          customerId: body.customerId,
          sourceSaleItemId: mainItem.id,
          productId: pkg.id,
          ...buildEntitlementState(pkg.validityDays, pkg.credits, status),
        },
      });

      return tx.paymentRecord.create({
        data: {
          paymentNo: createPaymentNo(),
          userId: body.customerId,
          memberEntitlementId: mainEntitlement.id,
          packageSaleId: packageSale.id,
          amount: body.amount,
          paymentMethod,
          slipImageId: body.slipImageId ?? null,
          status,
          note: body.note?.trim() || null,
          paidAt,
          verifiedById: isVerified ? actor.id : null,
          verifiedAt: isVerified ? new Date() : null,
          rejectionReason: status === "FAILED" ? "บันทึกรายการไม่สำเร็จ" : null,
          metadata: {
            createdByAdminId: actor.id,
          },
        },
      });
    });

    return created;
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    console.error("[POST /api/admin/payments]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Unable to create payment",
    });
  }
});
