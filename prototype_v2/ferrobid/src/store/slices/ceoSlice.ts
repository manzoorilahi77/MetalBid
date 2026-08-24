import {
  planRequestCeoSignoff, planRequestCeoInfo, planDelegateCeoApprovals, planClearCeoDelegation, planDecideCeoApproval,
} from '../../application/ceoApprovals'
import { canSignForCeo } from '../constants'
import type { StoreGet, StoreSet, InternalHelpers } from '../internal'
import type { State } from '../types'

export const createCeoSlice = (
  set: StoreSet, get: StoreGet, helpers: InternalHelpers,
): Pick<State, 'requestCeoSignoff' | 'requestCeoInfo' | 'delegateCeoApprovals' | 'clearCeoDelegation' | 'decideCeoApproval'> => ({
  /* -------------------------- CEO sign-off queue ---------------------- */
  requestCeoSignoff: ({ kind, refId, amount, summary, reason, payload }) => {
    const s = get()
    const existing = s.ceoApprovals.find(
      (a) => a.refId === refId && a.kind === kind && (a.status === 'pending' || a.status === 'info_requested'),
    )
    const plan = planRequestCeoSignoff(summary, reason, { role: s.role, existing })
    if (plan.action === 'refused') return null
    if (plan.action === 'existing') return plan.record
    const record = helpers.raiseCeoApproval(kind, refId, amount, summary, reason)
    if (payload) {
      set((st) => ({ ceoApprovals: st.ceoApprovals.map((a) => (a.id === record.id ? { ...a, payload } : a)) }))
    }
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return record
  },

  requestCeoInfo: (id, note) => {
    const s = get()
    const req = s.ceoApprovals.find((a) => a.id === id)
    const plan = planRequestCeoInfo(note, { canSign: canSignForCeo(s.role, s.currentUser?.id, s.ceoDelegation, s.now), req, now: s.now })
    if (!plan) return
    set((st) => ({
      ceoApprovals: st.ceoApprovals.map((a) =>
        a.id === id ? { ...a, status: 'info_requested' as const, infoNote: note, infoAskedAt: plan.infoAskedAt } : a,
      ),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
    get().notify(plan.notification)
  },

  delegateCeoApprovals: (toUserId, until, note) => {
    const s = get()
    const result = planDelegateCeoApprovals(toUserId, until, note, { role: s.role, actorId: s.currentUser?.id, to: s.users.find((u) => u.id === toUserId), now: s.now })
    if (!result.ok) return result
    const { plan } = result
    set({ ceoDelegation: plan.record })
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    get().notify(plan.notification)
    return { ok: true }
  },

  clearCeoDelegation: () => {
    const s = get()
    const current = s.ceoDelegation
    const plan = planClearCeoDelegation({ role: s.role, current, to: current ? s.users.find((u) => u.id === current.toUserId) : undefined })
    if (!plan) return
    set({ ceoDelegation: null })
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    get().notify(plan.notification)
  },

  decideCeoApproval: (id, approve, note) => {
    const s = get()
    const req = s.ceoApprovals.find((a) => a.id === id)
    const plan = planDecideCeoApproval(approve, note, {
      canSign: canSignForCeo(s.role, s.currentUser?.id, s.ceoDelegation, s.now),
      req,
      emdForfeiture: req?.kind === 'emd_forfeiture' ? s.emdForfeitures.find((f) => f.id === req.refId) : undefined,
      refund: req?.kind === 'refund' ? s.refundRequests.find((r) => r.id === req.refId) : undefined,
      financeConfigBefore: s.financeConfig,
      now: s.now,
    })
    if (!plan) return
    set((st) => ({
      ceoApprovals: st.ceoApprovals.map((a) =>
        a.id === id ? { ...a, status: plan.mainStatus, decidedBy: st.currentUser?.id, decidedAt: plan.decidedAt, decisionNote: note } : a,
      ),
    }))
    get().audit(plan.mainAudit.action, plan.mainAudit.target, plan.mainAudit.detail, plan.mainAudit.severity)

    if (plan.applyForfeitureRecord) {
      const record = plan.applyForfeitureRecord
      set((st) => ({
        emdForfeitures: st.emdForfeitures.map((f) => (f.id === record.id ? { ...f, status: 'applied' as const, decidedBy: st.currentUser?.id, decidedAt: plan.decidedAt, decisionNote: note } : f)),
      }))
      helpers.applyForfeiture(record)
    }
    if (plan.waiveForfeiture) {
      get().waiveEmdForfeiture(plan.waiveForfeiture.forfeitureId, plan.waiveForfeiture.reason)
    }
    if (plan.refundOutcome) {
      const ro = plan.refundOutcome
      set((st) => ({
        refundRequests: st.refundRequests.map((r) =>
          r.id === ro.refundId ? { ...r, status: ro.status, decidedBy: st.currentUser?.id, decidedAt: plan.decidedAt, decisionNote: note } : r,
        ),
      }))
    }
    if (plan.feeChange) {
      const payload = plan.feeChange.payload
      set((st) => ({ financeConfig: { ...st.financeConfig, ...payload } }))
      get().audit(plan.feeChange.audit.action, plan.feeChange.audit.target, plan.feeChange.audit.detail, plan.feeChange.audit.severity)
    }
    if (plan.banUserId) {
      const banUserId = plan.banUserId
      const blacklistReason = plan.blacklistReason
      set((st) => ({
        users: st.users.map((u) => (u.id === banUserId ? { ...u, standing: 'defaulter' as const, blacklistReason } : u)),
      }))
    }
    get().notify(plan.finalNotification)
  },
})
