import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import { createReceiptNo } from "~~/server/utils/receiptNo";
import { notifyReceipt } from "~~/server/utils/notify";

type ConfirmPaymentBody = {
  method: "CASH" | "TRANSFER";
  slipImageId?: string | null;
  note?: string | null;
};

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["EMPLOYEE", "ADMIN"]);
  const paymentId = getRouterParam(event, "id");

  if (!paymentId) {
    throw createError({ statusCode: 400, statusMessage: "ไม่พบรหัสการชำระเงิน" });
  }

  const body = await readBody<ConfirmPaymentBody>(event);

  if (body.method !== "CASH" && body.method !== "TRANSFER") {
    throw createError({ statusCode: 400, statusMessage: "วิธีชำระเงินไม่ถูกต้อง" });
  }

  const slipImageId = body.slipImageId?.trim() || null;

  if (body.method === "TRANSFER" && !slipImageId) {
    throw createError({ statusCode: 400, statusMessage: "การโอนเงินต้องแนบสลิปการโอน" });
  }

  if (slipImageId) {
    const slip = await prisma.image.findFirst({ where: { id: slipImageId, deletedAt: null }, select: { id: true } });
    if (!slip) {
      throw createError({ statusCode: 404, statusMessage: "ไม่พบรูปสลิปการโอน" });
    }
  }

  const existing = await prisma.paymentRecord.findFirst({
    where: { id: paymentId, deletedAt: null },
    select: { id: true, status: true, amount: true, slipImageId: true, method: true, paidAt: true, receiptNo: true },
  });

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: "ไม่พบการชำระเงิน" });
  }

  if (existing.status === "PAID") {
    throw createError({ statusCode: 409, statusMessage: "การชำระเงินนี้ได้รับการยืนยันแล้ว" });
  }

  if (existing.status === "CANCELLED") {
    throw createError({ statusCode: 409, statusMessage: "การชำระเงินนี้ถูกยกเลิกแล้ว" });
  }

  const now = new Date();
  const receiptNo = existing.receiptNo ?? (await createReceiptNo(now));

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.paymentRecord.updateMany({
      where: { id: paymentId, status: { not: "PAID" }, deletedAt: null },
      data: {
        status: "PAID",
        method: body.method,
        slipImageId,
        paidAt: now,
        confirmedAt: now,
        confirmedById: actor.id,
        receiptNo,
        note: body.note?.trim() || undefined,
      },
    });

    if (result.count === 0) {
      throw createError({ statusCode: 409, statusMessage: "การชำระเงินนี้ได้รับการยืนยันโดยผู้อื่นแล้ว" });
    }

    await tx.paymentAuditLog.create({
      data: {
        paymentId,
        action: "CONFIRMED",
        actorId: actor.id,
        beforeJson: {
          status: existing.status,
          method: existing.method,
          slipImageId: existing.slipImageId,
        },
        afterJson: {
          status: "PAID",
          method: body.method,
          slipImageId,
          receiptNo,
          confirmedAt: now.toISOString(),
        },
      },
    });

    return tx.paymentRecord.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        status: true,
        method: true,
        receiptNo: true,
        paymentNo: true,
        paidAt: true,
        confirmedAt: true,
        amount: true,
      },
    });
  });

  void notifyReceipt({ paymentId }).catch((error) => {
    console.error("[notifyReceipt]", error);
  });

  return updated;
});
