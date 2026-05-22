import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import { deleteRichMenuAlias } from "~~/server/utils/line-messaging";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const query = getQuery(event);
  const id = query.id as string;

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาระบุ ID ของ Rich Menu" });
  }

  const richMenu = await prisma.lineRichMenu.findUnique({
    where: { id },
  });

  if (!richMenu) {
    throw createError({ statusCode: 404, statusMessage: "ไม่พบ Rich Menu ในระบบ" });
  }

  if (!richMenu.aliasId) {
    return richMenu; // Already deleted
  }

  try {
    // 1. Delete alias on LINE
    console.log(`[LINE RichMenu] Deleting alias '${richMenu.aliasId}' for richMenuId: ${richMenu.richMenuId}`);
    await deleteRichMenuAlias(richMenu.aliasId).catch((err) =>
      console.warn(`[LINE RichMenu] Failed to delete alias ${richMenu.aliasId} on LINE:`, err?.message || err),
    );

    // 2. Update database
    const updated = await prisma.lineRichMenu.update({
      where: { id },
      data: { aliasId: null },
    });

    return updated;
  } catch (error: any) {
    console.error(`[LINE RichMenu Delete Alias API] Failed:`, error);
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || "เกิดข้อผิดพลาดในการลบ Rich Menu Alias",
    });
  }
});
