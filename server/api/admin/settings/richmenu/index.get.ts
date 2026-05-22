import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const richMenus = await prisma.lineRichMenu.findMany({
    orderBy: { createdAt: "desc" },
  });

  const syncedUsersCount = await prisma.account.count({
    where: { providerId: "line" },
  });

  return {
    richMenus,
    syncedUsersCount,
  };
});
