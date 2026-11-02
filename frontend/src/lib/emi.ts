/** Standard reducing-balance EMI. Rate is annual %, tenure in months. */
export function emi(principal: number, annualRate: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0
  const r = annualRate / 12 / 100
  if (r === 0) return Math.round(principal / months)
  const factor = (1 + r) ** months
  return Math.round((principal * r * factor) / (factor - 1))
}

export function loanSummary(price: number, downPayment: number, annualRate: number, months: number) {
  const principal = Math.max(0, price - downPayment)
  const monthly = emi(principal, annualRate, months)
  const totalPaid = monthly * months
  return { principal, monthly, interest: Math.max(0, totalPaid - principal) }
}
