import { z } from "zod/v4";
import { prisma } from "~~/server/utils/prisma";
import { requireUser } from "~~/server/utils/auth";

const schema = z.object({
  name: z.string().trim().min(1).max(100).nullish(),
  phoneNumber: z.string().trim().max(20).nullish(),
  image: z.string().url().nullish(),
});

export default defineEventHandler(async (event) => {
  const actor = requireUser(event);
  const body = await readValidatedBody(event, schema.parse);

  await prisma.user.update({
    where: { id: actor.id },
    data: {
      name: body.name ?? undefined,
      phoneNumber: body.phoneNumber ?? null,
      image: body.image ?? null,
    },
  });

  return { success: true };
});
