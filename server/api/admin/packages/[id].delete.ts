import { prisma } from '~~/server/utils/prisma'

/**
 * DELETE /api/admin/packages/:id
 * Soft-delete แพ็กเกจโดยการ set deletedAt
 * ข้อมูลจะยังคงอยู่ใน database แต่จะไม่แสดงในระบบ
 */
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ไม่พบรหัสแพ็กเกจ' })

    const existing = await prisma.packageProduct.findFirst({ where: { id, deletedAt: null } })
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'ไม่พบแพ็กเกจที่ต้องการลบ' })

    try {
        await prisma.packageProduct.update({
            where: { id },
            data: { deletedAt: new Date() },
        })

        return { success: true, message: `ลบแพ็กเกจ "${existing.name}" สำเร็จ` }
    } catch (error) {
        console.error('[DELETE /api/admin/packages/:id]', error)
        throw createError({ statusCode: 500, statusMessage: 'ไม่สามารถลบแพ็กเกจได้' })
    }
})
