import type { H3Event } from "h3";
import { requireRole } from "~~/server/utils/auth";
import { runExpiringPackageNotifications } from "~~/server/utils/notifyExpiring";
import { timingSafeCompareStrings } from "~~/server/utils/timingSafeCompare";

const hasValidCronSecret = (event: H3Event): boolean => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authorization = getHeader(event, "authorization");
  const bearerSecret = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const legacySecret = getHeader(event, "x-cron-secret");

  return [bearerSecret, legacySecret]
    .filter((secret): secret is string => Boolean(secret))
    .some((secret) => timingSafeCompareStrings(secret, cronSecret));
};

/**
 * Runs the package-expiry notification job for Vercel Cron or an authenticated
 * admin. Vercel sends CRON_SECRET as `Authorization: Bearer <secret>`.
 */
export const runPackageExpiryCron = async (event: H3Event) => {
  if (!hasValidCronSecret(event)) {
    requireRole(event, ["ADMIN"]);
  }

  const results = await runExpiringPackageNotifications();
  return { ok: true, results };
};
