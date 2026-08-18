import { prisma } from '~~/server/utils/prisma'
import { requireRole } from '~~/server/utils/auth'
import { parseDateRange } from '~~/server/utils/csv'
import { calculateIncomeBreakdown } from '~~/server/utils/financeIncome'
import type { FinanceSummary } from '~~/shared/types/expense'

export default defineEventHandler(async (event): Promise<FinanceSummary> => {
  await requireRole(event, ['ADMIN'])

  const query = getQuery(event)
  const { from, to } = parseDateRange(query.from, query.to)

  const [paidPayments, expenseSum] = await Promise.all([
    prisma.paymentRecord.findMany({
      where: {
        deletedAt: null,
        status: 'PAID',
        paidAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        amount: true,
        packageSaleId: true,
        serviceOrderId: true,
        serviceOrder: {
          select: {
            weightKg: true,
          },
        },
      },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        deletedAt: null,
        expenseAt: { gte: from, lte: to },
      },
    }),
  ])

  const { totalIncome, breakdown } = calculateIncomeBreakdown(paidPayments)
  const expense = Number(expenseSum._sum.amount ?? 0)
  const net = totalIncome - expense

  return {
    income: totalIncome,
    expense,
    net,
    incomeBreakdown: breakdown,
  }
})
