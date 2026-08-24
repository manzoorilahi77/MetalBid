import { inr } from '../../lib/format'
import { planSubmitInspection, planDecideLot, planWaiveInspection, planDecideSellerKyc, planConfirmHandover } from '../../application/opsInspection'
import { planPublishDraftCatalogue, planAssignCatalogue, planPublishCatalogue } from '../../application/catalogue'
import { planSetSellerLotDecision, planRecordCommissionSettlement } from '../../application/sellerWorkflow'
import { planResolveFlaggedLot, planApproveStaSale, planMarkStaUnsold, planReturnRefusedLotToPipeline } from '../../application/lotResolution'
import { AUCTION_FLOOR_ROLES } from '../constants'
import type { StoreGet, StoreSet, InternalHelpers } from '../internal'
import type { State } from '../types'
import type { LotStatus } from '../../types'

export const createOpsSlice = (
  set: StoreSet, get: StoreGet, helpers: InternalHelpers,
): Pick<State,
  'submitInspection' | 'resolveFlaggedLot' | 'approveStaSale' | 'markStaUnsold' | 'returnRefusedLotToPipeline'
  | 'decideLot' | 'decideSellerKyc' | 'confirmHandover' | 'setSellerLotDecision'
  | 'recordCommissionSettlement' | 'publishCatalogue' | 'assignCatalogue' | 'waiveInspection' | 'publishDraftCatalogue'
  | 'pauseCatalogue' | 'resumeCatalogue' | 'extendCatalogue' | 'cancelCatalogue' | 'voidBid'
> => ({
  /* ---------------------------- ops / admin --------------------------- */
  submitInspection: (lotId, report, outcome) => {
    // A filed report is evidence — it is never edited. A correction is a
    // re-inspection, which appends a new version and leaves the earlier one
    // on record.
    const s = get()
    const me = s.currentUser
    const lot = s.lots.find((l) => l.id === lotId)
    const plan = planSubmitInspection(lotId, report, outcome, {
      now: s.now,
      lot,
      priorReportCount: s.inspectionReports.filter((r) => r.lotId === lotId).length,
      inspectorId: me?.id ?? 'u-field-1',
      inspectorName: me?.name ?? 'Field executive',
      sellerId: helpers.sellerOfLot(lot),
    })
    set((st) => ({
      inspectionReports: [...st.inspectionReports, plan.report],
      lots: st.lots.map((l) => (l.id === lotId ? { ...l, status: plan.lotStatus, inspectionReportId: plan.report.id } : l)),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)

    // The two people whose work waits on the report hear about it as it lands:
    // Operations decides the lot, the seller owns the material. Both roles
    // hold the lot gate, so both are told a report has landed.
    helpers.notifyRole(['exec_manager', 'sub_admin'], plan.opsNotification)
    if (plan.sellerNotification) get().notify(plan.sellerNotification)
  },

  resolveFlaggedLot: (lotId) => {
    const s = get()
    const result = planResolveFlaggedLot(lotId, { role: s.role, lot: s.lots.find((l) => l.id === lotId) })
    if (!result.ok) return result
    set((st) => ({ lots: st.lots.map((l) => (l.id === lotId ? { ...l, status: 'inspected' as LotStatus } : l)) }))
    return { ok: true }
  },

  approveStaSale: (lotId) => {
    const s = get()
    const lot = s.lots.find((l) => l.id === lotId)
    const result = planApproveStaSale(lotId, { role: s.role, lot, catalogue: lot ? s.catalogues.find((c) => c.id === lot.catalogueId) : undefined })
    if (!result.ok) return result
    set((st) => ({ lots: st.lots.map((l) => (l.id === lotId ? { ...l, status: 'sold' as LotStatus } : l)) }))
    return { ok: true }
  },

  markStaUnsold: (lotId) => {
    const s = get()
    const lot = s.lots.find((l) => l.id === lotId)
    const result = planMarkStaUnsold(lotId, { role: s.role, lot, catalogue: lot ? s.catalogues.find((c) => c.id === lot.catalogueId) : undefined })
    if (!result.ok) return result
    set((st) => ({ lots: st.lots.map((l) => (l.id === lotId ? { ...l, status: 'unsold' as LotStatus } : l)) }))
    return { ok: true }
  },

  returnRefusedLotToPipeline: (lotId) => {
    const s = get()
    const lot = s.lots.find((l) => l.id === lotId)
    const result = planReturnRefusedLotToPipeline(lotId, { role: s.role, lot, catalogue: lot ? s.catalogues.find((c) => c.id === lot.catalogueId) : undefined })
    if (!result.ok) return result
    set((st) => ({ lots: st.lots.map((l) => (l.id === lotId ? { ...l, status: 'unsold' as LotStatus } : l)) }))
    return { ok: true }
  },

  decideLot: (lotId, outcome, reason) => {
    const s = get()
    const lot = s.lots.find((l) => l.id === lotId)
    const result = planDecideLot(lotId, outcome, reason, {
      role: s.role,
      lot,
      catalogue: lot ? s.catalogues.find((c) => c.id === lot.catalogueId) : undefined,
      sellerId: helpers.sellerOfLot(lot),
    })
    if (!result.ok) return result
    const { plan } = result

    set((st) => ({ lots: st.lots.map((l) => (l.id === lotId ? { ...l, status: plan.status } : l)) }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    // The seller finds out from us, not by noticing their lot is missing.
    if (plan.sellerNotification) get().notify(plan.sellerNotification)
    // A re-inspection is work for whoever is holding the catalogue.
    if (plan.fieldExecNotification) get().notify(plan.fieldExecNotification)
    // This may have been the last lot the catalogue was waiting on.
    if (plan.shouldAnnounceCatalogueReady) helpers.announceCatalogueReady(lot!.catalogueId)
    return { ok: true }
  },

  decideSellerKyc: (userId, approve, reason) => {
    const s = get()
    const result = planDecideSellerKyc(userId, approve, reason, { role: s.role, user: s.users.find((u) => u.id === userId) })
    if (!result.ok) return result
    const { plan } = result
    set((st) => ({
      users: st.users.map((u) => (u.id === userId
        ? { ...u, kycStatus: plan.kycStatus, sellerVerified: plan.approve ? true : u.sellerVerified }
        : u)),
      currentUser: st.currentUser?.id === userId
        ? { ...st.currentUser, kycStatus: plan.kycStatus, sellerVerified: plan.approve ? true : st.currentUser.sellerVerified }
        : st.currentUser,
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    get().notify(plan.notification)
    return { ok: true }
  },

  confirmHandover: (doId, note) => {
    const s = get()
    const order = s.deliveryOrders.find((d) => d.id === doId)
    const result = planConfirmHandover(doId, note, {
      role: s.role, order, lot: s.lots.find((l) => l.id === order?.lotId),
      weigher: order ? s.users.find((u) => u.id === order.weighedById) : undefined,
      now: s.now,
    })
    if (!result.ok) return result
    const { plan } = result
    set((st) => ({
      deliveryOrders: st.deliveryOrders.map((d) =>
        d.id === doId ? { ...d, handoverConfirmedAt: plan.handoverConfirmedAt, handoverConfirmedBy: st.currentUser?.id, handoverNote: note } : d,
      ),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
    get().notify(plan.buyerNotification)
    // Finance books the sale off the back of this.
    helpers.notifyRole('finance_admin', plan.financeNotification)
    return { ok: true }
  },

  setSellerLotDecision: (lotId, decision) => {
    const s = get()
    const lot = s.lots.find((l) => l.id === lotId)
    const cat = s.catalogues.find((c) => c.id === lot?.catalogueId)
    const result = planSetSellerLotDecision(lotId, decision, {
      role: s.role, lot, catalogue: cat, seller: s.users.find((u) => u.id === cat?.sellerId),
    })
    if (!result.ok) return result
    const { plan } = result

    set((st) => ({ lots: st.lots.map((l) => (l.id === lotId ? { ...l, sellerDecision: decision } : l)) }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    /* Rejecting is not the end of the lot — it is the start of an operational
       exception, and the material is sitting in a yard while it waits. Ops
       used to have to notice. */
    if (plan.rejectedNotification) helpers.notifyRole(['exec_manager', 'sub_admin'], plan.rejectedNotification)
    /* Accepting is what makes commission owed, so Finance is told a receipt is
       coming rather than discovering it when the seller records payment. */
    if (plan.acceptedNotification) helpers.notifyRole('finance_admin', plan.acceptedNotification)
    return { ok: true }
  },

  recordCommissionSettlement: (catalogueId, amount, mode, reference) => {
    const s = get()
    const result = planRecordCommissionSettlement(catalogueId, amount, mode, reference, {
      role: s.role, actorId: s.currentUser?.id, actorFirm: s.currentUser?.firm,
      catalogue: s.catalogues.find((c) => c.id === catalogueId), now: s.now,
    })
    if (!result.ok) return result
    const { plan } = result

    set((st) => ({ commissionSettlements: [...st.commissionSettlements, plan.record] }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
    // Hands the record straight to the Finance desk that has to confirm it.
    helpers.notifyRole('finance_admin', plan.notification)
    return { ok: true }
  },

  publishCatalogue: (cat, lotIds, overrides) => {
    const plan = planPublishCatalogue(cat, lotIds, overrides, { now: get().now, actorId: get().currentUser?.id, lots: get().lots })
    const lotResultById = new Map(plan.lotResults.map((r) => [r.lotId, r]))
    set((st) => ({
      catalogues: [...st.catalogues, { ...cat, lotIds }],
      lots: st.lots.map((l) => {
        const r = lotResultById.get(l.id)
        if (!r) return l
        return {
          ...l, ...overrides[l.id], catalogueId: cat.id,
          ...(r.overrideRows.length > 0 ? { overrides: [...(l.overrides ?? []), ...r.overrideRows] } : {}),
          lotNo: r.lotNo,
          status: r.status,
          endsAt: r.endsAt,
        }
      }),
    }))
    get().audit(plan.mainAudit.action, plan.mainAudit.target, plan.mainAudit.detail, plan.mainAudit.severity)
    if (plan.overrideAudit) {
      get().audit(plan.overrideAudit.action, plan.overrideAudit.target, plan.overrideAudit.detail, plan.overrideAudit.severity)
      if (plan.sellerOverrideNotification) get().notify(plan.sellerOverrideNotification)
    }
    if (plan.broadcastNotification) get().notify(plan.broadcastNotification)
    if (plan.fieldExecNotification) get().notify(plan.fieldExecNotification)
  },

  assignCatalogue: (catalogueId, fieldExecId) => {
    set((st) => ({
      catalogues: st.catalogues.map((c) => (c.id === catalogueId ? { ...c, assignedFieldExecId: fieldExecId } : c)),
    }))
    const cat = get().catalogues.find((c) => c.id === catalogueId)
    const exec = get().users.find((u) => u.id === fieldExecId)
    const plan = planAssignCatalogue(catalogueId, fieldExecId, { catalogue: cat, fieldExec: exec })
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
    // Work never lands silently on the field executive's queue.
    if (plan.notification) get().notify(plan.notification)
  },

  waiveInspection: (lotId, managerId, reason) => {
    const s = get()
    const lot = s.lots.find((l) => l.id === lotId)
    const result = planWaiveInspection(lotId, reason, {
      role: s.role, lot, sellerId: helpers.sellerOfLot(lot), now: s.now,
    })
    if (!result.ok) return result
    const { plan } = result

    set((st) => ({
      lots: st.lots.map((l) =>
        l.id === lotId
          ? { ...l, status: 'approved' as LotStatus, inspectionWaived: true, waivedBy: managerId, waivedReason: reason, waivedAt: plan.waivedAt }
          : l,
      ),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    if (plan.sellerNotification) get().notify(plan.sellerNotification)
    helpers.announceCatalogueReady(plan.catalogueId)
    return { ok: true }
  },

  publishDraftCatalogue: (catalogueId, mode) => {
    const s = get()
    const result = planPublishDraftCatalogue(catalogueId, mode, {
      role: s.role,
      catalogue: s.catalogues.find((c) => c.id === catalogueId),
      catalogueLots: s.lots.filter((l) => l.catalogueId === catalogueId),
      ceoPublishValueFrom: s.financeConfig.ceoPublishValueFrom,
      ceoApprovals: s.ceoApprovals,
      now: s.now,
    })
    if (!result.ok) return result
    const { plan } = result

    set((st) => ({
      catalogues: st.catalogues.map((c) =>
        c.id === catalogueId
          ? { ...c, status: plan.catalogueStatus, startsAt: plan.startsAt, endsAt: plan.endsAt, emdOpensAt: plan.emdOpensAt, emdDeadline: plan.emdDeadline }
          : c,
      ),
      lots: st.lots.map((l) => (l.catalogueId === catalogueId ? { ...l, status: plan.lotStatus, endsAt: plan.endsAt } : l)),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, 'info')
    get().notify(plan.broadcastNotification)
    // Publishing hands the sale to the auction floor and tells the seller
    // their material is on the market — neither used to be said.
    helpers.notifyRole(['auction_manager', 'sub_admin'], plan.roleNotification, s.currentUser?.id)
    if (plan.sellerNotification) get().notify(plan.sellerNotification)
    return { ok: true }
  },

  pauseCatalogue: (catalogueId, reason) => {
    if (!AUCTION_FLOOR_ROLES.includes(get().role)) return
    set((st) => ({ paused: { ...st.paused, [catalogueId]: true } }))
    const cat = get().catalogues.find((c) => c.id === catalogueId)
    get().audit('auction.pause', cat?.code ?? catalogueId, `Auction paused${reason ? ` — ${reason}` : ''}`, 'warning')
    helpers.notifyParticipants(catalogueId, {
      kind: 'lifecycle', title: `${cat?.code ?? 'Auction'} paused`,
      body: reason || 'Bidding is on hold and every countdown is frozen. You will be told when it resumes.',
    })
  },
  resumeCatalogue: (catalogueId) => {
    if (!AUCTION_FLOOR_ROLES.includes(get().role)) return
    set((st) => ({ paused: { ...st.paused, [catalogueId]: false } }))
    const cat = get().catalogues.find((c) => c.id === catalogueId)
    get().audit('auction.resume', cat?.code ?? catalogueId, 'Auction resumed — countdowns running again', 'warning')
    helpers.notifyParticipants(catalogueId, {
      kind: 'lifecycle', title: `${cat?.code ?? 'Auction'} resumed`,
      body: 'Bidding is open again. Countdowns have restarted from where they froze.',
    })
  },
  extendCatalogue: (catalogueId, minutes, reason) => {
    if (!AUCTION_FLOOR_ROLES.includes(get().role)) return
    const ms = minutes * 60_000
    set((st) => ({
      catalogues: st.catalogues.map((c) => (c.id === catalogueId ? { ...c, endsAt: new Date(Date.parse(c.endsAt) + ms).toISOString() } : c)),
      lots: st.lots.map((l) => (l.catalogueId === catalogueId && l.status === 'live' ? { ...l, endsAt: new Date(Date.parse(l.endsAt) + ms).toISOString() } : l)),
    }))
    const cat = get().catalogues.find((c) => c.id === catalogueId)
    get().audit('auction.extend', cat?.code ?? catalogueId, `Extended by ${minutes} minutes${reason ? ` — ${reason}` : ''}`, 'warning')
    helpers.notifyParticipants(catalogueId, {
      kind: 'lifecycle', title: `${cat?.code ?? 'Auction'} extended by ${minutes} min`,
      body: reason || 'Every live lot in this auction now closes later. Your existing bids stand.',
    })
  },
  cancelCatalogue: (catalogueId) => {
    // Executing a cancellation is Super Admin only — the Auction Manager and
    // Sub Admin raise it as a request (see requestCancellation).
    if (get().role !== 'super_admin') return
    set((st) => ({
      catalogues: st.catalogues.map((c) => (c.id === catalogueId ? { ...c, status: 'closed' as const } : c)),
      lots: st.lots.map((l) => (l.catalogueId === catalogueId && ['live', 'approved'].includes(l.status) ? { ...l, status: 'unsold' as LotStatus } : l)),
    }))
    const cat = get().catalogues.find((c) => c.id === catalogueId)
    get().audit('auction.cancel', cat?.code ?? catalogueId, 'Auction cancelled — all open lots voided, EMD released', 'critical')
    helpers.notifyParticipants(catalogueId, {
      kind: 'lifecycle', title: `${cat?.code ?? 'Auction'} cancelled`,
      body: 'Every open lot is now unsold and the EMD you had locked on this auction has been released.',
    })
  },
  voidBid: (bidId) => {
    if (get().role !== 'super_admin') return
    const s = get()
    const bid = s.bids.find((b) => b.id === bidId)
    if (!bid) return
    const remaining = s.bids.filter((b) => b.lotId === bid.lotId && b.status === 'valid' && b.id !== bidId)
    const top = remaining.sort((a, b) => b.rate - a.rate)[0] ?? null
    const lot = s.lots.find((l) => l.id === bid.lotId)
    set((st) => ({
      bids: st.bids.map((b) => (b.id === bidId ? { ...b, status: 'void' as const } : b)),
      lots: st.lots.map((l) =>
        l.id === bid.lotId
          ? { ...l, currentRate: top?.rate ?? null, leadingBidderId: top?.bidderId ?? null, bidCount: remaining.length }
          : l,
      ),
    }))
    get().audit('bid.void', lot?.lotNo ?? bidId, `Bid of ${inr(bid.rate)} on ${lot?.lotNo ?? bid.lotId} voided — ladder recomputed`, 'critical')
    /* Voiding a bid changes two people's position in a live sale and neither
       used to be told: the bidder whose offer was struck out, and whoever the
       recomputed ladder has just put in front. */
    get().notify({
      userId: bid.bidderId, kind: 'bid', title: `Your bid on ${lot?.lotNo ?? 'a lot'} was voided`,
      body: `${inr(bid.rate)}/${lot?.uom ?? 'MT'} has been struck from the ladder after review. You can bid again if the lot is still open.`,
      href: lot?.catalogueId ? `/bidding/${lot.catalogueId}?lot=${bid.lotId}` : '/buyer/bids',
    })
    if (top && top.bidderId !== bid.bidderId) {
      get().notify({
        userId: top.bidderId, kind: 'bid', title: `You are leading ${lot?.lotNo ?? 'a lot'}`,
        body: `A bid above yours was voided after review. Your ${inr(top.rate)}/${lot?.uom ?? 'MT'} is now H1.`,
        href: lot?.catalogueId ? `/bidding/${lot.catalogueId}?lot=${bid.lotId}` : '/buyer/bids',
      })
    }
  },
})
