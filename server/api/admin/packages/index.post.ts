import { prisma } from '~~/server/utils/prisma'
import { requireRole } from '~~/server/utils/auth'

interface CreatePackageBody {
    name: string
    description?: string | null
    packageType: 'MAIN' | 'ADDON'
    isDelivery?: boolean
    deductOn?: 'CREATED' | 'COMPLETED'
    price: number
    credits?: number | null
    validityDays?: number | null
    isActive?: boolean
}

/**
 * POST /api/admin/packages
 * สร้างแพ็กเกจใหม่แบบเดี่ยว
 */
export default defineEventHandler(async (event) => {
    await requireRole(event, ['ADMIN'])

    const body = await readBody<CreatePackageBody>(event)

    // --- Validation ---
    if (!body.name?.trim()) {
        throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกชื่อแพ็กเกจ' })
    }
    if (body.price === undefined || body.price === null || Number(body.price) < 0) {
        throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกราคาที่ถูกต้อง' })
    }
    try {
        const pkg = await prisma.packageProduct.create({
            data: {
                name: body.name.trim(),
                description: body.description?.trim() ?? null,
                packageType: body.packageType ?? 'MAIN',
                isDelivery: body.packageType === 'ADDON' ? Boolean(body.isDelivery) : false,
                deductOn: body.deductOn ?? 'CREATED',
                price: body.price,
                credits: body.credits ?? null,
                validityDays: body.validityDays ?? null,
                isActive: body.isActive ?? true,
            },
        })

        return pkg
    } catch (error) {
        console.error('[POST /api/admin/packages]', error)
        throw createError({ statusCode: 500, statusMessage: 'ไม่สามารถสร้างแพ็กเกจได้' })
    }
})
