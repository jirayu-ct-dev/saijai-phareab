import { getHeader, type H3Event } from "h3";
import { requireRole } from "~~/server/utils/auth";
import { runExpiringPackageNotifications } from "~~/server/utils/notifyExpiring";
import { timingSafeCompareStrings } from "~~/server/utils/timingSafeCompare";

const getSuppliedCronSecret = (event: H3Event) => {
  const customHeader = getHeader(event, "x-cron-secret");
  if (customHeader) return customHeader;

  const authorization = getHeader(event, "authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
};

export const runPackageExpiryCron = async (event: H3Event) => {
  const cronSecret = process.env.CRON_SECRET;
  const suppliedSecret = getSuppliedCronSecret(event);

  if (!cronSecret || !suppliedSecret || !timingSafeCompareStrings(suppliedSecret, cronSecret)) {
    requireRole(event, ["ADMIN"]);
  }

  const results = await runExpiringPackageNotifications();
  return { ok: true, results };
};
