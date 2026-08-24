/* ---------------------------------------------------------------------------
   Application layer — seller-initiated post-auction actions: accepting or
   rejecting a cleared price, and recording a commission settlement. Moved
   verbatim from opsSlice.ts's setSellerLotDecision and
   recordCommissionSettlement; no rule or wording changed beyond Phase 22.

   Phase 21/9-10: neither original action carried a role/permission guard in
   its body — both simply proceeded on whatever inputs they were given, with
   only the page (`/seller/settlement`, seller-only) actually gating who saw
   the button. Phase 22 (approved, behavior-changing): both now require the
   `seller` role at the plan-function level too, closing the gap where a
   direct store call from any other role went through unchecked. See
   opsInspection.ts for the general pattern.
--------------------------------------------------------------------------- */
import { uid, inr } from '../lib/format'
import type { Catalogue, CommissionSettlement, Lot, Role, User } from '../types'
import type { NotificationPlan } from './opsInspection'

/* --------------------------- setSellerLotDecision --------------------------- */

export type SellerLotDecision = 'accepted' | 'rejected' | null

export interface SetSellerLotDecisionContext {
  role: Role
  lot: Lot | undefined
  catalogue: Catalogue | undefined
  seller: User | undefined
}

export interface SetSellerLotDecisionPlan {
  lotId: string
  decision: SellerLotDecision
  audit: { action: string; target: string; detail: string; severity: 'warning' | 'info' }
  rejectedNotification: NotificationPlan | null
  acceptedNotification: NotificationPlan | null
}

export type SetSellerLotDecisionResult =
  | { ok: true; plan: SetSellerLotDecisionPlan }
  | { ok: false; error: string }

export function planSetSellerLotDecision(
  lotId: string,
  decision: SellerLotDecision,
  ctx: SetSellerLotDecisionContext,
): SetSellerLotDecisionResult {
  if (ctx.role !== 'seller') return { ok: false, error: 'Only a seller decides on their own cleared price' }
  const lot = ctx.lot
  const cat = ctx.catalogue
  const seller = ctx.seller
  const clearedRate = lot?.resultH1Rate ?? lot?.currentRate ?? 0
  const uom = lot?.uom ?? 'MT'

  return {
    ok: true,
    plan: {
      lotId,
      decision,
      audit: {
        action: 'lot.seller_decision', target: lot?.lotNo ?? lotId,
        detail: decision ? `Seller ${decision} the cleared price` : 'Seller decision reset to pending',
        severity: decision === 'rejected' ? 'warning' : 'info',
      },
      /* Rejecting is not the end of the lot — it is the start of an operational
         exception, and the material is sitting in a yard while it waits. Ops
         used to have to notice. */
      rejectedNotification: decision === 'rejected'
        ? {
          kind: 'system', title: `${lot?.lotNo ?? 'A lot'} — seller refused the cleared price`,
          body: `${seller?.firm ?? 'The seller'} refused ${inr(clearedRate)}/${uom} on ${cat?.code ?? 'a closed auction'}. No commission is due — decide what happens to the material.`,
          href: '/exec/settlement',
        }
        : null,
      /* Accepting is what makes commission owed, so Finance is told a receipt
         is coming rather than discovering it when the seller records payment. */
      acceptedNotification: decision === 'accepted'
        ? {
          kind: 'system', title: `Cleared price accepted — ${lot?.lotNo ?? 'a lot'}`,
          body: `${seller?.firm ?? 'A seller'} accepted ${inr(clearedRate)}/${uom} on ${cat?.code ?? 'a closed auction'}. Commission becomes due on this lot.`,
          href: '/finance/commission',
        }
        : null,
    },
  }
}

/* ------------------------- recordCommissionSettlement ----------------------- */

export interface RecordCommissionSettlementContext {
  role: Role
  actorId: string | undefined
  actorFirm: string | undefined
  catalogue: Catalogue | undefined
  now: number
}

export interface RecordCommissionSettlementPlan {
  record: CommissionSettlement
  audit: { action: string; target: string; detail: string }
  notification: NotificationPlan
}

export type RecordCommissionSettlementResult =
  | { ok: true; plan: RecordCommissionSettlementPlan }
  | { ok: false; error: string }

export function planRecordCommissionSettlement(
  catalogueId: string,
  amount: number,
  mode: 'transfer' | 'emd',
  reference: string | undefined,
  ctx: RecordCommissionSettlementContext,
): RecordCommissionSettlementResult {
  if (ctx.role !== 'seller') return { ok: false, error: 'Only a seller records their own commission settlement' }
  const at = new Date(ctx.now).toISOString()
  const record: CommissionSettlement = {
    id: uid('settle'), catalogueId, sellerId: ctx.actorId ?? '', amount, mode, at,
    reference: reference ?? (mode === 'emd' ? `EMD-NET-${catalogueId}` : undefined),
    // The seller says they have paid. Finance still has to see it arrive —
    // until then this is a claim, not a confirmed receipt.
    status: 'recorded',
  }
  const catCode = ctx.catalogue?.code ?? catalogueId
  return {
    ok: true,
    plan: {
      record,
      audit: {
        action: 'lot.commission_settled', target: catCode,
        detail: `Commission ${mode === 'emd' ? 'netted from EMD' : 'paid by transfer'} — ${inr(amount)}`,
      },
      // Hands the record straight to the Finance desk that has to confirm it.
      notification: {
        kind: 'system', title: `Commission recorded — ${catCode}`,
        body: `${ctx.actorFirm ?? 'A seller'} settled ${inr(amount)} ${mode === 'emd' ? 'from held EMD' : 'by transfer'}. Confirm it against the bank.`,
        href: '/finance/commission',
      },
    },
  }
}
