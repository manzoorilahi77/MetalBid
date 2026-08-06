/* Formatting helpers — Indian numbering, countdowns, dates. */

export const inr = (n: number): string =>
  '₹' + Math.round(n).toLocaleString('en-IN')

/** ₹12.4 L / ₹1.2 Cr style compact amounts. */
export const inrCompact = (n: number): string => {
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`
}

export const num = (n: number): string => n.toLocaleString('en-IN')

/* ------------------------- amount in words (Indian) ------------------------ */
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

/** 0–99. Hyphenated ("Twenty-Five") the way amounts are written on instruments. */
const under100 = (n: number): string =>
  n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '')

const under1000 = (n: number): string =>
  [Math.floor(n / 100) ? `${ONES[Math.floor(n / 100)]} Hundred` : '', n % 100 ? under100(n % 100) : '']
    .filter(Boolean).join(' ')

/** 0–99,999 — the crore group can run past 999 on large settlements. */
const under100000 = (n: number): string =>
  [Math.floor(n / 1000) ? `${under100(Math.floor(n / 1000))} Thousand` : '', n % 1000 ? under1000(n % 1000) : '']
    .filter(Boolean).join(' ')

/** Rupee amount spelled out in the Indian system, as written on a cheque or
 *  demand draft — 125000 → "One Lakh Twenty-Five Thousand Rupees Only".
 *  Paise are not modelled anywhere in this app, so the value is rounded. */
export const inrWords = (n: number): string => {
  const v = Math.round(Math.abs(n))
  if (v === 0) return 'Zero Rupees Only'
  const groups: [number, string][] = [
    [Math.floor(v / 1e7), 'Crore'],
    [Math.floor((v % 1e7) / 1e5), 'Lakh'],
    [Math.floor((v % 1e5) / 1e3), 'Thousand'],
    [v % 1000, ''],
  ]
  // map before filtering — the index has to stay the group's own, so only the
  // crore group gets the wider expansion
  const words = groups
    .map(([q, unit], i) => (q > 0 ? `${(i === 0 ? under100000 : under1000)(q)}${unit ? ` ${unit}` : ''}` : ''))
    .filter(Boolean)
    .join(' ')
  return `${n < 0 ? 'Minus ' : ''}${words} Rupees Only`
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "3d 04h" / "01:24:08" / "24:08" — for countdown widgets. */
export const countdown = (msLeft: number): string => {
  if (msLeft <= 0) return '00:00'
  const s = Math.floor(msLeft / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d}d ${pad(h)}h ${pad(m)}m`
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(sec)}`
  return `${pad(m)}:${pad(sec)}`
}

/** "in 2d 4h" / "2h ago" — coarse relative time. */
export const relTime = (iso: string, now: number): string => {
  const diff = Date.parse(iso) - now
  const abs = Math.abs(diff)
  const m = Math.floor(abs / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  const core = d > 0 ? `${d}d ${h % 24}h` : h > 0 ? `${h}h ${m % 60}m` : `${m}m`
  return diff >= 0 ? `in ${core}` : `${core} ago`
}

export const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

export const fmtDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })

export const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

let _uid = 0
export const uid = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${++_uid}`
