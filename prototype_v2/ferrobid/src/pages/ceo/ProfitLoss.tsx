/* ---------------------------------------------------------------------------
   CEO / MD — profit & loss. The landing page, and the first of four questions:
   **are we making money?**

   One headline number, twice: this month and this financial year, each with the
   period before it beside it. Then what we earned, what we spent, and where the
   earnings came from. The arithmetic is Finance's — the same `useBooks()` — so
   the CEO and the Finance Administrator can never be looking at two different
   net profits. What changes is the wording and the depth: this page stops at the
   summary and says what each figure means; Finance can open every one of them
   down to the individual payment.

   Two things are deliberately kept out of the profit figures. EMD is a
   customer's deposit, not our money, and appears only under Money at risk.
   Commission a seller says they have paid is owed, not earned, until Finance
   sees it on the bank statement — it is stated separately rather than counted.
--------------------------------------------------------------------------- */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Info, ShieldAlert, Signature, TrendingUp } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Chip, EmptyState, PageHeader } from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, inrCompact, num } from '../../lib/format'
import { delta } from '../../lib/money'
import { LedgerRow, ShareBar, commissionBreakdown } from '../finance/shared'
import { Headline, NotMyDecision, PlainStat, Question, Ranked, TrendBars, incomeByMonth, useBooks, useGrowth, useSignatureQueue } from './shared'

export default function CeoProfitLoss() {
  const month = useBooks('month')
  const year = useBooks('year')
  const growth = useGrowth('month')
  const queue = useSignatureQueue()
  const users = useStore((s) => s.users)
  const cfg = month.cfg

  const { byCategory, byRegion } = useMemo(() => commissionBreakdown(month, users), [month, users])

  /* Income recognised by calendar month — the same twelve points the dashboard
     draws, arrived at by the same pass over the books. */
  const trend = useMemo(() => incomeByMonth(month), [month])

  const nothingYet = year.income === 0 && year.commissionOwed === 0

  return (
    <Page>
      <PageHeader
        title="Profit &amp; loss"
        sub="Every figure here is worked out from real auctions and real payments — nothing on this page was typed in by anyone, and nothing on it can be edited."
        actions={
          queue.open.length > 0
            ? (
              <Link to="/ceo/approvals">
                <Chip tone="warning"><Signature size={12} /> {num(queue.open.length)} waiting for your signature</Chip>
              </Link>
            )
            : <Chip tone="success">Nothing waiting for your signature</Chip>
        }
      />

      {nothingYet ? (
        <EmptyState
          icon={<TrendingUp size={32} strokeWidth={1.5} />}
          title="We have not earned anything yet this financial year"
          body="We earn commission when a seller accepts the price their material sold at and the money reaches our bank. Nothing has completed that journey yet."
          action={<Link to="/ceo/growth" className="text-sm font-bold text-ember hover:underline inline-flex items-center gap-1">See what is in the pipeline <ArrowRight size={13} /></Link>}
        />
      ) : (
        <>
          {/* ---------------------- the headline number ---------------------- */}
          <div className="grid md:grid-cols-2 gap-3">
            <Headline
              label="Profit this month"
              value={inr(month.netProfit)}
              tone={month.netProfit >= 0 ? 'profit' : 'plain'}
              trend={delta(month.netProfit, month.prevNetProfit)}
              prev={<>last month {inr(month.prevNetProfit)}</>}
              sub="What we earned in fees this month, less what it cost us to run the sales behind them."
            />
            <Headline
              label="Profit this financial year"
              value={inr(year.netProfit)}
              tone={year.netProfit >= 0 ? 'profit' : 'plain'}
              trend={delta(year.netProfit, year.prevNetProfit)}
              prev={<>same point last year {inr(year.prevNetProfit)}</>}
              sub="1 April to today. The year-on-year figure is the same window in the previous financial year, not the whole of it."
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            <PlainStat label="Money we earned · this month" value={inrCompact(month.income)} tone="profit"
              trend={delta(month.income, month.prevIncome)} sub="commission, premium and fees" />
            <PlainStat label="Money we spent · this month" value={inrCompact(month.costs)}
              sub="cost of running the sales" />
            <PlainStat label="Earned but not yet received" value={inrCompact(month.commissionOwed)} tone="risk"
              sub="commission sellers still owe us" to="/ceo/risk" />
            <PlainStat label="Held for customers" value={inrCompact(month.emdHeld)} tone="held"
              sub="deposits — never our money" to="/ceo/risk" />
          </div>

          {/* ------------------------ earned and spent ----------------------- */}
          <Question
            q="Where did the money come from, and where did it go?"
            a={`Buyers pay sellers directly for the material. We only ever charge commission on the seller's upside, a premium on the buyer's side and any listing fee — so our income is a fraction of what trades through the platform, and it is meant to be.`}
          />

          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <div className="card p-5">
                <div className="flex items-baseline justify-between gap-3 pb-3 border-b border-line">
                  <h3 className="font-display font-bold">Money we earned this month</h3>
                  <span className="num text-sm font-bold">{inr(month.income)}</span>
                </div>
                <div className="divide-y divide-line">
                  <LedgerRow
                    label="Commission from sellers"
                    hint={`${cfg.sellerCommissionPct}% of what a lot beat the seller's own reserve by, on the lots they accepted`}
                    amount={month.commissionEarned}
                  />
                  <LedgerRow
                    label="Premium from buyers"
                    hint={`${cfg.buyerPremiumPct}% of the material value on every delivery order that has been paid`}
                    amount={month.buyerPremium}
                  />
                  <LedgerRow
                    label="Listing fees"
                    hint={cfg.listingFeePerLot > 0 ? `${inr(cfg.listingFeePerLot)} for every lot we list` : 'We do not charge one at the moment'}
                    amount={month.listingFees}
                    tone={cfg.listingFeePerLot > 0 ? undefined : 'muted'}
                  />
                </div>
                <div className="pt-3 mt-1 border-t border-line">
                  <ShareBar parts={[
                    { label: 'Seller commission', amount: month.commissionEarned, className: 'bg-ember' },
                    { label: 'Buyer premium', amount: month.buyerPremium, className: 'bg-steel' },
                    { label: 'Listing fees', amount: month.listingFees, className: 'bg-success' },
                  ]} />
                </div>
              </div>

              <div className="card p-5">
                <div className="flex items-baseline justify-between gap-3 pb-3 border-b border-line">
                  <h3 className="font-display font-bold">Money we spent this month</h3>
                  <span className="num text-sm font-bold">{inr(month.costs)}</span>
                </div>
                <div className="divide-y divide-line">
                  {month.costLines.map((c) => <LedgerRow key={c.label} label={c.label} amount={c.amount} negative />)}
                </div>
                <p className="text-[12px] text-ink-faint pt-3 mt-1 border-t border-line">
                  These are worked out from the work each sale demonstrably took — a yard visit per lot inspected,
                  infrastructure per auction, and two lines that scale with income. They are the first thing to replace
                  when the business keeps a real cost ledger.
                </p>
              </div>

              <div className="card p-5 bg-surface-2/50">
                <LedgerRow label="Profit this month" amount={month.netProfit} tone="profit" bold
                  hint={`Last month ${inr(month.prevNetProfit)} · this financial year ${inr(year.netProfit)}`} />
              </div>

              <TrendBars
                points={trend}
                title="What we earned, by month"
                sub="Commission the bank has confirmed, plus buyer premium. Twelve months to today."
              />
            </div>

            <div className="space-y-4">
              <Ranked
                title="Which materials earned most"
                rows={byCategory}
                empty="No seller has accepted a price yet, so nothing has earned a commission."
              />
              <Ranked
                title="Which regions earned most"
                rows={byRegion}
                empty="No auction has closed with a commission behind it yet."
              />
              <Ranked
                title="What sold, by material"
                rows={growth.byCategory}
                empty="Nothing has sold this month."
              />
            </div>
          </div>

          {/* --------------------- what is not in the number --------------- */}
          <Question q="What these figures deliberately leave out" />
          {/* Two exposure notes side by side — drawn the way the Finance
              dashboard draws the same kind of card: the colour carries on the
              icon and the figure, not as a stripe down the edge. */}
          <div className="grid md:grid-cols-2 gap-3">
            <div className="card p-4">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-steel">
                <ShieldAlert size={13} /> Held for customers
              </div>
              <div className="num text-xl font-bold text-steel mt-1.5">{inr(month.emdHeld)}</div>
              <p className="text-[13px] text-ink-muted mt-1.5">
                EMD sits in our bank account but belongs to the buyers who paid it, and most of it goes back to them
                automatically when their lot closes. It is a liability, and the day it starts looking like profit is the
                day someone spends it.
              </p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-warning">
                <Info size={13} /> Earned but not received
              </div>
              <div className="num text-xl font-bold text-warning mt-1.5">{inr(month.commissionOwed)}</div>
              <p className="text-[13px] text-ink-muted mt-1.5">
                A seller telling us they have paid is not the same as the money arriving, so commission is counted only
                once Finance matches it against the bank. It is money owed to us — see{' '}
                <Link to="/ceo/risk" className="text-ember font-semibold hover:underline">money at risk</Link>.
              </p>
            </div>
          </div>

          <div className="mt-8">
            <NotMyDecision>
              These are the same numbers the Finance Administrator works with, in plainer words — commission at{' '}
              {cfg.sellerCommissionPct}%, buyer premium at {cfg.buyerPremiumPct}%. Finance can open every figure here down
              to the individual payment behind it; this page stops at the summary on purpose. Changing a rate is a Super
              Admin edit that comes back to you for signature — it is never done from a reporting screen.
            </NotMyDecision>
          </div>
        </>
      )}
    </Page>
  )
}
