/* ---------------------------------------------------------------------------
   Super Admin — Roles.

   The first screen in our menu, because a role has to exist before anyone can
   hold it and before a page can be attached to it. This replaces the old
   "Team & permissions" screen, whose matrix was a picture of the permission
   model rather than the model itself: the counts, pages and holders below are
   read from the live role and page registries, so the table cannot describe a
   platform that isn't there.

   Four operations, and one rule under all of them: **an account is never
   deleted.** Removing a role suspends everyone holding it and keeps the role on
   the record, so restoring it puts the same people back exactly where they were.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Layers, Plus, RotateCcw, Shield, Trash2, Users as UsersIcon } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Avatar, Button, Chip, EmptyState, Field, Input, Modal, PageHeader, Stat, Textarea, cx,
} from '../../components/ui'
import { ROLE_LABEL, useStore, visiblePages } from '../../store/store'
import { relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type { RoleDef } from '../../types'

/** Roles that exist to render the public site rather than to be held by a
 *  person — shown, but never counted as staff or offered for removal. */
const PUBLIC_ROLES = new Set(['guest', 'guest1', 'guest2'])

export default function Roles() {
  const now = useNow()
  const roles = useStore((s) => s.roleRegistry)
  const pages = useStore((s) => s.pageRegistry)
  const users = useStore((s) => s.users)
  const catalogues = useStore((s) => s.catalogues)
  const addRole = useStore((s) => s.addRole)
  const removeRole = useStore((s) => s.removeRole)
  const duplicateRole = useStore((s) => s.duplicateRole)
  const restoreRole = useStore((s) => s.restoreRole)
  const pushToast = useStore((s) => s.pushToast)

  const [addOpen, setAddOpen] = useState(false)
  const [draft, setDraft] = useState({ label: '', home: '', note: '' })
  const [removing, setRemoving] = useState<RoleDef | null>(null)
  const [reason, setReason] = useState('')
  const [duplicating, setDuplicating] = useState<RoleDef | null>(null)
  const [copyName, setCopyName] = useState('')

  const active = roles.filter((r) => r.status === 'active')
  const removed = roles.filter((r) => r.status === 'removed')
  const staffRoles = active.filter((r) => !PUBLIC_ROLES.has(r.key))
  const holdersOf = (key: string) => users.filter((u) => u.role === key)
  const liveNow = catalogues.filter((c) => c.status === 'live')

  const say = (r: { ok: boolean; error?: string }, title: string, body?: string) => {
    if (!r.ok) pushToast({ kind: 'danger', title: 'Not done', body: r.error })
    else pushToast({ kind: 'success', title, body })
    return r.ok
  }

  return (
    <Page>
      <PageHeader
        title="Roles"
        sub="Every role on the platform, who holds it, and what it can open. Adding a role creates its default pages; removing one suspends its accounts and never deletes them."
        actions={<Button onClick={() => { setDraft({ label: '', home: '', note: '' }); setAddOpen(true) }}><Plus size={15} /> Add a role</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Roles in use" value={staffRoles.length} tone="ember" sub="excluding the public shells" />
        <Stat label="Staff accounts" value={users.filter((u) => !['buyer', 'seller'].includes(u.role) && !PUBLIC_ROLES.has(u.role)).length} />
        <Stat label="Menu entries" value={pages.length} tone="steel" sub={<Link className="text-ember font-semibold hover:underline" to="/admin/pages">Page manager</Link>} />
        <Stat label="Removed roles" value={removed.length} tone={removed.length ? 'warning' : undefined} sub="restorable in full" />
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {active.map((r) => {
          const holders = holdersOf(r.key)
          const menu = visiblePages(pages, r.key)
          const isSuper = r.key === 'super_admin'
          const isPublic = PUBLIC_ROLES.has(r.key)
          const blockedByLive = ['auction_manager', 'exec_manager', 'sub_admin'].includes(r.key) && liveNow.length > 0
          return (
            <div key={r.key} className={cx('card p-4 flex flex-col', isSuper && 'border-ember/40')}>
              <div className="flex items-start gap-2 flex-wrap">
                <span className="font-bold">{r.label}</span>
                {isSuper && <Chip tone="ember"><Shield size={11} /> Ours</Chip>}
                {r.builtIn ? <Chip tone="neutral">Built in</Chip> : <Chip tone="steel">Added here</Chip>}
                {r.basedOn && <Chip tone="steel">copy of {ROLE_LABEL[r.basedOn as keyof typeof ROLE_LABEL] ?? r.basedOn}</Chip>}
              </div>
              <div className="num text-xs text-ink-faint mt-1">{r.key} · lands on {r.home}</div>
              {r.note && <p className="text-[13px] text-ink-muted mt-2">{r.note}</p>}

              <div className="flex items-center gap-4 mt-3 text-sm">
                <span className="inline-flex items-center gap-1.5 text-ink-muted">
                  <UsersIcon size={14} /> <span className="num font-bold text-ink">{holders.length}</span> holder{holders.length === 1 ? '' : 's'}
                </span>
                <Link to="/admin/pages" className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink">
                  <Layers size={14} /> <span className="num font-bold text-ink">{menu.length}</span> pages
                </Link>
              </div>
              {holders.length > 0 && (
                <div className="flex items-center gap-1 mt-2.5">
                  {holders.slice(0, 6).map((u) => <Avatar key={u.id} name={u.name} hue={u.avatarHue} size={24} />)}
                  {holders.length > 6 && <span className="num text-xs text-ink-faint ml-1">+{holders.length - 6}</span>}
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-line">
                <Button variant="ghost" size="sm" onClick={() => { setDuplicating(r); setCopyName(`${r.label} (copy)`) }}>
                  <Copy size={14} /> Duplicate
                </Button>
                {!isSuper && !isPublic && (
                  <Button variant="ghost" size="sm" className="text-danger ml-auto"
                    title={blockedByLive ? `${liveNow.length} auction(s) running — this role cannot be removed until they close` : undefined}
                    onClick={() => { setRemoving(r); setReason('') }}>
                    <Trash2 size={14} /> Remove
                  </Button>
                )}
                {isSuper && <span className="text-[11px] text-ink-faint ml-auto self-center">Cannot be removed</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* ------------------------------ removed ------------------------------ */}
      <h2 className="text-lg font-bold mt-10 mb-1">Removed roles</h2>
      <p className="text-sm text-ink-muted mb-3">
        Kept in full, with every account suspended rather than deleted. Restoring puts the same people back on the same menu.
      </p>
      {removed.length === 0 && <EmptyState title="Nothing has been removed" body="A removed role would sit here until it is restored." />}
      <div className="space-y-2.5">
        {removed.map((r) => {
          const suspended = holdersOf(r.key).filter((u) => u.accountStatus === 'suspended')
          return (
            <div key={r.key} className="card border-warning/40 p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-64">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold">{r.label}</span>
                  <Chip tone="warning">Removed</Chip>
                  <span className="num text-xs text-ink-faint">{suspended.length} account{suspended.length === 1 ? '' : 's'} suspended</span>
                </div>
                <div className="text-[13px] text-ink-muted mt-0.5">{r.removedReason}</div>
                <div className="text-xs text-ink-faint mt-0.5">{r.removedAt && relTime(r.removedAt, now)}</div>
              </div>
              <Button variant="secondary" size="sm"
                onClick={() => say(restoreRole(r.key), `${r.label} restored`, `${suspended.length} account(s) can sign in again.`)}>
                <RotateCcw size={14} /> Restore
              </Button>
            </div>
          )
        })}
      </div>

      <div className="card border-l-4 border-l-steel p-4 mt-8 text-[13px] text-ink-muted">
        <strong className="text-ink">What this screen will not do.</strong> It cannot delete an account that holds a role, remove the
        Super Admin role, or remove a role while an auction it owns is still running. Everything it does change is recorded in{' '}
        <Link to="/admin/change-history" className="text-ember font-semibold hover:underline">Change history</Link> with a one-click undo —
        and none of it touches an auction, a bid, a payment or an audit entry.
      </div>

      {/* ------------------------------ add ------------------------------ */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add a role">
        <div className="space-y-4">
          <Field label="Role name" hint="What this role is called everywhere in the product.">
            <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="e.g. Regional Operations Lead" />
          </Field>
          <Field label="Landing route" hint="Where the role lands on sign-in. Leave blank to derive it from the name.">
            <Input className="num" value={draft.home} onChange={(e) => setDraft({ ...draft, home: e.target.value })} placeholder="/regional_operations_lead" />
          </Field>
          <Field label="What it is for (optional)">
            <Textarea value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="Covers the eastern yards during the festival season…" />
          </Field>
          <div className="card bg-surface-2 border-0 p-3.5 text-[13px] text-ink-muted">
            It starts with a dashboard, Browse, and its own activity record — a role with no menu is a role nobody can use. Attach the
            rest from <span className="font-semibold text-ink">Page manager</span>.
          </div>
          <Button className="w-full" disabled={!draft.label.trim()}
            onClick={() => {
              if (say(addRole(draft), `${draft.label.trim()} added`, 'Default pages created. Attach the rest from Page manager.')) setAddOpen(false)
            }}>
            Create the role
          </Button>
        </div>
      </Modal>

      {/* ---------------------------- duplicate ---------------------------- */}
      <Modal open={!!duplicating} onClose={() => setDuplicating(null)} title={`Duplicate ${duplicating?.label}`}>
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            The copy gets every one of {duplicating?.label}'s menu entries and lands on the same page. Nobody holds it until an account
            is moved onto it, so making the copy changes nothing for anyone working today.
          </p>
          <Field label="Name for the copy">
            <Input value={copyName} onChange={(e) => setCopyName(e.target.value)} />
          </Field>
          <Button className="w-full" disabled={!copyName.trim()}
            onClick={() => {
              if (say(duplicateRole(duplicating!.key, copyName), `${copyName.trim()} created`, `Copied from ${duplicating!.label}.`)) setDuplicating(null)
            }}>
            Duplicate
          </Button>
        </div>
      </Modal>

      {/* ------------------------------ remove ------------------------------ */}
      <Modal open={!!removing} onClose={() => setRemoving(null)} title={`Remove ${removing?.label}?`}>
        {removing && (
          <div className="space-y-4">
            <div className="card bg-warning-soft border-0 p-4 text-sm">
              <b>{holdersOf(removing.key).length} account{holdersOf(removing.key).length === 1 ? '' : 's'}</b> hold this role. They are
              <b> suspended, not deleted</b> — everything they have decided stays on the record and readable, and restoring the role
              puts them straight back. Nothing they have already done is reversed.
            </div>
            <Field label="Reason (recorded in Change history and the audit trail)">
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. merged into Operation Manager after the November restructure" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRemoving(null)}>Keep it</Button>
              <Button variant="danger" disabled={!reason.trim()}
                onClick={() => {
                  if (say(removeRole(removing.key, reason), `${removing.label} removed`, 'Accounts suspended. Restore it any time from this screen.')) setRemoving(null)
                }}>
                Remove role
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  )
}
