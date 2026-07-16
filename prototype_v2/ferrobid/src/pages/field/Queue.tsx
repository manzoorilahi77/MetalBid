/* Field executive — inspection queue (mobile-first). */
import { Link } from 'react-router-dom'
import { ClipboardCheck, MapPin } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, EmptyState, PhotoThumb, StatusChip } from '../../components/ui'
import { useStore } from '../../store/store'
import { num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'

export default function FieldQueue() {
  const now = useNow()
  const me = useStore((s) => s.currentUser)
  const lots = useStore((s) => s.lots)
  const reports = useStore((s) => s.inspectionReports)

  const queue = lots.filter((l) => l.status === 'pending_inspection')
  const myReports = reports
    .filter((r) => r.inspectorId === me?.id || r.inspectorId === 'u-field-1')
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  const done = myReports
    .map((r) => ({ r, lot: lots.find((l) => l.id === r.lotId) }))
    .filter((x) => x.lot && ['inspected', 'flagged', 'rejected', 'approved'].includes(x.lot.status))
    .slice(0, 6)

  return (
    <Page className="max-w-xl">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Inspection queue</h1>
          <p className="text-sm text-ink-muted mt-1">{me?.name ?? 'Field executive'} · {queue.length} visit{queue.length === 1 ? '' : 's'} pending</p>
        </div>
        <Chip tone="ember" className="num h-7">{queue.length} due</Chip>
      </div>

      <div className="space-y-3">
        {queue.length === 0 && <EmptyState icon={<ClipboardCheck size={32} strokeWidth={1.5} />} title="Queue clear" body="No lots pending inspection right now." />}
        {queue.map((l) => (
          <article key={l.id} className="card p-4">
            <div className="flex gap-3">
              <PhotoThumb hue={l.photos[0]?.hue ?? 24} className="w-20 h-16" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="num font-bold">{l.lotNo}</span>
                  <Chip tone="steel">{l.metal}</Chip>
                  <Chip tone="warning">Due today</Chip>
                </div>
                <div className="font-semibold text-sm mt-1">{l.grade}</div>
                <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-1">
                  <MapPin size={11} /> {l.yard}
                </div>
                <div className="num text-xs text-ink-faint mt-0.5">Declared {num(l.indicativeQty)} {l.uom}</div>
              </div>
            </div>
            <Link to={`/field/inspect/${l.id}`} className="block mt-3">
              <Button className="w-full" size="lg"><ClipboardCheck size={17} /> Start inspection</Button>
            </Link>
          </article>
        ))}
      </div>

      <h2 className="text-lg font-bold mt-10 mb-3">Recently completed</h2>
      <div className="space-y-2">
        {done.length === 0 && <p className="text-sm text-ink-faint">Your submitted reports will appear here.</p>}
        {done.map(({ r, lot }) => (
          <div key={r.id} className="card px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <span className="num font-bold text-sm">{lot!.lotNo}</span>
              <span className="text-sm text-ink-muted ml-2 truncate">{lot!.grade}</span>
              <div className="num text-[11px] text-ink-faint mt-0.5">measured {num(r.measuredQty)} {r.uom} · {relTime(r.date, now)}</div>
            </div>
            <StatusChip status={lot!.status} />
          </div>
        ))}
      </div>
    </Page>
  )
}
