/* ---------------------------------------------------------------------------
   Application layer — Finance confirming a buyer's payment receipt. Moved
   verbatim from financeSlice.ts's confirmBuyerPayment; no rule, wording, or
   amount changed. See opsInspection.ts for the pattern this follows.
--------------------------------------------------------------------------- */
import { inr } from '../lib/format'
import { doDue } from '../lib/money'
import type { DeliveryOrder, Lot, Role } from '../types'
import type { NotificationPlan } from './opsInspection'

export interface ConfirmBuyerPaymentContext {
  role: Role
  deliveryOrder: DeliveryOrder | undefined
  lot: Lot | undefined
}

export interface ConfirmBuyerPaymentPlan {
  doId: string
  due: number
  stage: 'dd_issued' | DeliveryOrder['stage']
  audit: { action: string; target: string; detail: string }
  opsNotification: NotificationPlan
  buyerNotification: NotificationPlan & { userId: string }
}

export type ConfirmBuyerPaymentResult =
  | { ok: true; plan: ConfirmBuyerPaymentPlan }
  | { ok: false; error: string }

const FINANCE_ROLES: Role[] = ['finance_admin', 'super_admin']

export function planConfirmBuyerPayment(
  doId: string,
  method: string,
  ref: string,
  ctx: ConfirmBuyerPaymentContext,
): ConfirmBuyerPaymentResult {
  if (!FINANCE_ROLES.includes(ctx.role)) return { ok: false, error: 'Only Finance can confirm a receipt' }
  const d = ctx.deliveryOrder
  if (!d) return { ok: false, error: 'Delivery order not found' }
  const due = doDue(d)
  if (d.paidAmount >= due) return { ok: false, error: 'This delivery order is already paid in full' }

  const lotNo = ctx.lot?.lotNo ?? 'delivery order'
  return {
    ok: true,
    plan: {
      doId,
      due,
      stage: d.stage === 'payment_pending' ? 'dd_issued' : d.stage,
      audit: {
        action: 'payment.confirm',
        target: ctx.lot?.lotNo ?? doId,
        detail: `Receipt of ${inr(due)} confirmed via ${method} (${ref}) — delivery order released to Operations`,
      },
      opsNotification: {
        kind: 'system', title: `Payment cleared — ${lotNo}`,
        body: `${inr(due)} received. Lifting can be scheduled.`, href: '/exec/logistics',
      },
      buyerNotification: {
        userId: d.buyerId, kind: 'wallet', title: 'Payment received',
        body: `We have received ${inr(due)} for ${ctx.lot?.lotNo ?? 'your lot'}. Lifting will be scheduled.`,
        href: '/buyer/auction-status',
      },
    },
  }
}
