import { z } from "zod/v4";
import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import { loadPaymentQrReceiverKeyring } from "~~/server/utils/printDocument";
import {
  PaymentQrSettingError,
  prepareMobilePaymentQrUpdate,
  projectPaymentQrSetting,
} from "~~/server/utils/paymentQrSetting";

const schema = z.object({
  enabled: z.boolean(),
  receiverValue: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? null : value,
    z.string().trim().max(30).nullable(),
  ),
  receiverLabel: z.string().trim().min(1).max(100),
});

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["ADMIN"]);
  const body = await readValidatedBody(event, schema.parse);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.appSetting.findUnique({
        where: { id: "singleton" },
        select: {
          paymentQrEnabled: true,
          paymentQrProvider: true,
          paymentQrReceiverType: true,
          paymentQrReceiverCiphertext: true,
          paymentQrReceiverLast4: true,
          paymentQrReceiverLabel: true,
          paymentQrKeyVersion: true,
          paymentQrConfigVersion: true,
          paymentQrActivatedAt: true,
          paymentQrActivatedById: true,
        },
      });
      const data = prepareMobilePaymentQrUpdate({
        current,
        input: body,
        keyring: loadPaymentQrReceiverKeyring(),
        actorId: actor.id,
        now: new Date(),
      });
      return tx.appSetting.upsert({
        where: { id: "singleton" },
        create: { id: "singleton", ...data },
        update: data,
      });
    });

    return projectPaymentQrSetting(updated);
  } catch (error) {
    if (error instanceof PaymentQrSettingError) {
      throw createError({
        statusCode: error.message.includes("กุญแจเข้ารหัส") ? 503 : 400,
        statusMessage: error.message,
      });
    }
    throw error;
  }
});
