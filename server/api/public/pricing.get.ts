import { prisma } from '~~/server/utils/prisma'

/**
 * GET /api/public/pricing
 * ดึงข้อมูลราคาหน้าร้านทั้งหมด แยกตามประเภทบริการและชิ้นผ้า
 */
export default defineEventHandler(async () => {
    try {
        // Fetch all active services
        const services = await prisma.storefrontService.findMany({
            where: { isActive: true, deletedAt: null },
            orderBy: { name: 'asc' }
        });

        // Fetch all active items
        const items = await prisma.storefrontItem.findMany({
            where: { isActive: true, deletedAt: null },
            orderBy: { name: 'asc' }
        });

        // Fetch all active prices
        const prices = await prisma.storefrontPrice.findMany({
            where: { isActive: true, deletedAt: null }
        });

        return {
            services,
            items,
            prices
        };
    } catch (error) {
        console.error('[GET /api/public/pricing]', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'ไม่สามารถดึงข้อมูลราคาหน้าร้านได้',
        })
    }
})
