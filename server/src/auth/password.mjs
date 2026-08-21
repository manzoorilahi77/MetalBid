/* ---------------------------------------------------------------------------
   Password hashing.

   scrypt, from node:crypto. Deliberately not bcrypt or argon2: both are native
   modules, and this deploys to shared cPanel hosting where a node-gyp build is
   a coin flip. scrypt is memory-hard, in the standard library, and needs no
   compiler — the right trade for this deployment.

   Stored format is self-describing so the parameters can be raised later
   without invalidating existing hashes:

     scrypt$N$r$p$<salt-b64>$<key-b64>

   verify() reads whatever parameters a stored hash was made with, so a user
   with an old hash still signs in; needsRehash() then tells the caller to
   re-hash them at the current cost while their plaintext is briefly in hand.
--------------------------------------------------------------------------- */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb)

/* N=16384 (2^14) with r=8 costs ~16MB and a few tens of milliseconds per hash.
   That is the standard interactive-login setting: slow enough to make offline
   cracking expensive, fast enough that a login does not feel stalled. */
const PARAMS = { N: 16384, r: 8, p: 1, keyLen: 32, saltLen: 16 }

/* Node's scrypt refuses to allocate more than 32MB by default, and N=16384 with
   r=8 needs ~16MB — fine, but the check is on 128*N*r which is exactly at the
   edge for larger N. Set it explicitly so raising N later fails loudly here
   rather than mysteriously at runtime. */
const MAX_MEMORY = 64 * 1024 * 1024

export async function hashPassword(plain) {
  assertUsable(plain)
  const salt = randomBytes(PARAMS.saltLen)
  const key = await scrypt(plain.normalize('NFKC'), salt, PARAMS.keyLen, {
    N: PARAMS.N, r: PARAMS.r, p: PARAMS.p, maxmem: MAX_MEMORY,
  })
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${key.toString('base64')}`
}

/** Constant-time verify. Returns false for anything malformed rather than
 *  throwing: a corrupt hash column must read as "wrong password", never as a
 *  500 that tells an attacker they found something interesting. */
export async function verifyPassword(plain, stored) {
  if (typeof plain !== 'string' || typeof stored !== 'string') return false
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false

  const [, nStr, rStr, pStr, saltB64, keyB64] = parts
  const N = Number(nStr), r = Number(rStr), p = Number(pStr)
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false

  let salt, expected
  try {
    salt = Buffer.from(saltB64, 'base64')
    expected = Buffer.from(keyB64, 'base64')
  } catch { return false }
  if (!salt.length || !expected.length) return false

  let actual
  try {
    actual = await scrypt(plain.normalize('NFKC'), salt, expected.length, { N, r, p, maxmem: MAX_MEMORY })
  } catch { return false }

  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/** True when a hash was made with weaker parameters than we now use. */
export function needsRehash(stored) {
  if (typeof stored !== 'string') return true
  const [algo, N, r, p] = stored.split('$')
  return algo !== 'scrypt' ||
    Number(N) < PARAMS.N || Number(r) < PARAMS.r || Number(p) < PARAMS.p
}

/* ---------------------------------------------------------------------------
   Policy.

   Length before composition: a 12-character passphrase beats "P@ss1!" and the
   rules that force the second produce passwords people write on monitors. The
   only composition rule kept is "not one repeated character", which catches
   'aaaaaaaaaaaa' without pushing anyone toward a pattern.
--------------------------------------------------------------------------- */
export const PASSWORD_MIN = 12
export const PASSWORD_MAX = 200

/** Obvious choices we refuse outright. Not a substitute for a breach corpus —
 *  it is the shortlist that would otherwise turn up in an audit. */
const BANNED = new Set([
  'password', 'password123', 'passw0rd', '123456789012', 'qwertyuiop12',
  'admin@123456', 'ferrobid@123', 'welcome@1234', 'changeme1234', 'letmein12345',
])

export function passwordProblem(plain, { email, name } = {}) {
  if (typeof plain !== 'string') return 'A password is required'
  const pw = plain.normalize('NFKC')
  if (pw.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters`
  if (pw.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters`
  if (pw.trim() !== pw) return 'Remove the leading or trailing spaces'
  if (new Set(pw).size < 4) return 'Use a mix of characters, not one repeated'
  if (BANNED.has(pw.toLowerCase())) return 'That password is too common'

  const lower = pw.toLowerCase()
  const local = typeof email === 'string' ? email.split('@')[0]?.toLowerCase() : ''
  if (local && local.length >= 4 && lower.includes(local)) return 'Do not put your email in your password'
  if (typeof name === 'string' && name.length >= 4 && lower.includes(name.toLowerCase())) {
    return 'Do not put your name in your password'
  }
  return null
}

function assertUsable(plain) {
  if (typeof plain !== 'string' || !plain.length) {
    throw Object.assign(new Error('A password is required'), { status: 400, expected: true })
  }
  if (plain.length > PASSWORD_MAX) {
    /* Unbounded input into a memory-hard KDF is a denial-of-service by design.
       Reject long input before doing any work on it. */
    throw Object.assign(new Error('Password is too long'), { status: 400, expected: true })
  }
}

/** A readable temporary password for an operator to hand over once. Avoids
 *  characters that are ambiguous when read aloud or off a screen. */
export function generateTempPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = randomBytes(16)
  let out = ''
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return `${out.slice(0, 5)}-${out.slice(5, 10)}-${out.slice(10, 16)}`
}
