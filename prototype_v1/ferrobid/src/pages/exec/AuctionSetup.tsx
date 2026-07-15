import { useState } from 'react';
import { CalendarClock, Rocket, Timer, Radio, Layers, Lock, FileText } from 'lucide-react';
import { useApp, catalogueById, eventById } from '../../store';
import { SectionTitle, Card, Btn, Modal, Field, inputCls, Empty, LotImage, Badge, StatusBadge, FileDrop } from '../../components/ui';
import { GatedBtn, ScopeBadge } from '../../components/gate';
import { inr, inrCompact, timeLeft, dateTime, nowStamp, nextId } from '../../utils';

const NEW_EVENT = '__new_event__';
const NEW_CATALOGUE = '__new_catalogue__';

export default function AuctionSetup() {
  const { lots, auctions, auctionEvents, catalogues, createAuction, createEvent, createCatalogue, assignLotToCatalogue, updateCatalogueInfo, updateCatalogueDocs, userName, now } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  const [f, setF] = useState({ startsInMin: '0', increment: '5000', reserve: '', emd: '' });
  const approved = lots.filter((l) => l.status === 'approved');
  const upcoming = auctions.filter((a) => a.status === 'scheduled' || a.status === 'live' || a.status === 'paused').map((a) => ({ a, lot: lots.find((l) => l.id === a.lotId)! }));
  const lot = lots.find((l) => l.id === openId);
  const lotCatalogue = lot?.catalogueId ? catalogueById(catalogues, lot.catalogueId) : undefined;

  const [assignId, setAssignId] = useState<string | null>(null);
  const [af, setAf] = useState({ eventId: '', catalogueId: '', newEventName: '', newEventStarts: '0', newEventEnds: '360', newCatalogueTitle: '', description: '', terms: '', docAdded: false });
  const openEvents = auctionEvents.filter((e) => e.status !== 'closed' && e.status !== 'cancelled');
  const assignLot = lots.find((l) => l.id === assignId);
  const catalogueOptions = catalogues.filter((c) => c.eventId === af.eventId && c.status !== 'closed');
  const selectedCatalogue = af.catalogueId && af.catalogueId !== NEW_CATALOGUE ? catalogueById(catalogues, af.catalogueId) : undefined;

  const startAssign = (id: string) => {
    setAf({ eventId: openEvents[0]?.id ?? NEW_EVENT, catalogueId: '', newEventName: '', newEventStarts: '0', newEventEnds: '360', newCatalogueTitle: '', description: '', terms: '', docAdded: false });
    setAssignId(id);
  };
  const pickCatalogue = (catalogueId: string) => {
    const c = catalogues.find((x) => x.id === catalogueId);
    setAf({ ...af, catalogueId, description: c?.additionalInfo.description ?? '', terms: c?.additionalInfo.terms ?? '' });
  };
  const confirmAssign = () => {
    if (!assignId) return;
    let eventId = af.eventId;
    if (eventId === NEW_EVENT || !eventId) {
      eventId = createEvent(af.newEventName || 'Untitled Event', Number(af.newEventStarts) || 0, Number(af.newEventEnds) || 360);
    }
    let catalogueId = af.catalogueId;
    if (catalogueId === NEW_CATALOGUE || !catalogueId) {
      catalogueId = createCatalogue(eventId, af.newCatalogueTitle || 'Untitled Catalogue');
    }
    assignLotToCatalogue(assignId, catalogueId);
    if (af.description || af.terms) updateCatalogueInfo(catalogueId, { description: af.description, terms: af.terms || undefined });
    if (af.docAdded) {
      const existing = catalogues.find((c) => c.id === catalogueId)?.documents ?? [];
      updateCatalogueDocs(catalogueId, [...existing, { id: nextId('DOC'), type: 'inspection', label: 'Bundled inspection report', url: '/mock-pdf/bundle.pdf', uploadedBy: userName, uploadedAt: nowStamp() }]);
    }
    setAssignId(null);
  };

  const open = (id: string) => {
    const l = lots.find((x) => x.id === id)!;
    setF({ startsInMin: '0', increment: String(l.increment), reserve: String(l.reservePrice), emd: String(l.emdAmount) });
    setOpenId(id);
  };
  const publish = () => {
    if (!openId) return;
    createAuction(openId, {
      startsInMin: Number(f.startsInMin),
      increment: Number(f.increment), reserve: Number(f.reserve), emd: Number(f.emd),
    });
    setOpenId(null);
  };

  return (
    <div>
      <SectionTitle title="Auction Creation & Scheduling" sub="Turn approved lots into scheduled or instantly-live auctions" right={<ScopeBadge module="auctions" />} />

      <h2 className="mb-2 text-sm font-bold text-ink">Approved lots ready for auction ({approved.length})</h2>
      {approved.length === 0 && <Empty title="No approved lots waiting" sub="Verify lots first — they'll queue here for auction setup." />}
      <div className="space-y-3">
        {approved.map((l) => (
          <Card key={l.id} className="flex flex-wrap items-center gap-4 p-4">
            <LotImage hues={l.imageHues} label={l.metal} className="h-14 w-20 rounded-lg shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-faint">{l.id}</div>
              <div className="truncate text-sm font-bold text-ink">{l.title}</div>
              <div className="text-xs text-faint">{l.quantity} · base {inrCompact(l.basePrice)} · reserve {inrCompact(l.reservePrice)}</div>
            </div>
            <Badge tone="bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-400/25">Verified ✓</Badge>
            {l.catalogueId ? (
              <Badge tone="tone-steel"><Layers size={11} /> {catalogueById(catalogues, l.catalogueId)?.title} · {eventById(auctionEvents, catalogueById(catalogues, l.catalogueId)?.eventId ?? '')?.name}</Badge>
            ) : (
              <Btn size="sm" variant="outline" onClick={() => startAssign(l.id)}><Layers size={13} /> Assign to catalogue</Btn>
            )}
            {l.catalogueId ? (
              <Btn size="sm" variant="accent" onClick={() => open(l.id)}><Rocket size={13} /> Create auction</Btn>
            ) : (
              <span title="Assign this lot to a catalogue first — the auction inherits its closing time">
                <Btn size="sm" variant="accent" disabled><Lock size={12} /> Create auction</Btn>
              </span>
            )}
          </Card>
        ))}
      </div>

      <h2 className="mb-2 mt-8 text-sm font-bold text-ink">Scheduled & live auctions</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {upcoming.map(({ a, lot: l }) => (
          <Card key={a.id} className="min-w-0 p-4">
            <div className="flex items-center gap-3">
              <LotImage hues={l.imageHues} className="h-11 w-16 rounded-lg shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-faint">{a.id} · {l.id}</div>
                <div className="truncate text-sm font-bold text-ink">{l.title}</div>
              </div>
              <StatusBadge status={l.status} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="min-w-0 rounded-lg bg-surface-2 px-2 py-1.5">
                <div className="text-[9px] font-bold uppercase text-faint">{a.status === 'live' ? 'Current' : 'Start price'}</div>
                <div className="font-extrabold text-ink">{inrCompact(a.currentBid)}</div>
              </div>
              <div className="min-w-0 rounded-lg bg-surface-2 px-2 py-1.5">
                <div className="text-[9px] font-bold uppercase text-faint">EMD / Incr</div>
                <div className="font-extrabold text-ink">{inrCompact(a.emd)} / {inrCompact(a.increment)}</div>
              </div>
              <div className="min-w-0 rounded-lg bg-surface-2 px-2 py-1.5">
                <div className="text-[9px] font-bold uppercase text-faint">{a.status === 'live' ? 'Ends in' : 'Starts'}</div>
                <div className="flex flex-wrap items-center justify-center gap-1 font-extrabold text-ember-600 dark:text-ember-400">
                  {a.status === 'live' ? <><Timer size={11} /> {timeLeft(a.endsAt, now)}</> : <><Radio size={11} /> {dateTime(a.startsAt)}</>}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={!!lot} onClose={() => setOpenId(null)} title={`Create auction — ${lot?.id ?? ''}`}>
        {lot && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
              <LotImage hues={lot.imageHues} className="h-11 w-16 rounded-lg shrink-0" />
              <div>
                <div className="text-sm font-bold text-ink">{lot.title}</div>
                <div className="text-xs text-faint">{lot.quantity} · base {inr(lot.basePrice)}</div>
              </div>
            </div>
            {lotCatalogue && (
              <div className="flex items-center gap-2 rounded-xl bg-steel-500/10 px-4 py-3 text-xs text-steel-800 dark:text-steel-200 ring-1 ring-steel-200 dark:ring-steel-400/25">
                <Layers size={14} className="shrink-0" />
                Closes with catalogue <b>{lotCatalogue.title}</b> at <b>{dateTime(lotCatalogue.closingAt)}</b> — bidding ends for every lot in the room at once.
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Starts in (minutes)" hint="0 = publish live immediately">
                <input className={inputCls} value={f.startsInMin} onChange={(e) => setF({ ...f, startsInMin: e.target.value.replace(/[^\d]/g, '') })} />
              </Field>
              <Field label="Bid increment (₹)">
                <input className={inputCls} value={f.increment} onChange={(e) => setF({ ...f, increment: e.target.value.replace(/[^\d]/g, '') })} />
              </Field>
              <Field label="Reserve price (₹)">
                <input className={inputCls} value={f.reserve} onChange={(e) => setF({ ...f, reserve: e.target.value.replace(/[^\d]/g, '') })} />
              </Field>
              <Field label="EMD (₹)" hint="Catalogue-level: buyers lock the max EMD across the room once">
                <input className={inputCls} value={f.emd} onChange={(e) => setF({ ...f, emd: e.target.value.replace(/[^\d]/g, '') })} />
              </Field>
            </div>
            <div className="rounded-xl bg-steel-500/10 px-4 py-3 text-xs text-steel-800 dark:text-steel-200 ring-1 ring-steel-200 dark:ring-steel-400/25">
              Late bids within the last <b>60s</b> auto-extend the auction by <b>2 min</b> (max 5 extensions) — per platform config.
            </div>
            <GatedBtn
              module="auctions" value={Number(f.reserve) || lot.reservePrice} variant="accent" size="lg" className="w-full"
              disabled={!Number(f.reserve)} onAllowed={publish}
              approval={{
                type: 'auction_publish',
                title: `Auction publish — ${lot.id} (over ceiling)`,
                detail: `${lot.title} at reserve ${inr(Number(f.reserve) || lot.reservePrice)} exceeds the Sub-Admin's ₹ ceiling. Approving publishes with the proposed schedule.`,
                refId: lot.id,
                payload: { startsInMin: Number(f.startsInMin), increment: Number(f.increment), reserve: Number(f.reserve), emd: Number(f.emd) },
              }}
            >
              <CalendarClock size={16} /> {Number(f.startsInMin) === 0 ? 'Publish live now' : `Schedule (starts in ${f.startsInMin} min)`}
            </GatedBtn>
          </div>
        )}
      </Modal>

      <Modal open={!!assignLot} onClose={() => setAssignId(null)} title={`Assign to catalogue — ${assignLot?.id ?? ''}`} wide>
        {assignLot && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
              <LotImage hues={assignLot.imageHues} className="h-11 w-16 rounded-lg shrink-0" />
              <div>
                <div className="text-sm font-bold text-ink">{assignLot.title}</div>
                <div className="text-xs text-faint">{assignLot.quantity} · {assignLot.metal}</div>
              </div>
            </div>

            <Field label="Auction Event">
              <select
                className={inputCls}
                value={af.eventId}
                onChange={(e) => setAf({ ...af, eventId: e.target.value, catalogueId: '' })}
              >
                {openEvents.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                <option value={NEW_EVENT}>+ New event…</option>
              </select>
            </Field>

            {af.eventId === NEW_EVENT ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Event name">
                  <input className={inputCls} value={af.newEventName} onChange={(e) => setAf({ ...af, newEventName: e.target.value })} />
                </Field>
                <Field label="Starts in (min)">
                  <input className={inputCls} value={af.newEventStarts} onChange={(e) => setAf({ ...af, newEventStarts: e.target.value.replace(/[^\d-]/g, '') })} />
                </Field>
                <Field label="Ends in (min)">
                  <input className={inputCls} value={af.newEventEnds} onChange={(e) => setAf({ ...af, newEventEnds: e.target.value.replace(/[^\d-]/g, '') })} />
                </Field>
              </div>
            ) : (
              <Field label="Catalogue">
                <select
                  className={inputCls}
                  value={af.catalogueId}
                  onChange={(e) => pickCatalogue(e.target.value)}
                >
                  <option value="" disabled>Choose a catalogue…</option>
                  {catalogueOptions.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  <option value={NEW_CATALOGUE}>+ New catalogue…</option>
                </select>
              </Field>
            )}

            {(af.eventId === NEW_EVENT || af.catalogueId === NEW_CATALOGUE) && (
              <Field label="New catalogue title">
                <input className={inputCls} value={af.newCatalogueTitle} onChange={(e) => setAf({ ...af, newCatalogueTitle: e.target.value })} />
              </Field>
            )}

            <div className="rounded-xl border border-line p-4">
              <div className="mb-3 flex items-center gap-1.5 text-xs font-bold text-ink"><FileText size={13} /> Bid-room document & description (buyer-facing)</div>
              <div className="space-y-3">
                <Field label="Catalogue description">
                  <textarea className={inputCls} rows={2} value={af.description} onChange={(e) => setAf({ ...af, description: e.target.value })} placeholder="What buyers see at the top of this bid room…" />
                </Field>
                <Field label="Terms (optional)">
                  <textarea className={inputCls} rows={2} value={af.terms} onChange={(e) => setAf({ ...af, terms: e.target.value })} placeholder="Payment window, pickup terms, EMD forfeiture rules…" />
                </Field>
                <FileDrop label="Attach a document (mock)" done={af.docAdded} onUpload={() => setAf({ ...af, docAdded: true })} />
                {selectedCatalogue && selectedCatalogue.documents.length > 0 && (
                  <div className="text-[11px] text-faint">{selectedCatalogue.documents.length} document(s) already on file for this catalogue.</div>
                )}
              </div>
            </div>

            <GatedBtn
              module="auctions" variant="accent" size="lg" className="w-full"
              disabled={af.eventId !== NEW_EVENT && !af.catalogueId}
              onAllowed={confirmAssign}
            >
              <Layers size={16} /> Assign lot to catalogue
            </GatedBtn>
          </div>
        )}
      </Modal>
    </div>
  );
}
