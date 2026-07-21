/* Marketplace landing — editorial hero, live rail, categories, how it works. */
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight, Search, Radio, ListChecks, Wallet, Gavel, Truck,
  PackagePlus, ClipboardCheck, BookOpen, Banknote, MapPin, Ruler, FileCheck2,
  ShieldCheck, ChevronRight,
} from 'lucide-react'
import { Page } from '../layout/Chrome'
import { Button, Chip, Countdown, PhotoThumb, cx } from '../components/ui'
import { CatalogueCard, CategoryTile, CATEGORY_META } from '../components/domain'
import { useStore, catalogueUiStatus } from '../store/store'
import { useNow } from '../lib/useTick'

const HOW_TRACKS: {
  title: string
  sub: string
  tone: 'ember' | 'steel' | 'success'
  steps: { icon: React.ReactNode; label: string; body: string }[]
}[] = [
  {
    title: 'For buyers',
    sub: 'Shortlist → fund EMD → bid → lift',
    tone: 'ember',
    steps: [
      { icon: <ListChecks size={18} />, label: 'Shortlist lots', body: 'Browse live catalogues and shortlist the lots you want to contest.' },
      { icon: <Wallet size={18} />, label: 'Fund EMD', body: 'Lock pre-bid EMD per lot from your wallet — refunded if you don’t win.' },
      { icon: <Gavel size={18} />, label: 'Bid live', body: 'Forward auction on rate per MT/KG/PCS with anti-snipe extensions.' },
      { icon: <Truck size={18} />, label: 'Pay & lift', body: 'H1 gets the delivery order. Pay, schedule lifting, weighment settles final qty.' },
    ],
  },
  {
    title: 'For sellers',
    sub: 'Submit lots → we inspect → catalogued → paid',
    tone: 'steel',
    steps: [
      { icon: <PackagePlus size={18} />, label: 'Submit lots', body: 'List your material with indicative quantity, grade and yard location.' },
      { icon: <ClipboardCheck size={18} />, label: 'We inspect', body: 'Our field team visits your yard, measures and photographs every lot.' },
      { icon: <BookOpen size={18} />, label: 'Catalogued', body: 'Verified lots go into a scheduled auction catalogue with reserve protection.' },
      { icon: <Banknote size={18} />, label: 'Get paid', body: 'Post-auction settlement with GST/TCS handled, funds to your account.' },
    ],
  },
  {
    title: 'Verified & catalogued by our team',
    sub: 'Field inspection → measured qty → published',
    tone: 'success',
    steps: [
      { icon: <MapPin size={18} />, label: 'Field inspection', body: 'Trained inspectors physically visit the yard for every single lot.' },
      { icon: <Ruler size={18} />, label: 'Measured quantity', body: 'Weighment-backed indicative quantity — final settles on lifting weighment.' },
      { icon: <FileCheck2 size={18} />, label: 'Published', body: 'Inspection report, photos and checklist attached before a lot goes live.' },
    ],
  },
]

export default function Home() {
  const nav = useNavigate()
  const now = useNow()
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const [q, setQ] = useState('')

  const { live, upcoming, nextClosing } = useMemo(() => {
    const live = catalogues.filter((c) => {
      const ui = catalogueUiStatus(c, now)
      return ui === 'live' || ui === 'closing'
    })
    const upcoming = catalogues.filter((c) => catalogueUiStatus(c, now) === 'upcoming')
    const nextClosing = [...live].sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt))[0]
    return { live, upcoming, nextClosing }
  }, [catalogues, now])

  const heroLots = useMemo(() => {
    const liveIds = new Set(live.map((c) => c.id))
    return lots.filter((l) => l.catalogueId && liveIds.has(l.catalogueId)).slice(0, 4)
      .map((l) => ({ hue: l.photos[0]?.hue ?? 20, category: l.category }))
  }, [lots, live])

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    nav(q.trim() ? `/browse?q=${encodeURIComponent(q.trim())}` : '/browse')
  }

  return (
    <Page className="space-y-16">
      {/* ------------------------------- Hero -------------------------------- */}
      <section className="pt-6 sm:pt-12 animate-fade-up">
        <div className="max-w-3xl">
          <div className="h-1 w-16 bg-ember rounded-full mb-6" />
          <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
            Industrial metal,<br />sold the <span className="text-ember">fair way</span>.
          </h1>
          <p className="text-base sm:text-lg text-ink-muted mt-5 max-w-xl">
            India&rsquo;s transparent B2B auction marketplace for scrap, flat &amp; long products,
            ferro alloys and plant assets — every lot physically inspected, catalogued and
            sold as-is-where-is.
          </p>

          <form onSubmit={submitSearch} className="mt-8 flex items-center max-w-xl relative">
            <Search size={18} className="absolute left-4 text-ink-faint pointer-events-none" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search MS scrap, SS coils, copper, catalogues…"
              aria-label="Search auctions"
              className="w-full h-[52px] pl-11 pr-32 rounded-2xl bg-surface border border-line-strong text-sm placeholder:text-ink-faint focus:outline-2 focus:outline-ember/60"
            />
            <Button type="submit" size="md" className="absolute right-1.5">Search</Button>
          </form>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={() => nav('/browse')}>
              Browse live auctions <ArrowRight size={17} />
            </Button>
            <Button size="lg" variant="secondary" onClick={() => nav('/buyer/kyc')}>
              Sell your material
            </Button>
          </div>

          {/* live ticker strip */}
          <div className="mt-8 card p-3 sm:p-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 bg-surface">
            <Chip tone="ember" pulse><Radio size={12} /> <span className="num">{live.length}</span> catalogues live now</Chip>
            {nextClosing && (
              <Link to={`/catalogue/${nextClosing.id}`} className="flex items-center gap-2 text-sm text-ink-muted hover:text-ink group">
                <span className="hidden sm:inline">Next to close:</span>
                <span className="num font-semibold text-ink">{nextClosing.code}</span>
                <Countdown endsAt={nextClosing.endsAt} size="sm" />
                <ChevronRight size={14} className="text-ink-faint group-hover:translate-x-0.5 transition-transform" />
              </Link>
            )}
          </div>
        </div>

        {heroLots.length > 0 && (
          <div className="mt-8 flex gap-2">
            {heroLots.map((l, i) => (
              <PhotoThumb key={i} hue={l.hue} category={l.category} className={cx('h-24 sm:h-32 flex-1 rounded-2xl', i > 1 && 'hidden sm:block')} />
            ))}
          </div>
        )}
      </section>

      {/* ---------------------------- Live rail ------------------------------ */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold">Live auctions</h2>
            <p className="text-sm text-ink-muted mt-1">Bidding open now — anti-snipe protected closings.</p>
          </div>
          <Link to="/browse?tab=live" className="text-sm font-semibold text-steel hover:underline whitespace-nowrap">View all</Link>
        </div>
        {live.length === 0 ? (
          <div className="card p-8 text-center text-sm text-ink-muted">No auctions are live right now — check the upcoming schedule below.</div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 snap-x snap-mandatory">
            {live.map((c) => <CatalogueCard key={c.id} cat={c} className="snap-start w-[320px] shrink-0" />)}
          </div>
        )}
      </section>

      {/* --------------------------- Upcoming grid --------------------------- */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold">Upcoming auctions</h2>
            <p className="text-sm text-ink-muted mt-1">Book yard inspections and fund EMD before the gavel drops.</p>
          </div>
          <Link to="/browse?tab=upcoming" className="text-sm font-semibold text-steel hover:underline whitespace-nowrap">View all</Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="card p-8 text-center text-sm text-ink-muted">New catalogues are announced every week — watch the noticeboard.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcoming.map((c) => <CatalogueCard key={c.id} cat={c} />)}
          </div>
        )}
      </section>

      {/* ------------------------- Browse by category ------------------------ */}
      <section>
        <h2 className="font-display text-2xl sm:text-3xl font-bold mb-4">Browse by category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {CATEGORY_META.map((c) => <CategoryTile key={c.key} category={c} />)}
        </div>
      </section>

      {/* ----------------------------- How it works -------------------------- */}
      <section>
        <h2 className="font-display text-2xl sm:text-3xl font-bold">How it works</h2>
        <p className="text-sm text-ink-muted mt-1 mb-6 max-w-2xl">
          One marketplace, three sides — buyers bid on verified lots, sellers get fair
          price discovery, and our field team stands behind every catalogue entry.
        </p>
        <div className="grid lg:grid-cols-3 gap-4">
          {HOW_TRACKS.map((track) => (
            <div key={track.title} className="card p-5">
              <div className={cx('text-xs font-bold uppercase tracking-wider',
                { ember: 'text-ember', steel: 'text-steel', success: 'text-success' }[track.tone])}>
                {track.title}
              </div>
              <div className="font-display font-bold text-lg mt-1 mb-4">{track.sub}</div>
              <ol className="space-y-4">
                {track.steps.map((s, i) => (
                  <li key={s.label} className="flex gap-3">
                    <span className={cx('num size-8 rounded-xl grid place-items-center shrink-0 font-bold text-sm',
                      { ember: 'bg-ember-soft text-ember-strong', steel: 'bg-steel-soft text-steel-strong', success: 'bg-success-soft text-success' }[track.tone])}>
                      {i + 1}
                    </span>
                    <span>
                      <span className="flex items-center gap-1.5 font-semibold text-sm text-ink">{s.icon} {s.label}</span>
                      <span className="block text-xs text-ink-muted mt-0.5 leading-relaxed">{s.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-faint mt-3">
          Quantities shown across the marketplace are indicative — final quantity settles on weighment at lifting.
        </p>
      </section>

      {/* ------------------------------ Trust band ---------------------------- */}
      <section className="card p-8 sm:p-10 bg-surface">
        <div className="grid sm:grid-cols-3 gap-8 text-center sm:text-left">
          <div>
            <div className="num font-display text-4xl sm:text-5xl font-bold text-ember">12,400+</div>
            <div className="text-sm text-ink-muted mt-1">lots sold on ferroBid</div>
          </div>
          <div>
            <div className="num font-display text-4xl sm:text-5xl font-bold text-ember">240</div>
            <div className="text-sm text-ink-muted mt-1">verified seller yards</div>
          </div>
          <div>
            <div className="num font-display text-4xl sm:text-5xl font-bold text-ember">3,800</div>
            <div className="text-sm text-ink-muted mt-1">registered buyers</div>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-line flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 font-semibold">
            <span className="size-9 rounded-xl bg-success-soft text-success grid place-items-center"><ShieldCheck size={18} /></span>
            Every lot physically inspected &amp; catalogued by our field team before it goes live.
          </div>
          <Button variant="secondary" onClick={() => nav('/help')}>Read our process</Button>
        </div>
      </section>
    </Page>
  )
}
