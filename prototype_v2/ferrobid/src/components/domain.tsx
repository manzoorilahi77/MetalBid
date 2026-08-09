/* Domain components shared across Home, Browse and role pages. */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Download, Layers, MapPin, Star } from 'lucide-react'
import type { Catalogue, MetalCategory } from '../types'
import { useStore, catalogueUiStatus, isCatalogueShortlisted } from '../store/store'
import { fmtDate, inrCompact, relTime } from '../lib/format'
import { categoryImageUrl } from '../data/categoryImages'
import { useNow } from '../lib/useTick'
import { LotShortlistModal } from './LotShortlistModal'
import { Button, Chip, Countdown, PhotoThumb, StatusChip, cx } from './ui'

/** Marketplace catalogue card — Home rail + Browse grid. Pass `showBuyerActions`
 *  to add the Browse & Shortlist footer (watchlist star, lot picker, PDF, view
 *  details) — opt-in so Home/Browse's guest- and role-neutral cards, which
 *  render this same component, are unaffected. */
export function CatalogueCard({ cat, className, showBuyerActions }: { cat: Catalogue; className?: string; showBuyerActions?: boolean }) {
  const now = useNow()
  const me = useStore((s) => s.currentUser)
  const lots = useStore((s) => s.lots)
  const users = useStore((s) => s.users)
  const watchlist = useStore((s) => s.watchlist)
  const selections = useStore((s) => s.selections)
  const toggleWatchlist = useStore((s) => s.toggleWatchlist)
  const pushToast = useStore((s) => s.pushToast)
  const [pickerOpen, setPickerOpen] = useState(false)
  const catLots = lots.filter((l) => l.catalogueId === cat.id)
  const seller = users.find((u) => u.id === cat.sellerId)
  const ui = catalogueUiStatus(cat, now, catLots)
  const emdFrom = catLots.length ? Math.min(...catLots.map((l) => l.preBidEmd)) : 0
  const emdTo = catLots.length ? Math.max(...catLots.map((l) => l.preBidEmd)) : 0
  const covers = catLots.slice(0, 3).flatMap((l) => l.photos.slice(0, 1).map((p) => ({ photo: p, category: l.category })))
  const shortlisted = isCatalogueShortlisted({ watchlist, selections }, me?.id, cat.id)

  return (
    <div className={cx('card card-hover flex flex-col min-w-[290px]',
      showBuyerActions && shortlisted && 'border-ember/40 bg-ember-soft/10 ring-1 ring-ember/15',
      className)}>
      <Link to={`/catalogue/${cat.id}`} className="p-4 flex flex-col gap-3 flex-1 focus-visible:outline-2 focus-visible:outline-ember">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <StatusChip status={ui} />
            {showBuyerActions && (cat.type === 'tender' ? <Chip tone="steel">Sealed tender</Chip> : <Chip tone="neutral">Forward</Chip>)}
          </div>
          {ui === 'live' || ui === 'closing'
            ? <Countdown endsAt={cat.endsAt} prefix="ends" size="sm" />
            : ui === 'upcoming'
              ? <Chip tone="steel" className="num">starts {relTime(cat.startsAt, now)}</Chip>
              : <span className="text-xs text-ink-faint">{relTime(cat.endsAt, now)}</span>}
        </div>
        <div className="flex gap-1.5">
          {covers.map((c, i) => <PhotoThumb key={i} hue={c.photo.hue} category={c.category} className="h-20 flex-1" />)}
        </div>
        <div>
          <div className="text-[11px] num font-semibold text-ink-faint">{cat.code}</div>
          <div className="font-display font-bold leading-snug line-clamp-2 mt-0.5">{cat.title}</div>
          <div className="text-xs text-ink-muted mt-1 line-clamp-1">{seller?.firm}</div>
        </div>
        <div className="mt-auto pt-2 border-t border-line flex items-center justify-between text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1"><Layers size={12} /> {catLots.length} lots</span>
          <span className="inline-flex items-center gap-1"><MapPin size={12} /> {cat.region}</span>
          <span className="num font-semibold text-ink">EMD from {inrCompact(emdFrom)}</span>
        </div>
        {showBuyerActions && (
          <div className="flex items-center justify-between text-[11px] text-ink-faint">
            <span className="num">EMD {inrCompact(emdFrom)}–{inrCompact(emdTo)}</span>
            <span className="inline-flex items-center gap-1"><CalendarDays size={11} /> Inspect {fmtDate(cat.inspectionFrom)}–{fmtDate(cat.inspectionTo)}</span>
          </div>
        )}
      </Link>

      {showBuyerActions && (
        <div className="flex items-center gap-1 px-3 pb-3 pt-1 border-t border-line">
          <button
            onClick={() => toggleWatchlist(cat.id)}
            aria-label={shortlisted ? 'Remove from watchlist' : 'Add to watchlist'}
            aria-pressed={shortlisted}
            title="Watchlist this catalogue"
            className={cx('p-2 rounded-lg transition-colors', shortlisted ? 'text-ember' : 'text-ink-faint hover:text-ink hover:bg-surface-2')}
          >
            <Star size={16} fill={shortlisted ? 'currentColor' : 'none'} />
          </button>
          <Button size="sm" variant="secondary" onClick={() => setPickerOpen(true)}>Shortlist lots</Button>
          <Button size="sm" variant="ghost"
            onClick={() => pushToast({ kind: 'info', title: 'Catalogue PDF downloading', body: `${cat.code} Catalogue & Annexure.pdf (demo)` })}>
            <Download size={14} /> PDF
          </Button>
          <Link to={`/catalogue/${cat.id}`} className="ml-auto">
            <Button size="sm" variant="ghost">View details</Button>
          </Link>
        </div>
      )}

      {showBuyerActions && (
        <LotShortlistModal open={pickerOpen} cat={cat} onClose={() => setPickerOpen(false)}
          footer={() => <div className="flex justify-end mt-4"><Button onClick={() => setPickerOpen(false)}>Done</Button></div>} />
      )}
    </div>
  )
}

export const CATEGORY_META: { key: MetalCategory; label: string; hue: number }[] = [
  { key: 'assets', label: 'Assets & Machinery', hue: 210 },
  { key: 'scrap', label: 'Scrap', hue: 20 },
  { key: 'flat-products', label: 'Flat Products', hue: 200 },
  { key: 'long-products', label: 'Long Products', hue: 30 },
  { key: 'melting-products', label: 'Melting Products', hue: 10 },
  { key: 'coal', label: 'Coal', hue: 260 },
  { key: 'chemicals', label: 'Chemicals', hue: 150 },
  { key: 'minerals', label: 'Minerals', hue: 90 },
  { key: 'ferro-alloys', label: 'Ferro Alloys', hue: 330 },
]

export function CategoryTile({ category }: { category: (typeof CATEGORY_META)[number] }) {
  const lots = useStore((s) => s.lots)
  const count = lots.filter((l) => l.category === category.key && l.catalogueId).length
  return (
    <Link to={`/browse?category=${category.key}`}
      className="card card-hover p-4 flex items-center gap-3">
      <img src={categoryImageUrl(category.key, category.hue)} alt="" loading="lazy"
        className="size-10 rounded-xl shrink-0 object-cover" />
      <span>
        <span className="block font-semibold text-sm leading-tight">{category.label}</span>
        <span className="num block text-xs text-ink-faint mt-0.5">{count} lots</span>
      </span>
    </Link>
  )
}
