import { requireUser } from "~~/server/utils/auth";
import { syncLineRichMenuForUser } from "~~/server/utils/line-richmenu";

export default defineEventHandler(async (event) => {
  const actor = requireUser(event);
  const linked = await syncLineRichMenuForUser(actor.id);

  return { success: true, linked };
});
