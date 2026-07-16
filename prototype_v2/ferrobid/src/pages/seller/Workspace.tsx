/* Seller workspace — overview of my catalogues, pipeline and live action. */
import { Link } from 'react-router-dom'
import { ArrowUpRight, Gavel, TrendingUp } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Chip, Countdown, EmptyState, PageHeader, Stat, StatusChip } from '../../components/ui'
import { catalogueUiStatus, useStore } from '../../store/store'
import { inr, inrCompact, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'

/** Stable bidder pseudonym — sellers never see buyer identities. */
const mask = (bidderId: string) =>
  `Bidder #${(bidderId.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % 89) + 10}`

export default function SellerWorkspace() {
  const now = useNow()
  const me = useStore((s) => s.currentUser)
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const bids = useStore((s) => s.bids)

  const myCats = catalogues.filter((c) => c.sellerId === me?.id)
  const myLots = lots.filter((l) => myCats.some((c) => c.id === l.catalogueId))
  const liveCats = myCats.filter((c) => c.status === 'live')
  const liveLots = myLots.filter((l) => l.status === 'live')
  const myBids = bids.filter((b) => b.status === 'valid' && liveLots.some((l) => l.id === b.lotId))
  const bidsToday = myBids.filter((b) => now - Date.parse(b.at) < 24 * 3600_000)

  const best = liveLots
    .filter((l) => l.currentRate != null)
    .map((l) => ({ l, uplift: ((l.currentRate! - l.startRate) / l.startRate) * 100 }))
    .sort((a, b) => b.uplift - a.uplift)[0]
  const expected = liveLots.reduce((s, l) => s + (l.currentRate ?? l.startRate) * l.indicativeQty, 0)

  const pipeline = lots.filter((l) => l.catalogueId === null)
  const pipeCount = (st: string) => pipeline.filter((l) => l.status === st).length

  const recent = [...myBids].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 8)

  return (
    <Page>
      <PageHeader
        title={<>Seller workspace</>}
        sub={`${me?.firm ?? 'Your firm'} · lots are inspected & catalogued by the ferroBid ops team before auction.`}
        actions={<Link to="/seller/create-lot"><button className="h-10 px-4 rounded-xl bg-ember text-white text-sm font-semibold hover:bg-ember-strong">+ Create lot</button></Link>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Live lots" value={num(liveLots.length)} sub={`across ${liveCats.length} live catalogue${liveCats.length === 1 ? '' : 's'}`} tone="ember" />
        <Stat label="Bids in last 24h" value={num(bidsToday.length)} sub={`${num(myBids.length)} bids total on live lots`} />
        <Stat label="Best uplift" value={best ? `+${best.uplift.toFixed(1)}%` : '—'} sub={best ? `${best.l.lotNo} · ${best.l.grade}` : 'no bids yet'} tone="success" />
        <Stat label="Expected realisation" value={inrCompact(expected)} sub="current H1 × indicative qty" />
      </div>

      {/* live catalogues */}
      <h2 className="text-lg font-bold mt-10 mb-3">My catalogues</h2>
      {myCats.length === 0 && <EmptyState title="No catalogues yet" body="Submit lots — once inspected and approved, our team catalogues them for auction." />}
      <div className="grid md:grid-cols-2 gap-4">
        {myCats.map((c) => {
          const cl = lots.filter((l) => l.catalogueId === c.id)
          const cBids = bids.filter((b) => b.status === 'valid' && cl.some((l) => l.id === b.lotId))
          const ui = catalogueUiStatus(c, now, cl)
          return (
            <div key={c.id} className="card card-hover p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StatusChip status={ui} />
                  <span className="num text-xs font-bold text-ink-faint">{c.code}</span>
                </div>
                {(ui === 'live' || ui === 'closing') && <Countdown endsAt={c.endsAt} size="sm" />}
              </div>
              <div className="font-display font-bold mt-2 leading-snug">{c.title}</div>
              <div className="num text-sm text-ink-muted mt-2 flex flex-wrap gap-x-5 gap-y-1">
                <span>{cl.length} lots</span>
                <span><Gavel size={12} className="inline mr-1" />{cBids.length} bids</span>
                <span><TrendingUp size={12} className="inline mr-1" />{cl.filter((l) => l.currentRate != null).length} with activity</span>
              </div>
              <div className="mt-4 flex gap-2">
                <Link to="/seller/monitor" className="text-sm font-semibold text-steel hover:underline inline-flex items-center gap-1">
                  Live monitor <ArrowUpRight size={14} />
                </Link>
                <Link to={`/catalogue/${c.id}`} className="text-sm font-semibold text-ink-muted hover:text-ink ml-auto">View as buyer</Link>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-10">
        {/* pipeline snapshot */}
        <div className="card p-5">
          <h2 className="text-lg font-bold mb-3">Pipeline snapshot</h2>
          <p className="text-xs text-ink-faint mb-3">Uncatalogued lots handled by ferroBid ops — inspection → approval → cataloguing.</p>
          <div className="flex flex-wrap gap-2">
            <Chip tone="steel" className="num h-8 px-3">Pending inspection · {pipeCount('pending_inspection')}</Chip>
            <Chip tone="steel" className="num h-8 px-3">Inspected · {pipeCount('inspected')}</Chip>
            <Chip tone="success" className="num h-8 px-3">Approved · {pipeCount('approved')}</Chip>
            <Chip tone="warning" className="num h-8 px-3">Flagged · {pipeCount('flagged')}</Chip>
            <Chip tone="danger" className="num h-8 px-3">Rejected · {pipeCount('rejected')}</Chip>
          </div>
          <Link to="/seller/lots" className="inline-block mt-4 text-sm font-semibold text-steel hover:underline">Open my lots & batches →</Link>
        </div>

        {/* recent activity */}
        <div className="card p-5">
          <h2 className="text-lg font-bold mb-3">Recent bid activity</h2>
          {recent.length === 0 && <p className="text-sm text-ink-faint">No bids yet on your live lots.</p>}
          <div className="divide-y divide-line">
            {recent.map((b) => {
              const l = lots.find((x) => x.id === b.lotId)!
              return (
                <div key={b.id} className="py-2.5 flex items-center gap-3 text-sm">
                  <span className="font-semibold">{mask(b.bidderId)}</span>
                  <span className="text-ink-muted truncate flex-1">bid on <b className="num text-ink">{l.lotNo}</b> {l.grade}</span>
                  <span className="num font-bold">{inr(b.rate)}<span className="text-ink-faint font-medium">/{l.uom}</span></span>
                  <span className="text-xs text-ink-faint num w-16 text-right">{relTime(b.at, now)}</span>
                </div>
              )
            })}
          </div>
          <p className="text-[11px] text-ink-faint mt-3">Bidder identities are masked for sellers.</p>
        </div>
      </div>
    </Page>
  )
}
