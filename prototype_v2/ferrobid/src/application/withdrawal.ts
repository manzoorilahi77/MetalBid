/* ---------------------------------------------------------------------------
   Application layer — a buyer requesting a wallet withdrawal. Moved verbatim
   from buyerSlice.ts's requestWithdrawal; no rule, threshold, or wording
   changed. This is the buyer wallet-withdrawal workflow, not server-
   authoritative EMD funding — that stays untouched. See opsInspection.ts for
   the pattern.
--------------------------------------------------------------------------- */
import { uid, inr } from '../lib/format'
import { withinWithdrawalWindow, nextWithdrawalWindowLabel } from '../store/constants'
import type { BankAccount, User, WithdrawalRequest, WithdrawalWindowConfig } from '../types'
import type { NotificationPlan } from './opsInspection'

export interface RequestWithdrawalContext {
  currentUser: User | null
  account: BankAccount | undefined
  walletBalance: number | undefined
  withdrawalWindow: WithdrawalWindowConfig
  withdrawalSecondSignatureFrom: number
  now: number
}

export interface RequestWithdrawalPlan {
  request: WithdrawalRequest
  ledgerNote: string
  audit: { action: string; target: string; detail: string }
  notification: NotificationPlan
}

export type RequestWithdrawalResult =
  | { ok: true; plan: RequestWithdrawalPlan }
  | { ok: false; error: string }

export function planRequestWithdrawal(
  amount: number,
  bankAccountId: string,
  ctx: RequestWithdrawalContext,
): RequestWithdrawalResult {
  const me = ctx.currentUser
  if (!me) return { ok: false, error: 'Sign in to request a withdrawal' }
  const account = ctx.account
  if (!account || account.status !== 'verified') return { ok: false, error: 'Select a verified bank account' }
  if (!(amount > 0)) return { ok: false, error: 'Enter an amount to withdraw' }
  if (ctx.walletBalance === undefined || amount > ctx.walletBalance) return { ok: false, error: 'Insufficient available balance' }
  if (!withinWithdrawalWindow(ctx.withdrawalWindow, ctx.now)) {
    return { ok: false, error: `Outside the withdrawal processing window. ${nextWithdrawalWindowLabel(ctx.withdrawalWindow, ctx.now)}` }
  }

  const ref = uid('wdr').toUpperCase()
  const req: WithdrawalRequest = {
    id: uid('wdr'), userId: me.id, amount, bankAccountId, ref,
    status: 'requested', requestedAt: new Date(ctx.now).toISOString(),
  }
  return {
    ok: true,
    plan: {
      request: req,
      ledgerNote: `Withdrawal requested to •••• ${account.last4}`,
      audit: { action: 'withdrawal.request', target: req.id, detail: `Withdrawal of ${inr(amount)} requested to •••• ${account.last4}` },
      // Money out runs on a window and a maker–checker; Finance is told at
      // the start of it, not when someone next opens the screen.
      notification: {
        kind: 'system', title: `Withdrawal to review — ${inr(amount)}`,
        body: `${me.firm} to ${account.bankName} •••• ${account.last4}.${amount >= ctx.withdrawalSecondSignatureFrom ? ' Above the second-signature threshold — a different Finance user must release it.' : ''}`,
        href: '/finance/withdrawals',
      },
    },
  }
}

/* ------------------------------- cancelWithdrawal ------------------------------ */

export interface CancelWithdrawalContext {
  request: WithdrawalRequest | undefined
  actor: User | null
  now: number
}

export interface CancelWithdrawalPlan {
  decidedAt: string
  ledgerEntry: { amount: number; ref: string; note: string }
  audit: { action: string; target: string; detail: string }
  deskNotification: NotificationPlan
  selfNotification: NotificationPlan & { userId: string }
}

export function planCancelWithdrawal(id: string, ctx: CancelWithdrawalContext): CancelWithdrawalPlan | null {
  const req = ctx.request
  const me = ctx.actor
  if (!req || !me || req.userId !== me.id || req.status !== 'requested') return null
  return {
    decidedAt: new Date(ctx.now).toISOString(),
    ledgerEntry: { amount: req.amount, ref: req.ref, note: 'Withdrawal cancelled by buyer — reversed' },
    audit: { action: 'withdrawal.cancel', target: id, detail: `Withdrawal of ${inr(req.amount)} cancelled by buyer — reversed` },
    // It was on Finance's desk; it has to visibly leave it.
    deskNotification: {
      kind: 'system', title: `Withdrawal withdrawn — ${inr(req.amount)}`,
      body: `${me.firm} cancelled their request before it was released. The balance is back in their wallet; nothing to process.`,
      href: '/finance/withdrawals',
    },
    selfNotification: {
      userId: me.id, kind: 'wallet', title: 'Withdrawal cancelled',
      body: `${inr(req.amount)} is back in your available balance.`, href: '/buyer/wallet',
    },
  }
}
