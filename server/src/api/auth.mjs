/* ---------------------------------------------------------------------------
   Sign in, sign out, and everything that hangs off an identity.

   Three properties this file is written to hold:

   1. **A failed login tells you nothing.** Unknown account, wrong password,
      locked, suspended — one message, and the unknown-account path still runs a
      hash so the response time does not sort real accounts from imaginary ones.

   2. **Lockout is per account and per address.** Per account alone lets one
      attacker lock every user out of their own accounts; per address alone is
      defeated by a botnet. Both, with different thresholds.

   3. **Every attempt is written down.** `login_attempts` is the durable half of
      the throttle and the answer to "was this account being probed".
--------------------------------------------------------------------------- */
import { pool } from '../db.mjs'
import { env } from '../env.mjs'
import { toDbDateTime } from '../time.mjs'
import { hashPassword, verifyPassword, needsRehash, passwordProblem, generateTempPassword } from '../auth/password.mjs'
import { signAccessToken, ACCESS_TTL_SECONDS, newId } from '../auth/tokens.mjs'
import { issueSession, rotateSession, revokeByToken, revokeAllForUser, listSessions } from '../auth/sessions.mjs'
import { invalidateUser } from '../auth/middleware.mjs'
import { isAnonymous, ADMIN_ROLES, hasRole } from '../auth/roles.mjs'
import { str, email as emailField, id as idField } from './validate.mjs'

const reject = (message, status = 401, code = 'invalid_credentials') =>
  Object.assign(new Error(message), { status, code, expected: true })

/* One message for every way a sign-in can fail. */
const GENERIC_FAILURE = 'That user ID and password do not match an account'

/* Thresholds. Account lockout is short — long enough to make guessing
   impractical, short enough that a real user who fat-fingered twice is not
   locked out of a live auction they have EMD in.

   Loosened outside production: repeated wrong-password testing should not
   spend fifteen minutes locked out of the box under test. */
const PRODUCTION = env.NODE_ENV === 'production'
const ACCOUNT_MAX_FAILURES = PRODUCTION ? 5 : 100
const ACCOUNT_LOCK_MINUTES = 15
const IP_MAX_FAILURES = PRODUCTION ? 20 : 500
const IP_WINDOW_MINUTES = 15

/* --------------------------------- login --------------------------------- */

export async function login({ identifier, password, ip, userAgent }) {
  const typed = str(identifier, 'User ID', { max: 191 }).toLowerCase()
  const secret = str(password, 'Password', { max: 200, trim: false })

  /* Address-level throttle first: it is one indexed count and it protects the
     expensive path behind it. */
  const [[ipRow]] = await pool.execute(
    `SELECT COUNT(*) AS n FROM login_attempts
      WHERE ip = ? AND outcome <> 'ok' AND at > ?`,
    [ip ?? '', toDbDateTime(new Date(Date.now() - IP_WINDOW_MINUTES * 60_000))])
  if (Number(ipRow.n) >= IP_MAX_FAILURES) {
    await record({ identifier: typed, ip, userAgent, outcome: 'throttled' })
    throw reject(`Too many failed attempts from this network. Try again in ${IP_WINDOW_MINUTES} minutes.`,
      429, 'rate_limited')
  }

  const [rows] = await pool.execute(
    `SELECT id, name, role, status, token_version, password_hash, failed_attempts, locked_until,
            must_change_password
       FROM users WHERE login_email = ? LIMIT 1`, [typed])
  const user = rows[0] ?? null

  /* No account: still spend the time a real verify would, so the two cases are
     not distinguishable by how long they take. */
  if (!user || !user.password_hash) {
    await verifyPassword(secret, DUMMY_HASH)
    await record({ identifier: typed, ip, userAgent, outcome: 'unknown_user' })
    throw reject(GENERIC_FAILURE)
  }

  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    await record({ identifier: typed, userId: user.id, ip, userAgent, outcome: 'locked' })
    throw reject(GENERIC_FAILURE)
  }

  if (user.status !== 'active') {
    await verifyPassword(secret, DUMMY_HASH)
    await record({ identifier: typed, userId: user.id, ip, userAgent, outcome: 'suspended' })
    throw reject(GENERIC_FAILURE)
  }

  /* An anonymous shell is not an account. If one ever ends up with a password
     row, refuse it rather than mint a token for a role with no owner. */
  if (isAnonymous(user.role)) {
    await record({ identifier: typed, userId: user.id, ip, userAgent, outcome: 'suspended' })
    throw reject(GENERIC_FAILURE)
  }

  const ok = await verifyPassword(secret, user.password_hash)
  if (!ok) {
    const failures = Number(user.failed_attempts) + 1
    const lock = failures >= ACCOUNT_MAX_FAILURES
      ? new Date(Date.now() + ACCOUNT_LOCK_MINUTES * 60_000)
      : null
    await pool.execute(
      `UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?`,
      [failures, lock ? toDbDateTime(lock) : null, user.id])
    await record({ identifier: typed, userId: user.id, ip, userAgent, outcome: 'bad_password' })
    throw reject(GENERIC_FAILURE)
  }

  /* Success. Clear the counters, note the login, and — while the plaintext is
     briefly in hand — upgrade the hash if the cost parameters have moved. */
  const now = new Date()
  const rehash = needsRehash(user.password_hash) ? await hashPassword(secret) : null
  await pool.execute(
    `UPDATE users
        SET failed_attempts = 0, locked_until = NULL, last_login_at = ?
            ${rehash ? ', password_hash = ?, password_set_at = ?' : ''}
      WHERE id = ?`,
    rehash ? [toDbDateTime(now), rehash, toDbDateTime(now), user.id] : [toDbDateTime(now), user.id])
  invalidateUser(user.id)

  await record({ identifier: typed, userId: user.id, ip, userAgent, outcome: 'ok' })

  const session = await issueSession({ userId: user.id, ip, userAgent })
  return {
    ...tokenBundle(user, session),
    mustChangePassword: !!user.must_change_password,
  }
}

/* -------------------------------- refresh -------------------------------- */

export async function refresh({ refreshToken, ip, userAgent }) {
  const token = str(refreshToken, 'Refresh token', { max: 512, trim: false })
  const result = await rotateSession({ token, ip, userAgent })

  if (!result.ok) {
    if (result.reason === 'reuse_detected') {
      /* Belt and braces: rotateSession already killed the family. Bumping the
         token version kills the access tokens that are still in flight too. */
      await pool.execute('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [result.userId])
      invalidateUser(result.userId)
      console.warn(`[auth] refresh token reuse for user ${result.userId} — family ${result.familyId} revoked`)
    }
    throw reject('Your session has expired. Sign in again.', 401, 'session_expired')
  }

  const [rows] = await pool.execute(
    `SELECT id, name, role, status, token_version, must_change_password FROM users WHERE id = ? LIMIT 1`,
    [result.userId])
  const user = rows[0]
  if (!user || user.status !== 'active') {
    await revokeAllForUser(result.userId, 'account_inactive')
    throw reject('Your session has expired. Sign in again.', 401, 'session_expired')
  }

  return {
    ...tokenBundle(user, result),
    mustChangePassword: !!user.must_change_password,
  }
}

/* ----------------------------- impersonation ------------------------------
   A Sub/Super Admin opening another account's session directly — a support
   answer or "does this look right for this role" check, not a credential a
   real sign-in would ever produce. Three roles are refused as a target,
   deliberately narrower than who may act as an admin:

     · super_admin  — the vendor break-glass account; nothing here is a
       legitimate reason to hold its session
     · sub_admin    — impersonation between admins would let one quietly act
       as another and defeat "whoever acts is named in the audit entry",
       which every admin screen in this app depends on
     · ceo          — the one signing authority the CMS's four-eyes rule
       exists to protect; borrowing it would let an admin forge a signature

   Everything else — buyer, seller and every staff desk — is exactly the set
   "different accounts" in the ask means, and exactly what a support case
   needs to reproduce. */

const IMPERSONATION_BLOCKED_ROLES = ['super_admin', 'sub_admin', 'ceo']

export async function impersonate({ auth, userId, ip, userAgent }) {
  if (!hasRole(auth.role, ADMIN_ROLES)) throw reject('Your role cannot sign in as another account', 403, 'forbidden')
  const target = idField(userId, 'userId')
  if (target === auth.userId) throw reject('You are already signed in as this account', 400, 'invalid_request')

  const [rows] = await pool.execute(
    `SELECT id, name, role, status, token_version FROM users WHERE id = ? LIMIT 1`, [target])
  const user = rows[0]
  if (!user) throw reject('No such user', 404, 'not_found')
  if (IMPERSONATION_BLOCKED_ROLES.includes(user.role)) {
    throw reject('This account cannot be signed into this way', 403, 'forbidden')
  }
  if (user.status !== 'active') {
    throw reject(`This account is ${user.status} and cannot sign in`, 409, 'invalid_request')
  }

  const session = await issueSession({ userId: user.id, ip, userAgent, impersonatedBy: auth.userId })
  console.warn(`[auth] ${auth.userId} (${auth.role}) signed in as ${user.id} (${user.role}) — session ${session.sessionId}`)
  return tokenBundle(user, session)
}

/* -------------------------------- sign out ------------------------------- */

export async function logout({ refreshToken, userId, everywhere = false }) {
  if (everywhere && userId) {
    await pool.execute('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [userId])
    invalidateUser(userId)
    const n = await revokeAllForUser(userId, 'signed_out_everywhere')
    return { ok: true, sessionsEnded: n }
  }
  if (refreshToken) {
    const done = await revokeByToken(refreshToken)
    return { ok: true, sessionsEnded: done ? 1 : 0 }
  }
  return { ok: true, sessionsEnded: 0 }
}

/* ---------------------------------- me ----------------------------------- */

/** The account behind the current token, plus its live sessions. This is what
 *  the frontend calls on boot to decide whether it still has a session. */
export async function me(auth) {
  const [rows] = await pool.execute(
    `SELECT id, name, firm, phone, email, login_email, role, status, kyc_status, seller_verified,
            standing, city, gstin, avatar_hue, bidder_id, joined_at, last_login_at,
            must_change_password, password_set_at
       FROM users WHERE id = ? LIMIT 1`, [auth.userId])
  const u = rows[0]
  if (!u) throw reject('No such user', 404, 'not_found')

  return {
    user: {
      id: u.id, name: u.name, firm: u.firm, phone: u.phone,
      email: u.login_email ?? u.email, role: u.role, status: u.status,
      kycStatus: u.kyc_status, sellerVerified: !!u.seller_verified, standing: u.standing,
      city: u.city, gstin: u.gstin, avatarHue: Number(u.avatar_hue), bidderId: u.bidder_id,
      joinedAt: u.joined_at ? new Date(u.joined_at).toISOString() : null,
      lastLoginAt: u.last_login_at ? new Date(u.last_login_at).toISOString() : null,
      mustChangePassword: !!u.must_change_password,
      passwordSetAt: u.password_set_at ? new Date(u.password_set_at).toISOString() : null,
    },
    sessions: await listSessions(auth.userId),
  }
}

/* ---------------------------- change password ---------------------------- */

export async function changePassword({ auth, currentPassword, newPassword, keepOtherSessions = false }) {
  const current = str(currentPassword, 'Current password', { max: 200, trim: false })
  const next = str(newPassword, 'New password', { max: 200, trim: false })

  const [rows] = await pool.execute(
    `SELECT id, name, login_email, password_hash FROM users WHERE id = ? LIMIT 1`, [auth.userId])
  const u = rows[0]
  if (!u) throw reject('No such user', 404, 'not_found')

  if (!u.password_hash || !(await verifyPassword(current, u.password_hash))) {
    throw reject('Your current password is not right', 403, 'invalid_credentials')
  }
  if (current === next) throw reject('Choose a password you have not just used', 400, 'invalid_request')

  const problem = passwordProblem(next, { email: u.login_email, name: u.name })
  if (problem) throw reject(problem, 400, 'weak_password')

  const now = new Date()
  await pool.execute(
    `UPDATE users
        SET password_hash = ?, password_set_at = ?, must_change_password = 0,
            failed_attempts = 0, locked_until = NULL,
            token_version = token_version + 1
      WHERE id = ?`,
    [await hashPassword(next), toDbDateTime(now), u.id])
  invalidateUser(u.id)

  /* Changing a password signs the account out everywhere by default — that is
     the entire point of doing it when you suspect someone else has it. */
  if (!keepOtherSessions) await revokeAllForUser(u.id, 'password_changed')

  const session = await issueSession({ userId: u.id })
  const [[fresh]] = await pool.execute(
    'SELECT id, name, role, token_version FROM users WHERE id = ? LIMIT 1', [u.id])
  return tokenBundle(fresh, session)
}

/* ------------------------- admin-issued passwords ------------------------ */

/**
 * A Sub Admin (or the break-glass Super Admin) issues a temporary password.
 * Shown to them once, stored only as a hash, and flagged so the account must
 * change it at next sign-in.
 */
export async function issueTemporaryPassword({ auth, userId, password = null }) {
  if (!hasRole(auth.role, ADMIN_ROLES)) throw reject('Your role cannot reset passwords', 403, 'forbidden')
  const target = idField(userId, 'userId')

  const [rows] = await pool.execute('SELECT id, role, name, login_email FROM users WHERE id = ? LIMIT 1', [target])
  const u = rows[0]
  if (!u) throw reject('No such user', 404, 'not_found')

  /* Only the break-glass account may reset another admin's password: otherwise
     one Sub Admin can take over another's account, and "who did this" stops
     being answerable. */
  if (hasRole(u.role, ADMIN_ROLES) && auth.role !== 'super_admin' && auth.userId !== u.id) {
    throw reject('Only platform support can reset an administrator password', 403, 'forbidden')
  }

  /* "Set by hand" in the admin UI — support reading it out on a call, or
     matching one the account holder asked for. Same rule a self-chosen
     password has to meet; the difference is who typed it. */
  let temp = generateTempPassword()
  if (password !== null) {
    const chosen = str(password, 'Password', { max: 200, trim: false })
    const problem = passwordProblem(chosen, { email: u.login_email, name: u.name })
    if (problem) throw reject(problem, 400, 'weak_password')
    temp = chosen
  }
  const now = new Date()
  await pool.execute(
    `UPDATE users
        SET password_hash = ?, password_set_at = ?, must_change_password = 1,
            failed_attempts = 0, locked_until = NULL, token_version = token_version + 1
      WHERE id = ?`,
    [await hashPassword(temp), toDbDateTime(now), u.id])
  invalidateUser(u.id)
  await revokeAllForUser(u.id, 'password_reset_by_admin')

  await pool.execute(
    `INSERT INTO password_resets (id, user_id, mode, password, at, by_id)
     VALUES (?, ?, 'temporary', NULL, ?, ?)`,
    [newId('pwr'), u.id, toDbDateTime(now), auth.userId],
  ).catch((err) => {
    /* The reset itself succeeded; an audit-row failure must be loud but must not
       roll the password back to one nobody now knows. */
    console.error('[auth] password_resets insert failed', err)
  })

  return { userId: u.id, temporaryPassword: temp, mustChangePassword: true }
}

/** Set a password directly — used by scripts/set-password.mjs and by seeding. */
export async function setPasswordDirect({ userId, password, mustChange = false }) {
  const problem = passwordProblem(password)
  if (problem) throw reject(problem, 400, 'weak_password')
  const now = new Date()
  const [res] = await pool.execute(
    `UPDATE users
        SET password_hash = ?, password_set_at = ?, must_change_password = ?,
            failed_attempts = 0, locked_until = NULL, token_version = token_version + 1
      WHERE id = ?`,
    [await hashPassword(password), toDbDateTime(now), mustChange ? 1 : 0, userId])
  invalidateUser(userId)
  return res.affectedRows > 0
}

/* -------------------------------- helpers -------------------------------- */

function tokenBundle(user, session) {
  return {
    accessToken: signAccessToken({
      userId: user.id, role: user.role, tokenVersion: Number(user.token_version),
    }),
    expiresIn: ACCESS_TTL_SECONDS,
    refreshToken: session.token,
    refreshExpiresAt: session.expiresAt.toISOString(),
    user: { id: user.id, name: user.name, role: user.role },
  }
}

async function record({ identifier, userId = null, ip, userAgent, outcome }) {
  try {
    await pool.execute(
      `INSERT INTO login_attempts (identifier, user_id, ip, user_agent, outcome, at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [String(identifier).slice(0, 191), userId, ip ? String(ip).slice(0, 64) : null,
       userAgent ? String(userAgent).slice(0, 255) : null, outcome, toDbDateTime(new Date())])
  } catch (err) {
    /* Never let the audit write break the login path — but never let it fail
       silently either. */
    console.error('[auth] login_attempts insert failed', err)
  }
}

/** Prune old attempt rows. Called by the scheduler. */
export async function pruneLoginAttempts({ keepDays = 90 } = {}) {
  const [res] = await pool.execute(
    'DELETE FROM login_attempts WHERE at < ?',
    [toDbDateTime(new Date(Date.now() - keepDays * 86_400_000))])
  return res.affectedRows
}

/** A real scrypt hash of a value nobody has, used to burn the same time on the
 *  unknown-account path that a genuine verify would. Generated once at startup. */
const DUMMY_HASH = await hashPassword('!not-a-real-password-' + Math.random())
