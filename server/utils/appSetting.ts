import { prisma } from "~~/server/utils/prisma";

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
  const setting = await prisma.appSetting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });
  invalidateBusinessSettingCache();
  return setting;
};

const shopIdentitySelect = {
  id: true,
  name: true,
  phone: true,
  address: true,
  logoUrl: true,
  lineQrImageUrl: true,
  lineQrEnabled: true,
  updatedAt: true,
} as const;

export const updateShopSetting = async (data: ShopSettingWrite) => {
  const update = {
    ...data,
    ...(data.lineQrImageUrl !== undefined
      ? { lineQrEnabled: Boolean(data.lineQrImageUrl) }
      : {}),
  };
  return prisma.appSetting.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      ...data,
      lineQrEnabled: Boolean(data.lineQrImageUrl),
    },
    update,
    select: shopIdentitySelect,
  });
};

const notificationPolicySelect = {
  id: true,
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
} as const;

export const updateNotificationSetting = async (data: NotificationSettingWrite) =>
  prisma.appSetting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
    select: notificationPolicySelect,
  });

export type ShopIdentityValues = {
  name: string;
  phone: string;
  address: string;
  logoUrl: string | null;
  lineQrImageUrl: string | null;
  lineQrEnabled: boolean;
};

/** Load the canonical shop identity without exposing payment QR secrets. */
export const getShopIdentity = async (): Promise<
  ShopIdentityValues & { id: string; updatedAt: Date }
> => {
  const app = await prisma.appSetting.findUnique({
    where: { id: "singleton" },
    select: shopIdentitySelect,
  });

  if (!app) {
    return {
      id: "singleton",
      name: "",
      phone: "",
      address: "",
      logoUrl: null,
      lineQrImageUrl: null,
      lineQrEnabled: false,
      updatedAt: new Date(0),
    };
  }
  return app;
};

/** Load the canonical notification policy. */
export const getNotificationPolicy = async (): Promise<
  NotificationSettingWrite & { id: string; updatedAt: Date }
> => {
  const app = await prisma.appSetting.findUnique({
    where: { id: "singleton" },
    select: notificationPolicySelect,
  });

  if (!app) {
    return {
      id: "singleton",
      notifyCustomerOnQuotation: true,
      notifyCustomerOnReceived: true,
      notifyCustomerOnProcessing: true,
      notifyCustomerOnDelivering: true,
      notifyCustomerOnCompleted: true,
      notifyCustomerOnCancelled: true,
      notifyCustomerReceipt: true,
      notifyStaffOnNewOrder: true,
      notifyCustomerOnPackageExpiring: true,
      updatedAt: new Date(0),
    };
  }
  return app;
};
