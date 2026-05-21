import { prisma } from '~~/server/utils/prisma'
import { requireRole } from '~~/server/utils/auth'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1),
  categoryId: z.string().optional(),
  description: z.string().optional()
})

export default defineEventHandler(async (event) => {
    await requireRole(event, ['EMPLOYEE', 'ADMIN'])

    try {
        const body = await readValidatedBody(event, schema.parse)

        const createdItem = await prisma.storefrontItem.create({
            data: {
                name: body.name,
                categoryId: body.categoryId || null,
                description: body.description || null,
            }
        })

        return createdItem
    } catch (error: any) {
        console.error('[POST /api/admin/pricing/item]', error)
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.message || 'ไม่สามารถเพิ่มรายการได้',
        })
    }
})
