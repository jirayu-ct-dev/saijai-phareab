import { prisma } from '~~/server/utils/prisma'
import { requireRole } from '~~/server/utils/auth'
import { parseDateRange } from '~~/server/utils/csv'
import type { DashboardCashflowPoint } from '~~/shared/types/expense'

export default defineEventHandler(async (event): Promise<DashboardCashflowPoint[]> => {
  await requireRole(event, ['ADMIN'])

  const query = getQuery(event)
  const { from, to } = parseDateRange(query.from, query.to)

  const [payments, expenses] = await Promise.all([
    prisma.paymentRecord.findMany({
      where: {
        deletedAt: null,
        status: 'PAID',
        paidAt: { gte: from, lte: to },
      },
      select: { amount: true, paidAt: true },
      orderBy: { paidAt: 'asc' },
    }),
    prisma.expense.findMany({
      where: {
        deletedAt: null,
        expenseAt: { gte: from, lte: to },
      },
      select: { amount: true, expenseAt: true },
      orderBy: { expenseAt: 'asc' },
    }),
  ])

  // Bucket by day (Bangkok UTC+7 = offset 7*3600*1000)
  const BKK_OFFSET = 7 * 60 * 60 * 1000

  const incomeBuckets = new Map<string, number>()
  for (const p of payments) {
    if (!p.paidAt) continue
    const localMs = p.paidAt.getTime() + BKK_OFFSET
    const localDate = new Date(localMs)
    const key = `${localDate.getUTCFullYear()}-${String(localDate.getUTCMonth() + 1).padStart(2, '0')}-${String(localDate.getUTCDate()).padStart(2, '0')}`
    incomeBuckets.set(key, (incomeBuckets.get(key) ?? 0) + Number(p.amount))
  }

  const expenseBuckets = new Map<string, number>()
  for (const e of expenses) {
    const localMs = e.expenseAt.getTime() + BKK_OFFSET
    const localDate = new Date(localMs)
    const key = `${localDate.getUTCFullYear()}-${String(localDate.getUTCMonth() + 1).padStart(2, '0')}-${String(localDate.getUTCDate()).padStart(2, '0')}`
    expenseBuckets.set(key, (expenseBuckets.get(key) ?? 0) + Number(e.amount))
  }

  // Fill all days in range
  const result: DashboardCashflowPoint[] = []
  const cursor = new Date(from.getTime() + BKK_OFFSET)
  cursor.setUTCHours(0, 0, 0, 0)
  const endLocal = new Date(to.getTime() + BKK_OFFSET)
  endLocal.setUTCHours(0, 0, 0, 0)

  while (cursor <= endLocal) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(cursor.getUTCDate()).padStart(2, '0')}`
    const income = incomeBuckets.get(key) ?? 0
    const expense = expenseBuckets.get(key) ?? 0
    result.push({
      date: key,
      income,
      expense,
      net: income - expense,
    })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return result
})
