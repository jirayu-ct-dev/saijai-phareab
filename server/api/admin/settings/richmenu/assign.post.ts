import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import {
  setDefaultRichMenu,
  cancelDefaultRichMenu,
  syncUserRichMenu,
} from "~~/server/utils/line-messaging";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const body = await readBody<{
    id: string;
    targetRole: string | null;
    isDefault: boolean;
  }>(event);

  if (!body?.id) {
    throw createError({ statusCode: 400, statusMessage: "ไม่พบ id" });
  }

  const menu = await prisma.lineRichMenu.findUnique({ where: { id: body.id } });
  if (!menu) {
    throw createError({ statusCode: 404, statusMessage: "ไม่พบ Rich Menu" });
  }

  try {
    const wasDefault = menu.isDefault;

    // 1. If setting as default, clear all others in DB first
    if (body.isDefault) {
      await prisma.lineRichMenu.updateMany({
        where: { id: { not: body.id } },
        data: { isDefault: false },
      });
    }

    // 2. Update the menu
    await prisma.lineRichMenu.update({
      where: { id: body.id },
      data: {
        targetRole: body.targetRole ?? null,
        isDefault: body.isDefault,
      },
    });

    // 3. Sync LINE default state
    if (body.isDefault) {
      await setDefaultRichMenu(menu.richMenuId);
    } else if (wasDefault && !body.isDefault) {
      await cancelDefaultRichMenu();
    }

    // 4. Background sync all LINE-linked users
    prisma.account
      .findMany({
        where: { providerId: "line" },
        select: { userId: true },
      })
      .then((accounts) => {
        for (const acc of accounts) {
          syncUserRichMenu(acc.userId).catch(() => {});
        }
      })
      .catch(() => {});

    return { success: true };
  } catch (error) {
    console.error("[POST /api/admin/settings/richmenu/assign]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "ไม่สามารถกำหนดการตั้งค่า Rich Menu ได้",
    });
  }
});
