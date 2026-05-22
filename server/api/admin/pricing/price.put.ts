import { prisma } from '~~/server/utils/prisma'
import { z } from 'zod'

const schema = z.object({
  storefrontItemId: z.string(),
  storefrontServiceId: z.string(),
  price: z.number().min(0),
  priceMin: z.number().min(0).nullable().optional(),
  priceMax: z.number().min(0).nullable().optional(),
})

export default defineEventHandler(async (event) => {
    try {
        const body = await readValidatedBody(event, schema.parse)

        // Upsert price
        const existingPrice = await prisma.storefrontPrice.findFirst({
            where: {
                storefrontItemId: body.storefrontItemId,
                storefrontServiceId: body.storefrontServiceId,
                deletedAt: null
            }
        })

        const priceData = {
            price: body.price,
            priceMin: body.priceMin ?? null,
            priceMax: body.priceMax ?? null,
        }

        if (existingPrice) {
            const updated = await prisma.storefrontPrice.update({
                where: { id: existingPrice.id },
                data: priceData,
            })
            return updated
        } else {
            const created = await prisma.storefrontPrice.create({
                data: {
                    storefrontItemId: body.storefrontItemId,
                    storefrontServiceId: body.storefrontServiceId,
                    ...priceData,
                }
            })
            return created
        }
    } catch (error: any) {
        console.error('[PUT /api/admin/pricing/price]', error)
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.message || 'ไม่สามารถบันทึกราคาได้',
        })
    }
})
