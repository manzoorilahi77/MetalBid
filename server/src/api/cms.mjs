/* ---------------------------------------------------------------------------
   The CMS.

   Reads are public and cheap; writes belong to the Sub Admin. That split is the
   whole shape of this file.

   Two rules are enforced here rather than documented and hoped for:

   * **No figure is ever typed into copy.** The prototype's `submitContentDraft`
     held this rule on the client, where it was a convention. `assertNoFigures`
     holds it on the server, where it is a rule. Auction numbers come from the
     auction system, money from finance, words from here — a page that types
     "12,400 lots sold" is how the public site ends up contradicting the books.

   * **Pricing and legal need the CEO.** Publishing those pages does not make
     them live; it hands them to the signature queue. Everything else the Sub
     Admin publishes outright, because the Sub Admin is the company's highest
     role and nothing in the CMS waits on the vendor's break-glass account.
--------------------------------------------------------------------------- */
import { pool } from '../db.mjs'
import { toDbDateTime } from '../time.mjs'
import { newId } from '../auth/tokens.mjs'
import { hasRole, ADMIN_ROLES, CEO_ROLES } from '../auth/roles.mjs'
import { str, id as idField, oneOf, bool, int, plain, invalid } from './validate.mjs'

const deny = (message) =>
  Object.assign(new Error(message), { status: 403, code: 'forbidden', expected: true })

/** Pages whose copy commits the company in public. */
const CEO_SIGNED_PAGES = new Set(['pricing', 'terms', 'privacy', 'grievance'])

const BLOCK_KINDS = ['text', 'richtext', 'image', 'link', 'list', 'faq', 'number_label']
const SOURCE_CLASSES = ['cms', 'portal', 'api', 'live', 'own']

/* =============================== public read ============================== */

/**
 * Everything one page needs, in one request: its enabled sections in order,
 * each with its published blocks inlined.
 *
 * A section the registry says is off is not returned AND its blocks are not
 * read — switching a section off has to save the work, not just hide the box.
 */
export async function getPageContent({ route, role = null }) {
  const pageRoute = str(route, 'route', { max: 128 })

  const [sections] = await pool.execute(
    `SELECT section_key, title, description, source_class, sort_order, toggleable, locked_reason
       FROM section_registry
      WHERE page_route = ?
        AND enabled = 1
        AND role IN ('*', ?)
      ORDER BY sort_order, section_key`,
    [pageRoute, role ?? '*'])

  if (!sections.length) return { route: pageRoute, sections: [] }

  const pageKey = pageKeyFor(pageRoute)
  const keys = sections.map((s) => s.section_key)
  const [blocks] = await pool.query(
    `SELECT section_key, block_key, kind, published_value, sort_order
       FROM cms_block
      WHERE page_key = ?
        AND status = 'published'
        AND published_value IS NOT NULL
        AND section_key IN (${keys.map(() => '?').join(',')})
      ORDER BY sort_order, block_key`,
    [pageKey, ...keys])

  const bySection = new Map()
  for (const b of blocks) {
    if (!bySection.has(b.section_key)) bySection.set(b.section_key, {})
    bySection.get(b.section_key)[b.block_key] = parseJson(b.published_value)
  }

  return {
    route: pageRoute,
    sections: sections.map((s) => ({
      key: s.section_key,
      title: s.title,
      description: s.description,
      source: s.source_class,
      toggleable: !!s.toggleable,
      lockedReason: s.locked_reason,
      content: bySection.get(s.section_key) ?? {},
    })),
  }
}

/** The switches for one route, including the ones that are off — the editing
 *  view, as opposed to the rendering view above. */
export async function listSections({ route = null, role = null }) {
  const where = []
  const params = []
  if (route) { where.push('page_route = ?'); params.push(route) }
  if (role) { where.push("role IN ('*', ?)"); params.push(role) }

  const [rows] = await pool.query(
    `SELECT * FROM section_registry
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY page_route, sort_order, section_key
      LIMIT 2000`, params)

  return rows.map((r) => ({
    key: r.section_key, route: r.page_route, role: r.role,
    title: r.title, description: r.description, source: r.source_class,
    enabled: !!r.enabled, toggleable: !!r.toggleable, lockedReason: r.locked_reason,
    reviewRequired: !!r.review_required, sortOrder: Number(r.sort_order),
    updatedBy: r.updated_by, updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
  }))
}

/* ============================== authoring ================================= */

export async function listBlocks({ pageKey = null, status = null }) {
  const where = []
  const params = []
  if (pageKey) { where.push('page_key = ?'); params.push(pageKey) }
  if (status) { where.push('status = ?'); params.push(status) }

  const [rows] = await pool.query(
    `SELECT id, page_key, section_key, block_key, kind, locale, draft_value, published_value,
            status, version, authored_by, published_by, signed_by, note, sort_order,
            updated_at, published_at
       FROM cms_block
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY page_key, section_key, sort_order, block_key
      LIMIT 1000`, params)

  return rows.map(toBlockDto)
}

/** Create or edit a draft. Never touches what is published. */
export async function saveBlock({ auth, block }) {
  requireEditor(auth)

  const pageKey = idField(block?.pageKey, 'pageKey')
  const sectionKey = idField(block?.sectionKey, 'sectionKey')
  const blockKey = idField(block?.blockKey, 'blockKey')
  const kind = oneOf(block?.kind, 'kind', BLOCK_KINDS)
  const locale = str(block?.locale ?? 'en', 'locale', { max: 12 })
  const sortOrder = int(block?.sortOrder ?? 0, 'sortOrder', { min: -1000, max: 10_000 })

  if (block?.value === undefined) throw invalid('value is required')
  assertNoFigures(block.value, kind)

  const now = new Date()
  const [[existing]] = await pool.query(
    `SELECT * FROM cms_block
      WHERE page_key = ? AND section_key = ? AND block_key = ? AND locale = ? LIMIT 1`,
    [pageKey, sectionKey, blockKey, locale])

  if (existing) {
    await pool.execute(
      `UPDATE cms_block
          SET draft_value = ?, kind = ?, sort_order = ?, status = 'draft',
              authored_by = ?, note = NULL, updated_at = ?
        WHERE id = ?`,
      [JSON.stringify(block.value), kind, sortOrder, auth.userId, toDbDateTime(now), existing.id])
    await log({ target: 'cms_block', targetId: existing.id, action: 'edit',
      before: parseJson(existing.draft_value), after: block.value, auth })
    return { id: existing.id, status: 'draft' }
  }

  const id = newId('cms')
  await pool.execute(
    `INSERT INTO cms_block
       (id, page_key, section_key, block_key, kind, locale, draft_value, status,
        authored_by, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
    [id, pageKey, sectionKey, blockKey, kind, locale, JSON.stringify(block.value),
     auth.userId, sortOrder, toDbDateTime(now), toDbDateTime(now)])
  await log({ target: 'cms_block', targetId: id, action: 'edit', before: null, after: block.value, auth })
  return { id, status: 'draft' }
}

/**
 * Publish a draft.
 *
 * For most pages this makes it live. For pricing and legal it hands it to the
 * CEO instead — `ceo_pending` — and the page keeps serving the previous
 * published value until somebody signs.
 */
export async function publishBlock({ auth, blockId, note = null }) {
  requireEditor(auth)
  const id = idField(blockId, 'blockId')

  const [[block]] = await pool.query('SELECT * FROM cms_block WHERE id = ? LIMIT 1', [id])
  if (!block) throw Object.assign(new Error('No such block'), { status: 404, expected: true })
  if (block.draft_value === null) throw invalid('There is nothing to publish — the draft is empty')

  /* A page whose section demands a second reader cannot be published by the
     person who wrote it. The switch is per section, off by default. */
  const [[section]] = await pool.query(
    `SELECT review_required FROM section_registry
      WHERE section_key = ? AND page_route = ? LIMIT 1`,
    [block.section_key, routeFor(block.page_key)])
  if (section?.review_required && block.authored_by === auth.userId && auth.role !== 'super_admin') {
    throw deny('This section needs a second reader — another administrator has to publish it')
  }

  const now = new Date()

  if (CEO_SIGNED_PAGES.has(block.page_key) && !hasRole(auth.role, CEO_ROLES)) {
    await pool.execute(
      `UPDATE cms_block SET status = 'ceo_pending', note = ?, updated_at = ? WHERE id = ?`,
      [note, toDbDateTime(now), id])
    await log({ target: 'cms_block', targetId: id, action: 'publish',
      before: { status: block.status }, after: { status: 'ceo_pending' }, auth, reason: note })
    return { id, status: 'ceo_pending', message: 'Sent for signature — this page commits the company in public' }
  }

  const version = Number(block.version) + 1
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute(
      `UPDATE cms_block
          SET published_value = draft_value, status = 'published', version = ?,
              published_by = ?, signed_by = ?, published_at = ?, updated_at = ?, note = ?
        WHERE id = ?`,
      [version, auth.userId, hasRole(auth.role, CEO_ROLES) ? auth.userId : null,
       toDbDateTime(now), toDbDateTime(now), note, id])
    await conn.execute(
      `INSERT INTO cms_block_versions (id, block_id, version, value, published_by, signed_by, published_at, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId('cmsv'), id, version, toJsonColumn(block.draft_value), auth.userId,
       hasRole(auth.role, CEO_ROLES) ? auth.userId : null, toDbDateTime(now), note])
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }

  await log({ target: 'cms_block', targetId: id, action: 'publish',
    before: parseJson(block.published_value), after: parseJson(block.draft_value), auth, reason: note })
  return { id, status: 'published', version }
}

/** Take a published block off the site without deleting its words. */
export async function unpublishBlock({ auth, blockId, reason }) {
  requireEditor(auth)
  const id = idField(blockId, 'blockId')
  const why = plain(reason, 'reason', { max: 512 })

  const [[block]] = await pool.query('SELECT * FROM cms_block WHERE id = ? LIMIT 1', [id])
  if (!block) throw Object.assign(new Error('No such block'), { status: 404, expected: true })

  await pool.execute(
    `UPDATE cms_block SET published_value = NULL, status = 'draft', updated_at = ?, note = ? WHERE id = ?`,
    [toDbDateTime(new Date()), why, id])
  await log({ target: 'cms_block', targetId: id, action: 'unpublish',
    before: parseJson(block.published_value), after: null, auth, reason: why })
  return { id, status: 'draft' }
}

/** Restore a previous published version. */
export async function rollbackBlock({ auth, blockId, version }) {
  requireEditor(auth)
  const id = idField(blockId, 'blockId')
  const target = int(version, 'version', { min: 1 })

  const [[snapshot]] = await pool.query(
    'SELECT value FROM cms_block_versions WHERE block_id = ? AND version = ? LIMIT 1', [id, target])
  if (!snapshot) throw Object.assign(
    new Error('That version does not exist'), { status: 404, expected: true })

  const [[block]] = await pool.query('SELECT * FROM cms_block WHERE id = ? LIMIT 1', [id])
  const next = Number(block.version) + 1
  const now = new Date()

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute(
      `UPDATE cms_block
          SET published_value = ?, draft_value = ?, status = 'published', version = ?,
              published_by = ?, published_at = ?, updated_at = ?, note = ?
        WHERE id = ?`,
      [toJsonColumn(snapshot.value), toJsonColumn(snapshot.value), next, auth.userId, toDbDateTime(now), toDbDateTime(now),
       `Rolled back to version ${target}`, id])
    /* The rollback is itself a version, so the history reads forwards and the
       thing that was rolled back is still reachable. */
    await conn.execute(
      `INSERT INTO cms_block_versions (id, block_id, version, value, published_by, published_at, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newId('cmsv'), id, next, toJsonColumn(snapshot.value), auth.userId, toDbDateTime(now),
       `Rolled back to version ${target}`])
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }

  await log({ target: 'cms_block', targetId: id, action: 'rollback',
    before: parseJson(block.published_value), after: parseJson(snapshot.value), auth,
    reason: `to version ${target}` })
  return { id, status: 'published', version: next, restoredFrom: target }
}

/** The CEO's signature queue for content. */
export async function signBlock({ auth, blockId, approve, note = null }) {
  if (!hasRole(auth.role, CEO_ROLES)) throw deny('Only the CEO can sign this')
  const id = idField(blockId, 'blockId')
  const ok = bool(approve, 'approve')

  const [[block]] = await pool.query('SELECT * FROM cms_block WHERE id = ? LIMIT 1', [id])
  if (!block) throw Object.assign(new Error('No such block'), { status: 404, expected: true })
  if (block.status !== 'ceo_pending') throw invalid('That page is not waiting for a signature')

  if (!ok) {
    await pool.execute(
      `UPDATE cms_block SET status = 'returned', note = ?, updated_at = ? WHERE id = ?`,
      [plain(note ?? 'Returned without a reason given', 'note', { max: 512 }),
       toDbDateTime(new Date()), id])
    await log({ target: 'cms_block', targetId: id, action: 'publish',
      before: { status: 'ceo_pending' }, after: { status: 'returned' }, auth, reason: note })
    return { id, status: 'returned' }
  }

  return publishBlock({ auth: { ...auth, role: 'ceo' }, blockId: id, note })
}

/* ============================ section switches ============================ */

/** Turn a section on or off. The heart of the enable/disable feature. */
export async function setSectionEnabled({ auth, route, sectionKey, role = '*', enabled, reason = null }) {
  requireEditor(auth)
  const pageRoute = str(route, 'route', { max: 128 })
  const key = idField(sectionKey, 'sectionKey')
  const on = bool(enabled, 'enabled')

  const [[section]] = await pool.query(
    `SELECT * FROM section_registry
      WHERE page_route = ? AND section_key = ? AND role = ? LIMIT 1`,
    [pageRoute, key, role ?? '*'])
  if (!section) throw Object.assign(
    new Error('No such section'), { status: 404, expected: true })

  if (!section.toggleable) {
    /* The reason is stored precisely so this message can name it. */
    throw deny(section.locked_reason
      ? `This section cannot be switched off — ${section.locked_reason}`
      : 'This section cannot be switched off')
  }

  /* A section holding unpublished words must not be hidden: the draft would sit
     behind a panel nobody can see and be lost. Resolve it first. */
  if (!on) {
    const [[pending]] = await pool.query(
      `SELECT COUNT(*) AS n FROM cms_block
        WHERE page_key = ? AND section_key = ?
          AND status IN ('draft', 'in_review', 'ceo_pending')
          AND draft_value IS NOT NULL`,
      [pageKeyFor(pageRoute), key])
    if (Number(pending.n) > 0) {
      throw deny('This section has unpublished changes — publish or discard them before switching it off')
    }
  }

  await pool.execute(
    `UPDATE section_registry
        SET enabled = ?, updated_by = ?, updated_at = ?
      WHERE page_route = ? AND section_key = ? AND role = ?`,
    [on ? 1 : 0, auth.userId, toDbDateTime(new Date()), pageRoute, key, role ?? '*'])

  await log({ target: 'section_registry', targetId: `${pageRoute}#${key}@${role ?? '*'}`,
    action: 'toggle', before: { enabled: !!section.enabled }, after: { enabled: on },
    auth, reason })

  return { route: pageRoute, sectionKey: key, role, enabled: on }
}

/** Reorder the sections on a page. */
export async function reorderSections({ auth, route, order }) {
  requireEditor(auth)
  const pageRoute = str(route, 'route', { max: 128 })
  if (!Array.isArray(order) || !order.length) throw invalid('order must be a list of section keys')

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    for (const [i, key] of order.entries()) {
      await conn.execute(
        `UPDATE section_registry SET sort_order = ?, updated_by = ?, updated_at = ?
          WHERE page_route = ? AND section_key = ?`,
        [i, auth.userId, toDbDateTime(new Date()), pageRoute, idField(key, 'sectionKey')])
    }
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }

  await log({ target: 'section_registry', targetId: pageRoute, action: 'edit',
    before: null, after: { order }, auth })
  return { route: pageRoute, order }
}

/** Register a section. Called by the seeder and when a new screen ships. */
export async function upsertSection({ auth, section }) {
  requireEditor(auth)
  const row = {
    section_key: idField(section?.key, 'key'),
    page_route: str(section?.route, 'route', { max: 128 }),
    role: section?.role ?? '*',
    title: plain(section?.title, 'title', { max: 191 }),
    description: plain(section?.description, 'description', { max: 512, optional: true }),
    source_class: oneOf(section?.source, 'source', SOURCE_CLASSES),
    enabled: section?.enabled === false ? 0 : 1,
    toggleable: section?.toggleable === false ? 0 : 1,
    locked_reason: plain(section?.lockedReason, 'lockedReason', { max: 255, optional: true }),
    review_required: section?.reviewRequired ? 1 : 0,
    sort_order: int(section?.sortOrder ?? 0, 'sortOrder', { min: -1000, max: 10_000 }),
  }
  /* A section that is not toggleable must say why — otherwise the screen shows
     a missing switch with no explanation, which reads as a bug. */
  if (!row.toggleable && !row.locked_reason) {
    throw invalid('A section that cannot be switched off must carry a lockedReason')
  }

  await pool.execute(
    `INSERT INTO section_registry
       (section_key, page_route, role, title, description, source_class, enabled, toggleable,
        locked_reason, review_required, sort_order, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       title = VALUES(title), description = VALUES(description),
       source_class = VALUES(source_class), toggleable = VALUES(toggleable),
       locked_reason = VALUES(locked_reason), review_required = VALUES(review_required),
       sort_order = VALUES(sort_order), updated_by = VALUES(updated_by), updated_at = VALUES(updated_at)`,
    [row.section_key, row.page_route, row.role, row.title, row.description, row.source_class,
     row.enabled, row.toggleable, row.locked_reason, row.review_required, row.sort_order,
     auth.userId, toDbDateTime(new Date())])

  return { ok: true, ...section }
}

/* ------------------------------- change log ------------------------------ */

export async function listChanges({ target = null, targetId = null, limit = 100 }) {
  const where = []
  const params = []
  if (target) { where.push('target = ?'); params.push(target) }
  if (targetId) { where.push('target_id = ?'); params.push(targetId) }

  const [rows] = await pool.query(
    `SELECT * FROM content_change_log
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY at DESC LIMIT ?`,
    [...params, Math.min(Number(limit) || 100, 500)])

  return rows.map((r) => ({
    id: r.id, target: r.target, targetId: r.target_id, action: r.action,
    before: parseJson(r.before_json), after: parseJson(r.after_json),
    actorId: r.actor_id, actorRole: r.actor_role, reason: r.reason,
    at: new Date(r.at).toISOString(),
  }))
}

/* -------------------------------- internals ------------------------------ */

function requireEditor(auth) {
  if (!auth) throw Object.assign(
    new Error('Sign in to continue'), { status: 401, code: 'unauthenticated', expected: true })
  if (!hasRole(auth.role, ADMIN_ROLES) && !hasRole(auth.role, CEO_ROLES)) {
    throw deny('Your role cannot edit site content')
  }
}

/**
 * The no-figures rule.
 *
 * Refuses a number that looks like a fact — a count, an amount, a percentage —
 * inside copy. Deliberately narrow: a year, an ordinal, a phone number and a
 * clause number are all numbers that belong in copy, so what is caught is
 * grouped thousands, currency, and percentages.
 *
 * `number_label` is the escape hatch, and its whole point: a block of that kind
 * is a CAPTION for a number the platform computes, so the number is not in it.
 */
function assertNoFigures(value, kind) {
  if (kind === 'number_label') return
  const text = collectText(value)
  const patterns = [
    /(?:₹|rs\.?|inr)\s*[\d,]+/i,            // ₹12,400 · Rs 5000
    /\b\d{1,3}(?:,\d{2,3})+\b/,             // 12,400 · 1,00,000
    /\b\d+(?:\.\d+)?\s?%/,                  // 18% · 2.5 %
    /\b\d{4,}\+/,                           // 3800+
  ]
  for (const re of patterns) {
    const hit = text.match(re)
    if (hit) {
      throw invalid(
        `Copy cannot contain a figure ("${hit[0].trim()}"). ` +
        'Auction numbers come from the auction system and money from finance — ' +
        'use a number_label block so the caption is edited here and the number is computed.')
    }
  }
}

function collectText(value, depth = 0) {
  if (depth > 6) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map((v) => collectText(v, depth + 1)).join(' ')
  if (value && typeof value === 'object') return Object.values(value).map((v) => collectText(v, depth + 1)).join(' ')
  return ''
}

async function log({ target, targetId, action, before, after, auth, reason = null }) {
  await pool.execute(
    `INSERT INTO content_change_log
       (id, target, target_id, action, before_json, after_json, actor_id, actor_role, reason, at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [newId('ccl'), target, String(targetId).slice(0, 191), action,
     before === null || before === undefined ? null : JSON.stringify(before),
     after === null || after === undefined ? null : JSON.stringify(after),
     auth?.userId ?? null, auth?.role ?? null, reason ? String(reason).slice(0, 512) : null,
     toDbDateTime(new Date())],
  ).catch((err) => console.error('[cms] change log insert failed', err))
}

const toBlockDto = (r) => ({
  id: r.id, pageKey: r.page_key, sectionKey: r.section_key, blockKey: r.block_key,
  kind: r.kind, locale: r.locale,
  draft: parseJson(r.draft_value), published: parseJson(r.published_value),
  status: r.status, version: Number(r.version),
  authoredBy: r.authored_by, publishedBy: r.published_by, signedBy: r.signed_by,
  note: r.note, sortOrder: Number(r.sort_order),
  updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
  publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
})

const parseJson = (v) => {
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') return v          // mysql2 already parsed the JSON column
  try { return JSON.parse(v) } catch { return v }
}

/** Re-encode a value READ BACK from a JSON column so it can be written to
 *  another one.
 *
 *  mysql2 parses JSON columns on the way out, so `block.draft_value` arrives as
 *  a JavaScript value — for a text block, a bare string. Handing that straight
 *  to a JSON column on the way back in makes MySQL parse `Eight roles…` as JSON
 *  and reject it: ER_INVALID_JSON_TEXT. Publishing every text block failed on
 *  this. `parseJson` first, so a driver that hands back a raw string instead is
 *  normalised rather than double-encoded. */
const toJsonColumn = (v) => (v === null || v === undefined ? null : JSON.stringify(parseJson(v)))

/* Route <-> page key. A page key is what a block is filed under; a route is what
   the browser asks for. They differ because one page key can serve several
   routes (the buyer dashboard is '/buyer' for a buyer and nothing else, but the
   home page is both '/' and the guest shell). */
const ROUTE_TO_PAGE = {
  '/': 'home',
  '/legal/privacy': 'privacy',
  '/legal/terms': 'terms',
  '/pricing': 'pricing',
  '/about': 'about',
  '/contact': 'contact',
  '/blog': 'blog',
  '/knowledge': 'knowledge',
  '/help': 'help',
  '/help/faqs': 'faqs',
  '/grievance': 'grievance',
}
const PAGE_TO_ROUTE = Object.fromEntries(Object.entries(ROUTE_TO_PAGE).map(([r, p]) => [p, r]))

export const pageKeyFor = (route) =>
  ROUTE_TO_PAGE[route] ?? (route.replace(/^\//, '').replace(/[/-]/g, '_') || 'home')
export const routeFor = (pageKey) =>
  PAGE_TO_ROUTE[pageKey] ?? `/${pageKey.replace(/_/g, '/')}`
