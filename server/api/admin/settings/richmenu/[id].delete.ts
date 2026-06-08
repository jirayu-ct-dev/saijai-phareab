import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import { deleteRichMenu, deleteRichMenuAlias } from "~~/server/utils/line-messaging";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "ไม่พบ id" });
  }

  const menu = await prisma.lineRichMenu.findUnique({ where: { id } });
  if (!menu) {
    throw createError({ statusCode: 404, statusMessage: "ไม่พบ Rich Menu" });
  }

  try {
    // 1. Delete alias from LINE if exists
    if (menu.aliasId) {
      await deleteRichMenuAlias(menu.aliasId).catch((err) => {
        console.warn("[DELETE richmenu] Failed to delete alias:", err?.message || err);
      });
    }

    // 2. Delete from LINE
    await deleteRichMenu(menu.richMenuId).catch((err) => {
      console.warn("[DELETE richmenu] Failed to delete from LINE:", err?.message || err);
    });

    // 3. Delete from DB
    await prisma.lineRichMenu.delete({ where: { id } });

    return { success: true };
  } catch (error) {
    console.error("[DELETE /api/admin/settings/richmenu/:id]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "ไม่สามารถลบ Rich Menu ได้",
    });
  }
});
