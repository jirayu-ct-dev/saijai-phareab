import { prisma } from "~~/server/utils/prisma";
import { requireUser } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const actor = requireUser(event);

  const user = await prisma.user.findFirst({
    where: { id: actor.id, deletedAt: null },
    select: {
      id: true,
      lineNotifyEnabled: true,
      accounts: {
        where: { providerId: "line" },
        select: { accountId: true },
        take: 1,
      },
    },
  });

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: "ไม่พบผู้ใช้" });
  }

  return {
    lineNotifyEnabled: user.lineNotifyEnabled,
    hasLineLinked: user.accounts.length > 0,
  };
});
