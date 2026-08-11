/* Browse & Shortlist — search/sort + scope + status tabs + photo card grid. */
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X, SearchX } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, EmptyState, PageHeader, Segmented, Select, cx } from '../../components/ui'
import { CatalogueCard } from '../../components/domain'
import { useStore, catalogueUiStatus, isCatalogueShortlisted } from '../../store/store'
import { useNow } from '../../lib/useTick'
import type { Catalogue } from '../../types'

type Scope = 'all' | 'shortlisted'
type Tab = 'live' | 'upcoming' | 'closed'
type SortKey = 'default' | 'emdAsc' | 'emdDesc' | 'title'

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'default', label: 'Ending Soonest' },
  { key: 'title', label: 'Title A–Z' },
  { key: 'emdAsc', label: 'EMD: Low to High' },
  { key: 'emdDesc', label: 'EMD: High to Low' },
]

const emdFrom = (cat: Catalogue, lots: { catalogueId: string; preBidEmd: number }[]) => {
  const catLots = lots.filter((l) => l.catalogueId === cat.id)
  return catLots.length ? Math.min(...catLots.map((l) => l.preBidEmd)) : Infinity
}

export default function BuyerMarketplace() {
  const now = useNow()
  const me = useStore((s) => s.currentUser)
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const watchlist = useStore((s) => s.watchlist)
  const [params, setParams] = useSearchParams()

  const tabParam = params.get('tab')
  const tab: Tab = tabParam === 'upcoming' || tabParam === 'closed' ? tabParam : 'live'
  const scopeParam = params.get('scope')
  const scope: Scope = scopeParam === 'shortlisted' ? 'shortlisted' : 'all'
  const [q, setQ] = useState(params.get('q') ?? '')
  const [sort, setSort] = useState<SortKey>('default')

  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params)
    next.set('tab', t)
    setParams(next, { replace: true })
  }
  const setScope = (v: Scope) => {
    const next = new URLSearchParams(params)
    next.set('scope', v)
    setParams(next, { replace: true })
  }

  const matchesFiltersIgnoringScope = (cat: Catalogue): boolean => {
    // Draft catalogues aren't published yet — catalogueUiStatus buckets them
    // as 'closed' for internal role views, but buyers must never see them.
    if (cat.status === 'draft') return false
    if (!q.trim()) return true
    const catLots = lots.filter((l) => l.catalogueId === cat.id)
    const needle = q.trim().toLowerCase()
    const inCat = cat.title.toLowerCase().includes(needle) || cat.code.toLowerCase().includes(needle)
    const inLots = catLots.some((l) =>
      l.description.toLowerCase().includes(needle) ||
      l.metal.toLowerCase().includes(needle) ||
      l.grade.toLowerCase().includes(needle) ||
      l.lotNo.toLowerCase().includes(needle))
    return inCat || inLots
  }

  // Scope (all vs. shortlisted) is the other, independent facet — it combines
  // with every other filter rather than replacing them.
  const matchesFilters = (cat: Catalogue): boolean =>
    matchesFiltersIgnoringScope(cat) &&
    (scope !== 'shortlisted' || isCatalogueShortlisted({ watchlist }, me?.id, cat.id))

  const { byTab, results, shortlistedCount } = useMemo(() => {
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
    if (sort === 'title') results = [...results].sort((a, b) => a.title.localeCompare(b.title))
    else if (sort === 'emdAsc') results = [...results].sort((a, b) => emdFrom(a, lots) - emdFrom(b, lots))
    else if (sort === 'emdDesc') results = [...results].sort((a, b) => emdFrom(b, lots) - emdFrom(a, lots))
    // Shortlisted count ignores the tab (it's the other, independent facet) but
    // respects every other filter, so the two dimensions genuinely combine.
    const shortlistedCount = catalogues
      .filter(matchesFiltersIgnoringScope)
      .filter((cat) => isCatalogueShortlisted({ watchlist }, me?.id, cat.id)).length
    return { byTab, results, shortlistedCount }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogues, lots, now, q, sort, tab, scope, watchlist, me])

  const anyFilter = q.trim() !== ''

  const clearFilters = () => {
    setQ(''); setSort('default')
    const next = new URLSearchParams()
    next.set('tab', tab)
    next.set('scope', scope)
    setParams(next, { replace: true })
  }

  const TAB_DEFS: { key: Tab; label: string }[] = [
    { key: 'live', label: 'Live' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'closed', label: 'Closed' },
  ]

  return (
    <Page>
      <PageHeader
        title="Browse & Shortlist"
        sub="Every catalogue is physically inspected and verified by our field team. Sold as-is-where-is — quantities are indicative, final on weighment."
      />

      <div className="min-w-0">
        {/* Scope (all vs. shortlisted) combines with the status tab below it —
            e.g. Shortlisted + Upcoming is a real, filterable view. */}
        <Segmented<Scope> className="mb-3" value={scope} onChange={setScope} options={[
          { key: 'all', label: 'All' },
          { key: 'shortlisted', label: <>Shortlisted <span className="num opacity-70">{shortlistedCount}</span></> },
        ]} />

        <div className="flex flex-row items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-0">
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
            body={scope === 'shortlisted'
              ? 'Nothing shortlisted in this status yet — star a catalogue to see it here.'
              : 'Try widening your search or clearing a filter — lot-level matches (metal, grade, description) surface their catalogue here too.'}
            action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <>
            <div className="flex items-center justify-between mb-3 gap-3">
              <span className="text-xs text-ink-faint"><span className="num font-semibold text-ink-muted">{results.length}</span> catalogue{results.length === 1 ? '' : 's'}</span>
              {anyFilter && (
                <button onClick={clearFilters} className="text-[13px] font-semibold text-steel hover:underline">Clear all filters</button>
              )}
            </div>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {results.map((c) => <CatalogueCard key={c.id} cat={c} showBuyerActions />)}
            </div>
          </>
        )}
      </div>
    </Page>
  )
}
