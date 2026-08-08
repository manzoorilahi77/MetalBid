/* Field executive — inspection queue: catalogues assigned to me (mobile-first). */
import { Link } from 'react-router-dom'
import { ClipboardCheck, MapPin } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Chip, EmptyState, StatusChip } from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDate, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'

export default function FieldQueue() {
  const now = useNow()
  const me = useStore((s) => s.currentUser)
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const users = useStore((s) => s.users)
  const reports = useStore((s) => s.inspectionReports)

  const myCatalogues = catalogues.filter((c) => c.status === 'draft' && c.assignedFieldExecId === me?.id)
  const myReports = reports
    .filter((r) => r.inspectorId === me?.id)
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
          <p className="text-sm text-ink-muted mt-1">{me?.name ?? 'Field executive'} · {myCatalogues.length} catalogue{myCatalogues.length === 1 ? '' : 's'} assigned</p>
        </div>
        <Chip tone="ember" className="num h-7">{myCatalogues.length} assigned</Chip>
      </div>

      <div className="space-y-3">
        {myCatalogues.length === 0 && (
          <EmptyState icon={<ClipboardCheck size={32} strokeWidth={1.5} />} title="No catalogues assigned" body="Catalogues assigned to you by the Executive Manager will appear here." />
        )}
        {myCatalogues.map((c) => {
          const catLots = lots.filter((l) => l.catalogueId === c.id)
          const inspected = catLots.filter((l) => l.status !== 'pending_inspection').length
          const seller = users.find((u) => u.id === c.sellerId)
          return (
            <Link key={c.id} to={`/field/catalogue/${c.id}`} className="block">
              <article className="card card-hover p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="num font-bold">{c.code}</span>
                  <span className="font-semibold text-sm">{c.title}</span>
                </div>
                <div className="text-xs text-ink-muted mt-1 flex items-center gap-1">
                  <MapPin size={11} /> {c.yardName} · {c.region}
                </div>
                <div className="text-xs text-ink-faint mt-0.5">
                  {seller?.firm ?? 'Seller'} · {fmtDate(c.inspectionFrom)}–{fmtDate(c.inspectionTo)} · {c.inspectionHours}
                </div>
                <div className="num text-xs text-ink-muted mt-2 font-semibold">{inspected} of {catLots.length} lots inspected</div>
              </article>
            </Link>
          )
        })}
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
