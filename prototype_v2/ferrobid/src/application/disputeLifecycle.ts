/* ---------------------------------------------------------------------------
   Application layer — opening and resolving a dispute ticket. Moved verbatim
   from miscSlice.ts's createDispute and subAdminSlice.ts's resolveDispute; no
   rule, threshold, or wording changed.

   resolveDispute's refund_due branch calls the existing raiseRefund action —
   a full, independently-validated Zustand action (its own role check, its
   own CEO-threshold gate, its own audit/notify) — not a pure calculation.
   That call is deliberately NOT inlined or duplicated here: duplicating its
   validation would risk the two copies drifting apart. Instead this is split
   into two pure steps around that one stateful call, exactly the shape the
   original action already had:
     1. planResolveDisputeGuards — the checks resolveDispute can make before
        ever calling raiseRefund (role, ticket exists, not already resolved,
        resolution required, amount required for refund_due).
     2. the Zustand adapter calls the real, untouched get().raiseRefund(...)
        when needed, exactly as the original inline call did.
     3. planResolveDisputeOutcome — the mutation/audit/notification plan,
        built from the now-known outcome of that call.
   See opsInspection.ts for the general pattern.
--------------------------------------------------------------------------- */
import { uid, inr } from '../lib/format'
import { checkAuth } from './authorization'
import type { Dispute, DisputeOutcome, Role, User } from '../types'
import type { NotificationPlan } from './opsInspection'

/* ------------------------------- createDispute ------------------------------- */

export interface CreateDisputeContext {
  currentUser: User | null
  lotNo: string | undefined
  now: number
}

export interface CreateDisputePlan {
  dispute: Dispute
  audit: { action: string; target: string; detail: string; severity: 'warning' }
  supportNotification: NotificationPlan
  customerNotification: NotificationPlan & { userId: string }
}

export type CreateDisputeResult =
  | { ok: true; plan: CreateDisputePlan }
  | { ok: false }

export function planCreateDispute(
  subject: string,
  category: Dispute['category'],
  body: string,
  lotId: string | undefined,
  ctx: CreateDisputeContext,
): CreateDisputeResult {
  const me = ctx.currentUser
  if (!me) return { ok: false }

  const at = new Date(ctx.now).toISOString()
  const dispute: Dispute = {
    id: uid('dsp'),
    userId: me.id, subject, category, lotId,
    status: 'open', createdAt: at,
    messages: [{ from: 'user', body, at }],
  }
  return {
    ok: true,
    plan: {
      dispute,
      /* A ticket is a customer waiting. It used to be the one
         customer-initiated action in the store that wrote no audit entry
         and told nobody — so the Sub Admin's own Approvals screen, which
         reviews the audit trail, could not see that support had been asked
         for anything. */
      audit: { action: 'dispute.open', target: dispute.id.toUpperCase(), detail: `${me.firm} raised "${subject}" (${category})`, severity: 'warning' },
      supportNotification: {
        kind: 'system', title: `New ticket — ${subject}`,
        body: `${me.firm} · ${category}${lotId ? ` · ${ctx.lotNo ?? ''}` : ''} — ${body.slice(0, 120)}`,
        href: '/sub/disputes',
      },
      customerNotification: {
        userId: me.id, kind: 'system', title: 'Your ticket is with support',
        body: 'Someone on the support desk will pick it up and reply here.',
        href: '/disputes',
      },
    },
  }
}

/* ------------------------------ resolveDispute -------------------------------- */

export interface ResolveDisputeGuardContext {
  role: Role
  dispute: Dispute | undefined
}

export type ResolveDisputeGuardResult =
  | { ok: true }
  | { ok: false; error: string }

export function planResolveDisputeGuards(
  outcome: DisputeOutcome,
  resolution: string,
  amount: number | undefined,
  ctx: ResolveDisputeGuardContext,
): ResolveDisputeGuardResult {
  const roleError = checkAuth('closeDispute', ctx.role)
  if (roleError) return { ok: false, error: roleError }
  const d = ctx.dispute
  if (!d) return { ok: false, error: 'Ticket not found' }
  if (d.status === 'resolved') return { ok: false, error: 'Already closed' }
  if (!resolution.trim()) return { ok: false, error: 'Say how it was resolved — the customer is shown this' }
  if (outcome === 'refund_due' && !(amount && amount > 0)) return { ok: false, error: 'Enter the amount owed back' }
  return { ok: true }
}

export interface ResolveDisputeOutcomeContext {
  dispute: Dispute
  actorId: string | undefined
  now: number
  refundRaised: boolean
  refundId: string | undefined
}

export interface ResolveDisputeOutcomePlan {
  disputeId: string
  closes: boolean
  refundId: string | undefined
  message: Dispute['messages'][number]
  resolvedAt: string | undefined
  resolvedById: string | undefined
  assignedToId: string | undefined
  audit: { action: string; target: string; detail: string; severity: 'warning' | 'info' }
  notification: NotificationPlan & { userId: string }
}

export function planResolveDisputeOutcome(
  outcome: DisputeOutcome,
  resolution: string,
  amount: number | undefined,
  ctx: ResolveDisputeOutcomeContext,
): ResolveDisputeOutcomePlan {
  const d = ctx.dispute
  const trimmed = resolution.trim()
  const at = new Date(ctx.now).toISOString()
  const closes = outcome !== 'refund_due'

  return {
    disputeId: d.id,
    closes,
    refundId: ctx.refundId,
    message: { from: 'support', body: trimmed, at },
    resolvedAt: closes ? at : undefined,
    resolvedById: closes ? ctx.actorId : undefined,
    assignedToId: d.assignedToId ?? ctx.actorId,
    audit: {
      action: 'dispute.resolve', target: d.id.toUpperCase(),
      detail: `"${d.subject}" — ${outcome.replace('_', ' ')}${ctx.refundRaised ? `, refund of ${inr(amount ?? 0)} raised with Finance` : ''}: ${trimmed}`,
      severity: outcome === 'declined' ? 'warning' : 'info',
    },
    notification: {
      userId: d.userId, kind: 'system',
      title: closes ? 'Your ticket has been resolved' : 'Your ticket has been decided — refund with Finance',
      body: ctx.refundRaised
        ? `${trimmed} A refund of ${inr(amount ?? 0)} is with Finance; the ticket stays open until it has been paid.`
        : trimmed,
      href: '/disputes',
    },
  }
}
