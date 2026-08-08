import { dispatchDuePickupNotifications } from "~~/server/utils/pickupConfirmation";

export default defineTask({
  meta: {
    name: "notify:pickup-confirmations",
    description: "Send due pickup confirmation and reminder notifications",
  },
  async run() {
    const summary = await dispatchDuePickupNotifications();
    return { result: { ok: true, summary } };
  },
});
