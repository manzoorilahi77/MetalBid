import { uid } from '../../lib/format'
import { planApproveWithdrawal, planProcessWithdrawal, planFailWithdrawal, planSetWithdrawalWindow } from '../../application/withdrawalDesk'
import type { StoreGet, StoreSet, InternalHelpers } from '../internal'
import type { State } from '../types'

export const createWithdrawalDeskSlice = (
  set: StoreSet, get: StoreGet, helpers: InternalHelpers,
): Pick<State, 'approveWithdrawal' | 'processWithdrawal' | 'failWithdrawal' | 'setWithdrawalWindow'> => ({
  /* Money out is two deliberate steps by two people. Review accepts the
     request into processing and records who did it; Process releases the
     payment and, above the configured threshold, refuses to be the same
     person. Together with deposit approval, one individual doing both would
     otherwise hold a complete round trip on customer money. */
  approveWithdrawal: (id) => {
    const s = get()
    const req = s.withdrawalRequests.find((r) => r.id === id)
    const plan = planApproveWithdrawal(id, {
      role: s.role, req, actorId: s.currentUser?.id, actorName: s.currentUser?.name,
      requesterFirm: (req && s.users.find((u) => u.id === req.userId)?.firm) || 'A customer',
      withdrawalSecondSignatureFrom: s.financeConfig.withdrawalSecondSignatureFrom, now: s.now,
    })
    if (!plan) return
    set((st) => ({
      withdrawalRequests: st.withdrawalRequests.map((r) =>
        r.id === id ? { ...r, status: 'under_review' as const, reviewedBy: st.currentUser?.id, reviewedAt: plan.reviewedAt } : r,
      ),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
    /* Maker–checker only works if the checker knows there is something to
       release. Above the threshold it has to be a different Finance user, so
       whoever reviewed it is left off their own hand-off. */
    helpers.notifyRole('finance_admin', plan.deskNotification.plan, plan.deskNotification.excludeUserId)
    get().notify(plan.requesterNotification)
  },

  processWithdrawal: (id) => {
    const s = get()
    const req = s.withdrawalRequests.find((r) => r.id === id)
    const plan = planProcessWithdrawal(id, {
      role: s.role, req, actorId: s.currentUser?.id, actorName: s.currentUser?.name,
      reviewerName: req ? s.users.find((u) => u.id === req.reviewedBy)?.name : undefined,
      withdrawalSecondSignatureFrom: s.financeConfig.withdrawalSecondSignatureFrom, now: s.now,
    })
    if (!plan) return
    if (plan.blocked) {
      get().pushToast(plan.toast)
      get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
      return
    }
    set((st) => ({
      withdrawalRequests: st.withdrawalRequests.map((r) =>
        r.id === id ? { ...r, status: 'processed' as const, processedBy: st.currentUser?.id, decidedAt: plan.decidedAt } : r,
      ),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
    get().notify(plan.notification)
  },

  failWithdrawal: (id, reason) => {
    const s = get()
    const req = s.withdrawalRequests.find((r) => r.id === id)
    const plan = planFailWithdrawal(id, reason, { role: s.role, req, now: s.now })
    if (!plan) return
    set((st) => ({
      withdrawalRequests: st.withdrawalRequests.map((r) => (r.id === id ? { ...r, status: 'failed' as const, reason, decidedAt: plan.decidedAt } : r)),
      wallets: st.wallets.map((w) =>
        w.userId === req!.userId
          ? { ...w, balance: w.balance + plan.ledgerEntry.amount, ledger: [{ id: uid('led'), at: plan.decidedAt, type: 'refund' as const, amount: plan.ledgerEntry.amount, ref: plan.ledgerEntry.ref, note: plan.ledgerEntry.note }, ...w.ledger] }
          : w,
      ),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    get().notify(plan.notification)
  },

  setWithdrawalWindow: (config) => {
    const plan = planSetWithdrawalWindow(config, get().role)
    if (!plan) return
    set({ withdrawalWindow: config })
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
  },
})
