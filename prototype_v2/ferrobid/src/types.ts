/* ---------------------------------------------------------------------------
   ferroBid domain types.
   An Auction is a Catalogue containing many Lots. Buyers shortlist lots,
   fund pre-bid EMD per lot, and bid a rate per unit of measurement.
--------------------------------------------------------------------------- */

export type Role =
  | 'guest'
  | 'buyer'
  | 'seller'
  | 'field_exec'
  | 'exec_manager'
  | 'sub_admin'
  | 'super_admin'

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
  type: 'forward' // English forward auction on rate
  status: CatalogueStatus
  startsAt: string // ISO — rebased to "now" at seed load
  endsAt: string
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
}

export interface Lot {
  id: string
  lotNo: string // "LOT-01"
  catalogueId: string
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
}

export interface LotPhoto {
  id: string
  label: string // "Overview", "Close-up" …
  hue: number // 0-360 — drives the placeholder gradient
}

export type BidType = 'manual' | 'auto' | 'bot'

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
}

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

export type FulfilmentStage =
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
  stage: FulfilmentStage
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
}

/** Per-buyer, per-catalogue shortlist + scoped EMD funding (§9). */
export interface BuyerLotSelection {
  buyerId: string
  catalogueId: string
  lotIds: string[] // shortlisted
  emdFundedLotIds: string[] // subset with EMD locked
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

export interface Dispute {
  id: string
  userId: string
  subject: string
  category: 'payment' | 'quality' | 'quantity' | 'lifting' | 'other'
  lotId?: string
  status: 'open' | 'in_review' | 'resolved'
  createdAt: string
  messages: { from: 'user' | 'support'; body: string; at: string }[]
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
