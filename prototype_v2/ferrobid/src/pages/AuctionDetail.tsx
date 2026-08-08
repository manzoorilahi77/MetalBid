/* ---------------------------------------------------------------------------
   Auction (Catalogue) Detail — modelled on the metaljunction catalogue IA:
   header facts strip, lots annexure with filters + shortlist + scoped EMD,
   T&C (versioned, gates bidding), inspection & contacts, documents.
--------------------------------------------------------------------------- */
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle, CalendarDays, Check, Download, FileText, Gavel, Lock, MapPin,
  Phone, QrCode, ScrollText, Search, Star, X,
} from 'lucide-react'
import { Page } from '../layout/Chrome'
import {
  Button, Chip, Countdown, EmptyState, Input, Modal, PhotoThumb,
  Select, StatusChip, Tabs, Toggle, cx,
} from '../components/ui'
import { catalogueUiStatus, selectionSummary, useStore } from '../store/store'
import { fmtDate, fmtDateTime, inr, inrCompact, inrWords, num } from '../lib/format'
import { useNow } from '../lib/useTick'
import type { Lot } from '../types'

type TabKey = 'lots' | 'terms' | 'inspection' | 'documents'

const DEFAULT_FILTERS = {
  q: '', metal: 'all', status: 'all', uom: 'all',
  emd: 'all' as 'all' | 'lt50' | '50to2' | 'gt2',
  rate: 'all' as 'all' | 'lt1k' | '1kto50k' | 'gt50k',
  qty: 'all' as 'all' | 'small' | 'medium' | 'large',
  hazardous: false, onlySelected: false,
}
type Filters = typeof DEFAULT_FILTERS

export default function AuctionDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const now = useNow()
  const me = useStore((s) => s.currentUser)
  const role = useStore((s) => s.role)
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const users = useStore((s) => s.users)
  const selections = useStore((s) => s.selections)
  const reports = useStore((s) => s.inspectionReports)
  const termsSets = useStore((s) => s.termsSets)
  const termsAccepted = useStore((s) => s.termsAccepted)
  const acceptTerms = useStore((s) => s.acceptTerms)
  const toggleShortlist = useStore((s) => s.toggleShortlist)
  const fundEmd = useStore((s) => s.fundEmd)
  const pushToast = useStore((s) => s.pushToast)
  const bookSlot = useStore((s) => s.bookInspectionSlot)
  const inspectionSlots = useStore((s) => s.inspectionSlots)
  const announcements = useStore((s) => s.announcements)

  const [tab, setTab] = useState<TabKey>('lots')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [sort, setSort] = useState<'lotNo' | 'rate' | 'emd' | 'qty'>('lotNo')
  const [termsOpen, setTermsOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [slotBooked, setSlotBooked] = useState(false)

  const cat = catalogues.find((c) => c.id === id && c.status !== 'draft')
  if (!cat) {
    return <Page><EmptyState title="Catalogue not found" body="It may have been removed in this demo session." action={<Link to="/browse"><Button variant="secondary">Back to browse</Button></Link>} /></Page>
  }

  const catLots = lots.filter((l) => l.catalogueId === cat.id)
  const seller = users.find((u) => u.id === cat.sellerId)
  const ui = catalogueUiStatus(cat, now, catLots)
  const terms = termsSets.find((t) => t.id === cat.termsSetId)
  const accepted = !!termsAccepted[cat.id]
  const summary = selectionSummary({ selections, lots }, me?.id, cat.id)
  const isBuyer = role === 'buyer'
  const catAnnouncements = announcements.filter((a) => a.catalogueId === cat.id)
  const mySlot = inspectionSlots.find((s) => s.catalogueId === cat.id && s.userId === me?.id)

  const metals = [...new Set(catLots.map((l) => l.metal))]
  const uoms = [...new Set(catLots.map((l) => l.uom))]

  const filtered = useMemo(() => {
    let list = catLots.filter((l) => {
      if (filters.q && !`${l.lotNo} ${l.description} ${l.metal} ${l.grade}`.toLowerCase().includes(filters.q.toLowerCase())) return false
      if (filters.metal !== 'all' && l.metal !== filters.metal) return false
      if (filters.uom !== 'all' && l.uom !== filters.uom) return false
      if (filters.status !== 'all' && l.status !== filters.status) return false
      if (filters.hazardous && !l.hazardous) return false
      if (filters.emd === 'lt50' && l.preBidEmd >= 50_000) return false
      if (filters.emd === '50to2' && (l.preBidEmd < 50_000 || l.preBidEmd > 200_000)) return false
      if (filters.emd === 'gt2' && l.preBidEmd <= 200_000) return false
      if (filters.rate === 'lt1k' && l.startRate >= 1000) return false
      if (filters.rate === '1kto50k' && (l.startRate < 1000 || l.startRate > 50_000)) return false
      if (filters.rate === 'gt50k' && l.startRate <= 50_000) return false
      const qtyBand = l.uom === 'KG' ? l.indicativeQty / 1000 : l.indicativeQty
      if (filters.qty === 'small' && qtyBand >= 25) return false
      if (filters.qty === 'medium' && (qtyBand < 25 || qtyBand > 100)) return false
      if (filters.qty === 'large' && qtyBand <= 100) return false
      if (filters.onlySelected && !summary.lotIds.includes(l.id)) return false
      return true
    })
    const key: Record<typeof sort, (l: Lot) => number | string> = {
      lotNo: (l) => l.lotNo, rate: (l) => l.startRate, emd: (l) => l.preBidEmd, qty: (l) => l.indicativeQty,
    }
    list = [...list].sort((a, b) => {
      const ka = key[sort](a), kb = key[sort](b)
      return ka < kb ? -1 : ka > kb ? 1 : 0
    })
    return list
  }, [catLots, filters, sort, summary.lotIds])

  const dirty = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS)
  const canBid = ui === 'live' || ui === 'closing'

  const factCls = 'py-3 px-4 border-l border-line first:border-l-0 min-w-40'
  const factLabel = 'text-[11px] font-bold uppercase tracking-wider text-ink-faint'
  const factVal = 'text-sm font-semibold text-ink mt-0.5'

  return (
    <>
      <Page className="pb-32">
        {/* ------------------------------ header ------------------------------ */}
        <nav className="text-xs text-ink-faint mb-2 flex items-center gap-1.5">
          <Link to="/" className="hover:text-ink">Home</Link><span>/</span>
          <Link to="/browse" className="hover:text-ink">Browse</Link><span>/</span>
          <span className="text-ink-muted num">{cat.code}</span>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <StatusChip status={ui} />
              <span className="num text-sm font-bold text-ink-muted">{cat.code}</span>
              {cat.type === 'forward' && <Chip tone="neutral">Forward e-auction</Chip>}
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold mt-2">{cat.title}</h1>
            <p className="text-sm text-ink-muted mt-2">{cat.description}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {canBid && <Countdown endsAt={cat.endsAt} prefix="closes in" size="lg" />}
            {ui === 'upcoming' && <Chip tone="steel" className="h-8 px-3 text-sm num">Starts {fmtDateTime(cat.startsAt)}</Chip>}
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => pushToast({ kind: 'info', title: 'Catalogue PDF downloading', body: `${cat.code} Catalogue & Annexure.pdf (demo)` })}>
                <Download size={14} /> Catalogue PDF
              </Button>
              {accepted
                ? <Chip tone="success" className="h-8 px-3"><Check size={12} /> T&C accepted · {termsAccepted[cat.id]}</Chip>
                : <Button variant="steel" size="sm" onClick={() => setTermsOpen(true)}><ScrollText size={14} /> Accept Terms & Conditions</Button>}
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
        <div className="card mt-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 overflow-hidden">
          <div className={factCls}>
            <div className={factLabel}>Seller / principal</div>
            <div className={factVal}>{seller?.firm}</div>
          </div>
          <div className={factCls}>
            <div className={factLabel}>E-auction date & time</div>
            <div className={cx(factVal, 'num')}>{fmtDateTime(cat.startsAt)} → {fmtDateTime(cat.endsAt)}</div>
          </div>
          <div className={factCls}>
            <div className={factLabel}>Inspection window</div>
            <div className={cx(factVal, 'num')}>{fmtDate(cat.inspectionFrom)} – {fmtDate(cat.inspectionTo)}</div>
            <div className="text-xs text-ink-muted num">{cat.inspectionHours}</div>
          </div>
          <div className={factCls}>
            <div className={factLabel}>Material location</div>
            <div className={factVal}>{cat.yardName}</div>
            <div className="text-xs text-ink-muted">{cat.region}</div>
          </div>
          <div className={factCls}>
            <div className={factLabel}>Bid validity</div>
            <div className={cx(factVal, 'num')}>{cat.bidValidityDays} days</div>
            <div className="text-xs text-ink-muted num">Anti-snipe +{cat.antiSnipeMinutes} min</div>
          </div>
          <div className={cx(factCls, 'bg-ember-soft/40')}>
            <div className={factLabel}>Your selection EMD</div>
            <div className={cx(factVal, 'num')}>{summary.count > 0 ? `${inrCompact(summary.funded)} / ${inrCompact(summary.required)}` : '—'}</div>
            <div className="text-xs text-ink-muted num">{summary.count} lot{summary.count === 1 ? '' : 's'} shortlisted</div>
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

            {/* filter bar */}
            <div className="card p-3 flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
                <Input className="h-9 w-48 pl-8 text-[13px]" placeholder="Lot no / description…" value={filters.q}
                  onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
              </div>
              <Select className="h-9 w-32 text-[13px]" value={filters.metal} onChange={(e) => setFilters({ ...filters, metal: e.target.value })}>
                <option value="all">Metal: all</option>
                {metals.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
              <Select className="h-9 w-30 text-[13px]" value={filters.uom} onChange={(e) => setFilters({ ...filters, uom: e.target.value })}>
                <option value="all">UOM: all</option>
                {uoms.map((u) => <option key={u} value={u}>{u}</option>)}
              </Select>
              <Select className="h-9 w-36 text-[13px]" value={filters.emd} onChange={(e) => setFilters({ ...filters, emd: e.target.value as Filters['emd'] })}>
                <option value="all">EMD: any</option>
                <option value="lt50">Below ₹50k</option>
                <option value="50to2">₹50k – ₹2L</option>
                <option value="gt2">Above ₹2L</option>
              </Select>
              <Select className="h-9 w-38 text-[13px]" value={filters.rate} onChange={(e) => setFilters({ ...filters, rate: e.target.value as Filters['rate'] })}>
                <option value="all">Start rate: any</option>
                <option value="lt1k">Below ₹1,000</option>
                <option value="1kto50k">₹1k – ₹50k</option>
                <option value="gt50k">Above ₹50k</option>
              </Select>
              <Select className="h-9 w-32 text-[13px]" value={filters.qty} onChange={(e) => setFilters({ ...filters, qty: e.target.value as Filters['qty'] })}>
                <option value="all">Qty: any</option>
                <option value="small">Small (&lt;25 MT)</option>
                <option value="medium">25–100 MT</option>
                <option value="large">Large (&gt;100 MT)</option>
              </Select>
              <Select className="h-9 w-32 text-[13px]" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                <option value="all">Status: all</option>
                {['live', 'sold', 'sta', 'unsold', 'approved'].map((st) => <option key={st} value={st}>{st.toUpperCase()}</option>)}
              </Select>
              <label className="flex items-center gap-1.5 text-[13px] font-medium text-ink-muted cursor-pointer select-none">
                <input type="checkbox" checked={filters.hazardous} onChange={(e) => setFilters({ ...filters, hazardous: e.target.checked })} className="accent-[#E4572E]" />
                Hazardous only
              </label>
              <div className="ml-auto flex items-center gap-2">
                <Select className="h-9 w-36 text-[13px]" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                  <option value="lotNo">Sort: lot no</option>
                  <option value="rate">Sort: start rate</option>
                  <option value="emd">Sort: EMD</option>
                  <option value="qty">Sort: quantity</option>
                </Select>
                {dirty && (
                  <button className="text-[13px] font-semibold text-steel hover:underline inline-flex items-center gap-1"
                    onClick={() => setFilters(DEFAULT_FILTERS)}><X size={13} /> Clear all</button>
                )}
              </div>
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
                      {/* shortlist + identity */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {isBuyer && (
                          <button
                            aria-label={selected ? 'Remove from shortlist' : 'Add to shortlist'}
                            onClick={() => toggleShortlist(cat.id, lot.id)}
                            className={cx('mt-0.5 size-9 rounded-xl border grid place-items-center shrink-0 transition-colors',
                              selected ? 'bg-ember text-white border-ember' : 'border-line-strong text-ink-faint hover:text-ember hover:border-ember/50')}>
                            <Star size={16} fill={selected ? 'currentColor' : 'none'} />
                          </button>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="num font-bold">{lot.lotNo}</span>
                            <Chip tone="steel">{lot.metal}</Chip>
                            <Chip tone="neutral">{lot.grade}</Chip>
                            {lot.hazardous && <Chip tone="warning">Hazardous</Chip>}
                            <StatusChip status={lot.status} />
                            {lot.extensions > 0 && <Chip tone="warning" className="num">+{lot.extensions} ext</Chip>}
                          </div>
                          <p className="text-sm text-ink-muted mt-1 line-clamp-2">{lot.description}
                            <span className="text-ink-faint"> · As-is-where-is.</span>
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
                        {/* live rate + increment stay inside the bidding room — showing them here lets buyers self-select out before entering */}
                        {lot.status !== 'live' && (
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
                      {/* CTA */}
                      {canBid && lot.status === 'live' && (
                        <div className="flex lg:flex-col gap-2 items-stretch shrink-0">
                          <Countdown endsAt={lot.endsAt} size="sm" className="justify-center" />
                          <Button size="sm"
                            onClick={() => {
                              if (!accepted) { setTermsOpen(true); return }
                              nav(`/bidding/${cat.id}?lot=${lot.id}`)
                            }}>
                            <Gavel size={14} /> Bid
                          </Button>
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
            {!accepted && <Button onClick={() => setTermsOpen(true)}><ScrollText size={15} /> Accept Terms & Conditions</Button>}
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
                <div className="card bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink-muted mt-3 border-0">
                  Maximum <b className="text-ink">2 persons per firm</b>. Carry photo ID matching the gate-pass booking. Safety shoes and helmet mandatory inside the yard.
                </div>
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

      {/* --------------------- sticky selection action bar ---------------------- */}
      {isBuyer && summary.count > 0 && canBid && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-line bg-surface/95 backdrop-blur shadow-[0_-8px_30px_-16px_rgb(0_0_0/0.3)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="num text-sm">
              <b>{summary.count}</b> lot{summary.count === 1 ? '' : 's'} selected
              <span className="text-ink-faint"> · </span>Pre-bid EMD <b>{inr(summary.required)}</b>
              <span className="text-ink-faint"> · </span>Funded <b className="text-success">{inr(summary.funded)}</b>
              <span className="text-ink-faint"> · </span>Shortfall <b className={summary.shortfall > 0 ? 'text-ember-strong' : 'text-success'}>{inr(summary.shortfall)}</b>
            </div>
            {/* one path in: accept T&C → fund every shortlisted lot → enter */}
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              {summary.shortfall > 0 ? (
                <Button variant="steel" onClick={() => {
                  if (!accepted) { setTermsOpen(true); return }
                  setPayOpen(true)
                }}>
                  <Lock size={15} /> Fund {inr(summary.shortfall)} EMD to enter
                </Button>
              ) : (
                <Button onClick={() => {
                  if (!accepted) { setTermsOpen(true); return }
                  nav(`/bidding/${cat.id}`)
                }}>
                  <Gavel size={15} /> Enter bidding room
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------- modals -------------------------------- */}
      <TermsGateModal open={termsOpen} onClose={() => setTermsOpen(false)} catalogueId={cat.id} onAccept={() => {
        acceptTerms(cat.id)
        setTermsOpen(false)
        pushToast({ kind: 'success', title: 'Terms accepted', body: `${terms?.name} ${terms?.version} — you can now bid on ${cat.code}.` })
      }} />
      <FundEmdModal open={payOpen} onClose={() => setPayOpen(false)} catalogueId={cat.id}
        lotIds={summary.unfundedLotIds} amount={summary.shortfall}
        onDone={(method) => {
          const ok = fundEmd(cat.id, summary.unfundedLotIds, method)
          if (ok) pushToast({ kind: 'success', title: 'EMD funded', body: `${inr(summary.shortfall)} locked for ${summary.unfundedLotIds.length} lot(s).` })
          else pushToast({ kind: 'danger', title: 'Insufficient wallet balance', body: 'Top up your wallet, then fund EMD again.' })
        }} />
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

/* --------------------------- fund EMD modal -------------------------------- */
function FundEmdModal({ open, onClose, lotIds, amount, onDone, catalogueId }: {
  open: boolean; onClose: () => void; lotIds: string[]; amount: number
  catalogueId: string; onDone: (method: string) => void
}) {
  const lots = useStore((s) => s.lots)
  const wallets = useStore((s) => s.wallets)
  const me = useStore((s) => s.currentUser)
  const wallet = wallets.find((w) => w.userId === me?.id)
  const selLots = lots.filter((l) => l.catalogueId === catalogueId && lotIds.includes(l.id))
  const enough = (wallet?.balance ?? 0) >= amount
  const [phase, setPhase] = useState<'review' | 'processing'>('review')
  return (
    <Modal open={open} onClose={() => { setPhase('review'); onClose() }} title="Fund EMD for selected lots">
      {phase === 'review' ? (
        <div className="space-y-4">
          <div className="card bg-surface-2 border-0 divide-y divide-line">
            {selLots.map((l) => (
              <div key={l.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span><b className="num">{l.lotNo}</b> <span className="text-ink-muted">{l.grade}</span></span>
                <span className="num font-semibold">{inr(l.preBidEmd)}</span>
              </div>
            ))}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold">EMD to lock now</span>
                <span className="num text-lg font-bold text-ember-strong">{inr(amount)}</span>
              </div>
              <div className="text-xs text-ink-muted mt-1 text-right italic">{inrWords(amount)}</div>
            </div>
          </div>
          <p className="text-xs text-ink-muted">
            EMD locks only against your <b>selected</b> lots — never the full catalogue. Funds move from your wallet balance ({wallet ? inr(wallet.balance) : '₹0'}) into the locked EMD pool and auto-release within 24h if you're not H1.
          </p>
          {!enough && <div className="card border-danger/40 bg-danger-soft px-4 py-2.5 text-sm text-danger font-semibold">Wallet balance is short. Top up from Wallet & EMD ledger first.</div>}
          <Button className="w-full" size="lg" disabled={!enough}
            onClick={() => {
              setPhase('processing')
              setTimeout(() => { onDone('Wallet'); setPhase('review'); onClose() }, 1300)
            }}>
            Lock {inr(amount)} from wallet
          </Button>
        </div>
      ) : (
        <div className="py-10 text-center">
          <div className="mx-auto size-9 border-[3px] border-ember border-t-transparent rounded-full animate-spin" />
          <div className="font-semibold mt-3">Locking EMD…</div>
        </div>
      )}
    </Modal>
  )
}
