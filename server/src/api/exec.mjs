/* ---------------------------------------------------------------------------
   Operation Manager workspace.

   The widest read scope so far. This role owns the whole lot pipeline — draft
   through inspection, approval, catalogue building, publish, logistics and
   handover — so unlike buyer and seller there is no "their own" subset to scope
   to. It legitimately reads everything.

   It cannot be scoped to work in flight either. Settlement operates on lots in
   CLOSED catalogues (STA referrals, unsold lots going back to the seller) and
   Handover closes deliveries long after the auction ended, so filtering to
   non-closed catalogues would empty two screens.

   Reserve price IS returned: lot approval compares the reserve against what the
   field executive measured, and settlement decides STA referrals against it.
   This role sets and overrides reserves in the catalogue builder.

   The payload is therefore large — the full catalogue and lot set. That is
   honest for a role that renders a whole-pipeline board, but it is the first
   endpoint here that will need pagination rather than a single fetch once this
   runs against real volumes. Flagged rather than pre-optimised: the prototype
   ships the same data to the browser as a JSON bundle today.
--------------------------------------------------------------------------- */
import { query } from '../db.mjs'
import {
  CATALOGUE_COLUMNS, DELIVERY_ORDER_COLUMNS, INSPECTION_REPORT_COLUMNS,
  LOT_COLUMNS_WITH_RESERVE, TERMS_SET_COLUMNS, USER_COLUMNS_FULL,
  lotIdsByCatalogue, photosByLot, toCatalogue, toDeliveryOrder, toInspectionReport,
  toLot, toTermsSet, toUser,
} from './dto.mjs'

export async function getExecData() {
  const [catalogues, lots, photos, reports, orders, termsSets, users] = [
    await query(`SELECT ${CATALOGUE_COLUMNS} FROM catalogues ORDER BY starts_at DESC`),
    await query(`SELECT ${LOT_COLUMNS_WITH_RESERVE} FROM lots ORDER BY catalogue_id, lot_no`),
    await query('SELECT id, lot_id, label, hue FROM lot_photos ORDER BY lot_id, position'),
    await query(`SELECT ${INSPECTION_REPORT_COLUMNS} FROM inspection_reports ORDER BY inspected_at ASC`),
    await query(`SELECT ${DELIVERY_ORDER_COLUMNS} FROM delivery_orders ORDER BY created_at DESC`),
    await query(`SELECT ${TERMS_SET_COLUMNS} FROM terms_sets`),
    /* Full profiles: the pipeline verifies sellers and chases buyers, which
       needs KYC state, standing and contact details. */
    await query(`SELECT ${USER_COLUMNS_FULL} FROM users`),
  ]

  const byLot = photosByLot(photos)
  const byCatalogue = lotIdsByCatalogue(lots)

  return {
    serverTime: new Date().toISOString(),
    catalogues: catalogues.map((c) => toCatalogue(c, byCatalogue.get(c.id))),
    lots: lots.map((l) => toLot(l, byLot.get(l.id))),
    inspectionReports: reports.map(toInspectionReport),
    deliveryOrders: orders.map(toDeliveryOrder),
    termsSets: termsSets.map(toTermsSet),
    users: users.map(toUser),
  }
}
