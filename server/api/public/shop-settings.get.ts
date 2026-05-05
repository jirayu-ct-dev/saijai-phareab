import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async () => {
  const settings = await prisma.shopSetting.findFirst();
  return {
    name: settings?.name || "",
    phone: settings?.phone || "",
    address: settings?.address || "",
    logoUrl: settings?.logoUrl || null,
    lineQrImageUrl: settings?.lineQrImageUrl || null,
  };
});
