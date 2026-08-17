import { z } from 'zod'
import { prisma } from '~~/server/utils/prisma'
import { requireRole } from '~~/server/utils/auth'
import { normalizeCategoryName } from '~~/shared/utils/expenseCategory'
import type { ExpenseCategory } from '~~/shared/types/expense'

const updateCategorySchema = z.object({
  name: z.string().trim().min(1, 'กรุณาระบุชื่อหมวดหมู่').max(100, 'ชื่อหมวดหมู่ต้องไม่เกิน 100 ตัวอักษร').optional(),
  isActive: z.boolean().optional(),
})

export default defineEventHandler(async (event): Promise<ExpenseCategory> => {
  await requireRole(event, ['ADMIN'])

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ไม่พบรหัสหมวดหมู่' })
  }

  const category = await prisma.expenseCategory.findUnique({
    where: { id },
  })

  if (!category || category.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบหมวดหมู่ที่ระบุ' })
  }

  const body = await readValidatedBody(event, (b) => updateCategorySchema.parse(b))

  let normalizedName: string | undefined
  if (body.name !== undefined) {
    normalizedName = normalizeCategoryName(body.name)
    if (!normalizedName) {
      throw createError({ statusCode: 400, statusMessage: 'ชื่อหมวดหมู่ไม่ถูกต้อง' })
    }

    if (normalizedName !== category.normalizedName) {
      const duplicate = await prisma.expenseCategory.findUnique({
        where: { normalizedName },
      })
      if (duplicate && duplicate.id !== id && duplicate.deletedAt === null) {
        throw createError({
          statusCode: 409,
          statusMessage: 'มีหมวดหมู่ชื่อนี้อยู่ในระบบแล้ว',
        })
      }
    }
  }

  const updated = await prisma.expenseCategory.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim(), normalizedName } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
    include: {
      _count: {
        select: {
          expenses: { where: { deletedAt: null } },
        },
      },
    },
  })

  return {
    id: updated.id,
    name: updated.name,
    normalizedName: updated.normalizedName,
    isActive: updated.isActive,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    expensesCount: updated._count.expenses,
  }
})
