import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import { createReceiptNo } from "~~/server/utils/receiptNo";
import { notifyReceipt } from "~~/server/utils/notify";
import type { PaymentMethod, PaymentStatus } from "~~/shared/types/enums";

type UpdatePaymentStateBody = {
  status?: PaymentStatus;
  method?: PaymentMethod | null;
  slipImageId?: string | null;
};

const paymentStatuses = new Set<PaymentStatus>(["UNPAID", "PENDING_VERIFICATION", "PAID", "CANCELLED"]);
const paymentMethods = new Set<PaymentMethod>(["CASH", "TRANSFER"]);

const packageSaleStatusByPaymentStatus: Record<PaymentStatus, "PENDING" | "PAID" | "CANCELLED"> = {
  UNPAID: "PENDING",
  PENDING_VERIFICATION: "PENDING",
  PAID: "PAID",
  CANCELLED: "CANCELLED",
};

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["ADMIN", "EMPLOYEE"]);
  const paymentId = getRouterParam(event, "id");

  if (!paymentId) {
    throw createError({ statusCode: 400, statusMessage: "ไม่พบรหัสการชำระเงิน" });
  }

  const body = await readBody<UpdatePaymentStateBody>(event).catch(() => ({} as UpdatePaymentStateBody));
  const nextStatus = body.status;

  if (!nextStatus || !paymentStatuses.has(nextStatus)) {
    throw createError({ statusCode: 400, statusMessage: "สถานะการชำระเงินไม่ถูกต้อง" });
  }

  if (body.method != null && !paymentMethods.has(body.method)) {
    throw createError({ statusCode: 400, statusMessage: "วิธีชำระเงินไม่ถูกต้อง" });
  }

  const existing = await prisma.paymentRecord.findFirst({
    where: { id: paymentId, deletedAt: null },
    select: {
      id: true,
      status: true,
      method: true,
      paidAt: true,
      confirmedAt: true,
      confirmedById: true,
      receiptNo: true,
      packageSaleId: true,
      slipImageId: true,
    },
  });

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: "ไม่พบการชำระเงิน" });
  }

  const nextMethod = body.method === undefined ? existing.method : body.method;

  if (nextStatus === "PAID" && !nextMethod) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาเลือกวิธีชำระเงินเมื่อสถานะเป็นชำระแล้ว" });
  }

  const slipProvided = Object.prototype.hasOwnProperty.call(body, "slipImageId");
  const nextSlipImageId = slipProvided ? body.slipImageId ?? null : existing.slipImageId;

  if (slipProvided && body.slipImageId) {
    const slipExists = await prisma.image.findFirst({
      where: { id: body.slipImageId },
      select: { id: true },
    });
    if (!slipExists) {
      throw createError({ statusCode: 400, statusMessage: "ไม่พบหลักฐานการชำระเงิน" });
    }
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const receiptNo = nextStatus === "PAID" ? existing.receiptNo ?? (await createReceiptNo(now, tx)) : existing.receiptNo;

    await tx.paymentRecord.update({
      where: { id: paymentId },
      data: {
        status: nextStatus,
        method: nextMethod ?? null,
        receiptNo,
        slipImageId: nextSlipImageId,
        paidAt: nextStatus === "PAID" ? existing.paidAt ?? now : null,
        confirmedAt: nextStatus === "PAID" ? existing.confirmedAt ?? now : null,
        confirmedById: nextStatus === "PAID" ? existing.confirmedById ?? actor.id : null,
      },
    });

    if (existing.packageSaleId) {
      await tx.packageSale.update({
        where: { id: existing.packageSaleId },
        data: { status: packageSaleStatusByPaymentStatus[nextStatus] },
      });
    }

    await tx.paymentAuditLog.create({
      data: {
        paymentId,
        action: "UPDATED",
        actorId: actor.id,
        beforeJson: {
          status: existing.status,
          method: existing.method,
          paidAt: existing.paidAt?.toISOString() ?? null,
          confirmedAt: existing.confirmedAt?.toISOString() ?? null,
          confirmedById: existing.confirmedById,
          receiptNo: existing.receiptNo,
          slipImageId: existing.slipImageId,
        },
        afterJson: {
          status: nextStatus,
          method: nextMethod,
          paidAt: nextStatus === "PAID" ? (existing.paidAt ?? now).toISOString() : null,
          confirmedAt: nextStatus === "PAID" ? (existing.confirmedAt ?? now).toISOString() : null,
          confirmedById: nextStatus === "PAID" ? existing.confirmedById ?? actor.id : null,
          receiptNo,
          slipImageId: nextSlipImageId,
        },
      },
    });
  });

  if (nextStatus === "PAID") {
    void notifyReceipt({ paymentId }).catch((err) => {
      console.error("[state.put] notifyReceipt failed", err);
    });
  }

  return { id: paymentId, status: nextStatus, method: nextMethod ?? null };
});
