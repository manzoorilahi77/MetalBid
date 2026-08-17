/* Browse & Shortlist — status tabs + filter card + photo card grid. */
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SearchX, Star, X } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, EmptyState, Field, Input, PageHeader, Select, cx } from '../../components/ui'
import { CatalogueCard } from '../../components/domain'
import { useGuestGate } from '../../components/GuestGate'
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

const STATE_LABELS: Record<string, string> = {
  KA: 'Karnataka', TN: 'Tamil Nadu', TS: 'Telangana', OD: 'Odisha', JH: 'Jharkhand', CG: 'Chhattisgarh', WB: 'West Bengal',
}

const stateOf = (cat: Catalogue) => cat.region.split(',').pop()?.trim() ?? ''

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
  const guest = useGuestGate()
  const [params, setParams] = useSearchParams()

  const tabParam = params.get('tab')
  const tab: Tab = tabParam === 'live' || tabParam === 'closed' ? tabParam : 'upcoming'
  const scopeParam = params.get('scope')
  const scope: Scope = scopeParam === 'shortlisted' ? 'shortlisted' : 'all'
  const [q, setQ] = useState(params.get('q') ?? '')
  const [sort, setSort] = useState<SortKey>('default')
  const [stateFilter, setStateFilter] = useState('all')

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
    if (stateFilter !== 'all' && stateOf(cat) !== stateFilter) return false
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
  }, [catalogues, lots, now, q, sort, tab, scope, stateFilter, watchlist, me])

  const states = useMemo(() => Array.from(new Set(catalogues.map(stateOf).filter(Boolean))).sort(), [catalogues])

  const anyFilter = q.trim() !== '' || stateFilter !== 'all' || scope === 'shortlisted'

  const clearFilters = () => {
    setQ(''); setSort('default'); setStateFilter('all')
    const next = new URLSearchParams()
    next.set('tab', tab)
    next.set('scope', 'all')
    setParams(next, { replace: true })
  }

  const TAB_DEFS: { key: Tab; label: string }[] = [
    { key: 'live', label: 'Live' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'closed', label: 'Closed' },
  ]

  return (
    <Page>
      {/* The title names what the visitor can actually do here — promising a
          guest "& Shortlist" on a page where shortlisting is locked reads as a
          broken screen rather than a paywall. */}
      <PageHeader
        title={guest.isGuest ? 'Browse the marketplace' : 'Browse & Shortlist'}
        sub="Every catalogue is physically inspected and verified by our field team. Sold as-is-where-is — quantities are indicative, final on weighment."
      />

      {/* Status tabs on top; "Shortlisted only" sits directly under Live, on
          its own line, so it reads as a filter that applies within whichever
          status tab is active rather than a fourth status. */}
      <div className="mb-6">
        <div className="flex items-center gap-1 border-b border-line overflow-x-auto" role="tablist">
          {TAB_DEFS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={cx('h-11 px-4 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px inline-flex items-center gap-2 transition-colors',
                tab === t.key ? 'border-ember text-ink' : 'border-transparent text-ink-muted hover:text-ink')}>
              {t.key === 'live' && <span className={cx('size-1.5 rounded-full animate-live-pulse', tab === t.key ? 'bg-ember' : 'bg-ink-faint')} />}
              {t.label}
              <span className={cx('num text-xs px-1.5 py-0.5 rounded-md', tab === t.key ? 'bg-ember-soft text-ember-strong' : 'bg-surface-2 text-ink-faint')}>
                {byTab[t.key].length}
              </span>
            </button>
          ))}
        </div>
        {/* A guest has no shortlist to filter down to, so this filter is the
            prompt rather than a facet — same as the star on each card. */}
        <button aria-pressed={scope === 'shortlisted'}
          onClick={() => { if (guest.block('shortlist')) return; setScope(scope === 'shortlisted' ? 'all' : 'shortlisted') }}
          className={cx('mt-3 h-9 px-3.5 rounded-full border text-sm font-semibold whitespace-nowrap inline-flex items-center gap-2 transition-colors',
            scope === 'shortlisted' ? 'bg-ember-soft border-ember/30 text-ember-strong' : 'bg-surface border-line-strong text-ink-muted hover:text-ink hover:border-ink/30')}>
          <Star size={14} fill={scope === 'shortlisted' ? 'currentColor' : 'none'} />
          Shortlisted only
          <span className={cx('num text-xs px-1.5 py-0.5 rounded-md', scope === 'shortlisted' ? 'bg-white/50' : 'bg-surface-2 text-ink-faint')}>
            {shortlistedCount}
          </span>
        </button>
      </div>

      <div className="card p-4 mb-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Search" className="sm:col-span-2">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
              <Input className="pl-9 pr-9" value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Material, lot ID, seller or location…" />
              {q && (
                <button onClick={() => setQ('')} aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink">
                  <X size={15} />
                </button>
              )}
            </div>
          </Field>
          <Field label="State">
            <Select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
              <option value="all">All states</option>
              {states.map((s) => <option key={s} value={s}>{STATE_LABELS[s] ?? s}</option>)}
            </Select>
          </Field>
          <Field label="Sort by">
            <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
          </Field>
        </div>
      </div>

      {results.length === 0 ? (
        <EmptyState
          icon={<SearchX size={32} strokeWidth={1.5} />}
          title="No catalogues match"
          body={scope === 'shortlisted'
            ? 'Nothing shortlisted in this status yet — star an upcoming catalogue to see it here.'
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
    </Page>
  )
}
