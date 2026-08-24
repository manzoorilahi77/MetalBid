/* ---------------------------------------------------------------------------
   Application layer — a support-desk reply on a dispute ticket. Moved
   verbatim from subAdminSlice.ts's replyToDispute; no rule or wording
   changed. See opsInspection.ts for the pattern.
--------------------------------------------------------------------------- */
import { checkAuth } from './authorization'
import type { Dispute, Role } from '../types'
import type { NotificationPlan } from './opsInspection'

export interface ReplyToDisputeContext {
  role: Role
  actorId: string | undefined
  dispute: Dispute | undefined
  now: number
}

export interface ReplyToDisputePlan {
  disputeId: string
  assignedToId: string | undefined
  message: Dispute['messages'][number]
  audit: { action: string; target: string; detail: string }
  notification: NotificationPlan & { userId: string }
}

export type ReplyToDisputeResult =
  | { ok: true; plan: ReplyToDisputePlan }
  | { ok: false; error: string }

export function planReplyToDispute(
  id: string,
  body: string,
  ctx: ReplyToDisputeContext,
): ReplyToDisputeResult {
  const roleError = checkAuth('replyToDispute', ctx.role)
  if (roleError) return { ok: false, error: roleError }
  if (!body.trim()) return { ok: false, error: 'Write the reply first' }
  const d = ctx.dispute
  if (!d) return { ok: false, error: 'Ticket not found' }
  if (d.status === 'resolved') return { ok: false, error: 'This ticket is closed' }

  const at = new Date(ctx.now).toISOString()
  return {
    ok: true,
    plan: {
      disputeId: id,
      assignedToId: d.assignedToId ?? ctx.actorId,
      message: { from: 'support', body: body.trim(), at },
      audit: { action: 'dispute.reply', target: d.id.toUpperCase(), detail: `Replied on "${d.subject}"` },
      notification: {
        userId: d.userId, kind: 'system', title: 'Support replied to your ticket',
        body: body.trim().slice(0, 140), href: '/disputes',
      },
    },
  }
}
