/* Field executive — full lot context: specs, photos, logistics, checklist preview, seller trust. */
import { Link, useParams } from 'react-router-dom'
import { Check, ChevronLeft, ClipboardCheck, MapPin, Phone } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, EmptyState, PhotoThumb, StatusChip } from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDate, num } from '../../lib/format'

const CHECK_ITEMS = [
  'Material matches declared grade',
  'Quantity verified (visual/weighment)',
  'No hazardous contamination',
  'Loading access available',
  'Photos captured',
]

export default function FieldLotDetail() {
  const { lotId } = useParams()
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const users = useStore((s) => s.users)
  const inspectionReports = useStore((s) => s.inspectionReports)

  const lot = lots.find((l) => l.id === lotId)
  if (!lot) {
    return (
      <Page className="max-w-xl">
        <EmptyState title="Lot not found" action={<Link to="/field"><Button variant="secondary">Back to queue</Button></Link>} />
      </Page>
    )
  }
  const cat = catalogues.find((c) => c.id === lot.catalogueId)
  const seller = users.find((u) => u.id === cat?.sellerId)
  const canInspect = ['pending_inspection', 'flagged', 'rejected'].includes(lot.status)
  const report = inspectionReports.find((r) => r.id === lot.inspectionReportId)

  return (
    <Page className="max-w-xl pb-28">
      <Link to={cat ? `/field/catalogue/${cat.id}` : '/field'} className="inline-flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-ink mb-4">
        <ChevronLeft size={16} /> {cat?.code ?? 'Queue'}
      </Link>

      <div className="card p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="num font-bold">{lot.lotNo}</span>
          <Chip tone="steel">{lot.metal}</Chip>
          <StatusChip status={lot.status} />
          {lot.hazardous && <Chip tone="danger">Hazardous</Chip>}
        </div>
        <h1 className="font-display text-xl font-bold mt-1">{lot.grade}</h1>
        <div className="text-sm text-ink-muted mt-1">{lot.description}</div>
        <div className="num text-sm font-semibold mt-2">Declared {num(lot.indicativeQty)} {lot.uom}</div>
      </div>

      <div>
        <span className="block text-[13px] font-semibold mt-5 mb-2">Photos</span>
        <div className="grid grid-cols-2 gap-3">
          {lot.photos.map((p) => (
            <PhotoThumb key={p.id} hue={p.hue} category={lot.category} label={p.label} className="h-28 rounded-2xl w-full" />
          ))}
        </div>
      </div>

      {cat && (
        <div className="card p-4 mt-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint mb-2">Visit & logistics</div>
          <div className="text-sm font-semibold flex items-center gap-1"><MapPin size={13} /> {cat.yardName}</div>
          <div className="text-xs text-ink-faint mt-0.5">{cat.yardAddress}</div>
          <div className="num text-sm mt-2">{fmtDate(cat.inspectionFrom)} – {fmtDate(cat.inspectionTo)} · {cat.inspectionHours}</div>
          <div className="text-xs text-ink-faint mt-1 flex items-center gap-1"><Phone size={11} /> {cat.inspectionContact.name} · {cat.inspectionContact.phone}</div>
        </div>
      )}

      <div className="mt-5">
        <span className="block text-[13px] font-semibold mb-2">Inspection checklist preview</span>
        <div className="card divide-y divide-line">
          {CHECK_ITEMS.map((item) => (
            <div key={item} className="flex items-center gap-3 px-4 py-3">
              <span className="size-6 rounded-lg grid place-items-center border border-line-strong text-ink-faint shrink-0"><Check size={14} /></span>
              <span className="text-sm font-medium text-ink-muted">{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4 mt-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint mb-2">Seller trust</div>
        <div className="text-sm font-semibold">{seller?.firm ?? 'Seller'}</div>
        {lot.knownSeller && <Chip tone="success" className="mt-2">Known seller</Chip>}
      </div>

      {lot.inspectionWaived ? (
        <div className="card p-4 mt-5 bg-success-soft border-success/25">
          <div className="font-semibold text-success">Inspection waived</div>
          <div className="text-xs text-ink-muted mt-1">Approved as a known seller{lot.waivedReason ? ` — ${lot.waivedReason}` : ''}. No field inspection needed.</div>
        </div>
      ) : canInspect ? (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
          <div className="max-w-xl mx-auto px-4 py-3">
            <Link to={`/field/inspect/${lot.id}`} className="block">
              <Button className="w-full" size="lg"><ClipboardCheck size={17} /> Start inspection</Button>
            </Link>
          </div>
        </div>
      ) : report ? (
        <div className="card p-4 mt-5 bg-success-soft border-success/25">
          <div className="font-semibold text-success">Inspection complete — read only</div>
          <div className="text-xs text-ink-muted mt-1">
            This lot is <b className="text-ink">{lot.status}</b> and can no longer be re-inspected from here.
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-3">
            <Chip tone="steel" className="capitalize">{report.condition}</Chip>
            <span className="num text-sm font-semibold">Measured {num(report.measuredQty)} {report.uom}</span>
          </div>
          {report.notes && <div className="text-xs text-ink-muted mt-2 italic">{report.notes}</div>}
        </div>
      ) : null}
    </Page>
  )
}
