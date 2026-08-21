/* ---------------------------------------------------------------------------
   The bootstrap payload: public catalogue data plus the user directory.

   The frontend store starts empty and this endpoint, fetched once at app
   start, is what fills the public surface: the homepage rails and Browse (live
   and upcoming catalogues with their lots), the Noticeboard (announcements),
   and the user directory that sign-in and the demo role switcher resolve
   against. The per-role endpoints then layer each workspace's own records on
   top.

   This is a public, unauthenticated endpoint -- so LOT_COLUMNS, never
   LOT_COLUMNS_WITH_RESERVE, and USER_COLUMNS, never USER_COLUMNS_FULL: the
   directory carries display identity (name, firm, role, city, avatar, bidder
   handle), not contact details or KYC state. See dto.mjs.
--------------------------------------------------------------------------- */
import { query } from '../db.mjs'
import {
  CATALOGUE_COLUMNS, LOT_COLUMNS, USER_COLUMNS,
  iso, lotIdsByCatalogue, marks, photosByLot, toCatalogue, toLot, toUser,
} from './dto.mjs'

/** Catalogues a visitor may see. 'draft' and 'closed' never appear: nothing is
 *  public until it is published, and closed sales belong in History. */
const PUBLIC_STATUSES = ['live', 'upcoming']

export async function getHomeData() {
  /* The whole directory, not just the visible catalogues' sellers: with the
     store starting empty, this is what the login screen and the demo role
     switcher have to resolve identities against. Public columns only. */
  const users = await query(`SELECT ${USER_COLUMNS} FROM users`)

  const announcements = await query(
    'SELECT id, scope, catalogue_id, title, body, at, severity FROM announcements ORDER BY at DESC')

  /* Approved only, and never the moderation trail — a rejected or still-pending
     quote is not the submitter's to have shown, and moderator identity is an
     internal record, not part of what a visitor reads. */
  const testimonials = await query(
    `SELECT id, user_id, role, quote, rating, submitted_at
       FROM testimonials WHERE status = 'approved' ORDER BY submitted_at DESC`)

  const catalogues = await query(
    `SELECT ${CATALOGUE_COLUMNS} FROM catalogues WHERE status IN (?, ?) ORDER BY ends_at ASC`,
    PUBLIC_STATUSES,
  )

  const catIds = catalogues.map((c) => c.id)

  const lots = catIds.length ? await query(
    `SELECT ${LOT_COLUMNS} FROM lots WHERE catalogue_id IN (${marks(catIds)}) ORDER BY catalogue_id, lot_no`,
    catIds) : []

  const photos = catIds.length ? await query(
    `SELECT p.id, p.lot_id, p.label, p.hue
       FROM lot_photos p JOIN lots l ON l.id = p.lot_id
      WHERE l.catalogue_id IN (${marks(catIds)})
      ORDER BY p.lot_id, p.position`, catIds) : []

  const byLot = photosByLot(photos)
  const byCatalogue = lotIdsByCatalogue(lots)

  return {
    serverTime: new Date().toISOString(),
    catalogues: catalogues.map((c) => toCatalogue(c, byCatalogue.get(c.id))),
    lots: lots.map((l) => toLot(l, byLot.get(l.id))),
    users: users.map(toUser),
    announcements: announcements.map((a) => ({
      id: a.id, scope: a.scope, catalogueId: a.catalogue_id ?? undefined, title: a.title,
      body: a.body, at: iso(a.at), severity: a.severity,
    })),
    testimonials: testimonials.map((t) => ({
      id: t.id, userId: t.user_id, role: t.role, quote: t.quote,
      rating: t.rating ?? undefined, status: 'approved', submittedAt: iso(t.submitted_at),
    })),
  }
}
