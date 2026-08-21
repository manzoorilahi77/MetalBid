/* ---------------------------------------------------------------------------
   Write registry: which entities may be persisted, and which columns of each.

   The frontend holds 127 mutating actions and all of their business logic. Port
   that to 127 bespoke endpoints and you get a year of work and two divergent
   implementations of every rule. So instead the store's own state changes are
   persisted: a client-side middleware diffs the entity arrays after each action
   and sends the rows that changed, and this registry is what the server will
   accept.

   The registry is the security boundary, and it is a whitelist on purpose.
   Anything not named here cannot be written at all, and a column not named for
   an entity is dropped rather than passed through — so a client cannot invent a
   field, and cannot reach a column the UI has no business setting (a lot's
   reserve_rate is writable, its id is not; a bid is insert-only).

   What this is NOT: authorization. It says what shape a write may take, not who
   may make it. Every endpoint here is still unauthenticated. When auth lands,
   each entity needs a per-role rule on top of this — see `writableBy` below,
   which records the intent today and is not yet enforced.

   Two paths deliberately bypass this and are computed server-side instead,
   because the server has to be the authority and last-write-wins is not good
   enough: placing a bid and funding EMD. See bidding.mjs.
--------------------------------------------------------------------------- */

/* Column type hints. Anything unlisted is passed through as a scalar. */
const J = 'json'      // stringified on write
const B = 'bool'      // JS boolean -> TINYINT(1)
const D = 'datetime'  // ISO string -> DATETIME(3) in UTC

/** camelCase field -> [column, type?]. Fields absent here are silently dropped. */
export const ENTITIES = {
  lots: {
    table: 'lots', key: ['id'], writableBy: ['exec_manager', 'auction_manager', 'seller', 'sub_admin', 'super_admin'],
    fields: {
      lotNo: ['lot_no'], catalogueId: ['catalogue_id'], sellerId: ['seller_id'],
      metal: ['metal'], category: ['category'], grade: ['grade'],
      indicativeQty: ['indicative_qty'], uom: ['uom'], yard: ['yard'],
      description: ['description'], startRate: ['start_rate'], increment: ['increment'],
      reserveRate: ['reserve_rate'], preBidEmd: ['pre_bid_emd'], hazardous: ['hazardous', B],
      status: ['status'], currentRate: ['current_rate'], leadingBidderId: ['leading_bidder_id'],
      bidCount: ['bid_count'], endsAt: ['ends_at', D], extensions: ['extensions'],
      resultH1Rate: ['result_h1_rate'], saleBasis: ['sale_basis'], knownSeller: ['known_seller', B],
      inspectionReportId: ['inspection_report_id'], inspectionWaived: ['inspection_waived', B],
      waivedBy: ['waived_by'], waivedReason: ['waived_reason'], waivedAt: ['waived_at', D],
      sellerDecision: ['seller_decision'], overrides: ['overrides', J],
    },
  },
  catalogues: {
    table: 'catalogues', key: ['id'], writableBy: ['exec_manager', 'auction_manager', 'sub_admin', 'super_admin'],
    fields: {
      code: ['code'], title: ['title'], sellerId: ['seller_id'], type: ['type'],
      status: ['status'], startsAt: ['starts_at', D], endsAt: ['ends_at', D],
      emdDeadline: ['emd_deadline', D], emdOpensAt: ['emd_opens_at', D],
      inspectionFrom: ['inspection_from', D], inspectionTo: ['inspection_to', D],
      inspectionHours: ['inspection_hours'], yardName: ['yard_name'],
      yardAddress: ['yard_address'], region: ['region'],
      antiSnipeMinutes: ['anti_snipe_minutes'], bidValidityDays: ['bid_validity_days'],
      description: ['description'], termsSetId: ['terms_set_id'],
      assignedFieldExecId: ['assigned_field_exec_id'], inspectionContact: ['inspection_contact', J],
    },
  },
  /* Insert-only. A placed bid is never edited; voiding one sets status via the
     void request flow, which goes through this same path as an update to
     `status` only. */
  bids: {
    table: 'bids', key: ['id'], insertOnly: false,
    writableBy: ['auction_manager', 'sub_admin', 'super_admin'],
    fields: {
      lotId: ['lot_id'], catalogueId: ['catalogue_id'], bidderId: ['bidder_id'],
      rate: ['rate'], at: ['at', D], type: ['type'], status: ['status'],
    },
  },
  users: {
    table: 'users', key: ['id'], writableBy: ['sub_admin', 'super_admin'],
    fields: {
      name: ['name'], firm: ['firm'], phone: ['phone'], email: ['email'], role: ['role'],
      kycStatus: ['kyc_status'], sellerVerified: ['seller_verified', B], standing: ['standing'],
      city: ['city'], gstin: ['gstin'], avatarHue: ['avatar_hue'], bidderId: ['bidder_id'],
      joinedAt: ['joined_at', D],
    },
  },
  deliveryOrders: {
    table: 'delivery_orders', key: ['id'], writableBy: ['exec_manager', 'finance_admin', 'buyer', 'sub_admin', 'super_admin'],
    fields: {
      lotId: ['lot_id'], catalogueId: ['catalogue_id'], buyerId: ['buyer_id'], stage: ['stage'],
      h1Rate: ['h1_rate'], awardedQty: ['awarded_qty'], uom: ['uom'],
      materialValue: ['material_value'], gstAmount: ['gst_amount'], tcsAmount: ['tcs_amount'],
      paidAmount: ['paid_amount'], liftingBy: ['lifting_by', D], createdAt: ['created_at', D],
      ddId: ['dd_id'], liftingChecklist: ['lifting_checklist', J], weighedQty: ['weighed_qty'],
      weighedById: ['weighed_by_id'], weighedAt: ['weighed_at', D],
      handoverConfirmedAt: ['handover_confirmed_at', D], handoverConfirmedBy: ['handover_confirmed_by'],
      handoverNote: ['handover_note'],
    },
  },
  inspectionReports: {
    table: 'inspection_reports', key: ['id'], writableBy: ['field_exec', 'exec_manager', 'sub_admin', 'super_admin'],
    fields: {
      lotId: ['lot_id'], inspectorId: ['inspector_id'], date: ['inspected_at', D],
      measuredQty: ['measured_qty'], uom: ['uom'], condition: ['lot_condition'],
      notes: ['notes'], checklist: ['checklist', J], photoCount: ['photo_count'], status: ['status'],
    },
  },
  notifications: {
    table: 'notifications', key: ['id'], writableBy: ['*'],
    fields: {
      userId: ['user_id'], kind: ['kind'], title: ['title'], body: ['body'],
      at: ['at', D], read: ['is_read', B], href: ['href'],
    },
  },
  disputes: {
    table: 'disputes', key: ['id'], writableBy: ['buyer', 'seller', 'sub_admin', 'super_admin'],
    fields: {
      userId: ['user_id'], subject: ['subject'], category: ['category'], lotId: ['lot_id'],
      status: ['status'], createdAt: ['created_at', D], messages: ['messages', J],
      assignedToId: ['assigned_to_id'], outcome: ['outcome'], resolution: ['resolution'],
      resolvedAt: ['resolved_at', D], resolvedById: ['resolved_by_id'], refundId: ['refund_id'],
    },
  },
  testimonials: {
    /* A buyer or seller writes their own; a Sub/Super Admin moderates any of
       them. See policy.mjs for the ownership + staff-only-fields split that
       keeps a customer from approving their own quote. */
    table: 'testimonials', key: ['id'], writableBy: ['buyer', 'seller', 'sub_admin', 'super_admin'],
    fields: {
      userId: ['user_id'], role: ['role'], quote: ['quote'], rating: ['rating'],
      status: ['status'], submittedAt: ['submitted_at', D],
      moderatedBy: ['moderated_by'], moderatedAt: ['moderated_at', D],
      moderationNote: ['moderation_note'],
    },
  },
  bankAccounts: {
    table: 'bank_accounts', key: ['id'], writableBy: ['buyer', 'seller', 'finance_admin', 'sub_admin', 'super_admin'],
    fields: {
      userId: ['user_id'], bankName: ['bank_name'], ifsc: ['ifsc'],
      accountHolderName: ['account_holder_name'], last4: ['last4'],
      accountNumberMasked: ['account_number_masked'], status: ['status'],
      rejectionReason: ['rejection_reason'], createdAt: ['created_at', D],
    },
  },
  companyBankAccounts: {
    /* Finance reads/edits these from its own desk; sub_admin/super_admin edit
       them from Financial config (admin/Finance.tsx), the same table both ways. */
    table: 'company_bank_accounts', key: ['id'], writableBy: ['finance_admin', 'sub_admin', 'super_admin'],
    fields: {
      bank: ['bank'], accountNumberMasked: ['account_number_masked'], ifsc: ['ifsc'],
      purpose: ['purpose'],
    },
  },
  depositClaims: {
    table: 'deposit_claims', key: ['id'], writableBy: ['buyer', 'finance_admin', 'sub_admin', 'super_admin'],
    fields: {
      userId: ['user_id'], amount: ['amount'], utr: ['utr'], transferDate: ['transfer_date', D],
      proofFilename: ['proof_filename'], status: ['status'], rejectionReason: ['rejection_reason'],
      createdAt: ['created_at', D], decidedAt: ['decided_at', D], decidedBy: ['decided_by'],
    },
  },
  withdrawalRequests: {
    table: 'withdrawal_requests', key: ['id'], writableBy: ['buyer', 'seller', 'finance_admin', 'sub_admin', 'super_admin'],
    fields: {
      userId: ['user_id'], amount: ['amount'], bankAccountId: ['bank_account_id'], ref: ['ref'],
      status: ['status'], reason: ['reason'], requestedAt: ['requested_at', D],
      decidedAt: ['decided_at', D], reviewedBy: ['reviewed_by'], reviewedAt: ['reviewed_at', D],
      processedBy: ['processed_by'],
    },
  },
  refundRequests: {
    table: 'refund_requests', key: ['id'], writableBy: ['finance_admin', 'sub_admin', 'super_admin', 'ceo'],
    fields: {
      userId: ['user_id'], amount: ['amount'], source: ['source'], reason: ['reason'],
      lotId: ['lot_id'], catalogueId: ['catalogue_id'], disputeId: ['dispute_id'],
      status: ['status'], raisedBy: ['raised_by'], raisedAt: ['raised_at', D],
      decidedBy: ['decided_by'], decidedAt: ['decided_at', D], decisionNote: ['decision_note'],
      processedBy: ['processed_by'], processedAt: ['processed_at', D],
    },
  },
  emdForfeitures: {
    table: 'emd_forfeitures', key: ['id'], writableBy: ['finance_admin', 'ceo', 'sub_admin', 'super_admin'],
    fields: {
      buyerId: ['buyer_id'], lotId: ['lot_id'], catalogueId: ['catalogue_id'], amount: ['amount'],
      reason: ['reason'], status: ['status'], raisedBy: ['raised_by'], raisedAt: ['raised_at', D],
      decidedBy: ['decided_by'], decidedAt: ['decided_at', D], decisionNote: ['decision_note'],
    },
  },
  invoices: {
    table: 'invoices', key: ['id'], writableBy: ['finance_admin', 'super_admin'],
    fields: {
      number: ['number'], kind: ['kind'], partyId: ['party_id'], catalogueId: ['catalogue_id'],
      lotId: ['lot_id'], doId: ['do_id'], issuedAt: ['issued_at', D], issuedBy: ['issued_by'],
      taxable: ['taxable'], gst: ['gst'], tcs: ['tcs'], total: ['total'], status: ['status'],
      supersedesId: ['supersedes_id'], note: ['note'],
    },
  },
  bankStatementLines: {
    table: 'bank_statement_lines', key: ['id'], writableBy: ['finance_admin', 'super_admin'],
    fields: {
      at: ['at', D], accountId: ['account_id'], direction: ['direction'], amount: ['amount'],
      ref: ['ref'], narration: ['narration'], status: ['status'], matchedTo: ['matched_to'],
      matchedKind: ['matched_kind'], matchedBy: ['matched_by'], matchedAt: ['matched_at', D],
      breakNote: ['break_note'], escalated: ['escalated', B],
    },
  },
  commissionSettlements: {
    table: 'commission_settlements', key: ['id'], writableBy: ['seller', 'finance_admin', 'sub_admin', 'super_admin'],
    fields: {
      catalogueId: ['catalogue_id'], sellerId: ['seller_id'], amount: ['amount'], mode: ['mode'],
      at: ['settled_at', D], reference: ['reference'], status: ['status'],
      confirmedBy: ['confirmed_by'], confirmedAt: ['confirmed_at', D], queryNote: ['query_note'],
    },
  },
  ceoApprovals: {
    table: 'ceo_approvals', key: ['id'], writableBy: ['ceo', 'finance_admin', 'auction_manager', 'exec_manager', 'sub_admin', 'super_admin'],
    fields: {
      kind: ['kind'], refId: ['ref_id'], amount: ['amount'], summary: ['summary'],
      reason: ['reason'], requestedBy: ['requested_by'], requestedAt: ['requested_at', D],
      status: ['status'], infoNote: ['info_note'], infoAskedAt: ['info_asked_at', D],
      payload: ['payload', J], decidedBy: ['decided_by'], decidedAt: ['decided_at', D],
      decisionNote: ['decision_note'],
    },
  },
  cancellationRequests: {
    table: 'cancellation_requests', key: ['id'], writableBy: ['auction_manager', 'sub_admin', 'super_admin'],
    fields: {
      catalogueId: ['catalogue_id'], reason: ['reason'], requestedBy: ['requested_by'],
      requestedAt: ['requested_at', D], status: ['status'], decidedBy: ['decided_by'],
      decidedAt: ['decided_at', D], decisionNote: ['decision_note'],
    },
  },
  bidVoidRequests: {
    table: 'bid_void_requests', key: ['id'], writableBy: ['auction_manager', 'sub_admin', 'super_admin'],
    fields: {
      bidId: ['bid_id'], lotId: ['lot_id'], catalogueId: ['catalogue_id'], reason: ['reason'],
      notes: ['notes'], raisedBy: ['raised_by'], raisedAt: ['raised_at', D], stage: ['stage'],
      requestedBy: ['requested_by'], requestedAt: ['requested_at', D], status: ['status'],
      decidedBy: ['decided_by'], decidedAt: ['decided_at', D], decisionNote: ['decision_note'],
    },
  },
  resultConfirmations: {
    table: 'result_confirmations', key: ['catalogueId'], writableBy: ['auction_manager', 'sub_admin', 'super_admin'],
    fields: {
      catalogueId: ['catalogue_id'], confirmedBy: ['confirmed_by'], confirmedAt: ['confirmed_at', D],
      lotsSold: ['lots_sold'], lotsUnsold: ['lots_unsold'], realisation: ['realisation'],
    },
  },
  staReferrals: {
    table: 'sta_referrals', key: ['id'], writableBy: ['auction_manager', 'exec_manager', 'sub_admin', 'super_admin'],
    fields: {
      lotId: ['lot_id'], catalogueId: ['catalogue_id'], note: ['note'],
      referredBy: ['referred_by'], referredAt: ['referred_at', D],
    },
  },
  emdExemptionRequests: {
    table: 'emd_exemption_requests', key: ['id'], writableBy: ['buyer', 'auction_manager', 'sub_admin', 'super_admin'],
    fields: {
      buyerId: ['buyer_id'], catalogueId: ['catalogue_id'], reason: ['reason'], status: ['status'],
      createdAt: ['created_at', D], decidedAt: ['decided_at', D], decidedBy: ['decided_by'],
      rejectionReason: ['rejection_reason'],
    },
  },
  announcements: {
    table: 'announcements', key: ['id'], writableBy: ['auction_manager', 'sub_admin', 'super_admin'],
    fields: {
      scope: ['scope'], catalogueId: ['catalogue_id'], title: ['title'], body: ['body'],
      at: ['at', D], severity: ['severity'],
    },
  },
  auditEvents: {
    table: 'audit_events', key: ['id'], writableBy: ['*'],
    fields: {
      at: ['at', D], actorId: ['actor_id'], action: ['action'], target: ['target'],
      detail: ['detail'], severity: ['severity'],
    },
  },
  inspectionSlots: {
    table: 'inspection_slots', key: ['id'], writableBy: ['buyer', 'exec_manager', 'sub_admin', 'super_admin'],
    fields: {
      catalogueId: ['catalogue_id'], userId: ['user_id'], date: ['slot_date', D],
      window: ['window_label'], persons: ['persons'], status: ['status'], passCode: ['pass_code'],
    },
  },
  demandDrafts: {
    table: 'demand_drafts', key: ['id'], writableBy: ['finance_admin', 'exec_manager', 'sub_admin', 'super_admin'],
    fields: {
      doId: ['do_id'], ddNumber: ['dd_number'], issuingBank: ['issuing_bank'],
      amount: ['amount'], issuedAt: ['issued_at', D], issuedBy: ['issued_by'],
    },
  },
  termsSets: {
    /* exec_manager writes them from the catalogue builder; sub_admin/super_admin
       from Master data — same table both ways. */
    table: 'terms_sets', key: ['id'], writableBy: ['exec_manager', 'sub_admin', 'super_admin'],
    fields: {
      name: ['name'], version: ['version'], general: ['general', J], special: ['special', J],
      lotSpecificNote: ['lot_specific_note'],
    },
  },
  autoBids: {
    table: 'auto_bids', key: ['buyerId', 'lotId'], writableBy: ['buyer'],
    fields: {
      buyerId: ['buyer_id'], lotId: ['lot_id'], maxRate: ['max_rate'], active: ['active', B],
    },
  },
  watchlist: {
    table: 'watchlist', key: ['buyerId', 'catalogueId'], writableBy: ['buyer'],
    fields: { buyerId: ['buyer_id'], catalogueId: ['catalogue_id'] },
  },
  /* Supervisory + platform structure. */
  actionReviews: {
    table: 'action_reviews', key: ['id'], writableBy: ['sub_admin', 'super_admin'],
    fields: {
      eventId: ['event_id'], verdict: ['verdict'], note: ['note'], at: ['at', D],
      byId: ['by_id'], escalatedTo: ['escalated_to'],
    },
  },
  handoverNotes: {
    table: 'handover_notes', key: ['id'], writableBy: ['sub_admin', 'super_admin'],
    fields: { byId: ['by_id'], at: ['at', D], body: ['body'] },
  },
  contentDrafts: {
    table: 'content_drafts', key: ['id'], writableBy: ['sub_admin', 'super_admin', 'ceo'],
    fields: {
      page: ['page'], section: ['section'], authorId: ['author_id'],
      submittedAt: ['submitted_at', D], before: ['before_text'], after: ['after_text'],
      status: ['status'], needsCeo: ['needs_ceo', B], note: ['note'],
      decidedAt: ['decided_at', D], decidedBy: ['decided_by'],
    },
  },
  passwordResets: {
    table: 'password_resets', key: ['id'], writableBy: ['sub_admin', 'super_admin'],
    fields: {
      userId: ['user_id'], mode: ['mode'], password: ['password'], at: ['at', D],
      byId: ['by_id'], consumed: ['consumed', B],
    },
  },
  roleRegistry: {
    table: 'role_registry', key: ['key'], writableBy: ['super_admin'],
    fields: {
      key: ['role_key'], label: ['label'], home: ['home'], builtIn: ['built_in', B],
      status: ['status'], createdAt: ['created_at', D], createdBy: ['created_by'],
      removedAt: ['removed_at', D], removedBy: ['removed_by'], removedReason: ['removed_reason'],
      basedOn: ['based_on'], note: ['note'],
    },
  },
  pageRegistry: {
    /* Shared with the Sub Admin's Page manager — see the roles decision in the
       Content Atlas. Role definitions themselves (roleRegistry, below) stay
       super_admin-only; renaming, hiding or moving a page's tab does not. */
    table: 'page_registry', key: ['id'], writableBy: ['sub_admin', 'super_admin'],
    fields: {
      roleKey: ['role_key'], to: ['destination'], label: ['label'], subLabel: ['sub_label'],
      end: ['is_end', B], locked: ['locked', B], inTop: ['in_top', B], inSub: ['in_sub', B],
      activeMatch: ['active_match', J], hidden: ['hidden', B], order: ['sort_order'],
      builtIn: ['built_in', B], retained: ['retained', B], attachedFrom: ['attached_from'],
      category: ['category'],
    },
  },
  structuralChanges: {
    /* The undo log behind Page manager and Master data — shared with those. */
    table: 'structural_changes', key: ['id'], writableBy: ['sub_admin', 'super_admin'],
    fields: {
      at: ['at', D], byId: ['by_id'], kind: ['kind'], target: ['target'], summary: ['summary'],
      before: ['before_val'], after: ['after_val'], snapshot: ['snapshot', J],
      undoneAt: ['undone_at', D], undoneBy: ['undone_by'],
    },
  },
  /* Master data — shared with the Sub Admin's own screen. */
  masterCategories: {
    table: 'master_categories', key: ['key'], writableBy: ['sub_admin', 'super_admin'],
    fields: {
      key: ['category_key'], label: ['label'], hue: ['hue'], builtIn: ['built_in', B],
      active: ['active', B],
    },
  },
  masterUoms: {
    table: 'master_uoms', key: ['code'], writableBy: ['sub_admin', 'super_admin'],
    fields: {
      code: ['code'], label: ['label'], precision: ['precision_note'],
      builtIn: ['built_in', B], active: ['active', B],
    },
  },
  masterYards: {
    table: 'master_yards', key: ['id'], writableBy: ['sub_admin', 'super_admin'],
    fields: {
      name: ['name'], region: ['region'], address: ['address'], contactName: ['contact_name'],
      contactPhone: ['contact_phone'], builtIn: ['built_in', B], active: ['active', B],
    },
  },
}

/** Convert one camelCase row to its column form, dropping anything unlisted. */
export function toColumns(entityName, row) {
  const entity = ENTITIES[entityName]
  if (!entity) throw new Error(`unknown entity: ${entityName}`)
  const out = {}
  for (const [field, value] of Object.entries(row)) {
    const spec = entity.fields[field]
    if (!spec) continue // not writable — dropped, never passed through
    const [column, type] = spec
    if (value === undefined) continue
    if (value === null) { out[column] = null; continue }
    if (type === J) out[column] = JSON.stringify(value)
    else if (type === B) out[column] = value ? 1 : 0
    else if (type === D) {
      const d = new Date(value)
      out[column] = Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 23).replace('T', ' ')
    } else out[column] = value
  }
  return out
}

/** The key columns for an entity, as {column: value}, from a camelCase row. */
export function keyColumns(entityName, row) {
  const entity = ENTITIES[entityName]
  const out = {}
  for (const field of entity.key) {
    const spec = entity.fields[field]
    /* A key field may not be in `fields` (an immutable surrogate id like
       lots.id). Fall back to the field name itself, which matches the column. */
    const column = spec ? spec[0] : field
    out[column] = row[field]
  }
  return out
}
