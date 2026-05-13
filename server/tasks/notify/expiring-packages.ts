import { runExpiringPackageNotifications } from "~~/server/utils/notifyExpiring";

export default defineTask({
  meta: {
    name: "notify:expiring-packages",
    description: "Send LINE notifications for packages nearing expiration",
  },
  async run() {
    const results = await runExpiringPackageNotifications();
    return { result: { ok: true, results } };
  },
});
