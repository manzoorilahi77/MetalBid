/* Executive Manager — focused approval desk for inspected lots. */
import { Check, X, ClipboardCheck } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { PageHeader, Button, Chip, StatusChip, EmptyState, PhotoThumb, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { num, fmtDate } from '../../lib/format'

/** Yard → seller firm (pipeline lots carry no sellerId — derive from the yard). */
const YARD_SELLER: Record<string, string> = {
  'Burma Mines Yard': 'Tata Steel — Jamshedpur Works',
  'VJNR Yard B': 'JSW Steel — Vijayanagar Works',
  'BSP Scrap Yard 3': 'SAIL — Bhilai Steel Plant',
  'Mancheswar Depot': 'East Coast Railway — Stores Dept',
  'MSTC Paradip Yard': 'MSTC — Eastern Region Yard',
  'RSTPS Ash Yard': 'NTPC — Ramagundam STPS',
}

export default function LotApproval() {
  const lots = useStore((s) => s.lots)
  const reports = useStore((s) => s.inspectionReports)
  const setLotStatus = useStore((s) => s.setLotStatus)
  const pushToast = useStore((s) => s.pushToast)

  const queue = lots.filter((l) => l.status === 'inspected')

  return (
    <Page>
      <PageHeader
        title="Lot approval"
        sub="Review verified inspection reports and clear lots for cataloguing. Approved lots become available in the catalogue builder."
        actions={<Chip tone="steel"><span className="num">{queue.length}</span> awaiting decision</Chip>}
      />

      {queue.length === 0 && (
        <EmptyState
          icon={<ClipboardCheck size={32} strokeWidth={1.5} />}
          title="Approval queue is clear"
          body="No inspected lots are waiting for a decision. New inspections will appear here as field executives verify them."
        />
      )}

      <div className="space-y-4">
        {queue.map((l) => {
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
                    {l.hazardous && <Chip tone="danger">Hazardous</Chip>}
                  </div>
                  <h2 className="font-display text-lg font-bold mt-1">{l.grade} · {l.metal}</h2>
                  <div className="text-sm text-ink-muted mt-0.5">{l.description}</div>
                  <div className="text-xs text-ink-faint mt-1">
                    Seller <span className="text-ink-muted font-semibold">{YARD_SELLER[l.yard] ?? 'Direct consignment'}</span> · Yard <span className="text-ink-muted font-semibold">{l.yard}</span>
                  </div>
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

              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-line">
                <Button variant="success"
                  onClick={() => { setLotStatus(l.id, 'approved'); pushToast({ kind: 'success', title: `${l.lotNo} approved for cataloguing`, body: `${l.grade} is now available in the catalogue builder.` }) }}>
                  Approve for cataloguing
                </Button>
                <Button variant="secondary"
                  onClick={() => { setLotStatus(l.id, 'flagged'); pushToast({ kind: 'warning', title: `${l.lotNo} sent back`, body: 'Flagged for re-inspection — the field team has been notified.' }) }}>
                  Send back / flag
                </Button>
                <Button variant="ghost" className="text-danger hover:text-danger"
                  onClick={() => { setLotStatus(l.id, 'rejected'); pushToast({ kind: 'danger', title: `${l.lotNo} rejected`, body: 'Lot removed from the auction pipeline. The seller will be informed.' }) }}>
                  Reject
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </Page>
  )
}
