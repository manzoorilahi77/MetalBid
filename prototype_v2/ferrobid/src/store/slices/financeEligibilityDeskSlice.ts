import { uid } from '../../lib/format'
import {
  planIssueDemandDraft, planVerifyBankAccount, planRejectBankAccount,
  planApproveDepositClaim, planRejectDepositClaim, planApproveEmdExemption, planRejectEmdExemption,
  planSetCompanyBankAccounts,
} from '../../application/financeEligibilityDesk'
import type { StoreGet, StoreSet, InternalHelpers } from '../internal'
import type { State } from '../types'

export const createFinanceEligibilityDeskSlice = (
  set: StoreSet, get: StoreGet, helpers: InternalHelpers,
): Pick<State,
  'issueDemandDraft' | 'verifyBankAccount' | 'rejectBankAccount'
  | 'approveDepositClaim' | 'rejectDepositClaim' | 'approveEmdExemption' | 'rejectEmdExemption'
  | 'setCompanyBankAccounts'
> => ({
  // Recording a Demand Draft received from the buyer offline — Finance's
  // collection step, which replaces the generic advance for
  // payment_pending→dd_issued. Operations keeps it too: the DD often arrives
  // at the yard rather than at the finance desk.
  issueDemandDraft: (doId, dd) => {
    const s = get()
    const d = s.deliveryOrders.find((x) => x.id === doId)
    const plan = planIssueDemandDraft(dd, {
      role: s.role, actorId: s.currentUser?.id, actorName: s.currentUser?.name,
      d, lot: d ? s.lots.find((l) => l.id === d.lotId) : undefined, now: s.now,
    })
    if (!plan) return
    set((st) => ({
      demandDrafts: [...st.demandDrafts, plan.draft],
      deliveryOrders: st.deliveryOrders.map((x) =>
        x.id === doId ? { ...x, ddId: plan.draft.id, stage: 'dd_issued' as const, paidAmount: plan.paidAmount } : x,
      ),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
    /* Recording the draft is what releases the order for lifting, so both the
       buyer and the desk that did not record it are told. A DD taken at the
       yard has to reach Finance; one taken at the desk has to reach
       Operations. */
    get().notify(plan.buyerNotification)
    helpers.notifyRole(plan.deskNotification.roles, plan.deskNotification.plan)
  },

  verifyBankAccount: (id) => {
    const s = get()
    const plan = planVerifyBankAccount(id, { role: s.role, a: s.bankAccounts.find((x) => x.id === id) })
    if (!plan) return
    set((st) => ({ bankAccounts: st.bankAccounts.map((x) => (x.id === id ? { ...x, status: 'verified' as const } : x)) }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
    get().notify(plan.notification)
  },

  rejectBankAccount: (id, reason) => {
    const s = get()
    const plan = planRejectBankAccount(id, reason, { role: s.role, a: s.bankAccounts.find((x) => x.id === id) })
    if (!plan) return
    set((st) => ({ bankAccounts: st.bankAccounts.map((x) => (x.id === id ? { ...x, status: 'rejected' as const, rejectionReason: reason } : x)) }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    get().notify(plan.notification)
  },

  approveDepositClaim: (id) => {
    const s = get()
    const claim = s.depositClaims.find((c) => c.id === id)
    const plan = planApproveDepositClaim(id, { role: s.role, claim, actorId: s.currentUser?.id, now: s.now })
    if (!plan) return
    helpers.ensureWallet(claim!.userId)
    set((st) => ({
      depositClaims: st.depositClaims.map((c) => (c.id === id ? { ...c, status: 'approved' as const, decidedAt: plan.decidedAt, decidedBy: st.currentUser?.id } : c)),
      wallets: st.wallets.map((w) =>
        w.userId === claim!.userId
          ? { ...w, balance: w.balance + plan.ledgerEntry.amount, ledger: [{ id: uid('led'), at: plan.decidedAt, type: 'topup' as const, amount: plan.ledgerEntry.amount, ref: plan.ledgerEntry.ref, note: plan.ledgerEntry.note }, ...w.ledger] }
          : w,
      ),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
    get().notify(plan.notification)
  },

  rejectDepositClaim: (id, reason) => {
    const s = get()
    const claim = s.depositClaims.find((c) => c.id === id)
    const plan = planRejectDepositClaim(id, reason, { role: s.role, claim, actorId: s.currentUser?.id, now: s.now })
    if (!plan) return
    set((st) => ({
      depositClaims: st.depositClaims.map((c) => (c.id === id ? { ...c, status: 'rejected' as const, rejectionReason: reason, decidedAt: plan.decidedAt, decidedBy: st.currentUser?.id } : c)),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    get().notify(plan.notification)
  },

  approveEmdExemption: (id) => {
    const s = get()
    const req = s.emdExemptionRequests.find((r) => r.id === id)
    const plan = planApproveEmdExemption({ role: s.role, req, cat: req ? s.catalogues.find((c) => c.id === req.catalogueId) : undefined, actorId: s.currentUser?.id, now: s.now })
    if (!plan) return
    set((st) => ({
      emdExemptionRequests: st.emdExemptionRequests.map((r) =>
        r.id === id ? { ...r, status: 'approved' as const, decidedAt: plan.decidedAt, decidedBy: st.currentUser?.id } : r,
      ),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    get().notify(plan.notification)
  },

  rejectEmdExemption: (id, reason) => {
    const s = get()
    const req = s.emdExemptionRequests.find((r) => r.id === id)
    const plan = planRejectEmdExemption(reason, { role: s.role, req, cat: req ? s.catalogues.find((c) => c.id === req.catalogueId) : undefined, actorId: s.currentUser?.id, now: s.now })
    if (!plan) return
    set((st) => ({
      emdExemptionRequests: st.emdExemptionRequests.map((r) =>
        r.id === id ? { ...r, status: 'rejected' as const, rejectionReason: reason, decidedAt: plan.decidedAt, decidedBy: st.currentUser?.id } : r,
      ),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    get().notify(plan.notification)
  },

  setCompanyBankAccounts: (accounts) => {
    const plan = planSetCompanyBankAccounts(accounts, get().role)
    if (!plan) return
    set({ companyBankAccounts: accounts })
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
  },
})
