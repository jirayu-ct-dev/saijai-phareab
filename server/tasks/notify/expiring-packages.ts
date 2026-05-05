import { runExpiringPackageNotifications } from "~~/server/utils/notifyExpiring";

export default defineTask({
  meta: {
    name: "notify:expiring-packages",
    description: "Send LINE notifications for packages nearing expiration",
  },
  async run() {
    try {
      const results = await runExpiringPackageNotifications();
      return { result: { ok: true, results } };
    } catch (error) {
      console.error("[task:notify:expiring-packages] failed", error);
      return { result: { ok: false, error: (error as Error).message } };
    }
  },
});
