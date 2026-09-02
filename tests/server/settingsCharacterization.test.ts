/**
 * DB-01 characterization tests — settings projection.
 *
 * These tests protect CURRENT behavior of the settings boundary before any
 * schema consolidation (AppSetting read cutover). They document today's
 * actual behavior, including quirks:
 *   - businessSetting loader caches values for the cache TTL and falls back
 *     to "QT-"/"RC-" when the stored prefix is an empty string.
 *   - The public shop-settings endpoint exposes an explicit allow-list of
 *     fields only; server-only setting fields must never leak.
 *   - The admin business-settings endpoint returns its own fixed shape.
 *
 * Prisma is mocked; no database is touched.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "~~/app/generated/prisma/client";

const prismaMock = vi.hoisted(() => ({
  appSetting: {
    upsert: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  shopSetting: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock("~~/server/utils/prisma", () => ({ prisma: prismaMock }));

vi.mock("~~/server/utils/auth", () => ({
  requireRole: vi.fn(),
}));

// Nitro auto-imports used by the API handlers under test. These shims mirror
// the h3 behavior the handlers rely on (handlers receive `event`, errors carry
// statusCode/statusMessage).
(globalThis as Record<string, unknown>).defineEventHandler = (handler: unknown) => handler;

type FakeBusinessSetting = Record<string, unknown>;

const businessSettingRow = (overrides: Partial<Record<string, unknown>> = {}): FakeBusinessSetting => ({
  id: "singleton",
  hangerPricePerUnit: new Prisma.Decimal("10.00"),
  washFoldPricePerKg: new Prisma.Decimal("60.00"),
  washFoldMinKg: new Prisma.Decimal("3.00"),
  vatRate: new Prisma.Decimal("7.00"),
  vatIncluded: true,
  paymentNoPrefix: "PAY-",
  orderNoPrefix: "ORD-",
  quotationNoPrefix: "QT-",
  receiptNoPrefix: "RC-",
  minimumOrderAmount: new Prisma.Decimal("100.00"),
  packageRefundDays: 7,
  updatedAt: new Date("2026-05-01T00:00:00.000Z"),
  ...overrides,
});

const importHandler = async (path: string): Promise<(event?: unknown) => unknown | Promise<unknown>> => {
  const mod = (await import(path)) as { default: (event?: unknown) => unknown | Promise<unknown> };
  return mod.default;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  // appSetting.ts keeps a module-level cache; resetModules drops it.
  prismaMock.appSetting.upsert.mockReset();
  prismaMock.appSetting.findFirst.mockReset();
  prismaMock.appSetting.findUnique.mockReset();
  prismaMock.shopSetting.findFirst.mockReset();
  prismaMock.shopSetting.findUnique.mockReset();
});

describe("business setting projection (server/utils/appSetting.ts)", () => {
  it("maps the singleton row to plain numbers and keeps non-empty prefixes", async () => {
    prismaMock.appSetting.upsert.mockResolvedValue(
      businessSettingRow({ quotationNoPrefix: "QUO-", receiptNoPrefix: "REC-" }),
    );

    const { getBusinessSetting } = await import("../../server/utils/appSetting");
    const values = await getBusinessSetting();

    expect(values).toEqual({
      hangerPricePerUnit: 10,
      washFoldPricePerKg: 60,
      washFoldMinKg: 3,
      vatRate: 7,
      vatIncluded: true,
      paymentNoPrefix: "PAY-",
      orderNoPrefix: "ORD-",
      quotationNoPrefix: "QUO-",
      receiptNoPrefix: "REC-",
      minimumOrderAmount: 100,
      packageRefundDays: 7,
    });
    // Decimal values must never escape the loader as raw Decimal objects.
    for (const [key, value] of Object.entries(values)) {
      if (["paymentNoPrefix", "orderNoPrefix", "quotationNoPrefix", "receiptNoPrefix", "vatIncluded"].includes(key)) {
        continue;
      }
      expect(value, `${key} must be a JSON-safe number`).toEqual(expect.any(Number));
    }
  });

  it("falls back to QT-/RC- when the stored prefixes are empty strings", async () => {
    // Quirk: empty-string prefixes are normalized, null/missing prefixes are not handled here.
    prismaMock.appSetting.upsert.mockResolvedValue(businessSettingRow({ quotationNoPrefix: "", receiptNoPrefix: "" }));

    const { getBusinessSetting } = await import("../../server/utils/appSetting");
    const values = await getBusinessSetting();

    expect(values.quotationNoPrefix).toBe("QT-");
    expect(values.receiptNoPrefix).toBe("RC-");
  });

  it("caches values for the TTL and re-loads after invalidateBusinessSettingCache", async () => {
    prismaMock.appSetting.upsert.mockResolvedValue(businessSettingRow());

    const { getBusinessSetting, invalidateBusinessSettingCache } = await import("../../server/utils/appSetting");

    await getBusinessSetting();
    await getBusinessSetting();
    expect(prismaMock.appSetting.upsert).toHaveBeenCalledTimes(1);

    invalidateBusinessSettingCache();
    await getBusinessSetting();
    expect(prismaMock.appSetting.upsert).toHaveBeenCalledTimes(2);
  });
});

describe("public shop settings projection (server/api/public/shop-settings.get.ts)", () => {
  it("returns only the public allow-list and never leaks other setting fields", async () => {
    // DB-06 read cutover: identity resolves from AppSetting; sensitive fields
    // that may exist on either row must never appear in the response.
    prismaMock.shopSetting.findUnique.mockResolvedValue({
      id: "singleton",
      name: "ร้านซักผ้าสายใจ",
      phone: "0812345678",
      address: "กรุงเทพฯ",
      logoUrl: "https://example.com/logo.png",
      lineQrImageUrl: "https://example.com/line-qr.png",
      paymentQrConfig: "sensitive-qr-config",
      internalNote: "internal-only",
      updatedAt: new Date("2026-05-01T00:00:00.000Z"),
    });
    prismaMock.appSetting.findUnique.mockResolvedValue({
      name: "ร้านซักผ้าสายใจ",
      phone: "0812345678",
      address: "กรุงเทพฯ",
      logoUrl: "https://example.com/logo.png",
      lineQrImageUrl: "https://example.com/line-qr.png",
      washFoldPricePerKg: new Prisma.Decimal("72.50"),
      paymentQrConfig: "sensitive-qr-config",
      internalNote: "internal-only",
      updatedAt: new Date("2026-05-01T00:00:00.000Z"),
    });

    const handler = await importHandler("../../server/api/public/shop-settings.get");
    const result = (await handler()) as Record<string, unknown>;

    // Exact shape protects the no-leak invariant for the settings consolidation.
    expect(Object.keys(result).sort()).toEqual(
      ["address", "lineQrImageUrl", "logoUrl", "name", "phone", "washFoldPricePerKg"].sort(),
    );
    expect(result).toEqual({
      name: "ร้านซักผ้าสายใจ",
      phone: "0812345678",
      address: "กรุงเทพฯ",
      logoUrl: "https://example.com/logo.png",
      lineQrImageUrl: "https://example.com/line-qr.png",
      washFoldPricePerKg: 72.5,
    });
  });

  it("falls back to empty strings/null and 60 THB/kg when no rows exist", async () => {
    prismaMock.shopSetting.findUnique.mockResolvedValue(null);
    prismaMock.appSetting.findUnique.mockResolvedValue(null);

    const handler = await importHandler("../../server/api/public/shop-settings.get");
    const result = (await handler()) as Record<string, unknown>;

    expect(result).toEqual({
      name: "",
      phone: "",
      address: "",
      logoUrl: null,
      lineQrImageUrl: null,
      washFoldPricePerKg: 60,
    });
  });

  it("uses the Decimal wash-fold price when a business row exists, even for zero", async () => {
    // Quirk: the guard checks truthiness of the raw value; a Prisma Decimal
    // zero is an object (truthy), so 0 is returned rather than the 60 default.
    prismaMock.shopSetting.findUnique.mockResolvedValue(null);
    prismaMock.appSetting.findUnique.mockResolvedValue({
      name: null,
      phone: null,
      address: null,
      logoUrl: null,
      lineQrImageUrl: null,
      washFoldPricePerKg: new Prisma.Decimal("0"),
      updatedAt: new Date("2026-05-01T00:00:00.000Z"),
    });

    const handler = await importHandler("../../server/api/public/shop-settings.get");
    const result = (await handler()) as Record<string, unknown>;

    expect(result.washFoldPricePerKg).toBe(0);
  });
});

describe("admin business settings projection (server/api/admin/settings/business.get.ts)", () => {
  it("returns the fixed admin shape with numeric conversions and excludes quotation/receipt prefixes", async () => {
    prismaMock.appSetting.upsert.mockResolvedValue(
      businessSettingRow({ quotationNoPrefix: "QT-ADMIN", receiptNoPrefix: "RC-ADMIN" }),
    );

    const handler = await importHandler("../../server/api/admin/settings/business.get");
    const result = (await handler({})) as Record<string, unknown>;

    // Today's admin response does not include quotationNoPrefix/receiptNoPrefix.
    expect(Object.keys(result).sort()).toEqual(
      [
        "id",
        "hangerPricePerUnit",
        "washFoldPricePerKg",
        "washFoldMinKg",
        "vatRate",
        "vatIncluded",
        "paymentNoPrefix",
        "orderNoPrefix",
        "minimumOrderAmount",
        "packageRefundDays",
        "updatedAt",
      ].sort(),
    );
    expect(result).toMatchObject({
      id: "singleton",
      hangerPricePerUnit: 10,
      washFoldPricePerKg: 60,
      washFoldMinKg: 3,
      vatRate: 7,
      vatIncluded: true,
      paymentNoPrefix: "PAY-",
      orderNoPrefix: "ORD-",
      minimumOrderAmount: 100,
      packageRefundDays: 7,
      updatedAt: new Date("2026-05-01T00:00:00.000Z"),
    });
    expect(result.quotationNoPrefix).toBeUndefined();
    expect(result.receiptNoPrefix).toBeUndefined();
    expect(result).not.toHaveProperty("quotationNoPrefix", "QT-ADMIN");
  });
});
