/* ---------------------------------------------------------------------------
   Finance Administrator workspace — shared derivations and primitives.

   This desk answers one question on twelve screens: where is the money, and is
   any of it in the wrong place. The books are therefore assembled in exactly one
   place — `useBooks()` below — so the net profit on the dashboard, the net
   profit on the P&L and the net profit the CEO eventually reads are the same
   number arrived at the same way.

   Two conventions run through the whole workspace:

   · Money the platform is *holding* is drawn in steel, never in a profit colour.
     EMD is a customer's money sitting in our account; it is a liability, and it
     must never look like income.
   · Anything that takes money away from a customer collects a typed reason
     before it commits, in `MoneyReasonModal` — one dialog, so no screen can
     quietly skip it.
--------------------------------------------------------------------------- */
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, Landmark, Lock, Minus } from 'lucide-react'
import { Button, Chip, Field, Input, Modal, Textarea, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { useNow } from '../../lib/useTick'
import { inr, inrCompact, num } from '../../lib/format'
import {
  billableLots, buyerPremiumFor, clearedValue, commissionFor, commissionTotal, delta, doDue, doOutstanding,
  periodBounds, reserveValue, undecidedLots, upsideValue, within, type PeriodKey,
} from '../../lib/money'
import type {
  BankStatementLine, Catalogue, CommissionSettlement, DeliveryOrder, FinanceConfig, Lot, User, Wallet,
} from '../../types'

export {
  billableLots, buyerPremiumFor, clearedValue, commissionFor, commissionTotal, delta, doDue, doOutstanding,
  periodBounds, reserveValue, undecidedLots, upsideValue, within,
}
export type { PeriodKey }

/* ============================== the books ================================= */

/** One auction's commercial position, from Finance's side of the glass. */
export interface CommissionRow {
  cat: Catalogue
  seller?: User
  lots: Lot[]
  /** Lots the seller accepted — the only ones a commission is charged on. */
  billable: Lot[]
  /** Cleared lots the seller has not yet decided on: commission not yet earned. */
  undecided: Lot[]
  /** Lots the seller rejected. No commission, and an operational exception. */
  rejected: Lot[]
  grossAccepted: number
  commissionDue: number
  settlement?: CommissionSettlement
  /** Recorded by the seller, not yet matched against the bank by Finance. */
  awaitingConfirmation: boolean
  confirmed: boolean
  queried: boolean
  /** Owed, decided, and nothing recorded against it — this is what gets chased. */
  outstanding: boolean
  /** When the auction closed — what the ageing on an outstanding commission runs from. */
  closedAt: string
}

export interface Books {
  cfg: FinanceConfig
  now: number
  /* --- income, for the selected period --- */
  commissionEarned: number
  commissionOwed: number
  buyerPremium: number
  listingFees: number
  income: number
  /* --- costs --- */
  costs: number
  costLines: { label: string; amount: number }[]
  netProfit: number
  prevNetProfit: number
  prevIncome: number
  /* --- position, always as-at-now rather than for a period --- */
  emdHeld: number
  walletBalances: number
  outstandingBuyerPayments: number
  refundsDue: number
  inTransit: number
  forfeitedThisPeriod: number
  /* --- flow, for the selected period --- */
  moneyIn: number
  moneyOut: number
  gstCollected: number
  tcsCollected: number
  /* --- rows --- */
  commissionRows: CommissionRow[]
  deliveryRows: { d: DeliveryOrder; buyer?: User; lot?: Lot; cat?: Catalogue; due: number; outstanding: number }[]
}

/** Assembles the books once per render of whichever Finance screen asks.
 *  Everything is computed from real auctions, real delivery orders and real
 *  wallet movements — nothing here is a stored figure someone typed in. */
export function useBooks(period: PeriodKey = 'month'): Books {
  const now = useNow()
  const cfg = useStore((s) => s.financeConfig)
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const users = useStore((s) => s.users)
  const wallets = useStore((s) => s.wallets)
  const deliveryOrders = useStore((s) => s.deliveryOrders)
  const commissionSettlements = useStore((s) => s.commissionSettlements)
  const refundRequests = useStore((s) => s.refundRequests)
  const withdrawalRequests = useStore((s) => s.withdrawalRequests)
  const depositClaims = useStore((s) => s.depositClaims)
  const emdForfeitures = useStore((s) => s.emdForfeitures)

  return useMemo(() => {
    const { from, to, prevFrom, prevTo } = periodBounds(period, now)
    const lotsByCat = new Map<string, Lot[]>()
    for (const l of lots) {
      const arr = lotsByCat.get(l.catalogueId)
      if (arr) arr.push(l)
      else lotsByCat.set(l.catalogueId, [l])
    }

    /* ---------------------------- commission ---------------------------- */
    const commissionRows: CommissionRow[] = catalogues
      .filter((c) => c.status === 'closed')
      .map((cat) => {
        const catLots = lotsByCat.get(cat.id) ?? []
        const cleared = catLots.filter((l) => l.status === 'sold' || l.status === 'sta')
        const billable = billableLots(catLots)
        const settlement = commissionSettlements.find((s) => s.catalogueId === cat.id)
        const commissionDue = billable.reduce((sum, l) => sum + (commissionFor(l, cfg) ?? 0), 0)
        const undecided = undecidedLots(catLots)
        const status = settlement?.status ?? (settlement ? 'recorded' : undefined)
        return {
          cat,
          seller: users.find((u) => u.id === cat.sellerId),
          lots: cleared,
          billable,
          undecided,
          rejected: cleared.filter((l) => l.sellerDecision === 'rejected'),
          grossAccepted: billable.reduce((sum, l) => sum + (clearedValue(l) ?? 0), 0),
          commissionDue,
          settlement,
          awaitingConfirmation: status === 'recorded',
          confirmed: status === 'confirmed',
          queried: status === 'queried',
          outstanding: commissionDue > 0 && !settlement && undecided.length === 0,
          closedAt: cat.endsAt,
        }
      })
      .filter((r) => r.lots.length > 0)
      .sort((a, b) => Date.parse(b.closedAt) - Date.parse(a.closedAt))

    /** Income is only recognised once Finance has *seen the money arrive* —
     *  a settlement the seller merely recorded is not yet earned. */
    const earnedIn = (f: number, t: number) => commissionRows
      .filter((r) => r.confirmed && within(r.settlement?.confirmedAt, f, t))
      .reduce((sum, r) => sum + r.commissionDue, 0)

    const commissionEarned = earnedIn(from, to)
    const prevCommission = period === 'all' ? 0 : earnedIn(prevFrom, prevTo)
    const commissionOwed = commissionRows
      .filter((r) => !r.confirmed)
      .reduce((sum, r) => sum + r.commissionDue, 0)

    /* -------------------------- buyer-side income ------------------------ */
    const deliveryRows = deliveryOrders.map((d) => ({
      d,
      buyer: users.find((u) => u.id === d.buyerId),
      lot: lots.find((l) => l.id === d.lotId),
      cat: catalogues.find((c) => c.id === d.catalogueId),
      due: doDue(d),
      outstanding: doOutstanding(d),
    }))

    const paidIn = (f: number, t: number) => deliveryOrders.filter((d) => d.paidAmount > 0 && within(d.createdAt, f, t))
    const premiumFor = (rows: DeliveryOrder[]) => rows.reduce((sum, d) => sum + buyerPremiumFor(d, cfg), 0)
    const buyerPremium = premiumFor(paidIn(from, to))
    const prevPremium = period === 'all' ? 0 : premiumFor(paidIn(prevFrom, prevTo))

    const lotsListedIn = (f: number, t: number) =>
      catalogues.filter((c) => c.status !== 'draft' && within(c.startsAt, f, t))
        .reduce((sum, c) => sum + (lotsByCat.get(c.id)?.length ?? 0), 0)
    const listingFees = lotsListedIn(from, to) * cfg.listingFeePerLot
    const prevListingFees = period === 'all' ? 0 : lotsListedIn(prevFrom, prevTo) * cfg.listingFeePerLot

    const income = commissionEarned + buyerPremium + listingFees
    const prevIncome = prevCommission + prevPremium + prevListingFees

    /* -------------------------------- costs ------------------------------ */
    // The prototype has no cost ledger. Rather than invent a lump sum, costs are
    // derived from the work the platform demonstrably does to run a sale — a
    // yard visit per inspected lot, infrastructure per auction, and two lines
    // that scale with income. The per-unit figures are placeholders and are the
    // first thing to replace when a real cost ledger exists; the *shape* is
    // right, which is what makes the P&L readable in the meantime.
    //
    // Computed for any window, so the previous period is arrived at the same way
    // as the current one rather than being estimated — a comparison against a
    // number that was never really calculated is worse than no comparison.
    const COST_PER_INSPECTION = 1_200
    const COST_PER_AUCTION = 2_500
    const GATEWAY_RATE = 0.018
    const SUPPORT_RATE = 0.09
    const costsFor = (f: number, t: number, periodIncome: number) => {
      const auctionsRun = catalogues.filter((c) => within(c.startsAt, f, t) && c.status !== 'draft').length
      const inspections = lots.filter((l) => l.inspectionReportId && within(l.endsAt, f, t)).length
      return [
        { label: 'Field inspection', amount: inspections * COST_PER_INSPECTION },
        { label: 'Payment gateway & bank charges', amount: Math.round(periodIncome * GATEWAY_RATE) },
        { label: 'Platform & infrastructure', amount: auctionsRun * COST_PER_AUCTION },
        { label: 'Sales & customer support', amount: Math.round(periodIncome * SUPPORT_RATE) },
      ]
    }
    const costLines = costsFor(from, to, income)
    const costs = costLines.reduce((sum, c) => sum + c.amount, 0)
    // No prior window means no comparison — `delta()` returns null against zero
    // and the tile says "no prior period" rather than inventing a percentage.
    const prevCosts = period === 'all' ? 0 : costsFor(prevFrom, prevTo, prevIncome).reduce((sum, c) => sum + c.amount, 0)

    /* ------------------------------- position ----------------------------- */
    const emdHeld = wallets.reduce((sum: number, w: Wallet) => sum + w.emdLocked, 0)
    const walletBalances = wallets.reduce((sum: number, w: Wallet) => sum + w.balance, 0)
    const outstandingBuyerPayments = deliveryRows.reduce((sum, r) => sum + r.outstanding, 0)
    const refundsDue = refundRequests
      .filter((r) => r.status === 'approved' || r.status === 'pending' || r.status === 'awaiting_ceo')
      .reduce((sum, r) => sum + r.amount, 0)
    const inTransit = withdrawalRequests
      .filter((r) => r.status === 'requested' || r.status === 'under_review')
      .reduce((sum, r) => sum + r.amount, 0)
    const forfeitedThisPeriod = emdForfeitures
      .filter((f) => f.status === 'applied' && within(f.decidedAt ?? f.raisedAt, from, to))
      .reduce((sum, f) => sum + f.amount, 0)

    /* --------------------------------- flow ------------------------------- */
    const moneyIn = depositClaims
      .filter((c) => c.status === 'approved' && within(c.decidedAt, from, to))
      .reduce((sum, c) => sum + c.amount, 0)
      + deliveryOrders.filter((d) => d.paidAmount > 0 && within(d.createdAt, from, to)).reduce((sum, d) => sum + d.paidAmount, 0)
    const moneyOut = withdrawalRequests
      .filter((r) => r.status === 'processed' && within(r.decidedAt, from, to))
      .reduce((sum, r) => sum + r.amount, 0)
      + refundRequests.filter((r) => r.status === 'processed' && within(r.processedAt, from, to)).reduce((sum, r) => sum + r.amount, 0)

    const taxed = paidIn(from, to)
    const gstCollected = taxed.reduce((sum, d) => sum + d.gstAmount, 0)
    const tcsCollected = taxed.reduce((sum, d) => sum + d.tcsAmount, 0)

    return {
      cfg, now,
      commissionEarned, commissionOwed, buyerPremium, listingFees, income,
      costs, costLines,
      netProfit: income - costs,
      // Zero when there is genuinely no prior period, so the trend pill hides
      // itself instead of reporting growth against a number nobody computed.
      prevNetProfit: prevIncome === 0 && prevCosts === 0 ? 0 : prevIncome - prevCosts,
      prevIncome,
      emdHeld, walletBalances, outstandingBuyerPayments, refundsDue, inTransit, forfeitedThisPeriod,
      moneyIn, moneyOut, gstCollected, tcsCollected,
      commissionRows, deliveryRows,
    }
  }, [period, now, cfg, catalogues, lots, users, wallets, deliveryOrders, commissionSettlements, refundRequests, withdrawalRequests, depositClaims, emdForfeitures])
}

/** Where the commission came from, four ways. Pure function of the books, so
 *  the Finance P&L and the CEO's read of it are the same arithmetic rather than
 *  two implementations that would eventually disagree. Wrap in `useMemo`. */
export function commissionBreakdown(books: Books, users: User[]) {
  const { cfg } = books
  const rank = <T extends { amount: number }>(rows: T[]) => rows.sort((a, b) => b.amount - a.amount)

  const categories = new Map<string, { amount: number; lots: number }>()
  for (const r of books.commissionRows) {
    for (const l of r.billable) {
      const c = categories.get(l.category) ?? { amount: 0, lots: 0 }
      const upside = Math.max(0, (clearedValue(l) ?? 0) - reserveValue(l))
      categories.set(l.category, { amount: c.amount + upside * (cfg.sellerCommissionPct / 100), lots: c.lots + 1 })
    }
  }

  const regions = new Map<string, { amount: number; auctions: number }>()
  const sellers = new Map<string, number>()
  for (const r of books.commissionRows) {
    if (r.commissionDue <= 0) continue
    const region = regions.get(r.cat.region) ?? { amount: 0, auctions: 0 }
    regions.set(r.cat.region, { amount: region.amount + r.commissionDue, auctions: region.auctions + 1 })
    sellers.set(r.cat.sellerId, (sellers.get(r.cat.sellerId) ?? 0) + r.commissionDue)
  }

  return {
    byCategory: rank([...categories.entries()].map(([key, v]) => ({
      key, label: key.replace(/-/g, ' '), sub: `${num(v.lots)} lot${v.lots === 1 ? '' : 's'} accepted`, amount: v.amount,
    }))),
    byRegion: rank([...regions.entries()].map(([key, v]) => ({
      key, label: key, sub: `${num(v.auctions)} auction${v.auctions === 1 ? '' : 's'}`, amount: v.amount,
    }))),
    bySeller: rank([...sellers.entries()].map(([id, amount]) => ({
      key: id, label: users.find((u) => u.id === id)?.firm ?? id, amount,
    }))),
    byAuction: rank(books.commissionRows.filter((r) => r.commissionDue > 0).map((r) => ({
      key: r.cat.id,
      label: r.cat.title,
      sub: `${r.cat.code} · ${r.confirmed ? 'confirmed' : r.awaitingConfirmation ? 'recorded, not yet confirmed' : 'outstanding'}`,
      amount: r.commissionDue,
      to: '/finance/commission',
    }))),
  }
}

/** Everything sitting on the Finance desk right now, as counts. The dashboard
 *  reads it for its work lists; every other screen reads it for its tab badge,
 *  so a number can never disagree with itself between two screens. */
export function useFinanceQueues() {
  const depositClaims = useStore((s) => s.depositClaims)
  const withdrawalRequests = useStore((s) => s.withdrawalRequests)
  const bankAccounts = useStore((s) => s.bankAccounts)
  const refundRequests = useStore((s) => s.refundRequests)
  const bankStatementLines = useStore((s) => s.bankStatementLines)
  const ceoApprovals = useStore((s) => s.ceoApprovals)
  const { commissionRows, deliveryRows } = useBooks('all')

  return useMemo(() => {
    const depositsToVerify = depositClaims.filter((c) => c.status === 'submitted')
    const withdrawalsToReview = withdrawalRequests.filter((r) => r.status === 'requested')
    const withdrawalsToProcess = withdrawalRequests.filter((r) => r.status === 'under_review')
    const accountsToVerify = bankAccounts.filter((a) => a.status === 'pending')
    const commissionsToConfirm = commissionRows.filter((r) => r.awaitingConfirmation)
    const commissionsOverdue = commissionRows.filter((r) => r.outstanding)
    const refundsToDecide = refundRequests.filter((r) => r.status === 'pending')
    const refundsToProcess = refundRequests.filter((r) => r.status === 'approved')
    const reconExceptions = bankStatementLines.filter((l) => l.status !== 'matched')
    const paymentsOverdue = deliveryRows.filter((r) => r.outstanding > 0)
    const awaitingSignature = ceoApprovals.filter((a) => a.status === 'pending')
    const total = depositsToVerify.length + withdrawalsToReview.length + withdrawalsToProcess.length
      + accountsToVerify.length + commissionsToConfirm.length + refundsToDecide.length
      + refundsToProcess.length + reconExceptions.length
    return {
      depositsToVerify, withdrawalsToReview, withdrawalsToProcess, accountsToVerify,
      commissionsToConfirm, commissionsOverdue, refundsToDecide, refundsToProcess,
      reconExceptions, paymentsOverdue, awaitingSignature, total,
    }
  }, [depositClaims, withdrawalRequests, bankAccounts, refundRequests, bankStatementLines, ceoApprovals, commissionRows, deliveryRows])
}

/* ============================== who is looking ============================= */

/** Every money action in the store refuses a caller who is not Finance or Super
 *  Admin. Other roles can still *open* these screens — the visibility matrix is
 *  not enforced on the router yet, and reading the books is exactly what the Sub
 *  Admin and the CEO are meant to do — so the workspace has to say plainly that
 *  it is in read-only mode rather than letting someone press a button that
 *  silently does nothing. */
export function useFinanceScope() {
  const role = useStore((s) => s.role)
  const me = useStore((s) => s.currentUser)
  return {
    role,
    me,
    /** True when this account may actually move money. */
    canExecute: role === 'finance_admin' || role === 'super_admin',
  }
}

/** Shown once at the top of the workspace when the viewer cannot execute. Sits
 *  in the layout rather than on each page, so no screen can forget it. */
export function ReadOnlyBanner() {
  const { canExecute, role } = useFinanceScope()
  if (canExecute) return null
  const who = role === 'sub_admin' ? 'A Sub Admin sees every rupee moving through the platform and can recommend'
    : role === 'exec_manager' || role === 'auction_manager' ? 'An operational role can read the money behind its own work'
      : 'This account can read the books'
  return (
    <div className="border-b border-line bg-warning-soft/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-start gap-2.5 text-[13px]">
        <Lock size={14} className="mt-0.5 shrink-0 text-warning" />
        <p className="text-ink-muted">
          <strong className="text-ink">Read-only.</strong> {who}, but only the Finance Administrator approves a deposit,
          releases a withdrawal, confirms a commission or forfeits an EMD. Buttons below will be refused.
        </p>
      </div>
    </div>
  )
}

/* ================================ pieces ================================== */

/** Section heading with the count beside it — used instead of another card
 *  wrapper where the content below is already carded, so a long money screen
 *  reads as chapters rather than a stack of boxes. */
export function SectionTitle({ title, count, sub, action }: {
  title: ReactNode; count?: number; sub?: ReactNode; action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-3 mt-9 first:mt-0">
      <div className="min-w-0">
        <h2 className="font-display text-lg font-bold flex items-center gap-2">
          {title}
          {count !== undefined && (
            <span className="num text-xs font-bold px-1.5 py-0.5 rounded-md bg-surface-2 text-ink-muted border border-line">{count}</span>
          )}
        </h2>
        {sub && <p className="text-[13px] text-ink-muted mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

/**
 * A money figure with its own weight class.
 *
 * `flow` colours the direction money moved — in is green, out is red, neither
 * is a judgement. `held` is deliberately steel and never green: EMD is a
 * customer's money sitting in our account, and the day it starts looking like
 * profit is the day someone spends it.
 */
export function MoneyStat({ label, amount, sub, tone = 'plain', trend, to, exact, className }: {
  label: ReactNode
  amount: number
  sub?: ReactNode
  tone?: 'plain' | 'profit' | 'held' | 'in' | 'out' | 'risk'
  /** % change against the previous period; null hides the pill. */
  trend?: number | null
  to?: string
  /** Show the full rupee figure rather than the compact one. */
  exact?: boolean
  className?: string
}) {
  const valueCls = {
    plain: 'text-ink',
    profit: amount >= 0 ? 'text-success' : 'text-danger',
    held: 'text-steel',
    in: 'text-success',
    out: 'text-danger',
    risk: 'text-warning',
  }[tone]
  const inner = (
    <>
      <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{label}</div>
      <div className={cx('num text-2xl font-bold mt-1 tabular-nums', valueCls)}>
        {exact ? inr(amount) : inrCompact(amount)}
      </div>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        {trend != null && Number.isFinite(trend) && (
          <span className={cx('num inline-flex items-center gap-0.5 text-[11px] font-bold rounded-md px-1 py-0.5',
            trend >= 0 ? 'text-success bg-success-soft' : 'text-danger bg-danger-soft')}>
            {trend >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
        {/* No percentage where a percentage would mislead — see `delta()`. The
            caller states the previous figure in `sub` instead. */}
        {trend === null && <span className="inline-flex items-center gap-0.5 text-[11px] text-ink-faint"><Minus size={11} /> no comparable prior period</span>}
        {sub && <span className="text-xs text-ink-muted">{sub}</span>}
      </div>
    </>
  )
  return to
    ? <Link to={to} className={cx('card card-hover p-4 block', className)}>{inner}</Link>
    : <div className={cx('card p-4', className)}>{inner}</div>
}

/** The strip that opens most Finance screens: how many are waiting at each step
 *  of this particular flow, and where each one is worked. */
export function QueueStrip({ steps }: { steps: { label: string; count: number; to?: string; urgent?: boolean; onClick?: () => void; active?: boolean }[] }) {
  return (
    <div className="card overflow-hidden mb-6">
      <div className={cx('grid divide-x divide-y sm:divide-y-0 divide-line',
        steps.length >= 5 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'grid-cols-2 lg:grid-cols-4')}>
        {steps.map((s) => {
          const body = (
            <>
              <div className="flex items-baseline gap-2">
                <span className={cx('num text-2xl font-bold tabular-nums',
                  s.count === 0 ? 'text-ink-faint' : s.urgent ? 'text-warning' : 'text-ink')}>
                  {num(s.count)}
                </span>
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint mt-1 leading-tight">{s.label}</div>
            </>
          )
          const cls = cx('group px-4 py-3.5 text-left transition-colors hover:bg-surface-2',
            s.urgent && s.count > 0 && 'bg-warning-soft/50 hover:bg-warning-soft',
            s.active && 'bg-ember-soft/50')
          if (s.onClick) return <button key={s.label} type="button" onClick={s.onClick} className={cls}>{body}</button>
          if (s.to) return <Link key={s.label} to={s.to} className={cls}>{body}</Link>
          return <div key={s.label} className={cx(cls, 'cursor-default hover:bg-transparent')}>{body}</div>
        })}
      </div>
    </div>
  )
}

/** States plainly what this desk is not allowed to do, next to the place a
 *  button for it would otherwise sit. The separation is a feature, so it is
 *  shown rather than left as an absence. */
export function ScopeNote({ children }: { children: ReactNode }) {
  return (
    <div className="card bg-surface-2/60 border-dashed px-4 py-3 flex items-start gap-2.5 text-[13px] text-ink-muted">
      <Lock size={14} className="mt-0.5 shrink-0 text-ink-faint" />
      <p className="max-w-4xl">{children}</p>
    </div>
  )
}

/** Above a configured rupee figure a decision leaves this desk. Shown wherever
 *  that could happen, *before* the button is pressed — so nobody is surprised
 *  by an action that did not complete. */
export function ThresholdNote({ amount, label }: { amount: number; label: string }) {
  return (
    <div className="flex items-start gap-2 text-[12px] text-ink-muted">
      <Landmark size={13} className="mt-0.5 shrink-0 text-ink-faint" />
      <span>{label} of <span className="num font-bold text-ink">{inr(amount)}</span> or more are signed by the CEO before they take effect. Below that, Finance completes them here.</span>
    </div>
  )
}

/** Ledger-style key/value row — right-aligned tabular numerals so a column of
 *  amounts can be read down rather than across. */
export function LedgerRow({ label, amount, tone, bold, hint, negative }: {
  label: ReactNode; amount: number; tone?: 'muted' | 'profit' | 'held'; bold?: boolean; hint?: ReactNode; negative?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <div className="min-w-0">
        <div className={cx('text-sm', bold ? 'font-bold' : 'font-medium text-ink')}>{label}</div>
        {hint && <div className="text-xs text-ink-faint mt-0.5">{hint}</div>}
      </div>
      <div className={cx('num tabular-nums shrink-0',
        bold ? 'text-lg font-bold' : 'text-sm font-semibold',
        tone === 'muted' ? 'text-ink-muted' : tone === 'held' ? 'text-steel' : tone === 'profit' ? (amount >= 0 ? 'text-success' : 'text-danger') : 'text-ink')}>
        {negative ? `− ${inr(Math.abs(amount))}` : inr(amount)}
      </div>
    </div>
  )
}

/** Share-of-total bar. Used on the P&L where the split between income lines
 *  matters more than any one of them. */
export function ShareBar({ parts }: { parts: { label: string; amount: number; className: string }[] }) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.amount), 0)
  if (total <= 0) return null
  return (
    <>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-surface-2 border border-line">
        {parts.filter((p) => p.amount > 0).map((p) => (
          <div key={p.label} className={p.className} style={{ width: `${(p.amount / total) * 100}%` }} title={`${p.label} — ${inr(p.amount)}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {parts.filter((p) => p.amount > 0).map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted">
            <span className={cx('size-2 rounded-full', p.className)} />
            {p.label}
            <span className="num font-semibold text-ink">{((p.amount / total) * 100).toFixed(0)}%</span>
          </span>
        ))}
      </div>
    </>
  )
}

/** How long something has been waiting, coloured by how much that matters.
 *  An overdue commission and a five-minute-old deposit claim are both "open";
 *  only one of them is a problem. */
export function Ageing({ since, now, warnDays = 7, dangerDays = 15 }: { since: string; now: number; warnDays?: number; dangerDays?: number }) {
  const days = Math.floor((now - Date.parse(since)) / 86_400_000)
  const tone = days >= dangerDays ? 'danger' : days >= warnDays ? 'warning' : 'neutral'
  return <Chip tone={tone} className="num">{days <= 0 ? 'today' : `${days}d`}</Chip>
}

/* ------------------------------ reason gate -------------------------------- */

/** Every action on this desk that moves, holds back or returns customer money
 *  collects a typed reason first, and lands in the audit trail under the name of
 *  whoever pressed it. One dialog enforces that for all of them.
 *
 *  `amountLabel` turns it into a money form — the refund screen needs the
 *  operator to state a figure as well as a reason. */
export function MoneyReasonModal({
  open, onClose, title, intent = 'warning', confirmLabel, summary, hint, placeholder, presets,
  amountLabel, amountDefault, amountMax, onConfirm,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  intent?: 'warning' | 'danger' | 'primary' | 'success'
  confirmLabel: string
  summary: ReactNode
  hint?: ReactNode
  placeholder?: string
  presets?: string[]
  amountLabel?: string
  amountDefault?: number
  amountMax?: number
  onConfirm: (reason: string, amount: number) => void
}) {
  const [reason, setReason] = useState('')
  const [amount, setAmount] = useState<string>('')
  const value = Number((amount || String(amountDefault ?? 0)).replace(/[^\d]/g, ''))
  const amountOk = !amountLabel || (value > 0 && (amountMax == null || value <= amountMax))
  const close = () => { setReason(''); setAmount(''); onClose() }
  return (
    <Modal open={open} onClose={close} title={title}>
      <div className="space-y-4">
        <div className={cx('card border-0 p-4 text-sm',
          intent === 'danger' ? 'bg-danger-soft text-ink'
            : intent === 'warning' ? 'bg-warning-soft text-ink'
              : intent === 'success' ? 'bg-success-soft text-ink' : 'bg-surface-2')}>
          {summary}
        </div>
        {amountLabel && (
          <Field label={amountLabel} hint={amountMax != null ? `Cannot exceed ${inr(amountMax)}.` : undefined}>
            <Input
              className="num text-right"
              inputMode="numeric"
              value={amount === '' ? (amountDefault != null ? amountDefault.toLocaleString('en-IN') : '') : value.toLocaleString('en-IN')}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
            />
          </Field>
        )}
        {presets && presets.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button key={p} type="button" onClick={() => setReason(p)}
                className={cx('h-7 px-2.5 rounded-lg border text-xs font-semibold transition-colors',
                  reason === p ? 'border-ember bg-ember-soft text-ember-strong' : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink')}>
                {p}
              </button>
            ))}
          </div>
        )}
        <Field label="Reason" hint={hint ?? 'Recorded in the audit trail against your name, and shown to whoever it affects.'}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button
            variant={intent === 'danger' ? 'danger' : intent === 'success' ? 'success' : intent === 'warning' ? 'steel' : 'primary'}
            disabled={reason.trim().length < 4 || !amountOk}
            onClick={() => { onConfirm(reason.trim(), value); close() }}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------------------------- statement matching ---------------------------- */

/** Candidate credits on the company statement for an amount — used by Deposits
 *  and Commission settlements, both of which must be matched to a real bank
 *  credit before they can be confirmed. */
export function useStatementCandidates(direction: BankStatementLine['direction'], amount: number, ref?: string) {
  const lines = useStore((s) => s.bankStatementLines)
  return useMemo(() => {
    const open = lines.filter((l) => l.direction === direction && l.status !== 'matched')
    const exactRef = ref ? open.filter((l) => l.ref === ref) : []
    const nearAmount = open.filter((l) => Math.abs(l.amount - amount) <= Math.max(1000, amount * 0.02))
    const rest = open.filter((l) => !exactRef.includes(l) && !nearAmount.includes(l))
    return { exactRef, nearAmount: nearAmount.filter((l) => !exactRef.includes(l)), rest }
  }, [lines, direction, amount, ref])
}
