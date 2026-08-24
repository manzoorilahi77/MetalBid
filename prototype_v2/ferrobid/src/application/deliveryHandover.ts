/* ---------------------------------------------------------------------------
   Application layer — buyer/staff delivery-handover actions: booking a yard
   inspection slot, recording the gross weighment, and completing lifting.
   Moved verbatim from buyerSlice.ts; no rule, threshold, or wording changed.
   See opsInspection.ts for the pattern.
--------------------------------------------------------------------------- */
import { num, uid } from '../lib/format'
import { WEIGHMENT_WITNESS_ROLES } from '../store/constants'
import type { Catalogue, DeliveryOrder, InspectionSlot, Lot, Role, User } from '../types'
import type { NotificationPlan } from './opsInspection'

/* ------------------------------ bookInspectionSlot ------------------------------ */

export interface BookInspectionSlotContext {
  actor: User
  catalogue: Catalogue | undefined
}

export interface BookInspectionSlotPlan {
  slot: InspectionSlot
  audit: { action: string; target: string; detail: string }
  opsNotification: NotificationPlan
  fieldExecNotification: (NotificationPlan & { userId: string }) | null
}

export function planBookInspectionSlot(
  catalogueId: string,
  date: string,
  window: string,
  persons: number,
  ctx: BookInspectionSlotContext,
): BookInspectionSlotPlan {
  const me = ctx.actor
  const cat = ctx.catalogue
  const slot: InspectionSlot = {
    id: uid('slot'), catalogueId, userId: me.id, date, window, persons,
    status: 'booked', passCode: `FB-GATE-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
  }
  return {
    slot,
    audit: { action: 'inspection.slot_book', target: cat?.code ?? catalogueId, detail: `${me.firm} booked a yard visit for ${persons} on ${date} (${window})` },
    // Somebody has to be at the gate. Operations runs the yard window and the
    // assigned field executive is usually the person on site.
    opsNotification: {
      kind: 'system', title: `Yard visit booked — ${cat?.code ?? 'a catalogue'}`,
      body: `${me.firm} · ${persons} visitor${persons === 1 ? '' : 's'} on ${date}, ${window}, at ${cat?.yardName ?? 'the yard'}.`,
      href: '/exec/logistics',
    },
    fieldExecNotification: cat?.assignedFieldExecId
      ? {
        userId: cat.assignedFieldExecId, kind: 'system', title: `Buyer visiting ${cat.yardName}`,
        body: `${me.firm} · ${persons} visitor${persons === 1 ? '' : 's'} on ${date}, ${window}.`,
        href: `/field/catalogue/${catalogueId}`,
      }
      : null,
  }
}

/* -------------------------------- recordWeighment -------------------------------- */

export interface RecordWeighmentContext {
  order: DeliveryOrder | undefined
  lot: Lot | undefined
  actor: User | null
  role: Role
  now: number
}

export interface RecordWeighmentPlan {
  mutation: { qty: number; weighedById: string; weighedAt: string }
  audit: { action: string; target: string; detail: string; severity: 'info' | 'warning' }
  buyerDeclaredNotification: NotificationPlan | null
  staffConfirmedNotification: (NotificationPlan & { userId: string }) | null
  shortfallNotification: NotificationPlan | null
}

export function planRecordWeighment(qty: number, ctx: RecordWeighmentContext): RecordWeighmentPlan | null {
  const d = ctx.order
  const me = ctx.actor
  if (!d || !me || d.stage !== 'lifted') return null
  // Either side may put a reading on the record — the buyer at their own
  // weighbridge, or our people at the yard. Who it was is stamped, because
  // only a staff reading can close the handover.
  const isBuyer = d.buyerId === me.id
  const isStaff = WEIGHMENT_WITNESS_ROLES.includes(ctx.role)
  if (!isBuyer && !isStaff) return null
  const at = new Date(ctx.now).toISOString()
  const lot = ctx.lot
  const variance = d.awardedQty > 0 ? ((qty - d.awardedQty) / d.awardedQty) * 100 : 0
  return {
    mutation: { qty, weighedById: me.id, weighedAt: at },
    audit: {
      action: 'do.weighment', target: lot?.lotNo ?? d.id,
      detail: `Gross weighment ${num(qty)} ${d.uom} recorded by ${isStaff ? me.name : `${me.firm} (buyer)`} against ${num(d.awardedQty)} ${d.uom} awarded — ${variance >= 0 ? '+' : ''}${variance.toFixed(1)}%`,
      severity: Math.abs(variance) >= 1 ? 'warning' : 'info',
    },
    // A buyer's reading is a declaration until we have stood at the bridge.
    buyerDeclaredNotification: isBuyer ? {
      kind: 'system', title: `Weighment declared — ${lot?.lotNo ?? 'a lot'}`,
      body: `${me.firm} recorded ${num(qty)} ${d.uom} against ${num(d.awardedQty)} ${d.uom} awarded (${variance >= 0 ? '+' : ''}${variance.toFixed(1)}%). Witness it before closing the handover.`,
      href: '/exec/logistics',
    } : null,
    staffConfirmedNotification: !isBuyer ? {
      userId: d.buyerId, kind: 'system', title: `Weighment confirmed — ${lot?.lotNo ?? 'your lot'}`,
      body: `Recorded at ${num(qty)} ${d.uom}, witnessed by ${me.name}. This is the quantity your invoice is raised on.`,
      href: '/buyer/auction-status',
    } : null,
    // A material shortfall is money owed back. Finance is told rather than
    // the buyer having to open a ticket to get it noticed.
    shortfallNotification: variance <= -1 ? {
      kind: 'system', title: `Weighment shortfall — ${lot?.lotNo ?? 'a lot'}`,
      body: `${num(qty)} ${d.uom} against ${num(d.awardedQty)} ${d.uom} awarded (${variance.toFixed(1)}%). The value of the shortfall goes back to the buyer.`,
      href: '/finance/refunds',
    } : null,
  }
}

/* -------------------------------- completeLifting -------------------------------- */

export interface CompleteLiftingContext {
  order: DeliveryOrder | undefined
  lot: Lot | undefined
  actor: User | null
  role: Role
}

export interface CompleteLiftingPlan {
  audit: { action: string; target: string; detail: string }
  notification: NotificationPlan
}

export function planCompleteLifting(doId: string, ctx: CompleteLiftingContext): CompleteLiftingPlan | null {
  const d = ctx.order
  const me = ctx.actor
  if (!d || !me || d.stage !== 'lifted' || !d.liftingChecklist.every((i) => i.done)) return null
  if (d.buyerId !== me.id && !WEIGHMENT_WITNESS_ROLES.includes(ctx.role)) return null
  const lot = ctx.lot
  return {
    audit: { action: 'do.complete', target: lot?.lotNo ?? doId, detail: `Lifting completed — ${num(d.weighedQty ?? d.awardedQty)} ${d.uom} weighed vs ${num(d.awardedQty)} ${d.uom} indicative` },
    // Closing the handover is Operations' step, and it comes next.
    notification: {
      kind: 'system', title: `Lifting complete — ${lot?.lotNo ?? doId}`,
      body: `${num(d.weighedQty ?? d.awardedQty)} ${d.uom} off site. Close the handover to finish the sale.`,
      href: '/exec/handover',
    },
  }
}
