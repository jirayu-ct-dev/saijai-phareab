import { requireUser } from "~~/server/utils/auth";
import { syncLineRichMenuForUser } from "~~/server/utils/line-richmenu";

export default defineEventHandler(async (event) => {
  const actor = requireUser(event);
  const result = await syncLineRichMenuForUser(actor.id);

  return { success: true, ...result };
});
