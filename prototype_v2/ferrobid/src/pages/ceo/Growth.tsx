/* ---------------------------------------------------------------------------
   CEO / MD — business growth. The second question: **is the business growing?**

   Profit says whether this month worked. Growth says whether the thing that
   produced it is getting bigger, and it is a different question: a good month on
   a shrinking buyer base is a warning, not a result.

   So the page measures the platform rather than the P&L — what sold, how much
   material moved, how many people came, and how many of them had been before.
   Value here is **what the material sold for**, not our income: buyers pay
   sellers directly, and we only take commission on the upside. Saying so
   plainly on the page stops a ₹4 crore figure being mistaken for turnover.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Users } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { EmptyState, PageHeader, Segmented } from '../../components/ui'
import { inr, inrCompact, num } from '../../lib/format'
import { PERIOD_LABEL, delta, type PeriodKey } from '../../lib/money'
import { Headline, NotMyDecision, PlainStat, Question, Ranked, TrendBars, useGrowth } from './shared'

/** How a single figure moved, with the previous period spelled out rather than
 *  left as a percentage the reader has to reverse-engineer. */
function Movement({ label, now, before, format, unit, hint }: {
  label: string
  now: number
  before: number
  format?: (n: number) => string
  unit?: string
  hint?: string
}) {
  const fmt = format ?? num
  return (
    <PlainStat
      label={label}
      value={unit ? `${fmt(now)} ${unit}` : fmt(now)}
      trend={delta(now, before)}
      sub={before > 0 ? `was ${fmt(before)}${unit ? ` ${unit}` : ''}` : hint ?? 'nothing in the period before'}
    />
  )
}

export default function CeoGrowth() {
  const [period, setPeriod] = useState<PeriodKey>('month')
  const g = useGrowth(period)
  const { current: c, previous: p } = g

  const sellThrough = c.lotsOffered > 0 ? (c.lotsSold / c.lotsOffered) * 100 : 0
  const prevSellThrough = p.lotsOffered > 0 ? (p.lotsSold / p.lotsOffered) * 100 : 0
  const repeatShare = c.activeBuyers > 0 ? (c.repeatBuyers / c.activeBuyers) * 100 : 0
  const prevRepeatShare = p.activeBuyers > 0 ? (p.repeatBuyers / p.activeBuyers) * 100 : 0
  const nothingYet = c.lotsOffered === 0 && c.bids === 0 && c.newCustomers === 0

  return (
    <Page>
      <PageHeader
        title="Business growth"
        sub="How much trade the platform carried, and who turned up to it. This is the size of the business — not our income, which is a small percentage of it."
        actions={
          <Segmented
            options={(['month', 'quarter', 'year', 'all'] as PeriodKey[]).map((k) => ({ key: k, label: PERIOD_LABEL[k] }))}
            value={period} onChange={setPeriod}
          />
        }
      />

      {nothingYet ? (
        <EmptyState
          icon={<Users size={32} strokeWidth={1.5} />}
          title={`Nothing traded ${PERIOD_LABEL[period].toLowerCase()}`}
          body="No auction closed and no bid was placed in this window. Widen the period, or look at what is scheduled to come."
          action={<Link to="/ceo/auctions" className="text-sm font-bold text-ember hover:underline inline-flex items-center gap-1">Auction performance <ArrowRight size={13} /></Link>}
        />
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-3">
            <Headline
              label={`Value of material sold · ${PERIOD_LABEL[period].toLowerCase()}`}
              value={inr(c.salesValue)}
              trend={period === 'all' ? undefined : delta(c.salesValue, p.salesValue)}
              prev={period === 'all' ? undefined : <>previous period {inr(p.salesValue)}</>}
              sub="What buyers agreed to pay sellers across every lot that closed. The money for the material goes buyer to seller directly — we earn commission on the part above the seller's reserve."
            />
            <Headline
              label={`Buyers who bid · ${PERIOD_LABEL[period].toLowerCase()}`}
              value={num(c.activeBuyers)}
              trend={period === 'all' ? undefined : delta(c.activeBuyers, p.activeBuyers)}
              prev={period === 'all' ? undefined : <>previous period {num(p.activeBuyers)}</>}
              sub={c.activeBuyers > 0
                ? `${num(c.repeatBuyers)} of them had bid with us before — ${repeatShare.toFixed(0)}% came back. Repeat buyers are the cheapest growth there is.`
                : 'Nobody bid in this window.'}
            />
          </div>

          {/* ---------------------------- what moved --------------------------- */}
          <Question
            q="How much trade did we carry?"
            a="Lots offered against lots sold is the honest measure of whether we are selling what sellers give us — volume alone can rise while sell-through falls."
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Movement label="Lots sold" now={c.lotsSold} before={p.lotsSold} />
            <Movement label="Lots offered" now={c.lotsOffered} before={p.lotsOffered} />
            <PlainStat
              label="Sell-through"
              value={`${sellThrough.toFixed(0)}%`}
              trend={period === 'all' ? undefined : delta(sellThrough, prevSellThrough)}
              sub={prevSellThrough > 0 ? `was ${prevSellThrough.toFixed(0)}%` : 'no prior period'}
            />
            <Movement label="Tonnage sold" now={c.tonnage} before={p.tonnage} unit="MT"
              hint="lots priced per MT only" />
          </div>

          {/* ---------------------------- who came ----------------------------- */}
          <Question
            q="Who came, and did they come back?"
            a="New accounts tell you the marketing worked. The repeat share tells you the platform did."
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Movement label="New customers" now={c.newCustomers} before={p.newCustomers} hint="first period on the platform" />
            <Movement label="Buyers who bid" now={c.activeBuyers} before={p.activeBuyers} />
            <PlainStat
              label="Came back"
              value={`${repeatShare.toFixed(0)}%`}
              trend={period === 'all' ? undefined : delta(repeatShare, prevRepeatShare)}
              sub={`${num(c.repeatBuyers)} of ${num(c.activeBuyers)} had bid before`}
            />
            <Movement label="Bids placed" now={c.bids} before={p.bids} />
          </div>

          {/* --------------------------- the shape ----------------------------- */}
          <Question q="Twelve months of trade" a="Value of material sold, by the month the auction closed." />
          <TrendBars
            points={g.trend}
            title="Value of material sold, by month"
            sub="Every lot that closed with a winning price, at that price."
          />

          <Question q="Where the growth is coming from" />
          <div className="grid md:grid-cols-3 gap-4">
            <Ranked title="By material" rows={g.byCategory} empty="Nothing sold in this period." />
            <Ranked title="By region" rows={g.byRegion} empty="Nothing sold in this period." />
            <Ranked title="Biggest buyers" rows={g.topBuyers} empty="No lot has a winning bidder in this period." />
          </div>

          <div className="grid md:grid-cols-2 gap-3 mt-6">
            <PlainStat label="Auctions we ran" value={num(c.auctionsRun)} trend={period === 'all' ? undefined : delta(c.auctionsRun, p.auctionsRun)}
              sub={`${num(c.auctionsClosed)} closed in the period`} to="/ceo/auctions" />
            <PlainStat label="Average price over reserve" value={`${c.avgUplift.toFixed(1)}%`}
              trend={period === 'all' ? undefined : delta(c.avgUplift, p.avgUplift)}
              sub="how much competition added to the seller's own floor — and the base our commission is cut from"
              to="/ceo/auctions" />
          </div>

          <div className="mt-8">
            <NotMyDecision>
              Sales value is not turnover. Buyers settle with sellers directly for the material; the platform&apos;s own
              income is the commission and premium on the{' '}
              <Link to="/ceo/pnl" className="text-ember font-semibold hover:underline">profit &amp; loss</Link>. Counting the
              full {inrCompact(c.salesValue)} as ours would overstate the business by roughly two orders of magnitude,
              which is exactly why the two live on separate screens.
            </NotMyDecision>
          </div>
        </>
      )}
    </Page>
  )
}
