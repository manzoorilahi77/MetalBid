/* ---------------------------------------------------------------------------
   Application layer — the Finance/CEO EMD forfeiture desk. Moved verbatim
   from financeSlice.ts's raiseEmdForfeiture and waiveEmdForfeiture; no rule,
   threshold, wording, or recipient changed. This is the finance/CEO
   forfeiture *decision* workflow, not the bid-time EMD server authority
   (fundEmd/placeBid) — that stays untouched. See opsInspection.ts for the
   pattern.
--------------------------------------------------------------------------- */
import { uid, inr } from '../lib/format'
import { emdForfeitureAmount } from '../lib/emd'
import { FINANCE_ROLES } from '../store/constants'
import { checkAuth } from './authorization'
import type { EmdForfeiture, Lot, Role } from '../types'
import type { NotificationPlan } from './opsInspection'

/* --------------------------------- raise --------------------------------- */

export interface RaiseEmdForfeitureContext {
  role: Role
  actorId: string | undefined
  lot: Lot | undefined
  hasActiveForfeitureOnLot: boolean
  walletEmdLocked: number
  ceoForfeitureFrom: number
  now: number
}

export interface RaiseEmdForfeiturePlan {
  record: EmdForfeiture
  overThreshold: boolean
  ceoApproval: { kind: 'emd_forfeiture'; refId: string; amount: number; summary: string; reason: string } | null
  audit: { action: string; target: string; detail: string; severity: 'critical' } | null
  notification: (NotificationPlan & { userId: string }) | null
}

export type RaiseEmdForfeitureResult =
  | { ok: true; plan: RaiseEmdForfeiturePlan }
  | { ok: false; error: string }

export function planRaiseEmdForfeiture(
  lotId: string,
  buyerId: string,
  reason: string,
  ctx: RaiseEmdForfeitureContext,
): RaiseEmdForfeitureResult {
  const roleError = checkAuth('forfeitEmd', ctx.role)
  if (roleError) return { ok: false, error: roleError }
  const lot = ctx.lot
  if (!lot) return { ok: false, error: 'Lot not found' }
  if (ctx.hasActiveForfeitureOnLot) return { ok: false, error: 'A forfeiture already exists on this lot for this buyer' }
  const amount = emdForfeitureAmount(lot.preBidEmd, ctx.walletEmdLocked)
  if (amount <= 0) return { ok: false, error: 'No EMD is held against this lot' }

  const overThreshold = amount >= ctx.ceoForfeitureFrom
  const nowIso = new Date(ctx.now).toISOString()
  const record: EmdForfeiture = {
    id: uid('emf'), buyerId, lotId, catalogueId: lot.catalogueId, amount, reason,
    status: overThreshold ? 'awaiting_ceo' : 'applied',
    raisedBy: ctx.actorId ?? 'system',
    raisedAt: nowIso,
    ...(overThreshold ? {} : { decidedBy: ctx.actorId, decidedAt: nowIso }),
  }

  if (!overThreshold) {
    return { ok: true, plan: { record, overThreshold: false, ceoApproval: null, audit: null, notification: null } }
  }
  return {
    ok: true,
    plan: {
      record, overThreshold: true,
      ceoApproval: {
        kind: 'emd_forfeiture', refId: record.id, amount,
        summary: `Forfeit ${inr(amount)} of EMD held against ${lot.lotNo}`, reason,
      },
      audit: {
        action: 'emd.forfeit_request', target: lot.lotNo,
        detail: `Forfeiture of ${inr(amount)} sent for CEO sign-off — ${reason}`, severity: 'critical',
      },
      // Their money is frozen pending a decision; they are told that, and why.
      notification: {
        userId: buyerId, kind: 'wallet', title: `EMD held pending review — ${lot.lotNo}`,
        body: `${inr(amount)} stays locked while a forfeiture is decided. ${reason}`, href: '/buyer/wallet',
      },
    },
  }
}

/* --------------------------------- waive --------------------------------- */

export interface WaiveEmdForfeitureContext {
  role: Role
  actorId: string | undefined
  record: EmdForfeiture | undefined
  lot: Lot | undefined
  now: number
  /** Phase 22: set only when this call comes from decideCeoApproval's
   *  refuse+emd_forfeiture branch and the caller already passed
   *  canSignForCeo — the CEO (or an authorized delegate) refusing a
   *  forfeiture on their own sign-off queue is not a Finance desk action,
   *  and FINANCE_ROLES was never meant to gate it. This does not widen who
   *  may use the Finance desk's own direct waive button. */
  ceoQueueAuthorized?: boolean
}

export interface WaiveEmdForfeiturePlan {
  forfeitureId: string
  decidedBy: string | undefined
  decidedAt: string
  audit: { action: string; target: string; detail: string; severity: 'warning' }
  notification: NotificationPlan & { userId: string }
}

export type WaiveEmdForfeitureResult =
  | { ok: true; plan: WaiveEmdForfeiturePlan }
  | { ok: false }

export function planWaiveEmdForfeiture(
  id: string,
  reason: string,
  ctx: WaiveEmdForfeitureContext,
): WaiveEmdForfeitureResult {
  if (!FINANCE_ROLES.includes(ctx.role) && !ctx.ceoQueueAuthorized) return { ok: false }
  const record = ctx.record
  if (!record || record.status === 'applied') return { ok: false }

  const decidedAt = new Date(ctx.now).toISOString()
  return {
    ok: true,
    plan: {
      forfeitureId: id,
      decidedBy: ctx.actorId,
      decidedAt,
      audit: {
        action: 'emd.forfeit_waive', target: ctx.lot?.lotNo ?? record.lotId,
        detail: `Forfeiture of ${inr(record.amount)} waived — ${reason}`, severity: 'warning',
      },
      notification: {
        userId: record.buyerId, kind: 'wallet', title: 'EMD forfeiture waived',
        body: `${inr(record.amount)} stays with you. ${reason}`, href: '/buyer/wallet',
      },
    },
  }
}
