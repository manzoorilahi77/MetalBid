/* ---------------------------------------------------------------------------
   CEO / MD — the dashboard. The landing screen, and the only one in this
   workspace that answers all four questions at once.

   Everything on this page is a **summary of a screen that already exists**, not
   a sixth calculation. Profit comes from `useBooks()`, the same hook the Finance
   P&L uses; growth from `useGrowth()`; the sales from `useAuctionPerformance()`;
   exposure from `useRisk()`; failures from `useIncidents()`; the queue from
   `useSignatureQueue()`. Nothing here is derived a second way, so no figure on
   the dashboard can disagree with the screen it links to — and every panel does
   link to that screen, because this page deliberately stops at the summary.

   The three rules of the workspace still hold, and matter more here than
   anywhere else because everything is side by side:

   · **Money we are holding is never drawn as money we have.** EMD is steel, and
     it is never added into a total with money that is ours.
   · **Four kinds of money at risk are never summed.** A deposit we hold, a debt
     owed to us, a payment in transit and a disputed amount are different things;
     one "total at risk" figure would be arithmetic with no meaning.
   · **No buttons.** Every control on this page navigates; nothing decides.

   Read top to bottom it tells one story: how are we doing → why → what is
   growing → what is exposed → what do I need to act on.
--------------------------------------------------------------------------- */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  AlertTriangle, ArrowRight, BadgeIndianRupee, CheckCircle2, FileSpreadsheet, Gavel, Landmark,
  MessageSquareWarning, ShieldAlert, ShieldCheck, Signature, TrendingUp, Users,
} from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Chip, EmptyState, PageHeader, Segmented, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, inrCompact, num, relTime } from '../../lib/format'
import { PERIOD_LABEL, delta, type PeriodKey } from '../../lib/money'
import { LedgerRow, ShareBar, commissionBreakdown } from '../finance/shared'
import {
  NotMyDecision, Question, Ranked, TrendBars, Trend, incomeByMonth,
  useAuctionPerformance, useBooks, useGrowth, useIncidents, useRisk, useSignatureQueue,
} from './shared'

/* ------------------------------- chart chrome ------------------------------ */
/* Recharts is themed from the CSS variables rather than from literals, so the
   charts follow the dark theme with the rest of the app. */
const TOOLTIP_STYLE = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 12,
  fontSize: 13,
  boxShadow: '0 10px 30px -18px rgb(0 0 0 / 0.35)',
} as const
const TICK = { fontSize: 11, fill: 'var(--ink-faint)' } as const
const AXIS = { axisLine: false, tickLine: false } as const

/** A chart with the question it answers above it, a written summary for anyone
 *  who cannot see it, a legend that carries the same figures as text, and its
 *  own empty state — so a panel with no data reads as "nothing happened"
 *  rather than as a broken box. */
function ChartCard({ title, sub, aria, empty, emptyText, height = 260, legend, children }: {
  title: React.ReactNode
  sub?: React.ReactNode
  /** One sentence describing what the chart shows, for screen readers. */
  aria: string
  /** True when there is genuinely nothing to draw. */
  empty?: boolean
  emptyText?: string
  height?: number
  /** Keys and totals in words, below the plot area — never colour alone. */
  legend?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="card p-4 sm:p-5 h-full flex flex-col">
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{title}</div>
        {sub && <div className="text-[12px] text-ink-muted mt-1 max-w-prose">{sub}</div>}
      </div>
      {empty ? (
        <p className="flex-1 grid place-items-center text-[13px] text-ink-muted text-center py-10">
          {emptyText ?? 'Nothing to draw for this period.'}
        </p>
      ) : (
        <>
          <div className="mt-4 -ml-2" style={{ height }} role="img" aria-label={aria}>
            {children}
          </div>
          {legend && <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">{legend}</div>}
        </>
      )}
    </div>
  )
}

/* --------------------------------- the KPIs -------------------------------- */

type Tone = 'plain' | 'profit' | 'held' | 'risk' | 'ember'

const TONE_VALUE: Record<Tone, string> = {
  plain: 'text-ink',
  profit: 'text-success',
  held: 'text-steel',
  risk: 'text-warning',
  ember: 'text-ember',
}
const TONE_ICON: Record<Tone, string> = {
  plain: 'bg-surface-2 text-ink-muted',
  profit: 'bg-success-soft text-success',
  held: 'bg-steel-soft text-steel',
  risk: 'bg-warning-soft text-warning',
  ember: 'bg-ember-soft text-ember',
}

/** One executive reading: the figure, what it is, how it moved, and the screen
 *  it comes from. Every tile is a link — a number the CEO cannot open is a
 *  number they have to take on trust. */
function Kpi({ label, value, sub, trend, tone = 'plain', to, icon: Icon, size = 'md' }: {
  label: React.ReactNode
  value: React.ReactNode
  sub?: React.ReactNode
  trend?: number | null
  tone?: Tone
  to: string
  icon: typeof TrendingUp
  /** `lg` is the one figure the page leads on. */
  size?: 'md' | 'lg'
}) {
  return (
    <Link to={to} className="card card-hover p-4 sm:p-5 flex flex-col min-h-[7.5rem] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{label}</div>
        <span className={cx('size-8 rounded-xl grid place-items-center shrink-0', TONE_ICON[tone])}>
          <Icon size={15} />
        </span>
      </div>
      {/* `lg` matches the workspace's own `Headline` rather than growing past
          it — a rupee figure in full runs long, and the tile has to hold a
          crore without wrapping on a phone. */}
      <div className={cx('num font-bold tabular-nums mt-2', TONE_VALUE[tone], size === 'lg' ? 'text-3xl sm:text-4xl' : 'text-2xl')}>
        {value}
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-auto pt-2">
        <Trend value={trend} />
        {sub && <span className="text-[12px] text-ink-muted">{sub}</span>}
      </div>
    </Link>
  )
}

/* ------------------------------ action centre ------------------------------ */

/** One thing waiting on the CEO. Deliberately not a notification: it says what
 *  is held, how much of it there is, and opens the desk that works it. */
function ActionRow({ label, count, sub, to, tone, icon: Icon }: {
  label: string
  count: React.ReactNode
  sub: string
  to: string
  tone: 'ember' | 'risk' | 'held' | 'plain'
  icon: typeof Signature
}) {
  const quiet = count === 0
  return (
    <Link
      to={to}
      className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-surface-2 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ember"
    >
      <span className={cx('size-9 rounded-xl grid place-items-center shrink-0',
        quiet ? 'bg-surface-2 text-ink-faint' : TONE_ICON[tone])}>
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-ink">{label}</div>
        <div className="text-[12px] text-ink-muted truncate">{sub}</div>
      </div>
      <span className={cx('num text-xl font-bold tabular-nums shrink-0', quiet ? 'text-ink-faint' : TONE_VALUE[tone])}>
        {typeof count === 'number' ? num(count) : count}
      </span>
      <ArrowRight size={14} className="text-ink-faint shrink-0" />
    </Link>
  )
}

/* ------------------------------ business health ---------------------------- */

type HealthState = 'good' | 'steady' | 'watch'

const HEALTH_META: Record<HealthState, { label: string; dot: string; text: string }> = {
  good: { label: 'Healthy', dot: 'bg-success', text: 'text-success' },
  steady: { label: 'Steady', dot: 'bg-steel', text: 'text-steel' },
  watch: { label: 'Watch', dot: 'bg-warning', text: 'text-warning' },
}

/** One dimension of the business, with its own real measure beside it.
 *
 *  There is deliberately no combined score. The platform has no calculation for
 *  one, and inventing a "72 / 100" would be a number nobody could trace back to
 *  a record. What each dimension gets instead is the figure it is judged on and
 *  the rule that judged it, in words — so a reader can disagree with the
 *  threshold rather than with an opaque total. The state word is always shown
 *  as text as well as colour. */
function Dimension({ label, value, state, rule, meter, to }: {
  label: string
  value: React.ReactNode
  state: HealthState
  rule: string
  /** 0–100 where the measure genuinely is a percentage; omitted otherwise. */
  meter?: number
  to: string
}) {
  const meta = HEALTH_META[state]
  return (
    <Link to={to} className="card card-hover p-4 block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint truncate">{label}</span>
        <span className={cx('inline-flex items-center gap-1.5 text-[11px] font-bold shrink-0', meta.text)}>
          <span className={cx('size-1.5 rounded-full', meta.dot)} aria-hidden />
          {meta.label}
        </span>
      </div>
      <div className="num text-xl font-bold tabular-nums mt-1.5">{value}</div>
      {meter !== undefined && (
        <div className="h-1.5 rounded-full bg-surface-2 mt-2.5 overflow-hidden">
          <div className={cx('h-full rounded-full', meta.dot)} style={{ width: `${Math.max(2, Math.min(100, meter))}%` }} />
        </div>
      )}
      <p className="text-[12px] text-ink-muted mt-2 leading-snug">{rule}</p>
    </Link>
  )
}

/** Opens the screen a panel summarises. */
function OpenScreen({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="text-[13px] font-bold text-ember hover:underline inline-flex items-center gap-1 shrink-0">
      {children} <ArrowRight size={13} />
    </Link>
  )
}

/* ================================== page =================================== */

export default function CeoDashboard() {
  const [period, setPeriod] = useState<PeriodKey>('month')

  /* Six readings of the same records. Every one of them is the hook the screen
     it links to already uses. */
  const books = useBooks(period)
  const year = useBooks('year')
  const growth = useGrowth(period)
  const auctions = useAuctionPerformance(period)
  const risk = useRisk(period)
  const incidents = useIncidents(period)
  const queue = useSignatureQueue()
  const users = useStore((s) => s.users)

  const { current: c, previous: p } = growth
  const label = PERIOD_LABEL[period].toLowerCase()

  const income = useMemo(() => incomeByMonth(books), [books])
  const { byCategory: commissionByCategory } = useMemo(() => commissionBreakdown(books, users), [books, users])

  /* --------------------------- derived readings --------------------------- */
  const sellThrough = auctions.totals.sellThrough
  const prevSellThrough = p.lotsOffered > 0 ? (p.lotsSold / p.lotsOffered) * 100 : 0
  const serious = incidents.filter((i) => i.severity === 'critical')
  const oldDebtRows = [...risk.owedByBuyers, ...risk.owedBySellers].filter((r) => r.bucket === '30+')
  const oldDebt = oldDebtRows.reduce((s, r) => s + r.amount, 0)
  const oldDebtShare = risk.owedToUs > 0 ? (oldDebt / risk.owedToUs) * 100 : 0
  const moneyHeldUp = queue.open.reduce((s, a) => s + a.amount, 0)

  /* The health rules, stated once here and printed on the cards themselves.
     They are judgements about thresholds, not derived figures — which is why
     each card shows the measure that produced the word. */
  const health: Parameters<typeof Dimension>[0][] = [
    {
      label: 'Money',
      value: inr(books.netProfit),
      state: books.netProfit <= 0 ? 'watch' : books.netProfit >= books.prevNetProfit ? 'good' : 'steady',
      rule: books.prevNetProfit > 0
        ? `Profit ${label}, against ${inr(books.prevNetProfit)} the period before.`
        : `Profit ${label}. No comparable period before it.`,
      to: '/ceo/pnl',
    },
    {
      label: 'Auctions',
      value: `${sellThrough.toFixed(0)}% sell-through`,
      state: sellThrough >= 70 ? 'good' : sellThrough >= 50 ? 'steady' : 'watch',
      rule: `${num(auctions.totals.soldLots)} of ${num(auctions.totals.totalLots)} lots found a buyer. Healthy at 70% and above.`,
      meter: sellThrough,
      to: '/ceo/auctions',
    },
    {
      label: 'Growth',
      value: inrCompact(c.salesValue),
      state: p.salesValue === 0 ? 'steady' : c.salesValue >= p.salesValue ? 'good' : 'watch',
      rule: p.salesValue > 0
        ? `Value of material sold, against ${inrCompact(p.salesValue)} the period before.`
        : 'Value of material sold. Nothing traded in the period before it.',
      to: '/ceo/growth',
    },
    {
      label: 'Exposure',
      value: inrCompact(risk.owedToUs),
      state: oldDebtShare >= 25 ? 'watch' : oldDebtShare > 0 ? 'steady' : 'good',
      rule: oldDebt > 0
        ? `Owed to us, of which ${inrCompact(oldDebt)} is more than thirty days old. Watch from a quarter of it.`
        : 'Owed to us, none of it older than thirty days.',
      meter: 100 - oldDebtShare,
      to: '/ceo/risk',
    },
    {
      label: 'Operations',
      value: `${num(serious.length)} serious`,
      state: serious.length === 0 ? 'good' : serious.length <= 2 ? 'steady' : 'watch',
      rule: `${num(incidents.length)} thing${incidents.length === 1 ? '' : 's'} went wrong ${label}, across every desk.`,
      to: '/ceo/issues',
    },
  ]

  /* ----------------------------- chart series ----------------------------- */
  /* Latest eight closed auctions, oldest first so the bars read left to right
     the way the sales actually ran. */
  const auctionBars = useMemo(
    () => auctions.rows.slice(0, 8).reverse().map((r) => ({
      name: r.code,
      title: r.title,
      sold: r.lotsSold,
      unsold: Math.max(0, r.lotsOffered - r.lotsSold),
    })),
    [auctions.rows],
  )
  const ageingBars = useMemo(
    () => risk.buckets.map((b) => ({ name: `${b.bucket} days`, buyers: b.buyers, sellers: b.sellers })),
    [risk.buckets],
  )

  const nothingYet = year.income === 0 && year.commissionOwed === 0 && c.lotsOffered === 0 && c.bids === 0

  /* The reporting stamp. `now` ticks every second, so it is printed to the
     minute — a clock that re-renders a timestamp every second reads as noise
     rather than as freshness. */
  const asAt = new Date(books.now).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  })

  return (
    <Page>
      <PageHeader
        title="CEO dashboard"
        sub="Your executive view of ferroBid — what we earned, how the sales performed, whether we are growing, what is exposed, and what is waiting on your signature."
        actions={
          <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full">
            <span className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-line bg-surface-2 text-[12px] text-ink-muted">
              <span className="size-1.5 rounded-full bg-success animate-live-pulse" aria-hidden />
              <span className="num">As at {asAt}</span>
            </span>
            <Segmented
              options={(['month', 'quarter', 'year', 'all'] as PeriodKey[]).map((k) => ({ key: k, label: PERIOD_LABEL[k] }))}
              value={period}
              onChange={setPeriod}
            />
          </div>
        }
      />

      {nothingYet ? (
        <EmptyState
          icon={<TrendingUp size={32} strokeWidth={1.5} />}
          title="Nothing has traded yet"
          body="No auction has closed, nothing has been bid on and no commission has reached the bank. Every panel on this dashboard fills itself from those records as they happen."
          action={<OpenScreen to="/ceo/auctions">See what is scheduled</OpenScreen>}
        />
      ) : (
        <>
          {/* ══════ Level 1 — what the CEO needs to know before anything else ══ */}
          <div className="grid lg:grid-cols-3 gap-3">
            {/* `Trend` already prints "no comparable period" where a percentage
                would lie, so no `sub` below ever repeats that phrase. */}
            <div className="lg:col-span-2 grid sm:grid-cols-2 gap-3">
              <Kpi
                label={`Profit · ${label}`}
                value={inr(books.netProfit)}
                tone={books.netProfit >= 0 ? 'profit' : 'plain'}
                trend={delta(books.netProfit, books.prevNetProfit)}
                sub={books.prevNetProfit > 0 ? `was ${inrCompact(books.prevNetProfit)}` : undefined}
                to="/ceo/pnl"
                icon={TrendingUp}
                size="lg"
              />
              <Kpi
                label={`Value of material sold · ${label}`}
                value={inrCompact(c.salesValue)}
                trend={period === 'all' ? undefined : delta(c.salesValue, p.salesValue)}
                sub="buyers pay sellers directly"
                to="/ceo/growth"
                icon={Gavel}
                size="lg"
              />
              <Kpi
                label={`Money we earned · ${label}`}
                value={inrCompact(books.income)}
                tone="ember"
                trend={delta(books.income, books.prevIncome)}
                sub="commission, premium and fees"
                to="/ceo/pnl"
                icon={BadgeIndianRupee}
              />
              <Kpi
                label="Owed to us"
                value={inrCompact(risk.owedToUs)}
                tone="risk"
                sub={oldDebt > 0 ? `${inrCompact(oldDebt)} over thirty days` : 'none over thirty days'}
                to="/ceo/risk"
                icon={ShieldAlert}
              />
              <Kpi
                label="Held for customers"
                value={inrCompact(risk.emdHeld)}
                tone="held"
                sub="deposits — never our money"
                to="/ceo/risk"
                icon={Landmark}
              />
              <Kpi
                label={`Buyers who bid · ${label}`}
                value={num(c.activeBuyers)}
                trend={period === 'all' ? undefined : delta(c.activeBuyers, p.activeBuyers)}
                sub={`${num(c.repeatBuyers)} had bid before`}
                to="/ceo/growth"
                icon={Users}
              />
            </div>

            {/* ------------------------ the action centre ------------------- */}
            <div className="card overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-line bg-surface-2/60 flex items-center gap-2">
                <Signature size={13} className="text-ink-faint" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Needs your attention</span>
                {queue.open.length > 0 && <Chip tone="warning" className="ml-auto">{num(queue.open.length)} waiting</Chip>}
              </div>
              <div className="divide-y divide-line flex-1">
                <ActionRow
                  label="Waiting for your signature"
                  count={queue.open.length}
                  sub={queue.open.length > 0 ? `${inr(moneyHeldUp)} held up · nothing has taken effect` : 'every desk is inside its own authority'}
                  to="/ceo/approvals"
                  tone="ember"
                  icon={Signature}
                />
                <ActionRow
                  label="Serious failures"
                  count={serious.length}
                  sub={`of ${num(incidents.length)} thing${incidents.length === 1 ? '' : 's'} that went wrong ${label}`}
                  to="/ceo/issues"
                  tone="risk"
                  icon={AlertTriangle}
                />
                <ActionRow
                  label="Owed more than thirty days"
                  count={oldDebtRows.length}
                  sub={oldDebt > 0 ? `${inr(oldDebt)} — usually a decision, not another reminder` : 'nothing has aged that far'}
                  to="/ceo/risk"
                  tone="risk"
                  icon={ShieldAlert}
                />
                <ActionRow
                  label="Customers still waiting"
                  count={risk.openDisputes.length}
                  sub="open complaints across every desk"
                  to="/ceo/issues"
                  tone="held"
                  icon={MessageSquareWarning}
                />
              </div>
              <Link
                to="/ceo/delegate"
                className="flex items-start gap-2.5 px-4 py-3 border-t border-line bg-surface-2/40 text-[12px] text-ink-muted hover:bg-surface-2 transition-colors"
              >
                <ShieldCheck size={14} className={cx('mt-0.5 shrink-0', queue.delegate ? 'text-steel' : 'text-ink-faint')} />
                <span>
                  {queue.delegate
                    ? <><strong className="text-ink">{queue.delegate.name} is holding your queue until {queue.delegatedUntil}.</strong> Change or take it back.</>
                    : <>Nobody is holding your queue. <span className="text-ember font-semibold">Delegate it</span> before you are away rather than leaving people waiting.</>}
                </span>
              </Link>
            </div>
          </div>

          {/* ══════ Is the business healthy? ══════════════════════════════════ */}
          <Question
            q="Is the business healthy?"
            a="Five dimensions, each with the figure it is judged on. There is no combined score — the platform has no calculation for one, and a single number would hide exactly the dimension that moved."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {health.map((d) => <Dimension key={d.label} {...d} />)}
          </div>

          {/* ══════ Level 2 — why ═════════════════════════════════════════════ */}
          <Question
            q="Where did the money come from?"
            a="Buyers pay sellers directly for the material. We charge commission on the seller's upside, a premium on the buyer's side and any listing fee — so our income is a fraction of what trades through the platform, and it is meant to be."
            action={<OpenScreen to="/ceo/pnl">Profit &amp; loss</OpenScreen>}
          />
          <div className="grid lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2">
              <ChartCard
                title="What we earned, by month"
                sub="Commission the bank has confirmed, plus buyer premium. Twelve months to today — it does not follow the period selector."
                aria={`Money earned each month for twelve months, ending ${income[income.length - 1]?.label} at ${inr(income[income.length - 1]?.value ?? 0)}.`}
                empty={income.every((d) => d.value === 0)}
                emptyText="Nothing has been earned in the last twelve months — no commission has reached the bank and no delivery order has been paid."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={income} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ceoIncomeFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--ember)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--ember)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="label" tick={TICK} {...AXIS} />
                    <YAxis tick={TICK} width={64} tickFormatter={(v: number) => inrCompact(v)} {...AXIS} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      cursor={{ stroke: 'var(--line-strong)' }}
                      formatter={(v) => [inr(Number(v)), 'Money we earned']}
                    />
                    <Area type="monotone" dataKey="value" stroke="var(--ember)" strokeWidth={2} fill="url(#ceoIncomeFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* --------------------- profit & loss snapshot ------------------ */}
            <div className="card p-4 sm:p-5 flex flex-col">
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Financial snapshot · {label}</div>
              <div className="divide-y divide-line mt-2">
                <LedgerRow label="Money we earned" amount={books.income} />
                <LedgerRow label="Money we spent" amount={books.costs} negative />
                <LedgerRow label="Profit" amount={books.netProfit} tone="profit" bold />
                <LedgerRow label="Earned but not received" amount={books.commissionOwed}
                  hint="commission sellers still owe us" />
                <LedgerRow label="Held for customers" amount={risk.emdHeld} tone="held"
                  hint="deposits — a liability, never profit" />
                <LedgerRow label="Profit this financial year" amount={year.netProfit} tone="profit"
                  hint="1 April to today" />
              </div>
              <div className="pt-3 mt-3 border-t border-line">
                <ShareBar parts={[
                  { label: 'Seller commission', amount: books.commissionEarned, className: 'bg-ember' },
                  { label: 'Buyer premium', amount: books.buyerPremium, className: 'bg-steel' },
                  { label: 'Listing fees', amount: books.listingFees, className: 'bg-success' },
                ]} />
              </div>
              <div className="mt-4 pt-3 border-t border-line">
                <OpenScreen to="/ceo/pnl">View detailed profit &amp; loss</OpenScreen>
              </div>
            </div>
          </div>

          {/* ══════ Did the sales work? ═══════════════════════════════════════ */}
          <Question
            q="How did the auctions perform?"
            a="Not how big the sales were — whether they worked. A sale that clears everything with one bidder per lot is a private sale with extra steps, and the price shows it."
            action={<OpenScreen to="/ceo/auctions">Auction performance</OpenScreen>}
          />
          <div className="grid lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2">
              <ChartCard
                title="Lots sold against lots offered"
                sub={`The ${auctionBars.length === 1 ? 'auction' : `last ${num(auctionBars.length)} auctions`} that closed ${label}, oldest first. The pale part of each bar is what nobody bought.`}
                aria={`Lots sold and unsold across ${num(auctionBars.length)} closed auctions. ${num(auctions.totals.soldLots)} of ${num(auctions.totals.totalLots)} lots sold overall.`}
                empty={auctionBars.length === 0}
                emptyText={`No auction closed ${label}.`}
                legend={
                  <>
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted">
                      <span className="size-2 rounded-full bg-success" aria-hidden /> Sold
                      <span className="num font-semibold text-ink">{num(auctions.totals.soldLots)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted">
                      <span className="size-2 rounded-full bg-line-strong" aria-hidden /> Unsold
                      <span className="num font-semibold text-ink">{num(auctions.totals.totalLots - auctions.totals.soldLots)}</span>
                    </span>
                  </>
                }
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={auctionBars} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="name" tick={TICK} {...AXIS} />
                    <YAxis tick={TICK} width={36} allowDecimals={false} {...AXIS} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      cursor={{ fill: 'var(--surface-2)' }}
                      formatter={(v, key) => [num(Number(v)), key === 'sold' ? 'Lots sold' : 'Lots unsold']}
                      labelFormatter={(l) => auctionBars.find((b) => b.name === l)?.title ?? String(l ?? '')}
                    />
                    <Bar dataKey="sold" stackId="lots" fill="var(--success)" maxBarSize={48} />
                    <Bar dataKey="unsold" stackId="lots" fill="var(--line-strong)" radius={[6, 6, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div className="card p-4 sm:p-5 flex flex-col">
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Was there real competition?</div>
              <div className="divide-y divide-line mt-2 flex-1">
                {[
                  { k: 'Sell-through', v: `${sellThrough.toFixed(0)}%`, t: delta(sellThrough, prevSellThrough) },
                  { k: 'Average price over reserve', v: `${c.avgUplift.toFixed(1)}%`, t: period === 'all' ? undefined : delta(c.avgUplift, p.avgUplift) },
                  { k: 'Bids per lot sold', v: auctions.totals.bidsPerLot.toFixed(1) },
                  { k: 'Bidders per auction', v: auctions.totals.biddersPerAuction.toFixed(1) },
                  { k: 'Auctions closed', v: num(auctions.totals.auctions) },
                  { k: 'Total realisation', v: inrCompact(auctions.totals.realisation) },
                ].map((r) => (
                  <div key={r.k} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-[13px] text-ink">{r.k}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      {r.t !== undefined && <Trend value={r.t} />}
                      <span className="num text-[13px] font-bold tabular-nums">{r.v}</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-3 mt-1 border-t border-line">
                <Chip tone={auctions.live.length ? 'ember' : 'neutral'} pulse={auctions.live.length > 0}>
                  {num(auctions.live.length)} live now
                </Chip>
                <Chip tone="steel">{num(auctions.upcoming.length)} scheduled</Chip>
                {auctions.totals.voids + auctions.totals.cancellations > 0 && (
                  <Chip tone="warning">{num(auctions.totals.voids + auctions.totals.cancellations)} interventions</Chip>
                )}
              </div>
            </div>
          </div>

          {/* ══════ Is it growing? ════════════════════════════════════════════ */}
          <Question
            q="Is the business growing?"
            a="Profit says whether the period worked. Growth says whether the thing that produced it is getting bigger — a good month on a shrinking buyer base is a warning, not a result."
            action={<OpenScreen to="/ceo/growth">Business growth</OpenScreen>}
          />
          <div className="grid lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2">
              <TrendBars
                points={growth.trend}
                title="Value of material sold, by month"
                sub="Every lot that closed with a winning price, at that price. This is trade carried, not our income."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Lots sold', value: num(c.lotsSold), trend: delta(c.lotsSold, p.lotsSold), sub: `of ${num(c.lotsOffered)} offered` },
                { label: 'New customers', value: num(c.newCustomers), trend: delta(c.newCustomers, p.newCustomers), sub: 'first period with us' },
                { label: 'Bids placed', value: num(c.bids), trend: delta(c.bids, p.bids), sub: 'across every lot' },
                { label: 'Came back', value: `${c.activeBuyers > 0 ? ((c.repeatBuyers / c.activeBuyers) * 100).toFixed(0) : 0}%`, sub: `${num(c.repeatBuyers)} of ${num(c.activeBuyers)} buyers` },
              ].map((m) => (
                <Link key={m.label} to="/ceo/growth" className="card card-hover p-4 block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{m.label}</div>
                  <div className="num text-2xl font-bold tabular-nums mt-1">{m.value}</div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {m.trend !== undefined && period !== 'all' && <Trend value={m.trend} />}
                    <span className="text-[12px] text-ink-muted">{m.sub}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* ══════ What is exposed? ══════════════════════════════════════════ */}
          <Question
            q="How much money is exposed?"
            a="Four different kinds of money, never added into one total — a deposit we hold, a debt owed to us, a payment in transit and an amount somebody is contesting are not the same thing, and a single figure across them would mean nothing."
            action={<OpenScreen to="/ceo/risk">Money at risk</OpenScreen>}
          />
          <div className="grid lg:grid-cols-3 gap-3">
            <div className="grid grid-cols-2 gap-3 content-start">
              <Kpi label="Held for customers" value={inrCompact(risk.emdHeld)} tone="held"
                sub="deposits, a liability" to="/ceo/risk" icon={Landmark} />
              <Kpi label="Owed to us" value={inrCompact(risk.owedToUs)} tone="risk"
                sub={`${num(risk.owedByBuyers.length + risk.owedBySellers.length)} open items`} to="/ceo/risk" icon={ShieldAlert} />
              <Kpi label="In transit" value={inrCompact(risk.inTransit)}
                sub="somebody is waiting on it" to="/ceo/risk" icon={BadgeIndianRupee} />
              <Kpi label="In dispute" value={inrCompact(risk.disputed)}
                sub={`${num(risk.openDisputes.length)} open ticket${risk.openDisputes.length === 1 ? '' : 's'}`} to="/ceo/issues" icon={MessageSquareWarning} />
            </div>
            <div className="lg:col-span-2">
              <ChartCard
                title="The shape of what we are owed"
                sub="The same money as the tile beside it, grouped by how old the debt is rather than by who owes it. A debt's age is what tells you whether it is a debt or a loss."
                aria={`Money owed to us by age. ${risk.buckets.map((b) => `${b.bucket} days ${inrCompact(b.buyers + b.sellers)}`).join(', ')}.`}
                empty={risk.owedToUs === 0}
                emptyText="Nothing is owed to us — every buyer has paid and every closed auction has settled."
                height={230}
                legend={
                  <>
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted">
                      <span className="size-2 rounded-full bg-warning" aria-hidden /> Buyers who won and have not paid
                      <span className="num font-semibold text-ink">{inrCompact(risk.owedByBuyers.reduce((s, r) => s + r.amount, 0))}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted">
                      <span className="size-2 rounded-full bg-steel" aria-hidden /> Commission not yet received
                      <span className="num font-semibold text-ink">{inrCompact(risk.owedBySellers.reduce((s, r) => s + r.amount, 0))}</span>
                    </span>
                  </>
                }
              >
                <ResponsiveContainer width="100%" height="100%">
                  {/* The right margin keeps the last money tick inside the card,
                      and the axis width holds "16–30 days" on one line. */}
                  <BarChart data={ageingBars} layout="vertical" margin={{ top: 4, right: 32, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
                    <XAxis type="number" tick={TICK} tickFormatter={(v: number) => inrCompact(v)} {...AXIS} />
                    <YAxis type="category" dataKey="name" tick={TICK} width={92} {...AXIS} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      cursor={{ fill: 'var(--surface-2)' }}
                      formatter={(v, key) => [inr(Number(v)), key === 'buyers' ? 'Buyers who have not paid' : 'Commission not yet received']}
                    />
                    <Bar dataKey="buyers" stackId="age" fill="var(--warning)" maxBarSize={28} />
                    <Bar dataKey="sellers" stackId="age" fill="var(--steel)" radius={[0, 6, 6, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </div>

          {/* ══════ Which materials carry the business? ═══════════════════════ */}
          <Question
            q="Which materials are carrying the business?"
            a="What earned us the most commission, beside what actually traded. They are not the same list: a material can move enormous value and earn us very little if it clears close to the seller's reserve."
            action={<OpenScreen to="/ceo/pnl">Profit &amp; loss</OpenScreen>}
          />
          <div className="grid md:grid-cols-3 gap-3">
            <Ranked
              title="Which materials earned most"
              rows={commissionByCategory.slice(0, 5)}
              empty="No seller has accepted a price yet, so nothing has earned a commission."
            />
            <Ranked
              title="What sold, by material"
              rows={growth.byCategory.slice(0, 5)}
              empty={`Nothing sold ${label}.`}
            />
            <Ranked
              title="Where it sold, by region"
              rows={growth.byRegion.slice(0, 5)}
              empty={`No auction closed ${label}.`}
            />
          </div>

          {/* ══════ Level 3 — what went wrong ═════════════════════════════════ */}
          <Question
            q="What went wrong?"
            a="Every failure across every desk, in one place. One bad week looks like noise from any single desk and like a pattern from here."
            action={<OpenScreen to="/ceo/issues">View all issues</OpenScreen>}
          />
          {incidents.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 size={32} strokeWidth={1.5} />}
              title={`Nothing went wrong ${label}`}
              body="No deposit forfeited, no payment bounced, no bid questioned and nobody left waiting. Widen the period for the longer view."
            />
          ) : (
            <div className="grid lg:grid-cols-3 gap-3">
              <div className="grid grid-cols-3 lg:grid-cols-1 gap-3 content-start">
                {([
                  { k: 'critical', label: 'Serious', tone: 'risk' as Tone, sub: 'a customer lost money, or a sale was interfered with' },
                  { k: 'warning', label: 'Worth watching', tone: 'plain' as Tone, sub: 'fine alone, a pattern if it repeats' },
                  { k: 'note', label: 'For the record', tone: 'plain' as Tone, sub: 'deliberate and controlled — counted, not a mistake' },
                ]).map((s) => {
                  const n = incidents.filter((i) => i.severity === s.k).length
                  return (
                    <Link key={s.k} to="/ceo/issues" className="card card-hover p-4 block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{s.label}</div>
                      <div className={cx('num text-2xl font-bold tabular-nums mt-1', n > 0 ? TONE_VALUE[s.tone] : 'text-ink-faint')}>{num(n)}</div>
                      <p className="text-[12px] text-ink-muted mt-1 leading-snug hidden lg:block">{s.sub}</p>
                    </Link>
                  )
                })}
              </div>
              <div className="lg:col-span-2 card divide-y divide-line overflow-hidden">
                {incidents.slice(0, 5).map((i) => (
                  <Link key={i.id} to={i.to} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2 transition-colors">
                    <span className={cx('size-8 rounded-xl grid place-items-center shrink-0 mt-0.5',
                      i.severity === 'critical' ? 'bg-danger-soft text-danger'
                        : i.severity === 'warning' ? 'bg-warning-soft text-warning' : 'bg-surface-2 text-ink-muted')}>
                      <AlertTriangle size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-semibold">{i.title}</span>
                        <Chip tone={i.severity === 'critical' ? 'danger' : i.severity === 'warning' ? 'warning' : 'neutral'}>
                          {i.severity === 'critical' ? 'Serious' : i.severity === 'warning' ? 'Worth watching' : 'For the record'}
                        </Chip>
                      </div>
                      <div className="text-[11px] text-ink-faint mt-0.5">{relTime(i.at, books.now)}</div>
                    </div>
                    {i.amount != null && i.amount > 0 && (
                      <span className="num text-[13px] font-bold tabular-nums shrink-0 self-center hidden sm:block">{inr(i.amount)}</span>
                    )}
                  </Link>
                ))}
                {incidents.length > 5 && (
                  <div className="px-4 py-3 bg-surface-2/40">
                    <OpenScreen to="/ceo/issues">
                      {num(incidents.length - 5)} more {incidents.length - 5 === 1 ? 'event' : 'events'}
                    </OpenScreen>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════ The reference shelf ═══════════════════════════════════════ */}
          <Question
            q="Take it away with you"
            a="Each pack is the same figures as the screen it came from, written to a file. Nothing is recomputed for an export."
            action={<OpenScreen to="/ceo/reports">All reports</OpenScreen>}
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Profit and loss', sub: inr(books.netProfit), to: '/ceo/pnl' },
              { label: 'Business growth', sub: inrCompact(c.salesValue), to: '/ceo/growth' },
              { label: 'Auction performance', sub: `${sellThrough.toFixed(0)}% sell-through`, to: '/ceo/auctions' },
              { label: 'Money at risk', sub: inrCompact(risk.owedToUs), to: '/ceo/risk' },
            ].map((r) => (
              <Link key={r.label} to="/ceo/reports" className="card card-hover p-4 flex items-start gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember">
                <FileSpreadsheet size={15} className="text-ink-faint shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold truncate">{r.label}</div>
                  <div className="num text-[12px] text-ink-muted mt-0.5">{r.sub}</div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-8">
            <NotMyDecision>
              Nothing on this page is yours to press, and that is deliberate — it is a reading of six screens, each of
              which belongs to a desk that works it. The one exception is your signature queue: {queue.open.length > 0
                ? <>{num(queue.open.length)} decision{queue.open.length === 1 ? ' is' : 's are'} waiting on you and nothing they propose has taken effect until you sign.</>
                : <>it is clear, so every desk is working inside its own authority right now.</>}{' '}
              Every figure above is the same arithmetic as the screen it links to — commission at {books.cfg.sellerCommissionPct}%,
              buyer premium at {books.cfg.buyerPremiumPct}% — and Finance can open any of them down to the individual
              payment behind it.
            </NotMyDecision>
          </div>
        </>
      )}
    </Page>
  )
}
