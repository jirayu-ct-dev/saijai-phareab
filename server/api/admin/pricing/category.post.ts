import { z } from 'zod'
import { prisma } from "~~/server/utils/prisma";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional()
})

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])
  const body = await readValidatedBody(event, schema.parse)

  const category = await prisma.storefrontCategory.create({
    data: { name: body.name.trim(), description: body.description?.trim() || null }
  })

  return category
})
