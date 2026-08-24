/* ---------------------------------------------------------------------------
   Finance Administrator — profit & loss.

   Nobody in the build can currently tell whether the business is making money.
   The inputs all exist; nothing added them up. This does, and it is the same
   arithmetic the CEO's version will read — one set of numbers, shown twice. The
   difference is depth, not substance: Finance can open every figure down to the
   auction behind it; the CEO's version stops at the summary.

   One rule the page is built around: **income is only recognised when the money
   has actually been seen.** A commission the seller says they have paid is owed,
   not earned, until Finance matches it against the bank — so it sits in its own
   column rather than being quietly counted as profit.
--------------------------------------------------------------------------- */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Download, Info, TrendingUp } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, EmptyState, PageHeader, Segmented, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, inrCompact, num } from '../../lib/format'
import { PERIOD_LABEL, delta, type PeriodKey } from '../../lib/money'
import { LedgerRow, MoneyStat, ShareBar, ScopeNote, commissionBreakdown, useBooks } from '../shared/finance'

/* --------------------------- twelve-month trend ---------------------------- */
/** Confirmed commission by calendar month. Deliberately a plain SVG rather than
 *  a chart library: the shape is the message, and a stack of axes and legends
 *  would bury it. */
function TrendStrip({ points }: { points: { label: string; value: number }[] }) {
  const max = Math.max(1, ...points.map((p) => p.value))
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Income recognised, by month</div>
          <div className="text-[12px] text-ink-muted mt-0.5">Commission confirmed against the bank, plus buyer premium</div>
        </div>
        <Chip tone="steel"><TrendingUp size={12} /> 12 months</Chip>
      </div>
      <div className="flex items-end gap-1.5 h-32">
        {points.map((p, i) => (
          <div key={p.label} className="flex-1 flex flex-col items-center gap-1.5 min-w-0 group">
            <div className="relative w-full flex-1 flex items-end">
              <div
                className={cx('w-full rounded-t transition-colors', i === points.length - 1 ? 'bg-ember' : 'bg-steel/45 group-hover:bg-steel/70')}
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

/** A ranked breakdown — by metal, region, seller or auction. Every row carries
 *  its share so the top of the list is legible without reading the numbers. */
function Breakdown({ title, rows, empty }: {
  title: string
  rows: { key: string; label: string; sub?: string; amount: number; to?: string }[]
  empty: string
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
          {rows.slice(0, 6).map((r) => {
            const pct = total > 0 ? (r.amount / total) * 100 : 0
            const body = (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-semibold truncate">{r.label}</span>
                  <span className="num text-[13px] font-bold tabular-nums shrink-0">{inrCompact(r.amount)}</span>
                </div>
                {r.sub && <div className="text-[11px] text-ink-faint mt-0.5 truncate">{r.sub}</div>}
                <div className="h-1 rounded-full bg-surface-2 mt-2 overflow-hidden">
                  <div className="h-full rounded-full bg-ember/60" style={{ width: `${pct}%` }} />
                </div>
              </>
            )
            return r.to
              ? <Link key={r.key} to={r.to} className="block px-4 py-3 hover:bg-surface-2 transition-colors">{body}</Link>
              : <div key={r.key} className="px-4 py-3">{body}</div>
          })}
        </div>
      )}
    </div>
  )
}

export default function ProfitLoss() {
  const [period, setPeriod] = useState<PeriodKey>('month')
  const books = useBooks(period)
  const users = useStore((s) => s.users)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const commissionSettlements = useStore((s) => s.commissionSettlements)
  const cfg = books.cfg

  const netTrend = delta(books.netProfit, books.prevNetProfit)
  const incomeTrend = delta(books.income, books.prevIncome)

  /* Confirmed commission by month, oldest first — the twelve-month shape. */
  const trend = useMemo(() => {
    const now = new Date(books.now)
    const buckets = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-IN', { month: 'short' }), value: 0 }
    })
    const index = new Map(buckets.map((b, i) => [b.key, i]))
    for (const r of books.commissionRows) {
      if (!r.confirmed || !r.settlement?.confirmedAt) continue
      const d = new Date(r.settlement.confirmedAt)
      const i = index.get(`${d.getFullYear()}-${d.getMonth()}`)
      if (i != null) buckets[i].value += r.commissionDue
    }
    for (const row of books.deliveryRows) {
      if (row.d.paidAmount <= 0) continue
      const d = new Date(row.d.createdAt)
      const i = index.get(`${d.getFullYear()}-${d.getMonth()}`)
      if (i != null) buckets[i].value += row.d.materialValue * (cfg.buyerPremiumPct / 100)
    }
    return buckets
  }, [books, cfg.buyerPremiumPct])

  /* Commission by metal category, region, seller and auction — every figure
     traceable to the accepted lots it came from, and derived in `shared.tsx` so
     the CEO's read of the same question cannot drift from this one. */
  const { byCategory, byRegion, bySeller, byAuction } = useMemo(() => commissionBreakdown(books, users), [books, users])

  const exportPack = () => {
    const rows = [
      ['ferroBid — profit & loss', PERIOD_LABEL[period]],
      [],
      ['Income'],
      ['Seller commission (confirmed)', books.commissionEarned],
      ['Buyer premium', books.buyerPremium],
      ['Listing fees', books.listingFees],
      ['Total income', books.income],
      [],
      ['Costs'],
      ...books.costLines.map((c) => [c.label, c.amount]),
      ['Total costs', books.costs],
      [],
      ['Net profit', books.netProfit],
      ['Commission owed, not yet received', books.commissionOwed],
    ]
    const csv = rows.map((r) => r.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `ferrobid-pnl-${period}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const settledCount = commissionSettlements.filter((s) => s.status === 'confirmed').length
  const nothingYet = books.income === 0 && books.commissionOwed === 0

  return (
    <Page>
      <PageHeader
        title="Profit &amp; loss"
        sub="Computed from real auctions and real payments. Nothing on this page can be edited — every figure opens the records behind it."
        actions={
          <>
            <Segmented
              options={(['month', 'quarter', 'year', 'all'] as PeriodKey[]).map((k) => ({ key: k, label: PERIOD_LABEL[k] }))}
              value={period} onChange={setPeriod}
            />
            <Button variant="secondary" size="sm" onClick={exportPack}><Download size={14} /> Export</Button>
          </>
        }
      />

      {nothingYet ? (
        <EmptyState
          icon={<TrendingUp size={32} strokeWidth={1.5} />}
          title="No income has been recognised in this period"
          body="Commission is recognised the moment Finance confirms a seller's settlement against the bank. Confirm one, or widen the period, and it will appear here."
          action={<Link to="/finance/commission" className="text-sm font-bold text-ember hover:underline inline-flex items-center gap-1">Commission settlements <ArrowRight size={13} /></Link>}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MoneyStat
              label={`Net profit · ${PERIOD_LABEL[period].toLowerCase()}`}
              amount={books.netProfit} tone="profit" exact
              trend={period === 'all' ? undefined : netTrend}
              sub={period === 'all' ? 'income less costs' : `previous period ${inr(books.prevNetProfit)}`}
            />
            <MoneyStat label="Income" amount={books.income} tone="in" trend={period === 'all' ? undefined : incomeTrend} exact sub="recognised, in the bank" />
            <MoneyStat label="Costs" amount={books.costs} tone="out" exact sub="cost of running the sales" />
            <MoneyStat label="Commission owed" amount={books.commissionOwed} tone="risk" exact sub="earned but not yet received" to="/finance/commission" />
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mt-6">
            {/* ------------------------- the statement ------------------------- */}
            <div className="lg:col-span-2 space-y-4">
              <div className="card p-5">
                <div className="flex items-baseline justify-between gap-3 pb-3 border-b border-line">
                  <h2 className="font-display font-bold">Income</h2>
                  <span className="num text-sm font-bold">{inr(books.income)}</span>
                </div>
                <div className="divide-y divide-line">
                  <LedgerRow
                    label="Seller commission"
                    hint={`${cfg.sellerCommissionPct}% of the seller's upside over their own reserve, on lots they accepted · ${num(settledCount)} settlement${settledCount === 1 ? '' : 's'} confirmed`}
                    amount={books.commissionEarned}
                  />
                  <LedgerRow
                    label="Buyer premium"
                    hint={`${cfg.buyerPremiumPct}% of material value on every paid delivery order`}
                    amount={books.buyerPremium}
                  />
                  <LedgerRow
                    label="Listing fees"
                    hint={cfg.listingFeePerLot > 0 ? `${inr(cfg.listingFeePerLot)} per lot listed` : 'Not currently charged'}
                    amount={books.listingFees}
                    tone={cfg.listingFeePerLot > 0 ? undefined : 'muted'}
                  />
                </div>
                <div className="pt-3 mt-1 border-t border-line">
                  <ShareBar parts={[
                    { label: 'Commission', amount: books.commissionEarned, className: 'bg-ember' },
                    { label: 'Buyer premium', amount: books.buyerPremium, className: 'bg-steel' },
                    { label: 'Listing fees', amount: books.listingFees, className: 'bg-success' },
                  ]} />
                </div>
              </div>

              <div className="card p-5">
                <div className="flex items-baseline justify-between gap-3 pb-3 border-b border-line">
                  <h2 className="font-display font-bold">Costs</h2>
                  <span className="num text-sm font-bold">{inr(books.costs)}</span>
                </div>
                <div className="divide-y divide-line">
                  {books.costLines.map((c) => (
                    <LedgerRow key={c.label} label={c.label} amount={c.amount} negative />
                  ))}
                </div>
              </div>

              <div className="card p-5 bg-surface-2/50">
                <LedgerRow label="Net profit" amount={books.netProfit} tone="profit" bold
                  hint={period === 'all' ? undefined : `Previous period ${inr(books.prevNetProfit)}`} />
              </div>

              <TrendStrip points={trend} />
            </div>

            {/* --------------------------- breakdowns -------------------------- */}
            <div className="space-y-4">
              <Breakdown title="By auction" rows={byAuction} empty="No auction has produced a commission yet." />
              <Breakdown title="By metal category" rows={byCategory} empty="No accepted lots in this period." />
              <Breakdown title="By region" rows={byRegion} empty="No closed auctions in this period." />
              <Breakdown title="By seller" rows={bySeller} empty="No seller has settled yet." />
            </div>
          </div>

          <div className="card border-l-4 border-l-steel p-4 mt-6 flex items-start gap-3">
            <Info size={16} className="text-steel shrink-0 mt-0.5" />
            <div className="text-[13px] text-ink-muted">
              <strong className="text-ink">Commission is recognised when the money arrives, not when the seller says it has.</strong>{' '}
              {inr(books.commissionOwed)} is currently earned but unconfirmed and sits outside net profit until it is matched
              against the bank on <Link to="/finance/commission" className="text-ember font-semibold hover:underline">Commission settlements</Link>.
              EMD is excluded entirely — {inr(books.emdHeld)} is held for customers and is never the company's money.
            </div>
          </div>
        </>
      )}

      <div className="mt-8">
        <ScopeNote>
          Rates come from Financial configuration, not from this page — commission is {cfg.sellerCommissionPct}%, buyer premium
          is {cfg.buyerPremiumPct}%, and both are set by the Super Admin with the CEO's approval. Changing a fee here is not
          possible by design: it would make the same auction worth two different amounts on two screens. There are{' '}
          {num(lots.filter((l) => l.status === 'sold' || l.status === 'sta').length)} cleared lots across{' '}
          {num(catalogues.filter((c) => c.status === 'closed').length)} closed auctions behind these figures.
        </ScopeNote>
      </div>
    </Page>
  )
}
