/* Executive Manager — lot pipeline as a horizontal Kanban board. */
import { Link } from 'react-router-dom'
import { Page } from '../../layout/Chrome'
import { PageHeader, Button, Chip, StatusChip, Stat, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { num } from '../../lib/format'
import type { Lot } from '../../types'

type ColKey = 'pending' | 'inspected' | 'approved' | 'live' | 'resolved' | 'attention'

const COLS: { key: ColKey; title: string; match: (l: Lot) => boolean; amber?: boolean }[] = [
  { key: 'pending', title: 'Pending inspection', match: (l) => l.status === 'pending_inspection' },
  { key: 'inspected', title: 'Inspected', match: (l) => l.status === 'inspected' },
  { key: 'approved', title: 'Approved', match: (l) => l.status === 'approved' },
  { key: 'live', title: 'In auction', match: (l) => l.status === 'live' },
  { key: 'resolved', title: 'Resolved', match: (l) => ['sold', 'sta', 'unsold'].includes(l.status) },
  { key: 'attention', title: 'Attention', match: (l) => ['flagged', 'rejected'].includes(l.status), amber: true },
]

const CARD_CAP = 8

export default function Pipeline() {
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const users = useStore((s) => s.users)
  const reports = useStore((s) => s.inspectionReports)
  const setLotStatus = useStore((s) => s.setLotStatus)
  const publishDraftCatalogue = useStore((s) => s.publishDraftCatalogue)
  const pushToast = useStore((s) => s.pushToast)

  const draftCatalogues = catalogues.filter((c) => c.status === 'draft')

  const byCol = COLS.map((c) => ({ ...c, lots: lots.filter(c.match) }))

  const measured = (l: Lot) => reports.find((r) => r.id === l.inspectionReportId)?.measuredQty ?? null

  const actions = (col: ColKey, l: Lot) => {
    switch (col) {
      case 'inspected':
        return (
          <div className="flex gap-1.5">
            <Button size="sm" variant="success" className="flex-1"
              onClick={() => { setLotStatus(l.id, 'approved'); pushToast({ kind: 'success', title: `${l.lotNo} approved`, body: 'Lot is ready for cataloguing.' }) }}>
              Approve
            </Button>
            <Button size="sm" variant="ghost" className="flex-1"
              onClick={() => { setLotStatus(l.id, 'flagged'); pushToast({ kind: 'warning', title: `${l.lotNo} flagged`, body: 'Moved to the attention column for review.' }) }}>
              Flag
            </Button>
          </div>
        )
      case 'approved':
        // Under the catalogue-before-inspection lifecycle, a lot only reaches
        // 'approved' after already being catalogued (or via waiver on an
        // already-catalogue-eligible lot) — there's nothing actionable here.
        return null
      case 'live':
        return l.catalogueId ? (
          <Link to={`/catalogue/${l.catalogueId}`} className="block">
            <Button size="sm" variant="ghost" className="w-full">Open auction</Button>
          </Link>
        ) : null
      case 'attention':
        return (
          <Button size="sm" variant="secondary" className="w-full"
            onClick={() => { setLotStatus(l.id, 'inspected'); pushToast({ kind: 'success', title: `${l.lotNo} resolved`, body: 'Returned to the inspected queue for approval.' }) }}>
            Resolve
          </Button>
        )
      default:
        return null
    }
  }

  return (
    <Page>
      <PageHeader title="Lot pipeline" sub="Every lot on the platform, from seller submission through inspection, approval, auction and resolution." />

      {draftCatalogues.length > 0 && (
        <div className="mb-6 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Draft catalogues awaiting publish</div>
          {draftCatalogues.map((c) => {
            const catLots = lots.filter((l) => l.catalogueId === c.id)
            const resolved = catLots.filter((l) => l.status === 'approved').length
            const ready = catLots.length > 0 && resolved === catLots.length
            const exec = users.find((u) => u.id === c.assignedFieldExecId)
            return (
              <div key={c.id} className="card p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="num text-sm font-bold">{c.code}</span>
                    <span className="font-semibold text-sm">{c.title}</span>
                  </div>
                  <div className="text-xs text-ink-muted mt-0.5">
                    Assigned to {exec?.name ?? 'unassigned'} · <span className="num">{resolved}/{catLots.length}</span> lots approved
                  </div>
                </div>
                <Button
                  size="sm" variant={ready ? 'success' : 'secondary'} disabled={!ready}
                  onClick={() => {
                    const res = publishDraftCatalogue(c.id, 'now')
                    pushToast(res.ok
                      ? { kind: 'success', title: `${c.code} is live`, body: `${catLots.length} lots are open for bidding.` }
                      : { kind: 'warning', title: 'Cannot publish yet', body: res.error })
                  }}
                >
                  {ready ? 'Publish catalogue' : `${resolved}/${catLots.length} lots approved`}
                </Button>
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <Stat label="Pending inspection" value={byCol[0].lots.length} tone="steel" />
        <Stat label="Inspected" value={byCol[1].lots.length} tone="steel" />
        <Stat label="Approved" value={byCol[2].lots.length} tone="success" />
        <Stat label="In auction" value={byCol[3].lots.length} tone="ember" />
        <Stat label="Resolved" value={byCol[4].lots.length} />
        <Stat label="Attention" value={byCol[5].lots.length} tone="warning" />
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
        {byCol.map((col) => (
          <div key={col.key} className="w-72 shrink-0">
            <div className={cx('flex items-center justify-between px-3 py-2 rounded-t-2xl border border-b-0',
              col.amber ? 'bg-warning-soft border-warning/25' : 'bg-surface-2 border-line')}>
              <span className={cx('text-sm font-bold', col.amber ? 'text-warning' : 'text-ink')}>{col.title}</span>
              <span className={cx('num text-xs font-bold px-2 py-0.5 rounded-full', col.amber ? 'bg-warning text-white' : 'bg-surface text-ink-muted border border-line')}>
                {col.lots.length}
              </span>
            </div>
            <div className={cx('rounded-b-2xl border border-t-0 p-2 space-y-2 min-h-32 bg-canvas',
              col.amber ? 'border-warning/25' : 'border-line')}>
              {col.lots.length === 0 && (
                <div className="text-xs text-ink-faint text-center py-8">Nothing here</div>
              )}
              {col.lots.slice(0, CARD_CAP).map((l) => {
                const m = measured(l)
                return (
                  <div key={l.id} className="card p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="num text-xs font-bold text-ink">{l.lotNo}</span>
                      <StatusChip status={l.status} />
                    </div>
                    <div className="text-sm font-semibold leading-tight">{l.grade} <span className="text-ink-muted font-normal">· {l.metal}</span></div>
                    <div className="text-xs text-ink-muted">
                      <span className="num">{num(l.indicativeQty)} {l.uom}</span> · {l.yard}
                    </div>
                    {m != null && (
                      <div className="text-xs text-ink-faint">Measured <span className="num text-ink-muted">{num(m)} {l.uom}</span> on inspection</div>
                    )}
                    {actions(col.key, l)}
                  </div>
                )
              })}
              {col.lots.length > CARD_CAP && (
                <div className="text-xs text-ink-faint text-center py-1.5">
                  <Chip tone="neutral">+{col.lots.length - CARD_CAP} more lots</Chip>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Page>
  )
}
