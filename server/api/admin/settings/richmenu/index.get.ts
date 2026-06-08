import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  try {
    const [richMenus, syncedUsersCount] = await Promise.all([
      prisma.lineRichMenu.findMany({
        orderBy: { createdAt: "desc" },
      }),
      prisma.account.count({
        where: { providerId: "line" },
      }),
    ]);

    return { richMenus, syncedUsersCount };
  } catch (error) {
    console.error("[GET /api/admin/settings/richmenu]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "ไม่สามารถโหลดข้อมูล Rich Menu ได้",
    });
  }
});
