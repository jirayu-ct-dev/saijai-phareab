import { hasActiveMemberPackage, requireUser } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const isMember = await hasActiveMemberPackage(user.id);

  return { isMember };
});
