import { afterAll, beforeAll, describe, expect, it } from "vitest";

const runDatabaseTest = process.env.RUN_DB04_DB_TEST === "1";
const describeDatabase = runDatabaseTest ? describe : describe.skip;

describeDatabase("DB-04 settings dual-write on disposable PostgreSQL", () => {
  let prisma: (typeof import("../../server/utils/prisma"))["prisma"];
  let appSetting: typeof import("../../server/utils/appSetting");

  beforeAll(async () => {
    if (process.env.CONFIRM_DISPOSABLE !== "1" || !process.env.DATABASE_URL) {
      throw new Error("DB-04 database test requires CONFIRM_DISPOSABLE=1 and DATABASE_URL");
    }
    const target = new URL(process.env.DATABASE_URL);
    const databaseName = target.pathname.replace(/^\//, "");
    if (!["127.0.0.1", "localhost"].includes(target.hostname) || !databaseName.startsWith("rehearsal")) {
      throw new Error("DB-04 database test only accepts a loopback rehearsal database");
    }

    ({ prisma } = await import("../../server/utils/prisma"));
    appSetting = await import("../../server/utils/appSetting");
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("keeps legacy/target rows equal and rolls the legacy write back when the target fails", async () => {
    const originalShop = await prisma.shopSetting.findUnique({ where: { id: "singleton" } });
    const originalNotification = await prisma.notificationSetting.findUnique({ where: { id: "singleton" } });
    const originalApp = await prisma.appSetting.findUnique({ where: { id: "singleton" } });

    try {
      await appSetting.updateShopSetting({
        name: "DB04 ร้านทดสอบ",
        phone: "0800000000",
        address: "แพร่",
        logoUrl: null,
        lineQrImageUrl: "https://example.test/line-qr.png",
      });
      await appSetting.updateNotificationSetting({
        notifyCustomerOnQuotation: true,
        notifyCustomerOnReceived: false,
        notifyCustomerOnProcessing: true,
        notifyCustomerOnDelivering: false,
        notifyCustomerOnCompleted: true,
        notifyCustomerOnCancelled: false,
        notifyCustomerReceipt: true,
        notifyStaffOnNewOrder: false,
        notifyCustomerOnPackageExpiring: true,
      });
      await appSetting.updateBusinessSetting({
        hangerPricePerUnit: 12,
        washFoldPricePerKg: 65,
        washFoldMinKg: 2,
        vatRate: 7,
        vatIncluded: true,
        paymentNoPrefix: "PAY-",
        orderNoPrefix: "ORD-",
        minimumOrderAmount: 100,
        packageRefundDays: 14,
      });

      const [legacyShop, legacyNotification, target] = await Promise.all([
        prisma.shopSetting.findUniqueOrThrow({ where: { id: "singleton" } }),
        prisma.notificationSetting.findUniqueOrThrow({ where: { id: "singleton" } }),
        prisma.appSetting.findUniqueOrThrow({ where: { id: "singleton" } }),
      ]);
      expect(target).toMatchObject({
        name: legacyShop.name,
        phone: legacyShop.phone,
        address: legacyShop.address,
        logoUrl: legacyShop.logoUrl,
        lineQrImageUrl: legacyShop.lineQrImageUrl,
        lineQrEnabled: true,
        notifyCustomerOnQuotation: legacyNotification.notifyCustomerOnQuotation,
        notifyCustomerOnReceived: legacyNotification.notifyCustomerOnReceived,
        notifyCustomerOnProcessing: legacyNotification.notifyCustomerOnProcessing,
        notifyCustomerOnDelivering: legacyNotification.notifyCustomerOnDelivering,
        notifyCustomerOnCompleted: legacyNotification.notifyCustomerOnCompleted,
        notifyCustomerOnCancelled: legacyNotification.notifyCustomerOnCancelled,
        notifyCustomerReceipt: legacyNotification.notifyCustomerReceipt,
        notifyStaffOnNewOrder: legacyNotification.notifyStaffOnNewOrder,
        notifyCustomerOnPackageExpiring: legacyNotification.notifyCustomerOnPackageExpiring,
      });
      expect(Number(target.hangerPricePerUnit)).toBe(12);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "business_setting"
        ADD CONSTRAINT "db04_rehearsal_reject_name"
        CHECK ("name" IS DISTINCT FROM '__DB04_TARGET_FAILURE__')
      `);
      try {
        await expect(appSetting.updateShopSetting({
          name: "__DB04_TARGET_FAILURE__",
          phone: legacyShop.phone,
          address: legacyShop.address,
          logoUrl: legacyShop.logoUrl,
          lineQrImageUrl: legacyShop.lineQrImageUrl,
        })).rejects.toThrow();
      } finally {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "business_setting" DROP CONSTRAINT IF EXISTS "db04_rehearsal_reject_name"`,
        );
      }

      expect(await prisma.shopSetting.findUniqueOrThrow({ where: { id: "singleton" } })).toMatchObject({
        name: legacyShop.name,
        phone: legacyShop.phone,
        address: legacyShop.address,
      });
    } finally {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "business_setting" DROP CONSTRAINT IF EXISTS "db04_rehearsal_reject_name"`,
      );
      await prisma.$transaction([
        originalShop
          ? prisma.shopSetting.update({
              where: { id: originalShop.id },
              data: {
                name: originalShop.name,
                phone: originalShop.phone,
                address: originalShop.address,
                logoUrl: originalShop.logoUrl,
                lineQrImageUrl: originalShop.lineQrImageUrl,
              },
            })
          : prisma.shopSetting.deleteMany({ where: { id: "singleton" } }),
        originalNotification
          ? prisma.notificationSetting.update({
              where: { id: originalNotification.id },
              data: {
                notifyCustomerOnQuotation: originalNotification.notifyCustomerOnQuotation,
                notifyCustomerOnReceived: originalNotification.notifyCustomerOnReceived,
                notifyCustomerOnProcessing: originalNotification.notifyCustomerOnProcessing,
                notifyCustomerOnDelivering: originalNotification.notifyCustomerOnDelivering,
                notifyCustomerOnCompleted: originalNotification.notifyCustomerOnCompleted,
                notifyCustomerOnCancelled: originalNotification.notifyCustomerOnCancelled,
                notifyCustomerReceipt: originalNotification.notifyCustomerReceipt,
                notifyStaffOnNewOrder: originalNotification.notifyStaffOnNewOrder,
                notifyCustomerOnPackageExpiring: originalNotification.notifyCustomerOnPackageExpiring,
              },
            })
          : prisma.notificationSetting.deleteMany({ where: { id: "singleton" } }),
        originalApp
          ? prisma.appSetting.update({
              where: { id: originalApp.id },
              data: originalApp,
            })
          : prisma.appSetting.deleteMany({ where: { id: "singleton" } }),
      ]);
    }
  });
});
