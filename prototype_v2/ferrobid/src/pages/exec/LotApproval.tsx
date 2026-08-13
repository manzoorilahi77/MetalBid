/* ---------------------------------------------------------------------------
   Operation Manager — lot approval: approve, bypass, send back or reject.

   This is the platform's core quality gate — the single decision that puts a
   seller's material in front of buyers — and it is the one place a lot can also
   be **bypassed**: accepted for a trusted seller without a yard visit at all.

   Bypass is deliberately *not* gated behind a second approver. What controls it
   instead is a typed reason, an audit entry at warning severity, a marker that
   stays on the lot wherever it appears, and a monthly count. That trade is only
   safe while all four hold, which is why the reason is mandatory here and the
   store refuses an empty one.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Check, X, ClipboardCheck, ShieldAlert, ShieldOff, History } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  PageHeader, Button, Chip, StatusChip, EmptyState, PhotoThumb, Modal, Field, Textarea, Tabs, cx,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { num, fmtDate, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type { Lot } from '../../types'

/** Yard → seller firm (pipeline lots carry no sellerId — derive from the yard). */
const YARD_SELLER: Record<string, string> = {
  'Burma Mines Yard': 'Tata Steel — Jamshedpur Works',
  'VJNR Yard B': 'JSW Steel — Vijayanagar Works',
  'BSP Scrap Yard 3': 'SAIL — Bhilai Steel Plant',
  'Mancheswar Depot': 'East Coast Railway — Stores Dept',
  'MSTC Paradip Yard': 'MSTC — Eastern Region Yard',
  'RSTPS Ash Yard': 'NTPC — Ramagundam STPS',
}

type Tab = 'inspected' | 'bypass' | 'decided'
type Outcome = 'flagged' | 'rejected' | 'bypass'

const OUTCOME_COPY: Record<Outcome, { title: string; confirm: string; intent: 'warning' | 'danger'; hint: string; placeholder: string; presets: string[] }> = {
  flagged: {
    title: 'Send back for re-inspection',
    confirm: 'Send back with this reason',
    intent: 'warning',
    hint: 'The field executive and the seller both see this word for word.',
    placeholder: 'e.g. Measured quantity is 9% under declared — re-weigh and photograph the full stack.',
    presets: ['Quantity variance too high', 'Photographs incomplete', 'Condition does not match the report', 'Checklist item failed'],
  },
  rejected: {
    title: 'Reject this lot',
    confirm: 'Reject with this reason',
    intent: 'danger',
    hint: 'The lot leaves the pipeline and the seller is told exactly this.',
    placeholder: 'e.g. Material is contaminated with non-ferrous scrap and cannot be catalogued as declared.',
    presets: ['Material not as declared', 'Hazardous without clearance', 'Seller withdrew', 'Below viable quantity'],
  },
  bypass: {
    title: 'Bypass the inspection',
    confirm: 'Bypass and accept the lot',
    intent: 'warning',
    hint: 'Recorded at warning severity against your name, and the marker stays on the lot for the life of the sale.',
    placeholder: 'e.g. Known seller, fourth consecutive catalogue with no variance. Weighbridge slip attached to the submission.',
    presets: ['Trusted seller — consistent history', 'Yard already inspected this week', 'Material sealed and certified at source', 'Repeat lot from an inspected batch'],
  },
}

export default function LotApproval() {
  const now = useNow()
  const lots = useStore((s) => s.lots)
  const reports = useStore((s) => s.inspectionReports)
  const catalogues = useStore((s) => s.catalogues)
  const users = useStore((s) => s.users)
  const me = useStore((s) => s.currentUser)
  const decideLot = useStore((s) => s.decideLot)
  const waiveInspection = useStore((s) => s.waiveInspection)
  const pushToast = useStore((s) => s.pushToast)

  const [tab, setTab] = useState<Tab>('inspected')
  const [target, setTarget] = useState<{ lot: Lot; outcome: Outcome } | null>(null)
  const [reason, setReason] = useState('')

  const queue = lots.filter((l) => l.status === 'inspected')
  /* Bypass applies before a yard visit has happened, so it is a different list:
     lots sitting in a catalogue waiting for an inspection that could be skipped. */
  const awaitingInspection = lots.filter((l) => l.status === 'pending_inspection')
  const bypassed = lots.filter((l) => l.inspectionWaived)

  const sellerOf = (l: Lot) => {
    const cat = catalogues.find((c) => c.id === l.catalogueId)
    const seller = cat ? users.find((u) => u.id === cat.sellerId) : undefined
    return seller?.firm ?? YARD_SELLER[l.yard] ?? 'Direct consignment'
  }

  /** What this seller's material has done before — the only thing that makes a
   *  bypass a judgement rather than a guess. */
  const sellerHistory = (l: Lot) => {
    const catIds = catalogues.filter((c) => c.sellerId && c.sellerId === catalogues.find((x) => x.id === l.catalogueId)?.sellerId).map((c) => c.id)
    const theirs = lots.filter((x) => catIds.includes(x.catalogueId))
    return {
      submitted: theirs.length,
      rejected: theirs.filter((x) => x.status === 'rejected').length,
      bypassed: theirs.filter((x) => x.inspectionWaived).length,
      sold: theirs.filter((x) => x.status === 'sold' || x.status === 'sta').length,
    }
  }

  const close = () => { setTarget(null); setReason('') }

  const confirm = () => {
    if (!target) return
    const { lot, outcome } = target
    const text = reason.trim()
    const res = outcome === 'bypass'
      ? waiveInspection(lot.id, me?.id ?? 'u-exec-1', text)
      : decideLot(lot.id, outcome, text)
    if (!res.ok) {
      pushToast({ kind: 'danger', title: 'Not recorded', body: res.error })
      return
    }
    pushToast(outcome === 'bypass'
      ? { kind: 'warning', title: `${lot.lotNo} bypassed`, body: 'Accepted without a yard visit. Logged at warning severity and marked on the lot.' }
      : outcome === 'flagged'
        ? { kind: 'warning', title: `${lot.lotNo} sent back`, body: 'The field executive and the seller have both been told why.' }
        : { kind: 'danger', title: `${lot.lotNo} rejected`, body: 'Out of the pipeline. The seller has been given your reason.' })
    close()
  }

  const approve = (l: Lot) => {
    const res = decideLot(l.id, 'approved')
    pushToast(res.ok
      ? { kind: 'success', title: `${l.lotNo} approved`, body: `${l.grade} is cleared for auction, pending the rest of its catalogue.` }
      : { kind: 'danger', title: 'Not approved', body: res.error })
  }

  return (
    <Page>
      <PageHeader
        title="Lot approval"
        sub="The gate between a seller's yard and the marketplace. Approve a lot on its inspection report, send it back, reject it — or bypass the inspection entirely for a seller you trust."
        actions={<Chip tone="steel"><span className="num">{queue.length}</span> awaiting decision</Chip>}
      />

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'inspected', label: 'Inspected — awaiting decision', count: queue.length },
          { key: 'bypass', label: 'Awaiting inspection', count: awaitingInspection.length },
          { key: 'decided', label: 'Bypassed', count: bypassed.length },
        ]}
        className="mb-5"
      />

      {/* ------------------------- bypass queue ---------------------------- */}
      {tab === 'bypass' && (
        <>
          <div className="card border-l-4 border-l-warning p-4 mb-4 flex items-start gap-3">
            <ShieldAlert size={16} className="text-warning shrink-0 mt-0.5" />
            <div className="text-[13px] text-ink-muted">
              <strong className="text-ink">A bypass accepts the lot on the seller&apos;s description alone.</strong> No second
              approval is required — a typed reason, an audit entry at warning severity and a permanent marker on the lot
              are the whole control. Every one of these is a lot we described to buyers without seeing it.
            </div>
          </div>
          {awaitingInspection.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck size={32} strokeWidth={1.5} />}
              title="Nothing is waiting on a yard visit"
              body="Lots appear here once they are catalogued and assigned to a field executive."
            />
          ) : (
            <div className="card divide-y divide-line overflow-hidden">
              {awaitingInspection.map((l) => {
                const h = sellerHistory(l)
                return (
                  <div key={l.id} className="p-4 flex flex-wrap items-center gap-3">
                    <PhotoThumb hue={l.photos[0]?.hue ?? 24} category={l.category} className="w-16 h-12" />
                    <div className="min-w-48 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="num text-xs font-bold">{l.lotNo}</span>
                        <StatusChip status={l.status} />
                        {l.knownSeller && <Chip tone="success">Known seller</Chip>}
                        {l.hazardous && <Chip tone="danger">Hazardous</Chip>}
                      </div>
                      <div className="text-sm font-semibold mt-0.5">{l.grade} · {l.metal}</div>
                      <div className="text-xs text-ink-muted">
                        <span className="num">{num(l.indicativeQty)} {l.uom}</span> · {l.yard} · {sellerOf(l)}
                      </div>
                      <div className="text-[11px] text-ink-faint mt-1 flex items-center gap-1.5">
                        <History size={11} />
                        <span className="num">{h.submitted}</span> lots from this seller · <span className="num">{h.sold}</span> sold ·{' '}
                        <span className="num">{h.rejected}</span> rejected · <span className="num">{h.bypassed}</span> previously bypassed
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => { setTarget({ lot: l, outcome: 'bypass' }); setReason('') }}>
                      <ShieldOff size={14} /> Bypass inspection
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ------------------------- bypassed record -------------------------- */}
      {tab === 'decided' && (
        bypassed.length === 0 ? (
          <EmptyState
            icon={<ShieldOff size={32} strokeWidth={1.5} />}
            title="No lot has been bypassed"
            body="Every lot on the platform reached the market on a field executive's report. This list is also the monthly bypass count on the operations report."
          />
        ) : (
          <div className="card divide-y divide-line overflow-hidden">
            {bypassed.map((l) => (
              <div key={l.id} className="p-4 flex flex-wrap items-start gap-3">
                <span className="size-9 rounded-xl grid place-items-center shrink-0 bg-warning-soft text-warning mt-0.5"><ShieldOff size={16} /></span>
                <div className="min-w-48 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="num text-xs font-bold">{l.lotNo}</span>
                    <StatusChip status={l.status} />
                    <Chip tone="warning">Bypassed — no yard visit</Chip>
                  </div>
                  <div className="text-sm font-semibold mt-0.5">{l.grade} · {l.metal} <span className="text-ink-muted font-normal">· {sellerOf(l)}</span></div>
                  <div className="text-[13px] text-ink-muted mt-0.5">&ldquo;{l.waivedReason ?? 'No reason recorded.'}&rdquo;</div>
                  <div className="text-[11px] text-ink-faint mt-1">
                    {users.find((u) => u.id === l.waivedBy)?.name ?? 'Operations'} · {l.waivedAt ? relTime(l.waivedAt, now) : '—'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'inspected' && queue.length === 0 && (
        <EmptyState
          icon={<ClipboardCheck size={32} strokeWidth={1.5} />}
          title="Approval queue is clear"
          body="No inspected lots are waiting for a decision. New inspections will appear here as field executives verify them."
        />
      )}

      <div className="space-y-4">
        {tab === 'inspected' && queue.map((l) => {
          const rep = reports.find((r) => r.id === l.inspectionReportId)
          const variance = rep ? ((rep.measuredQty - l.indicativeQty) / l.indicativeQty) * 100 : null
          const varHigh = variance != null && Math.abs(variance) > 5
          return (
            <div key={l.id} className="card p-5 animate-fade-up">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="num text-sm font-bold">{l.lotNo}</span>
                    <StatusChip status={l.status} />
                    {l.knownSeller && <Chip tone="success">Known seller</Chip>}
                    {l.hazardous && <Chip tone="danger">Hazardous</Chip>}
                  </div>
                  <h2 className="font-display text-lg font-bold mt-1">{l.grade} · {l.metal}</h2>
                  <div className="text-sm text-ink-muted mt-0.5">{l.description}</div>
                  <div className="text-xs text-ink-faint mt-1">
                    Seller <span className="text-ink-muted font-semibold">{sellerOf(l)}</span> · Yard <span className="text-ink-muted font-semibold">{l.yard}</span>
                  </div>
                  {(() => {
                    const h = sellerHistory(l)
                    return (
                      <div className="text-[11px] text-ink-faint mt-1 flex items-center gap-1.5">
                        <History size={11} />
                        <span className="num">{h.submitted}</span> lots from this seller · <span className="num">{h.sold}</span> sold ·{' '}
                        <span className="num">{h.rejected}</span> rejected · <span className="num">{h.bypassed}</span> bypassed
                      </div>
                    )
                  })()}
                </div>
                <div className="flex gap-1.5">
                  {l.photos.map((p) => <PhotoThumb key={p.id} hue={p.hue} category={l.category} label={p.label} className="w-20 h-14" />)}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                {/* quantities */}
                <div className="card bg-surface-2 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint mb-2">Quantity check</div>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-ink-muted">Declared</span>
                    <span className="num font-semibold">{num(l.indicativeQty)} {l.uom}</span>
                  </div>
                  <div className="flex items-baseline justify-between text-sm mt-1.5">
                    <span className="text-ink-muted">Measured</span>
                    <span className="num font-semibold">{rep ? `${num(rep.measuredQty)} ${rep.uom}` : '—'}</span>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="text-xs text-ink-faint">Variance</span>
                    {variance != null
                      ? <Chip tone={varHigh ? 'warning' : 'success'}><span className="num">{variance >= 0 ? '+' : ''}{variance.toFixed(1)}%</span></Chip>
                      : <Chip>No report</Chip>}
                  </div>
                  {rep && (
                    <div className="text-xs text-ink-faint mt-2.5 pt-2.5 border-t border-line">
                      Condition <span className="font-semibold text-ink-muted capitalize">{rep.condition}</span> · inspected {fmtDate(rep.date)} · <span className="num">{rep.photoCount}</span> photos
                    </div>
                  )}
                </div>

                {/* checklist */}
                <div className="card bg-surface-2 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint mb-2">Inspector checklist</div>
                  {rep ? (
                    <ul className="space-y-1.5">
                      {rep.checklist.map((c, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          {c.ok
                            ? <Check size={14} className="text-success shrink-0" />
                            : <X size={14} className="text-danger shrink-0" />}
                          <span className={cx(!c.ok && 'text-danger font-medium')}>{c.item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <div className="text-sm text-ink-faint">Checklist unavailable.</div>}
                </div>

                {/* notes */}
                <div className="card bg-surface-2 p-4 flex flex-col">
                  <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint mb-2">Inspector notes</div>
                  <blockquote className="border-l-2 border-line-strong pl-3 text-sm text-ink-muted italic flex-1">
                    {rep?.notes ?? 'No notes recorded.'}
                  </blockquote>
                  <div className="text-xs text-ink-faint mt-2">Quantity is indicative — final on weighment.</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-line">
                <Button variant="success" onClick={() => approve(l)}>Approve</Button>
                <Button variant="secondary" onClick={() => { setTarget({ lot: l, outcome: 'flagged' }); setReason('') }}>
                  Send back for re-inspection
                </Button>
                <Button variant="ghost" className="text-danger hover:text-danger"
                  onClick={() => { setTarget({ lot: l, outcome: 'rejected' }); setReason('') }}>
                  Reject
                </Button>
                <span className="text-[12px] text-ink-faint ml-auto">
                  Whichever you press is written to the audit trail under your name, and the seller is told.
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* --------------------------- typed reason --------------------------- */}
      <Modal open={!!target} onClose={close} title={target ? `${OUTCOME_COPY[target.outcome].title} — ${target.lot.lotNo}` : ''}>
        {target && (
          <div className="space-y-4">
            <div className={cx('card border-0 p-4 text-sm',
              OUTCOME_COPY[target.outcome].intent === 'danger' ? 'bg-danger-soft' : 'bg-warning-soft')}>
              <div className="font-bold text-ink">{target.lot.grade} · {target.lot.metal}</div>
              <p className="text-ink-muted mt-1">
                {target.outcome === 'bypass'
                  ? `${num(target.lot.indicativeQty)} ${target.lot.uom} from ${sellerOf(target.lot)} goes to market on their description, with no yard visit. The quantity stays indicative and final on weighment.`
                  : target.outcome === 'flagged'
                    ? 'The lot goes back to the field executive and stays out of any catalogue until it is re-inspected.'
                    : 'The lot leaves the pipeline. The seller can resubmit it as a new lot.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {OUTCOME_COPY[target.outcome].presets.map((p) => (
                <button key={p} type="button" onClick={() => setReason(p)}
                  className={cx('h-7 px-2.5 rounded-lg border text-xs font-semibold transition-colors',
                    reason === p ? 'border-ember bg-ember-soft text-ember-strong' : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink')}>
                  {p}
                </button>
              ))}
            </div>
            <Field label="Reason" hint={OUTCOME_COPY[target.outcome].hint}>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={OUTCOME_COPY[target.outcome].placeholder} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={close}>Cancel</Button>
              <Button
                variant={OUTCOME_COPY[target.outcome].intent === 'danger' ? 'danger' : 'steel'}
                disabled={reason.trim().length < 4}
                onClick={confirm}>
                {OUTCOME_COPY[target.outcome].confirm}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  )
}
