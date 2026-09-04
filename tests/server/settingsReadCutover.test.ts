import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  appSetting: { findUnique: vi.fn() },
  shopSetting: { findUnique: vi.fn() },
  notificationSetting: { findUnique: vi.fn() },
}));

vi.mock("~~/server/utils/prisma", () => ({ prisma: prismaMock }));

const updatedAt = new Date("2026-09-03T00:00:00.000Z");

const legacyShopRow = {
  id: "singleton",
  name: "ร้านตัวอย่าง",
  phone: "081-234-5678",
  address: "แพร่",
  logoUrl: null,
  lineQrImageUrl: "https://example.com/line.png",
  updatedAt,
};

const legacyNotificationRow = {
  id: "singleton",
  notifyCustomerOnQuotation: true,
  notifyCustomerOnReceived: true,
  notifyCustomerOnProcessing: false,
  notifyCustomerOnDelivering: true,
  notifyCustomerOnCompleted: true,
  notifyCustomerOnCancelled: true,
  notifyCustomerReceipt: true,
  notifyStaffOnNewOrder: true,
  notifyCustomerOnPackageExpiring: false,
  updatedAt,
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.appSetting.findUnique.mockResolvedValue(null);
  prismaMock.shopSetting.findUnique.mockResolvedValue(null);
  prismaMock.notificationSetting.findUnique.mockResolvedValue(null);
});

describe("compatReadOutcome", () => {
  it("is a fallback while the target field is still null", async () => {
    const { compatReadOutcome } = await import("../../server/utils/appSetting");
    expect(compatReadOutcome(null, "legacy")).toBe("fallback");
    expect(compatReadOutcome(undefined, true)).toBe("fallback");
    expect(compatReadOutcome(null, null)).toBe("fallback");
  });

  it("is a mismatch only when both sources exist and disagree", async () => {
    const { compatReadOutcome } = await import("../../server/utils/appSetting");
    expect(compatReadOutcome("new", "old")).toBe("mismatch");
    expect(compatReadOutcome(false, true)).toBe("mismatch");
    expect(compatReadOutcome("same", "same")).toBe("match");
    expect(compatReadOutcome("new", null)).toBe("match");
  });
});

describe("resolveCompatRead", () => {
  it("prefers legacy on mismatch and falls back through legacy to the default", async () => {
    const { resolveCompatRead } = await import("../../server/utils/appSetting");
    expect(resolveCompatRead<string>("new", "old", "")).toEqual({ value: "old", outcome: "mismatch" });
    expect(resolveCompatRead<string>(null, "legacy", "default")).toEqual({
      value: "legacy",
      outcome: "fallback",
    });
    expect(resolveCompatRead<string>(null, null, "default")).toEqual({
      value: "default",
      outcome: "fallback",
    });
    expect(resolveCompatRead<string>("target", null, "default")).toEqual({
      value: "target",
      outcome: "match",
    });
  });
});

describe("getShopIdentity read cutover", () => {
  it("serves AppSetting values and reports match when both rows agree", async () => {
    const { getShopIdentity } = await import("../../server/utils/appSetting");
    prismaMock.appSetting.findUnique.mockResolvedValue({
      name: legacyShopRow.name,
      phone: legacyShopRow.phone,
      address: legacyShopRow.address,
      logoUrl: null,
      lineQrImageUrl: legacyShopRow.lineQrImageUrl,
      lineQrEnabled: true,
      updatedAt,
    });
    prismaMock.shopSetting.findUnique.mockResolvedValue(legacyShopRow);

    const identity = await getShopIdentity();

    expect(identity).toEqual({
      id: "singleton",
      name: legacyShopRow.name,
      phone: legacyShopRow.phone,
      address: legacyShopRow.address,
      logoUrl: null,
      lineQrImageUrl: legacyShopRow.lineQrImageUrl,
      lineQrEnabled: true,
      updatedAt,
    });
  });

  it("falls back per-field to legacy on target null and on mismatch", async () => {
    const { getShopIdentity } = await import("../../server/utils/appSetting");
    prismaMock.appSetting.findUnique.mockResolvedValue({
      name: "ชื่อใหม่",
      phone: null,
      address: "ที่อยู่ใหม่",
      logoUrl: null,
      lineQrImageUrl: "https://example.com/other.png",
      updatedAt,
    });
    prismaMock.shopSetting.findUnique.mockResolvedValue(legacyShopRow);

    const identity = await getShopIdentity();

    expect(identity.name).toBe(legacyShopRow.name); // mismatch → legacy wins
    expect(identity.phone).toBe(legacyShopRow.phone); // target null → legacy
    expect(identity.address).toBe(legacyShopRow.address); // mismatch → legacy wins
    expect(identity.logoUrl).toBeNull();
  });

  it("serves an explicit disabled LINE QR toggle without deleting the image", async () => {
    const { getShopIdentity } = await import("../../server/utils/appSetting");
    prismaMock.appSetting.findUnique.mockResolvedValue({
      ...legacyShopRow,
      lineQrEnabled: false,
      updatedAt,
    });
    prismaMock.shopSetting.findUnique.mockResolvedValue(legacyShopRow);

    const identity = await getShopIdentity();

    expect(identity.lineQrImageUrl).toBe(legacyShopRow.lineQrImageUrl);
    expect(identity.lineQrEnabled).toBe(false);
  });

  it("uses the legacy row entirely when AppSetting has no row yet", async () => {
    const { getShopIdentity } = await import("../../server/utils/appSetting");
    prismaMock.shopSetting.findUnique.mockResolvedValue(legacyShopRow);

    const identity = await getShopIdentity();

    expect(identity).toEqual({
      id: "singleton",
      name: legacyShopRow.name,
      phone: legacyShopRow.phone,
      address: legacyShopRow.address,
      logoUrl: null,
      lineQrImageUrl: legacyShopRow.lineQrImageUrl,
      lineQrEnabled: true,
      updatedAt,
    });
  });
});

describe("getNotificationPolicy read cutover", () => {
  it("falls back to the legacy policy while AppSetting fields are unmigrated", async () => {
    const { getNotificationPolicy } = await import("../../server/utils/appSetting");
    prismaMock.appSetting.findUnique.mockResolvedValue({
      notifyCustomerOnQuotation: null,
      notifyCustomerOnReceived: null,
      notifyCustomerOnProcessing: null,
      notifyCustomerOnDelivering: null,
      notifyCustomerOnCompleted: null,
      notifyCustomerOnCancelled: null,
      notifyCustomerReceipt: null,
      notifyStaffOnNewOrder: null,
      notifyCustomerOnPackageExpiring: null,
      updatedAt,
    });
    prismaMock.notificationSetting.findUnique.mockResolvedValue(legacyNotificationRow);

    const policy = await getNotificationPolicy();

    expect(policy.notifyCustomerOnProcessing).toBe(false);
    expect(policy.notifyCustomerOnPackageExpiring).toBe(false);
    expect(policy.notifyCustomerOnQuotation).toBe(true);
  });

  it("defaults to enabled when neither source has a policy", async () => {
    const { getNotificationPolicy } = await import("../../server/utils/appSetting");

    const policy = await getNotificationPolicy();

    expect(policy.notifyCustomerOnQuotation).toBe(true);
    expect(policy.notifyCustomerOnPackageExpiring).toBe(true);
    expect(policy.notifyStaffOnNewOrder).toBe(true);
  });

  it("keeps the legacy policy on divergence — mismatches must stay zero during soak", async () => {
    const { getNotificationPolicy } = await import("../../server/utils/appSetting");
    prismaMock.appSetting.findUnique.mockResolvedValue({
      notifyCustomerOnQuotation: true,
      notifyCustomerOnReceived: true,
      notifyCustomerOnProcessing: true,
      notifyCustomerOnDelivering: true,
      notifyCustomerOnCompleted: true,
      notifyCustomerOnCancelled: true,
      notifyCustomerReceipt: true,
      notifyStaffOnNewOrder: true,
      notifyCustomerOnPackageExpiring: false,
      updatedAt,
    });
    prismaMock.notificationSetting.findUnique.mockResolvedValue(legacyNotificationRow);

    const policy = await getNotificationPolicy();

    expect(policy.notifyCustomerOnProcessing).toBe(false);
  });

  it("serves the migrated policy once the legacy row is gone", async () => {
    const { getNotificationPolicy } = await import("../../server/utils/appSetting");
    prismaMock.appSetting.findUnique.mockResolvedValue({
      notifyCustomerOnQuotation: true,
      notifyCustomerOnReceived: true,
      notifyCustomerOnProcessing: false,
      notifyCustomerOnDelivering: true,
      notifyCustomerOnCompleted: true,
      notifyCustomerOnCancelled: true,
      notifyCustomerReceipt: true,
      notifyStaffOnNewOrder: false,
      notifyCustomerOnPackageExpiring: false,
      updatedAt,
    });
    prismaMock.notificationSetting.findUnique.mockResolvedValue(null);

    const policy = await getNotificationPolicy();

    expect(policy.notifyCustomerOnProcessing).toBe(false);
    expect(policy.notifyStaffOnNewOrder).toBe(false);
    expect(policy.notifyCustomerOnQuotation).toBe(true);
  });
});
