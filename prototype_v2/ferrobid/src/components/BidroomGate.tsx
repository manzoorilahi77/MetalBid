/* ---------------------------------------------------------------------------
   The bidding-room gate — the ONE path into /bidding/:catalogueId.

   Every trigger in the app (dashboard, catalogue sticky bar, shortlist, my
   bids, and the "Bid Now" header shortcut) calls into this provider, so the
   rules can't drift apart:

     shortlist check → pending EMD → terms & conditions → navigate

   "Bid Now" prepends two more steps (pick a live auction, review its lots)
   before joining the same sequence. Cancelling out of the EMD step returns to
   the auction list when the flow started there, and simply closes otherwise.

   Terms are confirmed on EVERY entry, even when `termsAccepted` already has a
   version recorded for the catalogue — one rule, no branches.
--------------------------------------------------------------------------- */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, Gavel, Lock, Star, Wallet as WalletIcon } from 'lucide-react'
import { Button, Chip, Countdown, Modal, StatusChip } from './ui'
import { catalogueUiStatus, selectionSummary, useStore } from '../store/store'
import { emdBlockedMessage, emdWindowClosed } from '../lib/emd'
import { inr, inrWords, num } from '../lib/format'
import type { Catalogue } from '../types'

type Step = 'auctions' | 'lots' | 'emd' | 'terms'

interface Flow {
  step: Step
  catalogueId: string | null
  /** Started from the "Bid Now" shortcut, so Cancel/Back go to the auction list. */
  fromBidNow: boolean
  /** Preserved through the gate so "Go to bidding room" still lands on its lot. */
  lotId?: string
}

interface GateApi {
  /** Run the gate for one catalogue and, if it clears, enter its bidroom. */
  enterBidroom: (catalogueId: string, opts?: { lotId?: string }) => void
  /** Open the "Bid Now" shortcut at the my-live-auctions step. */
  openBidNow: () => void
}

const Ctx = createContext<GateApi | null>(null)

/** Entry points call this; it never returns null so callers stay branch-free. */
export function useBidroomGate(): GateApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useBidroomGate must be used inside <BidroomGateProvider>')
  return ctx
}

export function BidroomGateProvider({ children }: { children: ReactNode }) {
  const [flow, setFlow] = useState<Flow | null>(null)
  const me = useStore((s) => s.currentUser)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const selections = useStore((s) => s.selections)

  const enterBidroom = useCallback<GateApi['enterBidroom']>((catalogueId, opts) => {
    const s = useStore.getState()
    if (!s.currentUser) {
      s.pushToast({ kind: 'warning', title: 'Sign in to bid', body: 'Use the demo role switcher or the login screen.' })
      return
    }
    const cat = s.catalogues.find((c) => c.id === catalogueId)
    if (!cat) return
    const summary = selectionSummary(s, s.currentUser.id, catalogueId)
    if (summary.count === 0) {
      s.pushToast({
        kind: 'warning',
        title: `Shortlist at least one lot in ${cat.code}`,
        body: 'The bidding room only opens for lots you have shortlisted.',
      })
      return
    }
    setFlow({
      step: summary.unfundedLotIds.length > 0 ? 'emd' : 'terms',
      catalogueId, fromBidNow: false, lotId: opts?.lotId,
    })
  }, [])

  const openBidNow = useCallback<GateApi['openBidNow']>(() => {
    const s = useStore.getState()
    if (!s.currentUser) {
      s.pushToast({ kind: 'warning', title: 'Sign in to bid', body: 'Use the demo role switcher or the login screen.' })
      return
    }
    setFlow({ step: 'auctions', catalogueId: null, fromBidNow: true })
  }, [])

  const api = useMemo<GateApi>(() => ({ enterBidroom, openBidNow }), [enterBidroom, openBidNow])

  const close = () => setFlow(null)
  const cat = flow?.catalogueId ? catalogues.find((c) => c.id === flow.catalogueId) ?? null : null
  const summary = selectionSummary({ selections, lots }, me?.id, flow?.catalogueId ?? '')

  /* Live catalogues the buyer has shortlisted at least one lot in — step (a). */
  const myLiveAuctions = useMemo(() => {
    if (!me) return []
    return catalogues.filter((c) =>
      c.status === 'live' &&
      selections.some((x) => x.buyerId === me.id && x.catalogueId === c.id && x.lotIds.length > 0))
  }, [catalogues, selections, me])

  /** Called when the EMD step clears (or was skipped) — terms are always next. */
  const toTerms = () => setFlow((f) => (f ? { ...f, step: 'terms' } : f))

  return (
    <Ctx.Provider value={api}>
      {children}

      <AuctionPickerStep
        open={flow?.step === 'auctions'}
        auctions={myLiveAuctions}
        onClose={close}
        onPick={(id) => setFlow({ step: 'lots', catalogueId: id, fromBidNow: true })}
      />

      <LotPickerStep
        open={flow?.step === 'lots' && !!cat}
        cat={cat}
        onBack={() => setFlow({ step: 'auctions', catalogueId: null, fromBidNow: true })}
        onClose={close}
        onContinue={() => {
          if (!cat) return
          setFlow((f) => (f ? { ...f, step: summary.unfundedLotIds.length > 0 ? 'emd' : 'terms' } : f))
        }}
      />

      <PendingEmdStep
        open={flow?.step === 'emd' && !!cat}
        cat={cat}
        onCancel={() => {
          if (flow?.fromBidNow) setFlow({ step: 'auctions', catalogueId: null, fromBidNow: true })
          else close()
        }}
        onPaid={toTerms}
      />

      <TermsStep
        open={flow?.step === 'terms' && !!cat}
        cat={cat}
        onCancel={() => {
          if (flow?.fromBidNow) setFlow({ step: 'auctions', catalogueId: null, fromBidNow: true })
          else close()
        }}
        lotId={flow?.lotId}
        onDone={close}
      />
    </Ctx.Provider>
  )
}

/* --------------------- (a) pick one of my live auctions -------------------- */
function AuctionPickerStep({ open, auctions, onClose, onPick }: {
  open: boolean; auctions: Catalogue[]; onClose: () => void; onPick: (catalogueId: string) => void
}) {
  const me = useStore((s) => s.currentUser)
  const lots = useStore((s) => s.lots)
  const selections = useStore((s) => s.selections)
  const now = useStore((s) => s.now)

  return (
    <Modal open={open} onClose={onClose} title="Bid now — pick an auction">
      {auctions.length === 0 ? (
        <div className="py-6 text-center">
          <div className="mx-auto size-12 rounded-2xl bg-surface-2 grid place-items-center text-ink-faint"><Gavel size={22} /></div>
          <div className="font-bold mt-3">No live auctions on your shortlist</div>
          <p className="text-sm text-ink-muted mt-1 max-w-sm mx-auto">
            Shortlist lots in a catalogue and it shows up here the moment that auction goes live.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-ink-muted">
            These are the live auctions you have shortlisted lots in. Pick one to review its lots and enter the room.
          </p>
          {auctions.map((c) => {
            const s = selectionSummary({ selections, lots }, me?.id, c.id)
            const catLots = lots.filter((l) => l.catalogueId === c.id)
            return (
              <button key={c.id} onClick={() => onPick(c.id)}
                className="w-full text-left card card-hover p-4 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="num text-[11px] font-bold text-ink-faint">{c.code}</span>
                    <StatusChip status={catalogueUiStatus(c, now, catLots)} />
                  </div>
                  <div className="font-semibold text-sm mt-1 line-clamp-1">{c.title}</div>
                  <div className="text-xs text-ink-muted mt-0.5">
                    <span className="num font-semibold">{s.count}</span> shortlisted
                    {s.shortfall > 0
                      ? <> · <span className="text-warning font-semibold">EMD pending {inr(s.shortfall)}</span></>
                      : <> · <span className="text-success font-semibold">EMD funded</span></>}
                  </div>
                </div>
                <Countdown endsAt={c.endsAt} prefix="ends" size="sm" />
              </button>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

/* ------------- (b) every lot in the catalogue, star to shortlist ----------- */
function LotPickerStep({ open, cat, onBack, onClose, onContinue }: {
  open: boolean; cat: Catalogue | null; onBack: () => void; onClose: () => void; onContinue: () => void
}) {
  const me = useStore((s) => s.currentUser)
  const lots = useStore((s) => s.lots)
  const selections = useStore((s) => s.selections)
  const toggleShortlist = useStore((s) => s.toggleShortlist)
  const pushToast = useStore((s) => s.pushToast)
  if (!cat) return null

  const catLots = lots.filter((l) => l.catalogueId === cat.id)
  const summary = selectionSummary({ selections, lots }, me?.id, cat.id)

  return (
    <Modal open={open} onClose={onClose} wide
      title={<span className="flex items-center gap-2"><span className="num text-sm text-ink-faint">{cat.code}</span> Lots in this auction</span>}>
      <p className="text-sm text-ink-muted">
        Star the lots you want to bid on. Pre-bid EMD is locked per lot — only starred lots enter the room with you.
      </p>

      <div className="mt-3 card bg-surface-2 border-0 divide-y divide-line max-h-[45vh] overflow-y-auto">
        {catLots.map((l) => {
          const shortlisted = summary.lotIds.includes(l.id)
          const funded = summary.fundedLotIds.includes(l.id)
          return (
            <div key={l.id} className="flex items-center gap-3 px-3 py-2.5">
              <button
                onClick={() => {
                  if (funded) {
                    pushToast({ kind: 'info', title: `${l.lotNo} stays shortlisted`, body: 'EMD is locked on this lot until the auction closes.' })
                    return
                  }
                  toggleShortlist(cat.id, l.id)
                }}
                aria-label={shortlisted ? `Remove ${l.lotNo} from shortlist` : `Shortlist ${l.lotNo}`}
                aria-pressed={shortlisted}
                className={`p-1.5 rounded-lg shrink-0 transition-colors ${shortlisted ? 'text-ember' : 'text-ink-faint hover:text-ink'} ${funded ? 'cursor-default' : 'hover:bg-surface'}`}
              >
                <Star size={18} fill={shortlisted ? 'currentColor' : 'none'} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="num text-sm font-bold">{l.lotNo}</span>
                  <Chip tone="neutral">{l.metal}</Chip>
                </div>
                <div className="text-xs text-ink-muted line-clamp-1 mt-0.5">{l.description}</div>
                <div className="text-[11px] text-ink-faint mt-0.5 num">
                  {num(l.indicativeQty)} {l.uom} · start {inr(l.startRate)}/{l.uom} · EMD {inr(l.preBidEmd)}
                </div>
              </div>
              {funded
                ? <Chip tone="success">EMD paid</Chip>
                : shortlisted
                  ? <Chip tone="warning">EMD pending</Chip>
                  : <Chip tone="neutral">Not shortlisted</Chip>}
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <Button variant="ghost" onClick={onBack}><ArrowLeft size={15} /> Auctions</Button>
        <span className="text-sm text-ink-muted ml-auto">
          <span className="num font-bold text-ink">{summary.count}</span> shortlisted
          {summary.shortfall > 0 && <> · EMD due <span className="num font-bold text-warning">{inr(summary.shortfall)}</span></>}
        </span>
        <span title={summary.count === 0 ? 'Shortlist at least one lot to continue' : undefined}>
          <Button disabled={summary.count === 0} onClick={onContinue}>
            <Gavel size={15} /> Enter bidding room
          </Button>
        </span>
      </div>
      {summary.count === 0 && (
        <p className="text-xs font-semibold text-ink-faint mt-2 text-right">Shortlist at least one lot to continue.</p>
      )}
    </Modal>
  )
}

/* --------------------- (c) clear any pending pre-bid EMD ------------------- */
function PendingEmdStep({ open, cat, onCancel, onPaid }: {
  open: boolean; cat: Catalogue | null; onCancel: () => void; onPaid: () => void
}) {
  const me = useStore((s) => s.currentUser)
  const lots = useStore((s) => s.lots)
  const selections = useStore((s) => s.selections)
  const wallets = useStore((s) => s.wallets)
  const now = useStore((s) => s.now)
  const fundEmd = useStore((s) => s.fundEmd)
  const pushToast = useStore((s) => s.pushToast)
  const [paying, setPaying] = useState(false)
  if (!cat) return null

  const summary = selectionSummary({ selections, lots }, me?.id, cat.id)
  const pendingLots = lots.filter((l) => summary.unfundedLotIds.includes(l.id))
  const balance = wallets.find((w) => w.userId === me?.id)?.balance ?? 0
  const closed = emdWindowClosed(cat, now)
  const enough = balance >= summary.shortfall

  const pay = () => {
    setPaying(true)
    window.setTimeout(() => {
      const ok = fundEmd(cat.id, summary.unfundedLotIds, 'Wallet')
      setPaying(false)
      if (!ok) {
        pushToast({ kind: 'danger', title: 'Could not lock EMD', body: `Top up your wallet — ${inr(summary.shortfall)} needed.` })
        return
      }
      pushToast({
        kind: 'success',
        title: `EMD locked for ${pendingLots.length} lot${pendingLots.length > 1 ? 's' : ''}`,
        body: `${inr(summary.shortfall)} locked against ${cat.code}.`,
      })
      onPaid()
    }, 900)
  }

  return (
    <Modal open={open} onClose={onCancel} title="Pre-bid EMD pending">
      {closed ? (
        <div className="space-y-4">
          <div className="card border-danger/40 bg-danger-soft p-4 flex gap-3">
            <AlertTriangle size={18} className="text-danger shrink-0 mt-0.5" />
            <p className="text-sm text-danger font-semibold">{emdBlockedMessage(cat)}</p>
          </div>
          <Button variant="secondary" className="w-full" onClick={onCancel}>Close</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            {pendingLots.length} shortlisted lot{pendingLots.length > 1 ? 's' : ''} in <span className="num font-semibold text-ink">{cat.code}</span>
            {pendingLots.length === 1 ? ' still needs' : ' still need'} pre-bid EMD before you can enter the room.
          </p>
          <div className="card bg-surface-2 border-0 divide-y divide-line">
            {pendingLots.map((l) => (
              <div key={l.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span><b className="num">{l.lotNo}</b> <span className="text-ink-muted">{l.grade}</span></span>
                <span className="num font-semibold text-warning">{inr(l.preBidEmd)}</span>
              </div>
            ))}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold">Total EMD due</span>
                <span className="num text-lg font-bold text-ember-strong">{inr(summary.shortfall)}</span>
              </div>
              <div className="text-xs text-ink-muted mt-1 text-right italic">{inrWords(summary.shortfall)}</div>
            </div>
          </div>
          <p className="text-xs text-ink-faint flex items-center gap-1.5">
            <WalletIcon size={13} /> Wallet balance {inr(balance)} · EMD auto-releases if you aren't H1.
          </p>
          {!enough && (
            <div className="card border-danger/40 bg-danger-soft px-4 py-2.5 text-sm text-danger font-semibold">
              Wallet balance is short. Top up from Wallet & EMD ledger first.
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={onCancel}>Cancel</Button>
            <Button className="flex-[2]" loading={paying} disabled={!enough} onClick={pay}>
              <Lock size={15} /> Pay {inr(summary.shortfall)}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ------------------------- (d) terms, every time -------------------------- */
function TermsStep({ open, cat, onCancel, onDone, lotId }: {
  open: boolean; cat: Catalogue | null; onCancel: () => void; onDone: () => void; lotId?: string
}) {
  const termsSets = useStore((s) => s.termsSets)
  const acceptTerms = useStore((s) => s.acceptTerms)
  const [agree, setAgree] = useState(false)
  const nav = useNavigate()
  if (!cat) return null
  const terms = termsSets.find((t) => t.id === cat.termsSetId)

  return (
    <Modal open={open} onClose={() => { setAgree(false); onCancel() }} wide
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
        <Button variant="ghost" className="flex-1" onClick={() => { setAgree(false); onCancel() }}>Cancel</Button>
        <Button className="flex-[2]" disabled={!agree} onClick={() => {
          acceptTerms(cat.id)
          setAgree(false)
          onDone()
          nav(lotId ? `/bidding/${cat.id}?lot=${lotId}` : `/bidding/${cat.id}`)
        }}>
          <Check size={15} /> Enter bidding room
        </Button>
      </div>
    </Modal>
  )
}
