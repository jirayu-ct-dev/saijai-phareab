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
    isPublic?: boolean
    serviceId?: string | null
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

    const packageType = body.packageType ?? existing.packageType
    const isDelivery = packageType === 'ADDON' && (body.isDelivery ?? existing.isDelivery)
    const serviceId = packageType === 'MAIN'
        ? body.serviceId !== undefined ? body.serviceId?.trim() || null : existing.serviceId
        : null

    if (packageType === 'MAIN' && !serviceId) {
        throw createError({ statusCode: 400, statusMessage: 'กรุณาเลือกบริการของแพ็กเกจหลัก' })
    }

    if (serviceId) {
        const service = await prisma.storefrontService.findFirst({
            where: { id: serviceId, deletedAt: null, isActive: true },
            select: { id: true },
        })
        if (!service) throw createError({ statusCode: 404, statusMessage: 'ไม่พบบริการที่เลือก' })
    }

    try {
        const updated = await prisma.packageProduct.update({
            where: { id },
            data: {
                ...(body.name !== undefined && { name: body.name.trim() }),
                ...(body.description !== undefined && { description: body.description }),
                packageType,
                isDelivery,
                serviceId,
                ...(body.deductOn !== undefined || isDelivery ? { deductOn: isDelivery ? 'CREATED' : body.deductOn } : {}),
                ...(body.price !== undefined && { price: body.price }),
                ...(body.credits !== undefined || isDelivery ? { credits: isDelivery ? null : body.credits } : {}),
                ...(body.validityDays !== undefined && { validityDays: body.validityDays }),
                ...(body.isActive !== undefined && { isActive: body.isActive }),
                ...(body.isPublic !== undefined && { isPublic: body.isPublic }),
            },
            include: { service: { select: { id: true, name: true } } },
        })

        return updated
    } catch (error) {
        console.error('[PUT /api/admin/packages/:id]', error)
        throw createError({ statusCode: 500, statusMessage: 'ไม่สามารถอัปเดตแพ็กเกจได้' })
    }
})
