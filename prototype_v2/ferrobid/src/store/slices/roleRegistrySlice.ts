import { planAddRole, planRemoveRole, planDuplicateRole, planRestoreRole } from '../../application/roleRegistry'
import type { StoreGet, StoreSet, InternalHelpers } from '../internal'
import type { State } from '../types'
import type { AccountStatus } from '../../types'

export const createRoleRegistrySlice = (
  set: StoreSet, get: StoreGet, helpers: InternalHelpers,
): Pick<State, 'addRole' | 'removeRole' | 'duplicateRole' | 'restoreRole'> => ({
  /* ------------------- Super Admin — the platform itself -----------------
     Structure, never business data. Everything here is recorded in
     `structuralChanges` with the snapshot that undoes it, which is what lets
     a bad change be reversed in a click instead of an emergency release.
     Auctions, bids, payments and audit entries are deliberately outside that
     snapshot and can never be rolled back. */

  addRole: (input) => {
    const s = get()
    const result = planAddRole(input, { permissionError: helpers.requireSuperAdmin(), roleRegistry: s.roleRegistry, actorId: s.currentUser?.id, now: s.now })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({
      roleRegistry: [...st.roleRegistry, plan.roleRecord],
      pageRegistry: [...st.pageRegistry, ...plan.pages],
    }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true, key: plan.key }
  },

  removeRole: (key, reason) => {
    const s = get()
    const result = planRemoveRole(key, reason, {
      permissionError: helpers.requireSuperAdmin(), role: s.roleRegistry.find((r) => r.key === key),
      liveOwned: helpers.liveAuctionsOwnedBy(key), users: s.users, now: s.now,
    })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({
      roleRegistry: st.roleRegistry.map((r) =>
        r.key === key ? { ...r, status: 'removed' as const, removedAt: plan.removedAt, removedBy: st.currentUser?.id, removedReason: reason } : r),
      // Accounts are suspended, never deleted — the history behind everything
      // they decided has to stay readable.
      users: st.users.map((u) => (u.role === key ? { ...u, accountStatus: 'suspended' as AccountStatus } : u)),
    }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    // Suspension is only real because it stops the sign-in — which means the
    // people it stops have to be told, rather than meeting a locked door.
    for (const n of plan.notifications) {
      get().notify({ userId: n.userId, kind: 'system', title: n.title, body: n.body })
    }
    return { ok: true }
  },

  duplicateRole: (key, label) => {
    const s = get()
    const result = planDuplicateRole(key, label, {
      permissionError: helpers.requireSuperAdmin(), source: s.roleRegistry.find((r) => r.key === key), roleRegistry: s.roleRegistry,
      sourcePages: s.pageRegistry.filter((p) => p.roleKey === key), actorId: s.currentUser?.id, now: s.now,
    })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({
      roleRegistry: [...st.roleRegistry, plan.roleRecord],
      pageRegistry: [...st.pageRegistry, ...plan.pageCopies],
    }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true, key: plan.newKey }
  },

  restoreRole: (key) => {
    const s = get()
    const result = planRestoreRole(key, { permissionError: helpers.requireSuperAdmin(), role: s.roleRegistry.find((r) => r.key === key), users: s.users })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({
      roleRegistry: st.roleRegistry.map((r) =>
        r.key === key ? { ...r, status: 'active' as const, removedAt: undefined, removedBy: undefined, removedReason: undefined } : r),
      users: st.users.map((u) => (u.role === key && u.accountStatus === 'suspended' ? { ...u, accountStatus: 'active' as AccountStatus } : u)),
    }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },
})
