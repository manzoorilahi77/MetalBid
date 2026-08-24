/* ---------------------------------------------------------------------------
   Application layer — Sub Admin / Super Admin correcting a user's own
   account details. Moved verbatim from superAdminSlice.ts's
   updateUserDetails; no rule, threshold, or wording changed.
--------------------------------------------------------------------------- */
import type { Role, User } from '../types'
import type { NotificationPlan } from './opsInspection'

export interface UpdateUserDetailsPatch {
  name?: string
  firm?: string
  email?: string
  phone?: string
  city?: string
  gstin?: string
}

export interface UpdateUserDetailsContext {
  role: Role
  currentUserId: string | undefined
  user: User | undefined
  users: User[]
}

export interface UpdateUserDetailsPlan {
  noop: boolean
  next: Partial<User>
  structural: { target: string; summary: string; before: string; after: string } | null
  audit: { action: string; target: string; detail: string; severity: 'warning' } | null
  notification: (NotificationPlan & { userId: string }) | null
}

export type UpdateUserDetailsResult =
  | { ok: true; plan: UpdateUserDetailsPlan }
  | { ok: false; error: string }

export function planUpdateUserDetails(userId: string, patch: UpdateUserDetailsPatch, ctx: UpdateUserDetailsContext): UpdateUserDetailsResult {
  if (ctx.role !== 'super_admin' && ctx.role !== 'sub_admin') return { ok: false, error: 'Accounts are administered by a Sub Admin or a Super Admin' }
  const user = ctx.user
  if (!user) return { ok: false, error: 'No such account' }
  if (user.role === 'super_admin' && ctx.role !== 'super_admin') return { ok: false, error: 'Only another Super Admin can edit a Super Admin account' }

  const clean = {
    name: patch.name?.trim(), firm: patch.firm?.trim(), email: patch.email?.trim(),
    phone: patch.phone?.trim(), city: patch.city?.trim(), gstin: patch.gstin?.trim(),
  }
  if (clean.name === '') return { ok: false, error: 'A name cannot be blank' }
  if (clean.email && ctx.users.some((u) => u.id !== userId && u.email.toLowerCase() === clean.email!.toLowerCase())) {
    return { ok: false, error: 'Another account already uses that email' }
  }

  const fields = (Object.keys(clean) as (keyof typeof clean)[]).filter((k) => clean[k] !== undefined && clean[k] !== user[k])
  if (fields.length === 0) return { ok: true, plan: { noop: true, next: {}, structural: null, audit: null, notification: null } }

  const before = fields.map((k) => `${k} ${user[k] || '—'}`).join(' · ')
  const after = fields.map((k) => `${k} ${clean[k]}`).join(' · ')
  const next = fields.reduce((acc, k) => ({ ...acc, [k]: clean[k] }), {} as Partial<User>)

  return {
    ok: true,
    plan: {
      noop: false, next,
      // Recorded, never reversed from Change history: putting a contact
      // detail back is a correction of its own, made here, with its own entry.
      structural: { target: `${user.name} · ${user.firm}`, summary: `Account details corrected — ${fields.join(', ')}`, before, after },
      audit: { action: 'account.edit', target: user.name, detail: `${before} → ${after}`, severity: 'warning' },
      // Support changed something on someone else's account. They are told
      // what changed, which is what makes a wrong correction findable.
      notification: userId !== ctx.currentUserId
        ? { userId, kind: 'system', title: 'Your account details were updated', body: `Support corrected: ${after}. If that is not right, reply on a support ticket and we will put it back.`, href: '/profile' }
        : null,
    },
  }
}
