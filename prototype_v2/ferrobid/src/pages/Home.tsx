/* Marketplace landing — editorial hero, live rail, categories, how it works.

   Every section reads through `useCmsPage('/')` with the copy already on this
   page as its fallback — see api/useCmsPage.ts. That means today's render is
   byte-identical to before this page was wired up; an editor in the CMS has
   to publish something before anyone sees a difference. `cms.on(key)` is the
   half of that which matters most: it is what makes the Sub Admin's Portal
   sections toggle actually hide something here, rather than only changing
   what an API answers nobody reads. */
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight, Search, Radio, ListChecks, Wallet, Gavel, Truck,
  PackagePlus, ClipboardCheck, BookOpen, Banknote, MapPin, Ruler, FileCheck2,
  ShieldCheck, ChevronRight, Megaphone, Quote, Star, type LucideIcon,
} from 'lucide-react'
import { Page } from '../layout/Chrome'
import { Button, Chip, Countdown, Field, Modal, PhotoThumb, Textarea, cx } from '../components/ui'
import { CatalogueCard, CategoryTile, CATEGORY_META } from '../components/domain'
import { useStore, catalogueUiStatus } from '../store/store'
import { useNow } from '../lib/useTick'
import { useCmsPage } from '../api/useCmsPage'
import { relTime } from '../lib/format'

/** How-it-works icons are stored in the CMS as names (JSON has no component
 *  type), so a track from the API and a track from the fallback both resolve
 *  through this map rather than one of them carrying a live element. */
const TRACK_ICONS: Record<string, LucideIcon> = {
  ListChecks, Wallet, Gavel, Truck, PackagePlus, ClipboardCheck, BookOpen,
  Banknote, MapPin, Ruler, FileCheck2,
}

type Track = {
  title: string
  sub: string
  tone: 'ember' | 'steel' | 'success'
  steps: { icon: string; label: string; body: string }[]
}

const HOW_TRACKS: Track[] = [
  {
    title: 'For buyers',
    sub: 'Shortlist → fund EMD → bid → lift',
    tone: 'ember',
    steps: [
      { icon: 'ListChecks', label: 'Shortlist lots', body: 'Browse live catalogues and shortlist the lots you want to contest.' },
      { icon: 'Wallet', label: 'Fund EMD', body: 'Lock pre-bid EMD per lot from your wallet — refunded if you don’t win.' },
      { icon: 'Gavel', label: 'Bid live', body: 'Forward auction on rate per MT/KG/PCS with anti-snipe extensions.' },
      { icon: 'Truck', label: 'Pay & lift', body: 'H1 gets the delivery order. Pay, schedule lifting, weighment settles final qty.' },
    ],
  },
  {
    title: 'For sellers',
    sub: 'Submit lots → we inspect → catalogued → paid',
    tone: 'steel',
    steps: [
      { icon: 'PackagePlus', label: 'Submit lots', body: 'List your material with indicative quantity, grade and yard location.' },
      { icon: 'ClipboardCheck', label: 'We inspect', body: 'Our field team visits your yard, measures and photographs every lot.' },
      { icon: 'BookOpen', label: 'Catalogued', body: 'Verified lots go into a scheduled auction catalogue with reserve protection.' },
      { icon: 'Banknote', label: 'Get paid', body: 'Post-auction settlement with GST/TCS handled, funds to your account.' },
    ],
  },
  {
    title: 'Verified & catalogued by our team',
    sub: 'Field inspection → measured qty → published',
    tone: 'success',
    steps: [
      { icon: 'MapPin', label: 'Field inspection', body: 'Trained inspectors physically visit the yard for every single lot.' },
      { icon: 'Ruler', label: 'Measured quantity', body: 'Weighment-backed indicative quantity — final settles on lifting weighment.' },
      { icon: 'FileCheck2', label: 'Published', body: 'Inspection report, photos and checklist attached before a lot goes live.' },
    ],
  },
]

const SEVERITY_TONE = { info: 'steel', warning: 'warning', critical: 'danger' } as const

export default function Home() {
  const nav = useNavigate()
  const now = useNow()
  const cms = useCmsPage('/')
  /* The app-wide bootstrap (see App.tsx) pulls live + upcoming catalogues into
     the store. If the server is unreachable there is nothing to show — the
     rails render empty and the banner below says why. */
  const serverStatus = useStore((s) => s.serverStatus)
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const announcements = useStore((s) => s.announcements)
  const testimonials = useStore((s) => s.testimonials)
  const users = useStore((s) => s.users)
  const currentUser = useStore((s) => s.currentUser)
  const role = useStore((s) => s.role)
  const submitTestimonial = useStore((s) => s.submitTestimonial)
  const pushToast = useStore((s) => s.pushToast)
  const [q, setQ] = useState('')
  const [shareOpen, setShareOpen] = useState(false)
  const [shareQuote, setShareQuote] = useState('')
  const [shareBusy, setShareBusy] = useState(false)

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

  /* Platform notices only — a catalogue-scoped announcement belongs on that
     catalogue's page, not the marketplace front door. */
  const notices = useMemo(
    () => announcements.filter((a) => a.scope === 'platform')
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 3),
    [announcements])

  const approvedTestimonials = useMemo(
    () => testimonials.filter((t) => t.status === 'approved')
      .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt)).slice(0, 6),
    [testimonials])
  /* One quote per account, ever — the CTA disappears once theirs is on record,
     whatever a moderator later decides about it. */
  const myTestimonial = currentUser ? testimonials.find((t) => t.userId === currentUser.id) : undefined
  const canShare = currentUser && (role === 'buyer' || role === 'seller') && !myTestimonial

  const submitShare = () => {
    setShareBusy(true)
    const result = submitTestimonial(shareQuote)
    setShareBusy(false)
    if (result.ok) {
      setShareOpen(false)
      setShareQuote('')
      pushToast({ kind: 'success', title: 'Thank you', body: 'A moderator will review it before it appears here.' })
    } else {
      pushToast({ kind: 'danger', title: 'Not submitted', body: result.error ?? 'Something went wrong.' })
    }
  }

  const tracks = cms.value<Track[]>('how_it_works', 'tracks', HOW_TRACKS)
  const heroCtaPrimary = cms.value('hero', 'cta_primary', { label: 'Browse live auctions', to: '/browse' })
  const heroCtaSecondary = cms.value('hero', 'cta_secondary', { label: 'Sell your material', to: '/buyer/kyc' })
  const liveCtaAll = cms.value('live_auctions', 'view_all', { label: 'View all', to: '/browse?tab=live' })
  const upcomingCtaAll = cms.value('upcoming_auctions', 'view_all', { label: 'View all', to: '/browse?tab=upcoming' })
  const trustCta = cms.value('trust_footer', 'cta', { label: 'Read our process', to: '/help' })

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    nav(q.trim() ? `/browse?q=${encodeURIComponent(q.trim())}` : '/browse')
  }

  return (
    <Page className="space-y-16">
      {serverStatus === 'offline' && cms.on('offline_banner') && (
        <div className="card p-3 text-xs text-ink-muted border-warning/40 bg-warning-soft/10">
          {cms.text('offline_banner', 'message', 'Server not connected — live auctions cannot be loaded right now.')}
        </div>
      )}
      {/* ------------------------------- Hero -------------------------------- */}
      <section className="pt-6 sm:pt-12 animate-fade-up">
        <div className="max-w-3xl">
          <div className="h-1 w-16 bg-ember rounded-full mb-6" />
          <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
            {cms.text('hero', 'headline_lead', 'Industrial metal,')}<br />
            <span className="text-ember">{cms.text('hero', 'headline_accent', 'sold the fair way.')}</span>
          </h1>
          <p className="text-base sm:text-lg text-ink-muted mt-5 max-w-xl">
            {cms.text('hero', 'subcopy',
              'India’s transparent B2B auction marketplace for scrap, flat & long products, ferro alloys and plant assets — every lot physically inspected, catalogued and sold as-is-where-is.')}
          </p>

          <form onSubmit={submitSearch} className="mt-8 flex items-center max-w-xl relative">
            <Search size={18} className="absolute left-4 text-ink-faint pointer-events-none" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={cms.text('hero', 'search_placeholder', 'Search MS scrap, SS coils, copper, catalogues…')}
              aria-label="Search auctions"
              className="w-full h-[52px] pl-11 pr-32 rounded-2xl bg-surface border border-line-strong text-sm placeholder:text-ink-faint focus:outline-2 focus:outline-ember/60"
            />
            <Button type="submit" size="md" className="absolute right-1.5">Search</Button>
          </form>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={() => nav(heroCtaPrimary.to)}>
              {heroCtaPrimary.label} <ArrowRight size={17} />
            </Button>
            <Button size="lg" variant="secondary" onClick={() => nav(heroCtaSecondary.to)}>
              {heroCtaSecondary.label}
            </Button>
          </div>

          {/* live ticker strip */}
          {cms.on('ticker') && (
            <div className="mt-8 card p-3 sm:p-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 bg-surface">
              <Chip tone="ember" pulse><Radio size={12} /> <span className="num">{live.length}</span> catalogues live now</Chip>
              {nextClosing && (
                <Link to={`/catalogue/${nextClosing.id}`} className="flex items-center gap-2 text-sm text-ink-muted hover:text-ink group">
                  <span className="hidden sm:inline">Next to close:</span>
                  <span className="num font-semibold text-ember">{nextClosing.code}</span>
                  <Countdown endsAt={nextClosing.endsAt} size="sm" />
                  <ChevronRight size={14} className="text-ink-faint group-hover:translate-x-0.5 transition-transform" />
                </Link>
              )}
            </div>
          )}
        </div>

        {cms.on('hero_thumbs') && heroLots.length > 0 && (
          <div className="mt-8 flex gap-2">
            {heroLots.map((l, i) => (
              <PhotoThumb key={i} hue={l.hue} category={l.category} className={cx('h-24 sm:h-32 flex-1 rounded-2xl', i > 1 && 'hidden sm:block')} />
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------ Live rail ------------------------------ */}
      {cms.on('live_auctions') && (
        <section>
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold">
                {cms.text('live_auctions', 'heading', 'Live auctions')}
              </h2>
              <p className="text-sm text-ink-muted mt-1">
                {cms.text('live_auctions', 'subcopy', 'Bidding open now — anti-snipe protected closings.')}
              </p>
            </div>
            <Link to={liveCtaAll.to} className="text-sm font-semibold text-steel hover:underline whitespace-nowrap">{liveCtaAll.label}</Link>
          </div>
          {live.length === 0 ? (
            <div className="card p-8 text-center text-sm text-ink-muted">
              {cms.text('live_auctions', 'empty', 'No auctions are live right now — check the upcoming schedule below.')}
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 snap-x snap-mandatory">
              {live.map((c) => <CatalogueCard key={c.id} cat={c} className="snap-start w-[320px] shrink-0" />)}
            </div>
          )}
        </section>
      )}

      {/* --------------------------- Upcoming grid --------------------------- */}
      {cms.on('upcoming_auctions') && (
        <section>
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold">
                {cms.text('upcoming_auctions', 'heading', 'Upcoming auctions')}
              </h2>
              <p className="text-sm text-ink-muted mt-1">
                {cms.text('upcoming_auctions', 'subcopy', 'Book yard inspections and fund EMD before the gavel drops.')}
              </p>
            </div>
            <Link to={upcomingCtaAll.to} className="text-sm font-semibold text-steel hover:underline whitespace-nowrap">{upcomingCtaAll.label}</Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="card p-8 text-center text-sm text-ink-muted">
              {cms.text('upcoming_auctions', 'empty', 'New catalogues are announced every week — watch the noticeboard.')}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcoming.map((c) => <CatalogueCard key={c.id} cat={c} />)}
            </div>
          )}
        </section>
      )}

      {/* ----------------------------- Announcements ---------------------------- */}
      {cms.on('announcements') && notices.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Megaphone size={20} className="text-ember" />
            <h2 className="font-display text-2xl sm:text-3xl font-bold">Announcements</h2>
          </div>
          <div className="card divide-y divide-line overflow-hidden">
            {notices.map((a) => (
              <div key={a.id} className="p-4 flex flex-wrap items-start gap-x-3 gap-y-1.5">
                <Chip tone={SEVERITY_TONE[a.severity]} className="shrink-0 mt-0.5">{a.severity}</Chip>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm">{a.title}</div>
                  <p className="text-[13px] text-ink-muted mt-0.5 leading-relaxed">{a.body}</p>
                </div>
                <span className="text-[11px] text-ink-faint shrink-0">{relTime(a.at, now)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ----------------------------- Testimonials ---------------------------- */}
      {cms.on('testimonials') && (approvedTestimonials.length > 0 || canShare) && (
        <section>
          <div className="flex items-end justify-between mb-4 gap-3">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold">What our members say</h2>
              <p className="text-sm text-ink-muted mt-1">From verified buyers and sellers — every quote is moderated before it appears here.</p>
            </div>
            {canShare && (
              <Button variant="secondary" size="md" onClick={() => setShareOpen(true)} className="shrink-0">
                Share your experience
              </Button>
            )}
          </div>
          {approvedTestimonials.length === 0 ? (
            <div className="card p-8 text-center text-sm text-ink-muted">
              Be the first to share how ferroBid has worked for you.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {approvedTestimonials.map((t) => {
                const author = users.find((u) => u.id === t.userId)
                return (
                  <div key={t.id} className="card p-5">
                    <Quote size={20} className="text-ember mb-2" />
                    <p className="text-sm leading-relaxed">{t.quote}</p>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-line">
                      <div>
                        <div className="text-sm font-semibold">{author?.name ?? 'A ferroBid member'}</div>
                        <div className="text-xs text-ink-muted">{author?.firm ?? (t.role === 'buyer' ? 'Buyer' : 'Seller')}</div>
                      </div>
                      {typeof t.rating === 'number' && (
                        <div className="flex items-center gap-0.5" aria-label={`${t.rating} out of 5`}>
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star key={i} size={13} className={i < t.rating! ? 'text-ember fill-ember' : 'text-line-strong'} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* ------------------------- Browse by category ------------------------ */}
      {cms.on('categories') && (
        <section>
          <h2 className="font-display text-2xl sm:text-3xl font-bold mb-4">
            {cms.text('categories', 'heading', 'Browse by category')}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {CATEGORY_META.map((c) => <CategoryTile key={c.key} category={c} />)}
          </div>
        </section>
      )}

      {/* ----------------------------- How it works -------------------------- */}
      {cms.on('how_it_works') && (
        <section>
          <h2 className="font-display text-2xl sm:text-3xl font-bold">
            {cms.text('how_it_works', 'heading', 'How it works')}
          </h2>
          <p className="text-sm text-ink-muted mt-1 mb-6 max-w-2xl">
            {cms.text('how_it_works', 'subcopy',
              'One marketplace, three sides — buyers bid on verified lots, sellers get fair price discovery, and our field team stands behind every catalogue entry.')}
          </p>
          <div className="grid lg:grid-cols-3 gap-4">
            {tracks.map((track) => (
              <div key={track.title} className="card p-5">
                <div className={cx('text-xs font-bold uppercase tracking-wider',
                  { ember: 'text-ember', steel: 'text-steel', success: 'text-success' }[track.tone])}>
                  {track.title}
                </div>
                <div className="font-display font-bold text-lg mt-1 mb-4">{track.sub}</div>
                <ol className="space-y-4">
                  {track.steps.map((s, i) => {
                    const Icon = TRACK_ICONS[s.icon] ?? ListChecks
                    return (
                      <li key={s.label} className="flex gap-3">
                        <span className={cx('num size-8 rounded-xl grid place-items-center shrink-0 font-bold text-sm',
                          { ember: 'bg-ember-soft text-ember-strong', steel: 'bg-steel-soft text-steel-strong', success: 'bg-success-soft text-success' }[track.tone])}>
                          {i + 1}
                        </span>
                        <span>
                          <span className="flex items-center gap-1.5 font-semibold text-sm text-ink"><Icon size={18} /> {s.label}</span>
                          <span className="block text-xs text-ink-muted mt-0.5 leading-relaxed">{s.body}</span>
                        </span>
                      </li>
                    )
                  })}
                </ol>
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-faint mt-3">
            {cms.text('how_it_works', 'footnote',
              'Quantities shown across the marketplace are indicative — final quantity settles on weighment at lifting.')}
          </p>
        </section>
      )}

      {/* ------------------------------ Trust band ---------------------------- */}
      {cms.on('trust_band') && (
        <section className="card p-8 sm:p-10 bg-surface">
          <div className="grid sm:grid-cols-3 gap-8 text-center sm:text-left">
            <div>
              <div className="num font-display text-4xl sm:text-5xl font-bold text-ember">12,400+</div>
              <div className="text-sm text-ink-muted mt-1">
                {cms.text('trust_band', 'stat_lots_label', 'lots sold on ferroBid')}
              </div>
            </div>
            <div>
              <div className="num font-display text-4xl sm:text-5xl font-bold text-ember">240</div>
              <div className="text-sm text-ink-muted mt-1">
                {cms.text('trust_band', 'stat_yards_label', 'verified seller yards')}
              </div>
            </div>
            <div>
              <div className="num font-display text-4xl sm:text-5xl font-bold text-ember">3,800</div>
              <div className="text-sm text-ink-muted mt-1">
                {cms.text('trust_band', 'stat_buyers_label', 'registered buyers')}
              </div>
            </div>
          </div>
          {cms.on('trust_footer') && (
            <div className="mt-8 pt-6 border-t border-line flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 font-semibold">
                <span className="size-9 rounded-xl bg-success-soft text-success grid place-items-center"><ShieldCheck size={18} /></span>
                {cms.text('trust_footer', 'line', 'Every lot physically inspected & catalogued by our field team before it goes live.')}
              </div>
              <Button variant="secondary" onClick={() => nav(trustCta.to)}>{trustCta.label}</Button>
            </div>
          )}
        </section>
      )}

      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title="Share your experience">
        <div className="p-5 sm:p-6 space-y-4">
          <p className="text-sm text-ink-muted">
            Tell other {role === 'buyer' ? 'buyers' : 'sellers'} what working with ferroBid has been like. A moderator
            reads every submission before it goes public — your name and firm will show alongside it once approved.
          </p>
          <Field label="Your experience">
            <Textarea value={shareQuote} onChange={(e) => setShareQuote(e.target.value)} rows={4}
              placeholder="What made the difference for you — the inspection, the price discovery, the settlement…?" />
          </Field>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setShareOpen(false)}>Cancel</Button>
            <Button disabled={shareQuote.trim().length < 20 || shareBusy} loading={shareBusy} onClick={submitShare}>
              Submit for review
            </Button>
          </div>
        </div>
      </Modal>
    </Page>
  )
}
