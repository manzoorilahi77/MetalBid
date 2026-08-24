/* ---------------------------------------------------------------------------
   Phase 23 — characterization tests for src/api/cms.mjs.

   Same approach as bidding.characterization.test.mjs: real MySQL, functions
   called directly, current behavior recorded as the baseline for the next
   refactor phases. See that file's header for the full rationale.
--------------------------------------------------------------------------- */
import { test, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { pool, closePool } from '../../src/db.mjs'
import { toDbDateTime } from '../../src/time.mjs'
import * as cms from '../../src/api/cms.mjs'
import { resetDb, ids } from './helpers/reset.mjs'

const subAdmin = { userId: ids.users.subAdmin, role: 'sub_admin' }
const subAdmin2 = { userId: ids.users.subAdmin2, role: 'sub_admin' }
const ceo = { userId: ids.users.ceo, role: 'ceo' }
const buyer = { userId: ids.users.buyerRich, role: 'buyer' }

before(async () => { await resetDb() })
beforeEach(async () => { await resetDb() })
after(async () => { await closePool() })

/* =============================== public read ================================ */

test('getPageContent — enabled sections only, in section-key order, published content inlined', async () => {
  const res = await cms.getPageContent({ route: '/', role: null })
  assert.equal(res.route, '/')
  assert.deepEqual(res.sections.map((s) => s.key), ['footer', 'hero', 'reviewed'])
  const hero = res.sections.find((s) => s.key === 'hero')
  assert.deepEqual(hero.content, { headline: 'Welcome to ferroBid' })
  const footer = res.sections.find((s) => s.key === 'footer')
  assert.deepEqual(footer.content, {})
  assert.equal(footer.toggleable, false)
  assert.equal(footer.lockedReason, 'Legal requirement')
})

test('getPageContent — a role-scoped section is excluded unless that role is asking', async () => {
  const asGuest = await cms.getPageContent({ route: '/buyer', role: null })
  assert.deepEqual(asGuest.sections, [])
  const asBuyer = await cms.getPageContent({ route: '/buyer', role: 'buyer' })
  assert.deepEqual(asBuyer.sections.map((s) => s.key), ['welcome'])
})

test('listSections — everything for a route, including disabled sections, regardless of role', async () => {
  const res = await cms.listSections({ route: '/' })
  assert.deepEqual(res.map((s) => s.key).sort(), ['footer', 'hero', 'promo', 'reviewed'])
  const promo = res.find((s) => s.key === 'promo')
  assert.equal(promo.enabled, false)
})

/* ================================ authoring ================================= */

test('listBlocks — filters by pageKey, ordered by section then block key', async () => {
  const res = await cms.listBlocks({ pageKey: 'home' })
  assert.deepEqual(res.map((b) => `${b.sectionKey}/${b.blockKey}`), ['hero/headline', 'hero/subhead', 'reviewed/note'])
})

test('saveBlock — creates a new draft block', async () => {
  const res = await cms.saveBlock({
    auth: subAdmin,
    block: { pageKey: 'home', sectionKey: 'hero', blockKey: 'newblock', kind: 'text', value: 'Fresh copy' },
  })
  assert.equal(res.status, 'draft')
  const [[row]] = await pool.query('SELECT draft_value, status, authored_by FROM cms_block WHERE id = ?', [res.id])
  assert.equal(row.draft_value, 'Fresh copy')
  assert.equal(row.status, 'draft')
  assert.equal(row.authored_by, ids.users.subAdmin)
})

test('saveBlock — editing an existing block updates its draft in place, same id', async () => {
  const res = await cms.saveBlock({
    auth: subAdmin,
    block: { pageKey: 'home', sectionKey: 'hero', blockKey: 'subhead', kind: 'text', value: 'Edited subhead' },
  })
  assert.equal(res.id, ids.cms.draft)
  const [[row]] = await pool.query('SELECT draft_value FROM cms_block WHERE id = ?', [ids.cms.draft])
  assert.equal(row.draft_value, 'Edited subhead')
})

test('saveBlock — refuses a non-editor role', async () => {
  await assert.rejects(
    () => cms.saveBlock({ auth: buyer, block: { pageKey: 'home', sectionKey: 'hero', blockKey: 'x', kind: 'text', value: 'x' } }),
    (err) => { assert.equal(err.status, 403); assert.match(err.message, /cannot edit site content/); return true })
})

test('saveBlock — refuses with no auth at all', async () => {
  await assert.rejects(
    () => cms.saveBlock({ auth: null, block: { pageKey: 'home', sectionKey: 'hero', blockKey: 'x', kind: 'text', value: 'x' } }),
    (err) => { assert.equal(err.status, 401); return true })
})

test('saveBlock — the no-figures rule refuses a grouped number in copy', async () => {
  await assert.rejects(
    () => cms.saveBlock({
      auth: subAdmin,
      block: { pageKey: 'home', sectionKey: 'hero', blockKey: 'x', kind: 'text', value: 'We sold ₹12,400 worth today' },
    }),
    (err) => { assert.equal(err.status, 400); assert.match(err.message, /Copy cannot contain a figure/); return true })
})

test('saveBlock — number_label is the escape hatch for the no-figures rule', async () => {
  const res = await cms.saveBlock({
    auth: subAdmin,
    block: { pageKey: 'home', sectionKey: 'hero', blockKey: 'x', kind: 'number_label', value: '12,400 lots sold' },
  })
  assert.equal(res.status, 'draft')
})

/* ================================= publish ================================== */

test('publishBlock — happy path: draft becomes published at version 1', async () => {
  const res = await cms.publishBlock({ auth: subAdmin, blockId: ids.cms.draft })
  assert.deepEqual(res, { id: ids.cms.draft, status: 'published', version: 1 })
  const [[row]] = await pool.query('SELECT published_value, status, version FROM cms_block WHERE id = ?', [ids.cms.draft])
  assert.equal(row.status, 'published')
  assert.equal(Number(row.version), 1)
  assert.equal(row.published_value, 'A national metal exchange')
  const [versions] = await pool.query('SELECT version FROM cms_block_versions WHERE block_id = ?', [ids.cms.draft])
  assert.equal(versions.length, 1)
})

test('publishBlock — a CEO-signed page routes to ceo_pending instead of publishing', async () => {
  const res = await cms.publishBlock({ auth: subAdmin, blockId: ids.cms.pricingDraft, note: 'ready for review' })
  assert.deepEqual(res, { id: ids.cms.pricingDraft, status: 'ceo_pending', message: res.message })
  assert.match(res.message, /commits the company in public/)
  const [[row]] = await pool.query('SELECT status, published_value FROM cms_block WHERE id = ?', [ids.cms.pricingDraft])
  assert.equal(row.status, 'ceo_pending')
  assert.equal(row.published_value, null) // not live yet
})

test('publishBlock — the CEO publishing directly bypasses ceo_pending', async () => {
  const res = await cms.publishBlock({ auth: ceo, blockId: ids.cms.pricingDraft })
  assert.equal(res.status, 'published')
  const [[row]] = await pool.query('SELECT signed_by FROM cms_block WHERE id = ?', [ids.cms.pricingDraft])
  assert.equal(row.signed_by, ids.users.ceo)
})

test('publishBlock — a review-required section refuses the same author, allows a different editor', async () => {
  await assert.rejects(
    () => cms.publishBlock({ auth: subAdmin, blockId: ids.cms.reviewRequired }),
    (err) => { assert.equal(err.status, 403); assert.match(err.message, /second reader/); return true })

  const res = await cms.publishBlock({ auth: subAdmin2, blockId: ids.cms.reviewRequired })
  assert.equal(res.status, 'published')
})

test('publishBlock — super_admin is exempt from the review-required same-author check', async () => {
  const [[row]] = await pool.query('SELECT authored_by FROM cms_block WHERE id = ?', [ids.cms.reviewRequired])
  assert.equal(row.authored_by, ids.users.subAdmin)
  const res = await cms.publishBlock({ auth: { userId: ids.users.subAdmin, role: 'super_admin' }, blockId: ids.cms.reviewRequired })
  assert.equal(res.status, 'published')
})

test('publishBlock — refuses a block with nothing drafted', async () => {
  await pool.query(
    `INSERT INTO cms_block (id, page_key, section_key, block_key, kind, draft_value, status, version, sort_order, created_at, updated_at)
     VALUES ('cms-empty-1', 'home', 'hero', 'empty', 'text', NULL, 'draft', 0, 0, ?, ?)`,
    [toDbDateTime(new Date()), toDbDateTime(new Date())])
  await assert.rejects(
    () => cms.publishBlock({ auth: subAdmin, blockId: 'cms-empty-1' }),
    (err) => { assert.equal(err.status, 400); assert.match(err.message, /nothing to publish/); return true })
})

test('publishBlock — an unknown block throws a 404', async () => {
  await assert.rejects(
    () => cms.publishBlock({ auth: subAdmin, blockId: 'cms-does-not-exist' }),
    (err) => { assert.equal(err.status, 404); return true })
})

/* =============================== unpublish/rollback ========================= */

test('unpublishBlock — takes a published block off the site without touching the draft', async () => {
  const res = await cms.unpublishBlock({ auth: subAdmin, blockId: ids.cms.published, reason: 'typo' })
  assert.deepEqual(res, { id: ids.cms.published, status: 'draft' })
  const [[row]] = await pool.query('SELECT published_value, draft_value, status FROM cms_block WHERE id = ?', [ids.cms.published])
  assert.equal(row.published_value, null)
  assert.equal(row.draft_value, 'Welcome to ferroBid')
  assert.equal(row.status, 'draft')
})

test('rollbackBlock — restores a previous version as a new version, forward-only history', async () => {
  const res = await cms.rollbackBlock({ auth: subAdmin, blockId: ids.cms.published, version: 1 })
  assert.equal(res.status, 'published')
  assert.equal(res.version, 3) // was version 2, rollback creates version 3
  assert.equal(res.restoredFrom, 1)
  const [[row]] = await pool.query('SELECT published_value, draft_value, version FROM cms_block WHERE id = ?', [ids.cms.published])
  assert.equal(row.published_value, 'Welcome (old copy)')
  assert.equal(Number(row.version), 3)
  const [versions] = await pool.query('SELECT version FROM cms_block_versions WHERE block_id = ? ORDER BY version', [ids.cms.published])
  assert.deepEqual(versions.map((v) => Number(v.version)), [1, 3])
})

test('rollbackBlock — a version that never existed throws a 404', async () => {
  await assert.rejects(
    () => cms.rollbackBlock({ auth: subAdmin, blockId: ids.cms.published, version: 99 }),
    (err) => { assert.equal(err.status, 404); return true })
})

/* =================================== sign ==================================== */

test('signBlock — a non-CEO role is refused', async () => {
  await cms.publishBlock({ auth: subAdmin, blockId: ids.cms.pricingDraft }) // -> ceo_pending
  await assert.rejects(
    () => cms.signBlock({ auth: subAdmin, blockId: ids.cms.pricingDraft, approve: true }),
    (err) => { assert.equal(err.status, 403); assert.match(err.message, /Only the CEO/); return true })
})

test('signBlock — refuses a block that is not waiting for a signature', async () => {
  await assert.rejects(
    () => cms.signBlock({ auth: ceo, blockId: ids.cms.draft, approve: true }),
    (err) => { assert.equal(err.status, 400); assert.match(err.message, /not waiting for a signature/); return true })
})

test('signBlock — approving publishes the block and records the CEO as signer', async () => {
  await cms.publishBlock({ auth: subAdmin, blockId: ids.cms.pricingDraft })
  const res = await cms.signBlock({ auth: ceo, blockId: ids.cms.pricingDraft, approve: true })
  assert.equal(res.status, 'published')
  const [[row]] = await pool.query('SELECT signed_by, status FROM cms_block WHERE id = ?', [ids.cms.pricingDraft])
  assert.equal(row.signed_by, ids.users.ceo)
  assert.equal(row.status, 'published')
})

test('signBlock — refusing returns the block with a note, still unpublished', async () => {
  await cms.publishBlock({ auth: subAdmin, blockId: ids.cms.pricingDraft })
  const res = await cms.signBlock({ auth: ceo, blockId: ids.cms.pricingDraft, approve: false, note: 'Not yet' })
  assert.deepEqual(res, { id: ids.cms.pricingDraft, status: 'returned' })
  const [[row]] = await pool.query('SELECT status, note, published_value FROM cms_block WHERE id = ?', [ids.cms.pricingDraft])
  assert.equal(row.status, 'returned')
  assert.equal(row.note, 'Not yet')
  assert.equal(row.published_value, null)
})

/* ============================ section switches =============================== */

test('setSectionEnabled — turns a toggleable section off', async () => {
  // 'welcome' carries no cms_block rows at all, so it is a clean case — see the
  // next test for what happens when a section's own blocks are in the way.
  const res = await cms.setSectionEnabled({ auth: subAdmin, route: '/buyer', sectionKey: 'welcome', role: 'buyer', enabled: false, reason: 'testing' })
  assert.deepEqual(res, { route: '/buyer', sectionKey: 'welcome', role: 'buyer', enabled: false })
  const [[row]] = await pool.query('SELECT enabled FROM section_registry WHERE page_route = ? AND section_key = ?', ['/buyer', 'welcome'])
  assert.equal(row.enabled, 0)
})

test('setSectionEnabled — refuses a locked section and names the reason', async () => {
  await assert.rejects(
    () => cms.setSectionEnabled({ auth: subAdmin, route: '/', sectionKey: 'footer', enabled: false }),
    (err) => { assert.equal(err.status, 403); assert.match(err.message, /Legal requirement/); return true })
})

test('setSectionEnabled — refuses to hide a section with unpublished drafts', async () => {
  await assert.rejects(
    () => cms.setSectionEnabled({ auth: subAdmin, route: '/', sectionKey: 'reviewed', enabled: false }),
    (err) => { assert.equal(err.status, 403); assert.match(err.message, /unpublished changes/); return true })
})

// Worth keeping explicit: unpublishBlock sets status back to 'draft' but does
// NOT clear draft_value (see unpublishBlock — it mirrors the just-removed
// published value into "draft", by design, so re-publishing restores it).
// The pending-drafts guard above cannot tell that apart from a real unsaved
// edit, so unpublishing a block is enough to block switching its section off
// — even though nobody actually changed anything.
test('setSectionEnabled — an unpublished (not edited) block also counts as a pending draft', async () => {
  await cms.unpublishBlock({ auth: subAdmin, blockId: ids.cms.published, reason: 'testing' }) // section: hero
  await assert.rejects(
    () => cms.setSectionEnabled({ auth: subAdmin, route: '/', sectionKey: 'hero', enabled: false }),
    (err) => { assert.equal(err.status, 403); assert.match(err.message, /unpublished changes/); return true })
})

test('setSectionEnabled — turning a section ON skips the pending-drafts check', async () => {
  const res = await cms.setSectionEnabled({ auth: subAdmin, route: '/', sectionKey: 'promo', enabled: true })
  assert.equal(res.enabled, true)
})

test('setSectionEnabled — an unknown section throws a 404', async () => {
  await assert.rejects(
    () => cms.setSectionEnabled({ auth: subAdmin, route: '/', sectionKey: 'nope', enabled: false }),
    (err) => { assert.equal(err.status, 404); return true })
})

test('reorderSections — rewrites sort_order to match the given order', async () => {
  await cms.reorderSections({ auth: subAdmin, route: '/', order: ['reviewed', 'footer', 'hero'] })
  const rows = await cms.listSections({ route: '/' })
  const order = Object.fromEntries(rows.map((r) => [r.key, r.sortOrder]))
  assert.equal(order.reviewed, 0)
  assert.equal(order.footer, 1)
  assert.equal(order.hero, 2)
})

test('upsertSection — registers a new section', async () => {
  const res = await cms.upsertSection({
    auth: subAdmin,
    section: { key: 'brandnew', route: '/', source: 'cms', title: 'Brand new section' },
  })
  assert.equal(res.ok, true)
  const [[row]] = await pool.query('SELECT * FROM section_registry WHERE page_route = ? AND section_key = ?', ['/', 'brandnew'])
  assert.ok(row)
  assert.equal(row.enabled, 1)
})

test('upsertSection — a non-toggleable section must carry a lockedReason', async () => {
  await assert.rejects(
    () => cms.upsertSection({
      auth: subAdmin,
      section: { key: 'locked-no-reason', route: '/', source: 'cms', title: 'x', toggleable: false },
    }),
    (err) => { assert.equal(err.status, 400); assert.match(err.message, /lockedReason/); return true })
})

/* ================================ change log =================================== */

test('listChanges — records and returns publish/unpublish/toggle actions, newest first', async () => {
  await cms.publishBlock({ auth: subAdmin, blockId: ids.cms.draft })
  await cms.unpublishBlock({ auth: subAdmin, blockId: ids.cms.published, reason: 'r' })
  await cms.setSectionEnabled({ auth: subAdmin, route: '/buyer', sectionKey: 'welcome', role: 'buyer', enabled: false })

  const all = await cms.listChanges({})
  assert.ok(all.length >= 3)
  assert.equal(all[0].action, 'toggle') // newest first

  const blockOnly = await cms.listChanges({ target: 'cms_block', targetId: ids.cms.draft })
  assert.equal(blockOnly.length, 1)
  assert.equal(blockOnly[0].action, 'publish')
})
