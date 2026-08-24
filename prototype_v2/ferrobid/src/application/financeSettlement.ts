/* ---------------------------------------------------------------------------
   Application layer — Finance-desk settlement bookkeeping: confirming/
   querying a seller's commission settlement against the bank, and chasing an
   overdue buyer payment. Moved verbatim from financeSlice.ts; no rule,
   threshold, or wording changed. See opsInspection.ts for the pattern.
--------------------------------------------------------------------------- */
import { inr } from '../lib/format'
import { checkAuth } from './authorization'
import type { Catalogue, CommissionSettlement, DeliveryOrder, Lot, Role } from '../types'
import type { NotificationPlan } from './opsInspection'

/* ------------------------- confirmCommissionSettlement ----------------------- */

export interface ConfirmCommissionSettlementContext {
  role: Role
  record: CommissionSettlement | undefined
  catalogue: Catalogue | undefined
  now: number
}

export interface ConfirmCommissionSettlementPlan {
  confirmedAt: string
  audit: { action: string; target: string; detail: string }
  notification: NotificationPlan & { userId: string }
}

export type ConfirmCommissionSettlementResult =
  | { ok: true; plan: ConfirmCommissionSettlementPlan }
  | { ok: false; error: string }

export function planConfirmCommissionSettlement(
  bankLineId: string | undefined,
  ctx: ConfirmCommissionSettlementContext,
): ConfirmCommissionSettlementResult {
  const roleError = checkAuth('confirmCommissionSettlement', ctx.role)
  if (roleError) return { ok: false, error: roleError }
  const record = ctx.record
  if (!record) return { ok: false, error: 'Settlement not found' }
  if (record.status === 'confirmed') return { ok: false, error: 'This settlement is already confirmed' }
  // A transfer is only confirmed against a real bank credit. An EMD-netted
  // settlement never touches the bank, so it needs no statement line.
  if (record.mode === 'transfer' && !bankLineId) {
    return { ok: false, error: 'Match the transfer to a credit on the statement before confirming it' }
  }
  const cat = ctx.catalogue
  return {
    ok: true,
    plan: {
      confirmedAt: new Date(ctx.now).toISOString(),
      audit: { action: 'commission.confirm', target: cat?.code ?? record.catalogueId, detail: `Commission of ${inr(record.amount)} confirmed against the bank (${record.mode === 'emd' ? 'netted from EMD' : `transfer ${record.reference ?? '—'}`})` },
      notification: {
        userId: record.sellerId, kind: 'wallet', title: 'Commission confirmed',
        body: `We have matched your ${inr(record.amount)} settlement for ${cat?.code ?? 'the auction'}. It now appears in your History.`,
        href: '/seller/settlement',
      },
    },
  }
}

/* -------------------------- queryCommissionSettlement ------------------------ */

export interface QueryCommissionSettlementContext {
  role: Role
  record: CommissionSettlement | undefined
  catalogue: Catalogue | undefined
}

export interface QueryCommissionSettlementPlan {
  audit: { action: string; target: string; detail: string; severity: 'warning' }
  notification: NotificationPlan & { userId: string }
}

export function planQueryCommissionSettlement(
  note: string,
  ctx: QueryCommissionSettlementContext,
): QueryCommissionSettlementPlan | null {
  if (checkAuth('queryCommissionSettlement', ctx.role)) return null
  const record = ctx.record
  if (!record || record.status === 'confirmed') return null
  const cat = ctx.catalogue
  return {
    audit: { action: 'commission.query', target: cat?.code ?? record.catalogueId, detail: `Commission of ${inr(record.amount)} queried — ${note}`, severity: 'warning' },
    notification: { userId: record.sellerId, kind: 'wallet', title: 'Commission payment queried', body: note, href: '/seller/settlement' },
  }
}

/* ------------------------------ flagOverduePayment ---------------------------- */

export interface FlagOverduePaymentContext {
  role: Role
  order: DeliveryOrder | undefined
  lot: Lot | undefined
}

export interface FlagOverduePaymentPlan {
  audit: { action: string; target: string; detail: string; severity: 'warning' }
  notification: NotificationPlan & { userId: string }
}

export function planFlagOverduePayment(
  doId: string,
  note: string,
  ctx: FlagOverduePaymentContext,
): FlagOverduePaymentPlan | null {
  if (checkAuth('flagOverduePayment', ctx.role)) return null
  const d = ctx.order
  if (!d) return null
  return {
    audit: { action: 'payment.overdue', target: ctx.lot?.lotNo ?? doId, detail: `Payment chased — ${note}`, severity: 'warning' },
    notification: { userId: d.buyerId, kind: 'wallet', title: 'Payment overdue', body: note, href: '/buyer/auction-status' },
  }
}
