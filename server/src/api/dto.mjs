/* ---------------------------------------------------------------------------
   Shared row -> DTO mappers.

   Every role endpoint returns the same entities in the frontend's camelCase
   shape, and by the fifth endpoint the mapping had been copy-pasted four times.
   That is a correctness problem, not just duplication: `lots.reserve_rate` is
   the seller's floor price and must reach the seller and the operations roles
   but never a buyer, and a rule enforced by remembering to delete a line from a
   copied SELECT is a rule that will eventually be forgotten.

   So the column list and the mapper are defined together here, and the choice
   is made by picking LOT_COLUMNS vs LOT_COLUMNS_WITH_RESERVE at the call site.
   `toLot` emits `reserveRate` only when the column was actually selected, so a
   public query cannot leak it even by accident.
--------------------------------------------------------------------------- */

export const num = (v) => (v === null || v === undefined ? null : Number(v))
export const iso = (d) => (d ? new Date(d).toISOString() : null)
export const marks = (xs) => xs.map(() => '?').join(', ')

/* ------------------------------- lots ------------------------------------ */

/** Buyer-facing. Deliberately omits reserve_rate. */
export const LOT_COLUMNS = `id, lot_no, catalogue_id, seller_id, metal, category, grade,
  indicative_qty, uom, yard, description, start_rate, increment, pre_bid_emd, hazardous,
  status, current_rate, leading_bidder_id, bid_count, ends_at, extensions, result_h1_rate,
  sale_basis, known_seller, inspection_report_id, inspection_waived, waived_by,
  waived_reason, waived_at, seller_decision, overrides`

/** For the seller who set the reserve, and the operations roles who decide
 *  against it (lot approval, settlement, STA referral). */
export const LOT_COLUMNS_WITH_RESERVE = `${LOT_COLUMNS}, reserve_rate`

export function toLot(l, photos) {
  return {
    id: l.id, lotNo: l.lot_no, catalogueId: l.catalogue_id, sellerId: l.seller_id,
    metal: l.metal, category: l.category, grade: l.grade,
    indicativeQty: num(l.indicative_qty), uom: l.uom, yard: l.yard,
    description: l.description, startRate: num(l.start_rate), increment: num(l.increment),
    preBidEmd: num(l.pre_bid_emd), hazardous: !!l.hazardous, status: l.status,
    currentRate: num(l.current_rate), leadingBidderId: l.leading_bidder_id,
    bidCount: l.bid_count, endsAt: iso(l.ends_at), extensions: l.extensions,
    resultH1Rate: num(l.result_h1_rate), saleBasis: l.sale_basis,
    knownSeller: !!l.known_seller, inspectionReportId: l.inspection_report_id,
    inspectionWaived: !!l.inspection_waived, waivedBy: l.waived_by,
    waivedReason: l.waived_reason, waivedAt: iso(l.waived_at),
    sellerDecision: l.seller_decision, overrides: l.overrides ?? [],
    photos: photos ?? [],
    /* Only present when LOT_COLUMNS_WITH_RESERVE was used. */
    ...('reserve_rate' in l ? { reserveRate: num(l.reserve_rate) } : {}),
  }
}

/** lot_photos rows -> Map(lot_id -> photo[]), ordered by position. */
export function photosByLot(rows) {
  const map = new Map()
  for (const p of rows) {
    if (!map.has(p.lot_id)) map.set(p.lot_id, [])
    map.get(p.lot_id).push({ id: p.id, label: p.label, hue: p.hue })
  }
  return map
}

/* ---------------------------- catalogues --------------------------------- */

export const CATALOGUE_COLUMNS = `id, code, title, seller_id, type, status, starts_at, ends_at,
  emd_deadline, emd_opens_at, inspection_from, inspection_to, inspection_hours, yard_name,
  yard_address, region, anti_snipe_minutes, bid_validity_days, description, terms_set_id,
  assigned_field_exec_id, inspection_contact`

export function toCatalogue(c, lotIds) {
  return {
    id: c.id, code: c.code, title: c.title, sellerId: c.seller_id, type: c.type,
    status: c.status, startsAt: iso(c.starts_at), endsAt: iso(c.ends_at),
    emdDeadline: iso(c.emd_deadline), emdOpensAt: iso(c.emd_opens_at) ?? undefined,
    inspectionFrom: iso(c.inspection_from), inspectionTo: iso(c.inspection_to),
    inspectionHours: c.inspection_hours, yardName: c.yard_name, yardAddress: c.yard_address,
    region: c.region, antiSnipeMinutes: c.anti_snipe_minutes,
    bidValidityDays: c.bid_validity_days, description: c.description,
    termsSetId: c.terms_set_id, assignedFieldExecId: c.assigned_field_exec_id,
    inspectionContact: c.inspection_contact ?? null,
    lotIds: lotIds ?? [],
  }
}

/** lots rows -> Map(catalogue_id -> lot id[]), for Catalogue.lotIds. */
export function lotIdsByCatalogue(lots) {
  const map = new Map()
  for (const l of lots) {
    if (!l.catalogue_id) continue
    if (!map.has(l.catalogue_id)) map.set(l.catalogue_id, [])
    map.get(l.catalogue_id).push(l.id)
  }
  return map
}

/* ------------------------------- others ---------------------------------- */

export const USER_COLUMNS = 'id, name, firm, role, city, avatar_hue, bidder_id'

/** For the staff desks (ops, auction, finance, admin, CEO) that manage accounts
 *  — and for a user's own row on their personal endpoint. Contact details and
 *  KYC state are exactly what the public column set exists to withhold, so the
 *  choice between the two constants is a disclosure decision: make it on
 *  purpose at every call site. */
export const USER_COLUMNS_FULL =
  `${USER_COLUMNS}, phone, email, kyc_status, seller_verified, standing, gstin, joined_at`

export function toUser(u) {
  return {
    id: u.id, name: u.name, firm: u.firm, role: u.role, city: u.city,
    avatarHue: u.avatar_hue, bidderId: u.bidder_id,
    /* Only present when USER_COLUMNS_FULL was selected — same device as
       reserve_rate on toLot, so a public query cannot leak a profile. */
    ...('kyc_status' in u ? {
      phone: u.phone, email: u.email, kycStatus: u.kyc_status,
      sellerVerified: !!u.seller_verified, standing: u.standing,
      gstin: u.gstin, joinedAt: iso(u.joined_at),
    } : {}),
  }
}

export const INSPECTION_REPORT_COLUMNS = `id, lot_id, inspector_id, inspected_at, measured_qty,
  uom, lot_condition, notes, checklist, photo_count, status`

export function toInspectionReport(r) {
  return {
    id: r.id, lotId: r.lot_id, inspectorId: r.inspector_id, date: iso(r.inspected_at),
    measuredQty: num(r.measured_qty), uom: r.uom, condition: r.lot_condition,
    notes: r.notes, checklist: r.checklist ?? [], photoCount: r.photo_count, status: r.status,
  }
}

export const DELIVERY_ORDER_COLUMNS = `id, lot_id, catalogue_id, buyer_id, stage, h1_rate,
  awarded_qty, uom, material_value, gst_amount, tcs_amount, paid_amount, lifting_by,
  created_at, dd_id, lifting_checklist, weighed_qty, weighed_by_id, weighed_at,
  handover_confirmed_at, handover_confirmed_by, handover_note`

export function toDeliveryOrder(d) {
  return {
    id: d.id, lotId: d.lot_id, catalogueId: d.catalogue_id, buyerId: d.buyer_id,
    stage: d.stage, h1Rate: num(d.h1_rate), awardedQty: num(d.awarded_qty), uom: d.uom,
    materialValue: num(d.material_value), gstAmount: num(d.gst_amount),
    tcsAmount: num(d.tcs_amount), paidAmount: num(d.paid_amount),
    liftingBy: iso(d.lifting_by), createdAt: iso(d.created_at), ddId: d.dd_id ?? undefined,
    liftingChecklist: d.lifting_checklist ?? [],
    weighedQty: num(d.weighed_qty) ?? undefined, weighedById: d.weighed_by_id ?? undefined,
    weighedAt: iso(d.weighed_at) ?? undefined,
    handoverConfirmedAt: iso(d.handover_confirmed_at) ?? undefined,
    handoverConfirmedBy: d.handover_confirmed_by ?? undefined,
    handoverNote: d.handover_note ?? undefined,
  }
}

export const TERMS_SET_COLUMNS = 'id, name, version, general, special, lot_specific_note'

export function toTermsSet(t) {
  return {
    id: t.id, name: t.name, version: t.version,
    general: t.general ?? [], special: t.special ?? [],
    lotSpecificNote: t.lot_specific_note,
  }
}
