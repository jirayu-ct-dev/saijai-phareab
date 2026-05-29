import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import { deleteRichMenuAlias } from "~~/server/utils/line-messaging";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const query = getQuery(event);
  const id = query.id as string | undefined;

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "ไม่พบ id" });
  }

  const menu = await prisma.lineRichMenu.findUnique({ where: { id } });
  if (!menu) {
    throw createError({ statusCode: 404, statusMessage: "ไม่พบ Rich Menu" });
  }

  if (!menu.aliasId) {
    throw createError({ statusCode: 404, statusMessage: "Rich Menu นี้ไม่มี Alias" });
  }

  try {
    // 1. Delete alias on LINE
    await deleteRichMenuAlias(menu.aliasId);

    // 2. Clear aliasId in DB
    await prisma.lineRichMenu.update({
      where: { id },
      data: { aliasId: null },
    });

    return { success: true };
  } catch (error) {
    console.error("[DELETE /api/admin/settings/richmenu/alias]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "ไม่สามารถลบ Rich Menu Alias ได้",
    });
  }
});
