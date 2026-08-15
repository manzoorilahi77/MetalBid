/* ---------------------------------------------------------------------------
   Auction Manager — schedule & publish.

   This screen is the boundary between private and public. Above the gate a
   catalogue exists only inside the operations team; below it, it is on the
   marketplace and EMD funding is open. Four roles may press the button — Ops
   Manager, Auction Manager, Sub Admin, Super Admin — and whoever does is named
   in the audit entry, so the gate is a *state* boundary, not a role boundary.

   The page is laid out to make that literal: everything above the divider is
   invisible to every buyer and seller, everything below it is live to the world.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import {
  AlertTriangle, CalendarClock, Eye, EyeOff, Package, RotateCcw, ShieldAlert, ShieldCheck, Signature, Undo2, Upload, Zap,
} from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Button, Chip, Countdown, EmptyState, Field, Input, Modal, PageHeader, Segmented, Stat, cx,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDateTime, inr, inrCompact, num, relTime } from '../../lib/format'
import { emdDeadlineMs, emdOpensAtMs } from '../../lib/emd'
import { useNow } from '../../lib/useTick'
import { AuctionIdentity, ReasonModal, ScopeNote, SectionTitle, isAwaitingPublish, useAuctionRows, type AuctionRow } from './shared'
import type { Catalogue } from '../../types'

/* The rupee value above which a publish needs the CEO's signature now lives in
   Financial Configuration (`ceoPublishValueFrom`) and the decision has a
   destination: the catalogue is held, a request goes to the CEO's queue, and
   Publish unblocks the moment it is signed. A threshold that can be ignored is
   not a threshold — but one with nowhere to escalate to is just a dead end. */

const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

/** How long a window is, in the coarsest unit that still says something — the
 *  point of showing it is "is this enough time for a buyer to move money", so
 *  "2 days" answers it and "2d 04h 17m" does not. */
const fmtGap = (ms: number) => {
  const m = Math.round(ms / 60_000)
  if (m < 1) return 'immediately'
  if (m >= 2880) return `${Math.round(m / 1440)} days`
  if (m >= 1440) return '1 day'
  if (m >= 120) return `${Math.round(m / 60)} hours`
  if (m >= 60) return '1 hour'
  return `${m} minutes`
}

/* --------------------------- the buyer's-eye view -------------------------- */
/** Exactly what appears on the marketplace the instant the button is pressed —
 *  and, just as importantly, what does not. Reserve never crosses the gate, so
 *  it is absent here by construction rather than by being filtered out later. */
function BuyerPreview({ row }: { row: AuctionRow }) {
  const { cat, lots } = row
  return (
    <div className="rounded-2xl border-2 border-dashed border-steel/40 overflow-hidden bg-steel-soft/25">
      <div className="px-4 py-2.5 bg-steel-soft/70 border-b border-steel/20 flex items-center gap-2 text-steel-strong">
        <Eye size={14} />
        <span className="text-xs font-bold uppercase tracking-wider">What a buyer will see</span>
      </div>
      <div className="p-4 bg-surface">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="num text-xs font-bold text-ember">{cat.code}</div>
            <div className="font-display text-lg font-bold mt-0.5">{cat.title}</div>
            <div className="text-xs text-ink-muted mt-1">
              {cat.yardName}, {cat.region} · inspection {fmtDateTime(cat.inspectionFrom)} – {fmtDateTime(cat.inspectionTo)} ({cat.inspectionHours})
            </div>
          </div>
          <Chip tone="steel">{cat.type === 'tender' ? 'Sealed tender' : 'Live auction'}</Chip>
        </div>

        {/* Both ends of the EMD window, not just the cut-off — a buyer plans
            funding around when it opens as much as when it shuts. */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-3.5 border-t border-line text-sm">
          {[
            ['Lots', num(lots.length)],
            ['EMD opens', fmtDateTime(new Date(emdOpensAtMs(cat)).toISOString())],
            ['EMD closes', fmtDateTime(new Date(emdDeadlineMs(cat)).toISOString())],
            ['Auction opens', fmtDateTime(cat.startsAt)],
            ['Auction closes', fmtDateTime(cat.endsAt)],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">{k}</div>
              <div className="num text-[13px] font-semibold mt-0.5">{v}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[13px] min-w-[440px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-ink-faint border-b border-line">
                <th className="py-2 pr-3 font-bold">Lot</th>
                <th className="py-2 pr-3 font-bold">Material</th>
                <th className="py-2 pr-3 font-bold text-right">Quantity</th>
                <th className="py-2 pr-3 font-bold text-right">Start rate</th>
                <th className="py-2 font-bold text-right">Pre-bid EMD</th>
              </tr>
            </thead>
            <tbody>
              {lots.slice(0, 6).map((l) => (
                <tr key={l.id} className="border-b border-line last:border-0">
                  <td className="py-2 pr-3 num font-semibold">{l.lotNo}</td>
                  <td className="py-2 pr-3 text-ink-muted truncate max-w-40">{l.grade} · {l.metal}</td>
                  <td className="py-2 pr-3 num text-right">{num(l.indicativeQty)} {l.uom}</td>
                  <td className="py-2 pr-3 num text-right font-semibold">{inr(l.startRate)}</td>
                  <td className="py-2 num text-right">{inr(l.preBidEmd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lots.length > 6 && (
            <div className="text-xs text-ink-faint pt-2">+ {num(lots.length - 6)} more lots in the annexure</div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-line flex items-center gap-2 text-xs text-ink-faint">
          <EyeOff size={13} className="shrink-0" />
          Reserve prices, seller cost and bidder identities are never part of this view.
        </div>
      </div>
    </div>
  )
}

/* --------------------------------- page ------------------------------------ */
export default function AuctionSchedule() {
  const rows = useAuctionRows()
  const now = useNow()
  const publishDraftCatalogue = useStore((s) => s.publishDraftCatalogue)
  const rescheduleCatalogue = useStore((s) => s.rescheduleCatalogue)
  const returnCatalogueToOps = useStore((s) => s.returnCatalogueToOps)
  const requestCeoSignoff = useStore((s) => s.requestCeoSignoff)
  const ceoApprovals = useStore((s) => s.ceoApprovals)
  const cfg = useStore((s) => s.financeConfig)
  const pushToast = useStore((s) => s.pushToast)

  const [publishTarget, setPublishTarget] = useState<AuctionRow | null>(null)
  const [mode, setMode] = useState<'now' | 'schedule'>('schedule')
  const [previewOf, setPreviewOf] = useState<AuctionRow | null>(null)
  const [editTarget, setEditTarget] = useState<Catalogue | null>(null)
  // a sale has four instants, not two: the EMD window, then the bidding window
  const [emdOpensAt, setEmdOpensAt] = useState('')
  const [emdClosesAt, setEmdClosesAt] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [antiSnipe, setAntiSnipe] = useState(5)
  const [returnTarget, setReturnTarget] = useState<AuctionRow | null>(null)

  const awaiting = rows.filter(isAwaitingPublish)
  const scheduled = rows.filter((r) => r.cat.status === 'upcoming')
  const liveNow = rows.filter((r) => r.ui === 'live' || r.ui === 'closing')

  const openEdit = (cat: Catalogue) => {
    setEditTarget(cat)
    // `emdOpensAt` is optional on the catalogue, so the field is filled from the
    // instant actually in force (emd.ts falls back well before the cut-off) —
    // editing it here is what makes it explicit
    setEmdOpensAt(toLocalInput(new Date(emdOpensAtMs(cat)).toISOString()))
    setEmdClosesAt(toLocalInput(new Date(emdDeadlineMs(cat)).toISOString()))
    setStartsAt(toLocalInput(cat.startsAt))
    setEndsAt(toLocalInput(cat.endsAt))
    setAntiSnipe(cat.antiSnipeMinutes)
  }

  const unresolvedLots = (r: AuctionRow) => r.lots.filter((l) => l.status !== 'approved')
  /** Above the configured value the catalogue is held until the CEO signs it.
   *  `ceoSignoff` is the request's own state, so the card can say whether it is
   *  unsent, waiting, or cleared — rather than just "blocked". */
  const overCeoValue = (r: AuctionRow) => r.reserveValue >= cfg.ceoPublishValueFrom
  const ceoSignoff = (r: AuctionRow) => {
    const req = ceoApprovals.find((a) => a.kind === 'auction_publish' && a.refId === r.cat.id)
    if (!overCeoValue(r)) return { needed: false, blocked: false, req: undefined }
    const cleared = req?.status === 'approved'
    return { needed: true, blocked: !cleared, req }
  }

  const doPublish = () => {
    if (!publishTarget) return
    const res = publishDraftCatalogue(publishTarget.cat.id, mode)
    if (!res.ok) {
      pushToast({ kind: 'danger', title: 'Not published', body: res.error })
      return
    }
    pushToast({
      kind: 'success',
      title: mode === 'now' ? `${publishTarget.cat.code} is live` : `${publishTarget.cat.code} scheduled`,
      body: mode === 'now'
        ? 'It is on the marketplace now and EMD funding is open.'
        : 'It goes live automatically at the scheduled time — no further step.',
    })
    setPublishTarget(null)
  }

  /** Sends the catalogue for signature. It is not published, not scheduled and
   *  not altered — the request only removes the block once it comes back
   *  signed, and the decision to publish stays with this desk. */
  const askForSignature = (r: AuctionRow) => {
    const res = requestCeoSignoff({
      kind: 'auction_publish',
      refId: r.cat.id,
      amount: r.reserveValue,
      summary: `Publish ${r.cat.code} — ${inr(r.reserveValue)} at reserve`,
      reason: `${num(r.lots.length)} lots, all approved and catalogued at ${r.cat.yardName}, ${r.cat.region}. Above the ${inr(cfg.ceoPublishValueFrom)} publish threshold, so it is being held rather than taken to market.`,
    })
    pushToast(res
      ? { kind: 'info', title: `${r.cat.code} sent for signature`, body: 'It stays private until the CEO signs. You will publish it yourself once they do.' }
      : { kind: 'danger', title: 'Not sent', body: 'This account cannot raise a request for signature.' })
  }

  const saveSchedule = () => {
    if (!editTarget) return
    const res = rescheduleCatalogue(editTarget.id, {
      emdOpensAt: new Date(emdOpensAt).toISOString(),
      emdDeadline: new Date(emdClosesAt).toISOString(),
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      antiSnipeMinutes: antiSnipe,
    })
    if (!res.ok) {
      pushToast({ kind: 'danger', title: 'Schedule unchanged', body: res.error })
      return
    }
    pushToast({ kind: 'success', title: `${editTarget.code} rescheduled`, body: 'Bidders on this sale will see the new EMD window and bidding times.' })
    setEditTarget(null)
  }

  /* The order is the sale itself, so it is checked as the manager types rather
     than only on save — a window in the wrong order is a mistake to point at,
     not an error to hand back. */
  const scheduleError = (() => {
    if (!editTarget) return null
    const [eo, ec, so, sc] = [emdOpensAt, emdClosesAt, startsAt, endsAt].map((v) => Date.parse(v))
    if ([eo, ec, so, sc].some(Number.isNaN)) return 'All four times are needed before this can be saved.'
    if (ec <= eo) return 'EMD closes before it opens. Buyers would have no window to fund in.'
    if (ec > so) return 'EMD closes after bidding opens. Pre-bid EMD has to be funded before the first bid.'
    if (sc <= so) return 'The auction closes before it opens.'
    return null
  })()

  return (
    <Page>
      <PageHeader
        title="Schedule & publish"
        sub="The one step that makes an auction public. Shared with the Operation Manager, Sub Admin and Super Admin — whoever presses it is named in the audit entry."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Ready to publish" value={num(awaiting.length)} tone={awaiting.length ? 'warning' : 'success'} sub="Private until you act" />
        <Stat label="Scheduled" value={num(scheduled.length)} tone="steel" sub="Will open on their own" />
        <Stat label="Live now" value={num(liveNow.length)} tone={liveNow.length ? 'ember' : undefined} sub="Already public" />
        <Stat label="Value at reserve, unpublished" value={inrCompact(awaiting.reduce((s, r) => s + r.reserveValue, 0))} sub="Not yet earning" />
      </div>

      {/* =================== above the gate — private ==================== */}
      <SectionTitle
        title="Waiting to go to market"
        count={awaiting.length}
        sub="Assembled and approved by Operations. No buyer or seller can see any of this — not on the marketplace, not in search, not on the home page."
      />

      {awaiting.length === 0 ? (
        <EmptyState
          icon={<Package size={32} strokeWidth={1.5} />}
          title="Nothing is waiting to be published"
          body="Catalogues appear here once Operations has approved every lot in them and assembled the catalogue."
        />
      ) : (
        <div className="space-y-3">
          {awaiting.map((r, i) => {
            const blocked = unresolvedLots(r)
            const ceo = ceoSignoff(r)
            return (
              <div key={r.cat.id} className="card overflow-hidden animate-fade-up" style={{ animationDelay: `${i * 45}ms` }}>
                <div className="p-4 flex flex-wrap items-start gap-4">
                  <AuctionIdentity row={r}>
                    <Chip tone="neutral"><Zap size={11} /> {r.cat.antiSnipeMinutes} min anti-snipe</Chip>
                  </AuctionIdentity>
                  <div className="flex gap-6 text-sm">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Lots</div>
                      <div className="num text-lg font-bold">{num(r.lots.length)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Value at reserve</div>
                      <div className="num text-lg font-bold">{inrCompact(r.reserveValue)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap ml-auto">
                    <Button variant="ghost" size="sm" onClick={() => setPreviewOf(r)}>
                      <Eye size={14} /> Preview
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => openEdit(r.cat)}>
                      <CalendarClock size={14} /> Schedule
                    </Button>
                    <Button variant="ghost" size="sm" className="text-ink-muted" onClick={() => setReturnTarget(r)}>
                      <Undo2 size={14} /> Return to Ops
                    </Button>
                    {ceo.blocked && blocked.length === 0 && (!ceo.req || ceo.req.status === 'refused') && (
                      <Button size="sm" variant="steel" onClick={() => askForSignature(r)}>
                        <Signature size={14} /> Ask the CEO{ceo.req ? ' again' : ''}
                      </Button>
                    )}
                    <Button size="sm" disabled={blocked.length > 0 || ceo.blocked}
                      onClick={() => { setPublishTarget(r); setMode('schedule') }}>
                      <Upload size={14} /> Publish
                    </Button>
                  </div>
                </div>

                {blocked.length > 0 && (
                  <div className="px-4 py-2.5 border-t bg-warning-soft/60 border-warning/20 text-ink flex items-start gap-2 text-[13px]">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" />
                    <span>
                      <b>{num(blocked.length)} lot{blocked.length === 1 ? '' : 's'} still undecided</b> — {blocked.map((l) => l.lotNo).slice(0, 5).join(', ')}
                      {blocked.length > 5 ? ' …' : ''}. Operations has to approve, bypass or reject each one before this catalogue can be published.
                    </span>
                  </div>
                )}

                {ceo.needed && (
                  <div className={cx('px-4 py-2.5 border-t flex items-start gap-2 text-[13px] text-ink',
                    !ceo.blocked ? 'bg-success-soft/60 border-success/20'
                      : ceo.req ? 'bg-steel-soft/60 border-steel/20' : 'bg-danger-soft/60 border-danger/20')}>
                    {!ceo.blocked
                      ? <ShieldCheck size={15} className="mt-0.5 shrink-0 text-success" />
                      : <ShieldAlert size={15} className={cx('mt-0.5 shrink-0', ceo.req ? 'text-steel' : 'text-danger')} />}
                    <span>
                      {!ceo.blocked ? (
                        <>
                          <b>Signed off by the CEO.</b> {inrCompact(r.reserveValue)} at reserve is above the{' '}
                          {inrCompact(cfg.ceoPublishValueFrom)} threshold, and the signature is on record. Publishing is yours again —
                          when, and how, is still your call.
                        </>
                      ) : ceo.req?.status === 'info_requested' ? (
                        <>
                          <b>The CEO has a question before signing.</b> &ldquo;{ceo.req.infoNote}&rdquo; — answer it and the
                          catalogue publishes as soon as they sign. Nothing about the lots or the reserves has changed.
                        </>
                      ) : ceo.req?.status === 'refused' ? (
                        <>
                          <b>The CEO refused this publish.</b> &ldquo;{ceo.req.decisionNote ?? 'No reason recorded.'}&rdquo; The
                          catalogue stays private. Ask again once what they raised has been dealt with.
                        </>
                      ) : ceo.req ? (
                        <>
                          <b>With the CEO for signature</b> — sent {relTime(ceo.req.requestedAt, now)}. {inrCompact(r.reserveValue)} at
                          reserve is above the {inrCompact(cfg.ceoPublishValueFrom)} threshold, so it is held rather than waved through.
                          The catalogue is untouched and stays private meanwhile.
                        </>
                      ) : (
                        <>
                          <b>Needs the CEO&apos;s signature</b> — {inrCompact(r.reserveValue)} at reserve is above the{' '}
                          {inrCompact(cfg.ceoPublishValueFrom)} threshold. Send it across and it publishes the moment they sign.
                        </>
                      )}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ============================ the gate ============================ */}
      <div className="my-9 flex items-center gap-4" aria-hidden>
        <div className="h-px flex-1 bg-line" />
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint whitespace-nowrap">
          <EyeOff size={13} />
          Everything above is private · everything below is public
        </div>
        <div className="h-px flex-1 bg-line" />
      </div>

      {/* =================== below the gate — public ===================== */}
      <SectionTitle
        title="Scheduled and live"
        count={scheduled.length + liveNow.length}
        sub="On the marketplace, with EMD funding open. A scheduled sale opens on its own — nobody has to be at their desk."
      />

      {scheduled.length + liveNow.length === 0 ? (
        <EmptyState title="Nothing is public yet" body="Published auctions and their schedules appear here." />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {[...liveNow, ...scheduled].map((r) => (
            <div key={r.cat.id} className="p-4 flex flex-wrap items-center gap-4">
              <AuctionIdentity row={r} to={`/auction/rooms/${r.cat.id}`} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm">
                {[
                  ['Opens', fmtDateTime(r.cat.startsAt)],
                  ['Closes', fmtDateTime(r.cat.endsAt)],
                  ['Anti-snipe', `${r.cat.antiSnipeMinutes} min`],
                  ['Bid validity', `${r.cat.bidValidityDays} days`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">{k}</div>
                    <div className="num text-[13px] font-semibold mt-0.5 whitespace-nowrap">{v}</div>
                  </div>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-2">
                {r.ui === 'upcoming' ? (
                  <>
                    <Countdown endsAt={r.cat.startsAt} prefix="opens" size="sm" />
                    <Button variant="secondary" size="sm" onClick={() => openEdit(r.cat)}>
                      <RotateCcw size={14} /> Reschedule
                    </Button>
                  </>
                ) : (
                  <Countdown endsAt={r.cat.endsAt} prefix="closes" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <ScopeNote>
          Adding or removing a lot, changing a reserve and approving a lot all belong to Operations — this desk takes the
          catalogue as it was assembled and decides only <em>when</em> the market sees it. A published auction can no longer
          be rescheduled; once it is live, use Live auctions to pause or extend it.
        </ScopeNote>
      </div>

      {/* ---------------------------- publish gate ---------------------------- */}
      <Modal open={!!publishTarget} onClose={() => setPublishTarget(null)} title={`Publish ${publishTarget?.cat.code ?? ''}?`} wide>
        {publishTarget && (
          <div className="space-y-5">
            <div className="card bg-ember-soft border-0 p-4">
              <div className="flex items-start gap-3">
                <span className="size-9 rounded-xl bg-ember text-white grid place-items-center shrink-0"><Upload size={17} /></span>
                <div className="text-sm">
                  <div className="font-bold text-ink">This is the moment it becomes public</div>
                  <p className="text-ink-muted mt-1">
                    {num(publishTarget.lots.length)} lots worth {inrCompact(publishTarget.reserveValue)} at reserve go onto the
                    marketplace, EMD funding opens, and every user is notified. Your name is recorded against it.
                  </p>
                </div>
              </div>
            </div>

            <Segmented stretch value={mode} onChange={setMode} options={[
              { key: 'schedule', label: `Open as scheduled — ${fmtDateTime(publishTarget.cat.startsAt)}` },
              { key: 'now', label: 'Go live immediately' },
            ]} />

            <p className="text-[13px] text-ink-muted">
              {mode === 'now'
                ? 'Bidding opens the second you confirm. There is no pre-auction EMD window, so buyers who have not already funded cannot join — use this only when the sale was meant to be open already.'
                : 'The catalogue appears on the marketplace now and opens for bidding on its own at the scheduled time. Buyers get the full EMD funding window in between.'}
            </p>

            <BuyerPreview row={publishTarget} />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPublishTarget(null)}>Keep it private</Button>
              <Button onClick={doPublish}>
                <Upload size={15} /> {mode === 'now' ? 'Publish and open bidding' : 'Publish to the marketplace'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ------------------------------- preview ------------------------------- */}
      <Modal open={!!previewOf} onClose={() => setPreviewOf(null)} title={`Preview — ${previewOf?.cat.code ?? ''}`} wide>
        {previewOf && <BuyerPreview row={previewOf} />}
      </Modal>

      {/* ------------------------------ reschedule ----------------------------- */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={`Schedule — ${editTarget?.code ?? ''}`}>
        {editTarget && (
          <div className="space-y-4">
            {/* Two windows, in the order they happen: buyers fund, then they
                bid. Kept as separate blocks so the EMD window reads as a phase
                of the sale rather than as fine print on the auction times. */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-2">1 · Pre-bid EMD window</div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="EMD opens" hint="Shortlisting and funding become possible">
                  <Input type="datetime-local" className="num" value={emdOpensAt} onChange={(e) => setEmdOpensAt(e.target.value)} />
                </Field>
                <Field label="EMD closes" hint="Cut-off — no new lots can be funded after this">
                  <Input type="datetime-local" className="num" value={emdClosesAt} onChange={(e) => setEmdClosesAt(e.target.value)} />
                </Field>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-2">2 · Bidding window</div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Auction opens" hint="Bidding starts — the sale is live from here">
                  <Input type="datetime-local" className="num" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                </Field>
                <Field label="Auction closes" hint="Subject to anti-snipe extensions below">
                  <Input type="datetime-local" className="num" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                </Field>
              </div>
            </div>

            <Field label="Anti-snipe window" hint="A bid inside the last N minutes pushes that lot's close out by the same N minutes, automatically.">
              <Input type="number" min={0} max={60} className="num w-32" value={antiSnipe}
                onChange={(e) => setAntiSnipe(Math.max(0, Math.min(60, Number(e.target.value))))} />
            </Field>

            {scheduleError ? (
              <p className="text-xs text-danger font-semibold flex items-start gap-1.5">
                <AlertTriangle size={13} className="mt-px shrink-0" />{scheduleError}
              </p>
            ) : (
              <p className="text-xs text-ink-faint">
                Buyers get <span className="num">{fmtGap(Date.parse(emdClosesAt) - Date.parse(emdOpensAt))}</span> to fund their EMD,
                and bidding opens <span className="num">{fmtGap(Date.parse(startsAt) - Date.parse(emdClosesAt))}</span> after the cut-off.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button onClick={saveSchedule} disabled={!!scheduleError}>Save schedule</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* --------------------------- return to Ops ---------------------------- */}
      <ReasonModal
        open={!!returnTarget}
        onClose={() => setReturnTarget(null)}
        title={`Return ${returnTarget?.cat.code ?? ''} to Operations`}
        intent="primary"
        confirmLabel="Return with comments"
        summary={<>The catalogue goes back to the Operation Manager and stays private. Nothing about the lots, reserves or approvals is changed — only your comments travel with it.</>}
        hint="The Operation Manager sees this verbatim. Say what has to change before it can go to market."
        placeholder="e.g. LOT-04 and LOT-07 are the same material catalogued twice — please merge before this goes out."
        presets={['Duplicate lots', 'Inspection photos missing', 'Wrong yard on the catalogue', 'Schedule clashes with a larger sale']}
        onConfirm={(reason) => {
          if (!returnTarget) return
          returnCatalogueToOps(returnTarget.cat.id, reason)
          pushToast({ kind: 'info', title: `${returnTarget.cat.code} returned to Operations`, body: 'It stays private until they send it back.' })
          setReturnTarget(null)
        }}
      />
    </Page>
  )
}
