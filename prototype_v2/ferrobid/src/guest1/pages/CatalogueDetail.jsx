/* Guest-only catalogue detail (#/home/catalogue/:id) — deliberately mirrors
   the buyer app's AuctionDetail.tsx (same Tailwind UI kit, same layout, same
   tabs) so a visitor sees the identical page a signed-in buyer would, minus
   every action that requires an account: shortlist, EMD funding, T&C
   acceptance, inspection-slot booking, and bidding. Those are replaced by a
   single closing CTA. No role-branching — this page never checks who's
   signed in, it always renders the read-only shell. */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, CalendarDays, Download, FileText, MapPin, Phone,
} from 'lucide-react';
import {
  Button, Chip, Countdown, EmptyState, PhotoThumb, StatusChip, Tabs, cx,
} from '../../components/ui';
import { useStore, catalogueUiStatus } from '../../store/store';
import { emdDeadlineMs, emdWindowClosed } from '../../lib/emd';
import { fmtDate, fmtDateTime, inr, inrCompact, num } from '../../lib/format';
import { useNow } from '../../lib/useTick';

export const CatalogueDetail = () => {
  const { id } = useParams();
  const now = useNow();
  const catalogues = useStore((s) => s.catalogues);
  const lots = useStore((s) => s.lots);
  const users = useStore((s) => s.users);
  const reports = useStore((s) => s.inspectionReports);
  const termsSets = useStore((s) => s.termsSets);
  const announcements = useStore((s) => s.announcements);
  const pushToast = useStore((s) => s.pushToast);

  const [tab, setTab] = useState('lots');

  const cat = catalogues.find((c) => c.id === id && c.status !== 'draft');

  if (!cat) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <EmptyState
          title="Catalogue not found"
          body="This listing may have closed or the link may be out of date."
          action={<Link to="/marketplace"><Button variant="secondary">Back to marketplace</Button></Link>}
        />
      </div>
    );
  }

  const catLots = lots.filter((l) => l.catalogueId === cat.id);
  const seller = users.find((u) => u.id === cat.sellerId);
  const ui = catalogueUiStatus(cat, now, catLots);
  const terms = termsSets.find((t) => t.id === cat.termsSetId);
  const catAnnouncements = announcements.filter((a) => a.catalogueId === cat.id);
  const canBid = ui === 'live' || ui === 'closing';
  const emdFrom = catLots.length ? Math.min(...catLots.map((l) => l.preBidEmd)) : 0;
  const emdTo = catLots.length ? Math.max(...catLots.map((l) => l.preBidEmd)) : 0;
  const sortedLots = [...catLots].sort((a, b) => (a.lotNo < b.lotNo ? -1 : a.lotNo > b.lotNo ? 1 : 0));

  const factCls = 'py-3 px-4 border-l border-line first:border-l-0 min-w-40';
  const factLabel = 'text-[11px] font-bold uppercase tracking-wider text-ink-faint';
  const factVal = 'text-sm font-semibold text-ink mt-0.5';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-16">
      {/* ------------------------------ header ------------------------------ */}
      <nav className="text-xs text-ink-faint mb-2 flex items-center gap-1.5">
        <Link to="/" className="hover:text-ink">Home</Link><span>/</span>
        <Link to="/marketplace" className="hover:text-ink">Marketplace</Link><span>/</span>
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
          {canBid && <Countdown endsAt={cat.endsAt} prefix="closes in" size="lg" />}
          {ui === 'upcoming' && <Chip tone="steel" className="h-8 px-3 text-sm num">Starts {fmtDateTime(cat.startsAt)}</Chip>}
          {ui === 'upcoming' && (
            emdWindowClosed(cat, now)
              ? <Chip tone="danger" className="h-8 px-3 text-sm num">EMD closed {fmtDateTime(new Date(emdDeadlineMs(cat)).toISOString())}</Chip>
              : <Chip tone="warning" className="h-8 px-3 text-sm num">Fund EMD by {fmtDateTime(new Date(emdDeadlineMs(cat)).toISOString())}</Chip>
          )}
          <Button variant="secondary" size="md" onClick={() => pushToast({ kind: 'info', title: 'Catalogue PDF downloading', body: `${cat.code} Catalogue & Annexure.pdf (demo)` })}>
            <Download size={14} /> Catalogue PDF
          </Button>
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
          <div className={factVal}>{seller?.firm ?? 'Verified Seller'}</div>
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
          <div className={factLabel}>Lots in catalogue</div>
          <div className={cx(factVal, 'num')}>{catLots.length} lot{catLots.length === 1 ? '' : 's'}</div>
          <div className="text-xs text-ink-muted num">EMD {inrCompact(emdFrom)}–{inrCompact(emdTo)}</div>
        </div>
      </div>

      {/* -------------------------------- tabs -------------------------------- */}
      <Tabs
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

          <div className="mt-4 space-y-3">
            {sortedLots.map((lot) => {
              const rep = reports.find((r) => r.id === lot.inspectionReportId);
              return (
                <article key={lot.id} className="card p-4">
                  {/* grid, not flex-col/lg:flex-row: guest1's own global CSS defines an
                      unlayered `.flex-col { flex-direction: column }` utility of its own
                      (src/guest1/styles/index.css) which — because it's unlayered — always
                      wins over Tailwind's layered `lg:flex-row` override, permanently
                      pinning this row to a column layout on guest1 routes. grid-cols
                      responsive variants aren't shadowed the same way (guest1 has no
                      colliding `.grid-cols-*` classes), so a grid switch sidesteps it. */}
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
                    <div className="flex items-start gap-3 min-w-0">
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
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-5 gap-y-2 lg:text-right">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Indicative qty</div>
                        <div className="num text-sm font-bold">{num(lot.indicativeQty)} {lot.uom}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Start rate</div>
                        <div className="num text-sm font-bold">{inr(lot.startRate)}<span className="text-ink-faint font-medium">/{lot.uom}</span></div>
                      </div>
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
                      </div>
                    </div>
                    {canBid && lot.status === 'live' && (
                      <div className="flex items-stretch">
                        <Countdown endsAt={lot.endsAt} size="sm" className="justify-center" />
                      </div>
                    )}
                  </div>
                </article>
              );
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
              <div className="mt-4 card border-line bg-surface-2 p-4 text-sm text-ink-muted">
                Contact the inspection team below to arrange a visit — gate-pass booking is available once you create an account.
              </div>
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
                    <div className="font-semibold">ferroBid support desk</div>
                    <div className="text-xs text-ink-muted">General queries about this catalogue</div>
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

      {/* ------------------------------ closing CTA ---------------------------- */}
      <div className="mt-10 card p-6 flex flex-wrap items-center justify-between gap-4 bg-ember-soft/20 border-ember/20">
        <div>
          <h2 className="text-lg font-bold">Ready to bid on this catalogue?</h2>
          <p className="text-sm text-ink-muted mt-1">Create a free account to fund EMD and join the room when it goes live.</p>
        </div>
        <Link to="/pricing">
          <Button size="md">Create an account to bid <ArrowRight size={16} /></Button>
        </Link>
      </div>
    </div>
  );
};

export default CatalogueDetail;
