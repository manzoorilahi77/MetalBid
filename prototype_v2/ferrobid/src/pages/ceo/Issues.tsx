/* ---------------------------------------------------------------------------
   CEO / MD — things that went wrong. Still the third question, from the other
   side: not what is at risk, but what has already failed.

   Every row here is read from a real record on somebody's desk — a forfeited
   deposit, a bounced payment, a bid struck off, a seller who refused the price
   their own lot sold at, a complaint nobody has answered. Nothing is a log
   line: each one opens the screen where it happened, and each says what it
   actually cost in plain words.

   The value of the page is that these never appear together anywhere else.
   Finance sees its failures, the Auction Manager sees theirs, support sees the
   complaints. One bad week looks like noise from each of those desks and like a
   pattern from here.
--------------------------------------------------------------------------- */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, BadgeAlert, CheckCircle2, Gavel, IndianRupee, MessageSquareWarning, ShieldQuestion } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Chip, EmptyState, PageHeader, Segmented, Tabs, cx } from '../../components/ui'
import { inr, num, relTime } from '../../lib/format'
import { PERIOD_LABEL, type PeriodKey } from '../../lib/money'
import { NotMyDecision, PlainStat, Question, useIncidents, type Incident } from './shared'

type Filter = 'all' | Incident['kind']

const KIND_META: Record<Incident['kind'], { label: string; icon: typeof IndianRupee; blurb: string }> = {
  money: { label: 'Money', icon: IndianRupee, blurb: 'Payments that failed, deposits we kept, and money the bank and the ledger disagree about.' },
  auction: { label: 'The auction floor', icon: Gavel, blurb: 'Bids we had to question or strike off, and sales that did not run to their end.' },
  customer: { label: 'Customers', icon: MessageSquareWarning, blurb: 'People waiting on an answer, and prices a seller would not accept.' },
  quality: { label: 'What we sold', icon: ShieldQuestion, blurb: 'Lots that reached the market on the seller\'s word rather than on an inspection.' },
}

const SEVERITY_META = {
  critical: { chip: 'danger', label: 'Serious', ring: 'bg-danger-soft text-danger' },
  warning: { chip: 'warning', label: 'Worth watching', ring: 'bg-warning-soft text-warning' },
  note: { chip: 'neutral', label: 'For the record', ring: 'bg-surface-2 text-ink-muted' },
} as const

export default function CeoIssues() {
  const [period, setPeriod] = useState<PeriodKey>('month')
  const [filter, setFilter] = useState<Filter>('all')
  const incidents = useIncidents(period)

  const counts = useMemo(() => ({
    all: incidents.length,
    money: incidents.filter((i) => i.kind === 'money').length,
    auction: incidents.filter((i) => i.kind === 'auction').length,
    customer: incidents.filter((i) => i.kind === 'customer').length,
    quality: incidents.filter((i) => i.kind === 'quality').length,
    critical: incidents.filter((i) => i.severity === 'critical').length,
    cost: incidents.reduce((s, i) => s + (i.amount ?? 0), 0),
  }), [incidents])

  const shown = filter === 'all' ? incidents : incidents.filter((i) => i.kind === filter)
  const now = Date.now()

  return (
    <Page>
      <PageHeader
        title="Things that went wrong"
        sub="Every failure across every desk, in one place and in time order. Each one opens where it happened."
        actions={
          <Segmented
            options={(['month', 'quarter', 'year', 'all'] as PeriodKey[]).map((k) => ({ key: k, label: PERIOD_LABEL[k] }))}
            value={period} onChange={setPeriod}
          />
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <PlainStat label={`Went wrong · ${PERIOD_LABEL[period].toLowerCase()}`} value={num(counts.all)}
          tone={counts.all > 0 ? 'risk' : 'plain'} sub="across every desk" />
        <PlainStat label="Serious" value={num(counts.critical)} tone={counts.critical > 0 ? 'risk' : 'plain'}
          sub="a customer lost money, or a sale was interfered with" />
        <PlainStat label="Money attached" value={inr(counts.cost)}
          sub="the value carried by these events — not a loss figure" />
        <PlainStat label="People still waiting" value={num(counts.customer)}
          sub="complaints and refused prices" to="/disputes" />
      </div>

      <Question q="What kind of thing went wrong?" />
      <Tabs
        value={filter}
        onChange={setFilter}
        tabs={[
          { key: 'all' as Filter, label: 'Everything', count: counts.all },
          { key: 'money' as Filter, label: KIND_META.money.label, count: counts.money },
          { key: 'auction' as Filter, label: KIND_META.auction.label, count: counts.auction },
          { key: 'customer' as Filter, label: KIND_META.customer.label, count: counts.customer },
          { key: 'quality' as Filter, label: KIND_META.quality.label, count: counts.quality },
        ]}
        className="mb-4"
      />

      {filter !== 'all' && (
        <p className="text-[13px] text-ink-muted -mt-2 mb-4">{KIND_META[filter].blurb}</p>
      )}

      {shown.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={32} strokeWidth={1.5} />}
          title={filter === 'all' ? `Nothing went wrong ${PERIOD_LABEL[period].toLowerCase()}` : 'Nothing of that kind in this period'}
          body="No deposit forfeited, no payment bounced, no bid questioned and nobody left waiting. Widen the period if you want the longer view."
        />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {shown.map((i) => {
            const meta = SEVERITY_META[i.severity]
            const Icon = KIND_META[i.kind].icon
            return (
              <Link key={i.id} to={i.to} className="flex items-start gap-3.5 px-4 py-3.5 hover:bg-surface-2 transition-colors">
                <span className={cx('size-9 rounded-xl grid place-items-center shrink-0 mt-0.5', meta.ring)}>
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm">{i.title}</span>
                    <Chip tone={meta.chip}>{meta.label}</Chip>
                  </div>
                  <p className="text-[13px] text-ink-muted leading-snug mt-0.5">{i.body}</p>
                  <div className="text-[11px] text-ink-faint mt-1">
                    {relTime(i.at, now)} · {KIND_META[i.kind].label.toLowerCase()}
                  </div>
                </div>
                {i.amount != null && i.amount > 0 && (
                  <span className="num text-sm font-bold shrink-0 self-center tabular-nums hidden sm:block">{inr(i.amount)}</span>
                )}
              </Link>
            )
          })}
        </div>
      )}

      {/* ------------------------- how to read this ------------------------- */}
      <Question q="How to read this page" />
      <div className="grid md:grid-cols-3 gap-3">
        <div className="card p-4 flex items-start gap-3">
          <BadgeAlert size={16} className="text-danger shrink-0 mt-0.5" />
          <div className="text-[13px] text-ink-muted">
            <strong className="text-ink">Serious</strong> means a customer lost money or a sale was interfered with — a
            forfeited deposit, a struck-off bid, a cancelled auction. These are the ones worth asking about by name.
          </div>
        </div>
        <div className="card p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
          <div className="text-[13px] text-ink-muted">
            <strong className="text-ink">Worth watching</strong> is a single event that is fine on its own and a pattern
            if it repeats — a bounced payment, an unanswered complaint, a price a seller refused.
          </div>
        </div>
        <div className="card p-4 flex items-start gap-3">
          <ShieldQuestion size={16} className="text-ink-faint shrink-0 mt-0.5" />
          <div className="text-[13px] text-ink-muted">
            <strong className="text-ink">For the record</strong> is deliberate and controlled — a bypassed inspection, a
            deposit claim we could not trace. Counted here so the rate is visible, not because it was a mistake.
          </div>
        </div>
      </div>

      <div className="mt-8">
        <NotMyDecision>
          Nothing here is yours to fix, and none of it can be closed from this page — a complaint is answered by the Sub
          Admin, a bad bid is struck off by the Super Admin, a bounced payment is re-sent by Finance. What this page is
          for is the pattern: three unanswered complaints in a week is a support problem, and it will not look like one
          from any single desk.
        </NotMyDecision>
      </div>
    </Page>
  )
}
