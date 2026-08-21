/* ---------------------------------------------------------------------------
   Persistence endpoint.

   Takes a batch of row changes produced by the client-side store diff and
   applies them in ONE transaction, so an action that touches four tables either
   lands completely or not at all — a lot going 'sold' while its delivery order
   fails to insert is exactly the kind of half-state a prototype tolerates and a
   database must not.

   Shape:
     POST /api/mutate
     { ops: [ { entity, op: 'upsert' | 'delete', row } , ... ] }

   Every op is filtered through entities.mjs first, so unknown entities are
   rejected and unknown columns are dropped rather than passed through.

   Each op checks whether the row exists and then UPDATEs or INSERTs. The
   obvious one-round-trip alternative, INSERT .. ON DUPLICATE KEY UPDATE, does
   not work here: MySQL must be able to build a valid INSERT even when the row
   already exists, so a partial update -- {id, status} for a lot -- fails on
   every NOT NULL column the client did not send. A partial update is the normal
   case for a status change, so correctness wins over the round trip.

   Either branch is idempotent, so replaying a batch after a dropped connection
   is safe.
--------------------------------------------------------------------------- */
import { pool } from '../db.mjs'
import { ENTITIES, keyColumns, toColumns } from './entities.mjs'

const MAX_OPS = 2000

export async function applyMutations(ops) {
  if (!Array.isArray(ops)) throw Object.assign(new Error('ops must be an array'), { status: 400 })
  if (ops.length > MAX_OPS) {
    throw Object.assign(new Error(`too many ops (${ops.length} > ${MAX_OPS})`), { status: 413 })
  }

  /* Validate everything before opening a transaction: a bad batch should be
     rejected outright, not half-applied and rolled back. */
  const prepared = []
  for (const [i, op] of ops.entries()) {
    const { entity, op: kind = 'upsert', row } = op ?? {}
    const spec = ENTITIES[entity]
    if (!spec) throw Object.assign(new Error(`op ${i}: unknown entity "${entity}"`), { status: 400 })
    if (!row || typeof row !== 'object') {
      throw Object.assign(new Error(`op ${i}: row missing`), { status: 400 })
    }
    if (kind !== 'upsert' && kind !== 'delete') {
      throw Object.assign(new Error(`op ${i}: unknown op "${kind}"`), { status: 400 })
    }

    const keys = keyColumns(entity, row)
    if (Object.values(keys).some((v) => v === undefined || v === null)) {
      throw Object.assign(new Error(`op ${i}: ${entity} is missing its key (${spec.key.join(', ')})`),
        { status: 400 })
    }

    if (kind === 'delete') {
      prepared.push({ kind, table: spec.table, keys })
      continue
    }

    const columns = { ...toColumns(entity, row), ...keys }
    if (Object.keys(columns).length === 0) {
      throw Object.assign(new Error(`op ${i}: ${entity} has no writable columns`), { status: 400 })
    }
    prepared.push({ kind, table: spec.table, keys, columns })
  }

  const conn = await pool.getConnection()
  await conn.beginTransaction()
  try {
    let written = 0
    for (const p of prepared) {
      if (p.kind === 'delete') {
        const where = Object.keys(p.keys).map((c) => `${c} = ?`).join(' AND ')
        const [r] = await conn.query(`DELETE FROM ${p.table} WHERE ${where}`, Object.values(p.keys))
        written += r.affectedRows
        continue
      }
      const where = Object.keys(p.keys).map((c) => `${c} = ?`).join(' AND ')
      const keyValues = Object.values(p.keys)
      const [[existing]] = await conn.query(
        `SELECT 1 AS found FROM ${p.table} WHERE ${where} LIMIT 1`, keyValues)

      if (existing) {
        /* Key columns identified the row; they are not part of the update. */
        const updatable = Object.keys(p.columns).filter((c) => !(c in p.keys))
        if (updatable.length === 0) continue // key-only row, already present
        const [r] = await conn.query(
          `UPDATE ${p.table} SET ${updatable.map((c) => `${c} = ?`).join(', ')} WHERE ${where}`,
          [...updatable.map((c) => p.columns[c]), ...keyValues],
        )
        written += r.affectedRows
      } else {
        const cols = Object.keys(p.columns)
        const [r] = await conn.query(
          `INSERT INTO ${p.table} (${cols.join(', ')}) VALUES (?)`,
          [cols.map((c) => p.columns[c])],
        )
        written += r.affectedRows
      }
    }
    await conn.commit()
    return { ok: true, ops: prepared.length, rowsAffected: written }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

/* ---------------------------------------------------------------------------
   Wallets and shortlists need shapes the generic path cannot express.

   A Wallet carries its ledger inline, and a BuyerLotSelection carries two
   parallel arrays of lot ids. Both are one object in the store and several rows
   in the database, so they get their own handlers rather than a registry entry.
--------------------------------------------------------------------------- */

/** Wallet balances plus any ledger entries the client does not already have. */
export async function saveWallet(wallet) {
  const conn = await pool.getConnection()
  await conn.beginTransaction()
  try {
    await conn.query(
      `INSERT INTO wallets (user_id, balance, emd_locked) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE balance = VALUES(balance), emd_locked = VALUES(emd_locked)`,
      [wallet.userId, wallet.balance ?? 0, wallet.emdLocked ?? 0],
    )
    for (const e of wallet.ledger ?? []) {
      await conn.query(
        `INSERT INTO wallet_ledger (id, user_id, at, type, amount, ref, lot_id, catalogue_id, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE amount = VALUES(amount), note = VALUES(note)`,
        [e.id, wallet.userId, new Date(e.at).toISOString().slice(0, 23).replace('T', ' '),
         e.type, e.amount, e.ref ?? null, e.lotId ?? null, e.catalogueId ?? null, e.note ?? null],
      )
    }
    await conn.commit()
    return { ok: true, ledgerEntries: (wallet.ledger ?? []).length }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

/** One buyer's shortlist for one catalogue, as the complete set of its rows.
 *  Replace rather than merge: the client sends the whole selection, so a lot it
 *  omitted is a lot the buyer un-shortlisted. */
export async function saveSelection(selection) {
  const { buyerId, catalogueId, lotIds = [], emdFundedLotIds = [] } = selection
  const funded = new Set(emdFundedLotIds)
  const rows = [...new Set([...lotIds, ...funded])]

  const conn = await pool.getConnection()
  await conn.beginTransaction()
  try {
    await conn.query('DELETE FROM selection_lots WHERE buyer_id = ? AND catalogue_id = ?',
      [buyerId, catalogueId])
    if (rows.length) {
      await conn.query(
        'INSERT INTO selection_lots (buyer_id, catalogue_id, lot_id, emd_funded) VALUES ?',
        [rows.map((lotId) => [buyerId, catalogueId, lotId, funded.has(lotId) ? 1 : 0])],
      )
    }
    await conn.commit()
    return { ok: true, lots: rows.length }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

/** Platform settings that are single JSON documents. */
export async function saveSetting(key, value) {
  const allowed = ['financeConfig', 'withdrawalWindow', 'ceoDelegation']
  if (!allowed.includes(key)) {
    throw Object.assign(new Error(`unknown setting "${key}"`), { status: 400 })
  }
  await pool.query(
    `INSERT INTO app_settings (setting_key, value, updated_at) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)`,
    [key, JSON.stringify(value ?? null), new Date().toISOString().slice(0, 23).replace('T', ' ')],
  )
  return { ok: true }
}
