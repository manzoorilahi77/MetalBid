import { Link } from 'react-router-dom';
import {
  ClipboardList, ShieldQuestion, Radio, Timer, CheckCircle2, ArrowRight,
  Eye, Lock, Wrench, BadgeCheck, Search,
} from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../../store';
import { DEMO_SUB_ADMIN_ID, OPS_MODULES, LEVEL_LABEL } from '../../permissions';
import type { ScopedPermissions } from '../../types';
import { SectionTitle, Card, Badge, Btn, Stat, Empty } from '../../components/ui';
import { inrCompact, cx } from '../../utils';

/** Route for each ops module inside the Sub-Admin console (inherited Exec screens). */
export const SUB_MODULE_ROUTE: Record<string, string> = {
  pipeline: '/sub/pipeline', entities: '/sub/entities', lots: '/sub/lots', manager_review: '/sub/manager-review', auctions: '/sub/auctions',
  settlement: '/sub/settlement', logistics: '/sub/logistics', handover: '/sub/handover',
  monitor: '/sub/monitor', users: '/sub',
};

function slaChip(dueAt: number, now: number) {
  const mins = Math.round((dueAt - now) / 60000);
  if (mins < 0) return <Badge tone="bg-red-50 dark:bg-red-400/10 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-400/25"><Timer size={11} /> Overdue {-mins}m</Badge>;
  if (mins < 120) return <Badge tone="bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-400/25"><Timer size={11} /> Due in {mins}m</Badge>;
  return <Badge tone="bg-surface-3 text-muted ring-line-strong"><Timer size={11} /> Due in {Math.round(mins / 60)}h</Badge>;
}

const LEVEL_ICON = { hidden: <Lock size={13} />, view: <Eye size={13} />, act: <Wrench size={13} />, approve: <BadgeCheck size={13} /> } as const;

export default function SubConsole() {
  const { admins, workQueue, approvals, auctions, users, now, completeTask } = useApp();
  const me = admins.find((a) => a.id === DEMO_SUB_ADMIN_ID);
  const scoped: ScopedPermissions = me?.scoped ?? {};
  const [q, setQ] = useState('');

  const openTasks = workQueue.filter((t) => t.status === 'open').sort((a, b) => a.dueAt - b.dueAt);
  const myPending = approvals.filter((a) => a.status === 'pending' && a.requestedBy === me?.name);
  const liveCount = auctions.filter((a) => a.status === 'live' || a.status === 'paused').length;
  const granted = OPS_MODULES.filter((m) => scoped[m.key]?.level !== 'hidden');
  const usersVisible = scoped.users?.level !== 'hidden';

  return (
    <div>
      <SectionTitle
        title="Sub-Admin Ops Console"
        sub={`Signed in as ${me?.name} — you operate the Executive pipeline within your granted scope`}
        right={<Badge tone="tone-violet">{granted.length} of {OPS_MODULES.length} modules granted</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Open tasks" value={openTasks.length} hint={`${openTasks.filter((t) => t.dueAt < now).length} overdue`} icon={<ClipboardList size={18} />} />
        <Stat label="Awaiting approval" value={myPending.length} hint="Requests with Exec/Super Admin" icon={<ShieldQuestion size={18} />} accent="bg-amber-500/10 text-amber-600 dark:text-amber-400" />
        <Stat label="Auctions to watch" value={liveCount} hint="Live + paused in Bid Monitor" icon={<Radio size={18} />} accent="bg-ember-500/10 text-ember-600 dark:text-ember-400" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div>
          <h2 className="mb-2 text-sm font-bold text-ink">My Work Queue <span className="ml-1 text-xs font-medium text-faint">SLA-tracked tasks routed to your scope</span></h2>
          <div className="space-y-2.5">
            {openTasks.length === 0 && <Empty title="Queue is clear 🎉" sub="Tasks assigned by Executive Managers or auto-routed by scope appear here." />}
            {openTasks.map((t) => (
              <Card key={t.id} className="flex flex-wrap items-center gap-3 p-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-steel-500/10 text-steel-700 dark:text-steel-300">
                  <ClipboardList size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold text-faint">{t.id} · ref {t.refId} · from {t.assignedBy}</div>
                  <div className="text-[13px] font-bold text-ink leading-snug">{t.title}</div>
                </div>
                {slaChip(t.dueAt, now)}
                <div className="flex items-center gap-1.5">
                  {SUB_MODULE_ROUTE[t.module] && scoped[t.module]?.level !== 'hidden' && (
                    <Link to={SUB_MODULE_ROUTE[t.module]}><Btn size="sm" variant="outline">Open <ArrowRight size={12} /></Btn></Link>
                  )}
                  <Btn size="sm" variant="success" onClick={() => completeTask(t.id)}><CheckCircle2 size={13} /> Done</Btn>
                </div>
              </Card>
            ))}
          </div>

          {usersVisible && (
            <>
              <h2 className="mb-2 mt-7 text-sm font-bold text-ink">User Directory <span className="ml-1 text-xs font-medium text-faint">view-scoped — standing changes are Super Admin only</span></h2>
              <div className="relative mb-3 max-w-md">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users…" className="w-full rounded-xl border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-steel-500/25" />
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {users.filter((u) => !u.id.startsWith('b-')).filter((u) => !q || u.name.toLowerCase().includes(q.toLowerCase())).map((u) => (
                  <Card key={u.id} className="flex items-center gap-3 p-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-ink">{u.name}</div>
                      <div className="text-xs text-faint">{u.phone} · KYC {u.kycStatus}</div>
                    </div>
                    <Badge tone={u.standing === 'good' || !u.standing ? 'tone-emerald' : 'bg-red-50 dark:bg-red-400/10 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-400/25'} className="capitalize">
                      {u.standing ?? 'good'}
                    </Badge>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          <h2 className="mb-2 text-sm font-bold text-ink">Your permission grants</h2>
          <Card className="divide-y divide-line">
            {OPS_MODULES.map((m) => {
              const p = scoped[m.key];
              const level = p?.level ?? 'hidden';
              const bits = p ? [p.metals !== 'All' && p.metals, p.region !== 'All' && p.region, p.ceiling > 0 && `≤ ${inrCompact(p.ceiling)}`].filter(Boolean) : [];
              return (
                <div key={m.key} className={cx('flex items-center gap-3 px-4 py-2.5', level === 'hidden' && 'opacity-50')}>
                  <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                    level === 'hidden' ? 'bg-line text-faint' : level === 'view' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400')}>
                    {LEVEL_ICON[level]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-ink">{m.label}</div>
                    {bits.length > 0 && <div className="text-[10px] text-faint">{bits.join(' · ')}</div>}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted">{LEVEL_LABEL[level]}</span>
                </div>
              );
            })}
          </Card>
          <p className="mt-2 text-[11px] text-faint">
            Set by the Super Admin in <b>Admins &amp; Permissions</b>. Hidden modules disappear from your sidebar; actions above your level or ₹ ceiling route through <b>Approvals</b>.
          </p>
        </div>
      </div>
    </div>
  );
}
