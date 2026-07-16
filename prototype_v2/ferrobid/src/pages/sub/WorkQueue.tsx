/* Sub-admin work queue — SLA-tracked triage of flagged lots, KYC, disputes and
   STA chases. Sub-admin resolves what's in scope and escalates the rest. */
import { useMemo, useState } from 'react'
import { Check, Flag, MessageSquareWarning, ShieldQuestion, UserCheck } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Avatar, Button, Chip, EmptyState, Field, LockChip, Modal, PageHeader, Segmented, Textarea, cx,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, num, fmtDateTime } from '../../lib/format'
import type { Dispute, Lot, User } from '../../types'

type Kind = 'flag' | 'kyc' | 'dispute' | 'sta'
type Priority = 'all' | 'soon' | 'overdue'

interface QueueItem {
  id: string
  kind: Kind
  title: string
  sub: string
  dueLabel: string
  leftMs: number
  overdue: boolean
  amber: boolean
  lot?: Lot
  user?: User
  dispute?: Dispute
}

const KIND_ICON: Record<Kind, typeof Flag> = {
  flag: Flag, kyc: UserCheck, dispute: MessageSquareWarning, sta: ShieldQuestion,
}
const KIND_LABEL: Record<Kind, string> = {
  flag: 'Flagged lot', kyc: 'KYC', dispute: 'Dispute', sta: 'STA chase',
}

/** Deterministic hash → the same item always shows the same SLA countdown. */
const hashOf = (s: string) => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

const leftLabel = (ms: number) => {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return `${h}h ${String(m).padStart(2, '0')}m left`
}

export default function WorkQueue() {
  const lots = useStore((s) => s.lots)
  const users = useStore((s) => s.users)
  const disputes = useStore((s) => s.disputes)
  const catalogues = useStore((s) => s.catalogues)
  const inspectionReports = useStore((s) => s.inspectionReports)
  const audit = useStore((s) => s.audit)
  const pushToast = useStore((s) => s.pushToast)

  const [priority, setPriority] = useState<Priority>('all')
  const [done, setDone] = useState<Set<string>>(new Set())
  const [kycUser, setKycUser] = useState<User | null>(null)
  const [flagLot, setFlagLot] = useState<Lot | null>(null)
  const [openDispute, setOpenDispute] = useState<Dispute | null>(null)
  const [reply, setReply] = useState('')

  const assignee = users.find((u) => u.id === 'u-sub-1')

  const items = useMemo<QueueItem[]>(() => {
    const closedCatIds = new Set(catalogues.filter((c) => c.status === 'closed').map((c) => c.id))
    const raw: { id: string; kind: Kind; title: string; sub: string; dueH: number; lot?: Lot; user?: User; dispute?: Dispute }[] = [
      ...lots.filter((l) => l.status === 'flagged').map((l) => ({
        id: `wq-flag-${l.id}`, kind: 'flag' as Kind,
        title: `Review flagged lot ${l.lotNo}`,
        sub: `${l.metal} ${l.grade} · ${num(l.indicativeQty)} ${l.uom} · ${l.yard}`,
        dueH: 4, lot: l,
      })),
      ...users.filter((u) => u.kycStatus === 'pending').map((u) => ({
        id: `wq-kyc-${u.id}`, kind: 'kyc' as Kind,
        title: `Verify KYC — ${u.firm}`,
        sub: `${u.name} · ${u.city}`,
        dueH: 24, user: u,
      })),
      ...disputes.filter((d) => d.status === 'open').map((d) => ({
        id: `wq-dsp-${d.id}`, kind: 'dispute' as Kind,
        title: `Dispute: ${d.subject}`,
        sub: `${users.find((u) => u.id === d.userId)?.firm ?? 'Buyer'} · ${d.category}`,
        dueH: 8, dispute: d,
      })),
      ...lots.filter((l) => l.status === 'sta' && closedCatIds.has(l.catalogueId)).map((l) => ({
        id: `wq-sta-${l.id}`, kind: 'sta' as Kind,
        title: `Chase STA decision — ${l.lotNo}`,
        sub: `H1 ${inr(l.resultH1Rate ?? l.currentRate ?? 0)}/${l.uom} below reserve · ${catalogues.find((c) => c.id === l.catalogueId)?.code ?? ''}`,
        dueH: 48, lot: l,
      })),
    ]

    const withSla = raw.map((r) => {
      const dueMs = r.dueH * 3_600_000
      const fraction = ((hashOf(r.id) % 90) + 5) / 100 // deterministic 5–94% of SLA left
      const leftMs = Math.round(dueMs * fraction)
      return {
        ...r,
        leftMs,
        overdue: false,
        amber: fraction < 0.25,
        dueLabel: leftLabel(leftMs),
      }
    })
    // the tightest item on the board has already blown its SLA
    if (withSla.length > 0) {
      const worst = withSla.reduce((a, b) => (a.leftMs / (a.dueH * 3_600_000) <= b.leftMs / (b.dueH * 3_600_000) ? a : b))
      worst.overdue = true
      worst.amber = false
      worst.dueLabel = 'Overdue'
    }
    return withSla.sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.leftMs - b.leftMs)
  }, [lots, users, disputes, catalogues])

  const visible = items.filter((i) =>
    priority === 'all' ? true : priority === 'overdue' ? i.overdue : i.amber)

  const toggleDone = (id: string) => {
    setDone((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const flagReport = flagLot
    ? inspectionReports.find((r) => r.id === flagLot.inspectionReportId) ?? inspectionReports.find((r) => r.lotId === flagLot.id)
    : undefined

  return (
    <Page>
      <PageHeader
        title="Work queue"
        sub="Everything assigned to your desk, ranked by SLA. Clear what you can — escalate what you can't."
        actions={
          <Segmented<Priority>
            options={[{ key: 'all', label: 'All' }, { key: 'soon', label: 'Due soon' }, { key: 'overdue', label: 'Overdue' }]}
            value={priority}
            onChange={setPriority}
          />
        }
      />

      {visible.length === 0 ? (
        <EmptyState title="Queue clear" body="Nothing matches this priority filter. Nice shift." />
      ) : (
        <div className="card overflow-hidden">
          <ul>
            {visible.map((item) => {
              const Icon = KIND_ICON[item.kind]
              const isDone = done.has(item.id)
              return (
                <li key={item.id} className={cx('flex flex-wrap items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-line last:border-0', isDone && 'opacity-55')}>
                  <button
                    onClick={() => toggleDone(item.id)}
                    aria-label={isDone ? 'Mark not done' : 'Mark done'}
                    className={cx('size-5 rounded-md border flex items-center justify-center shrink-0 transition-colors',
                      isDone ? 'bg-success border-success text-white' : 'border-line-strong hover:border-ink/40')}
                  >
                    {isDone && <Check size={13} />}
                  </button>
                  <span className={cx('size-9 rounded-xl border border-line flex items-center justify-center shrink-0',
                    item.kind === 'flag' ? 'bg-warning-soft text-warning'
                    : item.kind === 'kyc' ? 'bg-steel-soft text-steel-strong'
                    : item.kind === 'dispute' ? 'bg-danger-soft text-danger'
                    : 'bg-surface-2 text-ink-muted')}>
                    <Icon size={16} />
                  </span>
                  <div className="flex-1 min-w-52">
                    <div className={cx('font-semibold text-sm', isDone && 'line-through')}>{item.title}</div>
                    <div className="text-xs text-ink-muted mt-0.5">{KIND_LABEL[item.kind]} · {item.sub}</div>
                  </div>
                  <Chip tone={item.overdue ? 'danger' : item.amber ? 'warning' : 'neutral'} className="num">
                    {item.dueLabel}
                  </Chip>
                  {assignee && (
                    <span title={`Assigned to ${assignee.name}`}>
                      <Avatar name={assignee.name} hue={assignee.avatarHue} size={28} />
                    </span>
                  )}
                  {item.kind === 'kyc' && item.user && (
                    <Button variant="secondary" size="sm" onClick={() => setKycUser(item.user!)}>Review KYC</Button>
                  )}
                  {item.kind === 'flag' && item.lot && (
                    <Button variant="secondary" size="sm" onClick={() => setFlagLot(item.lot!)}>Open review</Button>
                  )}
                  {item.kind === 'dispute' && item.dispute && (
                    <Button variant="secondary" size="sm" onClick={() => { setOpenDispute(item.dispute!); setReply('') }}>Open thread</Button>
                  )}
                  {item.kind === 'sta' && item.lot && (
                    <Button variant="secondary" size="sm" onClick={() => {
                      audit('sta.chase', item.lot!.lotNo, 'Reminder sent to seller for STA (below-reserve) decision')
                      pushToast({ kind: 'info', title: 'Reminder sent to seller', body: `${item.lot!.lotNo} — STA decision pending, 48h SLA.` })
                    }}>Send reminder</Button>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="px-5 py-3 bg-surface-2 border-t border-line text-xs text-ink-muted">
            {num(items.length)} items on your desk · SLAs: flagged lots 4h · disputes 8h · KYC 24h · STA chase 48h.
          </div>
        </div>
      )}

      {/* ------------------------------ KYC modal ----------------------------- */}
      <Modal open={!!kycUser} onClose={() => setKycUser(null)} title="KYC verification">
        {kycUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={kycUser.name} hue={kycUser.avatarHue} size={40} />
              <div>
                <div className="font-bold">{kycUser.firm}</div>
                <div className="text-xs text-ink-muted">{kycUser.name} · {kycUser.email}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="card bg-surface-2 p-3">
                <div className="text-xs text-ink-faint uppercase tracking-wider font-semibold">GSTIN</div>
                <div className="num font-semibold mt-0.5">{kycUser.gstin}</div>
              </div>
              <div className="card bg-surface-2 p-3">
                <div className="text-xs text-ink-faint uppercase tracking-wider font-semibold">City</div>
                <div className="font-semibold mt-0.5">{kycUser.city}</div>
              </div>
              <div className="card bg-surface-2 p-3">
                <div className="text-xs text-ink-faint uppercase tracking-wider font-semibold">Standing</div>
                <div className="mt-1">
                  <Chip tone={kycUser.standing === 'good' ? 'success' : kycUser.standing === 'watchlist' ? 'warning' : 'danger'}>
                    {kycUser.standing}
                  </Chip>
                </div>
              </div>
              <div className="card bg-surface-2 p-3">
                <div className="text-xs text-ink-faint uppercase tracking-wider font-semibold">Phone</div>
                <div className="num font-semibold mt-0.5">{kycUser.phone}</div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => {
                pushToast({ kind: 'info', title: 'Document request sent', body: `${kycUser.firm} asked to re-upload GST certificate and cancelled cheque.` })
                setKycUser(null)
              }}>Request docs</Button>
              <Button variant="success" onClick={() => {
                audit('kyc.approve', kycUser.firm, 'Seller KYC verified — GSTIN and bank details matched')
                pushToast({ kind: 'success', title: 'KYC approved — user notified' })
                setKycUser(null)
              }}>Approve</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* -------------------------- flagged-lot modal ------------------------- */}
      <Modal open={!!flagLot} onClose={() => setFlagLot(null)} title={`Flagged lot review — ${flagLot?.lotNo ?? ''}`}>
        {flagLot && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="warning"><Flag size={11} /> Flagged at inspection</Chip>
              <span className="text-sm text-ink-muted">{flagLot.metal} {flagLot.grade} · {num(flagLot.indicativeQty)} {flagLot.uom} · {flagLot.yard}</span>
            </div>
            <div className="card bg-surface-2 p-3.5 text-sm">
              <div className="text-xs text-ink-faint uppercase tracking-wider font-semibold mb-1">Inspection notes</div>
              {flagReport ? (
                <>
                  <p>{flagReport.notes}</p>
                  <div className="text-xs text-ink-muted mt-2">
                    Measured {num(flagReport.measuredQty)} {flagReport.uom} · condition {flagReport.condition} · {fmtDateTime(flagReport.date)}
                  </div>
                </>
              ) : (
                <p className="text-ink-muted">Field executive flagged this lot during inspection — measured quantity and grade did not match the seller's declaration. Awaiting exec decision.</p>
              )}
            </div>
            <div className="card bg-surface-2 p-3 flex items-center justify-between gap-3">
              <span className="text-xs text-ink-muted">Approving or rejecting a flagged lot needs Exec Manager sign-off.</span>
              <LockChip label="Decision above your scope" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setFlagLot(null)}>Close</Button>
              <Button onClick={() => {
                audit('lot.escalate', flagLot.lotNo, 'Flagged lot escalated to Exec Manager with inspection notes', 'warning')
                pushToast({ kind: 'success', title: 'Escalated to Exec Manager', body: `${flagLot.lotNo} sent with inspection notes attached.` })
                setFlagLot(null)
              }}>Escalate to Exec Manager</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ----------------------------- dispute modal --------------------------- */}
      <Modal open={!!openDispute} onClose={() => setOpenDispute(null)} title={openDispute ? `Dispute — ${openDispute.subject}` : 'Dispute'}>
        {openDispute && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="danger">Open</Chip>
              <Chip>{openDispute.category}</Chip>
              <span className="text-xs text-ink-muted">
                {users.find((u) => u.id === openDispute.userId)?.firm ?? 'Buyer'} · raised {fmtDateTime(openDispute.createdAt)}
              </span>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {openDispute.messages.map((m, i) => (
                <div key={i} className={cx('card p-3 text-sm', m.from === 'support' ? 'bg-steel-soft ml-6' : 'bg-surface-2 mr-6')}>
                  <div className="text-xs font-semibold text-ink-faint mb-0.5">{m.from === 'support' ? 'ferroBid support' : 'Buyer'} · {fmtDateTime(m.at)}</div>
                  {m.body}
                </div>
              ))}
            </div>
            <Field label="Reply" hint="Sent to the buyer on the dispute thread. Resolution/refund actions are Super Admin scope.">
              <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="e.g. We've pulled the weighbridge slips for this lot and will revert within 24 hours…" />
            </Field>
            <div className="flex items-center justify-between gap-3">
              <LockChip label="Resolve/refund requires Super Admin" />
              <Button onClick={() => {
                pushToast({ kind: 'success', title: 'Reply sent on dispute thread', body: 'Buyer notified. SLA clock keeps running until resolved.' })
                setOpenDispute(null)
              }}>Send reply</Button>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  )
}
