import { runExpiringPackageNotifications } from "~~/server/utils/notifyExpiring";

export default defineTask({
  meta: {
    name: "notify:expiring-packages",
    description: "Send LINE notifications for packages nearing expiration",
  },
  async run() {
    try {
      await runExpiringPackageNotifications();
      return { result: "Success" };
    } catch (error) {
      console.error("[task:notify:expiring-packages] failed", error);
      return { result: "Failed" };
    }
  },
});
