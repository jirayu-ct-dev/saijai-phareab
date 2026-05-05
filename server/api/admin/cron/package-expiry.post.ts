import { requireRole } from "~~/server/utils/auth";
import { runExpiringPackageNotifications } from "~~/server/utils/notifyExpiring";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);
  const results = await runExpiringPackageNotifications();
  return { ok: true, results };
});
