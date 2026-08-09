/* Buyer home — an action feed. Whatever needs doing next is highest on the
   page: a live, fully-funded auction pins to the top with one tap into its
   bidding room; everything else queues below in EMD fund-by order. */
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Bell, CheckCircle2, Gavel, Truck, UserRound } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, Countdown, EmptyState, PageHeader, Stat } from '../../components/ui'
import { EmdReminderBanner } from '../../components/EmdReminder'
import { useBidroomGate } from '../../components/BidroomGate'
import { useStore, selectionSummary } from '../../store/store'
import { inr, inrCompact, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type { Catalogue } from '../../types'

type Row = {
  cat: Catalogue
  summary: ReturnType<typeof selectionSummary>
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
    .map((cat) => ({ cat, summary: selectionSummary({ selections, lots }, me.id, cat.id) }))
    .filter((r) => r.summary.count > 0)

  const totalShortfall = rows.reduce((sum, r) => sum + r.summary.shortfall, 0)
  const shortfallRows = rows.filter((r) => r.summary.shortfall > 0)

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
    </Page>
  )
}
