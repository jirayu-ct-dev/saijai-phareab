import { prisma } from "~~/server/utils/prisma";
import { getShopIdentity } from "~~/server/utils/appSetting";

export default defineEventHandler(async () => {
  // DB-06 read cutover: shop identity comes from AppSetting (per-field legacy
  // fallback during soak) and the price from the AppSetting business fields,
  // both via explicit selects (plan Phase 5.1).
  const [identity, business] = await Promise.all([
    getShopIdentity(),
    prisma.appSetting.findUnique({
      where: { id: "singleton" },
      select: { washFoldPricePerKg: true },
    }),
  ]);

  return {
    name: identity.name,
    phone: identity.phone,
    address: identity.address,
    logoUrl: identity.logoUrl,
    lineQrImageUrl: identity.lineQrImageUrl,
    washFoldPricePerKg: business?.washFoldPricePerKg ? Number(business.washFoldPricePerKg) : 60,
  };
});
