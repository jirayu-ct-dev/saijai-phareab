import { prisma } from '~~/server/utils/prisma'
import { requireRole } from '~~/server/utils/auth'
import { parseDateRange } from '~~/server/utils/csv'
import type { ExpenseListResponse } from '~~/shared/types/expense'
import type { Prisma } from '~~/app/generated/prisma/client'

export default defineEventHandler(async (event): Promise<ExpenseListResponse> => {
  await requireRole(event, ['ADMIN'])

  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20))
  const search = String(query.search ?? '').trim()
  const categoryId = String(query.categoryId ?? '').trim()

  const where: Prisma.ExpenseWhereInput = {
    deletedAt: null,
  }

  if (query.from || query.to) {
    const { from, to } = parseDateRange(query.from, query.to)
    where.expenseAt = { gte: from, lte: to }
  }

  if (categoryId) {
    where.categoryId = categoryId
  }

  if (search) {
    where.OR = [
      { description: { contains: search, mode: 'insensitive' } },
      { category: { name: { contains: search, mode: 'insensitive' } } },
    ]
  }

  const [total, totalSum, expenses] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where,
    }),
    prisma.expense.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ expenseAt: 'desc' }, { createdAt: 'desc' }],
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
    }),
  ])

  const expenseTotal = Number(totalSum._sum.amount ?? 0)

  return {
    items: expenses.map((item) => ({
      id: item.id,
      categoryId: item.categoryId,
      category: {
        id: item.category.id,
        name: item.category.name,
        isActive: item.category.isActive,
      },
      amount: Number(item.amount),
      expenseAt: item.expenseAt.toISOString(),
      description: item.description,
      createdById: item.createdById,
      createdBy: {
        id: item.createdBy.id,
        name: item.createdBy.name,
        email: item.createdBy.email,
      },
      updatedById: item.updatedById,
      updatedBy: item.updatedBy
        ? {
            id: item.updatedBy.id,
            name: item.updatedBy.name,
            email: item.updatedBy.email,
          }
        : null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    summary: {
      expenseTotal,
    },
  }
})
