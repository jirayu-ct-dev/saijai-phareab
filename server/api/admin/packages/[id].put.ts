import { prisma } from '~~/server/utils/prisma'
import { requireRole } from '~~/server/utils/auth'
import { hasUsablePackageCredits, normalizePackageUsageSettings } from '~~/shared/utils/packageUsage'
import { updatePackageProductSchema } from '~~/shared/utils/packageProductInput'

/**
 * PUT /api/admin/packages/:id
 * อัปเดตข้อมูลแพ็กเกจเดี่ยว
 */
export default defineEventHandler(async (event) => {
    await requireRole(event, ['ADMIN'])

    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ไม่พบรหัสแพ็กเกจ' })

    const body = await readValidatedBody(event, updatePackageProductSchema.parse)

    // ตรวจสอบว่า Package มีอยู่จริงและยังไม่ถูกลบ
    const existing = await prisma.packageProduct.findFirst({ where: { id, deletedAt: null } })
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'ไม่พบแพ็กเกจที่ต้องการแก้ไข' })

    const packageType = body.packageType ?? existing.packageType
    const usageSettings = normalizePackageUsageSettings({
        packageType,
        isDelivery: body.isDelivery ?? existing.isDelivery,
        credits: body.credits !== undefined ? body.credits : existing.credits,
    })
    const serviceId = packageType === 'MAIN'
        ? body.serviceId !== undefined ? body.serviceId?.trim() || null : existing.serviceId
        : null

    const isEditingServiceAssignment = body.packageType !== undefined || body.serviceId !== undefined
    if (packageType === 'MAIN' && isEditingServiceAssignment && !serviceId) {
        throw createError({ statusCode: 400, statusMessage: 'กรุณาเลือกบริการของแพ็กเกจหลัก' })
    }
    const isEditingUsageSettings = body.packageType !== undefined
        || body.isDelivery !== undefined
        || body.credits !== undefined
    if (isEditingUsageSettings && !hasUsablePackageCredits(usageSettings)) {
        throw createError({ statusCode: 400, statusMessage: 'กรุณากำหนดเครดิตอย่างน้อย 1 เครดิต' })
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
                isDelivery: usageSettings.isDelivery,
                serviceId,
                deductOn: usageSettings.deductOn,
                ...(body.price !== undefined && { price: body.price }),
                credits: usageSettings.credits,
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
