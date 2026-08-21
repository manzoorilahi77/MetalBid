/* ---------------------------------------------------------------------------
   Route guards: who is allowed to be on this page at all.

   Until now the router had none. Every role's routes were nested under a layout
   that fetched that role's data and drew its tab strip, but nothing checked who
   was asking — so a signed-in buyer who typed `#/admin/audit`, or a visitor with
   no account at all who typed `#/finance/pnl`, got the page. The API refused the
   data, so the screen came up empty with "Server not connected" on it, which
   reads as a broken app rather than a closed door.

   Two things to be clear about:

   * This is not a security control. The server decides what may be read and
     written, and it already does — see auth/roles.mjs and api/policy.mjs, which
     are deliberately a separate copy of these groupings for exactly this reason.
     What this fixes is the *routing*: the wrong page should not open, and when
     it doesn't, the app should say why.

   * The groupings below mirror the server's. Where they disagree the server
     wins, and the symptom is a page that opens but cannot load — so they are
     written here in the same shape, next to each other, to be checked against
     auth/roles.mjs by eye.
--------------------------------------------------------------------------- */
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ROLE_HOME, isAnonymousRole, useStore } from '../store/store'
import type { Role } from '../types'

/* Mirrors of server/src/auth/roles.mjs. Kept as literals rather than imported
   from the store's capability groups, because those exist to decide which
   buttons to draw and these decide which pages exist — the two drift for good
   reasons, and a shared constant would hide it when they do. */
export const ADMIN_ROLES: Role[] = ['sub_admin', 'super_admin']
export const AUCTION_CONTROL_ROLES: Role[] = ['auction_manager', 'exec_manager', 'sub_admin', 'super_admin']
export const CEO_ROLES: Role[] = ['ceo', 'super_admin']
/** The pipeline desk: the Operation Manager's own screens, which the Sub Admin
 *  works alongside them rather than in a copy of their own. */
export const EXEC_ROLES: Role[] = ['exec_manager', 'sub_admin', 'super_admin']
/** Reading the books is shared; moving money is not — that split is enforced
 *  per-action inside the Finance pages, not here. */
export const FINANCE_ROLES: Role[] = ['finance_admin', 'ceo', 'sub_admin', 'super_admin']
/** A field executive's queue, plus the two roles who supervise it. */
export const FIELD_ROLES: Role[] = ['field_exec', 'exec_manager', 'sub_admin', 'super_admin']

/** Rendered while the boot-time session restore is still in flight. Deliberately
 *  not a spinner: the restore is one round trip and usually beats first paint,
 *  so a spinner would be a flash of chrome that means nothing. */
function Resolving() {
  return null
}

/**
 * Gate a block of routes on the viewer's role.
 *
 * Nobody signed in → the login page, remembering where they were headed so the
 * sign-in can finish the journey rather than dumping them on a dashboard.
 * Signed in as the wrong role → their own home, because they do have somewhere
 * to be; bouncing them to a 404 or a login form would be a lie about why.
 */
export function RequireRole({ allow }: { allow: Role[] }) {
  const role = useStore((s) => s.role)
  const currentUser = useStore((s) => s.currentUser)
  const sessionStatus = useStore((s) => s.sessionStatus)
  const { pathname, search } = useLocation()

  /* Identity is not known yet — decide nothing. Without this every reload of a
     deep link would bounce to /login for the one round trip the restore takes,
     and land the user somewhere they did not ask to go. */
  if (sessionStatus === 'restoring') return <Resolving />

  const toLogin = <Navigate to={`/login?from=${encodeURIComponent(`${pathname}${search}`)}`} replace />

  /* An anonymous role can be a legitimate answer, not just the absence of one:
     the guest tour genuinely belongs on the buyer's marketplace. So a block
     that names one admits it, and every other anonymous visitor is asked to
     sign in. Which pages within such a block a guest may see is GuestGate's
     job, not this one's — see GUEST_ALLOWED_PREFIXES. */
  if (isAnonymousRole(role)) return allow.includes(role) ? <Outlet /> : toLogin

  if (!currentUser) return toLogin
  if (!allow.includes(role)) return <Navigate to={ROLE_HOME[role]} replace />

  return <Outlet />
}

/**
 * Gate a block of routes on being signed in at all, whatever the role.
 *
 * For the pages every account holds — the profile, notification preferences —
 * where the question is "is this anybody?" rather than "is this the right
 * somebody?".
 */
export function RequireAuth() {
  const role = useStore((s) => s.role)
  const currentUser = useStore((s) => s.currentUser)
  const sessionStatus = useStore((s) => s.sessionStatus)
  const { pathname, search } = useLocation()

  if (sessionStatus === 'restoring') return <Resolving />

  if (!currentUser || isAnonymousRole(role)) {
    const from = encodeURIComponent(`${pathname}${search}`)
    return <Navigate to={`/login?from=${from}`} replace />
  }

  return <Outlet />
}
