/* ---------------------------------------------------------------------------
   Application layer — the role registry (add / remove / duplicate / restore
   a role). Moved verbatim from superAdminSlice.ts; no rule, threshold, or
   wording changed.

   Every one of these goes through the structural-change snapshot/undo system
   (`helpers.structureSnapshot()` / `helpers.recordStructural()`), same as
   phase 14's publishContent/returnContent and phase 16's masterData.ts —
   that stays an adapter-side call here too, since it captures live state
   immediately before the mutation and a pure function has no state to
   capture. Role permission is likewise computed once by the adapter via the
   existing `helpers.requireSuperAdmin()` and passed in as `permissionError`.
--------------------------------------------------------------------------- */
import { uid } from '../lib/format'
import { DEFAULT_NEW_ROLE_PAGES, slugKey } from '../store/constants'
import type { Catalogue, PageDef, RoleDef, StructuralChangeKind, User } from '../types'

export type PermissionError = { ok: false; error: string } | null
type Result<T> = { ok: true; plan: T } | { ok: false; error: string }

export interface StructuralPlan {
  kind: StructuralChangeKind
  target: string
  summary: string
  before: string | null
  after: string | null
}

/* ------------------------------ addRole ------------------------------ */

export interface AddRoleInput {
  label: string
  home?: string
  note?: string
}

export interface AddRolePlan {
  key: string
  roleRecord: RoleDef
  pages: PageDef[]
  structural: StructuralPlan
  audit: { action: string; target: string; detail: string; severity: 'critical' }
}

export function planAddRole(input: AddRoleInput, ctx: { permissionError: PermissionError; roleRegistry: RoleDef[]; actorId: string | undefined; now: number }): Result<AddRolePlan> {
  if (ctx.permissionError) return ctx.permissionError
  const label = input.label.trim()
  if (!label) return { ok: false, error: 'A role needs a name' }
  const key = slugKey(label)
  if (ctx.roleRegistry.some((r) => r.key === key)) return { ok: false, error: `A role called "${label}" already exists` }
  const home = input.home?.trim() || `/${key}`
  const at = new Date(ctx.now).toISOString()
  const pages: PageDef[] = DEFAULT_NEW_ROLE_PAGES.map((p, i) => ({
    id: uid('pg'), roleKey: key, to: p.to === '@home' ? home : p.to, label: p.label,
    inTop: i === 0, inSub: true, hidden: false, order: i, builtIn: false,
    end: i === 0, retained: p.retained,
  }))
  const roleRecord: RoleDef = { key, label, home, builtIn: false, status: 'active', createdAt: at, createdBy: ctx.actorId, note: input.note }
  return {
    ok: true,
    plan: {
      key, roleRecord, pages,
      structural: { kind: 'role.add', target: label, summary: `Role added with ${pages.length} default pages, landing on ${home}`, before: null, after: label },
      audit: { action: 'role.add', target: label, detail: `New role "${label}" (${key}) created with default pages`, severity: 'critical' },
    },
  }
}

/* ------------------------------ removeRole ------------------------------ */

export interface RemoveRolePlan {
  role: RoleDef
  removedAt: string
  holderIds: string[]
  structural: StructuralPlan
  audit: { action: string; target: string; detail: string; severity: 'critical' }
  notifications: { userId: string; title: string; body: string }[]
}

export function planRemoveRole(key: string, reason: string, ctx: {
  permissionError: PermissionError
  role: RoleDef | undefined
  liveOwned: Catalogue[]
  users: User[]
  now: number
}): Result<RemoveRolePlan> {
  if (ctx.permissionError) return ctx.permissionError
  const role = ctx.role
  if (!role || role.status === 'removed') return { ok: false, error: 'That role is not active' }
  if (key === 'super_admin') return { ok: false, error: 'The Super Admin role cannot be removed — it is the only way back in' }
  if (!reason.trim()) return { ok: false, error: 'A typed reason is required' }
  if (ctx.liveOwned.length > 0) {
    return { ok: false, error: `${role.label} is running ${ctx.liveOwned.map((c) => c.code).join(', ')} right now. Wait for it to close, or cancel it from Emergency override first.` }
  }
  const removedAt = new Date(ctx.now).toISOString()
  const holders = ctx.users.filter((u) => u.role === key)
  return {
    ok: true,
    plan: {
      role, removedAt, holderIds: holders.map((u) => u.id),
      structural: {
        kind: 'role.remove', target: role.label,
        summary: `Role removed — ${holders.length} account${holders.length === 1 ? '' : 's'} suspended, none deleted. ${reason}`,
        before: role.label, after: null,
      },
      audit: { action: 'role.remove', target: role.label, detail: `${reason} — ${holders.length} account(s) suspended`, severity: 'critical' },
      // Suspension is only real because it stops the sign-in — which means the
      // people it stops have to be told, rather than meeting a locked door.
      notifications: holders.map((u) => ({
        userId: u.id, title: 'Your access has been suspended',
        body: `The ${role.label} role was withdrawn — ${reason}. Your account and its history are intact. Contact a Super Admin to be reinstated.`,
      })),
    },
  }
}

/* ------------------------------ duplicateRole ------------------------------ */

export interface DuplicateRolePlan {
  newKey: string
  roleRecord: RoleDef
  pageCopies: PageDef[]
  structural: StructuralPlan
  audit: { action: string; target: string; detail: string; severity: 'warning' }
}

export function planDuplicateRole(key: string, label: string, ctx: {
  permissionError: PermissionError
  source: RoleDef | undefined
  roleRegistry: RoleDef[]
  sourcePages: PageDef[]
  actorId: string | undefined
  now: number
}): Result<DuplicateRolePlan> {
  if (ctx.permissionError) return ctx.permissionError
  const source = ctx.source
  if (!source) return { ok: false, error: 'No such role' }
  const name = label.trim()
  if (!name) return { ok: false, error: 'The copy needs a name' }
  const newKey = slugKey(name)
  if (ctx.roleRegistry.some((r) => r.key === newKey)) return { ok: false, error: `A role called "${name}" already exists` }
  const at = new Date(ctx.now).toISOString()
  const pageCopies: PageDef[] = ctx.sourcePages.map((p) => ({ ...p, id: uid('pg'), roleKey: newKey, builtIn: false, attachedFrom: key }))
  const roleRecord: RoleDef = { key: newKey, label: name, home: source.home, builtIn: false, status: 'active', createdAt: at, createdBy: ctx.actorId, basedOn: key }
  return {
    ok: true,
    plan: {
      newKey, roleRecord, pageCopies,
      structural: { kind: 'role.duplicate', target: name, summary: `Duplicated from ${source.label} with all ${pageCopies.length} of its pages. Nobody holds it yet.`, before: source.label, after: name },
      audit: { action: 'role.duplicate', target: name, detail: `Duplicated from ${source.label} (${pageCopies.length} pages)`, severity: 'warning' },
    },
  }
}

/* ------------------------------ restoreRole ------------------------------ */

export interface RestoreRolePlan {
  role: RoleDef
  restoredUserIds: string[]
  structural: StructuralPlan
  audit: { action: string; target: string; detail: string; severity: 'critical' }
}

export function planRestoreRole(key: string, ctx: { permissionError: PermissionError; role: RoleDef | undefined; users: User[] }): Result<RestoreRolePlan> {
  if (ctx.permissionError) return ctx.permissionError
  const role = ctx.role
  if (!role || role.status !== 'removed') return { ok: false, error: 'That role is not removed' }
  const restored = ctx.users.filter((u) => u.role === key && u.accountStatus === 'suspended')
  return {
    ok: true,
    plan: {
      role, restoredUserIds: restored.map((u) => u.id),
      structural: {
        kind: 'role.restore', target: role.label,
        summary: `Role restored — ${restored.length} suspended account${restored.length === 1 ? '' : 's'} can sign in again`,
        before: null, after: role.label,
      },
      audit: { action: 'role.restore', target: role.label, detail: `${restored.length} account(s) reinstated`, severity: 'critical' },
    },
  }
}
