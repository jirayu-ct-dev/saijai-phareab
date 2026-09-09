import { requireUser } from "~~/server/utils/auth";
import { unlinkLineRichMenuForUser } from "~~/server/utils/line-richmenu";

export default defineEventHandler(async (event) => {
  const actor = requireUser(event);
  const unlinked = await unlinkLineRichMenuForUser(actor.id);

  return { success: true, unlinked };
});
