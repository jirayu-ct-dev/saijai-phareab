import { beforeEach, describe, expect, it, vi } from "vitest";

const txMock = vi.hoisted(() => ({
  appSetting: { upsert: vi.fn() },
  shopSetting: { upsert: vi.fn() },
  notificationSetting: { upsert: vi.fn() },
}));

const prismaMock = vi.hoisted(() => ({
  appSetting: { upsert: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("~~/server/utils/prisma", () => ({ prisma: prismaMock }));

const shopRow = {
  id: "singleton",
  name: "ใส่ใจ ผ้าเรียบ",
  phone: "081-234-5678",
  address: "แพร่",
  logoUrl: "https://example.com/logo.png",
  lineQrImageUrl: "https://example.com/line.png",
  updatedAt: new Date("2026-09-02T00:00:00.000Z"),
};

const notificationRow = {
  id: "singleton",
  notifyCustomerOnQuotation: true,
  notifyCustomerOnReceived: true,
  notifyCustomerOnProcessing: false,
  notifyCustomerOnDelivering: true,
  notifyCustomerOnCompleted: true,
  notifyCustomerOnCancelled: false,
  notifyCustomerReceipt: true,
  notifyStaffOnNewOrder: true,
  notifyCustomerOnPackageExpiring: false,
  updatedAt: new Date("2026-09-02T00:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (operation: (tx: typeof txMock) => unknown) => operation(txMock));
  txMock.shopSetting.upsert.mockResolvedValue(shopRow);
  txMock.notificationSetting.upsert.mockResolvedValue(notificationRow);
  txMock.appSetting.upsert.mockResolvedValue({ id: "singleton" });
  prismaMock.appSetting.upsert.mockResolvedValue({ id: "singleton" });
});

describe("AppSetting compatibility writers", () => {
  it("writes persisted shop values to legacy and target rows in one transaction", async () => {
    const { updateShopSetting } = await import("../../server/utils/appSetting");

    const result = await updateShopSetting({
      name: shopRow.name,
      phone: shopRow.phone,
      address: shopRow.address,
      logoUrl: undefined,
      lineQrImageUrl: undefined,
    });

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(txMock.shopSetting.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        name: shopRow.name,
        phone: shopRow.phone,
        address: shopRow.address,
        logoUrl: undefined,
        lineQrImageUrl: undefined,
      },
      update: {
        name: shopRow.name,
        phone: shopRow.phone,
        address: shopRow.address,
        logoUrl: undefined,
        lineQrImageUrl: undefined,
      },
    });
    expect(txMock.appSetting.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        name: shopRow.name,
        phone: shopRow.phone,
        address: shopRow.address,
        logoUrl: shopRow.logoUrl,
        lineQrImageUrl: shopRow.lineQrImageUrl,
        lineQrEnabled: true,
      },
      update: {
        name: shopRow.name,
        phone: shopRow.phone,
        address: shopRow.address,
        logoUrl: shopRow.logoUrl,
        lineQrImageUrl: shopRow.lineQrImageUrl,
        lineQrEnabled: true,
      },
    });
    expect(result).toBe(shopRow);
  });

  it("mirrors every persisted notification policy field to AppSetting", async () => {
    const { updateNotificationSetting } = await import("../../server/utils/appSetting");

    const result = await updateNotificationSetting({
      notifyCustomerOnQuotation: false,
      notifyCustomerOnReceived: false,
      notifyCustomerOnProcessing: false,
      notifyCustomerOnDelivering: false,
      notifyCustomerOnCompleted: false,
      notifyCustomerOnCancelled: false,
      notifyCustomerReceipt: false,
      notifyStaffOnNewOrder: false,
      notifyCustomerOnPackageExpiring: false,
    });

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    const target = {
      notifyCustomerOnQuotation: notificationRow.notifyCustomerOnQuotation,
      notifyCustomerOnReceived: notificationRow.notifyCustomerOnReceived,
      notifyCustomerOnProcessing: notificationRow.notifyCustomerOnProcessing,
      notifyCustomerOnDelivering: notificationRow.notifyCustomerOnDelivering,
      notifyCustomerOnCompleted: notificationRow.notifyCustomerOnCompleted,
      notifyCustomerOnCancelled: notificationRow.notifyCustomerOnCancelled,
      notifyCustomerReceipt: notificationRow.notifyCustomerReceipt,
      notifyStaffOnNewOrder: notificationRow.notifyStaffOnNewOrder,
      notifyCustomerOnPackageExpiring: notificationRow.notifyCustomerOnPackageExpiring,
    };
    expect(txMock.appSetting.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      create: { id: "singleton", ...target },
      update: target,
    });
    expect(result).toBe(notificationRow);
  });

  it("rejects the whole compatibility write when the target write fails", async () => {
    txMock.appSetting.upsert.mockRejectedValueOnce(Object.assign(new Error("target unavailable"), { code: "P1001" }));
    const { updateShopSetting } = await import("../../server/utils/appSetting");

    await expect(updateShopSetting(shopRow)).rejects.toThrow("target unavailable");
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it("invalidates the business-settings cache only after the AppSetting write succeeds", async () => {
    const { getBusinessSetting, updateBusinessSetting } = await import("../../server/utils/appSetting");
    prismaMock.appSetting.upsert.mockResolvedValue({
      id: "singleton",
      hangerPricePerUnit: 10,
      washFoldPricePerKg: 60,
      washFoldMinKg: 1,
      vatRate: 7,
      vatIncluded: true,
      paymentNoPrefix: "PAY-",
      orderNoPrefix: "ORD-",
      quotationNoPrefix: "QT-",
      receiptNoPrefix: "RC-",
      minimumOrderAmount: 0,
      packageRefundDays: 7,
    });

    await getBusinessSetting();
    await updateBusinessSetting({
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
    await getBusinessSetting();

    expect(prismaMock.appSetting.upsert).toHaveBeenCalledTimes(3);

    prismaMock.appSetting.upsert.mockRejectedValueOnce(new Error("write failed"));
    await expect(updateBusinessSetting({
      hangerPricePerUnit: 12,
      washFoldPricePerKg: 65,
      washFoldMinKg: 2,
      vatRate: 7,
      vatIncluded: true,
      paymentNoPrefix: "PAY-",
      orderNoPrefix: "ORD-",
      minimumOrderAmount: 100,
      packageRefundDays: 14,
    })).rejects.toThrow("write failed");

    await getBusinessSetting();
    expect(prismaMock.appSetting.upsert).toHaveBeenCalledTimes(4);
  });
});
