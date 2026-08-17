import type { IncomeBreakdown, IncomeSourceCategory } from '~~/shared/types/expense'

export interface PaymentRecordSourceInput {
  id: string
  amount: number | { toNumber?: () => number } | string
  packageSaleId: string | null
  serviceOrderId: string | null
  serviceOrder?: {
    weightKg: number | { toNumber?: () => number } | null
  } | null
}

/**
 * Classifies a PaymentRecord into one of 4 mutually exclusive income source categories:
 * 1. PACKAGE_SALE: packageSaleId is present and serviceOrderId is null
 * 2. WASH_FOLD: serviceOrderId is present, packageSaleId is null, and serviceOrder.weightKg is present
 * 3. LAUNDRY_ORDER: serviceOrderId is present, packageSaleId is null, and serviceOrder.weightKg is null
 * 4. OTHER: both are null or both are present (invariant violation)
 */
export function classifyIncomeSource(record: PaymentRecordSourceInput): IncomeSourceCategory {
  const hasPackage = Boolean(record.packageSaleId)
  const hasOrder = Boolean(record.serviceOrderId)

  if (hasPackage && !hasOrder) {
    return 'PACKAGE_SALE'
  }

  if (hasOrder && !hasPackage) {
    const weight = record.serviceOrder?.weightKg
    const hasWeight = weight !== null && weight !== undefined && Number(weight) > 0
    return hasWeight ? 'WASH_FOLD' : 'LAUNDRY_ORDER'
  }

  if (hasPackage && hasOrder) {
    console.warn(`[Finance Classification] Anomaly: PaymentRecord ${record.id} has both packageSaleId and serviceOrderId`)
  }

  return 'OTHER'
}

/**
 * Aggregates a list of PaymentRecord items into a reconciled IncomeBreakdown.
 * Guarantees that packageSale + laundryOrder + washFold + other === totalIncome.
 */
export function calculateIncomeBreakdown(records: PaymentRecordSourceInput[]): {
  totalIncome: number
  breakdown: IncomeBreakdown
} {
  let packageSale = 0
  let laundryOrder = 0
  let washFold = 0
  let other = 0

  for (const record of records) {
    const amt = Number(record.amount)
    if (Number.isNaN(amt) || amt <= 0) continue

    const category = classifyIncomeSource(record)
    switch (category) {
      case 'PACKAGE_SALE':
        packageSale += amt
        break
      case 'LAUNDRY_ORDER':
        laundryOrder += amt
        break
      case 'WASH_FOLD':
        washFold += amt
        break
      case 'OTHER':
        other += amt
        break
    }
  }

  const totalIncome = packageSale + laundryOrder + washFold + other

  return {
    totalIncome,
    breakdown: {
      packageSale,
      laundryOrder,
      washFold,
      other,
    },
  }
}
