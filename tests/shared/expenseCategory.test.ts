import { describe, expect, it } from 'vitest'
import { normalizeCategoryName } from '../../shared/utils/expenseCategory'

describe('Expense Category Name Normalization', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeCategoryName('  ค่าน้ำยาซักผ้า  ')).toBe('ค่าน้ำยาซักผ้า')
  })

  it('collapses multiple internal whitespace characters into a single space', () => {
    expect(normalizeCategoryName('ค่าเช่า   สถานที่    ร้าน')).toBe('ค่าเช่า สถานที่ ร้าน')
  })

  it('converts uppercase characters to lowercase', () => {
    expect(normalizeCategoryName('  Office   SUPPLIES ')).toBe('office supplies')
  })

  it('handles empty or nullish strings safely', () => {
    expect(normalizeCategoryName('')).toBe('')
    expect(normalizeCategoryName('   ')).toBe('')
  })
})
