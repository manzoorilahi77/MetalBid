import type { LotStatus } from './types';

/** Ordered lifecycle used across boards, trackers and the audit view (WBS 3.4). */
export const LIFECYCLE_ORDER: LotStatus[] = [
  'draft',
  'submitted',
  'under_verification',
  'pending_manager_approval',
  'approved',
  'scheduled',
  'live',
  'bidding_closed',
  'won',
  'in_settlement',
  'ready_for_pickup',
  'in_logistics',
  'handover_complete',
  'closed',
];

export const STATUS_LABEL: Record<LotStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_verification: 'Under Verification',
  pending_manager_approval: 'Pending Manager Approval',
  rejected: 'Rejected',
  approved: 'Approved',
  scheduled: 'Auction Scheduled',
  live: 'Live Auction',
  bidding_closed: 'Bidding Closed',
  won: 'Won',
  in_settlement: 'In Settlement',
  ready_for_pickup: 'Ready for Pickup',
  in_logistics: 'In Logistics',
  handover_complete: 'Handover Complete',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

/** Status → badge tint. The tone-* classes are theme-aware and defined once in index.css. */
export const STATUS_TONE: Record<LotStatus, string> = {
  draft: 'tone-slate',
  submitted: 'tone-sky',
  under_verification: 'tone-amber',
  pending_manager_approval: 'tone-violet',
  rejected: 'tone-red',
  approved: 'tone-emerald',
  scheduled: 'tone-indigo',
  live: 'tone-ember',
  bidding_closed: 'tone-slate',
  won: 'tone-emerald',
  in_settlement: 'tone-violet',
  ready_for_pickup: 'tone-cyan',
  in_logistics: 'tone-blue',
  handover_complete: 'tone-teal',
  closed: 'tone-slate',
  cancelled: 'tone-red',
};

/** Allowed transitions + owning role — the prototype's state machine. */
export const TRANSITIONS: Record<LotStatus, { to: LotStatus[]; owner: string }> = {
  draft: { to: ['submitted'], owner: 'Seller' },
  submitted: { to: ['under_verification'], owner: 'Field Executive Officer' },
  under_verification: { to: ['pending_manager_approval'], owner: 'Field Executive Officer' },
  pending_manager_approval: { to: ['approved', 'rejected'], owner: 'Executive Manager' },
  rejected: { to: ['draft'], owner: 'Seller' },
  approved: { to: ['scheduled'], owner: 'Executive Manager' },
  scheduled: { to: ['live'], owner: 'System (start time)' },
  live: { to: ['bidding_closed'], owner: 'System (timer)' },
  bidding_closed: { to: ['won', 'closed'], owner: 'System' },
  won: { to: ['in_settlement'], owner: 'Executive Manager' },
  in_settlement: { to: ['ready_for_pickup', 'approved', 'cancelled'], owner: 'Executive Manager' },
  ready_for_pickup: { to: ['in_logistics'], owner: 'Executive Manager' },
  in_logistics: { to: ['handover_complete'], owner: 'Executive Manager' },
  handover_complete: { to: ['closed'], owner: 'Executive Manager' },
  closed: { to: [], owner: '—' },
  cancelled: { to: [], owner: '—' },
};

export function canTransition(from: LotStatus, to: LotStatus): boolean {
  return TRANSITIONS[from]?.to.includes(to) ?? false;
}

/** Index within the happy path (rejected maps next to under_verification; cancelled maps next to in_settlement). */
export function stageIndex(s: LotStatus): number {
  if (s === 'rejected') return LIFECYCLE_ORDER.indexOf('under_verification');
  if (s === 'cancelled') return LIFECYCLE_ORDER.indexOf('in_settlement');
  return LIFECYCLE_ORDER.indexOf(s);
}
