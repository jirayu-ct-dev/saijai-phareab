import { addDays } from "date-fns";
import type { PaymentMethod, PaymentStatus } from "~~/shared/types/enums";
import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

interface UpdatePaymentBody {
  customerId?: string;
  productId?: string;
  amount?: number;
  paymentMethod?: PaymentMethod;
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
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "ไม่พบรหัสรายการชำระเงิน" });
  }

  const body = await readBody<UpdatePaymentBody>(event);

  try {
    const existing = await prisma.paymentRecord.findFirst({
      where: { id, deletedAt: null },
      include: {
        memberEntitlement: {
          select: {
            id: true,
            productId: true,
          },
        },
        packageSale: {
          select: {
            id: true,
            note: true,
            items: {
              orderBy: [{ createdAt: "asc" }],
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!existing || !existing.memberEntitlement || !existing.packageSale) {
      throw createError({ statusCode: 404, statusMessage: "ไม่พบรายการชำระเงินที่ต้องการแก้ไข" });
    }

    const existingMemberEntitlement = existing.memberEntitlement;
    const existingPackageSale = existing.packageSale;

    const nextCustomerId = body.customerId ?? existing.userId;
    const nextProductId = body.productId ?? existingMemberEntitlement.productId;
    const nextAmount = body.amount ?? Number(existing.amount);
    const nextPaymentMethod = body.paymentMethod ?? existing.paymentMethod;
    const nextStatus = body.status ?? existing.status;
    const nextNote = body.note !== undefined ? body.note?.trim() || null : (existing.note ?? existingPackageSale.note ?? null);
    const nextSlipImageId = body.slipImageId !== undefined ? body.slipImageId : existing.slipImageId;

    if (!Number.isFinite(Number(nextAmount)) || Number(nextAmount) < 0) {
      throw createError({ statusCode: 400, statusMessage: "กรุณาระบุจำนวนเงินให้ถูกต้อง" });
    }
    if (nextPaymentMethod === "TRANSFER" && !nextSlipImageId) {
      throw createError({ statusCode: 400, statusMessage: "กรุณาอัปโหลดสลิปสำหรับรายการโอน" });
    }

    const customer = await prisma.user.findFirst({
      where: { id: nextCustomerId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) {
      throw createError({ statusCode: 404, statusMessage: "ไม่พบลูกค้าที่เลือก" });
    }

    const pkg = await prisma.packageProduct.findFirst({
      where: { id: nextProductId, deletedAt: null, isActive: true },
    });

    if (!pkg) {
      throw createError({ statusCode: 404, statusMessage: "ไม่พบ package ที่เลือก" });
    }

    const mainSaleItem = existingPackageSale.items[0];
    if (!mainSaleItem) {
      throw createError({ statusCode: 409, statusMessage: "ข้อมูล package sale ไม่สมบูรณ์" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.packageSale.update({
        where: { id: existingPackageSale.id },
        data: {
          customerId: nextCustomerId,
          status: nextStatus === "VERIFIED" ? "PAID" : nextStatus === "FAILED" ? "CANCELLED" : "PENDING",
          subtotalAmount: nextAmount,
          discountAmount: 0,
          totalAmount: nextAmount,
          note: nextNote,
        },
      });

      await tx.packageSaleItem.update({
        where: { id: mainSaleItem.id },
        data: {
          productId: nextProductId,
          itemType: pkg.packageType,
          qty: 1,
          unitPrice: nextAmount,
          totalPrice: nextAmount,
        },
      });

      await tx.memberEntitlement.update({
        where: { id: existingMemberEntitlement.id },
        data: {
          customerId: nextCustomerId,
          productId: nextProductId,
          ...buildEntitlementState(pkg.validityDays, pkg.credits, nextStatus),
          deletedAt: null,
          deletedById: null,
        },
      });

      const isVerified = nextStatus === "VERIFIED";

      return tx.paymentRecord.update({
        where: { id },
        data: {
          userId: nextCustomerId,
          memberEntitlementId: existingMemberEntitlement.id,
          packageSaleId: existingPackageSale.id,
          amount: nextAmount,
          paymentMethod: nextPaymentMethod,
          slipImageId: nextSlipImageId ?? null,
          status: nextStatus,
          note: nextNote,
          paidAt: isVerified ? new Date() : null,
          verifiedById: isVerified ? actor.id : null,
          verifiedAt: isVerified ? new Date() : null,
          rejectionReason: nextStatus === "FAILED" ? "ระบุโดยผู้ดูแลระบบ" : null,
          metadata: {
            updatedByAdminId: actor.id,
          },
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
      statusMessage: "Unable to update payment",
    });
  }
});
