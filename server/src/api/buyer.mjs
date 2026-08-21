/* ---------------------------------------------------------------------------
   Buyer workspace data.

   Returns one buyer's own slice: wallet and ledger, shortlists, bids, auto-bids,
   EMD exemption requests and delivery orders -- plus the catalogues and lots
   those reference. That last part matters: a buyer's history reaches into closed
   catalogues that /api/home never returns, so without them the Bids, Auction
   Status and Wallet screens would render rows pointing at nothing.

   Two deliberate disclosure decisions:

   * `reserve_rate` is never selected. It is the seller's floor price.
   * Rival bidder ids are pseudonymised per lot. Computing the buyer's rank needs
     competing bids, but the UI only uses bidderId as a grouping key and to test
     "is this me" -- it never shows a rival's identity. So rivals get a stable
     per-lot token instead. Ranking is unaffected and the endpoint stops leaking
     who else is in the room, which matters while there is still no
     authentication in front of it.
--------------------------------------------------------------------------- */
import { createHash } from 'node:crypto'
import { query } from '../db.mjs'
import {
  CATALOGUE_COLUMNS, DELIVERY_ORDER_COLUMNS, LOT_COLUMNS, TERMS_SET_COLUMNS,
  USER_COLUMNS, USER_COLUMNS_FULL,
  iso, lotIdsByCatalogue, marks, num, photosByLot, toCatalogue, toDeliveryOrder, toLot,
  toTermsSet, toUser,
} from './dto.mjs'

/** Stable, per-lot pseudonym. The same rival in the same lot always maps to the
 *  same token, so "best bid per bidder" still groups correctly; the same rival in
 *  a different lot maps to a different one, so nobody is trackable across lots. */
const rivalToken = (lotId, bidderId) =>
  'rival-' + createHash('sha256').update(lotId + ':' + bidderId).digest('hex').slice(0, 10)

export async function getBuyerData(buyerId) {
  /* The buyer's own row is the one full profile this endpoint discloses — the
     Profile and KYC screens are theirs. Everyone else stays public-columns. */
  const [buyer] = await query(`SELECT ${USER_COLUMNS_FULL} FROM users WHERE id = ?`, [buyerId])
  if (!buyer) return null

  const [walletRow] = await query('SELECT user_id, balance, emd_locked FROM wallets WHERE user_id = ?', [buyerId])
  const ledger = await query(
    'SELECT id, at, type, amount, ref, lot_id, catalogue_id, note FROM wallet_ledger WHERE user_id = ? ORDER BY at DESC',
    [buyerId])
  const watchlist = await query('SELECT catalogue_id FROM watchlist WHERE buyer_id = ?', [buyerId])
  const selectionRows = await query(
    'SELECT catalogue_id, lot_id, emd_funded FROM selection_lots WHERE buyer_id = ?', [buyerId])
  const myBidLots = await query('SELECT DISTINCT lot_id FROM bids WHERE bidder_id = ?', [buyerId])
  const autoBids = await query('SELECT lot_id, max_rate, active FROM auto_bids WHERE buyer_id = ?', [buyerId])
  const exemptions = await query(
    'SELECT id, catalogue_id, reason, status, created_at, decided_at, decided_by, rejection_reason FROM emd_exemption_requests WHERE buyer_id = ?',
    [buyerId])
  const orders = await query(
    `SELECT ${DELIVERY_ORDER_COLUMNS}
       FROM delivery_orders WHERE buyer_id = ? ORDER BY created_at DESC`, [buyerId])

  /* Every bid on any lot this buyer bid on -- needed to compute their rank. */
  const bidLotIds = myBidLots.map((r) => r.lot_id)
  const bids = bidLotIds.length
    ? await query(
        `SELECT id, lot_id, catalogue_id, bidder_id, rate, at, type, status
           FROM bids WHERE lot_id IN (${marks(bidLotIds)}) ORDER BY at ASC`, bidLotIds)
    : []

  /* Catalogues and lots the above reference, so nothing renders against a gap. */
  const catIds = [...new Set([
    ...watchlist.map((r) => r.catalogue_id),
    ...selectionRows.map((r) => r.catalogue_id),
    ...exemptions.map((r) => r.catalogue_id),
    ...orders.map((r) => r.catalogue_id),
    ...bids.map((r) => r.catalogue_id),
    ...ledger.map((r) => r.catalogue_id).filter(Boolean),
  ])]
  const lotIds = [...new Set([
    ...selectionRows.map((r) => r.lot_id),
    ...orders.map((r) => r.lot_id),
    ...bidLotIds,
    ...autoBids.map((r) => r.lot_id),
    ...ledger.map((r) => r.lot_id).filter(Boolean),
  ])]

  const catalogues = catIds.length ? await query(
    `SELECT ${CATALOGUE_COLUMNS} FROM catalogues WHERE id IN (${marks(catIds)})`, catIds) : []

  const lots = lotIds.length ? await query(
    `SELECT ${LOT_COLUMNS} FROM lots WHERE id IN (${marks(lotIds)})`, lotIds) : []

  const photos = lotIds.length ? await query(
    `SELECT id, lot_id, label, hue FROM lot_photos WHERE lot_id IN (${marks(lotIds)}) ORDER BY lot_id, position`,
    lotIds) : []

  const sellerIds = [...new Set(catalogues.map((c) => c.seller_id))].filter((id) => id !== buyerId)
  const users = sellerIds.length ? await query(
    `SELECT ${USER_COLUMNS} FROM users WHERE id IN (${marks(sellerIds)})`,
    sellerIds) : []

  const termsSets = await query(`SELECT ${TERMS_SET_COLUMNS} FROM terms_sets`)

  /* The Wallet and Dashboard screens' remaining slices. Notifications include
     broadcasts (user_id NULL), which is the whole point of allowing that null. */
  const notifications = await query(
    `SELECT id, user_id, kind, title, body, at, is_read, href
       FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY at DESC`, [buyerId])
  const disputes = await query(
    `SELECT id, user_id, subject, category, lot_id, status, created_at, messages,
            assigned_to_id, outcome, resolution, resolved_at, resolved_by_id, refund_id
       FROM disputes WHERE user_id = ? ORDER BY created_at DESC`, [buyerId])
  const bankAccounts = await query(
    `SELECT id, user_id, bank_name, ifsc, account_holder_name, last4, account_number_masked,
            status, rejection_reason, created_at
       FROM bank_accounts WHERE user_id = ?`, [buyerId])
  const depositClaims = await query(
    `SELECT id, user_id, amount, utr, transfer_date, proof_filename, status, rejection_reason,
            created_at, decided_at, decided_by
       FROM deposit_claims WHERE user_id = ? ORDER BY created_at DESC`, [buyerId])
  const withdrawals = await query(
    `SELECT id, user_id, amount, bank_account_id, ref, status, reason, requested_at,
            decided_at, reviewed_by, reviewed_at, processed_by
       FROM withdrawal_requests WHERE user_id = ? ORDER BY requested_at DESC`, [buyerId])
  const inspectionSlots = await query(
    `SELECT id, catalogue_id, user_id, slot_date, window_label, persons, status, pass_code
       FROM inspection_slots WHERE user_id = ?`, [buyerId])
  const companyBankAccounts = await query(
    'SELECT id, bank, account_number_masked, ifsc, purpose FROM company_bank_accounts')
  const settings = await query(
    "SELECT setting_key, value FROM app_settings WHERE setting_key IN ('withdrawalWindow', 'financeConfig')")
  const settingOf = (key) => settings.find((s) => s.setting_key === key)?.value ?? null

  const byLot = photosByLot(photos)
  const byCatalogue = lotIdsByCatalogue(lots)

  /* Rebuild the frontend's BuyerLotSelection shape from the normalised rows. */
  const selectionsByCatalogue = new Map()
  for (const r of selectionRows) {
    if (!selectionsByCatalogue.has(r.catalogue_id)) {
      selectionsByCatalogue.set(r.catalogue_id,
        { buyerId, catalogueId: r.catalogue_id, lotIds: [], emdFundedLotIds: [] })
    }
    const sel = selectionsByCatalogue.get(r.catalogue_id)
    sel.lotIds.push(r.lot_id)
    if (r.emd_funded) sel.emdFundedLotIds.push(r.lot_id)
  }

  return {
    serverTime: new Date().toISOString(),
    buyerId,
    wallet: {
      userId: buyerId,
      balance: num(walletRow ? walletRow.balance : 0),
      emdLocked: num(walletRow ? walletRow.emd_locked : 0),
      ledger: ledger.map((e) => ({
        id: e.id, at: iso(e.at), type: e.type, amount: num(e.amount), ref: e.ref,
        lotId: e.lot_id ?? undefined, catalogueId: e.catalogue_id ?? undefined, note: e.note,
      })),
    },
    watchlist: watchlist.map((w) => ({ buyerId, catalogueId: w.catalogue_id })),
    selections: [...selectionsByCatalogue.values()],
    bids: bids.map((b) => ({
      id: b.id, lotId: b.lot_id, catalogueId: b.catalogue_id,
      bidderId: b.bidder_id === buyerId ? buyerId : rivalToken(b.lot_id, b.bidder_id),
      rate: num(b.rate), at: iso(b.at), type: b.type, status: b.status,
    })),
    autoBids: autoBids.map((a) => ({
      buyerId, lotId: a.lot_id, maxRate: num(a.max_rate), active: !!a.active,
    })),
    emdExemptionRequests: exemptions.map((e) => ({
      id: e.id, buyerId, catalogueId: e.catalogue_id, reason: e.reason, status: e.status,
      createdAt: iso(e.created_at), decidedAt: iso(e.decided_at) ?? undefined,
      decidedBy: e.decided_by ?? undefined, rejectionReason: e.rejection_reason ?? undefined,
    })),
    deliveryOrders: orders.map(toDeliveryOrder),
    termsSets: termsSets.map(toTermsSet),
    catalogues: catalogues.map((c) => toCatalogue(c, byCatalogue.get(c.id))),
    lots: lots.map((l) => toLot(l, byLot.get(l.id))),
    users: [toUser(buyer), ...users.map(toUser)],
    notifications: notifications.map((n) => ({
      id: n.id, userId: n.user_id, kind: n.kind, title: n.title, body: n.body,
      at: iso(n.at), read: !!n.is_read, href: n.href ?? undefined,
    })),
    disputes: disputes.map((d) => ({
      id: d.id, userId: d.user_id, subject: d.subject, category: d.category,
      lotId: d.lot_id ?? undefined, status: d.status, createdAt: iso(d.created_at),
      messages: d.messages ?? [], assignedToId: d.assigned_to_id ?? undefined,
      outcome: d.outcome ?? undefined, resolution: d.resolution ?? undefined,
      resolvedAt: iso(d.resolved_at) ?? undefined, resolvedById: d.resolved_by_id ?? undefined,
      refundId: d.refund_id ?? undefined,
    })),
    bankAccounts: bankAccounts.map((a) => ({
      id: a.id, userId: a.user_id, bankName: a.bank_name, ifsc: a.ifsc,
      accountHolderName: a.account_holder_name, last4: a.last4,
      accountNumberMasked: a.account_number_masked, status: a.status,
      rejectionReason: a.rejection_reason ?? undefined, createdAt: iso(a.created_at),
    })),
    depositClaims: depositClaims.map((c) => ({
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
    inspectionSlots: inspectionSlots.map((s) => ({
      id: s.id, catalogueId: s.catalogue_id, userId: s.user_id,
      date: iso(s.slot_date), window: s.window_label, persons: s.persons,
      status: s.status, passCode: s.pass_code,
    })),
    companyBankAccounts: companyBankAccounts.map((a) => ({
      id: a.id, bank: a.bank, accountNumberMasked: a.account_number_masked,
      ifsc: a.ifsc, purpose: a.purpose,
    })),
    withdrawalWindow: settingOf('withdrawalWindow'),
    financeConfig: settingOf('financeConfig'),
  }
}
