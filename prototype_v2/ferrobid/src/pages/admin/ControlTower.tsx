/* Super Admin — control tower: pause / resume / extend / cancel / void-bid. */
import { useState } from 'react'
import { Ban, ChevronDown, Clock, Pause, Play, Zap } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Button, Chip, Countdown, EmptyState, Field, Modal, PageHeader, StatusChip, Textarea, cx,
} from '../../components/ui'
import { catalogueUiStatus, useStore } from '../../store/store'
import { fmtDateTime, inr, num } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type { Bid, Catalogue } from '../../types'

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
      <PageHeader title="Control tower" sub="Live intervention — pause, resume, extend or cancel catalogues, and void individual bids. Every action lands in the audit trail." />
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
                    <span className="num text-xs font-bold text-ink-faint">{c.code}</span>
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
