/* ---------------------------------------------------------------------------
   Request authentication.

   `authenticate` runs on every request and never rejects — it only decides
   whether `req.auth` exists. Rejection is the job of `requireAuth` and
   `requireRole`, mounted per route, so a route with no guard is visibly
   unguarded rather than accidentally open.

   The database is consulted once per access token, not once per request: the
   token carries the user's id, role and token version, and a small cache holds
   the account row for a few seconds so a burst of requests from one screen does
   not become a burst of queries against a 150-connection shared server. The
   cache is keyed by user and cleared on any write that changes standing, so a
   suspension takes effect within seconds rather than within fifteen minutes.
--------------------------------------------------------------------------- */
import { pool } from '../db.mjs'
import { verifyAccessToken } from './tokens.mjs'
import { hasRole } from './roles.mjs'

const fail = (status, error, message) =>
  Object.assign(new Error(message), { status, code: error, expected: true })

/* ------------------------------ account cache ---------------------------- */
/* Small and short-lived on purpose: it exists to collapse the 6–10 parallel
   requests one screen makes, not to avoid the database. */
const CACHE_TTL_MS = 5_000
const cache = new Map()

export function invalidateUser(userId) { cache.delete(userId) }
export function invalidateAllUsers() { cache.clear() }

async function loadUser(userId) {
  const hit = cache.get(userId)
  if (hit && hit.until > Date.now()) return hit.user

  const [rows] = await pool.execute(
    `SELECT id, name, firm, email, login_email, role, status, token_version,
            kyc_status, seller_verified, standing, bidder_id, must_change_password
       FROM users WHERE id = ? LIMIT 1`, [userId])
  const user = rows[0] ?? null
  cache.set(userId, { user, until: Date.now() + CACHE_TTL_MS })
  return user
}

/* ------------------------------- middleware ------------------------------ */

/**
 * Populates `req.auth` when a valid Bearer token is present. Silent otherwise:
 * public endpoints must keep working for a visitor with no session.
 */
export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) return next()

    const claims = verifyAccessToken(header.slice(7).trim())
    if (!claims) return next()

    const user = await loadUser(claims.sub)
    if (!user) return next()

    /* Two ways a live token stops being valid before it expires: the account was
       suspended, or its token version moved (password change, forced sign-out).
       Both are checked here rather than trusted from the token. */
    if (user.status !== 'active') return next()
    if (Number(user.token_version) !== Number(claims.tv)) return next()

    req.auth = {
      userId: user.id,
      role: user.role,
      name: user.name,
      firm: user.firm,
      email: user.login_email ?? user.email,
      standing: user.standing,
      kycStatus: user.kyc_status,
      sellerVerified: !!user.seller_verified,
      bidderId: user.bidder_id,
      mustChangePassword: !!user.must_change_password,
      tokenExpiresAt: claims.exp,
    }
    next()
  } catch (err) {
    next(err)
  }
}

/** Any signed-in account. */
export function requireAuth(req, _res, next) {
  if (!req.auth) return next(fail(401, 'unauthenticated', 'Sign in to continue'))
  next()
}

/**
 * A signed-in account holding one of `allowed`. The Super Admin satisfies every
 * requirement except one explicitly naming the CEO — see roles.mjs.
 *
 * The 403 message deliberately does not name the roles that would have worked:
 * an error that enumerates the permission model is an error that maps it.
 */
export function requireRole(...allowed) {
  const flat = allowed.flat()
  return (req, _res, next) => {
    if (!req.auth) return next(fail(401, 'unauthenticated', 'Sign in to continue'))
    if (!hasRole(req.auth.role, flat)) {
      return next(fail(403, 'forbidden', 'Your role cannot access this'))
    }
    next()
  }
}

/**
 * The caller must be the user named in `:param`, or hold one of `staffRoles`.
 * This is the guard that closes the original hole — `/api/buyer/:buyerId` took
 * any id from anyone.
 */
export function requireSelfOrRole(param, ...staffRoles) {
  const flat = staffRoles.flat()
  return (req, _res, next) => {
    if (!req.auth) return next(fail(401, 'unauthenticated', 'Sign in to continue'))
    if (req.auth.userId === req.params[param]) return next()
    if (hasRole(req.auth.role, flat)) return next()
    /* 404, not 403: confirming that an id exists but is not yours is itself a
       disclosure — it turns the endpoint into a directory of account ids. */
    return next(fail(404, 'not_found', 'No such user'))
  }
}

/** Blocks a suspended or defaulting account from acting, while still letting it
 *  read. Applied to bidding and money movement, not to GETs. */
export function requireGoodStanding(req, _res, next) {
  if (!req.auth) return next(fail(401, 'unauthenticated', 'Sign in to continue'))
  if (req.auth.standing === 'defaulter') {
    return next(fail(403, 'account_restricted',
      'This account is marked as a defaulter and cannot bid or move money. Contact support.'))
  }
  next()
}
