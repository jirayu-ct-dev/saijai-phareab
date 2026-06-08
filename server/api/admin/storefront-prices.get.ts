import { prisma } from '~~/server/utils/prisma'
import { requireRole } from '~~/server/utils/auth'

/**
 * GET /api/admin/storefront-prices
 * ดึงรายการราคาหน้าร้านทั้งหมด พร้อมข้อมูล service และ item เพื่อใช้เป็นตัวเลือกสำหรับโบนัส
 */
export default defineEventHandler(async (event) => {
    await requireRole(event, ['EMPLOYEE', 'ADMIN'])

    try {
        const prices = await prisma.storefrontPrice.findMany({
            where: { isActive: true, deletedAt: null },
            include: {
                storefrontService: { select: { id: true, name: true } },
                storefrontItem: { select: { id: true, name: true } }
            },
            orderBy: [
                { storefrontService: { name: 'asc' } },
                { storefrontItem: { name: 'asc' } }
            ]
        })
        
        return prices.map(p => ({
            id: p.id,
            name: `${p.storefrontService?.name || ''} ${p.storefrontItem?.name || ''}`.trim()
        }))
    } catch (error) {
        console.error('[GET /api/admin/storefront-prices]', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'ไม่สามารถดึงข้อมูลราคาหน้าร้านได้',
        })
    }
})
