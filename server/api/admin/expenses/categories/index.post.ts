import { z } from 'zod'
import { prisma } from '~~/server/utils/prisma'
import { requireRole } from '~~/server/utils/auth'
import { normalizeCategoryName } from '~~/shared/utils/expenseCategory'
import type { ExpenseCategory } from '~~/shared/types/expense'

const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'กรุณาระบุชื่อหมวดหมู่').max(100, 'ชื่อหมวดหมู่ต้องไม่เกิน 100 ตัวอักษร'),
})

export default defineEventHandler(async (event): Promise<ExpenseCategory> => {
  await requireRole(event, ['ADMIN'])

  const body = await readValidatedBody(event, (b) => createCategorySchema.parse(b))
  const normalizedName = normalizeCategoryName(body.name)

  if (!normalizedName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ชื่อหมวดหมู่ไม่ถูกต้อง',
    })
  }

  // Check if category exists
  const existing = await prisma.expenseCategory.findUnique({
    where: { normalizedName },
  })

  if (existing) {
    if (existing.deletedAt === null) {
      throw createError({
        statusCode: 409,
        statusMessage: 'มีหมวดหมู่นี้อยู่ในระบบแล้ว',
      })
    }

    // Restore previously soft-deleted category
    const restored = await prisma.expenseCategory.update({
      where: { id: existing.id },
      data: {
        name: body.name.trim(),
        isActive: true,
        deletedAt: null,
        deletedById: null,
      },
    })

    return {
      id: restored.id,
      name: restored.name,
      normalizedName: restored.normalizedName,
      isActive: restored.isActive,
      createdAt: restored.createdAt.toISOString(),
      updatedAt: restored.updatedAt.toISOString(),
      expensesCount: 0,
    }
  }

  const created = await prisma.expenseCategory.create({
    data: {
      name: body.name.trim(),
      normalizedName,
      isActive: true,
    },
  })

  return {
    id: created.id,
    name: created.name,
    normalizedName: created.normalizedName,
    isActive: created.isActive,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
    expensesCount: 0,
  }
})
