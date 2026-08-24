import { planUndoStructuralChange, planRestoreStructureTo } from '../../application/structuralRollback'
import { fmtStamp } from '../constants'
import type { StoreGet, StoreSet, InternalHelpers } from '../internal'
import type { State } from '../types'

export const createStructuralRollbackSlice = (
  set: StoreSet, get: StoreGet, helpers: InternalHelpers,
): Pick<State, 'undoStructuralChange' | 'restoreStructureTo'> => ({
  undoStructuralChange: (id) => {
    const s = get()
    const result = planUndoStructuralChange(id, {
      permissionError: helpers.requireSuperAdmin(), change: s.structuralChanges.find((c) => c.id === id),
      currentSnapshot: helpers.structureSnapshot(), now: s.now,
    })
    if (!result.ok) return result
    const { plan } = result
    set((st) => ({
      ...helpers.applySnapshot(plan.snapshotToApply),
      structuralChanges: st.structuralChanges.map((c) =>
        c.id === plan.changeId ? { ...c, undoneAt: plan.undoneAt, undoneBy: st.currentUser?.id } : c),
    }))
    helpers.recordStructural(plan.newRecord.kind, plan.newRecord.target, plan.newRecord.summary, plan.newRecord.before, plan.newRecord.after, plan.newRecord.snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },

  restoreStructureTo: (id) => {
    const s = get()
    const result = planRestoreStructureTo(id, {
      permissionError: helpers.requireSuperAdmin(), change: s.structuralChanges.find((c) => c.id === id),
      allChanges: s.structuralChanges, currentSnapshot: helpers.structureSnapshot(), fmtStamp, now: s.now,
    })
    if (!result.ok) return result
    const { plan } = result
    const laterIds = new Set(plan.laterChangeIds)
    set((st) => ({
      ...helpers.applySnapshot(plan.snapshotToApply),
      structuralChanges: st.structuralChanges.map((c) =>
        laterIds.has(c.id) ? { ...c, undoneAt: plan.undoneAt, undoneBy: st.currentUser?.id } : c),
    }))
    helpers.recordStructural(plan.newRecord.kind, plan.newRecord.target, plan.newRecord.summary, plan.newRecord.before, plan.newRecord.after, plan.newRecord.snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },
})
