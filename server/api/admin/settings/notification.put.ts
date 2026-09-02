import { z } from "zod/v4";
import { requireRole } from "~~/server/utils/auth";
import { updateNotificationSetting } from "~~/server/utils/appSetting";

const schema = z.object({
  notifyCustomerOnQuotation: z.boolean(),
  notifyCustomerOnReceived: z.boolean(),
  notifyCustomerOnProcessing: z.boolean(),
  notifyCustomerOnDelivering: z.boolean(),
  notifyCustomerOnCompleted: z.boolean(),
  notifyCustomerOnCancelled: z.boolean(),
  notifyCustomerReceipt: z.boolean(),
  notifyStaffOnNewOrder: z.boolean(),
  notifyCustomerOnPackageExpiring: z.boolean(),
});

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const body = await readValidatedBody(event, schema.parse);
  const setting = await updateNotificationSetting(body);

  return setting;
});
