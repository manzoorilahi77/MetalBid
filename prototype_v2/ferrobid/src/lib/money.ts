/* ---------------------------------------------------------------------------
   The money model — one place where a rupee figure is derived.

   Two screens show ferroBid's commission: the seller's Settlement page and the
   Finance desk's Commission settlements. If they each did their own arithmetic
   the platform would quietly charge two different numbers, and only one of them
   would be right. Everything below takes the rate from Financial Configuration
   rather than a literal, so a rate is stated once and shown many times.

   The commercial model, in one line: **buyers pay sellers directly. ferroBid
   only collects commission** — 10% of the seller's upside over their own
   reserve, on lots the seller accepted. There is no seller payout, which is why
   the Finance workspace has no payout screen.
--------------------------------------------------------------------------- */
import type { DeliveryOrder, FinanceConfig, Lot } from '../types'

/* ------------------------------ per-lot value ------------------------------ */

/** Rate is ₹ per UOM everywhere in the app, so a lot's value is always
 *  rate × indicative quantity. */
export const reserveValue = (l: Lot) => l.reserveRate * l.indicativeQty

/** What the lot actually cleared for — null until it has closed with a price. */
export const clearedValue = (l: Lot): number | null =>
  l.resultH1Rate != null ? l.resultH1Rate * l.indicativeQty : null

/** The seller's upside over their own reserve, in total ₹. This is the base the
 *  commission is cut from — a lot that merely met reserve earns nothing. */
export const upsideValue = (l: Lot): number | null => {
  const cleared = clearedValue(l)
  return cleared == null ? null : cleared - reserveValue(l)
}

/** Commission on one lot. Only ever positive: clearing below reserve is a loss
 *  for the seller, not a discount on our fee. */
export const commissionFor = (l: Lot, cfg: FinanceConfig): number | null => {
  const upside = upsideValue(l)
  return upside == null ? null : Math.max(0, upside) * (cfg.sellerCommissionPct / 100)
}

/** The lots a commission is actually charged on: sold or below-reserve lots the
 *  seller has *accepted*. A rejected price attracts nothing. */
export const billableLots = (lots: Lot[]) =>
  lots.filter((l) => (l.status === 'sold' || l.status === 'sta') && l.sellerDecision === 'accepted')

/** Lots that have cleared but the seller has not yet decided on. */
export const undecidedLots = (lots: Lot[]) =>
  lots.filter((l) => (l.status === 'sold' || l.status === 'sta') && !l.sellerDecision)

export const commissionTotal = (lots: Lot[], cfg: FinanceConfig) =>
  billableLots(lots).reduce((sum, l) => sum + (commissionFor(l, cfg) ?? 0), 0)

/* -------------------------------- buyer side -------------------------------- */

/** What a buyer owes on a delivery order — material plus the taxes collected
 *  with it. Computed on the DO at award; recomputed here only for display. */
export const doDue = (d: DeliveryOrder) => d.materialValue + d.gstAmount + d.tcsAmount
export const doOutstanding = (d: DeliveryOrder) => Math.max(0, doDue(d) - d.paidAmount)

/** Buyer premium — our other income line, charged on the material value of
 *  every delivery order. */
export const buyerPremiumFor = (d: DeliveryOrder, cfg: FinanceConfig) =>
  d.materialValue * (cfg.buyerPremiumPct / 100)

/** How many days past the payment window a delivery order is. Negative means it
 *  is still inside the window. This is what makes an EMD forfeitable. */
export const daysOverdue = (d: DeliveryOrder, cfg: FinanceConfig, now: number) => {
  const dueAt = Date.parse(d.createdAt) + cfg.paymentWindowDays * 86_400_000
  return Math.floor((now - dueAt) / 86_400_000)
}

/* ------------------------------ ageing buckets ------------------------------ */

export type AgeBucket = '0–7' | '8–15' | '16–30' | '30+'

export const ageBucket = (iso: string, now: number): AgeBucket => {
  const days = (now - Date.parse(iso)) / 86_400_000
  if (days <= 7) return '0–7'
  if (days <= 15) return '8–15'
  if (days <= 30) return '16–30'
  return '30+'
}

export const AGE_BUCKETS: AgeBucket[] = ['0–7', '8–15', '16–30', '30+']

/* --------------------------------- periods --------------------------------- */

export type PeriodKey = 'month' | 'quarter' | 'year' | 'all'

export const PERIOD_LABEL: Record<PeriodKey, string> = {
  month: 'This month', quarter: 'This quarter', year: 'This financial year', all: 'All time',
}

/** Start instant of a period, and of the period immediately before it — every
 *  headline figure on the P&L is shown against the previous period, so both are
 *  derived together rather than at two call sites. */
export function periodBounds(period: PeriodKey, now: number): { from: number; to: number; prevFrom: number; prevTo: number } {
  const d = new Date(now)
  if (period === 'all') return { from: 0, to: now, prevFrom: 0, prevTo: 0 }
  if (period === 'month') {
    const from = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
    const prevFrom = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime()
    return { from, to: now, prevFrom, prevTo: from }
  }
  if (period === 'quarter') {
    const q = Math.floor(d.getMonth() / 3)
    const from = new Date(d.getFullYear(), q * 3, 1).getTime()
    const prevFrom = new Date(d.getFullYear(), (q - 1) * 3, 1).getTime()
    return { from, to: now, prevFrom, prevTo: from }
  }
  // Indian financial year — 1 April to 31 March.
  const fyStartYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
  const from = new Date(fyStartYear, 3, 1).getTime()
  const prevFrom = new Date(fyStartYear - 1, 3, 1).getTime()
  return { from, to: now, prevFrom, prevTo: from }
}

export const within = (iso: string | undefined, from: number, to: number) => {
  if (!iso) return false
  const t = Date.parse(iso)
  return t >= from && t <= to
}

/** Percentage change against the previous period, or null when a percentage
 *  would not mean anything.
 *
 *  Two cases return null rather than a number. There is no prior figure at all
 *  (a change from zero is not a percentage), or the prior figure was a loss —
 *  "up 5,267% on last month" against a small negative base is arithmetically
 *  true and tells the reader nothing except that the base was near zero. In
 *  both cases the caller shows the previous figure itself instead. */
export const delta = (current: number, previous: number): number | null =>
  previous <= 0 ? null : ((current - previous) / previous) * 100
