/* My Lots & Batches — pipeline, approved, in-auction and closed lots. */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Chip, EmptyState, PageHeader, PhotoThumb, StatusChip, Tabs, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, num } from '../../lib/format'
import type { Lot } from '../../types'

type TabKey = 'pipeline' | 'approved' | 'live' | 'closed'

export default function MyLots() {
  const me = useStore((s) => s.currentUser)
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const reports = useStore((s) => s.inspectionReports)
  const [tab, setTab] = useState<TabKey>('pipeline')

  const myCatIds = catalogues.filter((c) => c.sellerId === me?.id).map((c) => c.id)
  const mine = lots.filter((l) => (l.catalogueId ? myCatIds.includes(l.catalogueId) : true))

  const groups: Record<TabKey, Lot[]> = {
    pipeline: mine.filter((l) => ['pending_inspection', 'inspected', 'flagged', 'rejected'].includes(l.status)),
    approved: mine.filter((l) => l.status === 'approved'),
    live: mine.filter((l) => l.status === 'live'),
    closed: mine.filter((l) => ['sold', 'sta', 'unsold'].includes(l.status)),
  }
  const list = groups[tab]

  return (
    <Page>
      <PageHeader title="My lots & batches" sub="Uncatalogued lots are managed by ferroBid ops through inspection and approval. Quantity is indicative until weighment." />
      <Tabs<TabKey> value={tab} onChange={setTab} tabs={[
        { key: 'pipeline', label: 'In pipeline', count: groups.pipeline.length },
        { key: 'approved', label: 'Approved', count: groups.approved.length },
        { key: 'live', label: 'In auction', count: groups.live.length },
        { key: 'closed', label: 'Sold & closed', count: groups.closed.length },
      ]} />
      <div className="mt-5 space-y-3">
        {list.length === 0 && <EmptyState title="Nothing here" body="Lots move through: pending inspection → inspected → approved → catalogued → auctioned." />}
        {list.map((l) => {
          const rep = reports.find((r) => r.id === l.inspectionReportId)
          const cat = catalogues.find((c) => c.id === l.catalogueId)
          const variance = rep ? ((rep.measuredQty - l.indicativeQty) / l.indicativeQty) * 100 : null
          const attention = l.status === 'flagged' || l.status === 'rejected'
          return (
            <article key={l.id} className={cx('card p-4', attention && (l.status === 'rejected' ? 'border-danger/40' : 'border-warning/40'))}>
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <PhotoThumb hue={l.photos[0]?.hue ?? 24} className="w-20 h-14" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="num font-bold">{l.lotNo}</span>
                    <Chip tone="steel">{l.metal}</Chip>
                    <span className="font-semibold text-sm">{l.grade}</span>
                    <StatusChip status={l.status} />
                    {cat && <Link to={`/catalogue/${cat.id}`}><Chip tone="ember" className="num hover:opacity-80">{cat.code}</Chip></Link>}
                  </div>
                  <p className="text-sm text-ink-muted mt-1 line-clamp-1">{l.description}</p>
                  {rep && (
                    <p className="text-xs mt-1 text-ink-muted">
                      Inspected: measured <b className="num text-ink">{num(rep.measuredQty)} {rep.uom}</b>
                      {variance != null && (
                        <span className={cx('num font-semibold ml-1', Math.abs(variance) > 5 ? 'text-warning' : 'text-success')}>
                          ({variance >= 0 ? '+' : ''}{variance.toFixed(1)}% vs declared)
                        </span>
                      )}
                      {' '}· condition {rep.condition}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-x-6 text-sm md:text-right shrink-0">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Declared qty</div>
                    <div className="num font-bold">{num(l.indicativeQty)} {l.uom}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Start rate</div>
                    <div className="num font-bold">{inr(l.startRate)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">{tab === 'closed' ? 'Result (H1)' : 'Current'}</div>
                    <div className={cx('num font-bold', l.currentRate ? 'text-ember-strong' : 'text-ink-faint')}>{l.currentRate ? inr(l.currentRate) : '—'}</div>
                  </div>
                </div>
              </div>
              {attention && rep && (
                <div className={cx('mt-3 rounded-xl px-4 py-2.5 text-sm font-medium flex items-start gap-2',
                  l.status === 'rejected' ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning')}>
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <span>{l.status === 'rejected' ? 'Rejected: ' : 'Flagged: '}{rep.notes}</span>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </Page>
  )
}
