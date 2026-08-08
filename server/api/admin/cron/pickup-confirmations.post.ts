import { requireRole } from "~~/server/utils/auth";
import { dispatchDuePickupNotifications } from "~~/server/utils/pickupConfirmation";

export default defineEventHandler(async (event) => {
  const cronSecret = process.env.CRON_SECRET;
  const incomingSecret = getHeader(event, "x-cron-secret");

  if (!(cronSecret && incomingSecret === cronSecret)) {
    requireRole(event, ["ADMIN"]);
  }

  const summary = await dispatchDuePickupNotifications();
  return { ok: true, summary };
});
