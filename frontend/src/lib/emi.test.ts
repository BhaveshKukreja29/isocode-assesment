import { describe, expect, it } from 'vitest'
import { emi, loanSummary } from './emi'

describe('emi', () => {
  it('matches the standard reducing-balance formula', () => {
    // ₹10 lakh at 9.5% for 60 months: bank calculators give ₹21,002.
    expect(emi(10_00_000, 9.5, 60)).toBe(21_002)
  })

  it('handles zero interest and empty loans', () => {
    expect(emi(6_00_000, 0, 60)).toBe(10_000)
    expect(emi(0, 9.5, 60)).toBe(0)
  })

  it('never lends more than the price', () => {
    expect(loanSummary(5_00_000, 6_00_000, 9.5, 60)).toEqual({ principal: 0, monthly: 0, interest: 0 })
  })
})
