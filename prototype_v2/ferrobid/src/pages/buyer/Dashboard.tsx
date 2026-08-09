/* Buyer home — an action feed. Whatever needs doing next is highest on the
   page: a live, fully-funded auction pins to the top with one tap into its
   bidding room; everything else queues below in EMD fund-by order. */
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Bell, CheckCircle2, Clock, Gavel, Lock, Truck, UserRound } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, Countdown, EmptyState, PageHeader, Stat, StatusChip, cx } from '../../components/ui'
import { EmdReminderBanner } from '../../components/EmdReminder'
import { useBidroomGate } from '../../components/BidroomGate'
import { useStore, selectionSummary, catalogueUiStatus } from '../../store/store'
import { emdDeadlineMs, emdWindowClosed } from '../../lib/emd'
import { countdown, inr, inrCompact, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type { Catalogue } from '../../types'

/** The buyer's journey into any one auction, in order. */
const STAGES = ['Shortlisted', 'Fund EMD', 'Waiting', 'Bidroom'] as const

type Row = {
  cat: Catalogue
  summary: ReturnType<typeof selectionSummary>
  ui: ReturnType<typeof catalogueUiStatus>
  stage: number
  deadline: number
  emdClosed: boolean
}

export default function Dashboard() {
  const me = useStore((s) => s.currentUser)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const bids = useStore((s) => s.bids)
  const wallets = useStore((s) => s.wallets)
  const selections = useStore((s) => s.selections)
  const notifications = useStore((s) => s.notifications)
  const deliveryOrders = useStore((s) => s.deliveryOrders)
  const { enterBidroom } = useBidroomGate()
  const now = useNow()

  if (!me) {
    return (
      <Page>
        <EmptyState
          icon={<UserRound size={32} strokeWidth={1.5} />}
          title="Sign in to see your buyer dashboard"
          body="Your wallet, shortlists, live bids and delivery orders appear here once you sign in."
          action={<Link to="/login"><Button>Sign in</Button></Link>}
        />
      </Page>
    )
  }

  const wallet = wallets.find((w) => w.userId === me.id)
  const lotById = new Map(lots.map((l) => [l.id, l]))

  // Active bids: my valid bids on live lots, deduped by lot
  const myValidBids = bids.filter((b) => b.bidderId === me.id && b.status === 'valid')
  const activeLots = [...new Set(myValidBids.map((b) => b.lotId))]
    .map((id) => lotById.get(id))
    .filter((l): l is NonNullable<typeof l> => !!l && l.status === 'live')
  const leadingCount = activeLots.filter((l) => l.leadingBidderId === me.id).length
  const outbidLots = activeLots.filter((l) => l.leadingBidderId !== me.id)

  const wonLots = lots.filter((l) => l.status === 'sold' && l.leadingBidderId === me.id)
  const wonValue = wonLots.reduce((sum, l) => sum + (l.resultH1Rate ?? l.currentRate ?? 0) * l.indicativeQty, 0)

  const pendingDos = deliveryOrders.filter((d) => d.buyerId === me.id && d.stage === 'payment_pending')

  /* ------------------- every catalogue I have a stake in -------------------
     The EMD shortfall figure below used to read a single hardcoded catalogue.
     It aggregates across all of them now, so funding any shortlist moves it. */
  const rows: Row[] = catalogues
    .filter((c) => c.status === 'live' || c.status === 'upcoming')
    .map((cat) => {
      const summary = selectionSummary({ selections, lots }, me.id, cat.id)
      const ui = catalogueUiStatus(cat, now, lots.filter((l) => l.catalogueId === cat.id))
      const stage = summary.shortfall > 0 ? 1 : cat.status === 'upcoming' ? 2 : 3
      return { cat, summary, ui, stage, deadline: emdDeadlineMs(cat), emdClosed: emdWindowClosed(cat, now) }
    })
    .filter((r) => r.summary.count > 0)

  const totalShortfall = rows.reduce((sum, r) => sum + r.summary.shortfall, 0)
  const shortfallRows = rows.filter((r) => r.summary.shortfall > 0)

  // Ready to bid right now — pinned. Everything else queues by EMD urgency.
  const pinned = rows.filter((r) => r.cat.status === 'live' && r.summary.shortfall === 0)
  const queued = rows
    .filter((r) => !pinned.includes(r))
    .sort((a, b) => a.deadline - b.deadline)

  const myNotifs = notifications.filter((n) => n.userId === me.id || n.userId === null).slice(0, 5)

  const attentionCount = (totalShortfall > 0 ? 1 : 0) + (outbidLots.length > 0 ? 1 : 0) + (pendingDos.length > 0 ? 1 : 0)

  return (
    <Page>
      <PageHeader
        title={`Namaste, ${me.name.split(' ')[0]}`}
        sub={`${me.firm} · ${me.city}. Here's where your money and bids stand right now.`}
        actions={<Link to="/buyermarketplace"><Button variant="steel">Browse auctions</Button></Link>}
      />

      <EmdReminderBanner className="mb-5" />

      {/* ------------------------------ Stat row ----------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Wallet balance" value={inr(wallet?.balance ?? 0)} sub={<Link to="/buyer/wallet" className="text-steel hover:underline">View ledger →</Link>} />
        <Stat label="EMD locked" value={inr(wallet?.emdLocked ?? 0)} tone="steel" sub="Auto-released if you don't win" />
        <Stat
          label="Active Auctions"
          to="/buyer/bids?tab=active"
          value={activeLots.length}
          tone={outbidLots.length > 0 ? 'warning' : 'ember'}
          sub={activeLots.length > 0 ? `${leadingCount} leading · ${outbidLots.length} outbid` : 'No live bids yet'}
        />
        <Stat label="Lots won" value={wonLots.length} tone="success" sub={wonLots.length > 0 ? `Worth ${inrCompact(wonValue)} all-time` : 'All time'} />
      </div>

      {/* ---------------------------- Action feed ---------------------------- */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-bold">Your auctions</h2>
          <Link to="/buyer/shortlist" className="text-sm font-semibold text-steel hover:underline">Shortlist & EMD →</Link>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="Nothing on your shortlist yet"
            body="Shortlist lots in a catalogue and it appears here — funded, waiting, or ready to bid."
            action={<Link to="/buyermarketplace"><Button variant="secondary">Browse auctions</Button></Link>}
          />
        ) : (
          <div className="space-y-3">
            {pinned.map((r) => (
              <PinnedAuction key={r.cat.id} row={r} onEnter={() => enterBidroom(r.cat.id)} />
            ))}
            {queued.map((r) => (
              <QueuedAuction key={r.cat.id} row={r} now={now} onAct={() => enterBidroom(r.cat.id)} />
            ))}
          </div>
        )}
      </section>

      {/* ------------------------- Needs your attention ----------------------- */}
      <section className="mt-8">
        <h2 className="font-display text-lg font-bold mb-3">Needs your attention</h2>
        {attentionCount === 0 ? (
          <div className="card p-4 flex items-center gap-3 text-sm text-ink-muted">
            <CheckCircle2 size={18} className="text-success shrink-0" />
            All clear — EMDs funded, no outbid lots, no pending payments.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {totalShortfall > 0 && (
              <div className="card p-4 border-l-4 border-l-warning flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-warning" />
                  <span className="font-semibold text-sm">EMD shortfall on your shortlist</span>
                </div>
                <p className="text-sm text-ink-muted">
                  {shortfallRows.reduce((n, r) => n + r.summary.unfundedLotIds.length, 0)} shortlisted lots across{' '}
                  <span className="num font-semibold text-ink">{shortfallRows.length}</span>{' '}
                  {shortfallRows.length === 1 ? 'catalogue' : 'catalogues'} ({shortfallRows.map((r) => r.cat.code).join(', ')}) are not EMD-funded — you can't bid on them until funded.
                </p>
                <div className="num text-xl font-bold text-warning">{inr(totalShortfall)}</div>
                <Link to="/buyer/shortlist" className="mt-auto">
                  <Button size="sm" className="w-full">Fund now</Button>
                </Link>
              </div>
            )}
            {outbidLots.length > 0 && (
              <div className="card p-4 border-l-4 border-l-danger flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Gavel size={16} className="text-danger" />
                  <span className="font-semibold text-sm">You've been outbid</span>
                  <Chip tone="danger" pulse>{outbidLots.length} lot{outbidLots.length > 1 ? 's' : ''}</Chip>
                </div>
                <div className="flex flex-col gap-2">
                  {outbidLots.slice(0, 3).map((l) => (
                    <div key={l.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0">
                        <span className="num font-semibold">{l.lotNo}</span>
                        <span className="text-ink-muted"> · H1 <span className="num">{inr(l.currentRate ?? l.startRate)}/{l.uom}</span></span>
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <Countdown endsAt={l.endsAt} size="sm" />
                        <Button size="sm" variant="danger" onClick={() => enterBidroom(l.catalogueId, { lotId: l.id })}>Rebid</Button>
                      </span>
                    </div>
                  ))}
                  {outbidLots.length > 3 && (
                    <Link to="/buyer/bids" className="text-xs text-steel hover:underline">+{outbidLots.length - 3} more in My bids →</Link>
                  )}
                </div>
              </div>
            )}
            {pendingDos.length > 0 && (
              <div className="card p-4 border-l-4 border-l-ember flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Truck size={16} className="text-ember" />
                  <span className="font-semibold text-sm">Payment pending on won lots</span>
                </div>
                <p className="text-sm text-ink-muted">
                  {pendingDos.length} delivery order{pendingDos.length > 1 ? 's' : ''} awaiting balance payment. Delivery order is issued only after full settlement.
                </p>
                <div className="num text-xl font-bold">
                  {inr(pendingDos.reduce((sum, d) => sum + d.materialValue + d.gstAmount + d.tcsAmount - d.paidAmount, 0))}
                </div>
                <Link to="/buyer/fulfilment" className="mt-auto">
                  <Button size="sm" variant="secondary" className="w-full">Go to fulfilment <ArrowRight size={14} /></Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </section>

      {/* --------------------------- Notifications ---------------------------- */}
      <section className="mt-8">
        <div className="flex items-center gap-2 mb-3">
          <Bell size={16} className="text-ink-muted" />
          <h2 className="font-display text-lg font-bold">Recent notifications</h2>
        </div>
        {myNotifs.length === 0 ? (
          <div className="card p-4 text-sm text-ink-muted">Nothing yet — bid activity, EMD locks and wins will show up here.</div>
        ) : (
          <div className="card divide-y divide-line">
            {myNotifs.map((n) => {
              const inner = (
                <div className="flex items-start gap-3 p-3.5">
                  {!n.read && <span className="size-2 rounded-full bg-ember mt-1.5 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{n.title}</div>
                    <div className="text-xs text-ink-muted mt-0.5 line-clamp-2">{n.body}</div>
                  </div>
                  <span className="text-xs text-ink-faint whitespace-nowrap">{relTime(n.at, now)}</span>
                </div>
              )
              return n.href
                ? <Link key={n.id} to={n.href} className="block hover:bg-surface-2 transition-colors">{inner}</Link>
                : <div key={n.id}>{inner}</div>
            })}
          </div>
        )}
      </section>
    </Page>
  )
}

/* ------------------------ live + funded → one tap in ----------------------- */
function PinnedAuction({ row, onEnter }: { row: Row; onEnter: () => void }) {
  const { cat, summary, ui } = row
  return (
    <div className="card p-5 border-l-4 border-l-ember bg-ember-soft/25">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusChip status={ui} />
            <span className="num text-[11px] font-bold text-ink-faint">{cat.code}</span>
            <Chip tone="success">EMD funded · ready to bid</Chip>
          </div>
          <Link to={`/catalogue/${cat.id}`} className="block font-display text-lg font-bold mt-1.5 hover:text-ember transition-colors">
            {cat.title}
          </Link>
          <div className="text-sm text-ink-muted mt-1">
            <span className="num font-semibold text-ink">{summary.count}</span> shortlisted lot{summary.count > 1 ? 's' : ''} ·{' '}
            EMD locked <span className="num font-semibold text-ink">{inr(summary.funded)}</span>
          </div>
          <StageTrack current={3} className="mt-3" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <Countdown endsAt={cat.endsAt} prefix="closes in" size="lg" />
          <Button size="lg" onClick={onEnter}><Gavel size={16} /> Enter bidroom</Button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- everything else, in EMD fund-by order -------------------- */
function QueuedAuction({ row, now, onAct }: { row: Row; now: number; onAct: () => void }) {
  const { cat, summary, ui, stage, deadline, emdClosed } = row
  const msLeft = deadline - now
  return (
    <div className="card p-4 flex flex-wrap items-start gap-4">
      <div className="min-w-0 flex-1 basis-72">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusChip status={ui} />
          <span className="num text-[11px] font-bold text-ink-faint">{cat.code}</span>
          {summary.shortfall > 0
            ? <Chip tone="warning">EMD pending {inr(summary.shortfall)}</Chip>
            : <Chip tone="success">EMD funded</Chip>}
        </div>
        <Link to={`/catalogue/${cat.id}`} className="block font-semibold mt-1.5 hover:text-ember transition-colors line-clamp-1">
          {cat.title}
        </Link>
        <div className="text-xs text-ink-muted mt-0.5">
          <span className="num font-semibold text-ink">{summary.count}</span> shortlisted ·{' '}
          <span className="num">{summary.unfundedLotIds.length}</span> awaiting EMD
        </div>
        <StageTrack current={stage} className="mt-3" />
      </div>

      <div className="flex flex-col items-end gap-2 ml-auto">
        {/* The fund-by clock only means something before go-live; once an
            auction is running, what matters is when it closes. */}
        {emdClosed ? (
          <Chip tone="danger">EMD deadline passed</Chip>
        ) : cat.status === 'upcoming' && summary.shortfall > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-warning num whitespace-nowrap">
            <Clock size={13} /> {countdown(msLeft)} to fund EMD
          </span>
        ) : cat.status === 'upcoming' ? (
          <Chip tone="steel" className="num">starts {relTime(cat.startsAt, now)}</Chip>
        ) : (
          <Countdown endsAt={cat.endsAt} prefix="closes in" size="sm" />
        )}

        {emdClosed ? (
          // Opens the same gate, which explains when the cut-off was and why
          // this auction can no longer be joined.
          <Button size="sm" variant="secondary" onClick={onAct}>EMD closed — details</Button>
        ) : summary.shortfall > 0 ? (
          <Button size="sm" onClick={onAct}><Lock size={14} /> Fund {inr(summary.shortfall)} EMD</Button>
        ) : cat.status === 'upcoming' ? (
          <Link to={`/catalogue/${cat.id}`}><Button size="sm" variant="secondary">View catalogue</Button></Link>
        ) : (
          <Button size="sm" onClick={onAct}><Gavel size={14} /> Enter bidroom</Button>
        )}
      </div>
    </div>
  )
}

/* ---- Shortlisted → Fund EMD → Waiting → Bidroom, current step lit up ------ */
function StageTrack({ current, className }: { current: number; className?: string }) {
  return (
    <ol className={cx('flex flex-wrap items-center gap-x-1.5 gap-y-1', className)}>
      {STAGES.map((label, i) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className={cx(
            'inline-flex items-center gap-1 h-6 px-2 rounded-lg text-[11px] font-bold border whitespace-nowrap',
            i === current
              ? 'bg-ember text-white border-transparent'
              : i < current
                ? 'bg-success-soft text-success border-success/25'
                : 'bg-surface-2 text-ink-faint border-line',
          )}>
            {i < current && <CheckCircle2 size={11} />}
            {label}
          </span>
          {i < STAGES.length - 1 && <span className="w-3 h-px bg-line-strong" aria-hidden />}
        </li>
      ))}
    </ol>
  )
}
