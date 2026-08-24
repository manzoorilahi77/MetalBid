/* ---------------------------------------------------------------------------
   Application layer — undoing one structural change, or restoring the whole
   platform shape to an earlier point. Moved verbatim from
   superAdminSlice.ts's undoStructuralChange/restoreStructureTo; no rule,
   threshold, or wording changed.

   Both actions read `structuralChanges` (and, for the single-undo path,
   nothing else) and return which snapshot to apply plus which change
   record(s) to mark undone — the actual `set(...helpers.applySnapshot(...))`
   stays in the adapter, same as every other structural action in this
   refactor, since applying a snapshot is itself the six-field patch
   `structureSnapshot()`/`applySnapshot()` already define, not something a
   plan function needs to reconstruct.

   Pre-existing behavior worth flagging, found while characterizing this
   pair (Phase 21/22, documented not fixed — the one-step, non-cascading
   shape of `undoStructuralChange` was reviewed and deliberately left as-is):
   `undoStructuralChange` marks ONLY the one target change as undone. If a
   later structural change has already been applied on top of it, undoing
   the earlier one silently reverts the platform to a state that predates
   the later change too — but the later change's own record is left showing
   as NOT undone, because nothing here walks forward from the target.
   `restoreStructureTo` does not have this gap: it explicitly finds and
   marks every snapshot-carrying change at or after the target's timestamp
   as undone in the same operation. The two actions are not equivalent
   restore mechanisms, and the UI that exposes `undoStructuralChange` on an
   individual change should be read with that in mind.

   Phase 22 (approved, behavior-changing): `restoreStructureTo`'s own
   later-change filter used to count a `structure.rollback` record — the
   meta-record `undoStructuralChange` itself creates — as one of the "N
   changes undone." That inflated the reported count by one for every prior
   individual undo folded into a broader restore. Meta-rollback records are
   now excluded from that filter; the count reflects only real business
   actions.
--------------------------------------------------------------------------- */
import type { StructuralChange, StructureSnapshot } from '../types'

/* ------------------------------ undoStructuralChange ------------------------------ */

export type PermissionError = { ok: false; error: string } | null
type Result<T> = { ok: true; plan: T } | { ok: false; error: string }

export interface UndoStructuralChangePlan {
  changeId: string
  snapshotToApply: StructureSnapshot
  undoneAt: string
  newRecord: { kind: 'structure.rollback'; target: string; summary: string; before: string | null; after: string | null; snapshot: StructureSnapshot }
  audit: { action: string; target: string; detail: string; severity: 'critical' }
}

export function planUndoStructuralChange(id: string, ctx: {
  permissionError: PermissionError
  change: StructuralChange | undefined
  currentSnapshot: StructureSnapshot
  now: number
}): Result<UndoStructuralChangePlan> {
  if (ctx.permissionError) return ctx.permissionError
  const change = ctx.change
  if (!change) return { ok: false, error: 'No such change' }
  if (change.undoneAt) return { ok: false, error: 'That change has already been undone' }
  if (!change.snapshot) return { ok: false, error: 'That change is on the record but is not a structural one — business data is never rolled back' }
  const undoneAt = new Date(ctx.now).toISOString()
  return {
    ok: true,
    plan: {
      changeId: id,
      snapshotToApply: change.snapshot,
      undoneAt,
      newRecord: {
        kind: 'structure.rollback', target: change.target, summary: `Undid: ${change.summary}`,
        before: change.after, after: change.before, snapshot: ctx.currentSnapshot,
      },
      audit: { action: 'structure.undo', target: change.target, detail: `Undid ${change.kind} — ${change.summary}`, severity: 'critical' },
    },
  }
}

/* ------------------------------ restoreStructureTo ------------------------------ */

export interface RestoreStructureToPlan {
  snapshotToApply: StructureSnapshot
  undoneAt: string
  laterChangeIds: string[]
  newRecord: { kind: 'structure.rollback'; target: string; summary: string; before: string | null; after: string | null; snapshot: StructureSnapshot }
  audit: { action: string; target: string; detail: string; severity: 'critical' }
}

export function planRestoreStructureTo(_id: string, ctx: {
  permissionError: PermissionError
  change: StructuralChange | undefined
  allChanges: StructuralChange[]
  currentSnapshot: StructureSnapshot
  fmtStamp: (iso: string) => string
  now: number
}): Result<RestoreStructureToPlan> {
  if (ctx.permissionError) return ctx.permissionError
  const change = ctx.change
  if (!change?.snapshot) return { ok: false, error: 'There is no structure snapshot at that point' }
  const later = ctx.allChanges.filter((c) => Date.parse(c.at) >= Date.parse(change.at) && !c.undoneAt && c.snapshot && c.kind !== 'structure.rollback')
  const undoneAt = new Date(ctx.now).toISOString()
  return {
    ok: true,
    plan: {
      snapshotToApply: change.snapshot,
      undoneAt,
      laterChangeIds: later.map((c) => c.id),
      newRecord: {
        kind: 'structure.rollback', target: 'The platform\'s shape',
        summary: `Restored to ${ctx.fmtStamp(change.at)} — ${later.length} change${later.length === 1 ? '' : 's'} undone. No auction, bid, payment or audit entry was touched.`,
        before: `${later.length} changes since`, after: ctx.fmtStamp(change.at), snapshot: ctx.currentSnapshot,
      },
      audit: { action: 'structure.restore', target: 'Roles & pages', detail: `Restored to ${change.at} (${later.length} changes undone)`, severity: 'critical' },
    },
  }
}
