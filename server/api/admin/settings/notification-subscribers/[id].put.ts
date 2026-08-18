import { z } from "zod/v4";
import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";

const schema = z.object({
  isActive: z.boolean().optional(),
  receiveNewOrder: z.boolean().optional(),
  receiveStatusChange: z.boolean().optional(),
  receiveReceipt: z.boolean().optional(),
});

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing id" });

  const data = await readValidatedBody(event, schema.parse);

  const subscriber = await prisma.notificationSubscriber.update({
    where: { id },
    data,
  });

  return subscriber;
});
