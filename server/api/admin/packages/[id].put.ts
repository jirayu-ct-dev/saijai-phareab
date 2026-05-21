import { prisma } from '~~/server/utils/prisma'
import { requireRole } from '~~/server/utils/auth'

interface UpdatePackageBody {
    name?: string
    description?: string | null
    packageType?: 'MAIN' | 'ADDON'
    isDelivery?: boolean
    deductOn?: 'CREATED' | 'COMPLETED'
    price?: number
    credits?: number | null
    validityDays?: number | null
    isActive?: boolean
}

/**
 * PUT /api/admin/packages/:id
 * อัปเดตข้อมูลแพ็กเกจเดี่ยว
 */
export default defineEventHandler(async (event) => {
    await requireRole(event, ['ADMIN'])

    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ไม่พบรหัสแพ็กเกจ' })

    const body = await readBody<UpdatePackageBody>(event)

    // ตรวจสอบว่า Package มีอยู่จริงและยังไม่ถูกลบ
    const existing = await prisma.packageProduct.findFirst({ where: { id, deletedAt: null } })
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'ไม่พบแพ็กเกจที่ต้องการแก้ไข' })

    try {
        const updated = await prisma.packageProduct.update({
            where: { id },
            data: {
                ...(body.name !== undefined && { name: body.name.trim() }),
                ...(body.description !== undefined && { description: body.description }),
                ...(body.packageType !== undefined && { packageType: body.packageType }),
                ...(body.isDelivery !== undefined && { isDelivery: body.isDelivery }),
                ...(body.deductOn !== undefined && { deductOn: body.deductOn }),
                ...(body.price !== undefined && { price: body.price }),
                ...(body.credits !== undefined && { credits: body.credits }),
                ...(body.validityDays !== undefined && { validityDays: body.validityDays }),
                ...(body.isActive !== undefined && { isActive: body.isActive }),
            },
        })

        return updated
    } catch (error) {
        console.error('[PUT /api/admin/packages/:id]', error)
        throw createError({ statusCode: 500, statusMessage: 'ไม่สามารถอัปเดตแพ็กเกจได้' })
    }
})
