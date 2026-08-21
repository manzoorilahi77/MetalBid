/* ---------------------------------------------------------------------------
   The scheduler — the thing bidding.mjs said was missing.

   Its own comment: "The countdown is the law even though no scheduler flips the
   row yet." Until now nothing did. A lot's `ends_at` passed and the row stayed
   `live` forever; the closed state existed only in whichever browser happened to
   be open, computed from `endsAt` vs `now`. A sale that finished overnight, with
   nobody watching, produced no winner, no delivery order, and no EMD release.

   This runs the same resolution the store runs, server-side and for everyone:

     openDueCatalogues   upcoming -> live at starts_at, and its approved lots go live
     closeDueLots        live lots past ends_at -> sold | sta | unsold
     closeDueCatalogues  a live catalogue whose lots have all resolved -> closed
     flagOverduePayments delivery orders past their payment window
     prune               expired sessions and old login attempts

   Three properties it has to hold:

   * **Only one runner.** `GET_LOCK` on a named lock, held on one dedicated
     connection for the life of the tick. Two API processes, or a restart that
     overlaps the previous run, cannot both close the same lot and raise two
     delivery orders for it.

   * **Idempotent.** Every statement is conditioned on the state it expects
     (`WHERE status = 'live'`), so a tick that dies half way and runs again
     finishes the job instead of doubling it.

   * **Per lot, not per batch.** One lot that throws must not stop the other
     forty from closing, so each is its own transaction.

   The rules mirror store.ts `tick()` deliberately — H1 at or above reserve
   sells, below reserve is subject-to-approval, no bids is unsold. Where the two
   ever diverge, this file is the one that decides, exactly as bidding.mjs is
   the authority for a bid.
--------------------------------------------------------------------------- */
import { pool } from '../db.mjs'
import { toDbDateTime } from '../time.mjs'
import { newId } from '../auth/tokens.mjs'
import { pruneSessions } from '../auth/sessions.mjs'
import { pruneLoginAttempts } from '../api/auth.mjs'
import { publish } from '../realtime/bus.mjs'

const LOCK_NAME = 'ferrobid:scheduler'
const DEFAULT_INTERVAL_MS = 15_000

let timer = null
let running = false

/* --------------------------------- driver -------------------------------- */

export function startScheduler({ intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  if (timer) return
  /* Run once shortly after boot rather than immediately: let the pool warm and
     the first health check answer before competing for connections. */
  timer = setInterval(() => { void tick() }, intervalMs)
  timer.unref?.()
  setTimeout(() => { void tick() }, 2_000).unref?.()
  console.log(`[scheduler] every ${intervalMs / 1000}s`)
}

export function stopScheduler() {
  if (timer) clearInterval(timer)
  timer = null
}

/** One pass. Exported so a test — or an operator — can run it by hand. */
export async function tick() {
  if (running) return { skipped: 'already_running' }
  running = true

  /* The lock lives on ONE connection and is released by returning it. Taking it
     with a 0-second timeout means a second runner declines rather than queues. */
  const conn = await pool.getConnection()
  let held = false
  try {
    const [[lock]] = await conn.query('SELECT GET_LOCK(?, 0) AS got', [LOCK_NAME])
    held = Number(lock.got) === 1
    if (!held) return { skipped: 'lock_held_elsewhere' }

    const result = {}
    result.opened = await run('open_catalogues', openDueCatalogues)
    result.lotsClosed = await run('close_lots', closeDueLots)
    result.cataloguesClosed = await run('close_catalogues', closeDueCatalogues)
    result.paymentsOverdue = await run('flag_overdue_payments', flagOverduePayments)
    result.pruned = await run('prune', prune)
    return result
  } catch (err) {
    console.error('[scheduler] tick failed', err)
    return { error: err.message }
  } finally {
    if (held) await conn.query('SELECT RELEASE_LOCK(?)', [LOCK_NAME]).catch(() => {})
    conn.release()
    running = false
  }
}

/** Wrap one job so its outcome is recorded whether it worked or not. */
async function run(job, fn) {
  const id = newId('job')
  const started = new Date()
  try {
    const { affected = 0, detail = null } = (await fn()) ?? {}
    /* Silence is the normal case — a tick where nothing was due should not
       write a row every fifteen seconds. Only real work is recorded. */
    if (affected > 0) {
      await pool.execute(
        `INSERT INTO job_runs (id, job, started_at, finished_at, outcome, affected, detail)
         VALUES (?, ?, ?, ?, 'ok', ?, ?)`,
        [id, job, toDbDateTime(started), toDbDateTime(new Date()), affected,
         detail ? JSON.stringify(detail).slice(0, 4000) : null])
    }
    return affected
  } catch (err) {
    console.error(`[scheduler] ${job} failed`, err)
    await pool.execute(
      `INSERT INTO job_runs (id, job, started_at, finished_at, outcome, affected, error)
       VALUES (?, ?, ?, ?, 'error', 0, ?)`,
      [id, job, toDbDateTime(started), toDbDateTime(new Date()), String(err?.message ?? err).slice(0, 4000)],
    ).catch(() => {})
    return 0
  }
}

/* ---------------------------- open what is due --------------------------- */

async function openDueCatalogues() {
  const now = new Date()
  const [due] = await pool.execute(
    `SELECT id, code, title, seller_id, ends_at
       FROM catalogues
      WHERE status = 'upcoming' AND starts_at <= ?
      LIMIT 50`, [toDbDateTime(now)])
  if (!due.length) return { affected: 0 }

  const opened = []
  for (const cat of due) {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      /* Conditioned on the status we read, so a concurrent publish that already
         opened it makes this a no-op rather than a second open. */
      const [res] = await conn.execute(
        `UPDATE catalogues SET status = 'live' WHERE id = ? AND status = 'upcoming'`, [cat.id])
      if (res.affectedRows === 0) { await conn.rollback(); continue }

      await conn.execute(
        `UPDATE lots SET status = 'live', ends_at = ?
          WHERE catalogue_id = ? AND status = 'approved'`,
        [toDbDateTime(cat.ends_at), cat.id])

      await audit(conn, 'auction.open', cat.code,
        `${cat.title} opened on schedule — bidding is live`)
      if (cat.seller_id) {
        await notify(conn, cat.seller_id, 'lifecycle', `${cat.code} is live`,
          `Bidding has opened on ${cat.title}. You can follow it lot by lot.`, '/seller/monitor')
      }
      await conn.commit()
      opened.push(cat.code)
      publish({ type: 'catalogue.open', catalogueId: cat.id, code: cat.code })
    } catch (err) {
      await conn.rollback()
      console.error(`[scheduler] opening ${cat.code} failed`, err)
    } finally {
      conn.release()
    }
  }
  return { affected: opened.length, detail: opened }
}

/* ---------------------------- close what is due -------------------------- */

async function closeDueLots() {
  const now = new Date()
  /* Paused sales are excluded the same way the store excludes them: an operator
     paused the clock, so the clock does not get to close the lot. */
  const [due] = await pool.execute(
    `SELECT l.id
       FROM lots l
       JOIN catalogues c ON c.id = l.catalogue_id
      WHERE l.status = 'live'
        AND l.ends_at <= ?
        AND c.status = 'live'
        AND COALESCE(c.paused, 0) = 0
      ORDER BY l.ends_at
      LIMIT 200`, [toDbDateTime(now)])
  if (!due.length) return { affected: 0 }

  const config = await financeConfig()
  let closed = 0
  const detail = []
  for (const { id } of due) {
    try {
      const outcome = await closeOneLot(id, config)
      if (outcome) { closed += 1; detail.push(outcome) }
    } catch (err) {
      console.error(`[scheduler] closing lot ${id} failed`, err)
    }
  }
  return { affected: closed, detail: detail.slice(0, 100) }
}

/**
 * Resolve one lot, in one transaction.
 *
 * Locked FOR UPDATE against the same row bidding.mjs locks, so a bid landing in
 * the final millisecond either gets in before the close or is rejected by it —
 * never both.
 */
async function closeOneLot(lotId, config) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [[lot]] = await conn.query(
      `SELECT id, lot_no, catalogue_id, seller_id, status, current_rate, reserve_rate,
              leading_bidder_id, indicative_qty, uom, pre_bid_emd, ends_at
         FROM lots WHERE id = ? FOR UPDATE`, [lotId])

    /* Re-checked inside the lock: the row may have been closed, paused or
       extended between the SELECT that found it and this transaction. */
    if (!lot || lot.status !== 'live' || new Date(lot.ends_at).getTime() > Date.now()) {
      await conn.rollback()
      return null
    }

    const [[cat]] = await conn.query(
      'SELECT id, code, title, seller_id FROM catalogues WHERE id = ? LIMIT 1', [lot.catalogue_id])

    const h1 = lot.current_rate === null ? null : Number(lot.current_rate)
    const reserve = Number(lot.reserve_rate)
    const status = h1 === null ? 'unsold' : h1 >= reserve ? 'sold' : 'sta'
    const winnerId = status === 'sold' ? lot.leading_bidder_id : null
    const at = new Date()

    await conn.execute(
      `UPDATE lots SET status = ?, result_h1_rate = ? WHERE id = ? AND status = 'live'`,
      [status, h1, lot.id])

    if (winnerId) {
      /* The winner's delivery order — what Finance collects against and what
         Operations lifts against. Guarded by a lookup rather than a unique
         index because a lot may legitimately be re-auctioned later. */
      const [[existing]] = await conn.query(
        'SELECT id FROM delivery_orders WHERE lot_id = ? AND buyer_id = ? LIMIT 1',
        [lot.id, winnerId])

      if (!existing) {
        const materialValue = Math.round(h1 * Number(lot.indicative_qty))
        const liftingBy = new Date(at.getTime() + config.paymentWindowDays * 86_400_000)
        await conn.execute(
          `INSERT INTO delivery_orders
             (id, lot_id, catalogue_id, buyer_id, stage, h1_rate, awarded_qty, uom,
              material_value, gst_amount, tcs_amount, paid_amount, lifting_by,
              created_at, lifting_checklist)
           VALUES (?, ?, ?, ?, 'payment_pending', ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
          [newId('do'), lot.id, cat.id, winnerId, h1, lot.indicative_qty, lot.uom,
           materialValue,
           Math.round(materialValue * (config.gstPct / 100)),
           Math.round(materialValue * (config.tcsPct / 100)),
           toDbDateTime(liftingBy), toDbDateTime(at),
           JSON.stringify(emptyLiftingChecklist())])
      }

      await notify(conn, winnerId, 'bid', `You won ${lot.lot_no}`,
        `H1 confirmed at ${inr(h1)}/${lot.uom}. Your delivery order is raised — payment opens the lifting.`,
        '/buyer/auction-status')
      await notifyRole(conn, ['finance_admin'], 'system', `Delivery order raised — ${lot.lot_no}`,
        `A buyer won at ${inr(h1)}/${lot.uom}. ${inr(Math.round(h1 * Number(lot.indicative_qty)))} before tax is due.`,
        '/finance/payments')
    }

    /* Everybody who funded EMD on this lot and did not win gets it back the
       moment the lot closes — the rule the store already holds, now enforced
       for every funder rather than only the one at a screen. */
    const [funders] = await conn.query(
      `SELECT buyer_id FROM selection_lots
        WHERE lot_id = ? AND emd_funded = 1 ${winnerId ? 'AND buyer_id <> ?' : ''}
        FOR UPDATE`,
      winnerId ? [lot.id, winnerId] : [lot.id])

    const emd = Number(lot.pre_bid_emd)
    for (const f of funders) {
      /* Lock the wallet for the same reason fundEmd does: two releases landing
         together must not both read the same locked balance. */
      await conn.query('SELECT user_id FROM wallets WHERE user_id = ? FOR UPDATE', [f.buyer_id])
      await conn.execute(
        `UPDATE wallets
            SET balance = balance + ?, emd_locked = GREATEST(0, emd_locked - ?)
          WHERE user_id = ?`, [emd, emd, f.buyer_id])
      await conn.execute(
        `INSERT INTO wallet_ledger (id, user_id, at, type, amount, ref, lot_id, catalogue_id, note)
         VALUES (?, ?, ?, 'emd_release', ?, ?, ?, ?, ?)`,
        [newId('led'), f.buyer_id, toDbDateTime(at), emd,
         `EMDR-${lot.id.slice(-6).toUpperCase()}`, lot.id, cat.id,
         `EMD auto-released — ${lot.lot_no} (${cat.code})`])
      await conn.execute(
        'UPDATE selection_lots SET emd_funded = 0 WHERE buyer_id = ? AND lot_id = ?',
        [f.buyer_id, lot.id])
      await notify(conn, f.buyer_id, 'wallet', `EMD released — ${lot.lot_no}`,
        `${inr(emd)} returned to your wallet (auction closed, not H1).`, '/buyer/wallet')
    }

    await conn.commit()
    publish({
      type: 'lot.close',
      lotId: lot.id, catalogueId: cat.id, lotNo: lot.lot_no,
      status, h1Rate: h1, winnerId,
    })
    return { lot: lot.lot_no, status, h1 }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

async function closeDueCatalogues() {
  /* A catalogue closes when nothing in it is still contestable. Expressed as a
     NOT EXISTS rather than by counting in JS, so the decision is made against
     the rows as they stand at that instant. */
  const [due] = await pool.execute(
    `SELECT c.id, c.code, c.title, c.seller_id
       FROM catalogues c
      WHERE c.status = 'live'
        AND EXISTS (SELECT 1 FROM lots l WHERE l.catalogue_id = c.id)
        AND NOT EXISTS (
          SELECT 1 FROM lots l
           WHERE l.catalogue_id = c.id AND l.status IN ('live', 'approved'))
      LIMIT 50`)
  if (!due.length) return { affected: 0 }

  const codes = []
  for (const cat of due) {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const [res] = await conn.execute(
        `UPDATE catalogues SET status = 'closed' WHERE id = ? AND status = 'live'`, [cat.id])
      if (res.affectedRows === 0) { await conn.rollback(); continue }

      const [[counts]] = await conn.query(
        `SELECT
           SUM(status = 'sold') AS sold,
           SUM(status = 'sta')  AS sta,
           COUNT(*)             AS total
         FROM lots WHERE catalogue_id = ?`, [cat.id])
      const sold = Number(counts.sold ?? 0)
      const sta = Number(counts.sta ?? 0)
      const total = Number(counts.total ?? 0)

      await audit(conn, 'auction.close', cat.code,
        `${cat.title} closed — ${sold} of ${total} lots sold${sta ? `, ${sta} below reserve` : ''}`)
      await notifyRole(conn, ['auction_manager', 'sub_admin'], 'lifecycle', `${cat.code} has closed`,
        `${sold} of ${total} lots sold${sta ? `, ${sta} cleared below reserve and need an Operations decision` : ''}. Confirm the results to release the seller's settlement.`,
        '/auction/results')
      if (sta > 0) {
        await notifyRole(conn, ['exec_manager', 'sub_admin'], 'system',
          `${sta} lot${sta === 1 ? '' : 's'} below reserve — ${cat.code}`,
          'Subject-to-approval lots are waiting on an Operations decision before the results can be confirmed.',
          '/exec/settlement')
      }
      if (cat.seller_id) {
        await notify(conn, cat.seller_id, 'lifecycle', `${cat.code} has closed`,
          `${sold} of ${total} lots sold. Settlement opens once the results are confirmed.`,
          '/seller/settlement')
      }
      await conn.commit()
      codes.push(cat.code)
      publish({ type: 'catalogue.close', catalogueId: cat.id, code: cat.code, sold, sta, total })
    } catch (err) {
      await conn.rollback()
      console.error(`[scheduler] closing ${cat.code} failed`, err)
    } finally {
      conn.release()
    }
  }
  return { affected: codes.length, detail: codes }
}

/* --------------------------- overdue payments ---------------------------- */

/**
 * A delivery order past its payment window.
 *
 * This deliberately does NOT forfeit the EMD. Forfeiture takes money from
 * somebody and needs a CEO signature — see the finance desk. What the machine
 * is allowed to do is say the window has passed, once, to the people whose job
 * it then becomes.
 */
async function flagOverduePayments() {
  const now = new Date()
  const [overdue] = await pool.execute(
    `SELECT d.id, d.lot_id, d.buyer_id, d.material_value, l.lot_no
       FROM delivery_orders d
       JOIN lots l ON l.id = d.lot_id
      WHERE d.stage = 'payment_pending'
        AND d.overdue_at IS NULL
        AND d.lifting_by IS NOT NULL
        AND d.lifting_by <= ?
      LIMIT 100`, [toDbDateTime(now)])
  if (!overdue.length) return { affected: 0 }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    for (const d of overdue) {
      /* `stage` is deliberately untouched — see migration 009. The machine
         records that the window passed; moving the stage is a person's call. */
      await conn.execute(
        `UPDATE delivery_orders SET overdue_at = ?
          WHERE id = ? AND stage = 'payment_pending' AND overdue_at IS NULL`,
        [toDbDateTime(now), d.id])
      await notify(conn, d.buyer_id, 'system', `Payment overdue — ${d.lot_no}`,
        `The payment window on ${d.lot_no} has passed. Pay now to keep the lot; continued default puts your EMD at risk.`,
        '/buyer/auction-status')
    }
    await notifyRole(conn, ['finance_admin', 'sub_admin'], 'system',
      `${overdue.length} payment${overdue.length === 1 ? '' : 's'} past the window`,
      'The payment window has closed on these delivery orders. Chase or refer them for forfeiture.',
      '/finance/payments')
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
  return { affected: overdue.length }
}

/* -------------------------------- prune ---------------------------------- */

async function prune() {
  /* Hourly is often enough, and this runs every 15s — so do it on the hour's
     first tick only, judged by the clock rather than by a counter that a
     restart would reset. */
  const minute = new Date().getUTCMinutes()
  if (minute !== 0) return { affected: 0 }
  const sessions = await pruneSessions()
  const attempts = await pruneLoginAttempts()
  return { affected: sessions + attempts, detail: { sessions, attempts } }
}

/* -------------------------------- helpers -------------------------------- */

let configCache = { at: 0, value: null }

async function financeConfig() {
  if (configCache.value && Date.now() - configCache.at < 60_000) return configCache.value
  const [rows] = await pool.execute(
    "SELECT value FROM app_settings WHERE setting_key = 'financeConfig' LIMIT 1")
  const raw = rows[0]?.value
  const parsed = typeof raw === 'string' ? safeParse(raw) : raw
  const value = {
    gstPct: Number(parsed?.gstPct ?? 18),
    tcsPct: Number(parsed?.tcsPct ?? 1),
    paymentWindowDays: Number(parsed?.paymentWindowDays ?? 3),
  }
  configCache = { at: Date.now(), value }
  return value
}

const safeParse = (s) => { try { return JSON.parse(s) } catch { return null } }

const emptyLiftingChecklist = () => [
  { key: 'vehicle_at_weighbridge', label: 'Vehicle at weighbridge', done: false },
  { key: 'loading_complete', label: 'Loading complete', done: false },
  { key: 'gross_weighment', label: 'Gross weighment recorded', done: false },
]

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`

async function notify(conn, userId, kind, title, body, href) {
  await conn.execute(
    `INSERT INTO notifications (id, user_id, kind, title, body, at, is_read, href)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    [newId('ntf'), userId, kind, title.slice(0, 191), body, toDbDateTime(new Date()), href])
}

async function notifyRole(conn, roles, kind, title, body, href) {
  const [users] = await conn.query(
    `SELECT id FROM users WHERE role IN (${roles.map(() => '?').join(',')}) AND status = 'active'`,
    roles)
  for (const u of users) await notify(conn, u.id, kind, title, body, href)
}

async function audit(conn, action, subject, detail) {
  await conn.execute(
    `INSERT INTO audit_events (id, at, actor_id, action, target, detail, severity)
     VALUES (?, ?, 'system', ?, ?, ?, 'info')`,
    [newId('aud'), toDbDateTime(new Date()), action, subject, detail],
  ).catch((err) => console.error('[scheduler] audit insert failed', err))
}
