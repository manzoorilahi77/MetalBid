/* Super Admin — user management. */
import { useState } from 'react'
import { Search } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Avatar, Button, Chip, Field, Input, Modal, PageHeader, Segmented, Select, Stat, Textarea, cx,
} from '../../components/ui'
import { ROLE_LABEL, useStore } from '../../store/store'
import { fmtDate, inrCompact } from '../../lib/format'
import type { Standing, User } from '../../types'

const kycTone = { verified: 'success', pending: 'warning', none: 'neutral', rejected: 'danger' } as const
const standingTone = { good: 'success', watchlist: 'warning', defaulter: 'danger' } as const

export default function Users() {
  const users = useStore((s) => s.users)
  const wallets = useStore((s) => s.wallets)
  const setUserStanding = useStore((s) => s.setUserStanding)
  const pushToast = useStore((s) => s.pushToast)

  const [q, setQ] = useState('')
  const [role, setRole] = useState('all')
  const [standing, setStanding] = useState('all')
  const [managed, setManaged] = useState<User | null>(null)
  const [newStanding, setNewStanding] = useState<Standing>('good')
  const [reason, setReason] = useState('')

  const list = users.filter((u) => {
    if (q && !`${u.name} ${u.firm} ${u.city} ${u.gstin}`.toLowerCase().includes(q.toLowerCase())) return false
    if (role !== 'all' && u.role !== role) return false
    if (standing !== 'all' && u.standing !== standing) return false
    return true
  })

  const buyers = users.filter((u) => u.role === 'buyer')

  return (
    <Page>
      <PageHeader title="User management" sub="Buyers, sellers and their KYC, standing and wallet exposure." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Total users" value={users.length} />
        <Stat label="Verified buyers" value={buyers.filter((u) => u.kycStatus === 'verified').length} tone="success" />
        <Stat label="Sellers" value={users.filter((u) => u.sellerVerified).length} tone="steel" />
        <Stat label="Defaulters" value={users.filter((u) => u.standing === 'defaulter').length} tone="danger" />
      </div>

      <div className="card p-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <Input className="h-9 w-56 pl-8 text-[13px]" placeholder="Name, firm, GSTIN…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="h-9 w-44 text-[13px]" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="all">Role: all</option>
          {Object.entries(ROLE_LABEL).filter(([k]) => k !== 'guest').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select className="h-9 w-44 text-[13px]" value={standing} onChange={(e) => setStanding(e.target.value)}>
          <option value="all">Standing: all</option>
          <option value="good">Good</option><option value="watchlist">Watchlist</option><option value="defaulter">Defaulter</option>
        </Select>
        <span className="num text-xs text-ink-faint ml-auto">{list.length} users</span>
      </div>

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-line">
              <th className="px-5 py-2.5">User</th><th className="px-4 py-2.5">Role</th><th className="px-4 py-2.5">City</th>
              <th className="px-4 py-2.5">KYC</th><th className="px-4 py-2.5">Standing</th><th className="px-4 py-2.5">Joined</th>
              <th className="px-4 py-2.5 text-right">Wallet</th><th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.map((u) => {
              const w = wallets.find((x) => x.userId === u.id)
              return (
                <tr key={u.id} className="hover:bg-surface-2/60">
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={u.name} hue={u.avatarHue} size={30} />
                      <div>
                        <div className="font-semibold">{u.name}</div>
                        <div className="text-xs text-ink-faint">{u.firm}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><Chip tone="steel">{ROLE_LABEL[u.role]}</Chip></td>
                  <td className="px-4 py-2.5 text-ink-muted">{u.city}</td>
                  <td className="px-4 py-2.5"><Chip tone={kycTone[u.kycStatus]}>{u.kycStatus}</Chip></td>
                  <td className="px-4 py-2.5"><Chip tone={standingTone[u.standing]}>{u.standing}</Chip></td>
                  <td className="px-4 py-2.5 num text-ink-muted">{fmtDate(u.joinedAt)}</td>
                  <td className="px-4 py-2.5 num text-right font-semibold">{w ? inrCompact(w.balance + w.emdLocked) : '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setManaged(u); setNewStanding(u.standing); setReason('') }}>Manage</Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Modal open={!!managed} onClose={() => setManaged(null)} title={managed ? `Manage — ${managed.firm}` : ''}>
        {managed && (
          <div className="space-y-4">
            <div className="card bg-surface-2 border-0 p-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <span className="text-ink-muted">Contact</span><span className="font-semibold">{managed.name} · <span className="num">{managed.phone}</span></span>
              <span className="text-ink-muted">GSTIN</span><span className="num font-semibold">{managed.gstin}</span>
              <span className="text-ink-muted">KYC</span><Chip tone={kycTone[managed.kycStatus]} className="w-fit">{managed.kycStatus}</Chip>
              <span className="text-ink-muted">Seller</span><span className="font-semibold">{managed.sellerVerified ? 'Verified seller' : '—'}</span>
            </div>
            {managed.blacklistReason && (
              <div className="card border-danger/40 bg-danger-soft px-4 py-2.5 text-sm text-danger">{managed.blacklistReason}</div>
            )}
            <Field label="Standing">
              <Segmented<Standing> value={newStanding} onChange={setNewStanding}
                options={[{ key: 'good', label: 'Good' }, { key: 'watchlist', label: 'Watchlist' }, { key: 'defaulter', label: 'Defaulter' }]} />
            </Field>
            {newStanding !== managed.standing && (
              <Field label="Reason (recorded in audit trail)">
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. failed to lift material within validity on AUC-2412" />
              </Field>
            )}
            <div className={cx('flex gap-2 flex-wrap')}>
              {newStanding !== managed.standing && (
                <Button variant={newStanding === 'defaulter' ? 'danger' : 'primary'} disabled={!reason.trim()}
                  onClick={() => {
                    setUserStanding(managed.id, newStanding, reason.trim())
                    pushToast({ kind: newStanding === 'good' ? 'success' : 'warning', title: `Standing → ${newStanding}`, body: managed.firm })
                    setManaged(null)
                  }}>
                  Apply standing change
                </Button>
              )}
              {managed.kycStatus === 'pending' && (
                <Button variant="success" onClick={() => { pushToast({ kind: 'success', title: 'KYC verified (demo)', body: managed.firm }); setManaged(null) }}>Verify KYC</Button>
              )}
              <Button variant="ghost" className="text-danger ml-auto"
                onClick={() => { pushToast({ kind: 'warning', title: 'Account suspended (demo)', body: `${managed.firm} can no longer sign in.` }); setManaged(null) }}>
                Suspend account
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  )
}
