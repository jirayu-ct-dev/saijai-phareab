import { z } from 'zod'
import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional()
})

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])
  const body = await readValidatedBody(event, schema.parse)

  const service = await prisma.storefrontService.create({
    data: { name: body.name.trim(), description: body.description?.trim() || null }
  })

  return service
})
