import { useState } from 'react';
import { Plus, ShieldCheck, UserCog } from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Card, Badge, Btn, Modal, Field, inputCls, Toggle } from '../../components/ui';

const PERM_LABEL: Record<string, string> = {
  entityVerification: 'Entity verification', lotVerification: 'Lot verification', auctionCreation: 'Auction creation',
  settlement: 'Settlement', logistics: 'Logistics', handover: 'Handover',
  manageAuctions: 'Manage auctions', manageLots: 'Manage lots', manageUsers: 'Manage users',
  manageCatalogue: 'Manage catalogue', viewAudit: 'View audit log', systemConfig: 'System config',
};

export default function Team() {
  const { admins, toggleAdminActive, toggleAdminPermission, addAdmin } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'exec' | 'subadmin'>('subadmin');

  return (
    <div>
      <SectionTitle
        title="Admins & Permission Matrix" sub="Create and manage Executive Admins and Sub-Admins"
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
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-4">
              {Object.entries(a.permissions).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted">{PERM_LABEL[k] ?? k}</span>
                  <Toggle on={v} onChange={() => toggleAdminPermission(a.id, k)} disabled={!a.active} />
                </div>
              ))}
            </div>
            {a.role === 'subadmin' && <p className="mt-3 text-[11px] text-faint">Sub-Admin menus & actions are visually gated by this matrix — try toggling and switching to the Sub-Admin role.</p>}
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
