import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({ appSetting: { findUnique: vi.fn() } }));
vi.mock("~~/server/utils/prisma", () => ({ prisma: prismaMock }));

const updatedAt = new Date("2026-09-03T00:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.appSetting.findUnique.mockResolvedValue(null);
});

describe("canonical AppSetting reads", () => {
  it("loads shop identity only from the AppSetting singleton", async () => {
    const row = {
      id: "singleton", name: "ร้านตัวอย่าง", phone: "081-234-5678", address: "แพร่",
      logoUrl: null, lineQrImageUrl: "https://example.com/line.png", lineQrEnabled: true, updatedAt,
    };
    prismaMock.appSetting.findUnique.mockResolvedValue(row);
    const { getShopIdentity } = await import("../../server/utils/appSetting");

    await expect(getShopIdentity()).resolves.toEqual(row);
    expect(prismaMock.appSetting.findUnique).toHaveBeenCalledWith({
      where: { id: "singleton" },
      select: {
        id: true, name: true, phone: true, address: true, logoUrl: true,
        lineQrImageUrl: true, lineQrEnabled: true, updatedAt: true,
      },
    });
  });

  it("returns safe shop defaults before the singleton is created", async () => {
    const { getShopIdentity } = await import("../../server/utils/appSetting");
    await expect(getShopIdentity()).resolves.toEqual({
      id: "singleton", name: "", phone: "", address: "", logoUrl: null,
      lineQrImageUrl: null, lineQrEnabled: false, updatedAt: new Date(0),
    });
  });

  it("loads notification policy only from AppSetting", async () => {
    const row = {
      id: "singleton", notifyCustomerOnQuotation: true, notifyCustomerOnReceived: true,
      notifyCustomerOnProcessing: false, notifyCustomerOnDelivering: true,
      notifyCustomerOnCompleted: true, notifyCustomerOnCancelled: false,
      notifyCustomerReceipt: true, notifyStaffOnNewOrder: false,
      notifyCustomerOnPackageExpiring: false, updatedAt,
    };
    prismaMock.appSetting.findUnique.mockResolvedValue(row);
    const { getNotificationPolicy } = await import("../../server/utils/appSetting");
    await expect(getNotificationPolicy()).resolves.toEqual(row);
  });

  it("defaults every notification to enabled before the singleton is created", async () => {
    const { getNotificationPolicy } = await import("../../server/utils/appSetting");
    const policy = await getNotificationPolicy();
    expect(policy).toMatchObject({
      notifyCustomerOnQuotation: true, notifyCustomerOnReceived: true,
      notifyCustomerOnProcessing: true, notifyCustomerOnDelivering: true,
      notifyCustomerOnCompleted: true, notifyCustomerOnCancelled: true,
      notifyCustomerReceipt: true, notifyStaffOnNewOrder: true,
      notifyCustomerOnPackageExpiring: true,
    });
  });
});
