/* ---------------------------------------------------------------------------
   CEO / MD — reports. Deliberately last in the menu: this is the reference
   shelf, not a place to find out what is happening. Anything urgent has already
   appeared on one of the four question screens.

   Every pack here is the *same figures those screens show*, written to a file.
   Nothing is recomputed for an export — a report that disagrees with the screen
   it came from is worse than no report, because it gets forwarded.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Download, FileSpreadsheet } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, PageHeader, Segmented } from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, num } from '../../lib/format'
import { PERIOD_LABEL, type PeriodKey } from '../../lib/money'
import {
  KIND_LABEL, NotMyDecision, Question, downloadCsv, useBooks, useGrowth, useIncidents, useRisk, useSignatureQueue,
} from './shared'

/** One pack: what it answers, what is in it, and the figures as they appear on
 *  the screen it came from. */
function Pack({ title, screen, to, lines, onExport, blurb }: {
  title: string
  screen: string
  to: string
  blurb: string
  lines: { label: string; value: string }[]
  onExport: () => void
}) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-line bg-surface-2/60 flex flex-wrap items-center gap-2">
        <FileSpreadsheet size={14} className="text-ink-faint" />
        <span className="font-bold text-sm">{title}</span>
        <Chip tone="neutral" className="ml-auto">from {screen}</Chip>
      </div>
      <div className="p-4">
        <p className="text-[13px] text-ink-muted">{blurb}</p>
        <div className="divide-y divide-line mt-3">
          {lines.map((l) => (
            <div key={l.label} className="flex items-baseline justify-between gap-4 py-2">
              <span className="text-[13px] text-ink">{l.label}</span>
              <span className="num text-[13px] font-bold tabular-nums shrink-0">{l.value}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <Button size="sm" variant="secondary" onClick={onExport}><Download size={14} /> Export</Button>
          <Link to={to} className="text-[13px] font-bold text-ember hover:underline inline-flex items-center gap-1">
            Open {screen} <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function CeoReports() {
  const [period, setPeriod] = useState<PeriodKey>('month')
  const books = useBooks(period)
  const growth = useGrowth(period)
  const risk = useRisk(period)
  const incidents = useIncidents(period)
  const queue = useSignatureQueue()
  const users = useStore((s) => s.users)
  const label = PERIOD_LABEL[period]
  const stamp = new Date(books.now).toISOString().slice(0, 10)
  const file = (name: string) => `ferrobid-${name}-${period}-${stamp}.csv`

  const c = growth.current
  const sellThrough = c.lotsOffered > 0 ? (c.lotsSold / c.lotsOffered) * 100 : 0

  const exportPnl = () => downloadCsv(file('profit-and-loss'), [
    ['ferroBid — profit & loss', label, `as at ${stamp}`],
    [],
    ['Money we earned'],
    ['Commission from sellers (received)', books.commissionEarned],
    ['Premium from buyers', books.buyerPremium],
    ['Listing fees', books.listingFees],
    ['Total earned', books.income],
    [],
    ['Money we spent'],
    ...books.costLines.map((l) => [l.label, l.amount]),
    ['Total spent', books.costs],
    [],
    ['Profit', books.netProfit],
    ['Previous period profit', books.prevNetProfit],
    [],
    ['Not counted as profit'],
    ['Commission earned but not received', books.commissionOwed],
    ['Customer deposits held', books.emdHeld],
  ])

  const exportGrowth = () => downloadCsv(file('growth'), [
    ['ferroBid — business growth', label, `as at ${stamp}`],
    [],
    ['Measure', 'This period', 'Previous period'],
    ['Value of material sold', c.salesValue, growth.previous.salesValue],
    ['Lots sold', c.lotsSold, growth.previous.lotsSold],
    ['Lots offered', c.lotsOffered, growth.previous.lotsOffered],
    ['Tonnage sold (MT-priced lots)', c.tonnage, growth.previous.tonnage],
    ['Auctions run', c.auctionsRun, growth.previous.auctionsRun],
    ['Auctions closed', c.auctionsClosed, growth.previous.auctionsClosed],
    ['Bids placed', c.bids, growth.previous.bids],
    ['Buyers who bid', c.activeBuyers, growth.previous.activeBuyers],
    ['Of those, had bid before', c.repeatBuyers, growth.previous.repeatBuyers],
    ['New customers', c.newCustomers, growth.previous.newCustomers],
    ['Average price over reserve (%)', c.avgUplift.toFixed(2), growth.previous.avgUplift.toFixed(2)],
    [],
    ['Value of material sold, by month'],
    ...growth.trend.map((t) => [t.label, t.value]),
  ])

  const exportRisk = () => downloadCsv(file('money-at-risk'), [
    ['ferroBid — money at risk', label, `as at ${stamp}`],
    [],
    ['Held for customers (deposits)', risk.emdHeld],
    ['Owed to us', risk.owedToUs],
    ['In transit', risk.inTransit],
    ['In dispute', risk.disputed],
    ['Deposits forfeited this period', risk.forfeitedThisPeriod],
    [],
    ['Buyers who won and have not paid'],
    ['Buyer', 'What', 'Amount', 'Age (days)'],
    ...risk.owedByBuyers.map((r) => [r.party, r.what, r.amount, r.bucket]),
    [],
    ['Sellers who owe commission'],
    ['Seller', 'What', 'Amount', 'Age (days)'],
    ...risk.owedBySellers.map((r) => [r.party, r.what, r.amount, r.bucket]),
  ])

  const exportIncidents = () => downloadCsv(file('what-went-wrong'), [
    ['ferroBid — things that went wrong', label, `as at ${stamp}`],
    [],
    ['When', 'Seriousness', 'Area', 'What happened', 'Detail', 'Amount'],
    ...incidents.map((i) => [i.at, i.severity, i.kind, i.title, i.body, i.amount ?? '']),
  ])

  const exportDecisions = () => downloadCsv(file('decisions'), [
    ['ferroBid — decisions that needed a signature', `as at ${stamp}`],
    [],
    ['Raised', 'Kind', 'What', 'Amount', 'Raised by', 'Status', 'Decided', 'Signed by', 'Note'],
    ...[...queue.open, ...queue.decided].map((a) => [
      a.requestedAt,
      KIND_LABEL[a.kind],
      a.summary,
      a.amount,
      users.find((u) => u.id === a.requestedBy)?.name ?? a.requestedBy,
      a.status,
      a.decidedAt ?? '',
      a.decidedBy ? users.find((u) => u.id === a.decidedBy)?.name ?? a.decidedBy : '',
      a.decisionNote ?? a.infoNote ?? '',
    ]),
  ])

  return (
    <Page>
      <PageHeader
        title="Reports"
        sub="The same figures as the screens, in a file. Read this last — anything that needed you has already appeared elsewhere."
        actions={
          <Segmented
            options={(['month', 'quarter', 'year', 'all'] as PeriodKey[]).map((k) => ({ key: k, label: PERIOD_LABEL[k] }))}
            value={period} onChange={setPeriod}
          />
        }
      />

      <Question q={`Five packs, all for ${label.toLowerCase()}`} a="Each one opens the screen it came from, so a figure can always be traced back to the records behind it." />

      <div className="grid lg:grid-cols-2 gap-4">
        <Pack
          title="Profit and loss"
          screen="profit and loss"
          to="/ceo/pnl"
          blurb="What we earned, what we spent, and what was left — with what is deliberately excluded stated at the bottom."
          lines={[
            { label: 'Money we earned', value: inr(books.income) },
            { label: 'Money we spent', value: inr(books.costs) },
            { label: 'Profit', value: inr(books.netProfit) },
            { label: 'Earned but not received', value: inr(books.commissionOwed) },
          ]}
          onExport={exportPnl}
        />
        <Pack
          title="Business growth"
          screen="growth"
          to="/ceo/growth"
          blurb="Trade carried and people who turned up, this period against the one before, plus twelve months of shape."
          lines={[
            { label: 'Value of material sold', value: inr(c.salesValue) },
            { label: 'Lots sold', value: `${num(c.lotsSold)} of ${num(c.lotsOffered)}` },
            { label: 'Buyers who bid', value: num(c.activeBuyers) },
            { label: 'New customers', value: num(c.newCustomers) },
          ]}
          onExport={exportGrowth}
        />
        <Pack
          title="Money at risk"
          screen="money at risk"
          to="/ceo/risk"
          blurb="Deposits we hold, debts owed to us with their age, money in transit and money in dispute — never added together."
          lines={[
            { label: 'Held for customers', value: inr(risk.emdHeld) },
            { label: 'Owed to us', value: inr(risk.owedToUs) },
            { label: 'In transit', value: inr(risk.inTransit) },
            { label: 'In dispute', value: inr(risk.disputed) },
          ]}
          onExport={exportRisk}
        />
        <Pack
          title="Auction performance"
          screen="auction performance"
          to="/ceo/auctions"
          blurb="Whether the sales worked: sell-through, how far competition pushed prices above reserve, and how deep the bidding went."
          lines={[
            { label: 'Sell-through', value: `${sellThrough.toFixed(0)}%` },
            { label: 'Average price over reserve', value: `${c.avgUplift.toFixed(1)}%` },
            { label: 'Auctions closed', value: num(c.auctionsClosed) },
            { label: 'Bids placed', value: num(c.bids) },
          ]}
          onExport={exportGrowth}
        />
        <Pack
          title="Decisions that needed a signature"
          screen="approvals"
          to="/ceo/approvals"
          blurb="Everything that reached you, whether it is still waiting or already signed — with who raised it and what was said."
          lines={[
            { label: 'Waiting on you', value: num(queue.open.length) },
            { label: 'Signed or refused', value: num(queue.decided.length) },
            { label: 'Money held up', value: inr(queue.open.reduce((s, a) => s + a.amount, 0)) },
          ]}
          onExport={exportDecisions}
        />
        <Pack
          title="Things that went wrong"
          screen="what went wrong"
          to="/ceo/issues"
          blurb="Every failure across every desk in time order, with what each one carried in money."
          lines={[
            { label: 'Events', value: num(incidents.length) },
            { label: 'Serious', value: num(incidents.filter((i) => i.severity === 'critical').length) },
            { label: 'Money attached', value: inr(incidents.reduce((s, i) => s + (i.amount ?? 0), 0)) },
          ]}
          onExport={exportIncidents}
        />
      </div>

      <div className="mt-8">
        <NotMyDecision>
          These are exports of what is on screen, not a separate reporting system — which is the point. Finance keeps the
          deeper packs (movement by period, tax collected, the audit pack) on{' '}
          <Link to="/finance/reports" className="text-ember font-semibold hover:underline">financial reports</Link>, and
          can open any figure here down to the individual payment behind it. Ask them for that rather than asking for a
          new number: a figure that exists in two places eventually means two things.
        </NotMyDecision>
      </div>
    </Page>
  )
}
