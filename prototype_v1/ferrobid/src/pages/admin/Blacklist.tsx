import { useState } from 'react';
import { ShieldAlert, UserX, Eye, RotateCcw, TriangleAlert, Search } from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Card, Badge, Btn, Modal, Field, inputCls, Toggle, Stat } from '../../components/ui';
import type { UserStanding } from '../../types';
import { cx } from '../../utils';

const STANDING_TONE: Record<UserStanding, string> = {
  good: 'tone-emerald',
  watchlist: 'bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-400/25',
  suspended: 'bg-orange-50 dark:bg-orange-400/10 text-orange-700 dark:text-orange-300 ring-orange-200 dark:ring-orange-400/25',
  blacklisted: 'bg-red-50 dark:bg-red-400/10 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-400/25',
};

/** Blacklist & defaulter management with the auto-suspend rule (WBS v3.1 F44). */
export default function Blacklist() {
  const { users, config, setUserStanding, recordDefault, updateConfig } = useApp();
  const [target, setTarget] = useState<{ id: string; name: string; standing: UserStanding } | null>(null);
  const [reason, setReason] = useState('');
  const [q, setQ] = useState('');

  const risk = config.risk;
  const flagged = users.filter((u) => (u.standing ?? 'good') !== 'good');
  const rows = users.filter((u) => !q || u.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.defaults ?? 0) - (a.defaults ?? 0));

  const apply = () => {
    if (!target || (!reason.trim() && target.standing !== 'good')) return;
    setUserStanding(target.id, target.standing, reason);
    setTarget(null);
    setReason('');
  };

  return (
    <div>
      <SectionTitle
        title="Blacklist & Defaulters"
        sub="Risk & trust controls — watchlist, suspend or blacklist participants; defaults feed the auto-suspend rule"
        right={<Badge tone={STANDING_TONE.blacklisted}><ShieldAlert size={12} /> {flagged.length} flagged accounts</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Watchlist" value={users.filter((u) => u.standing === 'watchlist').length} icon={<Eye size={18} />} accent="bg-amber-500/10 text-amber-600 dark:text-amber-400" />
        <Stat label="Suspended" value={users.filter((u) => u.standing === 'suspended').length} icon={<UserX size={18} />} accent="bg-orange-500/10 text-orange-600 dark:text-orange-400" />
        <Stat label="Blacklisted" value={users.filter((u) => u.standing === 'blacklisted').length} icon={<ShieldAlert size={18} />} accent="bg-red-500/10 text-red-600 dark:text-red-400" />
      </div>

      <Card className="mt-4 flex flex-wrap items-center gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400"><TriangleAlert size={18} /></div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-ink">Auto-suspend rule</div>
          <div className="text-xs text-muted">Automatically suspend an account when payment defaults reach the threshold.</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted">Suspend after</span>
          <select
            value={risk.autoSuspendAfterDefaults}
            onChange={(e) => updateConfig('risk', 'autoSuspendAfterDefaults', Number(e.target.value))}
            className="rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-xs font-bold text-ink focus:outline-none"
          >
            {[1, 2, 3, 5].map((n) => <option key={n} value={n}>{n} default{n > 1 ? 's' : ''}</option>)}
          </select>
          <Toggle on={risk.autoSuspendEnabled} onChange={() => updateConfig('risk', 'autoSuspendEnabled', !risk.autoSuspendEnabled)} />
        </div>
      </Card>

      <div className="relative mt-5 mb-3 max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search participants…" className="w-full rounded-xl border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-steel-500/25" />
      </div>

      <div className="space-y-2.5">
        {rows.map((u) => {
          const standing = u.standing ?? 'good';
          return (
            <Card key={u.id} className={cx('flex flex-wrap items-center gap-3 p-4', standing === 'blacklisted' && 'ring-red-200 dark:ring-red-400/25')}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-ink">{u.name}</span>
                  <Badge tone={STANDING_TONE[standing]} className="capitalize">{standing}</Badge>
                  {(u.defaults ?? 0) > 0 && <Badge tone="bg-surface-3 text-muted ring-line-strong">{u.defaults} default{(u.defaults ?? 0) > 1 ? 's' : ''}</Badge>}
                </div>
                <div className="text-xs text-faint">{u.phone}{u.businessName && <> · {u.businessName}</>}</div>
                {u.standingReason && <div className="mt-1 text-[11px] text-muted italic">“{u.standingReason}”</div>}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Btn size="sm" variant="ghost" onClick={() => recordDefault(u.id)} className="!text-faint" >+ Record default (sim)</Btn>
                {standing !== 'good' && (
                  <Btn size="sm" variant="outline" onClick={() => { setUserStanding(u.id, 'good', 'Standing cleared after review'); }}><RotateCcw size={12} /> Clear</Btn>
                )}
                {standing !== 'watchlist' && standing !== 'blacklisted' && (
                  <Btn size="sm" variant="outline" onClick={() => setTarget({ id: u.id, name: u.name, standing: 'watchlist' })}><Eye size={12} /> Watchlist</Btn>
                )}
                {standing !== 'suspended' && standing !== 'blacklisted' && (
                  <Btn size="sm" variant="outline" onClick={() => setTarget({ id: u.id, name: u.name, standing: 'suspended' })}><UserX size={12} /> Suspend</Btn>
                )}
                {standing !== 'blacklisted' && (
                  <Btn size="sm" variant="danger" onClick={() => setTarget({ id: u.id, name: u.name, standing: 'blacklisted' })}><ShieldAlert size={12} /> Blacklist</Btn>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={!!target} onClose={() => { setTarget(null); setReason(''); }} title={`${target?.standing === 'watchlist' ? 'Add to watchlist' : target?.standing === 'suspended' ? 'Suspend' : 'Blacklist'} — ${target?.name ?? ''}`}>
        <div className="space-y-4">
          {target?.standing === 'blacklisted' && (
            <p className="rounded-lg bg-red-50 dark:bg-red-400/10 px-3 py-2 text-xs text-red-800 dark:text-red-200 ring-1 ring-red-200 dark:ring-red-400/25">
              Blacklisting blocks login, bidding and listing. EMDs in live auctions are released per policy (mock).
            </p>
          )}
          <Field label="Reason (mandatory — recorded in the audit trail)">
            <textarea className={inputCls} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Repeated payment defaults and unresponsive to notices." />
          </Field>
          <Btn variant="danger" className="w-full" disabled={!reason.trim()} onClick={apply}>Confirm</Btn>
        </div>
      </Modal>
    </div>
  );
}
