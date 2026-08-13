/* ---------------------------------------------------------------------------
   Auction Manager — one bidding room, from the operator's side.

   A buyer's room answers "where am I?". This one answers "what is happening in
   here?" — every lot's rate and ladder, every participant, every extension, all
   at once. The only action is to put a bid on the record; the desk observes and
   escalates, it never bids, never alters a rate and never sees a reserve it can
   change.
--------------------------------------------------------------------------- */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Activity, ArrowLeft, Flag, Pause, ShieldCheck, TrendingUp, Users, Zap } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Avatar, Button, Chip, Countdown, EmptyState, PageHeader, StatusChip, cx,
} from '../../components/ui'
import { rankBidders, useStore } from '../../store/store'
import { fmtTime, inr, inrCompact, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import { FloorStatus, PausedOverlay, ReasonModal, ScopeNote, useAuctionRows } from './shared'
import type { Bid } from '../../types'

const FLAG_REASONS = ['Rapid-fire pattern', 'Suspected collusion', 'Bid retraction request', 'Wallet mismatch']

export default function BiddingRoomOperator() {
  const { catalogueId } = useParams()
  const nav = useNavigate()
  const now = useNow()
  const rows = useAuctionRows()
  const bids = useStore((s) => s.bids)
  const users = useStore((s) => s.users)
  const termsSets = useStore((s) => s.termsSets)
  const voidRequests = useStore((s) => s.bidVoidRequests)
  const flagBid = useStore((s) => s.flagBid)
  const pushToast = useStore((s) => s.pushToast)

  const row = rows.find((r) => r.cat.id === catalogueId)
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null)
  const [flagging, setFlagging] = useState<Bid | null>(null)

  // Follow the room: default to the lot closing soonest that is still open, so
  // opening the room lands on the one that needs watching.
  const defaultLotId = useMemo(() => {
    if (!row) return null
    const open = [...row.liveLots].sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt))
    return (open[0] ?? row.lots[0])?.id ?? null
  }, [row])

  useEffect(() => {
    if (!selectedLotId && defaultLotId) setSelectedLotId(defaultLotId)
  }, [selectedLotId, defaultLotId])

  if (!row) {
    return (
      <Page>
        <EmptyState
          title="That room does not exist"
          body="The auction may have been closed or cancelled."
          action={<Button variant="secondary" onClick={() => nav('/auction/rooms')}>Back to bidding rooms</Button>}
        />
      </Page>
    )
  }

  const lot = row.lots.find((l) => l.id === selectedLotId) ?? row.lots[0]
  const ladder = lot ? rankBidders(bids, lot.id) : []
  const flaggedBidIds = new Set(voidRequests.filter((r) => r.status === 'pending').map((r) => r.bidId))
  const lotBids = lot ? bids.filter((b) => b.lotId === lot.id && b.status === 'valid') : []
  const terms = termsSets.find((t) => t.id === row.cat.termsSetId)
  const isTender = row.cat.type === 'tender'

  const firm = (id: string) => users.find((u) => u.id === id)?.firm ?? 'Unknown firm'
  const userOf = (id: string) => users.find((u) => u.id === id)

  return (
    <Page>
      <PageHeader
        crumbs={[{ label: 'Bidding rooms', to: '/auction/rooms' }, { label: row.cat.code }]}
        title={row.cat.title}
        sub={`${row.seller?.firm ?? 'Unknown seller'} · ${row.cat.yardName}, ${row.cat.region} · ${row.cat.type === 'tender' ? 'sealed tender' : 'live ascending auction'}`}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/auction/live"><Button variant="ghost" size="sm"><ArrowLeft size={14} /> Live control</Button></Link>
            <Countdown endsAt={row.cat.endsAt} prefix="closes" size="lg" />
          </div>
        }
      />

      {row.isPaused && (
        <div className="card border-danger/50 relative overflow-hidden p-4 mb-5 flex items-start gap-3">
          <PausedOverlay />
          <span className="size-9 rounded-xl bg-danger-soft text-danger grid place-items-center shrink-0"><Pause size={17} /></span>
          <div className="text-sm">
            <div className="font-bold">This room is paused</div>
            <p className="text-ink-muted mt-0.5">
              Every countdown below is frozen and any bid arriving now is refused. Resume it from Live auctions.
            </p>
          </div>
          <Link to="/auction/live" className="ml-auto self-center"><Button variant="success" size="sm">Go to live control</Button></Link>
        </div>
      )}

      {/* room-wide readout */}
      <div className="card p-4 mb-5 grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Lots live', value: `${num(row.liveLots.length)}/${num(row.lots.length)}`, icon: <Activity size={12} />, tone: '' },
          { label: 'Bidders admitted', value: num(row.admitted), icon: <Users size={12} />, tone: '' },
          { label: 'Valid bids', value: num(row.bids.length), icon: <TrendingUp size={12} />, tone: '' },
          { label: 'Anti-snipe extensions', value: num(row.extensions), icon: <Zap size={12} />, tone: row.extensions ? 'text-warning' : '' },
          { label: 'Cleared so far', value: inrCompact(row.realisation), icon: <TrendingUp size={12} />, tone: 'text-success' },
        ].map((m) => (
          <div key={m.label}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint flex items-center gap-1">{m.icon} {m.label}</div>
            <div className={cx('num text-xl font-bold mt-0.5', m.tone)}>{m.value}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] gap-5 items-start">
        {/* ------------------------- the lot rail ------------------------- */}
        <div className="card overflow-hidden lg:sticky lg:top-32">
          <div className="px-4 py-3 border-b border-line bg-surface-2/60">
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Lots in this room</div>
            <div className="text-[13px] text-ink-muted mt-0.5">Closing soonest at the top</div>
          </div>
          <div className="max-h-[32rem] overflow-y-auto divide-y divide-line">
            {[...row.lots]
              .sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt))
              .map((l) => {
                const active = l.id === lot?.id
                return (
                  <button key={l.id} onClick={() => setSelectedLotId(l.id)}
                    className={cx('w-full text-left px-4 py-3 transition-colors', active ? 'bg-ember-soft/60' : 'hover:bg-surface-2')}>
                    <div className="flex items-center gap-2">
                      <span className={cx('num text-xs font-bold', active ? 'text-ember-strong' : 'text-ink-muted')}>{l.lotNo}</span>
                      <StatusChip status={l.status} />
                      {l.extensions > 0 && <Chip tone="warning" className="num ml-auto"><Zap size={10} /> {l.extensions}</Chip>}
                    </div>
                    <div className="text-[13px] font-semibold mt-1 truncate">{l.grade} · {l.metal}</div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="num text-[13px] font-bold">
                        {l.currentRate ? inr(l.currentRate) : <span className="text-ink-faint font-normal">no bids</span>}
                        {l.currentRate && <span className="text-[10px] text-ink-faint font-medium">/{l.uom}</span>}
                      </span>
                      <span className="num text-[11px] text-ink-faint">{num(l.bidCount)} bid{l.bidCount === 1 ? '' : 's'}</span>
                    </div>
                    {l.status === 'live' && <Countdown endsAt={l.endsAt} size="sm" className="mt-1.5" />}
                  </button>
                )
              })}
          </div>
        </div>

        {/* ------------------------- the ladder --------------------------- */}
        <div className="space-y-5">
          {!lot ? (
            <EmptyState title="This auction has no lots" />
          ) : (
            <>
              <div className="card overflow-hidden">
                <div className="p-4 flex flex-wrap items-start gap-4 border-b border-line">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="num text-xs font-bold text-ember">{lot.lotNo}</span>
                      <StatusChip status={lot.status} />
                      <FloorStatus row={row} />
                    </div>
                    <div className="font-display text-xl font-bold mt-1">{lot.grade} · {lot.metal}</div>
                    <div className="text-[13px] text-ink-muted mt-0.5">
                      <span className="num">{num(lot.indicativeQty)} {lot.uom}</span> · {lot.yard} · increment <span className="num">{inr(lot.increment)}</span>
                    </div>
                  </div>
                  {lot.status === 'live' && (
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint mb-1">Lot closes</div>
                      <Countdown endsAt={lot.endsAt} />
                    </div>
                  )}
                </div>

                <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Current rate', value: lot.currentRate ? inr(lot.currentRate) : '—', tone: 'text-ember' },
                    { label: 'Start rate', value: inr(lot.startRate), tone: '' },
                    { label: 'Bids', value: num(lot.bidCount), tone: '' },
                    { label: 'Extensions', value: num(lot.extensions), tone: lot.extensions ? 'text-warning' : '' },
                  ].map((m) => (
                    <div key={m.label}>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">{m.label}</div>
                      <div className={cx('num text-lg font-bold mt-0.5', m.tone)}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* the ladder itself */}
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-line bg-surface-2/60 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-sm">{isTender ? 'Sealed offers' : 'Bid ladder'}</div>
                    <div className="text-[12px] text-ink-muted">
                      {isTender
                        ? 'One confidential offer per firm. No bidder can see any of this — only you can.'
                        : "Each firm's best rate, ranked. Ties break on the earlier bid."}
                    </div>
                  </div>
                  <Chip tone="steel"><Users size={11} /> {num(ladder.length)} in contention</Chip>
                </div>
                {ladder.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-ink-faint">
                    Nobody has bid on this lot yet.
                  </div>
                ) : (
                  <div className="divide-y divide-line">
                    {ladder.map((r) => {
                      const u = userOf(r.bidderId)
                      const bid = lotBids.find((b) => b.bidderId === r.bidderId && b.rate === r.rate)
                      const alreadyFlagged = bid ? flaggedBidIds.has(bid.id) : false
                      return (
                        <div key={r.bidderId} className={cx('px-4 py-3 flex items-center gap-3', r.rank === 1 && 'bg-success-soft/30')}>
                          <span className={cx('num size-7 rounded-lg grid place-items-center text-xs font-bold shrink-0',
                            r.rank === 1 ? 'bg-success text-white' : 'bg-surface-2 text-ink-muted border border-line')}>
                            {r.rank === 1 ? 'H1' : `H${r.rank}`}
                          </span>
                          <Avatar name={u?.name ?? '??'} hue={u?.avatarHue ?? 200} size={30} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-semibold truncate">{firm(r.bidderId)}</div>
                            <div className="text-[11px] text-ink-faint">
                              {u?.bidderId && <span className="num">{u.bidderId} · </span>}
                              {fmtTime(r.at)} · {relTime(r.at, now)}
                            </div>
                          </div>
                          <Chip tone={r.type === 'manual' ? 'neutral' : 'steel'}>{r.type === 'bot' ? 'Floor' : r.type}</Chip>
                          <span className="num text-sm font-bold w-28 text-right shrink-0">{inr(r.rate)}</span>
                          {alreadyFlagged ? (
                            <Chip tone="warning" className="shrink-0"><Flag size={11} /> Flagged</Chip>
                          ) : (
                            <Button variant="ghost" size="sm" className="shrink-0" disabled={!bid}
                              onClick={() => bid && setFlagging(bid)}>
                              <Flag size={13} /> Flag
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* who is in the room, and on what terms */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="card p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint flex items-center gap-1.5 mb-2">
                    <Users size={12} /> Admitted to this room
                  </div>
                  <div className="num text-2xl font-bold">{num(row.admitted)}</div>
                  <p className="text-[13px] text-ink-muted mt-1">
                    Firms through the door — pre-bid EMD funded before the cut-off, or already bidding. Nobody else can
                    place a bid here.
                  </p>
                  <Link to="/auction/emd-eligibility" className="text-[12px] font-bold text-ember hover:underline mt-2 inline-block">
                    Eligibility queue →
                  </Link>
                </div>
                <div className="card p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint flex items-center gap-1.5 mb-2">
                    <ShieldCheck size={12} /> Terms in force
                  </div>
                  <div className="font-bold text-sm">{terms?.name ?? 'Standard terms'}</div>
                  <div className="num text-[13px] text-ink-muted mt-0.5">version {terms?.version ?? '—'}</div>
                  <p className="text-[13px] text-ink-muted mt-1.5">
                    Accepted by every bidder at the door — the room refuses entry without it. Sale is
                    {' '}{lot.saleBasis.replace(/-/g, ' ')}, bids valid {num(row.cat.bidValidityDays)} days.
                  </p>
                </div>
              </div>
            </>
          )}

          <ScopeNote>
            Nothing on this screen changes a rate, a reserve or a ladder. Flagging a bid puts it on the record and sends it
            to the bid monitor — voiding it is the Super Admin&apos;s call, and only ever theirs.
          </ScopeNote>
        </div>
      </div>

      <ReasonModal
        open={!!flagging}
        onClose={() => setFlagging(null)}
        title="Put this bid on the record"
        intent="warning"
        confirmLabel="Flag for review"
        summary={
          flagging ? (
            <>
              <b className="num">{inr(flagging.rate)}</b> from <b>{firm(flagging.bidderId)}</b> on{' '}
              <b className="num">{row.lots.find((l) => l.id === flagging.lotId)?.lotNo}</b>. The bid stands and the ladder is
              unchanged — flagging records it and moves it to the bid monitor, where it can be escalated to the Super Admin.
            </>
          ) : null
        }
        hint="Say what you saw. The Super Admin decides on this text if it is escalated."
        placeholder="e.g. Four bids inside 20 seconds, each at the exact minimum increment, immediately after a rival firm's bid."
        presets={FLAG_REASONS}
        onConfirm={(reason) => {
          if (!flagging) return
          flagBid(flagging.id, reason)
          pushToast({ kind: 'warning', title: 'Bid flagged', body: 'It is on the record and waiting in the bid monitor.' })
          setFlagging(null)
        }}
      />
    </Page>
  )
}
