/* ---------------------------------------------------------------------------
   Application layer — the withdrawal maker-checker desk (review → release),
   plus the withdrawal-window config. Moved verbatim from
   auctionFloorSlice.ts's approveWithdrawal/processWithdrawal/failWithdrawal/
   setWithdrawalWindow; no rule, threshold, or wording changed.

   Review and release stay two separate actions on purpose — together with
   deposit approval, one person doing both would hold a complete round trip
   on customer money. `planProcessWithdrawal` returns a discriminated plan so
   the same-user block (a toast, not a refusal) and the real release stay
   exactly as distinct as they were inline.
--------------------------------------------------------------------------- */
import { inr } from '../lib/format'
import { FINANCE_ROLES } from '../store/constants'
import type { Role, WithdrawalRequest, WithdrawalWindowConfig } from '../types'
import type { NotificationPlan } from './opsInspection'

/* ------------------------------ approveWithdrawal ------------------------------ */

export interface ApproveWithdrawalContext {
  role: Role
  req: WithdrawalRequest | undefined
  actorId: string | undefined
  actorName: string | undefined
  requesterFirm: string
  withdrawalSecondSignatureFrom: number
  now: number
}

export interface ApproveWithdrawalPlan {
  reviewedAt: string
  audit: { action: string; target: string; detail: string }
  deskNotification: { plan: NotificationPlan; excludeUserId: string | undefined }
  requesterNotification: NotificationPlan & { userId: string }
}

export function planApproveWithdrawal(id: string, ctx: ApproveWithdrawalContext): ApproveWithdrawalPlan | null {
  if (!FINANCE_ROLES.includes(ctx.role)) return null
  const req = ctx.req
  if (!req || req.status !== 'requested') return null
  const reviewedAt = new Date(ctx.now).toISOString()
  const needsSecond = req.amount >= ctx.withdrawalSecondSignatureFrom
  return {
    reviewedAt,
    audit: { action: 'withdrawal.review', target: id, detail: `Withdrawal of ${inr(req.amount)} reviewed into processing by ${ctx.actorName ?? 'Finance'}` },
    deskNotification: {
      plan: {
        kind: 'system', title: `Withdrawal ready to release — ${inr(req.amount)}`,
        body: `${ctx.requesterFirm} · reviewed by ${ctx.actorName ?? 'Finance'}.${needsSecond ? ' Above the second-signature threshold — a different Finance user must release it.' : ''}`,
        href: '/finance/withdrawals',
      },
      excludeUserId: needsSecond ? ctx.actorId : undefined,
    },
    requesterNotification: {
      userId: req.userId, kind: 'wallet', title: 'Withdrawal under review',
      body: `${inr(req.amount)} has passed review and is queued for release to your verified account.`,
      href: '/buyer/wallet',
    },
  }
}

/* ------------------------------ processWithdrawal ------------------------------ */

export interface ProcessWithdrawalContext {
  role: Role
  req: WithdrawalRequest | undefined
  actorId: string | undefined
  actorName: string | undefined
  reviewerName: string | undefined
  withdrawalSecondSignatureFrom: number
  now: number
}

export type ProcessWithdrawalPlan =
  | {
    blocked: true
    toast: { kind: 'danger'; title: string; body: string }
    audit: { action: string; target: string; detail: string; severity: 'warning' }
  }
  | {
    blocked: false
    decidedAt: string
    audit: { action: string; target: string; detail: string }
    notification: NotificationPlan & { userId: string }
  }

export function planProcessWithdrawal(id: string, ctx: ProcessWithdrawalContext): ProcessWithdrawalPlan | null {
  if (!FINANCE_ROLES.includes(ctx.role)) return null
  const req = ctx.req
  if (!req || req.status !== 'under_review') return null

  if (req.amount >= ctx.withdrawalSecondSignatureFrom && req.reviewedBy && req.reviewedBy === ctx.actorId) {
    return {
      blocked: true,
      toast: {
        kind: 'danger', title: 'A second pair of hands is required',
        body: `You reviewed this withdrawal. Above ${inr(ctx.withdrawalSecondSignatureFrom)} it must be released by a different Finance user.`,
      },
      audit: { action: 'withdrawal.maker_checker_block', target: id, detail: `Same-user release refused on ${inr(req.amount)} — reviewer and processor must differ`, severity: 'warning' },
    }
  }

  return {
    blocked: false,
    decidedAt: new Date(ctx.now).toISOString(),
    audit: { action: 'withdrawal.process', target: id, detail: `Withdrawal of ${inr(req.amount)} released to bank by ${ctx.actorName ?? 'Finance'} — reviewed by ${ctx.reviewerName ?? 'Finance'}` },
    notification: { userId: req.userId, kind: 'wallet', title: 'Withdrawal processed', body: `${inr(req.amount)} sent to your bank account.`, href: '/buyer/wallet' },
  }
}

/* ------------------------------ failWithdrawal ------------------------------ */

export interface FailWithdrawalContext {
  role: Role
  req: WithdrawalRequest | undefined
  now: number
}

export interface FailWithdrawalPlan {
  decidedAt: string
  ledgerEntry: { amount: number; ref: string; note: string }
  audit: { action: string; target: string; detail: string; severity: 'warning' }
  notification: NotificationPlan & { userId: string }
}

export function planFailWithdrawal(id: string, reason: string | undefined, ctx: FailWithdrawalContext): FailWithdrawalPlan | null {
  if (!FINANCE_ROLES.includes(ctx.role)) return null
  const req = ctx.req
  if (!req || req.status !== 'under_review') return null
  return {
    decidedAt: new Date(ctx.now).toISOString(),
    ledgerEntry: { amount: req.amount, ref: req.ref, note: `Withdrawal failed — reversed${reason ? `: ${reason}` : ''}` },
    audit: { action: 'withdrawal.fail', target: id, detail: `Withdrawal of ${inr(req.amount)} failed${reason ? ` — ${reason}` : ''} — reversed to wallet`, severity: 'warning' },
    notification: { userId: req.userId, kind: 'wallet', title: 'Withdrawal failed', body: `${inr(req.amount)} reversed to your wallet.${reason ? ` Reason: ${reason}` : ''}`, href: '/buyer/wallet' },
  }
}

/* ------------------------------ setWithdrawalWindow ------------------------------ */

export interface SetWithdrawalWindowPlan {
  audit: { action: string; target: string; detail: string }
}

export function planSetWithdrawalWindow(config: WithdrawalWindowConfig, role: Role): SetWithdrawalWindowPlan | null {
  if (role !== 'super_admin') return null
  return {
    audit: {
      action: 'withdrawal.window_config', target: 'withdrawal_window',
      detail: `Withdrawal window updated — ${config.days.length} day(s)/week, ${String(config.startHour).padStart(2, '0')}:${String(config.startMinute).padStart(2, '0')}–${String(config.endHour).padStart(2, '0')}:${String(config.endMinute).padStart(2, '0')} IST`,
    },
  }
}
