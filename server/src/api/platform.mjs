/* ---------------------------------------------------------------------------
   Shared loaders for the whole-platform roles.

   Sub Admin, Super Admin and the CEO all read across the entire platform rather
   than owning a slice of it, and their payloads overlap heavily — Super Admin is
   very nearly Sub Admin plus the platform's own structure. Composing them from
   named loaders keeps that relationship visible in the code instead of as three
   near-identical SELECT lists that drift apart.

   On reserve price: none of these three roles gets it. Their own screens never
   read `lot.reserveRate`, and the screens that do — exec/Settlement,
   auction/Results — sit under the Exec and Auction layouts, which run their own
   fetch on mount and supply it. So a Sub Admin who navigates into lot settlement
   still sees the reserve, and this endpoint still does not carry it. Mounting
   the fetches on layouts is what makes least privilege free here.
--------------------------------------------------------------------------- */
import { query } from '../db.mjs'
import {
  CATALOGUE_COLUMNS, DELIVERY_ORDER_COLUMNS, INSPECTION_REPORT_COLUMNS, LOT_COLUMNS,
  TERMS_SET_COLUMNS, USER_COLUMNS_FULL,
  iso, lotIdsByCatalogue, num, photosByLot, toCatalogue, toDeliveryOrder,
  toInspectionReport, toLot, toTermsSet, toUser,
} from './dto.mjs'

/** Catalogues and lots together, because Catalogue.lotIds is derived from lots. */
export async function loadCataloguesAndLots() {
  const [catalogues, lots, photos] = [
    await query(`SELECT ${CATALOGUE_COLUMNS} FROM catalogues ORDER BY starts_at DESC`),
    await query(`SELECT ${LOT_COLUMNS} FROM lots ORDER BY catalogue_id, lot_no`),
    await query('SELECT id, lot_id, label, hue FROM lot_photos ORDER BY lot_id, position'),
  ]
  const byLot = photosByLot(photos)
  const byCatalogue = lotIdsByCatalogue(lots)
  return {
    catalogues: catalogues.map((c) => toCatalogue(c, byCatalogue.get(c.id))),
    lots: lots.map((l) => toLot(l, byLot.get(l.id))),
  }
}

/** Full profiles, deliberately: every caller of this loader is a staff desk
 *  (Sub Admin, Super Admin, CEO) whose screens manage accounts — KYC state,
 *  standing, contact details. The public directory lives on /api/home. */
export async function loadUsers() {
  return (await query(`SELECT ${USER_COLUMNS_FULL} FROM users`)).map(toUser)
}

export async function loadBids() {
  const rows = await query(
    'SELECT id, lot_id, catalogue_id, bidder_id, rate, at, type, status FROM bids ORDER BY at ASC')
  return rows.map((b) => ({
    id: b.id, lotId: b.lot_id, catalogueId: b.catalogue_id, bidderId: b.bidder_id,
    rate: num(b.rate), at: iso(b.at), type: b.type, status: b.status,
  }))
}

export async function loadDeliveryOrders() {
  return (await query(`SELECT ${DELIVERY_ORDER_COLUMNS} FROM delivery_orders ORDER BY created_at DESC`))
    .map(toDeliveryOrder)
}

export async function loadInspectionReports() {
  return (await query(`SELECT ${INSPECTION_REPORT_COLUMNS} FROM inspection_reports ORDER BY inspected_at ASC`))
    .map(toInspectionReport)
}

export async function loadTermsSets() {
  return (await query(`SELECT ${TERMS_SET_COLUMNS} FROM terms_sets`)).map(toTermsSet)
}

/** Wallets with their ledger nested, the way Wallet.ledger is read everywhere. */
export async function loadWallets() {
  const [wallets, ledger] = [
    await query('SELECT user_id, balance, emd_locked FROM wallets'),
    await query(`SELECT id, user_id, at, type, amount, ref, lot_id, catalogue_id, note
                   FROM wallet_ledger ORDER BY at DESC`),
  ]
  const byUser = new Map()
  for (const e of ledger) {
    if (!byUser.has(e.user_id)) byUser.set(e.user_id, [])
    byUser.get(e.user_id).push({
      id: e.id, at: iso(e.at), type: e.type, amount: num(e.amount), ref: e.ref,
      lotId: e.lot_id ?? undefined, catalogueId: e.catalogue_id ?? undefined, note: e.note,
    })
  }
  return wallets.map((w) => ({
    userId: w.user_id, balance: num(w.balance), emdLocked: num(w.emd_locked),
    ledger: byUser.get(w.user_id) ?? [],
  }))
}

/** Every buyer's shortlist, rebuilt from the normalised rows. */
export async function loadSelections() {
  const rows = await query('SELECT buyer_id, catalogue_id, lot_id, emd_funded FROM selection_lots')
  const byKey = new Map()
  for (const r of rows) {
    const key = `${r.buyer_id}:${r.catalogue_id}`
    if (!byKey.has(key)) {
      byKey.set(key, { buyerId: r.buyer_id, catalogueId: r.catalogue_id, lotIds: [], emdFundedLotIds: [] })
    }
    const sel = byKey.get(key)
    sel.lotIds.push(r.lot_id)
    if (r.emd_funded) sel.emdFundedLotIds.push(r.lot_id)
  }
  return [...byKey.values()]
}

export async function loadDisputes() {
  return (await query(`SELECT id, user_id, subject, category, lot_id, status, created_at, messages,
                              assigned_to_id, outcome, resolution, resolved_at, resolved_by_id, refund_id
                         FROM disputes ORDER BY created_at DESC`)).map((d) => ({
    id: d.id, userId: d.user_id, subject: d.subject, category: d.category,
    lotId: d.lot_id ?? undefined, status: d.status, createdAt: iso(d.created_at),
    messages: d.messages ?? [], assignedToId: d.assigned_to_id ?? undefined,
    outcome: d.outcome ?? undefined, resolution: d.resolution ?? undefined,
    resolvedAt: iso(d.resolved_at) ?? undefined, resolvedById: d.resolved_by_id ?? undefined,
    refundId: d.refund_id ?? undefined,
  }))
}

export async function loadTestimonials() {
  return (await query(`SELECT id, user_id, role, quote, rating, status, submitted_at,
                              moderated_by, moderated_at, moderation_note
                         FROM testimonials ORDER BY submitted_at DESC`)).map((t) => ({
    id: t.id, userId: t.user_id, role: t.role, quote: t.quote, rating: t.rating ?? undefined,
    status: t.status, submittedAt: iso(t.submitted_at),
    moderatedBy: t.moderated_by ?? undefined, moderatedAt: iso(t.moderated_at) ?? undefined,
    moderationNote: t.moderation_note ?? undefined,
  }))
}

export async function loadAuditEvents() {
  return (await query(`SELECT id, at, actor_id, action, target, detail, severity
                         FROM audit_events ORDER BY at DESC`)).map((a) => ({
    id: a.id, at: iso(a.at), actorId: a.actor_id, action: a.action,
    target: a.target, detail: a.detail, severity: a.severity,
  }))
}

/** The money records the supervisory and commercial roles read but do not move. */
export async function loadFinanceRecords() {
  const [deposits, withdrawals, refunds, forfeitures, settlements, statementLines, ceoApprovals] = [
    await query(`SELECT id, user_id, amount, utr, transfer_date, proof_filename, status,
                        rejection_reason, created_at, decided_at, decided_by
                   FROM deposit_claims ORDER BY created_at DESC`),
    await query(`SELECT id, user_id, amount, bank_account_id, ref, status, reason, requested_at,
                        decided_at, reviewed_by, reviewed_at, processed_by
                   FROM withdrawal_requests ORDER BY requested_at DESC`),
    await query(`SELECT id, user_id, amount, source, reason, lot_id, catalogue_id, dispute_id,
                        status, raised_by, raised_at, decided_by, decided_at, decision_note,
                        processed_by, processed_at FROM refund_requests ORDER BY raised_at DESC`),
    await query(`SELECT id, buyer_id, lot_id, catalogue_id, amount, reason, status, raised_by,
                        raised_at, decided_by, decided_at, decision_note FROM emd_forfeitures`),
    await query(`SELECT id, catalogue_id, seller_id, amount, mode, settled_at, reference, status,
                        confirmed_by, confirmed_at, query_note FROM commission_settlements`),
    await query(`SELECT id, at, account_id, direction, amount, ref, narration, status, matched_to,
                        matched_kind, matched_by, matched_at, break_note, escalated
                   FROM bank_statement_lines ORDER BY at DESC`),
    await query(`SELECT id, kind, ref_id, amount, summary, reason, requested_by, requested_at,
                        status, info_note, info_asked_at, payload, decided_by, decided_at,
                        decision_note FROM ceo_approvals ORDER BY requested_at DESC`),
  ]
  return {
    depositClaims: deposits.map((c) => ({
      id: c.id, userId: c.user_id, amount: num(c.amount), utr: c.utr,
      transferDate: iso(c.transfer_date), proofFilename: c.proof_filename ?? undefined,
      status: c.status, rejectionReason: c.rejection_reason ?? undefined,
      createdAt: iso(c.created_at), decidedAt: iso(c.decided_at) ?? undefined,
      decidedBy: c.decided_by ?? undefined,
    })),
    withdrawalRequests: withdrawals.map((w) => ({
      id: w.id, userId: w.user_id, amount: num(w.amount), bankAccountId: w.bank_account_id,
      ref: w.ref, status: w.status, reason: w.reason ?? undefined,
      requestedAt: iso(w.requested_at), decidedAt: iso(w.decided_at) ?? undefined,
      reviewedBy: w.reviewed_by ?? undefined, reviewedAt: iso(w.reviewed_at) ?? undefined,
      processedBy: w.processed_by ?? undefined,
    })),
    refundRequests: refunds.map((r) => ({
      id: r.id, userId: r.user_id, amount: num(r.amount), source: r.source, reason: r.reason,
      lotId: r.lot_id ?? undefined, catalogueId: r.catalogue_id ?? undefined,
      disputeId: r.dispute_id ?? undefined, status: r.status, raisedBy: r.raised_by,
      raisedAt: iso(r.raised_at), decidedBy: r.decided_by ?? undefined,
      decidedAt: iso(r.decided_at) ?? undefined, decisionNote: r.decision_note ?? undefined,
      processedBy: r.processed_by ?? undefined, processedAt: iso(r.processed_at) ?? undefined,
    })),
    emdForfeitures: forfeitures.map((f) => ({
      id: f.id, buyerId: f.buyer_id, lotId: f.lot_id, catalogueId: f.catalogue_id,
      amount: num(f.amount), reason: f.reason, status: f.status, raisedBy: f.raised_by,
      raisedAt: iso(f.raised_at), decidedBy: f.decided_by ?? undefined,
      decidedAt: iso(f.decided_at) ?? undefined, decisionNote: f.decision_note ?? undefined,
    })),
    commissionSettlements: settlements.map((s) => ({
      id: s.id, catalogueId: s.catalogue_id, sellerId: s.seller_id, amount: num(s.amount),
      mode: s.mode, at: iso(s.settled_at), reference: s.reference ?? undefined,
      status: s.status ?? undefined, confirmedBy: s.confirmed_by ?? undefined,
      confirmedAt: iso(s.confirmed_at) ?? undefined, queryNote: s.query_note ?? undefined,
    })),
    bankStatementLines: statementLines.map((b) => ({
      id: b.id, at: iso(b.at), accountId: b.account_id, direction: b.direction,
      amount: num(b.amount), ref: b.ref, narration: b.narration, status: b.status,
      matchedTo: b.matched_to ?? undefined, matchedKind: b.matched_kind ?? undefined,
      matchedBy: b.matched_by ?? undefined, matchedAt: iso(b.matched_at) ?? undefined,
      breakNote: b.break_note ?? undefined, escalated: !!b.escalated,
    })),
    ceoApprovals: ceoApprovals.map((c) => ({
      id: c.id, kind: c.kind, refId: c.ref_id, amount: num(c.amount), summary: c.summary,
      reason: c.reason, requestedBy: c.requested_by, requestedAt: iso(c.requested_at),
      status: c.status, infoNote: c.info_note ?? undefined,
      infoAskedAt: iso(c.info_asked_at) ?? undefined, payload: c.payload ?? undefined,
      decidedBy: c.decided_by ?? undefined, decidedAt: iso(c.decided_at) ?? undefined,
      decisionNote: c.decision_note ?? undefined,
    })),
  }
}

/** The escalations that need a second signature. */
export async function loadEscalations() {
  const [cancellations, bidVoids, resultConfirmations, staReferrals, exemptions, announcements] = [
    await query(`SELECT id, catalogue_id, reason, requested_by, requested_at, status,
                        decided_by, decided_at, decision_note FROM cancellation_requests`),
    await query(`SELECT id, bid_id, lot_id, catalogue_id, reason, notes, raised_by, raised_at,
                        stage, requested_by, requested_at, status, decided_by, decided_at,
                        decision_note FROM bid_void_requests`),
    await query(`SELECT catalogue_id, confirmed_by, confirmed_at, lots_sold, lots_unsold,
                        realisation FROM result_confirmations`),
    await query('SELECT id, lot_id, catalogue_id, note, referred_by, referred_at FROM sta_referrals'),
    await query(`SELECT id, buyer_id, catalogue_id, reason, status, created_at, decided_at,
                        decided_by, rejection_reason FROM emd_exemption_requests`),
    await query('SELECT id, scope, catalogue_id, title, body, at, severity FROM announcements ORDER BY at DESC'),
  ]
  return {
    cancellationRequests: cancellations.map((c) => ({
      id: c.id, catalogueId: c.catalogue_id, reason: c.reason, requestedBy: c.requested_by,
      requestedAt: iso(c.requested_at), status: c.status, decidedBy: c.decided_by ?? undefined,
      decidedAt: iso(c.decided_at) ?? undefined, decisionNote: c.decision_note ?? undefined,
    })),
    bidVoidRequests: bidVoids.map((b) => ({
      id: b.id, bidId: b.bid_id, lotId: b.lot_id, catalogueId: b.catalogue_id,
      reason: b.reason, notes: b.notes ?? undefined, raisedBy: b.raised_by,
      raisedAt: iso(b.raised_at), stage: b.stage, requestedBy: b.requested_by ?? undefined,
      requestedAt: iso(b.requested_at) ?? undefined, status: b.status,
      decidedBy: b.decided_by ?? undefined, decidedAt: iso(b.decided_at) ?? undefined,
      decisionNote: b.decision_note ?? undefined,
    })),
    resultConfirmations: resultConfirmations.map((r) => ({
      catalogueId: r.catalogue_id, confirmedBy: r.confirmed_by, confirmedAt: iso(r.confirmed_at),
      lotsSold: r.lots_sold, lotsUnsold: r.lots_unsold, realisation: num(r.realisation),
    })),
    staReferrals: staReferrals.map((s) => ({
      id: s.id, lotId: s.lot_id, catalogueId: s.catalogue_id, note: s.note,
      referredBy: s.referred_by, referredAt: iso(s.referred_at),
    })),
    emdExemptionRequests: exemptions.map((e) => ({
      id: e.id, buyerId: e.buyer_id, catalogueId: e.catalogue_id, reason: e.reason,
      status: e.status, createdAt: iso(e.created_at), decidedAt: iso(e.decided_at) ?? undefined,
      decidedBy: e.decided_by ?? undefined, rejectionReason: e.rejection_reason ?? undefined,
    })),
    announcements: announcements.map((a) => ({
      id: a.id, scope: a.scope, catalogueId: a.catalogue_id ?? undefined, title: a.title,
      body: a.body, at: iso(a.at), severity: a.severity,
    })),
  }
}

/** The supervisory records the Sub Admin desk owns. */
export async function loadSupervision() {
  const [reviews, notes, drafts] = [
    await query('SELECT id, event_id, verdict, note, at, by_id, escalated_to FROM action_reviews'),
    await query('SELECT id, by_id, at, body FROM handover_notes ORDER BY at DESC'),
    await query(`SELECT id, page, section, author_id, submitted_at, before_text, after_text,
                        status, needs_ceo, note, decided_at, decided_by
                   FROM content_drafts ORDER BY submitted_at DESC`),
  ]
  return {
    actionReviews: reviews.map((r) => ({
      id: r.id, eventId: r.event_id, verdict: r.verdict, note: r.note,
      at: iso(r.at), byId: r.by_id, escalatedTo: r.escalated_to ?? undefined,
    })),
    handoverNotes: notes.map((n) => ({ id: n.id, byId: n.by_id, at: iso(n.at), body: n.body })),
    contentDrafts: drafts.map((d) => ({
      id: d.id, page: d.page, section: d.section, authorId: d.author_id,
      submittedAt: iso(d.submitted_at), before: d.before_text, after: d.after_text,
      status: d.status, needsCeo: !!d.needs_ceo, note: d.note ?? undefined,
      decidedAt: iso(d.decided_at) ?? undefined, decidedBy: d.decided_by ?? undefined,
    })),
  }
}

export async function loadSettings() {
  const rows = await query('SELECT setting_key, value FROM app_settings')
  const of = (key) => rows.find((r) => r.setting_key === key)?.value ?? null
  return {
    financeConfig: of('financeConfig'),
    withdrawalWindow: of('withdrawalWindow'),
    ceoDelegation: of('ceoDelegation'),
  }
}
