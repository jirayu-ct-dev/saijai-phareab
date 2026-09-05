import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  await requireRole(event, ["EMPLOYEE", "ADMIN"]);

  const now = new Date();
  const bangkokOffset = 7 * 60 * 60 * 1000;
  const bangkokNow = new Date(now.getTime() + bangkokOffset);
  const y = bangkokNow.getUTCFullYear();
  const m = bangkokNow.getUTCMonth();
  const d = bangkokNow.getUTCDate();
  const todayStart = new Date(Date.UTC(y, m, d) - bangkokOffset);
  const todayEnd = new Date(Date.UTC(y, m, d + 1) - bangkokOffset);

  const [receivedToday, inProgress, readyToDeliver, completedToday] = await Promise.all([
    prisma.serviceOrder.count({
      where: { deletedAt: null, status: { not: "CANCELLED" }, receivedAt: { gte: todayStart, lt: todayEnd } },
    }),
    prisma.serviceOrder.count({
      where: { deletedAt: null, status: { in: ["RECEIVED", "PROCESSING"] } },
    }),
    prisma.serviceOrder.count({
      where: { deletedAt: null, status: "DELIVERING" },
    }),
    prisma.serviceOrder.count({
      where: {
        deletedAt: null,
        status: "COMPLETED",
        OR: [
          { completedAt: { gte: todayStart, lt: todayEnd } },
          { completedAt: null, updatedAt: { gte: todayStart, lt: todayEnd } },
        ],
      },
    }),
  ]);

  return { receivedToday, inProgress, readyToDeliver, completedToday };
});
