import type { ServiceOrderStatus } from "~~/shared/types/enums";
import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

type UpdateStatusBody = {
  status?: ServiceOrderStatus;
};

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["EMPLOYEE", "ADMIN"]);
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "ไม่พบรหัสรายการรับผ้า" });
  }

  const body = await readBody<UpdateStatusBody>(event);
  const status = body.status;
  const allowedStatuses: ServiceOrderStatus[] = [
    "RECEIVED",
    "PENDING",
    "CHECKING",
    "PROCESSING",
    "PENDING_REVIEW",
    "COMPLETED",
    "CANCELLED",
  ];

  if (!status || !allowedStatuses.includes(status)) {
    throw createError({ statusCode: 400, statusMessage: "สถานะงานไม่ถูกต้อง" });
  }

  const existing = await prisma.serviceOrder.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: {
      id: true,
      status: true,
      employeeId: true,
      orderNo: true,
      updatedAt: true,
    },
  });

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: "ไม่พบรายการรับผ้า" });
  }

  const updated = await prisma.serviceOrder.update({
    where: { id },
    data: {
      status,
      employeeId: existing.employeeId ?? actor.id,
    },
    select: {
      id: true,
      orderNo: true,
      status: true,
      updatedAt: true,
    },
  });

  return {
    id: updated.id,
    orderNo: updated.orderNo,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  };
});
