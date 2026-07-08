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
    verified: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    pending: 'bg-amber-50 text-amber-700 ring-amber-200',
    not_submitted: 'bg-slate-100 text-slate-500 ring-slate-300',
  };

  return (
    <div>
      <SectionTitle title="User Management" sub="All registered buyers and verified seller entities" />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs active={tab} onChange={setTab} tabs={[{ key: 'all', label: 'All users' }, { key: 'sellers', label: 'Verified sellers' }, { key: 'buyers', label: 'Buyers only' }]} />
        <div className="relative flex-1 min-w-52">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, business, phone, email…" className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-steel-500 focus:outline-none focus:ring-2 focus:ring-steel-100" />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto thin-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
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
                <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <div className="font-bold text-steel-950">{u.name}</div>
                    <div className="text-[11px] text-slate-400">{u.businessName ?? u.id}</div>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">
                    <div>{u.phone}</div>
                    <div className="text-slate-400">{u.email}</div>
                  </td>
                  <td className="px-5 py-3"><Badge tone={KYC_TONE[u.kycStatus]} className="capitalize">{u.kycStatus.replace('_', ' ')}</Badge></td>
                  <td className="px-5 py-3">
                    {u.sellerVerified
                      ? <Badge tone="bg-emerald-50 text-emerald-700 ring-emerald-200"><BadgeCheck size={11} /> Verified entity</Badge>
                      : <span className="text-xs text-slate-400">Buyer only</span>}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-400">{u.joinedAt}</td>
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
