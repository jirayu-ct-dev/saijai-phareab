import { requireRole } from "~~/server/utils/auth";
import { runExpiringPackageNotifications } from "~~/server/utils/notifyExpiring";
import { timingSafeCompareStrings } from "~~/server/utils/timingSafeCompare";

export default defineEventHandler(async (event) => {
  const cronSecret = process.env.CRON_SECRET;
  const incomingSecret = getHeader(event, "x-cron-secret");

  if (cronSecret && incomingSecret && timingSafeCompareStrings(incomingSecret, cronSecret)) {
    // Authenticated via secret header — allow external schedulers (Vercel Cron, GitHub Actions, etc.)
  } else {
    requireRole(event, ["ADMIN"]);
  }

  const results = await runExpiringPackageNotifications();
  return { ok: true, results };
});
