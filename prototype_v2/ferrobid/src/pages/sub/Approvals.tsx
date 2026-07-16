/* Sub-admin approvals inbox — what you can clear yourself, what needs Super
   Admin, and a visual map of this role's module permissions. */
import { useState } from 'react'
import {
  BadgeCheck, Ban, CheckCircle2, Gavel, Landmark, Lock, Megaphone, Radar,
  Database, Users2, Activity, ListTodo, Inbox, LayoutDashboard,
} from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Avatar, Button, Chip, LockChip, PageHeader } from '../../components/ui'
import { useStore } from '../../store/store'
import { inr } from '../../lib/format'

/* ------------------------- hardcoded demo rows ---------------------------- */

const DRAFT_ANNOUNCEMENTS = [
  {
    id: 'draft-1',
    title: 'Scheduled maintenance — Sunday 02:00–04:00 IST',
    body: 'Bidding and wallet services will be briefly unavailable. Live catalogues are paused automatically and countdowns freeze for the window.',
    tone: 'info' as const,
  },
  {
    id: 'draft-2',
    title: 'Revised lifting hours at Jamshedpur yard',
    body: 'From next week, material lifting at the SAIL Jamshedpur yard moves to 09:00–17:00 IST. Gate passes issued for earlier slots remain valid.',
    tone: 'warning' as const,
  },
]

const VOID_REQUESTS = [
  {
    id: 'void-1',
    lot: 'LOT-07 · AUC-2412',
    firm: 'Shree Balaji Metals',
    rate: 47_800,
    uom: 'MT',
    reason: 'Rapid-fire pattern — 4 bids in 20s at exact minimum increment',
  },
  {
    id: 'void-2',
    lot: 'LOT-11 · AUC-2418',
    firm: 'Kanchan Ispat Udyog',
    rate: 52_150,
    uom: 'MT',
    reason: 'Bid retraction request — buyer cites fat-finger rate entry',
  },
]

const MODULES_LOCKED = [
  { name: 'Control Tower', icon: Radar, access: 'Read-only', note: 'Pause / extend / cancel auctions' },
  { name: 'Financial Config', icon: Landmark, access: 'No access', note: 'EMD %, TCS, settlement rules' },
  { name: 'Master Data', icon: Database, access: 'Read-only', note: 'Categories, yards, terms sets' },
  { name: 'User Management', icon: Users2, access: 'Read-only', note: 'Roles, resets, deactivation' },
  { name: 'Blacklist', icon: Ban, access: 'No access', note: 'Defaulter marking & EMD forfeit' },
]

const MODULES_FULL = [
  { name: 'Ops Console', icon: LayoutDashboard, note: 'Shift overview & audit feed' },
  { name: 'Bid Monitor', icon: Activity, note: 'Live surveillance & flagging' },
  { name: 'Work Queue', icon: ListTodo, note: 'SLA-tracked triage desk' },
  { name: 'Approvals', icon: Inbox, note: 'This inbox' },
]

export default function Approvals() {
  const users = useStore((s) => s.users)
  const notify = useStore((s) => s.notify)
  const audit = useStore((s) => s.audit)
  const pushToast = useStore((s) => s.pushToast)

  const [kycHandled, setKycHandled] = useState<Record<string, 'approved' | 'rejected'>>({})
  const [published, setPublished] = useState<Set<string>>(new Set())
  const [escalated, setEscalated] = useState<Set<string>>(new Set())

  const pendingKyc = users.filter((u) => u.kycStatus === 'pending')
  const watchlisted = users.find((u) => u.id === 'u-buyer-3')

  const decideKyc = (userId: string, firm: string, decision: 'approved' | 'rejected') => {
    setKycHandled((prev) => ({ ...prev, [userId]: decision }))
    if (decision === 'approved') {
      audit('kyc.approve', firm, 'Seller KYC verified from Approvals inbox')
      pushToast({ kind: 'success', title: 'KYC approved — user notified', body: firm })
    } else {
      audit('kyc.reject', firm, 'Seller KYC rejected — documents did not match GSTIN', 'warning')
      pushToast({ kind: 'warning', title: 'KYC rejected', body: `${firm} asked to resubmit documents.` })
    }
  }

  const publish = (draft: (typeof DRAFT_ANNOUNCEMENTS)[number]) => {
    notify({ userId: null, kind: 'system', title: draft.title, body: draft.body })
    setPublished((prev) => new Set(prev).add(draft.id))
    pushToast({ kind: 'success', title: 'Announcement published', body: 'Broadcast to all users via the notification bell.' })
  }

  const escalate = (id: string, what: string, detail: string) => {
    audit('approval.escalate', what, detail, 'warning')
    setEscalated((prev) => new Set(prev).add(id))
    pushToast({ kind: 'info', title: 'Sent to Super Admin', body: what })
  }

  return (
    <Page>
      <PageHeader
        title="Approvals"
        sub="Clear what sits inside your scope, package the rest for Super Admin sign-off."
        actions={<Chip tone="steel">{pendingKyc.filter((u) => !kycHandled[u.id]).length + DRAFT_ANNOUNCEMENTS.filter((d) => !published.has(d.id)).length} awaiting you</Chip>}
      />

      {/* --------------------- section 1: awaiting my approval ------------------ */}
      <section className="mb-8">
        <h2 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
          <BadgeCheck size={18} className="text-success" /> Awaiting my approval
        </h2>
        <div className="card overflow-hidden">
          <ul>
            {pendingKyc.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-line">
                <Avatar name={u.name} hue={u.avatarHue} size={34} />
                <div className="flex-1 min-w-52">
                  <div className="font-semibold text-sm">Seller KYC — {u.firm}</div>
                  <div className="text-xs text-ink-muted mt-0.5">
                    {u.name} · {u.city} · GSTIN <span className="num">{u.gstin}</span>
                  </div>
                </div>
                {kycHandled[u.id] ? (
                  <Chip tone={kycHandled[u.id] === 'approved' ? 'success' : 'danger'}>
                    {kycHandled[u.id] === 'approved' ? 'Approved' : 'Rejected'}
                  </Chip>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => decideKyc(u.id, u.firm, 'rejected')}>Reject</Button>
                    <Button variant="success" size="sm" onClick={() => decideKyc(u.id, u.firm, 'approved')}>Approve</Button>
                  </div>
                )}
              </li>
            ))}
            {DRAFT_ANNOUNCEMENTS.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-line last:border-0">
                <span className="size-9 rounded-xl bg-steel-soft text-steel-strong border border-line flex items-center justify-center shrink-0">
                  <Megaphone size={16} />
                </span>
                <div className="flex-1 min-w-52">
                  <div className="font-semibold text-sm">Announcement draft — {d.title}</div>
                  <div className="text-xs text-ink-muted mt-0.5 max-w-xl">{d.body}</div>
                </div>
                <Chip tone={d.tone === 'warning' ? 'warning' : 'steel'}>{d.tone}</Chip>
                {published.has(d.id)
                  ? <Chip tone="success">Published</Chip>
                  : <Button variant="steel" size="sm" onClick={() => publish(d)}>Publish</Button>}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* --------------------- section 2: requires super admin ------------------ */}
      <section className="mb-8">
        <h2 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
          <Gavel size={18} className="text-warning" /> Requires Super Admin
        </h2>
        <div className="card overflow-hidden">
          <ul>
            {VOID_REQUESTS.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-line">
                <span className="size-9 rounded-xl bg-warning-soft text-warning border border-line flex items-center justify-center shrink-0">
                  <Gavel size={16} />
                </span>
                <div className="flex-1 min-w-52">
                  <div className="font-semibold text-sm">
                    Void bid — <span className="num">{r.lot}</span> · {r.firm} at <span className="num">{inr(r.rate)}/{r.uom}</span>
                  </div>
                  <div className="text-xs text-ink-muted mt-0.5">From your flag: {r.reason}</div>
                </div>
                <LockChip label="Void requires Super Admin" />
                {escalated.has(r.id)
                  ? <Chip tone="steel">Sent</Chip>
                  : <Button variant="secondary" size="sm" onClick={() => escalate(r.id, `Void bid — ${r.lot}`, `${r.firm} · ${r.reason}`)}>Send to Super Admin</Button>}
              </li>
            ))}
            {watchlisted && (
              <li className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-3.5">
                <span className="size-9 rounded-xl bg-danger-soft text-danger border border-line flex items-center justify-center shrink-0">
                  <Ban size={16} />
                </span>
                <div className="flex-1 min-w-52">
                  <div className="font-semibold text-sm">Blacklist proposal — {watchlisted.firm}</div>
                  <div className="text-xs text-ink-muted mt-0.5">
                    Currently <Chip tone="warning" className="mx-1">watchlist</Chip> · propose moving to defaulter after repeated lifting delays.
                  </div>
                </div>
                <LockChip label="Blacklist requires Super Admin" />
                {escalated.has('blk-1')
                  ? <Chip tone="steel">Sent</Chip>
                  : <Button variant="secondary" size="sm" onClick={() => escalate('blk-1', `Blacklist proposal — ${watchlisted.firm}`, 'Watchlist → defaulter proposed: repeated lifting delays across 2 catalogues')}>Send to Super Admin</Button>}
              </li>
            )}
          </ul>
        </div>
      </section>

      {/* ------------------------ section 3: module access ---------------------- */}
      <section>
        <h2 className="font-display font-bold text-lg mb-1 flex items-center gap-2">
          <Lock size={16} className="text-ink-muted" /> Module access
        </h2>
        <p className="text-sm text-ink-muted mb-3">Your permission template — Sub-Admin (Ops). Changes to this template are made by Super Admin.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-3">
          {MODULES_FULL.map((m) => (
            <div key={m.name} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <m.icon size={18} className="text-success" />
                <Chip tone="success"><CheckCircle2 size={11} /> Full access</Chip>
              </div>
              <div className="font-semibold text-sm">{m.name}</div>
              <div className="text-xs text-ink-faint mt-0.5">{m.note}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {MODULES_LOCKED.map((m) => (
            <div key={m.name} className="card p-4 opacity-80">
              <div className="flex items-center justify-between mb-2">
                <m.icon size={18} className="text-ink-faint" />
                <LockChip label={m.access} />
              </div>
              <div className="font-semibold text-sm">{m.name}</div>
              <div className="text-xs text-ink-faint mt-0.5">{m.note}</div>
            </div>
          ))}
        </div>
      </section>
    </Page>
  )
}
