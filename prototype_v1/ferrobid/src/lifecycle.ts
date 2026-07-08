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

export const STATUS_TONE: Record<LotStatus, string> = {
  draft: 'bg-slate-100 text-slate-600 ring-slate-300',
  submitted: 'bg-sky-50 text-sky-700 ring-sky-200',
  under_verification: 'bg-amber-50 text-amber-700 ring-amber-200',
  rejected: 'bg-red-50 text-red-700 ring-red-200',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  scheduled: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  live: 'bg-ember-50 text-ember-700 ring-ember-200',
  bidding_closed: 'bg-slate-100 text-slate-600 ring-slate-300',
  won: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  in_settlement: 'bg-violet-50 text-violet-700 ring-violet-200',
  ready_for_pickup: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  in_logistics: 'bg-blue-50 text-blue-700 ring-blue-200',
  handover_complete: 'bg-teal-50 text-teal-700 ring-teal-200',
  closed: 'bg-slate-200 text-slate-600 ring-slate-300',
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
