/* ---------------------------------------------------------------------------
   CMS service — Phase 24.

   The business rules that used to sit inline in src/api/cms.mjs, now reading
   and writing through repository.mjs instead of `pool` directly. This is the
   layer that knows WHAT a publish means (draft becomes version N+1, pricing
   and legal wait for the CEO) and WHY a toggle can be refused (locked, or a
   draft would go dark) — src/api/cms.mjs only knows how to validate a
   request and check who is allowed to make it.

   Two rules enforced here rather than documented and hoped for — carried over
   unchanged from the file this was split out of:

   * **No figure is ever typed into copy.** `assertNoFigures`.
   * **Pricing and legal need the CEO.** `CEO_SIGNED_PAGES`.
--------------------------------------------------------------------------- */
import { toDbDateTime } from '../time.mjs'
import { newId } from '../auth/tokens.mjs'
import { hasRole, CEO_ROLES } from '../auth/roles.mjs'
import { invalid } from '../api/validate.mjs'
import * as repo from './repository.mjs'

export const deny = (message) =>
  Object.assign(new Error(message), { status: 403, code: 'forbidden', expected: true })

/** Pages whose copy commits the company in public. */
const CEO_SIGNED_PAGES = new Set(['pricing', 'terms', 'privacy', 'grievance'])

/* =============================== public read ================================ */

export async function getPageContent(pageRoute, role) {
  const sections = await repo.findEnabledSections(pageRoute, role)
  if (!sections.length) return { route: pageRoute, sections: [] }

  const pageKey = pageKeyFor(pageRoute)
  const keys = sections.map((s) => s.section_key)
  const blocks = await repo.findPublishedBlocks(pageKey, keys)

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

export async function listSections({ route = null, role = null }) {
  const rows = await repo.findSections({ route, role })
  return rows.map((r) => ({
    key: r.section_key, route: r.page_route, role: r.role,
    title: r.title, description: r.description, source: r.source_class,
    enabled: !!r.enabled, toggleable: !!r.toggleable, lockedReason: r.locked_reason,
    reviewRequired: !!r.review_required, sortOrder: Number(r.sort_order),
    updatedBy: r.updated_by, updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
  }))
}

/* ================================ authoring ================================= */

export async function listBlocks({ pageKey = null, status = null }) {
  const rows = await repo.findBlocks({ pageKey, status })
  return rows.map(toBlockDto)
}

export async function saveBlock({ auth, pageKey, sectionKey, blockKey, kind, locale, sortOrder, value }) {
  assertNoFigures(value, kind)

  const now = new Date()
  const existing = await repo.findBlockByCoordinates({ pageKey, sectionKey, blockKey, locale })

  if (existing) {
    await repo.updateBlockDraft({
      id: existing.id, valueJson: JSON.stringify(value), kind, sortOrder,
      authorId: auth.userId, now: toDbDateTime(now),
    })
    await log({ target: 'cms_block', targetId: existing.id, action: 'edit',
      before: parseJson(existing.draft_value), after: value, auth })
    return { id: existing.id, status: 'draft' }
  }

  const id = newId('cms')
  await repo.insertBlockDraft({
    id, pageKey, sectionKey, blockKey, kind, locale, valueJson: JSON.stringify(value),
    authorId: auth.userId, sortOrder, now: toDbDateTime(now),
  })
  await log({ target: 'cms_block', targetId: id, action: 'edit', before: null, after: value, auth })
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
  const block = await repo.findBlockById(blockId)
  if (!block) throw Object.assign(new Error('No such block'), { status: 404, expected: true })
  if (block.draft_value === null) throw invalid('There is nothing to publish — the draft is empty')

  /* A page whose section demands a second reader cannot be published by the
     person who wrote it. The switch is per section, off by default. */
  const section = await repo.findSectionReviewFlag({ sectionKey: block.section_key, pageRoute: routeFor(block.page_key) })
  if (section?.review_required && block.authored_by === auth.userId && auth.role !== 'super_admin') {
    throw deny('This section needs a second reader — another administrator has to publish it')
  }

  const now = new Date()

  if (CEO_SIGNED_PAGES.has(block.page_key) && !hasRole(auth.role, CEO_ROLES)) {
    await repo.markBlockCeoPending({ id: blockId, note, now: toDbDateTime(now) })
    await log({ target: 'cms_block', targetId: blockId, action: 'publish',
      before: { status: block.status }, after: { status: 'ceo_pending' }, auth, reason: note })
    return { id: blockId, status: 'ceo_pending', message: 'Sent for signature — this page commits the company in public' }
  }

  const version = Number(block.version) + 1
  await repo.publishBlockTx({
    id: blockId, version, publishedBy: auth.userId,
    signedBy: hasRole(auth.role, CEO_ROLES) ? auth.userId : null,
    now: toDbDateTime(now), note,
    versionValueJson: toJsonColumn(block.draft_value),
    versionId: newId('cmsv'),
  })

  await log({ target: 'cms_block', targetId: blockId, action: 'publish',
    before: parseJson(block.published_value), after: parseJson(block.draft_value), auth, reason: note })
  return { id: blockId, status: 'published', version }
}

/** Take a published block off the site without deleting its words. */
export async function unpublishBlock({ auth, blockId, reason }) {
  const block = await repo.findBlockById(blockId)
  if (!block) throw Object.assign(new Error('No such block'), { status: 404, expected: true })

  await repo.markBlockUnpublished({ id: blockId, now: toDbDateTime(new Date()), reason })
  await log({ target: 'cms_block', targetId: blockId, action: 'unpublish',
    before: parseJson(block.published_value), after: null, auth, reason })
  return { id: blockId, status: 'draft' }
}

/** Restore a previous published version. */
export async function rollbackBlock({ auth, blockId, version }) {
  const snapshot = await repo.findVersionSnapshot({ blockId, version })
  if (!snapshot) throw Object.assign(
    new Error('That version does not exist'), { status: 404, expected: true })

  const block = await repo.findBlockById(blockId)
  const next = Number(block.version) + 1
  const now = new Date()

  await repo.rollbackBlockTx({
    id: blockId, next, publishedBy: auth.userId, now: toDbDateTime(now), target: version,
    valueJson: toJsonColumn(snapshot.value), versionId: newId('cmsv'),
  })

  await log({ target: 'cms_block', targetId: blockId, action: 'rollback',
    before: parseJson(block.published_value), after: parseJson(snapshot.value), auth,
    reason: `to version ${version}` })
  return { id: blockId, status: 'published', version: next, restoredFrom: version }
}

/** The CEO's signature queue for content.
 *
 *  Split across two functions rather than one, so cms.mjs's signBlock handler
 *  can own the branch that matters: on approval it re-enters the real
 *  publishBlock HANDLER (not this service directly), the same way the
 *  original single-file version did — including that handler's own
 *  requireEditor recheck. That recheck is always-true once the role is forced
 *  to 'ceo', but it is a defense-in-depth check on a CEO-authorization path,
 *  and trimming it was never something this extraction needed to do. */
export async function checkSignable(blockId) {
  const block = await repo.findBlockById(blockId)
  if (!block) throw Object.assign(new Error('No such block'), { status: 404, expected: true })
  if (block.status !== 'ceo_pending') throw invalid('That page is not waiting for a signature')
  return block
}

export async function returnBlock({ auth, blockId, note }) {
  await repo.markBlockReturned({ id: blockId, note, now: toDbDateTime(new Date()) })
  await log({ target: 'cms_block', targetId: blockId, action: 'publish',
    before: { status: 'ceo_pending' }, after: { status: 'returned' }, auth, reason: note })
  return { id: blockId, status: 'returned' }
}

/* ============================ section switches ============================ */

/** Turn a section on or off. The heart of the enable/disable feature. */
export async function setSectionEnabled({ auth, route, sectionKey, role, enabled, reason = null }) {
  const section = await repo.findSectionForToggle({ pageRoute: route, sectionKey, role })
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
  if (!enabled) {
    const pending = await repo.countPendingDrafts({ pageKey: pageKeyFor(route), sectionKey })
    if (Number(pending.n) > 0) {
      throw deny('This section has unpublished changes — publish or discard them before switching it off')
    }
  }

  await repo.updateSectionEnabled({
    pageRoute: route, sectionKey, role, enabled: enabled ? 1 : 0,
    updatedBy: auth.userId, now: toDbDateTime(new Date()),
  })

  await log({ target: 'section_registry', targetId: `${route}#${sectionKey}@${role ?? '*'}`,
    action: 'toggle', before: { enabled: !!section.enabled }, after: { enabled }, auth, reason })

  return { route, sectionKey, role, enabled }
}

/** Reorder the sections on a page. */
export async function reorderSections({ auth, route, order }) {
  await repo.reorderSectionsTx({ route, order, updatedBy: auth.userId, now: toDbDateTime(new Date()) })
  await log({ target: 'section_registry', targetId: route, action: 'edit',
    before: null, after: { order }, auth })
  return { route, order }
}

/** Register a section. Called by the seeder and when a new screen ships. */
export async function upsertSection({ auth, row }) {
  await repo.upsertSection(row, auth.userId, toDbDateTime(new Date()))
  return { ok: true }
}

/* ------------------------------- change log ------------------------------ */

export async function listChanges({ target = null, targetId = null, limit = 100 }) {
  const rows = await repo.findChanges({ target, targetId, limit })
  return rows.map((r) => ({
    id: r.id, target: r.target, targetId: r.target_id, action: r.action,
    before: parseJson(r.before_json), after: parseJson(r.after_json),
    actorId: r.actor_id, actorRole: r.actor_role, reason: r.reason,
    at: new Date(r.at).toISOString(),
  }))
}

/* -------------------------------- internals ------------------------------ */

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
  await repo.insertChangeLog({
    id: newId('ccl'), target, targetId: String(targetId).slice(0, 191), action,
    beforeJson: before === null || before === undefined ? null : JSON.stringify(before),
    afterJson: after === null || after === undefined ? null : JSON.stringify(after),
    actorId: auth?.userId ?? null, actorRole: auth?.role ?? null,
    reason: reason ? String(reason).slice(0, 512) : null,
    at: toDbDateTime(new Date()),
  }).catch((err) => console.error('[cms] change log insert failed', err))
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
