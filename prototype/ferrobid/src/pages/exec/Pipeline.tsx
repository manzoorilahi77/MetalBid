import { useNavigate } from 'react-router-dom';
import { useApp } from '../../store';
import { SectionTitle, Card, Badge, LotImage } from '../../components/ui';
import { inrCompact, cx } from '../../utils';
import type { LotStatus } from '../../types';

const COLUMNS: { title: string; statuses: LotStatus[]; tone: string; to: string }[] = [
  { title: 'Submitted', statuses: ['submitted'], tone: 'border-t-sky-400', to: '/exec/lots' },
  { title: 'Under Verification', statuses: ['under_verification'], tone: 'border-t-amber-400', to: '/exec/lots' },
  { title: 'Approved', statuses: ['approved'], tone: 'border-t-emerald-400', to: '/exec/auctions' },
  { title: 'Scheduled / Live', statuses: ['scheduled', 'live'], tone: 'border-t-ember-500', to: '/exec/auctions' },
  { title: 'Won / Settlement', statuses: ['won', 'in_settlement'], tone: 'border-t-violet-400', to: '/exec/settlement' },
  { title: 'Logistics', statuses: ['ready_for_pickup', 'in_logistics'], tone: 'border-t-blue-400', to: '/exec/logistics' },
  { title: 'Closed', statuses: ['handover_complete', 'closed', 'rejected'], tone: 'border-t-slate-300', to: '/exec/handover' },
];

export default function Pipeline() {
  const nav = useNavigate();
  const { lots, entityRequests } = useApp();
  const pendingEntities = entityRequests.filter((r) => r.status === 'pending').length;

  return (
    <div>
      <SectionTitle
        title="Pipeline Board" sub="One board across the whole lot lifecycle — verify → auction → fulfil"
        right={pendingEntities > 0 && (
          <button onClick={() => nav('/exec/entities')} className="flex items-center gap-2 rounded-xl border border-ember-200 bg-ember-50 px-3.5 py-2 text-xs font-bold text-ember-700 hover:bg-ember-100 cursor-pointer">
            {pendingEntities} entity verification{pendingEntities > 1 ? 's' : ''} waiting →
          </button>
        )}
      />

      <div className="flex gap-3 overflow-x-auto thin-scroll pb-3">
        {COLUMNS.map((col) => {
          const items = lots.filter((l) => col.statuses.includes(l.status));
          return (
            <div key={col.title} className="w-60 shrink-0">
              <div className={cx('rounded-xl border-t-4 bg-slate-200/50 p-2', col.tone)}>
                <div className="flex items-center justify-between px-1.5 pb-2 pt-1">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-slate-600">{col.title}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">{items.length}</span>
                </div>
                <div className="space-y-2 min-h-24">
                  {items.map((l) => (
                    <Card key={l.id} onClick={() => nav(col.to)} className="p-2.5">
                      <div className="flex items-center gap-2">
                        <LotImage hues={l.imageHues} className="h-9 w-12 rounded-md shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold text-slate-400">{l.id}</div>
                          <div className="truncate text-xs font-bold text-steel-950">{l.title}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">{l.quantity}</span>
                        <Badge tone="bg-slate-50 text-slate-500 ring-slate-200">{inrCompact(l.basePrice)}</Badge>
                      </div>
                      {l.status === 'live' && <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-ember-600"><span className="h-1.5 w-1.5 rounded-full bg-ember-500 animate-pulse" /> LIVE bidding</div>}
                      {l.status === 'rejected' && <div className="mt-1.5 text-[10px] font-bold text-red-500">Rejected</div>}
                    </Card>
                  ))}
                  {items.length === 0 && <div className="rounded-lg border border-dashed border-slate-300 py-6 text-center text-[10px] text-slate-400">Empty</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">Click any card to open the stage's work queue. Lots move automatically as you action them.</p>
    </div>
  );
}
