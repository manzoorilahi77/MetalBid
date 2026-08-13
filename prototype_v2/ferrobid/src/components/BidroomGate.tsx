/* ---------------------------------------------------------------------------
   The bidding-room gate — the ONE path into /bidding/:catalogueId.

   Every trigger in the app (dashboard, catalogue sticky bar, shortlist, my
   bids, and the "Bid Now" header shortcut) calls into this provider, so the
   rules can't drift apart:

     shortlist check → pending EMD → terms & conditions → navigate

   "Bid Now" is two full pages (pick a live auction, review its lots — see
   pages/buyer/BidNowAuctions.tsx and BidNowLots.tsx) that feed into this same
   gate once a catalogue is picked. Cancelling out of the EMD/terms steps
   returns to the lot-review page when the flow started from "Bid Now", and
   simply closes otherwise.

   Terms are confirmed on EVERY entry, even when `termsAccepted` already has a
   version recorded for the catalogue — one rule, no branches.
--------------------------------------------------------------------------- */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, Gavel, Lock, Wallet as WalletIcon } from 'lucide-react'
import { Button, Chip, Modal } from './ui'
import { EmdExemptionControl } from './EmdExemption'
import { latestEmdExemptionRequest, selectionSummary, useStore } from '../store/store'
import { emdBlockedMessage, emdWindowClosed } from '../lib/emd'
import { inr, inrWords } from '../lib/format'
import type { Catalogue } from '../types'

type Step = 'emd' | 'terms'

interface Flow {
  step: Step
  catalogueId: string
  /** Started from the "Bid Now" shortcut, so Cancel goes back to the lot-review page. */
  fromBidNow: boolean
  /** Preserved through the gate so "Go to bidding room" still lands on its lot. */
  lotId?: string
}

interface GateApi {
  /** Run the gate for one catalogue and, if it clears, enter its bidroom. */
  enterBidroom: (catalogueId: string, opts?: { lotId?: string; fromBidNow?: boolean }) => void
  /** Open the "Bid Now" shortcut — the full-page live-auction picker. */
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
  const nav = useNavigate()

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
      catalogueId, fromBidNow: opts?.fromBidNow ?? false, lotId: opts?.lotId,
    })
  }, [])

  const openBidNow = useCallback<GateApi['openBidNow']>(() => {
    const s = useStore.getState()
    if (!s.currentUser) {
      s.pushToast({ kind: 'warning', title: 'Sign in to bid', body: 'Use the demo role switcher or the login screen.' })
      return
    }
    nav('/buyer/bid-now')
  }, [nav])

  const api = useMemo<GateApi>(() => ({ enterBidroom, openBidNow }), [enterBidroom, openBidNow])

  const close = () => setFlow(null)
  const cat = flow ? catalogues.find((c) => c.id === flow.catalogueId) ?? null : null
  const summary = selectionSummary({ selections, lots }, me?.id, flow?.catalogueId ?? '')

  /** Cancelling out of EMD/terms started from "Bid Now" returns to that
   *  catalogue's lot-review page instead of just closing. */
  const cancelToOrigin = () => {
    if (flow?.fromBidNow) nav(`/buyer/bid-now/${flow.catalogueId}`)
    else close()
  }

  /** Called when the EMD step clears (or was skipped) — terms are always next. */
  const toTerms = () => setFlow((f) => (f ? { ...f, step: 'terms' } : f))

  return (
    <Ctx.Provider value={api}>
      {children}

      <PendingEmdStep
        open={flow?.step === 'emd' && !!cat}
        cat={cat}
        onCancel={cancelToOrigin}
        onPaid={toTerms}
      />

      <TermsStep
        open={flow?.step === 'terms' && !!cat}
        cat={cat}
        onCancel={cancelToOrigin}
        lotId={flow?.lotId}
        onDone={close}
      />
    </Ctx.Provider>
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
  const emdExemptionRequests = useStore((s) => s.emdExemptionRequests)
  const fundEmd = useStore((s) => s.fundEmd)
  const pushToast = useStore((s) => s.pushToast)
  const [paying, setPaying] = useState(false)
  if (!cat) return null

  const summary = selectionSummary({ selections, lots }, me?.id, cat.id)
  const pendingLots = lots.filter((l) => summary.unfundedLotIds.includes(l.id))
  const balance = wallets.find((w) => w.userId === me?.id)?.balance ?? 0
  // An approved exemption reopens funding despite the deadline — same rule
  // fundEmd's own backstop enforces, surfaced here so the request button
  // (not a dead-end banner) is what a locked-out buyer actually sees.
  const exemption = me ? latestEmdExemptionRequest({ emdExemptionRequests }, me.id, cat.id) : undefined
  const closed = emdWindowClosed(cat, now) && exemption?.status !== 'approved'
  const enough = balance >= summary.shortfall
  // Frozen lots can't be paid, but lots funded before the cut-off are still
  // good — don't hold the whole room hostage to the ones that can't recover.
  const canContinueWithFunded = closed && summary.fundedLotIds.length > 0

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
            <div className="text-sm text-danger font-semibold space-y-1">
              <p>{emdBlockedMessage(cat)}</p>
              {canContinueWithFunded && (
                <p className="font-normal">
                  {pendingLots.length} lot{pendingLots.length > 1 ? 's' : ''} stay frozen — your{' '}
                  {summary.fundedLotIds.length} already-funded lot{summary.fundedLotIds.length > 1 ? 's are' : ' is'} still good to bid on.
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={onCancel}>Close</Button>
            <EmdExemptionControl catalogueId={cat.id} size="md" />
          </div>
          {canContinueWithFunded && (
            <Button className="w-full" onClick={onPaid}>
              <Gavel size={15} /> Continue with {summary.fundedLotIds.length} funded lot{summary.fundedLotIds.length > 1 ? 's' : ''}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            {pendingLots.length} shortlisted lot{pendingLots.length > 1 ? 's' : ''} in <span className="num font-semibold text-ember">{cat.code}</span>
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
