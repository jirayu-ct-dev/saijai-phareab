import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

type CancelPaymentBody = { note?: string | null };

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["ADMIN"]);
  const paymentId = getRouterParam(event, "id");

  if (!paymentId) {
    throw createError({ statusCode: 400, statusMessage: "ไม่พบรหัสการชำระเงิน" });
  }

  const body = await readBody<CancelPaymentBody>(event).catch(() => ({} as CancelPaymentBody));

  const existing = await prisma.paymentRecord.findFirst({
    where: { id: paymentId, deletedAt: null },
    select: { id: true, status: true, method: true, slipImageId: true },
  });

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: "ไม่พบการชำระเงิน" });
  }

  if (existing.status === "PAID") {
    throw createError({ statusCode: 409, statusMessage: "ไม่สามารถยกเลิกการชำระเงินที่ยืนยันแล้ว" });
  }

  if (existing.status === "CANCELLED") {
    return { id: paymentId, status: "CANCELLED" as const };
  }

  await prisma.$transaction(async (tx) => {
    await tx.paymentRecord.update({
      where: { id: paymentId },
      data: { status: "CANCELLED" },
    });
    await tx.paymentAuditLog.create({
      data: {
        paymentId,
        action: "CANCELLED",
        actorId: actor.id,
        beforeJson: { status: existing.status },
        afterJson: { status: "CANCELLED" },
        note: body.note?.trim() || null,
      },
    });
  });

  return { id: paymentId, status: "CANCELLED" as const };
});
