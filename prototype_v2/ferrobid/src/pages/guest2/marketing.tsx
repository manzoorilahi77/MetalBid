/* ---------------------------------------------------------------------------
   Guest 2 marketing primitives (blueprint §15, Phase 4).

   A small, LOCAL kit for the public site. Every piece is composed only from the
   existing Forge tokens and shared ui.tsx primitives — no new colors, no new
   fonts, no new motion. It lives inside pages/guest2/ so the whole role stays an
   isolated module: delete this folder and nothing else in the app changes.

   Reuse note: the contact form reuses Field/Input/Select/Textarea/Button, and
   the live proof strip reuses <Stat> — so neither needed a new component here.
--------------------------------------------------------------------------- */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronRight, ChevronDown, Check } from 'lucide-react'
import { Button, cx } from '../../components/ui'

type CtaLink = { label: string; to: string }

/**
 * useReveal — scroll-entrance for a section, reusing the existing
 * `animate-fade-up` token (blueprint §8). Fades a block up the first time it
 * enters the viewport; honours prefers-reduced-motion (no hide, no motion).
 * No new animation library — IntersectionObserver + one CSS keyframe.
 */
export function useReveal<T extends HTMLElement = HTMLElement>(delay = 0) {
  const ref = useRef<T | null>(null)
  const [state, setState] = useState<'hidden' | 'shown' | 'reduced'>('hidden')
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setState('reduced')
      return
    }
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) { setState('shown'); io.disconnect(); break }
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const className = state === 'reduced' ? '' : state === 'shown' ? 'animate-fade-up' : 'opacity-0'
  const style = delay && state === 'shown' ? { animationDelay: `${delay}ms` } : undefined
  return { ref, className, style }
}

/**
 * usePageMeta — sets the document title + description/OG tags per Guest 2 page
 * (blueprint §12). This is the client-side ceiling for a HashRouter SPA; real
 * crawlable meta needs the path-based routing / prerender deploy task (Decision
 * 3), which is flagged separately and NOT changed here. Restores the prior
 * title on unmount so navigating back into the app doesn't leave a stale tab.
 */
export function usePageMeta({ title, description }: { title: string; description?: string }) {
  useEffect(() => {
    const fullTitle = `${title} · ferroBid`
    const prevTitle = document.title
    document.title = fullTitle

    const upsert = (attr: 'name' | 'property', key: string, content?: string) => {
      if (!content) return
      const selector = `meta[${attr}="${key}"]`
      let el = document.head.querySelector<HTMLMetaElement>(selector)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, key)
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
    }
    upsert('name', 'description', description)
    upsert('property', 'og:title', fullTitle)
    upsert('property', 'og:description', description)
    upsert('property', 'og:type', 'website')

    return () => { document.title = prevTitle }
  }, [title, description])
}

/** Reveal — wraps arbitrary content (e.g. a page's custom section) in the
 *  same scroll-entrance behaviour without changing its inner markup. */
export function Reveal({ children, className, delay }: { children: ReactNode; className?: string; delay?: number }) {
  const reveal = useReveal<HTMLDivElement>(delay)
  return (
    <div ref={reveal.ref} className={cx(reveal.className, className)} style={reveal.style}>
      {children}
    </div>
  )
}

/**
 * Section — the standard marketing section wrapper (eyebrow + heading + lede).
 * Reuse: every Guest 2 page; replaces ad-hoc <section> heading blocks.
 * Deps: tokens only. A11y: real <section> + <h2> (pages own the single <h1>).
 * Responsive: fluid heading at sm:. Perf: pure presentational, no state.
 */
export function Section({ id, eyebrow, title, lede, children, className }: {
  id?: string
  eyebrow?: string
  title?: ReactNode
  lede?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const reveal = useReveal<HTMLElement>()
  return (
    <section ref={reveal.ref} id={id} style={reveal.style} className={cx('scroll-mt-20', reveal.className, className)}>
      {eyebrow && (
        <div className="text-xs font-semibold uppercase tracking-wider text-ember-strong">{eyebrow}</div>
      )}
      {title && (
        <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight leading-tight mt-2 max-w-2xl text-balance">
          {title}
        </h2>
      )}
      {lede && <p className="text-base text-ink-muted mt-3 max-w-2xl">{lede}</p>}
      {children && <div className="mt-6">{children}</div>}
    </section>
  )
}

/**
 * Hero — the page-opening block: accent rule, display headline, sub, CTA row,
 * optional children (e.g. a live proof strip). Renders the page's single <h1>.
 * Reuse: every marketing page. Deps: Button + tokens + animate-fade-up.
 */
export function Hero({ eyebrow, title, sub, primary, secondary, children }: {
  eyebrow?: string
  title: ReactNode
  sub?: ReactNode
  primary?: CtaLink
  secondary?: CtaLink
  children?: ReactNode
}) {
  const nav = useNavigate()
  return (
    <section className="pt-6 sm:pt-12 animate-fade-up">
      <div className="max-w-3xl">
        <div className="h-1 w-16 bg-ember rounded-full mb-6" />
        {eyebrow && (
          <div className="text-xs font-semibold uppercase tracking-wider text-ember-strong mb-3">{eyebrow}</div>
        )}
        <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05] text-balance">
          {title}
        </h1>
        {sub && <p className="text-base sm:text-lg text-ink-muted mt-5 max-w-xl">{sub}</p>}
        {(primary || secondary) && (
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {primary && (
              <Button size="lg" onClick={() => nav(primary.to)}>
                {primary.label} <ArrowRight size={17} />
              </Button>
            )}
            {secondary && (
              <Button size="lg" variant="secondary" onClick={() => nav(secondary.to)}>
                {secondary.label}
              </Button>
            )}
          </div>
        )}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  )
}

/**
 * FeatureCard — icon tile + title + body. The repeated "proof point / pillar"
 * unit across Why, Trust, Technology, Solutions, Industries.
 * Reuse: high. Deps: card class + tokens. A11y: <h3> under the section <h2>.
 */
export function FeatureCard({ icon, title, body, className }: {
  icon?: ReactNode
  title: string
  body: ReactNode
  className?: string
}) {
  return (
    <div className={cx('card p-5 flex flex-col gap-2', className)}>
      {icon && (
        <span aria-hidden="true" className="size-9 rounded-xl bg-ember-soft text-ember-strong grid place-items-center mb-1">
          {icon}
        </span>
      )}
      <h3 className="font-display font-bold text-base">{title}</h3>
      <p className="text-sm text-ink-muted">{body}</p>
    </div>
  )
}

/**
 * FeatureGrid — responsive wrapper for FeatureCards (2 or 3 columns).
 * Keeps column/gap rhythm consistent instead of ad-hoc grid classes per page.
 */
export function FeatureGrid({ cols = 3, children, className }: {
  cols?: 2 | 3
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cx('grid gap-4', cols === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3', className)}>
      {children}
    </div>
  )
}

/**
 * CtaBand — the repeated conversion band (heading + sub + primary/secondary
 * CTA). FAANG Luxury Enterprise styling matching Home page CTA layout.
 */
export function CtaBand({ eyebrow = 'READY TO GET STARTED?', title, sub, trustBadges, primary, secondary }: {
  eyebrow?: string
  title: ReactNode
  sub?: ReactNode
  trustBadges?: { icon: ReactNode; label: string }[]
  primary?: CtaLink
  secondary?: CtaLink
}) {
  const nav = useNavigate()
  const reveal = useReveal<HTMLElement>()
  return (
    <section ref={reveal.ref} style={reveal.style} className={cx('relative rounded-3xl bg-surface border border-line-strong p-8 sm:p-14 overflow-hidden shadow-xl', reveal.className)}>
      {/* Background Radial Glow & Dot Pattern */}
      <div className="absolute top-0 right-0 -mt-12 -mr-12 size-96 rounded-full bg-ember/10 blur-3xl pointer-events-none animate-breathe" />
      <div className="absolute bottom-0 left-0 -mb-12 -ml-12 size-80 rounded-full bg-steel/10 blur-3xl pointer-events-none animate-breathe [animation-delay:-5s]" />
      <div className="absolute inset-0 bg-[radial-gradient(#e4572e_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

      <div className="relative z-10 grid lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-8 space-y-4 text-center sm:text-left">
          {eyebrow && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ember-soft border border-ember/30 text-ember-strong text-xs font-bold uppercase tracking-wider">
              <span className="size-2 rounded-full bg-ember animate-pulse" />
              {eyebrow}
            </div>
          )}

          <h2 className="font-display text-2xl sm:text-4xl lg:text-[2.75rem] font-extrabold tracking-tight text-ink leading-[1.15] text-balance">
            {title}
          </h2>

          {sub && (
            <p className="text-base sm:text-lg text-ink-muted leading-relaxed max-w-2xl">
              {sub}
            </p>
          )}

          {trustBadges && trustBadges.length > 0 && (
            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-6 text-xs font-semibold text-ink-muted">
              {trustBadges.map((badge, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {badge.icon} {badge.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {(primary || secondary) && (
          <div className="lg:col-span-4">
            <div className="flex flex-col gap-3 w-full sm:max-w-xs sm:mx-auto lg:ml-auto lg:mr-0">
              {primary && (
                <button
                  type="button"
                  onClick={() => nav(primary.to)}
                  className="h-14 w-full px-8 rounded-xl bg-gradient-to-r from-ember to-amber-600 hover:from-amber-600 hover:to-ember text-white font-bold text-base inline-flex items-center justify-center gap-2 shadow-lg shadow-ember/25 hover:shadow-ember/40 transition-all duration-200 hover:-translate-y-0.5 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember cursor-pointer"
                >
                  {primary.label} <ArrowRight size={18} />
                </button>
              )}
              {secondary && (
                <button
                  type="button"
                  onClick={() => nav(secondary.to)}
                  className="h-14 w-full px-8 rounded-xl bg-surface hover:bg-surface-2 border border-line-strong text-ink font-bold text-base inline-flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember cursor-pointer"
                >
                  {secondary.label}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * ArticleCard — Insights list item (tag, title, excerpt, reading time).
 * Reuse: Insights index + any "related reading" strip. Deps: card/card-hover.
 * A11y: whole card is a single <Link> with a visible focus ring.
 */
export function ArticleCard({ to, title, excerpt, tag, readingTime }: {
  to: string
  title: string
  excerpt: ReactNode
  tag?: string
  readingTime?: string
}) {
  return (
    <Link to={to} className="card card-hover p-5 flex flex-col gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember">
      {tag && <span className="text-xs font-semibold uppercase tracking-wider text-ember-strong">{tag}</span>}
      <h3 className="font-display font-bold text-base leading-snug">{title}</h3>
      <p className="text-sm text-ink-muted line-clamp-3">{excerpt}</p>
      <div className="mt-auto pt-2 flex items-center gap-2 text-xs text-ink-faint">
        {readingTime && <span className="num">{readingTime}</span>}
        <span className="inline-flex items-center gap-1 text-steel font-semibold ml-auto">
          Read <ChevronRight size={14} />
        </span>
      </div>
    </Link>
  )
}

/* ---------------------------------------------------------------------------
   Premium editorial components — flagship page building blocks. Every piece is
   token-only, reveal-animated, responsive and reduced-motion-safe.
--------------------------------------------------------------------------- */

/** Scroll-in-view boolean (one-shot). prefers-reduced-motion → true instantly. */
function useInView<T extends HTMLElement = HTMLDivElement>(threshold = 0.18) {
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(reduce)
  useEffect(() => {
    if (reduce) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => { for (const e of entries) if (e.isIntersecting) { setInView(true); io.disconnect(); break } },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [reduce, threshold])
  return [ref, inView] as const
}

/** CountUp — animates 0 → target the first time it scrolls into view. */
export function CountUp({ to, prefix = '', suffix = '', decimals = 0, className }: {
  to: number; prefix?: string; suffix?: string; decimals?: number; className?: string
}) {
  const [ref, inView] = useInView<HTMLSpanElement>(0.5)
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!inView) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setVal(to); return }
    let raf = 0
    let start = 0
    const tick = (now: number) => {
      if (!start) start = now
      const t = Math.min(1, (now - start) / 1300)
      setVal(to * (1 - Math.pow(1 - t, 3)))
      if (t < 1) raf = requestAnimationFrame(tick)
      else setVal(to)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, to])
  return <span ref={ref} className={className}>{prefix}{val.toFixed(decimals)}{suffix}</span>
}

/**
 * EditorialHero — flagship page hero: editorial headline + sub + CTAs on the
 * left, a premium image (with an optional floating stat chip) on the right.
 * Renders the page's single <h1>.
 */
export function EditorialHero({ eyebrow, title, sub, primary, secondary, image, imageAlt, floatLabel, floatValue, floatPulse }: {
  eyebrow?: string
  title: ReactNode
  sub?: ReactNode
  primary?: CtaLink
  secondary?: CtaLink
  image: string
  imageAlt: string
  floatLabel?: string
  floatValue?: string
  floatPulse?: boolean
}) {
  const nav = useNavigate()
  return (
    <section className="pt-4 sm:pt-8 animate-fade-up">
      <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
        <div className="max-w-xl">
          <div className="h-1 w-16 bg-ember rounded-full mb-6" />
          {eyebrow && <div className="text-xs font-semibold uppercase tracking-wider text-ember-strong mb-3">{eyebrow}</div>}
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] text-balance">{title}</h1>
          {sub && <p className="text-base sm:text-lg text-ink-muted mt-5 text-pretty">{sub}</p>}
          {(primary || secondary) && (
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {primary && <Button size="lg" onClick={() => nav(primary.to)}>{primary.label} <ArrowRight size={17} /></Button>}
              {secondary && <Button size="lg" variant="secondary" onClick={() => nav(secondary.to)}>{secondary.label}</Button>}
            </div>
          )}
        </div>
        <div className="relative">
          <div className="absolute -top-8 -right-6 size-72 bg-ember/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative rounded-3xl overflow-hidden border border-line-strong shadow-[0_30px_70px_-30px_rgba(0,0,0,0.4)]">
            <img src={image} alt={imageAlt} className="w-full h-[320px] sm:h-[460px] object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
          </div>
          {floatValue && (
            <div className="absolute bottom-5 left-5 bg-surface/90 backdrop-blur-xl border border-line-strong/70 rounded-2xl px-4 py-3 shadow-[0_16px_44px_-18px_rgba(0,0,0,0.35)]">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint flex items-center gap-1.5">
                {floatPulse && <span className="size-1.5 rounded-full bg-ember animate-live-pulse" />}{floatLabel}
              </div>
              <div className="num text-xl font-extrabold text-ink mt-0.5">{floatValue}</div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/**
 * SplitFeature — editorial image/content block. Alternate `reverse` per section
 * to build rhythm down the page. Optional check-bulleted list + inline CTA.
 */
export function SplitFeature({ eyebrow, title, body, bullets, image, imageAlt, reverse, cta, badge }: {
  eyebrow?: string
  title: ReactNode
  body?: ReactNode
  bullets?: string[]
  image: string
  imageAlt: string
  reverse?: boolean
  cta?: CtaLink
  badge?: string
}) {
  const nav = useNavigate()
  const reveal = useReveal<HTMLElement>()
  return (
    <section ref={reveal.ref} style={reveal.style} className={cx('grid lg:grid-cols-2 gap-8 lg:gap-14 items-center', reveal.className)}>
      <div className={cx('relative', reverse && 'lg:order-2')}>
        <div className="rounded-3xl overflow-hidden border border-line-strong shadow-[0_24px_60px_-30px_rgba(0,0,0,0.32)]">
          <img src={image} alt={imageAlt} loading="lazy" className="w-full h-[300px] sm:h-[400px] object-cover" />
        </div>
      </div>
      <div className={cx(reverse && 'lg:order-1')}>
        {eyebrow && <div className="text-xs font-semibold uppercase tracking-wider text-ember-strong">{eyebrow}</div>}
        <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight leading-tight mt-2 text-balance">{title}</h2>
        {body && <p className="text-base text-ink-muted mt-4 text-pretty">{body}</p>}
        {bullets && (
          <ul className="mt-5 space-y-3">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-3 text-sm text-ink">
                <span aria-hidden="true" className="mt-0.5 size-5 rounded-full bg-success-soft text-success grid place-items-center shrink-0"><Check size={13} /></span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
        {badge && <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-ember-soft border border-ember/20 px-3 py-1 text-xs font-bold text-ember-strong">{badge}</div>}
        {cta && (
          <div className="mt-6">
            <Button size="md" variant="secondary" onClick={() => nav(cta.to)}>{cta.label} <ArrowRight size={15} /></Button>
          </div>
        )}
      </div>
    </section>
  )
}

/** StatRibbon — enterprise KPI band with count-up numbers. */
export function StatRibbon({ stats }: { stats: { to: number; prefix?: string; suffix?: string; decimals?: number; label: string }[] }) {
  const reveal = useReveal<HTMLDivElement>()
  return (
    <div ref={reveal.ref} style={reveal.style} className={cx('card bg-surface p-6 sm:p-8 grid grid-cols-2 lg:grid-cols-4 gap-6', reveal.className)}>
      {stats.map((s) => (
        <div key={s.label} className="text-center sm:text-left">
          <div className="num text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">
            <CountUp to={s.to} prefix={s.prefix} suffix={s.suffix} decimals={s.decimals} />
          </div>
          <div className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-muted mt-1.5">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

/** Quote — large editorial testimonial. */
export function Quote({ quote, author, role }: { quote: ReactNode; author: string; role: string }) {
  const reveal = useReveal<HTMLElement>()
  return (
    <section ref={reveal.ref} style={reveal.style} className={cx('card bg-gradient-to-br from-steel-soft to-surface p-8 sm:p-12', reveal.className)}>
      <div className="font-display text-2xl sm:text-[2rem] font-bold tracking-tight leading-snug text-balance max-w-3xl text-ink">
        &ldquo;{quote}&rdquo;
      </div>
      <div className="mt-6 flex items-center gap-3">
        <div className="size-11 rounded-full bg-ember-soft text-ember-strong grid place-items-center font-display font-bold">{author.charAt(0)}</div>
        <div>
          <div className="text-sm font-bold text-ink">{author}</div>
          <div className="text-xs text-ink-muted">{role}</div>
        </div>
      </div>
    </section>
  )
}

/** Faq — accessible accordion via native <details> (zero-JS, keyboard-friendly). */
export function Faq({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <div className="divide-y divide-line border border-line rounded-2xl bg-surface overflow-hidden">
      {items.map((it) => (
        <details key={it.q} className="group">
          <summary className="flex items-center justify-between gap-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden px-5 py-4 hover:bg-surface-2 transition-colors">
            <span className="font-display font-bold text-sm sm:text-base text-ink">{it.q}</span>
            <ChevronDown size={18} className="text-ink-faint shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-5 pb-5 -mt-1 text-sm text-ink-muted leading-relaxed">{it.a}</div>
        </details>
      ))}
    </div>
  )
}
