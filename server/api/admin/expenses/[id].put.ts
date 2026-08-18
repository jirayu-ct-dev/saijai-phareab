import { z } from 'zod'
import { prisma } from '~~/server/utils/prisma'
import { requireRole } from '~~/server/utils/auth'
import type { ExpenseItem } from '~~/shared/types/expense'

const updateExpenseSchema = z.object({
  categoryId: z.string().min(1, 'กรุณาเลือกหมวดหมู่รายจ่าย').optional(),
  amount: z.number().positive('จำนวนเงินต้องมากกว่า 0').max(10_000_000, 'จำนวนเงินสูงเกินกำหนด').optional(),
  expenseAt: z.string().datetime({ message: 'รูปแบบวันที่ไม่ถูกต้อง' }).optional(),
  description: z.string().trim().max(500, 'รายละเอียดต้องไม่เกิน 500 ตัวอักษร').optional().nullable(),
})

export default defineEventHandler(async (event): Promise<ExpenseItem> => {
  const user = await requireRole(event, ['ADMIN'])

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ไม่พบรหัสรายจ่าย' })
  }

  const existing = await prisma.expense.findUnique({
    where: { id },
  })

  if (!existing || existing.deletedAt !== null) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบรายการรายจ่ายที่ระบุ' })
  }

  const body = await readValidatedBody(event, (b) => updateExpenseSchema.parse(b))

  if (body.categoryId !== undefined && body.categoryId !== existing.categoryId) {
    const category = await prisma.expenseCategory.findUnique({
      where: { id: body.categoryId },
    })

    if (!category || category.deletedAt !== null) {
      throw createError({ statusCode: 404, statusMessage: 'ไม่พบหมวดหมู่ที่ระบุ' })
    }

    if (!category.isActive) {
      throw createError({ statusCode: 400, statusMessage: 'หมวดหมู่นี้ถูกปิดใช้งานอยู่ ไม่สามารถเปลี่ยนไปใช้หมวดหมู่นี้ได้' })
    }
  }

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
      ...(body.amount !== undefined ? { amount: body.amount } : {}),
      ...(body.expenseAt !== undefined ? { expenseAt: new Date(body.expenseAt) } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      updatedById: user.id,
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      updatedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  return {
    id: updated.id,
    categoryId: updated.categoryId,
    category: {
      id: updated.category.id,
      name: updated.category.name,
      isActive: updated.category.isActive,
    },
    amount: Number(updated.amount),
    expenseAt: updated.expenseAt.toISOString(),
    description: updated.description,
    createdById: updated.createdById,
    createdBy: {
      id: updated.createdBy.id,
      name: updated.createdBy.name,
      email: updated.createdBy.email,
    },
    updatedById: updated.updatedById,
    updatedBy: updated.updatedBy
      ? {
          id: updated.updatedBy.id,
          name: updated.updatedBy.name,
          email: updated.updatedBy.email,
        }
      : null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  }
})
