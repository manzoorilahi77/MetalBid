import type { LotStatus } from './types';

/** Ordered lifecycle used across boards, trackers and the audit view (WBS 3.4). */
export const LIFECYCLE_ORDER: LotStatus[] = [
  'draft',
  'submitted',
  'under_verification',
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
};

/** Status → badge tint. The tone-* classes are theme-aware and defined once in index.css. */
export const STATUS_TONE: Record<LotStatus, string> = {
  draft: 'tone-slate',
  submitted: 'tone-sky',
  under_verification: 'tone-amber',
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
};

/** Allowed transitions + owning role — the prototype's state machine. */
export const TRANSITIONS: Record<LotStatus, { to: LotStatus[]; owner: string }> = {
  draft: { to: ['submitted'], owner: 'Seller' },
  submitted: { to: ['under_verification'], owner: 'Executive Admin' },
  under_verification: { to: ['approved', 'rejected'], owner: 'Executive Admin' },
  rejected: { to: ['draft'], owner: 'Seller' },
  approved: { to: ['scheduled'], owner: 'Executive Admin' },
  scheduled: { to: ['live'], owner: 'System (start time)' },
  live: { to: ['bidding_closed'], owner: 'System (timer)' },
  bidding_closed: { to: ['won', 'closed'], owner: 'System' },
  won: { to: ['in_settlement'], owner: 'Executive Admin' },
  in_settlement: { to: ['ready_for_pickup'], owner: 'Executive Admin' },
  ready_for_pickup: { to: ['in_logistics'], owner: 'Executive Admin' },
  in_logistics: { to: ['handover_complete'], owner: 'Executive Admin' },
  handover_complete: { to: ['closed'], owner: 'Executive Admin' },
  closed: { to: [], owner: '—' },
};

export function canTransition(from: LotStatus, to: LotStatus): boolean {
  return TRANSITIONS[from]?.to.includes(to) ?? false;
}

/** Index within the happy path (rejected maps next to under_verification). */
export function stageIndex(s: LotStatus): number {
  if (s === 'rejected') return LIFECYCLE_ORDER.indexOf('under_verification');
  return LIFECYCLE_ORDER.indexOf(s);
}
