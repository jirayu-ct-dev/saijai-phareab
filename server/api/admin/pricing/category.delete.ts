import { z } from 'zod'
import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";

const schema = z.object({ id: z.string().min(1) })

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['ADMIN'])
  const body = await readValidatedBody(event, schema.parse)

  await prisma.storefrontCategory.update({
    where: { id: body.id },
    data: { deletedAt: new Date(), deletedById: user.id }
  })

  return { ok: true }
})
