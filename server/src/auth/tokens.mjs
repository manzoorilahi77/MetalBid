/* ---------------------------------------------------------------------------
   Tokens.

   Two kinds, because they answer different questions:

   * The ACCESS token is a signed statement — "this is user X, role Y, until
     T". It is checked with an HMAC and nothing else, so every request is
     authenticated without touching the database. That is what makes it cheap,
     and it is exactly why it must be short-lived: nothing can revoke it before
     it expires. Fifteen minutes.

   * The REFRESH token is an opaque random string with a row behind it. It can
     be revoked, it rotates on every use, and replaying an old one kills the
     whole family (see sessions.mjs). Thirty days.

   A hand-rolled JWT rather than `jsonwebtoken`: this is ~40 lines of HMAC over
   base64url, it adds no dependency to audit, and — because the library's
   `algorithms` default has been the source of the classic "alg: none" and
   RS256→HS256 confusions — the verifier below simply has no algorithm
   negotiation to confuse. HS256 is the only thing it can read.

   AUTH_SECRET must be set in .env. There is no development default: a fallback
   secret is a fallback that reaches production.
--------------------------------------------------------------------------- */
import { createHmac, randomBytes, timingSafeEqual, createHash } from 'node:crypto'
import { env } from '../env.mjs'

const SECRET = env.AUTH_SECRET
if (!SECRET || SECRET.length < 32) {
  throw new Error(
    'AUTH_SECRET is missing or shorter than 32 characters. ' +
    'Generate one with:  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
  )
}
const KEY = Buffer.from(SECRET, 'utf8')

export const ACCESS_TTL_SECONDS = Number(env.ACCESS_TTL_SECONDS ?? 900)          // 15 min
export const REFRESH_TTL_SECONDS = Number(env.REFRESH_TTL_SECONDS ?? 2_592_000)  // 30 days

const b64url = (buf) => Buffer.from(buf).toString('base64url')
const fromB64url = (s) => Buffer.from(s, 'base64url')

/* --------------------------------- access -------------------------------- */

/** Sign an access token. `claims` is small on purpose — an access token is
 *  presented on every request and read by the client, so it carries identity
 *  and nothing sensitive. */
export function signAccessToken({ userId, role, tokenVersion, ttl = ACCESS_TTL_SECONDS }) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({
    sub: userId,
    role,
    tv: tokenVersion,       // bumped on password change / forced sign-out
    iat: now,
    exp: now + ttl,
    iss: 'ferrobid',
  }))
  const body = `${header}.${payload}`
  return `${body}.${b64url(hmac(body))}`
}

/** Verify and decode. Returns null for anything wrong — expired, tampered,
 *  malformed — because the caller's only correct response to all of those is
 *  the same 401. */
export function verifyAccessToken(token) {
  if (typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [header, payload, signature] = parts
  const expected = hmac(`${header}.${payload}`)
  let given
  try { given = fromB64url(signature) } catch { return null }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null

  let claims
  try { claims = JSON.parse(fromB64url(payload).toString('utf8')) } catch { return null }

  /* Header is checked after the signature, not before: reading an attacker's
     header to decide how to verify it is the whole class of JWT bugs. */
  let head
  try { head = JSON.parse(fromB64url(header).toString('utf8')) } catch { return null }
  if (head?.alg !== 'HS256') return null

  const now = Math.floor(Date.now() / 1000)
  if (typeof claims?.exp !== 'number' || claims.exp <= now) return null
  if (typeof claims?.iat !== 'number' || claims.iat > now + 60) return null   // clock skew allowance
  if (claims.iss !== 'ferrobid') return null
  if (typeof claims.sub !== 'string' || typeof claims.role !== 'string') return null

  return claims
}

const hmac = (data) => createHmac('sha256', KEY).update(data).digest()

/* -------------------------------- refresh -------------------------------- */

/** A refresh token is 32 random bytes. It has no structure and means nothing
 *  on its own — its meaning is the row it matches. */
export function newRefreshToken() {
  return randomBytes(32).toString('base64url')
}

/** What we store. Never the token: a stolen database must not be a set of
 *  working sessions. SHA-256 without a salt is right here — unlike a password,
 *  the input is 256 bits of entropy, so there is nothing to brute-force and a
 *  slow KDF would only make every refresh expensive. */
export const hashRefreshToken = (token) =>
  createHash('sha256').update(String(token)).digest('hex')

/** Random id for sessions, job runs, cms rows — anywhere a uuid would do but a
 *  shorter, url-safe token reads better in a log line. */
export const newId = (prefix) => `${prefix}-${randomBytes(12).toString('base64url')}`
