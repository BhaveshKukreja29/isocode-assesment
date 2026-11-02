import { describe, expect, it } from 'vitest'
import { duration, inr, lakh, titleCase } from './format'

describe('format', () => {
  it('uses Indian digit grouping', () => {
    expect(inr(1_426_625)).toBe('₹14,26,625')
  })

  it('speaks in lakh and crore', () => {
    expect(lakh(12_45_000)).toBe('₹12.45 lakh')
    expect(lakh(1_20_00_000)).toBe('₹1.2 crore')
    expect(lakh(85_000)).toBe('₹85,000')
  })

  it('formats response times', () => {
    expect(duration(4 * 60_000)).toBe('4m')
    expect(duration(125 * 60_000)).toBe('2h 5m')
    expect(duration(-1)).toBe('0m')
  })

  it('title-cases enum values', () => {
    expect(titleCase('test_drive')).toBe('Test Drive')
    expect(titleCase('cng')).toBe('CNG')
  })
})
