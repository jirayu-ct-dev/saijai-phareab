import { z } from 'zod'
import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import { validateServiceIncludedItemIds } from "~~/server/utils/serviceIncludedItems";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  includedItemIds: z.array(z.string().min(1)).max(500).optional(),
})

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])
  const body = await readValidatedBody(event, schema.parse)

  const includedItemIds = await validateServiceIncludedItemIds(prisma, body.includedItemIds ?? [])
  const service = await prisma.storefrontService.create({
    data: {
      name: body.name.trim(),
      description: body.description?.trim() || null,
      includedItems: includedItemIds.length
        ? { createMany: { data: includedItemIds.map((storefrontItemId) => ({ storefrontItemId })) } }
        : undefined,
    },
    include: { includedItems: { select: { storefrontItemId: true } } },
  })

  const { includedItems, ...result } = service
  return { ...result, includedItemIds: includedItems.map((item) => item.storefrontItemId) }
})
