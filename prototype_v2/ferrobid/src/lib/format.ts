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
