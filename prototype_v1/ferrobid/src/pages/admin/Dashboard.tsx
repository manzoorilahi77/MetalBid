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
    { label: 'Entities awaiting verification', value: entityRequests.filter((r) => r.status === 'pending').length, icon: <BadgeCheck size={18} />, accent: 'bg-amber-50 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400', to: '/admin/users' },
    { label: 'Lots under verification', value: lots.filter((l) => ['submitted', 'under_verification'].includes(l.status)).length, icon: <ClipboardCheck size={18} />, accent: 'bg-sky-50 dark:bg-sky-400/10 text-sky-600 dark:text-sky-400' },
    { label: 'Live auctions', value: auctions.filter((a) => a.status === 'live').length, icon: <Radio size={18} />, accent: 'bg-ember-50 dark:bg-ember-400/10 text-ember-600 dark:text-ember-400' },
    { label: 'Awaiting settlement', value: settlements.filter((s) => !s.paymentConfirmed).length, icon: <Banknote size={18} />, accent: 'bg-violet-50 dark:bg-violet-400/10 text-violet-600 dark:text-violet-400' },
    { label: 'Awaiting pickup', value: logistics.filter((x) => x.status !== 'completed').length, icon: <Truck size={18} />, accent: 'bg-blue-50 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400' },
    { label: 'Registered users', value: users.length, icon: <Users size={18} />, accent: 'bg-steel-500/10 text-steel-700 dark:text-steel-300' },
  ];

  const gmv = auctions.filter((a) => a.status === 'closed' && a.leaderId).reduce((s, a) => s + a.currentBid, 0);
  const stageCounts = LIFECYCLE_ORDER.map((s) => ({ s, n: lots.filter((l) => l.status === s).length })).filter((x) => x.n > 0);
  const maxN = Math.max(...stageCounts.map((x) => x.n), 1);

  return (
    <div>
      <SectionTitle title="Platform Overview" sub="Full-lifecycle KPIs across verification, auctions and fulfilment" right={<Badge tone="bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-400/25">GMV realised: {inrCompact(gmv)}</Badge>} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k) => <Stat key={k.label} label={k.label} value={k.value} icon={k.icon} accent={k.accent} />)}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-bold text-ink">Lots by lifecycle stage</h3>
          <div className="mt-4 space-y-2.5">
            {stageCounts.map(({ s, n }) => (
              <div key={s} className="flex items-center gap-3">
                <span className="w-36 shrink-0 text-right text-[11px] font-semibold text-muted">{STATUS_LABEL[s]}</span>
                <div className="h-4 flex-1 rounded-full bg-surface-3">
                  <div className="h-4 rounded-full bg-gradient-to-r from-steel-600 to-steel-400" style={{ width: `${(n / maxN) * 100}%` }} />
                </div>
                <span className="w-5 text-xs font-extrabold text-ink">{n}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink">Latest audit activity</h3>
            <button onClick={() => nav('/admin/audit')} className="flex items-center gap-1 text-xs font-bold text-steel-600 dark:text-steel-400 hover:underline cursor-pointer">Full trail <ArrowRight size={12} /></button>
          </div>
          <div className="mt-3 space-y-2.5">
            {audit.slice(0, 6).map((a) => (
              <div key={a.id} className="flex items-start gap-2.5 border-b border-line pb-2.5 last:border-0">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-ember-400" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-ink leading-snug">{a.action}</div>
                  <div className="text-[10px] text-faint">{a.actor} ({a.role}) · {a.target} · {a.at}</div>
                </div>
                <Badge tone="bg-surface-3 text-muted ring-line">{a.stage}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
