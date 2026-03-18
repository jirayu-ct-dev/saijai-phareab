import { prisma } from '~~/server/utils/prisma'

interface UpdatePackageBody {
    name?: string
    description?: string | null
    packageType?: 'MAIN' | 'ADDON'
    price?: number
    credits?: number | null
    bonusCredits?: number | null
    validityDays?: number | null
    isActive?: boolean
    /** ส่งมาเพื่อแทนที่ bundle ทั้งหมด (ถ้าส่ง array ว่าง = ลบ bundle ทั้งหมด) */
    bundledAddons?: Array<{ addonPackageId: string; quantity: number }>
}

/**
 * PUT /api/admin/packages/:id
 * อัปเดตข้อมูลแพ็กเกจ รองรับการแทนที่ Bundle relations ทั้งชุดใน Transaction เดียว
 */
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ไม่พบรหัสแพ็กเกจ' })

    const body = await readBody<UpdatePackageBody>(event)

    // ตรวจสอบว่า Package มีอยู่จริงและยังไม่ถูกลบ
    const existing = await prisma.package.findFirst({ where: { id, deletedAt: null } })
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'ไม่พบแพ็กเกจที่ต้องการแก้ไข' })

    try {
        // ใช้ Transaction เพื่อให้การอัปเดต Bundle และข้อมูลหลักเป็น Atomic
        const updated = await prisma.$transaction(async (tx) => {
            // ถ้าส่ง bundledAddons มา ให้ replace ทั้งหมด (delete + create)
            if (body.bundledAddons !== undefined) {
                await tx.packageBundle.deleteMany({ where: { mainPackageId: id } })
                if (body.bundledAddons.length > 0) {
                    await tx.packageBundle.createMany({
                        data: body.bundledAddons.map((addon) => ({
                            mainPackageId: id,
                            addonPackageId: addon.addonPackageId,
                            quantity: addon.quantity,
                        })),
                    })
                }
            }

            return tx.package.update({
                where: { id },
                data: {
                    ...(body.name !== undefined && { name: body.name.trim() }),
                    ...(body.description !== undefined && { description: body.description }),
                    ...(body.packageType !== undefined && { packageType: body.packageType }),
                    ...(body.price !== undefined && { price: body.price }),
                    ...(body.credits !== undefined && { credits: body.credits }),
                    ...(body.bonusCredits !== undefined && { bonusCredits: body.bonusCredits }),
                    ...(body.validityDays !== undefined && { validityDays: body.validityDays }),
                    ...(body.isActive !== undefined && { isActive: body.isActive }),
                },
                include: {
                    bundledAddons: {
                        include: { addonPackage: { select: { id: true, name: true, packageType: true } } },
                    },
                },
            })
        })

        return updated
    } catch (error) {
        console.error('[PUT /api/admin/packages/:id]', error)
        throw createError({ statusCode: 500, statusMessage: 'ไม่สามารถอัปเดตแพ็กเกจได้' })
    }
})
