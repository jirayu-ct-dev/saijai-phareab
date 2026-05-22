import { z } from "zod/v4";
import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import { setDefaultRichMenu, cancelDefaultRichMenu, syncUserRichMenu } from "~~/server/utils/line-messaging";

const schema = z.object({
  id: z.string(),
  targetRole: z.enum(["USER", "MEMBER", "EMPLOYEE", "ADMIN"]).nullable().optional(),
  isDefault: z.boolean().optional(),
});

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const body = await readValidatedBody(event, schema.parse);
  const { id, targetRole, isDefault } = body;

  const richMenu = await prisma.lineRichMenu.findUnique({
    where: { id },
  });

  if (!richMenu) {
    throw createError({ statusCode: 404, statusMessage: "ไม่พบ Rich Menu ในระบบ" });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Handle default changes
      if (isDefault !== undefined) {
        if (isDefault) {
          // Reset default status of other rich menus
          await tx.lineRichMenu.updateMany({
            data: { isDefault: false },
          });
        }
      }

      // 2. Handle role mapping changes
      if (targetRole !== undefined && targetRole !== null) {
        // Reset role mapping of other rich menus for this specific role
        await tx.lineRichMenu.updateMany({
          where: { targetRole },
          data: { targetRole: null },
        });
      }

      return await tx.lineRichMenu.update({
        where: { id },
        data: {
          ...(targetRole !== undefined ? { targetRole } : {}),
          ...(isDefault !== undefined ? { isDefault } : {}),
        },
      });
    });

    // Apply default changes on LINE Messaging API
    if (isDefault !== undefined) {
      if (isDefault) {
        await setDefaultRichMenu(richMenu.richMenuId);
      } else if (richMenu.isDefault) {
        await cancelDefaultRichMenu().catch(() => {});
      }
    }

    // Mass sync all users in background
    void (async () => {
      try {
        console.log(`[LINE RichMenu] Mass syncing users after re-assignment...`);
        // We sync ALL active users to make sure everyone is on their correct menu
        const users = await prisma.user.findMany({
          where: { deletedAt: null, isActive: true },
          select: { id: true },
        });

        console.log(`[LINE RichMenu] Syncing ${users.length} users...`);
        for (const user of users) {
          await syncUserRichMenu(user.id);
        }
        console.log(`[LINE RichMenu] Re-assignment sync complete!`);
      } catch (err) {
        console.error(`[LINE RichMenu] Mass sync error:`, err);
      }
    })();

    return updated;
  } catch (error: any) {
    console.error(`[LINE RichMenu Assign API] Failed:`, error);
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || "เกิดข้อผิดพลาดในการกำหนดบทบาทของ Rich Menu",
    });
  }
});
