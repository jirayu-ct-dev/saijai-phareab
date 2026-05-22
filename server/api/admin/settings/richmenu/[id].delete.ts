import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import { deleteRichMenu, deleteRichMenuAlias, syncUserRichMenu } from "~~/server/utils/line-messaging";
import { deleteImageFromCloudinary } from "~~/server/utils/cloudinary";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาระบุ ID ของ Rich Menu" });
  }

  const richMenu = await prisma.lineRichMenu.findUnique({
    where: { id },
  });

  if (!richMenu) {
    throw createError({ statusCode: 404, statusMessage: "ไม่พบ Rich Menu ในระบบ" });
  }

  try {
    // 1. Delete alias on LINE if any
    if (richMenu.aliasId) {
      console.log(`[LINE RichMenu] Deleting alias: ${richMenu.aliasId}`);
      await deleteRichMenuAlias(richMenu.aliasId).catch((err) =>
        console.warn(`[LINE RichMenu] Failed to delete alias ${richMenu.aliasId} on LINE:`, err?.message || err),
      );
    }

    // 2. Delete rich menu on LINE
    console.log(`[LINE RichMenu] Deleting rich menu: ${richMenu.richMenuId}`);
    await deleteRichMenu(richMenu.richMenuId).catch((err) =>
      console.warn(`[LINE RichMenu] Failed to delete rich menu ${richMenu.richMenuId} on LINE:`, err?.message || err),
    );

    // 3. Delete from Cloudinary if publicId exists
    if (richMenu.imagePublicId) {
      console.log(`[LINE RichMenu] Deleting Cloudinary image: ${richMenu.imagePublicId}`);
      await deleteImageFromCloudinary(richMenu.imagePublicId).catch((err) =>
        console.warn(`[LINE RichMenu] Failed to delete Cloudinary image:`, err?.message || err),
      );
    }

    // 4. Delete from local database
    await prisma.lineRichMenu.delete({
      where: { id },
    });

    // 4. Background sync users of that role/default mapping
    const targetRole = richMenu.targetRole;
    void (async () => {
      try {
        console.log(`[LINE RichMenu] Starting background sync after deletion of role: ${targetRole || "default"}`);
        let userQuery: any = { deletedAt: null, isActive: true };

        if (targetRole === "ADMIN" || targetRole === "EMPLOYEE") {
          userQuery.role = { in: ["ADMIN", "EMPLOYEE"] };
        } else if (targetRole === "USER") {
          userQuery.role = "USER";
          userQuery.memberEntitlements = {
            none: {
              status: "ACTIVE",
            },
          };
        } else if (targetRole === "MEMBER") {
          userQuery.role = "USER";
          userQuery.memberEntitlements = {
            some: {
              status: "ACTIVE",
            },
          };
        }

        const users = await prisma.user.findMany({
          where: userQuery,
          select: { id: true },
        });

        console.log(`[LINE RichMenu] Syncing ${users.length} users...`);
        for (const user of users) {
          await syncUserRichMenu(user.id);
        }
        console.log(`[LINE RichMenu] Background sync complete!`);
      } catch (err) {
        console.error(`[LINE RichMenu] Background sync post-delete error:`, err);
      }
    })();

    return { ok: true };
  } catch (error: any) {
    console.error(`[LINE RichMenu Delete API] Failed:`, error);
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || "เกิดข้อผิดพลาดในการลบ Rich Menu",
    });
  }
});
