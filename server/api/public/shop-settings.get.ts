import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async () => {
  const [settings, business] = await Promise.all([
    prisma.shopSetting.findFirst(),
    prisma.businessSetting.findFirst()
  ]);

  return {
    name: settings?.name || "",
    phone: settings?.phone || "",
    address: settings?.address || "",
    logoUrl: settings?.logoUrl || null,
    lineQrImageUrl: settings?.lineQrImageUrl || null,
    washFoldPricePerKg: business?.washFoldPricePerKg ? Number(business.washFoldPricePerKg) : 60,
  };
});
