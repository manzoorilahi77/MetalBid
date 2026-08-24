/* ---------------------------------------------------------------------------
   Application layer — the refund lifecycle: raising a request (Finance, or a
   Sub Admin closing a dispute in the customer's favour), Finance's approve/
   reject decision, and processing an approved refund into the wallet. Moved
   verbatim from financeSlice.ts's raiseRefund/decideRefund/processRefund; no
   rule, threshold, or wording changed.

   Raising and deciding never touch a wallet — only `processRefund` credits
   one, and it does so the same way `cancelWithdrawal` (already migrated,
   src/application/withdrawal.ts) and `topUpWallet` do: a single-actor
   additive balance change with a ledger entry, no read-modify-write race
   with the live bidding engine. That is the same shape already approved as
   in-scope in earlier phases — unlike fundEmd/placeBid, nothing here
   competes with concurrent bidders for the same lot, so it is not the
   server-authoritative EMD/wallet concurrency path the standing exclusion
   is about. See opsInspection.ts for the pattern.
--------------------------------------------------------------------------- */
import { uid, inr } from '../lib/format'
import { FINANCE_ROLES } from '../store/constants'
import type { Dispute, RefundRequest, RefundSource, Role, User } from '../types'
import type { NotificationPlan } from './opsInspection'

/* --------------------------------- raiseRefund -------------------------------- */

export interface RaiseRefundInput {
  userId: string
  amount: number
  source: RefundSource
  reason: string
  lotId?: string
  catalogueId?: string
  disputeId?: string
}

export interface RaiseRefundContext {
  role: Role
  actorId: string | undefined
  ceoRefundFrom: number
  party: User | undefined
  now: number
}

export interface RaiseRefundPlan {
  record: RefundRequest
  overThreshold: boolean
  ceoApproval: { kind: 'refund'; refId: string; amount: number; summary: string; reason: string } | null
  audit: { action: string; target: string; detail: string; severity: 'info' | 'warning' }
  deskNotification: NotificationPlan | null
}

export type RaiseRefundResult =
  | { ok: true; plan: RaiseRefundPlan }
  | { ok: false; error: string }

export function planRaiseRefund(input: RaiseRefundInput, ctx: RaiseRefundContext): RaiseRefundResult {
  // Raising is a request, not a movement — which is why a Sub Admin or Exec
  // Manager closing a dispute in the customer's favour may raise the refund
  // it owes (Phase 22: exec_manager already closes tickets under
  // SUPPORT_ROLES but was left out of this carve-out, so resolving a ticket
  // with a refund_due outcome failed here with no way to complete it). It
  // still lands in Finance's queue at `pending` and Finance both approves
  // and pays it; nothing here touches a wallet.
  const mayRaise = FINANCE_ROLES.includes(ctx.role) || ((ctx.role === 'sub_admin' || ctx.role === 'exec_manager') && !!input.disputeId)
  if (!mayRaise) return { ok: false, error: 'Only Finance can raise a refund' }
  if (!(input.amount > 0)) return { ok: false, error: 'Enter the amount to return' }

  const overThreshold = input.amount >= ctx.ceoRefundFrom
  const record: RefundRequest = {
    id: uid('ref'), userId: input.userId, amount: input.amount, source: input.source, reason: input.reason,
    lotId: input.lotId, catalogueId: input.catalogueId, disputeId: input.disputeId,
    status: overThreshold ? 'awaiting_ceo' : 'pending',
    raisedBy: ctx.actorId ?? 'system',
    raisedAt: new Date(ctx.now).toISOString(),
  }
  const party = ctx.party
  if (overThreshold) {
    return {
      ok: true,
      plan: {
        record, overThreshold: true,
        ceoApproval: { kind: 'refund', refId: record.id, amount: input.amount, summary: `Refund ${inr(input.amount)} to ${party?.firm ?? input.userId}`, reason: input.reason },
        audit: { action: 'refund.raise', target: party?.firm ?? input.userId, detail: `Refund of ${inr(input.amount)} sent for CEO sign-off — ${input.reason}`, severity: 'warning' },
        deskNotification: null,
      },
    }
  }
  return {
    ok: true,
    plan: {
      record, overThreshold: false, ceoApproval: null,
      audit: { action: 'refund.raise', target: party?.firm ?? input.userId, detail: `Refund of ${inr(input.amount)} raised — ${input.reason}`, severity: 'info' },
      /* A Sub Admin closing a dispute in the customer's favour can raise this,
         but only Finance approves and pays it — so Finance is told rather than
         the request waiting to be noticed on a queue. */
      deskNotification: {
        kind: 'system', title: `Refund to decide — ${inr(input.amount)}`,
        body: `${party?.firm ?? 'A customer'} · ${input.reason}${input.disputeId ? ' (raised from a dispute — the ticket stays open until it is paid)' : ''}`,
        href: '/finance/refunds',
      },
    },
  }
}

/* --------------------------------- decideRefund -------------------------------- */

export interface DecideRefundContext {
  role: Role
  record: RefundRequest | undefined
  party: User | undefined
  now: number
}

export interface DecideRefundPlan {
  approve: boolean
  decidedAt: string
  audit: { action: string; target: string; detail: string; severity: 'info' | 'warning' }
  notification: (NotificationPlan & { userId: string }) | null
}

export function planDecideRefund(
  approve: boolean,
  note: string | undefined,
  ctx: DecideRefundContext,
): DecideRefundPlan | null {
  if (!FINANCE_ROLES.includes(ctx.role)) return null
  const record = ctx.record
  if (!record || (record.status !== 'pending' && record.status !== 'awaiting_ceo')) return null
  const party = ctx.party
  return {
    approve,
    decidedAt: new Date(ctx.now).toISOString(),
    audit: {
      action: approve ? 'refund.approve' : 'refund.reject', target: party?.firm ?? record.userId,
      detail: `${approve ? 'Refund approved' : 'Refund refused'} — ${inr(record.amount)}${note ? ` · ${note}` : ''}`,
      severity: approve ? 'info' : 'warning',
    },
    notification: !approve
      ? { userId: record.userId, kind: 'wallet', title: 'Refund not approved', body: note || 'Held pending review. Your dispute stays open.', href: '/disputes' }
      : null,
  }
}

/* -------------------------------- processRefund -------------------------------- */

export interface ProcessRefundContext {
  role: Role
  record: RefundRequest | undefined
  party: User | undefined
  dispute: Dispute | undefined
  now: number
}

export interface ProcessRefundDisputeClose {
  disputeId: string
  resolvedAt: string
  resolvedById: string | undefined
  message: { from: 'support'; body: string; at: string }
  audit: { action: string; target: string; detail: string }
}

export interface ProcessRefundPlan {
  processedAt: string
  ledgerEntry: { amount: number; ref: string; note: string }
  audit: { action: string; target: string; detail: string }
  notification: NotificationPlan & { userId: string }
  disputeClose: ProcessRefundDisputeClose | null
}

export type ProcessRefundResult =
  | { ok: true; plan: ProcessRefundPlan }
  | { ok: false; error: string }

export function planProcessRefund(ctx: ProcessRefundContext): ProcessRefundResult {
  if (!FINANCE_ROLES.includes(ctx.role)) return { ok: false, error: 'Only Finance can process a refund' }
  const record = ctx.record
  if (!record) return { ok: false, error: 'Refund not found' }
  if (record.status !== 'approved') return { ok: false, error: 'Approve the refund before processing it' }

  const at = new Date(ctx.now).toISOString()
  const party = ctx.party
  const d = ctx.dispute
  // The last link in the support chain. A Sub Admin decided the dispute and
  // held it open because money was owed; paying it is what actually closes
  // it, so Finance closes it here rather than leaving the customer with a
  // ticket that is only resolved once somebody remembers to say so.
  const shouldCloseDispute = !!record.disputeId && !!d && d.status !== 'resolved'

  return {
    ok: true,
    plan: {
      processedAt: at,
      ledgerEntry: { amount: record.amount, ref: record.id, note: `Refund — ${record.reason}` },
      audit: { action: 'refund.process', target: party?.firm ?? record.userId, detail: `Refund of ${inr(record.amount)} credited to wallet — ${record.reason}` },
      notification: { userId: record.userId, kind: 'wallet', title: 'Refund credited', body: `${inr(record.amount)} has been returned to your wallet.`, href: '/buyer/wallet' },
      disputeClose: shouldCloseDispute
        ? {
          disputeId: record.disputeId!,
          resolvedAt: at,
          resolvedById: d!.resolvedById ?? d!.assignedToId,
          message: { from: 'support', body: `${inr(record.amount)} has been returned to your wallet. This closes the ticket — reply here if anything is still outstanding.`, at },
          audit: { action: 'dispute.closed', target: d!.id.toUpperCase(), detail: `Closed on payment of the ${inr(record.amount)} refund` },
        }
        : null,
    },
  }
}
