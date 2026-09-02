import { z } from "zod/v4";
import { requireRole } from "~~/server/utils/auth";
import { updateBusinessSetting } from "~~/server/utils/appSetting";

const schema = z.object({
  hangerPricePerUnit: z.number().min(0).max(10000),
  washFoldPricePerKg: z.number().min(0).max(10000),
  washFoldMinKg: z.number().min(0).max(1000),
  vatRate: z.number().min(0).max(100),
  vatIncluded: z.boolean(),
  paymentNoPrefix: z.string().trim().min(1).max(20),
  orderNoPrefix: z.string().trim().min(1).max(20),
  minimumOrderAmount: z.number().min(0),
  packageRefundDays: z.number().int().min(0).max(365),
});

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const body = await readValidatedBody(event, schema.parse);

  await updateBusinessSetting(body);

  return { success: true };
});
