/* ---------------------------------------------------------------------------
   Auction Manager — dashboard.

   Answers two questions and nothing else: is anything wrong, and what needs me
   today. Every row routes to the screen where the thing is actually resolved;
   nothing is edited here. The figures on this page exist across three other
   screens today and have never appeared together, which is the whole reason it
   is worth a screen of its own.
--------------------------------------------------------------------------- */
import { Link } from 'react-router-dom'
import {
  ArrowRight, CheckCircle2, Flag, Gavel, Radio, Send, ShieldQuestion, Timer, Upload, Users, Zap,
} from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Chip, Countdown, EmptyState, PageHeader, Stat, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { inrCompact, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import { AuctionIdentity, PausedOverlay, SectionTitle, isAwaitingPublish, useAuctionRows } from './shared'

/* --------------------------- the sale-day strip ---------------------------- */
/** The five states an auction passes through on this desk, as one band. It is
 *  the fastest read on the page: where the work is bunched up right now. */
function FloorStrip({ steps }: { steps: { label: string; count: number; to: string; urgent?: boolean }[] }) {
  return (
    <div className="card overflow-hidden mb-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-line">
        {steps.map((s) => (
          <Link key={s.label} to={s.to}
            className={cx('group px-4 py-3.5 transition-colors hover:bg-surface-2 relative',
              s.urgent && s.count > 0 && 'bg-warning-soft/50 hover:bg-warning-soft')}>
            <div className="flex items-baseline gap-2">
              <span className={cx('num text-2xl font-bold tabular-nums',
                s.count === 0 ? 'text-ink-faint' : s.urgent ? 'text-warning' : 'text-ink')}>
                {s.count}
              </span>
              <ArrowRight size={13} className="text-ink-faint opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint mt-1 leading-tight">{s.label}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------- work rows --------------------------------- */
function WorkRow({ icon, tone, title, body, meta, to, cta }: {
  icon: React.ReactNode
  tone: 'danger' | 'warning' | 'steel' | 'success'
  title: React.ReactNode
  body: React.ReactNode
  meta?: React.ReactNode
  to: string
  cta: string
}) {
  const toneCls = {
    danger: 'bg-danger-soft text-danger',
    warning: 'bg-warning-soft text-warning',
    steel: 'bg-steel-soft text-steel',
    success: 'bg-success-soft text-success',
  }[tone]
  return (
    <Link to={to} className="group flex items-start gap-3.5 px-4 py-3.5 hover:bg-surface-2 transition-colors">
      <span className={cx('size-9 rounded-xl grid place-items-center shrink-0 mt-0.5', toneCls)}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-sm leading-snug">{title}</span>
        <span className="block text-[13px] text-ink-muted leading-snug mt-0.5">{body}</span>
        {meta && <span className="block text-[11px] text-ink-faint mt-1">{meta}</span>}
      </span>
      <span className="shrink-0 self-center text-[12px] font-bold text-ember opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1">
        {cta} <ArrowRight size={12} />
      </span>
    </Link>
  )
}

export default function AuctionDashboard() {
  const now = useNow()
  const rows = useAuctionRows()
  const users = useStore((s) => s.users)
  const exemptions = useStore((s) => s.emdExemptionRequests)
  const voidRequests = useStore((s) => s.bidVoidRequests)
  const lots = useStore((s) => s.lots)

  const live = rows.filter((r) => r.ui === 'live' || r.ui === 'closing')
  const scheduled = rows.filter((r) => r.ui === 'upcoming')
  const readyToPublish = rows.filter(isAwaitingPublish)
  const closingWithinHour = live.filter((r) => Date.parse(r.cat.endsAt) - now < 3600_000)
  const awaitingConfirmation = rows.filter((r) => r.cat.status === 'closed' && !r.resultsConfirmed && r.lots.length > 0)

  const pendingExemptions = exemptions.filter((r) => r.status === 'pending')
  const openFlags = voidRequests.filter((r) => r.status === 'pending')

  const lotsLiveNow = live.reduce((s, r) => s + r.liveLots.length, 0)
  const bidsLastHour = live.reduce((s, r) => s + r.bidsLastHour, 0)
  const activeBidders = new Set(live.flatMap((r) => r.bids.map((b) => b.bidderId))).size
  const extensionsToday = rows.reduce((s, r) => s + r.extensions, 0)

  const firm = (id: string) => users.find((u) => u.id === id)?.firm ?? 'Unknown firm'
  const lotNo = (id: string) => lots.find((l) => l.id === id)?.lotNo ?? id

  const attention = [
    ...readyToPublish.map((r) => ({
      key: `pub-${r.cat.id}`, weight: 2,
      icon: <Upload size={16} />, tone: 'steel' as const,
      title: <>{r.cat.code} is ready to go to market</>,
      body: `${r.lots.length} lots assembled by Operations, ${inrCompact(r.reserveValue)} at reserve. Nothing is public until it is published.`,
      meta: `${r.seller?.firm ?? 'Unknown seller'} · ${r.cat.yardName}`,
      to: '/auction/schedule', cta: 'Publish',
    })),
    ...pendingExemptions.map((r) => {
      const cat = rows.find((x) => x.cat.id === r.catalogueId)
      return {
        key: `emd-${r.id}`, weight: 1,
        icon: <ShieldQuestion size={16} />, tone: 'warning' as const,
        title: <>{firm(r.buyerId)} missed the EMD deadline on {cat?.cat.code ?? 'an auction'}</>,
        body: r.reason,
        meta: `Raised ${relTime(r.createdAt, now)} · a bidder is waiting on this answer`,
        to: '/auction/emd-eligibility', cta: 'Decide',
      }
    }),
    ...openFlags.map((r) => ({
      key: `flag-${r.id}`, weight: r.stage === 'requested' ? 1 : 3,
      icon: <Flag size={16} />, tone: 'danger' as const,
      title: <>{r.reason} on {lotNo(r.lotId)}</>,
      body: r.stage === 'requested'
        ? 'Escalated to the Super Admin as a void request — awaiting their decision.'
        : (r.notes ?? 'Flagged by surveillance for review.'),
      meta: `${r.stage === 'requested' ? 'With Super Admin' : 'Awaiting your review'} · raised ${relTime(r.raisedAt, now)}`,
      to: '/auction/bid-monitor', cta: 'Review',
    })),
    ...awaitingConfirmation.map((r) => ({
      key: `res-${r.cat.id}`, weight: 4,
      icon: <CheckCircle2 size={16} />, tone: 'success' as const,
      title: <>{r.cat.code} closed — results need confirming</>,
      body: `${r.soldLots.length} sold, ${r.staLots.length} below reserve, ${inrCompact(r.realisation)} realised. The seller cannot settle until you confirm.`,
      meta: `Closed ${relTime(r.cat.endsAt, now)}`,
      to: '/auction/results', cta: 'Confirm',
    })),
  ].sort((a, b) => a.weight - b.weight)

  return (
    <Page>
      <PageHeader
        title="Auction desk"
        sub="Everything scheduled, running or waiting on a decision — in the order the day happens."
        actions={
          live.length > 0
            ? <Chip tone="ember" pulse><Radio size={12} /> {num(live.length)} auction{live.length === 1 ? '' : 's'} on the floor</Chip>
            : <Chip tone="neutral">Floor quiet</Chip>
        }
      />

      <FloorStrip steps={[
        { label: 'Ready to publish', count: readyToPublish.length, to: '/auction/schedule', urgent: true },
        { label: 'Scheduled', count: scheduled.length, to: '/auction/schedule' },
        { label: 'Live now', count: live.length, to: '/auction/live' },
        { label: 'Closing within the hour', count: closingWithinHour.length, to: '/auction/live', urgent: true },
        { label: 'Results to confirm', count: awaitingConfirmation.length, to: '/auction/results', urgent: true },
      ]} />

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Stat label="Live auctions" value={num(live.length)} tone={live.length ? 'ember' : undefined} sub="Open to bidding now" to="/auction/live" />
        <Stat label="Lots live" value={num(lotsLiveNow)} sub="Across every open sale" to="/auction/rooms" />
        <Stat label="Bids · last hour" value={num(bidsLastHour)} tone="steel" sub="Valid bids only" to="/auction/bid-monitor" />
        <Stat label="Active bidders" value={num(activeBidders)} sub="Distinct firms bidding" to="/auction/bid-monitor" />
        <Stat label="Anti-snipe extensions" value={num(extensionsToday)} tone={extensionsToday > 0 ? 'warning' : undefined} sub="Automatic, no action needed" to="/auction/reports" />
        <Stat label="Eligibility queue" value={num(pendingExemptions.length)} tone={pendingExemptions.length ? 'warning' : 'success'} sub="Buyers waiting to be let in" to="/auction/emd-eligibility" />
      </div>

      {/* ------------------------- what needs you ------------------------- */}
      <SectionTitle
        title="What needs you"
        count={attention.length}
        sub="Ranked by what costs the business most if it waits. Each row opens where it is resolved."
      />
      {attention.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={32} strokeWidth={1.5} />}
          title="Nothing is waiting on you"
          body="No catalogue to publish, no eligibility request open, no flagged bidding and no results outstanding. Anything new will appear here."
        />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {attention.map((a) => (
            <WorkRow key={a.key} icon={a.icon} tone={a.tone} title={a.title} body={a.body} meta={a.meta} to={a.to} cta={a.cta} />
          ))}
        </div>
      )}

      {/* --------------------------- on the floor -------------------------- */}
      <SectionTitle
        title="On the floor"
        count={live.length}
        sub="Soonest-closing first. Open one to pause, extend or drop into its room."
        action={live.length > 0 ? <Link to="/auction/live" className="text-[13px] font-bold text-ember hover:underline inline-flex items-center gap-1">Live control <ArrowRight size={13} /></Link> : undefined}
      />
      {live.length === 0 ? (
        <EmptyState
          icon={<Gavel size={32} strokeWidth={1.5} />}
          title="No auction is running"
          body={scheduled.length > 0
            ? `${scheduled.length} scheduled sale${scheduled.length === 1 ? '' : 's'} will open automatically at the published time.`
            : 'Publish a catalogue from Schedule & publish to open the floor.'}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {live.map((r, i) => (
            <div key={r.cat.id}
              className={cx('card card-hover p-4 relative overflow-hidden animate-fade-up', r.isPaused && 'border-danger/50')}
              style={{ animationDelay: `${i * 45}ms` }}>
              {r.isPaused && <PausedOverlay />}
              <div className="flex items-start gap-3">
                <AuctionIdentity row={r} to={`/auction/rooms/${r.cat.id}`}>
                  {r.extensions > 0 && <Chip tone="warning" className="num"><Zap size={11} /> {r.extensions}</Chip>}
                </AuctionIdentity>
                <Countdown endsAt={r.cat.endsAt} prefix="closes" />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3.5 pt-3.5 border-t border-line">
                {[
                  { label: 'Lots live', value: `${r.liveLots.length}/${r.lots.length}`, icon: <Gavel size={12} /> },
                  { label: 'Bids · 1h', value: num(r.bidsLastHour), icon: <Timer size={12} /> },
                  { label: 'Bidders', value: num(r.participants), icon: <Users size={12} /> },
                ].map((m) => (
                  <div key={m.label}>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint flex items-center gap-1">{m.icon} {m.label}</div>
                    <div className="num text-base font-bold mt-0.5">{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------------------------- announcements ------------------------ */}
      <SectionTitle
        title="Reaching the floor"
        sub="Notices go to the bidders in one auction, or to everyone."
        action={<Link to="/auction/announcements" className="text-[13px] font-bold text-ember hover:underline inline-flex items-center gap-1"><Send size={13} /> Write a notice</Link>}
      />
      <div className="card p-4 text-[13px] text-ink-muted">
        An extension, a pause and a cancellation each notify their bidders automatically — you only write a notice
        when something needs saying that the system cannot infer.
      </div>
    </Page>
  )
}
