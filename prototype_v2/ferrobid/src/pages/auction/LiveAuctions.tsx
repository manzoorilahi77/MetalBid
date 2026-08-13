/* ---------------------------------------------------------------------------
   Auction Manager — live auctions.

   The intervention desk. Every running and scheduled sale, and the four things
   that can be done to one: pause it, resume it, extend it, or ask the Super
   Admin to cancel it. Every one of them is reason-mandatory, lands in the audit
   trail, and notifies the bidders it affects — because all four change the deal
   a buyer thought they were in.

   What is deliberately absent: voiding a bid, cancelling unilaterally, altering
   a rate, changing a reserve, and anything touching a wallet.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity, Ban, ChevronDown, Clock, Gavel, Pause, Play, Radio, ScanEye, Timer, Users, Zap,
} from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Button, Chip, Countdown, EmptyState, Field, Modal, PageHeader, Segmented, Stat, Textarea, cx,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDateTime, fmtTime, inr, inrCompact, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import { AuctionIdentity, PausedOverlay, ReasonModal, ScopeNote, useAuctionRows, type AuctionRow } from './shared'

const EXTEND_OPTIONS = [5, 15, 30, 60]

export default function LiveAuctions() {
  const now = useNow()
  const rows = useAuctionRows()
  const users = useStore((s) => s.users)
  const lots = useStore((s) => s.lots)
  const cancellationRequests = useStore((s) => s.cancellationRequests)
  const pauseCatalogue = useStore((s) => s.pauseCatalogue)
  const resumeCatalogue = useStore((s) => s.resumeCatalogue)
  const extendCatalogue = useStore((s) => s.extendCatalogue)
  const requestCancellation = useStore((s) => s.requestCancellation)
  const pushToast = useStore((s) => s.pushToast)

  const [scope, setScope] = useState<'running' | 'scheduled'>('running')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pauseTarget, setPauseTarget] = useState<AuctionRow | null>(null)
  const [cancelTarget, setCancelTarget] = useState<AuctionRow | null>(null)
  const [extendTarget, setExtendTarget] = useState<AuctionRow | null>(null)
  const [extendMinutes, setExtendMinutes] = useState(15)
  const [extendReason, setExtendReason] = useState('')

  const running = rows.filter((r) => r.ui === 'live' || r.ui === 'closing')
  const scheduled = rows.filter((r) => r.ui === 'upcoming')
  const shown = scope === 'running' ? running : scheduled

  const pausedCount = running.filter((r) => r.isPaused).length
  const firm = (id: string) => users.find((u) => u.id === id)?.firm ?? 'Unknown firm'
  const lotNo = (id: string) => lots.find((l) => l.id === id)?.lotNo ?? id

  const doExtend = () => {
    if (!extendTarget) return
    extendCatalogue(extendTarget.cat.id, extendMinutes, extendReason.trim())
    pushToast({
      kind: 'info', title: `${extendTarget.cat.code} extended by ${extendMinutes} min`,
      body: 'Every live lot moved by the same amount. Bidders have been told.',
    })
    setExtendTarget(null)
    setExtendReason('')
  }

  return (
    <Page>
      <PageHeader
        title="Live auctions"
        sub="Watch every sale on the floor and step in when one goes wrong. Pause, resume and extend take effect immediately; cancelling does not — it goes to the Super Admin."
        actions={
          <div className="flex items-center gap-2">
            <Chip tone={running.length ? 'ember' : 'neutral'} pulse={running.length > 0}>
              <Activity size={12} /> {running.length ? 'Streaming' : 'Floor quiet'}
            </Chip>
            <Segmented value={scope} onChange={setScope} options={[
              { key: 'running', label: `Running${running.length ? ` · ${running.length}` : ''}` },
              { key: 'scheduled', label: `Scheduled${scheduled.length ? ` · ${scheduled.length}` : ''}` },
            ]} />
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Running now" value={num(running.length)} tone={running.length ? 'ember' : undefined} sub="Open to bidding" />
        <Stat label="Paused" value={num(pausedCount)} tone={pausedCount ? 'danger' : 'success'} sub={pausedCount ? 'Bids are being refused' : 'Nothing on hold'} />
        <Stat label="Closing within the hour" value={num(running.filter((r) => Date.parse(r.cat.endsAt) - now < 3600_000).length)} tone="warning" sub="Watch these first" />
        <Stat label="Anti-snipe extensions" value={num(running.reduce((s, r) => s + r.extensions, 0))} sub="Automatic — no action needed" />
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={<Gavel size={32} strokeWidth={1.5} />}
          title={scope === 'running' ? 'No auction is running' : 'Nothing is scheduled'}
          body={scope === 'running'
            ? 'Scheduled sales open on their own at their published time and will appear here the moment they do.'
            : 'Publish a catalogue from Schedule & publish to put a sale on the calendar.'}
        />
      ) : (
        <div className="space-y-4">
          {shown.map((r, i) => {
            const cancelReq = cancellationRequests.find((x) => x.catalogueId === r.cat.id && x.status === 'pending')
            const isRunning = r.ui === 'live' || r.ui === 'closing'
            const recent = [...r.bids].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 8)
            return (
              <div key={r.cat.id}
                className={cx('card overflow-hidden relative animate-fade-up', r.isPaused && 'border-danger/50')}
                style={{ animationDelay: `${i * 45}ms` }}>
                {r.isPaused && <PausedOverlay />}

                {/* identity + clock */}
                <div className="p-5 flex flex-wrap items-start gap-4">
                  <AuctionIdentity row={r} to={`/auction/rooms/${r.cat.id}`}>
                    {r.extensions > 0 && <Chip tone="warning" className="num"><Zap size={11} /> {r.extensions} extension{r.extensions === 1 ? '' : 's'}</Chip>}
                  </AuctionIdentity>
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint mb-1">
                      {isRunning ? (r.isPaused ? 'Frozen at' : 'Closes in') : 'Opens in'}
                    </div>
                    <Countdown endsAt={isRunning ? r.cat.endsAt : r.cat.startsAt} size="lg" />
                    <div className="text-[11px] text-ink-faint mt-1 num">{fmtDateTime(isRunning ? r.cat.endsAt : r.cat.startsAt)}</div>
                  </div>
                </div>

                {/* the numbers that say whether it is going well */}
                <div className={cx('px-5 pb-4 grid grid-cols-2 sm:grid-cols-5 gap-4', r.isPaused && 'opacity-60')}>
                  {[
                    { label: 'Lots live', value: `${num(r.liveLots.length)}/${num(r.lots.length)}`, icon: <Gavel size={12} /> },
                    { label: 'Valid bids', value: num(r.bids.length), icon: <Activity size={12} /> },
                    { label: 'Last hour', value: num(r.bidsLastHour), icon: <Timer size={12} /> },
                    { label: 'Bidders', value: num(r.participants), icon: <Users size={12} /> },
                    { label: 'Cleared so far', value: inrCompact(r.realisation), icon: <Radio size={12} /> },
                  ].map((m) => (
                    <div key={m.label}>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint flex items-center gap-1">{m.icon} {m.label}</div>
                      <div className="num text-lg font-bold mt-0.5">{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* a cancellation already with the Super Admin outranks the controls */}
                {cancelReq && (
                  <div className="px-5 py-3 bg-danger-soft/60 border-t border-danger/20 flex items-start gap-2.5 text-[13px]">
                    <Ban size={15} className="mt-0.5 shrink-0 text-danger" />
                    <span>
                      <b>Cancellation requested {relTime(cancelReq.requestedAt, now)}</b> — with the Super Admin now.
                      <span className="text-ink-muted"> “{cancelReq.reason}”</span> The sale keeps running until they decide.
                    </span>
                  </div>
                )}

                {/* the four things this desk can do */}
                <div className="px-5 py-3 border-t border-line bg-surface-2/50 flex flex-wrap items-center gap-2">
                  {r.isPaused ? (
                    <span className="text-[13px] text-danger font-semibold mr-auto flex items-center gap-1.5">
                      <Pause size={14} /> Frozen — every countdown is held and new bids are being refused
                    </span>
                  ) : (
                    <span className="text-[13px] text-ink-muted mr-auto">
                      {isRunning ? 'Running normally. Interventions notify every bidder on this sale.' : 'Opens automatically — nobody needs to be at their desk.'}
                    </span>
                  )}

                  <Button variant="ghost" size="sm" onClick={() => setExpanded(expanded === r.cat.id ? null : r.cat.id)}>
                    <ScanEye size={14} /> Bid stream
                    <ChevronDown size={13} className={cx('transition-transform', expanded === r.cat.id && 'rotate-180')} />
                  </Button>

                  {isRunning && (r.isPaused ? (
                    <Button variant="success" size="sm"
                      onClick={() => {
                        resumeCatalogue(r.cat.id)
                        pushToast({ kind: 'success', title: `${r.cat.code} resumed`, body: 'Countdowns restarted from where they froze. Bidders told.' })
                      }}>
                      <Play size={14} /> Resume
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => setPauseTarget(r)}>
                      <Pause size={14} /> Pause
                    </Button>
                  ))}

                  {isRunning && (
                    <Button variant="steel" size="sm" disabled={r.isPaused}
                      onClick={() => { setExtendTarget(r); setExtendMinutes(15); setExtendReason('') }}>
                      <Clock size={14} /> Extend
                    </Button>
                  )}

                  <Button variant="ghost" size="sm" className="text-danger hover:text-danger" disabled={!!cancelReq}
                    onClick={() => setCancelTarget(r)}>
                    <Ban size={14} /> {cancelReq ? 'Cancellation pending' : 'Request cancellation'}
                  </Button>

                  <Link to={`/auction/rooms/${r.cat.id}`}>
                    <Button size="sm"><Gavel size={14} /> Open room</Button>
                  </Link>
                </div>

                {/* recent bids, in place */}
                {expanded === r.cat.id && (
                  <div className="border-t border-line divide-y divide-line bg-surface-2/30">
                    {recent.length === 0 ? (
                      <div className="px-5 py-4 text-sm text-ink-faint">No bids on this auction yet.</div>
                    ) : recent.map((b) => (
                      <div key={b.id} className="px-5 py-2.5 flex items-center gap-3 text-sm animate-bid-in">
                        <span className="num text-xs text-ink-faint w-20 shrink-0">{fmtTime(b.at)}</span>
                        <span className="num font-bold w-16 shrink-0">{lotNo(b.lotId)}</span>
                        <span className="flex-1 truncate text-ink-muted">{firm(b.bidderId)}</span>
                        <Chip tone={b.type === 'manual' ? 'neutral' : 'steel'}>{b.type === 'bot' ? 'Floor' : b.type}</Chip>
                        <span className="num font-bold w-28 text-right">{inr(b.rate)}</span>
                      </div>
                    ))}
                    <div className="px-5 py-2.5 bg-surface-2/60">
                      <Link to="/auction/bid-monitor" className="text-[13px] font-bold text-ember hover:underline">
                        Open the full bid monitor to flag anything anomalous →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-6">
        <ScopeNote>
          Voiding a bid and cancelling a sale both leave this desk as requests and are closed by a Super Admin — they take
          money or a win away from a customer, so they never complete in one pair of hands. Reserves, rates and wallets are
          not touched from here at all.
        </ScopeNote>
      </div>

      {/* ------------------------------- pause -------------------------------- */}
      <ReasonModal
        open={!!pauseTarget}
        onClose={() => setPauseTarget(null)}
        title={`Pause ${pauseTarget?.cat.code ?? ''}`}
        intent="warning"
        confirmLabel="Pause the auction"
        summary={
          <>
            Every countdown in this sale freezes where it stands, <b>new bids are refused</b>, and all{' '}
            <b className="num">{pauseTarget?.participants ?? 0}</b> bidders are told it is on hold. Nothing already bid is lost.
          </>
        }
        placeholder="e.g. Seller reported a yard fire affecting LOT-03 to LOT-07 — holding until we can confirm the material is intact."
        presets={['Yard incident under verification', 'Suspected platform fault', 'Seller dispute on a listed lot', 'Bidder-side connectivity failure']}
        onConfirm={(reason) => {
          if (!pauseTarget) return
          pauseCatalogue(pauseTarget.cat.id, reason)
          pushToast({ kind: 'warning', title: `${pauseTarget.cat.code} paused`, body: 'Countdowns frozen and bids refused. Bidders have been told why.' })
          setPauseTarget(null)
        }}
      />

      {/* ------------------------------- extend ------------------------------- */}
      <Modal open={!!extendTarget} onClose={() => setExtendTarget(null)} title={`Extend ${extendTarget?.cat.code ?? ''}`}>
        {extendTarget && (
          <div className="space-y-4">
            <div className="card bg-warning-soft border-0 p-4 text-sm">
              Every live lot in this sale closes later by the same amount, and all{' '}
              <b className="num">{extendTarget.participants}</b> bidders are told. Existing bids and the ladder are untouched.
            </div>
            <Field label="Extend by" hint="This is a deliberate extension. Anti-snipe extensions happen on their own and need nobody.">
              <div className="grid grid-cols-4 gap-2">
                {EXTEND_OPTIONS.map((m) => (
                  <button key={m} type="button" onClick={() => setExtendMinutes(m)}
                    className={cx('num h-11 rounded-xl border font-bold transition-colors',
                      m === extendMinutes ? 'bg-steel text-white border-steel' : 'bg-surface text-ink-muted border-line hover:border-line-strong hover:text-ink')}>
                    +{m}m
                  </button>
                ))}
              </div>
            </Field>
            <div className="text-[13px] text-ink-muted">
              New close: <span className="num font-bold text-ink">{fmtDateTime(new Date(Date.parse(extendTarget.cat.endsAt) + extendMinutes * 60_000).toISOString())}</span>
            </div>
            <Field label="Reason" hint="Recorded in the audit trail against your name, and shown to every bidder on this sale.">
              <Textarea value={extendReason} onChange={(e) => setExtendReason(e.target.value)}
                placeholder="e.g. Payment gateway was unreachable for eleven minutes — giving back the time bidders lost." />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setExtendTarget(null)}>Cancel</Button>
              <Button variant="steel" disabled={extendReason.trim().length < 4} onClick={doExtend}>
                <Clock size={15} /> Extend by {extendMinutes} minutes
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* -------------------------- cancellation request ---------------------- */}
      <ReasonModal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title={`Request cancellation — ${cancelTarget?.cat.code ?? ''}`}
        intent="danger"
        confirmLabel="Send to the Super Admin"
        summary={
          <>
            <b>This does not cancel the auction.</b> It sends a request, with your reason as the evidence, to the Super Admin —
            the only role that can approve one. The sale keeps running until they decide. If they approve, every open lot
            becomes unsold and all locked EMD is released.
          </>
        }
        hint="The Super Admin reads this verbatim and decides on it. Be specific about what happened."
        placeholder="e.g. Seller has withdrawn the material after a weighbridge dispute; there is nothing left to deliver against 9 of the 12 lots."
        presets={['Seller withdrew the material', 'Material misdescribed at scale', 'Legal hold on the yard', 'Platform fault invalidated the bidding']}
        onConfirm={(reason) => {
          if (!cancelTarget) return
          const res = requestCancellation(cancelTarget.cat.id, reason)
          pushToast(res.ok
            ? { kind: 'warning', title: 'Cancellation requested', body: `${cancelTarget.cat.code} keeps running until the Super Admin decides.` }
            : { kind: 'danger', title: 'Not sent', body: res.error })
          setCancelTarget(null)
        }}
      />
    </Page>
  )
}
