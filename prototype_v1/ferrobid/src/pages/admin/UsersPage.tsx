import { useState } from 'react';
import { Search, BadgeCheck } from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Card, Badge, Toggle, Tabs } from '../../components/ui';

export default function UsersPage() {
  const { users, toggleUserActive } = useApp();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('all');

  const rows = users
    .filter((u) => !u.id.startsWith('b-'))
    .filter((u) => tab === 'all' || (tab === 'sellers' ? u.sellerVerified : !u.sellerVerified))
    .filter((u) => !q || (u.name + (u.businessName ?? '') + u.phone + (u.email ?? '')).toLowerCase().includes(q.toLowerCase()));

  const KYC_TONE: Record<string, string> = {
    verified: 'bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-400/25',
    pending: 'bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-400/25',
    not_submitted: 'bg-surface-3 text-muted ring-line-strong',
  };

  return (
    <div>
      <SectionTitle title="User Management" sub="All registered buyers and verified seller entities" />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs active={tab} onChange={setTab} tabs={[{ key: 'all', label: 'All users' }, { key: 'sellers', label: 'Verified sellers' }, { key: 'buyers', label: 'Buyers only' }]} />
        <div className="relative flex-1 min-w-52">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, business, phone, email…" className="w-full rounded-xl border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm focus:border-steel-500 focus:outline-none focus:ring-2 focus:ring-steel-500/25" />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto thin-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-bold uppercase tracking-wide text-faint">
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">KYC</th>
                <th className="px-5 py-3">Seller</th>
                <th className="px-5 py-3">Joined</th>
                <th className="px-5 py-3 text-right">Active</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-b border-line hover:bg-surface-2/60">
                  <td className="px-5 py-3">
                    <div className="font-bold text-ink">{u.name}</div>
                    <div className="text-[11px] text-faint">{u.businessName ?? u.id}</div>
                  </td>
                  <td className="px-5 py-3 text-xs text-muted">
                    <div>{u.phone}</div>
                    <div className="text-faint">{u.email}</div>
                  </td>
                  <td className="px-5 py-3"><Badge tone={KYC_TONE[u.kycStatus]} className="capitalize">{u.kycStatus.replace('_', ' ')}</Badge></td>
                  <td className="px-5 py-3">
                    {u.sellerVerified
                      ? <Badge tone="bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-400/25"><BadgeCheck size={11} /> Verified entity</Badge>
                      : <span className="text-xs text-faint">Buyer only</span>}
                  </td>
                  <td className="px-5 py-3 text-xs text-faint">{u.joinedAt}</td>
                  <td className="px-5 py-3 text-right"><Toggle on={u.active} onChange={() => toggleUserActive(u.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
