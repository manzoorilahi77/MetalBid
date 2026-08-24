/* ---------------------------------------------------------------------------
   Application layer — the lot quality gate (field inspection, then the
   Operations/Sub Admin decision). Each function here answers "how do we
   execute this operation": it reads the inputs the Zustand action already
   read, applies the same validation/branching the action already had, and
   returns a plan of what to write and who to tell. It performs no `set`,
   `get`, or `notify` call itself — those stay in the Zustand slice, which is
   now a thin adapter over this plan. Moved verbatim from opsSlice.ts; no
   business rule, wording, or threshold changed.
--------------------------------------------------------------------------- */
import { uid, num } from '../lib/format'
import { inspectionOutcomeToLotStatus, type InspectionOutcome } from '../lib/lotStatus'
import { LOT_GATE_ROLES, WEIGHMENT_WITNESS_ROLES } from '../store/constants'
import type { Catalogue, DeliveryOrder, InspectionReport, Lot, LotStatus, NotificationKind, Role, User } from '../types'

/* ------------------------------ submitInspection ------------------------------ */

export interface SubmitInspectionContext {
  now: number
  lot: Lot | undefined
  priorReportCount: number
  inspectorId: string
  inspectorName: string
  sellerId: string | null
}

export interface NotificationPlan {
  kind: NotificationKind
  title: string
  body: string
  href: string
}

export interface SubmitInspectionPlan {
  report: InspectionReport
  lotStatus: LotStatus
  audit: { action: string; target: string; detail: string }
  opsNotification: NotificationPlan
  sellerNotification: (NotificationPlan & { userId: string }) | null
}

export function planSubmitInspection(
  lotId: string,
  report: Omit<InspectionReport, 'id' | 'lotId' | 'date'>,
  outcome: InspectionOutcome,
  ctx: SubmitInspectionContext,
): SubmitInspectionPlan {
  const version = ctx.priorReportCount + 1
  const rep: InspectionReport = {
    ...report, id: uid('ir'), lotId, date: new Date(ctx.now).toISOString(),
    status: outcome, inspectorId: ctx.inspectorId,
  }
  const lotStatus = inspectionOutcomeToLotStatus(outcome)
  const title = `${ctx.lot?.lotNo ?? 'Lot'} inspection ${outcome}`
  const measured = `${report.measuredQty} ${report.uom} measured against ${ctx.lot?.indicativeQty ?? '—'} ${report.uom} declared`
  return {
    report: rep,
    lotStatus,
    audit: {
      action: 'inspection.submit',
      target: ctx.lot?.lotNo ?? lotId,
      detail: `Inspection ${outcome} — measured ${report.measuredQty} ${report.uom}${version > 1 ? ` (version ${version})` : ''}`,
    },
    opsNotification: {
      kind: 'system', title,
      body: `${ctx.inspectorName} filed report ${version > 1 ? `v${version} ` : ''}— ${measured}. Awaiting your decision.`,
      href: '/exec/approvals',
    },
    sellerNotification: ctx.sellerId
      ? { userId: ctx.sellerId, kind: 'system', title, body: `${measured}. Operations decides the lot next.`, href: '/seller/lots' }
      : null,
  }
}

/* --------------------------------- decideLot ----------------------------------- */

export type LotDecisionOutcome = 'approved' | 'flagged' | 'rejected'

export interface DecideLotContext {
  role: Role
  lot: Lot | undefined
  catalogue: Catalogue | undefined
  sellerId: string | null
}

export interface DecideLotPlan {
  lotId: string
  status: LotDecisionOutcome
  audit: { action: string; target: string; detail: string; severity: 'info' | 'warning' }
  sellerNotification: (NotificationPlan & { userId: string }) | null
  fieldExecNotification: (NotificationPlan & { userId: string }) | null
  shouldAnnounceCatalogueReady: boolean
}

export type DecideLotResult =
  | { ok: true; plan: DecideLotPlan }
  | { ok: false; error: string }

export function planDecideLot(
  lotId: string,
  outcome: LotDecisionOutcome,
  reason: string | undefined,
  ctx: DecideLotContext,
): DecideLotResult {
  if (!LOT_GATE_ROLES.includes(ctx.role)) return { ok: false, error: 'Only Operations or a Sub Admin decides a lot' }
  if (!ctx.lot) return { ok: false, error: 'Lot not found' }
  if (outcome !== 'approved' && !reason?.trim()) {
    return { ok: false, error: 'A reason is required — the seller is shown it word for word' }
  }
  const lot = ctx.lot
  const detail = {
    approved: `Cleared for auction${reason ? ` — ${reason}` : ''}`,
    flagged: `Sent back for re-inspection — ${reason}`,
    rejected: `Rejected — ${reason}`,
  }[outcome]
  const sellerTitle = {
    approved: `${lot.lotNo} approved`,
    flagged: `${lot.lotNo} sent back for re-inspection`,
    rejected: `${lot.lotNo} rejected`,
  }[outcome]

  return {
    ok: true,
    plan: {
      lotId,
      status: outcome,
      audit: {
        action: `lot.${outcome === 'flagged' ? 'send_back' : outcome}`,
        target: lot.lotNo,
        detail,
        severity: outcome === 'rejected' ? 'warning' : 'info',
      },
      sellerNotification: ctx.sellerId
        ? { userId: ctx.sellerId, kind: 'system', title: sellerTitle, body: detail, href: '/seller/lots' }
        : null,
      fieldExecNotification: outcome === 'flagged' && ctx.catalogue?.assignedFieldExecId
        ? {
          userId: ctx.catalogue.assignedFieldExecId, kind: 'system',
          title: `Re-inspect ${lot.lotNo}`, body: reason ?? 'Sent back by Operations.', href: `/field/lot/${lot.id}`,
        }
        : null,
      shouldAnnounceCatalogueReady: outcome === 'approved',
    },
  }
}

/* ------------------------------ waiveInspection ------------------------------ */

export interface WaiveInspectionContext {
  role: Role
  lot: Lot | undefined
  sellerId: string | null
  now: number
}

export interface WaiveInspectionPlan {
  lotId: string
  waivedAt: string
  audit: { action: string; target: string; detail: string; severity: 'warning' }
  sellerNotification: (NotificationPlan & { userId: string }) | null
  catalogueId: string | null
}

export type WaiveInspectionResult =
  | { ok: true; plan: WaiveInspectionPlan }
  | { ok: false; error: string }

export function planWaiveInspection(
  lotId: string,
  reason: string,
  ctx: WaiveInspectionContext,
): WaiveInspectionResult {
  if (!LOT_GATE_ROLES.includes(ctx.role)) return { ok: false, error: 'Only Operations or a Sub Admin may bypass an inspection' }
  const lot = ctx.lot
  if (!lot) return { ok: false, error: 'Lot not found' }
  // The typed reason *is* the control. Bypass is deliberately not gated
  // behind a second approver, so an empty reason would leave nothing at all
  // standing between a seller's word and the marketplace.
  if (!reason.trim()) return { ok: false, error: 'A typed reason is required to bypass an inspection' }

  return {
    ok: true,
    plan: {
      lotId,
      waivedAt: new Date(ctx.now).toISOString(),
      // Warning severity, not info: this lot goes to market described on the
      // seller's word alone, and the monthly count of these is a quality metric.
      audit: { action: 'inspection.bypass', target: lot.lotNo, detail: `Inspection bypassed — ${reason}`, severity: 'warning' },
      sellerNotification: ctx.sellerId
        ? {
          userId: ctx.sellerId, kind: 'system', title: `${lot.lotNo} accepted without inspection`,
          body: `Accepted on your description — ${reason}. The quantity stays indicative and is final on weighment.`,
          href: '/seller/lots',
        }
        : null,
      catalogueId: lot.catalogueId,
    },
  }
}

/* ----------------------------- decideSellerKyc ------------------------------- */

export interface DecideSellerKycContext {
  role: Role
  user: User | undefined
}

export interface DecideSellerKycPlan {
  approve: boolean
  kycStatus: 'verified' | 'rejected'
  audit: { action: string; target: string; detail: string; severity: 'info' | 'warning' }
  notification: NotificationPlan & { userId: string }
}

export type DecideSellerKycResult =
  | { ok: true; plan: DecideSellerKycPlan }
  | { ok: false; error: string }

export function planDecideSellerKyc(
  userId: string,
  approve: boolean,
  reason: string | undefined,
  ctx: DecideSellerKycContext,
): DecideSellerKycResult {
  if (!LOT_GATE_ROLES.includes(ctx.role)) return { ok: false, error: 'Only Operations or a Sub Admin verifies a seller' }
  const user = ctx.user
  if (!user) return { ok: false, error: 'Account not found' }
  if (!approve && !reason?.trim()) return { ok: false, error: 'Say what has to be resubmitted' }

  return {
    ok: true,
    plan: {
      approve,
      kycStatus: approve ? 'verified' : 'rejected',
      audit: {
        action: approve ? 'kyc.approve' : 'kyc.reject', target: user.firm,
        detail: approve ? 'Seller verified — may submit lots' : `Rejected — ${reason}`,
        severity: approve ? 'info' : 'warning',
      },
      notification: {
        userId, kind: 'system',
        title: approve ? 'You are verified as a seller' : 'Your seller verification needs more',
        body: approve
          ? 'You can submit lots for inspection now. They stay private until Operations catalogues and publishes them.'
          : `${reason} — resubmit and we will look again. You can appeal to the Operation Manager.`,
        href: approve ? '/seller/create-lot' : '/buyer/kyc',
      },
    },
  }
}

/* ------------------------------- confirmHandover ------------------------------ */

export interface ConfirmHandoverContext {
  role: Role
  order: DeliveryOrder | undefined
  lot: Lot | undefined
  weigher: User | undefined
  now: number
}

export interface ConfirmHandoverPlan {
  handoverConfirmedAt: string
  audit: { action: string; target: string; detail: string }
  buyerNotification: NotificationPlan & { userId: string }
  financeNotification: NotificationPlan
}

export type ConfirmHandoverResult =
  | { ok: true; plan: ConfirmHandoverPlan }
  | { ok: false; error: string }

export function planConfirmHandover(
  doId: string,
  note: string | undefined,
  ctx: ConfirmHandoverContext,
): ConfirmHandoverResult {
  if (!LOT_GATE_ROLES.includes(ctx.role)) return { ok: false, error: 'Only Operations or a Sub Admin closes a handover' }
  const order = ctx.order
  if (!order) return { ok: false, error: 'Delivery order not found' }
  if (order.stage !== 'completed') return { ok: false, error: 'The material has not been lifted yet' }
  if (order.handoverConfirmedAt) return { ok: false, error: 'This handover is already closed' }
  /* Weighment-final means final. The quantity here becomes the invoice and
     any shortfall refund, so it cannot rest on the buyer's own reading —
     one of our people has to have witnessed it. */
  if (order.weighedQty != null) {
    const weigher = ctx.weigher
    if (!weigher || !WEIGHMENT_WITNESS_ROLES.includes(weigher.role)) {
      return {
        ok: false,
        error: 'The weighment on this order was declared by the buyer. Record the witnessed figure on Logistics before closing the handover.',
      }
    }
  }
  const at = new Date(ctx.now).toISOString()
  const lot = ctx.lot
  const qty = order.weighedQty ?? order.awardedQty
  return {
    ok: true,
    plan: {
      handoverConfirmedAt: at,
      audit: { action: 'delivery.handover', target: lot?.lotNo ?? doId, detail: `Handover closed at ${num(qty)} ${order.uom} weighment-final${note ? ` — ${note}` : ''}` },
      buyerNotification: {
        userId: order.buyerId, kind: 'system', title: `Handover closed on ${lot?.lotNo ?? 'your lot'}`,
        body: `Recorded at ${num(qty)} ${order.uom}, weighment-final. Your closure certificate is available.`,
        href: '/buyer/auction-status',
      },
      // Finance books the sale off the back of this.
      financeNotification: {
        kind: 'system', title: 'Delivery closed',
        body: `${lot?.lotNo ?? doId} handed over at ${num(qty)} ${order.uom}. Ready to book.`,
        href: '/finance/payments',
      },
    },
  }
}
