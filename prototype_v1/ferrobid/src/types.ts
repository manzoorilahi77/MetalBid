export type Role = 'guest' | 'buyer' | 'seller' | 'exec' | 'subadmin' | 'superadmin';

/** Split of the Executive Admin role (WBS §5): field inspection vs desk/fulfilment management. */
export type ExecFunction = 'field' | 'manager';

/** Full lot lifecycle: Draft → Closed (WBS §3) */
export type LotStatus =
  | 'draft'
  | 'submitted'
  | 'under_verification'
  | 'rejected'
  | 'approved'
  | 'scheduled'
  | 'live'
  | 'bidding_closed'
  | 'won'
  | 'in_settlement'
  | 'ready_for_pickup'
  | 'in_logistics'
  | 'handover_complete'
  | 'closed';

export interface User {
  id: string;
  name: string;
  phone: string;
  role: Role;
  kycStatus: 'not_submitted' | 'pending' | 'verified';
  sellerVerified: boolean;
  businessName?: string;
  email?: string;
  joinedAt: string;
  active: boolean;
  standing?: UserStanding;   // risk & trust status (WBS v3.1 F44)
  defaults?: number;         // payment defaults count — feeds auto-suspend rule
  standingReason?: string;
}

/** Scoped permission model (WBS v3.1 §5.1): module × action level × scope × value ceiling */
export type PermLevel = 'hidden' | 'view' | 'act' | 'approve';

export interface ModulePermission {
  level: PermLevel;
  metals: string;   // 'All' | 'Ferrous' | 'Copper' | ...
  region: string;   // 'All' | 'Chennai' | ...
  ceiling: number;  // ₹ value ceiling for actions; 0 = no limit
}

export type ScopedPermissions = Record<string, ModulePermission>;

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'exec' | 'subadmin';
  execFunction?: ExecFunction; // exec admins only — Field Executive Officer vs Executive Manager
  permissions: Record<string, boolean>;
  scoped?: ScopedPermissions;   // sub-admins only — drives console gating
  active: boolean;
  createdAt: string;
}

/** Maker-checker approval request (WBS v3.1 F42) */
export type ApprovalType =
  | 'entity_approve' | 'entity_reject' | 'lot_reject'
  | 'emd_forfeit' | 'auction_publish' | 'auction_pause' | 'bid_flag';

export interface ApprovalRequest {
  id: string;
  type: ApprovalType;
  title: string;
  detail: string;
  refId: string;                 // lot / auction / settlement / bid id the action targets
  amount?: number;
  payload?: Record<string, unknown>; // extra params executed on approval (e.g. auction schedule)
  requestedBy: string;
  requestedRole: string;
  at: string;
  status: 'pending' | 'approved' | 'rejected';
  decidedBy?: string;
  decisionNote?: string;
  decidedAt?: string;
}

/** Sub-Admin work queue task with SLA (WBS v3.1 F45) */
export interface WorkTask {
  id: string;
  title: string;
  module: string;      // ops module key — links task to its screen
  refId: string;
  assignedBy: string;
  dueAt: number;
  status: 'open' | 'done';
}

export type UserStanding = 'good' | 'watchlist' | 'suspended' | 'blacklisted';

/** Buyer/Seller mandatory onboarding KYC (WBS §5 — Account → Profile → Documents → Review). */
export type KycDocType = 'pan' | 'aadhar' | 'photo' | 'gst' | 'address_proof' | 'cancelled_cheque' | 'itr' | 'pcb';
export type KycDocStatus = 'pending' | 'uploaded' | 'verified' | 'rejected';

export interface KycProfile {
  fullName: string;
  email: string;
  phone: string;
  panNumber: string;
  isBusiness: boolean;
  businessName: string;
  gstin: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

export interface Lot {
  id: string;
  title: string;
  metal: string;          // Ferrous / Copper / Aluminium ...
  category: string;       // Scrap / Ingots / Coils ...
  grade: string;
  quantity: string;
  location: string;
  description: string;
  sellerId: string;
  status: LotStatus;
  basePrice: number;
  reservePrice: number;
  emdAmount: number;
  increment: number;
  imageHues: number[];    // gradient placeholder hues for mock images
  createdAt: string;
  rejectReason?: string;
  verification?: {
    checklist: Record<string, boolean>;
    note: string;
    reportUploaded: boolean;
    photosUploaded: boolean;
    decision?: 'verified' | 'flagged' | 'rejected';
    decidedBy?: string;
  };
  auctionId?: string;
  catalogueId?: string;
}

export type EventStatus = 'scheduled' | 'live' | 'closed' | 'cancelled';
export type CatalogueStatus = 'draft' | 'scheduled' | 'live' | 'closed';

/** Scheduled circuit grouping one or more Catalogues (WBS: Auction Event → Catalogue → Lot). */
export interface AuctionEvent {
  id: string;
  name: string;
  description?: string;
  status: EventStatus;
  startsAt: number;
  endsAt: number;
  catalogueIds: string[];
  location?: string;
  coverHues: number[];
  createdAt: string;
}

/** Grouping of Lots within an AuctionEvent, e.g. by metal or session. */
export interface Catalogue {
  id: string;
  eventId: string;
  title: string;
  description?: string;
  lotIds: string[];
  closingAt: number;
  status: CatalogueStatus;
  createdAt: string;
}

export interface Auction {
  id: string;
  lotId: string;
  startsAt: number;
  endsAt: number;
  status: 'scheduled' | 'live' | 'paused' | 'cancelled' | 'closed';
  pausedRemaining?: number;  // ms left on the clock when paused (control tower)
  pauseReason?: string;
  startPrice: number;
  currentBid: number;
  leaderId?: string;
  leaderName?: string;
  increment: number;
  reserve: number;
  emd: number;
  extensions: number;
  bidderCount: number;
}

export interface Bid {
  id: string;
  auctionId: string;
  bidderId: string;
  bidderName: string;
  amount: number;
  at: number;
  auto?: boolean;
  ip: string; // feeds same-IP fraud detection (WBS §6)
}

export interface LedgerEntry {
  id: string;
  type: 'topup' | 'emd_lock' | 'emd_release' | 'emd_forfeit' | 'payment' | 'refund';
  amount: number;
  note: string;
  at: string;
}

export interface EntityRequest {
  id: string;
  userId: string;
  userName: string;
  businessName: string;
  gstin: string;
  pan: string;
  docs: { name: string; type: string }[];
  status: 'pending' | 'approved' | 'rejected' | 'returned';
  note?: string;
  submittedAt: string;
}

export interface Settlement {
  id: string;
  lotId: string;
  auctionId: string;
  winnerId: string;
  winnerName: string;
  amount: number;
  paymentConfirmed: boolean;
  emdHandled: boolean;
  invoiceGenerated: boolean;
}

export interface LogisticsRecord {
  id: string;
  lotId: string;
  pickupDate?: string;
  slot?: string;
  handler?: string;
  status: 'awaiting' | 'scheduled' | 'in_transit' | 'completed';
  checklist: Record<string, boolean>;
  proofUploaded: boolean;
}

export interface AppNotification {
  id: string;
  audience: Role | 'all';
  title: string;
  body: string;
  at: number;
  read: boolean;
  kind: 'lifecycle' | 'bid' | 'wallet' | 'system';
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  postedBy: string;
  at: string;
  pinned?: boolean;
}

export interface AuditEntry {
  id: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  stage: string;
  at: string;
}

/** Subscription/Billing (WBS §5 — plan comparison + simple checkout, buyer & seller). */
export type PlanAudience = 'buyer' | 'seller';

export interface SubscriptionPlan {
  id: string;
  audience: PlanAudience;
  name: string;
  price: number;
  billingCycle: 'monthly' | 'yearly';
  tagline: string;
  features: string[];
  highlight?: boolean;
}

export interface ActiveSubscription {
  planId: string;
  renewsAt: number;
  autoRenew: boolean;
}

export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: 'success' | 'error' | 'info' | 'bid';
}
