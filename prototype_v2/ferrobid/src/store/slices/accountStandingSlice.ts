import { planSetUserStanding } from '../../application/userStanding'
import type { StoreGet, StoreSet, InternalHelpers } from '../internal'
import type { State } from '../types'

export const createAccountStandingSlice = (
  set: StoreSet, get: StoreGet, helpers: InternalHelpers,
): Pick<State, 'setUserStanding'> => ({
  setUserStanding: (userId, standing, reason) => {
    const s = get()
    const result = planSetUserStanding(userId, standing, reason, { role: s.role, u: s.users.find((x) => x.id === userId), now: s.now })
    if (!result.ok) return result
    const { plan } = result
    set((st) => ({
      users: st.users.map((u) => (u.id === userId ? { ...u, standing, blacklistReason: reason ?? u.blacklistReason } : u)),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    // Standing changes what a customer may do on the platform, so they are
    // told what changed and why rather than finding out at a locked button.
    get().notify(plan.notification)
    // Money at risk against a restricted account is Finance's problem too.
    if (plan.financeNotification) {
      helpers.notifyRole('finance_admin', plan.financeNotification)
    }
    return { ok: true }
  },
})
