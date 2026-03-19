import { prisma } from '~~/server/utils/prisma'

/**
 * GET /api/public/packages
 * ดึงแพ็กเกจที่เปิดให้ใช้งานอยู่ แบ่งเป็น MAIN สำหรับแสดงบนหน้าเว็บหลัก
 */
export default defineEventHandler(async () => {
    try {
        const packages = await prisma.package.findMany({
            where: { isActive: true, deletedAt: null, packageType: 'MAIN' },
            include: {
                bundledAddons: {
                    include: {
                        addonPackage: {
                            select: { id: true, name: true, description: true },
                        },
                    },
                },
                packageBonuses: {
                    include: {
                        storefrontPrice: {
                            select: {
                                id: true,
                                storefrontService: { select: { name: true } },
                                storefrontItem: { select: { name: true } },
                            },
                        },
                    },
                },
            },
            orderBy: { price: 'asc' },
        })

        // Format to make it easier for frontend
        return packages.map((pkg) => ({
            id: pkg.id,
            name: pkg.name,
            description: pkg.description,
            price: Number(pkg.price),
            credits: pkg.credits,
            bonusCredits: pkg.bonusCredits,
            validityDays: pkg.validityDays,
            features: [
                `${pkg.credits} โควต้าซักรีดตามต้องการ`,
                pkg.bonusCredits ? `แถมฟรี ${pkg.bonusCredits} โควต้าพิเศษ` : null,
                `อายุการใช้งาน ${pkg.validityDays} วัน`,
                ...pkg.bundledAddons.map(b => `ฟรี! แพ็กเกจเสริม ${b.addonPackage.name}`),
                ...pkg.packageBonuses.map(b => `ฟรี! ${b.storefrontPrice.storefrontService?.name} ${b.storefrontPrice.storefrontItem?.name} x${b.quantity}`)
            ].filter(Boolean)
        }))
    } catch (error) {
        console.error('[GET /api/public/packages]', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'ไม่สามารถดึงข้อมูลแพ็กเกจได้',
        })
    }
})
