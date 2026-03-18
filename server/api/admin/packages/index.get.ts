import { prisma } from '~~/server/utils/prisma'

/**
 * GET /api/admin/packages
 * ดึงแพ็กเกจทั้งหมด (ไม่รวมที่ถูก soft-delete) พร้อม bundle relations
 */
export default defineEventHandler(async () => {
    try {
        const packages = await prisma.package.findMany({
            where: { deletedAt: null },
            include: {
                // แพ็กเกจเสริมที่ถูกผูกไว้ (สำหรับ Bundle tab)
                bundledAddons: {
                    include: {
                        addonPackage: {
                            select: { id: true, name: true, packageType: true, isActive: true },
                        },
                    },
                },
                // โบนัส (แถมบริการหน้าร้าน)
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
                // ข้อมูลว่าแพ็กเกจนี้ถูกรวมในชุดไหนบ้าง
                includedInBundles: {
                    include: {
                        mainPackage: {
                            select: { id: true, name: true },
                        },
                    },
                },
            },
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
