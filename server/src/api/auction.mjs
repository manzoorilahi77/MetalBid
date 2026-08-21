/* ---------------------------------------------------------------------------
   Auction Manager workspace.

   Runs the auction floor: schedules and publishes, monitors the bid stream,
   pauses and extends, closes, and confirms results. Like the Operation Manager
   this is a whole-platform role rather than an owner of records, so the scope
   is every catalogue and lot rather than a subset.

   Two things here are specific to this desk:

   * EMD eligibility. Deciding who may bid in a catalogue needs each buyer's
     shortlist and what they funded against it, plus their wallet balance — so
     this endpoint returns selection_lots and wallets for EVERY buyer, which no
     other role-scoped endpoint does. It is the one screen that legitimately
     reads across all buyers at once.

   * Bidder identity is real here, not masked. The Auction Manager voids bids,
     investigates collusion and answers for the result; they cannot do any of
     that against a pseudonym. This is the deliberate exception to the rule the
     buyer and seller endpoints follow.

   Reserve price is returned: results and STA referrals are decided against it.
--------------------------------------------------------------------------- */
import { query } from '../db.mjs'
import {
  CATALOGUE_COLUMNS, LOT_COLUMNS_WITH_RESERVE, TERMS_SET_COLUMNS, USER_COLUMNS_FULL,
  iso, lotIdsByCatalogue, num, photosByLot, toCatalogue, toLot, toTermsSet, toUser,
} from './dto.mjs'

export async function getAuctionData() {
  const [
    catalogues, lots, photos, bids, users, termsSets,
    announcements, cancellations, bidVoids, resultConfirmations, staReferrals,
    exemptions, selectionRows, wallets,
  ] = [
    await query(`SELECT ${CATALOGUE_COLUMNS} FROM catalogues ORDER BY starts_at DESC`),
    await query(`SELECT ${LOT_COLUMNS_WITH_RESERVE} FROM lots ORDER BY catalogue_id, lot_no`),
    await query('SELECT id, lot_id, label, hue FROM lot_photos ORDER BY lot_id, position'),
    await query(`SELECT id, lot_id, catalogue_id, bidder_id, rate, at, type, status
                   FROM bids ORDER BY at ASC`),
    /* Full profiles: EMD eligibility and the surveillance queue are decided
       against KYC state and standing, which the public column set withholds. */
    await query(`SELECT ${USER_COLUMNS_FULL} FROM users`),
    await query(`SELECT ${TERMS_SET_COLUMNS} FROM terms_sets`),
    await query(`SELECT id, scope, catalogue_id, title, body, at, severity
                   FROM announcements ORDER BY at DESC`),
    await query(`SELECT id, catalogue_id, reason, requested_by, requested_at, status,
                        decided_by, decided_at, decision_note FROM cancellation_requests`),
    await query(`SELECT id, bid_id, lot_id, catalogue_id, reason, notes, raised_by, raised_at,
                        stage, requested_by, requested_at, status, decided_by, decided_at,
                        decision_note FROM bid_void_requests`),
    await query(`SELECT catalogue_id, confirmed_by, confirmed_at, lots_sold, lots_unsold,
                        realisation FROM result_confirmations`),
    await query(`SELECT id, lot_id, catalogue_id, note, referred_by, referred_at FROM sta_referrals`),
    await query(`SELECT id, buyer_id, catalogue_id, reason, status, created_at, decided_at,
                        decided_by, rejection_reason FROM emd_exemption_requests`),
    await query('SELECT buyer_id, catalogue_id, lot_id, emd_funded FROM selection_lots'),
    await query('SELECT user_id, balance, emd_locked FROM wallets'),
  ]

  const byLot = photosByLot(photos)
  const byCatalogue = lotIdsByCatalogue(lots)

  /* Rebuild every buyer's BuyerLotSelection from the normalised rows — keyed on
     buyer AND catalogue, since the eligibility screen compares buyers within
     one catalogue. */
  const selections = new Map()
  for (const r of selectionRows) {
    const key = `${r.buyer_id}:${r.catalogue_id}`
    if (!selections.has(key)) {
      selections.set(key, {
        buyerId: r.buyer_id, catalogueId: r.catalogue_id, lotIds: [], emdFundedLotIds: [],
      })
    }
    const sel = selections.get(key)
    sel.lotIds.push(r.lot_id)
    if (r.emd_funded) sel.emdFundedLotIds.push(r.lot_id)
  }

  return {
    serverTime: new Date().toISOString(),
    catalogues: catalogues.map((c) => toCatalogue(c, byCatalogue.get(c.id))),
    lots: lots.map((l) => toLot(l, byLot.get(l.id))),
    users: users.map(toUser),
    termsSets: termsSets.map(toTermsSet),
    bids: bids.map((b) => ({
      id: b.id, lotId: b.lot_id, catalogueId: b.catalogue_id, bidderId: b.bidder_id,
      rate: num(b.rate), at: iso(b.at), type: b.type, status: b.status,
    })),
    selections: [...selections.values()],
    wallets: wallets.map((w) => ({
      userId: w.user_id, balance: num(w.balance), emdLocked: num(w.emd_locked), ledger: [],
    })),
    announcements: announcements.map((a) => ({
      id: a.id, scope: a.scope, catalogueId: a.catalogue_id ?? undefined, title: a.title,
      body: a.body, at: iso(a.at), severity: a.severity,
    })),
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
  }
}
