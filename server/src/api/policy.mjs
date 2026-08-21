/* ---------------------------------------------------------------------------
   Write authorization for /api/mutate.

   entities.mjs said it plainly: "What this is NOT: authorization. It says what
   shape a write may take, not who may make it." This is the missing half.

   Every op in a batch is checked twice:

   1. **Role.** `writableBy`, already recorded on every entity, is now enforced.
      A buyer cannot write `catalogues`, whatever the client sends.

   2. **Ownership.** Role alone is not enough for the customer-facing entities.
      A buyer may write `bankAccounts` — but only rows whose `userId` is their
      own, otherwise "register a payout account" becomes "repoint somebody
      else's payouts at my bank". So each entity a customer can write declares
      which column has to equal the caller, and the check reads the row *as it
      exists in the database*, not as the client described it. That distinction
      is the whole point: a client that lies about `userId` on an update would
      otherwise pass an ownership check against its own lie.

   Three further rules that are not per-entity:

   * **Money is not writable by the person it belongs to.** A buyer may create a
     deposit claim; they may not set its `status` to 'verified'. Fields like
     that are listed in `staffOnlyFields` and stripped — not rejected — from a
     customer's write, because the client legitimately sends whole rows.

   * **Staff act on anyone's records, within their role.** Finance writes any
     buyer's refund; that is the job. Ownership checks apply to customers only.

   * **Nobody escalates themselves.** `users.role`, `users.standing` and
     `users.status` are admin-only regardless of who owns the row.
--------------------------------------------------------------------------- */
import { pool } from '../db.mjs'
import { ENTITIES } from './entities.mjs'
import { hasRole, isStaff, ADMIN_ROLES } from '../auth/roles.mjs'

const deny = (message) =>
  Object.assign(new Error(message), { status: 403, code: 'forbidden', expected: true })

/* ---------------------------------------------------------------------------
   Ownership map.

   entity -> the camelCase field on the row that must equal the caller's user id
   when the caller is a customer (buyer/seller) rather than staff.

   `via` handles the rows that do not carry the owner directly: a `lots` row
   belongs to the seller named on it, but a `commissionSettlements` row is tied
   to a lot, so the owner has to be looked up one hop away.
--------------------------------------------------------------------------- */
const OWNERSHIP = {
  lots:                  { column: 'seller_id' },
  bankAccounts:          { column: 'user_id' },
  depositClaims:         { column: 'user_id' },
  withdrawalRequests:    { column: 'user_id' },
  refundRequests:        { column: 'user_id' },
  disputes:              { column: 'user_id' },
  testimonials:          { column: 'user_id' },
  watchlist:             { column: 'buyer_id', key: ['buyer_id', 'catalogue_id'] },
  autoBids:              { column: 'buyer_id', key: ['buyer_id', 'lot_id'] },
  emdExemptionRequests:  { column: 'buyer_id' },
  inspectionSlots:       { column: 'user_id' },
  deliveryOrders:        { column: 'buyer_id' },
  notifications:         { column: 'user_id' },
  commissionSettlements: { column: 'seller_id' },
}

/* Columns a customer may never set on their own row, whatever the client sends.
   Stripped rather than rejected: the store diff legitimately posts the whole
   row back, and rejecting the batch would break a valid action for a field the
   user never touched. */
const STAFF_ONLY_FIELDS = {
  lots: ['status', 'current_rate', 'leading_bidder_id', 'bid_count', 'result_h1_rate',
         'inspection_waived', 'waived_by', 'waived_reason', 'waived_at', 'catalogue_id',
         'inspection_report_id', 'known_seller', 'seller_decision'],
  depositClaims: ['status', 'rejection_reason', 'decided_at', 'decided_by'],
  withdrawalRequests: ['status', 'reason', 'decided_at', 'reviewed_by', 'reviewed_at', 'processed_by'],
  refundRequests: ['status', 'decided_by', 'decided_at', 'decision_note', 'processed_by', 'processed_at'],
  bankAccounts: ['status', 'rejection_reason'],
  disputes: ['status', 'outcome', 'resolution', 'resolved_at', 'resolved_by_id',
             'assigned_to_id', 'refund_id'],
  /* A quote is public the moment a moderator says so — the person who wrote it
     may not say so themselves. */
  testimonials: ['status', 'moderated_by', 'moderated_at', 'moderation_note'],
  emdExemptionRequests: ['status', 'decided_at', 'decided_by', 'rejection_reason'],
  deliveryOrders: ['stage', 'paid_amount', 'dd_id', 'weighed_qty', 'weighed_by_id', 'weighed_at',
                   'handover_confirmed_at', 'handover_confirmed_by'],
  commissionSettlements: ['status', 'confirmed_by', 'confirmed_at', 'query_note'],
  users: ['role', 'standing', 'status', 'kyc_status', 'seller_verified', 'bidder_id',
          'password_hash', 'token_version', 'login_email'],
}

/* Entities only an admin may write at all, whatever `writableBy` says — the
   registry that decides who can see what, and the record of who changed it. */
const ADMIN_ONLY = new Set([
  'roleRegistry', 'pageRegistry', 'structuralChanges',
  'masterCategories', 'masterUoms', 'masterYards',
  'companyBankAccounts', 'passwordResets',
])

/* Append-only: an existing row may not be updated by anyone through this path.
   The audit trail is worthless if it can be edited, and a bid's history is
   evidence in a dispute. */
const APPEND_ONLY = new Set(['auditEvents', 'bids', 'structuralChanges'])

/**
 * Check and clean a batch of ops for one caller. Returns the ops to apply —
 * possibly with fields removed — or throws the first violation.
 *
 * @param {Array}  ops   as posted
 * @param {object} auth  req.auth
 */
export async function authorizeOps(ops, auth) {
  if (!auth) throw Object.assign(
    new Error('Sign in to continue'), { status: 401, code: 'unauthenticated', expected: true })

  const staff = isStaff(auth.role)
  const admin = hasRole(auth.role, ADMIN_ROLES)
  const out = []

  /* Existing rows are read once, in bulk, per entity — an ownership check per op
     would be N round trips against a pool of 8 connections. */
  const existing = await loadExisting(ops)

  for (const [i, original] of ops.entries()) {
    let op = original
    const { entity, op: kind = 'upsert', row } = op ?? {}
    const spec = ENTITIES[entity]
    if (!spec) throw Object.assign(
      new Error(`op ${i}: unknown entity "${entity}"`), { status: 400, code: 'invalid_request', expected: true })

    /* 1. Role. */
    const allowed = spec.writableBy ?? []
    const wildcard = allowed.includes('*')
    if (!wildcard && !hasRole(auth.role, allowed)) {
      throw deny(`Your role cannot change ${label(entity)}`)
    }
    if (ADMIN_ONLY.has(entity) && !admin) {
      throw deny(`Only an administrator can change ${label(entity)}`)
    }

    /* 2. Append-only entities. */
    const key = rowKey(entity, row)
    const prior = key ? existing.get(`${entity}:${key}`) : null
    if (APPEND_ONLY.has(entity)) {
      if (kind === 'delete') throw deny(`${label(entity)} cannot be deleted`)
      /* An update to an existing append-only row is allowed only for staff and
         only on `status` — that is how a void marks a bid, and nothing else. */
      if (prior && !staff) throw deny(`${label(entity)} cannot be edited`)
      if (prior && staff) {
        const stripped = onlyFields(row, ['id', 'status'])
        out.push({ ...op, row: stripped })
        continue
      }
    }

    /* 3. Ownership, for customers. */
    if (!staff) {
      const own = OWNERSHIP[entity]
      if (own) {
        /* On an update, the row in the database decides. On an insert, the row
           being written decides — and is forced to name the caller. */
        const ownerNow = prior ? prior[own.column] : null
        if (prior) {
          if (ownerNow !== auth.userId) throw deny(`That ${label(entity, true)} is not yours`)
        } else {
          /* Insert. Rather than merely checking the claim, overwrite it: a
             composite-key row (watchlist, autoBids) cannot be matched against an
             existing row, so "the client did not name an owner" and "the client
             named someone else" have to collapse into the same safe answer. */
          const field = camel(own.column)
          const claimed = row?.[field]
          if (claimed && claimed !== auth.userId) throw deny('You can only create records for yourself')
          op = { ...op, row: { ...row, [field]: auth.userId } }
        }
      } else if (!wildcard) {
        /* A customer writing an entity with no ownership rule is a gap in this
           map, not a permission. Fail closed and name it so it gets fixed. */
        throw deny(`Writing ${label(entity)} is not available to your role`)
      }

      /* 4. Strip the fields a customer may never set. Reads from `op.row`, not
         the original `row` — step 3 may just have overwritten the owner field
         on an insert, and stripping from the pre-overwrite row would silently
         discard that, sending a write with no owner at all (a DB-level
         "doesn't have a default value" error, not a security hole, but a real
         bug: the ownership guarantee above stops applying). */
      const banned = STAFF_ONLY_FIELDS[entity]
      if (banned) {
        const cleaned = dropColumns(entity, op.row, banned)
        out.push({ ...op, row: cleaned })
        continue
      }
    }

    /* 5. Nobody, staff included, escalates a role or standing except an admin. */
    if (entity === 'users' && !admin) {
      out.push({ ...op, row: dropColumns(entity, row, STAFF_ONLY_FIELDS.users) })
      continue
    }

    out.push(op)
  }

  return out
}

/* ------------------------------- internals ------------------------------- */

/** Fetch the current version of every row a batch touches, keyed entity:id. */
async function loadExisting(ops) {
  const byEntity = new Map()
  for (const op of ops) {
    const entity = op?.entity
    if (!ENTITIES[entity]) continue
    const key = rowKey(entity, op.row)
    if (!key) continue
    if (!byEntity.has(entity)) byEntity.set(entity, new Set())
    byEntity.get(entity).add(key)
  }

  const found = new Map()
  for (const [entity, keys] of byEntity) {
    const spec = ENTITIES[entity]
    const own = OWNERSHIP[entity]
    /* Only the key and the owner column are needed; selecting * would pull
       reserve prices and bank details into memory for no reason. */
    const cols = ['id']
    if (own) cols.push(own.column)
    const ids = [...keys]
    /* Chunked so a 2000-op batch does not build a 2000-mark IN list. */
    for (let i = 0; i < ids.length; i += 200) {
      const slice = ids.slice(i, i + 200)
      const [rows] = await pool.query(
        `SELECT ${[...new Set(cols)].join(', ')} FROM ${spec.table}
          WHERE id IN (${slice.map(() => '?').join(', ')})`, slice)
      for (const r of rows) found.set(`${entity}:${r.id}`, r)
    }
  }
  return found
}

const rowKey = (entity, row) => {
  const spec = ENTITIES[entity]
  if (!spec || !row) return null
  /* Every entity in the registry is keyed on `id` except the composite ones,
     which customers do not own individually. */
  return spec.key.length === 1 && spec.key[0] === 'id' ? row.id ?? null : null
}

/** Remove the camelCase fields that map to any of `columns`. */
function dropColumns(entity, row, columns) {
  const spec = ENTITIES[entity]
  const banned = new Set(columns)
  const out = {}
  for (const [field, value] of Object.entries(row ?? {})) {
    const col = spec.fields[field]?.[0] ?? field
    if (banned.has(col)) continue
    out[field] = value
  }
  return out
}

/** Keep only the named camelCase fields. */
function onlyFields(row, fields) {
  const keep = new Set(fields)
  const out = {}
  for (const [k, v] of Object.entries(row ?? {})) if (keep.has(k)) out[k] = v
  return out
}

const camel = (column) => column.replace(/_([a-z])/g, (_, c) => c.toUpperCase())

/** A readable name for an error message — "delivery orders", not "deliveryOrders". */
function label(entity, singular = false) {
  const words = entity.replace(/([A-Z])/g, ' $1').toLowerCase().trim()
  return singular ? words.replace(/s$/, '') : words
}
