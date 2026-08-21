/* ---------------------------------------------------------------------------
   Seller workspace data.

   Returns one seller's own slice: their lots wherever those lots sit in the
   pipeline, the catalogues holding them, the bids placed against them, the
   field inspection reports, and their commission settlements.

   Disclosure differs from the buyer endpoint in both directions:

   * `reserve_rate` IS returned here. It is the seller's own floor price — the
     buyer endpoint hides it from buyers, not from the person who set it.

   * Bidder identity is not. The seller screens already mask a bidder to their
     public bidder code (`BUS7Y`), never a name or firm, so this returns only
     {id, bidderId} for the bidders on their lots. The seller can tell two
     bidders apart and follow one across lots, which is what the ladder needs,
     and learns nothing else about either.

   A lot exists before any catalogue holds it, and `lots.seller_id` is set at
   submission for exactly that reason — so this is keyed on the lot's own
   seller_id rather than the catalogue's, and an uncatalogued draft lot still
   reaches its owner's screen.
--------------------------------------------------------------------------- */
import { query } from '../db.mjs'
import {
  CATALOGUE_COLUMNS, INSPECTION_REPORT_COLUMNS, LOT_COLUMNS_WITH_RESERVE,
  USER_COLUMNS, USER_COLUMNS_FULL,
  iso, lotIdsByCatalogue, marks, num, photosByLot, toCatalogue, toInspectionReport, toLot, toUser,
} from './dto.mjs'

export async function getSellerData(sellerId) {
  /* The seller's own row is the one full profile this endpoint discloses — the
     Profile and verification screens are theirs. Everyone else stays public. */
  const [seller] = await query(`SELECT ${USER_COLUMNS_FULL} FROM users WHERE id = ?`, [sellerId])
  if (!seller) return null

  const lots = await query(
    `SELECT ${LOT_COLUMNS_WITH_RESERVE} FROM lots WHERE seller_id = ? ORDER BY catalogue_id, lot_no`, [sellerId])

  const lotIds = lots.map((l) => l.id)

  const photos = lotIds.length ? await query(
    `SELECT id, lot_id, label, hue FROM lot_photos WHERE lot_id IN (${marks(lotIds)}) ORDER BY lot_id, position`,
    lotIds) : []

  const bids = lotIds.length ? await query(
    `SELECT id, lot_id, catalogue_id, bidder_id, rate, at, type, status
       FROM bids WHERE lot_id IN (${marks(lotIds)}) ORDER BY at ASC`, lotIds) : []

  const reports = lotIds.length ? await query(
    `SELECT ${INSPECTION_REPORT_COLUMNS}
       FROM inspection_reports WHERE lot_id IN (${marks(lotIds)})`, lotIds) : []

  /* Catalogues holding this seller's lots, plus any catalogue listed against
     them directly — the two overlap but neither is a superset of the other. */
  const catIds = [...new Set(lots.map((l) => l.catalogue_id).filter(Boolean))]
  const catalogues = await query(
    `SELECT ${CATALOGUE_COLUMNS}
       FROM catalogues
      WHERE seller_id = ?${catIds.length ? ` OR id IN (${marks(catIds)})` : ''}`,
    [sellerId, ...catIds])

  const settlements = await query(
    `SELECT id, catalogue_id, seller_id, amount, mode, settled_at, reference, status,
            confirmed_by, confirmed_at, query_note
       FROM commission_settlements WHERE seller_id = ? ORDER BY settled_at DESC`, [sellerId])

  const companyAccounts = await query(
    'SELECT id, bank, account_number_masked, ifsc, purpose FROM company_bank_accounts')

  const [financeRow] = await query(
    "SELECT value FROM app_settings WHERE setting_key = 'financeConfig'")

  /* Bidders on this seller's lots, reduced to id + public bidder code. Plus the
     seller's own record and the inspectors who filed the reports, which the
     screens show by name. */
  const bidderIds = [...new Set(bids.map((b) => b.bidder_id))]
  const bidders = bidderIds.length ? await query(
    `SELECT id, bidder_id FROM users WHERE id IN (${marks(bidderIds)})`, bidderIds) : []

  const namedIds = [...new Set(reports.map((r) => r.inspector_id).filter(Boolean))]
    .filter((id) => id !== sellerId)
  const named = namedIds.length ? await query(
    `SELECT ${USER_COLUMNS} FROM users WHERE id IN (${marks(namedIds)})`,
    namedIds) : []

  const byLot = photosByLot(photos)
  const byCatalogue = lotIdsByCatalogue(lots)

  /* Named records win over the bare {id, bidderId} rows where both exist — the
     seller and the inspectors are shown by name, bidders never are. */
  const namedById = new Map([...named.map((u) => [u.id, u]), [seller.id, seller]])
  const users = [
    ...bidders.filter((b) => !namedById.has(b.id)).map((b) => ({ id: b.id, bidderId: b.bidder_id })),
    ...named.map(toUser),
    toUser(seller),
  ]

  return {
    serverTime: new Date().toISOString(),
    sellerId,
    lots: lots.map((l) => toLot(l, byLot.get(l.id))),
    catalogues: catalogues.map((c) => toCatalogue(c, byCatalogue.get(c.id))),
    bids: bids.map((b) => ({
      id: b.id, lotId: b.lot_id, catalogueId: b.catalogue_id, bidderId: b.bidder_id,
      rate: num(b.rate), at: iso(b.at), type: b.type, status: b.status,
    })),
    inspectionReports: reports.map(toInspectionReport),
    commissionSettlements: settlements.map((s) => ({
      id: s.id, catalogueId: s.catalogue_id, sellerId: s.seller_id, amount: num(s.amount),
      mode: s.mode, at: iso(s.settled_at), reference: s.reference ?? undefined,
      status: s.status ?? undefined, confirmedBy: s.confirmed_by ?? undefined,
      confirmedAt: iso(s.confirmed_at) ?? undefined, queryNote: s.query_note ?? undefined,
    })),
    companyBankAccounts: companyAccounts.map((a) => ({
      id: a.id, bank: a.bank, accountNumberMasked: a.account_number_masked,
      ifsc: a.ifsc, purpose: a.purpose,
    })),
    financeConfig: financeRow ? financeRow.value : null,
    users,
  }
}
