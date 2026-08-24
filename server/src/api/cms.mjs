/* ---------------------------------------------------------------------------
   The CMS — route handler layer.

   Phase 24: this file used to hold validation, authorization, business rules
   and raw SQL all in one place. It now does only the first two — parse and
   validate the request, check who is allowed to make it — and hands off to
   src/cms/service.mjs for everything else. src/cms/repository.mjs is the only
   file that runs a query. Every function here keeps its exact exported name,
   parameter shape and return shape; server.mjs calls these exactly as before
   and needs no changes.

   Reads are public and cheap; writes belong to the Sub Admin. That split is
   still the whole shape of the file — see src/cms/service.mjs's header for
   the two rules (no figures in copy, pricing/legal need the CEO) that used to
   be documented here and are enforced there now.
--------------------------------------------------------------------------- */
import { hasRole, ADMIN_ROLES, CEO_ROLES } from '../auth/roles.mjs'
import { str, id as idField, oneOf, bool, int, plain, invalid } from './validate.mjs'
import * as service from '../cms/service.mjs'

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
  return service.getPageContent(pageRoute, role)
}

/** The switches for one route, including the ones that are off — the editing
 *  view, as opposed to the rendering view above. */
export async function listSections({ route = null, role = null }) {
  return service.listSections({ route, role })
}

/* ============================== authoring ================================= */

export async function listBlocks({ pageKey = null, status = null }) {
  return service.listBlocks({ pageKey, status })
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

  return service.saveBlock({ auth, pageKey, sectionKey, blockKey, kind, locale, sortOrder, value: block.value })
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
  return service.publishBlock({ auth, blockId: id, note })
}

/** Take a published block off the site without deleting its words. */
export async function unpublishBlock({ auth, blockId, reason }) {
  requireEditor(auth)
  const id = idField(blockId, 'blockId')
  const why = plain(reason, 'reason', { max: 512 })
  return service.unpublishBlock({ auth, blockId: id, reason: why })
}

/** Restore a previous published version. */
export async function rollbackBlock({ auth, blockId, version }) {
  requireEditor(auth)
  const id = idField(blockId, 'blockId')
  const target = int(version, 'version', { min: 1 })
  return service.rollbackBlock({ auth, blockId: id, version: target })
}

/** The CEO's signature queue for content. */
export async function signBlock({ auth, blockId, approve, note = null }) {
  if (!hasRole(auth.role, CEO_ROLES)) throw service.deny('Only the CEO can sign this')
  const id = idField(blockId, 'blockId')
  const ok = bool(approve, 'approve')
  return service.signBlock({ auth, blockId: id, approve: ok, note })
}

/* ============================ section switches ============================ */

/** Turn a section on or off. The heart of the enable/disable feature. */
export async function setSectionEnabled({ auth, route, sectionKey, role = '*', enabled, reason = null }) {
  requireEditor(auth)
  const pageRoute = str(route, 'route', { max: 128 })
  const key = idField(sectionKey, 'sectionKey')
  const on = bool(enabled, 'enabled')
  return service.setSectionEnabled({ auth, route: pageRoute, sectionKey: key, role, enabled: on, reason })
}

/** Reorder the sections on a page. */
export async function reorderSections({ auth, route, order }) {
  requireEditor(auth)
  const pageRoute = str(route, 'route', { max: 128 })
  if (!Array.isArray(order) || !order.length) throw invalid('order must be a list of section keys')
  const keys = order.map((key) => idField(key, 'sectionKey'))
  return service.reorderSections({ auth, route: pageRoute, order: keys })
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
  if (!row.toggleable && !row.locked_reason) throw invalid('A section that cannot be switched off must carry a lockedReason')

  await service.upsertSection({ auth, row })
  return { ok: true, ...section }
}

/* ------------------------------- change log ------------------------------ */

export async function listChanges({ target = null, targetId = null, limit = 100 }) {
  return service.listChanges({ target, targetId, limit })
}

/* -------------------------------- internals ------------------------------ */

function requireEditor(auth) {
  if (!auth) throw Object.assign(
    new Error('Sign in to continue'), { status: 401, code: 'unauthenticated', expected: true })
  if (!hasRole(auth.role, ADMIN_ROLES) && !hasRole(auth.role, CEO_ROLES)) {
    throw service.deny('Your role cannot edit site content')
  }
}

export const pageKeyFor = service.pageKeyFor
export const routeFor = service.routeFor
