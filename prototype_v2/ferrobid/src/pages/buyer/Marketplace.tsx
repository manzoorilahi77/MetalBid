/* Buyer marketplace — faceted sidebar + search/sort + status tabs + photo card grid. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, X, RotateCcw, Building2, MapPin, Clock, Layers, ChevronRight, ChevronDown, SearchX } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, EmptyState, PageHeader, PhotoThumb, Select, Toggle, cx } from '../../components/ui'
import { CATEGORY_META } from '../../components/domain'
import { useStore, catalogueUiStatus } from '../../store/store'
import { useNow } from '../../lib/useTick'
import { countdown, inrCompact, relTime } from '../../lib/format'
import type { Catalogue, Lot, MetalCategory } from '../../types'

type Tab = 'live' | 'upcoming' | 'closed'
type EmdBand = 'any' | 'lt50k' | '50k-2l' | 'gt2l'
type SortKey = 'default' | 'emdAsc' | 'emdDesc' | 'title'

const EMD_BANDS: { key: EmdBand; label: string }[] = [
  { key: 'any', label: 'EMD: any' },
  { key: 'lt50k', label: 'EMD under ₹50k' },
  { key: '50k-2l', label: 'EMD ₹50k – ₹2 L' },
  { key: 'gt2l', label: 'EMD over ₹2 L' },
]

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'default', label: 'Ending Soonest' },
  { key: 'title', label: 'Title A–Z' },
  { key: 'emdAsc', label: 'EMD: Low to High' },
  { key: 'emdDesc', label: 'EMD: High to Low' },
]

const inBand = (emd: number, band: EmdBand) =>
  band === 'any' ? true
  : band === 'lt50k' ? emd < 50_000
  : band === '50k-2l' ? emd >= 50_000 && emd <= 200_000
  : emd > 200_000

const emdFrom = (cat: Catalogue, lots: Lot[]) => {
  const catLots = lots.filter((l) => l.catalogueId === cat.id)
  return catLots.length ? Math.min(...catLots.map((l) => l.preBidEmd)) : Infinity
}

/* ------------------------------- Lot card -------------------------------- */
function LotCard({ cat }: { cat: Catalogue }) {
  const now = useNow()
  const lots = useStore((s) => s.lots)
  const users = useStore((s) => s.users)
  const catLots = lots.filter((l) => l.catalogueId === cat.id)
  const seller = users.find((u) => u.id === cat.sellerId)
  const ui = catalogueUiStatus(cat, now, catLots)
  const firstLot = catLots[0]
  const emd = catLots.length ? Math.min(...catLots.map((l) => l.preBidEmd)) : 0

  const badge = {
    live: { label: 'LIVE', dot: 'bg-white' },
    closing: { label: 'CLOSING', dot: 'bg-white' },
    upcoming: { label: 'UPCOMING', dot: 'bg-white/70' },
    closed: { label: 'CLOSED', dot: 'bg-white/50' },
  }[ui]

  const timeLabel =
    ui === 'live' || ui === 'closing' ? countdown(Date.parse(cat.endsAt) - now)
    : ui === 'upcoming' ? relTime(cat.startsAt, now)
    : relTime(cat.endsAt, now)

  return (
    <Link to={`/catalogue/${cat.id}`}
      className="card card-hover overflow-hidden flex flex-col group focus-visible:outline-2 focus-visible:outline-ember">
      <div className="relative">
        <PhotoThumb hue={firstLot?.photos[0]?.hue ?? 30} category={firstLot?.category} className="w-full h-40 rounded-none border-0" />
        <span className={cx('absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold backdrop-blur-sm',
          ui === 'live' || ui === 'closing' ? 'bg-white/90 text-ember-strong' : 'bg-black/60 text-white')}>
          <span className={cx('size-1.5 rounded-full', ui === 'live' || ui === 'closing' ? 'bg-ember animate-live-pulse' : badge.dot)} />
          {badge.label}
        </span>
        <span className="num absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-white bg-black/60 backdrop-blur-sm">
          <Clock size={11} /> {timeLabel}
        </span>
      </div>
      <div className="p-4 flex flex-col gap-2.5 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] num font-semibold text-ember-strong">{cat.code}</span>
          <span className="inline-flex items-center gap-1 text-xs text-ink-faint"><Layers size={12} /> {catLots.length} lots</span>
        </div>
        <h3 className="font-display font-bold leading-snug line-clamp-2">{cat.title}</h3>
        <div className="flex flex-col gap-1 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5 line-clamp-1"><Building2 size={12} className="shrink-0" /> {seller?.firm}</span>
          <span className="inline-flex items-center gap-1.5 line-clamp-1"><MapPin size={12} className="shrink-0" /> {cat.region}</span>
        </div>
        <div className="mt-auto pt-3 border-t border-line flex items-center justify-between gap-2">
          <span>
            <span className="block text-[11px] text-ink-faint">EMD from</span>
            <span className="num font-bold text-ink">{inrCompact(emd)}</span>
          </span>
          <span className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-ember text-white text-[13px] font-semibold group-hover:bg-ember-strong transition-colors">
            View <ChevronRight size={14} />
          </span>
        </div>
      </div>
    </Link>
  )
}

/* ------------------------------- Sidebar ---------------------------------- */
function CheckRow({ label, count, checked, onChange }: { label: string; count?: number; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2.5 py-1.5 text-sm text-ink-muted hover:text-ink cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={onChange} className="size-4 rounded border-line-strong accent-ember" />
      <span className="flex-1 leading-tight">{label}</span>
      {count !== undefined && <span className="num text-xs text-ink-faint">{count}</span>}
    </label>
  )
}

/** Collapsed by default — click to open a checklist popover, so a long facet
    (many sellers/categories) doesn't force the whole sidebar tall. */
function MultiSelectDropdown({ placeholder, options, selected, onToggle }: {
  placeholder: string
  options: { key: string; label: string; count?: number }[]
  selected: string[]
  onToggle: (key: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const summary = selected.length === 0 ? placeholder
    : selected.length === 1 ? options.find((o) => o.key === selected[0])?.label ?? placeholder
    : `${selected.length} selected`

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        className={cx('w-full h-10 px-3 rounded-xl border bg-surface text-sm font-medium flex items-center justify-between gap-2 transition-colors',
          selected.length > 0 ? 'border-ember/50 text-ink' : 'border-line-strong text-ink-muted')}>
        <span className="truncate">{summary}</span>
        <ChevronDown size={15} className={cx('text-ink-faint shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute z-20 left-0 right-0 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-line bg-surface shadow-lg p-1.5">
          {options.map((o) => (
            <CheckRow key={o.key} label={o.label} count={o.count} checked={selected.includes(o.key)} onChange={() => onToggle(o.key)} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function BuyerMarketplace() {
  const now = useNow()
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const users = useStore((s) => s.users)
  const [params, setParams] = useSearchParams()

  const tabParam = params.get('tab')
  const tab: Tab = tabParam === 'upcoming' || tabParam === 'closed' ? tabParam : 'live'
  const [q, setQ] = useState(params.get('q') ?? '')
  const [categories, setCategories] = useState<MetalCategory[]>(() => {
    const c = params.get('category')
    return c ? [c as MetalCategory] : []
  })
  const [sellerIds, setSellerIds] = useState<string[]>([])
  const [region, setRegion] = useState('all')
  const [emdBand, setEmdBand] = useState<EmdBand>('any')
  const [closingSoon, setClosingSoon] = useState(false)
  const [sort, setSort] = useState<SortKey>('default')

  const regions = useMemo(() => [...new Set(catalogues.map((c) => c.region))].sort(), [catalogues])
  const sellers = useMemo(() => users.filter((u) => u.role === 'seller'), [users])

  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params)
    next.set('tab', t)
    setParams(next, { replace: true })
  }

  const toggleCategory = (key: MetalCategory) =>
    setCategories((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]))
  const toggleSeller = (id: string) =>
    setSellerIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))

  const matchesFilters = (cat: Catalogue): boolean => {
    const catLots = lots.filter((l) => l.catalogueId === cat.id)
    if (q.trim()) {
      const needle = q.trim().toLowerCase()
      const inCat = cat.title.toLowerCase().includes(needle) || cat.code.toLowerCase().includes(needle)
      const inLots = catLots.some((l) =>
        l.description.toLowerCase().includes(needle) ||
        l.metal.toLowerCase().includes(needle) ||
        l.grade.toLowerCase().includes(needle) ||
        l.lotNo.toLowerCase().includes(needle))
      if (!inCat && !inLots) return false
    }
    if (categories.length && !catLots.some((l) => categories.includes(l.category))) return false
    if (region !== 'all' && cat.region !== region) return false
    if (sellerIds.length && !sellerIds.includes(cat.sellerId)) return false
    if (emdBand !== 'any') {
      if (!catLots.length) return false
      if (!inBand(Math.min(...catLots.map((l) => l.preBidEmd)), emdBand)) return false
    }
    return true
  }

  const { byTab, results } = useMemo(() => {
    const filtered = catalogues.filter(matchesFilters)
    const byTab: Record<Tab, Catalogue[]> = { live: [], upcoming: [], closed: [] }
    for (const cat of filtered) {
      const ui = catalogueUiStatus(cat, now)
      const bucket: Tab = ui === 'live' || ui === 'closing' ? 'live' : ui
      byTab[bucket].push(cat)
    }
    byTab.live.sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt))
    byTab.upcoming.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    byTab.closed.sort((a, b) => Date.parse(b.endsAt) - Date.parse(a.endsAt))
    let results = byTab[tab]
    if (closingSoon && tab === 'live') {
      results = results.filter((cat) => catalogueUiStatus(cat, now) === 'closing')
    }
    if (sort === 'title') results = [...results].sort((a, b) => a.title.localeCompare(b.title))
    else if (sort === 'emdAsc') results = [...results].sort((a, b) => emdFrom(a, lots) - emdFrom(b, lots))
    else if (sort === 'emdDesc') results = [...results].sort((a, b) => emdFrom(b, lots) - emdFrom(a, lots))
    return { byTab, results }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogues, lots, now, q, categories, region, sellerIds, emdBand, closingSoon, sort, tab])

  const anyFilter = q.trim() !== '' || categories.length > 0 || sellerIds.length > 0 || region !== 'all' || emdBand !== 'any' || closingSoon

  const clearFilters = () => {
    setQ(''); setCategories([]); setSellerIds([]); setRegion('all'); setEmdBand('any'); setClosingSoon(false); setSort('default')
    const next = new URLSearchParams()
    next.set('tab', tab)
    setParams(next, { replace: true })
  }

  const categoryCount = (key: MetalCategory) =>
    catalogues.filter((cat) => lots.some((l) => l.catalogueId === cat.id && l.category === key)).length
  const sellerCount = (id: string) => catalogues.filter((cat) => cat.sellerId === id).length

  const TAB_DEFS: { key: Tab; label: string }[] = [
    { key: 'live', label: 'Live' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'closed', label: 'Closed' },
  ]

  return (
    <Page>
      <PageHeader
        title="Buyer marketplace"
        sub="Every catalogue is physically inspected and verified by our field team. Sold as-is-where-is — quantities are indicative, final on weighment."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[272px_1fr] gap-6 items-start">
        {/* ------------------------------ Sidebar filters ----------------------- */}
        <aside className="card p-5 lg:sticky lg:top-24">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-display font-bold">Filters</h3>
            <button onClick={clearFilters} className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ember-strong">
              <RotateCcw size={12} /> Reset
            </button>
          </div>

          <div className="py-3 border-b border-line">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-1.5">Category</h4>
            <MultiSelectDropdown placeholder="All categories"
              options={CATEGORY_META.map((c) => ({ key: c.key, label: c.label, count: categoryCount(c.key) }))}
              selected={categories} onToggle={(key) => toggleCategory(key as MetalCategory)} />
          </div>

          <div className="py-3 border-b border-line">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-1.5">Seller</h4>
            <MultiSelectDropdown placeholder="All sellers"
              options={sellers.map((s) => ({ key: s.id, label: s.firm, count: sellerCount(s.id) }))}
              selected={sellerIds} onToggle={toggleSeller} />
          </div>

          <div className="py-3 border-b border-line">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-1.5">Location</h4>
            <Select value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="all">All regions</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </div>

          <div className="py-3 border-b border-line">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-1.5">EMD range</h4>
            <Select value={emdBand} onChange={(e) => setEmdBand(e.target.value as EmdBand)}>
              {EMD_BANDS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
            </Select>
            <p className="text-xs text-ink-faint mt-1">Lowest lot EMD in catalogue</p>
          </div>

          <div className="pt-3">
            <Toggle checked={closingSoon} onChange={setClosingSoon} label="Closing soon (under 30 min)" />
          </div>
        </aside>

        {/* -------------------------------- Main --------------------------------- */}
        <div className="min-w-0">
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
              <input value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search by material, lot ID, seller or location…"
                className="h-11 w-full pl-10 pr-9 rounded-xl bg-surface border border-line-strong text-sm placeholder:text-ink-faint focus:outline-2 focus:outline-ember/50" />
              {q && (
                <button onClick={() => setQ('')} aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink">
                  <X size={15} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm text-ink-faint whitespace-nowrap">Sort by:</span>
              <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-11 w-auto">
                {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </Select>
            </div>
          </div>

          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-surface-2 border border-line mb-5 max-w-full overflow-x-auto">
            {TAB_DEFS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cx('h-9 px-4 rounded-full text-sm font-semibold whitespace-nowrap inline-flex items-center gap-2 transition-colors',
                  tab === t.key ? 'bg-ember text-white shadow-sm' : 'text-ink-muted hover:text-ink')}>
                {t.key === 'live' && <span className={cx('size-1.5 rounded-full animate-live-pulse', tab === t.key ? 'bg-white' : 'bg-ember')} />}
                {t.label}
                <span className={cx('num text-[11px] px-1.5 py-0.5 rounded-full', tab === t.key ? 'bg-white/25' : 'bg-surface text-ink-faint')}>
                  {byTab[t.key].length}
                </span>
              </button>
            ))}
          </div>

          {results.length === 0 ? (
            <EmptyState
              icon={<SearchX size={32} strokeWidth={1.5} />}
              title="No catalogues match"
              body={closingSoon && tab !== 'live'
                ? 'The closing-soon filter only applies to live auctions.'
                : 'Try widening your search or clearing a filter — lot-level matches (metal, grade, description) surface their catalogue here too.'}
              action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <>
              <div className="flex items-center justify-between mb-3 gap-3">
                <span className="text-xs text-ink-faint"><span className="num font-semibold text-ink-muted">{results.length}</span> lot{results.length === 1 ? '' : 's'}</span>
                {anyFilter && (
                  <button onClick={clearFilters} className="text-[13px] font-semibold text-steel hover:underline">Clear all filters</button>
                )}
              </div>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {results.map((c) => <LotCard key={c.id} cat={c} />)}
              </div>
            </>
          )}
        </div>
      </div>
    </Page>
  )
}
