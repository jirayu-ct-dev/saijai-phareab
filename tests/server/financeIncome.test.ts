import { describe, expect, it } from 'vitest'
import { classifyIncomeSource, calculateIncomeBreakdown } from '../../server/utils/financeIncome'

describe('Finance Income Source Classification & Breakdown', () => {
  it('classifies package payment as PACKAGE_SALE', () => {
    const record = {
      id: 'pay_1',
      amount: 500,
      packageSaleId: 'sale_123',
      serviceOrderId: null,
      serviceOrder: null,
    }
    expect(classifyIncomeSource(record)).toBe('PACKAGE_SALE')
  })

  it('classifies service-order with weightKg as WASH_FOLD', () => {
    const record = {
      id: 'pay_2',
      amount: 150,
      packageSaleId: null,
      serviceOrderId: 'order_123',
      serviceOrder: {
        weightKg: 4.5,
      },
    }
    expect(classifyIncomeSource(record)).toBe('WASH_FOLD')
  })

  it('classifies service-order without weightKg as LAUNDRY_ORDER', () => {
    const record = {
      id: 'pay_3',
      amount: 200,
      packageSaleId: null,
      serviceOrderId: 'order_456',
      serviceOrder: {
        weightKg: null,
      },
    }
    expect(classifyIncomeSource(record)).toBe('LAUNDRY_ORDER')
  })

  it('classifies record with missing references or both references as OTHER', () => {
    const recordNeither = {
      id: 'pay_4',
      amount: 100,
      packageSaleId: null,
      serviceOrderId: null,
      serviceOrder: null,
    }
    expect(classifyIncomeSource(recordNeither)).toBe('OTHER')

    const recordBoth = {
      id: 'pay_5',
      amount: 100,
      packageSaleId: 'sale_1',
      serviceOrderId: 'order_1',
      serviceOrder: { weightKg: 2 },
    }
    expect(classifyIncomeSource(recordBoth)).toBe('OTHER')
  })

  it('calculates income breakdown ensuring sum(breakdown) === totalIncome', () => {
    const records = [
      { id: '1', amount: 1000, packageSaleId: 'pkg_1', serviceOrderId: null },
      { id: '2', amount: 300, packageSaleId: null, serviceOrderId: 'ord_1', serviceOrder: { weightKg: null } },
      { id: '3', amount: 150, packageSaleId: null, serviceOrderId: 'ord_2', serviceOrder: { weightKg: 3.5 } },
      { id: '4', amount: 50, packageSaleId: null, serviceOrderId: null }, // OTHER
    ]

    const { totalIncome, breakdown } = calculateIncomeBreakdown(records)

    expect(totalIncome).toBe(1500)
    expect(breakdown.packageSale).toBe(1000)
    expect(breakdown.laundryOrder).toBe(300)
    expect(breakdown.washFold).toBe(150)
    expect(breakdown.other).toBe(50)

    const sumBreakdown =
      breakdown.packageSale +
      breakdown.laundryOrder +
      breakdown.washFold +
      breakdown.other

    expect(sumBreakdown).toBe(totalIncome)
  })

  it('ignores non-positive amounts', () => {
    const records = [
      { id: '1', amount: 1000, packageSaleId: 'pkg_1', serviceOrderId: null },
      { id: '2', amount: 0, packageSaleId: 'pkg_2', serviceOrderId: null },
      { id: '3', amount: -50, packageSaleId: 'pkg_3', serviceOrderId: null },
    ]

    const { totalIncome, breakdown } = calculateIncomeBreakdown(records)

    expect(totalIncome).toBe(1000)
    expect(breakdown.packageSale).toBe(1000)
  })
})
