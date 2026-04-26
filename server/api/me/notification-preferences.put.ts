import { z } from "zod/v4";
import { prisma } from "~~/server/utils/prisma";
import { requireUser } from "~~/server/utils/auth";

const schema = z.object({
  lineNotifyEnabled: z.boolean(),
});

export default defineEventHandler(async (event) => {
  const actor = requireUser(event);
  const { lineNotifyEnabled } = await readValidatedBody(event, schema.parse);

  await prisma.user.update({
    where: { id: actor.id },
    data: { lineNotifyEnabled },
  });

  return { success: true, lineNotifyEnabled };
});
