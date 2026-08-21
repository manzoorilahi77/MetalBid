/* ---------------------------------------------------------------------------
   Give an account a way to sign in.

   Migration 009 added the columns; it could not add the credentials, because
   there were none to migrate — 008 stored issued passwords in the clear and
   this replaces that entirely. So every account starts with no password and
   cannot sign in until somebody runs this.

   Three modes:

     node scripts/set-password.mjs --list
         Which accounts can sign in, and which cannot yet.

     node scripts/set-password.mjs --user u-sub-1 --email sub@ferrobid.in [--password '...']
         Bind a login email to one account and set its password. Without
         --password, a temporary one is generated, printed once, and flagged so
         the holder must replace it at first sign-in.

     node scripts/set-password.mjs --seed-dev
         Development only. Gives every demo account from the prototype's
         DEMO_LOGINS map a working login with one shared dev password. Refuses
         to run when NODE_ENV=production, because a known password on every
         staff role is exactly the thing this whole change exists to remove.
--------------------------------------------------------------------------- */
import { pool, closePool } from '../src/db.mjs'
import { toDbDateTime } from '../src/time.mjs'
import { hashPassword, passwordProblem, generateTempPassword } from '../src/auth/password.mjs'
import { env } from '../src/env.mjs'

/* The prototype's DEMO_LOGINS, as email -> the seeded account that holds that
   role. Kept here rather than imported: this is a .mjs script and that is a
   TypeScript module in another package. */
const DEV_ACCOUNTS = [
  ['buy@gmail.com',       'u-buyer-1'],
  ['sell@gmail.com',      'u-seller-2'],
  ['field@gmail.com',     'u-field-1'],
  ['executive@gmail.com', 'u-exec-1'],
  ['auction@gmail.com',   'u-auction-1'],
  ['finance@gmail.com',   'u-fin-1'],
  ['sub@gmail.com',       'u-sub-1'],
  ['ceo@gmail.com',       'u-ceo-1'],
  /* The break-glass account. Present in dev so the role can be exercised;
     absent from every user-facing list, exactly as before. */
  ['super@gmail.com',     'u-super-1'],
]

/* Twelve characters, which is the policy minimum, and obviously a dev value. */
const DEV_PASSWORD = env.DEV_PASSWORD ?? 'FerroBid@Dev2026'

const args = parseArgs(process.argv.slice(2))

try {
  if (args.list) await list()
  else if (args['seed-dev']) await seedDev()
  else if (args.user) await setOne(args)
  else usage()
} catch (err) {
  console.error(`\n✗ ${err.message}\n`)
  process.exitCode = 1
} finally {
  await closePool()
}

/* --------------------------------- modes --------------------------------- */

async function list() {
  const [rows] = await pool.query(
    `SELECT id, name, role, status, login_email,
            password_hash IS NOT NULL AS has_password, must_change_password, last_login_at
       FROM users
      WHERE role NOT IN ('guest', 'guest1', 'guest_buyer')
      ORDER BY FIELD(role, 'super_admin', 'sub_admin', 'ceo', 'finance_admin',
                     'auction_manager', 'exec_manager', 'field_exec', 'seller', 'buyer'),
               name
      LIMIT 200`)

  const canSignIn = rows.filter((r) => Number(r.has_password) === 1 && r.login_email)
  console.log(`\n${rows.length} accounts · ${canSignIn.length} can sign in\n`)
  console.log(pad('ID', 16), pad('ROLE', 16), pad('LOGIN EMAIL', 28), 'STATE')
  console.log('-'.repeat(78))
  for (const r of rows) {
    const state = !r.login_email ? 'no login email'
      : Number(r.has_password) !== 1 ? 'NO PASSWORD'
      : Number(r.must_change_password) === 1 ? 'temporary password'
      : r.last_login_at ? `last in ${new Date(r.last_login_at).toISOString().slice(0, 10)}`
      : 'ready, never used'
    console.log(pad(r.id, 16), pad(r.role, 16), pad(r.login_email ?? '—', 28),
      r.status === 'active' ? state : `${r.status.toUpperCase()} · ${state}`)
  }
  console.log()
}

async function setOne({ user, email, password }) {
  const [[row]] = await pool.query('SELECT id, name, role, login_email FROM users WHERE id = ? LIMIT 1', [user])
  if (!row) throw new Error(`No account with id ${user}`)

  const loginEmail = (email ?? row.login_email ?? '').trim().toLowerCase()
  if (!loginEmail) throw new Error('This account has no login email yet — pass --email')

  const [[clash]] = await pool.query(
    'SELECT id FROM users WHERE login_email = ? AND id <> ? LIMIT 1', [loginEmail, user])
  if (clash) throw new Error(`${loginEmail} already signs in as ${clash.id}`)

  const generated = !password
  const secret = password ?? generateTempPassword()
  const problem = passwordProblem(secret, { email: loginEmail, name: row.name })
  if (problem) throw new Error(problem)

  await pool.execute(
    `UPDATE users
        SET login_email = ?, password_hash = ?, password_set_at = ?,
            must_change_password = ?, failed_attempts = 0, locked_until = NULL,
            token_version = token_version + 1
      WHERE id = ?`,
    [loginEmail, await hashPassword(secret), toDbDateTime(new Date()),
     generated ? 1 : 0, user])

  /* Bumping token_version above already invalidated live access tokens; this
     ends the refresh sessions too. */
  await pool.execute(
    `UPDATE sessions SET revoked_at = ?, revoked_reason = 'password_reset'
      WHERE user_id = ? AND revoked_at IS NULL`,
    [toDbDateTime(new Date()), user])

  console.log(`\n✓ ${row.name} (${row.role}) signs in as ${loginEmail}`)
  if (generated) {
    console.log(`  Temporary password: ${secret}`)
    console.log('  Shown once. They must set their own at first sign-in.\n')
  } else {
    console.log('  Password set.\n')
  }
}

async function seedDev() {
  if (env.NODE_ENV === 'production') {
    throw new Error('--seed-dev refuses to run with NODE_ENV=production')
  }
  const problem = passwordProblem(DEV_PASSWORD)
  if (problem) throw new Error(`DEV_PASSWORD is not usable: ${problem}`)

  /* One hash, reused. Hashing nine times costs nine times ~80ms for no benefit
     when the password is identical and this is a development convenience. */
  const hash = await hashPassword(DEV_PASSWORD)
  const now = toDbDateTime(new Date())

  let done = 0
  const missing = []
  for (const [email, userId] of DEV_ACCOUNTS) {
    const [res] = await pool.execute(
      `UPDATE users
          SET login_email = ?, password_hash = ?, password_set_at = ?,
              must_change_password = 0, status = 'active',
              failed_attempts = 0, locked_until = NULL
        WHERE id = ?`,
      [email, hash, now, userId])
    if (res.affectedRows) done += 1
    else missing.push(`${userId} (${email})`)
  }

  console.log(`\n✓ ${done} development logins set. Password for all: ${DEV_PASSWORD}`)
  if (missing.length) {
    console.log(`\n  Not found — run npm run db:seed first:\n    ${missing.join('\n    ')}`)
  }
  console.log('\n  These are development credentials. Never run this against production.\n')
}

function usage() {
  console.log(`
  node scripts/set-password.mjs --list
  node scripts/set-password.mjs --user <id> --email <address> [--password <secret>]
  node scripts/set-password.mjs --seed-dev
`)
}

/* -------------------------------- helpers -------------------------------- */

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) { out[key] = next; i += 1 } else out[key] = true
  }
  return out
}

const pad = (s, n) => String(s ?? '').padEnd(n).slice(0, n)
