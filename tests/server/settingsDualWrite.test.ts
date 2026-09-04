import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({ appSetting: { upsert: vi.fn() } }));
vi.mock("~~/server/utils/prisma", () => ({ prisma: prismaMock }));

const shopRow = {
  id: "singleton", name: "ใส่ใจ ผ้าเรียบ", phone: "081-234-5678", address: "แพร่",
  logoUrl: "https://example.com/logo.png", lineQrImageUrl: "https://example.com/line.png",
  lineQrEnabled: true, updatedAt: new Date("2026-09-02T00:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.appSetting.upsert.mockResolvedValue(shopRow);
});

describe("canonical AppSetting writers", () => {
  it("writes shop identity once with an explicit safe projection", async () => {
    const { updateShopSetting } = await import("../../server/utils/appSetting");
    const data = {
      name: shopRow.name, phone: shopRow.phone, address: shopRow.address,
      logoUrl: shopRow.logoUrl, lineQrImageUrl: shopRow.lineQrImageUrl,
    };
    await expect(updateShopSetting(data)).resolves.toBe(shopRow);
    expect(prismaMock.appSetting.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      create: { id: "singleton", ...data, lineQrEnabled: true },
      update: { ...data, lineQrEnabled: true },
      select: {
        id: true, name: true, phone: true, address: true, logoUrl: true,
        lineQrImageUrl: true, lineQrEnabled: true, updatedAt: true,
      },
    });
  });

  it("disables LINE QR when its image is cleared", async () => {
    const { updateShopSetting } = await import("../../server/utils/appSetting");
    await updateShopSetting({ ...shopRow, lineQrImageUrl: null });
    expect(prismaMock.appSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ lineQrImageUrl: null, lineQrEnabled: false }),
      update: expect.objectContaining({ lineQrImageUrl: null, lineQrEnabled: false }),
    }));
  });

  it("preserves the current LINE QR toggle when the image field is omitted", async () => {
    const { updateShopSetting } = await import("../../server/utils/appSetting");
    await updateShopSetting({ name: shopRow.name, phone: shopRow.phone, address: shopRow.address });
    expect(prismaMock.appSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ lineQrEnabled: false }),
      update: { name: shopRow.name, phone: shopRow.phone, address: shopRow.address },
    }));
  });

  it("writes the complete notification policy to AppSetting", async () => {
    const { updateNotificationSetting } = await import("../../server/utils/appSetting");
    const policy = {
      notifyCustomerOnQuotation: true, notifyCustomerOnReceived: false,
      notifyCustomerOnProcessing: true, notifyCustomerOnDelivering: false,
      notifyCustomerOnCompleted: true, notifyCustomerOnCancelled: false,
      notifyCustomerReceipt: true, notifyStaffOnNewOrder: false,
      notifyCustomerOnPackageExpiring: true,
    };
    await updateNotificationSetting(policy);
    expect(prismaMock.appSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "singleton" }, create: { id: "singleton", ...policy }, update: policy,
    }));
  });
});
