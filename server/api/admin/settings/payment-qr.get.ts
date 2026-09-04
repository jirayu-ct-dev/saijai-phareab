import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import { projectPaymentQrSetting } from "~~/server/utils/paymentQrSetting";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const setting = await prisma.appSetting.findUnique({
    where: { id: "singleton" },
    select: {
      paymentQrEnabled: true,
      paymentQrReceiverType: true,
      paymentQrReceiverCiphertext: true,
      paymentQrReceiverLast4: true,
      paymentQrReceiverLabel: true,
      paymentQrKeyVersion: true,
      paymentQrConfigVersion: true,
      paymentQrActivatedAt: true,
    },
  });

  return projectPaymentQrSetting(setting);
});
