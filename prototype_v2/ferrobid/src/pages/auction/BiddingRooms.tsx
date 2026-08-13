/* ---------------------------------------------------------------------------
   Auction Manager — bidding rooms.

   The buyer's room shows one buyer their own position. There has never been a
   way for an operator to see a whole room at once — every lot, every ladder,
   every participant. This is the way in; the room itself is one level down.
--------------------------------------------------------------------------- */
import { Link } from 'react-router-dom'
import { ArrowRight, Gavel, Users, Zap } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Chip, Countdown, EmptyState, PageHeader, ProgressBar, cx } from '../../components/ui'
import { inrCompact, num } from '../../lib/format'
import { AuctionIdentity, PausedOverlay, SectionTitle, useAuctionRows } from './shared'

export default function BiddingRooms() {
  const rows = useAuctionRows()

  const running = rows.filter((r) => r.ui === 'live' || r.ui === 'closing')
  const opening = rows.filter((r) => r.ui === 'upcoming')

  return (
    <Page>
      <PageHeader
        title="Bidding rooms"
        sub="An operator's view of a running room — every lot, every ladder and every participant at once. Watching, not bidding."
      />

      <SectionTitle
        title="Rooms open now"
        count={running.length}
        sub="Rates and ladders update continuously while a room is open."
      />

      {running.length === 0 ? (
        <EmptyState
          icon={<Gavel size={32} strokeWidth={1.5} />}
          title="No room is open"
          body={opening.length > 0
            ? `${opening.length} scheduled sale${opening.length === 1 ? '' : 's'} will open on time and appear here.`
            : 'Rooms open automatically when a published auction reaches its start time.'}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {running.map((r, i) => {
            const closed = r.lots.length - r.liveLots.length
            return (
              <Link key={r.cat.id} to={`/auction/rooms/${r.cat.id}`}
                className={cx('card card-hover p-4 relative overflow-hidden group animate-fade-up', r.isPaused && 'border-danger/50')}
                style={{ animationDelay: `${i * 45}ms` }}>
                {r.isPaused && <PausedOverlay />}
                <div className="flex items-start gap-3">
                  <AuctionIdentity row={r}>
                    {r.extensions > 0 && <Chip tone="warning" className="num"><Zap size={11} /> {r.extensions}</Chip>}
                  </AuctionIdentity>
                  <Countdown endsAt={r.cat.endsAt} prefix="closes" />
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-[11px] font-semibold mb-1.5">
                    <span className="text-ink-muted">Lots resolved</span>
                    <span className="num text-ink">{num(closed)} of {num(r.lots.length)}</span>
                  </div>
                  <ProgressBar value={closed} max={Math.max(r.lots.length, 1)} tone="ember" />
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4 pt-3.5 border-t border-line">
                  {[
                    { label: 'Bidders in', value: num(r.admitted), icon: <Users size={12} /> },
                    { label: 'Valid bids', value: num(r.bids.length), icon: <Gavel size={12} /> },
                    { label: 'Cleared', value: inrCompact(r.realisation), icon: <ArrowRight size={12} /> },
                  ].map((m) => (
                    <div key={m.label}>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint flex items-center gap-1">{m.icon} {m.label}</div>
                      <div className="num text-base font-bold mt-0.5">{m.value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 text-[12px] font-bold text-ember opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1">
                  Open the room <ArrowRight size={12} />
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {opening.length > 0 && (
        <>
          <SectionTitle title="Opening soon" count={opening.length} sub="These rooms open on their own at the published time." />
          <div className="card divide-y divide-line overflow-hidden">
            {opening.map((r) => (
              <div key={r.cat.id} className="p-4 flex flex-wrap items-center gap-4">
                <AuctionIdentity row={r} />
                <div className="ml-auto flex items-center gap-3">
                  <span className="text-[13px] text-ink-muted num">{num(r.lots.length)} lots</span>
                  <Countdown endsAt={r.cat.startsAt} prefix="opens" size="sm" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Page>
  )
}
