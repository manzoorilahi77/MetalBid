/* ---------------------------------------------------------------------------
   Bidding Room — per-lot live cockpit. Defaults to the buyer's shortlisted
   + EMD-funded lots (the §9 "live cockpit"); full catalogue one tap away.
   Rate-per-UOM ladder, stepper quick-bid, auto-bid proxy, EMD gate, anti-snipe
   indicator, win confetti. Four interchangeable layouts (Classic / Quick /
   Desk / Normal) share the same bid-builder and ladder logic underneath.
--------------------------------------------------------------------------- */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowUpRight, Bot, ChevronLeft, Crown, Gavel, LayoutGrid, Lock, Monitor,
  PanelRightClose, PanelRightOpen, Rows3, ShieldAlert, Smartphone, Sparkles, TrendingUp, Zap,
} from 'lucide-react'
import { Page } from '../layout/Chrome'
import {
  AmountStepper, Button, Chip, Countdown, EmptyState, Input, Modal, Segmented, StatusChip, Toggle, cx,
} from '../components/ui'
import { ladderStandings, myBidTrail, selectionSummary, useStore } from '../store/store'
import { fireConfetti } from '../lib/confetti'
import { countdown, inr, inrWords, num, relTime } from '../lib/format'
import { useNow } from '../lib/useTick'
import type { Lot } from '../types'

type Style = 'classic' | 'quick' | 'desk' | 'normal'

/** Normal view stays quiet until a shortlisted lot enters its last 3 minutes. */
const URGENT_MS = 3 * 60_000
/** Market ticker shows this many lots before it starts scrolling. */
const MARKET_ROWS = 15
const MARKET_ROW_PX = 38

export default function BiddingRoom() {
  const { catalogueId } = useParams()
  const [params, setParams] = useSearchParams()
  const now = useNow()

  const me = useStore((s) => s.currentUser)
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const bids = useStore((s) => s.bids)
  const auditEvents = useStore((s) => s.auditEvents)
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
  const [style, setStyle] = useState<Style>('classic')
  const [bidAmount, setBidAmount] = useState(0)
  const [autoOpen, setAutoOpen] = useState(false)
  const [emdGateLot, setEmdGateLot] = useState<Lot | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmRate, setConfirmRate] = useState(0)
  const [ladderView, setLadderView] = useState<'ladder' | 'mine'>('ladder')
  // open on arrival so the ladder is discoverable; closing it sticks for the session
  const [ladderOpen, setLadderOpen] = useState(true)

  // cockpit lots: shortlisted first (funded first within), else all
  const cockpitLots = useMemo(() => {
    const mine = catLots.filter((l) => summary.lotIds.includes(l.id))
    const sorted = [...mine].sort((a, b) =>
      Number(summary.fundedLotIds.includes(b.id)) - Number(summary.fundedLotIds.includes(a.id)))
    return showAll || sorted.length === 0 ? catLots : sorted
  }, [catLots, summary.lotIds, summary.fundedLotIds, showAll])

  // Normal view's market list and reminder cards share one scope, so the toggle in
  // the market card governs both — shortlist by default, every lot when switched off.
  const marketLots = useMemo(
    () => (showAll ? catLots : catLots.filter((l) => summary.lotIds.includes(l.id))),
    [catLots, summary.lotIds, showAll])

  // lots about to close — the only thing that earns a top card in Normal view
  const urgentLots = useMemo(() => marketLots.filter((l) => {
    if (l.status !== 'live') return false
    const left = Date.parse(l.endsAt) - now
    return left > 0 && left <= URGENT_MS
  }), [marketLots, now])

  const activeLotId = params.get('lot') ?? cockpitLots.find((l) => l.status === 'live')?.id ?? cockpitLots[0]?.id
  const lot = catLots.find((l) => l.id === activeLotId) ?? cockpitLots[0]

  // win confetti
  useEffect(() => {
    if (lastWonLotId && summary.lotIds.includes(lastWonLotId)) {
      fireConfetti()
      clearWinFlag()
    }
  }, [lastWonLotId, summary.lotIds, clearWinFlag])

  const minNext = lot ? (lot.currentRate == null ? lot.startRate : lot.currentRate + lot.increment) : 0

  // bid builder tracks the lot's own minimum — reset whenever the lot changes
  // or someone else's bid moves the floor out from under a stale amount
  useEffect(() => { setBidAmount(minNext) }, [lot?.id, minNext])
  // Only the pending bid confirmation is lot-specific and must not carry across.
  // The ladder stays open and on whichever tab you left it — switching lots from
  // the market list is browsing, not a reason to pack the panel away.
  useEffect(() => { setConfirmOpen(false) }, [lot?.id])

  if (!cat || !lot) {
    return <Page><EmptyState title="Nothing to bid on here" body="This catalogue has no lots, or it doesn't exist in this demo session." action={<Link to="/browse"><Button variant="secondary">Browse auctions</Button></Link>} /></Page>
  }

  if (summary.count === 0) {
    return (
      <Page>
        <EmptyState title="Nothing shortlisted yet"
          body="Shortlist at least one lot from the catalogue to enter its bidding room."
          action={<Link to={`/catalogue/${cat.id}`}><Button variant="secondary">Back to catalogue</Button></Link>} />
      </Page>
    )
  }

  // Entry rule: EMD on *every* shortlisted lot. Getting in with a partly-funded
  // shortlist is what put "EMD pending" badges on shortlisted lots inside the room.
  if (summary.unfundedLotIds.length > 0) {
    const gateLots = catLots.filter((l) => summary.unfundedLotIds.includes(l.id))
    return (
      <Page>
        <div className="max-w-lg mx-auto mt-6 sm:mt-10 card p-6 sm:p-8">
          <div className="flex flex-col items-center text-center gap-2">
            <div className="size-12 rounded-2xl bg-warning-soft grid place-items-center text-warning"><Lock size={22} /></div>
            <h1 className="text-lg font-bold mt-1">Fund EMD to enter the bidding room</h1>
            <p className="text-sm text-ink-muted max-w-sm">
              {gateLots.length} of your {summary.count} shortlisted lot{summary.count > 1 ? 's' : ''} in {cat.code}
              {gateLots.length === 1 ? ' still needs' : ' still need'} pre-bid EMD. The room opens once every one is funded.
            </p>
          </div>
          <div className="mt-5 divide-y divide-line border border-line rounded-xl overflow-hidden">
            {gateLots.map((l) => (
              <div key={l.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <div className="num text-sm font-bold">{l.lotNo}</div>
                  <div className="text-xs text-ink-muted">{l.grade}</div>
                </div>
                <span className="num text-sm font-bold text-warning">{inr(l.preBidEmd)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 card bg-surface-2 border-0 px-4 py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Total payable</span>
              <span className="num text-lg font-bold text-ember-strong">{inr(summary.shortfall)}</span>
            </div>
            <div className="text-xs text-ink-muted mt-1 text-right italic">{inrWords(summary.shortfall)}</div>
          </div>
          {me && (
            <p className="text-xs text-ink-faint mt-3 text-center">
              Wallet balance {inr(wallets.find((w) => w.userId === me.id)?.balance ?? 0)}. EMD is scoped per lot and auto-releases if you don't win.
            </p>
          )}
          <Button size="lg" className="w-full mt-5" onClick={() => {
            const ok = fundEmd(cat.id, summary.unfundedLotIds, 'Wallet')
            if (ok) {
              pushToast({ kind: 'success', title: 'EMD locked', body: `${gateLots.length} lot${gateLots.length > 1 ? 's' : ''} unlocked for bidding.` })
            } else {
              pushToast({ kind: 'danger', title: 'Insufficient balance', body: 'Top up your wallet from Wallet & EMD ledger.' })
            }
          }}>
            Fund {inr(summary.shortfall)} to enter
          </Button>
          <Link to={`/catalogue/${cat.id}`} className="block w-full text-center text-sm font-semibold text-ink-muted hover:text-ink mt-3">
            Back to catalogue
          </Link>
        </div>
      </Page>
    )
  }

  const funded = summary.fundedLotIds.includes(lot.id)
  const isPaused = !!paused[cat.id]
  const accepted = !!termsAccepted[cat.id]
  const leading = lot.leadingBidderId === me?.id
  const myAuto = autoBids.find((a) => a.buyerId === me?.id && a.lotId === lot.id && a.active)
  const lotBids = bids
    .filter((b) => b.lotId === lot.id && b.status === 'valid')
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))

  const maskBidder = (bidderId: string) => {
    if (bidderId === me?.id) return 'You'
    const u = users.find((x) => x.id === bidderId)
    // stable pseudonym — rivals never see firm names
    const n = (bidderId.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % 89) + 10
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
    } else {
      pushToast({ kind: 'danger', title: 'Bid rejected', body: res.error })
    }
  })

  /* -------------------------- shared bid builder -------------------------- */
  const renderBidBuilder = (size: 'md' | 'md+' | 'lg') => (
    <div className="flex flex-col gap-3">
      <AmountStepper minNext={minNext} increment={lot.increment} value={bidAmount} onChange={setBidAmount} size={size} />
      <div className="flex flex-wrap items-center gap-2">
        <Button size={size === 'lg' ? 'lg' : 'md'} disabled={isPaused || bidAmount < minNext}
          className={size === 'lg' ? 'flex-1' : undefined}
          onClick={() => gateOr(() => { setConfirmRate(bidAmount); setConfirmOpen(true) })}>
          <Gavel size={16} /> Bid {inr(bidAmount)}
        </Button>
        <Button variant="ghost" size={size === 'lg' ? 'lg' : 'md'} onClick={() => gateOr(() => setAutoOpen(true))}>
          <Bot size={15} /> {myAuto ? 'Edit auto-bid' : 'Set auto-bid'}
        </Button>
      </div>
      {bidAmount < minNext && (
        <p className="text-xs font-semibold text-danger">Minimum next bid is {inr(minNext)}/{lot.uom}.</p>
      )}
      <p className="text-xs text-ink-faint">
        Bids are per {lot.uom}, exclusive of GST & TCS. A bid in the final {cat.antiSnipeMinutes} minutes extends this lot by {cat.antiSnipeMinutes} minutes.
      </p>
    </div>
  )

  /* ------------------------------ shared ladder ---------------------------- */
  const renderLadder = (dense: boolean) => {
    const standings = ladderStandings(bids, lot.id, me?.id)
    const myTrail = myBidTrail(bids, auditEvents, lot, me?.id)
    const view = myTrail.length > 0 ? ladderView : 'ladder'
    return (
      <div className="card overflow-hidden">
        <div className={cx('px-4 py-3 border-b border-line flex items-center justify-between gap-2', dense && 'py-2.5')}>
          <span className="font-bold text-sm">{view === 'mine' ? `My bids — ${lot.lotNo}` : `Bid ladder — ${lot.lotNo}`}</span>
          {myTrail.length > 0 ? (
            <Segmented value={view} onChange={setLadderView} options={[
              { key: 'ladder', label: 'Ladder' },
              { key: 'mine', label: `My bids (${myTrail.length})` },
            ]} />
          ) : (
            <span className="num text-xs text-ink-faint">{lotBids.length} bids</span>
          )}
        </div>
        {view === 'mine' ? (
          <div className={cx('overflow-y-auto divide-y divide-line', dense ? 'max-h-[340px]' : 'max-h-[430px]')}>
            {myTrail.map((row) => (
              <div key={row.id} className={cx('flex items-center gap-3 px-4', dense ? 'py-1.5' : 'py-2.5')}>
                <div className="flex-1 min-w-0">
                  <div className={cx('font-semibold truncate', dense ? 'text-xs' : 'text-sm', row.struck && 'line-through text-ink-faint')}>
                    You bid {inr(row.rate)} at {relTime(row.at, now)}
                    {row.type === 'auto' && <Bot size={11} className="inline ml-1.5 text-steel" />}
                  </div>
                  {row.detail && !dense && <div className="text-[11px] text-ink-faint truncate mt-0.5">{row.detail}</div>}
                </div>
                <Chip tone={row.tone} className="shrink-0">{row.reasonLabel}</Chip>
              </div>
            ))}
          </div>
        ) : (
          <div className={cx('overflow-y-auto divide-y divide-line', dense ? 'max-h-[340px]' : 'max-h-[430px]')}>
            {standings.top.length === 0 && (
              <div className="p-8 text-center text-sm text-ink-faint">No bids yet. Be the first at <b className="num text-ink">{inr(lot.startRate)}</b>.</div>
            )}
            {standings.top.map((row) => (
              <div key={row.bidderId} className={cx('flex items-center gap-3 px-4', dense ? 'py-1.5' : 'py-2.5', row.rank === 1 && 'animate-bid-in', row.isMe && 'bg-ember-soft/30')}>
                <span className={cx('rounded-lg grid place-items-center font-bold shrink-0', dense ? 'size-6 text-[9px]' : 'size-7 text-[10px]',
                  row.rank === 1 ? 'bg-ember text-white' : 'bg-surface-2 text-ink-faint')}>
                  H{row.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={cx('font-semibold truncate', dense ? 'text-xs' : 'text-sm', row.isMe && 'text-ember-strong')}>{maskBidder(row.bidderId)}
                    {row.type === 'auto' && <Bot size={11} className="inline ml-1.5 text-steel" />}
                  </div>
                  {!dense && <div className="text-[11px] text-ink-faint">{relTime(row.at, now)}</div>}
                </div>
                <span className={cx('num font-bold', dense ? 'text-xs' : 'text-sm', row.rank === 1 ? 'text-ink' : 'text-ink-muted')}>{inr(row.rate)}</span>
              </div>
            ))}
            {standings.myRow && (
              <div className="border-t-2 border-dashed border-line">
                <div className="px-4 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-faint">Your position</div>
                <div className={cx('flex items-center gap-3 px-4 bg-ember-soft/30', dense ? 'py-1.5' : 'py-2.5')}>
                  <span className={cx('rounded-lg grid place-items-center font-bold shrink-0 bg-surface-2 text-ink-faint', dense ? 'size-6 text-[9px]' : 'size-7 text-[10px]')}>
                    H{standings.myRow.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={cx('font-semibold truncate text-ember-strong', dense ? 'text-xs' : 'text-sm')}>You
                      {standings.myRow.type === 'auto' && <Bot size={11} className="inline ml-1.5 text-steel" />}
                    </div>
                    {!dense && <div className="text-[11px] text-ink-faint">{relTime(standings.myRow.at, now)}</div>}
                  </div>
                  <span className={cx('num font-bold text-ink-muted', dense ? 'text-xs' : 'text-sm')}>{inr(standings.myRow.rate)}</span>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="px-4 py-3 border-t border-line bg-surface-2 text-[11px] text-ink-faint">
          {view === 'mine'
            ? 'Your full bid trail on this lot, including any bids voided by Control Tower.'
            : "Rival identities are masked. Simulated competitors are bidding on live lots — expect action near the close."}
        </div>
      </div>
    )
  }

  const styleSwitcher = (
    <Segmented value={style} onChange={setStyle} options={[
      { key: 'classic', label: <><Gavel size={13} className="inline mr-1.5 -mt-0.5" /> Classic</> },
      { key: 'quick', label: <><Smartphone size={13} className="inline mr-1.5 -mt-0.5" /> Quick</> },
      { key: 'desk', label: <><LayoutGrid size={13} className="inline mr-1.5 -mt-0.5" /> Desk</> },
      { key: 'normal', label: <><Monitor size={13} className="inline mr-1.5 -mt-0.5" /> Normal</> },
    ]} />
  )

  const statusChipFor = () => lot.status === 'live'
    ? (leading
      ? <Chip tone="success" pulse>You are H1</Chip>
      : lot.leadingBidderId
        ? <Chip tone="danger">{lotBids[0] ? maskBidder(lotBids[0].bidderId) : 'Rival'} is leading</Chip>
        : <Chip tone="neutral">No bids yet — start at {inr(lot.startRate)}</Chip>)
    : null

  return (
    <Page className="pb-10">
      {/* header row */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Link to={`/catalogue/${cat.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-ink">
          <ChevronLeft size={16} /> <span className="num">{cat.code}</span>
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold flex-1 min-w-0 truncate">Bidding room</h1>
        {isPaused && <Chip tone="danger" pulse><ShieldAlert size={12} /> Paused by administrator</Chip>}
        {/* Normal's shortlist control lives in its market card, leaving this slot free
            for the switcher — which saves it a row of its own and the dead band that
            came with it, since Normal has no lot strip to fill that band. */}
        {style === 'normal'
          ? styleSwitcher
          : <Toggle checked={!showAll && summary.count > 0} onChange={(v) => setShowAll(!v)}
              label={`My shortlist only (${summary.count})`} />}
      </div>

      {/* lot strip — the cockpit switcher */}
      {style !== 'normal' && (
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
                {!lFunded && <Lock size={11} className="text-warning" />}
              </div>
            </button>
          )
        })}
      </div>
      )}

      {/* style switcher — Normal renders it up in the header row instead */}
      {style !== 'normal' && (
        <div className="flex justify-end mt-4 mb-1">{styleSwitcher}</div>
      )}

      {/* main cockpit — four interchangeable styles */}
      {style === 'classic' && (
        <div className="grid lg:grid-cols-[1fr_360px] gap-5 mt-3 items-start">
          <div className="card p-5 sm:p-6 relative overflow-hidden">
            {!funded && (
              <div className="absolute top-0 inset-x-0 bg-warning-soft border-b border-warning/30 px-5 py-2 text-[13px] font-semibold text-warning flex items-center gap-2">
                <Lock size={13} /> EMD pending for this lot — fund it to unlock bidding.
                <button className="underline ml-1" onClick={() => setEmdGateLot(lot)}>Fund {inr(lot.preBidEmd)}</button>
              </div>
            )}
            <div className={cx((!funded) && 'pt-8')}>
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
                    {statusChipFor()}
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
                  {renderBidBuilder('md')}
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

          {renderLadder(false)}
        </div>
      )}

      {style === 'quick' && (
        <div className="max-w-md mx-auto mt-3 w-full space-y-4">
          <div className="card overflow-hidden">
            {/* one-line status banner — the first thing the eye lands on */}
            <div className={cx('flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-extrabold',
              lot.status !== 'live' ? 'bg-surface-2 text-ink-muted'
                : leading ? 'bg-success-soft text-success'
                  : lot.leadingBidderId ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-ink-muted')}>
              {lot.status !== 'live'
                ? (lot.status === 'sold' && leading ? '🎉 You won this lot' : 'Bidding closed')
                : leading
                  ? <><Crown size={13} /> You're leading — sit tight</>
                  : lot.leadingBidderId
                    ? <><ArrowUpRight size={13} /> Outbid — one tap takes it back</>
                    : <><Gavel size={13} /> No bid from you yet</>}
            </div>

            <div className="p-5 flex flex-col items-center text-center gap-3">
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <span className="num font-bold text-sm">{lot.lotNo}</span>
                <Chip tone="neutral">{lot.grade}</Chip>
                {!funded && <Chip tone="warning"><Lock size={11} /> EMD pending</Chip>}
              </div>

              {lot.status === 'live' && <Countdown endsAt={lot.endsAt} prefix="closes in" size="lg" />}

              <div key={lot.currentRate ?? 0} className="num font-bold leading-none text-5xl animate-bid-in text-ink">
                {lot.currentRate ? inr(lot.currentRate) : inr(lot.startRate)}
                <span className="text-lg text-ink-faint font-medium">/{lot.uom}</span>
              </div>
              <span className="num text-xs text-ink-muted"><TrendingUp size={12} className="inline mr-1" />{lot.bidCount} bids · min next {inr(minNext)}</span>

              {!funded && (
                <Button className="w-full" onClick={() => setEmdGateLot(lot)}>Fund {inr(lot.preBidEmd)} EMD to bid</Button>
              )}

              {lot.status === 'live' ? (
                <div className="w-full flex flex-col items-center gap-3 pt-2 border-t border-line mt-1">
                  {renderBidBuilder('lg')}
                </div>
              ) : (
                <div className="w-full text-ink-muted font-semibold text-sm py-2">
                  {lot.status === 'sold' ? `Sold at ${inr(lot.resultH1Rate ?? 0)}/${lot.uom}` : lot.status === 'sta' ? 'H1 below reserve, subject to seller approval' : 'No sale'}
                </div>
              )}
            </div>
          </div>

          {renderLadder(true)}
        </div>
      )}

      {style === 'desk' && (
        <div className="grid lg:grid-cols-[1fr_300px_260px] gap-4 mt-3 items-start text-sm">
          {/* dense lot panel + bid builder */}
          <div className="card p-4 relative overflow-hidden">
            {!funded && (
              <div className="absolute top-0 inset-x-0 bg-warning-soft border-b border-warning/30 px-4 py-1.5 text-xs font-semibold text-warning flex items-center gap-2">
                <Lock size={12} /> EMD pending. <button className="underline" onClick={() => setEmdGateLot(lot)}>Fund {inr(lot.preBidEmd)}</button>
              </div>
            )}
            <div className={cx('flex items-center justify-between gap-2 flex-wrap', (!funded) && 'pt-6')}>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="num font-bold">{lot.lotNo}</span>
                <Chip tone="steel" className="h-5 text-[10px]">{lot.metal}</Chip>
                <StatusChip status={lot.status} />
              </div>
              {lot.status === 'live' && <Countdown endsAt={lot.endsAt} size="sm" />}
            </div>
            <p className="text-xs text-ink-muted mt-1 truncate">{lot.description}</p>

            <div className="mt-3 flex items-end justify-between gap-3">
              <div key={lot.currentRate ?? 0} className={cx('num font-bold leading-none animate-bid-in text-3xl', leading ? 'text-success' : 'text-ink')}>
                {lot.currentRate ? inr(lot.currentRate) : inr(lot.startRate)}
                <span className="text-sm text-ink-faint font-medium">/{lot.uom}</span>
              </div>
              {statusChipFor()}
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
              <div className="card bg-surface-2 border-0 p-2"><div className="text-ink-faint">Start</div><div className="num font-semibold">{inr(lot.startRate)}</div></div>
              <div className="card bg-surface-2 border-0 p-2"><div className="text-ink-faint">Increment</div><div className="num font-semibold">{inr(lot.increment)}</div></div>
              <div className="card bg-surface-2 border-0 p-2"><div className="text-ink-faint">Min next</div><div className="num font-bold text-ember-strong">{inr(minNext)}</div></div>
            </div>

            {lot.status === 'live' ? (
              <div className="mt-3 border-t border-line pt-3">
                {renderBidBuilder('md')}
              </div>
            ) : (
              <div className="mt-3 text-ink-muted font-semibold text-xs">
                {lot.status === 'sold' ? `Sold at ${inr(lot.resultH1Rate ?? 0)}/${lot.uom}` : lot.status === 'sta' ? 'H1 below reserve — subject to seller approval' : 'No sale'}
              </div>
            )}
          </div>

          {renderLadder(true)}

          {/* market ticker — every lot in this catalogue at a glance */}
          <div className="card overflow-hidden">
            <div className="px-3 py-2.5 border-b border-line flex items-center gap-1.5">
              <Rows3 size={13} className="text-ink-faint" /> <span className="font-bold text-xs">Market — {cat.code}</span>
            </div>
            <div className="max-h-[430px] overflow-y-auto divide-y divide-line">
              {catLots.map((l) => {
                const lLeading = l.leadingBidderId === me?.id
                return (
                  <button key={l.id} onClick={() => setParams({ lot: l.id }, { replace: true })}
                    className={cx('w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-2 transition-colors', l.id === lot.id && 'bg-ember-soft/30')}>
                    <span className="num text-[11px] font-bold w-14 shrink-0">{l.lotNo}</span>
                    <span className="num text-xs font-semibold flex-1 truncate">{l.currentRate ? inr(l.currentRate) : inr(l.startRate)}</span>
                    {l.status === 'live'
                      ? (lLeading ? <Chip tone="success" className="h-5 text-[9px]">H1</Chip> : <Chip tone="ember" pulse className="h-5 text-[9px]">Live</Chip>)
                      : <StatusChip status={l.status} />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Desk's three fixed tracks — the template never changes, so toggling the
          ladder leaves the bid card and the gaps exactly where they are. */}
      {style === 'normal' && (
        <div className="grid gap-4 items-start text-sm lg:grid-cols-[minmax(0,1fr)_300px_300px]">
          {/* column 1 owns the bid card and, under it, the closing alerts */}
          <div className="min-w-0 flex flex-col gap-3">
          {/* Desk's panel, with only the rate numerals scaled up */}
          <div className="card p-4 relative overflow-hidden">
            {!funded && (
              <div className="absolute top-0 inset-x-0 bg-warning-soft border-b border-warning/30 px-4 py-1.5 text-xs font-semibold text-warning flex items-center gap-2">
                <Lock size={12} /> EMD pending. <button className="underline" onClick={() => setEmdGateLot(lot)}>Fund {inr(lot.preBidEmd)}</button>
              </div>
            )}
            <div className={cx('flex items-center justify-between gap-2 flex-wrap', (!funded) && 'pt-6')}>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="num font-bold">{lot.lotNo}</span>
                <Chip tone="steel" className="h-5 text-[10px]">{lot.metal}</Chip>
                <Chip tone="neutral" className="h-5 text-[10px]">{lot.grade}</Chip>
                <StatusChip status={lot.status} />
                {lot.extensions > 0 && <Chip tone="warning" className="num h-5 text-[10px]"><Zap size={10} /> +{lot.extensions * cat.antiSnipeMinutes}m</Chip>}
              </div>
              {lot.status === 'live' && <Countdown endsAt={lot.endsAt} size="sm" />}
            </div>
            <p className="text-xs text-ink-muted mt-1 truncate">{lot.description}</p>

            <div className="mt-3 flex items-end justify-between gap-3 flex-wrap">
              <div key={lot.currentRate ?? 0} className={cx('num font-bold leading-none animate-bid-in text-3xl', leading ? 'text-success' : 'text-ink')}>
                {lot.currentRate ? inr(lot.currentRate) : inr(lot.startRate)}
                <span className="text-sm text-ink-faint font-medium">/{lot.uom}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {statusChipFor()}
                {/* the panel glyph points at the reserved column to this card's right,
                    and flips to a close affordance once the ladder is in it */}
                <Button variant={ladderOpen ? 'steel' : 'secondary'} size="sm"
                  aria-expanded={ladderOpen}
                  title={ladderOpen ? 'Hide the bid ladder' : 'Open the bid ladder beside this card'}
                  onClick={() => setLadderOpen((o) => !o)}>
                  {ladderOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
                  Bid ladder
                  <span className={cx('num text-[11px] font-bold rounded-md px-1.5 py-px',
                    ladderOpen ? 'bg-white/20 text-white' : 'bg-surface-2 text-ink-muted')}>
                    {lot.bidCount}
                  </span>
                </Button>
              </div>
            </div>

            {/* same tiles as Desk, one notch taller so the bigger numerals sit right */}
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="card bg-surface-2 border-0 px-2.5 py-2">
                <div className="text-[11px] text-ink-faint">Start</div>
                <div className="num font-bold text-lg leading-tight">{inr(lot.startRate)}</div>
              </div>
              <div className="card bg-surface-2 border-0 px-2.5 py-2">
                <div className="text-[11px] text-ink-faint">Increment</div>
                <div className="num font-bold text-lg leading-tight">{inr(lot.increment)}</div>
              </div>
              <div className="card bg-surface-2 border-0 px-2.5 py-2">
                <div className="text-[11px] text-ink-faint">Min next</div>
                <div className="num font-bold text-lg leading-tight text-ember-strong">{inr(minNext)}</div>
              </div>
            </div>

            {lot.status === 'live' ? (
              <div className="mt-3 border-t border-line pt-3">
                {renderBidBuilder('md+')}
              </div>
            ) : (
              <div className="mt-3 text-ink-muted font-semibold text-xs">
                {lot.status === 'sold' && leading
                  ? <span className="text-success inline-flex items-center gap-1.5"><Sparkles size={14} /> You won at {inr(lot.resultH1Rate ?? 0)}/{lot.uom} — <Link to="/buyer/fulfilment" className="underline">track fulfilment</Link></span>
                  : lot.status === 'sold' ? `Sold at ${inr(lot.resultH1Rate ?? 0)}/${lot.uom}` : lot.status === 'sta' ? 'H1 below reserve — subject to seller approval' : 'No sale'}
              </div>
            )}
          </div>

          {/* Closing alerts hang off the bottom of the bid card, inside column 1 —
              so they stop short of the ladder and market instead of running the
              full page width, and overflow wraps onto another line rather than
              scrolling sideways. Nothing above or beside them moves. */}
          {urgentLots.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {urgentLots.map((l) => {
                const lLeading = l.leadingBidderId === me?.id
                return (
                  <button key={l.id}
                    onClick={() => setParams({ lot: l.id }, { replace: true })}
                    className={cx('card px-3.5 py-2.5 min-w-52 flex-1 max-w-64 text-left animate-urgent-pulse',
                      'bg-danger-soft/40', l.id === lot.id ? 'border-danger' : 'border-danger/45 hover:border-danger')}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="num text-xs font-bold">{l.lotNo}</span>
                      {lLeading
                        ? <Chip tone="success" className="h-5 text-[10px]">H1</Chip>
                        : <Chip tone="danger" pulse className="h-5 text-[10px]">Closing</Chip>}
                    </div>
                    <div className="text-xs text-ink-muted truncate mt-1">{l.grade}</div>
                    <div className="num text-sm font-bold mt-0.5">
                      {l.currentRate ? inr(l.currentRate) : inr(l.startRate)}<span className="text-[10px] text-ink-faint font-medium">/{l.uom}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <Countdown endsAt={l.endsAt} size="sm" className="h-5 text-[10px] px-1.5" />
                      <span className="text-[10px] font-semibold text-danger">
                        {lLeading ? 'Hold or raise' : 'Bid or let go'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
          </div>

          {/* middle column — always rendered so the market keeps column 3 and the
              tracks never shift; the ladder just fills it when toggled on */}
          <div className="min-w-0">
            {ladderOpen && renderLadder(true)}
          </div>

          {/* market ticker — grade alongside the lot no so rows are identifiable */}
          <div className="card overflow-hidden">
            <div className="px-3 py-2.5 border-b border-line flex items-center gap-1.5">
              <Rows3 size={13} className="text-ink-faint" /> <span className="font-bold text-xs">Market — {cat.code}</span>
            </div>
            {/* one scope control for the whole view — it filters this list and the reminder cards */}
            <div className="px-2 py-2 border-b border-line">
              <Segmented stretch value={showAll ? 'all' : 'mine'} onChange={(v) => setShowAll(v === 'all')}
                options={[
                  { key: 'mine', label: `Shortlist (${summary.count})` },
                  { key: 'all', label: `All (${catLots.length})` },
                ]} />
            </div>
            <div className="overflow-y-auto divide-y divide-line"
              style={{ maxHeight: MARKET_ROWS * MARKET_ROW_PX }}>
              {marketLots.map((l) => {
                const lLeading = l.leadingBidderId === me?.id
                // gold rail = already on my shortlist; only meaningful in the All list,
                // where mine and everyone else's lots sit side by side
                const mine = showAll && summary.lotIds.includes(l.id)
                // clock rides the top line next to the lot no; the grade keeps the
                // second line to itself. Reddens inside the alert window so the list
                // agrees with the cards below.
                const msLeft = Date.parse(l.endsAt) - now
                const closing = l.status === 'live' && msLeft > 0 && msLeft <= URGENT_MS
                return (
                  <button key={l.id} onClick={() => setParams({ lot: l.id }, { replace: true })}
                    style={{ height: MARKET_ROW_PX }}
                    title={mine ? 'On your shortlist' : undefined}
                    className={cx('w-full flex flex-col justify-center gap-px pr-3 text-left hover:bg-surface-2 transition-colors',
                      mine ? 'border-l-[3px] border-l-gold pl-[9px]' : 'pl-3',
                      l.id === lot.id && 'bg-ember-soft/30')}>
                    <span className="flex items-center gap-2 w-full leading-tight">
                      <span className="num text-[11px] font-bold shrink-0">{l.lotNo}</span>
                      <span className={cx('num text-[10px] tabular-nums shrink-0',
                        closing ? 'text-danger font-semibold' : 'text-ink-faint')}>
                        {l.status === 'live' ? countdown(msLeft) : ''}
                      </span>
                      {/* both trailing columns are fixed width: chips differ in width
                          (H1 is far narrower than Live), and a variable chip would drag
                          the rate's right edge around from row to row */}
                      <span className="num text-xs font-semibold ml-auto w-[76px] text-right truncate shrink-0">
                        {l.currentRate ? inr(l.currentRate) : inr(l.startRate)}
                      </span>
                      <span className="w-14 shrink-0 flex justify-end">
                        {l.status === 'live'
                          ? (lLeading
                            ? <Chip tone="success" className="h-4 text-[9px] px-1.5">H1</Chip>
                            : <Chip tone="ember" pulse className="h-4 text-[9px] px-1.5">Live</Chip>)
                          : <Chip className="h-4 text-[9px] px-1.5"
                            tone={l.status === 'sold' ? 'success' : l.status === 'sta' ? 'warning' : 'neutral'}>
                            {l.status === 'sold' ? 'Sold' : l.status === 'sta' ? 'STA' : 'Unsold'}
                          </Chip>}
                      </span>
                    </span>
                    <span className="text-[10px] text-ink-faint truncate leading-tight">{l.grade}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* auto-bid modal */}
      <AutoBidModal open={autoOpen} onClose={() => setAutoOpen(false)} lot={lot}
        current={myAuto?.maxRate} onSave={(max, active) => {
          setAutoBid(lot.id, max, active)
          setAutoOpen(false)
          pushToast(active
            ? { kind: 'success', title: 'Auto-bid armed', body: `We'll counter rivals up to ${inr(max)}/${lot.uom} on ${lot.lotNo}.` }
            : { kind: 'info', title: 'Auto-bid disabled', body: lot.lotNo })
        }} />

      {/* bid confirmation modal */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm your bid">
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            Confirm bid of <b className="num text-ink">{inr(confirmRate)}/{lot.uom}</b> for <b className="num text-ink">{lot.lotNo}</b>?
          </p>
          {/* rate in words — a mistyped digit is far easier to catch spelled out */}
          <div className="card bg-surface-2 border-0 px-3.5 py-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Bid amount</div>
            <div className="num text-xl font-bold mt-0.5">{inr(confirmRate)}<span className="text-sm text-ink-faint font-medium">/{lot.uom}</span></div>
            <div className="text-xs text-ink-muted mt-1 italic">{inrWords(confirmRate)} per {lot.uom}</div>
          </div>
          <div className="card bg-surface-2 border-0 p-3.5 text-sm space-y-1.5">
            <div className="flex justify-between"><span className="text-ink-muted">Current H1</span><span className="num font-semibold">{lot.currentRate ? inr(lot.currentRate) : '—'}</span></div>
            {myAuto && <div className="flex justify-between"><span className="text-ink-muted">Your auto-bid ceiling</span><span className="num font-semibold">{inr(myAuto.maxRate)}</span></div>}
          </div>
          {confirmRate < minNext && (
            <div className="rounded-xl bg-warning-soft border border-warning/25 px-3.5 py-2.5 text-sm font-semibold text-warning">
              Someone just bid — minimum is now {inr(minNext)}/{lot.uom}.
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={() => {
              const rate = confirmRate < minNext ? minNext : confirmRate
              doBid(rate)
              setConfirmOpen(false)
            }}>
              {confirmRate < minNext ? `Bid ${inr(minNext)} instead` : 'Confirm'}
            </Button>
          </div>
        </div>
      </Modal>

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
            <div className="card bg-surface-2 border-0 px-3.5 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">EMD payable</span>
                <span className="num text-lg font-bold">{inr(emdGateLot.preBidEmd)}</span>
              </div>
              <div className="text-xs text-ink-muted mt-1 text-right italic">{inrWords(emdGateLot.preBidEmd)}</div>
            </div>
            <p className="text-xs text-ink-faint">
              Funding it also adds {emdGateLot.lotNo} to your shortlist, so it appears in the
              Shortlist list and gets a closing reminder in its last 3 minutes.
            </p>
            <Button className="w-full" size="lg" onClick={() => {
              const ok = fundEmd(cat.id, [emdGateLot.id], 'Wallet')
              if (ok) {
                pushToast({ kind: 'success', title: 'EMD locked', body: `${emdGateLot.lotNo} added to your shortlist and unlocked for bidding.` })
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
