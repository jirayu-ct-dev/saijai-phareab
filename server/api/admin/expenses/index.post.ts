import { z } from 'zod'
import { prisma } from '~~/server/utils/prisma'
import { requireRole } from '~~/server/utils/auth'
import type { ExpenseItem } from '~~/shared/types/expense'

const createExpenseSchema = z.object({
  categoryId: z.string().min(1, 'กรุณาเลือกหมวดหมู่รายจ่าย'),
  amount: z.number().positive('จำนวนเงินต้องมากกว่า 0').max(10_000_000, 'จำนวนเงินสูงเกินกำหนด'),
  expenseAt: z.string().datetime({ message: 'รูปแบบวันที่ไม่ถูกต้อง' }),
  description: z.string().trim().max(500, 'รายละเอียดต้องไม่เกิน 500 ตัวอักษร').optional().nullable(),
})

export default defineEventHandler(async (event): Promise<ExpenseItem> => {
  const user = await requireRole(event, ['ADMIN'])

  const body = await readValidatedBody(event, (b) => createExpenseSchema.parse(b))

  const category = await prisma.expenseCategory.findUnique({
    where: { id: body.categoryId },
  })

  if (!category || category.deletedAt !== null) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบหมวดหมู่ที่ระบุ' })
  }

  if (!category.isActive) {
    throw createError({ statusCode: 400, statusMessage: 'หมวดหมู่นี้ถูกปิดใช้งานอยู่ ไม่สามารถบันทึกรายจ่ายใหม่ได้' })
  }

  const expense = await prisma.expense.create({
    data: {
      categoryId: body.categoryId,
      amount: body.amount,
      expenseAt: new Date(body.expenseAt),
      description: body.description ?? null,
      createdById: user.id,
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
    },
  })

  return {
    id: expense.id,
    categoryId: expense.categoryId,
    category: {
      id: expense.category.id,
      name: expense.category.name,
      isActive: expense.category.isActive,
    },
    amount: Number(expense.amount),
    expenseAt: expense.expenseAt.toISOString(),
    description: expense.description,
    createdById: expense.createdById,
    createdBy: {
      id: expense.createdBy.id,
      name: expense.createdBy.name,
      email: expense.createdBy.email,
    },
    updatedById: null,
    updatedBy: null,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  }
})
