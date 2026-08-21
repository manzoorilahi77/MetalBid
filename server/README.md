# FerroBid API

Node + Express + MySQL backend. The frontend prototype lives in
`../prototype_v2/ferrobid`.

## Run

```bash
cd server
npm install
npm run dev          # API on http://localhost:4000
```

In a second terminal:

```bash
cd prototype_v2/ferrobid
npm run dev          # Vite on http://localhost:5173
```

The frontend reads `VITE_API_URL` from `.env.local` (defaults to
`http://localhost:4000`). The store starts **empty** in the browser — the
database is the only source of data. If the API is down every screen shows
nothing plus a "server not connected" notice, and the app keeps retrying until
the server answers; once it does, the pages fill in without a reload. The full
local-fixture seed still loads for the Node scripts (`dump-store.ts`,
`verify-persistence.ts`) — they are what produce the database's contents — and
can be forced in the browser with `VITE_LOCAL_SEED=1` for offline UI work.

## Scripts

| command | what it does |
|---|---|
| `npm run db:test` | connect, print server version and table count |
| `npm run db:migrate` | apply `migrations/*.sql` in order, tracked in `_migrations` |
| `npm run db:seed` | wipe and reload from the prototype's mock fixtures |
| `npm run db:pool-check` | read-only pool + timezone verification |
| `npm run db:seed-auth` | give the demo accounts a working login (development only) |
| `npm run db:passwords -- --list` | who can sign in, and who has no password yet |
| `npm run db:passwords -- --user <id> --email <addr>` | issue a temporary password for one account |
| `npm run db:seed-cms` | load the section inventory and the site's current copy into the CMS |
| `node scripts/smoke-auth.mjs` | run the security checklist against a live server |
| `npm run jobs:tick` | run one scheduler pass by hand |

## Endpoints

| endpoint | serves |
|---|---|
| `GET /api/health` | liveness + DB round-trip |
| `GET /api/home` | live + upcoming catalogues, their lots, sellers |
| `GET /api/buyer/:buyerId` | one buyer's wallet, ledger, shortlists, bids, auto-bids, EMD exemptions, delivery orders, plus every catalogue and lot those reference |
| `GET /api/seller/:sellerId` | one seller's lots at any pipeline stage, the catalogues holding them, bids against them, inspection reports, commission settlements |
| `GET /api/field/:userId` | one field executive's assigned catalogues and their lots, unioned with the lots they have already reported on |
| `GET /api/exec` | the whole lot pipeline — every catalogue, lot, inspection report and delivery order. No `:userId`: this role's scope is not a subset of anything |
| `GET /api/auction` | the auction floor — catalogues, lots, the full bid stream, announcements, cancellations, bid voids, STA referrals, plus every buyer's shortlist and balance for EMD eligibility |
| `GET /api/finance` | the books — wallets with ledgers, deposits, withdrawals, refunds, forfeitures, invoices, the bank statement, commission and the CEO queue, for all users |
| `GET /api/sub` | everything operational, plus the supervisory records (action reviews, shift handover notes, content drafts) |
| `GET /api/admin` | `/api/sub` **plus the platform's own structure** — role registry, page registry, change history, password resets, master data |
| `GET /api/ceo` | a narrower commercial read — catalogues, lots, bids, the money records, the approval queue and the delegation. No audit trail, no page registry, no inspection reports |

All ten role endpoints are DB-backed. `page_registry` is the one that is not
ordinary data: the app builds both navigation bars from it, so editing a row
renames a menu item live.

Disclosure is decided per role, not once globally, and the two rules point in
opposite directions depending on who is asking:

| endpoint | `lots.reserve_rate` | bidder identity |
|---|---|---|
| home | hidden (public endpoint) | n/a |
| buyer | hidden — it is the seller's floor | pseudonymised per lot |
| seller | **returned** — it is their own floor | `{id, bidderId}`, the public code the UI already shows |
| field | hidden — they measure, they do not decide against the floor | n/a |
| exec | **returned** — lot approval and STA referral decide against it | n/a |
| auction | **returned** — results and STA are decided against it | **real ids** — they void bids and answer for the result; they cannot act on a pseudonym |
| finance | hidden — Finance moves money against cleared prices, never the floor | n/a |
| sub / admin / ceo | hidden — their own screens never read it, and the screens that do (exec/Settlement, auction/Results) sit under layouts that fetch it themselves | n/a |

The column list and the mapper live together in `src/api/dto.mjs`, and the
choice is made by importing `LOT_COLUMNS` or `LOT_COLUMNS_WITH_RESERVE`.
`toLot` emits `reserveRate` only when the column was actually selected, so a
public query cannot leak it even if someone forgets. A rule enforced by
remembering to delete a line from a copied SELECT is a rule that gets forgotten.

Those disclosure rules are one of two layers. The other is **who is allowed to
call the endpoint at all** - see Authentication below. Until migration 009 there
was no such layer: `/api/buyer/:buyerId` handed any caller any buyer's wallet
and bid history, and the disclosure table above was the only thing standing
between a curious visitor and the whole platform.

## Authentication

Every route carries an explicit guard. A route with no guard is *visibly*
unguarded - `public_` says so in as many characters as `requireRole` does -
rather than open because nobody remembered.

| guard | who gets through |
|---|---|
| `public_` | anybody, signed in or not |
| `requireAuth` | any active account |
| `requireSelfOrRole(param, roles)` | the user named in the URL, or a role whose job includes their record |
| `requireRole(...roles)` | a named set. The Super Admin satisfies every requirement except one naming the CEO |
| `requireGoodStanding` | plus: not a defaulter. Applied to bidding and money movement, never to reads |

**Passwords** are hashed with **scrypt** from `node:crypto` - deliberately not
bcrypt or argon2, both of which are native modules and this deploys to shared
cPanel hosting where a node-gyp build is a coin flip. The stored format carries
its own parameters (`scrypt$N$r$p$salt$key`) so the cost can be raised later
without invalidating anybody's password; `needsRehash` upgrades a hash silently
at the next successful sign-in.

**Tokens** are two kinds, because they answer different questions:

- the **access token** is an HS256 JWT, 15 minutes, checked with an HMAC and
  nothing else - so every request is authenticated without touching the
  database. Nothing can revoke it before it expires, which is exactly why it is
  short. Hand-rolled rather than `jsonwebtoken`: ~40 lines, no dependency to
  audit, and no algorithm negotiation to confuse (the classic `alg: none` and
  RS256-to-HS256 attacks have nothing to attack).
- the **refresh token** is 32 opaque random bytes with a row behind it, 30 days,
  stored as a SHA-256 digest. It **rotates on every use**, and a token presented
  twice is treated as theft: the whole family is revoked *and* the account's
  `token_version` is bumped, which kills the access tokens already in flight.

**A failed sign-in tells you nothing.** Unknown account, wrong password, locked,
suspended - one message, and the unknown-account path still runs a scrypt hash
so response time does not sort real accounts from imaginary ones.

**Lockout is per account and per address.** Five failures locks an account for
15 minutes; twenty failures from one address throttles it for 15 minutes. Per
account alone would let an attacker lock every user out of their own account;
per address alone is defeated by a botnet. The in-process limiter refunds
successful sign-ins, so an office behind one NAT address is not locked out for
working normally - only wrong passwords count.

### Getting a login

Migration 009 added the columns; it could not add credentials, because there
were none to migrate - 008 stored issued passwords in the clear and this
replaces that entirely. Every account starts unable to sign in.

```bash
npm run db:seed-auth                     # development: the demo accounts, one shared password
npm run db:passwords -- --list           # who can sign in
npm run db:passwords -- --user u-sub-1 --email ops@ferrobid.in
```

`AUTH_SECRET` must be set in `.env` or the server refuses to start. There is no
development default: a fallback secret is a fallback that reaches production.

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

The frontend keeps the access token **in memory** and the refresh token in
`localStorage`. That is a real trade - an XSS could lift the refresh token - and
the mitigation is the rotation and reuse detection above. If the API is ever
served same-origin with the app, move the refresh token to an httpOnly cookie
and turn `credentials` on in the CORS config.

Run `node scripts/smoke-auth.mjs` against a live server to check all of this
still holds. It is the reviewer's checklist, automated: 27 cases, each one
something that *was* possible before.

## Writes

The frontend holds 127 mutating actions and all their business logic. Rather
than port that into 127 endpoints — a year of work and two divergent copies of
every rule — the store's own state changes are persisted:

`src/api/persist.ts` subscribes to the store once, diffs the entity arrays after
each action by **object reference** (every action updates immutably, so a
changed row is a new object and untouched rows keep their identity), and posts
the rows that changed to `POST /api/mutate`. One mechanism, all 127 actions.

`src/api/entities.mjs` is a strict whitelist for **shape**: an unknown entity is
rejected, and an unknown column is dropped rather than passed through.

`src/api/policy.mjs` is the other half - **permission** - and it is what
`entities.mjs` used to say was missing. Every op in a batch is checked twice:

1. **Role.** `writableBy`, already recorded on every entity, is now enforced. A
   buyer cannot write `catalogues`, whatever the client sends.
2. **Ownership.** A buyer may write `bankAccounts` - but only rows whose
   `user_id` is their own, or "register a payout account" becomes "repoint
   somebody else's payouts at my bank". The check reads the row **as it exists
   in the database**, not as the client described it: a client that lies about
   the owner on an update would otherwise pass an ownership check against its
   own lie. On an insert the owner field is *overwritten* with the caller.

Three further rules that are not per-entity:

- **Money is not writable by the person it belongs to.** A buyer may create a
  deposit claim; they may not set its status to verified. Those fields are
  *stripped*, not rejected - the store diff legitimately posts whole rows, and
  failing the batch would break a valid action over a field nobody touched.
- **Append-only means append-only.** `auditEvents`, `bids` and
  `structuralChanges` cannot be edited or deleted through this path. An audit
  trail that can be edited is worthless, and a bid's history is evidence.
- **Nobody escalates themselves.** `role`, `standing`, `status`, `kyc_status`
  and `bidder_id` on `users` are admin-only regardless of who owns the row.

Two paths deliberately bypass all of that, because last-write-wins is not an
acceptable answer when money is involved:

| endpoint | why the server must own it |
|---|---|
| `POST /api/bids` | two bids arriving together must not both read the same current rate. The lot row is locked `FOR UPDATE`, so the second re-reads the first's result. Verified: 5 simultaneous bids at the same rate → exactly 1 accepted |
| `POST /api/emd/fund` | two fundings must not both see the same balance and both succeed. The wallet row is locked the same way. Idempotent — a replayed request does not double-charge |

Both keep the client's optimistic path for instant feedback and reconcile
against the server's answer, rolling back with the server's reason if it
rejects. The server always wins.

**The simulation tick does not persist.** `tick` drives the prototype's bots and
lot closing, which was right with no backend and is actively wrong with one -
every open tab would write invented bids and race to close the same lots. The
clock still runs for countdowns; nothing it changes is saved.

## The scheduler

`src/jobs/scheduler.mjs` is what closes an auction. Before it, `ends_at` passed
and the row stayed `live` forever - the closed state existed only in whichever
browser happened to be open. A sale that finished overnight produced no winner,
no delivery order and no EMD release.

| job | what it does |
|---|---|
| `open_catalogues` | `upcoming` to `live` at `starts_at`, and its approved lots go live |
| `close_lots` | live lots past `ends_at` become `sold` (H1 at or above reserve), `sta` (below reserve) or `unsold`; raises the winner's delivery order; releases EMD to every funder who did not win |
| `close_catalogues` | a live catalogue whose lots have all resolved becomes `closed` |
| `flag_overdue_payments` | records `overdue_at` on delivery orders past their payment window |
| `prune` | expired sessions and login attempts, hourly |

Three properties it holds:

- **Only one runner.** `GET_LOCK` on a named lock, held on one dedicated
  connection for the tick. Two API processes cannot both close the same lot and
  raise two delivery orders for it.
- **Idempotent.** Every statement is conditioned on the state it expects
  (`WHERE status = 'live'`), so a tick that dies half way finishes the job next
  time instead of doubling it.
- **Per lot, not per batch.** One lot that throws must not stop the other forty.

It runs in-process every 15s. Set `SCHEDULER=off` and drive it with
`POST /api/jobs/tick` from cron if you would rather one machine own the clock.
Work is recorded in `job_runs` - only when something actually happened, so an
idle floor does not write a row every fifteen seconds.

**It deliberately does not forfeit EMD.** Forfeiture takes money from somebody
and needs a CEO signature. What the machine may do is say the window passed,
once, to the people whose job it then becomes.

One thing the scheduler forced into the schema: `catalogues.paused` did not
exist. Pausing a live sale was session state in one browser, so the pause was
invisible to everyone else - and a pause the closer cannot see is a pause that
does not stop the close.

## Realtime

`GET /api/stream` is Server-Sent Events. The bidding room needs a shared clock
and a pushed ladder; without one, two bidders see different states and an
anti-snipe extension triggered by one never reaches the other - the difference
between a fair close and a disputed one.

SSE rather than WebSockets for three reasons that all point the same way here:
it is plain HTTP so cPanel's proxy passes it without configuration, it
reconnects on its own with `Last-Event-ID`, and the traffic is one-way - bids
already POST and get the authoritative answer back.

The bus is **in-process**. With one API process that is right; with two it
becomes wrong quietly, because a bid handled by process A would not reach a
subscriber on process B. `publish` in `src/realtime/bus.mjs` is the single place
to swap in Redis pub/sub if that day comes.

Events carry no bidder identity: masking is a disclosure rule and a broadcast
channel is the last place to leak it.

## Uploads

`lot_photos` stored a colour hue. `POST /api/uploads` stores real files.

Raw body, not multipart - no multer, no busboy, no dependency: the client sends
the bytes with `Content-Type` and an `X-Filename` header, which `fetch` does
natively from a `File`. Multipart exists to send several fields at once; here
there is one file and the metadata fits in headers and the query string.

The **type is sniffed from the first bytes**, never trusted from the header, and
only JPEG, PNG, WebP and PDF are accepted. The filename the client sends is
recorded for display and thrown away for storage: the file is stored under its
own content hash, which closes path traversal and the "upload an HTML file, open
it, own the origin" trick in one go. The CSP in `security/headers.mjs` closes it
again, and every download is served `Content-Disposition: attachment`.

Visibility is per file: `public` (catalogue photos), `authenticated`, `owner`
(deposit proofs) or `staff` (KYC documents). A file the caller may not see
returns **404, not 403** - confirming an id exists is itself a disclosure.

Set `UPLOAD_DIR` **outside the web root**: nothing under it should be reachable
except through `GET /api/uploads/:id`, which is what applies these rules.

## CMS

Migration 010 implements the Content Atlas. Two tables, deliberately separate:

- `cms_block` - **what** a section says. Draft and published values side by
  side, versioned into `cms_block_versions` on every publish, so a rollback
  restores a real previous version rather than an empty box.
- `section_registry` - **whether** it appears. One row per section, per page,
  per role, with an on/off switch. Not just the home page: every page of every
  portal.

Keeping them apart is what lets an operator switch a section off without
deleting the words in it, and edit words that are currently hidden.

Ownership follows the roles decision: the **Sub Admin** creates, edits,
publishes, switches and rolls back. The Super Admin is a vendor-held break-glass
superset and appears nowhere in the routine path. The one gate that remains is
the CEO's, on pricing and legal copy, because that copy commits the company in
public - and that gate sits between two company roles, so it survives the Super
Admin never signing in.

Two rules are enforced rather than hoped for:

- **No figure is ever typed into copy.** `assertNoFigures` refuses grouped
  thousands, currency and percentages in a text block. Years, clause numbers and
  phone numbers are fine. The escape hatch is the `number_label` kind, whose
  whole point is to be a caption for a number the platform computes.
- **A section that cannot be switched off must say why.** `toggleable = 0`
  requires a `locked_reason`, and the API returns it in the refusal - otherwise
  a missing switch reads as a bug rather than a decision.

Every publish, toggle and rollback lands in `content_change_log` with the actor,
the reason, and the before/after.

### Seeding it

`npm run db:seed-cms` loads `src/cms/inventory.mjs`: 235 sections across 56
routes, and the home page's copy as it already reads.

Seeding is deliberately invisible. The blocks are the strings the components
hardcode today, seeded straight to `published`, so the site renders exactly what
it rendered before — the words simply become editable. A CMS rollout that also
rewrote the copy would make it impossible to tell which change broke what.

Two rules the seeder follows on a re-run:

- **`enabled` is never overwritten.** An operator who switched a section off did
  that on purpose, and a deploy that turns it back on because the seed file says
  so would be a deploy that silently overrides them. Titles, source classes and
  lock reasons *are* updated.
- **A section in the database that the inventory no longer names is reported,
  never deleted.** It may hold published copy, and a seeder that removes a live
  section is a seeder that takes the site down.

### Reading it in the app

`useCmsPage(route)` returns accessors that all take a fallback, and the fallback
is the string the component already hardcodes. A page therefore renders
identically whether the CMS answers, is slow, or has never been seeded — which
is what makes moving a page onto the CMS a change nobody can see.

The section list has **two audiences and two answers**, and conflating them was a
bug worth naming: a page rendering itself wants only the sections its own role
can see, but an editor administering them has to see all of them, or a Sub Admin
cannot switch off a section that only appears in the buyer's portal. So
`GET /api/cms/sections` returns everything to an editor and scopes to the
caller's role for everyone else.

## Deploying

There is no magic here — the same commands you already run in development, run
once against the production database, plus three things that only matter in
production: `AUTH_SECRET`, `ALLOWED_ORIGINS`, and `NODE_ENV=production`.

1. **Copy `.env.example` to `.env`** on the server and fill it in for real.
   Three of these are load-bearing:
   - `AUTH_SECRET` — the server refuses to start without one, and a shared or
     guessable value means anybody can mint a token for any role. Generate it
     with the command in `.env.example`, and treat it like a password: not in
     git, not in a ticket, not in Slack.
   - `ALLOWED_ORIGINS` — set to the deployed frontend's real origin(s). Left
     unset, CORS falls back to the Vite dev origins and the production
     frontend cannot call the API at all.
   - `NODE_ENV=production` — turns off things that are only safe in dev, most
     importantly `db:seed-auth`'s demo-password seeding, which refuses to run
     when this is set.
2. **Migrate, then seed the CMS once**: `npm run db:migrate` (idempotent —
   safe to run on every deploy) and `npm run db:seed-cms` (also idempotent —
   never overwrites a section an operator already switched off, or a block
   someone already edited). Do **not** run `npm run db:seed` against a
   production database — that script rebases fixture data around "now" and is
   for the dev/demo database only.
3. **Build the frontend with the real API origin**: `VITE_API_URL=https://your-api-origin
   npm run build` from `prototype_v2/ferrobid`. This bakes the URL into the
   bundle at build time — changing it later means rebuilding, not restarting
   anything. Serve the resulting `dist/` as static files (the committed
   `.github/workflows/deploy-pages.yml` does this for GitHub Pages; a cPanel
   host can serve it from any static document root just as well).
4. **Run the server as a long-lived process**, not `npm run dev` — `npm start`
   under cPanel's Node.js App Manager, or under PM2 (`pm2 start src/server.mjs
   --name ferrobid-api`) if you manage the box yourself. Either way it needs
   to survive a reboot and restart on crash; neither `npm start` alone nor a
   bare `node` process does that for you.
5. **Set `TRUST_PROXY=1`** if there is a reverse proxy in front of the process
   (cPanel always puts one there). Getting this wrong makes every request look
   like it came from the proxy's own address, and the per-IP rate limiter then
   throttles the whole world as one caller — which reads as the API being
   broken for everyone, not as a config mistake.
6. **Run the smoke test against the live URL before calling it done**:
   `node scripts/smoke-auth.mjs --url https://your-api-origin` (needs
   `npm run db:seed-auth` run once first, for the demo accounts it signs in
   as — or point it at accounts you know the passwords for). It is the
   closest thing this project has to a deploy gate: 39 checks covering
   authentication, authorization, the CMS, and rate limiting, in under a
   minute. A clean run is not proof nothing is wrong, but a failing one is
   proof something is.

What this project does **not** have yet, and a production rollout should
account for: outbound email/SMS/WhatsApp for notifications (`notify()` only
ever writes to the in-app feed), generated PDFs for invoices and delivery
orders, an error-tracking integration (errors currently only go to whatever
captures stdout/stderr), and a backup schedule for the database beyond
whatever the hosting provider does by default.

## Things that will bite you

**The database server's clock is EDT, not IST**, and we do not change server
config. Every instant is stored UTC in `DATETIME(3)` and converted to IST for
display by `src/time.mjs`. Two rules follow, and both are enforced by
convention rather than by the schema:

- never use `TIMESTAMP` columns — they are re-read through the session timezone
- never use `NOW()` / `CURRENT_TIMESTAMP` defaults — pass `nowUtc()` from the app

**`bigNumberStrings` is on**, so BIGINT ids survive as strings instead of lossy
doubles. The catch is that `COUNT(*)` and even `SELECT 1` also come back as
strings, and `'0'` is truthy. Always `Number()` a numeric scalar before testing
it. This has already caused three bugs.

**Money is `DECIMAL(14,2)`** and mysql2 returns it as a string. That is
deliberate — rupee arithmetic must not round through a double. Convert to
`Number` only at the API boundary, where the frontend's types expect numbers.

**This is a shared cPanel host**: `max_connections` is 150 across every account
on the box and `wait_timeout` is 300s. The pool is capped at 8 with a 60s idle
timeout. Measured peak use is 6. Raise only with evidence of queueing.

## Seeded time

The fixtures are authored around a fixed anchor and the prototype rebases them
to "now" on every page load. A database cannot do that — rows hold absolute
instants — so `db:seed` applies the shift once, and the data ages from there.
Live auctions really do close. **Re-run `npm run db:seed` to rebase the demo
data around the current moment.**
