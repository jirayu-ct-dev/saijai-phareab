import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  requireRole(event, ["EMPLOYEE", "ADMIN"]);
  const serviceOrderId = getRouterParam(event, "id");
  const notificationId = getRouterParam(event, "notificationId");
  if (!serviceOrderId || !notificationId) {
    throw createError({ statusCode: 400, statusMessage: "ไม่พบงานแจ้งเตือน" });
  }

  const job = await prisma.pickupConfirmationNotification.findFirst({
    where: {
      id: notificationId,
      confirmation: {
        serviceOrderId,
        status: "ACTIVE",
      },
    },
    include: {
      confirmation: {
        select: {
          revision: true,
          response: true,
          serviceOrder: { select: { status: true, dueAt: true, deletedAt: true } },
        },
      },
    },
  });
  if (!job) throw createError({ statusCode: 404, statusMessage: "ไม่พบงานแจ้งเตือน" });
  if (job.revision !== job.confirmation.revision || job.confirmation.response) {
    throw createError({ statusCode: 409, statusMessage: "งานแจ้งเตือนนี้ไม่ใช่รอบปัจจุบัน" });
  }
  if (job.confirmation.serviceOrder.deletedAt
    || ["COMPLETED", "CANCELLED"].includes(job.confirmation.serviceOrder.status)
    || (job.confirmation.serviceOrder.dueAt && job.confirmation.serviceOrder.dueAt <= new Date())) {
    throw createError({ statusCode: 409, statusMessage: "เลยเวลาที่เหมาะสมสำหรับส่งข้อความนี้แล้ว" });
  }
  if (job.status !== "FAILED" && job.status !== "UNREACHABLE") {
    throw createError({ statusCode: 409, statusMessage: "ส่งซ้ำได้เฉพาะงานที่ส่งไม่สำเร็จ" });
  }

  const now = new Date();
  await prisma.pickupConfirmationNotification.update({
    where: { id: job.id },
    data: {
      status: "PENDING",
      scheduledFor: now,
      manualRetryRequestedAt: now,
      claimExpiresAt: null,
    },
  });
  return { ok: true };
});
