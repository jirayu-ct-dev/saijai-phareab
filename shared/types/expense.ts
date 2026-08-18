export interface ExpenseCategory {
  id: string
  name: string
  normalizedName: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  expensesCount?: number
}

export interface ExpenseItem {
  id: string
  categoryId: string
  category: {
    id: string
    name: string
    isActive: boolean
  }
  amount: number
  expenseAt: string
  description: string | null
  createdById: string
  createdBy: {
    id: string
    name: string | null
    email: string
  }
  updatedById?: string | null
  updatedBy?: {
    id: string
    name: string | null
    email: string
  } | null
  createdAt: string
  updatedAt: string
}

export interface ExpenseListResponse {
  items: ExpenseItem[]
  total: number
  page: number
  pageSize: number
  summary: {
    expenseTotal: number
  }
}

export interface IncomeBreakdown {
  packageSale: number
  laundryOrder: number
  washFold: number
  other: number
}

export interface FinanceSummary {
  income: number
  expense: number
  net: number
  incomeBreakdown: IncomeBreakdown
}

export interface DashboardCashflowPoint {
  date: string
  income: number
  expense: number
  net: number
}

export type IncomeSourceCategory = 'PACKAGE_SALE' | 'WASH_FOLD' | 'LAUNDRY_ORDER' | 'OTHER'
