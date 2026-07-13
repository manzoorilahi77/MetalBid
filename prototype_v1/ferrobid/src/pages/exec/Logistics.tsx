import { useState } from 'react';
import { Truck, CalendarClock, UserCheck } from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Card, Btn, Badge, Modal, Field, inputCls, Empty, LotImage } from '../../components/ui';

const HANDLERS = ['BlueDart Heavy Cargo', 'SafeXpress Logistics', 'VRL Industrial Movers', 'TCI Freight'];
const SLOTS = ['08:00 – 10:00', '10:00 – 12:00', '14:00 – 16:00', '16:00 – 18:00'];

const LG_TONE: Record<string, string> = {
  awaiting: 'bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-400/25',
  scheduled: 'bg-indigo-50 dark:bg-indigo-400/10 text-indigo-700 dark:text-indigo-300 ring-indigo-200 dark:ring-indigo-400/25',
  in_transit: 'bg-blue-50 dark:bg-blue-400/10 text-blue-700 dark:text-blue-300 ring-blue-200 dark:ring-blue-400/25',
  completed: 'bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-400/25',
};

export default function Logistics() {
  const { logistics, lots, schedulePickup, markInTransit } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  const [date, setDate] = useState('2026-07-10');
  const [slot, setSlot] = useState(SLOTS[1]);
  const [handler, setHandler] = useState(HANDLERS[0]);
  const rec = logistics.find((x) => x.id === openId);

  const rows = logistics.filter((x) => x.status !== 'completed');
  const doneRows = logistics.filter((x) => x.status === 'completed');

  return (
    <div>
      <SectionTitle title="Logistics" sub="Schedule pickups, assign handlers and track movement" />
      {rows.length === 0 && <Empty title="No pickups to manage" sub="Settled lots appear here for pickup scheduling." />}
      <div className="space-y-3">
        {rows.map((x) => {
          const lot = lots.find((l) => l.id === x.lotId)!;
          return (
            <Card key={x.id} className="flex flex-wrap items-center gap-4 p-4">
              <LotImage hues={lot.imageHues} label={lot.metal} className="h-14 w-20 rounded-lg shrink-0" />
              <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                <div className="text-[11px] font-bold text-faint">{x.id} · {lot.id}</div>
                <div className="truncate text-sm font-bold text-ink">{lot.title}</div>
                <div className="text-xs text-faint">
                  {x.pickupDate ? <>📅 {x.pickupDate} · {x.slot} · 🚚 {x.handler}</> : 'Pickup not scheduled yet'}
                </div>
              </div>
              <Badge tone={LG_TONE[x.status]} className="capitalize">{x.status.replace('_', ' ')}</Badge>
              {x.status === 'awaiting' && <Btn size="sm" variant="accent" onClick={() => setOpenId(x.id)}><CalendarClock size={13} /> Schedule pickup</Btn>}
              {x.status === 'scheduled' && <Btn size="sm" variant="primary" onClick={() => markInTransit(x.id)}><Truck size={13} /> Mark in transit</Btn>}
              {x.status === 'in_transit' && <Badge tone="bg-blue-50 dark:bg-blue-400/10 text-blue-700 dark:text-blue-300 ring-blue-200 dark:ring-blue-400/25"><Truck size={11} /> Vehicle en route — complete at Handover</Badge>}
            </Card>
          );
        })}
      </div>

      {doneRows.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 text-sm font-bold text-ink">Completed pickups</h2>
          <div className="space-y-2">
            {doneRows.map((x) => {
              const lot = lots.find((l) => l.id === x.lotId);
              return (
                <Card key={x.id} className="flex flex-wrap items-center gap-3 p-3.5">
                  <UserCheck size={17} className="text-emerald-500 shrink-0" />
                  <div className="min-w-0 flex-1 basis-full text-sm font-bold text-ink sm:basis-auto">{lot?.title}</div>
                  <span className="text-xs text-faint">{x.pickupDate} · {x.handler}</span>
                  <Badge tone={LG_TONE.completed}>Completed</Badge>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <Modal open={!!rec} onClose={() => setOpenId(null)} title="Schedule pickup">
        {rec && (
          <div className="space-y-4">
            <Field label="Pickup date">
              <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Time slot">
              <div className="grid grid-cols-2 gap-2">
                {SLOTS.map((s) => (
                  <button key={s} onClick={() => setSlot(s)} className={`rounded-lg border px-3 py-2 text-xs font-bold cursor-pointer ${slot === s ? 'border-steel-600 bg-steel-500/10 text-steel-800 dark:text-steel-200' : 'border-line text-muted hover:bg-surface-2'}`}>{s}</button>
                ))}
              </div>
            </Field>
            <Field label="Assign pickup handler">
              <select className={inputCls} value={handler} onChange={(e) => setHandler(e.target.value)}>
                {HANDLERS.map((h) => <option key={h}>{h}</option>)}
              </select>
            </Field>
            <Btn variant="accent" size="lg" className="w-full" onClick={() => { schedulePickup(rec.id, date, slot, handler); setOpenId(null); }}>
              <CalendarClock size={16} /> Confirm schedule & notify winner
            </Btn>
          </div>
        )}
      </Modal>
    </div>
  );
}
