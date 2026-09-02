import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import { getNotificationPolicy } from "~~/server/utils/appSetting";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN", "EMPLOYEE"]);

  // DB-06 read cutover: the policy resolves from AppSetting with per-field
  // legacy fallback and soak comparison (plan Phase 5.1).
  const setting = await getNotificationPolicy();

  const subscribers = await prisma.notificationSubscriber.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          accounts: {
            where: { providerId: "line" },
            select: { accountId: true },
            take: 1,
          },
        },
      },
    },
  });

  return {
    setting,
    subscribers: subscribers.map((sub) => ({
      id: sub.id,
      userId: sub.userId,
      isActive: sub.isActive,
      receiveNewOrder: sub.receiveNewOrder,
      receiveStatusChange: sub.receiveStatusChange,
      receiveReceipt: sub.receiveReceipt,
      createdAt: sub.createdAt,
      user: {
        id: sub.user.id,
        name: sub.user.name,
        email: sub.user.email,
        image: sub.user.image,
        role: sub.user.role,
        hasLineLinked: sub.user.accounts.length > 0,
      },
    })),
  };
});
