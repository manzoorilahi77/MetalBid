import { useState } from 'react';
import { Plus, ShieldCheck, UserCog, Sparkles } from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Card, Badge, Btn, Modal, Field, inputCls, Toggle } from '../../components/ui';
import { OPS_MODULES, PERM_TEMPLATES, METAL_SCOPES, REGION_SCOPES, CEILINGS, DEFAULT_SUB_SCOPED } from '../../permissions';
import type { PermLevel } from '../../types';
import { cx } from '../../utils';

const PERM_LABEL: Record<string, string> = {
  entityVerification: 'Entity verification', lotVerification: 'Lot verification', auctionCreation: 'Auction creation',
  settlement: 'Settlement', logistics: 'Logistics', handover: 'Handover',
  manageAuctions: 'Manage auctions', manageLots: 'Manage lots', manageUsers: 'Manage users',
  manageCatalogue: 'Manage catalogue', viewAudit: 'View audit log', systemConfig: 'System config',
};

const LEVELS: { key: PermLevel; label: string }[] = [
  { key: 'hidden', label: 'Hidden' }, { key: 'view', label: 'View' }, { key: 'act', label: 'Act' }, { key: 'approve', label: 'Act + Approve' },
];

const selectCls =
  'rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-[11px] font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-steel-500/25 disabled:opacity-40';

/** Scoped permission editor: module × action level × scope × ₹ ceiling (WBS v3.1 F10). */
function ScopedMatrix({ adminId }: { adminId: string }) {
  const { admins, updateScopedPermission, applyPermTemplate } = useApp();
  const scoped = admins.find((a) => a.id === adminId)?.scoped ?? DEFAULT_SUB_SCOPED;
  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-faint"><Sparkles size={12} /> Templates</span>
        {PERM_TEMPLATES.map((t) => (
          <button key={t.key} title={t.desc} onClick={() => applyPermTemplate(adminId, t.key)}
            className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-bold text-muted hover:border-steel-400 hover:bg-steel-500/10 hover:text-ink cursor-pointer">
            {t.label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto thin-scroll">
        <table className="w-full min-w-[540px] text-left">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-wide text-faint">
              <th className="pb-2 pr-2">Module</th>
              <th className="pb-2 pr-2">Level</th>
              <th className="pb-2 pr-2">Metal scope</th>
              <th className="pb-2 pr-2">Region</th>
              <th className="pb-2">₹ ceiling</th>
            </tr>
          </thead>
          <tbody>
            {OPS_MODULES.map((m) => {
              const p = scoped[m.key];
              const off = !p || p.level === 'hidden';
              return (
                <tr key={m.key} className="border-t border-line">
                  <td className={cx('py-2 pr-2 text-xs font-semibold', off ? 'text-faint' : 'text-ink')}>{m.label}</td>
                  <td className="py-2 pr-2">
                    <select className={selectCls} value={p?.level ?? 'hidden'}
                      onChange={(e) => updateScopedPermission(adminId, m.key, { level: e.target.value as PermLevel })}>
                      {LEVELS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <select className={selectCls} disabled={off} value={p?.metals ?? 'All'}
                      onChange={(e) => updateScopedPermission(adminId, m.key, { metals: e.target.value })}>
                      {METAL_SCOPES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <select className={selectCls} disabled={off} value={p?.region ?? 'All'}
                      onChange={(e) => updateScopedPermission(adminId, m.key, { region: e.target.value })}>
                      {REGION_SCOPES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="py-2">
                    <select className={selectCls} disabled={off} value={p?.ceiling ?? 0}
                      onChange={(e) => updateScopedPermission(adminId, m.key, { ceiling: Number(e.target.value) })}>
                      {CEILINGS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-faint">
        <b>Hidden</b> removes the module from the Sub-Admin sidebar · <b>View</b> shows it read-only · <b>Act</b> allows work within scope
        (risky or over-ceiling actions route to <b>Approvals</b>) · <b>Act + Approve</b> executes directly. Switch to the Sub-Admin role to see gating live.
      </p>
    </div>
  );
}

export default function Team() {
  const { admins, toggleAdminActive, toggleAdminPermission, addAdmin } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'exec' | 'subadmin'>('subadmin');

  return (
    <div>
      <SectionTitle
        title="Admins & Permission Matrix" sub="Sub-Admin grants are scoped: module × action level × metal/region scope × ₹ ceiling"
        right={<Btn variant="accent" size="sm" onClick={() => setOpen(true)}><Plus size={14} /> New admin</Btn>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {admins.map((a) => (
          <Card key={a.id} className="p-5">
            <div className="flex items-start gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${a.role === 'exec' ? 'bg-ember-50 dark:bg-ember-400/10 text-ember-600 dark:text-ember-400' : 'bg-violet-50 dark:bg-violet-400/10 text-violet-600 dark:text-violet-400'}`}>
                {a.role === 'exec' ? <ShieldCheck size={20} /> : <UserCog size={20} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-ink">{a.name}</span>
                  <Badge tone={a.role === 'exec' ? 'bg-ember-50 dark:bg-ember-400/10 text-ember-700 dark:text-ember-300 ring-ember-200 dark:ring-ember-400/25' : 'bg-violet-50 dark:bg-violet-400/10 text-violet-700 dark:text-violet-300 ring-violet-200 dark:ring-violet-400/25'}>
                    {a.role === 'exec' ? 'Executive Admin' : 'Sub-Admin'}
                  </Badge>
                </div>
                <div className="text-xs text-faint">{a.email} · since {a.createdAt}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold ${a.active ? 'text-emerald-600 dark:text-emerald-400' : 'text-faint'}`}>{a.active ? 'ACTIVE' : 'DISABLED'}</span>
                <Toggle on={a.active} onChange={() => toggleAdminActive(a.id)} />
              </div>
            </div>
            {a.role === 'exec' ? (
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-4">
                {Object.entries(a.permissions).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted">{PERM_LABEL[k] ?? k}</span>
                    <Toggle on={v} onChange={() => toggleAdminPermission(a.id, k)} disabled={!a.active} />
                  </div>
                ))}
              </div>
            ) : (
              <ScopedMatrix adminId={a.id} />
            )}
          </Card>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Create admin">
        <div className="space-y-4">
          <Field label="Full name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Anita Desai" /></Field>
          <Field label="Email"><input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@ferrobid.in" /></Field>
          <Field label="Role">
            <div className="grid grid-cols-2 gap-2">
              {(['subadmin', 'exec'] as const).map((r) => (
                <button key={r} onClick={() => setRole(r)} className={`rounded-xl border px-3 py-2.5 text-xs font-bold cursor-pointer ${role === r ? 'border-steel-600 bg-steel-500/10 text-steel-800 dark:text-steel-200' : 'border-line text-muted hover:bg-surface-2'}`}>
                  {r === 'exec' ? 'Executive Admin' : 'Sub-Admin'}
                </button>
              ))}
            </div>
          </Field>
          <Btn variant="accent" className="w-full" disabled={!name || !email.includes('@')} onClick={() => { addAdmin(name, email, role); setOpen(false); setName(''); setEmail(''); }}>
            Create with default permissions
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
