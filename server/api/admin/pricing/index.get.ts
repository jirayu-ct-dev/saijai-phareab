import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async () => {
    try {
        const items = await prisma.storefrontItem.findMany({
            where: { isActive: true, deletedAt: null },
            orderBy: [
                { categoryId: 'asc' },
                { name: 'asc' }
            ]
        })

        const services = await prisma.storefrontService.findMany({
            where: { isActive: true, deletedAt: null },
            orderBy: { name: 'asc' }
        })

        const prices = await prisma.storefrontPrice.findMany({
            where: { isActive: true, deletedAt: null }
        })

        return {
            items,
            services,
            prices
        }
    } catch (error) {
        console.error('[GET /api/admin/pricing]', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'ไม่สามารถดึงข้อมูลราคาหน้าร้านได้',
        })
    }
})
