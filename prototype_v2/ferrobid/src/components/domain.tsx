/* Domain components shared across Home, Browse and role pages. */
import { Link } from 'react-router-dom'
import { Layers, MapPin } from 'lucide-react'
import type { Catalogue, MetalCategory } from '../types'
import { useStore, catalogueUiStatus } from '../store/store'
import { inrCompact, relTime } from '../lib/format'
import { useNow } from '../lib/useTick'
import { Chip, Countdown, PhotoThumb, StatusChip, cx } from './ui'

/** Marketplace catalogue card — Home rail + Browse grid. */
export function CatalogueCard({ cat, className }: { cat: Catalogue; className?: string }) {
  const now = useNow()
  const lots = useStore((s) => s.lots)
  const users = useStore((s) => s.users)
  const catLots = lots.filter((l) => l.catalogueId === cat.id)
  const seller = users.find((u) => u.id === cat.sellerId)
  const ui = catalogueUiStatus(cat, now, catLots)
  const emdFrom = catLots.length ? Math.min(...catLots.map((l) => l.preBidEmd)) : 0
  const hues = catLots.slice(0, 3).flatMap((l) => l.photos.slice(0, 1))
  return (
    <Link to={`/catalogue/${cat.id}`}
      className={cx('card card-hover p-4 flex flex-col gap-3 min-w-[290px] focus-visible:outline-2 focus-visible:outline-ember', className)}>
      <div className="flex items-center justify-between gap-2">
        <StatusChip status={ui} />
        {ui === 'live' || ui === 'closing'
          ? <Countdown endsAt={cat.endsAt} prefix="ends" size="sm" />
          : ui === 'upcoming'
            ? <Chip tone="steel" className="num">starts {relTime(cat.startsAt, now)}</Chip>
            : <span className="text-xs text-ink-faint">{relTime(cat.endsAt, now)}</span>}
      </div>
      <div className="flex gap-1.5">
        {hues.map((p, i) => <PhotoThumb key={i} hue={p.hue} className="h-20 flex-1" />)}
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
    </Link>
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
      <span className="size-10 rounded-xl shrink-0"
        style={{ background: `linear-gradient(135deg, hsl(${category.hue} 35% 68%), hsl(${category.hue + 20} 42% 42%))` }} />
      <span>
        <span className="block font-semibold text-sm leading-tight">{category.label}</span>
        <span className="num block text-xs text-ink-faint mt-0.5">{count} lots</span>
      </span>
    </Link>
  )
}
