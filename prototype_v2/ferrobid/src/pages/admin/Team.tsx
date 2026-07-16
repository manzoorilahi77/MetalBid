/* Super Admin — team & permissions. */
import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Avatar, Button, Chip, Field, Input, Modal, PageHeader, Select, cx } from '../../components/ui'
import { ROLE_LABEL, useStore } from '../../store/store'
import { fmtDate } from '../../lib/format'
import type { Role } from '../../types'

const TEAM_ROLES: Role[] = ['field_exec', 'exec_manager', 'sub_admin', 'super_admin']

type Access = 'full' | 'limited' | 'none'
const MATRIX: { module: string; cells: Record<string, Access> }[] = [
  { module: 'Inspections', cells: { field_exec: 'full', exec_manager: 'full', sub_admin: 'limited', super_admin: 'full' } },
  { module: 'Lot approval', cells: { field_exec: 'none', exec_manager: 'full', sub_admin: 'limited', super_admin: 'full' } },
  { module: 'Catalogue builder', cells: { field_exec: 'none', exec_manager: 'full', sub_admin: 'none', super_admin: 'full' } },
  { module: 'Bid monitor', cells: { field_exec: 'none', exec_manager: 'limited', sub_admin: 'full', super_admin: 'full' } },
  { module: 'Settlement & DOs', cells: { field_exec: 'none', exec_manager: 'full', sub_admin: 'limited', super_admin: 'full' } },
  { module: 'Control tower', cells: { field_exec: 'none', exec_manager: 'limited', sub_admin: 'none', super_admin: 'full' } },
  { module: 'Financial config', cells: { field_exec: 'none', exec_manager: 'none', sub_admin: 'none', super_admin: 'full' } },
  { module: 'Master data', cells: { field_exec: 'none', exec_manager: 'limited', sub_admin: 'none', super_admin: 'full' } },
  { module: 'User management', cells: { field_exec: 'none', exec_manager: 'none', sub_admin: 'limited', super_admin: 'full' } },
  { module: 'Audit trail', cells: { field_exec: 'none', exec_manager: 'limited', sub_admin: 'limited', super_admin: 'full' } },
]

const cellGlyph: Record<Access, { g: string; cls: string; label: string }> = {
  full: { g: '✓', cls: 'text-success', label: 'Full' },
  limited: { g: '◐', cls: 'text-warning', label: 'Limited' },
  none: { g: '✗', cls: 'text-ink-faint', label: 'None' },
}

export default function Team() {
  const users = useStore((s) => s.users)
  const pushToast = useStore((s) => s.pushToast)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [invite, setInvite] = useState({ name: '', email: '', role: 'field_exec' })

  const team = users.filter((u) => TEAM_ROLES.includes(u.role))

  return (
    <Page>
      <PageHeader title="Team & permissions" sub="Internal operators across the four admin tiers, and the module template each tier can touch."
        actions={<Button onClick={() => setInviteOpen(true)}><UserPlus size={15} /> Invite teammate</Button>} />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {team.map((u) => (
          <div key={u.id} className="card p-4 flex items-start gap-3">
            <Avatar name={u.name} hue={u.avatarHue} size={40} />
            <div className="min-w-0">
              <div className="font-bold text-sm truncate">{u.name}</div>
              <Chip tone={u.role === 'super_admin' ? 'ember' : 'steel'} className="mt-1">{ROLE_LABEL[u.role]}</Chip>
              <div className="text-xs text-ink-faint mt-1.5">{u.city} · since {fmtDate(u.joinedAt)}</div>
              <Chip tone="success" className="mt-1.5">Active</Chip>
            </div>
          </div>
        ))}
      </div>

      <div className="card mt-8 overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Permission matrix</h2>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-success font-bold">✓ Full</span>
            <span className="text-warning font-bold">◐ Limited / read-only</span>
            <span className="text-ink-faint font-bold">✗ No access</span>
            <Button variant="ghost" size="sm" onClick={() => pushToast({ kind: 'info', title: 'Template editor', body: 'Permission template editing is stubbed in this prototype.' })}>Edit template</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-line">
                <th className="px-5 py-2.5">Module</th>
                {TEAM_ROLES.map((r) => <th key={r} className="px-4 py-2.5 text-center">{ROLE_LABEL[r]}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {MATRIX.map((row) => (
                <tr key={row.module} className="hover:bg-surface-2/60">
                  <td className="px-5 py-2.5 font-semibold">{row.module}</td>
                  {TEAM_ROLES.map((r) => {
                    const c = cellGlyph[row.cells[r]]
                    return <td key={r} className={cx('px-4 py-2.5 text-center font-bold', c.cls)} title={c.label}>{c.g}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite teammate">
        <div className="space-y-4">
          <Field label="Full name"><Input value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} placeholder="e.g. Rohit Sen" /></Field>
          <Field label="Work email"><Input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="name@ferrobid.in" /></Field>
          <Field label="Role template">
            <Select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
              {TEAM_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </Select>
          </Field>
          <Button className="w-full" disabled={!invite.name || !invite.email}
            onClick={() => {
              setInviteOpen(false)
              pushToast({ kind: 'success', title: 'Invite sent (demo)', body: `${invite.name} will join as ${ROLE_LABEL[invite.role as Role]}.` })
            }}>
            Send invite
          </Button>
        </div>
      </Modal>
    </Page>
  )
}
