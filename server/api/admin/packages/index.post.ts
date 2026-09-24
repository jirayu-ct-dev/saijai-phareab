import { prisma } from '~~/server/utils/prisma'
import { requireRole } from '~~/server/utils/auth'
import { hasUsablePackageCredits, normalizePackageUsageSettings } from '~~/shared/utils/packageUsage'
import { createPackageProductSchema } from '~~/shared/utils/packageProductInput'

/**
 * POST /api/admin/packages
 * สร้างแพ็กเกจใหม่แบบเดี่ยว
 */
export default defineEventHandler(async (event) => {
    await requireRole(event, ['ADMIN'])

    const body = await readValidatedBody(event, createPackageProductSchema.parse)

    // --- Validation ---
    if (!body.name?.trim()) {
        throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกชื่อแพ็กเกจ' })
    }
    if (body.price === undefined || body.price === null || Number(body.price) < 0) {
        throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกราคาที่ถูกต้อง' })
    }
    const packageType = body.packageType ?? 'MAIN'
    const packageServiceId = packageType === 'MAIN' ? body.packageServiceId?.trim() || null : null
    const usageSettings = normalizePackageUsageSettings({
        packageType,
        isDelivery: body.isDelivery,
        credits: body.credits,
    })

    if (packageType === 'MAIN' && !packageServiceId) {
        throw createError({ statusCode: 400, statusMessage: 'กรุณาเลือกบริการของแพ็กเกจหลัก' })
    }
    if (!hasUsablePackageCredits(usageSettings)) {
        throw createError({ statusCode: 400, statusMessage: 'กรุณากำหนดเครดิตอย่างน้อย 1 เครดิต' })
    }

    if (packageServiceId) {
        const service = await prisma.packageService.findFirst({
            where: { id: packageServiceId, deletedAt: null, isActive: true },
            select: { id: true, includedItems: { select: { storefrontItemId: true }, take: 1 } },
        })
        if (!service) throw createError({ statusCode: 404, statusMessage: 'ไม่พบบริการที่เลือก' })
        if (!service.includedItems.length) throw createError({ statusCode: 400, statusMessage: 'บริการนี้ยังไม่มีรายการผ้า' })
    }

    try {
        const pkg = await prisma.packageProduct.create({
            data: {
                name: body.name.trim(),
                description: body.description?.trim() ?? null,
                packageType,
                isDelivery: usageSettings.isDelivery,
                deductOn: usageSettings.deductOn,
                price: body.price,
                credits: usageSettings.credits,
                validityDays: body.validityDays ?? 30,
                isActive: body.isActive ?? true,
                isPublic: body.isPublic ?? true,
                packageServiceId,
            },
            include: { packageService: { select: { id: true, name: true } } },
        })

        return pkg
    } catch (error) {
        console.error('[POST /api/admin/packages]', error)
        throw createError({ statusCode: 500, statusMessage: 'ไม่สามารถสร้างแพ็กเกจได้' })
    }
})
