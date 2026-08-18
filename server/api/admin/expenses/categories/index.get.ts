import { prisma } from '~~/server/utils/prisma'
import { requireRole } from '~~/server/utils/auth'
import type { ExpenseCategory } from '~~/shared/types/expense'

export default defineEventHandler(async (event): Promise<ExpenseCategory[]> => {
  await requireRole(event, ['ADMIN'])

  const query = getQuery(event)
  const activeOnly = query.activeOnly === 'true'

  const categories = await prisma.expenseCategory.findMany({
    where: {
      deletedAt: null,
      ...(activeOnly ? { isActive: true } : {}),
    },
    include: {
      _count: {
        select: {
          expenses: {
            where: { deletedAt: null },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    normalizedName: cat.normalizedName,
    isActive: cat.isActive,
    createdAt: cat.createdAt.toISOString(),
    updatedAt: cat.updatedAt.toISOString(),
    expensesCount: cat._count.expenses,
  }))
})
