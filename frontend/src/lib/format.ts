const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})
const plain = new Intl.NumberFormat('en-IN')
const IST = 'Asia/Kolkata'

export const inr = (amount: number) => rupees.format(amount)
export const number = (n: number) => plain.format(n)
export const km = (n: number) => `${plain.format(n)} km`

/** ₹12.45 lakh / ₹1.2 crore — how Indian buyers talk about car prices. */
export function lakh(amount: number) {
  if (amount >= 1_00_00_000) return `₹${+(amount / 1_00_00_000).toFixed(2)} crore`
  if (amount >= 1_00_000) return `₹${+(amount / 1_00_000).toFixed(2)} lakh`
  return inr(amount)
}

export const date = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: IST })

export const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: IST })

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: IST,
  })

/** "4m", "2h 5m", "3d" */
export function duration(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60_000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  return `${Math.floor(hours / 24)}d`
}

export const ago = (iso: string, now = Date.now()) => `${duration(now - new Date(iso).getTime())} ago`

/** YYYY-MM-DD for "today + n days" in IST, for date inputs and the slot API. */
export function istDay(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000)
  return d.toLocaleDateString('en-CA', { timeZone: IST })
}

const ACRONYMS: Record<string, string> = { cng: 'CNG', ev: 'EV' }

export const titleCase = (s: string) =>
  ACRONYMS[s] ?? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
