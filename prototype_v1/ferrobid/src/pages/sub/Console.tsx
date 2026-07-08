import { useState } from 'react';
import { Lock, Search, Radio, Timer } from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Card, Badge, StatusBadge, Tabs, Empty, LotImage } from '../../components/ui';
import { inrCompact, timeLeft, cx } from '../../utils';

const SUB_ADMIN_ID = 'adm-03';

function LockedPanel({ perm }: { perm: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-slate-400"><Lock size={20} /></div>
      <div className="text-sm font-bold text-slate-500">Permission required</div>
      <p className="max-w-sm text-xs text-slate-400">
        Your Sub-Admin account doesn't have the <b>“{perm}”</b> permission.
        A Super Admin can grant it from <b>Admins &amp; Permissions</b> — this gating is visual (demo RBAC).
      </p>
    </div>
  );
}

export default function SubConsole() {
  const { admins, lots, auctions, users, now } = useApp();
  const me = admins.find((a) => a.id === SUB_ADMIN_ID);
  const perms = me?.permissions ?? {};
  const [tab, setTab] = useState('auctions');
  const [q, setQ] = useState('');

  const tabs = [
    { key: 'auctions', label: <span className="flex items-center gap-1.5">Auctions {!perms.manageAuctions && <Lock size={11} />}</span> },
    { key: 'lots', label: <span className="flex items-center gap-1.5">Lots & Catalogue {!perms.manageLots && <Lock size={11} />}</span> },
    { key: 'users', label: <span className="flex items-center gap-1.5">Users {!perms.manageUsers && <Lock size={11} />}</span> },
  ];

  return (
    <div>
      <SectionTitle
        title="Sub-Admin Ops Console" sub={`Signed in as ${me?.name} — actions outside your permission scope are visibly locked`}
        right={<Badge tone="bg-violet-50 text-violet-700 ring-violet-200">{Object.values(perms).filter(Boolean).length} of {Object.keys(perms).length} permissions granted</Badge>}
      />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <div className="mt-5">
        {tab === 'auctions' && (
          perms.manageAuctions ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {auctions.filter((a) => a.status !== 'closed').map((a) => {
                const lot = lots.find((l) => l.id === a.lotId)!;
                return (
                  <Card key={a.id} className="flex items-center gap-3 p-4">
                    <LotImage hues={lot.imageHues} className="h-12 w-16 rounded-lg shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold text-slate-400">{a.id}</div>
                      <div className="truncate text-sm font-bold text-steel-950">{lot.title}</div>
                      <div className="text-xs text-slate-400">{inrCompact(a.currentBid)} · {a.bidderCount} bidders</div>
                    </div>
                    {a.status === 'live'
                      ? <Badge tone="bg-ember-50 text-ember-700 ring-ember-200"><Radio size={11} /> {timeLeft(a.endsAt, now)}</Badge>
                      : <Badge tone="bg-indigo-50 text-indigo-700 ring-indigo-200"><Timer size={11} /> Scheduled</Badge>}
                  </Card>
                );
              })}
            </div>
          ) : <LockedPanel perm="Manage auctions" />
        )}

        {tab === 'lots' && (
          perms.manageLots || perms.manageCatalogue ? (
            <>
              <div className="relative mb-3 max-w-md">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search catalogue…" className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-steel-100" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {lots.filter((l) => !q || (l.title + l.id).toLowerCase().includes(q.toLowerCase())).map((l) => (
                  <Card key={l.id} className="p-3.5">
                    <div className="flex items-center gap-3">
                      <LotImage hues={l.imageHues} className="h-11 w-14 rounded-lg shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold text-slate-400">{l.id}</div>
                        <div className="truncate text-xs font-bold text-steel-950">{l.title}</div>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between">
                      <StatusBadge status={l.status} />
                      <span className="text-xs font-bold text-steel-900">{inrCompact(l.basePrice)}</span>
                    </div>
                    <div className={cx('mt-2 text-[10px] font-semibold', perms.manageLots ? 'text-emerald-600' : 'text-slate-400')}>
                      {perms.manageLots ? '✓ Edit access' : <span className="flex items-center gap-1"><Lock size={9} /> Catalogue view only</span>}
                    </div>
                  </Card>
                ))}
              </div>
            </>
          ) : <LockedPanel perm="Manage lots / catalogue" />
        )}

        {tab === 'users' && (
          perms.manageUsers ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {users.filter((u) => !u.id.startsWith('b-')).map((u) => (
                <Card key={u.id} className="p-4">
                  <div className="text-sm font-bold text-steel-950">{u.name}</div>
                  <div className="text-xs text-slate-400">{u.phone}</div>
                </Card>
              ))}
            </div>
          ) : <LockedPanel perm="Manage users" />
        )}
      </div>

      {tab && !perms.viewAudit && tab === 'audit' && <Empty title="No access" />}
    </div>
  );
}
