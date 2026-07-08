import { useNavigate } from 'react-router-dom';
import { BadgeCheck, ClipboardCheck, Radio, Banknote, Truck, Users, ArrowRight } from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Card, Stat, Badge } from '../../components/ui';
import { inrCompact } from '../../utils';
import { LIFECYCLE_ORDER, STATUS_LABEL } from '../../lifecycle';

export default function AdminDashboard() {
  const nav = useNavigate();
  const { lots, auctions, users, entityRequests, settlements, logistics, audit } = useApp();

  const kpis = [
    { label: 'Entities awaiting verification', value: entityRequests.filter((r) => r.status === 'pending').length, icon: <BadgeCheck size={18} />, accent: 'bg-amber-50 text-amber-600', to: '/admin/users' },
    { label: 'Lots under verification', value: lots.filter((l) => ['submitted', 'under_verification'].includes(l.status)).length, icon: <ClipboardCheck size={18} />, accent: 'bg-sky-50 text-sky-600' },
    { label: 'Live auctions', value: auctions.filter((a) => a.status === 'live').length, icon: <Radio size={18} />, accent: 'bg-ember-50 text-ember-600' },
    { label: 'Awaiting settlement', value: settlements.filter((s) => !s.paymentConfirmed).length, icon: <Banknote size={18} />, accent: 'bg-violet-50 text-violet-600' },
    { label: 'Awaiting pickup', value: logistics.filter((x) => x.status !== 'completed').length, icon: <Truck size={18} />, accent: 'bg-blue-50 text-blue-600' },
    { label: 'Registered users', value: users.length, icon: <Users size={18} />, accent: 'bg-steel-50 text-steel-700' },
  ];

  const gmv = auctions.filter((a) => a.status === 'closed' && a.leaderId).reduce((s, a) => s + a.currentBid, 0);
  const stageCounts = LIFECYCLE_ORDER.map((s) => ({ s, n: lots.filter((l) => l.status === s).length })).filter((x) => x.n > 0);
  const maxN = Math.max(...stageCounts.map((x) => x.n), 1);

  return (
    <div>
      <SectionTitle title="Platform Overview" sub="Full-lifecycle KPIs across verification, auctions and fulfilment" right={<Badge tone="bg-emerald-50 text-emerald-700 ring-emerald-200">GMV realised: {inrCompact(gmv)}</Badge>} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k) => <Stat key={k.label} label={k.label} value={k.value} icon={k.icon} accent={k.accent} />)}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-bold text-steel-950">Lots by lifecycle stage</h3>
          <div className="mt-4 space-y-2.5">
            {stageCounts.map(({ s, n }) => (
              <div key={s} className="flex items-center gap-3">
                <span className="w-36 shrink-0 text-right text-[11px] font-semibold text-slate-500">{STATUS_LABEL[s]}</span>
                <div className="h-4 flex-1 rounded-full bg-slate-100">
                  <div className="h-4 rounded-full bg-gradient-to-r from-steel-600 to-steel-400" style={{ width: `${(n / maxN) * 100}%` }} />
                </div>
                <span className="w-5 text-xs font-extrabold text-steel-950">{n}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-steel-950">Latest audit activity</h3>
            <button onClick={() => nav('/admin/audit')} className="flex items-center gap-1 text-xs font-bold text-steel-600 hover:underline cursor-pointer">Full trail <ArrowRight size={12} /></button>
          </div>
          <div className="mt-3 space-y-2.5">
            {audit.slice(0, 6).map((a) => (
              <div key={a.id} className="flex items-start gap-2.5 border-b border-slate-50 pb-2.5 last:border-0">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-ember-400" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-steel-950 leading-snug">{a.action}</div>
                  <div className="text-[10px] text-slate-400">{a.actor} ({a.role}) · {a.target} · {a.at}</div>
                </div>
                <Badge tone="bg-slate-100 text-slate-500 ring-slate-200">{a.stage}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
