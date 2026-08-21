/* ---------------------------------------------------------------------------
   Field executive workspace.

   The narrowest role on the platform: a field executive sees the catalogues
   assigned to them and the lots inside those catalogues, and nothing else.

   Two sets have to be unioned, and missing either one breaks a screen:

   1. Catalogues where assigned_field_exec_id is this user — the work queue.
   2. Lots they have already filed a report against. Assignment moves on: a
      catalogue reassigned or closed after they inspected it drops out of set 1,
      but their own report history still points at those lots, and the history
      panel would render rows against nothing.

   Reports are returned for every lot in scope, not only this inspector's own,
   because the lot detail screen shows the full inspection history of a lot —
   including an earlier visit by somebody else, which is exactly the context a
   re-inspection needs.

   Reserve price is not returned. A field executive measures and photographs;
   they do not decide anything against the seller's floor.
--------------------------------------------------------------------------- */
import { query } from '../db.mjs'
import {
  CATALOGUE_COLUMNS, INSPECTION_REPORT_COLUMNS, LOT_COLUMNS, USER_COLUMNS,
  lotIdsByCatalogue, marks, photosByLot, toCatalogue, toInspectionReport, toLot, toUser,
} from './dto.mjs'

export async function getFieldData(userId) {
  const [user] = await query('SELECT id FROM users WHERE id = ?', [userId])
  if (!user) return null

  /* Set 1: assigned catalogues. Set 2: lots this inspector has reported on. */
  const assigned = await query(
    `SELECT ${CATALOGUE_COLUMNS} FROM catalogues WHERE assigned_field_exec_id = ?`, [userId])
  const ownReportLots = await query(
    'SELECT DISTINCT lot_id FROM inspection_reports WHERE inspector_id = ?', [userId])

  const assignedCatIds = assigned.map((c) => c.id)
  const historyLotIds = ownReportLots.map((r) => r.lot_id)

  const lots = (assignedCatIds.length || historyLotIds.length)
    ? await query(
        `SELECT ${LOT_COLUMNS} FROM lots
          WHERE ${[
            assignedCatIds.length ? `catalogue_id IN (${marks(assignedCatIds)})` : null,
            historyLotIds.length ? `id IN (${marks(historyLotIds)})` : null,
          ].filter(Boolean).join(' OR ')}
          ORDER BY catalogue_id, lot_no`,
        [...assignedCatIds, ...historyLotIds])
    : []

  const lotIds = lots.map((l) => l.id)

  const photos = lotIds.length ? await query(
    `SELECT id, lot_id, label, hue FROM lot_photos WHERE lot_id IN (${marks(lotIds)}) ORDER BY lot_id, position`,
    lotIds) : []

  const reports = lotIds.length ? await query(
    `SELECT ${INSPECTION_REPORT_COLUMNS} FROM inspection_reports
      WHERE lot_id IN (${marks(lotIds)}) ORDER BY inspected_at ASC`, lotIds) : []

  /* A lot from the history set may sit in a catalogue no longer assigned to
     them; the screens still resolve it by id, so pull those catalogues in. */
  const extraCatIds = [...new Set(lots.map((l) => l.catalogue_id).filter(Boolean))]
    .filter((id) => !assignedCatIds.includes(id))
  const extraCatalogues = extraCatIds.length ? await query(
    `SELECT ${CATALOGUE_COLUMNS} FROM catalogues WHERE id IN (${marks(extraCatIds)})`,
    extraCatIds) : []
  const catalogues = [...assigned, ...extraCatalogues]

  const userIds = [...new Set([
    userId,
    ...catalogues.map((c) => c.seller_id),
    ...catalogues.map((c) => c.assigned_field_exec_id).filter(Boolean),
    ...reports.map((r) => r.inspector_id).filter(Boolean),
  ])]
  const users = await query(
    `SELECT ${USER_COLUMNS} FROM users WHERE id IN (${marks(userIds)})`, userIds)

  const byLot = photosByLot(photos)
  const byCatalogue = lotIdsByCatalogue(lots)

  return {
    serverTime: new Date().toISOString(),
    fieldExecId: userId,
    catalogues: catalogues.map((c) => toCatalogue(c, byCatalogue.get(c.id))),
    lots: lots.map((l) => toLot(l, byLot.get(l.id))),
    inspectionReports: reports.map(toInspectionReport),
    users: users.map(toUser),
  }
}
