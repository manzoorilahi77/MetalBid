/* ---------------------------------------------------------------------------
   Phase 28's shared lot-status writer table — the single source of truth for
   who may call each of the nine discretionary lot-status writers and which
   lot statuses each accepts as a starting point. Built from Step 1's
   enumeration, not invented: every role set and every status list here is
   copied from the writer's own pre-existing guard, unchanged.

   Two dimensions only — role and source status. What each writer targets
   (target statuses) is listed for reference; it is still decided by the
   writer's own logic (caller input, catalogue state), not looked up here.

   Four writers are intentionally 'any': decideLot, waiveInspection,
   submitInspection and publishCatalogue never gated on the lot's current
   status, confirmed by Step 1's audit as existing design (re-inspection and
   re-decision are legitimate regardless of where a lot currently sits), not
   an oversight to "fix" by narrowing it here.

   publishDraftCatalogue's real precondition ("every lot in the catalogue is
   'approved'") is listed for documentation, but is deliberately NOT routed
   through checkLotWriterSourceStatus below: it is a multi-lot, count-and-
   pluralize check ("3 lots still need approval"), a different shape from the
   other writers' single-lot check, and forcing it through the shared
   single-lot helper would either lose that wording or require bloating the
   helper for one caller. Its status logic stays local to catalogue.ts.

   returnRefusedLotToPipeline is listed as 'any' on status: its real
   precondition is sellerDecision === 'rejected' (plus the catalogue being
   closed), not lot.status at all — see lotResolution.ts. Marking it
   status-restrictive here would misrepresent what the writer actually checks.
--------------------------------------------------------------------------- */
import { FIELD_INSPECTION_ROLES, LOT_GATE_ROLES, PUBLISH_ROLES } from '../store/constants'
import { checkRole } from './authorization'
import type { LotStatus, Role } from '../types'

export type LotWriterKey =
  | 'submitInspection' | 'decideLot' | 'waiveInspection' | 'publishCatalogue'
  | 'publishDraftCatalogue' | 'resolveFlaggedLot' | 'approveStaSale' | 'markStaUnsold' | 'returnRefusedLotToPipeline'

export interface LotWriterRule {
  roles: Role[]
  roleError: string
  /** 'any' = every current lot status is a valid starting point for this
   *  writer. A list names the only statuses it accepts — anything else is
   *  refused with statusError. */
  sourceStatus: 'any' | LotStatus[]
  /** Required whenever sourceStatus is a list; unused for 'any'. */
  statusError?: string
  /** Every status this writer can move a lot to, across all its branches —
   *  reference only, not enforced here. */
  targetStatus: LotStatus[]
}

export const LOT_WRITER_RULES: Record<LotWriterKey, LotWriterRule> = {
  submitInspection: {
    roles: FIELD_INSPECTION_ROLES,
    roleError: 'Only a Field Executive, Operations or a Sub Admin files an inspection',
    sourceStatus: 'any',
    targetStatus: ['inspected', 'flagged', 'rejected'],
  },
  decideLot: {
    roles: LOT_GATE_ROLES,
    roleError: 'Only Operations or a Sub Admin decides a lot',
    sourceStatus: 'any',
    targetStatus: ['approved', 'flagged', 'rejected'],
  },
  waiveInspection: {
    roles: LOT_GATE_ROLES,
    roleError: 'Only Operations or a Sub Admin may bypass an inspection',
    sourceStatus: 'any',
    targetStatus: ['approved'],
  },
  publishCatalogue: {
    roles: LOT_GATE_ROLES,
    roleError: 'Only Operations or a Sub Admin builds or publishes a catalogue',
    sourceStatus: 'any',
    targetStatus: ['live', 'approved', 'pending_inspection'],
  },
  publishDraftCatalogue: {
    roles: PUBLISH_ROLES,
    roleError: 'Not permitted for this role',
    sourceStatus: ['approved'], // documentation only — see file header; enforced per-catalogue in catalogue.ts
    targetStatus: ['live', 'approved'],
  },
  resolveFlaggedLot: {
    roles: LOT_GATE_ROLES,
    roleError: 'Only Operations or a Sub Admin resolves a flagged lot',
    sourceStatus: ['flagged'],
    statusError: 'Only a flagged lot can be returned to the inspected queue',
    targetStatus: ['inspected'],
  },
  approveStaSale: {
    roles: LOT_GATE_ROLES,
    roleError: 'Only Operations or a Sub Admin decides an STA lot',
    sourceStatus: ['sta'],
    statusError: 'Only a lot cleared below reserve (STA) can be decided here',
    targetStatus: ['sold'],
  },
  markStaUnsold: {
    roles: LOT_GATE_ROLES,
    roleError: 'Only Operations or a Sub Admin decides an STA lot',
    sourceStatus: ['sta'],
    statusError: 'Only a lot cleared below reserve (STA) can be decided here',
    targetStatus: ['unsold'],
  },
  returnRefusedLotToPipeline: {
    roles: LOT_GATE_ROLES,
    roleError: 'Only Operations or a Sub Admin returns a lot to the pipeline',
    sourceStatus: 'any', // real precondition is sellerDecision, not status — see file header
    targetStatus: ['unsold'],
  },
}

/** Returns the role error for this writer, or null if the role is allowed.
 *  Delegates to the same shared primitive every other role check in the
 *  codebase now uses (application/authorization.ts) — this table adds the
 *  status dimension lot-status writers need on top of it, not a second,
 *  parallel way of comparing a role against a list. */
export function checkLotWriterRole(key: LotWriterKey, role: Role): string | null {
  const rule = LOT_WRITER_RULES[key]
  return checkRole(rule.roles, role, rule.roleError)
}

/** Returns the status error for this writer, or null if the status is a
 *  valid starting point. Only meaningful for writers whose sourceStatus is a
 *  list — do not call this for publishDraftCatalogue (see file header). */
export function checkLotWriterSourceStatus(key: LotWriterKey, status: LotStatus): string | null {
  const rule = LOT_WRITER_RULES[key]
  if (rule.sourceStatus === 'any') return null
  return rule.sourceStatus.includes(status) ? null : (rule.statusError ?? 'That status cannot be used here')
}
