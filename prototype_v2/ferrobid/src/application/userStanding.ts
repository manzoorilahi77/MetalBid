/* ---------------------------------------------------------------------------
   Application layer — account standing (good / watchlist / defaulter). Moved
   verbatim from auctionFloorSlice.ts's setUserStanding; no rule, threshold,
   or wording changed beyond Phase 22.

   Phase 21/16: the original action carried no role guard at all — any
   caller could flip a user's standing; only the page (`/admin/users`,
   `/admin/blacklist`, both SUB_ADMIN_ROLES) gated who saw the control.
   Phase 22 (approved, behavior-changing): now requires SUB_ADMIN_ROLES
   (sub_admin/super_admin — the same set the pages already call ADMIN_ROLES)
   at the plan-function level too.
--------------------------------------------------------------------------- */
import { SUB_ADMIN_ROLES } from '../store/constants'
import type { Role, Standing, User } from '../types'
import type { NotificationPlan } from './opsInspection'

export interface SetUserStandingContext {
  role: Role
  u: User | undefined
  now: number
}

export interface SetUserStandingPlan {
  audit: { action: string; target: string; detail: string; severity: 'critical' | 'warning' }
  notification: NotificationPlan & { userId: string }
  financeNotification: NotificationPlan | null
}

export type SetUserStandingResult =
  | { ok: true; plan: SetUserStandingPlan }
  | { ok: false; error: string }

export function planSetUserStanding(userId: string, standing: Standing, reason: string | undefined, ctx: SetUserStandingContext): SetUserStandingResult {
  if (!SUB_ADMIN_ROLES.includes(ctx.role)) return { ok: false, error: 'Only a Sub Admin or Super Admin changes account standing' }
  const u = ctx.u
  return {
    ok: true,
    plan: {
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
    },
  }
}
