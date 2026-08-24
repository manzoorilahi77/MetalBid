/* ---------------------------------------------------------------------------
   Application layer — account standing (good / watchlist / defaulter). Moved
   verbatim from auctionFloorSlice.ts's setUserStanding; no rule, threshold,
   or wording changed.

   Pre-existing finding, not fixed here: the original action carries no role
   guard at all — any caller can flip a user's standing. Documented, not
   fabricated into a guard that never existed. Matches the same
   no-pre-existing-guard pattern already flagged for setSellerLotDecision and
   recordCommissionSettlement (phase 10).
--------------------------------------------------------------------------- */
import type { Standing, User } from '../types'
import type { NotificationPlan } from './opsInspection'

export interface SetUserStandingContext {
  u: User | undefined
  now: number
}

export interface SetUserStandingPlan {
  audit: { action: string; target: string; detail: string; severity: 'critical' | 'warning' }
  notification: NotificationPlan & { userId: string }
  financeNotification: NotificationPlan | null
}

export function planSetUserStanding(userId: string, standing: Standing, reason: string | undefined, ctx: SetUserStandingContext): SetUserStandingPlan {
  const u = ctx.u
  return {
    audit: {
      action: 'user.standing', target: u?.firm ?? userId,
      detail: `Standing set to ${standing}${reason ? ` — ${reason}` : ''}`,
      severity: standing === 'defaulter' ? 'critical' : 'warning',
    },
    notification: {
      userId, kind: 'system',
      title: {
        good: 'Your account standing has been restored',
        watchlist: 'Your account has been placed on watchlist',
        defaulter: 'Your account has been restricted',
      }[standing],
      body: standing === 'good'
        ? 'Full access is back. Nothing further is needed from you.'
        : `${reason ?? 'Reviewed by our operations team.'} Contact support if you believe this is a mistake.`,
      href: '/disputes',
    },
    // Money at risk against a restricted account is Finance's problem too.
    financeNotification: standing === 'defaulter'
      ? {
        kind: 'system', title: `Account restricted — ${u?.firm ?? userId}`,
        body: `${reason ?? 'Marked as a defaulter by operations.'} Check any EMD held and open delivery orders against this account.`,
        href: '/finance/emd',
      }
      : null,
  }
}
