/* Super Admin — platform KPIs. */
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, Zap } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Chip, PageHeader, ProgressBar, Stat } from '../../components/ui'
import { CATEGORY_META } from '../../components/domain'
import { MarketInsights } from '../../components/MarketInsights'
import { useStore } from '../../store/store'
import { inrCompact, num } from '../../lib/format'
import { useNow } from '../../lib/useTick'

const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 13 }

export default function AdminDashboard() {
  const now = useNow()
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const bids = useStore((s) => s.bids)
  const users = useStore((s) => s.users)
  const wallets = useStore((s) => s.wallets)

  const sold = lots.filter((l) => l.status === 'sold' && l.resultH1Rate)
  const gmv = sold.reduce((s, l) => s + l.resultH1Rate! * l.indicativeQty, 0)
  const liveCats = catalogues.filter((c) => c.status === 'live')
  const liveLotIds = new Set(lots.filter((l) => l.status === 'live').map((l) => l.id))
  const activeBidders = new Set(bids.filter((b) => b.status === 'valid' && liveLotIds.has(b.lotId)).map((b) => b.bidderId)).size
  const resolved = lots.filter((l) => ['sold', 'sta', 'unsold'].includes(l.status))
  const sellThrough = resolved.length ? (sold.length / resolved.length) * 100 : 0
  const emdHeld = wallets.reduce((s, w) => s + w.emdLocked, 0)

  // synthesized weekly trend anchored to real GMV
  const gmvTrend = Array.from({ length: 8 }, (_, i) => ({
    week: `W${i + 1}`,
    gmv: Math.round((gmv / 1e5) * (0.45 + i * 0.08 + (i % 3) * 0.05)),
  }))
  const byCat = catalogues.filter((c) => c.status === 'closed').map((c) => ({
    name: c.code,
    value: Math.round(lots.filter((l) => l.catalogueId === c.id && l.status === 'sold')
      .reduce((s, l) => s + (l.resultH1Rate ?? 0) * l.indicativeQty, 0) / 1e5),
  }))

  const catalogued = lots.filter((l) => l.catalogueId)
  const categoryMix = CATEGORY_META
    .map((c) => ({ ...c, count: catalogued.filter((l) => l.category === c.key).length }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)

  const bidsPerMin = bids.filter((b) => now - Date.parse(b.at) < 10 * 60_000).length / 10
  const extensions = lots.reduce((s, l) => s + l.extensions, 0)

  const buyerTotals = users
    .filter((u) => u.role === 'buyer')
    .map((u) => ({
      u,
      won: sold.filter((l) => l.leadingBidderId === u.id),
    }))
    .map((x) => ({ ...x, value: x.won.reduce((s, l) => s + l.resultH1Rate! * l.indicativeQty, 0) }))
    .filter((x) => x.won.length > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  return (
    <Page>
      <PageHeader title="Platform dashboard" sub="Marketplace-wide KPIs across catalogues, bidders and settlement." />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="GMV (sold lots)" value={inrCompact(gmv)} tone="ember" sub="H1 × indicative qty" />
        <Stat label="Live catalogues" value={num(liveCats.length)} sub={`${lots.filter((l) => l.status === 'live').length} live lots`} />
        <Stat label="Active bidders" value={num(activeBidders)} sub="on live lots" />
        <Stat label="Sell-through" value={`${sellThrough.toFixed(0)}%`} tone="success" sub={`${sold.length}/${resolved.length} resolved lots`} />
        <Stat label="EMD held" value={inrCompact(emdHeld)} tone="steel" sub="locked across wallets" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-6">
        <div className="card p-5">
          <h2 className="font-bold mb-4">GMV trend <span className="text-xs text-ink-faint font-normal">(₹ lakh / week)</span></h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={gmvTrend}>
                <defs>
                  <linearGradient id="gmvFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E4572E" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#E4572E" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 12, fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [`₹${v} L`, 'GMV']} contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="gmv" stroke="#E4572E" strokeWidth={2.5} fill="url(#gmvFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-bold mb-4">Realisation by catalogue <span className="text-xs text-ink-faint font-normal">(closed, ₹ lakh)</span></h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCat}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [`₹${v} L`, 'Realised']} contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill="#2B4C7E" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-6">
        <div className="card p-5">
          <h2 className="font-bold mb-4">Category mix <span className="text-xs text-ink-faint font-normal">(catalogued lots)</span></h2>
          <div className="space-y-3">
            {categoryMix.map((c) => (
              <div key={c.key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{c.label}</span>
                  <span className="num text-ink-muted">{c.count}</span>
                </div>
                <ProgressBar value={c.count} max={categoryMix[0].count} tone="ember" />
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-bold mb-4">Platform health</h2>
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-ink-muted"><Activity size={15} className="text-success" /> Tick engine</span>
              <Chip tone="success" pulse>Running · 1s</Chip>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Bid velocity (10 min)</span>
              <span className="num font-bold">{bidsPerMin.toFixed(1)} bids/min</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Simulated competition</span>
              <Chip tone="steel">5 bot bidders active</Chip>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-ink-muted"><Zap size={15} className="text-warning" /> Anti-snipe extensions</span>
              <span className="num font-bold">{num(extensions)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Payment gateway</span>
              <Chip tone="success">Operational</Chip>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-bold mb-4">Top buyers <span className="text-xs text-ink-faint font-normal">(by won value)</span></h2>
          <div className="divide-y divide-line">
            {buyerTotals.map(({ u, won, value }) => (
              <div key={u.id} className="py-2.5 flex items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{u.firm}</div>
                  <div className="text-xs text-ink-faint">{u.city} · {won.length} lot{won.length === 1 ? '' : 's'} won</div>
                </div>
                <span className="num font-bold">{inrCompact(value)}</span>
              </div>
            ))}
            {buyerTotals.length === 0 && <p className="text-sm text-ink-faint py-3">No sold lots yet.</p>}
          </div>
        </div>
      </div>

      {/* Market context behind the KPIs above — benchmark prices, the clearing
          index, where demand sits geographically, and auction momentum. */}
      <div className="mt-6">
        <MarketInsights sellThrough={sellThrough} />
      </div>
    </Page>
  )
}
