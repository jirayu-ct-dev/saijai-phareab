import { prisma } from '~~/server/utils/prisma'
import { z } from 'zod'

const schema = z.object({
  id: z.string()
})

export default defineEventHandler(async (event) => {
    try {
        const body = await readValidatedBody(event, schema.parse)

        const deletedItem = await prisma.storefrontItem.updateMany({
            where: { id: body.id },
            data: {
                isActive: false,
                deletedAt: new Date()
            }
        })

        // Also deactivate related prices
        await prisma.storefrontPrice.updateMany({
            where: { storefrontItemId: body.id },
            data: {
                isActive: false,
                deletedAt: new Date()
            }
        })

        return deletedItem
    } catch (error: any) {
        console.error('[DELETE /api/admin/pricing/item]', error)
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.message || 'ไม่สามารถลบรายการได้',
        })
    }
})
