import { uid, inr } from '../../lib/format'
import { planSendAnnouncement } from '../../application/announcements'
import {
  planIssueDemandDraft, planVerifyBankAccount, planRejectBankAccount,
  planApproveDepositClaim, planRejectDepositClaim, planApproveEmdExemption, planRejectEmdExemption,
  planSetCompanyBankAccounts,
} from '../../application/financeEligibilityDesk'
import { planApproveWithdrawal, planProcessWithdrawal, planFailWithdrawal, planSetWithdrawalWindow } from '../../application/withdrawalDesk'
import { planSetUserStanding } from '../../application/userStanding'
import { AUCTION_FLOOR_ROLES, PUBLISH_ROLES, RESULT_ROLES, SURVEILLANCE_ROLES } from '../constants'
import type { StoreGet, StoreSet, InternalHelpers } from '../internal'
import type { State } from '../types'
import type { BidVoidRequest, CancellationRequest, ResultConfirmation, StaReferral } from '../../types'

export const createAuctionFloorSlice = (
  set: StoreSet, get: StoreGet, helpers: InternalHelpers,
): Pick<State,
  'rescheduleCatalogue' | 'returnCatalogueToOps' | 'requestCancellation' | 'decideCancellationRequest' | 'flagBid'
  | 'requestBidVoid' | 'dismissBidFlag' | 'decideBidVoidRequest' | 'sendAnnouncement' | 'confirmAuctionResults'
  | 'referStaLot' | 'setUserStanding' | 'issueDemandDraft' | 'verifyBankAccount' | 'rejectBankAccount'
  | 'approveDepositClaim' | 'rejectDepositClaim' | 'approveWithdrawal' | 'processWithdrawal' | 'failWithdrawal'
  | 'approveEmdExemption' | 'rejectEmdExemption' | 'setWithdrawalWindow' | 'setCompanyBankAccounts'
> => ({
  /* ------------------------- auction floor -------------------------------
     Publishing and EMD eligibility are shared with Operations; running the
     sale is this desk's own. The two irreversible calls — cancelling a sale
     and voiding a bid — leave here as requests and are closed by a Super
     Admin, which is why they are modelled as records with evidence. */

  rescheduleCatalogue: (catalogueId, { emdOpensAt, emdDeadline, startsAt, endsAt, antiSnipeMinutes }) => {
    if (!PUBLISH_ROLES.includes(get().role)) return { ok: false, error: 'Not permitted for this role' }
    const cat = get().catalogues.find((c) => c.id === catalogueId)
    if (!cat) return { ok: false, error: 'Auction not found' }
    if (cat.status === 'live' || cat.status === 'closed') {
      return { ok: false, error: 'Only an auction that has not gone live can be rescheduled' }
    }
    /* The four instants have to run in order — EMD opens, EMD closes, bidding
       opens, bidding closes. An EMD window that shuts after bidding starts
       would let a buyer join a sale they were never able to fund, and one
       that opens after it shuts can be funded by nobody at all. */
    if (Date.parse(emdDeadline) <= Date.parse(emdOpensAt)) {
      return { ok: false, error: 'EMD has to close after it opens' }
    }
    if (Date.parse(emdDeadline) > Date.parse(startsAt)) {
      return { ok: false, error: 'EMD has to close before bidding opens — buyers fund first, then bid' }
    }
    if (Date.parse(endsAt) <= Date.parse(startsAt)) return { ok: false, error: 'The close must fall after the start' }
    set((st) => ({
      catalogues: st.catalogues.map((c) =>
        c.id === catalogueId
          ? { ...c, startsAt, endsAt, antiSnipeMinutes, emdOpensAt, emdDeadline }
          : c,
      ),
      lots: st.lots.map((l) => (l.catalogueId === catalogueId ? { ...l, endsAt } : l)),
    }))
    const stamp = (iso: string) => new Date(iso).toLocaleString('en-IN')
    get().audit('auction.reschedule', cat.code, `Rescheduled — EMD ${stamp(emdOpensAt)} → ${stamp(emdDeadline)}, bidding ${stamp(startsAt)} → ${stamp(endsAt)}, anti-snipe ${antiSnipeMinutes} min`, 'warning')
    /* Buyers plan around these times — they have shortlisted lots and in most
       cases already locked EMD against them — and the seller is waiting on
       the sale. Moving the dates without telling either was the gap. */
    helpers.notifyParticipants(catalogueId, {
      kind: 'lifecycle', title: `${cat.code} has been rescheduled`,
      // the EMD cut-off moves with the sale now, so it is stated rather than
      // left for a buyer to discover when funding is refused
      body: `Bidding now opens ${new Date(startsAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} and closes ${new Date(endsAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}, with pre-bid EMD open until ${new Date(emdDeadline).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}. EMD you have already funded, and your shortlist, carry over.`,
    })
    if (cat.sellerId) {
      get().notify({
        userId: cat.sellerId, kind: 'lifecycle', title: `${cat.code} has been rescheduled`,
        body: `Your sale now runs ${new Date(startsAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} → ${new Date(endsAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}. Nothing about your lots or reserves has changed.`,
        href: '/seller/monitor',
      })
    }
    return { ok: true }
  },

  returnCatalogueToOps: (catalogueId, comments) => {
    if (!PUBLISH_ROLES.includes(get().role)) return
    const cat = get().catalogues.find((c) => c.id === catalogueId)
    if (!cat || cat.status === 'live' || cat.status === 'closed') return
    set((st) => ({
      catalogues: st.catalogues.map((c) => (c.id === catalogueId ? { ...c, status: 'draft' as const } : c)),
    }))
    get().audit('auction.return_to_ops', cat.code, `Returned to Operations before publish — ${comments}`, 'warning')
    helpers.notifyRole(['exec_manager', 'sub_admin'], {
      kind: 'system',
      title: `${cat.code} returned to Operations`, body: comments, href: '/exec/catalogue-builder',
    })
  },

  requestCancellation: (catalogueId, reason) => {
    if (!AUCTION_FLOOR_ROLES.includes(get().role)) return { ok: false, error: 'Not permitted for this role' }
    const s = get()
    const cat = s.catalogues.find((c) => c.id === catalogueId)
    if (!cat) return { ok: false, error: 'Auction not found' }
    if (s.cancellationRequests.some((r) => r.catalogueId === catalogueId && r.status === 'pending')) {
      return { ok: false, error: 'A cancellation request for this auction is already with the Super Admin' }
    }
    const req: CancellationRequest = {
      id: uid('cxr'), catalogueId, reason,
      requestedBy: s.currentUser?.id ?? 'system',
      requestedAt: new Date(s.now).toISOString(),
      status: 'pending',
    }
    set((st) => ({ cancellationRequests: [req, ...st.cancellationRequests] }))
    get().audit('auction.cancel_request', cat.code, `Cancellation requested — ${reason}`, 'critical')
    helpers.notifyRole('super_admin', {
      kind: 'system',
      title: `Cancellation requested — ${cat.code}`, body: reason, href: '/admin/control-tower',
    })
    return { ok: true }
  },

  decideCancellationRequest: (id, approve, note) => {
    if (get().role !== 'super_admin') return
    const s = get()
    const req = s.cancellationRequests.find((r) => r.id === id)
    if (!req || req.status !== 'pending') return
    set((st) => ({
      cancellationRequests: st.cancellationRequests.map((r) =>
        r.id === id
          ? { ...r, status: approve ? ('approved' as const) : ('rejected' as const), decidedBy: st.currentUser?.id, decidedAt: new Date(st.now).toISOString(), decisionNote: note }
          : r,
      ),
    }))
    const cat = s.catalogues.find((c) => c.id === req.catalogueId)
    if (approve) get().cancelCatalogue(req.catalogueId)
    get().audit(
      approve ? 'auction.cancel_approve' : 'auction.cancel_refuse',
      cat?.code ?? req.catalogueId,
      approve ? `Cancellation approved${note ? ` — ${note}` : ''}` : `Cancellation refused${note ? ` — ${note}` : ''} — the auction runs to its scheduled close`,
      'critical',
    )
    get().notify({
      userId: req.requestedBy, kind: 'system',
      title: approve ? `${cat?.code ?? 'Auction'} cancellation approved` : `${cat?.code ?? 'Auction'} cancellation refused`,
      body: note || (approve ? 'Open lots are unsold and EMD has been released.' : 'The auction continues to its scheduled close.'),
      href: '/auction/live',
    })
  },

  flagBid: (bidId, reason, notes) => {
    if (!SURVEILLANCE_ROLES.includes(get().role)) return
    const s = get()
    const bid = s.bids.find((b) => b.id === bidId)
    if (!bid || s.bidVoidRequests.some((r) => r.bidId === bidId && r.status === 'pending')) return
    const lot = s.lots.find((l) => l.id === bid.lotId)
    const req: BidVoidRequest = {
      id: uid('bvr'), bidId, lotId: bid.lotId, catalogueId: bid.catalogueId,
      reason, notes,
      raisedBy: s.currentUser?.id ?? 'system',
      raisedAt: new Date(s.now).toISOString(),
      stage: 'flagged', status: 'pending',
    }
    set((st) => ({ bidVoidRequests: [req, ...st.bidVoidRequests] }))
    get().audit('bid.flag', lot?.lotNo ?? bid.lotId, `${reason} — ${inr(bid.rate)} on ${lot?.lotNo ?? bid.lotId}${notes ? ` · ${notes}` : ''}`, 'warning')
    /* A flag is only worth raising if the desk that can escalate it hears
       about it while the auction is still running. Whoever flagged is left
       off — they know. */
    helpers.notifyRole(['auction_manager', 'sub_admin'], {
      kind: 'system', title: `Bid flagged — ${lot?.lotNo ?? 'a lot'}`,
      body: `${reason} · ${inr(bid.rate)}/${lot?.uom ?? 'MT'}${notes ? ` — ${notes}` : ''}. Decide whether to request a void from the Super Admin.`,
      href: '/auction/bid-monitor',
    }, s.currentUser?.id)
  },

  requestBidVoid: (requestId, note) => {
    if (!SURVEILLANCE_ROLES.includes(get().role)) return
    const s = get()
    const req = s.bidVoidRequests.find((r) => r.id === requestId)
    if (!req || req.status !== 'pending' || req.stage !== 'flagged') return
    set((st) => ({
      bidVoidRequests: st.bidVoidRequests.map((r) =>
        r.id === requestId
          ? { ...r, stage: 'requested' as const, requestedBy: st.currentUser?.id, requestedAt: new Date(st.now).toISOString(), notes: note ? `${r.notes ? `${r.notes} · ` : ''}${note}` : r.notes }
          : r,
      ),
    }))
    const lot = s.lots.find((l) => l.id === req.lotId)
    get().audit('bid.void_request', lot?.lotNo ?? req.lotId, `Void requested from Super Admin — ${req.reason}${note ? ` · ${note}` : ''}`, 'critical')
    helpers.notifyRole('super_admin', {
      kind: 'system',
      title: `Void requested — ${lot?.lotNo ?? 'bid'}`, body: req.reason, href: '/admin/control-tower',
    })
  },

  dismissBidFlag: (requestId, note) => {
    if (!SURVEILLANCE_ROLES.includes(get().role)) return
    const s = get()
    const req = s.bidVoidRequests.find((r) => r.id === requestId)
    if (!req || req.status !== 'pending') return
    set((st) => ({
      bidVoidRequests: st.bidVoidRequests.map((r) =>
        r.id === requestId
          ? { ...r, status: 'rejected' as const, decidedBy: st.currentUser?.id, decidedAt: new Date(st.now).toISOString(), decisionNote: note ?? 'Reviewed — bidding was legitimate' }
          : r,
      ),
    }))
    const lot = s.lots.find((l) => l.id === req.lotId)
    // Dismissed, not erased — the flag stays on the record either way.
    get().audit('bid.flag_dismiss', lot?.lotNo ?? req.lotId, `Flag reviewed and dismissed${note ? ` — ${note}` : ''} — the bid stands`, 'warning')
    // Whoever raised the flag is told what came of it — a surveillance chain
    // that never answers back stops being used.
    if (req.raisedBy && req.raisedBy !== s.currentUser?.id) {
      get().notify({
        userId: req.raisedBy, kind: 'system', title: `Flag dismissed — ${lot?.lotNo ?? 'a lot'}`,
        body: note || 'Reviewed and found legitimate. The bid stands and the flag remains on record.',
        href: '/sub/bid-monitor',
      })
    }
  },

  decideBidVoidRequest: (id, approve, note) => {
    if (get().role !== 'super_admin') return
    const s = get()
    const req = s.bidVoidRequests.find((r) => r.id === id)
    if (!req || req.status !== 'pending') return
    set((st) => ({
      bidVoidRequests: st.bidVoidRequests.map((r) =>
        r.id === id
          ? { ...r, status: approve ? ('approved' as const) : ('rejected' as const), decidedBy: st.currentUser?.id, decidedAt: new Date(st.now).toISOString(), decisionNote: note }
          : r,
      ),
    }))
    if (approve) get().voidBid(req.bidId)
    const lot = s.lots.find((l) => l.id === req.lotId)
    get().audit(
      approve ? 'bid.void_approve' : 'bid.void_refuse',
      lot?.lotNo ?? req.lotId,
      approve ? `Void approved${note ? ` — ${note}` : ''}` : `Void refused${note ? ` — ${note}` : ''} — the bid stands, the flag remains on record`,
      'critical',
    )
    get().notify({
      userId: req.requestedBy ?? req.raisedBy, kind: 'system',
      title: approve ? 'Bid voided' : 'Void request refused',
      body: note || (approve ? 'The ladder has been recomputed from the remaining valid bids.' : 'The bid stands. The flag remains on record.'),
      href: '/auction/bid-monitor',
    })
  },

  sendAnnouncement: ({ scope, catalogueId, title, body, severity }) => {
    const s = get()
    const cat = catalogueId ? s.catalogues.find((c) => c.id === catalogueId) : undefined
    const result = planSendAnnouncement({ scope, catalogueId, title, body, severity }, { role: s.role, cat, now: s.now })
    if (!result.ok) return result
    const { plan } = result
    set((st) => ({ announcements: [plan.record, ...st.announcements] }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    if (plan.notify.kind === 'participants') {
      helpers.notifyParticipants(plan.notify.catalogueId, plan.notify.plan)
    } else {
      get().notify(plan.notify.plan)
    }
    return { ok: true }
  },

  confirmAuctionResults: (catalogueId) => {
    if (!RESULT_ROLES.includes(get().role)) return { ok: false, error: 'Not permitted for this role' }
    const s = get()
    const cat = s.catalogues.find((c) => c.id === catalogueId)
    if (!cat) return { ok: false, error: 'Auction not found' }
    if (cat.status !== 'closed') return { ok: false, error: 'Results can only be confirmed once the auction has closed' }
    if (s.resultConfirmations.some((r) => r.catalogueId === catalogueId)) {
      return { ok: false, error: 'These results have already been confirmed' }
    }
    const catLots = s.lots.filter((l) => l.catalogueId === catalogueId)
    const undecided = catLots.filter((l) => l.status === 'sta' && !s.staReferrals.some((r) => r.lotId === l.id))
    if (undecided.length > 0) {
      return { ok: false, error: `${undecided.length} lot${undecided.length > 1 ? 's' : ''} cleared below reserve and still need${undecided.length > 1 ? '' : 's'} an Operations decision` }
    }
    const sold = catLots.filter((l) => l.status === 'sold')
    const realisation = sold.reduce((sum, l) => sum + (l.resultH1Rate ?? l.currentRate ?? 0) * l.indicativeQty, 0)
    const record: ResultConfirmation = {
      catalogueId,
      confirmedBy: s.currentUser?.id ?? 'system',
      confirmedAt: new Date(s.now).toISOString(),
      lotsSold: sold.length,
      lotsUnsold: catLots.filter((l) => l.status === 'unsold').length,
      realisation,
    }
    set((st) => ({ resultConfirmations: [record, ...st.resultConfirmations] }))
    get().audit('auction.results_confirm', cat.code, `Results confirmed — ${sold.length} of ${catLots.length} lots sold, realisation ${inr(realisation)}`, 'info')
    // Confirmation is the hand-off that opens the seller's accept/reject step.
    get().notify({
      userId: cat.sellerId, kind: 'system', title: `${cat.code} results confirmed`,
      body: `${sold.length} lot${sold.length === 1 ? '' : 's'} sold. Review each cleared price and settle commission.`,
      href: '/seller/settlement',
    })
    return { ok: true }
  },

  referStaLot: (lotId, note) => {
    if (!RESULT_ROLES.includes(get().role)) return
    const s = get()
    const lot = s.lots.find((l) => l.id === lotId)
    if (!lot || lot.status !== 'sta' || s.staReferrals.some((r) => r.lotId === lotId)) return
    const referral: StaReferral = {
      id: uid('star'), lotId, catalogueId: lot.catalogueId, note,
      referredBy: s.currentUser?.id ?? 'system',
      referredAt: new Date(s.now).toISOString(),
    }
    set((st) => ({ staReferrals: [referral, ...st.staReferrals] }))
    const cat = s.catalogues.find((c) => c.id === lot.catalogueId)
    get().audit('auction.sta_refer', lot.lotNo, `Below-reserve lot referred to Operations (${cat?.code ?? lot.catalogueId}) — ${note}`, 'warning')
    helpers.notifyRole(['exec_manager', 'sub_admin'], {
      kind: 'system',
      title: `${lot.lotNo} referred — cleared below reserve`,
      body: note, href: '/exec/settlement',
    })
  },
  setUserStanding: (userId, standing, reason) => {
    const s = get()
    const plan = planSetUserStanding(userId, standing, reason, { u: s.users.find((x) => x.id === userId), now: s.now })
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
  },
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

  setWithdrawalWindow: (config) => {
    const plan = planSetWithdrawalWindow(config, get().role)
    if (!plan) return
    set({ withdrawalWindow: config })
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
  },

  setCompanyBankAccounts: (accounts) => {
    const plan = planSetCompanyBankAccounts(accounts, get().role)
    if (!plan) return
    set({ companyBankAccounts: accounts })
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
  },
})
