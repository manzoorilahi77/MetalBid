/* Guest 2 — FAANG-level International Luxury Public Homepage.
   Includes exact Why Choose Ferrobid & Market Insights sections from the reference design,
   ultra-photorealistic studio hero photography, and continuous horizontal process workflow. */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ShieldCheck, ArrowRight, Radio, ChevronRight, TrendingUp, TrendingDown,
  Globe, Cpu, Activity, CheckCircle2, Clock, Building2, Lock,
  Truck, Gavel, Wallet, PackageSearch, IdCard, Sparkles,
  ChevronLeft, Megaphone, FileText, CreditCard, CalendarClock,
  Download, ArrowUpRight, Calendar, Quote, Star, BadgeCheck, MapPin, Newspaper
} from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Chip, Countdown, Button } from '../../components/ui'
import { CategoryTile, CATEGORY_META } from '../../components/domain'
import { Section, Reveal, usePageMeta } from './marketing'

type ChartRange = '7D' | '30D' | '90D' | '1Y'

const CHART_DATA: Record<ChartRange, { labels: string[]; points: number[]; tooltipVal: string; tooltipChange: string }> = {
  '7D': {
    labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Today'],
    points: [595, 602, 598, 610, 608, 615, 620],
    tooltipVal: '$620 / MT',
    tooltipChange: '+1.85%',
  },
  '30D': {
    labels: ['Apr 20', 'Apr 27', 'May 4', 'May 11', 'May 18'],
    points: [580, 592, 605, 598, 620],
    tooltipVal: '$620 / MT',
    tooltipChange: '+3.25%',
  },
  '90D': {
    labels: ['Feb', 'Mar', 'Apr', 'May'],
    points: [540, 565, 590, 620],
    tooltipVal: '$620 / MT',
    tooltipChange: '+8.40%',
  },
  '1Y': {
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    points: [480, 510, 560, 620],
    tooltipVal: '$620 / MT',
    tooltipChange: '+14.2%',
  },
}

/** Lightweight inline-SVG sparkline — area + line + endpoint dot. No chart
 *  library. Colour comes from `currentColor`, so tint it via a text-* class on
 *  the wrapper (green for up-trends), matching the trend indicators. */
function Sparkline({ points, id, className }: { points: number[]; id: string; className?: string }) {
  const w = 80
  const h = 28
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const stepX = w / (points.length - 1)
  const coords = points.map((p, i) => [i * stepX, h - 2 - ((p - min) / range) * (h - 4)] as const)
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${line} L${w} ${h} L0 ${h} Z`
  const [lastX, lastY] = coords[coords.length - 1]
  const gid = `spark-${id}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.20" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2.2" fill="currentColor" />
    </svg>
  )
}

/* Stylised world map for the Global Heat Map card — continents as soft
   silhouettes (steel) with pulsing demand hubs (ember = hot, green = active).
   Pure inline SVG: no map library, no tiles, on-palette. */
const MAP_CONTINENTS = [
  '45,42 72,32 104,36 122,52 112,72 122,90 96,94 80,80 70,62 52,60 42,50', // N. America
  '106,102 126,100 141,116 136,142 122,172 112,156 116,131 106,116', // S. America
  '186,42 210,37 226,49 217,61 197,63 189,53', // Europe
  '197,72 231,70 249,91 242,121 227,149 214,141 206,110 198,90', // Africa
  '230,40 282,29 332,43 344,67 320,90 285,93 258,80 240,66 232,52', // Asia
  '322,132 353,127 369,143 360,161 334,163 324,148', // Australia
]
const MAP_HUBS: { x: number; y: number; hot: boolean }[] = [
  { x: 110, y: 62, hot: false }, // New York
  { x: 206, y: 49, hot: true }, // London
  { x: 262, y: 84, hot: true }, // Dubai
  { x: 338, y: 68, hot: false }, // Tokyo
  { x: 316, y: 78, hot: true }, // Shanghai
  { x: 276, y: 92, hot: false }, // Mumbai
  { x: 128, y: 150, hot: false }, // São Paulo
]

function WorldHeatMap({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 200" className={className} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g style={{ fill: 'var(--steel)' }} fillOpacity={0.18}>
        {MAP_CONTINENTS.map((pts, i) => (
          <polygon key={i} points={pts} />
        ))}
      </g>
      {MAP_HUBS.map((h, i) => (
        <g key={i} style={{ fill: h.hot ? 'var(--ember)' : 'var(--success)' }}>
          <circle cx={h.x} cy={h.y} r="7" fillOpacity={0.28} className="animate-live-pulse" style={{ animationDelay: `${i * 0.25}s` }} />
          <circle cx={h.x} cy={h.y} r="2.4" />
        </g>
      ))}
    </svg>
  )
}

/* Data-driven geometry for the Steel Price Trend chart — a smooth cubic spline
   through the active range's points, plus the closed area path. */
function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x},${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d
}

function buildChart(points: number[]) {
  const W = 500
  const H = 200
  const padY = 26
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const stepX = points.length > 1 ? W / (points.length - 1) : W
  const coords = points.map((p, i) => ({
    x: i * stepX,
    y: padY + (1 - (p - min) / range) * (H - padY * 2),
  }))
  const line = smoothPath(coords)
  const area = `${line} L ${W},${H} L 0,${H} Z`
  return { W, H, coords, line, area }
}

/* "Start bidding in 5 quick steps" — illustrated step flow with curved dotted
   connector arrows (blueprint §8 motion). Scroll-triggered staggered reveal;
   honours prefers-reduced-motion. Icons in tinted panels stand in for the
   reference's character illustrations, on the existing token palette. */
const PROCESS_STEPS = [
  { n: '1', title: 'Discover', desc: 'Explore premium lots and live auctions across multiple categories.', icon: <PackageSearch size={26} />, accent: <Sparkles />, tone: 'ember' as const },
  { n: '2', title: 'Register', desc: 'Create your account and complete KYC for a secure experience.', icon: <IdCard size={26} />, accent: <ShieldCheck />, tone: 'steel' as const },
  { n: '3', title: 'Bid', desc: 'Place your bids in live or forward auctions with confidence.', icon: <Gavel size={26} />, accent: <Radio />, tone: 'ember' as const },
  { n: '4', title: 'Pay', desc: 'Make secure payments and get instant settlement confirmation.', icon: <CreditCard size={26} />, accent: <ShieldCheck />, tone: 'steel' as const },
  { n: '5', title: 'Lift & Deliver', desc: 'We handle logistics and deliver your won lots safely to your location.', icon: <Truck size={26} />, accent: <MapPin />, tone: 'ember' as const },
]

function StepArrow({ up, idx, revealed, delayMs, animate, tone }: { up: boolean; idx: number; revealed: boolean; delayMs: number; animate: boolean; tone: 'ember' | 'steel' }) {
  const d = up ? 'M2,34 Q34,3 62,26' : 'M2,14 Q34,45 62,22'
  const mid = `g2ah-${idx}`
  return (
    <svg
      viewBox="0 0 64 48"
      className="w-10 lg:w-20 h-14 shrink-0 self-start mt-10"
      aria-hidden="true"
      style={{
        // alternating brand marks — steel (blue) / ember (orange)
        color: tone === 'ember' ? 'var(--ember)' : 'var(--steel)',
        // fade + slide in toward the next step, on its own beat (same mechanism
        // as the panels so it reliably staggers one after another)
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'none' : 'translateX(-10px)',
        transition: animate ? 'opacity 450ms ease-out, transform 450ms ease-out' : 'none',
        transitionDelay: animate ? `${delayMs}ms` : '0ms',
      }}
    >
      <defs>
        <marker id={mid} markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill="currentColor" />
        </marker>
      </defs>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="1 6" strokeLinecap="round" markerEnd={`url(#${mid})`} className={revealed ? 'animate-dash-flow' : ''} />
    </svg>
  )
}

function StepPanel({ s }: { s: (typeof PROCESS_STEPS)[number] }) {
  const em = s.tone === 'ember'
  const stroke = em ? 'var(--ember)' : 'var(--steel)'
  return (
    <div className="w-full flex flex-col items-center">
      {/* numbered badge + hexagon */}
      <div className="relative w-[132px] h-[132px]">
        {/* number badge overhanging the top vertex */}
        <div className={`absolute -top-2 left-1/2 -translate-x-1/2 z-20 size-9 rounded-full grid place-items-center font-display text-[13px] font-extrabold text-white ring-4 ring-surface shadow-[0_6px_14px_-4px_rgba(0,0,0,0.35)] ${em ? 'bg-ember' : 'bg-steel'}`}>
          {s.n.padStart(2, '0')}
        </div>
        {/* hexagon outline */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full transition-transform duration-300 group-hover:scale-105"
          style={{ filter: 'drop-shadow(0 12px 22px rgba(0,0,0,0.10))' }}
          aria-hidden="true"
        >
          <polygon points="50,2.5 92,26 92,74 50,97.5 8,74 8,26" fill="var(--surface)" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
        </svg>
        {/* centred icon disc — primary glyph + composite tone accent badge */}
        <div className="absolute inset-0 grid place-items-center">
          <div className={`relative size-14 rounded-full bg-surface grid place-items-center shadow-[0_8px_20px_-8px_rgba(0,0,0,0.25)] transition-transform duration-300 group-hover:-translate-y-0.5 [&>svg]:size-7 [&>svg]:stroke-[1.75] ${em ? 'text-ember-strong' : 'text-steel-strong'}`}>
            {s.icon}
            <span className={`absolute -bottom-0.5 -right-0.5 grid size-[18px] place-items-center rounded-full text-white ring-2 ring-surface shadow-sm [&_svg]:size-2.5 ${em ? 'bg-ember' : 'bg-steel'}`}>
              {s.accent}
            </span>
          </div>
        </div>
      </div>

      {/* dotted connector + diamond node */}
      <div className="flex flex-col items-center py-1.5">
        <span className={`block h-4 border-l-2 border-dotted ${em ? 'border-ember/40' : 'border-steel/40'}`} />
        <span className={`size-2 rotate-45 rounded-[1px] ${em ? 'bg-ember' : 'bg-steel'}`} />
      </div>

      {/* description card with tone top-accent + small icon badge */}
      <div className={`relative w-full max-w-[210px] rounded-2xl border border-line border-t-[3px] bg-surface px-4 pt-7 pb-5 text-center shadow-[0_16px_36px_-22px_rgba(0,0,0,0.30)] transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_24px_46px_-24px_rgba(0,0,0,0.35)] ${em ? 'border-t-ember' : 'border-t-steel'}`}>
        <div className={`absolute -top-4 left-1/2 -translate-x-1/2 size-9 rounded-full grid place-items-center ring-4 ring-surface shadow-sm [&_svg]:size-[17px] ${em ? 'bg-ember-soft text-ember-strong' : 'bg-steel-soft text-steel-strong'}`}>
          {s.icon}
        </div>
        <h4 className="font-display font-bold text-base text-ink">{s.title}</h4>
        <p className="text-xs text-ink-muted leading-relaxed mt-1.5">{s.desc}</p>
      </div>
    </div>
  )
}

function ProcessFlow() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [state, setState] = useState<'hidden' | 'shown' | 'reduced'>('hidden')
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setState('reduced')
      return
    }
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) { setState('shown'); io.disconnect(); break }
      },
      { threshold: 0.3 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const animate = state !== 'reduced'
  const visible = state !== 'hidden'
  // panels on even beats, arrows on odd beats → the whole flow builds left-to-right
  const panelStyle = (i: number) => ({
    opacity: visible ? 1 : 0,
    transform: visible ? 'none' : 'translateY(18px)',
    transition: animate ? 'opacity 520ms ease-out, transform 520ms ease-out' : 'none',
    transitionDelay: animate ? `${i * 2 * 90}ms` : '0ms',
  })
  return (
    <div ref={ref}>
      {/* desktop: illustrated flow — panels + arrows draw in one by one */}
      <div className="hidden md:flex items-start">
        {PROCESS_STEPS.map((s, i) => (
          <div key={s.n} className="contents">
            <div className="group flex-1 flex flex-col items-center text-center px-1" style={panelStyle(i)}>
              <StepPanel s={s} />
            </div>
            {i < PROCESS_STEPS.length - 1 && (
              <StepArrow up={i % 2 === 0} tone={i % 2 === 0 ? 'steel' : 'ember'} idx={i} revealed={visible} delayMs={(i * 2 + 1) * 90} animate={animate} />
            )}
          </div>
        ))}
      </div>
      {/* mobile: stacked step cards — same hexagon-badge language, compact */}
      <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PROCESS_STEPS.map((s, i) => {
          const em = s.tone === 'ember'
          return (
            <div key={s.n} className={`group flex items-start gap-4 rounded-2xl border border-line border-t-[3px] bg-surface p-4 shadow-[0_10px_26px_-18px_rgba(0,0,0,0.28)] ${em ? 'border-t-ember' : 'border-t-steel'}`} style={panelStyle(i)}>
              <div className="relative shrink-0">
                <div className={`size-14 rounded-full bg-surface grid place-items-center ring-1 ring-line shadow-[0_8px_20px_-8px_rgba(0,0,0,0.25)] [&_svg]:size-6 ${em ? 'text-ember-strong' : 'text-steel-strong'}`}>
                  {s.icon}
                </div>
                <div className={`absolute -top-1.5 -left-1.5 size-5 rounded-full grid place-items-center font-display text-[10px] font-extrabold text-white ring-2 ring-surface ${em ? 'bg-ember' : 'bg-steel'}`}>
                  {s.n}
                </div>
              </div>
              <div>
                <h4 className="font-display font-bold text-sm text-ink">{s.title}</h4>
                <p className="text-xs text-ink-muted leading-relaxed mt-1">{s.desc}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* Shared scroll-reveal utilities for the home sections. Animation-based (uses
   the existing fade-up token) so it never fights a card's hover transition;
   prefers-reduced-motion → everything shows instantly. */
function useInView<T extends HTMLElement = HTMLDivElement>(threshold = 0.2, rootMargin = '0px 0px 20% 0px') {
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(reduce)
  useEffect(() => {
    if (reduce) return
    const el = ref.current
    if (!el) return
    // rootMargin extends the root's bottom edge so the reveal fires *before* the
    // element scrolls into view — the fade-in has finished by the time it's seen.
    // Prevents the "cards appear a moment late" flicker on normal/fast scrolls.
    const io = new IntersectionObserver(
      (entries) => { for (const e of entries) if (e.isIntersecting) { setInView(true); io.disconnect(); break } },
      { threshold, rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [reduce, threshold, rootMargin])
  return [ref, inView] as const
}

/** Two-way visibility (unlike useInView, keeps observing) so continuous loops —
 *  the marquees — can be paused while off-screen to save GPU/compositor work.
 *  Starts `true` to avoid a paused flash before the observer's first callback. */
function useVisible<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null)
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '140px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, visible] as const
}

/** Camera-depth parallax — drifts a layer against the scroll so foreground and
 *  background separate in space (perceived depth, not camera movement). Budget:
 *  transform-only, one rAF coalesced per frame, only runs while on-screen, and
 *  fully opts out under reduced motion. `speed` is fraction-of-viewport drift;
 *  keep it small (±0.03–0.08) so it reads as depth, never as movement. */
function useParallax<T extends HTMLElement = HTMLDivElement>(speed = 0.05) {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = ref.current
    if (!el) return
    let raf = 0
    let visible = true
    const update = () => {
      raf = 0
      if (!visible) return
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight || 1
      const progress = (rect.top + rect.height / 2 - vh / 2) / vh // ≈ -0.5 … 0.5 across the viewport
      el.style.transform = `translate3d(0, ${(-progress * speed * vh).toFixed(2)}px, 0)`
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) onScroll() }, { rootMargin: '20% 0px' })
    io.observe(el)
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      io.disconnect()
      if (raf) cancelAnimationFrame(raf)
      el.style.transform = ''
    }
  }, [speed])
  return ref
}

/** Directional reveal — slides a card in from a side (or up from below) as a
 *  transition, so the per-card delay is guaranteed regardless of any CSS
 *  animation-delay collision. Put it on a wrapper so card hover stays intact. */
function directionalReveal(inView: boolean, reduce: boolean, from: 'left' | 'right' | 'down', delay: number) {
  if (reduce) return undefined
  const hidden = from === 'left' ? 'translateX(-46px)' : from === 'right' ? 'translateX(46px)' : 'translateY(38px)'
  return {
    opacity: inView ? 1 : 0,
    transform: inView ? 'none' : hidden,
    transition: `opacity 0.75s var(--ease-settle) ${delay}ms, transform 0.75s var(--ease-settle) ${delay}ms`,
    willChange: 'opacity, transform',
  } as const
}

/** Count-up number that animates 0 → target the first time it scrolls in. */
function CountUp({ to, prefix = '', suffix = '', decimals = 0, className }: { to: number; prefix?: string; suffix?: string; decimals?: number; className?: string }) {
  const [ref, inView] = useInView<HTMLSpanElement>(0.5, '0px 0px -5% 0px')
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!inView) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setVal(to); return }
    let raf = 0
    let start = 0
    const tick = (now: number) => {
      if (!start) start = now
      const t = Math.min(1, (now - start) / 1300)
      setVal(to * (1 - Math.pow(1 - t, 3))) // easeOutCubic
      if (t < 1) raf = requestAnimationFrame(tick)
      else setVal(to)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, to])
  return <span ref={ref} className={className}>{prefix}{val.toFixed(decimals)}{suffix}</span>
}

/* ---------------------------------------------------------------------------
   ANNOUNCEMENTS & NOTICES — the "trading-desk newsroom" band.

   A premium, horizontally-snapping notice rail: category-coded cards with an
   icon tile, a NEW pulse, a date and a download/read action. Deliberately the
   ONLY horizontal-rail pattern on the page, so it reads as its own moment —
   not another grid. Prev/next controls + a segmented progress bar mirror the
   scroll position. Token-only palette, reduced-motion-safe (native smooth
   scroll), keyboard-reachable cards and controls.
--------------------------------------------------------------------------- */
type AnnounceTone = 'ember' | 'steel' | 'success' | 'warning'

const ANNOUNCE_TONES: Record<AnnounceTone, { tile: string; chip: string; bar: string; glow: string; hoverBorder: string }> = {
  ember: {
    tile: 'bg-ember-soft text-ember-strong',
    chip: 'bg-ember-soft text-ember-strong border-ember/20',
    bar: 'bg-ember', glow: 'bg-ember/10', hoverBorder: 'group-hover:border-ember/45',
  },
  steel: {
    tile: 'bg-steel-soft text-steel-strong',
    chip: 'bg-steel-soft text-steel-strong border-steel/20',
    bar: 'bg-steel', glow: 'bg-steel/10', hoverBorder: 'group-hover:border-steel/45',
  },
  success: {
    tile: 'bg-success-soft text-success',
    chip: 'bg-success-soft text-success border-success/25',
    bar: 'bg-success', glow: 'bg-success/10', hoverBorder: 'group-hover:border-success/45',
  },
  warning: {
    tile: 'bg-warning-soft text-warning',
    chip: 'bg-warning-soft text-warning border-warning/25',
    bar: 'bg-warning', glow: 'bg-warning/10', hoverBorder: 'group-hover:border-warning/45',
  },
}

type Announcement = {
  id: string
  category: string
  tone: AnnounceTone
  icon: ReactNode
  title: string
  body: string
  date: string
  action: 'download' | 'read'
  isNew?: boolean
}

const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'an-1', category: 'Auction Calendar', tone: 'ember', icon: <CalendarClock size={22} />,
    title: 'Q3 2026 Global Auction Calendar Released',
    body: 'Sixty-two scheduled sales across steel, copper and heavy assets — now open for lot preview and EMD funding.',
    date: 'Jul 21, 2026', action: 'read', isNew: true,
  },
  {
    id: 'an-2', category: 'Policy Update', tone: 'steel', icon: <FileText size={22} />,
    title: 'Revised Terms & Conditions — Industrial Metals',
    body: 'Updated bidding, settlement and reserve-protection terms effective 10.08.26. Applies to all live catalogues.',
    date: 'Jul 18, 2026', action: 'download',
  },
  {
    id: 'an-3', category: 'Payments', tone: 'success', icon: <CreditCard size={22} />,
    title: 'SmartPay Gateway 2.0 — Instant UPI & RTGS',
    body: 'Real-time wallet top-up and same-day EMD release now live across UPI, NetBanking and RTGS rails.',
    date: 'Jul 15, 2026', action: 'read', isNew: true,
  },
  {
    id: 'an-4', category: 'Logistics', tone: 'warning', icon: <Truck size={22} />,
    title: 'Area Pass & Vehicle-Placement Protocol',
    body: 'Generate area-pass requests for lifting directly from the fulfilment tracker — new gate-pass checklist attached.',
    date: 'Jul 10, 2026', action: 'download',
  },
  {
    id: 'an-5', category: 'Wallet', tone: 'ember', icon: <Wallet size={22} />,
    title: 'EMD Refund Window Extended to 72 Hours',
    body: 'Auto-release on lost lots now settles within 72 hours, with every lock and release traceable in your ledger.',
    date: 'Jul 05, 2026', action: 'read',
  },
  {
    id: 'an-6', category: 'Network', tone: 'steel', icon: <Globe size={22} />,
    title: 'Verified Seller Onboarding — APAC Region',
    body: 'KYC-backed seller registration opens across Japan, Korea and Southeast Asia with local settlement support.',
    date: 'Jul 01, 2026', action: 'download',
  },
]

function AnnouncementsBoard() {
  const railRef = useRef<HTMLDivElement | null>(null)
  const [active, setActive] = useState(0)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)
  // Cards deal in one after another as the board enters (executive-dashboard feel)
  const [revealRef, revealed] = useInView<HTMLElement>(0.12, '0px 0px -8% 0px')
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const measure = () => {
    const el = railRef.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('[data-card]')
    const step = card ? card.offsetWidth + 16 /* gap-4 */ : el.clientWidth
    setActive(Math.round(el.scrollLeft / step))
    setAtStart(el.scrollLeft <= 4)
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4)
  }

  // Sync nav-button + progress state to the actual rail on mount and on resize,
  // so the arrows show correct disabled edges before the first scroll.
  useEffect(() => {
    measure()
    const el = railRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const scrollByCards = (dir: 1 | -1) => {
    const el = railRef.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('[data-card]')
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.9
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  const NavBtn = ({ dir, disabled }: { dir: 1 | -1; disabled: boolean }) => (
    <button
      type="button"
      onClick={() => scrollByCards(dir)}
      disabled={disabled}
      aria-label={dir === -1 ? 'Previous announcements' : 'Next announcements'}
      className="size-10 rounded-full grid place-items-center border border-line-strong bg-surface text-ink transition-all duration-200 hover:bg-surface-2 hover:border-ink-faint hover:-translate-y-0.5 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember shadow-sm"
    >
      {dir === -1 ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
    </button>
  )

  return (
    <section ref={revealRef} aria-label="Announcements and Notices" className="space-y-6">
      {/* Header — eyebrow/title on the left, live badge + controls on the right */}
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ember-strong">
            <Megaphone size={14} /> Announcements &amp; Notices
          </div>
          <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight mt-1.5 text-ink text-balance">
            Straight from the <span className="text-ember">trading desk</span>.
          </h2>
          <p className="text-base text-ink-muted mt-2 text-pretty">
            Auction calendars, policy updates and official circulars — everything you need to bid informed, in one place.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-2 border border-line text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            <span className="size-2 rounded-full bg-emerald-500 animate-live-pulse" /> Updated weekly
          </span>
          <NavBtn dir={-1} disabled={atStart} />
          <NavBtn dir={1} disabled={atEnd} />
        </div>
      </div>

      {/* Horizontal snap rail — px/py give the hover-lift + card shadow room so
          overflow-x-auto (which also clips the y-axis) never cuts a card off.
          Only the RIGHT edge fades, hinting more content; the first card stays
          flush-left with the heading. scroll-p keeps snapped cards aligned. */}
      <div
        ref={railRef}
        onScroll={measure}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 pt-3 pb-5 scroll-px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:[mask-image:linear-gradient(to_right,#000_93%,transparent)]"
      >
        {ANNOUNCEMENTS.map((a, i) => {
          const t = ANNOUNCE_TONES[a.tone]
          return (
            <div
              key={a.id}
              data-card
              className="snap-start shrink-0 w-[280px] sm:w-[340px]"
              style={reduce ? undefined : {
                opacity: revealed ? 1 : 0,
                transform: revealed ? 'none' : 'translateY(26px)',
                transition: `opacity 0.6s var(--ease-settle) ${i * 95}ms, transform 0.6s var(--ease-settle) ${i * 95}ms`,
                willChange: 'opacity, transform',
              }}
            >
            <article
              className={`group relative card card-hover p-0 overflow-hidden flex flex-col h-full ${t.hoverBorder}`}
            >
              {/* tone accent bar */}
              <div className={`h-1 w-full ${t.bar}`} />
              {/* hover glow */}
              <div className={`pointer-events-none absolute -top-8 -right-8 size-40 rounded-full ${t.glow} blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

              <div className="relative z-10 p-5 flex flex-col flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className={`size-12 rounded-2xl grid place-items-center shadow-[0_6px_16px_-8px_rgba(0,0,0,0.25)] transition-transform duration-300 group-hover:-translate-y-0.5 ${t.tile}`}>
                    {a.icon}
                  </div>
                  {a.isNew && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ember text-white text-[10px] font-extrabold uppercase tracking-wider shadow-sm">
                      <span className="size-1.5 rounded-full bg-white animate-live-pulse" /> New
                    </span>
                  )}
                </div>

                <span className={`mt-4 self-start inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${t.chip}`}>
                  {a.category}
                </span>

                <h3 className="font-display font-bold text-base sm:text-lg text-ink leading-snug tracking-tight mt-2.5 line-clamp-2">
                  {a.title}
                </h3>
                <p className="text-sm text-ink-muted leading-relaxed mt-2 line-clamp-3">
                  {a.body}
                </p>

                <div className="mt-auto pt-4 flex items-center justify-between gap-3 border-t border-line">
                  <span className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
                    <Calendar size={13} /> <span className="num">{a.date}</span>
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-steel hover:text-steel-strong transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember rounded"
                  >
                    {a.action === 'download' ? (
                      <>Download <Download size={14} className="group-hover:translate-y-0.5 transition-transform" /></>
                    ) : (
                      <>Read notice <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" /></>
                    )}
                  </button>
                </div>
              </div>
            </article>
            </div>
          )
        })}
      </div>

      {/* Segmented progress indicator (mirrors scroll position) */}
      <div className="flex items-center justify-center gap-1.5 pt-1">
        {ANNOUNCEMENTS.map((a, i) => (
          <span
            key={a.id}
            className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? 'w-7 bg-ember' : 'w-1.5 bg-line-strong'}`}
          />
        ))}
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------------------
   TESTIMONIALS — the "executive spotlight" band.

   An interactive voice-of-the-customer moment: a large editorial portrait on
   the left, the active quote + rating on the right, and a photo avatar rail
   that switches speakers. Auto-advances every 7s, pauses on hover/focus, and
   honours prefers-reduced-motion. Deliberately different from the static
   Success Story card and the Announcements rail, so it reads as its own beat.
   Token-only palette, portraits are local /images assets, fully keyboard-driven.
--------------------------------------------------------------------------- */
type Testimonial = {
  id: string
  name: string
  role: string
  company: string
  location: string
  quote: string
  metric: string
  img: string
}

const TESTIMONIALS: Testimonial[] = [
  {
    id: 't-david', name: 'David Okonkwo', role: 'Group Purchasing Head',
    company: 'Atlas Resources', location: 'Lagos, Nigeria', img: '/images/exec_david.jpg',
    quote: 'The live bid trail changed how we negotiate internally. We walk into every auction with data, and we walk out having saved real capital.',
    metric: '$2.7M saved / yr',
  },
  {
    id: 't-kenji', name: 'Kenji Tanaka', role: 'Director of Global Sourcing',
    company: 'Rinkai Steel Works', location: 'Osaka, Japan', img: '/images/exec_kenji.jpg',
    quote: 'Reserve protection and EMD-backed bidders mean every lot we list meets serious demand. It is the first platform our board trusted with mill-grade volume.',
    metric: '¥1.2B traded',
  },
  {
    id: 't-arjun', name: 'Arjun Sharma', role: 'Head of Supply Chain',
    company: 'Meridian Metals', location: 'Mumbai, India', img: '/images/exec_arjun.jpg',
    quote: 'The transparency is unlike anything in this industry. My team sees every bid and every settlement in real time — no back-room deals, no surprises.',
    metric: '18% cost reduction',
  },
  {
    id: 't-lars', name: 'Lars Eriksson', role: 'VP, Raw Materials',
    company: 'Nordfjord Industries', location: 'Oslo, Norway', img: '/images/exec_lars.jpg',
    quote: 'From inspection reports to lifting logistics, the whole loop is one login. We onboarded four regional yards without adding a single headcount.',
    metric: '4 yards onboarded',
  },
  {
    id: 't-omar', name: 'Omar Al-Rashid', role: 'Managing Director',
    company: 'Gulf Alloy Trading', location: 'Dubai, UAE', img: '/images/exec_omar.jpg',
    quote: 'ferroBid gave us verified demand across three continents overnight. Our surplus now clears at a genuinely competitive rate, every single cycle.',
    metric: '3 continents reach',
  },
  {
    id: 't-rafael', name: 'Rafael Almeida', role: 'Chief Procurement Officer',
    company: 'Vale Ferro Group', location: 'São Paulo, Brazil', img: '/images/exec_rafael.jpg',
    quote: 'We replaced three weeks of yard visits with a single afternoon of live bidding. The audit trail alone made our compliance team fall in love with ferroBid.',
    metric: '31% faster sourcing',
  },
]

function Testimonials() {
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const t = TESTIMONIALS[idx]
  // Spotlight rises in when the section is reached (the inner blur only fires on
  // carousel change / mount, so on scroll-in the card would otherwise be static).
  const [revealRef, shown] = useInView<HTMLDivElement>(0.15, '0px 0px -8% 0px')

  // Auto-advance the spotlight; pause on hover/focus, skip under reduced motion.
  useEffect(() => {
    if (paused || reduce) return
    const id = setInterval(() => setIdx((x) => (x + 1) % TESTIMONIALS.length), 7000)
    return () => clearInterval(id)
  }, [paused, reduce])

  const go = (dir: 1 | -1) => setIdx((x) => (x + dir + TESTIMONIALS.length) % TESTIMONIALS.length)

  return (
    <section
      aria-label="Testimonials"
      className="space-y-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Header */}
      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ember-strong">
          <Quote size={14} /> Testimonials
        </div>
        <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight mt-1.5 text-ink text-balance">
          Trusted by the people who <span className="text-ember">move metal</span>.
        </h2>
        <p className="text-base text-ink-muted mt-2 text-pretty">
          From mill floors to boardrooms — hear why global procurement leaders run their auctions on ferroBid.
        </p>
      </div>

      {/* Spotlight card */}
      <div ref={revealRef} style={directionalReveal(shown, reduce, 'down', 0)} className="card overflow-hidden relative bg-surface shadow-[0_28px_70px_-40px_rgba(0,0,0,0.35)]">
        <div className="pointer-events-none absolute -top-16 -right-16 size-72 rounded-full bg-ember/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 size-72 rounded-full bg-steel/10 blur-3xl" />

        <div className="relative z-10 grid lg:grid-cols-12">
          {/* Portrait */}
          <div className="lg:col-span-5 relative min-h-[240px] lg:min-h-0 overflow-hidden lg:border-r lg:border-line">
            <img
              key={t.img}
              src={t.img}
              alt={`${t.name}, ${t.role} at ${t.company}`}
              className={`absolute inset-0 w-full h-full object-cover object-center ${reduce ? '' : 'animate-reveal-blur'}`}
            />
            {/* subtle bottom vignette for chip legibility — no side fade, so the
                portrait keeps a clean crisp edge against the content panel */}
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />
            {/* floating company chip */}
            <div className="absolute bottom-4 left-4 right-4 lg:right-auto">
              <div className="inline-flex items-center gap-2.5 rounded-2xl bg-surface/85 backdrop-blur-xl border border-line-strong/70 px-3.5 py-2.5 shadow-[0_16px_44px_-18px_rgba(0,0,0,0.4)]">
                <span className="size-9 rounded-xl bg-steel-soft text-steel-strong grid place-items-center font-display font-extrabold shrink-0">
                  {t.company.charAt(0)}
                </span>
                <div className="min-w-0">
                  <div className="font-display font-bold text-sm text-ink leading-tight truncate">{t.company}</div>
                  <div className="text-[11px] text-ink-muted flex items-center gap-1">
                    <BadgeCheck size={12} className="text-emerald-600 shrink-0" /> Verified enterprise
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-center relative overflow-hidden">
            <Quote size={120} className="pointer-events-none absolute -bottom-6 -right-4 text-ember/[0.06] rotate-180 hidden sm:block" aria-hidden="true" />

            {/* rating + counter */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1 text-amber-500" aria-label="Rated 5 out of 5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={16} className="fill-current" />
                ))}
                <span className="num ml-2 text-xs font-bold text-ink-muted">5.0</span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => go(-1)} aria-label="Previous testimonial" className="size-8 rounded-full grid place-items-center border border-line-strong bg-surface text-ink hover:bg-surface-2 hover:border-ink-faint transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember">
                  <ChevronLeft size={16} />
                </button>
                <span className="num text-xs font-bold text-ink-faint tabular-nums w-10 text-center">{idx + 1} / {TESTIMONIALS.length}</span>
                <button type="button" onClick={() => go(1)} aria-label="Next testimonial" className="size-8 rounded-full grid place-items-center border border-line-strong bg-surface text-ink hover:bg-surface-2 hover:border-ink-faint transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Quote (re-animates on change) */}
            <blockquote key={t.id} className={`mt-4 font-display text-lg sm:text-xl lg:text-[1.4rem] font-bold tracking-tight leading-snug text-ink text-balance ${reduce ? '' : 'animate-reveal-blur'}`}>
              &ldquo;{t.quote}&rdquo;
            </blockquote>

            {/* Attribution + metric */}
            <div className="mt-5 pt-4 border-t border-line flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="font-display font-bold text-base text-ink">{t.name}</div>
                <div className="text-sm text-ink-muted">{t.role} · {t.location}</div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5">
                <TrendingUp size={14} className="text-emerald-600" />
                <span className="num text-sm font-extrabold text-emerald-600">{t.metric}</span>
              </div>
            </div>

            {/* Avatar switcher rail */}
            <div className="mt-5 flex items-center gap-2.5">
              {TESTIMONIALS.map((p, i) => {
                const on = i === idx
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setIdx(i)}
                    aria-label={`Show testimonial from ${p.name}`}
                    aria-pressed={on}
                    className={`relative rounded-full transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember ${on ? 'ring-2 ring-ember ring-offset-2 ring-offset-surface scale-105' : 'opacity-60 hover:opacity-100'}`}
                  >
                    <img
                      src={p.img}
                      alt=""
                      className={`rounded-full object-cover object-center transition-all duration-300 ${on ? 'size-11' : 'size-9'}`}
                    />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* Live-activity feed for the hero marquee — each entry carries the product,
   the selling company, its city/country of origin, the earnest-money deposit
   (EMD) required to contest it, and how long ago it landed. Rendered twice
   back-to-back so the -50% ticker loop is seamless. */
type LiveEvent = {
  product: string
  seller: string
  city: string
  emd: string
  time: string
  dot: string
}

const LIVE_ACTIVITY: LiveEvent[] = [
  { product: 'Steel Coils · Hot Rolled', seller: 'Nippon Steel', city: 'Tokyo, JP', emd: '$6,800', time: '2m ago', dot: 'bg-emerald-500' },
  { product: 'Copper Cathodes · Grade A', seller: 'Freeport-McMoRan', city: 'Phoenix, US', emd: '$37,500', time: '1m ago', dot: 'bg-emerald-500' },
  { product: 'CAT 336 Excavator', seller: 'Ritchie Bros.', city: 'Dubai, AE', emd: '$21,500', time: '8m ago', dot: 'bg-amber-500' },
  { product: 'Aluminium Ingots · 99.7%', seller: 'Norsk Hydro', city: 'Oslo, NO', emd: '$15,400', time: '11m ago', dot: 'bg-emerald-500' },
  { product: 'TMT Rebar Bundle', seller: 'Tata Steel', city: 'Jamshedpur, IN', emd: '$4,200', time: '4m ago', dot: 'bg-emerald-500' },
  { product: 'Zinc Slabs · SHG', seller: 'Hindustan Zinc', city: 'Udaipur, IN', emd: '$9,100', time: '6m ago', dot: 'bg-steel' },
]

/* ---------------------------------------------------------------------------
   NEWS & INSIGHTS — the "trading-floor newsroom" band.

   A premium magazine layout: one large overlaid featured story on the left and
   a ranked headline list on the right. Editorial content (metal + machinery
   auction news / market analysis) — distinct from the Market Insights data
   dashboard. Token-only palette, local images, keyboard-reachable links.
--------------------------------------------------------------------------- */
type InsightTone = 'ember' | 'steel' | 'warning' | 'success'

const INSIGHT_TONES: Record<InsightTone, { text: string; solid: string }> = {
  ember: { text: 'text-ember-strong', solid: 'bg-ember' },
  steel: { text: 'text-steel-strong', solid: 'bg-steel' },
  warning: { text: 'text-warning', solid: 'bg-warning' },
  success: { text: 'text-success', solid: 'bg-success' },
}

type Insight = {
  id: string
  tone: InsightTone
  category: string
  title: string
  excerpt?: string
  author?: string
  date: string
  read: string
  img: string
}

const INSIGHTS: Insight[] = [
  {
    id: 'in-1', tone: 'ember', category: 'Market Analysis',
    title: 'Steel HRC Hits an 18-Month High as Asian Demand Outpaces Supply',
    excerpt: 'Hot-rolled coil benchmarks climbed 3.2% this week as East-Asian restocking collided with tight mill output — reshaping reserve strategies on the auction floor.',
    author: 'Ferrobid Research', date: 'Jul 22, 2026', read: '6 min read',
    img: '/images/auction_steel_coils.png',
  },
  {
    id: 'in-2', tone: 'steel', category: 'Non-Ferrous',
    title: 'Copper Cathode Premiums Tighten Ahead of Q3 Restocking',
    date: 'Jul 20, 2026', read: '4 min read', img: '/images/tile_copper.jpg',
  },
  {
    id: 'in-3', tone: 'warning', category: 'Machinery',
    title: 'Used-Equipment Values Climb as Construction Fleets Electrify',
    date: 'Jul 18, 2026', read: '5 min read', img: '/images/auction_cat_excavator.png',
  },
  {
    id: 'in-4', tone: 'steel', category: 'Platform',
    title: 'Inside Anti-Snipe: How Live-Bid Mechanics Protect Fair Pricing',
    date: 'Jul 16, 2026', read: '3 min read', img: '/images/why_ai_real.jpg',
  },
  {
    id: 'in-5', tone: 'ember', category: 'Auctions',
    title: 'Aluminium Billet Sales Draw Record Cross-Border Bidders',
    date: 'Jul 14, 2026', read: '4 min read', img: '/images/tile_aluminium.jpg',
  },
]

function InsightsSection() {
  const [featured, ...rest] = INSIGHTS
  const ft = INSIGHT_TONES[featured.tone]
  // Featured rises in; headlines slide in from the right, one after another.
  const [revealRef, shown] = useInView<HTMLElement>(0.12, '0px 0px -8% 0px')
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    <section ref={revealRef} aria-label="News and Insights" className="space-y-6">
      {/* header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ember-strong">
            <Newspaper size={14} /> News &amp; Insights
          </div>
          <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight mt-1.5 text-ink text-balance">
            The metal markets, <span className="text-ember">decoded</span>.
          </h2>
        </div>
        <Link to="/browse" className="text-sm font-bold text-steel hover:text-steel-strong flex items-center gap-1 hover:underline shrink-0">
          View all insights <ChevronRight size={16} />
        </Link>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Featured story — full-bleed image with overlaid headline */}
        <div
          className="lg:col-span-7"
          style={reduce ? undefined : {
            opacity: shown ? 1 : 0,
            transform: shown ? 'none' : 'translateY(26px)',
            transition: 'opacity 0.65s var(--ease-settle), transform 0.65s var(--ease-settle)',
            willChange: 'opacity, transform',
          }}
        >
        <Link
          to="/browse"
          className="group relative card card-hover overflow-hidden min-h-[360px] sm:min-h-[440px] flex w-full h-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
        >
          <img
            src={featured.img}
            alt={featured.title}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/5" />
          <div className="relative z-10 mt-auto p-6 sm:p-8 space-y-3 text-white">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sm ${ft.solid}`}>
              {featured.category}
            </span>
            <h3 className="font-display text-xl sm:text-3xl font-bold leading-snug tracking-tight text-balance max-w-2xl">
              {featured.title}
            </h3>
            <p className="text-sm text-white/80 leading-relaxed max-w-xl line-clamp-2">{featured.excerpt}</p>
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-white/70 pt-1">
              <span className="font-semibold text-white/90">{featured.author}</span>
              <span className="size-1 rounded-full bg-white/40" />
              <span>{featured.date}</span>
              <span className="size-1 rounded-full bg-white/40" />
              <span className="inline-flex items-center gap-1"><Clock size={12} /> {featured.read}</span>
            </div>
          </div>
        </Link>
        </div>

        {/* Ranked headline list */}
        <div className="lg:col-span-5 flex flex-col justify-between">
          {rest.map((a, i) => {
            const t = INSIGHT_TONES[a.tone]
            return (
              <Link
                key={a.id}
                to="/browse"
                style={reduce ? undefined : {
                  opacity: shown ? 1 : 0,
                  transform: shown ? 'none' : 'translateX(30px)',
                  transition: `opacity 0.55s var(--ease-settle) ${160 + i * 90}ms, transform 0.55s var(--ease-settle) ${160 + i * 90}ms`,
                  willChange: 'opacity, transform',
                }}
                className={`group flex items-start gap-4 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember rounded-lg ${i > 0 ? 'border-t border-line' : ''}`}
              >
                <div className="relative w-24 h-20 rounded-xl overflow-hidden shrink-0">
                  <img src={a.img} alt={a.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider ${t.text}`}>{a.category}</span>
                  <h4 className="font-display font-bold text-sm text-ink leading-snug mt-0.5 line-clamp-2 group-hover:text-ember transition-colors">{a.title}</h4>
                  <div className="text-[11px] text-ink-muted mt-1.5 flex items-center gap-1.5">
                    <Clock size={12} className="shrink-0" /> {a.date} · {a.read}
                  </div>
                </div>
                <ArrowUpRight size={16} className="shrink-0 mt-0.5 text-ink-faint transition-all group-hover:text-ember group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* Client/partner logos for the "Trusted by" wall. Real brand marks (source:
   Simple Icons) inlined as single-path SVGs with fill=currentColor, so they
   stay crisp and adapt to light/dark theme. Brands without an available mark
   fall back to a clean monochrome wordmark. Trademarks belong to their owners;
   shown as verified client references. */
const BRANDS: { name: string; path?: string }[] = [
  { name: 'NASA', path: 'M4.344 13.598c.075.281.195.39.407.39.22 0 .335-.132.335-.39V8.804h1.379v4.794c0 .675-.088.968-.43 1.31-.247.248-.703.439-1.278.439-.464 0-.909-.154-1.192-.438-.249-.25-.386-.505-.599-1.311l-.846-3.196c-.074-.281-.194-.39-.406-.39-.22 0-.336.132-.336.39v4.794H0v-4.794c0-.675.088-.968.43-1.31.247-.248.703-.439 1.278-.439.464 0 .909.154 1.192.438.249.25.385.505.599 1.311zM22.575 15.196l-1.591-4.98a.415.415 0 00-.06-.132.226.226 0 00-.186-.082.226.226 0 00-.185.082.414.414 0 00-.06.132l-1.591 4.98h-1.425l1.739-5.44c.09-.283.22-.524.384-.684.282-.275.614-.419 1.138-.419.525 0 .857.144 1.139.42.164.16.294.4.384.683L24 15.196h-1.425zM15.531 15.196c.903 0 1.344-.192 1.692-.538.385-.383.569-.802.569-1.427 0-.553-.202-1.064-.51-1.37-.403-.4-.903-.527-1.719-.527h-1.142c-.436 0-.61-.053-.748-.188-.094-.093-.139-.23-.139-.393 0-.168.04-.334.156-.448.103-.1.243-.147.511-.147h3.301V8.804h-3.049c-.903 0-1.343.192-1.691.538-.385.383-.57.802-.57 1.427 0 .553.203 1.064.51 1.37.404.4.904.527 1.72.527h1.141c.437 0 .61.053.748.188.095.093.14.23.14.393 0 .169-.041.335-.157.448-.102.1-.242.147-.51.147h-3.405l-1.306-4.086c-.09-.283-.22-.524-.384-.684-.282-.275-.615-.419-1.139-.419s-.857.144-1.138.42c-.165.16-.294.4-.385.683l-1.738 5.44h1.424l1.592-4.98a.415.415 0 01.06-.132.226.226 0 01.185-.082c.082 0 .142.028.186.082a.413.413 0 01.06.132l1.591 4.98h4.144z' },
  { name: 'Shell', path: 'M12 .863C5.34.863 0 6.251 0 12.98c0 .996.038 1.374.246 2.33l3.662 2.71.57 4.515h6.102l.326.227c.377.262.705.375 1.082.375.352 0 .732-.101 1.024-.313l.39-.289h6.094l.563-4.515 3.695-2.71c.208-.956.246-1.334.246-2.33C24 6.252 18.661.863 12 .863zm.996 2.258c.9 0 1.778.224 2.512.649l-2.465 12.548 3.42-12.062c1.059.36 1.863.941 2.508 1.814l.025.034-4.902 10.615 5.572-9.713.033.03c.758.708 1.247 1.567 1.492 2.648l-6.195 7.666 6.436-6.5.01.021c.253.563.417 1.36.417 1.996 0 .509-.024.712-.164 1.25l-3.554 2.602-.467 3.71h-4.475l-.517.395c-.199.158-.482.266-.682.266-.199 0-.483-.108-.682-.266l-.517-.394H6.322l-.445-3.61-3.627-2.666c-.11-.436-.16-.83-.16-1.261 0-.72.159-1.49.426-2.053l.013-.024 6.45 6.551L2.75 9.621c.25-1.063.874-2.09 1.64-2.713l5.542 9.776L4.979 6.1c.555-.814 1.45-1.455 2.546-1.827l3.424 12.069L8.355 3.816l.055-.03c.814-.45 1.598-.657 2.457-.657.195 0 .286.004.528.03l.587 13.05.46-13.059c.224-.025.309-.029.554-.029z' },
  { name: 'Siemens', path: 'M1.478 10.016c.24 0 .59.046 1.046.14v.726a2.465 2.465 0 0 0-.946-.213c-.41 0-.615.118-.615.354 0 .088.041.16.124.216.069.045.258.14.568.286.446.208.743.388.89.541.176.182.264.417.264.705 0 .415-.172.73-.516.949-.279.176-.64.264-1.085.264-.375 0-.753-.046-1.133-.139v-.755c.41.135.774.203 1.09.203.437 0 .655-.121.655-.362a.302.302 0 0 0-.095-.227c-.065-.065-.232-.155-.5-.27-.481-.208-.795-.384-.94-.53a.999.999 0 0 1-.284-.73c0-.377.137-.666.413-.864.272-.196.626-.294 1.064-.294zm21.19 0c.246 0 .565.04.956.123l.09.016v.727a2.471 2.471 0 0 0-.948-.213c-.409 0-.612.118-.612.354 0 .088.04.16.123.216.066.043.256.139.57.286.443.208.74.388.889.541.176.182.264.417.264.705 0 .415-.172.73-.514.949-.28.176-.643.264-1.087.264-.376 0-.754-.046-1.134-.139v-.755c.407.135.77.203 1.09.203.437 0 .655-.121.655-.362 0-.09-.03-.166-.092-.227-.066-.065-.233-.155-.503-.27-.48-.206-.793-.382-.94-.53a.997.997 0 0 1-.284-.732c0-.376.137-.664.413-.862.272-.196.627-.294 1.064-.294zm-12.674.066l.92 2.444.942-2.444h1.257v3.825h-.968v-2.708l-1.072 2.747h-.632l-1.052-2.747v2.708H8.67v-3.825zm-5.587 0v3.825H3.386v-3.825zm3.554 0v.692H6.327v.864H7.75v.63H6.327v.908h1.677v.73h-2.66v-3.824zm8.707 0v.692h-1.634v.864h1.422v.63h-1.422v.908h1.677v.73H14.05v-3.824zm1.898 0l1.255 2.56v-2.56h.719v3.825h-1.15l-1.288-2.595v2.595h-.72v-3.825z' },
  { name: 'BHP' },
  { name: 'ArcelorMittal' },
  { name: 'Caterpillar', path: 'M11.901 11.554l.802-4.1.798 4.1zm2.869-6.52h-4.15L8.2 15.884l4.503-3.635 4.695 3.934zm-2.067 8.156l-7.509 6.072H19.95zM24 5.02v2.77h-2.066v11.45h-.882l-2.436-2.04V7.79h-2.057V5.02zM6.872 16.864c.548-.458.642-1.024.642-1.532V13.2h-2.98v2.894a.75.75 0 0 1-.748.751c-.414 0-.722-.336-.722-.75V7.893c0-.414.308-.75.722-.75a.75.75 0 0 1 .749.75v2.913H7.51V7.785c0-1.67-1.092-3.044-3.75-3.047-2.728 0-3.76 1.38-3.76 3.05v8.563c0 1.655 1.314 2.907 2.995 2.907h.922Z' },
  { name: 'Toyota', path: 'M12 3.848C5.223 3.848 0 7.298 0 12c0 4.702 5.224 8.152 12 8.152S24 16.702 24 12c0-4.702-5.223-8.152-12-8.152zm7.334 3.839c0 1.08-1.725 1.913-4.488 2.246-.26-2.58-1.005-4.279-1.963-4.913 2.948.184 6.45 1.227 6.45 2.667zM12 16.401c-.96 0-1.746-1.5-1.808-4.389.577.047 1.18.072 1.808.072.628 0 1.23-.025 1.807-.072-.061 2.89-.847 4.389-1.807 4.389zm0-6.308c-.59 0-1.155-.019-1.69-.054.261-1.728.92-3.15 1.69-3.15.77 0 1.428 1.422 1.689 3.15-.535.034-1.099.054-1.689.054zm-.882-5.075c-.956.633-1.706 2.333-1.964 4.915C6.391 9.6 4.665 8.767 4.665 7.687c0-1.44 3.504-2.49 6.453-2.669zM2.037 11.68a5.265 5.265 0 011.048-3.164c.27 1.547 2.522 2.881 5.972 3.37V12c0 3.772.879 6.203 2.087 6.97-5.107-.321-9.107-3.48-9.107-7.29zm10.823 7.29c1.207-.767 2.087-3.198 2.087-6.97v-.115c3.447-.488 5.704-1.826 5.972-3.37a5.26 5.26 0 011.049 3.165c-.004 3.81-4.008 6.969-9.109 7.29z' },
]

/* Monochrome logo lockup — real brand mark (inline SVG, theme-aware) or a
   styled wordmark fallback. Muted by default, full-strength on hover. */
function BrandLogo({ name, path }: { name: string; path?: string }) {
  return (
    <div className="shrink-0 opacity-55 transition-opacity duration-300 hover:opacity-100 text-ink-muted hover:text-ink">
      {path ? (
        <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={name} className="h-8 sm:h-9 w-auto">
          <path d={path} />
        </svg>
      ) : (
        <span className="font-display text-lg sm:text-xl font-extrabold tracking-tight whitespace-nowrap">{name}</span>
      )}
    </div>
  )
}

export default function Guest2Home() {
  usePageMeta({
    title: 'Global Industrial Auctions & Marketplace',
    description: 'The world’s most trusted marketplace for industrial assets. Real auctions. Real-time bidding. Real results.',
  })
  const nav = useNavigate()
  const [chartRange, setChartRange] = useState<ChartRange>('30D')
  const [activeTooltipIndex, setActiveTooltipIndex] = useState<number | null>(4)
  // Forthcoming cards cascade *as the user arrives* — a negative bottom margin
  // holds the trigger until the grid is actually entering the viewport (rather
  // than the default pre-fire), so the one-after-another reveal is seen, not missed.
  const [liveRef, liveInView] = useInView<HTMLDivElement>(0.05, '0px 0px -12% 0px')
  const [catRef, catInView] = useInView<HTMLDivElement>(0.05, '0px 0px -10% 0px')
  const [whyRef, whyInView] = useInView<HTMLDivElement>(0.05, '0px 0px -12% 0px')
  const [chartRef, chartInView] = useInView<HTMLDivElement>(0.35)
  const [heroTickerRef, heroTickerVis] = useVisible<HTMLDivElement>()
  const [logoTickerRef, logoTickerVis] = useVisible<HTMLDivElement>()
  // Hero depth: foreground (image + panels) and background (ambient light) drift
  // against the scroll at opposite, tiny rates so the scene reads as layered.
  const heroFgParallax = useParallax<HTMLDivElement>(0.1)
  const heroBgParallax = useParallax<HTMLDivElement>(-0.09)
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [successRef, successShown] = useInView<HTMLDivElement>(0.12, '0px 0px -10% 0px')
  const [ctaRef, ctaShown] = useInView<HTMLDivElement>(0.15, '0px 0px -10% 0px')

  // Forthcoming (upcoming) auction lots — scheduled to open for bidding
  const upcomingAuctions = [
    {
      id: 'up-1',
      title: 'Steel Coils – Hot Rolled',
      seller: 'Nippon Steel',
      location: 'Tokyo, Japan',
      openingPrice: '$58,000',
      emd: '$5,800',
      lots: 24,
      startsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000).toISOString(),
      progress: 72,
      spark: [58, 60, 59, 62, 61, 64, 66, 68],
      img: '/images/auction_steel_coils.png',
    },
    {
      id: 'up-2',
      title: 'Copper Cathodes – Grade A',
      seller: 'Freeport-McMoRan',
      location: 'Phoenix, USA',
      openingPrice: '$320,000',
      emd: '$32,000',
      lots: 12,
      startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
      progress: 88,
      spark: [41, 43, 42, 44, 46, 45, 48, 50],
      img: '/images/auction_copper_cathodes.png',
    },
    {
      id: 'up-3',
      title: 'CAT 336 Heavy Excavator',
      seller: 'Ritchie Bros.',
      location: 'Dubai, UAE',
      openingPrice: '$180,000',
      emd: '$18,000',
      lots: 8,
      startsAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
      progress: 46,
      spark: [30, 33, 32, 35, 34, 38, 40, 43],
      img: '/images/auction_cat_excavator.png',
    },
    {
      id: 'up-4',
      title: 'Aluminium Ingots – 99.7%',
      seller: 'Norsk Hydro',
      location: 'Oslo, Norway',
      openingPrice: '$140,000',
      emd: '$14,000',
      lots: 16,
      startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
      progress: 63,
      spark: [49, 50, 49, 51, 52, 51, 53, 54],
      img: '/images/tile_aluminium.jpg',
    },
  ]

  const activeChart = CHART_DATA[chartRange]
  const chart = buildChart(activeChart.points)

  return (
    <Page className="space-y-20 pt-2 pb-16">
      {/* --------------------------------------------------------------------- */}
      {/* HERO SECTION WITH ULTRA-PHOTOREALISTIC STUDIO VISUAL & FLOATING CARDS */}
      {/* --------------------------------------------------------------------- */}
      <section className="relative flex flex-col lg:min-h-[calc(100vh-6rem)] pt-4 sm:pt-8 pb-5">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          {/* Left Hero Content — cinematic sequenced unfold (eyebrow → … → stats) */}
          <div className="lg:col-span-6 space-y-6">
            <div className="animate-fade-up inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-ember-soft border border-ember/30 text-ember-strong text-[11px] font-bold uppercase tracking-[0.15em]">
              <span className="size-2 rounded-full bg-ember animate-live-pulse" />
              LIVE. GLOBAL. TRANSPARENT.
            </div>

            <h1 style={{ animationDelay: '90ms' }} className="animate-fade-up font-display text-5xl sm:text-6xl lg:text-[4rem] font-extrabold tracking-tight leading-[1.02] text-balance">
              The Future of<br />
              <span className="bg-gradient-to-r from-ember via-amber-500 to-emerald-500 bg-clip-text text-transparent">
                Industrial Auctions
              </span>
            </h1>

            <p style={{ animationDelay: '190ms' }} className="animate-fade-up text-base sm:text-lg text-ink-muted leading-relaxed max-w-xl text-pretty">
              The world’s most trusted marketplace for industrial assets. Real auctions. Real-time bidding. Real results.
            </p>

            {/* CTAs */}
            <div style={{ animationDelay: '300ms' }} className="animate-fade-up flex flex-wrap items-center gap-4 pt-2">
              <Button
                size="lg"
                onClick={() => nav('/browse')}
                className="bg-gradient-to-r from-ember to-amber-600 text-white shadow-lg shadow-ember/25 hover:shadow-xl hover:shadow-ember/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 px-7 py-3.5 text-base font-bold rounded-xl"
              >
                Join Live Auction <ArrowRight size={18} />
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => nav('/browse')}
                className="px-7 py-3.5 text-base font-bold rounded-xl border-line-strong hover:bg-surface-2 hover:border-ink-faint hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 transition-all duration-300"
              >
                Explore Marketplace
              </Button>
            </div>

            {/* Stats Bar */}
            <div style={{ animationDelay: '420ms' }} className="animate-fade-up pt-7 border-t border-line/70 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5">
              <div>
                <div className="num text-2xl sm:text-3xl font-extrabold tracking-tight text-ink"><CountUp to={12.8} prefix="$" suffix="B+" decimals={1} /></div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mt-1">Millions Traded</div>
              </div>
              <div>
                <div className="num text-2xl sm:text-3xl font-extrabold tracking-tight text-ink"><CountUp to={150} suffix="+" /></div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mt-1">Countries</div>
              </div>
              <div>
                <div className="num text-2xl sm:text-3xl font-extrabold tracking-tight text-ink"><CountUp to={98} suffix="K+" /></div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mt-1">Enterprise Buyers</div>
              </div>
              <div>
                <div className="num text-2xl sm:text-3xl font-extrabold tracking-tight text-ink"><CountUp to={18} suffix="K+" /></div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mt-1">Verified Sellers</div>
              </div>
            </div>
          </div>

          {/* Right Side Photorealistic Studio Hero Graphic with Ambient Stage Lighting & Glass Overlays */}
          <div style={{ animationDelay: '240ms' }} className="animate-fade-up lg:col-span-6 relative">
            {/* Ambient Background Stage Lighting — slow breathing, out of phase,
                on a parallax layer so it drifts behind the foreground */}
            <div ref={heroBgParallax} className="absolute inset-0 pointer-events-none will-change-transform">
              <div className="absolute -top-10 -right-10 size-96 bg-ember/10 rounded-full blur-3xl animate-breathe" />
              <div className="absolute -bottom-10 -left-10 size-96 bg-emerald-500/[0.07] rounded-full blur-3xl animate-breathe [animation-delay:-4.5s]" />
            </div>

            <div ref={heroFgParallax} className="relative mx-auto max-w-xl will-change-transform">
              {/* image frame — overflow-hidden keeps the photo rounded; cards live OUTSIDE it so they can overhang the edges */}
              <div className="rounded-3xl overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.35)] border border-line-strong bg-surface/90 backdrop-blur-md p-2.5 group hover:shadow-[0_40px_90px_-30px_rgba(0,0,0,0.4)] transition-all duration-500">
                {/* composite showcase — bento mosaic of real photos: steel · pipes · machinery · copper · aluminium */}
                <div className="grid grid-cols-3 grid-rows-3 gap-1.5 h-[430px] sm:h-[480px] rounded-2xl overflow-hidden">
                  <img
                    src="/images/tile_steel.jpg"
                    alt="Steel coil ready for auction"
                    className="col-start-1 row-start-1 row-span-2 w-full h-full object-cover"
                  />
                  <img
                    src="/images/tile_pipes.jpg"
                    alt="Stacked steel pipes ready for auction"
                    className="col-start-1 row-start-3 w-full h-full object-cover"
                  />
                  <img
                    src="/images/hero_assets.jpg"
                    alt="Excavators lined up in an industrial auction yard"
                    className="col-start-2 row-start-1 row-span-3 w-full h-full object-cover object-center saturate-[1.03] contrast-[1.02]"
                  />
                  <img
                    src="/images/tile_copper.jpg"
                    alt="Copper coil ready for auction"
                    className="col-start-3 row-start-1 row-span-2 w-full h-full object-cover"
                  />
                  <img
                    src="/images/tile_aluminium.jpg"
                    alt="Aluminium billets ready for auction"
                    className="col-start-3 row-start-3 w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Glass Overlay Widget 1: Top Left Auction Countdown (overhangs left edge on desktop) */}
              <div className="absolute top-8 left-3 lg:-left-8 bg-surface/90 backdrop-blur-xl p-4 shadow-[0_16px_44px_-18px_rgba(0,0,0,0.22)] border border-line-strong/70 rounded-2xl hidden sm:block max-w-[220px] animate-float-soft [animation-delay:-0.6s]">
                <div className="flex items-center justify-between text-[11px] font-bold text-ink-faint uppercase tracking-wider">
                  <span>Auction Ends in</span>
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="num text-xl font-extrabold text-ink mt-1 tracking-wider">
                  00 : 18 : 42
                </div>
                <div className="mt-2.5 pt-2.5 border-t border-line text-[11px] flex justify-between text-ink-muted">
                  <span>Bid Increment</span>
                  <span className="num font-bold text-ink">$250</span>
                </div>
                <div className="mt-1.5 text-[11px] flex justify-between items-center text-ink-muted">
                  <span>Bidders Online</span>
                  <span className="num font-bold text-emerald-600 flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    128 Live
                  </span>
                </div>
              </div>

              {/* Glass Overlay Widget 2: Top Right Live Auction Card (overhangs right edge on desktop) */}
              <div className="absolute top-8 right-3 lg:-right-8 bg-surface/95 backdrop-blur-xl p-4 shadow-[0_16px_44px_-18px_rgba(0,0,0,0.22)] border border-line-strong/70 rounded-2xl max-w-[245px] animate-float-soft [animation-delay:-2.8s]">
                <div className="flex items-center justify-between gap-2">
                  <Chip tone="ember" pulse className="text-[10px] uppercase font-bold py-0.5">
                    <Radio size={10} /> LIVE AUCTION
                  </Chip>
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    +2.48% ↑
                  </span>
                </div>
                <div className="font-display font-bold text-sm text-ink mt-2">Steel Coils – Hot Rolled</div>
                <div className="text-[11px] text-ink-muted mt-1">Current Highest Bid</div>
                <div className="num text-2xl font-extrabold text-emerald-600 tracking-tight">$68,450</div>
                <div className="mt-2 pt-2 border-t border-line text-[11px] text-ink-muted flex items-center justify-between">
                  <span>Highest Bidder</span>
                  <span className="font-bold text-ink">MetalCorp GmbH</span>
                </div>
              </div>

              {/* Glass Overlay Widget 3: Bottom Right Market Velocity (overhangs right edge on desktop) */}
              <div className="absolute bottom-12 right-3 lg:-right-8 bg-surface/90 backdrop-blur-xl p-4 shadow-[0_16px_44px_-18px_rgba(0,0,0,0.22)] border border-line-strong/70 rounded-2xl hidden sm:block max-w-[210px] animate-float-soft [animation-delay:-4.9s]">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-ink-muted font-medium">Bid Velocity</span>
                  <span className="text-amber-600 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full">High</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-ink-muted font-medium">Price Trend</span>
                  <span className="num text-emerald-600 font-bold">+3.25% ↑</span>
                </div>
                <div className="mt-2 pt-2 border-t border-line flex items-center justify-between text-[11px]">
                  <span className="text-ink-muted font-medium">Market Confidence</span>
                  <span className="text-emerald-600 font-bold">Very High</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Flexible spacer: on lg it grows to push the ticker toward the bottom,
            but shrinks to 0 when content is tall — so the ticker's mt-10 is always
            a guaranteed minimum gap and it can never ride up under the image. */}
        <div aria-hidden="true" className="hidden lg:block flex-1" />

        {/* Horizontal Marquee Ticker Strip */}
        <div className="mt-10 rounded-2xl bg-surface border border-line p-3 overflow-hidden shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-2 text-[13px] font-bold uppercase tracking-wider text-ember-strong border border-line">
              <Activity size={15} className="animate-pulse" />
              <span>LIVE ACTIVITY</span>
              <span className="text-[10px] text-ink-faint hidden sm:inline">24/7 Global Bidding</span>
            </div>

            <div className="overflow-hidden whitespace-nowrap relative flex-1 [mask-image:linear-gradient(to_right,transparent,#000_5%,#000_95%,transparent)]">
              {/* rendered twice back-to-back → seamless -50% loop */}
              <div ref={heroTickerRef} style={{ animationPlayState: heroTickerVis ? undefined : 'paused' }} className="animate-ticker flex items-center gap-3.5 text-[13px]">
                {[...LIVE_ACTIVITY, ...LIVE_ACTIVITY].map((e, i) => (
                  <div
                    key={i}
                    aria-hidden={i >= LIVE_ACTIVITY.length}
                    className="flex items-center gap-2.5 shrink-0 rounded-xl border border-line bg-surface px-3.5 py-2 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.12)]"
                  >
                    <span className={`size-1.5 rounded-full ${e.dot} animate-live-pulse`} />
                    <span className="font-bold text-ink">{e.product}</span>
                    <span className="hidden md:inline-flex items-center gap-1.5 text-ink-muted">
                      <Building2 size={13} className="text-steel shrink-0" /> {e.seller}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-ink-muted">
                      <MapPin size={13} className="text-ember shrink-0" /> {e.city}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-steel-soft text-steel-strong px-2 py-0.5 text-[11px] font-bold border border-steel/15">
                      EMD <span className="num text-[13px] font-extrabold">{e.emd}</span>
                    </span>
                    <span className="text-ink-faint text-[11px]">{e.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* FORTHCOMING AUCTIONS SECTION                                           */}
      {/* --------------------------------------------------------------------- */}
      <Reveal>
        <section aria-label="Forthcoming Auctions" className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-ember-strong">FORTHCOMING AUCTIONS</div>
              <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight mt-1">
                Coming Up Next. Register Early.
              </h2>
            </div>
            <Link
              to="/browse"
              className="text-sm font-bold text-steel hover:text-steel-strong flex items-center gap-1 hover:underline"
            >
              View Auction Calendar <ChevronRight size={16} />
            </Link>
          </div>

          <div ref={liveRef} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {upcomingAuctions.map((item, i) => {
              // Explicit transition-based stagger — guaranteed per-card delay,
              // independent of any CSS animation-delay / shorthand collision.
              // Reveal lives on the wrapper; card-hover stays on the inner card
              // so hover interactions are untouched.
              const delay = reduceMotion ? 0 : Math.round(i * 260 * (1 - Math.min(i * 0.05, 0.3)))
              return (
              <div
                key={item.id}
                style={reduceMotion ? undefined : {
                  opacity: liveInView ? 1 : 0,
                  transform: liveInView ? 'none' : 'translateY(22px)',
                  clipPath: liveInView ? 'inset(0 0 0 0)' : 'inset(100% 0 0 0)',
                  transition: `opacity 0.6s var(--ease-settle) ${delay}ms, transform 0.6s var(--ease-settle) ${delay}ms, clip-path 0.6s var(--ease-settle) ${delay}ms`,
                  willChange: 'opacity, transform',
                }}
              >
                <div className="card card-hover p-4 flex flex-col justify-between space-y-4 h-full">
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden h-40 group">
                    <img
                      src={item.img}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2.5 left-2.5">
                      <Chip tone="steel" className="text-[10px] uppercase font-bold">
                        Upcoming
                      </Chip>
                    </div>
                    <div className="absolute top-2.5 right-2.5">
                      <Countdown endsAt={item.startsAt} prefix="Starts" size="sm" />
                    </div>
                  </div>

                  <div>
                    <h3 className="font-display font-bold text-base text-ink line-clamp-1">{item.title}</h3>
                    <div className="text-xs text-ink-muted mt-1 flex justify-between">
                      <span>Seller: <strong className="text-ink">{item.seller}</strong></span>
                      <span>Location: <strong className="text-ink">{item.location}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-line">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <span className="text-[11px] text-ink-muted block">Opening Price</span>
                      <span className="num text-xl font-extrabold text-ink">{item.openingPrice}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-steel">
                      <Sparkline points={item.spark} id={item.id} className="w-20 h-7" />
                      <div className="flex items-center gap-2 leading-none">
                        <span className="num text-xs font-bold text-ink">EMD {item.emd}</span>
                        <span className="num text-xs text-ink-muted">{item.lots} lots</span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-ember to-amber-500 rounded-full"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>

                  <Button
                    onClick={() => nav('/browse')}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm py-2 rounded-xl"
                  >
                    Register to Bid
                  </Button>
                </div>
                </div>
              </div>
              )
            })}
          </div>
        </section>
      </Reveal>

      {/* --------------------------------------------------------------------- */}
      {/* WHY CHOOSE FERROBID SECTION                                           */}
      {/* --------------------------------------------------------------------- */}
      <Section
        eyebrow="WHY CHOOSE FERROBID"
        title="Built for Trust. Designed for Global Industry."
        lede="Complete transparency, AI verification, and verified enterprise buyer networks built from the ground up."
      >
        <div ref={whyRef} className="grid lg:grid-cols-3 gap-6">
          {/* Card 1: Transparent Auctions — enters from the left */}
          <div style={directionalReveal(whyInView, reduceMotion, 'left', 0)}>
          <div className="card p-6 bg-surface/90 backdrop-blur-md border border-line-strong rounded-2xl relative overflow-hidden group hover:shadow-xl hover:border-ember/40 transition-all duration-300 flex flex-col justify-between h-full">
            <div className="absolute top-0 right-0 size-32 bg-ember/5 rounded-full blur-2xl group-hover:bg-ember/10 transition-colors pointer-events-none" />
            <div aria-hidden="true" style={{ animationDelay: '380ms' }} className={`pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent ${whyInView ? 'animate-sheen' : 'opacity-0'}`} />
            <div className="grid grid-cols-12 gap-4 items-center relative z-10">
              <div className="col-span-7 space-y-2.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  <ShieldCheck size={11} /> 100% Audit Trail
                </span>
                <h3 className="font-display text-lg font-bold text-ink leading-snug tracking-tight">Transparent Auctions</h3>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Real-time bidding, full audit trails, and complete transparency at every step.
                </p>
                <div className="pt-2">
                  <Link
                    to="/g2/how-it-works"
                    className="inline-flex items-center gap-1 text-xs font-bold text-ember hover:text-ember-strong group/link"
                  >
                    Learn More <ChevronRight size={14} className="group-hover/link:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>

              <div className="col-span-5 h-36 relative rounded-2xl overflow-hidden bg-gradient-to-br from-surface-2 to-surface-3 border border-line-strong/80 shadow-inner shrink-0">
                <img
                  src="/images/why_transparent_real.jpg"
                  alt="Steel coils in an industrial warehouse"
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                />
              </div>
            </div>
          </div>
          </div>

          {/* Card 2: AI Fraud Detection — rises from below */}
          <div style={directionalReveal(whyInView, reduceMotion, 'down', 110)}>
          <div className="card p-6 bg-surface/90 backdrop-blur-md border border-line-strong rounded-2xl relative overflow-hidden group hover:shadow-xl hover:border-steel/40 transition-all duration-300 flex flex-col justify-between h-full">
            <div className="absolute top-0 right-0 size-32 bg-steel/5 rounded-full blur-2xl group-hover:bg-steel/10 transition-colors pointer-events-none" />
            <div aria-hidden="true" style={{ animationDelay: '510ms' }} className={`pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent ${whyInView ? 'animate-sheen' : 'opacity-0'}`} />
            <div className="grid grid-cols-12 gap-4 items-center relative z-10">
              <div className="col-span-7 space-y-2.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-steel-soft text-steel-strong border border-steel/20">
                  <Cpu size={11} /> Real-Time AI Security
                </span>
                <h3 className="font-display text-lg font-bold text-ink leading-snug tracking-tight">AI Fraud Detection</h3>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Advanced AI protects every transaction and ensures fair competition.
                </p>
                <div className="pt-2">
                  <Link
                    to="/g2/solutions/buyers"
                    className="inline-flex items-center gap-1 text-xs font-bold text-ember hover:text-ember-strong group/link"
                  >
                    Learn More <ChevronRight size={14} className="group-hover/link:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>

              <div className="col-span-5 h-36 relative rounded-2xl overflow-hidden bg-gradient-to-br from-surface-2 to-surface-3 border border-line-strong/80 shadow-inner shrink-0">
                <img
                  src="/images/why_ai_real.jpg"
                  alt="Secure data-center server racks with network cabling"
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                />
              </div>
            </div>
          </div>
          </div>

          {/* Card 3: Global Enterprise Network — enters from the right */}
          <div style={directionalReveal(whyInView, reduceMotion, 'right', 0)}>
          <div className="card p-6 bg-surface/90 backdrop-blur-md border border-line-strong rounded-2xl relative overflow-hidden group hover:shadow-xl hover:border-amber-500/40 transition-all duration-300 flex flex-col justify-between h-full">
            <div className="absolute top-0 right-0 size-32 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors pointer-events-none" />
            <div aria-hidden="true" style={{ animationDelay: '640ms' }} className={`pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent ${whyInView ? 'animate-sheen' : 'opacity-0'}`} />
            <div className="grid grid-cols-12 gap-4 items-center relative z-10">
              <div className="col-span-7 space-y-2.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/10 text-amber-600 border border-amber-500/20">
                  <Globe size={11} /> 150+ Global Hubs
                </span>
                <h3 className="font-display text-lg font-bold text-ink leading-snug tracking-tight">Global Enterprise Network</h3>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Connecting enterprise buyers and verified sellers across 150+ countries.
                </p>
                <div className="pt-2">
                  <Link
                    to="/g2/solutions/sellers"
                    className="inline-flex items-center gap-1 text-xs font-bold text-ember hover:text-ember-strong group/link"
                  >
                    Learn More <ChevronRight size={14} className="group-hover/link:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>

              <div className="col-span-5 h-36 relative rounded-2xl overflow-hidden bg-gradient-to-br from-surface-2 to-surface-3 border border-line-strong/80 shadow-inner shrink-0">
                <img
                  src="/images/why_global_real.jpg"
                  alt="Container ship and cranes at a global shipping port"
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                />
              </div>
            </div>
          </div>
          </div>
        </div>
      </Section>

      {/* --------------------------------------------------------------------- */}
      {/* HOW FERROBID WORKS (Continuous Horizontal Enterprise Process Flow)    */}
      {/* --------------------------------------------------------------------- */}
      <Reveal>
        <section aria-label="How Ferrobid Works" className="space-y-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-ember-strong">HOW FERROBID WORKS</div>
              <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight mt-1 text-ink">
                Start bidding in <span className="text-ember">5 quick steps</span>
              </h2>
            </div>
            <Link
              to="/g2/how-it-works"
              className="text-sm font-bold text-steel hover:text-steel-strong inline-flex items-center gap-1 hover:underline shrink-0"
            >
              Learn more <ChevronRight size={16} />
            </Link>
          </div>

          {/* Illustrated 5-step flow with curved connector arrows */}
          <ProcessFlow />
        </section>
      </Reveal>

      {/* --------------------------------------------------------------------- */}
      {/* MARKET INSIGHTS SECTION (Live Data. Smarter Decisions.)               */}
      {/* --------------------------------------------------------------------- */}
      <Section
        eyebrow="MARKET INSIGHTS"
        title="Live Data. Smarter Decisions."
        lede="Real-time commodity benchmarks, price trend graphs, and global market demand indicators."
      >
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left Column: Live Commodity List */}
          <div className="lg:col-span-3 card p-5 space-y-4 bg-surface">
            <h3 className="font-display font-bold text-sm text-ink uppercase tracking-wider">
              Live Metal Indices
            </h3>
            <div className="space-y-3">
              {[
                { name: 'Steel (HRC)', price: '$620 / MT', change: '+3.25%', up: true, spark: [10, 11, 10.6, 11.8, 11.4, 12.6, 13.4] },
                { name: 'Copper', price: '$8,750 / MT', change: '+1.42%', up: true, spark: [20, 20.6, 20.3, 21, 21.6, 21.2, 22.4] },
                { name: 'Aluminium', price: '$2,380 / MT', change: '+0.85%', up: true, spark: [15, 15.2, 15.05, 15.4, 15.3, 15.55, 15.9] },
                { name: 'Crude Oil', price: '$78.20 / bbl', change: '-2.11%', up: false, spark: [30, 29.6, 29.9, 29, 28.6, 28.1, 27.3] },
              ].map((c, i) => (
                <div key={c.name} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-surface-2 border border-line hover:border-line-strong transition-colors">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-ink">{c.name}</div>
                    <div className="num text-xs text-ink-muted">{c.price}</div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <Sparkline points={c.spark} id={`mi-${i}`} className={`w-14 h-5 ${c.up ? 'text-emerald-600' : 'text-danger'}`} />
                    <span className={`num text-xs font-bold flex items-center gap-0.5 ${c.up ? 'text-emerald-600' : 'text-danger'}`}>
                      {c.up ? <TrendingUp size={14} /> : <TrendingDown size={14} />} {c.change}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <Link
              to="/browse"
              className="block text-center text-xs font-bold text-steel hover:underline pt-2"
            >
              View Full Market Dashboard →
            </Link>
          </div>

          {/* Center Column: Interactive Steel Price Trend Chart */}
          <div className="lg:col-span-6 card p-5 space-y-4 bg-surface flex flex-col justify-between">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display font-bold text-base text-ink">Steel Price Trend</h3>
                <span className="text-xs text-ink-muted">USD / MT (Spot Benchmark)</span>
              </div>

              {/* Range Selector Buttons */}
              <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl border border-line">
                {(['7D', '30D', '90D', '1Y'] as ChartRange[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setChartRange(r)
                      setActiveTooltipIndex(CHART_DATA[r].points.length - 1)
                    }}
                    className={`num px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                      chartRange === r ? 'bg-surface text-ink shadow-sm border border-line' : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* SVG spline area chart — the line strokes itself on first view
                (Bloomberg-terminal "data drawing"), then the area + points settle in */}
            <div ref={chartRef} className="relative h-60 w-full">
              <svg
                className="w-full h-full overflow-visible"
                viewBox="0 0 500 200"
                preserveAspectRatio="none"
                style={{
                  // Draw-in as a left→right wipe of the whole plot — robust under
                  // the non-uniform stretch (unlike a pathLength stroke-dash, which
                  // under-covered the line and left the graph ending early).
                  clipPath: chartInView ? 'inset(-25% 0% -25% 0%)' : 'inset(-25% 100% -25% 0%)',
                  transition: 'clip-path 1.4s var(--ease-settle)',
                }}
              >
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--success)" stopOpacity="0.26" />
                    <stop offset="100%" stopColor="var(--success)" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Gridlines */}
                {[40, 90, 140].map((y) => (
                  <line key={y} x1="0" y1={y} x2="500" y2={y} stroke="var(--line)" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
                ))}

                {/* Area + line — always rendered complete; the reveal is the
                    clip-path wipe on the parent <svg>, so the spline never ends early */}
                <path d={chart.area} fill="url(#chartGradient)" />
                <path
                  d={chart.line}
                  fill="none"
                  stroke="var(--success)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              {/* Data points (HTML overlay → stay perfectly round, keyboard-accessible) */}
              <div className="absolute inset-0" style={{ opacity: chartInView ? 1 : 0, transition: 'opacity 0.7s var(--ease-soft) 0.95s' }}>
                {chart.coords.map((pt, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveTooltipIndex(i)}
                    aria-label={`${activeChart.labels[i]}: $${activeChart.points[i]} per MT`}
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-all duration-200 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
                    style={{
                      left: `${(pt.x / chart.W) * 100}%`,
                      top: `${(pt.y / chart.H) * 100}%`,
                      width: activeTooltipIndex === i ? 13 : 10,
                      height: activeTooltipIndex === i ? 13 : 10,
                      borderColor: 'var(--success)',
                      background: activeTooltipIndex === i ? 'var(--success)' : 'var(--surface)',
                    }}
                  />
                ))}
              </div>

              {/* Active tooltip — follows the active point, shows its real value */}
              {activeTooltipIndex !== null && (() => {
                const c = chart.coords[activeTooltipIndex]
                const val = activeChart.points[activeTooltipIndex]
                const prev = activeChart.points[activeTooltipIndex - 1] ?? val
                const chg = prev ? ((val - prev) / prev) * 100 : 0
                return (
                  <div
                    className="absolute -translate-x-1/2 -translate-y-[135%] pointer-events-none z-20"
                    style={{ left: `${(c.x / chart.W) * 100}%`, top: `${(c.y / chart.H) * 100}%` }}
                  >
                    <div className="rounded-xl bg-surface/95 backdrop-blur border border-line-strong px-3 py-1.5 shadow-lg text-xs whitespace-nowrap">
                      <div className="num font-bold text-ink">${val.toLocaleString()} / MT</div>
                      <div className={`num text-[11px] font-semibold ${chg >= 0 ? 'text-emerald-600' : 'text-danger'}`}>
                        {chg >= 0 ? '▲' : '▼'} {Math.abs(chg).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Axis Date Labels */}
            <div className="flex justify-between text-xs num text-ink-faint pt-2 border-t border-line">
              {activeChart.labels.map((lbl) => (
                <span key={lbl}>{lbl}</span>
              ))}
            </div>
          </div>

          {/* Right Column: Global Heat Map & Market Pulse */}
          <div className="lg:col-span-3 space-y-4">
            {/* Global Heat Map Card */}
            <div className="card p-4 space-y-3 bg-surface">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-xs text-ink uppercase tracking-wider">
                  Global Heat Map
                </h3>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  Live Demand
                </span>
              </div>
              <div className="h-28 rounded-xl bg-surface-2 border border-line relative overflow-hidden">
                <div className="absolute inset-0 opacity-30 bg-[radial-gradient(var(--line-strong)_0.8px,transparent_0.8px)] [background-size:10px_10px]" />
                <WorldHeatMap className="absolute inset-0 w-full h-full p-2" />
                <span className="absolute bottom-1.5 left-2.5 text-[10px] text-ink-faint z-10">Active demand · 150+ hubs</span>
              </div>
            </div>

            {/* Market Pulse Gauge Card */}
            <div className="card p-4 space-y-3 bg-surface">
              <h3 className="font-display font-bold text-xs text-ink uppercase tracking-wider">
                Market Pulse
              </h3>

              <div className="space-y-3">
                {[
                  { label: 'Overall Demand', value: 'High · 3.24%', pct: 84, tone: 'var(--success)' },
                  { label: 'Supply Status', value: 'Stable', pct: 60, tone: 'var(--steel)' },
                  { label: 'Price Volatility', value: 'Very High', pct: 90, tone: 'var(--warning)' },
                ].map((m) => (
                  <div key={m.label}>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-ink-muted">{m.label}</span>
                      <span className="num font-bold text-ink">{m.value}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${m.pct}%`, background: m.tone }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* --------------------------------------------------------------------- */}
      {/* ANNOUNCEMENTS & NOTICES SECTION                                        */}
      {/* --------------------------------------------------------------------- */}
      <Reveal>
        <AnnouncementsBoard />
      </Reveal>

      {/* --------------------------------------------------------------------- */}
      {/* FEATURED CATEGORIES SECTION                                           */}
      {/* --------------------------------------------------------------------- */}
      <Reveal>
        <section aria-label="Featured Categories" className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-ember-strong">FEATURED CATEGORIES</div>
              <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight mt-1">
                Explore Top Industrial Categories
              </h2>
            </div>
            <Link to="/browse" className="text-sm font-bold text-steel hover:underline flex items-center gap-1">
              View All Categories <ChevronRight size={16} />
            </Link>
          </div>

          <div ref={catRef} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {CATEGORY_META.map((c, i) => (
              <div
                key={c.key}
                style={reduceMotion ? undefined : {
                  opacity: catInView ? 1 : 0,
                  transform: catInView ? 'none' : 'translateY(22px) scale(0.97)',
                  transition: `opacity 0.55s var(--ease-settle) ${i * 60}ms, transform 0.55s var(--ease-settle) ${i * 60}ms`,
                  willChange: 'opacity, transform',
                }}
              >
                <CategoryTile category={c} />
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* --------------------------------------------------------------------- */}
      {/* NEWS & INSIGHTS SECTION                                               */}
      {/* --------------------------------------------------------------------- */}
      <Reveal>
        <InsightsSection />
      </Reveal>

      {/* --------------------------------------------------------------------- */}
      {/* SUCCESS STORIES SECTION                                               */}
      {/* --------------------------------------------------------------------- */}
      <Reveal>
        <section aria-label="Success Stories" className="space-y-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-ember-strong">SUCCESS STORIES</div>
            <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight mt-1 text-ink">
              Results That Matter.
            </h2>
            <p className="text-base text-ink-muted mt-2 max-w-xl">
              How Fortune 500 enterprises optimize procurement yields and unlock capital liquidity.
            </p>
          </div>

          <div ref={successRef} className="card p-8 bg-surface border border-line grid lg:grid-cols-12 gap-8 items-center shadow-md">
            <div style={directionalReveal(successShown, reduceMotion, 'left', 0)} className="lg:col-span-5 relative rounded-2xl overflow-hidden h-72 group border border-line">
              <img
                src="/images/success_story_yard.png"
                alt="Global Mining Corp Enterprise Facility"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur px-2.5 py-1 rounded-full text-white border border-white/30">
                  Global Procurement Case Study
                </span>
                <div className="font-display font-bold text-sm mt-2">Global Mining Corp – Yard #4 Inspection</div>
              </div>
            </div>

            <div style={directionalReveal(successShown, reduceMotion, 'right', 130)} className="lg:col-span-7 space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-steel uppercase tracking-wider bg-steel-soft px-3 py-1 rounded-full border border-steel/20">
                  Global Mining Corp
                </span>
                <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                  <ShieldCheck size={14} /> Verified Enterprise Outcome
                </span>
              </div>

              <div className="space-y-1">
                <div className="num font-display text-4xl sm:text-5xl font-extrabold text-ember tracking-tight">
                  Saved <CountUp to={2.4} prefix="$" suffix="M" decimals={1} />
                </div>
                <div className="text-sm font-semibold text-ink-muted">
                  On Annual Heavy Metal & Scrap Asset Procurement
                </div>
              </div>

              {/* Key Metrics Row — figures count up as the story scrolls in */}
              <div className="grid grid-cols-3 gap-3 py-3 border-y border-line">
                <div>
                  <div className="num text-lg font-bold text-ink"><CountUp to={2.4} prefix="$" suffix="M" decimals={1} /></div>
                  <div className="text-[11px] text-ink-muted">Total Savings</div>
                </div>
                <div>
                  <div className="num text-lg font-bold text-ink"><CountUp to={12} /></div>
                  <div className="text-[11px] text-ink-muted">Auctions Won</div>
                </div>
                <div>
                  <div className="num text-lg font-bold text-emerald-600"><CountUp to={18} suffix="%" /></div>
                  <div className="text-[11px] text-ink-muted">Cost Reduction</div>
                </div>
              </div>

              <blockquote className="text-base text-ink italic leading-relaxed">
                “Ferrobid brings unmatched audit transparency, competitive live bidding, and million-dollar capital efficiency to our global procurement operations across multiple continents.”
              </blockquote>

              <div className="flex items-center gap-3.5 pt-1">
                <img
                  src="/images/executive_michael.png"
                  alt="Michael Carter"
                  className="size-11 rounded-full object-cover border border-line shadow-sm"
                />
                <div>
                  <div className="font-bold text-sm text-ink">Michael Carter</div>
                  <div className="text-xs text-ink-muted">Head of Procurement, Global Mining Corp</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* --------------------------------------------------------------------- */}
      {/* TESTIMONIALS SECTION                                                  */}
      {/* --------------------------------------------------------------------- */}
      <Reveal>
        <Testimonials />
      </Reveal>

      {/* --------------------------------------------------------------------- */}
      {/* TRUSTED BY GLOBAL LEADERS                                             */}
      {/* --------------------------------------------------------------------- */}
      <Reveal>
        <section aria-label="Trusted Leaders" className="space-y-8 text-center">
          <div className="text-xs font-bold uppercase tracking-wider text-ink-faint">
            TRUSTED BY INDUSTRY LEADERS &amp; ENTERPRISES WORLDWIDE
          </div>

          {/* Auto-scrolling monochrome logo wall — bespoke SVG marks + wordmarks,
              rendered twice for a seamless -50% loop; pauses on hover. */}
          <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_7%,#000_93%,transparent)]">
            {/* The strip animates translateX(-50%), so it must hold two IDENTICAL
                halves and each half must be wider than the container — otherwise a
                gap shows once a half scrolls off. Seven logos (~1 set) are narrower
                than the strip, so we repeat the set 4× (2 per half). Trailing
                padding per item (not flex `gap`) keeps spacing exact at the seam. */}
            <div ref={logoTickerRef} style={{ animationPlayState: logoTickerVis ? undefined : 'paused' }} className="animate-ticker flex items-center w-max py-1">
              {[...BRANDS, ...BRANDS, ...BRANDS, ...BRANDS].map((b, i) => (
                <div key={i} aria-hidden={i >= BRANDS.length} className="shrink-0 pr-12 sm:pr-16">
                  <BrandLogo name={b.name} path={b.path} />
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-line flex flex-wrap justify-center items-center gap-x-6 gap-y-3 text-xs text-ink-muted">
            <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-600" /> ISO 27001 Certified</span>
            <span className="flex items-center gap-1.5"><Lock size={14} className="text-emerald-600" /> SOC 2 Type II Compliant</span>
            <span className="flex items-center gap-1.5"><Building2 size={14} className="text-emerald-600" /> Bank-grade escrow &amp; settlement</span>
          </div>
        </section>
      </Reveal>

      {/* --------------------------------------------------------------------- */}
      {/* CTA CONVERSION BAND (FAANG Luxury Enterprise Styling)                  */}
      {/* --------------------------------------------------------------------- */}
      <Reveal>
        <div className="relative rounded-3xl bg-surface border border-line-strong p-8 sm:p-14 overflow-hidden shadow-xl">
          {/* Subtle Background Radial Glow */}
          <div className="absolute top-0 right-0 -mt-12 -mr-12 size-96 rounded-full bg-ember/10 blur-3xl pointer-events-none animate-breathe" />
          <div className="absolute bottom-0 left-0 -mb-12 -ml-12 size-80 rounded-full bg-steel/10 blur-3xl pointer-events-none animate-breathe [animation-delay:-5s]" />
          <div className="absolute inset-0 bg-[radial-gradient(#e4572e_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

          <div ref={ctaRef} className="relative z-10 grid lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-4 text-center sm:text-left">
              <div style={directionalReveal(ctaShown, reduceMotion, 'down', 0)} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ember-soft border border-ember/30 text-ember-strong text-xs font-bold uppercase tracking-wider">
                <span className="size-2 rounded-full bg-ember animate-pulse" />
                READY TO GET STARTED?
              </div>

              <h2 style={directionalReveal(ctaShown, reduceMotion, 'down', 80)} className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-ink leading-[1.15] text-balance">
                Join the World’s Most Trusted<br />
                <span className="bg-gradient-to-r from-ember via-amber-500 to-emerald-600 bg-clip-text text-transparent">
                  Auction Network.
                </span>
              </h2>

              <p style={directionalReveal(ctaShown, reduceMotion, 'down', 160)} className="text-base sm:text-lg text-ink-muted leading-relaxed max-w-2xl">
                Create your verified enterprise account today to access yard-inspected metal auctions, real-time transparent bidding, and institutional market intelligence.
              </p>

              {/* Trust Badges Row */}
              <div style={directionalReveal(ctaShown, reduceMotion, 'down', 240)} className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-6 text-xs font-semibold text-ink-muted">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-emerald-600" /> Free Enterprise Registration
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={15} className="text-emerald-600" /> EMD-Backed Bidding Protection
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock size={15} className="text-emerald-600" /> 24/7 Global Trading Desk
                </span>
              </div>
            </div>

            <div className="lg:col-span-4">
              <div style={directionalReveal(ctaShown, reduceMotion, 'down', 180)} className="flex flex-col gap-3 w-full sm:max-w-xs sm:mx-auto lg:ml-auto lg:mr-0">
                <button
                  onClick={() => nav('/login')}
                  className="h-14 w-full px-8 rounded-xl bg-gradient-to-r from-ember to-amber-600 hover:from-amber-600 hover:to-ember text-white font-bold text-base inline-flex items-center justify-center gap-2 shadow-lg shadow-ember/25 hover:shadow-ember/40 transition-all duration-200 hover:-translate-y-0.5 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
                >
                  Create Account <ArrowRight size={18} />
                </button>
                <button
                  onClick={() => nav('/browse')}
                  className="h-14 w-full px-8 rounded-xl bg-surface hover:bg-surface-2 border border-line-strong text-ink font-bold text-base inline-flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
                >
                  Explore Live Auctions
                </button>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </Page>
  )
}
