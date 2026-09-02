import { z } from "zod/v4";
import { requireRole } from "~~/server/utils/auth";
import { updateShopSetting } from "~~/server/utils/appSetting";

const schema = z.object({
  name: z.string().max(100),
  phone: z.string().max(20),
  address: z.string().max(300),
  logoUrl: z.string().url().nullish(),
  lineQrImageUrl: z.string().url().nullish(),
});

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const body = await readValidatedBody(event, schema.parse);

  const setting = await updateShopSetting(body);

  return setting;
});
