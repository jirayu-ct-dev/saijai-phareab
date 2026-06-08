import { prisma } from '~~/server/utils/prisma'
import { requireRole } from '~~/server/utils/auth'

/**
 * GET /api/admin/packages
 * ดึงแพ็กเกจทั้งหมด (ไม่รวมที่ถูก soft-delete) พร้อม bundle relations
 */
export default defineEventHandler(async (event) => {
    await requireRole(event, ['ADMIN'])

    try {
        const packages = await prisma.packageProduct.findMany({
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
        })

        return packages
    } catch (error) {
        console.error('[GET /api/admin/packages]', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'ไม่สามารถดึงข้อมูลแพ็กเกจได้',
        })
    }
})
