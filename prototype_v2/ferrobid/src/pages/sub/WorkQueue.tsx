/* ---------------------------------------------------------------------------
   Sub Admin — Work queue.

   Everything waiting on this desk, ranked by how close it is to its SLA, with
   the decision available in place wherever the decision is short enough to make
   from a summary — a seller to verify, a lot to send back, a reminder to chase.

   **Claiming is what divides this desk.** Every Sub Admin account is identical:
   the same full menu, the same powers, no per-account templates. So the only
   question the board has to answer is who has picked each item up, and the only
   thing claiming prevents is two people answering the same customer.

   The board itself is derived in `shared.tsx`, alongside the ops console's
   counts, so a number on the dashboard and the list you land on after clicking
   it can never be two different things.

   Money items appear here and are not decided here. Approving a deposit and
   releasing a withdrawal are, between them, a complete round trip on a
   customer's money — so no single desk holds both ends, and these rows route
   into Finance rather than opening a dialog.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Flag, ListFilter } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Avatar, Button, Chip, EmptyState, Field, Modal, PageHeader, Segmented, Select, Stat, Textarea,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDateTime, num } from '../../lib/format'
import {
  ClaimControl, LinkButton, SlaChip, WORK_ICON, WORK_LABEL, WORK_TINT, useWorkBoard, type WorkItem, type WorkKind,
} from './shared'
import { cx } from '../../components/ui'

type Priority = 'all' | 'mine' | 'unclaimed' | 'overdue'

export default function WorkQueue() {
  const inspectionReports = useStore((s) => s.inspectionReports)
  const me = useStore((s) => s.currentUser)
  const decideSellerKyc = useStore((s) => s.decideSellerKyc)
  const decideLot = useStore((s) => s.decideLot)
  const releaseWorkItem = useStore((s) => s.releaseWorkItem)
  const audit = useStore((s) => s.audit)
  const notify = useStore((s) => s.notify)
  const pushToast = useStore((s) => s.pushToast)

  const board = useWorkBoard()

  const [priority, setPriority] = useState<Priority>('all')
  const [kind, setKind] = useState<'all' | WorkKind>('all')
  const [kycItem, setKycItem] = useState<WorkItem | null>(null)
  const [flagItem, setFlagItem] = useState<WorkItem | null>(null)
  const [reason, setReason] = useState('')

  const visible = board
    .filter((i) => (kind === 'all' ? true : i.kind === kind))
    .filter((i) => {
      switch (priority) {
        case 'mine': return i.claimedBy?.id === me?.id
        case 'unclaimed': return i.mine && !i.claimedBy
        case 'overdue': return i.overdue
        default: return true
      }
    })

  const mine = board.filter((i) => i.mine)
  const claimedByMe = board.filter((i) => i.claimedBy?.id === me?.id)
  const unclaimed = mine.filter((i) => !i.claimedBy)
  const overdue = board.filter((i) => i.overdue)

  const kindsPresent = Array.from(new Set(board.map((i) => i.kind)))

  /** Clearing an item takes the claim off it too — a claim on something that is
   *  done is just a name sitting on an empty row. */
  const cleared = (item: WorkItem) => releaseWorkItem(item.id)

  const verify = (item: WorkItem, approve: boolean) => {
    if (!item.user) return
    const r = decideSellerKyc(item.user.id, approve, approve ? undefined : reason)
    if (!r.ok) { pushToast({ kind: 'danger', title: 'Not saved', body: r.error }); return }
    cleared(item)
    setKycItem(null)
    setReason('')
    pushToast({
      kind: approve ? 'success' : 'warning',
      title: approve ? `${item.user.firm} verified` : 'Rejected — they have been told what to resubmit',
      body: approve ? 'They can submit lots now.' : item.user.firm,
    })
  }

  const decide = (item: WorkItem, outcome: 'approved' | 'rejected') => {
    if (!item.lot) return
    const r = decideLot(item.lot.id, outcome, outcome === 'approved' ? undefined : reason)
    if (!r.ok) { pushToast({ kind: 'danger', title: 'Not saved', body: r.error }); return }
    cleared(item)
    setFlagItem(null)
    setReason('')
    pushToast({
      kind: outcome === 'approved' ? 'success' : 'warning',
      title: outcome === 'approved' ? `${item.lot.lotNo} approved` : `${item.lot.lotNo} rejected`,
      body: 'The seller has been told, and it is on the record against your name.',
    })
  }

  const chase = (item: WorkItem) => {
    if (!item.lot) return
    audit('auction.sta_chase', item.lot.lotNo, 'Reminder sent to the seller for their below-reserve decision')
    notify({
      userId: null, kind: 'system',
      title: `Decision needed on ${item.lot.lotNo}`,
      body: 'The highest bid came in below your reserve. Accept it or reject it — the lot cannot settle until you do.',
      href: '/seller/settlement',
    })
    pushToast({ kind: 'info', title: 'Reminder sent to the seller', body: `${item.lot.lotNo} — 48h SLA on the decision.` })
  }

  const flagReport = flagItem?.lot
    ? inspectionReports.find((r) => r.id === flagItem.lot!.inspectionReportId)
      ?? inspectionReports.find((r) => r.lotId === flagItem.lot!.id)
    : undefined

  /** The action that belongs on a row — the short decision in place, or the way
   *  to the screen where the long one is made. */
  const actionFor = (item: WorkItem) => {
    switch (item.kind) {
      case 'kyc':
        return <Button variant="secondary" size="sm" onClick={() => { setKycItem(item); setReason('') }}>Review</Button>
      case 'flag':
        return <Button variant="secondary" size="sm" onClick={() => { setFlagItem(item); setReason('') }}>Open review</Button>
      case 'sta':
        return <Button variant="secondary" size="sm" onClick={() => chase(item)}>Send a reminder</Button>
      default:
        return <LinkButton to={item.href}>{item.mine ? 'Open' : 'View in Finance'}</LinkButton>
    }
  }

  return (
    <Page>
      <PageHeader
        title="Work queue"
        sub="Everything on this desk, ranked by SLA. Claim what you take so nobody doubles up — every Sub Admin can do every one of these."
        actions={
          <Segmented<Priority>
            options={[
              { key: 'all', label: `All (${board.length})` },
              { key: 'mine', label: `Mine (${claimedByMe.length})` },
              { key: 'unclaimed', label: `Unclaimed (${unclaimed.length})` },
              { key: 'overdue', label: `Overdue (${overdue.length})` },
            ]}
            value={priority}
            onChange={setPriority}
          />
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="On this desk" value={num(mine.length)} sub="Yours to decide" />
        <Stat label="You have claimed" value={num(claimedByMe.length)} tone="steel" sub="Nobody else will pick these up" />
        <Stat label="Nobody on them" value={num(unclaimed.length)} tone={unclaimed.length ? 'ember' : undefined} sub="Free to claim" />
        <Stat label="Past SLA" value={num(overdue.length)} tone={overdue.length ? 'danger' : undefined} sub="Clear these first" />
      </div>

      <div className="card p-4 mb-4 flex flex-wrap items-end gap-x-6 gap-y-3">
        <Field label="Kind of work" className="w-60">
          <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="all">Everything</option>
            {kindsPresent.map((k) => (
              <option key={k} value={k}>{WORK_LABEL[k]} ({board.filter((i) => i.kind === k).length})</option>
            ))}
          </Select>
        </Field>
        <p className="pb-2.5 text-xs text-ink-muted flex items-center gap-1.5">
          <ListFilter size={13} />
          SLAs: flagged bids 2h · flagged lots and password resets 4h · EMD exemptions 6h · disputes 8h · verification and money 24h · STA chase 48h.
        </p>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={priority === 'overdue' ? 'Nothing is overdue' : priority === 'mine' ? 'You have not claimed anything' : 'Queue clear'}
          body={priority === 'mine'
            ? 'Claim an item from the board and it appears here — and stops showing as free for anyone else.'
            : 'Nothing matches this filter. Nice shift.'}
        />
      ) : (
        <div className="card overflow-hidden">
          <ul>
            {visible.map((item) => {
              const Icon = WORK_ICON[item.kind]
              const heldByOther = item.claimedBy && item.claimedBy.id !== me?.id
              return (
                <li
                  key={item.id}
                  className={cx('flex flex-wrap items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-line last:border-0',
                    heldByOther && 'opacity-70')}>
                  <span className={cx('size-9 rounded-xl border border-line flex items-center justify-center shrink-0', WORK_TINT[item.kind])}>
                    <Icon size={16} />
                  </span>
                  <div className="flex-1 min-w-52">
                    <div className="font-semibold text-sm">{item.title}</div>
                    <div className="text-xs text-ink-muted mt-0.5">
                      {WORK_LABEL[item.kind]} · {item.sub}
                      {!item.mine && <span className="text-ink-faint"> · Finance decides this</span>}
                    </div>
                  </div>
                  <SlaChip item={item} />
                  <ClaimControl item={item} />
                  {actionFor(item)}
                </li>
              )
            })}
          </ul>
          <div className="px-5 py-3 bg-surface-2 border-t border-line text-xs text-ink-muted">
            {num(board.length)} item{board.length === 1 ? '' : 's'} on the board · {num(mine.length)} for this desk ·
            {' '}{num(board.length - mine.length)} watched. Money items are Finance's to decide —{' '}
            <Link to="/sub/payments" className="font-semibold text-ember hover:underline">see the whole payment picture</Link>.
          </div>
        </div>
      )}

      {/* ------------------------------ verify a seller ----------------------- */}
      <Modal open={!!kycItem} onClose={() => setKycItem(null)} title="Seller verification">
        {kycItem?.user && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={kycItem.user.name} hue={kycItem.user.avatarHue} size={40} />
              <div>
                <div className="font-bold">{kycItem.user.firm}</div>
                <div className="text-xs text-ink-muted">{kycItem.user.name} · {kycItem.user.email}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['GSTIN', kycItem.user.gstin],
                ['City', kycItem.user.city],
                ['Standing', kycItem.user.standing],
                ['Phone', kycItem.user.phone],
              ].map(([k, v]) => (
                <div key={k} className="card bg-surface-2 p-3">
                  <div className="text-xs text-ink-faint uppercase tracking-wider font-semibold">{k}</div>
                  <div className="num font-semibold mt-0.5">{v}</div>
                </div>
              ))}
            </div>
            <Field label="Reason" hint="Required to reject — the seller is shown it word for word.">
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="e.g. the GSTIN does not match the firm name on the cheque…"
              />
            </Field>
            <div className="flex flex-wrap justify-end gap-2">
              <LinkButton to="/sub/seller-verification" variant="ghost">Open the full screen</LinkButton>
              <Button variant="secondary" onClick={() => verify(kycItem, false)}>Reject</Button>
              <Button variant="success" onClick={() => verify(kycItem, true)}>Verify</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------------------- a flagged lot --------------------------- */}
      <Modal open={!!flagItem} onClose={() => setFlagItem(null)} title={`Flagged lot — ${flagItem?.lot?.lotNo ?? ''}`}>
        {flagItem?.lot && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="warning"><Flag size={11} /> Flagged at inspection</Chip>
              <span className="text-sm text-ink-muted">
                {flagItem.lot.metal} {flagItem.lot.grade} · {num(flagItem.lot.indicativeQty)} {flagItem.lot.uom} · {flagItem.lot.yard}
              </span>
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
                <p className="text-ink-muted">
                  The field executive flagged this lot at inspection — the measured quantity or grade did not match
                  what the seller declared.
                </p>
              )}
            </div>
            <Field label="Reason" hint="Required to reject. The seller is shown it word for word.">
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="e.g. measured 11% under the declared quantity and the grade call is a tier lower…"
              />
            </Field>
            <div className="flex flex-wrap justify-end gap-2">
              <LinkButton to="/exec/approvals" variant="ghost">Open lot approval</LinkButton>
              <Button variant="danger" onClick={() => decide(flagItem, 'rejected')}>Reject</Button>
              <Button variant="success" onClick={() => decide(flagItem, 'approved')}>Approve anyway</Button>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  )
}
