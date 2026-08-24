/* ---------------------------------------------------------------------------
   Application layer — the four lot-status transitions that, before Phase 28b,
   went through a raw setter with no guard of any kind. Each
   page already implied a role and a source-status precondition through route
   gating and array filtering alone; these plan functions make that precondition
   real, enforced regardless of caller. Phase 28's audit (Step 1) found this gap;
   the guards below encode exactly what each page already checked before
   rendering its button — no new rule, no new audit entry, no new threshold.
--------------------------------------------------------------------------- */
import { checkLotWriterRole, checkLotWriterSourceStatus, type LotWriterKey } from './lotTransitions'
import type { Catalogue, Lot, Role } from '../types'

/* --------------------------- resolveFlaggedLot --------------------------- */
/* exec/Pipeline.tsx "Resolve": flagged -> inspected. The page only renders
   this button in the 'attention' column for a lot whose status is 'flagged'
   (rejected lots in that same column get no button at all). */

export interface ResolveFlaggedLotContext {
  role: Role
  lot: Lot | undefined
}

export type ResolveFlaggedLotResult =
  | { ok: true; plan: { lotId: string } }
  | { ok: false; error: string }

export function planResolveFlaggedLot(lotId: string, ctx: ResolveFlaggedLotContext): ResolveFlaggedLotResult {
  const roleError = checkLotWriterRole('resolveFlaggedLot', ctx.role)
  if (roleError) return { ok: false, error: roleError }
  const lot = ctx.lot
  if (!lot) return { ok: false, error: 'Lot not found' }
  const statusError = checkLotWriterSourceStatus('resolveFlaggedLot', lot.status)
  if (statusError) return { ok: false, error: statusError }
  return { ok: true, plan: { lotId } }
}

/* ------------------------- STA decisions (shared guard) ------------------------ */
/* exec/Settlement.tsx's staLots list, which both approveSale and markUnsold
   read their ids from: status === 'sta' AND the lot's catalogue is closed. */

function checkStaLot(key: LotWriterKey, role: Role, lot: Lot | undefined, catalogue: Catalogue | undefined): string | null {
  const roleError = checkLotWriterRole(key, role)
  if (roleError) return roleError
  if (!lot) return 'Lot not found'
  const statusError = checkLotWriterSourceStatus(key, lot.status)
  if (statusError) return statusError
  if (catalogue?.status !== 'closed') return 'The auction has not closed yet'
  return null
}

export interface DecideStaLotContext {
  role: Role
  lot: Lot | undefined
  catalogue: Catalogue | undefined
}

export type DecideStaLotResult =
  | { ok: true; plan: { lotId: string } }
  | { ok: false; error: string }

/* exec/Settlement.tsx approveSale: sta -> sold */
export function planApproveStaSale(lotId: string, ctx: DecideStaLotContext): DecideStaLotResult {
  const error = checkStaLot('approveStaSale', ctx.role, ctx.lot, ctx.catalogue)
  if (error) return { ok: false, error }
  return { ok: true, plan: { lotId } }
}

/* exec/Settlement.tsx markUnsold: sta -> unsold */
export function planMarkStaUnsold(lotId: string, ctx: DecideStaLotContext): DecideStaLotResult {
  const error = checkStaLot('markStaUnsold', ctx.role, ctx.lot, ctx.catalogue)
  if (error) return { ok: false, error }
  return { ok: true, plan: { lotId } }
}

/* --------------------------- returnRefusedLotToPipeline -------------------------- */
/* exec/Settlement.tsx returnToPipeline: sold|sta -> unsold. The page's
   refusedLots list — the only source of ids this button is ever called with —
   filters on sellerDecision === 'rejected' AND the lot's catalogue is closed.
   It does not itself re-check lot.status, so this guard doesn't either: adding
   a status check here would be stricter than what the page has ever enforced. */

export interface ReturnRefusedLotContext {
  role: Role
  lot: Lot | undefined
  catalogue: Catalogue | undefined
}

export type ReturnRefusedLotResult =
  | { ok: true; plan: { lotId: string } }
  | { ok: false; error: string }

export function planReturnRefusedLotToPipeline(lotId: string, ctx: ReturnRefusedLotContext): ReturnRefusedLotResult {
  const roleError = checkLotWriterRole('returnRefusedLotToPipeline', ctx.role)
  if (roleError) return { ok: false, error: roleError }
  const lot = ctx.lot
  if (!lot) return { ok: false, error: 'Lot not found' }
  if (lot.sellerDecision !== 'rejected') return { ok: false, error: 'The seller has not refused a price on this lot' }
  if (ctx.catalogue?.status !== 'closed') return { ok: false, error: 'The auction has not closed yet' }
  return { ok: true, plan: { lotId } }
}
