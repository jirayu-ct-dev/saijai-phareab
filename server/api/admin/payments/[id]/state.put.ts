import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import { createReceiptNo } from "~~/server/utils/receiptNo";
import { notifyReceipt } from "~~/server/utils/notify";
import {
  applyPaymentStateTransition,
  canTransitionPaymentStatus,
  paymentMethods,
  paymentStatuses,
} from "~~/server/utils/paymentStateTransition";
import type { PaymentMethod, PaymentStatus } from "~~/shared/types/enums";

type UpdatePaymentStateBody = {
  status?: PaymentStatus;
  method?: PaymentMethod | null;
  slipImageId?: string | null;
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

  if (!canTransitionPaymentStatus(existing.status, nextStatus)) {
    throw createError({ statusCode: 409, statusMessage: "ไม่สามารถเปลี่ยนสถานะการชำระเงินนี้ได้" });
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
    await applyPaymentStateTransition({
      tx,
      paymentId,
      existing,
      nextStatus,
      nextMethod: nextMethod ?? null,
      nextSlipImageId,
      actorId: actor.id,
      now,
      createReceiptNo: (date, receiptTx) => createReceiptNo(date, receiptTx as never),
    });
  });

  if (nextStatus === "PAID") {
    void notifyReceipt({ paymentId }).catch((err) => {
      console.error("[state.put] notifyReceipt failed", err);
    });
  }

  return { id: paymentId, status: nextStatus, method: nextMethod ?? null };
});
