import { useState } from 'react';
import { CalendarClock, Rocket, Timer, Radio } from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Card, Btn, Modal, Field, inputCls, Empty, LotImage, Badge, StatusBadge } from '../../components/ui';
import { inr, inrCompact, timeLeft, dateTime } from '../../utils';

export default function AuctionSetup() {
  const { lots, auctions, createAuction, now } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  const [f, setF] = useState({ startsInMin: '60', durationMin: '120', increment: '5000', reserve: '', emd: '' });
  const approved = lots.filter((l) => l.status === 'approved');
  const upcoming = auctions.filter((a) => a.status !== 'closed').map((a) => ({ a, lot: lots.find((l) => l.id === a.lotId)! }));
  const lot = lots.find((l) => l.id === openId);

  const open = (id: string) => {
    const l = lots.find((x) => x.id === id)!;
    setF({ startsInMin: '60', durationMin: '120', increment: String(l.increment), reserve: String(l.reservePrice), emd: String(l.emdAmount) });
    setOpenId(id);
  };
  const publish = () => {
    if (!openId) return;
    createAuction(openId, {
      startsInMin: Number(f.startsInMin), durationMin: Number(f.durationMin),
      increment: Number(f.increment), reserve: Number(f.reserve), emd: Number(f.emd),
    });
    setOpenId(null);
  };

  return (
    <div>
      <SectionTitle title="Auction Creation & Scheduling" sub="Turn approved lots into scheduled or instantly-live auctions" />

      <h2 className="mb-2 text-sm font-bold text-steel-950">Approved lots ready for auction ({approved.length})</h2>
      {approved.length === 0 && <Empty title="No approved lots waiting" sub="Verify lots first — they'll queue here for auction setup." />}
      <div className="space-y-3">
        {approved.map((l) => (
          <Card key={l.id} className="flex flex-wrap items-center gap-4 p-4">
            <LotImage hues={l.imageHues} label={l.metal} className="h-14 w-20 rounded-lg shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-slate-400">{l.id}</div>
              <div className="truncate text-sm font-bold text-steel-950">{l.title}</div>
              <div className="text-xs text-slate-400">{l.quantity} · base {inrCompact(l.basePrice)} · reserve {inrCompact(l.reservePrice)}</div>
            </div>
            <Badge tone="bg-emerald-50 text-emerald-700 ring-emerald-200">Verified ✓</Badge>
            <Btn size="sm" variant="accent" onClick={() => open(l.id)}><Rocket size={13} /> Create auction</Btn>
          </Card>
        ))}
      </div>

      <h2 className="mb-2 mt-8 text-sm font-bold text-steel-950">Scheduled & live auctions</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {upcoming.map(({ a, lot: l }) => (
          <Card key={a.id} className="p-4">
            <div className="flex items-center gap-3">
              <LotImage hues={l.imageHues} className="h-11 w-16 rounded-lg shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-slate-400">{a.id} · {l.id}</div>
                <div className="truncate text-sm font-bold text-steel-950">{l.title}</div>
              </div>
              <StatusBadge status={l.status} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                <div className="text-[9px] font-bold uppercase text-slate-400">{a.status === 'live' ? 'Current' : 'Start price'}</div>
                <div className="font-extrabold text-steel-950">{inrCompact(a.currentBid)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                <div className="text-[9px] font-bold uppercase text-slate-400">EMD / Incr</div>
                <div className="font-extrabold text-steel-950">{inrCompact(a.emd)} / {inrCompact(a.increment)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                <div className="text-[9px] font-bold uppercase text-slate-400">{a.status === 'live' ? 'Ends in' : 'Starts'}</div>
                <div className="flex items-center justify-center gap-1 font-extrabold text-ember-600">
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
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
              <LotImage hues={lot.imageHues} className="h-11 w-16 rounded-lg shrink-0" />
              <div>
                <div className="text-sm font-bold text-steel-950">{lot.title}</div>
                <div className="text-xs text-slate-400">{lot.quantity} · base {inr(lot.basePrice)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts in (minutes)" hint="0 = publish live immediately">
                <input className={inputCls} value={f.startsInMin} onChange={(e) => setF({ ...f, startsInMin: e.target.value.replace(/[^\d]/g, '') })} />
              </Field>
              <Field label="Duration (minutes)">
                <input className={inputCls} value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: e.target.value.replace(/[^\d]/g, '') })} />
              </Field>
              <Field label="Bid increment (₹)">
                <input className={inputCls} value={f.increment} onChange={(e) => setF({ ...f, increment: e.target.value.replace(/[^\d]/g, '') })} />
              </Field>
              <Field label="Reserve price (₹)">
                <input className={inputCls} value={f.reserve} onChange={(e) => setF({ ...f, reserve: e.target.value.replace(/[^\d]/g, '') })} />
              </Field>
              <Field label="EMD (₹)">
                <input className={inputCls} value={f.emd} onChange={(e) => setF({ ...f, emd: e.target.value.replace(/[^\d]/g, '') })} />
              </Field>
            </div>
            <div className="rounded-xl bg-steel-50 px-4 py-3 text-xs text-steel-800 ring-1 ring-steel-200">
              Late bids within the last <b>60s</b> auto-extend the auction by <b>2 min</b> (max 5 extensions) — per platform config.
            </div>
            <Btn variant="accent" size="lg" className="w-full" disabled={!Number(f.durationMin) || !Number(f.reserve)} onClick={publish}>
              <CalendarClock size={16} /> {Number(f.startsInMin) === 0 ? 'Publish live now' : `Schedule (starts in ${f.startsInMin} min)`}
            </Btn>
            <p className="text-center text-[11px] text-slate-400">Tip: set “Starts in” to 0 and a short duration to demo a full live auction quickly.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
