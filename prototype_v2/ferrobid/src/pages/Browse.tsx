/* Browse catalogues — tabbed status view with search + faceted filters. */
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SearchX } from 'lucide-react'
import { Page } from '../layout/Chrome'
import { Button, EmptyState, Field, Input, PageHeader, Select, Tabs, Toggle } from '../components/ui'
import { CatalogueCard, CATEGORY_META } from '../components/domain'
import { useStore, catalogueUiStatus } from '../store/store'
import { useNow } from '../lib/useTick'
import type { Catalogue, MetalCategory } from '../types'

type Tab = 'live' | 'upcoming' | 'closed'
type EmdBand = 'any' | 'lt50k' | '50k-2l' | 'gt2l'

const EMD_BANDS: { key: EmdBand; label: string }[] = [
  { key: 'any', label: 'EMD: any' },
  { key: 'lt50k', label: 'EMD under ₹50k' },
  { key: '50k-2l', label: 'EMD ₹50k – ₹2 L' },
  { key: 'gt2l', label: 'EMD over ₹2 L' },
]

const inBand = (emd: number, band: EmdBand) =>
  band === 'any' ? true
  : band === 'lt50k' ? emd < 50_000
  : band === '50k-2l' ? emd >= 50_000 && emd <= 200_000
  : emd > 200_000

export default function Browse() {
  const now = useNow()
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const users = useStore((s) => s.users)
  const [params, setParams] = useSearchParams()

  const tabParam = params.get('tab')
  const tab: Tab = tabParam === 'upcoming' || tabParam === 'closed' ? tabParam : 'live'
  const [q, setQ] = useState(params.get('q') ?? '')
  const [category, setCategory] = useState(params.get('category') ?? 'all')
  const [region, setRegion] = useState('all')
  const [sellerId, setSellerId] = useState('all')
  const [emdBand, setEmdBand] = useState<EmdBand>('any')
  const [closingSoon, setClosingSoon] = useState(false)

  const regions = useMemo(() => [...new Set(catalogues.map((c) => c.region))].sort(), [catalogues])
  const sellers = useMemo(() => users.filter((u) => u.role === 'seller'), [users])

  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params)
    next.set('tab', t)
    setParams(next, { replace: true })
  }

  /* non-tab filters (search, category, region, seller, EMD) — applied before
     tab split so tab counts reflect the filtered universe */
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
    if (category !== 'all' && !catLots.some((l) => l.category === (category as MetalCategory))) return false
    if (region !== 'all' && cat.region !== region) return false
    if (sellerId !== 'all' && cat.sellerId !== sellerId) return false
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
    return { byTab, results }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogues, lots, now, q, category, region, sellerId, emdBand, closingSoon, tab])

  const anyFilter = q.trim() !== '' || category !== 'all' || region !== 'all' || sellerId !== 'all' || emdBand !== 'any' || closingSoon

  const clearFilters = () => {
    setQ(''); setCategory('all'); setRegion('all'); setSellerId('all'); setEmdBand('any'); setClosingSoon(false)
    const next = new URLSearchParams()
    next.set('tab', tab)
    setParams(next, { replace: true })
  }

  return (
    <Page>
      <PageHeader
        title="Browse auctions"
        sub="Every catalogue is physically inspected and verified by our field team. Sold as-is-where-is — quantities are indicative, final on weighment."
      />

      <Tabs<Tab>
        tabs={[
          { key: 'live', label: 'Live', count: byTab.live.length },
          { key: 'upcoming', label: 'Upcoming', count: byTab.upcoming.length },
          { key: 'closed', label: 'Closed', count: byTab.closed.length },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-5"
      />

      {/* filter row */}
      <div className="card p-4 mb-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Search" className="sm:col-span-2 lg:col-span-1">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
              <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, code, lot, metal…" />
            </div>
          </Field>
          <Field label="Metal category">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">All categories</option>
              {CATEGORY_META.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="Region">
            <Select value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="all">All regions</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
          <Field label="Seller">
            <Select value={sellerId} onChange={(e) => setSellerId(e.target.value)}>
              <option value="all">All sellers</option>
              {sellers.map((s) => <option key={s.id} value={s.id}>{s.firm}</option>)}
            </Select>
          </Field>
          <Field label="EMD range" hint="Lowest lot EMD in catalogue">
            <Select value={emdBand} onChange={(e) => setEmdBand(e.target.value as EmdBand)}>
              {EMD_BANDS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
            </Select>
          </Field>
        </div>
        <div className="mt-3 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-3">
          <Toggle checked={closingSoon} onChange={setClosingSoon} label="Closing soon (under 30 min)" />
          {anyFilter && (
            <button onClick={clearFilters} className="text-[13px] font-semibold text-steel hover:underline">
              Clear all filters
            </button>
          )}
        </div>
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
          <div className="text-xs text-ink-faint mb-3"><span className="num font-semibold text-ink-muted">{results.length}</span> catalogue{results.length === 1 ? '' : 's'}</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((c) => <CatalogueCard key={c.id} cat={c} />)}
          </div>
        </>
      )}
    </Page>
  )
}
