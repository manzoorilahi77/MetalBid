/* ---------------------------------------------------------------------------
   Refresh-token sessions.

   One row per signed-in device, rotated on every refresh. The rotation is the
   interesting part:

     issue()   -> hands out token A, row A (family F)
     rotate(A) -> revokes row A, issues token B in the same family F

   If token A is ever presented again after that, it can only be because someone
   kept a copy — the legitimate client discarded it when it got B. So a hit on
   a revoked row is treated as theft and the entire family is killed, signing
   that device out everywhere. This is the standard refresh-rotation reuse
   detection, and it is the reason refresh tokens are worth storing at all.

   Everything here writes DATETIME(3) through toDbDateTime, never NOW(): the
   database server's clock is EDT (see time.mjs).
--------------------------------------------------------------------------- */
import { pool } from '../db.mjs'
import { toDbDateTime } from '../time.mjs'
import { hashRefreshToken, newRefreshToken, newId, REFRESH_TTL_SECONDS } from './tokens.mjs'

/** Create a session and return the plaintext refresh token — the only moment
 *  it exists outside the caller's response. */
export async function issueSession({ userId, ip, userAgent, familyId = null, impersonatedBy = null }) {
  const token = newRefreshToken()
  const id = newId('sess')
  const now = new Date()
  const expires = new Date(now.getTime() + REFRESH_TTL_SECONDS * 1000)

  await pool.execute(
    `INSERT INTO sessions (id, user_id, impersonated_by, token_hash, family_id, issued_at, expires_at, user_agent, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, impersonatedBy, hashRefreshToken(token), familyId ?? id, toDbDateTime(now), toDbDateTime(expires),
     clip(userAgent, 255), clip(ip, 64)],
  )
  return { token, sessionId: id, familyId: familyId ?? id, expiresAt: expires }
}

/**
 * Exchange a refresh token for a new one.
 *
 * Returns `{ ok: true, token, userId, ... }` or `{ ok: false, reason }`. The
 * reasons are distinguished for the audit log, not for the caller's response —
 * the client is told the same thing for all of them.
 */
export async function rotateSession({ token, ip, userAgent }) {
  const hash = hashRefreshToken(token)
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    /* FOR UPDATE so two tabs refreshing at once cannot both rotate the same row
       and have the second one look like a replay. */
    const [[row]] = await conn.query(
      `SELECT id, user_id, family_id, expires_at, revoked_at
         FROM sessions WHERE token_hash = ? FOR UPDATE`, [hash])

    if (!row) { await conn.rollback(); return { ok: false, reason: 'unknown' } }

    if (row.revoked_at) {
      /* Replay of a token we already rotated away. Treat the device as
         compromised: kill every live session in the family, so both the thief
         and the legitimate holder are forced to sign in again. */
      await conn.execute(
        `UPDATE sessions SET revoked_at = ?, revoked_reason = 'reuse_detected'
           WHERE family_id = ? AND revoked_at IS NULL`,
        [toDbDateTime(new Date()), row.family_id])
      await conn.commit()
      return { ok: false, reason: 'reuse_detected', userId: row.user_id, familyId: row.family_id }
    }

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await conn.rollback()
      return { ok: false, reason: 'expired' }
    }

    const now = new Date()
    const next = newRefreshToken()
    const nextId = newId('sess')
    const expires = new Date(now.getTime() + REFRESH_TTL_SECONDS * 1000)

    await conn.execute(
      `UPDATE sessions SET revoked_at = ?, revoked_reason = 'rotated', last_used_at = ?
         WHERE id = ?`,
      [toDbDateTime(now), toDbDateTime(now), row.id])

    await conn.execute(
      `INSERT INTO sessions (id, user_id, token_hash, family_id, rotated_from,
                             issued_at, expires_at, user_agent, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nextId, row.user_id, hashRefreshToken(next), row.family_id, row.id,
       toDbDateTime(now), toDbDateTime(expires), clip(userAgent, 255), clip(ip, 64)])

    await conn.commit()
    return { ok: true, token: next, userId: row.user_id, sessionId: nextId, familyId: row.family_id, expiresAt: expires }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

/** Sign out one device. */
export async function revokeByToken(token, reason = 'signed_out') {
  const [res] = await pool.execute(
    `UPDATE sessions SET revoked_at = ?, revoked_reason = ?
       WHERE token_hash = ? AND revoked_at IS NULL`,
    [toDbDateTime(new Date()), reason, hashRefreshToken(token)])
  return res.affectedRows > 0
}

/** Sign out every device for a user. Paired with bumping `users.token_version`,
 *  which is what also invalidates access tokens already in flight. */
export async function revokeAllForUser(userId, reason = 'revoked') {
  const [res] = await pool.execute(
    `UPDATE sessions SET revoked_at = ?, revoked_reason = ?
       WHERE user_id = ? AND revoked_at IS NULL`,
    [toDbDateTime(new Date()), reason, userId])
  return res.affectedRows
}

/** What the account's own "signed-in devices" list shows. */
export async function listSessions(userId) {
  const [rows] = await pool.execute(
    `SELECT id, issued_at, last_used_at, expires_at, user_agent, ip
       FROM sessions
      WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?
      ORDER BY issued_at DESC LIMIT 50`,
    [userId, toDbDateTime(new Date())])
  return rows.map((r) => ({
    id: r.id,
    issuedAt: new Date(r.issued_at).toISOString(),
    lastUsedAt: r.last_used_at ? new Date(r.last_used_at).toISOString() : null,
    expiresAt: new Date(r.expires_at).toISOString(),
    userAgent: r.user_agent,
    ip: r.ip,
  }))
}

/** Housekeeping — expired and long-revoked rows are dead weight and a privacy
 *  liability (they hold IPs and user agents). Called by the scheduler. */
export async function pruneSessions({ keepRevokedDays = 30 } = {}) {
  const cutoff = new Date(Date.now() - keepRevokedDays * 86_400_000)
  const [res] = await pool.execute(
    `DELETE FROM sessions
      WHERE (expires_at < ?) OR (revoked_at IS NOT NULL AND revoked_at < ?)`,
    [toDbDateTime(new Date()), toDbDateTime(cutoff)])
  return res.affectedRows
}

const clip = (s, n) => (typeof s === 'string' && s.length ? s.slice(0, n) : null)
