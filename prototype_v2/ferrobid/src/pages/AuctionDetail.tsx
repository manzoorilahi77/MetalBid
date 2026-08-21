/* ---------------------------------------------------------------------------
   Auction (Catalogue) Detail — modelled on the metaljunction catalogue IA:
   header facts strip, lots annexure with filters + shortlist + scoped EMD,
   T&C (versioned, gates bidding), inspection & contacts, documents.
--------------------------------------------------------------------------- */
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, CalendarDays, Check, Download, FileText, Lock, MapPin,
  Phone, QrCode, ScrollText, Star,
} from 'lucide-react'
import { Page } from '../layout/Chrome'
import {
  Button, Chip, Countdown, EmptyState, Modal, PhotoThumb,
  StatusChip, Tabs, Toggle, cx,
} from '../components/ui'
import { useGuestGate } from '../components/GuestGate'
import { useCmsPage } from '../api/useCmsPage'
import { ROLE_HOME, catalogueUiStatus, isCatalogueEmdLocked, selectionSummary, useStore } from '../store/store'
import { emdDeadlineMs, emdOpensAtMs, emdWindowClosed, emdWindowNotOpen } from '../lib/emd'
import { fmtDate, fmtDateTime, inr, inrCompact, num, relTime } from '../lib/format'
import { useNow } from '../lib/useTick'

type TabKey = 'lots' | 'terms' | 'inspection' | 'documents'

const DEFAULT_FILTERS = { onlySelected: false }
type Filters = typeof DEFAULT_FILTERS

export default function AuctionDetail() {
  const { id } = useParams()
  const now = useNow()
  const cms = useCmsPage('/catalogue')
  const me = useStore((s) => s.currentUser)
  const role = useStore((s) => s.role)
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const users = useStore((s) => s.users)
  const selections = useStore((s) => s.selections)
  const watchlist = useStore((s) => s.watchlist)
  const reports = useStore((s) => s.inspectionReports)
  const termsSets = useStore((s) => s.termsSets)
  const termsAccepted = useStore((s) => s.termsAccepted)
  const acceptTerms = useStore((s) => s.acceptTerms)
  const toggleWatchlist = useStore((s) => s.toggleWatchlist)
  const pushToast = useStore((s) => s.pushToast)
  const bookSlot = useStore((s) => s.bookInspectionSlot)
  const inspectionSlots = useStore((s) => s.inspectionSlots)
  const announcements = useStore((s) => s.announcements)
  const guest = useGuestGate()

  const [tab, setTab] = useState<TabKey>('lots')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [termsOpen, setTermsOpen] = useState(false)
  const [slotBooked, setSlotBooked] = useState(false)
  const [unshortlistConfirm, setUnshortlistConfirm] = useState(false)

  // Buyers browse their own faceted grid at /buyermarketplace, not the
  // guest-facing /browse — sending a signed-in buyer there was landing them
  // on a page outside their own nav entirely. A "Browse as Guest" visitor is
  // touring that same grid, so they go back to it too.
  const onBuyerGrid = role === 'buyer' || guest.isGuest
  const browseHref = onBuyerGrid ? '/buyermarketplace' : '/browse'
  const browseLabel = role === 'buyer' ? 'Browse & Shortlist' : guest.isGuest ? 'Marketplace' : 'Browse'

  const cat = catalogues.find((c) => c.id === id && c.status !== 'draft')
  if (!cat) {
    return <Page><EmptyState title="Catalogue not found" body="It may have been removed in this demo session." action={<Link to={browseHref}><Button variant="secondary">Back to {browseLabel.toLowerCase()}</Button></Link>} /></Page>
  }

  const catLots = lots.filter((l) => l.catalogueId === cat.id)
  const totalEmd = catLots.reduce((sum, l) => sum + l.preBidEmd, 0)
  const seller = users.find((u) => u.id === cat.sellerId)
  const ui = catalogueUiStatus(cat, now, catLots)
  const terms = termsSets.find((t) => t.id === cat.termsSetId)
  const accepted = !!termsAccepted[cat.id]
  const summary = selectionSummary({ selections, lots }, me?.id, cat.id)
  const isBuyer = role === 'buyer'
  // Watchlist-only, not the isCatalogueShortlisted union with starred lots — this
  // button must be able to turn itself back off on click without also clearing lots.
  const watchlisted = !!me && watchlist.some((w) => w.buyerId === me.id && w.catalogueId === cat.id)
  // EMD already funded, or the funding deadline passed without full funding —
  // both lock the shortlist star read-only (same rule the store's
  // toggleWatchlist enforces), so a missed catalogue can't be quietly
  // unshortlisted away.
  const fundedLocked = watchlisted && isCatalogueEmdLocked({ selections, lots }, me?.id, cat.id)
  const deadlinePassed = emdWindowClosed(cat, now)
  const emdLocked = watchlisted && (fundedLocked || deadlinePassed)
  // EMD hasn't opened yet — same freeze as the deadline case, mirrored from
  // the store's toggleWatchlist guard.
  const notOpen = emdWindowNotOpen(cat, now)
  const catAnnouncements = announcements.filter((a) => a.catalogueId === cat.id)
  const mySlot = inspectionSlots.find((s) => s.catalogueId === cat.id && s.userId === me?.id)

  const filtered = useMemo(() => {
    const list = catLots.filter((l) => !filters.onlySelected || summary.lotIds.includes(l.id))
    return [...list].sort((a, b) => (a.lotNo < b.lotNo ? -1 : a.lotNo > b.lotNo ? 1 : 0))
  }, [catLots, filters, summary.lotIds])

  const canBid = ui === 'live' || ui === 'closing'

  const factCls = 'py-3 px-4 border-l border-line first:border-l-0 min-w-40'
  const factLabel = 'text-[11px] font-bold uppercase tracking-wider text-ink-faint'
  const factVal = 'text-sm font-semibold text-ink mt-0.5'

  return (
    <>
      <Page>
        {/* ------------------------------ header ------------------------------ */}
        <Link to={browseHref} className="inline-block mb-3">
          <Button variant="secondary" size="sm"><ArrowLeft size={15} /> Back to {browseLabel}</Button>
        </Link>
        <nav className="text-xs text-ink-faint mb-2 flex items-center gap-1.5">
          {/* The viewer's OWN home, not "/". `/` is rewritten to the public
              marketing site by Guest1Gate, so this breadcrumb used to drop a
              signed-in buyer out of the app onto a page with no way back. */}
          <Link to={ROLE_HOME[role]} className="hover:text-ink">Home</Link><span>/</span>
          <Link to={browseHref} className="hover:text-ink">{browseLabel}</Link><span>/</span>
          <span className="text-ink-muted num">{cat.code}</span>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <StatusChip status={ui} />
              <span className="num text-sm font-bold text-ember">{cat.code}</span>
              {cat.type === 'forward' ? <Chip tone="neutral">Forward e-auction</Chip> : <Chip tone="steel">Sealed tender</Chip>}
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold mt-2">{cat.title}</h1>
            <p className="text-sm text-ink-muted mt-2">{cat.description}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {(canBid || isBuyer || guest.isGuest) && (
              <div className="flex flex-wrap items-center justify-end gap-3">
                {canBid && <Countdown endsAt={cat.endsAt} prefix="closes in" size="lg" />}
                {/* The guest gets the real button in the real place — pressing
                    it is how the tour explains itself. */}
                {guest.isGuest && (
                  <Button variant="secondary" size="md" onClick={() => guest.block('shortlist')}
                    title="Subscribe to shortlist this catalogue">
                    <Star size={14} /> Add to shortlist
                  </Button>
                )}
                {isBuyer && (
                  <span title={notOpen
                    ? `EMD funding opens ${relTime(new Date(emdOpensAtMs(cat)).toISOString(), now)}`
                    : fundedLocked
                      ? 'EMD funded — this catalogue is read only until it closes'
                      : deadlinePassed
                        ? 'EMD deadline passed — this catalogue is read only'
                        : undefined}>
                    <Button
                      variant={watchlisted ? 'success' : 'secondary'}
                      size="md"
                      disabled={emdLocked || notOpen}
                      onClick={() => watchlisted ? setUnshortlistConfirm(true) : toggleWatchlist(cat.id)}
                      aria-pressed={watchlisted}
                      aria-label={watchlisted ? 'Remove from shortlist' : 'Add to shortlist'}
                    >
                      {emdLocked || notOpen ? <Lock size={14} /> : <Star size={14} fill={watchlisted ? 'currentColor' : 'none'} />}
                      {watchlisted ? 'Shortlisted' : 'Add to shortlist'}
                    </Button>
                  </span>
                )}
              </div>
            )}
            {ui === 'upcoming' && <Chip tone="steel" className="h-8 px-3 text-sm num">Starts {fmtDateTime(cat.startsAt)}</Chip>}
            {/* The cut-off buyers actually have to hit — funding closes well
                before the sale opens (src/lib/emd.ts). */}
            {ui === 'upcoming' && (
              notOpen
                ? <Chip tone="neutral" className="h-8 px-3 text-sm num">EMD opens {fmtDateTime(new Date(emdOpensAtMs(cat)).toISOString())}</Chip>
                : emdWindowClosed(cat, now)
                  ? <Chip tone="danger" className="h-8 px-3 text-sm num">EMD closed {fmtDateTime(new Date(emdDeadlineMs(cat)).toISOString())}</Chip>
                  : <Chip tone="warning" className="h-8 px-3 text-sm num">Fund EMD by {fmtDateTime(new Date(emdDeadlineMs(cat)).toISOString())}</Chip>
            )}
            {/* wraps on a phone — side by side these two overran the viewport */}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" size="md" onClick={() => pushToast({ kind: 'info', title: 'Catalogue PDF downloading', body: `${cat.code} Catalogue & Annexure.pdf (demo)` })}>
                <Download size={14} /> Catalogue PDF
              </Button>
              {accepted
                ? <Chip tone="success" className="h-10 px-4"><Check size={12} /> T&C accepted · {termsAccepted[cat.id]}</Chip>
                : <Button variant="steel" size="md" onClick={() => { if (guest.block('terms')) return; setTermsOpen(true) }}><ScrollText size={14} /> Accept Terms & Conditions</Button>}
            </div>
          </div>
        </div>

        {catAnnouncements.length > 0 && (
          <div className="mt-4 space-y-2">
            {catAnnouncements.map((a) => (
              <div key={a.id} className={cx('card px-4 py-2.5 flex items-start gap-2.5 text-sm border-l-4',
                a.severity === 'warning' ? 'border-l-warning' : a.severity === 'critical' ? 'border-l-danger' : 'border-l-steel')}>
                <AlertTriangle size={15} className={a.severity === 'warning' ? 'text-warning mt-0.5' : 'text-steel mt-0.5'} />
                <span><span className="font-semibold">{a.title}.</span> <span className="text-ink-muted">{a.body}</span></span>
              </div>
            ))}
          </div>
        )}

        {/* --------------------------- key facts strip -------------------------- */}
        <div className="card mt-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 overflow-hidden">
          <div className={factCls}>
            <div className={factLabel}>Seller / principal</div>
            <div className={factVal}>{seller?.firm}</div>
          </div>
          <div className={factCls}>
            <div className={factLabel}>Inspection window</div>
            <div className={cx(factVal, 'num')}>From: {fmtDate(cat.inspectionFrom)}</div>
            <div className={cx(factVal, 'num')}>Till: {fmtDate(cat.inspectionTo)}</div>
            <div className="text-xs text-ink-muted num">{cat.inspectionHours}</div>
          </div>
          <div className={factCls}>
            <div className={factLabel}>E-auction date & time</div>
            <div className={cx(factVal, 'num')}>{fmtDateTime(cat.startsAt)} → {fmtDateTime(cat.endsAt)}</div>
          </div>
          <div className={factCls}>
            <div className={factLabel}>Material location</div>
            <div className={factVal}>{cat.yardName}</div>
            <div className="text-xs text-ink-muted">{cat.region}</div>
          </div>
          <div className={factCls}>
            <div className={factLabel}>EMD value</div>
            <div className={cx(factVal, 'num')}>{inrCompact(totalEmd)}</div>
          </div>
        </div>

        {/* -------------------------------- tabs -------------------------------- */}
        <Tabs<TabKey>
          className="mt-8"
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'lots', label: 'Lots (annexure)', count: catLots.length },
            { key: 'terms', label: 'Terms & Conditions' },
            { key: 'inspection', label: 'Inspection & Contacts' },
            { key: 'documents', label: 'Documents', count: cat.documents.length },
          ]}
        />

        {/* ------------------------------ lots tab ------------------------------ */}
        {tab === 'lots' && (
          <div className="mt-5">
            <div className="card px-3 py-2.5 flex items-center gap-2 text-sm bg-warning-soft/60 border-warning/30 text-warning font-medium mb-4">
              <AlertTriangle size={15} /> Quantity is indicative — final quantity and payment are determined on weighment. Material sells as-is-where-is after inspection.
            </div>

            {/* "my lots" toggle */}
            {isBuyer && summary.count > 0 && (
              <div className="mt-3 flex items-center justify-between card px-4 py-2.5 bg-ember-soft/30 border-ember/20">
                <Toggle checked={filters.onlySelected} onChange={(v) => setFilters({ ...filters, onlySelected: v })}
                  label={`Show only my selected lots (${summary.count})`} />
                <span className="num text-[13px] text-ink-muted hidden sm:block">
                  Funded {summary.fundedLotIds.length}/{summary.count} · Shortfall <b className="text-ember-strong">{inr(summary.shortfall)}</b>
                </span>
              </div>
            )}

            {/* lot list */}
            <div className="mt-4 space-y-3">
              {filtered.length === 0 && <EmptyState title="No lots match these filters" action={<Button variant="secondary" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>Clear all filters</Button>} />}
              {filtered.map((lot) => {
                const selected = summary.lotIds.includes(lot.id)
                const funded = summary.fundedLotIds.includes(lot.id)
                const rep = reports.find((r) => r.id === lot.inspectionReportId)
                return (
                  <article key={lot.id} className={cx('card p-4 transition-colors', selected && 'border-ember/40 bg-ember-soft/20')}>
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      {/* identity — lots are view-only here; shortlisting and EMD
                          funding happen on the dedicated EMD & payments page. */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="num font-bold">{lot.lotNo}</span>
                            <Chip tone="steel">{lot.metal}</Chip>
                            <Chip tone="neutral">{lot.grade}</Chip>
                            {lot.hazardous && <Chip tone="warning">Hazardous</Chip>}
                            <StatusChip status={lot.status} />
                            {lot.extensions > 0 && <Chip tone="warning" className="num">+{lot.extensions} ext</Chip>}
                          </div>
                          <p className="text-sm font-semibold text-ink mt-1 line-clamp-2">{lot.description}
                            <span className="font-normal text-ink-faint"> · As-is-where-is.</span>
                          </p>
                          {rep && (
                            <p className="text-xs mt-1.5 text-ink-muted">
                              <span className="font-semibold text-success">Inspected:</span>{' '}
                              measured <span className="num font-semibold text-ink">{num(rep.measuredQty)} {rep.uom}</span> · condition {rep.condition} · <span className="italic">{rep.notes}</span>
                            </p>
                          )}
                          <div className="flex gap-1.5 mt-2">
                            {lot.photos.map((p) => <PhotoThumb key={p.id} hue={p.hue} category={lot.category} label={p.label} className="w-14 h-10" />)}
                          </div>
                        </div>
                      </div>
                      {/* numbers */}
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-5 gap-y-2 lg:text-right shrink-0">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Indicative qty</div>
                          <div className="num text-sm font-bold">{num(lot.indicativeQty)} {lot.uom}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Start rate</div>
                          <div className="num text-sm font-bold">{inr(lot.startRate)}<span className="text-ink-faint font-medium">/{lot.uom}</span></div>
                        </div>
                        {/* live rate + increment stay inside the bidding room — showing them here lets
                            buyers self-select out before entering. Tender lots hide this column
                            entirely — no live price/H1 language anywhere on a sealed-bid lot. */}
                        {cat.type !== 'tender' && lot.status !== 'live' && (
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Result (H1)</div>
                            <div className={cx('num text-sm font-bold', lot.currentRate ? 'text-ember-strong' : 'text-ink-faint')}>
                              {lot.currentRate ? inr(lot.currentRate) : '—'}
                            </div>
                          </div>
                        )}
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Pre-bid EMD</div>
                          <div className="num text-sm font-bold">{inr(lot.preBidEmd)}</div>
                          {isBuyer && selected && (funded
                            ? <Chip tone="success" className="mt-1">EMD funded</Chip>
                            : <Chip tone="warning" className="mt-1">EMD pending</Chip>)}
                        </div>
                      </div>
                      {/* No bid entry here — bidding happens in the bidding room,
                          a separate page. This is view + fund-EMD only. */}
                      {canBid && lot.status === 'live' && (
                        <div className="flex lg:flex-col gap-2 items-stretch shrink-0">
                          <Countdown endsAt={lot.endsAt} size="sm" className="justify-center" />
                          {isBuyer && selected && !funded && (
                            <Link to={`/buyer/shortlist/${cat.id}`}>
                              <Button size="sm" variant="steel"><Lock size={14} /> Fund EMD</Button>
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        )}

        {/* ------------------------------ terms tab ------------------------------ */}
        {tab === 'terms' && terms && (
          <div className="mt-6 max-w-3xl space-y-6">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{terms.name}</h2>
              <Chip tone="steel" className="num">{terms.version}</Chip>
              {accepted && <Chip tone="success"><Check size={12} /> Accepted this session</Chip>}
            </div>
            <div className="card px-4 py-3 text-sm bg-warning-soft/60 border-warning/30 text-warning font-medium">
              Precedence: lot-specific conditions → special conditions → general conditions. {terms.lotSpecificNote}
            </div>
            <section>
              <h3 className="font-bold mb-2">General conditions</h3>
              <ol className="space-y-2 text-sm text-ink-muted list-decimal pl-5 marker:text-ink-faint marker:font-semibold">
                {terms.general.map((g, i) => <li key={i}>{g}</li>)}
              </ol>
            </section>
            <section>
              <h3 className="font-bold mb-2">Special conditions</h3>
              <ol className="space-y-2 text-sm text-ink-muted list-decimal pl-5 marker:text-ink-faint marker:font-semibold">
                {terms.special.map((g, i) => <li key={i}>{g}</li>)}
              </ol>
            </section>
            {!accepted && <Button onClick={() => { if (guest.block('terms')) return; setTermsOpen(true) }}><ScrollText size={15} /> Accept Terms & Conditions</Button>}
          </div>
        )}

        {/* --------------------------- inspection tab ---------------------------- */}
        {tab === 'inspection' && (
          <div className="mt-6 grid lg:grid-cols-2 gap-5">
            <div className="space-y-5">
              <div className="card p-5">
                <h3 className="font-bold flex items-center gap-2"><CalendarDays size={17} className="text-ember" /> Inspection window</h3>
                <div className="num text-lg font-bold mt-2">{fmtDate(cat.inspectionFrom)} → {fmtDate(cat.inspectionTo)}</div>
                <div className="text-sm text-ink-muted num">{cat.inspectionHours}, working days</div>
                {cms.on('inspection_help') && (
                  <div className="card bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink-muted mt-3 border-0">
                    Maximum <b className="text-ink">2 persons per firm</b>. Carry photo ID matching the gate-pass booking. Safety shoes and helmet mandatory inside the yard.
                  </div>
                )}
                {mySlot || slotBooked ? (
                  <div className="mt-4 card border-success/40 bg-success-soft/50 p-4 flex items-center gap-4">
                    <QrCode size={44} className="text-success shrink-0" />
                    <div>
                      <div className="font-bold text-success">Visit booked — gate pass issued</div>
                      <div className="text-sm text-ink-muted num mt-0.5">
                        {mySlot ? `${fmtDate(mySlot.date)} · ${mySlot.window} · ${mySlot.persons} person(s)` : 'Confirmed'}
                        {mySlot && <> · Pass <b className="text-ink">{mySlot.passCode}</b></>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <Button className="mt-4" variant="steel"
                    onClick={() => {
                      if (guest.block('inspection')) return
                      if (!me) { pushToast({ kind: 'warning', title: 'Sign in to book an inspection visit' }); return }
                      bookSlot(cat.id, new Date(now + 86400_000).toISOString(), '10:00–13:00 IST', 2)
                      setSlotBooked(true)
                      pushToast({ kind: 'success', title: 'Inspection slot booked', body: 'Gate pass QR generated — show it at the yard gate.' })
                    }}>
                    Book inspection slot
                  </Button>
                )}
              </div>
              <div className="card p-5">
                <h3 className="font-bold flex items-center gap-2"><Phone size={16} className="text-ember" /> Contact persons</h3>
                <div className="mt-3 space-y-3 text-sm">
                  <div className="flex justify-between gap-3 flex-wrap">
                    <div>
                      <div className="font-semibold">{cat.inspectionContact.name}</div>
                      <div className="text-xs text-ink-muted">{cat.inspectionContact.role}</div>
                    </div>
                    <a href={`tel:${cat.inspectionContact.phone}`} className="num text-steel font-semibold">{cat.inspectionContact.phone}</a>
                  </div>
                  <div className="flex justify-between gap-3 flex-wrap border-t border-line pt-3">
                    <div>
                      <div className="font-semibold">ferroBid buyer desk</div>
                      <div className="text-xs text-ink-muted">Payment, delivery order & confirmation</div>
                    </div>
                    <a href="tel:+911800419000" className="num text-steel font-semibold">1800-419-000</a>
                  </div>
                </div>
              </div>
            </div>
            <div className="card p-5">
              <h3 className="font-bold flex items-center gap-2"><MapPin size={17} className="text-ember" /> Yard address</h3>
              <p className="text-sm text-ink-muted mt-2">{cat.yardAddress}</p>
              <div className="mt-4 h-64 rounded-xl border border-line relative overflow-hidden"
                style={{ background: 'repeating-linear-gradient(0deg, var(--surface-2) 0 1px, transparent 1px 28px), repeating-linear-gradient(90deg, var(--surface-2) 0 1px, var(--surface) 1px 28px)' }}>
                <div className="absolute inset-0 grid place-items-center">
                  <div className="flex flex-col items-center gap-1.5 text-ink-faint">
                    <MapPin size={30} className="text-ember" />
                    <span className="text-xs font-semibold">{cat.yardName} · {cat.region}</span>
                    <span className="text-[11px]">Map preview (demo)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------- documents tab ---------------------------- */}
        {tab === 'documents' && (
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl">
            {cat.documents.map((d) => (
              <button key={d.id} className="card card-hover p-4 flex items-center gap-3 text-left"
                onClick={() => pushToast({ kind: 'info', title: 'Downloading', body: `${d.name} (demo)` })}>
                <span className="size-10 rounded-xl bg-steel-soft text-steel grid place-items-center shrink-0"><FileText size={18} /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold truncate">{d.name}</span>
                  <span className="block text-xs text-ink-faint uppercase num">{d.type} · {d.size}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Page>

      {/* ------------------------------- modals -------------------------------- */}
      <TermsGateModal open={termsOpen} onClose={() => setTermsOpen(false)} catalogueId={cat.id} onAccept={() => {
        acceptTerms(cat.id)
        setTermsOpen(false)
        pushToast({ kind: 'success', title: 'Terms accepted', body: `${terms?.name} ${terms?.version} — you can now bid on ${cat.code}.` })
      }} />

      <Modal open={unshortlistConfirm} onClose={() => setUnshortlistConfirm(false)} title="Remove from shortlist?">
        <p className="text-sm text-ink-muted">
          {cat.code} will no longer show as shortlisted. Any lots you've starred in this catalogue stay shortlisted separately.
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={() => setUnshortlistConfirm(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => {
            toggleWatchlist(cat.id)
            setUnshortlistConfirm(false)
            pushToast({ kind: 'info', title: 'Removed from shortlist', body: cat.code })
          }}>
            Remove
          </Button>
        </div>
      </Modal>
    </>
  )
}

/* --------------------------- terms gate modal ------------------------------ */
function TermsGateModal({ open, onClose, catalogueId, onAccept }: {
  open: boolean; onClose: () => void; catalogueId: string; onAccept: () => void
}) {
  const catalogues = useStore((s) => s.catalogues)
  const termsSets = useStore((s) => s.termsSets)
  const [agree, setAgree] = useState(false)
  const cat = catalogues.find((c) => c.id === catalogueId)
  const terms = termsSets.find((t) => t.id === cat?.termsSetId)
  if (!terms) return null
  return (
    <Modal open={open} onClose={onClose} title={<span>Terms & Conditions <Chip tone="steel" className="num ml-1">{terms.version}</Chip></span>} wide>
      <div className="max-h-72 overflow-y-auto card bg-surface-2 border-0 p-4 space-y-3 text-sm text-ink-muted">
        <div className="font-bold text-ink">{terms.name}</div>
        <ol className="list-decimal pl-5 space-y-1.5">
          {terms.general.map((g, i) => <li key={i}>{g}</li>)}
        </ol>
        <div className="font-bold text-ink pt-1">Special conditions</div>
        <ol className="list-decimal pl-5 space-y-1.5">
          {terms.special.map((g, i) => <li key={i}>{g}</li>)}
        </ol>
        <p className="text-xs italic">{terms.lotSpecificNote}</p>
      </div>
      <label className="flex items-start gap-2.5 mt-4 text-sm cursor-pointer select-none">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 accent-[#E4572E]" />
        <span>I have read and accept these terms ({terms.version}) on behalf of my firm, including the as-is-where-is sale basis and EMD forfeiture conditions. Bidding is gated on this acceptance.</span>
      </label>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="ghost" onClick={onClose}>Not now</Button>
        <Button disabled={!agree} onClick={onAccept}><Check size={15} /> Accept & continue</Button>
      </div>
    </Modal>
  )
}
