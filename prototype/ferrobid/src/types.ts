export type Role = 'guest' | 'buyer' | 'seller' | 'exec' | 'subadmin' | 'superadmin';

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
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'exec' | 'subadmin';
  permissions: Record<string, boolean>;
  active: boolean;
  createdAt: string;
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
}

export interface Auction {
  id: string;
  lotId: string;
  startsAt: number;
  endsAt: number;
  status: 'scheduled' | 'live' | 'closed';
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

export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: 'success' | 'error' | 'info' | 'bid';
}
