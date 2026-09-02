import { prisma } from "~~/server/utils/prisma";
import {
  COMPAT_METRICS,
  emitCompatTelemetry,
  withCompatTelemetry,
} from "~~/server/utils/compatTelemetry";

export type BusinessSettingValues = {
  hangerPricePerUnit: number;
  washFoldPricePerKg: number;
  washFoldMinKg: number;
  vatRate: number;
  vatIncluded: boolean;
  paymentNoPrefix: string;
  orderNoPrefix: string;
  quotationNoPrefix: string;
  receiptNoPrefix: string;
  minimumOrderAmount: number;
  packageRefundDays: number;
};

export type BusinessSettingWrite = Omit<BusinessSettingValues, "quotationNoPrefix" | "receiptNoPrefix">;

export type ShopSettingWrite = {
  name: string;
  phone: string;
  address: string;
  logoUrl?: string | null;
  lineQrImageUrl?: string | null;
};

export type NotificationSettingWrite = {
  notifyCustomerOnQuotation: boolean;
  notifyCustomerOnReceived: boolean;
  notifyCustomerOnProcessing: boolean;
  notifyCustomerOnDelivering: boolean;
  notifyCustomerOnCompleted: boolean;
  notifyCustomerOnCancelled: boolean;
  notifyCustomerReceipt: boolean;
  notifyStaffOnNewOrder: boolean;
  notifyCustomerOnPackageExpiring: boolean;
};

type CompatibilityPath = "business" | "shop" | "notification";

const CACHE_TTL_MS = 5 * 60 * 1000;
let cached: { values: BusinessSettingValues; expiresAt: number } | null = null;

const loadFromDb = async (): Promise<BusinessSettingValues> => {
  const setting = await prisma.appSetting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });

  return {
    hangerPricePerUnit: Number(setting.hangerPricePerUnit),
    washFoldPricePerKg: Number(setting.washFoldPricePerKg),
    washFoldMinKg: Number(setting.washFoldMinKg),
    vatRate: Number(setting.vatRate),
    vatIncluded: setting.vatIncluded,
    paymentNoPrefix: setting.paymentNoPrefix,
    orderNoPrefix: setting.orderNoPrefix,
    quotationNoPrefix: setting.quotationNoPrefix || "QT-",
    receiptNoPrefix: setting.receiptNoPrefix || "RC-",
    minimumOrderAmount: Number(setting.minimumOrderAmount),
    packageRefundDays: setting.packageRefundDays,
  };
};

export const getBusinessSetting = async (): Promise<BusinessSettingValues> => {
  if (cached && Date.now() < cached.expiresAt) {
    return cached.values;
  }
  const values = await loadFromDb();
  cached = { values, expiresAt: Date.now() + CACHE_TTL_MS };
  return values;
};

export const invalidateBusinessSettingCache = (): void => {
  cached = null;
};

export const updateBusinessSetting = async (data: BusinessSettingWrite) => {
  const setting = await withCompatTelemetry("business", () =>
    prisma.appSetting.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    }),
  );
  invalidateBusinessSettingCache();
  return setting;
};

export const updateShopSetting = async (data: ShopSettingWrite) =>
  withCompatTelemetry("shop", () =>
    prisma.$transaction(async (tx) => {
      const legacy = await tx.shopSetting.upsert({
        where: { id: "singleton" },
        create: { id: "singleton", ...data },
        update: data,
      });
      const target = {
        name: legacy.name,
        phone: legacy.phone,
        address: legacy.address,
        logoUrl: legacy.logoUrl,
        lineQrImageUrl: legacy.lineQrImageUrl,
        lineQrEnabled: Boolean(legacy.lineQrImageUrl),
      };

      await tx.appSetting.upsert({
        where: { id: "singleton" },
        create: { id: "singleton", ...target },
        update: target,
      });
      return legacy;
    }),
  );

export const updateNotificationSetting = async (data: NotificationSettingWrite) =>
  withCompatTelemetry("notification", () =>
    prisma.$transaction(async (tx) => {
      const legacy = await tx.notificationSetting.upsert({
        where: { id: "singleton" },
        create: { id: "singleton", ...data },
        update: data,
      });
      const target: NotificationSettingWrite = {
        notifyCustomerOnQuotation: legacy.notifyCustomerOnQuotation,
        notifyCustomerOnReceived: legacy.notifyCustomerOnReceived,
        notifyCustomerOnProcessing: legacy.notifyCustomerOnProcessing,
        notifyCustomerOnDelivering: legacy.notifyCustomerOnDelivering,
        notifyCustomerOnCompleted: legacy.notifyCustomerOnCompleted,
        notifyCustomerOnCancelled: legacy.notifyCustomerOnCancelled,
        notifyCustomerReceipt: legacy.notifyCustomerReceipt,
        notifyStaffOnNewOrder: legacy.notifyStaffOnNewOrder,
        notifyCustomerOnPackageExpiring: legacy.notifyCustomerOnPackageExpiring,
      };

      await tx.appSetting.upsert({
        where: { id: "singleton" },
        create: { id: "singleton", ...target },
        update: target,
      });
      return legacy;
    }),
  );

// ===========================================================================
// DB-06 read cutover (plan Phase 5): reads resolve from the AppSetting target
// fields, falling back per-field to the legacy row when the target is still
// `null` (not migrated yet — schema comment on the expand columns). Every read
// is compared against the legacy source and counted so the soak window can
// prove mismatch = fallback = 0 before dual-write stops.
// ===========================================================================

export type CompatReadOutcome = "match" | "mismatch" | "fallback";

/**
 * Pure soak comparator: how a target-field read relates to its legacy source.
 * - `fallback`: the target field is still `null`/absent — legacy wins.
 * - `mismatch`: both sources exist and disagree — legacy wins and the read
 *   must be counted (soak gate requires these to stay at zero).
 * - `match`: target present and agrees with legacy (or legacy has no row).
 */
export const compatReadOutcome = (
  appValue: unknown,
  legacyValue: unknown,
): CompatReadOutcome => {
  if (appValue === null || appValue === undefined) return "fallback";
  if (legacyValue === null || legacyValue === undefined) return "match";
  return Object.is(appValue, legacyValue) ? "match" : "mismatch";
};

/**
 * Resolve one field: legacy value wins on mismatch or fallback, otherwise the
 * target value; `fallbackValue` applies only when neither source has data.
 */
export const resolveCompatRead = <T>(
  appValue: T | null | undefined,
  legacyValue: T | null | undefined,
  fallbackValue: T,
): { value: T; outcome: CompatReadOutcome } => {
  const outcome = compatReadOutcome(appValue, legacyValue);
  if (outcome === "mismatch") return { value: legacyValue as T, outcome };
  if (outcome === "fallback") return { value: legacyValue ?? fallbackValue, outcome };
  return { value: appValue as T, outcome };
};

export type ShopIdentityValues = {
  name: string;
  phone: string;
  address: string;
  logoUrl: string | null;
  lineQrImageUrl: string | null;
};

const emitSettingRead = (path: "shop" | "notification", outcomes: CompatReadOutcome[]): void => {
  const result = outcomes.some((outcome) => outcome === "mismatch")
    ? "mismatch"
    : outcomes.some((outcome) => outcome === "fallback")
      ? "fallback"
      : "match";
  emitCompatTelemetry({ metric: COMPAT_METRICS.settingRead, path, result });
};

/**
 * Shop identity read after the DB-06 cutover: resolves every field from
 * AppSetting with per-field legacy fallback and soak comparison. Never writes.
 */
export const getShopIdentity = async (): Promise<
  ShopIdentityValues & { id: string; updatedAt: Date }
> => {
  const [app, legacy] = await Promise.all([
    prisma.appSetting.findUnique({
      where: { id: "singleton" },
      select: { name: true, phone: true, address: true, logoUrl: true, lineQrImageUrl: true, updatedAt: true },
    }),
    prisma.shopSetting.findUnique({ where: { id: "singleton" } }),
  ]);

  if (!app) {
    emitSettingRead("shop", ["fallback"]);
    return {
      id: "singleton",
      name: legacy?.name ?? "",
      phone: legacy?.phone ?? "",
      address: legacy?.address ?? "",
      logoUrl: legacy?.logoUrl ?? null,
      lineQrImageUrl: legacy?.lineQrImageUrl ?? null,
      updatedAt: legacy?.updatedAt ?? new Date(0),
    };
  }

  const name = resolveCompatRead(app.name, legacy?.name ?? null, "");
  const phone = resolveCompatRead(app.phone, legacy?.phone ?? null, "");
  const address = resolveCompatRead(app.address, legacy?.address ?? null, "");
  const logoUrl = resolveCompatRead(app.logoUrl, legacy?.logoUrl ?? null, null);
  const lineQrImageUrl = resolveCompatRead(app.lineQrImageUrl, legacy?.lineQrImageUrl ?? null, null);
  emitSettingRead("shop", [name, phone, address, logoUrl, lineQrImageUrl].map((r) => r.outcome));

  return {
    id: "singleton",
    name: name.value,
    phone: phone.value,
    address: address.value,
    logoUrl: logoUrl.value,
    lineQrImageUrl: lineQrImageUrl.value,
    updatedAt: app.updatedAt,
  };
};

/**
 * Notification policy read after the DB-06 cutover. Legacy booleans default to
 * `true`, so an absent policy resolves to enabled for every channel.
 */
export const getNotificationPolicy = async (): Promise<
  NotificationSettingWrite & { id: string; updatedAt: Date }
> => {
  const [app, legacy] = await Promise.all([
    prisma.appSetting.findUnique({
      where: { id: "singleton" },
      select: {
        notifyCustomerOnQuotation: true,
        notifyCustomerOnReceived: true,
        notifyCustomerOnProcessing: true,
        notifyCustomerOnDelivering: true,
        notifyCustomerOnCompleted: true,
        notifyCustomerOnCancelled: true,
        notifyCustomerReceipt: true,
        notifyStaffOnNewOrder: true,
        notifyCustomerOnPackageExpiring: true,
        updatedAt: true,
      },
    }),
    prisma.notificationSetting.findUnique({ where: { id: "singleton" } }),
  ]);

  if (!app) {
    emitSettingRead("notification", ["fallback"]);
    return {
      id: "singleton",
      notifyCustomerOnQuotation: legacy?.notifyCustomerOnQuotation ?? true,
      notifyCustomerOnReceived: legacy?.notifyCustomerOnReceived ?? true,
      notifyCustomerOnProcessing: legacy?.notifyCustomerOnProcessing ?? true,
      notifyCustomerOnDelivering: legacy?.notifyCustomerOnDelivering ?? true,
      notifyCustomerOnCompleted: legacy?.notifyCustomerOnCompleted ?? true,
      notifyCustomerOnCancelled: legacy?.notifyCustomerOnCancelled ?? true,
      notifyCustomerReceipt: legacy?.notifyCustomerReceipt ?? true,
      notifyStaffOnNewOrder: legacy?.notifyStaffOnNewOrder ?? true,
      notifyCustomerOnPackageExpiring: legacy?.notifyCustomerOnPackageExpiring ?? true,
      updatedAt: legacy?.updatedAt ?? new Date(0),
    };
  }

  const fields = {
    notifyCustomerOnQuotation: resolveCompatRead(app.notifyCustomerOnQuotation, legacy?.notifyCustomerOnQuotation, true),
    notifyCustomerOnReceived: resolveCompatRead(app.notifyCustomerOnReceived, legacy?.notifyCustomerOnReceived, true),
    notifyCustomerOnProcessing: resolveCompatRead(app.notifyCustomerOnProcessing, legacy?.notifyCustomerOnProcessing, true),
    notifyCustomerOnDelivering: resolveCompatRead(app.notifyCustomerOnDelivering, legacy?.notifyCustomerOnDelivering, true),
    notifyCustomerOnCompleted: resolveCompatRead(app.notifyCustomerOnCompleted, legacy?.notifyCustomerOnCompleted, true),
    notifyCustomerOnCancelled: resolveCompatRead(app.notifyCustomerOnCancelled, legacy?.notifyCustomerOnCancelled, true),
    notifyCustomerReceipt: resolveCompatRead(app.notifyCustomerReceipt, legacy?.notifyCustomerReceipt, true),
    notifyStaffOnNewOrder: resolveCompatRead(app.notifyStaffOnNewOrder, legacy?.notifyStaffOnNewOrder, true),
    notifyCustomerOnPackageExpiring: resolveCompatRead(
      app.notifyCustomerOnPackageExpiring,
      legacy?.notifyCustomerOnPackageExpiring,
      true,
    ),
  };
  emitSettingRead(
    "notification",
    Object.values(fields).map((field) => field.outcome),
  );

  return {
    id: "singleton",
    notifyCustomerOnQuotation: fields.notifyCustomerOnQuotation.value,
    notifyCustomerOnReceived: fields.notifyCustomerOnReceived.value,
    notifyCustomerOnProcessing: fields.notifyCustomerOnProcessing.value,
    notifyCustomerOnDelivering: fields.notifyCustomerOnDelivering.value,
    notifyCustomerOnCompleted: fields.notifyCustomerOnCompleted.value,
    notifyCustomerOnCancelled: fields.notifyCustomerOnCancelled.value,
    notifyCustomerReceipt: fields.notifyCustomerReceipt.value,
    notifyStaffOnNewOrder: fields.notifyStaffOnNewOrder.value,
    notifyCustomerOnPackageExpiring: fields.notifyCustomerOnPackageExpiring.value,
    updatedAt: app.updatedAt,
  };
};
