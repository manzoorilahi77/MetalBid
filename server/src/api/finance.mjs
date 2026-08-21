/* ---------------------------------------------------------------------------
   Finance Administrator workspace.

   The books: money in (deposits), money out (withdrawals, refunds), what was
   billed (invoices), what was earned (commission), what was forfeited, and the
   bank statement all of it is reconciled against — plus the CEO queue that
   gates the large decisions.

   Unlike buyer and seller this is not scoped to one user's records. Finance
   verifies every buyer's deposit and every seller's commission, so wallets,
   bank accounts, deposit claims and withdrawal requests are returned for ALL
   users. That is the role, not an oversight.

   Reserve price is NOT returned. Finance moves money against cleared prices and
   invoices; the seller's floor is a commercial term they never act on. This is
   the one whole-platform role that still gets LOT_COLUMNS rather than
   LOT_COLUMNS_WITH_RESERVE.

   Ledger entries are returned with the wallets here, unlike the auction
   endpoint's balance-only view: the EMD ledger screen is a line-by-line audit.
--------------------------------------------------------------------------- */
import { query } from '../db.mjs'
import {
  CATALOGUE_COLUMNS, DELIVERY_ORDER_COLUMNS, LOT_COLUMNS, USER_COLUMNS_FULL,
  iso, lotIdsByCatalogue, num, photosByLot, toCatalogue, toDeliveryOrder, toLot, toUser,
} from './dto.mjs'

export async function getFinanceData() {
  const [
    catalogues, lots, photos, users, orders,
    wallets, ledger, bankAccounts, companyAccounts, deposits, withdrawals,
    refunds, forfeitures, invoices, statementLines, settlements, ceoApprovals,
    auditEvents, selectionRows, settings,
  ] = [
    await query(`SELECT ${CATALOGUE_COLUMNS} FROM catalogues ORDER BY starts_at DESC`),
    await query(`SELECT ${LOT_COLUMNS} FROM lots ORDER BY catalogue_id, lot_no`),
    await query('SELECT id, lot_id, label, hue FROM lot_photos ORDER BY lot_id, position'),
    /* Full profiles: refunds, forfeitures and account verification are decided
       against the account's standing and registered details. */
    await query(`SELECT ${USER_COLUMNS_FULL} FROM users`),
    await query(`SELECT ${DELIVERY_ORDER_COLUMNS} FROM delivery_orders ORDER BY created_at DESC`),
    await query('SELECT user_id, balance, emd_locked FROM wallets'),
    await query(`SELECT id, user_id, at, type, amount, ref, lot_id, catalogue_id, note
                   FROM wallet_ledger ORDER BY at DESC`),
    await query(`SELECT id, user_id, bank_name, ifsc, account_holder_name, last4,
                        account_number_masked, status, rejection_reason, created_at
                   FROM bank_accounts`),
    await query('SELECT id, bank, account_number_masked, ifsc, purpose FROM company_bank_accounts'),
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
    await query(`SELECT id, number, kind, party_id, catalogue_id, lot_id, do_id, issued_at,
                        issued_by, taxable, gst, tcs, total, status, supersedes_id, note
                   FROM invoices ORDER BY issued_at DESC`),
    await query(`SELECT id, at, account_id, direction, amount, ref, narration, status,
                        matched_to, matched_kind, matched_by, matched_at, break_note, escalated
                   FROM bank_statement_lines ORDER BY at DESC`),
    await query(`SELECT id, catalogue_id, seller_id, amount, mode, settled_at, reference, status,
                        confirmed_by, confirmed_at, query_note FROM commission_settlements`),
    await query(`SELECT id, kind, ref_id, amount, summary, reason, requested_by, requested_at,
                        status, info_note, info_asked_at, payload, decided_by, decided_at,
                        decision_note FROM ceo_approvals ORDER BY requested_at DESC`),
    await query(`SELECT id, at, actor_id, action, target, detail, severity
                   FROM audit_events ORDER BY at DESC`),
    await query('SELECT buyer_id, catalogue_id, lot_id, emd_funded FROM selection_lots'),
    await query("SELECT setting_key, value FROM app_settings"),
  ]

  const byLot = photosByLot(photos)
  const byCatalogue = lotIdsByCatalogue(lots)
  const settingOf = (key) => settings.find((s) => s.setting_key === key)?.value ?? null

  /* Ledger entries belong to their wallet, so they are nested rather than
     returned as a parallel array — Wallet.ledger is how every screen reads it. */
  const ledgerByUser = new Map()
  for (const e of ledger) {
    if (!ledgerByUser.has(e.user_id)) ledgerByUser.set(e.user_id, [])
    ledgerByUser.get(e.user_id).push({
      id: e.id, at: iso(e.at), type: e.type, amount: num(e.amount), ref: e.ref,
      lotId: e.lot_id ?? undefined, catalogueId: e.catalogue_id ?? undefined, note: e.note,
    })
  }

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
    deliveryOrders: orders.map(toDeliveryOrder),
    selections: [...selections.values()],
    wallets: wallets.map((w) => ({
      userId: w.user_id, balance: num(w.balance), emdLocked: num(w.emd_locked),
      ledger: ledgerByUser.get(w.user_id) ?? [],
    })),
    bankAccounts: bankAccounts.map((a) => ({
      id: a.id, userId: a.user_id, bankName: a.bank_name, ifsc: a.ifsc,
      accountHolderName: a.account_holder_name, last4: a.last4,
      accountNumberMasked: a.account_number_masked, status: a.status,
      rejectionReason: a.rejection_reason ?? undefined, createdAt: iso(a.created_at),
    })),
    companyBankAccounts: companyAccounts.map((a) => ({
      id: a.id, bank: a.bank, accountNumberMasked: a.account_number_masked,
      ifsc: a.ifsc, purpose: a.purpose,
    })),
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
    invoices: invoices.map((i) => ({
      id: i.id, number: i.number, kind: i.kind, partyId: i.party_id,
      catalogueId: i.catalogue_id, lotId: i.lot_id ?? undefined, doId: i.do_id ?? undefined,
      issuedAt: iso(i.issued_at), issuedBy: i.issued_by, taxable: num(i.taxable),
      gst: num(i.gst), tcs: num(i.tcs), total: num(i.total), status: i.status,
      supersedesId: i.supersedes_id ?? undefined, note: i.note ?? undefined,
    })),
    bankStatementLines: statementLines.map((b) => ({
      id: b.id, at: iso(b.at), accountId: b.account_id, direction: b.direction,
      amount: num(b.amount), ref: b.ref, narration: b.narration, status: b.status,
      matchedTo: b.matched_to ?? undefined, matchedKind: b.matched_kind ?? undefined,
      matchedBy: b.matched_by ?? undefined, matchedAt: iso(b.matched_at) ?? undefined,
      breakNote: b.break_note ?? undefined, escalated: !!b.escalated,
    })),
    commissionSettlements: settlements.map((s) => ({
      id: s.id, catalogueId: s.catalogue_id, sellerId: s.seller_id, amount: num(s.amount),
      mode: s.mode, at: iso(s.settled_at), reference: s.reference ?? undefined,
      status: s.status ?? undefined, confirmedBy: s.confirmed_by ?? undefined,
      confirmedAt: iso(s.confirmed_at) ?? undefined, queryNote: s.query_note ?? undefined,
    })),
    ceoApprovals: ceoApprovals.map((c) => ({
      id: c.id, kind: c.kind, refId: c.ref_id, amount: num(c.amount), summary: c.summary,
      reason: c.reason, requestedBy: c.requested_by, requestedAt: iso(c.requested_at),
      status: c.status, infoNote: c.info_note ?? undefined,
      infoAskedAt: iso(c.info_asked_at) ?? undefined, payload: c.payload ?? undefined,
      decidedBy: c.decided_by ?? undefined, decidedAt: iso(c.decided_at) ?? undefined,
      decisionNote: c.decision_note ?? undefined,
    })),
    auditEvents: auditEvents.map((a) => ({
      id: a.id, at: iso(a.at), actorId: a.actor_id, action: a.action,
      target: a.target, detail: a.detail, severity: a.severity,
    })),
    financeConfig: settingOf('financeConfig'),
    withdrawalWindow: settingOf('withdrawalWindow'),
  }
}
