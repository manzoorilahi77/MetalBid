import { uid, inr } from '../../lib/format'
import { emdWindowClosed, emdWindowNotOpen, totalEmdRequired } from '../../lib/emd'
import { planRequestWithdrawal, planCancelWithdrawal } from '../../application/withdrawal'
import { planSubmitKyc, planRegisterBankAccount, planSubmitDepositClaim, planRequestEmdExemption } from '../../application/buyerRegistration'
import { planBookInspectionSlot, planRecordWeighment, planCompleteLifting } from '../../application/deliveryHandover'
import { isCatalogueEmdLocked } from '../constants'
import type { StoreGet, StoreSet, InternalHelpers } from '../internal'
import type { State } from '../types'

export const createBuyerSlice = (
  set: StoreSet, get: StoreGet, helpers: InternalHelpers,
): Pick<State,
  'toggleShortlist' | 'toggleWatchlist' | 'fundEmd' | 'placeBid' | 'setAutoBid' | 'topUpWallet' | 'acceptTerms'
  | 'bookInspectionSlot' | 'submitKyc' | 'advanceDeliveryOrder' | 'toggleLiftingChecklistItem' | 'recordWeighment'
  | 'completeLifting' | 'registerBankAccount' | 'submitDepositClaim' | 'requestWithdrawal' | 'cancelWithdrawal'
  | 'requestEmdExemption'
> => ({
  /* ------------------------------- buyer ------------------------------ */
  toggleShortlist: (catalogueId, lotId) => {
    const me = get().currentUser
    if (!me) return
    const cat = get().catalogues.find((c) => c.id === catalogueId)
    // Cut-off guard, same rule fundEmd enforces. Callers pre-check
    // `emdWindowClosed` so they can show the deadline message; this is the backstop.
    // An approved exemption request reopens this despite the deadline.
    if (cat && emdWindowClosed(cat, get().now) && !helpers.hasApprovedEmdExemption(me.id, catalogueId)) return
    // Symmetric guard on the other side of the window — nothing to fund yet.
    if (cat && emdWindowNotOpen(cat, get().now)) return
    set((st) => {
      const existing = st.selections.find((x) => x.buyerId === me.id && x.catalogueId === catalogueId)
      if (!existing) {
        return { selections: [...st.selections, { buyerId: me.id, catalogueId, lotIds: [lotId], emdFundedLotIds: [] }] }
      }
      const has = existing.lotIds.includes(lotId)
      return {
        selections: st.selections.map((x) =>
          x === existing
            ? {
                ...x,
                lotIds: has ? x.lotIds.filter((id) => id !== lotId) : [...x.lotIds, lotId],
                // deselecting an unfunded lot is free; funded lots stay funded until close
                emdFundedLotIds: has ? x.emdFundedLotIds : x.emdFundedLotIds,
              }
            : x,
        ),
      }
    })
  },

  toggleWatchlist: (catalogueId) => {
    const me = get().currentUser
    if (!me) return
    set((st) => {
      const has = st.watchlist.some((w) => w.buyerId === me.id && w.catalogueId === catalogueId)
      const cat = st.catalogues.find((c) => c.id === catalogueId)
      // Read-only once either EMD is funded, or the pre-bid EMD deadline has
      // passed without full funding — the buyer missed the cut-off, so the
      // entry stays put (visible, locked) as a record of what fell through,
      // rather than letting them quietly unshortlist and lose that signal.
      if (has && (isCatalogueEmdLocked(st, me.id, catalogueId) || (cat && emdWindowClosed(cat, st.now)))) return st
      // Can't shortlist before the EMD window has even opened — nothing to fund yet.
      if (!has && cat && emdWindowNotOpen(cat, st.now)) return st
      return {
        watchlist: has
          ? st.watchlist.filter((w) => !(w.buyerId === me.id && w.catalogueId === catalogueId))
          : [...st.watchlist, { buyerId: me.id, catalogueId }],
      }
    })
  },

  fundEmd: (catalogueId, lotIds, method) => {
    const s = get()
    const me = s.currentUser
    if (!me) return false
    const w = helpers.ensureWallet(me.id)
    const lots = s.lots.filter((l) => lotIds.includes(l.id))
    const total = totalEmdRequired(lots)
    if (w.balance < total) return false
    const cat = s.catalogues.find((c) => c.id === catalogueId)!
    // Cut-off guard. Callers pre-check `emdWindowClosed` so they can show the
    // deadline message rather than the balance one; this is the backstop.
    // An approved exemption request reopens this despite the deadline.
    if (emdWindowClosed(cat, s.now) && !helpers.hasApprovedEmdExemption(me.id, catalogueId)) return false
    // Symmetric guard on the other side of the window — nothing to fund yet.
    if (emdWindowNotOpen(cat, s.now)) return false
    set((st) => ({
      wallets: st.wallets.map((x) =>
        x.userId === me.id
          ? {
              ...x, balance: x.balance - total, emdLocked: x.emdLocked + total,
              ledger: [
                ...lots.map((l) => ({
                  id: uid('led'), at: new Date(st.now).toISOString(), type: 'emd_lock' as const,
                  amount: -l.preBidEmd, ref: uid('EMD').toUpperCase(), lotId: l.id, catalogueId,
                  note: `Pre-bid EMD locked — ${l.lotNo} (${cat.code}) via ${method}`,
                })),
                ...x.ledger,
              ],
            }
          : x,
      ),
      selections: (() => {
        const existing = st.selections.find((x) => x.buyerId === me.id && x.catalogueId === catalogueId)
        if (!existing) {
          return [...st.selections, { buyerId: me.id, catalogueId, lotIds: [...lotIds], emdFundedLotIds: [...lotIds] }]
        }
        return st.selections.map((x) =>
          x === existing
            ? { ...x, lotIds: [...new Set([...x.lotIds, ...lotIds])], emdFundedLotIds: [...new Set([...x.emdFundedLotIds, ...lotIds])] }
            : x,
        )
      })(),
    }))
    get().notify({
      userId: me.id, kind: 'wallet', title: `EMD locked for ${lots.length} lot${lots.length > 1 ? 's' : ''}`,
      body: `${inr(total)} locked against ${cat.code} via ${method}.`, href: '/buyer/shortlist',
    })
    return true
  },

  placeBid: (lotId, rate, bidderId, type = 'manual') => {
    const me = get().currentUser
    const who = bidderId ?? me?.id
    if (!who) return { ok: false, error: 'Sign in to bid' }
    return helpers.applyBid(lotId, rate, who, type)
  },

  setAutoBid: (lotId, maxRate, active) => {
    const me = get().currentUser
    if (!me) return
    set((st) => {
      const rest = st.autoBids.filter((a) => !(a.buyerId === me.id && a.lotId === lotId))
      return { autoBids: active ? [...rest, { buyerId: me.id, lotId, maxRate, active }] : rest }
    })
  },

  topUpWallet: (amount, method) => {
    const me = get().currentUser
    if (!me) return
    helpers.ensureWallet(me.id)
    set((st) => ({
      wallets: st.wallets.map((w) =>
        w.userId === me.id
          ? {
              ...w, balance: w.balance + amount,
              ledger: [{ id: uid('led'), at: new Date(st.now).toISOString(), type: 'topup' as const, amount, ref: uid('UTR').toUpperCase(), note: `Wallet top-up via ${method}` }, ...w.ledger],
            }
          : w,
      ),
    }))
    get().notify({ userId: me.id, kind: 'wallet', title: 'Wallet top-up successful', body: `${inr(amount)} added via ${method}.`, href: '/buyer/wallet' })
  },

  acceptTerms: (catalogueId) => {
    const s = get()
    const cat = s.catalogues.find((c) => c.id === catalogueId)
    const ts = s.termsSets.find((t) => t.id === cat?.termsSetId)
    set((st) => ({ termsAccepted: { ...st.termsAccepted, [catalogueId]: ts?.version ?? 'v1' } }))
  },

  bookInspectionSlot: (catalogueId, date, window, persons) => {
    const me = get().currentUser
    if (!me) return
    const cat = get().catalogues.find((c) => c.id === catalogueId)
    const plan = planBookInspectionSlot(catalogueId, date, window, persons, { actor: me, catalogue: cat })
    set((st) => ({ inspectionSlots: [...st.inspectionSlots, plan.slot] }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
    helpers.notifyRole(['exec_manager', 'sub_admin'], plan.opsNotification)
    if (plan.fieldExecNotification) get().notify(plan.fieldExecNotification)
  },

  submitKyc: () => {
    const me = get().currentUser
    if (!me) return
    const plan = planSubmitKyc({ actor: me })
    set((st) => ({
      users: st.users.map((u) => (u.id === me.id ? { ...u, kycStatus: 'pending' as const } : u)),
      currentUser: { ...me, kycStatus: 'pending' },
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
    get().notify(plan.selfNotification)
    helpers.notifyRole(['exec_manager', 'sub_admin'], plan.opsNotification)
  },

  // valid only for the two hops needing no extra data — payment_pending needs
  // issueDemandDraft, and lifted needs completeLifting (checklist-gated)
  advanceDeliveryOrder: (doId) => {
    const order = ['payment_pending', 'dd_issued', 'lifting_scheduled', 'lifted', 'completed'] as const
    set((st) => ({
      deliveryOrders: st.deliveryOrders.map((d) => {
        if (d.id !== doId) return d
        if (d.stage !== 'dd_issued' && d.stage !== 'lifting_scheduled') return d
        const idx = order.indexOf(d.stage)
        return { ...d, stage: order[idx + 1] }
      }),
    }))
  },

  toggleLiftingChecklistItem: (doId, key) => {
    const me = get().currentUser
    set((st) => ({
      deliveryOrders: st.deliveryOrders.map((d) => {
        if (d.id !== doId || d.stage !== 'lifted' || !me || d.buyerId !== me.id) return d
        return {
          ...d,
          liftingChecklist: d.liftingChecklist.map((item) =>
            item.key !== key ? item : { ...item, done: !item.done, at: !item.done ? new Date(st.now).toISOString() : undefined },
          ),
        }
      }),
    }))
  },

  recordWeighment: (doId, qty) => {
    const s = get()
    const d = s.deliveryOrders.find((x) => x.id === doId)
    const plan = planRecordWeighment(qty, { order: d, lot: s.lots.find((l) => l.id === d?.lotId), actor: s.currentUser, role: s.role, now: s.now })
    if (!plan) return
    set((st) => ({
      deliveryOrders: st.deliveryOrders.map((x) => (x.id === doId
        ? {
          ...x,
          weighedQty: plan.mutation.qty,
          weighedById: plan.mutation.weighedById,
          weighedAt: plan.mutation.weighedAt,
          liftingChecklist: x.liftingChecklist.map((item) =>
            item.key !== 'gross_weighment' ? item : { ...item, done: true, at: plan.mutation.weighedAt },
          ),
        }
        : x)),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    if (plan.buyerDeclaredNotification) helpers.notifyRole(['exec_manager', 'sub_admin'], plan.buyerDeclaredNotification)
    if (plan.staffConfirmedNotification) get().notify(plan.staffConfirmedNotification)
    if (plan.shortfallNotification) helpers.notifyRole('finance_admin', plan.shortfallNotification)
  },

  completeLifting: (doId) => {
    const s = get()
    const d = s.deliveryOrders.find((x) => x.id === doId)
    const plan = planCompleteLifting(doId, { order: d, lot: s.lots.find((l) => l.id === d?.lotId), actor: s.currentUser, role: s.role })
    if (!plan) return
    set((st) => ({
      deliveryOrders: st.deliveryOrders.map((x) => (x.id === doId ? { ...x, stage: 'completed' as const } : x)),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
    // Closing the handover is Operations' step, and it comes next.
    helpers.notifyRole(['exec_manager', 'sub_admin'], plan.notification)
  },

  registerBankAccount: (bankName, accountNumber, ifsc, accountHolderName) => {
    const me = get().currentUser
    if (!me) return
    const plan = planRegisterBankAccount(bankName, accountNumber, ifsc, accountHolderName, { actorId: me.id, actorFirm: me.firm, now: get().now })
    set((st) => ({ bankAccounts: [...st.bankAccounts, plan.account] }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
    helpers.notifyRole('finance_admin', plan.notification)
  },

  submitDepositClaim: (amount, utr, transferDate, proofFilename) => {
    const s = get()
    const result = planSubmitDepositClaim(amount, utr, transferDate, proofFilename, {
      actor: s.currentUser, existingUtrs: s.depositClaims.map((c) => c.utr.trim().toLowerCase()), now: s.now,
    })
    if (!result.ok) return result
    const { plan } = result
    set((st) => ({ depositClaims: [...st.depositClaims, plan.claim] }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
    helpers.notifyRole('finance_admin', plan.notification)
    return { ok: true }
  },

  requestWithdrawal: (amount, bankAccountId) => {
    const s = get()
    const me = s.currentUser
    const result = planRequestWithdrawal(amount, bankAccountId, {
      currentUser: me,
      account: me ? s.bankAccounts.find((a) => a.id === bankAccountId && a.userId === me.id) : undefined,
      walletBalance: me ? helpers.wallet(me.id)?.balance : undefined,
      withdrawalWindow: s.withdrawalWindow,
      withdrawalSecondSignatureFrom: s.financeConfig.withdrawalSecondSignatureFrom,
      now: s.now,
    })
    if (!result.ok) return result
    const { plan } = result

    set((st) => ({
      withdrawalRequests: [...st.withdrawalRequests, plan.request],
      wallets: st.wallets.map((x) =>
        x.userId === plan.request.userId
          ? {
              ...x, balance: x.balance - plan.request.amount,
              ledger: [{ id: uid('led'), at: new Date(st.now).toISOString(), type: 'withdraw' as const, amount: -plan.request.amount, ref: plan.request.ref, note: plan.ledgerNote }, ...x.ledger],
            }
          : x,
      ),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
    // Money out runs on a window and a maker–checker; Finance is told at the
    // start of it, not when someone next opens the screen.
    helpers.notifyRole('finance_admin', plan.notification)
    return { ok: true }
  },

  cancelWithdrawal: (id) => {
    const s = get()
    const req = s.withdrawalRequests.find((r) => r.id === id)
    const plan = planCancelWithdrawal(id, { request: req, actor: s.currentUser, now: s.now })
    if (!plan) return
    set((st) => ({
      withdrawalRequests: st.withdrawalRequests.map((r) => (r.id === id ? { ...r, status: 'cancelled' as const, decidedAt: plan.decidedAt } : r)),
      wallets: st.wallets.map((w) =>
        w.userId === req!.userId
          ? { ...w, balance: w.balance + plan.ledgerEntry.amount, ledger: [{ id: uid('led'), at: new Date(st.now).toISOString(), type: 'refund' as const, amount: plan.ledgerEntry.amount, ref: plan.ledgerEntry.ref, note: plan.ledgerEntry.note }, ...w.ledger] }
          : w,
      ),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
    helpers.notifyRole('finance_admin', plan.deskNotification)
    get().notify(plan.selfNotification)
  },

  requestEmdExemption: (catalogueId, reason) => {
    const s = get()
    const cat = s.catalogues.find((c) => c.id === catalogueId)
    const hasExisting = !!s.currentUser && s.emdExemptionRequests.some(
      (r) => r.buyerId === s.currentUser!.id && r.catalogueId === catalogueId && r.status !== 'rejected',
    )
    const result = planRequestEmdExemption(catalogueId, reason, { actor: s.currentUser, catalogue: cat, hasExisting, now: s.now })
    if (!result.ok) return result
    const { plan } = result
    set((st) => ({ emdExemptionRequests: [...st.emdExemptionRequests, plan.request] }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    get().notify(plan.selfNotification)
    helpers.notifyRole(['auction_manager', 'exec_manager', 'sub_admin'], plan.deskNotification)
    return { ok: true }
  },
})
