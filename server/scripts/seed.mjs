/* ---------------------------------------------------------------------------
   Seeds the database from the prototype store's computed state.

   Source is seed-data/store-dump.json, produced by
   `npx tsx scripts/dump-store.ts` in the frontend -- NOT src/data/mock/*.json.
   The distinction matters: store.ts synthesises records that exist in no
   fixture file at all (the bank accounts, deposit claims, withdrawal requests,
   EMD exemptions and bid flags, and the weighment witness stamped onto delivery
   orders). Seeding from the raw fixtures silently drops all of them.

   Timestamps: the store already rebased every instant to the moment of the dump,
   so nothing is shifted again here. Re-dump and re-seed to move the demo data
   around the current moment.

   Rows whose foreign key targets are missing are skipped and reported rather
   than silently dropped -- the fixtures do contain a few (see the watchlist
   entry pointing at a catalogue that was never authored). Run with --dry-run to
   build and validate every row without connecting to the database.
--------------------------------------------------------------------------- */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { toDbDateTime, formatIst } from '../src/time.mjs'

const DRY = process.argv.includes('--dry-run')
const here = dirname(fileURLToPath(import.meta.url))
const dump = JSON.parse(readFileSync(join(here, '..', 'seed-data', 'store-dump.json'), 'utf8'))

/** ISO string -> DATETIME(3) literal, in UTC. No rebasing: see header. */
const dt = (iso) => (iso ? toDbDateTime(new Date(iso)) : null)
const json = (v) => JSON.stringify(v ?? null)
const bool = (v) => (v ? 1 : 0)

const idsOf = (rows, key = 'id') => new Set(rows.map((r) => r[key]))
const userIds = idsOf(dump.users)
const catalogueIds = idsOf(dump.catalogues)
const lotIds = idsOf(dump.lots)

/* Every table, in insert order. Reversed, this is also the safe wipe order.
   `fks` are validated locally so a dangling row is reported by name rather than
   surfacing as an opaque ER_NO_REFERENCED_ROW_2 mid-transaction. */
const TABLES = [
  {
    name: 'users',
    columns: ['id', 'name', 'firm', 'phone', 'email', 'role', 'kyc_status', 'seller_verified',
              'standing', 'city', 'gstin', 'avatar_hue', 'bidder_id', 'joined_at'],
    rows: () => dump.users.map((u) => ({
      id: u.id, name: u.name, firm: u.firm ?? null, phone: u.phone ?? null, email: u.email ?? null,
      role: u.role, kyc_status: u.kycStatus ?? 'none', seller_verified: bool(u.sellerVerified),
      standing: u.standing ?? 'good', city: u.city ?? null, gstin: u.gstin ?? null,
      avatar_hue: u.avatarHue ?? 0, bidder_id: u.bidderId ?? null, joined_at: dt(u.joinedAt),
    })),
  },
  {
    name: 'terms_sets',
    columns: ['id', 'name', 'version', 'general', 'special', 'lot_specific_note'],
    rows: () => dump.termsSets.map((t) => ({
      id: t.id, name: t.name, version: t.version,
      general: json(t.general ?? []), special: json(t.special ?? []),
      lot_specific_note: t.lotSpecificNote ?? null,
    })),
  },
  {
    name: 'company_bank_accounts',
    columns: ['id', 'bank', 'account_number_masked', 'ifsc', 'purpose'],
    rows: () => dump.companyBankAccounts.map((a) => ({
      id: a.id, bank: a.bank, account_number_masked: a.accountNumberMasked,
      ifsc: a.ifsc, purpose: a.purpose ?? null,
    })),
  },
  {
    name: 'catalogues',
    fks: [['seller_id', userIds]],
    columns: ['id', 'code', 'title', 'seller_id', 'type', 'status', 'starts_at', 'ends_at',
              'emd_deadline', 'emd_opens_at', 'inspection_from', 'inspection_to', 'inspection_hours',
              'yard_name', 'yard_address', 'region', 'anti_snipe_minutes', 'bid_validity_days',
              'description', 'terms_set_id', 'assigned_field_exec_id', 'inspection_contact'],
    rows: () => dump.catalogues.map((c) => ({
      id: c.id, code: c.code, title: c.title, seller_id: c.sellerId, type: c.type, status: c.status,
      starts_at: dt(c.startsAt), ends_at: dt(c.endsAt), emd_deadline: dt(c.emdDeadline),
      emd_opens_at: dt(c.emdOpensAt), inspection_from: dt(c.inspectionFrom),
      inspection_to: dt(c.inspectionTo), inspection_hours: c.inspectionHours ?? null,
      yard_name: c.yardName ?? null, yard_address: c.yardAddress ?? null, region: c.region ?? null,
      anti_snipe_minutes: c.antiSnipeMinutes ?? 5, bid_validity_days: c.bidValidityDays ?? 7,
      description: c.description ?? null, terms_set_id: c.termsSetId ?? null,
      assigned_field_exec_id: c.assignedFieldExecId ?? null,
      inspection_contact: json(c.inspectionContact),
    })),
  },
  {
    name: 'catalogue_documents',
    fks: [['catalogue_id', catalogueIds]],
    columns: ['id', 'catalogue_id', 'name', 'type', 'size', 'position'],
    rows: () => dump.catalogues.flatMap((c) => (c.documents ?? []).map((d, i) => ({
      id: `${c.id}:${d.id}`, catalogue_id: c.id, name: d.name, type: d.type,
      size: d.size ?? null, position: i,
    }))),
  },
  {
    name: 'lots',
    fks: [['seller_id', userIds], ['catalogue_id', catalogueIds, { nullable: true }]],
    columns: ['id', 'lot_no', 'catalogue_id', 'seller_id', 'metal', 'category', 'grade',
              'indicative_qty', 'uom', 'yard', 'description', 'start_rate', 'increment',
              'reserve_rate', 'pre_bid_emd', 'hazardous', 'status', 'current_rate',
              'leading_bidder_id', 'bid_count', 'ends_at', 'extensions', 'result_h1_rate',
              'sale_basis', 'known_seller', 'inspection_report_id', 'inspection_waived',
              'waived_by', 'waived_reason', 'waived_at', 'seller_decision', 'overrides'],
    rows: () => dump.lots.map((l) => ({
      id: l.id, lot_no: l.lotNo, catalogue_id: l.catalogueId || null, seller_id: l.sellerId,
      metal: l.metal, category: l.category, grade: l.grade ?? null,
      indicative_qty: l.indicativeQty, uom: l.uom, yard: l.yard ?? null,
      description: l.description ?? null, start_rate: l.startRate, increment: l.increment,
      reserve_rate: l.reserveRate, pre_bid_emd: l.preBidEmd, hazardous: bool(l.hazardous),
      status: l.status, current_rate: l.currentRate ?? null,
      leading_bidder_id: l.leadingBidderId ?? null, bid_count: l.bidCount ?? 0,
      ends_at: dt(l.endsAt), extensions: l.extensions ?? 0,
      result_h1_rate: l.resultH1Rate ?? null, sale_basis: l.saleBasis ?? null,
      known_seller: bool(l.knownSeller), inspection_report_id: l.inspectionReportId ?? null,
      inspection_waived: bool(l.inspectionWaived), waived_by: l.waivedBy ?? null,
      waived_reason: l.waivedReason ?? null, waived_at: dt(l.waivedAt),
      seller_decision: l.sellerDecision ?? null, overrides: json(l.overrides ?? []),
    })),
  },
  {
    name: 'lot_photos',
    fks: [['lot_id', lotIds]],
    columns: ['id', 'lot_id', 'label', 'hue', 'position'],
    rows: () => dump.lots.flatMap((l) => (l.photos ?? []).map((p, i) => ({
      id: p.id, lot_id: l.id, label: p.label, hue: p.hue, position: i,
    }))),
  },
  {
    name: 'wallets',
    fks: [['user_id', userIds]],
    columns: ['user_id', 'balance', 'emd_locked'],
    rows: () => dump.wallets.map((w) => ({
      user_id: w.userId, balance: w.balance ?? 0, emd_locked: w.emdLocked ?? 0,
    })),
  },
  {
    name: 'wallet_ledger',
    fks: [['user_id', userIds]],
    columns: ['id', 'user_id', 'at', 'type', 'amount', 'ref', 'lot_id', 'catalogue_id', 'note'],
    rows: () => dump.wallets.flatMap((w) => (w.ledger ?? []).map((e) => ({
      id: e.id, user_id: w.userId, at: dt(e.at), type: e.type, amount: e.amount,
      ref: e.ref ?? null, lot_id: e.lotId ?? null, catalogue_id: e.catalogueId ?? null,
      note: e.note ?? null,
    }))),
  },
  {
    name: 'bank_accounts',
    fks: [['user_id', userIds]],
    columns: ['id', 'user_id', 'bank_name', 'ifsc', 'account_holder_name', 'last4',
              'account_number_masked', 'status', 'rejection_reason', 'created_at'],
    rows: () => dump.bankAccounts.map((a) => ({
      id: a.id, user_id: a.userId, bank_name: a.bankName, ifsc: a.ifsc,
      account_holder_name: a.accountHolderName, last4: a.last4,
      account_number_masked: a.accountNumberMasked, status: a.status,
      rejection_reason: a.rejectionReason ?? null, created_at: dt(a.createdAt),
    })),
  },
  {
    name: 'deposit_claims',
    fks: [['user_id', userIds]],
    columns: ['id', 'user_id', 'amount', 'utr', 'transfer_date', 'proof_filename', 'status',
              'rejection_reason', 'created_at', 'decided_at', 'decided_by'],
    rows: () => dump.depositClaims.map((c) => ({
      id: c.id, user_id: c.userId, amount: c.amount, utr: c.utr,
      transfer_date: dt(c.transferDate), proof_filename: c.proofFilename ?? null,
      status: c.status, rejection_reason: c.rejectionReason ?? null,
      created_at: dt(c.createdAt), decided_at: dt(c.decidedAt), decided_by: c.decidedBy ?? null,
    })),
  },
  {
    name: 'withdrawal_requests',
    fks: [['user_id', userIds]],
    columns: ['id', 'user_id', 'amount', 'bank_account_id', 'ref', 'status', 'reason',
              'requested_at', 'decided_at', 'reviewed_by', 'reviewed_at', 'processed_by'],
    rows: () => dump.withdrawalRequests.map((w) => ({
      id: w.id, user_id: w.userId, amount: w.amount, bank_account_id: w.bankAccountId ?? null,
      ref: w.ref ?? null, status: w.status, reason: w.reason ?? null,
      requested_at: dt(w.requestedAt), decided_at: dt(w.decidedAt),
      reviewed_by: w.reviewedBy ?? null, reviewed_at: dt(w.reviewedAt),
      processed_by: w.processedBy ?? null,
    })),
  },
  {
    name: 'watchlist',
    fks: [['buyer_id', userIds], ['catalogue_id', catalogueIds]],
    columns: ['buyer_id', 'catalogue_id'],
    rows: () => dump.watchlist.map((w) => ({ buyer_id: w.buyerId, catalogue_id: w.catalogueId })),
  },
  {
    /* lotIds and emdFundedLotIds collapse into one row per lot with a funded
       flag. Union rather than intersect: a funded lot missing from lotIds would
       otherwise be dropped silently, and losing a funded EMD is losing money. */
    name: 'selection_lots',
    fks: [['buyer_id', userIds], ['catalogue_id', catalogueIds], ['lot_id', lotIds]],
    columns: ['buyer_id', 'catalogue_id', 'lot_id', 'emd_funded'],
    rows: () => dump.selections.flatMap((s) => {
      const funded = new Set(s.emdFundedLotIds ?? [])
      return [...new Set([...(s.lotIds ?? []), ...funded])].map((lotId) => ({
        buyer_id: s.buyerId, catalogue_id: s.catalogueId, lot_id: lotId,
        emd_funded: bool(funded.has(lotId)),
      }))
    }),
  },
  {
    name: 'bids',
    fks: [['lot_id', lotIds], ['bidder_id', userIds]],
    columns: ['id', 'lot_id', 'catalogue_id', 'bidder_id', 'rate', 'at', 'type', 'status'],
    rows: () => dump.bids.map((b) => ({
      id: b.id, lot_id: b.lotId, catalogue_id: b.catalogueId, bidder_id: b.bidderId,
      rate: b.rate, at: dt(b.at), type: b.type, status: b.status ?? 'valid',
    })),
  },
  {
    name: 'auto_bids',
    fks: [['buyer_id', userIds], ['lot_id', lotIds]],
    columns: ['buyer_id', 'lot_id', 'max_rate', 'active'],
    rows: () => dump.autoBids.map((a) => ({
      buyer_id: a.buyerId, lot_id: a.lotId, max_rate: a.maxRate, active: bool(a.active),
    })),
  },
  {
    name: 'emd_exemption_requests',
    fks: [['buyer_id', userIds], ['catalogue_id', catalogueIds]],
    columns: ['id', 'buyer_id', 'catalogue_id', 'reason', 'status', 'created_at',
              'decided_at', 'decided_by', 'rejection_reason'],
    rows: () => dump.emdExemptionRequests.map((e) => ({
      id: e.id, buyer_id: e.buyerId, catalogue_id: e.catalogueId, reason: e.reason ?? null,
      status: e.status, created_at: dt(e.createdAt), decided_at: dt(e.decidedAt),
      decided_by: e.decidedBy ?? null, rejection_reason: e.rejectionReason ?? null,
    })),
  },
  {
    name: 'delivery_orders',
    fks: [['lot_id', lotIds], ['buyer_id', userIds]],
    columns: ['id', 'lot_id', 'catalogue_id', 'buyer_id', 'stage', 'h1_rate', 'awarded_qty',
              'uom', 'material_value', 'gst_amount', 'tcs_amount', 'paid_amount', 'lifting_by',
              'created_at', 'dd_id', 'lifting_checklist', 'weighed_qty', 'weighed_by_id',
              'weighed_at', 'handover_confirmed_at', 'handover_confirmed_by', 'handover_note'],
    rows: () => dump.deliveryOrders.map((d) => ({
      id: d.id, lot_id: d.lotId, catalogue_id: d.catalogueId, buyer_id: d.buyerId,
      stage: d.stage, h1_rate: d.h1Rate, awarded_qty: d.awardedQty, uom: d.uom,
      material_value: d.materialValue, gst_amount: d.gstAmount ?? 0, tcs_amount: d.tcsAmount ?? 0,
      paid_amount: d.paidAmount ?? 0, lifting_by: dt(d.liftingBy), created_at: dt(d.createdAt),
      dd_id: d.ddId ?? null, lifting_checklist: json(d.liftingChecklist ?? []),
      weighed_qty: d.weighedQty ?? null, weighed_by_id: d.weighedById ?? null,
      weighed_at: dt(d.weighedAt), handover_confirmed_at: dt(d.handoverConfirmedAt),
      handover_confirmed_by: d.handoverConfirmedBy ?? null, handover_note: d.handoverNote ?? null,
    })),
  },
  {
    name: 'demand_drafts',
    columns: ['id', 'do_id', 'dd_number', 'issuing_bank', 'amount', 'issued_at', 'issued_by'],
    rows: () => (dump.demandDrafts ?? []).map((d) => ({
      id: d.id, do_id: d.doId, dd_number: d.ddNumber, issuing_bank: d.issuingBank ?? null,
      amount: d.amount, issued_at: dt(d.issuedAt), issued_by: d.issuedBy ?? null,
    })),
  },
  {
    name: 'inspection_slots',
    fks: [['catalogue_id', catalogueIds], ['user_id', userIds]],
    columns: ['id', 'catalogue_id', 'user_id', 'slot_date', 'window_label', 'persons',
              'status', 'pass_code'],
    rows: () => dump.inspectionSlots.map((s) => ({
      id: s.id, catalogue_id: s.catalogueId, user_id: s.userId, slot_date: dt(s.date),
      window_label: s.window ?? null, persons: s.persons ?? 1, status: s.status,
      pass_code: s.passCode ?? null,
    })),
  },
  {
    name: 'notifications',
    columns: ['id', 'user_id', 'kind', 'title', 'body', 'at', 'is_read', 'href'],
    rows: () => dump.notifications.map((n) => ({
      id: n.id, user_id: n.userId ?? null, kind: n.kind, title: n.title, body: n.body ?? null,
      at: dt(n.at), is_read: bool(n.read), href: n.href ?? null,
    })),
  },
  {
    name: 'disputes',
    fks: [['user_id', userIds]],
    columns: ['id', 'user_id', 'subject', 'category', 'lot_id', 'status', 'created_at',
              'messages', 'assigned_to_id', 'outcome', 'resolution', 'resolved_at',
              'resolved_by_id', 'refund_id'],
    rows: () => dump.disputes.map((d) => ({
      id: d.id, user_id: d.userId, subject: d.subject, category: d.category,
      lot_id: d.lotId ?? null, status: d.status, created_at: dt(d.createdAt),
      messages: json(d.messages ?? []), assigned_to_id: d.assignedToId ?? null,
      outcome: d.outcome ?? null, resolution: d.resolution ?? null,
      resolved_at: dt(d.resolvedAt), resolved_by_id: d.resolvedById ?? null,
      refund_id: d.refundId ?? null,
    })),
  },
  {
    /* No FK on lot_id by design (see migration 006): a report is evidence and
       outlives the lot row. Validated here anyway so a genuinely dangling
       report is reported rather than quietly stored. */
    name: 'inspection_reports',
    fks: [['lot_id', lotIds], ['inspector_id', userIds, { nullable: true }]],
    columns: ['id', 'lot_id', 'inspector_id', 'inspected_at', 'measured_qty', 'uom',
              'lot_condition', 'notes', 'checklist', 'photo_count', 'status'],
    rows: () => dump.inspectionReports.map((r) => ({
      id: r.id, lot_id: r.lotId, inspector_id: r.inspectorId ?? null, inspected_at: dt(r.date),
      measured_qty: r.measuredQty ?? null, uom: r.uom ?? null, lot_condition: r.condition ?? null,
      notes: r.notes ?? null, checklist: json(r.checklist ?? []),
      photo_count: r.photoCount ?? 0, status: r.status,
    })),
  },
  {
    name: 'commission_settlements',
    fks: [['catalogue_id', catalogueIds], ['seller_id', userIds]],
    columns: ['id', 'catalogue_id', 'seller_id', 'amount', 'mode', 'settled_at', 'reference',
              'status', 'confirmed_by', 'confirmed_at', 'query_note'],
    rows: () => dump.commissionSettlements.map((s) => ({
      id: s.id, catalogue_id: s.catalogueId, seller_id: s.sellerId, amount: s.amount,
      mode: s.mode, settled_at: dt(s.at), reference: s.reference ?? null,
      status: s.status ?? null, confirmed_by: s.confirmedBy ?? null,
      confirmed_at: dt(s.confirmedAt), query_note: s.queryNote ?? null,
    })),
  },
  {
    name: 'announcements',
    fks: [['catalogue_id', catalogueIds, { nullable: true }]],
    columns: ['id', 'scope', 'catalogue_id', 'title', 'body', 'at', 'severity'],
    rows: () => dump.announcements.map((a) => ({
      id: a.id, scope: a.scope, catalogue_id: a.catalogueId ?? null, title: a.title,
      body: a.body ?? null, at: dt(a.at), severity: a.severity,
    })),
  },
  {
    name: 'cancellation_requests',
    fks: [['catalogue_id', catalogueIds]],
    columns: ['id', 'catalogue_id', 'reason', 'requested_by', 'requested_at', 'status',
              'decided_by', 'decided_at', 'decision_note'],
    rows: () => dump.cancellationRequests.map((c) => ({
      id: c.id, catalogue_id: c.catalogueId, reason: c.reason ?? null,
      requested_by: c.requestedBy, requested_at: dt(c.requestedAt), status: c.status,
      decided_by: c.decidedBy ?? null, decided_at: dt(c.decidedAt),
      decision_note: c.decisionNote ?? null,
    })),
  },
  {
    name: 'bid_void_requests',
    columns: ['id', 'bid_id', 'lot_id', 'catalogue_id', 'reason', 'notes', 'raised_by',
              'raised_at', 'stage', 'requested_by', 'requested_at', 'status',
              'decided_by', 'decided_at', 'decision_note'],
    rows: () => dump.bidVoidRequests.map((b) => ({
      id: b.id, bid_id: b.bidId, lot_id: b.lotId, catalogue_id: b.catalogueId,
      reason: b.reason ?? null, notes: b.notes ?? null, raised_by: b.raisedBy,
      raised_at: dt(b.raisedAt), stage: b.stage, requested_by: b.requestedBy ?? null,
      requested_at: dt(b.requestedAt), status: b.status, decided_by: b.decidedBy ?? null,
      decided_at: dt(b.decidedAt), decision_note: b.decisionNote ?? null,
    })),
  },
  {
    name: 'result_confirmations',
    fks: [['catalogue_id', catalogueIds]],
    columns: ['catalogue_id', 'confirmed_by', 'confirmed_at', 'lots_sold', 'lots_unsold', 'realisation'],
    rows: () => dump.resultConfirmations.map((r) => ({
      catalogue_id: r.catalogueId, confirmed_by: r.confirmedBy, confirmed_at: dt(r.confirmedAt),
      lots_sold: r.lotsSold ?? 0, lots_unsold: r.lotsUnsold ?? 0, realisation: r.realisation ?? 0,
    })),
  },
  {
    name: 'sta_referrals',
    fks: [['lot_id', lotIds]],
    columns: ['id', 'lot_id', 'catalogue_id', 'note', 'referred_by', 'referred_at'],
    rows: () => dump.staReferrals.map((s) => ({
      id: s.id, lot_id: s.lotId, catalogue_id: s.catalogueId, note: s.note ?? null,
      referred_by: s.referredBy, referred_at: dt(s.referredAt),
    })),
  },
  {
    name: 'refund_requests',
    fks: [['user_id', userIds]],
    columns: ['id', 'user_id', 'amount', 'source', 'reason', 'lot_id', 'catalogue_id',
              'dispute_id', 'status', 'raised_by', 'raised_at', 'decided_by', 'decided_at',
              'decision_note', 'processed_by', 'processed_at'],
    rows: () => dump.refundRequests.map((r) => ({
      id: r.id, user_id: r.userId, amount: r.amount, source: r.source, reason: r.reason ?? null,
      lot_id: r.lotId ?? null, catalogue_id: r.catalogueId ?? null, dispute_id: r.disputeId ?? null,
      status: r.status, raised_by: r.raisedBy, raised_at: dt(r.raisedAt),
      decided_by: r.decidedBy ?? null, decided_at: dt(r.decidedAt),
      decision_note: r.decisionNote ?? null, processed_by: r.processedBy ?? null,
      processed_at: dt(r.processedAt),
    })),
  },
  {
    name: 'emd_forfeitures',
    fks: [['buyer_id', userIds]],
    columns: ['id', 'buyer_id', 'lot_id', 'catalogue_id', 'amount', 'reason', 'status',
              'raised_by', 'raised_at', 'decided_by', 'decided_at', 'decision_note'],
    rows: () => dump.emdForfeitures.map((f) => ({
      id: f.id, buyer_id: f.buyerId, lot_id: f.lotId, catalogue_id: f.catalogueId,
      amount: f.amount, reason: f.reason ?? null, status: f.status, raised_by: f.raisedBy,
      raised_at: dt(f.raisedAt), decided_by: f.decidedBy ?? null, decided_at: dt(f.decidedAt),
      decision_note: f.decisionNote ?? null,
    })),
  },
  {
    name: 'invoices',
    columns: ['id', 'number', 'kind', 'party_id', 'catalogue_id', 'lot_id', 'do_id',
              'issued_at', 'issued_by', 'taxable', 'gst', 'tcs', 'total', 'status',
              'supersedes_id', 'note'],
    rows: () => dump.invoices.map((i) => ({
      id: i.id, number: i.number, kind: i.kind, party_id: i.partyId,
      catalogue_id: i.catalogueId, lot_id: i.lotId ?? null, do_id: i.doId ?? null,
      issued_at: dt(i.issuedAt), issued_by: i.issuedBy ?? null, taxable: i.taxable,
      gst: i.gst ?? 0, tcs: i.tcs ?? 0, total: i.total, status: i.status,
      supersedes_id: i.supersedesId ?? null, note: i.note ?? null,
    })),
  },
  {
    name: 'bank_statement_lines',
    columns: ['id', 'at', 'account_id', 'direction', 'amount', 'ref', 'narration', 'status',
              'matched_to', 'matched_kind', 'matched_by', 'matched_at', 'break_note', 'escalated'],
    rows: () => dump.bankStatementLines.map((b) => ({
      id: b.id, at: dt(b.at), account_id: b.accountId, direction: b.direction,
      amount: b.amount, ref: b.ref ?? null, narration: b.narration ?? null, status: b.status,
      matched_to: b.matchedTo ?? null, matched_kind: b.matchedKind ?? null,
      matched_by: b.matchedBy ?? null, matched_at: dt(b.matchedAt),
      break_note: b.breakNote ?? null, escalated: bool(b.escalated),
    })),
  },
  {
    name: 'ceo_approvals',
    columns: ['id', 'kind', 'ref_id', 'amount', 'summary', 'reason', 'requested_by',
              'requested_at', 'status', 'info_note', 'info_asked_at', 'payload',
              'decided_by', 'decided_at', 'decision_note'],
    rows: () => dump.ceoApprovals.map((c) => ({
      id: c.id, kind: c.kind, ref_id: c.refId, amount: c.amount ?? 0,
      summary: c.summary ?? null, reason: c.reason ?? null, requested_by: c.requestedBy,
      requested_at: dt(c.requestedAt), status: c.status, info_note: c.infoNote ?? null,
      info_asked_at: dt(c.infoAskedAt), payload: c.payload ? json(c.payload) : null,
      decided_by: c.decidedBy ?? null, decided_at: dt(c.decidedAt),
      decision_note: c.decisionNote ?? null,
    })),
  },
  {
    name: 'audit_events',
    columns: ['id', 'at', 'actor_id', 'action', 'target', 'detail', 'severity'],
    rows: () => dump.auditEvents.map((a) => ({
      id: a.id, at: dt(a.at), actor_id: a.actorId ?? null, action: a.action,
      target: a.target ?? null, detail: a.detail ?? null, severity: a.severity,
    })),
  },
  {
    name: 'role_registry',
    columns: ['role_key', 'label', 'home', 'built_in', 'status', 'created_at', 'created_by',
              'removed_at', 'removed_by', 'removed_reason', 'based_on', 'note'],
    rows: () => dump.roleRegistry.map((r) => ({
      role_key: r.key, label: r.label, home: r.home ?? null, built_in: bool(r.builtIn),
      status: r.status, created_at: dt(r.createdAt), created_by: r.createdBy ?? null,
      removed_at: dt(r.removedAt), removed_by: r.removedBy ?? null,
      removed_reason: r.removedReason ?? null, based_on: r.basedOn ?? null, note: r.note ?? null,
    })),
  },
  {
    name: 'page_registry',
    columns: ['id', 'role_key', 'destination', 'label', 'sub_label', 'is_end', 'locked',
              'in_top', 'in_sub', 'active_match', 'hidden', 'sort_order', 'built_in',
              'retained', 'attached_from', 'category'],
    rows: () => dump.pageRegistry.map((p) => ({
      id: p.id, role_key: p.roleKey, destination: p.to, label: p.label,
      sub_label: p.subLabel ?? null, is_end: bool(p.end), locked: bool(p.locked),
      in_top: bool(p.inTop), in_sub: bool(p.inSub),
      active_match: p.activeMatch ? json(p.activeMatch) : null,
      hidden: bool(p.hidden), sort_order: p.order ?? 0, built_in: bool(p.builtIn),
      retained: bool(p.retained), attached_from: p.attachedFrom ?? null,
      category: p.category ?? null,
    })),
  },
  {
    name: 'structural_changes',
    columns: ['id', 'at', 'by_id', 'kind', 'target', 'summary', 'before_val', 'after_val',
              'snapshot', 'undone_at', 'undone_by'],
    rows: () => dump.structuralChanges.map((c) => ({
      id: c.id, at: dt(c.at), by_id: c.byId, kind: c.kind, target: c.target ?? null,
      summary: c.summary ?? null, before_val: c.before ?? null, after_val: c.after ?? null,
      snapshot: c.snapshot ? json(c.snapshot) : null, undone_at: dt(c.undoneAt),
      undone_by: c.undoneBy ?? null,
    })),
  },
  {
    name: 'password_resets',
    fks: [['user_id', userIds]],
    columns: ['id', 'user_id', 'mode', 'password', 'at', 'by_id', 'consumed'],
    rows: () => dump.passwordResets.map((r) => ({
      id: r.id, user_id: r.userId, mode: r.mode, password: r.password ?? null,
      at: dt(r.at), by_id: r.byId, consumed: bool(r.consumed),
    })),
  },
  {
    name: 'content_drafts',
    columns: ['id', 'page', 'section', 'author_id', 'submitted_at', 'before_text', 'after_text',
              'status', 'needs_ceo', 'note', 'decided_at', 'decided_by'],
    rows: () => dump.contentDrafts.map((c) => ({
      id: c.id, page: c.page, section: c.section, author_id: c.authorId,
      submitted_at: dt(c.submittedAt), before_text: c.before ?? null, after_text: c.after ?? null,
      status: c.status, needs_ceo: bool(c.needsCeo), note: c.note ?? null,
      decided_at: dt(c.decidedAt), decided_by: c.decidedBy ?? null,
    })),
  },
  {
    name: 'action_reviews',
    columns: ['id', 'event_id', 'verdict', 'note', 'at', 'by_id', 'escalated_to'],
    rows: () => dump.actionReviews.map((r) => ({
      id: r.id, event_id: r.eventId, verdict: r.verdict, note: r.note ?? null,
      at: dt(r.at), by_id: r.byId, escalated_to: r.escalatedTo ?? null,
    })),
  },
  {
    name: 'handover_notes',
    columns: ['id', 'by_id', 'at', 'body'],
    rows: () => dump.handoverNotes.map((n) => ({
      id: n.id, by_id: n.byId, at: dt(n.at), body: n.body ?? null,
    })),
  },
  {
    name: 'master_categories',
    columns: ['category_key', 'label', 'hue', 'built_in', 'active'],
    rows: () => dump.masterCategories.map((c) => ({
      category_key: c.key, label: c.label, hue: c.hue ?? 0,
      built_in: bool(c.builtIn), active: bool(c.active),
    })),
  },
  {
    name: 'master_uoms',
    columns: ['code', 'label', 'precision_note', 'built_in', 'active'],
    rows: () => dump.masterUoms.map((u) => ({
      code: u.code, label: u.label, precision_note: u.precision ?? null,
      built_in: bool(u.builtIn), active: bool(u.active),
    })),
  },
  {
    name: 'master_yards',
    columns: ['id', 'name', 'region', 'address', 'contact_name', 'contact_phone',
              'built_in', 'active'],
    rows: () => dump.masterYards.map((y) => ({
      id: y.id, name: y.name, region: y.region ?? null, address: y.address ?? null,
      contact_name: y.contactName ?? null, contact_phone: y.contactPhone ?? null,
      built_in: bool(y.builtIn), active: bool(y.active),
    })),
  },
  {
    name: 'app_settings',
    columns: ['setting_key', 'value', 'updated_at'],
    rows: () => {
      const now = toDbDateTime(new Date())
      return [
        { setting_key: 'withdrawalWindow', value: json(dump.withdrawalWindow), updated_at: now },
        { setting_key: 'financeConfig', value: json(dump.financeConfig), updated_at: now },
        /* A singleton nullable object — a one-row table would add nothing over
           a settings key, and JSON null round-trips as "no delegation". */
        { setting_key: 'ceoDelegation', value: json(dump.ceoDelegation), updated_at: now },
      ]
    },
  },
]

/* ---------------------------- build + validate ---------------------------- */

const built = []
let skippedTotal = 0

for (const table of TABLES) {
  let rows = table.rows()
  const before = rows.length

  for (const [col, valid, opts] of table.fks ?? []) {
    const nullable = opts?.nullable ?? false
    const bad = rows.filter((r) => !(nullable && r[col] == null) && !valid.has(r[col]))
    if (bad.length) {
      const targets = [...new Set(bad.map((r) => r[col]))]
      console.warn(`  ! ${table.name}.${col}: skipping ${bad.length} row(s) — no such ` +
        `${targets.length === 1 ? 'target' : 'targets'} (${targets.slice(0, 5).join(', ')}` +
        `${targets.length > 5 ? ', …' : ''})`)
      rows = rows.filter((r) => (nullable && r[col] == null) || valid.has(r[col]))
    }
  }

  const undef = rows.find((r) => table.columns.some((c) => r[c] === undefined))
  if (undef) {
    const cols = table.columns.filter((c) => undef[c] === undefined)
    throw new Error(`${table.name}: column(s) ${cols.join(', ')} are undefined for row ` +
      `${undef.id ?? JSON.stringify(undef).slice(0, 80)} — map them explicitly to null`)
  }

  skippedTotal += before - rows.length
  built.push({ ...table, built: rows })
}

const widest = Math.max(...built.map((t) => t.name.length))
for (const t of built) console.log(`  ${t.name.padEnd(widest)}  ${String(t.built.length).padStart(6)} rows`)
console.log(`\n${built.reduce((n, t) => n + t.built.length, 0)} rows across ${built.length} tables` +
  (skippedTotal ? `, ${skippedTotal} skipped for missing references` : ''))

if (DRY) {
  console.log('\n--dry-run: nothing written.')
  process.exit(0)
}

/* -------------------------------- write ---------------------------------- */

const { pool, closePool } = await import('../src/db.mjs')
const conn = await pool.getConnection()
await conn.beginTransaction()
try {
  for (const t of [...built].reverse()) {
    const [r] = await conn.query(`DELETE FROM ${t.name}`)
    if (r.affectedRows) console.log(`  cleared ${t.name} (${r.affectedRows})`)
  }
  for (const t of built) {
    for (let i = 0; i < t.built.length; i += 400) {
      const slice = t.built.slice(i, i + 400)
      await conn.query(`INSERT INTO ${t.name} (${t.columns.join(', ')}) VALUES ?`,
        [slice.map((r) => t.columns.map((c) => r[c]))])
    }
    if (t.built.length) console.log(`  ${t.name.padEnd(widest)}  ${String(t.built.length).padStart(6)} inserted`)
  }
  await conn.commit()
} catch (err) {
  await conn.rollback()
  conn.release()
  await closePool()
  throw err
}
conn.release()

const [[live]] = await pool.query(
  `SELECT COUNT(*) n FROM catalogues WHERE status='live' AND ends_at > UTC_TIMESTAMP(3)`)
const [[next]] = await pool.query(
  `SELECT code, ends_at FROM catalogues WHERE status='live' AND ends_at > UTC_TIMESTAMP(3) ORDER BY ends_at LIMIT 1`)
console.log(`\nlive catalogues still open: ${Number(live.n)}`)
if (next) console.log(`next to close: ${next.code} at ${formatIst(next.ends_at)} IST`)
await closePool()
