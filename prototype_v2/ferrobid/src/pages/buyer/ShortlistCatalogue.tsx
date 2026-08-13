/* Shortlist — catalogue detail. Opened from /buyer/shortlist: shows the
   lots you've shortlisted in this catalogue (with EMD funded/pending
   status) alongside the full lot list so you can add more. */
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ArrowRight, Gavel, Lock, Star, Trash2, UserRound } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Button, Chip, Countdown, EmptyState, Input, Modal, MockOtpModal, MockPayModal, PageHeader, PhotoThumb, StatusChip, Tabs, cx,
} from '../../components/ui'
import { EmdExemptionControl } from '../../components/EmdExemption'
import { useStore, selectionSummary, catalogueUiStatus, latestEmdExemptionRequest } from '../../store/store'
import { emdBlockedMessage, emdDeadlineMs, emdOpensAtMs, emdWindowClosed, emdWindowNotOpen } from '../../lib/emd'
import { fmtDate, fmtDateTime, inr, inrCompact, inrWords, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type { Bid, Lot } from '../../types'

type LotsTab = 'shortlisted' | 'all'

export default function ShortlistCatalogue() {
  const { catalogueId } = useParams()
  const me = useStore((s) => s.currentUser)
  const selections = useStore((s) => s.selections)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const users = useStore((s) => s.users)
  const emdExemptionRequests = useStore((s) => s.emdExemptionRequests)
  const bids = useStore((s) => s.bids)
  const termsSets = useStore((s) => s.termsSets)
  const fundEmd = useStore((s) => s.fundEmd)
  const placeBid = useStore((s) => s.placeBid)
  const acceptTerms = useStore((s) => s.acceptTerms)
  const toggleShortlist = useStore((s) => s.toggleShortlist)
  const pushToast = useStore((s) => s.pushToast)
  const now = useNow()
  const [tab, setTab] = useState<LotsTab>('all')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [otpOpen, setOtpOpen] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const [agree, setAgree] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  // sealed-tender per-lot offer confirmation — shared by both tabs' lot rows
  const [tenderFlow, setTenderFlow] = useState<{ lot: Lot; rate: number; phase: 'ask' | 'confirm' } | null>(null)

  if (!me) {
    return (
      <Page>
        <EmptyState
          icon={<UserRound size={32} strokeWidth={1.5} />}
          title="Sign in to manage your shortlist"
          body="Shortlisted lots and pre-bid EMD funding are tied to your account."
          action={<Link to="/login"><Button>Sign in</Button></Link>}
        />
      </Page>
    )
  }

  const cat = catalogues.find((c) => c.id === catalogueId)
  if (!cat) {
    return (
      <Page>
        <EmptyState
          title="Catalogue not found"
          action={<Link to="/buyer/shortlist"><Button variant="secondary">Back to shortlist</Button></Link>}
        />
      </Page>
    )
  }

  const terms = termsSets.find((t) => t.id === cat.termsSetId)
  const isTender = cat.type === 'tender'
  const myTenderBid = (lotId: string): Bid | undefined =>
    bids.find((b) => b.lotId === lotId && b.bidderId === me.id && b.status === 'valid' && b.type === 'tender')

  const catLots = lots.filter((l) => l.catalogueId === cat.id)
  const totalEmd = catLots.reduce((sum, l) => sum + l.preBidEmd, 0)
  const seller = users.find((u) => u.id === cat.sellerId)
  const ui = catalogueUiStatus(cat, now, catLots)
  const summary = selectionSummary({ selections, lots }, me.id, cat.id)
  const shortlisted = catLots.filter((l) => summary.lotIds.includes(l.id))
  const canBid = ui === 'live' || ui === 'closing'
  // Missed the pre-bid EMD cut-off while the catalogue is still upcoming — the
  // whole catalogue freezes here: no more shortlisting, unshortlisting, or
  // funding until it either goes live (funding reopens per lot) or closes out.
  // A sub-admin-approved exemption request reopens it early, same as going live would.
  const exemption = latestEmdExemptionRequest({ emdExemptionRequests }, me.id, cat.id)
  const deadlinePassed = emdWindowClosed(cat, now) && exemption?.status !== 'approved'
  // EMD hasn't opened yet — mutually exclusive with deadlinePassed (the
  // window has to open before it can close). Same freeze as the deadline
  // case, just on the other side of it: no shortlisting or funding here
  // either, direct URL nav to this page notwithstanding.
  const notOpen = emdWindowNotOpen(cat, now)

  // Full-catalogue funded state (every lot, not just what's shortlisted) — used
  // only for the "read only" badge below.
  const allRequired = catLots.reduce((sum, l) => sum + l.preBidEmd, 0)
  const allShortfall = allRequired - summary.funded
  const readOnly = catLots.length > 0 && allShortfall <= 0

  // The strip and the pay button always reflect the buyer's current shortlist —
  // specifically whatever's still pending EMD — regardless of which tab is
  // open. Paying never reaches outside the shortlist; "Select all N lots"
  // brings the whole catalogue in first if that's what's wanted.
  const hasSelection = summary.count > 0
  const scopeCount = summary.unfundedLotIds.length
  const scopeRequired = summary.shortfall
  const scopeShortfall = summary.shortfall

  // Bulk select/clear on the All lots tab — funded lots are excluded from both,
  // same as the individual star (they're locked until the lot closes). Once the
  // catalogue is truly read-only, or the EMD deadline has passed, this naturally
  // comes out empty anyway.
  const selectableLotIds = deadlinePassed || notOpen ? [] : catLots.filter((l) => !summary.lotIds.includes(l.id) && !summary.fundedLotIds.includes(l.id)).map((l) => l.id)
  const clearableLotIds = deadlinePassed || notOpen ? [] : catLots.filter((l) => summary.lotIds.includes(l.id) && !summary.fundedLotIds.includes(l.id)).map((l) => l.id)
  const selectAllLots = () => {
    selectableLotIds.forEach((id) => toggleShortlist(cat.id, id))
    pushToast({ kind: 'info', title: `Added ${selectableLotIds.length} lot${selectableLotIds.length === 1 ? '' : 's'} to shortlist` })
  }
  const clearAllLots = () => {
    clearableLotIds.forEach((id) => toggleShortlist(cat.id, id))
    pushToast({ kind: 'info', title: 'Cleared shortlist selection' })
  }

  return (
    <>
    <Page className={hasSelection ? 'pb-28' : undefined}>
      <Link to="/buyer/shortlist" className="inline-block mb-3">
        <Button variant="secondary" size="sm"><ArrowLeft size={15} /> Back to EMD & payments</Button>
      </Link>

      <PageHeader
        title={cat.title}
        sub={<span className="num text-ember font-bold">{cat.code}</span>}
        actions={
          <div className="flex items-center gap-2">
            <StatusChip status={ui} />
            {readOnly && <Chip tone="success"><Lock size={12} /> EMD funded — read only</Chip>}
            {!readOnly && notOpen && <Chip tone="neutral"><Lock size={12} /> EMD not open yet</Chip>}
            {!readOnly && deadlinePassed && (
              <>
                <Chip tone="danger"><AlertTriangle size={12} /> EMD deadline passed</Chip>
                <EmdExemptionControl catalogueId={cat.id} />
              </>
            )}
            {canBid && <Countdown endsAt={cat.endsAt} prefix="ends" size="sm" />}
          </div>
        }
      />

      {/* Standing outside the header actions and the lots list so the two
          dates that actually gate this catalogue — go-live and the EMD
          cut-off — stay legible on their own instead of getting lost among
          the other header badges. */}
      {ui === 'upcoming' && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Chip tone="steel" className="num h-8 px-3 text-sm">Starts {fmtDateTime(cat.startsAt)}</Chip>
          {notOpen
            ? <Chip tone="neutral" className="num h-8 px-3 text-sm">EMD opens {fmtDateTime(new Date(emdOpensAtMs(cat)).toISOString())}</Chip>
            : deadlinePassed
              ? <Chip tone="danger" className="num h-8 px-3 text-sm">EMD closed {fmtDateTime(new Date(emdDeadlineMs(cat)).toISOString())}</Chip>
              : <Chip tone="warning" className="num h-8 px-3 text-sm">Fund EMD by {fmtDateTime(new Date(emdDeadlineMs(cat)).toISOString())}</Chip>}
        </div>
      )}

      {/* --------------------------- key facts strip -------------------------- */}
      <div className="card mt-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 overflow-hidden">
        <div className="py-3 px-4 border-l border-line first:border-l-0 min-w-40">
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Seller / principal</div>
          <div className="text-sm font-semibold text-ink mt-0.5">{seller?.firm}</div>
        </div>
        <div className="py-3 px-4 border-l border-line min-w-40">
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Inspection window</div>
          <div className="text-sm font-semibold text-ink mt-0.5 num">From: {fmtDate(cat.inspectionFrom)}</div>
          <div className="text-sm font-semibold text-ink mt-0.5 num">Till: {fmtDate(cat.inspectionTo)}</div>
          <div className="text-xs text-ink-muted num">{cat.inspectionHours}</div>
        </div>
        <div className="py-3 px-4 border-l border-line min-w-40">
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">E-auction date & time</div>
          <div className="text-sm font-semibold text-ink mt-0.5 num">{fmtDateTime(cat.startsAt)} → {fmtDateTime(cat.endsAt)}</div>
        </div>
        <div className="py-3 px-4 border-l border-line min-w-40">
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Material location</div>
          <div className="text-sm font-semibold text-ink mt-0.5">{cat.yardName}</div>
          <div className="text-xs text-ink-muted">{cat.region}</div>
        </div>
        <div className="py-3 px-4 border-l border-line min-w-40">
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">EMD value</div>
          <div className="text-sm font-semibold text-ink mt-0.5 num">{inrCompact(totalEmd)}</div>
        </div>
      </div>

      {/* ---------------------------- summary strip ---------------------------- */}
      <div className="card flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5">
        <span className="text-sm">
          <span className="num font-bold">{scopeCount}</span>
          <span className="text-ink-muted"> lot{scopeCount === 1 ? '' : 's'} pending EMD</span>
        </span>
        <span className="text-sm text-ink-muted">Pre-bid EMD <span className="num font-bold text-ink">{inr(scopeRequired)}</span></span>
        <span className="text-sm text-ink-muted">Funded <span className="num font-bold text-success">{inr(summary.funded)}</span></span>
        <span className="text-sm text-ink-muted">Shortfall <span className={cx('num font-bold', scopeShortfall > 0 ? 'text-warning' : 'text-ink')}>{inr(scopeShortfall)}</span></span>
        <span className="ml-auto">
          {!hasSelection ? null : scopeShortfall > 0 ? (
            deadlinePassed ? (
              <EmdExemptionControl catalogueId={cat.id} />
            ) : (
              <Button size="sm" onClick={() => setConfirmOpen(true)}>
                Pay EMD for shortlisted lots {inr(scopeShortfall)}
              </Button>
            )
          ) : (
            <Chip tone="success">All selected lots funded</Chip>
          )}
        </span>
      </div>
      {deadlinePassed && scopeShortfall > 0 && (
        <p className="text-xs text-danger font-semibold mt-2">{emdBlockedMessage(cat)}</p>
      )}

      {/* ------------------------------ lots tabs -------------------------------- */}
      <Tabs<LotsTab> className="mt-8" value={tab} onChange={setTab} tabs={[
        { key: 'all', label: 'All lots', count: catLots.length },
        { key: 'shortlisted', label: 'Shortlisted lots', count: shortlisted.length },
      ]} />

      {tab === 'shortlisted' ? (
        shortlisted.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              title="Nothing shortlisted in this catalogue yet"
              body="Switch to the All lots tab and star lots to add them to your shortlist."
            />
          </div>
        ) : (
        <div className="card divide-y divide-line overflow-hidden mt-5">
          {shortlisted.map((lot) => {
            const funded = summary.fundedLotIds.includes(lot.id)
            return (
              <div key={lot.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <PhotoThumb hue={lot.photos[0]?.hue ?? 24} category={lot.category} label={lot.photos[0]?.label} className="w-16 h-12" />
                <div className="min-w-0 flex-1 basis-56">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="num text-sm font-bold">{lot.lotNo}</span>
                    <Chip tone="neutral">{lot.metal}</Chip>
                    {lot.grade && <Chip tone="steel">{lot.grade}</Chip>}
                  </div>
                  <div className="text-sm text-ink-muted mt-0.5 line-clamp-1">{lot.description}</div>
                  <div className="text-xs text-ink-faint mt-0.5">indicative — final on weighment</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wider text-ink-faint">Indicative qty</div>
                  <div className="num text-sm font-semibold">{num(lot.indicativeQty)} {lot.uom}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wider text-ink-faint">Start rate</div>
                  <div className="num text-sm font-semibold">
                    {inr(lot.startRate)}
                    <span className="text-ink-faint text-xs"> /{lot.uom}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wider text-ink-faint">Pre-bid EMD</div>
                  <div className="num text-sm font-semibold">{inr(lot.preBidEmd)}</div>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  {funded
                    ? <Chip tone="success">EMD funded</Chip>
                    : <Chip tone="warning">EMD pending</Chip>}
                  <button
                    onClick={() => {
                      if (funded || deadlinePassed) return
                      toggleShortlist(cat.id, lot.id)
                      pushToast({ kind: 'info', title: `${lot.lotNo} removed from shortlist` })
                    }}
                    disabled={funded || deadlinePassed}
                    title={
                      funded ? 'EMD is locked — stays on shortlist until the lot closes'
                        : deadlinePassed ? 'EMD deadline passed — this catalogue is frozen'
                        : 'Remove from shortlist'
                    }
                    aria-label={`Remove ${lot.lotNo} from shortlist`}
                    className="p-2 rounded-lg text-ink-faint hover:text-danger hover:bg-danger-soft transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {isTender && funded && (
                  <TenderOfferRow lot={lot} myOffer={myTenderBid(lot.id)}
                    onSubmit={(l, rate) => setTenderFlow({ lot: l, rate, phase: 'ask' })} />
                )}
              </div>
            )
          })}
        </div>
        )
      ) : (
      <>
      <div className="flex items-center justify-between gap-3 mt-5 mb-2">
        <span className="text-xs text-ink-faint">
          <span className="num font-semibold text-ink-muted">{shortlisted.length}</span> of <span className="num font-semibold text-ink-muted">{catLots.length}</span> lots selected
        </span>
        <div className="flex items-center gap-3">
          {selectableLotIds.length > 0 && (
            <button onClick={selectAllLots} className="text-[13px] font-semibold text-ember hover:underline">
              Select all {catLots.length} lots
            </button>
          )}
          {clearableLotIds.length > 0 && (
            <button onClick={clearAllLots} className="text-[13px] font-semibold text-ink-faint hover:underline">
              Clear selection
            </button>
          )}
        </div>
      </div>
      <div className="card divide-y divide-line overflow-hidden">
        {catLots.map((lot) => {
          const selected = summary.lotIds.includes(lot.id)
          const funded = summary.fundedLotIds.includes(lot.id)
          return (
            <div key={lot.id} className={cx('flex flex-wrap items-center gap-3 px-5 py-3.5', selected && 'bg-ember-soft/20')}>
              <button
                aria-label={selected ? 'Remove from shortlist' : 'Add to shortlist'}
                onClick={() => toggleShortlist(cat.id, lot.id)}
                disabled={funded || deadlinePassed || notOpen}
                title={
                  funded ? 'EMD is locked — stays on shortlist until the lot closes'
                    : deadlinePassed ? 'EMD deadline passed — this catalogue is frozen'
                    : notOpen ? `EMD opens ${relTime(new Date(emdOpensAtMs(cat)).toISOString(), now)} — nothing to shortlist yet`
                    : selected ? 'Remove from shortlist' : 'Add to shortlist'
                }
                className={cx('size-9 rounded-xl border grid place-items-center shrink-0 transition-colors',
                  selected ? 'bg-ember text-white border-ember' : 'border-line-strong text-ink-faint hover:text-ember hover:border-ember/50',
                  'disabled:opacity-60 disabled:pointer-events-none')}
              >
                <Star size={16} fill={selected ? 'currentColor' : 'none'} />
              </button>
              <PhotoThumb hue={lot.photos[0]?.hue ?? 24} category={lot.category} label={lot.photos[0]?.label} className="w-16 h-12" />
              <div className="min-w-0 flex-1 basis-56">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="num text-sm font-bold">{lot.lotNo}</span>
                  <Chip tone="neutral">{lot.metal}</Chip>
                  {lot.grade && <Chip tone="steel">{lot.grade}</Chip>}
                  <StatusChip status={lot.status} />
                </div>
                <div className="text-sm text-ink-muted mt-0.5 line-clamp-1">{lot.description}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider text-ink-faint">Indicative qty</div>
                <div className="num text-sm font-semibold">{num(lot.indicativeQty)} {lot.uom}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider text-ink-faint">Start rate</div>
                <div className="num text-sm font-semibold">
                  {inr(lot.startRate)}
                  <span className="text-ink-faint text-xs"> /{lot.uom}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider text-ink-faint">Pre-bid EMD</div>
                <div className="num text-sm font-semibold">{inr(lot.preBidEmd)}</div>
              </div>
              <div className="ml-auto">
                {selected
                  ? (funded ? <Chip tone="success">EMD funded</Chip> : <Chip tone="warning">EMD pending</Chip>)
                  : <Chip tone="neutral">Not shortlisted</Chip>}
              </div>
              {isTender && selected && funded && (
                <TenderOfferRow lot={lot} myOffer={myTenderBid(lot.id)}
                  onSubmit={(l, rate) => setTenderFlow({ lot: l, rate, phase: 'ask' })} />
              )}
            </div>
          )
        })}
      </div>
      {shortlisted.length > 0 && (
        <div className="flex justify-center mt-5">
          <Button variant="secondary" onClick={() => setTab('shortlisted')}>
            Go to shortlisted lots ({shortlisted.length}) <ArrowRight size={15} />
          </Button>
        </div>
      )}
      </>
      )}

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm EMD for shortlisted lots">
        <p className="text-sm text-ink-muted">
          You're confirming <b className="num text-ink">{scopeCount}</b> lot{scopeCount === 1 ? '' : 's'} shortlisted in{' '}
          <b className="text-ink">{cat.code}</b>. Total pre-bid EMD for these lots is{' '}
          <b className="num text-ink">{inr(scopeRequired)}</b>.
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={() => { setConfirmOpen(false); setTermsOpen(true) }}>Confirm</Button>
        </div>
      </Modal>

      {/* terms & conditions — second popup, required before OTP, same
          wording/checkbox as the bidding-room entry gate */}
      <Modal open={termsOpen} onClose={() => { setAgree(false); setTermsOpen(false) }} wide
        title={<span>Terms & Conditions {terms && <Chip tone="steel" className="num ml-1">{terms.version}</Chip>}</span>}>
        {terms && (
          <div className="max-h-64 overflow-y-auto card bg-surface-2 border-0 p-4 space-y-3 text-sm text-ink-muted">
            <div className="font-bold text-ink">{terms.name}</div>
            <ol className="list-decimal pl-5 space-y-1.5">
              {terms.general.map((g, i) => <li key={i}>{g}</li>)}
            </ol>
            <div className="font-bold text-ink pt-1">Special conditions</div>
            <ol className="list-decimal pl-5 space-y-1.5">
              {terms.special.map((g, i) => <li key={i}>{g}</li>)}
            </ol>
            <p className="text-xs italic">{terms.lotSpecificNote}</p>
          </div>
        )}
        <label className="flex items-start gap-2.5 mt-4 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 accent-[#E4572E]" />
          <span>Have you read the terms and conditions? I accept them{terms ? ` (${terms.version})` : ''} on behalf of my firm, including the as-is-where-is sale basis and EMD forfeiture conditions.</span>
        </label>
        <div className="flex gap-2 mt-5">
          <Button variant="ghost" className="flex-1" onClick={() => { setAgree(false); setTermsOpen(false) }}>Cancel</Button>
          <Button className="flex-[2]" disabled={!agree} onClick={() => {
            acceptTerms(cat.id)
            setAgree(false)
            setTermsOpen(false)
            setOtpOpen(true)
          }}>
            Accept & continue
          </Button>
        </div>
      </Modal>

      {/* OTP verification — third popup, right before the payment method screen */}
      <MockOtpModal
        open={otpOpen}
        onClose={() => setOtpOpen(false)}
        onVerified={() => setPayOpen(true)}
        phone={me.phone}
      />

      <MockPayModal
        open={payOpen && scopeShortfall > 0}
        onClose={() => setPayOpen(false)}
        title={`Fund pre-bid EMD — ${cat.code}`}
        amount={scopeShortfall}
        onSuccess={(method) => {
          const ok = fundEmd(cat.id, summary.unfundedLotIds, method)
          if (!ok) {
            pushToast({
              kind: 'danger',
              title: 'Insufficient wallet balance — top up first',
              body: `You need ${inr(scopeShortfall)} available. Add funds from Wallet & ledger.`,
            })
          } else {
            pushToast({
              kind: 'success',
              title: `EMD funded for ${summary.unfundedLotIds.length} lot${summary.unfundedLotIds.length > 1 ? 's' : ''}`,
              body: isTender ? 'Enter your tender amount below for each funded lot.' : 'You can now bid on these lots in the bidding room.',
            })
          }
          setPayOpen(false)
        }}
      />

      {/* sealed-tender offer — step 1: do you want to offer at all? */}
      <Modal open={tenderFlow?.phase === 'ask'} onClose={() => setTenderFlow(null)} title="Submit an offer?">
        {tenderFlow && (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">
              Do you want to offer <b className="num text-ink">{inr(tenderFlow.rate)}/{tenderFlow.lot.uom}</b> on{' '}
              <b className="num text-ink">{tenderFlow.lot.lotNo}</b>?
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setTenderFlow(null)}>No</Button>
              <Button className="flex-1" onClick={() => setTenderFlow((f) => (f ? { ...f, phase: 'confirm' } : f))}>Yes</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* step 2 — final confirm. Amount spelled out in words, same as the bidding
          room's confirm step, so a mistyped digit is easy to catch before it locks. */}
      <Modal open={tenderFlow?.phase === 'confirm'} onClose={() => setTenderFlow(null)} title="Confirm your offer">
        {tenderFlow && (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">
              Confirm offer of <b className="num text-ink">{inr(tenderFlow.rate)}/{tenderFlow.lot.uom}</b> for{' '}
              <b className="num text-ink">{tenderFlow.lot.lotNo}</b>? This is final — it cannot be revised or resubmitted.
            </p>
            <div className="card bg-surface-2 border-0 px-3.5 py-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Offer amount</div>
              <div className="num text-xl font-bold mt-0.5">{inr(tenderFlow.rate)}<span className="text-sm text-ink-faint font-medium">/{tenderFlow.lot.uom}</span></div>
              <div className="text-xs text-ink-muted mt-1 italic">{inrWords(tenderFlow.rate)} per {tenderFlow.lot.uom}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setTenderFlow(null)}>Cancel</Button>
              <Button className="flex-1" onClick={() => {
                const res = placeBid(tenderFlow.lot.id, tenderFlow.rate, undefined, 'tender')
                pushToast(res.ok
                  ? { kind: 'success', title: `Offer submitted — ${inr(tenderFlow.rate)}/${tenderFlow.lot.uom}`, body: `${tenderFlow.lot.lotNo} · sealed, cannot be revised` }
                  : { kind: 'danger', title: 'Offer rejected', body: res.error })
                setTenderFlow(null)
              }}>Confirm</Button>
            </div>
          </div>
        )}
      </Modal>
      </Page>

      {/* --------------------- sticky selection summary bar ---------------------- */}
      {hasSelection && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-line bg-surface/95 backdrop-blur shadow-[0_-8px_30px_-16px_rgb(0_0_0/0.3)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="num text-sm">
              <b>{summary.count}</b> lot{summary.count === 1 ? '' : 's'} selected
              <span className="text-ink-faint"> · </span>Pre-bid EMD <b>{inr(scopeRequired)}</b>
              <span className="text-ink-faint"> · </span>Funded <b className="text-success">{inr(summary.funded)}</b>
              <span className="text-ink-faint"> · </span>Shortfall <b className={scopeShortfall > 0 ? 'text-ember-strong' : 'text-success'}>{inr(scopeShortfall)}</b>
            </div>
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              {scopeShortfall > 0 ? (
                deadlinePassed ? (
                  <EmdExemptionControl catalogueId={cat.id} />
                ) : (
                  <Button variant="steel" onClick={() => setConfirmOpen(true)}>
                    <Lock size={15} /> Pay EMD for shortlisted lots {inr(scopeShortfall)}
                  </Button>
                )
              ) : (
                <Chip tone="success">EMD fully funded</Chip>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Inline sealed-tender offer control for a funded lot — full-width so it wraps
 *  onto its own line under the lot row (both tabs' rows are flex-wrap). Once
 *  `myOffer` exists the input is gone for good: one sealed offer, no revisions. */
function TenderOfferRow({ lot, myOffer, onSubmit }: {
  lot: Lot
  myOffer: Bid | undefined
  onSubmit: (lot: Lot, rate: number) => void
}) {
  const [rate, setRate] = useState(lot.startRate)

  if (myOffer) {
    return (
      <div className="w-full mt-1 pt-2.5 border-t border-line/70 flex items-center justify-end gap-2 text-sm">
        <Lock size={13} className="text-ink-faint shrink-0" />
        <span className="font-semibold text-success">Offer submitted {inr(myOffer.rate)}/{lot.uom}</span>
        <span className="text-ink-faint text-xs">— sealed, cannot be revised</span>
      </div>
    )
  }
  if (lot.status !== 'live') return null

  return (
    <div className="w-full mt-1 pt-2.5 border-t border-line/70 flex flex-wrap items-center justify-end gap-2">
      {rate < lot.startRate && (
        <span className="text-xs font-semibold text-danger">Minimum offer is {inr(lot.startRate)}/{lot.uom}.</span>
      )}
      <span className="text-xs font-semibold text-ink-muted shrink-0">Tender amount (₹/{lot.uom})</span>
      <Input inputMode="numeric" className="num h-8 w-32 text-right" value={rate.toLocaleString('en-IN')}
        onChange={(e) => setRate(Number(e.target.value.replace(/[^\d]/g, '')) || 0)} />
      <Button size="sm" disabled={rate < lot.startRate} onClick={() => onSubmit(lot, rate)}>
        <Gavel size={13} /> Submit offer
      </Button>
    </div>
  )
}
