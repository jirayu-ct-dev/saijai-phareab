import { prisma } from '~~/server/utils/prisma'
import { requireRole } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['ADMIN'])

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ไม่พบรหัสหมวดหมู่' })
  }

  const category = await prisma.expenseCategory.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          expenses: { where: { deletedAt: null } },
        },
      },
    },
  })

  if (!category || category.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบหมวดหมู่ที่ระบุ' })
  }

  // If category is referenced by active expenses, deactivate it instead of soft-deleting
  if (category._count.expenses > 0) {
    const updated = await prisma.expenseCategory.update({
      where: { id },
      data: { isActive: false },
    })

    return {
      success: true,
      action: 'deactivated',
      message: 'หมวดหมู่นี้มีการใช้งานอยู่ จึงทำการปิดใช้งานแทนการลบ',
      category: {
        id: updated.id,
        name: updated.name,
        isActive: updated.isActive,
      },
    }
  }

  // Otherwise, soft delete
  await prisma.expenseCategory.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deletedById: user.id,
      isActive: false,
    },
  })

  return {
    success: true,
    action: 'deleted',
    message: 'ลบหมวดหมู่เรียบร้อยแล้ว',
  }
})
