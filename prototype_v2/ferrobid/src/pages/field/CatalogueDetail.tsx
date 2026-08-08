/* Field executive — assigned catalogue context + lot list ("catalogue inside the catalogue"). */
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, MapPin, Phone } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, EmptyState, PhotoThumb, StatusChip, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDate, num } from '../../lib/format'
import type { Lot } from '../../types'

export default function FieldCatalogueDetail() {
  const { catalogueId } = useParams()
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const users = useStore((s) => s.users)

  const cat = catalogues.find((c) => c.id === catalogueId)
  if (!cat) {
    return (
      <Page className="max-w-xl">
        <EmptyState title="Catalogue not found" action={<Link to="/field"><Button variant="secondary">Back to queue</Button></Link>} />
      </Page>
    )
  }

  const seller = users.find((u) => u.id === cat.sellerId)
  const catLots = cat.lotIds.map((id) => lots.find((l) => l.id === id)).filter((l): l is Lot => !!l)

  return (
    <Page className="max-w-xl pb-16">
      <Link to="/field" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-ink mb-4">
        <ChevronLeft size={16} /> Queue
      </Link>

      <div className="card p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="num font-bold">{cat.code}</span>
          <Chip tone="steel">Assigned</Chip>
        </div>
        <h1 className="font-display text-xl font-bold mt-1">{cat.title}</h1>
        <div className="text-sm text-ink-muted mt-1">{seller?.firm ?? 'Seller'}</div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Yard</div>
            <div className="text-sm font-semibold mt-0.5 flex items-center gap-1"><MapPin size={12} /> {cat.yardName}</div>
            <div className="text-xs text-ink-faint mt-0.5">{cat.yardAddress}</div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Inspection window</div>
            <div className="num text-sm font-semibold mt-0.5">{fmtDate(cat.inspectionFrom)} – {fmtDate(cat.inspectionTo)}</div>
            <div className="text-xs text-ink-faint mt-0.5">{cat.inspectionHours}</div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Inspection contact</div>
            <div className="text-sm font-semibold mt-0.5">{cat.inspectionContact.name}</div>
            <div className="text-xs text-ink-faint mt-0.5 flex items-center gap-1"><Phone size={11} /> {cat.inspectionContact.phone}</div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Lots</div>
            <div className="num text-sm font-semibold mt-0.5">{catLots.length} total</div>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-bold mt-6 mb-3">Lots to inspect</h2>
      <div className="space-y-2">
        {catLots.map((l) => {
          const card = (
            <article className={cx('card p-3.5 flex items-center gap-3', !l.inspectionWaived && 'card-hover')}>
              <PhotoThumb hue={l.photos[0]?.hue ?? 24} category={l.category} className="w-16 h-12" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="num font-bold text-sm">{l.lotNo}</span>
                  <StatusChip status={l.status} />
                  {l.inspectionWaived && <Chip tone="success">Waived</Chip>}
                </div>
                <div className="text-sm font-semibold mt-0.5">{l.grade} · {l.metal}</div>
                <div className="num text-xs text-ink-faint mt-0.5">Declared {num(l.indicativeQty)} {l.uom}</div>
              </div>
            </article>
          )
          // waived lots are read-only context, not an actionable item — no link
          return l.inspectionWaived
            ? <div key={l.id}>{card}</div>
            : <Link key={l.id} to={`/field/lot/${l.id}`} className="block">{card}</Link>
        })}
      </div>
    </Page>
  )
}
