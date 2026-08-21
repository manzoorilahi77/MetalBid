/* ---------------------------------------------------------------------------
   The two writes the server has to own.

   Everything else in this app persists through /api/mutate, which takes the
   store's own computed result. That is fine for a status change or a decision
   record: two people rarely fight over the same one, and last write wins is an
   acceptable answer when they do.

   It is NOT an acceptable answer here. Placing a bid and funding EMD are both
   read-modify-write races over money:

   * Two bids arriving together must not both read currentRate = 30000 and both
     be accepted at 30150. The lot row is locked FOR UPDATE so the second bid
     re-reads the first one's result and is rejected on its merits.
   * Two EMD fundings must not both see the same available balance and both
     succeed, locking more than the buyer has. The wallet row is locked the same
     way.

   So these two recompute the rules server-side from freshly locked rows rather
   than trusting what the client worked out. The client's own copy of the logic
   stays — it is what makes the UI feel instant — but the server's answer wins,
   and the client applies what comes back.

   The rules below mirror store.ts `applyBid` deliberately, including the tender
   exemptions. Where they ever diverge, this file is the one that decides.
--------------------------------------------------------------------------- */
import { randomUUID } from 'node:crypto'
import { pool } from '../db.mjs'
import { iso, num } from './dto.mjs'
import { publish } from '../realtime/bus.mjs'

const dbTime = (d) => new Date(d).toISOString().slice(0, 23).replace('T', ' ')
const fail = (message, status = 409) => Object.assign(new Error(message), { status, expected: true })

/** Place a bid. Returns the accepted bid and the lot as it now stands. */
export async function placeBid({ lotId, bidderId, rate, type = 'manual' }) {
  if (!lotId || !bidderId || !Number.isFinite(Number(rate))) {
    throw fail('lotId, bidderId and a numeric rate are required', 400)
  }
  rate = Number(rate)

  const conn = await pool.getConnection()
  await conn.beginTransaction()
  try {
    /* FOR UPDATE is the whole point: it serialises concurrent bids on this lot
       so each one sees the previous winner's rate, not a stale read. */
    const [[lot]] = await conn.query(
      `SELECT id, lot_no, catalogue_id, status, start_rate, increment, current_rate,
              leading_bidder_id, bid_count, ends_at, extensions, uom
         FROM lots WHERE id = ? FOR UPDATE`, [lotId])
    if (!lot) throw fail('Lot not found', 404)

    const [[cat]] = await conn.query(
      'SELECT id, status, type, anti_snipe_minutes, ends_at FROM catalogues WHERE id = ?',
      [lot.catalogue_id])
    if (!cat || cat.status !== 'live' || lot.status !== 'live') throw fail('Lot is not live')

    /* The countdown is the law even though no scheduler flips the row yet:
       lots stay status='live' in the database after their close, and the
       client's own tick is what hides them. The server is the authority, so a
       bid landing after the (possibly anti-snipe-extended) close is refused
       here rather than trusted to the caller's clock. Tender lots have a null
       ends_at and close with their catalogue. */
    const now = Date.now()
    const closesAt = lot.ends_at ? new Date(lot.ends_at).getTime()
      : cat.ends_at ? new Date(cat.ends_at).getTime() : null
    if (closesAt !== null && now >= closesAt) throw fail('Bidding on this lot has closed')

    const isTender = cat.type === 'tender'

    /* Sealed tender: exactly one offer per buyer per lot, no revision. */
    if (isTender) {
      const [[existing]] = await conn.query(
        "SELECT COUNT(*) n FROM bids WHERE lot_id = ? AND bidder_id = ? AND status = 'valid'",
        [lotId, bidderId])
      if (Number(existing.n) > 0) throw fail('You have already submitted an offer for this lot')
    }

    /* A tender offer is ranked against the floor, not against a visible rate. */
    const current = num(lot.current_rate)
    const minRate = isTender || current === null
      ? num(lot.start_rate)
      : current + num(lot.increment)
    if (rate < minRate) {
      throw fail(`Minimum ${isTender ? 'offer' : 'next bid'} is ${minRate} per ${lot.uom}`)
    }

    const bid = {
      id: `bid-${randomUUID().slice(0, 12)}`,
      lotId, catalogueId: cat.id, bidderId, rate,
      at: new Date(now).toISOString(), type, status: 'valid',
    }

    /* Anti-snipe: a bid inside the last N minutes pushes the close out by N.
       Tender lots have no visible countdown to snipe, so they are exempt. */
    let endsAt = lot.ends_at ? new Date(lot.ends_at).getTime() : null
    let extensions = lot.extensions
    if (!isTender && endsAt !== null) {
      const window = cat.anti_snipe_minutes * 60_000
      if (endsAt - now < window) {
        endsAt += window
        extensions += 1
      }
    }

    await conn.query(
      'INSERT INTO bids (id, lot_id, catalogue_id, bidder_id, rate, at, type, status) VALUES (?,?,?,?,?,?,?,?)',
      [bid.id, lotId, cat.id, bidderId, rate, dbTime(now), type, 'valid'])

    await conn.query(
      `UPDATE lots SET current_rate = ?, leading_bidder_id = ?, bid_count = bid_count + 1,
              ends_at = ?, extensions = ? WHERE id = ?`,
      [rate, bidderId, endsAt === null ? null : dbTime(endsAt), extensions, lotId])

    await conn.commit()

    /* Everyone watching this lot learns the new rate from one place — the
       server that accepted it — rather than each browser working it out from
       its own copy. `bidderId` is deliberately absent: identity is masked per
       the disclosure rules, and the stream is the last place to leak it. */
    publish({
      type: 'bid.placed',
      lotId, catalogueId: cat.id,
      currentRate: rate,
      bidCount: lot.bid_count + 1,
      endsAt: endsAt === null ? null : new Date(endsAt).toISOString(),
      extended: extensions !== lot.extensions,
    })
    if (lot.leading_bidder_id && lot.leading_bidder_id !== bidderId && !isTender) {
      publish({ type: 'bid.outbid', userId: lot.leading_bidder_id, lotId, catalogueId: cat.id, currentRate: rate })
    }

    return {
      ok: true,
      bid,
      lot: {
        id: lot.id, currentRate: rate, leadingBidderId: bidderId,
        bidCount: lot.bid_count + 1,
        endsAt: endsAt === null ? null : new Date(endsAt).toISOString(),
        extensions,
      },
      /* So the caller can tell whoever just lost the lead. */
      outbid: !isTender && lot.leading_bidder_id && lot.leading_bidder_id !== bidderId
        ? lot.leading_bidder_id : null,
      extended: extensions !== lot.extensions,
    }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

/* The EMD window rules, mirroring src/lib/emd.ts on the client: funding is
   accepted between `emd_opens_at` (default: 30 days before the deadline) and
   `emd_deadline` (default: 1 day before go-live), and an approved exemption
   request reopens a closed window. The client enforces the same rules for the
   UI; these are the authoritative copy. */
const DAY_MS = 24 * 3600_000
const emdDeadlineMs = (cat) =>
  cat.emd_deadline ? new Date(cat.emd_deadline).getTime()
    : new Date(cat.starts_at).getTime() - DAY_MS
const emdOpensAtMs = (cat) =>
  cat.emd_opens_at ? new Date(cat.emd_opens_at).getTime()
    : emdDeadlineMs(cat) - 30 * DAY_MS

/** Lock EMD against a set of lots in one catalogue, from the buyer's wallet. */
export async function fundEmd({ buyerId, catalogueId, lotIds, method = 'wallet' }) {
  if (!buyerId || !catalogueId || !Array.isArray(lotIds) || lotIds.length === 0) {
    throw fail('buyerId, catalogueId and a non-empty lotIds array are required', 400)
  }

  const conn = await pool.getConnection()
  await conn.beginTransaction()
  try {
    const [[cat]] = await conn.query(
      'SELECT id, code, status, starts_at, emd_deadline, emd_opens_at FROM catalogues WHERE id = ?',
      [catalogueId])
    if (!cat) throw fail('Catalogue not found', 404)
    if (cat.status !== 'upcoming' && cat.status !== 'live') {
      throw fail('This auction is not open for EMD')
    }
    const now = Date.now()
    if (cat.status === 'upcoming' && now < emdOpensAtMs(cat)) {
      throw fail(`EMD for ${cat.code} has not opened yet`)
    }
    if (now > emdDeadlineMs(cat)) {
      const [[exempt]] = await conn.query(
        `SELECT COUNT(*) n FROM emd_exemption_requests
          WHERE buyer_id = ? AND catalogue_id = ? AND status = 'approved'`,
        [buyerId, catalogueId])
      if (Number(exempt.n) === 0) {
        throw fail(`EMD for ${cat.code} closed at its deadline — this auction can no longer be joined`)
      }
    }

    /* Lock the wallet before reading the balance, so two concurrent fundings
       cannot both see the same available amount. */
    const [[wallet]] = await conn.query(
      'SELECT user_id, balance, emd_locked FROM wallets WHERE user_id = ? FOR UPDATE', [buyerId])
    if (!wallet) throw fail('No wallet for this buyer', 404)

    const marks = lotIds.map(() => '?').join(', ')
    const [lots] = await conn.query(
      `SELECT id, pre_bid_emd FROM lots WHERE id IN (${marks}) AND catalogue_id = ?`,
      [...lotIds, catalogueId])
    if (lots.length !== lotIds.length) throw fail('Some lots are not in this catalogue', 400)

    /* Already-funded lots are skipped rather than double-charged — the client
       may resend a selection that partly overlaps what is already locked. */
    const [funded] = await conn.query(
      `SELECT lot_id FROM selection_lots
        WHERE buyer_id = ? AND catalogue_id = ? AND emd_funded = 1 AND lot_id IN (${marks})`,
      [buyerId, catalogueId, ...lotIds])
    const alreadyFunded = new Set(funded.map((r) => r.lot_id))
    const toFund = lots.filter((l) => !alreadyFunded.has(l.id))

    const total = toFund.reduce((sum, l) => sum + num(l.pre_bid_emd), 0)
    const balance = num(wallet.balance)
    if (total > balance) {
      throw fail(`EMD of ${total} exceeds the available balance of ${balance}`)
    }

    if (total > 0) {
      await conn.query(
        'UPDATE wallets SET balance = balance - ?, emd_locked = emd_locked + ? WHERE user_id = ?',
        [total, total, buyerId])
      await conn.query(
        `INSERT INTO wallet_ledger (id, user_id, at, type, amount, ref, catalogue_id, note)
         VALUES (?, ?, ?, 'emd_lock', ?, ?, ?, ?)`,
        [`led-${randomUUID().slice(0, 12)}`, buyerId, dbTime(Date.now()), -total,
         method, catalogueId, `EMD locked on ${toFund.length} lot(s)`])
    }

    for (const l of toFund) {
      await conn.query(
        `INSERT INTO selection_lots (buyer_id, catalogue_id, lot_id, emd_funded) VALUES (?,?,?,1)
         ON DUPLICATE KEY UPDATE emd_funded = 1`,
        [buyerId, catalogueId, l.id])
    }

    await conn.commit()

    return {
      ok: true,
      funded: toFund.map((l) => l.id),
      skipped: [...alreadyFunded],
      amount: total,
      wallet: {
        userId: buyerId,
        balance: balance - total,
        emdLocked: num(wallet.emd_locked) + total,
      },
    }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

/** Credit a wallet — a verified deposit, a refund, an EMD release. */
export async function creditWallet({ userId, amount, type = 'topup', ref = null, note = null }) {
  if (!userId || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    throw fail('userId and a positive amount are required', 400)
  }
  amount = Number(amount)

  const conn = await pool.getConnection()
  await conn.beginTransaction()
  try {
    const [[wallet]] = await conn.query(
      'SELECT user_id, balance, emd_locked FROM wallets WHERE user_id = ? FOR UPDATE', [userId])
    if (!wallet) throw fail('No wallet for this user', 404)

    await conn.query('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', [amount, userId])
    const entry = {
      id: `led-${randomUUID().slice(0, 12)}`,
      at: new Date().toISOString(), type, amount, ref, note,
    }
    await conn.query(
      'INSERT INTO wallet_ledger (id, user_id, at, type, amount, ref, note) VALUES (?,?,?,?,?,?,?)',
      [entry.id, userId, dbTime(entry.at), type, amount, ref, note])

    await conn.commit()
    return { ok: true, entry, wallet: { userId, balance: num(wallet.balance) + amount, emdLocked: num(wallet.emd_locked) } }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

export { iso }
