import { z } from "zod/v4";
import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";

const schema = z.object({
  notifyCustomerOnReceived: z.boolean(),
  notifyCustomerOnProcessing: z.boolean(),
  notifyCustomerOnDelivering: z.boolean(),
  notifyCustomerOnCompleted: z.boolean(),
  notifyCustomerOnCancelled: z.boolean(),
  notifyCustomerReceipt: z.boolean(),
  notifyStaffOnNewOrder: z.boolean(),
});

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const body = await readValidatedBody(event, schema.parse);

  const setting = await prisma.notificationSetting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...body },
    update: body,
  });

  return setting;
});
