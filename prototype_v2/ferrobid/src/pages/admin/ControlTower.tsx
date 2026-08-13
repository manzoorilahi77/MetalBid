/* ---------------------------------------------------------------------------
   Super Admin — Emergency override.

   The end of every escalation in the product. Three things can only be finished
   here, and each of them arrives having been raised by somebody else:

   · **Void a bid** — surveillance flags it, the Auction Manager requests it, we
     decide. Three pairs of eyes on undoing a customer's offer.
   · **Approve a cancellation** — cancelling voids every open lot and releases
     all locked EMD, so it is never executed by the desk that asks for it.
   · **Bypass exceptions** — lots accepted without a field inspection. Not an
     approval queue by design: a bypass is controlled by a typed reason and an
     audit entry rather than a second signature, so this is the review that
     makes it visible.

   Below them, the live floor: pause, resume, extend, cancel. Every action here
   lands in the audit trail with our name on it.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Ban, ChevronDown, Clock, Gavel, Pause, Play, ShieldAlert, Signature, Zap } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Button, Chip, Countdown, EmptyState, Field, Modal, PageHeader, Stat, StatusChip, Textarea, cx,
} from '../../components/ui'
import { catalogueUiStatus, useStore } from '../../store/store'
import { fmtDate, fmtDateTime, inr, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type { Bid, Catalogue, CeoApprovalRequest } from '../../types'

export default function ControlTower() {
  const now = useNow()
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const bids = useStore((s) => s.bids)
  const users = useStore((s) => s.users)
  const paused = useStore((s) => s.paused)
  const pauseCatalogue = useStore((s) => s.pauseCatalogue)
  const resumeCatalogue = useStore((s) => s.resumeCatalogue)
  const extendCatalogue = useStore((s) => s.extendCatalogue)
  const cancelCatalogue = useStore((s) => s.cancelCatalogue)
  const voidBid = useStore((s) => s.voidBid)
  const pushToast = useStore((s) => s.pushToast)

  const [expanded, setExpanded] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Catalogue | null>(null)
  const [voidTarget, setVoidTarget] = useState<Bid | null>(null)
  const [reason, setReason] = useState('')

  const active = catalogues.filter((c) => c.status === 'live' || c.status === 'upcoming')

  return (
    <Page>
      <PageHeader title="Emergency override"
        sub="Where every escalation ends: void a bid, approve a cancellation, review a bypass — then the live floor itself. Nothing here is a fresh decision; each one was raised by another desk and is waiting on us." />

      <SignatureQueue />
      <Escalations />

      <h2 className="text-lg font-bold mt-10 mb-1 flex items-center gap-2"><Gavel size={17} className="text-ember" /> Live floor</h2>
      <p className="text-sm text-ink-muted mb-4">
        Pause, resume, extend or cancel a running catalogue. The Auction Manager and a Sub Admin hold pause, resume and extend as well —
        this is the same floor, not a second copy of it.
      </p>
      {active.length === 0 && <EmptyState title="No live or upcoming catalogues" />}
      <div className="space-y-4">
        {active.map((c) => {
          const cl = lots.filter((l) => l.catalogueId === c.id)
          const liveLots = cl.filter((l) => l.status === 'live')
          const cBids = bids.filter((b) => b.catalogueId === c.id && b.status === 'valid')
            .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
          const isPaused = !!paused[c.id]
          const isLive = c.status === 'live'
          const ui = catalogueUiStatus(c, now, cl)
          const extensions = cl.reduce((s, l) => s + l.extensions, 0)
          return (
            <div key={c.id} className={cx('card overflow-hidden', isPaused && 'border-danger/50')}>
              <div className="p-5 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-64">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusChip status={ui} />
                    {isPaused && <Chip tone="danger" pulse>PAUSED</Chip>}
                    <span className="num text-xs font-bold text-ember">{c.code}</span>
                    {extensions > 0 && <Chip tone="warning" className="num"><Zap size={11} /> {extensions} anti-snipe ext</Chip>}
                  </div>
                  <div className="font-display font-bold text-lg mt-1">{c.title}</div>
                  <div className="num text-xs text-ink-muted mt-1">
                    {isLive ? `${liveLots.length}/${cl.length} lots live` : `${cl.length} lots · starts ${fmtDateTime(c.startsAt)}`} · {cBids.length} bids
                  </div>
                </div>
                {isLive && <Countdown endsAt={c.endsAt} prefix="closes" size="lg" />}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="secondary" size="sm" disabled={!isLive || isPaused}
                    onClick={() => { pauseCatalogue(c.id); pushToast({ kind: 'warning', title: `${c.code} paused`, body: 'Countdowns frozen; bids rejected while paused.' }) }}>
                    <Pause size={14} /> Pause
                  </Button>
                  <Button variant="success" size="sm" disabled={!isPaused}
                    onClick={() => { resumeCatalogue(c.id); pushToast({ kind: 'success', title: `${c.code} resumed` }) }}>
                    <Play size={14} /> Resume
                  </Button>
                  <Button variant="steel" size="sm" disabled={!isLive}
                    onClick={() => { extendCatalogue(c.id, 15); pushToast({ kind: 'info', title: `${c.code} extended`, body: 'All live lots pushed by 15 minutes.' }) }}>
                    <Clock size={14} /> +15 min
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => { setCancelTarget(c); setReason('') }}>
                    <Ban size={14} /> Cancel
                  </Button>
                </div>
              </div>
              <button className="w-full px-5 py-2.5 border-t border-line text-[13px] font-semibold text-ink-muted hover:bg-surface-2 flex items-center justify-center gap-1.5"
                onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                Recent bids <ChevronDown size={14} className={cx('transition-transform', expanded === c.id && 'rotate-180')} />
              </button>
              {expanded === c.id && (
                <div className="border-t border-line divide-y divide-line bg-surface-2/40">
                  {cBids.slice(0, 8).map((b) => {
                    const l = lots.find((x) => x.id === b.lotId)!
                    const u = users.find((x) => x.id === b.bidderId)
                    return (
                      <div key={b.id} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                        <span className="num text-xs text-ink-faint w-24 shrink-0">{fmtDateTime(b.at)}</span>
                        <span className="num font-bold w-16">{l.lotNo}</span>
                        <span className="flex-1 truncate text-ink-muted">{u?.firm ?? b.bidderId}</span>
                        <Chip tone={b.type === 'manual' ? 'neutral' : 'steel'}>{b.type}</Chip>
                        <span className="num font-bold w-24 text-right">{inr(b.rate)}</span>
                        <Button variant="ghost" size="sm" className="text-danger" onClick={() => { setVoidTarget(b); setReason('') }}>Void</Button>
                      </div>
                    )
                  })}
                  {cBids.length === 0 && <div className="px-5 py-4 text-sm text-ink-faint">No bids yet.</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* cancel confirm */}
      <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)} title={`Cancel ${cancelTarget?.code}?`}>
        <p className="text-sm text-ink-muted">
          All open lots become <b>unsold</b>, bidding stops immediately and locked EMD auto-releases to buyers. This cannot be undone in-session.
        </p>
        <Field label="Reason (audit trail)" className="mt-4">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. seller withdrew material after yard incident" />
        </Field>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={() => setCancelTarget(null)}>Keep running</Button>
          <Button variant="danger" disabled={!reason.trim()}
            onClick={() => {
              cancelCatalogue(cancelTarget!.id)
              pushToast({ kind: 'danger', title: `${cancelTarget!.code} cancelled`, body: 'Open lots voided; EMD released.' })
              setCancelTarget(null)
            }}>
            Cancel catalogue
          </Button>
        </div>
      </Modal>

      {/* void bid confirm */}
      <Modal open={!!voidTarget} onClose={() => setVoidTarget(null)} title="Void this bid?">
        {voidTarget && (
          <>
            <div className="card bg-surface-2 border-0 p-4 text-sm">
              <div className="flex justify-between"><span className="text-ink-muted">Bid</span><span className="num font-bold">{inr(voidTarget.rate)}</span></div>
              <div className="flex justify-between mt-1"><span className="text-ink-muted">Bidder</span><span className="font-semibold">{users.find((u) => u.id === voidTarget.bidderId)?.firm}</span></div>
              <div className="flex justify-between mt-1"><span className="text-ink-muted">Lot</span><span className="num font-semibold">{lots.find((l) => l.id === voidTarget.lotId)?.lotNo}</span></div>
            </div>
            <Field label="Reason (audit trail)" className="mt-4">
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. wallet failed EMD re-validation" />
            </Field>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="ghost" onClick={() => setVoidTarget(null)}>Keep bid</Button>
              <Button variant="danger" disabled={!reason.trim()}
                onClick={() => {
                  voidBid(voidTarget.id)
                  pushToast({ kind: 'danger', title: 'Bid voided', body: `Lot leader recomputed from remaining valid bids (${num(bids.filter((b) => b.lotId === voidTarget.lotId && b.status === 'valid').length - 1)} left).` })
                  setVoidTarget(null)
                }}>
                Void bid
              </Button>
            </div>
          </>
        )}
      </Modal>
    </Page>
  )
}

/* ---------------------------------------------------------------------------
   The three escalations that end here.

   Each one arrives already argued: a bid flagged by surveillance and escalated
   by the Auction Manager, a cancellation asked for by whoever is running the
   sale, a lot let through without an inspection. We are the last pair of eyes,
   which is why the consequence of each decision is spelled out on the row
   rather than left to be remembered.
--------------------------------------------------------------------------- */
function Escalations() {
  const now = useNow()
  const voidRequests = useStore((s) => s.bidVoidRequests)
  const cancellations = useStore((s) => s.cancellationRequests)
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const bids = useStore((s) => s.bids)
  const users = useStore((s) => s.users)
  const decideBidVoidRequest = useStore((s) => s.decideBidVoidRequest)
  const decideCancellationRequest = useStore((s) => s.decideCancellationRequest)
  const pushToast = useStore((s) => s.pushToast)

  const [refusing, setRefusing] = useState<{ kind: 'void' | 'cancel'; id: string; label: string } | null>(null)
  const [note, setNote] = useState('')

  /* Only requests that have actually been escalated to us. A flag that
     surveillance has raised but the Auction Manager has not sent on is still
     their work, and showing it here would invite us to decide it early. */
  const pendingVoids = voidRequests.filter((r) => r.status === 'pending' && r.stage === 'requested')
  const pendingCancels = cancellations.filter((r) => r.status === 'pending')
  const bypassed = lots
    .filter((l) => l.inspectionWaived && l.waivedAt)
    .sort((a, b) => Date.parse(b.waivedAt!) - Date.parse(a.waivedAt!))
    .slice(0, 6)

  const firm = (id?: string | null) => users.find((u) => u.id === id)?.firm ?? users.find((u) => u.id === id)?.name ?? '—'
  const who = (id?: string | null) => users.find((u) => u.id === id)?.name ?? 'the desk'
  const cat = (id: string) => catalogues.find((c) => c.id === id)

  const nothingWaiting = pendingVoids.length === 0 && pendingCancels.length === 0

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Void requests" value={pendingVoids.length} tone={pendingVoids.length ? 'danger' : undefined} sub="only we can void" />
        <Stat label="Cancellation requests" value={pendingCancels.length} tone={pendingCancels.length ? 'danger' : undefined} sub="only we can approve" />
        <Stat label="Live catalogues" value={catalogues.filter((c) => c.status === 'live').length} tone="ember" />
        <Stat label="Bypassed lots" value={lots.filter((l) => l.inspectionWaived).length} tone="warning" sub="accepted without inspection" />
      </div>

      {nothingWaiting && (
        <div className="card border-l-4 border-l-success p-4 mb-6 text-[13px] text-ink-muted">
          <strong className="text-ink">Nothing is waiting on us.</strong> Void and cancellation requests land here the moment the
          Auction Manager or a Sub Admin escalates one — from{' '}
          <Link to="/auction/bid-monitor" className="text-ember font-semibold hover:underline">Bid monitor</Link> and{' '}
          <Link to="/auction/live" className="text-ember font-semibold hover:underline">Live auctions</Link> respectively.
        </div>
      )}

      {/* ------------------------------ void a bid ------------------------------ */}
      {pendingVoids.length > 0 && (
        <div className="card border-l-4 border-l-danger overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-line bg-surface-2/60 flex flex-wrap items-center gap-2">
            <ShieldAlert size={15} className="text-danger" />
            <span className="font-bold text-sm">Void requests</span>
            <Chip tone="danger">{num(pendingVoids.length)}</Chip>
            <span className="text-[12px] text-ink-muted ml-auto">
              Surveillance flagged it, the Auction Manager escalated it. Voiding recomputes the lot's leader from the bids that remain.
            </span>
          </div>
          <div className="divide-y divide-line">
            {pendingVoids.map((r) => {
              const bid = bids.find((b) => b.id === r.bidId)
              const lot = lots.find((l) => l.id === r.lotId)
              const c = cat(r.catalogueId)
              const stillValid = bid?.status === 'valid'
              return (
                <div key={r.id} className="px-4 py-3.5 flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Chip tone="danger">{r.reason}</Chip>
                      <span className="num text-xs font-bold text-ember">{c?.code}</span>
                      <span className="num text-sm font-bold">{lot?.lotNo}</span>
                      <span className="text-sm text-ink-muted">{firm(bid?.bidderId)}</span>
                      {!stillValid && <Chip tone="neutral">already void</Chip>}
                    </div>
                    {r.notes && <p className="text-[13px] text-ink-muted mt-1">{r.notes}</p>}
                    <div className="text-[11px] text-ink-faint mt-1">
                      Flagged by {who(r.raisedBy)} · escalated {r.requestedAt ? relTime(r.requestedAt, now) : relTime(r.raisedAt, now)} ·{' '}
                      <Link to="/auction/bid-monitor" className="text-ember font-semibold hover:underline">Bid monitor</Link>
                    </div>
                  </div>
                  <div className="num text-base font-bold shrink-0 w-28 text-right">{bid ? inr(bid.rate) : '—'}</div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="secondary" onClick={() => { setRefusing({ kind: 'void', id: r.id, label: `${lot?.lotNo} · ${firm(bid?.bidderId)}` }); setNote('') }}>
                      Let it stand
                    </Button>
                    <Button size="sm" variant="danger" disabled={!stillValid}
                      onClick={() => {
                        decideBidVoidRequest(r.id, true)
                        pushToast({ kind: 'danger', title: 'Bid voided', body: `${lot?.lotNo} — the leader is recomputed from the bids that remain.` })
                      }}>
                      Void the bid
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ---------------------------- cancel a sale ---------------------------- */}
      {pendingCancels.length > 0 && (
        <div className="card border-l-4 border-l-danger overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-line bg-surface-2/60 flex flex-wrap items-center gap-2">
            <AlertTriangle size={15} className="text-danger" />
            <span className="font-bold text-sm">Cancellation requests</span>
            <Chip tone="danger">{num(pendingCancels.length)}</Chip>
            <span className="text-[12px] text-ink-muted ml-auto">
              Approving voids every open lot and releases all locked EMD. Refusing leaves the auction running to its scheduled close.
            </span>
          </div>
          <div className="divide-y divide-line">
            {pendingCancels.map((r) => {
              const c = cat(r.catalogueId)
              const cl = lots.filter((l) => l.catalogueId === r.catalogueId)
              const openLots = cl.filter((l) => l.status === 'live').length
              const liveBids = bids.filter((b) => b.catalogueId === r.catalogueId && b.status === 'valid').length
              return (
                <div key={r.id} className="px-4 py-3.5 flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="num text-xs font-bold text-ember">{c?.code}</span>
                      <span className="font-semibold text-sm">{c?.title}</span>
                      {c && <StatusChip status={c.status} />}
                    </div>
                    <p className="text-[13px] text-ink-muted mt-1">{r.reason}</p>
                    <div className="text-[11px] text-ink-faint mt-1">
                      Asked for by {who(r.requestedBy)} · {relTime(r.requestedAt, now)} · {openLots} lot{openLots === 1 ? '' : 's'} still
                      open · {liveBids} valid bid{liveBids === 1 ? '' : 's'} would be voided
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="secondary" onClick={() => { setRefusing({ kind: 'cancel', id: r.id, label: c?.code ?? '' }); setNote('') }}>
                      Keep it running
                    </Button>
                    <Button size="sm" variant="danger"
                      onClick={() => {
                        decideCancellationRequest(r.id, true)
                        pushToast({ kind: 'danger', title: `${c?.code} cancelled`, body: 'Open lots voided; every locked EMD released to the buyers.' })
                      }}>
                      Approve cancellation
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* --------------------------- bypass exceptions --------------------------- */}
      {bypassed.length > 0 && (
        <div className="card overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-line bg-surface-2/60 flex flex-wrap items-center gap-2">
            <Zap size={15} className="text-warning" />
            <span className="font-bold text-sm">Bypass exceptions</span>
            <Chip tone="warning">{num(lots.filter((l) => l.inspectionWaived).length)}</Chip>
            <span className="text-[12px] text-ink-muted ml-auto">
              Lots accepted without a field inspection. Deliberately not an approval queue — a bypass is controlled by a typed reason
              and this record, not by a second signature.
            </span>
          </div>
          <div className="divide-y divide-line">
            {bypassed.map((l) => (
              <div key={l.id} className="px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="num font-bold w-20 shrink-0">{l.lotNo}</span>
                <span className="flex-1 min-w-52 truncate">
                  <span className="font-semibold">{l.metal}</span>
                  <span className="text-ink-muted"> · {l.waivedReason}</span>
                </span>
                <span className="text-xs text-ink-faint shrink-0">
                  {who(l.waivedBy)} · {l.waivedAt && fmtDate(l.waivedAt)}
                </span>
                <Link to="/exec/approvals" className="text-[13px] font-semibold text-ember hover:underline shrink-0">Lot approval →</Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------- refuse ------------------------------- */}
      <Modal open={!!refusing} onClose={() => { setRefusing(null); setNote('') }}
        title={refusing?.kind === 'void' ? 'Let this bid stand' : 'Keep this auction running'}>
        {refusing && (
          <div className="space-y-4">
            <div className="card bg-surface-2 border-0 p-4 text-sm">
              {refusing.kind === 'void'
                ? <>The bid stays valid and keeps its place on the ladder. The flag remains on record against it, so the pattern is still visible if it repeats.</>
                : <>The auction runs to its scheduled close. Whoever asked keeps the option to raise it again if the situation changes.</>}
            </div>
            <Field label="Reason" hint="Goes straight back to whoever raised it, and into the audit trail.">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)}
                placeholder={refusing.kind === 'void'
                  ? 'Increment pattern matches their usual behaviour on this grade — not enough to undo a customer\'s offer.'
                  : 'The yard incident is contained and the seller has confirmed the material is intact.'} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setRefusing(null); setNote('') }}>Cancel</Button>
              <Button disabled={note.trim().length < 4}
                onClick={() => {
                  if (refusing.kind === 'void') decideBidVoidRequest(refusing.id, false, note.trim())
                  else decideCancellationRequest(refusing.id, false, note.trim())
                  pushToast({ kind: 'info', title: refusing.kind === 'void' ? 'Bid stands' : 'Auction continues', body: 'The reason has gone back to whoever raised it.' })
                  setRefusing(null); setNote('')
                }}>
                Confirm
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

/* ---------------------------------------------------------------------------
   Decisions raised above the desk that proposed them.

   These belong to the CEO and are worked in their own workspace. They are
   mirrored here because Super Admin is our support and recovery role: if the
   CEO is unreachable and nobody has been delegated, the platform must not
   silently hold a customer's money. The record names whoever actually decided,
   so a signature given here never reads as the CEO's own.

   Nothing here is a fresh decision: the money is already held or already owed,
   and the requesting desk is waiting. Refusing a forfeiture releases the EMD
   back to the buyer; refusing a refund leaves the customer's dispute open. Both
   outcomes go back to Finance with the reason attached.
--------------------------------------------------------------------------- */
function SignatureQueue() {
  const now = useNow()
  const approvals = useStore((s) => s.ceoApprovals)
  const users = useStore((s) => s.users)
  const decide = useStore((s) => s.decideCeoApproval)
  const pushToast = useStore((s) => s.pushToast)

  const [refusing, setRefusing] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const pending = approvals.filter((a) => a.status === 'pending')
  if (pending.length === 0) return null

  const KIND_LABEL: Record<CeoApprovalRequest['kind'], string> = {
    emd_forfeiture: 'EMD forfeiture',
    refund: 'Refund',
    fee_change: 'Fee change',
    auction_publish: 'High-value publish',
    permanent_ban: 'Permanent ban',
    super_admin_account: 'New Super Admin',
    content_publish: 'Public copy',
  }

  return (
    <div className="card border-l-4 border-l-steel overflow-hidden mb-6">
      <div className="px-4 py-3 border-b border-line bg-surface-2/60 flex flex-wrap items-center gap-2">
        <Signature size={15} className="text-steel" />
        <span className="font-bold text-sm">Awaiting signature</span>
        <Chip tone="warning">{num(pending.length)}</Chip>
        <span className="text-[12px] text-ink-muted ml-auto">
          The CEO&apos;s queue, mirrored here for support and recovery — see{' '}
          <Link to="/ceo/approvals" className="text-ember font-semibold hover:underline">what needs their signature</Link>.
          Signing from here records your name, not theirs.
        </span>
      </div>
      <div className="divide-y divide-line">
        {pending.map((a) => {
          const requester = users.find((u) => u.id === a.requestedBy)
          return (
            <div key={a.id} className="flex flex-wrap items-start gap-3 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Chip tone="steel">{KIND_LABEL[a.kind]}</Chip>
                  <span className="font-semibold text-sm">{a.summary}</span>
                </div>
                <div className="text-[13px] text-ink-muted mt-0.5">{a.reason}</div>
                <div className="text-[11px] text-ink-faint mt-1">
                  Raised by {requester?.name ?? 'Finance'} · {relTime(a.requestedAt, now)} ·{' '}
                  <Link to="/finance" className="text-ember font-semibold hover:underline">Finance desk</Link>
                </div>
              </div>
              <div className="num text-base font-bold tabular-nums shrink-0 w-32 text-right">{inr(a.amount)}</div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="secondary" onClick={() => { setRefusing(a.id); setNote('') }}>Refuse</Button>
                <Button size="sm" variant="success" onClick={() => {
                  decide(a.id, true)
                  pushToast({ kind: 'success', title: 'Signed', body: `${a.summary} — what it was holding now goes ahead.` })
                }}>
                  {a.amount > 0 ? `Approve ${inr(a.amount)}` : 'Approve'}
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <Modal open={!!refusing} onClose={() => { setRefusing(null); setNote('') }} title="Refuse this request">
        <div className="space-y-4">
          <div className="card bg-warning-soft border-0 p-4 text-sm">
            The movement does not happen and the reason goes straight back to Finance. A refused forfeiture releases the
            EMD to the buyer; a refused refund leaves the money with us and the customer&apos;s dispute open.
          </div>
          <Field label="Reason" hint="Returned to whoever raised it, and recorded at critical severity in the audit trail.">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Give the buyer another seven days before we take their EMD…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setRefusing(null); setNote('') }}>Cancel</Button>
            <Button variant="danger" disabled={note.trim().length < 4} onClick={() => {
              if (!refusing) return
              decide(refusing, false, note.trim())
              pushToast({ kind: 'info', title: 'Refused', body: 'Finance has the reason and the record stays open on their desk.' })
              setRefusing(null); setNote('')
            }}>
              Refuse
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
