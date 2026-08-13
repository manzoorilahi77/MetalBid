/* ---------------------------------------------------------------------------
   All user accounts — held by the Sub Admin and the Super Admin.

   One screen, not a copy per role: administering accounts and resetting
   passwords is the Sub Admin's day-to-day job and the Super Admin's for support
   and recovery. Whoever acts is named in the audit entry, and two limits are
   enforced in the store rather than by hiding the screen — a Super Admin
   account can only be changed by another Super Admin, and a permanent ban needs
   the CEO's signature first.

   Every account of every role, with its KYC, its standing and what it is
   exposed to. The three actions that used to be cosmetic here now do the thing
   they say: **verify** writes the KYC decision and tells the seller, **suspend**
   stops the account signing in, and **reset password** issues a real credential,
   shown once.

   One rule sits under all of it: an account is never deleted. Suspending it,
   moving it to defaulter, even banning it, all leave the record — and the
   history behind every decision the account was part of — intact and readable.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Check, Copy, KeyRound, Power, Search, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Page } from '../../layout/Chrome'
import {
  Avatar, Button, Chip, Field, Input, Modal, PageHeader, Segmented, Select, Stat, Textarea, cx,
} from '../../components/ui'
import { ROLE_LABEL, useStore } from '../../store/store'
import { fmtDate, inrCompact, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type { AccountStatus, Standing, User } from '../../types'

/** The editable half of an account, seeded from the record. Kept as a plain
 *  projection so "has anything actually changed" is a string comparison rather
 *  than six of them. */
const startEdit = (u: User) => ({
  name: u.name, firm: u.firm, email: u.email, phone: u.phone, city: u.city, gstin: u.gstin,
})

const kycTone = { verified: 'success', pending: 'warning', none: 'neutral', rejected: 'danger' } as const
const standingTone = { good: 'success', watchlist: 'warning', defaulter: 'danger' } as const
const statusTone: Record<AccountStatus, 'success' | 'warning' | 'danger'> = {
  active: 'success', disabled: 'warning', suspended: 'warning', banned: 'danger',
}

export default function Users() {
  const now = useNow()
  const users = useStore((s) => s.users)
  const wallets = useStore((s) => s.wallets)
  const roles = useStore((s) => s.roleRegistry)
  const passwordResets = useStore((s) => s.passwordResets)
  const setUserStanding = useStore((s) => s.setUserStanding)
  const setAccountStatus = useStore((s) => s.setAccountStatus)
  const updateUserDetails = useStore((s) => s.updateUserDetails)
  const resetUserPassword = useStore((s) => s.resetUserPassword)
  const decideSellerKyc = useStore((s) => s.decideSellerKyc)
  const pushToast = useStore((s) => s.pushToast)

  const [q, setQ] = useState('')
  const [role, setRole] = useState('all')
  const [standing, setStanding] = useState('all')
  const [status, setStatus] = useState('all')
  const [managed, setManaged] = useState<User | null>(null)
  const [newStanding, setNewStanding] = useState<Standing>('good')
  const [reason, setReason] = useState('')
  const [resetMode, setResetMode] = useState<'auto' | 'manual'>('auto')
  const [manual, setManual] = useState('')
  const [issued, setIssued] = useState<{ password: string; name: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [edit, setEdit] = useState<ReturnType<typeof startEdit> | null>(null)

  const list = users.filter((u) => {
    if (q && !`${u.name} ${u.firm} ${u.city} ${u.gstin} ${u.email} ${u.username ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false
    if (role !== 'all' && u.role !== role) return false
    if (standing !== 'all' && u.standing !== standing) return false
    if (status !== 'all' && (u.accountStatus ?? 'active') !== status) return false
    return true
  })

  const buyers = users.filter((u) => u.role === 'buyer')
  const openResets = passwordResets.filter((r) => !r.consumed)
  const resetFor = (id: string) => passwordResets.find((r) => r.userId === id && !r.consumed)
  const managedStatus: AccountStatus = managed ? (managed.accountStatus ?? 'active') : 'active'
  const detailsDirty = !!managed && !!edit && JSON.stringify(edit) !== JSON.stringify(startEdit(managed))

  const say = (r: { ok: boolean; error?: string }, title: string, body?: string) => {
    if (!r.ok) pushToast({ kind: 'danger', title: 'Not done', body: r.error })
    else pushToast({ kind: 'success', title, body })
    return r.ok
  }

  return (
    <Page>
      <PageHeader
        title="All user accounts"
        sub="Every account of every role, with KYC, standing, exposure and sign-in state. Accounts are suspended, never deleted."
      />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Stat label="Total users" value={users.length} />
        <Stat label="Verified buyers" value={buyers.filter((u) => u.kycStatus === 'verified').length} tone="success" />
        <Stat label="Sellers" value={users.filter((u) => u.sellerVerified).length} tone="steel" />
        <Stat label="Not signing in" value={users.filter((u) => (u.accountStatus ?? 'active') !== 'active').length}
          tone={users.some((u) => (u.accountStatus ?? 'active') !== 'active') ? 'warning' : undefined} sub="suspended · disabled · banned" />
        <Stat label="Open password resets" value={openResets.length} tone={openResets.length ? 'ember' : undefined} sub="issued, not yet used" />
      </div>

      <div className="card p-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <Input className="h-9 w-56 pl-8 text-[13px]" placeholder="Name, firm, GSTIN, sign-in ID…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="h-9 w-44 text-[13px]" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="all">Role: all</option>
          {roles.filter((r) => r.key !== 'guest').map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </Select>
        <Select className="h-9 w-44 text-[13px]" value={standing} onChange={(e) => setStanding(e.target.value)}>
          <option value="all">Standing: all</option>
          <option value="good">Good</option><option value="watchlist">Watchlist</option><option value="defaulter">Defaulter</option>
        </Select>
        <Select className="h-9 w-44 text-[13px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Sign-in: all</option>
          <option value="active">Active</option><option value="disabled">Disabled</option>
          <option value="suspended">Suspended</option><option value="banned">Banned</option>
        </Select>
        <span className="num text-xs text-ink-faint ml-auto">{list.length} users</span>
      </div>

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-sm min-w-[940px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-line">
              <th className="px-5 py-2.5">User</th><th className="px-4 py-2.5">Role</th><th className="px-4 py-2.5">Bidder / Seller ID</th>
              <th className="px-4 py-2.5">KYC</th><th className="px-4 py-2.5">Standing</th><th className="px-4 py-2.5">Sign-in</th>
              <th className="px-4 py-2.5">Joined</th><th className="px-4 py-2.5 text-right">Wallet</th><th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.map((u) => {
              const w = wallets.find((x) => x.userId === u.id)
              const st = u.accountStatus ?? 'active'
              const pending = resetFor(u.id)
              return (
                <tr key={u.id} className={cx('hover:bg-surface-2/60', st !== 'active' && 'opacity-70')}>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={u.name} hue={u.avatarHue} size={30} />
                      <div>
                        <div className="font-semibold">{u.name}</div>
                        <div className="text-xs text-ink-faint">{u.firm} · {u.city}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><Chip tone="steel">{ROLE_LABEL[u.role] ?? u.role}</Chip></td>
                  <td className="px-4 py-2.5 num text-ink-muted">{u.bidderId ?? u.sellerId ?? '—'}</td>
                  <td className="px-4 py-2.5"><Chip tone={kycTone[u.kycStatus]}>{u.kycStatus}</Chip></td>
                  <td className="px-4 py-2.5"><Chip tone={standingTone[u.standing]}>{u.standing}</Chip></td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      <Chip tone={statusTone[st]}>{st}</Chip>
                      {pending && <Chip tone="ember"><KeyRound size={11} /> reset open</Chip>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 num text-ink-muted">{fmtDate(u.joinedAt)}</td>
                  <td className="px-4 py-2.5 num text-right font-semibold">{w ? inrCompact(w.balance + w.emdLocked) : '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button variant="ghost" size="sm"
                      onClick={() => { setManaged(u); setEdit(startEdit(u)); setNewStanding(u.standing); setReason(''); setResetMode('auto'); setManual('') }}>
                      Manage
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="card bg-surface-2 p-4 mt-6 text-[13px] text-ink-muted">
        <strong className="text-ink">A Sub Admin works this same list.</strong> Viewing, editing and resetting a password are shared —
        whoever acts is named in the{' '}
        <Link to="/admin/audit" className="text-ember font-semibold hover:underline">audit trail</Link> at critical severity. What is
        ours alone: suspending an account, and executing a{' '}
        <Link to="/admin/blacklist" className="text-ember font-semibold hover:underline">permanent ban</Link>, which the CEO signs
        first. A Super Admin's own password can only be reset by another Super Admin.
      </div>

      {/* ------------------------------ manage ------------------------------ */}
      <Modal open={!!managed} onClose={() => setManaged(null)} title={managed ? `Manage — ${managed.firm}` : ''} wide>
        {managed && (
          <div className="space-y-4">
            <div className="card bg-surface-2 border-0 p-4 grid sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <span className="text-ink-muted">Contact</span><span className="font-semibold">{managed.name} · <span className="num">{managed.phone}</span></span>
              <span className="text-ink-muted">Email / sign-in</span><span className="num font-semibold break-all">{managed.username ?? managed.email}</span>
              <span className="text-ink-muted">GSTIN</span><span className="num font-semibold">{managed.gstin}</span>
              <span className="text-ink-muted">{managed.role === 'seller' ? 'Seller ID' : 'Bidder ID'}</span>
              <span className="num font-semibold">{managed.bidderId ?? managed.sellerId ?? '—'}</span>
              <span className="text-ink-muted">KYC</span><Chip tone={kycTone[managed.kycStatus]} className="w-fit">{managed.kycStatus}</Chip>
              <span className="text-ink-muted">Sign-in</span><Chip tone={statusTone[managedStatus]} className="w-fit">{managedStatus}</Chip>
            </div>
            {managed.blacklistReason && (
              <div className="card border-danger/40 bg-danger-soft px-4 py-2.5 text-sm text-danger">{managed.blacklistReason}</div>
            )}
            {resetFor(managed.id) && (
              <div className="card bg-ember-soft/50 border-0 px-4 py-2.5 text-[13px]">
                A password was issued {relTime(resetFor(managed.id)!.at, now)} and has not been used yet. Issuing another replaces it.
              </div>
            )}

            {/* KYC — the decision four screens used to offer and none of them made */}
            {(managed.kycStatus === 'pending' || managed.kycStatus === 'rejected') && (
              <div className="card p-4">
                <h3 className="font-bold text-sm mb-1.5">Seller verification</h3>
                <p className="text-[13px] text-ink-muted mb-3">
                  Approving lets them submit lots. Their lots still stay private until Operations catalogues and publishes them, so this
                  is a verification, not a publication.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="success" size="sm"
                    onClick={() => { if (say(decideSellerKyc(managed.id, true), 'Seller verified', managed.firm)) setManaged(null) }}>
                    <ShieldCheck size={14} /> Verify KYC
                  </Button>
                  <Button variant="secondary" size="sm" disabled={!reason.trim()}
                    onClick={() => { if (say(decideSellerKyc(managed.id, false, reason.trim()), 'Sent back', 'They are told exactly what to resubmit.')) setManaged(null) }}>
                    Send back with the reason below
                  </Button>
                </div>
              </div>
            )}

            {/* Edit — the other half of "view and edit any account". Contact
                details go stale constantly and a support call is where that is
                found out, so correcting one lives beside the standing and the
                password rather than on a screen of its own. */}
            {edit ? (
              <div className="card p-4">
                <h3 className="font-bold text-sm mb-3">Account details</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Name"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
                  <Field label="Firm"><Input value={edit.firm} onChange={(e) => setEdit({ ...edit, firm: e.target.value })} /></Field>
                  <Field label="Email"><Input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
                  <Field label="Phone"><Input className="num" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
                  <Field label="City"><Input value={edit.city} onChange={(e) => setEdit({ ...edit, city: e.target.value })} /></Field>
                  <Field label="GSTIN"><Input className="num" value={edit.gstin} onChange={(e) => setEdit({ ...edit, gstin: e.target.value })} /></Field>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Button size="sm" disabled={!detailsDirty}
                    onClick={() => { if (say(updateUserDetails(managed.id, edit), 'Account details saved', 'Recorded in the audit trail with the before and after.')) setEdit(startEdit(managed)) }}>
                    Save details
                  </Button>
                  {detailsDirty && <Button size="sm" variant="ghost" onClick={() => setEdit(startEdit(managed))}>Discard</Button>}
                  <span className="text-xs text-ink-faint ml-auto">
                    The bidder and seller IDs are permanent and never editable — a seller has to keep resolving to the buyer who won.
                  </span>
                </div>
              </div>
            ) : null}

            <Field label="Standing">
              <Segmented<Standing> value={newStanding} onChange={setNewStanding}
                options={[{ key: 'good', label: 'Good' }, { key: 'watchlist', label: 'Watchlist' }, { key: 'defaulter', label: 'Defaulter' }]} />
            </Field>
            <Field label="Reason" hint="Shown on the account and recorded in the audit trail. Required for a standing change, a suspension or a KYC rejection.">
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. failed to lift material within validity on AUC-2412" />
            </Field>

            <div className="flex gap-2 flex-wrap items-center">
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
              <Button variant="secondary" size="sm"
                onClick={() => {
                  const r = resetUserPassword(managed.id, resetMode, manual)
                  if (!r.ok) { pushToast({ kind: 'danger', title: 'Not reset', body: r.error }); return }
                  const name = managed.name
                  setManaged(null); setManual(''); setCopied(false)
                  setIssued({ password: r.password!, name })
                }}>
                <KeyRound size={14} /> Reset password
              </Button>
              <Segmented<'auto' | 'manual'> value={resetMode} onChange={setResetMode} options={[
                { key: 'auto', label: 'Generate' }, { key: 'manual', label: 'Set by hand' },
              ]} />
              {resetMode === 'manual' && (
                <Input className="num h-9 w-56" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="8+ chars, a capital and a digit" />
              )}
              <Button variant="ghost" className={cx('ml-auto', managedStatus === 'active' ? 'text-danger' : 'text-success')}
                onClick={() => {
                  const next: AccountStatus = managedStatus === 'active' ? 'suspended' : 'active'
                  if (say(setAccountStatus(managed.id, next, reason.trim() || undefined),
                    next === 'suspended' ? 'Account suspended' : 'Account active again',
                    next === 'suspended' ? `${managed.firm} can no longer sign in. Nothing they have done is reversed.` : `${managed.firm} can sign in again.`)) setManaged(null)
                }}>
                <Power size={14} /> {managedStatus === 'active' ? 'Suspend account' : 'Reinstate account'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* --------------------------- password reveal --------------------------- */}
      <Modal open={!!issued} onClose={() => setIssued(null)} title={issued ? `Password for ${issued.name}` : ''}>
        {issued && (
          <div className="space-y-4">
            <div className="card bg-warning-soft border-0 p-4 text-sm">
              <b>Shown once.</b> Pass it on over a channel you trust. At their next sign-in they are asked whether to keep it or set
              their own.
            </div>
            <div className="card bg-surface-2 border-0 p-4 flex items-center gap-3">
              <span className="num text-xl font-bold tracking-wide flex-1 break-all">{issued.password}</span>
              <Button variant="secondary" size="sm"
                onClick={async () => {
                  try { await navigator.clipboard.writeText(issued.password); setCopied(true) } catch { /* blocked — it is on screen */ }
                }}>
                {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
              </Button>
            </div>
            <Button className="w-full" onClick={() => setIssued(null)}>I have passed it on</Button>
          </div>
        )}
      </Modal>
    </Page>
  )
}
