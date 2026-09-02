import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN", "EMPLOYEE"]);

  const setting = await prisma.appSetting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });

  return {
    id: setting.id,
    hangerPricePerUnit: Number(setting.hangerPricePerUnit),
    washFoldPricePerKg: Number(setting.washFoldPricePerKg),
    washFoldMinKg: Number(setting.washFoldMinKg),
    vatRate: Number(setting.vatRate),
    vatIncluded: setting.vatIncluded,
    paymentNoPrefix: setting.paymentNoPrefix,
    orderNoPrefix: setting.orderNoPrefix,
    minimumOrderAmount: Number(setting.minimumOrderAmount),
    packageRefundDays: setting.packageRefundDays,
    updatedAt: setting.updatedAt,
  };
});
