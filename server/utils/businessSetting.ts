import { prisma } from "~~/server/utils/prisma";

export type BusinessSettingValues = {
  hangerPricePerUnit: number;
  vatRate: number;
  vatIncluded: boolean;
  paymentNoPrefix: string;
  orderNoPrefix: string;
  minimumOrderAmount: number;
  packageRefundDays: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let cached: { values: BusinessSettingValues; expiresAt: number } | null = null;

const loadFromDb = async (): Promise<BusinessSettingValues> => {
  const setting = await prisma.businessSetting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });

  return {
    hangerPricePerUnit: Number(setting.hangerPricePerUnit),
    vatRate: Number(setting.vatRate),
    vatIncluded: setting.vatIncluded,
    paymentNoPrefix: setting.paymentNoPrefix,
    orderNoPrefix: setting.orderNoPrefix,
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
