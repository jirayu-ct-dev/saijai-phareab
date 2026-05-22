import { z } from "zod/v4";
import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import { createRichMenuAlias, deleteRichMenuAlias } from "~~/server/utils/line-messaging";

const schema = z.object({
  id: z.string(),
  aliasId: z.string().min(1).max(30),
});

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const body = await readValidatedBody(event, schema.parse);
  const { id, aliasId } = body;

  const richMenu = await prisma.lineRichMenu.findUnique({
    where: { id },
  });

  if (!richMenu) {
    throw createError({ statusCode: 404, statusMessage: "ไม่พบ Rich Menu ในระบบ" });
  }

  try {
    // 1. If this exact alias was already registered elsewhere on LINE, delete it first to avoid conflicts
    await deleteRichMenuAlias(aliasId).catch(() => {});

    // 2. If this menu had a different aliasId previously, delete that one too
    if (richMenu.aliasId && richMenu.aliasId !== aliasId) {
      await deleteRichMenuAlias(richMenu.aliasId).catch(() => {});
    }

    // 3. Register the new alias on LINE
    console.log(`[LINE RichMenu] Creating alias '${aliasId}' for richMenuId: ${richMenu.richMenuId}`);
    await createRichMenuAlias(aliasId, richMenu.richMenuId);

    // 4. Update aliasId in local database
    const updated = await prisma.lineRichMenu.update({
      where: { id },
      data: { aliasId },
    });

    return updated;
  } catch (error: any) {
    console.error(`[LINE RichMenu Alias API] Failed:`, error);
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || "เกิดข้อผิดพลาดในการสร้าง Rich Menu Alias บน LINE",
    });
  }
});
