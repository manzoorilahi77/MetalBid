import { uid } from '../../lib/format'
import { apiPost, ApiError } from '../../api/client'
import { planCreateSubAdmin, planSetAccountStatus } from '../../application/accountLifecycle'
import { planUpdateUserDetails } from '../../application/accountDetails'
import type { StoreGet, StoreSet, InternalHelpers } from '../internal'
import type { State } from '../types'

export const createAccountLifecycleSlice = (
  set: StoreSet, get: StoreGet, helpers: InternalHelpers,
): Pick<State, 'createSubAdmin' | 'setAccountStatus' | 'resetUserPassword' | 'updateUserDetails'> => ({
  /* ------------------- Super Admin — people --------------------------- */

  createSubAdmin: (input) => {
    const s = get()
    const result = planCreateSubAdmin(input, {
      permissionError: helpers.requireSuperAdmin(), users: s.users, actorId: s.currentUser?.id,
      ceo: s.users.find((u) => u.role === 'ceo'), now: s.now,
    })
    if (!result.ok) return result
    const { plan } = result
    set((st) => ({
      users: [...st.users, plan.user],
      passwordResets: [plan.passwordReset, ...st.passwordResets],
    }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    if (plan.ceoNotification) get().notify(plan.ceoNotification)
    return { ok: true, password: plan.password, userId: plan.user.id }
  },

  setAccountStatus: (userId, status, reason) => {
    const s = get()
    const user = s.users.find((u) => u.id === userId)
    const result = planSetAccountStatus(status, reason, {
      role: s.role, user,
      banApproved: s.ceoApprovals.some((a) => a.kind === 'permanent_ban' && a.refId === userId && a.status === 'approved'),
    })
    if (!result.ok) return result
    const { plan } = result
    if (plan.noop) return { ok: true }
    set((st) => ({ users: st.users.map((u) => (u.id === userId ? { ...u, accountStatus: status } : u)) }))
    helpers.recordStructural(plan.structural!.kind, plan.structural!.target, plan.structural!.summary, plan.structural!.before, plan.structural!.after)
    get().audit(plan.audit!.action, plan.audit!.target, plan.audit!.detail, plan.audit!.severity)
    get().notify(plan.notification!)
    return { ok: true }
  },

  resetUserPassword: async (userId, mode, manualPassword) => {
    const s = get()
    if (s.role !== 'super_admin' && s.role !== 'sub_admin') return { ok: false, error: 'Passwords are reset by a Sub Admin or a Super Admin' }
    const user = s.users.find((u) => u.id === userId)
    if (!user) return { ok: false, error: 'No such account' }
    // A Super Admin's password is only ever reset by another Super Admin.
    if (user.role === 'super_admin' && s.role !== 'super_admin') {
      return { ok: false, error: 'A Super Admin password can only be reset by another Super Admin' }
    }
    const manual = (manualPassword ?? '').trim()
    if (mode === 'manual') {
      if (manual.length < 8) return { ok: false, error: 'A password set by hand needs at least 8 characters' }
      if (!/[A-Z]/.test(manual) || !/[0-9]/.test(manual)) return { ok: false, error: 'Include at least one capital letter and one digit' }
    }

    /* The server sets the real scrypt hash — see issueTemporaryPassword in
       auth.mjs. This used to stop at the local row below and never call it,
       so the password shown here looked issued but could never sign in. */
    let password: string
    try {
      const res = await apiPost<{ temporaryPassword: string }>('/api/auth/reset', {
        userId, password: mode === 'manual' ? manual : undefined,
      })
      password = res.temporaryPassword
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : 'Could not reset the password' }
    }

    const at = new Date(s.now).toISOString()
    set((st) => ({
      passwordResets: [{ id: uid('pwr'), userId, mode, password, at, byId: st.currentUser?.id ?? 'system', consumed: false }, ...st.passwordResets],
    }))
    helpers.recordStructural('account.password_reset', `${user.name} · ${user.firm}`,
      `Password reset ${mode === 'auto' ? 'to a generated password' : 'by hand'}. Shown once; ${user.name.split(' ')[0]} is asked to keep it or set their own at next sign-in.`,
      null, mode)
    get().audit('account.password_reset', user.name, `Password reset (${mode}) for ${user.email}`, 'critical')
    get().notify({
      userId, kind: 'system', title: 'Your password was reset',
      body: 'Support issued a new password. Sign in with it, then keep it or set your own.',
    })
    return { ok: true, password }
  },

  updateUserDetails: (userId, patch) => {
    const s = get()
    const result = planUpdateUserDetails(userId, patch, { role: s.role, currentUserId: s.currentUser?.id, user: s.users.find((u) => u.id === userId), users: s.users })
    if (!result.ok) return result
    const { plan } = result
    if (plan.noop) return { ok: true }
    set((st) => ({
      users: st.users.map((u) => (u.id === userId ? { ...u, ...plan.next } : u)),
      currentUser: st.currentUser?.id === userId ? { ...st.currentUser, ...plan.next } : st.currentUser,
    }))
    /* Recorded, never reversed from Change history: putting a contact detail
       back is a correction of its own, made here, with its own entry. */
    helpers.recordStructural('account.edit', plan.structural!.target, plan.structural!.summary, plan.structural!.before, plan.structural!.after)
    get().audit(plan.audit!.action, plan.audit!.target, plan.audit!.detail, plan.audit!.severity)
    /* Support changed something on someone else's account. They are told what
       changed, which is what makes a wrong correction findable. */
    if (plan.notification) get().notify(plan.notification)
    return { ok: true }
  },
})
