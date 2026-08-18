import { prisma } from '~~/server/utils/prisma'
import { requireRole } from '~~/server/utils/auth'
import { parseDateRange } from '~~/server/utils/csv'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN', 'EMPLOYEE'])

  const query = getQuery(event)
  const { from, to } = parseDateRange(query.from, query.to)

  const rangeMs = to.getTime() - from.getTime()
  const prevFrom = new Date(from.getTime() - rangeMs)
  const prevTo = new Date(from.getTime() - 1)

  const [
    currentIncomeSum,
    prevIncomeSum,
    currentExpenseSum,
    prevExpenseSum,
    currentNewUsers,
    prevNewUsers,
  ] = await Promise.all([
    // รายรับปัจจุบัน: PaymentRecord ที่ชำระแล้ว (PAID) อิง paidAt
    prisma.paymentRecord.aggregate({
      _sum: { amount: true },
      where: {
        deletedAt: null,
        status: 'PAID',
        paidAt: { gte: from, lte: to },
      },
    }),
    // รายรับช่วงก่อนหน้า
    prisma.paymentRecord.aggregate({
      _sum: { amount: true },
      where: {
        deletedAt: null,
        status: 'PAID',
        paidAt: { gte: prevFrom, lte: prevTo },
      },
    }),
    // รายจ่ายปัจจุบัน: Expense อิง expenseAt
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        deletedAt: null,
        expenseAt: { gte: from, lte: to },
      },
    }),
    // รายจ่ายช่วงก่อนหน้า
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        deletedAt: null,
        expenseAt: { gte: prevFrom, lte: prevTo },
      },
    }),
    // ลูกค้าใหม่ปัจจุบัน
    prisma.user.count({
      where: {
        deletedAt: null,
        role: 'USER',
        createdAt: { gte: from, lte: to },
      },
    }),
    // ลูกค้าใหม่ช่วงก่อนหน้า
    prisma.user.count({
      where: {
        deletedAt: null,
        role: 'USER',
        createdAt: { gte: prevFrom, lte: prevTo },
      },
    }),
  ])

  const calcVariation = (current: number, prev: number) => {
    if (prev === 0) return current > 0 ? 100 : 0
    return Math.round(((current - prev) / Math.abs(prev)) * 100)
  }

  const currentIncome = Number(currentIncomeSum._sum.amount ?? 0)
  const prevIncome = Number(prevIncomeSum._sum.amount ?? 0)
  const currentExpense = Number(currentExpenseSum._sum.amount ?? 0)
  const prevExpense = Number(prevExpenseSum._sum.amount ?? 0)
  const currentNet = currentIncome - currentExpense
  const prevNet = prevIncome - prevExpense

  return [
    {
      title: 'ลูกค้าใหม่',
      icon: 'i-lucide-user-plus',
      to: '/admin/users',
      value: currentNewUsers,
      variation: calcVariation(currentNewUsers, prevNewUsers),
      isCurrency: false,
      statType: 'users',
    },
    {
      title: 'รายรับรวม',
      icon: 'i-lucide-wallet',
      to: '/admin/finance',
      value: currentIncome,
      variation: calcVariation(currentIncome, prevIncome),
      isCurrency: true,
      statType: 'income',
    },
    {
      title: 'รายจ่าย',
      icon: 'i-lucide-receipt',
      to: '/admin/finance',
      value: currentExpense,
      variation: calcVariation(currentExpense, prevExpense),
      isCurrency: true,
      statType: 'expense',
    },
    {
      title: 'ยอดสุทธิ',
      icon: 'i-lucide-coins',
      to: '/admin/finance',
      value: currentNet,
      variation: calcVariation(currentNet, prevNet),
      isCurrency: true,
      statType: 'net',
    },
  ]
})
