import { uid } from '../../lib/format'
import { planConfirmBuyerPayment } from '../../application/financePayments'
import { planRaiseEmdForfeiture, planWaiveEmdForfeiture } from '../../application/emdForfeiture'
import { planSetFinanceConfig } from '../../application/financeConfig'
import { planConfirmCommissionSettlement, planQueryCommissionSettlement, planFlagOverduePayment } from '../../application/financeSettlement'
import { planRaiseRefund, planDecideRefund, planProcessRefund } from '../../application/refunds'
import { planIssueInvoice, planReissueInvoice, planCancelInvoice } from '../../application/invoicing'
import { planMatchBankLine, planUnmatchBankLine, planFlagBankBreak, planEscalateBankBreak } from '../../application/reconciliation'
import type { StoreGet, StoreSet, InternalHelpers } from '../internal'
import type { State } from '../types'

export const createFinanceSlice = (
  set: StoreSet, get: StoreGet, helpers: InternalHelpers,
): Pick<State,
  'setFinanceConfig' | 'confirmCommissionSettlement' | 'queryCommissionSettlement' | 'confirmBuyerPayment'
  | 'flagOverduePayment' | 'raiseEmdForfeiture' | 'waiveEmdForfeiture' | 'raiseRefund' | 'decideRefund'
  | 'processRefund' | 'issueInvoice' | 'reissueInvoice' | 'cancelInvoice' | 'matchBankLine' | 'unmatchBankLine'
  | 'flagBankBreak' | 'escalateBankBreak'
> => ({
  /* ======================= Finance Administrator =======================
     Money in → money held → money out → the records that prove it. Two rules
     run through every action below. Anything that takes money away from a
     customer needs a person and a typed reason. Anything above a CEO
     threshold leaves this desk as a request rather than completing here — and
     the requester keeps sight of it while it is away. */

  setFinanceConfig: (patch) => {
    const plan = planSetFinanceConfig(patch, { role: get().role, before: get().financeConfig })
    if (!plan) return
    set({ financeConfig: plan.next })
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after)
  },

  /* ------------------------- commission settlements ------------------- */
  confirmCommissionSettlement: (id, bankLineId) => {
    const s = get()
    const record = s.commissionSettlements.find((r) => r.id === id)
    const result = planConfirmCommissionSettlement(bankLineId, {
      role: s.role, record, catalogue: record ? s.catalogues.find((c) => c.id === record.catalogueId) : undefined, now: s.now,
    })
    if (!result.ok) return result
    const { plan } = result
    set((st) => ({
      commissionSettlements: st.commissionSettlements.map((r) =>
        r.id === id ? { ...r, status: 'confirmed' as const, confirmedBy: st.currentUser?.id, confirmedAt: plan.confirmedAt, queryNote: undefined } : r,
      ),
      bankStatementLines: bankLineId
        ? st.bankStatementLines.map((l) =>
            l.id === bankLineId ? { ...l, status: 'matched' as const, matchedTo: id, matchedKind: 'commission' as const, matchedBy: st.currentUser?.id, matchedAt: plan.confirmedAt } : l,
          )
        : st.bankStatementLines,
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
    get().notify(plan.notification)
    return { ok: true }
  },

  queryCommissionSettlement: (id, note) => {
    const s = get()
    const record = s.commissionSettlements.find((r) => r.id === id)
    const plan = planQueryCommissionSettlement(note, { role: s.role, record, catalogue: record ? s.catalogues.find((c) => c.id === record.catalogueId) : undefined })
    if (!plan) return
    set((st) => ({
      commissionSettlements: st.commissionSettlements.map((r) =>
        r.id === id ? { ...r, status: 'queried' as const, queryNote: note } : r,
      ),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    get().notify(plan.notification)
  },

  /* --------------------------- buyer payments ------------------------- */
  confirmBuyerPayment: (doId, method, ref) => {
    const s = get()
    const d = s.deliveryOrders.find((x) => x.id === doId)
    const result = planConfirmBuyerPayment(doId, method, ref, {
      role: s.role,
      deliveryOrder: d,
      lot: d ? s.lots.find((l) => l.id === d.lotId) : undefined,
    })
    if (!result.ok) return result
    const { plan } = result

    set((st) => ({
      deliveryOrders: st.deliveryOrders.map((x) => (x.id === doId ? { ...x, paidAmount: plan.due, stage: plan.stage } : x)),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
    // Finance confirming the money is what lets Operations schedule lifting.
    helpers.notifyRole(['exec_manager', 'sub_admin'], plan.opsNotification)
    get().notify(plan.buyerNotification)
    return { ok: true }
  },

  flagOverduePayment: (doId, note) => {
    const s = get()
    const d = s.deliveryOrders.find((x) => x.id === doId)
    const plan = planFlagOverduePayment(doId, note, { role: s.role, order: d, lot: d ? s.lots.find((l) => l.id === d.lotId) : undefined })
    if (!plan) return
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    get().notify(plan.notification)
  },

  /* ------------------------- EMD held & forfeited --------------------- */
  raiseEmdForfeiture: (lotId, buyerId, reason) => {
    const s = get()
    const lot = s.lots.find((l) => l.id === lotId)
    const result = planRaiseEmdForfeiture(lotId, buyerId, reason, {
      role: s.role,
      actorId: s.currentUser?.id,
      lot,
      hasActiveForfeitureOnLot: s.emdForfeitures.some((f) => f.lotId === lotId && f.buyerId === buyerId && f.status !== 'waived'),
      walletEmdLocked: s.wallets.find((x) => x.userId === buyerId)?.emdLocked ?? 0,
      ceoForfeitureFrom: s.financeConfig.ceoForfeitureFrom,
      now: s.now,
    })
    if (!result.ok) return result
    const { plan } = result

    set((st) => ({ emdForfeitures: [plan.record, ...st.emdForfeitures] }))
    if (plan.overThreshold) {
      helpers.raiseCeoApproval(plan.ceoApproval!.kind, plan.ceoApproval!.refId, plan.ceoApproval!.amount, plan.ceoApproval!.summary, plan.ceoApproval!.reason)
      get().audit(plan.audit!.action, plan.audit!.target, plan.audit!.detail, plan.audit!.severity)
      get().notify(plan.notification!)
      return { ok: true, awaitingCeo: true }
    }
    helpers.applyForfeiture(plan.record)
    return { ok: true }
  },

  waiveEmdForfeiture: (id, reason) => {
    const s = get()
    const record = s.emdForfeitures.find((f) => f.id === id)
    const result = planWaiveEmdForfeiture(id, reason, {
      role: s.role,
      actorId: s.currentUser?.id,
      record,
      lot: record ? s.lots.find((l) => l.id === record.lotId) : undefined,
      now: s.now,
    })
    if (!result.ok) return
    const { plan } = result

    set((st) => ({
      emdForfeitures: st.emdForfeitures.map((f) =>
        f.id === plan.forfeitureId ? { ...f, status: 'waived' as const, decidedBy: plan.decidedBy, decidedAt: plan.decidedAt, decisionNote: reason } : f,
      ),
      ceoApprovals: st.ceoApprovals.map((a) =>
        a.kind === 'emd_forfeiture' && a.refId === plan.forfeitureId && a.status === 'pending'
          ? { ...a, status: 'refused' as const, decidedBy: plan.decidedBy, decidedAt: plan.decidedAt, decisionNote: 'Withdrawn by Finance' }
          : a,
      ),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    get().notify(plan.notification)
  },

  /* -------------------------------- refunds --------------------------- */
  raiseRefund: ({ userId, amount, source, reason, lotId, catalogueId, disputeId }) => {
    const s = get()
    const result = planRaiseRefund({ userId, amount, source, reason, lotId, catalogueId, disputeId }, {
      role: s.role, actorId: s.currentUser?.id, ceoRefundFrom: s.financeConfig.ceoRefundFrom,
      party: s.users.find((u) => u.id === userId), now: s.now,
    })
    if (!result.ok) return result
    const { plan } = result
    set((st) => ({ refundRequests: [plan.record, ...st.refundRequests] }))
    if (plan.overThreshold) {
      helpers.raiseCeoApproval(plan.ceoApproval!.kind, plan.ceoApproval!.refId, plan.ceoApproval!.amount, plan.ceoApproval!.summary, plan.ceoApproval!.reason)
      get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
      return { ok: true, awaitingCeo: true }
    }
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    /* A Sub Admin closing a dispute in the customer's favour can raise this,
       but only Finance approves and pays it — so Finance is told rather than
       the request waiting to be noticed on a queue. */
    helpers.notifyRole('finance_admin', plan.deskNotification!, s.currentUser?.id)
    return { ok: true }
  },

  decideRefund: (id, approve, note) => {
    const s = get()
    const record = s.refundRequests.find((r) => r.id === id)
    const plan = planDecideRefund(approve, note, { role: s.role, record, party: record ? s.users.find((u) => u.id === record.userId) : undefined, now: s.now })
    if (!plan) return
    set((st) => ({
      refundRequests: st.refundRequests.map((r) =>
        r.id === id
          ? { ...r, status: plan.approve ? ('approved' as const) : ('rejected' as const), decidedBy: st.currentUser?.id, decidedAt: plan.decidedAt, decisionNote: note }
          : r,
      ),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    if (plan.notification) get().notify(plan.notification)
  },

  processRefund: (id) => {
    const s = get()
    const record = s.refundRequests.find((r) => r.id === id)
    const dispute = record?.disputeId ? s.disputes.find((x) => x.id === record.disputeId) : undefined
    const result = planProcessRefund({ role: s.role, record, party: record ? s.users.find((u) => u.id === record.userId) : undefined, dispute, now: s.now })
    if (!result.ok) return result
    const { plan } = result
    helpers.ensureWallet(record!.userId)
    set((st) => ({
      refundRequests: st.refundRequests.map((r) =>
        r.id === id ? { ...r, status: 'processed' as const, processedBy: st.currentUser?.id, processedAt: plan.processedAt } : r,
      ),
      wallets: st.wallets.map((w) =>
        w.userId === record!.userId
          ? {
              ...w,
              balance: w.balance + plan.ledgerEntry.amount,
              ledger: [{ id: uid('led'), at: plan.processedAt, type: 'refund' as const, amount: plan.ledgerEntry.amount, ref: plan.ledgerEntry.ref, lotId: record!.lotId, catalogueId: record!.catalogueId, note: plan.ledgerEntry.note }, ...w.ledger],
            }
          : w,
      ),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
    get().notify(plan.notification)

    // The last link in the support chain. A Sub Admin decided the dispute and
    // held it open because money was owed; paying it is what actually closes
    // it, so Finance closes it here rather than leaving the customer with a
    // ticket that is only resolved once somebody remembers to say so.
    if (plan.disputeClose) {
      const dc = plan.disputeClose
      set((st) => ({
        disputes: st.disputes.map((x) => (x.id === dc.disputeId
          ? { ...x, status: 'resolved' as const, resolvedAt: dc.resolvedAt, resolvedById: dc.resolvedById, messages: [...x.messages, dc.message] }
          : x)),
      }))
      get().audit(dc.audit.action, dc.audit.target, dc.audit.detail)
    }
    return { ok: true }
  },

  /* --------------------------- invoices & receipts -------------------- */
  issueInvoice: (input) => {
    const s = get()
    const plan = planIssueInvoice(input, { role: s.role, invoiceCount: s.invoices.length, actorId: s.currentUser?.id, party: s.users.find((u) => u.id === input.partyId), now: s.now })
    if (!plan) return null
    set((st) => ({ invoices: [plan.record, ...st.invoices] }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
    get().notify(plan.notification)
    return plan.record
  },

  reissueInvoice: (id, note) => {
    const s = get()
    const original = s.invoices.find((i) => i.id === id)
    const plan = planReissueInvoice(note, { role: s.role, original, actorId: s.currentUser?.id, now: s.now })
    if (!plan) return
    // Superseded, not overwritten — the original stays on the record.
    set((st) => ({
      invoices: [plan.replacement, ...st.invoices.map((i) => (i.id === id ? { ...i, status: 'superseded' as const } : i))],
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    get().notify(plan.notification)
  },

  cancelInvoice: (id, note) => {
    const s = get()
    const original = s.invoices.find((i) => i.id === id)
    const plan = planCancelInvoice(note, { role: s.role, original })
    if (!plan) return
    set((st) => ({ invoices: st.invoices.map((i) => (i.id === id ? { ...i, status: 'cancelled' as const, note } : i)) }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    get().notify(plan.notification)
  },

  /* ------------------------------ reconciliation ---------------------- */
  matchBankLine: (lineId, matchedTo, kind) => {
    const s = get()
    const line = s.bankStatementLines.find((l) => l.id === lineId)
    const plan = planMatchBankLine(matchedTo, { role: s.role, line, now: s.now })
    if (!plan) return
    set((st) => ({
      bankStatementLines: st.bankStatementLines.map((l) =>
        l.id === lineId
          ? { ...l, status: 'matched' as const, matchedTo, matchedKind: kind, matchedBy: st.currentUser?.id, matchedAt: plan.matchedAt, breakNote: undefined, escalated: false }
          : l,
      ),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
  },

  unmatchBankLine: (lineId) => {
    const s = get()
    const line = s.bankStatementLines.find((l) => l.id === lineId)
    const plan = planUnmatchBankLine({ role: s.role, line })
    if (!plan) return
    set((st) => ({
      bankStatementLines: st.bankStatementLines.map((l) =>
        l.id === lineId ? { ...l, status: 'unmatched' as const, matchedTo: undefined, matchedKind: undefined, matchedBy: undefined, matchedAt: undefined } : l,
      ),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
  },

  flagBankBreak: (lineId, note) => {
    const s = get()
    const line = s.bankStatementLines.find((l) => l.id === lineId)
    const plan = planFlagBankBreak(note, { role: s.role, line })
    if (!plan) return
    set((st) => ({
      bankStatementLines: st.bankStatementLines.map((l) => (l.id === lineId ? { ...l, status: 'break' as const, breakNote: note } : l)),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
  },

  escalateBankBreak: (lineId) => {
    const s = get()
    const line = s.bankStatementLines.find((l) => l.id === lineId)
    const plan = planEscalateBankBreak({ role: s.role, line })
    if (!plan) return
    set((st) => ({ bankStatementLines: st.bankStatementLines.map((l) => (l.id === lineId ? { ...l, escalated: true } : l)) }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    helpers.notifyRole('super_admin', plan.notification)
  },
})
