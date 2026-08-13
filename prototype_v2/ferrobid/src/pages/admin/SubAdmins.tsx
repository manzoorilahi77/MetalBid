/* ---------------------------------------------------------------------------
   Super Admin — Sub Admin accounts.

   Blocking item #3 on the build list: the platform shipped with one fixed Sub
   Admin account and an "Invite teammate" button that created nothing. This
   creates real accounts with real credentials, any number of them.

   Every Sub Admin account is identical — the same full menu, the same powers.
   There are deliberately no per-account permission templates: work is divided
   by *assignment*, on the work queue, not by capability. That is why this
   screen shows what each one has handled rather than what each one may do.

   The CEO is notified when an account is created. They do not approve it.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, KeyRound, Power, ShieldCheck, UserPlus } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Avatar, Button, Chip, Field, Input, Modal, PageHeader, Segmented, Stat, cx,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDate, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type { User } from '../../types'

/** One issued password, shown once and never again. */
function PasswordReveal({ password, onDone }: { password: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="space-y-4">
      <div className="card bg-warning-soft border-0 p-4 text-sm">
        <b>This is the only time this password is shown.</b> Give it to them over a channel you trust. At their next sign-in they are
        asked whether to keep it or set their own.
      </div>
      <div className="card bg-surface-2 border-0 p-4 flex items-center gap-3">
        <span className="num text-xl font-bold tracking-wide flex-1 break-all">{password}</span>
        <Button variant="secondary" size="sm"
          onClick={async () => {
            try { await navigator.clipboard.writeText(password); setCopied(true) } catch { /* clipboard blocked — it is on screen */ }
          }}>
          {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
        </Button>
      </div>
      <Button className="w-full" onClick={onDone}>I have passed it on</Button>
    </div>
  )
}

export default function SubAdmins() {
  const now = useNow()
  const users = useStore((s) => s.users)
  const auditEvents = useStore((s) => s.auditEvents)
  const structuralChanges = useStore((s) => s.structuralChanges)
  const disputes = useStore((s) => s.disputes)
  const createSubAdmin = useStore((s) => s.createSubAdmin)
  const setAccountStatus = useStore((s) => s.setAccountStatus)
  const resetUserPassword = useStore((s) => s.resetUserPassword)
  const pushToast = useStore((s) => s.pushToast)

  const [createOpen, setCreateOpen] = useState(false)
  const [draft, setDraft] = useState({ name: '', username: '', email: '', phone: '', city: '' })
  const [issued, setIssued] = useState<{ password: string; name: string } | null>(null)
  const [resetting, setResetting] = useState<User | null>(null)
  const [mode, setMode] = useState<'auto' | 'manual'>('auto')
  const [manual, setManual] = useState('')

  const subAdmins = users.filter((u) => u.role === 'sub_admin')
  const activeCount = subAdmins.filter((u) => (u.accountStatus ?? 'active') === 'active').length
  const workHandled = (id: string) => auditEvents.filter((e) => e.actorId === id).length
  const lastAction = (id: string) => auditEvents.find((e) => e.actorId === id)?.at
  const openDisputes = disputes.filter((d) => d.status !== 'resolved').length

  const say = (r: { ok: boolean; error?: string }, title: string, body?: string) => {
    if (!r.ok) pushToast({ kind: 'danger', title: 'Not done', body: r.error })
    else pushToast({ kind: 'success', title, body })
    return r.ok
  }

  return (
    <Page>
      <PageHeader
        title="Sub Admin accounts"
        sub="The people who run the operation day to day. Any number of accounts, all identical — work is divided by assignment on the queue, never by capability."
        actions={<Button onClick={() => { setDraft({ name: '', username: '', email: '', phone: '', city: '' }); setCreateOpen(true) }}><UserPlus size={15} /> Create account</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Sub Admins" value={subAdmins.length} tone="ember" sub="no limit" />
        <Stat label="Active right now" value={activeCount} tone="success" />
        <Stat label="Disabled" value={subAdmins.length - activeCount} tone={subAdmins.length - activeCount ? 'warning' : undefined} />
        <Stat label="Open disputes on the desk" value={openDisputes} to="/sub/queue" sub="shared across all accounts" />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {subAdmins.map((u) => {
          const status = u.accountStatus ?? 'active'
          const last = lastAction(u.id) ?? u.lastActiveAt
          const changes = structuralChanges.filter((c) => c.byId === u.id).length
          return (
            <div key={u.id} className={cx('card p-4', status !== 'active' && 'opacity-70 border-warning/40')}>
              <div className="flex items-start gap-3">
                <Avatar name={u.name} hue={u.avatarHue} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold truncate">{u.name}</span>
                    {status === 'active'
                      ? <Chip tone="success">Active</Chip>
                      : <Chip tone="warning">{status}</Chip>}
                  </div>
                  <div className="num text-xs text-ink-faint mt-0.5">
                    {u.username ?? u.email} · created {fmtDate(u.joinedAt)}
                  </div>
                  <div className="text-[13px] text-ink-muted mt-2">
                    <span className="num font-bold text-ink">{workHandled(u.id)}</span> recorded actions
                    {changes > 0 && <> · <span className="num font-bold text-ink">{changes}</span> structural</>}
                    {last && <> · last active {relTime(last, now)}</>}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-line">
                <Button variant="ghost" size="sm" onClick={() => { setResetting(u); setMode('auto'); setManual('') }}>
                  <KeyRound size={14} /> Reset password
                </Button>
                <Link to={`/admin/audit?actor=${u.id}`} className="text-[13px] font-semibold text-ink-muted hover:text-ink self-center px-2">View activity</Link>
                <Button variant="ghost" size="sm" className={cx('ml-auto', status === 'active' ? 'text-danger' : 'text-success')}
                  onClick={() => say(
                    setAccountStatus(u.id, status === 'active' ? 'disabled' : 'active', status === 'active' ? 'Disabled by Super Admin' : 'Re-enabled by Super Admin'),
                    status === 'active' ? `${u.name} disabled` : `${u.name} re-enabled`,
                    status === 'active' ? 'They can no longer sign in. Nothing they have done is reversed.' : 'They can sign in again.',
                  )}>
                  <Power size={14} /> {status === 'active' ? 'Disable' : 'Re-enable'}
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="card border-l-4 border-l-steel p-4 mt-8 text-[13px] text-ink-muted">
        <strong className="text-ink">What a Sub Admin can and cannot do.</strong> They run the whole pre-auction pipeline, publish and
        run the auction, verify sellers, administer accounts and handle support — anything an operational role can do, they can do or
        review. They cannot void a bid, execute a money movement (they see every deposit, withdrawal and commission and may recommend;{' '}
        <Link to="/finance" className="text-ember font-semibold hover:underline">Finance</Link> approves and processes), ban an account
        permanently, change{' '}
        <Link to="/admin/finance" className="text-ember font-semibold hover:underline">financial configuration</Link> or master data, or
        create another Sub Admin. Those are ours.
      </div>

      {/* ------------------------------ create ------------------------------ */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create a Sub Admin account">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Full name"><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Rohit Sen" /></Field>
            <Field label="Sign-in ID"><Input className="num" value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} placeholder="rohit.sen" /></Field>
            <Field label="Work email"><Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="name@ferrobid.in" /></Field>
            <Field label="Phone"><Input className="num" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="+91 98200 00000" /></Field>
            <Field label="Base city"><Input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} placeholder="Mumbai" /></Field>
          </div>
          <div className="card bg-surface-2 border-0 p-3.5 text-[13px] text-ink-muted">
            <ShieldCheck size={14} className="inline mr-1.5 text-steel" />
            The account gets the full Sub Admin menu — there is nothing to configure. A password is generated and shown once. The CEO is
            told the account exists; they do not approve it.
          </div>
          <Button className="w-full" disabled={!draft.name.trim() || !draft.username.trim() || !draft.email.trim()}
            onClick={() => {
              const r = createSubAdmin(draft)
              if (!r.ok) { pushToast({ kind: 'danger', title: 'Not created', body: r.error }); return }
              setCreateOpen(false)
              setIssued({ password: r.password!, name: draft.name.trim() })
            }}>
            Create account
          </Button>
        </div>
      </Modal>

      {/* --------------------------- password reveal --------------------------- */}
      <Modal open={!!issued} onClose={() => setIssued(null)} title={issued ? `Password for ${issued.name}` : ''}>
        {issued && <PasswordReveal password={issued.password} onDone={() => setIssued(null)} />}
      </Modal>

      {/* ------------------------------- reset ------------------------------- */}
      <Modal open={!!resetting} onClose={() => setResetting(null)} title={resetting ? `Reset password — ${resetting.name}` : ''}>
        {resetting && (
          <div className="space-y-4">
            <Segmented<'auto' | 'manual'> value={mode} onChange={setMode} stretch options={[
              { key: 'auto', label: 'Generate a strong one' },
              { key: 'manual', label: 'Set it myself' },
            ]} />
            {mode === 'manual' && (
              <Field label="New password" hint="At least 8 characters, with a capital letter and a digit.">
                <Input className="num" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Give it to them over a trusted channel" />
              </Field>
            )}
            <p className="text-[13px] text-ink-muted">
              Recorded at critical severity in the audit trail. At their next sign-in they are asked: keep this password, or set a new one?
            </p>
            <Button className="w-full"
              onClick={() => {
                const r = resetUserPassword(resetting.id, mode, manual)
                if (!r.ok) { pushToast({ kind: 'danger', title: 'Not reset', body: r.error }); return }
                const name = resetting.name
                setResetting(null); setManual('')
                setIssued({ password: r.password!, name })
              }}>
              Reset password
            </Button>
          </div>
        )}
      </Modal>
    </Page>
  )
}
