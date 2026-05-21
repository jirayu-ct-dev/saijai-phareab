import { requireUser } from "~~/server/utils/auth";
import { syncUserRichMenu } from "~~/server/utils/line-messaging";

export default defineEventHandler(async (event) => {
  const user = requireUser(event);

  try {
    await syncUserRichMenu(user.id);
    return { success: true };
  } catch (error: any) {
    console.error(`[sync-richmenu API] Failed to sync for user ${user.id}:`, error);
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || "ไม่สามารถอัปเดต LINE Rich Menu ได้ในขณะนี้",
    });
  }
});
