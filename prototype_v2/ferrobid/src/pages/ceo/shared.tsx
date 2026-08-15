/* ---------------------------------------------------------------------------
   CEO / MD workspace — shared derivations and primitives.

   This role reads the business and signs the handful of decisions that are
   above anyone else's authority. It is built around four plain questions, in
   order: are we making money · is the business growing · is anything at risk ·
   what needs me. Eight screens, and only one of them has buttons.

   Three rules run through the whole workspace:

   · **The same numbers as Finance, in plainer words.** Net profit here is the
     net profit on the Finance P&L, arrived at by the same `useBooks()` — not a
     second calculation that could disagree. What differs is depth: Finance can
     open every figure down to the individual payment; this stops at the summary
     and says what the figure means.
   · **Money we are holding is never drawn as money we have.** EMD is a
     customer's deposit sitting in our account. It appears under "money at
     risk", in steel, and never inside profit.
   · **No buttons except on the signature queue.** Everything else is a reading
     surface. Where an action belongs to another desk, this workspace says whose
     it is rather than offering a control that would be refused.
--------------------------------------------------------------------------- */
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { Chip, cx } from '../../components/ui'
import { canSignForCeo, delegationActive, useStore } from '../../store/store'
import { useNow } from '../../lib/useTick'
import { inr, inrCompact, num } from '../../lib/format'
import {
  ageBucket, clearedValue, commissionFor, delta, doDue, doOutstanding, periodBounds, reserveValue, within,
  AGE_BUCKETS, type AgeBucket, type PeriodKey,
} from '../../lib/money'
import { useBooks, type Books, type CommissionRow } from '../finance/shared'
import type { Bid, Catalogue, CeoApprovalRequest, Dispute, Lot, User } from '../../types'

export { useBooks }
export type { Books, CommissionRow }

/* ============================ is it growing? ============================== */

/** One window of trading, measured the same way whichever window it is — so the
 *  previous period is genuinely comparable rather than estimated. */
export interface GrowthWindow {
  /** What the material sold for, at the price it cleared. Not our income —
   *  buyers pay sellers directly; we only ever earn commission on the upside. */
  salesValue: number
  lotsSold: number
  lotsOffered: number
  /** Tonnage across sold lots priced per MT. Lots sold by piece or by lot are
   *  counted in `lotsSold` and deliberately left out of this figure. */
  tonnage: number
  auctionsRun: number
  auctionsClosed: number
  bids: number
  activeBuyers: number
  /** Buyers who bid in this window and had also bid before it. */
  repeatBuyers: number
  /** Accounts that registered inside the window. */
  newCustomers: number
  /** Average % the winning price beat the seller's own reserve by. */
  avgUplift: number
}

export interface Growth {
  now: number
  period: PeriodKey
  current: GrowthWindow
  previous: GrowthWindow
  /** Sales value by calendar month, oldest first — twelve points. */
  trend: { label: string; value: number }[]
  /** Sales value by metal category and by region, largest first. */
  byCategory: { key: string; label: string; sub: string; amount: number }[]
  byRegion: { key: string; label: string; sub: string; amount: number }[]
  /** Buyers ranked by what they bought, with how many auctions they came to. */
  topBuyers: { key: string; label: string; sub: string; amount: number }[]
}

const soldLots = (lots: Lot[]) => lots.filter((l) => (l.status === 'sold' || l.status === 'sta') && l.resultH1Rate != null)

export function useGrowth(period: PeriodKey): Growth {
  const now = useNow()
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const bids = useStore((s) => s.bids)
  const users = useStore((s) => s.users)

  return useMemo(() => {
    const { from, to, prevFrom, prevTo } = periodBounds(period, now)
    const lotsByCat = new Map<string, Lot[]>()
    for (const l of lots) {
      const arr = lotsByCat.get(l.catalogueId)
      if (arr) arr.push(l)
      else lotsByCat.set(l.catalogueId, [l])
    }
    const validBids = bids.filter((b) => b.status === 'valid')

    const measure = (f: number, t: number): GrowthWindow => {
      const closed = catalogues.filter((c) => c.status === 'closed' && within(c.endsAt, f, t))
      const offered = closed.flatMap((c) => lotsByCat.get(c.id) ?? [])
      const sold = soldLots(offered)
      const windowBids = validBids.filter((b) => within(b.at, f, t))
      const bidders = new Set(windowBids.map((b) => b.bidderId))
      const earlier = new Set(validBids.filter((b) => Date.parse(b.at) < f).map((b) => b.bidderId))
      const uplifts = sold
        .map((l) => {
          const reserve = reserveValue(l)
          return reserve > 0 ? ((clearedValue(l) ?? 0) - reserve) / reserve : null
        })
        .filter((v): v is number => v != null)
      return {
        salesValue: sold.reduce((sum, l) => sum + (clearedValue(l) ?? 0), 0),
        lotsSold: sold.length,
        lotsOffered: offered.length,
        tonnage: sold.filter((l) => l.uom === 'MT').reduce((sum, l) => sum + l.indicativeQty, 0),
        auctionsRun: catalogues.filter((c) => c.status !== 'draft' && within(c.startsAt, f, t)).length,
        auctionsClosed: closed.length,
        bids: windowBids.length,
        activeBuyers: bidders.size,
        repeatBuyers: [...bidders].filter((id) => earlier.has(id)).length,
        newCustomers: users.filter((u) => (u.role === 'buyer' || u.role === 'seller') && within(u.joinedAt, f, t)).length,
        avgUplift: uplifts.length ? (uplifts.reduce((s, v) => s + v, 0) / uplifts.length) * 100 : 0,
      }
    }

    const current = measure(from, to)
    const previous = period === 'all'
      ? measure(0, 0)
      : measure(prevFrom, prevTo)

    /* --------------------------- twelve months --------------------------- */
    const d = new Date(now)
    const buckets = Array.from({ length: 12 }, (_, i) => {
      const m = new Date(d.getFullYear(), d.getMonth() - (11 - i), 1)
      return { key: `${m.getFullYear()}-${m.getMonth()}`, label: m.toLocaleDateString('en-IN', { month: 'short' }), value: 0 }
    })
    const index = new Map(buckets.map((b, i) => [b.key, i]))
    for (const c of catalogues) {
      if (c.status !== 'closed') continue
      const when = new Date(c.endsAt)
      const i = index.get(`${when.getFullYear()}-${when.getMonth()}`)
      if (i == null) continue
      buckets[i].value += soldLots(lotsByCat.get(c.id) ?? []).reduce((sum, l) => sum + (clearedValue(l) ?? 0), 0)
    }

    /* ---------------------------- breakdowns ----------------------------- */
    const closedInWindow = catalogues.filter((c) => c.status === 'closed' && within(c.endsAt, from, to))
    const soldInWindow = closedInWindow.flatMap((c) => soldLots(lotsByCat.get(c.id) ?? []).map((l) => ({ l, cat: c })))

    const rank = <T,>(
      rows: { key: string; label: string; amount: number; extra: T }[],
      sub: (extra: T) => string,
    ) => rows
      .map((r) => ({ key: r.key, label: r.label, sub: sub(r.extra), amount: r.amount }))
      .sort((a, b) => b.amount - a.amount)

    const catMap = new Map<string, { amount: number; lots: number }>()
    for (const { l } of soldInWindow) {
      const prev = catMap.get(l.category) ?? { amount: 0, lots: 0 }
      catMap.set(l.category, { amount: prev.amount + (clearedValue(l) ?? 0), lots: prev.lots + 1 })
    }
    const regionMap = new Map<string, { amount: number; auctions: Set<string> }>()
    for (const { l, cat } of soldInWindow) {
      const prev = regionMap.get(cat.region) ?? { amount: 0, auctions: new Set<string>() }
      prev.amount += clearedValue(l) ?? 0
      prev.auctions.add(cat.id)
      regionMap.set(cat.region, prev)
    }
    const buyerMap = new Map<string, { amount: number; auctions: Set<string> }>()
    for (const { l, cat } of soldInWindow) {
      if (!l.leadingBidderId) continue
      const prev = buyerMap.get(l.leadingBidderId) ?? { amount: 0, auctions: new Set<string>() }
      prev.amount += clearedValue(l) ?? 0
      prev.auctions.add(cat.id)
      buyerMap.set(l.leadingBidderId, prev)
    }

    return {
      now,
      period,
      current,
      previous,
      trend: buckets,
      byCategory: rank(
        [...catMap.entries()].map(([key, v]) => ({ key, label: key.replace(/-/g, ' '), amount: v.amount, extra: v.lots })),
        (lotCount: number) => `${num(lotCount)} lot${lotCount === 1 ? '' : 's'}`,
      ),
      byRegion: rank(
        [...regionMap.entries()].map(([key, v]) => ({ key, label: key, amount: v.amount, extra: v.auctions.size })),
        (auctions: number) => `${num(auctions)} auction${auctions === 1 ? '' : 's'}`,
      ),
      topBuyers: rank(
        [...buyerMap.entries()].map(([id, v]) => ({
          key: id,
          label: users.find((u) => u.id === id)?.firm ?? 'Unknown buyer',
          amount: v.amount,
          extra: v.auctions.size,
        })),
        (auctions: number) => `${num(auctions)} auction${auctions === 1 ? '' : 's'}`,
      ),
    }
  }, [period, now, catalogues, lots, bids, users])
}

/* ========================= what did we earn, by month? =================== */

/** Income recognised by calendar month — commission Finance has matched to the
 *  bank, plus buyer premium on paid delivery orders. The rows behind it are
 *  period-independent, so one pass over them gives the whole year.
 *
 *  A pure function of the books rather than a second hook, because the P&L and
 *  the dashboard both draw this curve: two implementations would eventually
 *  disagree, and the one nobody checked would be the one that got forwarded.
 *  Wrap in `useMemo` at the call site. */
export function incomeByMonth(books: Books): { label: string; value: number }[] {
  const now = new Date(books.now)
  const buckets = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-IN', { month: 'short' }), value: 0 }
  })
  const index = new Map(buckets.map((b, i) => [b.key, i]))
  const add = (iso: string | undefined, amount: number) => {
    if (!iso) return
    const d = new Date(iso)
    const i = index.get(`${d.getFullYear()}-${d.getMonth()}`)
    if (i != null) buckets[i].value += amount
  }
  for (const r of books.commissionRows) {
    if (r.confirmed) add(r.settlement?.confirmedAt, r.commissionDue)
  }
  for (const row of books.deliveryRows) {
    if (row.d.paidAmount > 0) add(row.d.createdAt, row.d.materialValue * (books.cfg.buyerPremiumPct / 100))
  }
  return buckets.map(({ label, value }) => ({ label, value }))
}

/* ========================= did the sales work? =========================== */

/** One closed auction, measured the way the auction performance screen measures
 *  it — sell-through, uplift over the seller's own floor, and how deep the
 *  bidding actually went. */
export interface AuctionResultRow {
  id: string
  code: string
  title: string
  region: string
  closedAt: string
  lotsOffered: number
  lotsSold: number
  realisation: number
  reserve: number
  uplift: number | null
  bidders: number
  bids: number
  extensions: number
  confirmed: boolean
}

export interface AuctionPerformance {
  now: number
  /** Closed auctions inside the window, newest first. */
  rows: AuctionResultRow[]
  live: Catalogue[]
  upcoming: Catalogue[]
  totals: {
    auctions: number
    totalLots: number
    soldLots: number
    sellThrough: number
    bidsPerLot: number
    biddersPerAuction: number
    extensions: number
    extensionRate: number
    /** Bids a Super Admin struck off, and every bid surveillance put on record. */
    voids: number
    flags: number
    cancellations: number
    realisation: number
  }
}

/** How well the sales themselves worked, as opposed to how big they were.
 *  Shared by the auction performance screen and the dashboard's summary of it,
 *  so a sell-through figure cannot mean two things in two places. */
export function useAuctionPerformance(period: PeriodKey): AuctionPerformance {
  const now = useNow()
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const bids = useStore((s) => s.bids)
  const bidVoidRequests = useStore((s) => s.bidVoidRequests)
  const cancellationRequests = useStore((s) => s.cancellationRequests)
  const resultConfirmations = useStore((s) => s.resultConfirmations)

  return useMemo(() => {
    const { from, to } = periodBounds(period, now)
    const inWindow = (iso: string) => (period === 'all' ? true : within(iso, from, to))
    const lotsByCat = new Map<string, Lot[]>()
    for (const l of lots) {
      const arr = lotsByCat.get(l.catalogueId)
      if (arr) arr.push(l)
      else lotsByCat.set(l.catalogueId, [l])
    }

    const rows: AuctionResultRow[] = catalogues
      .filter((c) => c.status === 'closed' && inWindow(c.endsAt))
      .map((c) => {
        const catLots = lotsByCat.get(c.id) ?? []
        const sold = soldLots(catLots)
        const catBids = bids.filter((b) => b.catalogueId === c.id && b.status === 'valid')
        const realisation = sold.reduce((s, l) => s + (clearedValue(l) ?? 0), 0)
        const reserve = sold.reduce((s, l) => s + reserveValue(l), 0)
        return {
          id: c.id,
          code: c.code,
          title: c.title,
          region: c.region,
          closedAt: c.endsAt,
          lotsOffered: catLots.length,
          lotsSold: sold.length,
          realisation,
          reserve,
          uplift: reserve > 0 ? ((realisation - reserve) / reserve) * 100 : null,
          bidders: new Set(catBids.map((b) => b.bidderId)).size,
          bids: catBids.length,
          extensions: catLots.reduce((s, l) => s + l.extensions, 0),
          confirmed: resultConfirmations.some((r) => r.catalogueId === c.id),
        }
      })
      .sort((a, b) => Date.parse(b.closedAt) - Date.parse(a.closedAt))

    const totalLots = rows.reduce((s, r) => s + r.lotsOffered, 0)
    const sold = rows.reduce((s, r) => s + r.lotsSold, 0)
    const totalBids = rows.reduce((s, r) => s + r.bids, 0)
    const extensions = rows.reduce((s, r) => s + r.extensions, 0)

    return {
      now,
      rows,
      live: catalogues.filter((c) => c.status === 'live'),
      upcoming: catalogues.filter((c) => c.status === 'upcoming'),
      totals: {
        auctions: rows.length,
        totalLots,
        soldLots: sold,
        sellThrough: totalLots > 0 ? (sold / totalLots) * 100 : 0,
        bidsPerLot: sold > 0 ? totalBids / sold : 0,
        biddersPerAuction: rows.length > 0 ? rows.reduce((s, r) => s + r.bidders, 0) / rows.length : 0,
        extensions,
        extensionRate: sold > 0 ? (extensions / sold) * 100 : 0,
        voids: bidVoidRequests.filter((v) => v.status === 'approved' && inWindow(v.decidedAt ?? v.raisedAt)).length,
        flags: bidVoidRequests.filter((v) => inWindow(v.raisedAt)).length,
        cancellations: cancellationRequests.filter((r) => r.status === 'approved' && inWindow(r.decidedAt ?? r.requestedAt)).length,
        realisation: rows.reduce((s, r) => s + r.realisation, 0),
      },
    }
  }, [period, now, catalogues, lots, bids, bidVoidRequests, cancellationRequests, resultConfirmations])
}

/* =========================== is anything at risk? ========================= */

export interface AgeingRow {
  key: string
  party: string
  what: string
  amount: number
  since: string
  bucket: AgeBucket
  to: string
}

export interface Risk {
  now: number
  /** Customers' money in our account. A liability, never income. */
  emdHeld: number
  walletBalances: number
  /** Won and unpaid, plus commission sellers owe. */
  owedToUs: number
  owedByBuyers: AgeingRow[]
  owedBySellers: AgeingRow[]
  /** Debited from a wallet and not yet paid out, plus refunds due. */
  inTransit: number
  withdrawalsInFlight: number
  refundsDue: number
  /** Taken from customers this period, and proposed but not yet signed. */
  forfeitedThisPeriod: number
  forfeituresProposed: number
  /** Money a customer is actively contesting. */
  disputed: number
  openDisputes: Dispute[]
  /** Every ageing row, bucketed — the shape of the debt rather than its total. */
  buckets: { bucket: AgeBucket; buyers: number; sellers: number }[]
}

export function useRisk(period: PeriodKey = 'month'): Risk {
  const books = useBooks(period)
  const users = useStore((s) => s.users)
  const lots = useStore((s) => s.lots)
  const disputes = useStore((s) => s.disputes)
  const emdForfeitures = useStore((s) => s.emdForfeitures)
  const withdrawalRequests = useStore((s) => s.withdrawalRequests)
  const refundRequests = useStore((s) => s.refundRequests)

  return useMemo(() => {
    const firm = (id: string) => users.find((u) => u.id === id)?.firm ?? 'Unknown account'

    const owedByBuyers: AgeingRow[] = books.deliveryRows
      .filter((r) => r.outstanding > 0)
      .map((r) => ({
        key: r.d.id,
        party: firm(r.d.buyerId),
        what: `${r.lot?.lotNo ?? 'Lot'} · ${r.cat?.code ?? ''} — ${inr(doDue(r.d))} due, ${inr(r.d.paidAmount)} paid`,
        amount: r.outstanding,
        since: r.d.createdAt,
        bucket: ageBucket(r.d.createdAt, books.now),
        to: '/finance/payments',
      }))
      .sort((a, b) => b.amount - a.amount)

    const owedBySellers: AgeingRow[] = books.commissionRows
      .filter((r) => !r.confirmed && r.commissionDue > 0)
      .map((r) => ({
        key: r.cat.id,
        party: r.seller?.firm ?? 'Unknown seller',
        what: `${r.cat.code} — commission on ${num(r.billable.length)} accepted lot${r.billable.length === 1 ? '' : 's'}${r.awaitingConfirmation ? ', recorded and awaiting the bank' : r.queried ? ', reference queried' : ''}`,
        amount: r.commissionDue,
        since: r.closedAt,
        bucket: ageBucket(r.closedAt, books.now),
        to: '/finance/commission',
      }))
      .sort((a, b) => b.amount - a.amount)

    const openDisputes = disputes.filter((d) => d.status !== 'resolved')
    const disputedFromRefunds = refundRequests
      .filter((r) => r.source === 'dispute' && r.status !== 'processed' && r.status !== 'rejected')
      .reduce((sum, r) => sum + r.amount, 0)
    const disputedFromLots = openDisputes.reduce((sum, d) => {
      if (!d.lotId) return sum
      const row = books.deliveryRows.find((r) => r.d.lotId === d.lotId)
      return sum + (row ? doDue(row.d) : 0)
    }, 0)

    const buckets = AGE_BUCKETS.map((bucket) => ({
      bucket,
      buyers: owedByBuyers.filter((r) => r.bucket === bucket).reduce((s, r) => s + r.amount, 0),
      sellers: owedBySellers.filter((r) => r.bucket === bucket).reduce((s, r) => s + r.amount, 0),
    }))

    return {
      now: books.now,
      emdHeld: books.emdHeld,
      walletBalances: books.walletBalances,
      owedToUs: books.outstandingBuyerPayments + books.commissionOwed,
      owedByBuyers,
      owedBySellers,
      inTransit: books.inTransit + books.refundsDue,
      withdrawalsInFlight: books.inTransit,
      refundsDue: books.refundsDue,
      forfeitedThisPeriod: books.forfeitedThisPeriod,
      forfeituresProposed: emdForfeitures.filter((f) => f.status === 'awaiting_ceo').reduce((s, f) => s + f.amount, 0),
      disputed: disputedFromRefunds + disputedFromLots,
      openDisputes,
      buckets,
    }
    // `lots` and `withdrawalRequests` participate through `books`; listed so the
    // memo re-runs when either changes underneath it.
  }, [books, users, lots, disputes, emdForfeitures, withdrawalRequests, refundRequests])
}

/* ========================= what went wrong? ============================== */

export type IncidentSeverity = 'critical' | 'warning' | 'note'

export interface Incident {
  id: string
  at: string
  severity: IncidentSeverity
  /** Plain-language group, used as the filter and the heading. */
  kind: 'money' | 'auction' | 'customer' | 'quality'
  title: string
  body: string
  amount?: number
  to: string
}

/** Everything that did not go the way it should have, from every desk at once —
 *  which is the only place they ever appear side by side. Read from the real
 *  records rather than from a log, so each row can be opened where it happened. */
export function useIncidents(period: PeriodKey = 'month'): Incident[] {
  const now = useNow()
  const users = useStore((s) => s.users)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const bids = useStore((s) => s.bids)
  const disputes = useStore((s) => s.disputes)
  const depositClaims = useStore((s) => s.depositClaims)
  const withdrawalRequests = useStore((s) => s.withdrawalRequests)
  const emdForfeitures = useStore((s) => s.emdForfeitures)
  const bankStatementLines = useStore((s) => s.bankStatementLines)
  const bidVoidRequests = useStore((s) => s.bidVoidRequests)
  const cancellationRequests = useStore((s) => s.cancellationRequests)
  const commissionSettlements = useStore((s) => s.commissionSettlements)
  const financeConfig = useStore((s) => s.financeConfig)

  return useMemo(() => {
    const { from, to } = periodBounds(period, now)
    const firm = (id: string) => users.find((u) => u.id === id)?.firm ?? 'an account'
    const lot = (id: string) => lots.find((l) => l.id === id)
    const cat = (id: string) => catalogues.find((c) => c.id === id)
    const rows: Incident[] = []
    const inWindow = (iso?: string) => (period === 'all' ? !!iso : within(iso, from, to))

    /* ------------------------------- money ------------------------------- */
    for (const f of emdForfeitures) {
      if (f.status !== 'applied' || !inWindow(f.decidedAt ?? f.raisedAt)) continue
      rows.push({
        id: `forfeit-${f.id}`, at: f.decidedAt ?? f.raisedAt, severity: 'critical', kind: 'money',
        title: `${firm(f.buyerId)} lost their deposit on ${lot(f.lotId)?.lotNo ?? 'a lot'}`,
        body: `We kept ${inr(f.amount)} of their money because they did not pay for what they won. ${f.reason}`,
        amount: f.amount, to: '/finance/emd',
      })
    }
    for (const w of withdrawalRequests) {
      if (w.status !== 'failed' || !inWindow(w.decidedAt ?? w.requestedAt)) continue
      rows.push({
        id: `wd-${w.id}`, at: w.decidedAt ?? w.requestedAt, severity: 'warning', kind: 'money',
        title: `A payment to ${firm(w.userId)} bounced`,
        body: `${inr(w.amount)} did not reach them. ${w.reason ?? 'No reason recorded.'} The money went back to their wallet.`,
        amount: w.amount, to: '/finance/withdrawals',
      })
    }
    for (const c of depositClaims) {
      if (c.status !== 'rejected' || !inWindow(c.decidedAt ?? c.createdAt)) continue
      rows.push({
        id: `dep-${c.id}`, at: c.decidedAt ?? c.createdAt, severity: 'note', kind: 'money',
        title: `${firm(c.userId)} claimed a deposit we could not find`,
        body: `${inr(c.amount)} against ${c.utr}. ${c.rejectionReason ?? 'Not credited.'} They cannot bid until it is resolved.`,
        amount: c.amount, to: '/finance/deposits',
      })
    }
    for (const line of bankStatementLines) {
      if (line.status === 'matched' || !inWindow(line.at)) continue
      rows.push({
        id: `bank-${line.id}`, at: line.at, severity: line.escalated ? 'critical' : 'warning', kind: 'money',
        title: `${inr(line.amount)} on our bank statement matches nothing we recorded`,
        body: `${line.direction === 'credit' ? 'Money arrived' : 'Money left'} — ${line.narration}. ${line.breakNote ?? 'Either a record is missing or a record is wrong.'}`,
        amount: line.amount, to: '/finance/reconciliation',
      })
    }
    for (const s of commissionSettlements) {
      if (s.status !== 'queried' || !inWindow(s.at)) continue
      rows.push({
        id: `com-${s.id}`, at: s.at, severity: 'note', kind: 'money',
        title: `${firm(s.sellerId)} says they paid commission we cannot trace`,
        body: `${inr(s.amount)} on ${cat(s.catalogueId)?.code ?? 'an auction'}. ${s.queryNote ?? 'The reference does not appear on our statement.'}`,
        amount: s.amount, to: '/finance/commission',
      })
    }

    /* ------------------------------ auction ------------------------------ */
    for (const v of bidVoidRequests) {
      if (!inWindow(v.raisedAt)) continue
      const decided = v.status === 'approved'
      rows.push({
        id: `void-${v.id}`, at: v.decidedAt ?? v.raisedAt, severity: decided ? 'critical' : 'warning', kind: 'auction',
        title: decided
          ? `A bid was struck off ${lot(v.lotId)?.lotNo ?? 'a lot'}`
          : `A bid on ${lot(v.lotId)?.lotNo ?? 'a lot'} is under suspicion`,
        body: `${v.reason}. ${v.notes ?? ''} ${decided ? 'The bid no longer stands.' : 'Surveillance has it on record; a Super Admin decides whether it stands.'}`.trim(),
        to: '/auction/bid-monitor',
      })
    }
    for (const c of cancellationRequests) {
      if (!inWindow(c.requestedAt)) continue
      rows.push({
        id: `cancel-${c.id}`, at: c.decidedAt ?? c.requestedAt,
        severity: c.status === 'approved' ? 'critical' : 'warning', kind: 'auction',
        title: c.status === 'approved'
          ? `${cat(c.catalogueId)?.code ?? 'An auction'} was cancelled mid-sale`
          : `${cat(c.catalogueId)?.code ?? 'An auction'} has been proposed for cancellation`,
        body: `${c.reason}${c.status === 'approved' ? ' Every bid was voided and all held EMD released.' : ''}`,
        to: '/auction/live',
      })
    }

    /* ------------------------------ customer ----------------------------- */
    for (const d of disputes) {
      if (d.status === 'resolved') continue
      const days = Math.floor((now - Date.parse(d.createdAt)) / 86_400_000)
      if (days < 2) continue
      rows.push({
        id: `dsp-${d.id}`, at: d.createdAt, severity: days >= 7 ? 'critical' : 'warning', kind: 'customer',
        title: `${firm(d.userId)} has been waiting ${num(days)} days for an answer`,
        body: `${d.subject} — a ${d.category} complaint, still ${d.status === 'open' ? 'unanswered' : 'under review'}.`,
        to: '/disputes',
      })
    }
    for (const l of lots) {
      if (l.sellerDecision !== 'rejected' || !inWindow(cat(l.catalogueId)?.endsAt)) continue
      const cleared = clearedValue(l) ?? 0
      rows.push({
        id: `reject-${l.id}`, at: cat(l.catalogueId)?.endsAt ?? new Date(now).toISOString(),
        severity: 'warning', kind: 'customer',
        title: `A seller refused the price ${l.lotNo} sold at`,
        body: `${cat(l.catalogueId)?.code ?? 'An auction'} cleared at ${inr(cleared)} against a reserve of ${inr(reserveValue(l))}. We earn no commission on it and the material needs an operational decision.`,
        amount: Math.max(0, commissionFor(l, financeConfig) ?? 0),
        to: '/exec/settlement',
      })
    }

    /* ------------------------------ quality ------------------------------ */
    for (const l of lots) {
      if (!l.inspectionWaived || !l.waivedAt || !inWindow(l.waivedAt)) continue
      rows.push({
        id: `bypass-${l.id}`, at: l.waivedAt, severity: 'note', kind: 'quality',
        title: `${l.lotNo} went to market without a yard visit`,
        body: `Inspection was bypassed for a trusted seller. ${l.waivedReason ?? 'No reason recorded.'} Every bypass is one lot we described on the seller's word alone.`,
        to: '/exec/approvals',
      })
    }

    return rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  }, [
    period, now, users, lots, catalogues, bids, disputes, depositClaims, withdrawalRequests,
    emdForfeitures, bankStatementLines, bidVoidRequests, cancellationRequests, commissionSettlements, financeConfig,
  ])
}

/* ========================== what needs my signature? ====================== */

export interface SignatureQueue {
  now: number
  open: CeoApprovalRequest[]
  pending: CeoApprovalRequest[]
  queried: CeoApprovalRequest[]
  decided: CeoApprovalRequest[]
  /** Whoever is holding the queue right now, if it is not the CEO. */
  delegate: User | null
  delegatedUntil: string | null
  /** True when *this* account may sign — the CEO, a live delegate, or support. */
  canSign: boolean
  /** True when this account is signing on someone else's behalf. */
  signingAsDelegate: boolean
}

export function useSignatureQueue(): SignatureQueue {
  const now = useNow()
  const approvals = useStore((s) => s.ceoApprovals)
  const delegation = useStore((s) => s.ceoDelegation)
  const users = useStore((s) => s.users)
  const role = useStore((s) => s.role)
  const me = useStore((s) => s.currentUser)

  return useMemo(() => {
    const pending = approvals.filter((a) => a.status === 'pending')
    const queried = approvals.filter((a) => a.status === 'info_requested')
    const live = delegationActive(delegation, now)
    return {
      now,
      open: [...pending, ...queried].sort((a, b) => Date.parse(a.requestedAt) - Date.parse(b.requestedAt)),
      pending,
      queried,
      decided: approvals
        .filter((a) => a.status === 'approved' || a.status === 'refused')
        .sort((a, b) => Date.parse(b.decidedAt ?? b.requestedAt) - Date.parse(a.decidedAt ?? a.requestedAt)),
      delegate: live ? users.find((u) => u.id === delegation?.toUserId) ?? null : null,
      delegatedUntil: live ? delegation?.until ?? null : null,
      canSign: canSignForCeo(role, me?.id, delegation, now),
      signingAsDelegate: role !== 'ceo' && live && delegation?.toUserId === me?.id,
    }
  }, [approvals, delegation, users, role, me, now])
}

export const KIND_LABEL: Record<CeoApprovalRequest['kind'], string> = {
  emd_forfeiture: 'Keeping a customer\'s deposit',
  refund: 'Giving money back',
  fee_change: 'Changing what we charge',
  auction_publish: 'A large sale going to market',
  permanent_ban: 'Closing an account for good',
  super_admin_account: 'A new administrator',
  content_publish: 'Words going on the public site',
}

/** What happens to the person waiting if this is refused. Stated on the card,
 *  because a refusal is never a dead end and the CEO should see where it lands
 *  before pressing it. */
export const KIND_IF_REFUSED: Record<CeoApprovalRequest['kind'], string> = {
  emd_forfeiture: 'The deposit goes back to the buyer and the debt stays with Finance to chase.',
  refund: 'The money stays with us and the customer\'s dispute stays open.',
  fee_change: 'Rates are unchanged. Every published auction keeps the rate it was listed under either way.',
  auction_publish: 'The catalogue stays private. Nothing about the lots or the reserves changes.',
  permanent_ban: 'The account stays open on the watchlist and can bid again.',
  super_admin_account: 'The account is not created and platform access is unchanged.',
  content_publish: 'The page stays as it is and the copy goes back to whoever wrote it.',
}

/* ================================ pieces ================================== */

/** The one number a screen is about. Bigger and plainer than a Finance stat:
 *  this workspace answers a question rather than presenting a metric. */
export function Headline({ label, value, sub, tone = 'plain', trend, prev, className }: {
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  tone?: 'plain' | 'profit' | 'held' | 'risk'
  /** % against the previous period; null prints "no comparable period". */
  trend?: number | null
  /** The previous figure itself, shown where a percentage would mislead. */
  prev?: ReactNode
  className?: string
}) {
  const toneCls = {
    plain: 'text-ink',
    profit: 'text-success',
    held: 'text-steel',
    risk: 'text-warning',
  }[tone]
  return (
    <div className={cx('card p-5 sm:p-6', className)}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{label}</div>
      <div className={cx('num font-bold tabular-nums mt-1.5 text-3xl sm:text-4xl', toneCls)}>{value}</div>
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <Trend value={trend} />
        {prev && <span className="text-[13px] text-ink-muted">{prev}</span>}
      </div>
      {sub && <p className="text-[13px] text-ink-muted mt-2 max-w-prose">{sub}</p>}
    </div>
  )
}

/** Percentage change, or an honest blank where a percentage would lie. */
export function Trend({ value, className }: { value?: number | null; className?: string }) {
  if (value === undefined) return null
  if (value === null || !Number.isFinite(value)) {
    return (
      <span className={cx('inline-flex items-center gap-1 text-[12px] text-ink-faint', className)}>
        <Minus size={12} /> no comparable period
      </span>
    )
  }
  return (
    <span className={cx('num inline-flex items-center gap-0.5 text-[12px] font-bold rounded-md px-1.5 py-0.5',
      value >= 0 ? 'text-success bg-success-soft' : 'text-danger bg-danger-soft', className)}>
      {value >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

/** A smaller reading — one figure, what it means underneath. */
export function PlainStat({ label, value, sub, trend, tone, to }: {
  label: ReactNode; value: ReactNode; sub?: ReactNode; trend?: number | null
  tone?: 'plain' | 'profit' | 'held' | 'risk'; to?: string
}) {
  const toneCls = { plain: 'text-ink', profit: 'text-success', held: 'text-steel', risk: 'text-warning' }[tone ?? 'plain']
  const inner = (
    <>
      <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{label}</div>
      <div className={cx('num text-2xl font-bold tabular-nums mt-1', toneCls)}>{value}</div>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        <Trend value={trend} />
        {sub && <span className="text-[12px] text-ink-muted">{sub}</span>}
      </div>
    </>
  )
  return to ? <Link to={to} className="card card-hover p-4 block">{inner}</Link> : <div className="card p-4">{inner}</div>
}

/** The question a section answers, in the CEO's own words, with the answer
 *  stated underneath it rather than left to be worked out from the figures. */
export function Question({ q, a, action, className }: { q: ReactNode; a?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-wrap items-end justify-between gap-3 mb-3 mt-10 first:mt-0', className)}>
      <div className="min-w-0">
        <h2 className="font-display text-lg font-bold">{q}</h2>
        {a && <p className="text-[13px] text-ink-muted mt-1 max-w-3xl">{a}</p>}
      </div>
      {action}
    </div>
  )
}

/** Twelve bars and nothing else — the shape is the message. */
export function TrendBars({ points, title, sub, highlightLast = true }: {
  points: { label: string; value: number }[]; title: ReactNode; sub?: ReactNode; highlightLast?: boolean
}) {
  const max = Math.max(1, ...points.map((p) => p.value))
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{title}</div>
          {sub && <div className="text-[12px] text-ink-muted mt-0.5">{sub}</div>}
        </div>
        <Chip tone="steel">12 months</Chip>
      </div>
      <div className="flex items-end gap-1.5 h-32">
        {points.map((p, i) => (
          // `h-full` is load-bearing: `items-end` on the row switches off the
          // default stretch, so without it each column is only as tall as its
          // label, the bar track resolves to zero, and every bar's percentage
          // height is a percentage of nothing.
          <div key={`${p.label}-${i}`} className="flex-1 h-full flex flex-col items-center gap-1.5 min-w-0 group">
            <div className="relative w-full flex-1 flex items-end">
              <div
                className={cx('w-full rounded-t transition-colors',
                  highlightLast && i === points.length - 1 ? 'bg-ember' : 'bg-steel/45 group-hover:bg-steel/70')}
                style={{ height: `${Math.max(2, (p.value / max) * 100)}%` }}
                title={`${p.label} — ${inr(p.value)}`}
              />
            </div>
            <span className="text-[9px] font-semibold uppercase tracking-wide text-ink-faint truncate w-full text-center">{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** A ranked list with a share bar per row — used for every "where did it come
 *  from" question on this desk. */
export function Ranked({ title, rows, empty, money = true }: {
  title: ReactNode
  rows: { key: string; label: string; sub?: string; amount: number }[]
  empty: string
  money?: boolean
}) {
  const total = rows.reduce((s, r) => s + r.amount, 0)
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-line bg-surface-2/60">
        <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{title}</div>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-ink-muted text-center">{empty}</p>
      ) : (
        <div className="divide-y divide-line">
          {rows.slice(0, 6).map((r) => (
            <div key={r.key} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-semibold truncate capitalize">{r.label}</span>
                <span className="num text-[13px] font-bold tabular-nums shrink-0">{money ? inrCompact(r.amount) : num(r.amount)}</span>
              </div>
              {r.sub && <div className="text-[11px] text-ink-faint mt-0.5 truncate">{r.sub}</div>}
              <div className="h-1 rounded-full bg-surface-2 mt-2 overflow-hidden">
                <div className="h-full rounded-full bg-ember/60" style={{ width: `${total > 0 ? (r.amount / total) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Says whose decision something is, next to where its button would be. The
 *  CEO approves and never originates; that separation is a feature, so it is
 *  shown rather than left as an absence. */
export function NotMyDecision({ children }: { children: ReactNode }) {
  return (
    <div className="card bg-surface-2/60 border-dashed px-4 py-3 text-[13px] text-ink-muted">
      <p className="max-w-4xl">{children}</p>
    </div>
  )
}

/* ------------------------------- exporting --------------------------------- */

/** Every report on this desk is the same figures the screens show, written to a
 *  file. Nothing is recomputed for the export. */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = rows.map((r) => r.map(escape).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Bids are only read through `useIncidents`; re-exported so a page that wants
 *  the raw feed does not reach past this module into the store. */
export type { Bid, Catalogue, Lot, User }
export { doOutstanding, delta }
