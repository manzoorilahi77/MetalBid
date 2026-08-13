/* Field executive — inspection queue: catalogues assigned to me (mobile-first).
 *  Doubles as this role's dashboard (spec Part 3) — assigned catalogues with
 *  yard, seller and window, lots inspected vs total, then the inspection
 *  history underneath. Inspection only: no auction, no pricing, no money. */
import { Link } from 'react-router-dom'
import { ClipboardCheck, MapPin } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Chip, EmptyState, StatusChip } from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDate, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'

/** Lot states that still want a visit from us. `flagged` and `rejected` come
 *  back when Operations sends a lot down for re-inspection. */
const OPEN_LOT = ['pending_inspection', 'flagged', 'rejected']

export default function FieldQueue() {
  const now = useNow()
  const me = useStore((s) => s.currentUser)
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const users = useStore((s) => s.users)
  const reports = useStore((s) => s.inspectionReports)

  // Assignment — not catalogue status — decides what is mine. A catalogue that
  // has moved on while lots are still outstanding must not vanish from here.
  const myCatalogues = catalogues
    .filter((c) => c.assignedFieldExecId === me?.id && c.status !== 'closed')
    .map((c) => {
      const catLots = lots.filter((l) => l.catalogueId === c.id)
      const open = catLots.filter((l) => !l.inspectionWaived && OPEN_LOT.includes(l.status))
      return {
        c,
        catLots,
        open: open.length,
        sentBack: open.filter((l) => l.status !== 'pending_inspection').length,
        inspected: catLots.filter((l) => l.inspectionWaived || !OPEN_LOT.includes(l.status)).length,
      }
    })
    .sort((a, b) => (b.open > 0 ? 1 : 0) - (a.open > 0 ? 1 : 0)
      || Date.parse(a.c.inspectionFrom) - Date.parse(b.c.inspectionFrom))

  const outstanding = myCatalogues.reduce((n, x) => n + x.open, 0)

  const myReports = reports
    .filter((r) => r.inspectorId === me?.id)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  // Reports are immutable: a correction is a re-inspection that appends a new
  // version, so number each one within its lot rather than replacing it.
  const versionOf = (lotId: string, id: string) =>
    reports.filter((r) => r.lotId === lotId).sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
      .findIndex((r) => r.id === id) + 1
  const history = myReports.map((r) => ({ r, lot: lots.find((l) => l.id === r.lotId) })).filter((x) => x.lot)
  const tally = {
    verified: myReports.filter((r) => r.status === 'verified').length,
    flagged: myReports.filter((r) => r.status === 'flagged').length,
    rejected: myReports.filter((r) => r.status === 'rejected').length,
  }

  return (
    <Page className="max-w-xl">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Inspection queue</h1>
          <p className="text-sm text-ink-muted mt-1">{me?.name ?? 'Field executive'} · {myCatalogues.length} catalogue{myCatalogues.length === 1 ? '' : 's'} assigned</p>
        </div>
        <Chip tone={outstanding > 0 ? 'ember' : 'success'} className="num h-7">
          {outstanding > 0 ? `${outstanding} lot${outstanding === 1 ? '' : 's'} to inspect` : 'All caught up'}
        </Chip>
      </div>

      <div className="space-y-3">
        {myCatalogues.length === 0 && (
          <EmptyState icon={<ClipboardCheck size={32} strokeWidth={1.5} />} title="No catalogues assigned" body="Catalogues assigned to you by the Operation Manager will appear here, and you are notified the moment one arrives." />
        )}
        {myCatalogues.map(({ c, catLots, open, sentBack, inspected }) => {
          const seller = users.find((u) => u.id === c.sellerId)
          return (
            <Link key={c.id} to={`/field/catalogue/${c.id}`} className="block">
              <article className="card card-hover p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="num font-bold text-ember">{c.code}</span>
                  <span className="font-semibold text-sm">{c.title}</span>
                  {open === 0 && <Chip tone="success">Complete</Chip>}
                  {sentBack > 0 && <Chip tone="warning" className="num">{sentBack} sent back</Chip>}
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

      <div className="flex items-end justify-between mt-10 mb-3">
        <h2 className="text-lg font-bold">Inspection history</h2>
        {myReports.length > 0 && (
          <div className="num text-xs text-ink-faint">
            {tally.verified} verified · {tally.flagged} flagged · {tally.rejected} rejected
          </div>
        )}
      </div>
      <div className="space-y-2">
        {history.length === 0 && <p className="text-sm text-ink-faint">Your submitted reports will appear here. Once filed, a report cannot be edited — a correction is a fresh inspection.</p>}
        {history.map(({ r, lot }) => {
          const v = versionOf(r.lotId, r.id)
          return (
            <Link key={r.id} to={`/field/lot/${r.lotId}`} className="block">
              <div className="card card-hover px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <span className="num font-bold text-sm">{lot!.lotNo}</span>
                  <span className="text-sm text-ink-muted ml-2 truncate">{lot!.grade}</span>
                  {v > 1 && <span className="num text-[11px] text-ink-faint ml-2">v{v}</span>}
                  <div className="num text-[11px] text-ink-faint mt-0.5">
                    measured {num(r.measuredQty)} {r.uom} · {r.condition} · {relTime(r.date, now)}
                  </div>
                </div>
                <StatusChip status={lot!.status} />
              </div>
            </Link>
          )
        })}
      </div>
    </Page>
  )
}
