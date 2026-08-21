/* ---------------------------------------------------------------------------
   FerroBid API server.

   Every route below carries an explicit guard. That is deliberate and it is the
   main change from the version of this file that had none: a route with no
   guard should be *visibly* unguarded — `public` says so in as many characters
   as `requireRole` does — rather than open because nobody remembered.

   The guards, in the order they get stricter:

     public                 anybody, signed in or not
     requireAuth            any account
     requireSelfOrRole      your own record, or a role whose job includes it
     requireRole(...)       a named set of roles
     requireGoodStanding    plus: not a defaulter (money and bidding only)

   Vite dev serves the frontend on 5173; this runs on PORT (4000 by default), so
   CORS is open to the dev origins only. Set ALLOWED_ORIGINS before deploying.
--------------------------------------------------------------------------- */
import express from 'express'
import cors from 'cors'
import { env } from './env.mjs'
import { pool, closePool } from './db.mjs'
import { formatIst } from './time.mjs'

import { getHomeData } from './api/home.mjs'
import { getBuyerData } from './api/buyer.mjs'
import { getSellerData } from './api/seller.mjs'
import { getFieldData } from './api/field.mjs'
import { getExecData } from './api/exec.mjs'
import { getAuctionData } from './api/auction.mjs'
import { getFinanceData } from './api/finance.mjs'
import { getSubAdminData, getSuperAdminData, getCeoData } from './api/admin.mjs'
import { applyMutations, saveSelection, saveSetting, saveWallet } from './api/mutate.mjs'
import { creditWallet, fundEmd, placeBid } from './api/bidding.mjs'

import * as auth from './api/auth.mjs'
import * as cms from './api/cms.mjs'
import * as uploads from './api/uploads.mjs'
import { authorizeOps } from './api/policy.mjs'

import {
  authenticate, requireAuth, requireRole, requireSelfOrRole, requireGoodStanding,
} from './auth/middleware.mjs'
import {
  BACK_OFFICE_ROLES, ADMIN_ROLES, AUCTION_CONTROL_ROLES, CEO_ROLES, hasRole,
} from './auth/roles.mjs'
import { rateLimit, byUserOrIp, clientIp } from './security/ratelimit.mjs'
import { securityHeaders, requestId, requestLog, requireJsonBody } from './security/headers.mjs'
import { subscribe, subscriberCount, closeAll as closeStreams } from './realtime/bus.mjs'
import { startScheduler, stopScheduler, tick } from './jobs/scheduler.mjs'

const app = express()
const PORT = Number(env.PORT ?? 4000)
const PRODUCTION = env.NODE_ENV === 'production'

/* cPanel and most managed hosts put a reverse proxy in front. Without this,
   every request appears to come from 127.0.0.1 and the per-IP rate limiter
   throttles the whole world as one caller. */
app.set('trust proxy', Number(env.TRUST_PROXY ?? 1))
app.disable('x-powered-by')

const ALLOWED = (env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',').map((s) => s.trim()).filter(Boolean)

if (PRODUCTION && ALLOWED.some((o) => o.includes('localhost'))) {
  console.warn('[api] WARNING: ALLOWED_ORIGINS still contains a localhost origin in production')
}

app.use(cors({
  origin: ALLOWED,
  /* The frontend sends its access token in the Authorization header, so no
     cookie crosses the origin and credentials stay off. If this API is ever
     served same-origin with the frontend, move the refresh token to an
     httpOnly cookie and turn this on — see README. */
  credentials: false,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Filename', 'Last-Event-ID'],
  maxAge: 86_400,
}))

app.use(requestId)
app.use(securityHeaders)

/* Uploads are raw bytes and must not meet the JSON parser. Mounted before it. */
app.use('/api/uploads', express.raw({ type: '*/*', limit: uploads.MAX_UPLOAD_BYTES }))

/* 100kb (the express default) is too small for /api/mutate: the client sends
   one batch per user action, and a bulk decision touching a few hundred lots
   plus their audit rows clears 100kb easily. A 413 there surfaces as a save
   that retries forever. */
app.use(express.json({ limit: '5mb' }))
app.use(requireJsonBody)

app.use(authenticate)
app.use(requestLog())

/* A floor under everything, so one client cannot exhaust the 8-connection pool
   however it is authenticated. Per-route limits sit on top of this. */
app.use(rateLimit({ name: 'global', limit: 600, windowMs: 60_000, key: byUserOrIp }))

/** Wraps an async handler so a rejected promise becomes an error the handler
 *  below renders, rather than an unhandled rejection that ends the process. */
const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)

/** Explicit "anybody may call this". Reads as a decision, not an omission. */
const public_ = (req, _res, next) => next()

/* ============================== health ==================================== */

app.get('/api/health', public_, route(async (_req, res) => {
  const [row] = await pool.query('SELECT 1 AS ok')
  // Number(): mysql2 returns BIGINT-typed results as strings under
  // bigNumberStrings, and that includes integer literals and COUNT(*).
  res.json({
    ok: Number(row[0].ok) === 1,
    serverTime: new Date().toISOString(),
    streams: subscriberCount(),
  })
}))

/* ================================ auth ==================================== */

/* Tighter than the global limiter and counted by address, because the thing
   being protected is the guess rate. `countFailuresOnly` is what keeps it from
   also punishing success: an office behind one NAT address signs in all day,
   and only wrong passwords should count toward a lockout. The durable half of
   this lives in the database — see the IP failure count in api/auth.mjs, which
   survives a restart. */
const loginLimit = rateLimit({
  name: 'login',
  /* Loosened outside production so repeated wrong-password testing doesn't
     lock out the whole dev box for 15 minutes at a time. */
  limit: PRODUCTION ? 10 : 200,
  windowMs: 15 * 60_000,
  key: clientIp,
  countFailuresOnly: true,
})

app.post('/api/auth/login', public_, loginLimit, route(async (req, res) => {
  res.json(await auth.login({
    identifier: req.body?.identifier ?? req.body?.email ?? req.body?.username,
    password: req.body?.password,
    ip: clientIp(req),
    userAgent: req.headers['user-agent'],
  }))
}))

app.post('/api/auth/refresh', public_,
  rateLimit({ name: 'refresh', limit: 60, windowMs: 15 * 60_000, key: clientIp }),
  route(async (req, res) => {
    res.json(await auth.refresh({
      refreshToken: req.body?.refreshToken,
      ip: clientIp(req),
      userAgent: req.headers['user-agent'],
    }))
  }))

app.post('/api/auth/logout', public_, route(async (req, res) => {
  res.json(await auth.logout({
    refreshToken: req.body?.refreshToken,
    userId: req.auth?.userId,
    everywhere: req.body?.everywhere === true,
  }))
}))

app.get('/api/auth/me', requireAuth, route(async (req, res) => {
  res.json(await auth.me(req.auth))
}))

app.post('/api/auth/password', requireAuth,
  rateLimit({ name: 'password', limit: 5, windowMs: 60 * 60_000, key: byUserOrIp }),
  route(async (req, res) => {
    res.json(await auth.changePassword({
      auth: req.auth,
      currentPassword: req.body?.currentPassword,
      newPassword: req.body?.newPassword,
      keepOtherSessions: req.body?.keepOtherSessions === true,
    }))
  }))

app.post('/api/auth/reset', requireRole(ADMIN_ROLES), route(async (req, res) => {
  res.json(await auth.issueTemporaryPassword({
    auth: req.auth, userId: req.body?.userId, password: req.body?.password ?? null,
  }))
}))

app.post('/api/auth/impersonate', requireRole(ADMIN_ROLES), route(async (req, res) => {
  res.json(await auth.impersonate({
    auth: req.auth, userId: req.body?.userId, ip: clientIp(req), userAgent: req.headers['user-agent'],
  }))
}))

/* =============================== realtime ================================= */

/* Anybody may watch — a guest sees a live ladder on the public catalogue page.
   What each subscriber receives is filtered per event in the bus, so a private
   event (an outbid notice) reaches one account only. */
app.get('/api/stream', public_, (req, res) => {
  subscribe({
    req, res,
    userId: req.auth?.userId ?? null,
    role: req.auth?.role ?? 'guest',
    catalogueId: typeof req.query.catalogueId === 'string' ? req.query.catalogueId : null,
    lastEventId: req.headers['last-event-id'] ?? req.query.lastEventId,
  })
})

/* ================================ reads =================================== */

/* The public marketplace. No account needed — that is the product. */
app.get('/api/home', public_, route(async (_req, res) => {
  res.json(await getHomeData())
}))

/* These were the hole: `/api/buyer/:buyerId` took any id from anyone. Now the
   caller is either that user or somebody whose job includes their record. */
app.get('/api/buyer/:buyerId',
  requireSelfOrRole('buyerId', BACK_OFFICE_ROLES),
  route(async (req, res) => {
    const data = await getBuyerData(req.params.buyerId)
    if (!data) return res.status(404).json({ error: 'not_found', message: 'No such user' })
    res.json(data)
  }))

app.get('/api/seller/:sellerId',
  requireSelfOrRole('sellerId', BACK_OFFICE_ROLES),
  route(async (req, res) => {
    const data = await getSellerData(req.params.sellerId)
    if (!data) return res.status(404).json({ error: 'not_found', message: 'No such user' })
    res.json(data)
  }))

app.get('/api/field/:userId',
  requireSelfOrRole('userId', ['exec_manager', 'sub_admin', 'super_admin']),
  route(async (req, res) => {
    const data = await getFieldData(req.params.userId)
    if (!data) return res.status(404).json({ error: 'not_found', message: 'No such user' })
    res.json(data)
  }))

/* No :userId — the Operation Manager's scope is the whole pipeline, not a
   subset keyed on who is asking. Which is exactly why the role check matters:
   there is no ownership to fall back on. */
app.get('/api/exec', requireRole('exec_manager', ADMIN_ROLES), route(async (_req, res) => {
  res.json(await getExecData())
}))

app.get('/api/auction', requireRole(AUCTION_CONTROL_ROLES), route(async (_req, res) => {
  res.json(await getAuctionData())
}))

app.get('/api/finance', requireRole('finance_admin', 'ceo', ADMIN_ROLES), route(async (_req, res) => {
  res.json(await getFinanceData())
}))

app.get('/api/sub', requireRole(ADMIN_ROLES), route(async (_req, res) => {
  res.json(await getSubAdminData())
}))

app.get('/api/admin', requireRole('super_admin'), route(async (_req, res) => {
  res.json(await getSuperAdminData())
}))

app.get('/api/ceo', requireRole(CEO_ROLES), route(async (_req, res) => {
  res.json(await getCeoData())
}))

/* ================================ writes ================================== */

/* Server-authoritative. These recompute from locked rows; the client applies
   whatever comes back. See bidding.mjs.

   `requireGoodStanding` is the addition: a defaulting account may read its
   history but may not bid or move money. And `bidderId` now comes from the
   token, never from the body — otherwise anybody could bid as anybody. */
app.post('/api/bids', requireAuth, requireGoodStanding,
  rateLimit({ name: 'bid', limit: 120, windowMs: 60_000, key: byUserOrIp }),
  route(async (req, res) => {
    res.json(await placeBid({ ...req.body, bidderId: req.auth.userId }))
  }))

app.post('/api/emd/fund', requireAuth, requireGoodStanding, route(async (req, res) => {
  res.json(await fundEmd({ ...req.body, buyerId: req.auth.userId }))
}))

/* Crediting a wallet is Finance's act, not the account holder's: a buyer who
   could call this could type themselves a balance. A deposit CLAIM is what a
   buyer files, and it goes through /api/mutate for Finance to verify. */
app.post('/api/wallet/credit', requireRole('finance_admin', ADMIN_ROLES), route(async (req, res) => {
  res.json(await creditWallet(req.body ?? {}))
}))

/* Persistence for everything else — the store's own result, whitelisted by
   entities.mjs for shape and by policy.mjs for permission, applied in one
   transaction. */
app.post('/api/mutate', requireAuth,
  rateLimit({ name: 'mutate', limit: 240, windowMs: 60_000, key: byUserOrIp }),
  route(async (req, res) => {
    const ops = req.body?.ops
    if (!Array.isArray(ops)) {
      return res.status(400).json({ error: 'invalid_request', message: 'ops must be an array' })
    }
    res.json(await applyMutations(await authorizeOps(ops, req.auth)))
  }))

app.post('/api/wallets', requireRole('finance_admin', ADMIN_ROLES), route(async (req, res) => {
  res.json(await saveWallet(req.body ?? {}))
}))

/* A selection is a buyer's own shortlist, so the buyer on it is the caller. */
app.post('/api/selections', requireAuth, route(async (req, res) => {
  res.json(await saveSelection({ ...req.body, buyerId: req.auth.userId }))
}))

/* Platform settings — rates, windows, delegation. The company's top role holds
   these; see the roles decision in the Content Atlas. */
app.post('/api/settings/:key', requireRole(ADMIN_ROLES), route(async (req, res) => {
  res.json(await saveSetting(req.params.key, req.body?.value))
}))

/* ================================= CMS ==================================== */

/* Reading published content is public — it is the public site. */
app.get('/api/cms/page', public_, route(async (req, res) => {
  res.json(await cms.getPageContent({
    route: req.query.route,
    role: req.auth?.role ?? null,
  }))
}))

/**
 * The section list.
 *
 * Two audiences, two answers, and conflating them was a bug worth naming: a
 * page RENDERING itself wants only the sections its own role can see, but an
 * editor ADMINISTERING them has to see all of them — otherwise a Sub Admin
 * cannot switch off a section that only appears in the buyer's portal, which is
 * most of them.
 *
 * So an editor gets everything unless they ask for a role; everybody else is
 * scoped to their own.
 */
app.get('/api/cms/sections', public_, route(async (req, res) => {
  const editing = hasRole(req.auth?.role, [...ADMIN_ROLES, ...CEO_ROLES])
  res.json(await cms.listSections({
    route: req.query.route ?? null,
    role: typeof req.query.role === 'string' ? req.query.role
      : editing ? null
      : (req.auth?.role ?? null),
  }))
}))

/* Everything below edits the site. */
const editor = requireRole(ADMIN_ROLES, CEO_ROLES)

app.get('/api/cms/blocks', editor, route(async (req, res) => {
  res.json(await cms.listBlocks({ pageKey: req.query.pageKey ?? null, status: req.query.status ?? null }))
}))

app.post('/api/cms/blocks', editor, route(async (req, res) => {
  res.json(await cms.saveBlock({ auth: req.auth, block: req.body }))
}))

app.post('/api/cms/blocks/:id/publish', editor, route(async (req, res) => {
  res.json(await cms.publishBlock({ auth: req.auth, blockId: req.params.id, note: req.body?.note }))
}))

app.post('/api/cms/blocks/:id/unpublish', editor, route(async (req, res) => {
  res.json(await cms.unpublishBlock({ auth: req.auth, blockId: req.params.id, reason: req.body?.reason }))
}))

app.post('/api/cms/blocks/:id/rollback', editor, route(async (req, res) => {
  res.json(await cms.rollbackBlock({ auth: req.auth, blockId: req.params.id, version: req.body?.version }))
}))

app.post('/api/cms/blocks/:id/sign', requireRole(CEO_ROLES), route(async (req, res) => {
  res.json(await cms.signBlock({
    auth: req.auth, blockId: req.params.id,
    approve: req.body?.approve, note: req.body?.note,
  }))
}))

app.post('/api/cms/sections', editor, route(async (req, res) => {
  res.json(await cms.upsertSection({ auth: req.auth, section: req.body }))
}))

/* The enable/disable switch — every page of every portal, not just Home. */
app.patch('/api/cms/sections/enabled', editor, route(async (req, res) => {
  res.json(await cms.setSectionEnabled({
    auth: req.auth,
    route: req.body?.route, sectionKey: req.body?.sectionKey, role: req.body?.role ?? null,
    enabled: req.body?.enabled, reason: req.body?.reason,
  }))
}))

app.post('/api/cms/sections/reorder', editor, route(async (req, res) => {
  res.json(await cms.reorderSections({ auth: req.auth, route: req.body?.route, order: req.body?.order }))
}))

app.get('/api/cms/changes', editor, route(async (req, res) => {
  res.json(await cms.listChanges({
    target: req.query.target ?? null, targetId: req.query.targetId ?? null, limit: req.query.limit,
  }))
}))

/* =============================== uploads ================================== */

app.post('/api/uploads', requireAuth,
  rateLimit({ name: 'upload', limit: 60, windowMs: 60_000, key: byUserOrIp }),
  route(async (req, res) => {
    /* express.raw() already buffered the body under the same cap. */
    res.json(await uploads.storeUpload({
      auth: req.auth,
      kind: req.query.kind,
      buffer: Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
      filename: req.headers['x-filename'],
      entityType: req.query.entityType ?? null,
      entityId: req.query.entityId ?? null,
      altText: req.query.altText ?? null,
    }))
  }))

app.get('/api/uploads/:id', public_, route(async (req, res) => {
  const file = await uploads.readUpload({ auth: req.auth ?? null, uploadId: req.params.id })
  res.setHeader('Content-Type', file.mime)
  res.setHeader('Cache-Control', file.cacheControl)
  /* attachment, always: a PDF or an image is never rendered inline from this
     origin, so a crafted file cannot execute in our security context. */
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename.replace(/"/g, '')}"`)
  res.send(file.buffer)
}))

app.delete('/api/uploads/:id', requireAuth, route(async (req, res) => {
  res.json(await uploads.deleteUpload({ auth: req.auth, uploadId: req.params.id }))
}))

app.get('/api/uploads', public_, route(async (req, res) => {
  res.json(await uploads.listUploads({
    auth: req.auth ?? null, entityType: req.query.entityType, entityId: req.query.entityId,
  }))
}))

/* =============================== scheduler ================================ */

/* Run a pass by hand — for an operator who needs a close to happen now, and for
   the case where this process runs with the scheduler disabled and cron pokes
   it instead. */
app.post('/api/jobs/tick', requireRole(ADMIN_ROLES), route(async (_req, res) => {
  res.json(await tick())
}))

/* ============================== not found ================================= */

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'not_found', message: 'No such endpoint' })
})

/* =============================== errors =================================== */

app.use((err, req, res, _next) => {
  /* Rules the caller broke (bid too low, EMD over balance, wrong password) are
     expected outcomes, not faults — they carry their own status and are not
     logged as server errors. Anything else is ours. */
  const status = err.status ?? 500
  if (!err.expected && status >= 500) console.error(`[api] [${req.id}]`, err)

  res.status(status).json({
    error: err.code ?? (err.expected ? 'rejected' : 'internal_error'),
    /* A 500 says nothing about itself in production: a stack trace or a driver
       message in a response body is a map of the system. */
    message: status >= 500 && PRODUCTION
      ? 'Something went wrong on our side. The request id below identifies it in our logs.'
      : err.message,
    requestId: req.id,
  })
})

/* =============================== startup ================================== */

await uploads.ensureUploadDir()

const server = app.listen(PORT, () => {
  console.log(`FerroBid API on http://localhost:${PORT}`)
  console.log(`  auth      POST /api/auth/login · refresh · logout · password   GET /api/auth/me`)
  console.log(`  public    GET  /api/health · /api/home · /api/cms/page · /api/stream`)
  console.log(`  scoped    GET  /api/buyer/:id · /api/seller/:id · /api/field/:id   (self or back office)`)
  console.log(`  staff     GET  /api/exec · /api/auction · /api/finance · /api/sub · /api/admin · /api/ceo`)
  console.log(`  writes    POST /api/bids · /api/emd/fund · /api/mutate · /api/uploads`)
  console.log(`  cms       GET/POST/PATCH /api/cms/*`)
  console.log(`  uploads   ${uploads.UPLOAD_ROOT}`)
  console.log(`  started   ${formatIst(new Date())} IST`)
})

/* The scheduler runs in-process by default. Set SCHEDULER=off and drive it with
   `POST /api/jobs/tick` from cron when the API runs in more than one process
   and you would rather one machine own the clock. */
if ((env.SCHEDULER ?? 'on') !== 'off') {
  startScheduler({ intervalMs: Number(env.SCHEDULER_INTERVAL_MS ?? 15_000) })
} else {
  console.log('[scheduler] disabled — drive it with POST /api/jobs/tick')
}

let shuttingDown = false
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`\n[api] ${sig} — shutting down`)
    stopScheduler()
    closeStreams()
    server.close(async () => {
      await closePool()
      process.exit(0)
    })
    /* A stream that will not close, or a query mid-flight, must not hold the
       process open forever — the host will SIGKILL it anyway, less tidily. */
    setTimeout(() => process.exit(0), 10_000).unref()
  })
}

/* An unhandled rejection anywhere means a promise chain lost its error. Log it
   with enough context to find, and keep serving: killing the process over one
   dropped rejection takes every live bidder down with it. */
process.on('unhandledRejection', (reason) => {
  console.error('[api] unhandled rejection', reason)
})
