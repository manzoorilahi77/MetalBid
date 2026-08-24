/* ---------------------------------------------------------------------------
   Application layer — Super Admin/Sub Admin account lifecycle: creating a
   Sub Admin account, and setting an account's status. Moved verbatim from
   superAdminSlice.ts; no rule, threshold, or wording changed beyond Phase 22
   (see planCreateSubAdmin's duplicate-email check below).

   resetUserPassword is deliberately NOT here — see Phase 20's report. Its
   live call to /api/auth/reset is not a side effect a plan step can safely
   stand in front of: the server call itself is the mutation (it bumps
   token_version and invalidates the target's sessions), and the returned
   temporaryPassword is the value the rest of the action is built from. There
   is nothing left for a pure function to plan that isn't either a guard
   check with no state to react to, or a record built from a value that does
   not exist until the network call returns.
--------------------------------------------------------------------------- */
import { uid } from '../lib/format'
import { generatePassword, hash } from '../store/constants'
import { checkAuth } from './authorization'
import type { AccountStatus, Role, User } from '../types'

type PermissionError = { ok: false; error: string } | null
type Result<T> = { ok: true; plan: T } | { ok: false; error: string }
type NotifyPlan = { userId: string; kind: 'system'; title: string; body: string; href?: string }

/* ------------------------------ createSubAdmin ------------------------------ */

export interface CreateSubAdminInput {
  name: string
  username: string
  email: string
  phone: string
  city: string
}

export interface CreateSubAdminContext {
  permissionError: PermissionError
  users: User[]
  actorId: string | undefined
  ceo: User | undefined
  now: number
}

export interface CreateSubAdminPlan {
  user: User
  password: string
  passwordReset: { id: string; userId: string; mode: 'auto'; password: string; at: string; byId: string; consumed: boolean }
  structural: { kind: 'account.create'; target: string; summary: string; before: null; after: string }
  audit: { action: string; target: string; detail: string; severity: 'critical' }
  ceoNotification: NotifyPlan | null
}

export function planCreateSubAdmin(input: CreateSubAdminInput, ctx: CreateSubAdminContext): Result<CreateSubAdminPlan> {
  if (ctx.permissionError) return ctx.permissionError
  const name = input.name.trim()
  const username = input.username.trim().toLowerCase()
  if (!name || !username) return { ok: false, error: 'Both a name and a sign-in ID are needed' }
  // Phase 22: email used to compare exact/case-sensitive while username
  // was already trim+lowercase — so 'User@x.com' and 'user@x.com' could
  // both be created as distinct accounts even though sign-in itself
  // matches email case-insensitively. Both sides now normalize the same
  // way the username check already does.
  const email = input.email.trim().toLowerCase()
  if (ctx.users.some((u) => u.username === username || u.email.trim().toLowerCase() === email)) {
    return { ok: false, error: 'Those sign-in details are already in use' }
  }
  const password = generatePassword()
  const id = uid('u-sub')
  const at = new Date(ctx.now).toISOString()
  const user: User = {
    id, name, firm: 'ferroBid Technologies', phone: input.phone.trim(), email: input.email.trim(),
    role: 'sub_admin', kycStatus: 'verified', sellerVerified: false, standing: 'good',
    city: input.city.trim() || 'Mumbai', gstin: '—', avatarHue: (hash(id) % 360),
    joinedAt: at, bidderId: null, sellerId: null,
    accountStatus: 'active', username, lastActiveAt: at,
  }
  return {
    ok: true,
    plan: {
      user, password,
      passwordReset: { id: uid('pwr'), userId: id, mode: 'auto', password, at, byId: ctx.actorId ?? 'system', consumed: false },
      structural: { kind: 'account.create', target: name, summary: `Sub Admin account created — ${username}. Every Sub Admin account is identical; work is divided by assignment, not by capability.`, before: null, after: username },
      audit: { action: 'account.create', target: username, detail: `Sub Admin account created for ${name}`, severity: 'critical' },
      // The CEO is told, and does not approve it — Part 8.
      ceoNotification: ctx.ceo
        ? { userId: ctx.ceo.id, kind: 'system', title: 'New Sub Admin account', body: `${name} (${username}) now has full operational access.`, href: '/admin/sub-admins' }
        : null,
    },
  }
}

/* ------------------------------ setAccountStatus ------------------------------ */

export interface SetAccountStatusContext {
  role: Role
  user: User | undefined
  banApproved: boolean
}

export interface SetAccountStatusPlan {
  noop: boolean
  before: AccountStatus
  structural: { kind: 'account.status'; target: string; summary: string; before: string; after: string } | null
  audit: { action: string; target: string; detail: string; severity: 'critical' } | null
  notification: NotifyPlan | null
}

export function planSetAccountStatus(status: AccountStatus, reason: string | undefined, ctx: SetAccountStatusContext): Result<SetAccountStatusPlan> {
  const roleError = checkAuth('administerAccounts', ctx.role)
  if (roleError) return { ok: false, error: roleError }
  const user = ctx.user
  if (!user) return { ok: false, error: 'No such account' }
  if (user.role === 'super_admin' && ctx.role !== 'super_admin') return { ok: false, error: 'Only another Super Admin can change a Super Admin account' }
  if (status === 'banned') {
    // Part 8 — a permanent ban is executed here but signed by the CEO.
    if (!ctx.banApproved) return { ok: false, error: 'A permanent ban needs the CEO\'s signature first — raise it from Blacklist & defaulters' }
  }
  const before = user.accountStatus ?? 'active'
  if (before === status) return { ok: true, plan: { noop: true, before, structural: null, audit: null, notification: null } }
  return {
    ok: true,
    plan: {
      noop: false, before,
      structural: { kind: 'account.status', target: `${user.name} · ${user.firm}`, summary: reason?.trim() || `Account ${status}`, before, after: status },
      audit: { action: 'account.status', target: user.name, detail: `${before} → ${status}${reason ? ` — ${reason}` : ''}`, severity: 'critical' },
      notification: {
        userId: user.id, kind: 'system',
        title: status === 'active' ? 'Your account is active again' : `Your account has been ${status}`,
        body: reason?.trim() || 'Contact support if you believe this is a mistake.',
      },
    },
  }
}
