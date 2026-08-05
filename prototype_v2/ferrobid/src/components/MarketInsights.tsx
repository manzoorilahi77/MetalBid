/* ---------------------------------------------------------------------------
   Market insights — benchmark prices, the ferroBid clearing index, regional
   demand and auction momentum. Market-wide context alongside the platform KPIs
   on the super admin dashboard, built on the Forge kit (flat cards, hairlines,
   mono numerals) so it reads as dashboard, not as a marketing band.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, Gavel, Package, Percent, TrendingDown, TrendingUp, Users } from 'lucide-react'
import indiaMap from '@svg-maps/india'
import { Chip, ProgressBar, Segmented, cx } from './ui'
import { num } from '../lib/format'

const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 13 }

/* -------------------------------------------------------------------------
   Benchmark prices a bidder checks before valuing a lot. Domestic ferrous
   grades in ₹/MT; non-ferrous in ₹/kg (MCX convention). In production these
   map to real feeds — LME/MCX for non-ferrous, domestic scrap indices
   (SteelMint / BigMint / Metal Junction) and mandi rates for ferrous.
------------------------------------------------------------------------- */
const PRICE_WATCH = [
  { name: 'HMS 80:20', price: 34200, unit: '/MT', changePct: 2.4, dir: 'up', low: 33600, high: 34700 },
  { name: 'Shredded', price: 36900, unit: '/MT', changePct: 1.1, dir: 'up', low: 36400, high: 37250 },
  { name: 'Steel HRC', price: 52400, unit: '/MT', changePct: 0.8, dir: 'up', low: 51900, high: 52850 },
  { name: 'Copper', price: 742, unit: '/kg', changePct: 1.6, dir: 'up', low: 731, high: 748 },
  { name: 'Aluminium', price: 198, unit: '/kg', changePct: 0.5, dir: 'down', low: 196, high: 201 },
] as const

/* ferroBid Scrap Index — the platform's own volume-weighted clearing price for
   ferrous lots (₹/MT). First-party data: the average price at which lots
   actually settled, so it reflects live auction demand, not a quoted rate. */
type RangeKey = '1D' | '7D' | '3M' | '1Y'

const RANGES: Record<RangeKey, { window: string; points: { label: string; price: number }[] }> = {
  '1D': {
    window: 'Today',
    points: [
      { label: '9 AM', price: 36600 }, { label: '12 PM', price: 36720 }, { label: '3 PM', price: 36680 },
      { label: '6 PM', price: 36850 }, { label: '9 PM', price: 36900 },
    ],
  },
  '7D': {
    window: '7 days',
    points: [
      { label: 'Mon', price: 35800 }, { label: 'Tue', price: 36100 }, { label: 'Wed', price: 35950 },
      { label: 'Thu', price: 36400 }, { label: 'Fri', price: 36250 }, { label: 'Sat', price: 36800 },
      { label: 'Sun', price: 36900 },
    ],
  },
  '3M': {
    window: '90 days',
    points: [
      { label: 'Apr 22', price: 34200 }, { label: 'May 7', price: 34800 }, { label: 'May 22', price: 34500 },
      { label: 'Jun 7', price: 35600 }, { label: 'Jun 22', price: 35200 }, { label: 'Jul 22', price: 36900 },
    ],
  },
  '1Y': {
    window: '12 months',
    points: [
      { label: 'Sep', price: 31500 }, { label: 'Nov', price: 32800 }, { label: 'Jan', price: 32100 },
      { label: 'Mar', price: 34200 }, { label: 'May', price: 35400 }, { label: 'Jul', price: 36900 },
    ],
  },
}

const RANGE_OPTIONS = (Object.keys(RANGES) as RangeKey[]).map((key) => ({ key, label: key }))

/* Live lots by state — first-party bid activity. Colours a national demand map. */
const STATE_LOTS: Record<string, number> = {
  mh: 312, gj: 268, tn: 214, ct: 188, wb: 176, jh: 142, or: 128, ka: 116,
  up: 104, rj: 88, pb: 82, tg: 76, mp: 71, hr: 64, ap: 58, kl: 44, dl: 52,
  br: 38, ut: 30, hp: 22, ga: 16, as: 14, jk: 18,
}
const DEFAULT_LOTS = 11
const MAX_LOTS = 312

/** Ember at a scaled opacity — theme-safe in a way a baked RGB ramp is not. */
const lotOpacity = (lots: number) => 0.08 + 0.92 * Math.min(lots / MAX_LOTS, 1)

/** "36.9k" / "37k" — one decimal only when it's needed, so no two ticks collide. */
const kTick = (v: number) => `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`

/** Round y-axis ticks (₹34k, ₹35k…) instead of the raw data bounds recharts
 *  would otherwise label. Keeps a step of headroom so the line never grazes
 *  the top or bottom of the plot. */
function priceTicks(prices: number[]): number[] {
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const magnitude = 10 ** Math.floor(Math.log10((max - min || 1) / 3))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= (max - min || 1) / 3) ?? magnitude
  let lo = Math.floor(min / step) * step
  let hi = Math.ceil(max / step) * step
  if (lo >= min) lo -= step
  if (hi <= max) hi += step
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 100; v += step) ticks.push(Math.round(v))
  return ticks
}

/** `sellThrough` comes from the host page so the pulse tile can't contradict a
 *  sell-through figure the page already computes from real lot data. */
export function MarketInsights({ sellThrough = 92 }: { sellThrough?: number } = {}) {
  const [range, setRange] = useState<RangeKey>('3M')
  const [hoverState, setHoverState] = useState<{ name: string; lots: number } | null>(null)

  const { window: rangeWindow, points } = RANGES[range]
  const last = points[points.length - 1].price
  const first = points[0].price
  const changePct = ((last - first) / first) * 100
  const up = changePct >= 0
  const yTicks = priceTicks(points.map((p) => p.price))

  return (
    <>
      {/* ------------------- Row 1 — clearing index + benchmarks ------------------- */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Ferrous scrap index */}
        <div className="card p-5 lg:col-span-2 flex flex-col">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="font-bold">
              Ferrous scrap index{' '}
              <span className="text-xs text-ink-faint font-normal">(₹/MT clearing price · {rangeWindow})</span>
            </h2>
            <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} />
          </div>

          <div className="flex items-baseline gap-2.5 mt-4">
            <span className="num text-3xl font-bold">₹{num(last)}</span>
            <span className={cx('num inline-flex items-center gap-1 text-sm font-bold', up ? 'text-success' : 'text-danger')}>
              {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {Math.abs(changePct).toFixed(2)}%
            </span>
          </div>

          {/* flex-1 so the chart fills the height the row inherits from the taller
              price-watch card instead of leaving dead space under the axis. */}
          <div className="flex-1 min-h-48 mt-4 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 4, right: 18, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="scrapIndexFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--steel)" stopOpacity={0.26} />
                    <stop offset="100%" stopColor="var(--steel)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[yTicks[0], yTicks[yTicks.length - 1]]}
                  ticks={yTicks}
                  tickFormatter={kTick}
                  tick={{ fontSize: 12, fill: 'var(--ink-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  width={46}
                />
                <Tooltip
                  formatter={(v) => [`₹${num(Number(v))}/MT`, 'Clearing price']}
                  contentStyle={tooltipStyle}
                  cursor={{ stroke: 'var(--line-strong)', strokeDasharray: '3 3' }}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="var(--steel)"
                  strokeWidth={2.5}
                  fill="url(#scrapIndexFill)"
                  dot={{ r: 3, fill: 'var(--surface)', stroke: 'var(--steel)', strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Metal price watch */}
        <div className="card p-5 flex flex-col">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold">
              Metal price watch <span className="text-xs text-ink-faint font-normal">(benchmarks)</span>
            </h2>
            <Chip tone="ember" pulse>Live</Chip>
          </div>
          <div className="divide-y divide-line mt-2">
            {PRICE_WATCH.map((a) => (
              <div key={a.name} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{a.name}</div>
                  <div className="num text-[11px] text-ink-faint">
                    24h ₹{num(a.low)} – ₹{num(a.high)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="num text-sm font-bold">
                    ₹{num(a.price)}<span className="text-ink-faint font-medium">{a.unit}</span>
                  </div>
                  <div className={cx('num inline-flex items-center gap-1 text-[11px] font-semibold',
                    a.dir === 'up' ? 'text-success' : 'text-danger')}>
                    {a.dir === 'up' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {a.changePct.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-auto pt-3 text-xs text-ink-faint">
            Ferrous ₹/MT, non-ferrous ₹/kg. Simulated feed — LME/MCX and domestic scrap indices in production.
          </p>
        </div>
      </div>

      {/* ---------------------- Row 2 — demand map + momentum ---------------------- */}
      <div className="grid gap-4 lg:grid-cols-3 mt-4">
        {/* Regional demand */}
        <div className="card p-5 flex flex-col">
          <h2 className="font-bold">
            Regional demand <span className="text-xs text-ink-faint font-normal">(live lots)</span>
          </h2>
          <p className="text-xs text-ink-muted mt-0.5 min-h-4">
            {hoverState
              ? <><span className="font-semibold text-ink">{hoverState.name}</span> · <span className="num">{hoverState.lots}</span> live lots</>
              : 'Live lots by state · hover to explore'}
          </p>
          <div className="flex-1 grid place-items-center mt-3">
            <svg
              viewBox={indiaMap.viewBox}
              role="img"
              aria-label="Live lots by state across India"
              className="w-full max-h-56"
              onMouseLeave={() => setHoverState(null)}
            >
              {indiaMap.locations.map((loc) => {
                const lots = STATE_LOTS[loc.id] ?? DEFAULT_LOTS
                return (
                  <path
                    key={loc.id}
                    d={loc.path}
                    fill="var(--ember)"
                    fillOpacity={lotOpacity(lots)}
                    stroke="var(--surface)"
                    strokeWidth={hoverState?.name === loc.name ? 1.6 : 0.7}
                    className="transition-[stroke-width] duration-150"
                    onMouseEnter={() => setHoverState({ name: loc.name, lots })}
                  />
                )
              })}
            </svg>
          </div>
          <div className="flex items-center gap-2 mt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            <span>Low</span>
            <div
              className="h-1.5 flex-1 rounded-full border border-line"
              style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--ember) 8%, transparent), var(--ember))' }}
            />
            <span>High</span>
          </div>
        </div>

        {/* Market pulse */}
        <div className="card p-5 lg:col-span-2 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold flex items-center gap-2">
              <Activity size={16} className="text-ember" /> Market pulse
              <span className="text-xs text-ink-faint font-normal">(auction momentum)</span>
            </h2>
            <Chip tone="neutral">30-day window</Chip>
          </div>

          <div className="rounded-xl border border-line bg-surface-2 p-4 flex items-center gap-3.5 mt-3">
            <span className="grid place-items-center size-10 rounded-lg bg-ember-soft text-ember shrink-0">
              <TrendingUp size={18} />
            </span>
            <div>
              <div className="num text-2xl font-bold text-ember">+3.24%</div>
              <div className="text-xs text-ink-muted">bid value vs last month</div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <PulseTile icon={<Users size={14} />} label="Buyer demand">
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-success">
                <span className="size-1.5 rounded-full bg-success" /> High
              </span>
            </PulseTile>

            <PulseTile icon={<Package size={14} />} label="Scrap supply">
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-warning">
                <span className="size-1.5 rounded-full bg-warning" /> Tightening
              </span>
            </PulseTile>

            <PulseTile icon={<Percent size={14} />} label="Sell-through">
              <span className="num text-sm font-bold text-success">{sellThrough.toFixed(0)}%</span>
              <ProgressBar value={sellThrough} max={100} tone="success" className="mt-2" />
            </PulseTile>

            <PulseTile icon={<Gavel size={14} />} label="Avg. bids / lot">
              <span className="num text-sm font-bold">14.6</span>
              <ProgressBar value={14.6} max={20} tone="steel" className="mt-2" />
            </PulseTile>
          </div>
        </div>
      </div>
    </>
  )
}

/** One momentum readout inside Market pulse — label row on top, value below. */
function PulseTile({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3.5">
      <div className="flex items-center gap-2 text-ink-muted">
        <span className="text-ink-faint">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}
