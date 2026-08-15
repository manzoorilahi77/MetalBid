/* ---------------------------------------------------------------------------
   ferroBid domain types.
   An Auction is a Catalogue containing many Lots. Buyers shortlist lots,
   fund pre-bid EMD per lot, and bid a rate per unit of measurement.
--------------------------------------------------------------------------- */

export type Role =
  | 'guest'
  | 'guest1' // isolated standalone public homepage app (own router, at /home)
  | 'guest2' // redesigned public/marketing site, anonymous like 'guest'
  | 'buyer'
  | 'seller'
  | 'field_exec'
  | 'exec_manager' // Operation Manager — pre-auction pipeline through to handover
  | 'auction_manager' // owns the running auction: publish → admit → run → close
  | 'finance_admin' // Finance Administrator — money in → held → out → records
  | 'sub_admin'
  | 'super_admin'
  | 'ceo' // CEO / MD — reads the business, signs the decisions above threshold

export type CatalogueStatus = 'draft' | 'upcoming' | 'live' | 'closed'

export type LotStatus =
  | 'pending_inspection'
  | 'inspected'
  | 'approved'
  | 'live'
  | 'sold'
  | 'sta' // subject to approval — H1 below reserve
  | 'unsold'
  | 'flagged'
  | 'rejected'

export type Uom = 'MT' | 'KG' | 'PCS' | 'LOT'

export type MetalCategory =
  | 'assets'
  | 'scrap'
  | 'flat-products'
  | 'long-products'
  | 'melting-products'
  | 'coal'
  | 'chemicals'
  | 'minerals'
  | 'ferro-alloys'

export interface CatalogueDocument {
  id: string
  name: string
  type: 'pdf' | 'xlsx' | 'jpg' | 'zip'
  size: string
}

export interface Catalogue {
  id: string
  code: string // e.g. AUC-2418
  title: string
  sellerId: string
  /** 'forward' = live ascending-price English auction. 'tender' = sealed-bid —
   *  one confidential offer per bidder, no visible competing price. */
  type: 'forward' | 'tender'
  status: CatalogueStatus
  startsAt: string // ISO — rebased to "now" at seed load
  endsAt: string
  /** Pre-bid EMD funding cut-off — 1–2 days ahead of `startsAt`. Funding is
   *  refused between this instant and go-live (see src/lib/emd.ts). */
  emdDeadline: string
  /** EMD funding/shortlisting opens at this instant, ahead of `emdDeadline`.
   *  Optional — catalogues without it are treated as always-open (see
   *  `emdOpensAtMs` in src/lib/emd.ts), which is every catalogue except the
   *  handful seeded far enough out to demo the "not open yet" phase. */
  emdOpensAt?: string
  inspectionFrom: string
  inspectionTo: string
  inspectionHours: string // e.g. "10:00–16:00 IST"
  inspectionContact: { name: string; phone: string; role: string }
  yardName: string
  yardAddress: string
  region: string // e.g. "Jamshedpur, JH"
  antiSnipeMinutes: number // bid in last N min extends by N min
  bidValidityDays: number
  lotIds: string[]
  documents: CatalogueDocument[]
  termsSetId: string
  description: string
  assignedFieldExecId: string | null // exec_manager sets this when assigning a draft catalogue for field inspection
}

export interface Lot {
  id: string
  lotNo: string // "LOT-01"
  catalogueId: string
  /** Who submitted the material. Set on the lot itself rather than read off the
   *  catalogue, because a lot exists — and has to be findable by seller in the
   *  catalogue builder — long before any catalogue holds it. */
  sellerId: string
  metal: string // "MS", "SS 304", "Copper" …
  category: MetalCategory
  grade: string
  indicativeQty: number
  uom: Uom
  yard: string
  description: string
  startRate: number // ₹ per UOM
  increment: number
  reserveRate: number // hidden from buyers
  preBidEmd: number // ₹ absolute per lot
  saleBasis: 'as-is-where-is'
  hazardous: boolean
  photos: LotPhoto[]
  inspectionReportId: string | null
  status: LotStatus
  // live-auction state (engine-managed)
  currentRate: number | null
  leadingBidderId: string | null
  bidCount: number
  endsAt: string // per-lot close; extends on anti-snipe
  extensions: number
  resultH1Rate?: number | null
  knownSeller: boolean // seeded trust flag — prototype-level, no real seller-identity link yet
  inspectionWaived: boolean // true if accepted by bypass instead of a real field inspection
  waivedBy: string | null // exec_manager user id
  waivedReason: string | null
  waivedAt: string | null // ISO timestamp
  /** What the catalogue builder changed on this lot from what the seller
   *  submitted. Bulk-setting an increment or an EMD across a catalogue is a
   *  change to the seller's own terms, so the original is kept beside the new
   *  value rather than overwritten, and the seller is told. */
  overrides?: LotOverride[]
  /** Seller's post-sale call on the cleared price — only meaningful once
   *  `resultH1Rate` exists (status 'sold' or 'sta'). null/undefined = undecided. */
  sellerDecision?: 'accepted' | 'rejected' | null
}

/** One field the platform changed from the seller's submitted value, kept on
 *  the lot for the life of the sale. */
export interface LotOverride {
  field: 'increment' | 'preBidEmd' | 'uom'
  label: string
  from: string
  to: string
  by: string // user id
  at: string
  catalogueCode: string
}

export interface LotPhoto {
  id: string
  label: string // "Overview", "Close-up" …
  hue: number // 0-360 — drives the placeholder gradient
}

export type BidType = 'manual' | 'auto' | 'bot' | 'tender'

export interface Bid {
  id: string
  lotId: string
  catalogueId: string
  bidderId: string
  rate: number
  at: string
  type: BidType
  status: 'valid' | 'void'
}

export type KycStatus = 'none' | 'pending' | 'verified' | 'rejected'
export type Standing = 'good' | 'watchlist' | 'defaulter'

export interface User {
  id: string
  name: string
  firm: string
  phone: string
  email: string
  role: Role
  kycStatus: KycStatus
  sellerVerified: boolean
  standing: Standing
  city: string
  gstin: string
  avatarHue: number
  joinedAt: string
  blacklistReason?: string
  /** Permanent bidder identity assigned once, at account creation, for role 'buyer'
   *  only — never reassigned or reused. This is the ID shown in the bid room / bid
   *  ladder in place of the buyer's real name, and the only identifier a seller is
   *  ever shown for who won a lot. null for non-buyer accounts. */
  bidderId: string | null
  /** Permanent seller identity assigned once, at account creation, for role 'seller'
   *  only — never reassigned or reused. null for non-seller accounts. */
  sellerId: string | null
  /** Whether the account can sign in. Accounts are never deleted — removing a
   *  role suspends everyone holding it, a ban closes it — so that the history
   *  behind every decision stays readable. Absent means 'active'. */
  accountStatus?: AccountStatus
  /** Sign-in identity for staff accounts created by a Super Admin. */
  username?: string
  /** Last time this account did anything, for the Sub Admin roster. */
  lastActiveAt?: string
}

export type AccountStatus = 'active' | 'disabled' | 'suspended' | 'banned'

export type LedgerType =
  | 'topup'
  | 'withdraw'
  | 'emd_lock'
  | 'emd_release'
  | 'emd_forfeit'
  | 'payment'
  | 'refund'

export interface LedgerEntry {
  id: string
  at: string
  type: LedgerType
  amount: number // positive = credit to available balance
  ref: string // UTR / txn ref
  lotId?: string
  catalogueId?: string
  note: string
}

export interface Wallet {
  userId: string
  balance: number // available
  emdLocked: number
  ledger: LedgerEntry[]
}

/* --------------------------- SmartPay (§ wallet) --------------------------- */

export interface BankAccount {
  id: string
  userId: string
  bankName: string
  ifsc: string
  accountHolderName: string
  last4: string // only the last 4 digits are ever persisted
  accountNumberMasked: string // e.g. "•••• •••• 1234" — display-ready, never the full number
  status: 'pending' | 'verified' | 'rejected'
  rejectionReason?: string
  createdAt: string
}

export interface DepositClaim {
  id: string
  userId: string
  amount: number
  utr: string // buyer-supplied bank reference / UTR
  transferDate: string
  proofFilename?: string
  status: 'submitted' | 'approved' | 'rejected'
  rejectionReason?: string
  createdAt: string
  decidedAt?: string
  decidedBy?: string
}

export interface WithdrawalRequest {
  id: string
  userId: string
  amount: number
  bankAccountId: string
  ref: string
  status: 'requested' | 'under_review' | 'processed' | 'failed' | 'cancelled'
  reason?: string
  requestedAt: string
  decidedAt?: string
  /** Maker–checker. The Finance user who *reviewed* the request into processing;
   *  above `withdrawalSecondSignatureFrom` a different user must process it. */
  reviewedBy?: string
  reviewedAt?: string
  /** The Finance user who released the payment. Never the reviewer above the
   *  configured threshold — the audit names both. */
  processedBy?: string
}

export interface CompanyBankAccount {
  id: string
  bank: string
  accountNumberMasked: string
  ifsc: string
  purpose: string
}

export interface WithdrawalWindowConfig {
  days: number[] // 0=Sun … 6=Sat, IST calendar day
  startHour: number
  startMinute: number
  endHour: number
  endMinute: number // IST, e.g. 11:00–14:00
}

export interface InspectionChecklistItem {
  item: string
  ok: boolean
}

export interface InspectionReport {
  id: string
  lotId: string
  inspectorId: string
  date: string
  measuredQty: number
  uom: Uom
  condition: 'good' | 'fair' | 'mixed' | 'poor'
  notes: string
  checklist: InspectionChecklistItem[]
  photoCount: number
  status: 'pending' | 'verified' | 'flagged' | 'rejected'
}

export type NotificationKind =
  | 'lifecycle' // catalogue live / closing / closed
  | 'bid' // outbid, won, lost
  | 'wallet' // topup, EMD lock/release
  | 'system' // KYC, announcements, disputes

export interface AppNotification {
  id: string
  userId: string | null // null = broadcast
  kind: NotificationKind
  title: string
  body: string
  at: string
  read: boolean
  href?: string
}

export interface TermsSet {
  id: string
  name: string
  version: string
  general: string[]
  special: string[]
  lotSpecificNote: string
}

export type AuctionStatusStage =
  | 'payment_pending'
  | 'dd_issued'
  | 'lifting_scheduled'
  | 'lifted'
  | 'completed'

export interface DemandDraft {
  id: string
  doId: string
  ddNumber: string
  issuingBank: string
  amount: number
  issuedAt: string
  issuedBy: string
}

export interface LiftingChecklistItem {
  key: 'vehicle_at_weighbridge' | 'loading_complete' | 'gross_weighment'
  label: string
  done: boolean
  at?: string
}

export interface DeliveryOrder {
  id: string
  lotId: string
  catalogueId: string
  buyerId: string
  stage: AuctionStatusStage
  h1Rate: number
  awardedQty: number
  uom: Uom
  materialValue: number
  gstAmount: number
  tcsAmount: number
  paidAmount: number
  liftingBy: string
  createdAt: string
  ddId?: string
  liftingChecklist: LiftingChecklistItem[]
  weighedQty?: number
  /** Who put the gross weighment on the record, and when. The figure decides the
   *  final invoice and any shortfall refund, so a buyer's own reading is a
   *  declaration — Operations has to witness it before the handover can close. */
  weighedById?: string
  weighedAt?: string
  /** Operations' sign-off that the material actually left the yard against the
   *  weighment-final quantity. The last operational act on a sale — until it is
   *  recorded, the delivery stays open however complete it looks. */
  handoverConfirmedAt?: string
  handoverConfirmedBy?: string
  handoverNote?: string
}

/** Per-buyer, per-catalogue shortlist + scoped EMD funding (§9). */
export interface BuyerLotSelection {
  buyerId: string
  catalogueId: string
  lotIds: string[] // shortlisted
  emdFundedLotIds: string[] // subset with EMD locked
}

/** Catalogue-level "interested" marker — separate from BuyerLotSelection's
 *  per-lot shortlist. A buyer can watchlist a catalogue with no lots starred. */
export interface WatchlistEntry {
  buyerId: string
  catalogueId: string
}

/** Buyer request to reopen pre-bid EMD funding after the deadline passed —
 *  reviewed by a sub-admin. Catalogue-scoped, since `emdWindowClosed` gates
 *  the whole catalogue rather than individual lots. */
export type EmdExemptionStatus = 'pending' | 'approved' | 'rejected'

export interface EmdExemptionRequest {
  id: string
  buyerId: string
  catalogueId: string
  reason: string
  status: EmdExemptionStatus
  createdAt: string
  decidedAt?: string
  decidedBy?: string
  rejectionReason?: string
}

export interface AutoBidSetting {
  buyerId: string
  lotId: string
  maxRate: number
  active: boolean
}

export interface Announcement {
  id: string
  scope: 'platform' | 'catalogue'
  catalogueId?: string
  title: string
  body: string
  at: string
  severity: 'info' | 'warning' | 'critical'
}

/** How a dispute ended. `refund_due` is the one outcome that does not close it
 *  on its own — the money side belongs to Finance, and the ticket stays visible
 *  to the customer until Finance has actually paid it. */
export type DisputeOutcome = 'upheld' | 'declined' | 'refund_due' | 'goodwill'

export interface Dispute {
  id: string
  userId: string
  subject: string
  category: 'payment' | 'quality' | 'quantity' | 'lifting' | 'other'
  lotId?: string
  status: 'open' | 'in_review' | 'resolved'
  createdAt: string
  messages: { from: 'user' | 'support'; body: string; at: string }[]
  /** The Sub Admin who picked the ticket up. Work on this desk is divided by
   *  assignment, not by capability, so this is who — not what they may do. */
  assignedToId?: string
  outcome?: DisputeOutcome
  resolution?: string
  resolvedAt?: string
  resolvedById?: string
  /** Raised against this ticket when the outcome owes the customer money.
   *  Finance approves and pays it; the Sub Admin never moves the money. */
  refundId?: string
}

/** A Sub Admin's supervisory verdict on something an operational role already
 *  did. Not a gate: the functional role acts first and it takes effect
 *  immediately — this is the review after the fact, held against the audit
 *  entry that recorded it.
 *
 *  `reversed` never undoes the original action here. Reversal of a bid, a
 *  publish or a payment belongs to whoever owns that lever; what this records
 *  is the Sub Admin's finding, and who it was handed to. */
export type ActionVerdict = 'confirmed' | 'questioned' | 'reversed'

export interface ActionReview {
  id: string
  /** The audit event being reviewed. */
  eventId: string
  verdict: ActionVerdict
  note: string
  at: string
  byId: string
  /** Set when the finding had to be handed to a role that holds the lever —
   *  Super Admin for a void or a ban, CEO above a threshold. */
  escalatedTo?: Role
}

/** A shift note left on the ops console, read by whoever comes on next. */
export interface HandoverNote {
  id: string
  byId: string
  at: string
  body: string
}

/** Seller's commission settlement for one auction — recorded once the seller
 *  pays ferroBid's commission (by transfer) or has it netted out of the EMD.
 *  A catalogue with sold/STA lots is only "done" (History) once every such
 *  lot has a decision and, if commission is owed, a matching record here. */
export interface CommissionSettlement {
  id: string
  catalogueId: string
  sellerId: string
  amount: number
  mode: 'transfer' | 'emd'
  at: string
  /** Bank reference the seller quoted on a transfer. EMD-netted settlements
   *  carry the internal ledger reference instead. */
  reference?: string
  /** Finance's side of the same record. 'recorded' = the seller says they paid;
   *  'confirmed' = Finance matched it against the bank; 'queried' = the
   *  reference did not match, and the auction stays in Pending settlement. */
  status?: 'recorded' | 'confirmed' | 'queried'
  confirmedBy?: string
  confirmedAt?: string
  queryNote?: string
}

export interface AuditEvent {
  id: string
  at: string
  actorId: string
  action: string
  target: string
  detail: string
  severity: 'info' | 'warning' | 'critical'
}

export interface InspectionSlot {
  id: string
  catalogueId: string
  userId: string
  date: string
  window: string
  persons: number
  status: 'booked' | 'attended' | 'cancelled'
  passCode: string
}

/* ------------------------- auction-floor escalations -------------------------
   Two decisions are deliberately out of the Auction Manager's hands: cancelling
   a live sale, and voiding a bid. Both leave this workspace as a *request* with
   evidence attached, and only a Super Admin can close them. Modelling them as
   records rather than messages is what makes the escalation have a destination
   — see the role architecture, Part 8. */

export type EscalationStatus = 'pending' | 'approved' | 'rejected'

/** Auction Manager · Sub Admin → Super Admin. Cancelling voids every open lot
 *  and releases all locked EMD, so it is never executed by the requester. */
export interface CancellationRequest {
  id: string
  catalogueId: string
  reason: string
  requestedBy: string
  requestedAt: string
  status: EscalationStatus
  decidedBy?: string
  decidedAt?: string
  decisionNote?: string
}

/** Surveillance flags a bid → the Auction Manager escalates it as a void
 *  request → a Super Admin voids it or lets it stand. `stage` tracks which of
 *  those two hand-offs the record has reached. */
export interface BidVoidRequest {
  id: string
  bidId: string
  lotId: string
  catalogueId: string
  reason: string
  notes?: string
  /** Who put the bid on the record — surveillance, or the Auction Manager. */
  raisedBy: string
  raisedAt: string
  stage: 'flagged' | 'requested'
  requestedBy?: string
  requestedAt?: string
  status: EscalationStatus
  decidedBy?: string
  decidedAt?: string
  decisionNote?: string
}

/** The Auction Manager's sign-off that a closed catalogue's outcomes are
 *  correct — the hand-off that releases the seller's accept/reject step. */
export interface ResultConfirmation {
  catalogueId: string
  confirmedBy: string
  confirmedAt: string
  lotsSold: number
  lotsUnsold: number
  realisation: number
}

/** A below-reserve (STA) lot passed to Operations for a commercial call. The
 *  Auction Manager may never accept or reject a price themselves. */
export interface StaReferral {
  id: string
  lotId: string
  catalogueId: string
  note: string
  referredBy: string
  referredAt: string
}

/* ============================ Finance workspace ============================
   Money in → money held → money out → the records that prove it. Every record
   below is owned by the Finance Administrator; other roles read them but never
   write them. Two rules shape the shapes here:

   · Anything that *takes* money away from a customer (a forfeiture, a refusal
     to refund) is a person's decision, never an automatic one — so it exists as
     a record with a typed reason and a named decider, not as a side-effect.
   · Anything above a configured rupee threshold leaves Finance as a request for
     the CEO. The requester keeps visibility; the item never vanishes.
--------------------------------------------------------------------------- */

/** Platform-wide money rules. Owned by Super Admin (Financial config), read by
 *  Finance, the seller Settlement page and every tax/commission calculation —
 *  so a rate is stated once and shown many times, never re-typed. */
export interface FinanceConfig {
  /* EMD sizing */
  emdPct: number
  emdMin: number
  emdCap: number
  emdReleaseHours: number
  /* taxes */
  gstPct: number
  tcsPct: number
  /* payment terms */
  bidValidityDays: number
  paymentWindowDays: number
  groundRentPerDayPerMt: number
  /* platform income */
  buyerPremiumPct: number
  /** Commission on the seller's upside over their own reserve, in %. */
  sellerCommissionPct: number
  listingFeePerLot: number
  /* CEO sign-off thresholds, in ₹ */
  ceoForfeitureFrom: number
  ceoRefundFrom: number
  ceoPublishValueFrom: number
  /** Second Finance user mandatory on withdrawals at or above this (₹).
   *  Below it one user may do both steps — the audit still names them twice. */
  withdrawalSecondSignatureFrom: number
}

export type RefundSource = 'cancellation' | 'weighment_shortfall' | 'dispute' | 'overpayment'

/** Money deliberately returned to a customer, outside the automatic EMD release.
 *  Raised by Finance, signed by the CEO above threshold, then processed — three
 *  distinct states, because approving a refund and actually paying it are not
 *  the same act. */
export interface RefundRequest {
  id: string
  userId: string
  amount: number
  source: RefundSource
  reason: string
  lotId?: string
  catalogueId?: string
  disputeId?: string
  status: 'pending' | 'awaiting_ceo' | 'approved' | 'processed' | 'rejected'
  raisedBy: string
  raisedAt: string
  decidedBy?: string
  decidedAt?: string
  decisionNote?: string
  processedBy?: string
  processedAt?: string
}

/** EMD taken from a buyer who breached the payment window. Never automatic —
 *  releasing money is automatic, taking it never is. */
export interface EmdForfeiture {
  id: string
  buyerId: string
  lotId: string
  catalogueId: string
  amount: number
  reason: string
  status: 'awaiting_ceo' | 'applied' | 'waived'
  raisedBy: string
  raisedAt: string
  decidedBy?: string
  decidedAt?: string
  decisionNote?: string
}

/** A tax document issued to one side of a sale. Numbers are generated, never
 *  typed; a correction supersedes rather than overwrites, so the original stays
 *  on the record. */
export interface Invoice {
  id: string
  number: string // FB/INV/26/0001
  kind: 'buyer_invoice' | 'commission_receipt'
  partyId: string
  catalogueId: string
  lotId?: string
  doId?: string
  issuedAt: string
  issuedBy: string
  taxable: number
  gst: number
  tcs: number
  total: number
  status: 'issued' | 'superseded' | 'cancelled'
  /** Set on a reissue — points at the document this one replaces. */
  supersedesId?: string
  note?: string
}

/** One line off the company bank statement, waiting to be matched against a
 *  platform record. The weakest control in the money flow is a deposit approved
 *  on a buyer-typed reference with no bank credit behind it; this is what closes
 *  that gap. */
export interface BankStatementLine {
  id: string
  at: string
  accountId: string // CompanyBankAccount.id
  direction: 'credit' | 'debit'
  amount: number
  ref: string // UTR / instrument reference
  narration: string
  status: 'unmatched' | 'matched' | 'break'
  /** What it was matched to — a deposit claim, withdrawal or commission id. */
  matchedTo?: string
  matchedKind?: 'deposit' | 'withdrawal' | 'commission' | 'payment'
  matchedBy?: string
  matchedAt?: string
  breakNote?: string
  escalated?: boolean
}

/** Anything above a CEO threshold leaves the requesting desk as one of these.
 *  It is the CEO's only inbox — "What needs my signature" — and it is also
 *  visible to Finance and the Super Admin as "awaiting sign-off", so nothing
 *  ever vanishes from the desk that raised it. */
export interface CeoApprovalRequest {
  id: string
  kind: CeoApprovalKind
  /** The record this decision is about — a forfeiture, refund, catalogue,
   *  account or, for a fee change, the configuration itself. */
  refId: string
  amount: number
  summary: string
  reason: string
  requestedBy: string
  requestedAt: string
  /** 'info_requested' is still an open item: the CEO has asked the requester a
   *  question and the request stays in the queue until it is signed or refused. */
  status: 'pending' | 'approved' | 'refused' | 'info_requested'
  /** What the CEO asked for, and when. Shown to the requesting desk verbatim. */
  infoNote?: string
  infoAskedAt?: string
  /** The change a signature would apply, where approving *is* the change —
   *  today only a fee or commission edit, which is held rather than saved. */
  payload?: Partial<FinanceConfig>
  decidedBy?: string
  decidedAt?: string
  decisionNote?: string
}

export type CeoApprovalKind =
  | 'emd_forfeiture'
  | 'refund'
  | 'fee_change'
  | 'auction_publish'
  | 'permanent_ban'
  | 'super_admin_account'
  /** Pricing and legal copy — Part 8: a Sub Admin drafts it, we publish it, and
   *  the CEO signs the two categories that commit the company in public. */
  | 'content_publish'

/** The CEO hands the signature queue to a named person until a set date —
 *  the only way an approval can be signed by anyone else. One at a time. */
export interface CeoDelegation {
  toUserId: string
  /** ISO date (yyyy-mm-dd). The delegation lapses on its own at end of day. */
  until: string
  note?: string
  setBy: string
  setAt: string
}

/* ========================= Super Admin — the platform ======================
   Our support and recovery role. Everything below changes the *shape* of the
   platform rather than its business data, and that distinction is the whole
   safety model: a role, a menu entry, an account or a page of copy can be
   changed and rolled back instantly, while an auction, a bid, a payment and an
   audit entry never can.
--------------------------------------------------------------------------- */

/** A role that exists on the platform. Built-in roles are the ones the app
 *  ships with; added and duplicated roles are created here at runtime. A
 *  removed role is kept on the record with its accounts suspended — never
 *  deleted — so it can be restored exactly as it was. */
export interface RoleDef {
  key: string
  label: string
  /** Landing route. A duplicated role starts on its source role's home. */
  home: string
  builtIn: boolean
  status: 'active' | 'removed'
  createdAt: string
  createdBy?: string
  removedAt?: string
  removedBy?: string
  removedReason?: string
  /** The role this one was duplicated from, if any. */
  basedOn?: string
  note?: string
}

/** One entry in one role's menu. The registry of these *is* the navigation —
 *  Chrome and the sub-nav render it, so a rename or a reorder made in Page
 *  manager is live everywhere the moment it is saved. */
export interface PageDef {
  id: string
  roleKey: string
  to: string
  label: string
  subLabel?: string
  end?: boolean
  locked?: boolean
  inTop: boolean
  inSub: boolean
  activeMatch?: string[]
  hidden: boolean
  order: number
  builtIn: boolean
  /** An audit or record surface this role must retain — cannot be hidden or
   *  detached however the menu is rearranged. */
  retained?: boolean
  /** Set when this entry was attached to a role it did not ship with. */
  attachedFrom?: string
  /** Splits a long menu into two levels — the category shows on the top bar and
   *  its pages fill the strip below. Roles whose menu is small enough to read at
   *  a glance leave it unset and render one flat strip; the operations roles
   *  group theirs, so eighteen tabs become three headings of six. */
  category?: string
}

export type StructuralChangeKind =
  | 'role.add' | 'role.remove' | 'role.duplicate' | 'role.restore'
  | 'page.rename' | 'page.visibility' | 'page.reorder' | 'page.attach' | 'page.detach' | 'page.add'
  | 'account.create' | 'account.status' | 'account.password_reset' | 'account.edit'
  | 'config.update'
  | 'content.publish' | 'content.return'
  | 'master.add' | 'master.edit' | 'master.deactivate' | 'master.terms_version'
  | 'structure.rollback'

/** Every structural change, in time order, with what it looked like before and
 *  after. Role and page changes carry a full snapshot of the structure as it
 *  stood *before* them, which is what makes "undo this change" and "restore to
 *  this point" exact rather than approximate. */
export interface StructuralChange {
  id: string
  at: string
  byId: string
  kind: StructuralChangeKind
  target: string
  summary: string
  before: string | null
  after: string | null
  /** The platform's shape immediately before this change was applied — what
   *  makes "undo this change" exact rather than approximate. Absent on the
   *  changes that are recorded but deliberately not reversible from here. */
  snapshot?: StructureSnapshot
  undoneAt?: string
  undoneBy?: string
}

/** A password issued by support on someone's behalf. Shown once, then the user
 *  is prompted to keep it or set their own at next sign-in. */
export interface PasswordReset {
  id: string
  userId: string
  mode: 'auto' | 'manual'
  password: string
  at: string
  byId: string
  /** True once the user has signed in and made their keep-or-change choice. */
  consumed: boolean
}

export type ContentStatus = 'submitted' | 'published' | 'returned'

/** Copy drafted by a Sub Admin, published by us. Nothing a content editor
 *  writes is public until someone presses Publish — and no number ever comes
 *  from here: auction figures come from the auction system, money figures from
 *  finance. */
export interface ContentDraft {
  id: string
  page: string
  section: string
  authorId: string
  submittedAt: string
  before: string
  after: string
  status: ContentStatus
  /** Pricing and legal copy needs the CEO as well as us. */
  needsCeo: boolean
  note?: string
  decidedAt?: string
  decidedBy?: string
}

/** Everything an undo puts back. Roles and menus, the vocabularies catalogues
 *  are built from, and the copy on the public site — all of it re-creatable
 *  from a snapshot without touching a single auction, bid, payment or audit
 *  entry, which is the whole reason rollback here is safe. */
export interface StructureSnapshot {
  roles: RoleDef[]
  pages: PageDef[]
  categories: MasterCategory[]
  uoms: MasterUom[]
  yards: MasterYard[]
  drafts: ContentDraft[]
}

export interface MasterCategory { key: string; label: string; hue: number; builtIn: boolean; active: boolean }
export interface MasterUom { code: string; label: string; precision: string; builtIn: boolean; active: boolean }
export interface MasterYard {
  id: string; name: string; region: string; address: string
  contactName: string; contactPhone: string; builtIn: boolean; active: boolean
}
