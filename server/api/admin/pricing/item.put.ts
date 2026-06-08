import { prisma } from '~~/server/utils/prisma'
import { requireRole } from '~~/server/utils/auth'
import { z } from 'zod'

const schema = z.object({
  id: z.string(),
  name: z.string().min(1),
  categoryId: z.string().optional(),
  description: z.string().optional()
})

export default defineEventHandler(async (event) => {
    await requireRole(event, ['EMPLOYEE', 'ADMIN'])

    try {
        const body = await readValidatedBody(event, schema.parse)

        const updatedItem = await prisma.storefrontItem.update({
            where: { id: body.id },
            data: {
                name: body.name,
                categoryId: body.categoryId || null,
                description: body.description || null,
            }
        })

        return updatedItem
    } catch (error: any) {
        console.error('[PUT /api/admin/pricing/item]', error)
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.message || 'ไม่สามารถแก้ไขรายการได้',
        })
    }
})
