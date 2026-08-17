/* Buyer home — an action feed. Whatever needs doing next is highest on the
   page: a live, fully-funded auction pins to the top with one tap into its
   bidding room; everything else queues below in EMD fund-by order. */
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, Bell, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Gavel, Truck, UserRound,
} from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, Countdown, EmptyState, PageHeader, Stat, cx } from '../../components/ui'
import { EmdReminderBanner } from '../../components/EmdReminder'
import { useBidroomGate } from '../../components/BidroomGate'
import { useStore, selectionSummary, isCatalogueShortlisted, hasApprovedEmdExemption } from '../../store/store'
import { emdDeadlineMs } from '../../lib/emd'
import { inr, inrCompact, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type { Catalogue } from '../../types'

type CalEventTone = 'ember' | 'danger' | 'success' | 'steel'
type CalEvent = {
  date: string
  /** What happens in this block — "Auction closes", "Bid closes". */
  label: string
  tone: CalEventTone
  /** Reference the buyer quotes: catalogue code or lot number. */
  code?: string
  /** Seller and size, or the yard. */
  meta?: string
  tags?: string[]
  to?: string
}

const TONE_TEXT: Record<CalEventTone, string> = {
  ember: 'text-ember', danger: 'text-danger', success: 'text-success', steel: 'text-steel',
}

/** The working band the grid draws. A deadline outside it is pinned to the
    nearest edge row rather than dropped, so nothing falls off the calendar. */
const HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']

/** "Aug 17" / "Monday" — month-first, matching the auction calendar elsewhere
    on the platform. `fmtTime` carries seconds, which a schedule block doesn't. */
const dateLabel = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const weekdayLabel = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long' })
const clockLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
const slotKey = (d: Date, hour: string) => `${dayKey(d)}|${hour}`
const hourOf = (d: Date) => `${String(Math.min(18, Math.max(9, d.getHours()))).padStart(2, '0')}:00`

/** Auction calendar — a week × time-block matrix. Each cell carries a count
    badge for the deadlines that land in that hour; picking one opens the block
    in the side panel. Three days on phones, seven from tablet up. */
function DashboardCalendar({ events }: { events: CalEvent[] }) {
  const now = useNow()
  const [offset, setOffset] = useState(0)
  const [cols, setCols] = useState(() => (typeof window === 'undefined' || window.innerWidth >= 768 ? 7 : 3))
  const [picked, setPicked] = useState<{ key: string; label: string; weekday: string; hour: string } | null>(null)

  useEffect(() => {
    const onResize = () => setCols(window.innerWidth >= 768 ? 7 : 3)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const todayStamp = new Date(now).toDateString()

  const days = useMemo(() => {
    const t = new Date(todayStamp)
    const start = new Date(t.getFullYear(), t.getMonth(), t.getDate() + offset)
    return Array.from({ length: cols }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      return {
        d,
        label: dateLabel(d),
        weekday: weekdayLabel(d),
        isToday: d.toDateString() === todayStamp,
      }
    })
  }, [offset, cols, todayStamp])

  /** Every event bucketed into the hour block it falls in, earliest first. */
  const bySlot = useMemo(() => {
    const m = new Map<string, CalEvent[]>()
    for (const e of [...events].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))) {
      const d = new Date(e.date)
      const k = slotKey(d, hourOf(d))
      const list = m.get(k)
      if (list) list.push(e)
      else m.set(k, [e])
    }
    return m
  }, [events])

  // Default to the first block in view that actually holds something — landing
  // on an empty 11:00 teaches the buyer nothing.
  const fallback = useMemo(() => {
    for (const day of days) {
      for (const h of HOURS) {
        if (bySlot.get(slotKey(day.d, h))?.length) {
          return { key: slotKey(day.d, h), label: day.label, weekday: day.weekday, hour: h }
        }
      }
    }
    const d0 = days[0]
    return { key: slotKey(d0.d, '11:00'), label: d0.label, weekday: d0.weekday, hour: '11:00' }
  }, [days, bySlot])

  const active = picked ?? fallback
  const activeList = bySlot.get(active.key) ?? []

  const go = (step: number) => { setOffset((o) => o + step * cols); setPicked(null) }
  const goToday = () => { setOffset(0); setPicked(null) }

  const first = days[0]
  const last = days[days.length - 1]
  const rangeLabel = `${first.label} - ${last.label}, ${last.d.getFullYear()}`

  return (
    <section className="mt-8">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays size={16} className="text-ink-muted" />
        <h2 className="font-display text-lg font-bold">Calendar</h2>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 lg:gap-8 items-start">
        {/* ------------------------------- matrix ------------------------------ */}
        <div className="card rounded-3xl p-2 overflow-hidden">
          <div className="grid" style={{ gridTemplateColumns: `80px repeat(${cols}, minmax(0,1fr))` }}>
            {/* corner */}
            <div className="bg-surface-2 border-r border-r-line-strong border-b-2 border-b-line" />

            {days.map((day) => (
              <div key={dayKey(day.d)}
                className="relative text-center py-3 px-1 bg-surface-2 border-r border-r-line-strong border-b-2 border-b-line"
                style={day.isToday
                  ? { background: 'linear-gradient(180deg, color-mix(in srgb, var(--ember) 8%, var(--surface-2)) 0%, var(--surface-2) 100%)' }
                  : undefined}>
                {day.isToday && <span className="absolute top-0 left-[10%] right-[10%] h-[3px] bg-ember rounded-b" />}
                <div className="text-[15px] font-extrabold text-ink leading-none">{day.label}</div>
                <div className="text-[11px] font-semibold text-ink-muted uppercase tracking-[0.5px] mt-1">{day.weekday}</div>
              </div>
            ))}

            {HOURS.map((h) => (
              <Fragment key={h}>
                <div className="num text-[11px] font-semibold text-ink-muted flex items-center justify-end px-3 bg-surface-2/40 border-r border-r-line-strong border-b border-b-line-strong">
                  {h}
                </div>
                {days.map((day) => {
                  const k = slotKey(day.d, h)
                  const list = bySlot.get(k) ?? []
                  const has = list.length > 0
                  const isSel = active.key === k && active.hour === h
                  return (
                    <button key={k} type="button" disabled={!has}
                      aria-label={has ? `${list.length} on ${day.label} at ${h}` : undefined}
                      onClick={() => setPicked({ key: k, label: day.label, weekday: day.weekday, hour: h })}
                      className={cx('h-[38px] flex items-center justify-center border-r border-r-line-strong border-b border-b-line-strong transition-colors',
                        has ? 'cursor-pointer hover:bg-ember-soft/60' : 'cursor-default',
                        isSel && 'rounded-lg ring-1 ring-ember/25 relative z-[5]')}
                      style={isSel
                        ? { background: 'radial-gradient(circle, color-mix(in srgb, var(--ember) 16%, transparent) 0%, color-mix(in srgb, var(--ember) 5%, transparent) 100%)' }
                        : day.isToday ? { background: 'color-mix(in srgb, var(--ember) 3%, transparent)' } : undefined}>
                      {has && (
                        <span className="num text-[12px] font-extrabold text-white px-2.5 py-0.5 rounded-full leading-tight"
                          style={{
                            background: 'linear-gradient(135deg, var(--ember), var(--ember-strong))',
                            boxShadow: '0 4px 12px color-mix(in srgb, var(--ember-strong) 32%, transparent)',
                          }}>
                          {list.length}
                        </span>
                      )}
                    </button>
                  )
                })}
              </Fragment>
            ))}
          </div>

          <div className="px-6 py-4 text-center text-xs font-medium text-ink-muted">
            *Auction schedule can be subjected to change.
          </div>
        </div>

        {/* ------------------------------ side panel --------------------------- */}
        <div className="card rounded-3xl p-6 flex flex-col lg:sticky lg:top-24 lg:h-[600px]">
          <div className="flex items-center justify-between gap-2 rounded-full border border-line bg-surface p-1.5 mb-4 shrink-0">
            <button type="button" onClick={goToday}
              className="h-8 px-4 rounded-full bg-ember-soft text-ember-strong text-[13px] font-bold hover:brightness-95 transition-all">
              Today
            </button>
            <button type="button" aria-label="Previous days" onClick={() => go(-1)}
              className="size-8 shrink-0 rounded-full border border-line grid place-items-center text-ink hover:bg-surface-2 transition-colors">
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-bold text-ink text-center flex-1 min-w-0 px-1">{rangeLabel}</span>
            <button type="button" aria-label="Next days" onClick={() => go(1)}
              className="size-8 shrink-0 rounded-full border border-line grid place-items-center text-ink hover:bg-surface-2 transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>

          <h3 className="font-display text-2xl font-bold pb-4 mb-5 border-b border-line shrink-0">
            {active.label} {active.weekday} {active.hour}
          </h3>

          <div className="flex-1 min-h-0 overflow-y-auto -mr-2 pr-2 flex flex-col gap-4">
            {activeList.length === 0 ? (
              <div className="rounded-2xl border border-line px-5 py-4 text-sm text-ink-muted">
                Nothing scheduled in this block.
              </div>
            ) : activeList.map((e, i) => {
              const inner = (
                <>
                  <div className={cx('num text-[13px] font-extrabold tracking-[0.5px]', TONE_TEXT[e.tone])}>
                    {e.code ?? 'Deadline'}
                  </div>
                  <div className="text-[15px] font-bold text-ink mt-2 leading-normal break-words">{e.label}</div>
                  {e.meta && <div className="text-[13px] text-ink-muted mt-1">{e.meta}</div>}
                  <div className="flex flex-wrap gap-2 mt-4">
                    {e.tags?.map((t) => (
                      <span key={t} className="bg-surface-2 text-ink-muted text-[11px] font-bold px-3 py-1.5 rounded-full border border-line">
                        {t}
                      </span>
                    ))}
                    <span className="num bg-ember-soft text-ember-strong text-[11px] font-bold px-3 py-1.5 rounded-full border border-ember/15">
                      {clockLabel(e.date)}
                    </span>
                  </div>
                </>
              )
              const cls = 'block text-left rounded-2xl border border-line bg-surface px-5 py-4 shrink-0 transition-all duration-300 hover:-translate-y-1 hover:border-ember/30 hover:shadow-[var(--shadow-card-hover)]'
              return e.to
                ? <Link key={i} to={e.to} className={cls}>{inner}</Link>
                : <div key={i} className={cx(cls, 'hover:translate-y-0')}>{inner}</div>
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

type Row = {
  cat: Catalogue
  summary: ReturnType<typeof selectionSummary>
}

export default function Dashboard() {
  const me = useStore((s) => s.currentUser)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const users = useStore((s) => s.users)
  const bids = useStore((s) => s.bids)
  const wallets = useStore((s) => s.wallets)
  const selections = useStore((s) => s.selections)
  const notifications = useStore((s) => s.notifications)
  const deliveryOrders = useStore((s) => s.deliveryOrders)
  const watchlist = useStore((s) => s.watchlist)
  const emdExemptionRequests = useStore((s) => s.emdExemptionRequests)
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
    .map((cat) => ({ cat, summary: selectionSummary({ selections, lots }, me.id, cat.id) }))
    .filter((r) => r.summary.count > 0)

  const totalShortfall = rows.reduce((sum, r) => sum + r.summary.shortfall, 0)
  const shortfallRows = rows.filter((r) => r.summary.shortfall > 0)
  // Missed the EMD deadline, requested an exemption, and a sub-admin approved
  // it — funding is reopened, so this is the buyer's cue to actually pay it.
  const approvedExemptionRows = shortfallRows.filter((r) => hasApprovedEmdExemption({ emdExemptionRequests }, me.id, r.cat.id))

  const myNotifs = notifications.filter((n) => n.userId === me.id || n.userId === null).slice(0, 5)

  const attentionCount = (totalShortfall > 0 ? 1 : 0) + (outbidLots.length > 0 ? 1 : 0) + (pendingDos.length > 0 ? 1 : 0)

  // Calendar: strictly scoped to catalogues on this buyer's shortlist (the
  // watchlist star, not just "has a lot selection") — auction start/close,
  // the EMD funding deadline (flagged red if a starred lot is still unpaid),
  // per-lot bid closes, and lift-by deadlines, all limited to that same set.
  const shortlistedCats = catalogues.filter((cat) => isCatalogueShortlisted({ watchlist }, me.id, cat.id))
  const shortlistedIds = new Set(shortlistedCats.map((c) => c.id))

  const sellerOf = (cat: Catalogue) => users.find((u) => u.id === cat.sellerId)?.firm ?? 'Seller'

  const calEvents: CalEvent[] = [
    ...shortlistedCats.flatMap((cat): CalEvent[] => {
      const summary = selectionSummary({ selections, lots }, me.id, cat.id)
      const emdDate = new Date(emdDeadlineMs(cat)).toISOString()
      const base = {
        code: cat.code,
        meta: `${sellerOf(cat)} · ${cat.lotIds.length} lot${cat.lotIds.length === 1 ? '' : 's'}`,
        tags: [cat.region],
        to: `/catalogue/${cat.id}`,
      }
      return [
        { ...base, date: cat.startsAt, label: 'Auction opens', tone: 'steel' },
        { ...base, date: cat.endsAt, label: 'Auction closes', tone: 'ember' },
        summary.count > 0 && summary.shortfall > 0
          ? { ...base, date: emdDate, label: `EMD unpaid — fund ${inr(summary.shortfall)}`, tone: 'danger', to: `/buyer/shortlist/${cat.id}` }
          : { ...base, date: emdDate, label: 'EMD funding closes', tone: 'steel' },
      ]
    }),
    ...activeLots.filter((l) => shortlistedIds.has(l.catalogueId)).map((l): CalEvent => ({
      date: l.endsAt,
      label: l.leadingBidderId === me.id ? 'Bid closes — you are H1' : 'Bid closes — you are outbid',
      tone: l.leadingBidderId === me.id ? 'success' : 'danger',
      code: l.lotNo,
      meta: `${l.metal} ${l.grade}`,
      tags: l.currentRate != null ? [inr(l.currentRate)] : undefined,
      to: '/buyer/bids?tab=active',
    })),
    ...pendingDos.filter((d) => shortlistedIds.has(d.catalogueId)).map((d): CalEvent => {
      const l = lotById.get(d.lotId)
      return {
        date: d.liftingBy,
        label: 'Lift-by deadline',
        tone: 'steel',
        code: l?.lotNo ?? d.lotId,
        meta: l ? `${l.metal} ${l.grade}` : undefined,
        tags: ['Delivery'],
        to: '/buyer/auction-status',
      }
    }),
  ]

  return (
    <Page>
      <PageHeader
        title={<>Namaste, {me.name.split(' ')[0]}{me.bidderId && <Chip tone="steel" className="num ml-2 align-middle text-xs">{me.bidderId}</Chip>}</>}
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
            {approvedExemptionRows.length > 0 && (
              <div className="card p-4 border-l-4 border-l-success flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-success" />
                  <span className="font-semibold text-sm">EMD exemption approved</span>
                </div>
                <p className="text-sm text-ink-muted">
                  A sub-admin approved reopening EMD funding for{' '}
                  {approvedExemptionRows.map((r) => r.cat.code).join(', ')} — pay now to join the auction.
                </p>
                <div className="num text-xl font-bold text-success">
                  {inr(approvedExemptionRows.reduce((sum, r) => sum + r.summary.shortfall, 0))}
                </div>
                <Link to="/buyer/emd-shortlisted-catalogue" className="mt-auto">
                  <Button size="sm" variant="success" className="w-full">Pay EMD now</Button>
                </Link>
              </div>
            )}
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
                <Link to="/buyer/emd-shortlisted-catalogue" className="mt-auto">
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
                    <Link to="/buyer/bids?tab=active" className="text-xs text-steel hover:underline">+{outbidLots.length - 3} more in My bids →</Link>
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
                <Link to="/buyer/auction-status" className="mt-auto">
                  <Button size="sm" variant="secondary" className="w-full">Go to auction status <ArrowRight size={14} /></Button>
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

      <DashboardCalendar events={calEvents} />
    </Page>
  )
}
