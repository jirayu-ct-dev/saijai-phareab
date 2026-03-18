import { prisma } from '~~/server/utils/prisma'

interface CreatePackageBody {
    name: string
    description?: string | null
    packageType: 'MAIN' | 'ADDON'
    price: number
    credits?: number | null
    bonusCredits?: number | null
    validityDays?: number | null
    isActive?: boolean
    /** รายการ ADDON ที่ผูกเข้ากับแพ็กเกจ MAIN นี้ (สำหรับ Bundle) */
    bundledAddons?: Array<{ addonPackageId: string; quantity: number }>
}

/**
 * POST /api/admin/packages
 * สร้างแพ็กเกจใหม่ รองรับการสร้าง Bundle (MAIN + ADDON) ในครั้งเดียว
 */
export default defineEventHandler(async (event) => {
    const body = await readBody<CreatePackageBody>(event)

    // --- Validation ---
    if (!body.name?.trim()) {
        throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกชื่อแพ็กเกจ' })
    }
    if (body.price === undefined || body.price === null || Number(body.price) < 0) {
        throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกราคาที่ถูกต้อง' })
    }
    if (body.packageType === 'ADDON' && body.bundledAddons?.length) {
        throw createError({ statusCode: 400, statusMessage: 'แพ็กเกจเสริม (ADDON) ไม่สามารถมี Bundle ได้' })
    }

    try {
        const pkg = await prisma.package.create({
            data: {
                name: body.name.trim(),
                description: body.description?.trim() ?? null,
                packageType: body.packageType ?? 'MAIN',
                price: body.price,
                credits: body.credits ?? null,
                bonusCredits: body.bonusCredits ?? 0,
                validityDays: body.validityDays ?? null,
                isActive: body.isActive ?? true,
                // สร้าง bundledAddons พร้อมกันถ้าเป็น MAIN และมีข้อมูล
                ...(body.packageType === 'MAIN' && body.bundledAddons?.length
                    ? {
                        bundledAddons: {
                            create: body.bundledAddons.map((addon) => ({
                                addonPackageId: addon.addonPackageId,
                                quantity: addon.quantity,
                            })),
                        },
                    }
                    : {}),
            },
            include: {
                bundledAddons: {
                    include: { addonPackage: { select: { id: true, name: true, packageType: true } } },
                },
            },
        })

        return pkg
    } catch (error) {
        console.error('[POST /api/admin/packages]', error)
        throw createError({ statusCode: 500, statusMessage: 'ไม่สามารถสร้างแพ็กเกจได้' })
    }
})
