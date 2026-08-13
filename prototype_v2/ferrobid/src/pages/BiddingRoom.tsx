/* ---------------------------------------------------------------------------
   Bidding Room — per-lot live cockpit. Defaults to the buyer's shortlisted
   + EMD-funded lots (the §9 "live cockpit"); full catalogue one tap away.
   Rate-per-UOM ladder, stepper quick-bid, auto-bid proxy, EMD gate, anti-snipe
   indicator, win confetti. Two interchangeable layouts (Classic / Board)
   share the same bid-builder and ladder logic underneath.
--------------------------------------------------------------------------- */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  BellRing, Bot, ChevronLeft, Crown, Gavel, Lock, Monitor,
  PanelRightClose, PanelRightOpen, Rows3, ShieldAlert, Sparkles, TrendingUp, Zap,
} from 'lucide-react'
import { Page } from '../layout/Chrome'
import {
  AmountGrid, AmountInput, Button, Chip, Countdown, EmptyState, Field, Input, Modal, Segmented, StatusChip, cx,
} from '../components/ui'
import { useBidroomGate } from '../components/BidroomGate'
import { EmdExemptionControl } from '../components/EmdExemption'
import { ladderStandings, latestEmdExemptionRequest, myBidTrail, selectionSummary, useStore } from '../store/store'
import { fireConfetti } from '../lib/confetti'
import { emdBlockedMessage, emdWindowClosed } from '../lib/emd'
import { countdown, inr, inrWords, num, relTime } from '../lib/format'
import { useNow } from '../lib/useTick'
import type { Lot } from '../types'

type Style = 'classic' | 'normal' | 'quick'

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
  const role = useStore((s) => s.role)
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const bids = useStore((s) => s.bids)
  const users = useStore((s) => s.users)
  const auditEvents = useStore((s) => s.auditEvents)
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
  const emdExemptionRequests = useStore((s) => s.emdExemptionRequests)
  const { enterBidroom } = useBidroomGate()

  const cat = catalogues.find((c) => c.id === catalogueId)
  const catLots = useMemo(() => lots.filter((l) => l.catalogueId === catalogueId), [lots, catalogueId])
  const summary = selectionSummary({ selections, lots }, me?.id, catalogueId ?? '')
  // EMD deadline gone with no exemption approved — new funding is refused
  // (store's fundEmd backstop), so lots that are already funded stay
  // biddable but the room shouldn't hold entry hostage to ones that can't be
  // paid anymore.
  const exemption = cat && me ? latestEmdExemptionRequest({ emdExemptionRequests }, me.id, cat.id) : undefined
  const frozen = !!cat && emdWindowClosed(cat, now) && exemption?.status !== 'approved'

  const [showAll, setShowAll] = useState(summary.count === 0)
  const [style, setStyle] = useState<Style>('classic')
  const [bidAmount, setBidAmount] = useState(0)
  // whichever lot the auto-bid / confirm modals are open for — Quick view's
  // cards each trigger these independently, without becoming "the" active lot
  const [autoBidLot, setAutoBidLot] = useState<Lot | null>(null)
  const [emdGateLot, setEmdGateLot] = useState<Lot | null>(null)
  const [preConfirmOpen, setPreConfirmOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmLot, setConfirmLot] = useState<Lot | null>(null)
  const [confirmRate, setConfirmRate] = useState(0)
  const [ladderView, setLadderView] = useState<'ladder' | 'mine'>('ladder')
  // open on arrival so the ladder is discoverable; closing it sticks for the session
  const [ladderOpen, setLadderOpen] = useState(true)
  // sealed-tender single offer input — reset to the lot's floor whenever the lot changes
  const [tenderOffer, setTenderOffer] = useState(0)

  // cockpit lots: the buyer's shortlist only — the room has nothing else to show.
  // Closing-soon (< 3 min) lots lead, then plain lot-number order, closed last.
  const cockpitLots = useMemo(() => {
    const mine = catLots.filter((l) => summary.lotIds.includes(l.id))
    return [...mine].sort((a, b) => {
      const aClosed = a.status !== 'live'
      const bClosed = b.status !== 'live'
      if (aClosed !== bClosed) return aClosed ? 1 : -1
      const aLeft = Date.parse(a.endsAt) - now
      const bLeft = Date.parse(b.endsAt) - now
      const aUrgent = !aClosed && aLeft > 0 && aLeft <= URGENT_MS
      const bUrgent = !bClosed && bLeft > 0 && bLeft <= URGENT_MS
      if (aUrgent !== bUrgent) return aUrgent ? -1 : 1
      if (aUrgent && bUrgent) return aLeft - bLeft
      return a.lotNo.localeCompare(b.lotNo, undefined, { numeric: true })
    })
  }, [catLots, summary.lotIds, now])

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
  useEffect(() => { setTenderOffer(lot?.startRate ?? 0) }, [lot?.id])
  // Only the pending bid confirmation is lot-specific and must not carry across.
  // The ladder stays open and on whichever tab you left it — switching lots from
  // the market list is browsing, not a reason to pack the panel away.
  useEffect(() => { setPreConfirmOpen(false); setConfirmOpen(false) }, [lot?.id])

  if (!cat || !lot) {
    return <Page><EmptyState title="Nothing to bid on here" body="This catalogue has no lots, or it doesn't exist in this demo session." action={<Link to={role === 'buyer' ? '/buyermarketplace' : '/browse'}><Button variant="secondary">Browse auctions</Button></Link>} /></Page>
  }

  // Sealed-bid tender: no visible price/ladder, no H1/leading indicator, no
  // outbid alerts, no auto-bid, no anti-snipe — a single one-time rate input.
  const isTender = cat.type === 'tender'
  const myTenderBid = bids.find((b) => b.lotId === lot.id && b.bidderId === me?.id && b.status === 'valid' && b.type === 'tender')

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
  // Once the deadline's gone with nothing to fall back on, that rule can't be
  // met at all — gate on "nothing funded" instead so a frozen catalogue with
  // at least one already-funded lot still lets the buyer in for that lot.
  if (summary.unfundedLotIds.length > 0 && !(frozen && summary.fundedLotIds.length > 0)) {
    const gateLots = catLots.filter((l) => summary.unfundedLotIds.includes(l.id))
    return (
      <Page>
        <div className="max-w-lg mx-auto mt-6 sm:mt-10 card p-6 sm:p-8">
          {frozen ? (
            <>
              <div className="flex flex-col items-center text-center gap-2">
                <div className="size-12 rounded-2xl bg-danger-soft grid place-items-center text-danger"><Lock size={22} /></div>
                <h1 className="text-lg font-bold mt-1">EMD deadline passed</h1>
                <p className="text-sm text-danger font-semibold max-w-sm">{emdBlockedMessage(cat)}</p>
              </div>
              <div className="mt-5 flex flex-col items-center gap-3">
                <EmdExemptionControl catalogueId={cat.id} size="md" />
                <Link to={`/catalogue/${cat.id}`} className="text-sm font-semibold text-ink-muted hover:text-ink">Back to catalogue</Link>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center text-center gap-2">
                <div className="size-12 rounded-2xl bg-warning-soft grid place-items-center text-warning"><Lock size={22} /></div>
                <h1 className="text-lg font-bold mt-1">Fund EMD to enter the bidding room</h1>
                <p className="text-sm text-ink-muted max-w-sm">
                  {gateLots.length} of your {summary.count} shortlisted lot{summary.count > 1 ? 's' : ''} in <span className="num font-bold text-ember">{cat.code}</span>
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
              {/* Same gate as every other entry point — pending EMD, then terms. */}
              <Button size="lg" className="w-full mt-5" onClick={() => enterBidroom(cat.id)}>
                Fund {inr(summary.shortfall)} to enter
              </Button>
              <Link to={`/catalogue/${cat.id}`} className="block w-full text-center text-sm font-semibold text-ink-muted hover:text-ink mt-3">
                Back to catalogue
              </Link>
            </>
          )}
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

  // Rival identities stay masked — real name/firm never shown here — but the
  // mask is now each buyer's own permanent Bidder ID rather than a throwaway
  // per-auction code, so it's the same proof-of-identity a seller admin sees
  // post-close for that lot.
  const maskBidder = (bidderId: string) => {
    if (bidderId === me?.id) return 'You'
    const bidderCode = users.find((u) => u.id === bidderId)?.bidderId
    return bidderCode ? `Bidder ${bidderCode}` : 'Bidder —'
  }

  // Generalized over an explicit lot so Quick view's multiple simultaneous
  // cards can each gate/bid independently, with no single "active lot".
  const gateOrFor = (targetLot: Lot, fn: () => void) => {
    if (!me) { pushToast({ kind: 'warning', title: 'Sign in to bid', body: 'Use the demo role switcher or the login screen.' }); return }
    // Arriving by direct URL skips the gate, so run it here rather than
    // inventing a second terms rule.
    if (!accepted) { enterBidroom(cat.id); return }
    if (!summary.fundedLotIds.includes(targetLot.id)) { setEmdGateLot(targetLot); return }
    fn()
  }
  const gateOr = (fn: () => void) => gateOrFor(lot, fn)

  const doBidFor = (targetLot: Lot, rate: number) => gateOrFor(targetLot, () => {
    const res = placeBid(targetLot.id, rate, undefined, isTender ? 'tender' : 'manual')
    if (res.ok) {
      pushToast(isTender
        ? { kind: 'success', title: `Offer submitted — ${inr(rate)}/${targetLot.uom}`, body: `${targetLot.lotNo} · sealed, cannot be revised` }
        : { kind: 'success', title: `Bid placed — ${inr(rate)}/${targetLot.uom}`, body: `${targetLot.lotNo} · you are H1` })
    } else {
      pushToast({ kind: 'danger', title: isTender ? 'Offer rejected' : 'Bid rejected', body: res.error })
    }
  })

  /* --------------------------- sealed tender control ------------------------ */
  const renderTenderControl = () => {
    if (myTenderBid) {
      return (
        <div className="card bg-success-soft border-success/25 p-4 text-center">
          <div className="text-sm font-bold text-success">Offer submitted {inr(myTenderBid.rate)}/{lot.uom}</div>
          <p className="text-xs text-ink-muted mt-1">Sealed — one offer per bidder, no revisions. Results show after the catalogue closes.</p>
        </div>
      )
    }
    return (
      <div className="flex flex-col gap-3">
        <Field label={`Your offer (₹/${lot.uom}) — minimum ${inr(lot.startRate)}`}>
          <Input inputMode="numeric" className="num" value={tenderOffer.toLocaleString('en-IN')}
            onChange={(e) => setTenderOffer(Number(e.target.value.replace(/[^\d]/g, '')) || 0)} />
        </Field>
        <Button disabled={isPaused || tenderOffer < lot.startRate}
          onClick={() => gateOr(() => { setConfirmLot(lot); setConfirmRate(tenderOffer); setPreConfirmOpen(true) })}>
          <Gavel size={16} /> Submit offer
        </Button>
        {tenderOffer < lot.startRate && (
          <p className="text-xs font-semibold text-danger">Offer must be at least {inr(lot.startRate)}/{lot.uom}.</p>
        )}
        <p className="text-xs text-ink-faint">
          Sealed tender — one confidential offer per bidder, submitted once and opened at close. No visible competing price, no revisions.
        </p>
      </div>
    )
  }

  const renderSealedNotice = () => (
    <div className="card p-6 flex flex-col items-center text-center gap-2 text-sm text-ink-muted">
      <Lock size={18} className="text-ink-faint" />
      Sealed tender — no visible bid ladder. Offers are opened when this catalogue closes.
    </div>
  )

  /* -------------------------- shared bid builder -------------------------- */
  // Two lines on a single white card: the quick-amount grid, then the −/+ input
  // with Bid sitting between it and Set auto-bid — the biggest of the three,
  // but one row, not a card of its own.
  const renderBidBuilder = (size: 'md' | 'md+' | 'lg') => (
    <div className="flex flex-col gap-2.5">
      <div className="card p-3 flex flex-col gap-2.5">
        <AmountGrid minNext={minNext} increment={lot.increment} value={bidAmount} onChange={setBidAmount} size={size} />
        <div className="flex items-stretch gap-2">
          <AmountInput minNext={minNext} increment={lot.increment} value={bidAmount} onChange={setBidAmount} size={size} />
          <Button size={size === 'lg' ? 'lg' : 'md'} className="flex-1" disabled={isPaused || bidAmount < minNext}
            onClick={() => gateOr(() => { setConfirmLot(lot); setConfirmRate(bidAmount); setPreConfirmOpen(true) })}>
            <Gavel size={16} /> Bid {inr(bidAmount)}
          </Button>
          <Button variant="ghost" size={size === 'lg' ? 'lg' : 'md'} onClick={() => gateOr(() => setAutoBidLot(lot))}>
            <Bot size={15} /> {myAuto ? 'Edit auto-bid' : 'Set auto-bid'}
          </Button>
        </div>
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
      { key: 'normal', label: <><Monitor size={13} className="inline mr-1.5 -mt-0.5" /> Board</> },
      { key: 'quick', label: <><Sparkles size={13} className="inline mr-1.5 -mt-0.5" /> Quick</> },
    ]} />
  )

  // Sealed tender has no visible leader/H1 to surface — renderTenderControl
  // covers "have I already offered" instead.
  const statusChipFor = () => isTender ? null : lot.status === 'live'
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
          <ChevronLeft size={16} /> <span className="num font-bold text-ember">{cat.code}</span>
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold flex-1 min-w-0 truncate">Bidding room</h1>
        {isPaused && <Chip tone="danger" pulse><ShieldAlert size={12} /> Paused by administrator</Chip>}
        {styleSwitcher}
      </div>

      {/* lot strip — the cockpit switcher. Up to 14 shortlisted lots lay out in full
          (wrapping to a second row past 7) so every lot is visible with no scroll;
          past that it falls back to the old single scrolling line. Quick view lists
          every shortlisted lot as its own card instead, so it has no need for this. */}
      {style === 'classic' && (
      <div className={cx(cockpitLots.length > 14 ? 'flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x' : 'flex flex-wrap gap-2 pb-2')}>
        {cockpitLots.map((l) => {
          const active = l.id === lot.id
          const lFunded = summary.fundedLotIds.includes(l.id)
          const lLeading = l.leadingBidderId === me?.id
          const lMine = bids.some((b) => b.lotId === l.id && b.bidderId === me?.id && b.status === 'valid')
          return (
            <button key={l.id}
              onClick={() => setParams({ lot: l.id }, { replace: true })}
              className={cx('card px-3.5 py-2.5 text-left transition-colors',
                cockpitLots.length > 14
                  ? 'min-w-44 shrink-0 snap-start'
                  : 'min-w-[140px] grow shrink basis-[calc((100%-3rem)/7)] max-w-[calc((100%-3rem)/7)]',
                active ? 'border-ember bg-ember-soft/40' : 'hover:border-line-strong')}>
              <div className="flex items-center justify-between gap-2">
                <span className="num text-xs font-bold">{l.lotNo}</span>
                {isTender
                  ? (l.status === 'live'
                    ? (lMine ? <Chip tone="success" className="h-5 text-[10px]">Offered</Chip> : <Chip tone="ember" pulse className="h-5 text-[10px]">Open</Chip>)
                    : <StatusChip status={l.status} />)
                  : l.status === 'live'
                    ? (lLeading ? <Chip tone="success" className="h-5 text-[10px]">H1</Chip>
                      : l.bidCount > 0 && summary.lotIds.includes(l.id) ? <Chip tone="danger" className="h-5 text-[10px]">Outbid</Chip>
                      : <Chip tone="ember" pulse className="h-5 text-[10px]">Live</Chip>)
                    : <StatusChip status={l.status} />}
              </div>
              <div className="text-xs text-ink-muted truncate mt-1">{l.grade}</div>
              <div className="num text-sm font-bold mt-0.5">
                {isTender ? `Start ${inr(l.startRate)}` : l.currentRate ? inr(l.currentRate) : inr(l.startRate)}
                {!isTender && <span className="text-[10px] text-ink-faint font-medium">/{l.uom}</span>}
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

      {/* main cockpit — three interchangeable styles */}
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
                  <p className="text-base font-semibold text-ink mt-1.5 max-w-xl">{lot.description}</p>
                  <p className="num text-xs text-ink-faint mt-1">{num(lot.indicativeQty)} {lot.uom} indicative · final on weighment · as-is-where-is</p>
                </div>
                {lot.status === 'live' && <Countdown endsAt={lot.endsAt} prefix="lot closes" size="lg" />}
              </div>

              {/* the big number — hidden entirely on sealed tender lots */}
              <div className="mt-6 grid sm:grid-cols-3 gap-4 items-end">
                {!isTender && (
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
                )}
                <div className={cx('card bg-surface-2 border-0 p-3.5 text-sm', isTender && 'sm:col-span-3')}>
                  <div className="flex justify-between"><span className="text-ink-muted">Start rate</span><span className="num font-semibold">{inr(lot.startRate)}</span></div>
                  {!isTender && (
                    <>
                      <div className="flex justify-between mt-1"><span className="text-ink-muted">Increment</span><span className="num font-semibold">{inr(lot.increment)}</span></div>
                      <div className="flex justify-between mt-1"><span className="text-ink-muted">Min next bid</span><span className="num font-bold text-ember-strong">{inr(minNext)}</span></div>
                    </>
                  )}
                  <div className="flex justify-between mt-1"><span className="text-ink-muted">Your EMD</span>
                    <span className={cx('num font-semibold', funded ? 'text-success' : 'text-warning')}>{funded ? 'Locked ✓' : inr(lot.preBidEmd)}</span></div>
                </div>
              </div>

              {/* bid controls */}
              {lot.status === 'live' ? (
                <div className="mt-6 border-t border-line pt-5">
                  {isTender ? renderTenderControl() : renderBidBuilder('md')}
                </div>
              ) : (
                <div className={cx('mt-6 card border-0 p-5 text-center',
                  lot.status === 'sold' && leading ? 'bg-success-soft' : 'bg-surface-2')}>
                  {lot.status === 'sold' && leading ? (
                    <div className="text-success font-bold text-lg flex items-center justify-center gap-2">
                      <Sparkles size={20} /> You won this lot at {inr(lot.resultH1Rate ?? 0)}/{lot.uom} 🎉
                      <Link to="/buyer/auction-status" className="underline text-sm font-semibold">Track auction status</Link>
                    </div>
                  ) : (
                    <div className="text-ink-muted font-semibold">
                      Bidding closed — {lot.status === 'sold' ? `sold at ${inr(lot.resultH1Rate ?? 0)}/${lot.uom}` : lot.status === 'sta' ? `${isTender ? 'Offer' : 'H1'} below reserve, subject to seller approval` : 'no sale'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {isTender ? renderSealedNotice() : renderLadder(false)}
        </div>
      )}

      {/* Board's three fixed tracks — the template never changes, so toggling the
          ladder leaves the bid card and the market exactly where they are. */}
      {style === 'normal' && (
        <div className="flex flex-col gap-4">
        <div className="grid gap-4 items-start text-sm lg:grid-cols-[300px_minmax(0,1fr)_300px]">
          {/* column 1 — market ticker, grade alongside the lot no so rows are identifiable */}
          <div className="card overflow-hidden">
            <div className="px-3 py-2.5 border-b border-line flex items-center gap-1.5">
              <Rows3 size={13} className="text-ink-faint" /> <span className="font-bold text-xs">Market — <span className="text-ember">{cat.code}</span></span>
            </div>
            {/* one scope control for the whole view — it filters this list and the reminder cards */}
            <div className="px-2 py-2 border-b border-line">
              <Segmented stretch value={showAll ? 'all' : 'mine'} onChange={(v) => setShowAll(v === 'all')}
                options={[
                  { key: 'all', label: `All (${catLots.length})` },
                  { key: 'mine', label: `Shortlist (${summary.count})` },
                ]} />
            </div>
            <div className="overflow-y-auto divide-y divide-line"
              style={{ maxHeight: MARKET_ROWS * MARKET_ROW_PX }}>
              {marketLots.map((l) => {
                const lLeading = l.leadingBidderId === me?.id
                const lMine = bids.some((b) => b.lotId === l.id && b.bidderId === me?.id && b.status === 'valid')
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
                        {isTender ? `Start ${inr(l.startRate)}` : l.currentRate ? inr(l.currentRate) : inr(l.startRate)}
                      </span>
                      <span className="w-14 shrink-0 flex justify-end">
                        {isTender
                          ? (l.status === 'live'
                            ? (lMine ? <Chip tone="success" className="h-4 text-[9px] px-1.5">Offered</Chip> : <Chip tone="ember" pulse className="h-4 text-[9px] px-1.5">Open</Chip>)
                            : <Chip className="h-4 text-[9px] px-1.5" tone={l.status === 'sold' ? 'success' : l.status === 'sta' ? 'warning' : 'neutral'}>
                              {l.status === 'sold' ? 'Accepted' : l.status === 'sta' ? 'STA' : 'Unsold'}
                            </Chip>)
                          : l.status === 'live'
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

          {/* column 2 — the bid card, front and centre */}
          <div className="min-w-0">
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
            <p className="text-sm font-semibold text-ink mt-1 truncate">{lot.description}</p>

            <div className="mt-3 flex items-end justify-between gap-3 flex-wrap">
              {isTender ? (
                <div className="num font-bold leading-none text-3xl text-ink">
                  Start {inr(lot.startRate)}<span className="text-sm text-ink-faint font-medium">/{lot.uom}</span>
                </div>
              ) : (
                <div key={lot.currentRate ?? 0} className={cx('num font-bold leading-none animate-bid-in text-3xl', leading ? 'text-success' : 'text-ink')}>
                  {lot.currentRate ? inr(lot.currentRate) : inr(lot.startRate)}
                  <span className="text-sm text-ink-faint font-medium">/{lot.uom}</span>
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {statusChipFor()}
                {/* the panel glyph points at the reserved column to this card's right,
                    and flips to a close affordance once the ladder is in it — no ladder
                    exists for a sealed tender lot, so the toggle itself disappears */}
                {!isTender && (
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
                )}
              </div>
            </div>

            {/* same tiles as Classic, one notch taller so the bigger numerals sit right */}
            {!isTender && (
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
            )}

            {lot.status === 'live' ? (
              <div className="mt-3 border-t border-line pt-3">
                {isTender ? renderTenderControl() : renderBidBuilder('md+')}
              </div>
            ) : (
              <div className="mt-3 text-ink-muted font-semibold text-xs">
                {lot.status === 'sold' && leading
                  ? <span className="text-success inline-flex items-center gap-1.5"><Sparkles size={14} /> You won at {inr(lot.resultH1Rate ?? 0)}/{lot.uom} — <Link to="/buyer/auction-status" className="underline">track auction status</Link></span>
                  : lot.status === 'sold' ? `Sold at ${inr(lot.resultH1Rate ?? 0)}/${lot.uom}` : lot.status === 'sta' ? `${isTender ? 'Offer' : 'H1'} below reserve — subject to seller approval` : 'No sale'}
              </div>
            )}
          </div>
          </div>

          {/* column 3 — always rendered so the bid card keeps its width and the
              tracks never shift; sealed tender has no ladder, so it always shows
              the sealed notice instead of following the ladderOpen toggle */}
          <div className="min-w-0">
            {isTender ? renderSealedNotice() : ladderOpen && renderLadder(true)}
          </div>
        </div>

        {/* Closing alerts run the full width below all three cards — compact
            tiles, four to a row, so the next four sit right underneath. */}
        {urgentLots.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {urgentLots.map((l) => {
              const lLeading = l.leadingBidderId === me?.id
              const lMine = bids.some((b) => b.lotId === l.id && b.bidderId === me?.id && b.status === 'valid')
              return (
                <button key={l.id}
                  onClick={() => setParams({ lot: l.id }, { replace: true })}
                  className={cx('card px-2.5 py-2 text-left animate-urgent-pulse',
                    'bg-danger-soft/40', l.id === lot.id ? 'border-danger' : 'border-danger/45 hover:border-danger')}>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="num text-[11px] font-bold truncate">{l.lotNo}</span>
                    {isTender
                      ? (lMine ? <Chip tone="success" className="h-4 text-[9px] px-1.5 shrink-0">Offered</Chip> : <Chip tone="danger" pulse className="h-4 text-[9px] px-1.5 shrink-0">Closing</Chip>)
                      : lLeading ? <Chip tone="success" className="h-4 text-[9px] px-1.5 shrink-0">H1</Chip>
                        : <Chip tone="danger" pulse className="h-4 text-[9px] px-1.5 shrink-0">Closing</Chip>}
                  </div>
                  {!isTender && (
                    <div className="num text-xs font-bold mt-0.5">
                      {l.currentRate ? inr(l.currentRate) : inr(l.startRate)}<span className="text-[9px] text-ink-faint font-medium">/{l.uom}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-1.5 mt-1">
                    <Countdown endsAt={l.endsAt} size="sm" className="h-4 text-[9px] px-1" />
                    <span className="text-[9px] font-semibold text-danger truncate">
                      {isTender ? (lMine ? 'Awaiting close' : 'Offer or let go') : lLeading ? 'Hold/raise' : 'Bid or let go'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
        </div>
      )}

      {/* Quick view — every shortlisted lot as its own compact card, so a buyer
          can work through the whole shortlist and place several bids without
          switching "the" active lot. Each card carries its own amount and its
          own confirm/auto-bid trigger. */}
      {style === 'quick' && (
        <div className="mt-3">
          <p className="text-xs text-ink-faint mb-3">
            Bids are per unit of measure, exclusive of GST &amp; TCS. A bid in a lot&apos;s final {cat.antiSnipeMinutes} minutes extends that lot by {cat.antiSnipeMinutes} minutes.
          </p>
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
            {cockpitLots.map((l) => (
              <QuickLotCard key={l.id} lot={l} isTender={isTender} isPaused={isPaused}
                funded={summary.fundedLotIds.includes(l.id)}
                leading={l.leadingBidderId === me?.id}
                iHaveBid={bids.some((b) => b.lotId === l.id && b.bidderId === me?.id && b.status === 'valid')}
                bidCount={l.bidCount}
                myAuto={autoBids.find((a) => a.buyerId === me?.id && a.lotId === l.id && a.active)}
                myTenderBid={bids.find((b) => b.lotId === l.id && b.bidderId === me?.id && b.status === 'valid' && b.type === 'tender')}
                onRequestBid={(targetLot, rate) => gateOrFor(targetLot, () => { setConfirmLot(targetLot); setConfirmRate(rate); setPreConfirmOpen(true) })}
                onRequestOffer={(targetLot, rate) => gateOrFor(targetLot, () => { setConfirmLot(targetLot); setConfirmRate(rate); setPreConfirmOpen(true) })}
                onOpenAutoBid={(targetLot) => gateOrFor(targetLot, () => setAutoBidLot(targetLot))}
                onOpenEmdGate={(targetLot) => setEmdGateLot(targetLot)} />
            ))}
          </div>
        </div>
      )}

      {/* auto-bid modal — keyed to whichever lot opened it, the active lot by default */}
      <AutoBidModal open={!!autoBidLot} onClose={() => setAutoBidLot(null)} lot={autoBidLot ?? lot}
        current={(autoBidLot ? autoBids.find((a) => a.buyerId === me?.id && a.lotId === autoBidLot.id && a.active) : myAuto)?.maxRate}
        onSave={(max, active) => {
          const targetLot = autoBidLot ?? lot
          setAutoBid(targetLot.id, max, active)
          setAutoBidLot(null)
          pushToast(active
            ? { kind: 'success', title: 'Auto-bid armed', body: `We'll counter rivals up to ${inr(max)}/${targetLot.uom} on ${targetLot.lotNo}.` }
            : { kind: 'info', title: 'Auto-bid disabled', body: targetLot.lotNo })
        }} />

      {/* step 1 — do you want to bid/offer at all? only a "yes" here opens the amount confirmation.
          Keyed to confirmLot (falling back to the active lot) so Quick view's per-card
          triggers confirm the lot that was actually clicked, not whichever lot is active. */}
      <Modal open={preConfirmOpen} onClose={() => setPreConfirmOpen(false)} title={isTender ? 'Submit an offer?' : 'Place a bid?'}>
        {(() => {
          const cLot = confirmLot ?? lot
          return (
            <div className="space-y-4">
              <p className="text-sm text-ink-muted">
                {isTender ? 'Do you want to offer' : 'Do you want to bid'} <b className="num text-ink">{inr(confirmRate)}/{cLot.uom}</b> on <b className="num text-ink">{cLot.lotNo}</b>?
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setPreConfirmOpen(false)}>No</Button>
                <Button className="flex-1" onClick={() => { setPreConfirmOpen(false); setConfirmOpen(true) }}>Yes</Button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* step 2 — bid / sealed-offer confirmation modal, with the exact amount to sign off
          on. A tender confirm must never surface minNext/currentRate: those are derived
          from the hidden highest sealed offer and would leak exactly what "no visible
          current rate" is supposed to hide. */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={isTender ? 'Confirm your offer' : 'Confirm your bid'}>
        {(() => {
          const cLot = confirmLot ?? lot
          const cMinNext = cLot.currentRate == null ? cLot.startRate : cLot.currentRate + cLot.increment
          const cMyAuto = autoBids.find((a) => a.buyerId === me?.id && a.lotId === cLot.id && a.active)
          return (
            <div className="space-y-4">
              <p className="text-sm text-ink-muted">
                {isTender ? 'Confirm offer of' : 'Confirm bid of'} <b className="num text-ink">{inr(confirmRate)}/{cLot.uom}</b> for <b className="num text-ink">{cLot.lotNo}</b>?
                {isTender && ' This is final — it cannot be revised or resubmitted.'}
              </p>
              {/* rate in words — a mistyped digit is far easier to catch spelled out */}
              <div className="card bg-surface-2 border-0 px-3.5 py-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{isTender ? 'Offer amount' : 'Bid amount'}</div>
                <div className="num text-xl font-bold mt-0.5">{inr(confirmRate)}<span className="text-sm text-ink-faint font-medium">/{cLot.uom}</span></div>
                <div className="text-xs text-ink-muted mt-1 italic">{inrWords(confirmRate)} per {cLot.uom}</div>
              </div>
              {!isTender && (
                <div className="card bg-surface-2 border-0 p-3.5 text-sm space-y-1.5">
                  <div className="flex justify-between"><span className="text-ink-muted">Current H1</span><span className="num font-semibold">{cLot.currentRate ? inr(cLot.currentRate) : '—'}</span></div>
                  {cMyAuto && <div className="flex justify-between"><span className="text-ink-muted">Your auto-bid ceiling</span><span className="num font-semibold">{inr(cMyAuto.maxRate)}</span></div>}
                </div>
              )}
              {!isTender && confirmRate < cMinNext && (
                <div className="rounded-xl bg-warning-soft border border-warning/25 px-3.5 py-2.5 text-sm font-semibold text-warning">
                  Someone just bid — minimum is now {inr(cMinNext)}/{cLot.uom}.
                </div>
              )}
              {isTender && confirmRate < cLot.startRate && (
                <div className="rounded-xl bg-warning-soft border border-warning/25 px-3.5 py-2.5 text-sm font-semibold text-warning">
                  Offer must be at least {inr(cLot.startRate)}/{cLot.uom}.
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setConfirmOpen(false)}>Cancel</Button>
                <Button className="flex-1" disabled={isTender && confirmRate < cLot.startRate} onClick={() => {
                  const rate = isTender ? confirmRate : confirmRate < cMinNext ? cMinNext : confirmRate
                  doBidFor(cLot, rate)
                  setConfirmOpen(false)
                }}>
                  {!isTender && confirmRate < cMinNext ? `Bid ${inr(cMinNext)} instead` : 'Confirm'}
                </Button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* EMD gate modal */}
      <Modal open={!!emdGateLot} onClose={() => setEmdGateLot(null)} title={frozen ? 'EMD deadline passed' : 'Fund EMD to bid'}>
        {emdGateLot && (
          frozen ? (
            <div className="space-y-4">
              <p className="text-sm text-danger font-semibold">{emdBlockedMessage(cat)}</p>
              <p className="text-sm text-ink-muted">
                Request an exemption to fund EMD and unlock bidding on <b className="num text-ink">{emdGateLot.lotNo}</b>.
              </p>
              <EmdExemptionControl catalogueId={cat.id} size="md" />
            </div>
          ) : (
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
          )
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

/* ------------------------------ Quick view card ---------------------------- */
/** One shortlisted lot, fully self-contained — its own bid amount, its own
 *  confirm/auto-bid triggers — so Quick view can lay out every shortlisted lot
 *  at once and a buyer can bid across all of them without switching "the"
 *  active lot. */
function QuickLotCard({
  lot, isTender, isPaused, funded, leading, iHaveBid, bidCount, myAuto, myTenderBid,
  onRequestBid, onRequestOffer, onOpenAutoBid, onOpenEmdGate,
}: {
  lot: Lot; isTender: boolean; isPaused: boolean
  funded: boolean; leading: boolean; iHaveBid: boolean; bidCount: number
  myAuto?: { maxRate: number }; myTenderBid?: { rate: number }
  onRequestBid: (lot: Lot, rate: number) => void
  onRequestOffer: (lot: Lot, rate: number) => void
  onOpenAutoBid: (lot: Lot) => void
  onOpenEmdGate: (lot: Lot) => void
}) {
  const minNext = lot.currentRate == null ? lot.startRate : lot.currentRate + lot.increment
  const [bidAmount, setBidAmount] = useState(minNext)
  const [tenderOffer, setTenderOffer] = useState(lot.startRate)
  // tracks the floor moving out from under a stale amount when someone else bids
  useEffect(() => { setBidAmount(minNext) }, [minNext])

  const closed = lot.status !== 'live'

  return (
    <div className="card overflow-hidden">
      {!isTender && !funded && (
        <div className="bg-warning-soft border-b border-warning/30 px-4 py-2 text-[11px] font-semibold text-warning flex items-center gap-1.5">
          <Lock size={11} /> EMD pending.
          <button className="underline" onClick={() => onOpenEmdGate(lot)}>Fund {inr(lot.preBidEmd)}</button>
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="num font-bold text-sm">{lot.lotNo}</span>
              <Chip tone="steel" className="h-5 text-[10px]">{lot.metal}</Chip>
              <StatusChip status={lot.status} />
            </div>
            <p className="text-xs text-ink-muted mt-1.5 truncate">{lot.description}</p>
          </div>
          {lot.status === 'live' && <Countdown endsAt={lot.endsAt} size="sm" className="shrink-0" />}
        </div>

        {!isTender ? (
          <div className="mt-3.5 flex items-center gap-2 flex-wrap">
            <div className="num font-bold text-2xl leading-none text-ink">
              {lot.currentRate ? inr(lot.currentRate) : inr(lot.startRate)}
              <span className="text-xs text-ink-faint font-medium">/{lot.uom}</span>
            </div>
            {!closed ? (
              leading ? <Chip tone="success" className="h-5 text-[10px]"><Crown size={10} /> You&apos;re H1</Chip>
                : iHaveBid ? <Chip tone="danger" className="h-5 text-[10px]"><BellRing size={10} /> Outbid</Chip>
                  : <Chip tone="neutral" className="h-5 text-[10px]">No bid yet</Chip>
            ) : (
              <Chip tone={lot.status === 'sold' ? 'success' : lot.status === 'sta' ? 'warning' : 'neutral'} className="h-5 text-[10px]">
                {lot.status === 'sold' ? `Sold ${inr(lot.resultH1Rate ?? 0)}` : lot.status === 'sta' ? 'STA' : 'Unsold'}
              </Chip>
            )}
            <span className="num text-[11px] text-ink-faint ml-auto">{bidCount} bids</span>
          </div>
        ) : (
          <div className="mt-3.5 text-sm font-semibold text-ink">
            {myTenderBid ? `Offer submitted ${inr(myTenderBid.rate)}/${lot.uom}` : `Sealed — start ${inr(lot.startRate)}/${lot.uom}`}
          </div>
        )}

        {lot.status === 'live' && isTender && !myTenderBid && (
          <div className="mt-4 flex items-center gap-2">
            <Input inputMode="numeric" className="num flex-1" value={tenderOffer.toLocaleString('en-IN')}
              onChange={(e) => setTenderOffer(Number(e.target.value.replace(/[^\d]/g, '')) || 0)} />
            <Button size="md" disabled={isPaused || tenderOffer < lot.startRate} onClick={() => onRequestOffer(lot, tenderOffer)}>
              <Gavel size={15} /> Offer
            </Button>
          </div>
        )}

        {lot.status === 'live' && !isTender && (
          <div className="mt-4 flex flex-col gap-2.5">
            <AmountGrid minNext={minNext} increment={lot.increment} value={bidAmount} onChange={setBidAmount} size="md" />
            <div className="flex items-stretch gap-2">
              <AmountInput minNext={minNext} increment={lot.increment} value={bidAmount} onChange={setBidAmount} size="md" />
              <Button size="md" className="flex-1" disabled={isPaused || bidAmount < minNext} onClick={() => onRequestBid(lot, bidAmount)}>
                <Gavel size={15} /> Bid {inr(bidAmount)}
              </Button>
              <Button variant="ghost" size="md" title={myAuto ? 'Edit auto-bid' : 'Set auto-bid'} onClick={() => onOpenAutoBid(lot)}>
                <Bot size={15} />
              </Button>
            </div>
            {myAuto && (
              <div className="text-[11px] font-semibold text-steel flex items-center gap-1"><Bot size={11} /> Auto-bid to {inr(myAuto.maxRate)}</div>
            )}
          </div>
        )}

        {closed && (
          <div className="mt-4 text-xs font-semibold">
            {lot.status === 'sold' && leading ? (
              <span className="text-success inline-flex items-center gap-1.5"><Sparkles size={13} /> You won this lot at {inr(lot.resultH1Rate ?? 0)}/{lot.uom}</span>
            ) : (
              <span className="text-ink-muted">
                {lot.status === 'sold' ? `Sold at ${inr(lot.resultH1Rate ?? 0)}/${lot.uom}`
                  : lot.status === 'sta' ? `${isTender ? 'Offer' : 'H1'} below reserve — subject to seller approval` : 'No sale'}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
