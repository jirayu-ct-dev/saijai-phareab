import { afterAll, beforeAll, describe, expect, it } from "vitest";

const runDatabaseTest = process.env.RUN_DB_CONSOLIDATION_TEST === "1";
const describeDatabase = runDatabaseTest ? describe : describe.skip;

describeDatabase("canonical settings on disposable PostgreSQL", () => {
  let prisma: (typeof import("../../server/utils/prisma"))["prisma"];
  let appSetting: typeof import("../../server/utils/appSetting");

  beforeAll(async () => {
    if (process.env.CONFIRM_DISPOSABLE !== "1" || !process.env.DATABASE_URL) {
      throw new Error("database test requires CONFIRM_DISPOSABLE=1 and DATABASE_URL");
    }
    const target = new URL(process.env.DATABASE_URL);
    const databaseName = target.pathname.replace(/^\//, "");
    if (!["127.0.0.1", "localhost"].includes(target.hostname) || !databaseName.startsWith("rehearsal")) {
      throw new Error("database test only accepts a loopback rehearsal database");
    }
    ({ prisma } = await import("../../server/utils/prisma"));
    appSetting = await import("../../server/utils/appSetting");
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("persists shop and notification settings in the AppSetting singleton", async () => {
    const original = await prisma.appSetting.findUnique({ where: { id: "singleton" } });
    try {
      await appSetting.updateShopSetting({
        name: "ร้านทดสอบ", phone: "0800000000", address: "แพร่",
        logoUrl: null, lineQrImageUrl: "https://example.test/line-qr.png",
      });
      await appSetting.updateNotificationSetting({
        notifyCustomerOnQuotation: true, notifyCustomerOnReceived: false,
        notifyCustomerOnProcessing: true, notifyCustomerOnDelivering: false,
        notifyCustomerOnCompleted: true, notifyCustomerOnCancelled: false,
        notifyCustomerReceipt: true, notifyStaffOnNewOrder: false,
        notifyCustomerOnPackageExpiring: true,
      });

      await expect(prisma.appSetting.findUniqueOrThrow({ where: { id: "singleton" } })).resolves.toMatchObject({
        name: "ร้านทดสอบ", phone: "0800000000", address: "แพร่",
        lineQrEnabled: true, notifyCustomerOnReceived: false,
        notifyStaffOnNewOrder: false,
      });
    } finally {
      if (original) {
        await prisma.appSetting.update({ where: { id: original.id }, data: original });
      } else {
        await prisma.appSetting.deleteMany({ where: { id: "singleton" } });
      }
    }
  });
});
