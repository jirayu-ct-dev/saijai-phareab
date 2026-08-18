import { describe, expect, it } from 'vitest'

describe('Dashboard Cashflow & Variation Logic', () => {
  const calcVariation = (current: number, prev: number) => {
    if (prev === 0) return current > 0 ? 100 : 0
    return Math.round(((current - prev) / Math.abs(prev)) * 100)
  }

  it('calculates positive variation correctly', () => {
    expect(calcVariation(150, 100)).toBe(50)
  })

  it('calculates negative variation correctly', () => {
    expect(calcVariation(80, 100)).toBe(-20)
  })

  it('handles zero previous base correctly', () => {
    expect(calcVariation(500, 0)).toBe(100)
    expect(calcVariation(0, 0)).toBe(0)
  })

  it('calculates net cashflow: income - expense', () => {
    const calcNet = (income: number, expense: number) => income - expense
    expect(calcNet(5000, 2000)).toBe(3000)
    expect(calcNet(2000, 5000)).toBe(-3000)
    expect(calcNet(2500, 2500)).toBe(0)
  })
})
