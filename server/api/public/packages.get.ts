import { prisma } from '~~/server/utils/prisma'

/**
 * GET /api/public/packages
 * ดึงแพ็กเกจที่เปิดให้ใช้งานอยู่ แบ่งเป็น MAIN สำหรับแสดงบนหน้าเว็บหลัก
 */
export default defineEventHandler(async () => {
    try {
        const packages = await prisma.packageProduct.findMany({
            where: { isActive: true, deletedAt: null },
            orderBy: { price: 'asc' },
        })

        return packages.map((pkg) => ({
            id: pkg.id,
            name: pkg.name,
            description: pkg.description,
            packageType: pkg.packageType,
            price: Number(pkg.price),
            credits: pkg.credits,
            validityDays: pkg.validityDays,
            features: [
                pkg.credits ? `${pkg.credits} เครดิต` : null,
                pkg.validityDays ? `อายุการใช้งาน ${pkg.validityDays} วัน` : null,
                pkg.packageType === 'MAIN' ? 'แพ็กเกจหลัก' : 'แพ็กเกจเสริม',
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
