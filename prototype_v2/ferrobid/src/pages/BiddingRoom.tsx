/* ---------------------------------------------------------------------------
   Bidding Room — per-lot live cockpit. Defaults to the buyer's shortlisted
   + EMD-funded lots (the §9 "live cockpit"); full catalogue one tap away.
   Rate-per-UOM ladder, quick-bid, auto-bid proxy, EMD gate, anti-snipe
   indicator, win confetti.
--------------------------------------------------------------------------- */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowUp, Bot, ChevronLeft, Gavel, Lock, ShieldAlert, Sparkles, TrendingUp, Zap,
} from 'lucide-react'
import { Page } from '../layout/Chrome'
import {
  Button, Chip, Countdown, EmptyState, Input, Modal, StatusChip, Toggle, cx,
} from '../components/ui'
import { selectionSummary, useStore } from '../store/store'
import { fireConfetti } from '../lib/confetti'
import { inr, num, relTime } from '../lib/format'
import { useNow } from '../lib/useTick'
import type { Bid, Lot } from '../types'

export default function BiddingRoom() {
  const { catalogueId } = useParams()
  const [params, setParams] = useSearchParams()
  const now = useNow()

  const me = useStore((s) => s.currentUser)
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const bids = useStore((s) => s.bids)
  const users = useStore((s) => s.users)
  const selections = useStore((s) => s.selections)
  const autoBids = useStore((s) => s.autoBids)
  const paused = useStore((s) => s.paused)
  const wallets = useStore((s) => s.wallets)
  const placeBid = useStore((s) => s.placeBid)
  const setAutoBid = useStore((s) => s.setAutoBid)
  const fundEmd = useStore((s) => s.fundEmd)
  const pushToast = useStore((s) => s.pushToast)
  const lastWonLotId = useStore((s) => s.lastWonLotId)
  const clearWinFlag = useStore((s) => s.clearWinFlag)
  const termsAccepted = useStore((s) => s.termsAccepted)

  const cat = catalogues.find((c) => c.id === catalogueId)
  const catLots = useMemo(() => lots.filter((l) => l.catalogueId === catalogueId), [lots, catalogueId])
  const summary = selectionSummary({ selections, lots }, me?.id, catalogueId ?? '')

  const [showAll, setShowAll] = useState(summary.count === 0)
  const [customRate, setCustomRate] = useState('')
  const [autoOpen, setAutoOpen] = useState(false)
  const [emdGateLot, setEmdGateLot] = useState<Lot | null>(null)

  // cockpit lots: shortlisted first (funded first within), else all
  const cockpitLots = useMemo(() => {
    const mine = catLots.filter((l) => summary.lotIds.includes(l.id))
    const sorted = [...mine].sort((a, b) =>
      Number(summary.fundedLotIds.includes(b.id)) - Number(summary.fundedLotIds.includes(a.id)))
    return showAll || sorted.length === 0 ? catLots : sorted
  }, [catLots, summary.lotIds, summary.fundedLotIds, showAll])

  const activeLotId = params.get('lot') ?? cockpitLots.find((l) => l.status === 'live')?.id ?? cockpitLots[0]?.id
  const lot = catLots.find((l) => l.id === activeLotId) ?? cockpitLots[0]

  // win confetti
  useEffect(() => {
    if (lastWonLotId && summary.lotIds.includes(lastWonLotId)) {
      fireConfetti()
      clearWinFlag()
    }
  }, [lastWonLotId, summary.lotIds, clearWinFlag])

  if (!cat || !lot) {
    return <Page><EmptyState title="Nothing to bid on here" body="This catalogue has no lots, or it doesn't exist in this demo session." action={<Link to="/browse"><Button variant="secondary">Browse auctions</Button></Link>} /></Page>
  }

  const funded = summary.fundedLotIds.includes(lot.id)
  const isPaused = !!paused[cat.id]
  const accepted = !!termsAccepted[cat.id]
  const minNext = lot.currentRate == null ? lot.startRate : lot.currentRate + lot.increment
  const leading = lot.leadingBidderId === me?.id
  const myAuto = autoBids.find((a) => a.buyerId === me?.id && a.lotId === lot.id && a.active)
  const lotBids = bids
    .filter((b) => b.lotId === lot.id && b.status === 'valid')
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))

  const maskBidder = (b: Bid) => {
    if (b.bidderId === me?.id) return 'You'
    const u = users.find((x) => x.id === b.bidderId)
    // stable pseudonym — rivals never see firm names
    const n = (b.bidderId.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % 89) + 10
    return u ? `Bidder #${n}` : `Bidder #${n}`
  }

  const gateOr = (fn: () => void) => {
    if (!me) { pushToast({ kind: 'warning', title: 'Sign in to bid', body: 'Use the demo role switcher or the login screen.' }); return }
    if (!accepted) { pushToast({ kind: 'warning', title: 'Accept the catalogue T&C first', body: 'Open the catalogue page and accept terms — bidding is gated on it.' }); return }
    if (!funded) { setEmdGateLot(lot); return }
    fn()
  }

  const doBid = (rate: number) => gateOr(() => {
    const res = placeBid(lot.id, rate)
    if (res.ok) {
      pushToast({ kind: 'success', title: `Bid placed — ${inr(rate)}/${lot.uom}`, body: `${lot.lotNo} · you are H1` })
      setCustomRate('')
    } else {
      pushToast({ kind: 'danger', title: 'Bid rejected', body: res.error })
    }
  })

  return (
    <Page className="pb-10">
      {/* header row */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Link to={`/catalogue/${cat.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-ink">
          <ChevronLeft size={16} /> <span className="num">{cat.code}</span>
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold flex-1 min-w-0 truncate">Bidding room</h1>
        {isPaused && <Chip tone="danger" pulse><ShieldAlert size={12} /> Paused by administrator</Chip>}
        <Toggle checked={!showAll && summary.count > 0} onChange={(v) => setShowAll(!v)}
          label={`My shortlist only (${summary.count})`} />
      </div>

      {/* lot strip — the cockpit switcher */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {cockpitLots.map((l) => {
          const active = l.id === lot.id
          const lFunded = summary.fundedLotIds.includes(l.id)
          const lLeading = l.leadingBidderId === me?.id
          return (
            <button key={l.id}
              onClick={() => setParams({ lot: l.id }, { replace: true })}
              className={cx('card px-3.5 py-2.5 min-w-44 text-left shrink-0 snap-start transition-colors',
                active ? 'border-ember bg-ember-soft/40' : 'hover:border-line-strong')}>
              <div className="flex items-center justify-between gap-2">
                <span className="num text-xs font-bold">{l.lotNo}</span>
                {l.status === 'live'
                  ? (lLeading ? <Chip tone="success" className="h-5 text-[10px]">H1</Chip>
                    : l.bidCount > 0 && summary.lotIds.includes(l.id) ? <Chip tone="danger" className="h-5 text-[10px]">Outbid</Chip>
                    : <Chip tone="ember" pulse className="h-5 text-[10px]">Live</Chip>)
                  : <StatusChip status={l.status} />}
              </div>
              <div className="text-xs text-ink-muted truncate mt-1">{l.grade}</div>
              <div className="num text-sm font-bold mt-0.5">
                {l.currentRate ? inr(l.currentRate) : inr(l.startRate)}<span className="text-[10px] text-ink-faint font-medium">/{l.uom}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                {l.status === 'live' ? <Countdown endsAt={l.endsAt} size="sm" className="h-5 text-[10px] px-1.5" /> : <span />}
                {!lFunded && summary.lotIds.includes(l.id) && <Lock size={11} className="text-warning" />}
              </div>
            </button>
          )
        })}
      </div>

      {/* main cockpit */}
      <div className="grid lg:grid-cols-[1fr_360px] gap-5 mt-4 items-start">
        {/* left: lot + bid controls */}
        <div className="card p-5 sm:p-6 relative overflow-hidden">
          {!funded && summary.lotIds.includes(lot.id) && (
            <div className="absolute top-0 inset-x-0 bg-warning-soft border-b border-warning/30 px-5 py-2 text-[13px] font-semibold text-warning flex items-center gap-2">
              <Lock size={13} /> EMD pending for this lot — fund it to unlock bidding.
              <button className="underline ml-1" onClick={() => setEmdGateLot(lot)}>Fund {inr(lot.preBidEmd)}</button>
            </div>
          )}
          <div className={cx((!funded && summary.lotIds.includes(lot.id)) && 'pt-8')}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="num font-bold text-lg">{lot.lotNo}</span>
                  <Chip tone="steel">{lot.metal}</Chip>
                  <Chip tone="neutral">{lot.grade}</Chip>
                  <StatusChip status={lot.status} />
                  {lot.extensions > 0 && <Chip tone="warning" className="num"><Zap size={11} /> anti-snipe +{lot.extensions * cat.antiSnipeMinutes}m</Chip>}
                </div>
                <p className="text-sm text-ink-muted mt-1.5 max-w-xl">{lot.description}</p>
                <p className="num text-xs text-ink-faint mt-1">{num(lot.indicativeQty)} {lot.uom} indicative · final on weighment · as-is-where-is</p>
              </div>
              {lot.status === 'live' && <Countdown endsAt={lot.endsAt} prefix="lot closes" size="lg" />}
            </div>

            {/* the big number */}
            <div className="mt-6 grid sm:grid-cols-3 gap-4 items-end">
              <div className="sm:col-span-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                  {lot.status === 'live' ? 'Current rate (H1)' : 'Final rate (H1)'}
                </div>
                <div key={lot.currentRate ?? 0} className={cx('num font-bold leading-none mt-1 animate-bid-in',
                  'text-4xl sm:text-6xl', leading ? 'text-success' : 'text-ink')}>
                  {lot.currentRate ? inr(lot.currentRate) : '—'}
                  <span className="text-lg sm:text-2xl text-ink-faint font-medium">/{lot.uom}</span>
                </div>
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  {lot.status === 'live' && (leading
                    ? <Chip tone="success" pulse>You are H1</Chip>
                    : lot.leadingBidderId
                      ? <Chip tone="danger">{lotBids[0] ? maskBidder(lotBids[0]) : 'Rival'} is leading</Chip>
                      : <Chip tone="neutral">No bids yet — start at {inr(lot.startRate)}</Chip>)}
                  <span className="num text-xs text-ink-muted"><TrendingUp size={12} className="inline mr-1" />{lot.bidCount} bids</span>
                  {myAuto && <Chip tone="steel" className="num"><Bot size={11} /> Auto-bid to {inr(myAuto.maxRate)}</Chip>}
                </div>
              </div>
              <div className="card bg-surface-2 border-0 p-3.5 text-sm">
                <div className="flex justify-between"><span className="text-ink-muted">Start rate</span><span className="num font-semibold">{inr(lot.startRate)}</span></div>
                <div className="flex justify-between mt-1"><span className="text-ink-muted">Increment</span><span className="num font-semibold">{inr(lot.increment)}</span></div>
                <div className="flex justify-between mt-1"><span className="text-ink-muted">Min next bid</span><span className="num font-bold text-ember-strong">{inr(minNext)}</span></div>
                <div className="flex justify-between mt-1"><span className="text-ink-muted">Your EMD</span>
                  <span className={cx('num font-semibold', funded ? 'text-success' : 'text-warning')}>{funded ? 'Locked ✓' : inr(lot.preBidEmd)}</span></div>
              </div>
            </div>

            {/* bid controls */}
            {lot.status === 'live' ? (
              <div className="mt-6 border-t border-line pt-5">
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 5].map((mult) => (
                    <Button key={mult} size="lg" variant={mult === 1 ? 'primary' : 'secondary'} disabled={isPaused}
                      onClick={() => doBid((lot.currentRate ?? lot.startRate - lot.increment) + lot.increment * mult)}>
                      <Gavel size={16} /> {mult === 1 ? `Bid ${inr(minNext)}` : `+${mult}× inc → ${inr((lot.currentRate ?? lot.startRate - lot.increment) + lot.increment * mult)}`}
                    </Button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <div className="relative">
                    <Input inputMode="numeric" placeholder={`Custom rate ≥ ${num(minNext)}`} value={customRate}
                      onChange={(e) => setCustomRate(e.target.value.replace(/[^\d]/g, ''))}
                      onKeyDown={(e) => { if (e.key === 'Enter' && customRate) doBid(Number(customRate)) }}
                      className="num w-56" aria-label="Custom bid rate" />
                  </div>
                  <Button variant="secondary" disabled={!customRate || isPaused} onClick={() => doBid(Number(customRate))}>
                    <ArrowUp size={15} /> Place custom bid
                  </Button>
                  <Button variant="ghost" onClick={() => gateOr(() => setAutoOpen(true))}>
                    <Bot size={15} /> {myAuto ? 'Edit auto-bid' : 'Set auto-bid'}
                  </Button>
                </div>
                <p className="text-xs text-ink-faint mt-3">
                  Bids are per {lot.uom}, exclusive of GST & TCS. A bid in the final {cat.antiSnipeMinutes} minutes extends this lot by {cat.antiSnipeMinutes} minutes.
                </p>
              </div>
            ) : (
              <div className={cx('mt-6 card border-0 p-5 text-center',
                lot.status === 'sold' && leading ? 'bg-success-soft' : 'bg-surface-2')}>
                {lot.status === 'sold' && leading ? (
                  <div className="text-success font-bold text-lg flex items-center justify-center gap-2">
                    <Sparkles size={20} /> You won this lot at {inr(lot.resultH1Rate ?? 0)}/{lot.uom} 🎉
                    <Link to="/buyer/fulfilment" className="underline text-sm font-semibold">Track fulfilment</Link>
                  </div>
                ) : (
                  <div className="text-ink-muted font-semibold">
                    Bidding closed — {lot.status === 'sold' ? `sold at ${inr(lot.resultH1Rate ?? 0)}/${lot.uom}` : lot.status === 'sta' ? 'H1 below reserve, subject to seller approval' : 'no sale'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* right: live bid ladder */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <span className="font-bold text-sm">Bid ladder — {lot.lotNo}</span>
            <span className="num text-xs text-ink-faint">{lotBids.length} bids</span>
          </div>
          <div className="max-h-[430px] overflow-y-auto divide-y divide-line">
            {lotBids.length === 0 && (
              <div className="p-8 text-center text-sm text-ink-faint">No bids yet. Be the first at <b className="num text-ink">{inr(lot.startRate)}</b>.</div>
            )}
            {lotBids.map((b, i) => {
              const isMe = b.bidderId === me?.id
              return (
                <div key={b.id} className={cx('flex items-center gap-3 px-4 py-2.5', i === 0 && 'animate-bid-in', isMe && 'bg-ember-soft/30')}>
                  <span className={cx('size-7 rounded-lg grid place-items-center text-[10px] font-bold shrink-0',
                    i === 0 ? 'bg-ember text-white' : 'bg-surface-2 text-ink-faint')}>
                    {i === 0 ? 'H1' : `H${i + 1}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={cx('text-sm font-semibold truncate', isMe && 'text-ember-strong')}>{maskBidder(b)}
                      {b.type === 'auto' && <Bot size={11} className="inline ml-1.5 text-steel" />}
                    </div>
                    <div className="text-[11px] text-ink-faint">{relTime(b.at, now)}</div>
                  </div>
                  <span className={cx('num text-sm font-bold', i === 0 ? 'text-ink' : 'text-ink-muted')}>{inr(b.rate)}</span>
                </div>
              )
            })}
          </div>
          <div className="px-4 py-3 border-t border-line bg-surface-2 text-[11px] text-ink-faint">
            Rival identities are masked. Simulated competitors are bidding on live lots — expect action near the close.
          </div>
        </div>
      </div>

      {/* auto-bid modal */}
      <AutoBidModal open={autoOpen} onClose={() => setAutoOpen(false)} lot={lot}
        current={myAuto?.maxRate} onSave={(max, active) => {
          setAutoBid(lot.id, max, active)
          setAutoOpen(false)
          pushToast(active
            ? { kind: 'success', title: 'Auto-bid armed', body: `We'll counter rivals up to ${inr(max)}/${lot.uom} on ${lot.lotNo}.` }
            : { kind: 'info', title: 'Auto-bid disabled', body: lot.lotNo })
        }} />

      {/* EMD gate modal */}
      <Modal open={!!emdGateLot} onClose={() => setEmdGateLot(null)} title="Fund EMD to bid">
        {emdGateLot && (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">
              Bidding on <b className="num text-ink">{emdGateLot.lotNo}</b> needs its pre-bid EMD of{' '}
              <b className="num text-ink">{inr(emdGateLot.preBidEmd)}</b> locked from your wallet
              {me && <> (balance {inr(wallets.find((w) => w.userId === me.id)?.balance ?? 0)})</>}.
              EMD is scoped to this lot only and auto-releases if you don't win.
            </p>
            <Button className="w-full" size="lg" onClick={() => {
              const ok = fundEmd(cat.id, [emdGateLot.id], 'Wallet')
              if (ok) {
                pushToast({ kind: 'success', title: 'EMD locked', body: `${emdGateLot.lotNo} unlocked for bidding.` })
                setEmdGateLot(null)
              } else {
                pushToast({ kind: 'danger', title: 'Insufficient balance', body: 'Top up your wallet from Wallet & EMD ledger.' })
              }
            }}>
              Lock {inr(emdGateLot.preBidEmd)} & unlock bidding
            </Button>
            <Link to="/buyer/wallet" className="block text-center text-sm font-semibold text-steel hover:underline">Top up wallet instead</Link>
          </div>
        )}
      </Modal>
    </Page>
  )
}

/* ------------------------------ auto-bid ---------------------------------- */
function AutoBidModal({ open, onClose, lot, current, onSave }: {
  open: boolean; onClose: () => void; lot: Lot; current?: number
  onSave: (max: number, active: boolean) => void
}) {
  const [max, setMax] = useState('')
  const ref = useRef(lot.id)
  useEffect(() => {
    if (open || ref.current !== lot.id) {
      setMax(String(current ?? Math.round((lot.currentRate ?? lot.startRate) * 1.1)))
      ref.current = lot.id
    }
  }, [open, lot.id, current, lot.currentRate, lot.startRate])
  const val = Number(max) || 0
  const minOk = val >= (lot.currentRate ?? lot.startRate)
  return (
    <Modal open={open} onClose={onClose} title={`Auto-bid — ${lot.lotNo}`}>
      <p className="text-sm text-ink-muted">
        Our proxy bids the minimum increment on your behalf whenever a rival takes H1, up to your ceiling. It never bids more than needed.
      </p>
      <div className="mt-4">
        <span className="block text-[13px] font-semibold mb-1.5">Maximum rate (₹/{lot.uom})</span>
        <Input inputMode="numeric" className="num" value={max} onChange={(e) => setMax(e.target.value.replace(/[^\d]/g, ''))} />
        <span className="block text-xs text-ink-faint mt-1.5">
          Current H1 {lot.currentRate ? inr(lot.currentRate) : '—'} · increment {inr(lot.increment)}
        </span>
      </div>
      <div className="flex gap-2 mt-5">
        {current && <Button variant="danger" onClick={() => onSave(0, false)}>Disable</Button>}
        <Button className="flex-1" disabled={!minOk} onClick={() => onSave(val, true)}>Arm auto-bid up to {val ? inr(val) : '—'}</Button>
      </div>
    </Modal>
  )
}
