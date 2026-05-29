import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import {
  createRichMenuAlias,
  deleteRichMenuAlias,
} from "~~/server/utils/line-messaging";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const body = await readBody<{ id: string; aliasId: string }>(event);

  if (!body?.id) {
    throw createError({ statusCode: 400, statusMessage: "ไม่พบ id" });
  }

  if (!body?.aliasId?.trim()) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาระบุ aliasId" });
  }

  const menu = await prisma.lineRichMenu.findUnique({ where: { id: body.id } });
  if (!menu) {
    throw createError({ statusCode: 404, statusMessage: "ไม่พบ Rich Menu" });
  }

  try {
    // 1. Delete old alias on LINE if the menu already has one
    if (menu.aliasId) {
      await deleteRichMenuAlias(menu.aliasId).catch((err) => {
        console.warn("[alias.post] Failed to delete old alias:", err?.message || err);
      });
    }

    // 2. Create the new alias on LINE
    await createRichMenuAlias(body.aliasId.trim(), menu.richMenuId);

    // 3. Save to DB
    await prisma.lineRichMenu.update({
      where: { id: body.id },
      data: { aliasId: body.aliasId.trim() },
    });

    return { success: true };
  } catch (error) {
    console.error("[POST /api/admin/settings/richmenu/alias]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "ไม่สามารถสร้าง Rich Menu Alias ได้",
    });
  }
});
