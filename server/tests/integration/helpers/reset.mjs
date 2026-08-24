/* ---------------------------------------------------------------------------
   Phase 23 characterization fixtures.

   Deterministic, fixed-id seed data for bidding.mjs and cms.mjs's integration
   tests. `resetDb()` wipes every table these two files touch (plus their FK
   dependencies) and reloads this fixture set, so every test starts from the
   same known state regardless of run order or what an earlier test wrote.

   Safe only because this points at a disposable local test database — see
   ../setup.env.mjs and server/.env.test. Never run against a real database.
--------------------------------------------------------------------------- */
import { pool } from '../../../src/db.mjs'
import { toDbDateTime } from '../../../src/time.mjs'

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** All fixture ids, so test files can reference them by name instead of
 *  re-typing string literals. */
export const ids = {
  users: {
    seller: 'u-seller-1',
    buyerRich: 'u-buyer-1', // balance 100000 — the happy-path funder
    buyerPoor: 'u-buyer-2', // balance 1000 — triggers insufficient-balance
    subAdmin: 'u-subadmin-1',
    subAdmin2: 'u-subadmin-2', // a second editor, for the review-required path
    ceo: 'u-ceo-1',
    buyerNoWallet: 'u-buyer-3', // no wallets row — for the "no wallet" branch
  },
  catalogues: {
    liveForward: 'cat-live-fwd',
    liveTender: 'cat-live-tender',
    upcomingNotLive: 'cat-notlive',
    emdOpen: 'cat-emd-open',
    emdNotYetOpen: 'cat-emd-notyet',
    emdClosedNoExempt: 'cat-emd-closed-noex',
    emdClosedExempt: 'cat-emd-closed-ex',
    emdNotOpenStatus: 'cat-emd-notopen', // status 'closed' — never open for EMD at all
  },
  lots: {
    fwd: 'lot-fwd-1', // live, biddable
    fwdSold: 'lot-fwd-sold-1', // status sold — "lot is not live" (lot-level)
    fwdPastDeadline: 'lot-fwd-past-1', // ends_at already passed, status still live
    fwdNearSnipe: 'lot-fwd-snipe-1', // ends_at inside the anti-snipe window
    tender: 'lot-tender-1', // live tender lot, no ends_at
    inUpcomingCatalogue: 'lot-catnotlive-1', // catalogue is upcoming — "lot is not live" (catalogue-level)
    emdOpen: 'lot-emd-open-1',
    emdNotYetOpen: 'lot-emd-notyet-1',
    emdClosedNoExempt: 'lot-emd-closed-1',
    emdClosedExempt: 'lot-emd-closed-ex-1',
    emdExpensive: 'lot-emd-expensive-1', // pre_bid_emd 200000 — exceeds buyerPoor's balance
    emdAlreadyFunded: 'lot-emd-alreadyfunded-1', // pre-funded via selection_lots
    emdNotOpenStatus: 'lot-emd-notopen-1',
  },
  exemption: 'emdx-1',
  cms: {
    pageHero: 'home', pageBuyer: 'buyer', pagePricing: 'pricing',
    published: 'cms-published-1', // published, version 2, has a v1 history row
    draft: 'cms-draft-1', // draft only, nothing published yet
    pricingDraft: 'cms-pricing-1', // draft on a CEO-signed page
    reviewRequired: 'cms-review-1', // draft in a review_required section, authored by subAdmin
  },
}

const TABLES_IN_FK_ORDER = [
  // children first
  'wallet_ledger', 'selection_lots', 'emd_exemption_requests', 'bids',
  'cms_block_versions', 'content_change_log', 'cms_block', 'section_registry',
  'lots', 'catalogues', 'wallets', 'users',
]

async function truncateAll() {
  await pool.query('SET FOREIGN_KEY_CHECKS = 0')
  for (const t of TABLES_IN_FK_ORDER) await pool.query(`TRUNCATE TABLE ${t}`)
  await pool.query('SET FOREIGN_KEY_CHECKS = 1')
}

async function seedUsers(now) {
  const users = [
    { id: ids.users.seller, name: 'Test Seller', role: 'seller' },
    { id: ids.users.buyerRich, name: 'Rich Buyer', role: 'buyer' },
    { id: ids.users.buyerPoor, name: 'Poor Buyer', role: 'buyer' },
    { id: ids.users.subAdmin, name: 'Sub Admin One', role: 'sub_admin' },
    { id: ids.users.subAdmin2, name: 'Sub Admin Two', role: 'sub_admin' },
    { id: ids.users.ceo, name: 'The CEO', role: 'ceo' },
    { id: ids.users.buyerNoWallet, name: 'Walletless Buyer', role: 'buyer' },
  ]
  for (const u of users) {
    await pool.query(
      `INSERT INTO users (id, name, role, status, standing, joined_at) VALUES (?, ?, ?, 'active', 'good', ?)`,
      [u.id, u.name, u.role, toDbDateTime(now)])
  }
  await pool.query('INSERT INTO wallets (user_id, balance, emd_locked) VALUES (?, 100000.00, 0.00)', [ids.users.buyerRich])
  await pool.query('INSERT INTO wallets (user_id, balance, emd_locked) VALUES (?, 1000.00, 0.00)', [ids.users.buyerPoor])
}

async function insertCatalogue(c) {
  await pool.query(
    `INSERT INTO catalogues
       (id, code, title, seller_id, type, status, starts_at, ends_at, emd_deadline, emd_opens_at, anti_snipe_minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 5)`,
    [c.id, c.id.toUpperCase(), `Fixture — ${c.id}`, ids.users.seller, c.type, c.status,
     toDbDateTime(c.startsAt), toDbDateTime(c.endsAt),
     c.emdDeadline ? toDbDateTime(c.emdDeadline) : null,
     c.emdOpensAt ? toDbDateTime(c.emdOpensAt) : null])
}

async function insertLot(l) {
  await pool.query(
    `INSERT INTO lots
       (id, lot_no, catalogue_id, seller_id, metal, category, indicative_qty, uom,
        start_rate, increment, reserve_rate, pre_bid_emd, status,
        current_rate, leading_bidder_id, bid_count, ends_at, extensions)
     VALUES (?, ?, ?, ?, 'MS', 'ferrous', 10, 'MT', ?, ?, ?, ?, ?, NULL, NULL, 0, ?, 0)`,
    [l.id, l.id.toUpperCase(), l.catalogueId, ids.users.seller,
     l.startRate ?? 30_000, l.increment ?? 500, l.reserveRate ?? 32_000, l.preBidEmd ?? 5_000,
     l.status ?? 'live', l.endsAt ? toDbDateTime(l.endsAt) : null])
}

async function seedCatalogueAndLots(now) {
  await insertCatalogue({
    id: ids.catalogues.liveForward, type: 'forward', status: 'live',
    startsAt: now - DAY, endsAt: now + HOUR,
  })
  await insertLot({ id: ids.lots.fwd, catalogueId: ids.catalogues.liveForward, endsAt: now + HOUR })
  await insertLot({ id: ids.lots.fwdSold, catalogueId: ids.catalogues.liveForward, status: 'sold', endsAt: now + HOUR })
  await insertLot({ id: ids.lots.fwdPastDeadline, catalogueId: ids.catalogues.liveForward, endsAt: now - HOUR })
  await insertLot({ id: ids.lots.fwdNearSnipe, catalogueId: ids.catalogues.liveForward, endsAt: now + 2 * 60_000 })

  await insertCatalogue({
    id: ids.catalogues.liveTender, type: 'tender', status: 'live',
    startsAt: now - DAY, endsAt: now + HOUR,
  })
  await insertLot({ id: ids.lots.tender, catalogueId: ids.catalogues.liveTender, endsAt: null, startRate: 20_000 })

  await insertCatalogue({
    id: ids.catalogues.upcomingNotLive, type: 'forward', status: 'upcoming',
    startsAt: now + DAY, endsAt: now + 2 * DAY,
  })
  await insertLot({ id: ids.lots.inUpcomingCatalogue, catalogueId: ids.catalogues.upcomingNotLive, endsAt: now + 2 * DAY })

  await insertCatalogue({
    id: ids.catalogues.emdOpen, type: 'forward', status: 'upcoming',
    startsAt: now + 10 * DAY, endsAt: now + 11 * DAY,
    emdOpensAt: now - DAY, emdDeadline: now + 5 * DAY,
  })
  await insertLot({ id: ids.lots.emdOpen, catalogueId: ids.catalogues.emdOpen, preBidEmd: 2_000 })
  await insertLot({ id: ids.lots.emdExpensive, catalogueId: ids.catalogues.emdOpen, preBidEmd: 200_000 })
  await insertLot({ id: ids.lots.emdAlreadyFunded, catalogueId: ids.catalogues.emdOpen, preBidEmd: 2_000 })

  await insertCatalogue({
    id: ids.catalogues.emdNotYetOpen, type: 'forward', status: 'upcoming',
    startsAt: now + 40 * DAY, endsAt: now + 41 * DAY,
    emdOpensAt: now + DAY, emdDeadline: now + 35 * DAY,
  })
  await insertLot({ id: ids.lots.emdNotYetOpen, catalogueId: ids.catalogues.emdNotYetOpen, preBidEmd: 2_000 })

  await insertCatalogue({
    id: ids.catalogues.emdClosedNoExempt, type: 'forward', status: 'live',
    startsAt: now - DAY, endsAt: now + HOUR,
    emdOpensAt: now - 20 * DAY, emdDeadline: now - DAY,
  })
  await insertLot({ id: ids.lots.emdClosedNoExempt, catalogueId: ids.catalogues.emdClosedNoExempt, preBidEmd: 2_000 })

  await insertCatalogue({
    id: ids.catalogues.emdClosedExempt, type: 'forward', status: 'live',
    startsAt: now - DAY, endsAt: now + HOUR,
    emdOpensAt: now - 20 * DAY, emdDeadline: now - DAY,
  })
  await insertLot({ id: ids.lots.emdClosedExempt, catalogueId: ids.catalogues.emdClosedExempt, preBidEmd: 2_000 })
  await pool.query(
    `INSERT INTO emd_exemption_requests (id, buyer_id, catalogue_id, status, created_at, decided_at, decided_by)
     VALUES (?, ?, ?, 'approved', ?, ?, ?)`,
    [ids.exemption, ids.users.buyerRich, ids.catalogues.emdClosedExempt, toDbDateTime(now - 2 * DAY), toDbDateTime(now - 2 * DAY), ids.users.subAdmin])

  await pool.query(
    'INSERT INTO selection_lots (buyer_id, catalogue_id, lot_id, emd_funded) VALUES (?, ?, ?, 1)',
    [ids.users.buyerRich, ids.catalogues.emdOpen, ids.lots.emdAlreadyFunded])

  await insertCatalogue({
    id: ids.catalogues.emdNotOpenStatus, type: 'forward', status: 'closed',
    startsAt: now - 30 * DAY, endsAt: now - 25 * DAY,
  })
  await insertLot({ id: ids.lots.emdNotOpenStatus, catalogueId: ids.catalogues.emdNotOpenStatus, status: 'closed', preBidEmd: 2_000 })
}

async function seedCms(now) {
  const sections = [
    { key: 'hero', route: '/', role: '*', title: 'Hero', enabled: 1, toggleable: 1, locked: null, review: 0 },
    { key: 'footer', route: '/', role: '*', title: 'Footer', enabled: 1, toggleable: 0, locked: 'Legal requirement', review: 0 },
    { key: 'promo', route: '/', role: '*', title: 'Promo', enabled: 0, toggleable: 1, locked: null, review: 0 },
    { key: 'welcome', route: '/buyer', role: 'buyer', title: 'Buyer welcome', enabled: 1, toggleable: 1, locked: null, review: 0 },
    { key: 'reviewed', route: '/', role: '*', title: 'Reviewed section', enabled: 1, toggleable: 1, locked: null, review: 1 },
    { key: 'plans', route: '/pricing', role: '*', title: 'Plans', enabled: 1, toggleable: 1, locked: null, review: 0 },
  ]
  for (const s of sections) {
    await pool.query(
      `INSERT INTO section_registry
         (section_key, page_route, role, title, source_class, enabled, toggleable, locked_reason, review_required, sort_order, updated_by, updated_at)
       VALUES (?, ?, ?, ?, 'cms', ?, ?, ?, ?, 0, ?, ?)`,
      [s.key, s.route, s.role, s.title, s.enabled, s.toggleable, s.locked, s.review, ids.users.subAdmin, toDbDateTime(now)])
  }

  // Published block, currently version 2, with a version-1 history row — a real target for rollbackBlock.
  await pool.query(
    `INSERT INTO cms_block
       (id, page_key, section_key, block_key, kind, draft_value, published_value, status, version,
        authored_by, published_by, sort_order, created_at, updated_at, published_at)
     VALUES (?, 'home', 'hero', 'headline', 'text', '"Welcome to ferroBid"', '"Welcome to ferroBid"', 'published', 2,
             ?, ?, 0, ?, ?, ?)`,
    [ids.cms.published, ids.users.subAdmin, ids.users.subAdmin, toDbDateTime(now - DAY), toDbDateTime(now), toDbDateTime(now)])
  await pool.query(
    `INSERT INTO cms_block_versions (id, block_id, version, value, published_by, published_at, note)
     VALUES ('cmsv-seed-1', ?, 1, '"Welcome (old copy)"', ?, ?, 'seed')`,
    [ids.cms.published, ids.users.subAdmin, toDbDateTime(now - DAY)])

  // Draft-only block, nothing published yet — for publishBlock's happy path.
  await pool.query(
    `INSERT INTO cms_block
       (id, page_key, section_key, block_key, kind, draft_value, published_value, status, version,
        authored_by, sort_order, created_at, updated_at)
     VALUES (?, 'home', 'hero', 'subhead', 'text', '"A national metal exchange"', NULL, 'draft', 0, ?, 0, ?, ?)`,
    [ids.cms.draft, ids.users.subAdmin, toDbDateTime(now), toDbDateTime(now)])

  // Draft on a CEO-signed page — publishing this should route to ceo_pending.
  await pool.query(
    `INSERT INTO cms_block
       (id, page_key, section_key, block_key, kind, draft_value, published_value, status, version,
        authored_by, sort_order, created_at, updated_at)
     VALUES (?, 'pricing', 'plans', 'intro', 'text', '"Simple, transparent pricing"', NULL, 'draft', 0, ?, 0, ?, ?)`,
    [ids.cms.pricingDraft, ids.users.subAdmin, toDbDateTime(now), toDbDateTime(now)])

  // Draft in a review_required section, authored by subAdmin — publishBlock by
  // the SAME author must be refused; a different editor must be allowed to.
  await pool.query(
    `INSERT INTO cms_block
       (id, page_key, section_key, block_key, kind, draft_value, published_value, status, version,
        authored_by, sort_order, created_at, updated_at)
     VALUES (?, 'home', 'reviewed', 'note', 'text', '"A note that needs a second reader"', NULL, 'draft', 0, ?, 0, ?, ?)`,
    [ids.cms.reviewRequired, ids.users.subAdmin, toDbDateTime(now), toDbDateTime(now)])
}

/** Wipe and reload the fixture set. Call from `beforeEach` in every
 *  integration test file — cheap enough (a handful of rows) to run per test,
 *  which keeps tests independent of run order and of each other's writes. */
export async function resetDb() {
  const now = Date.now()
  await truncateAll()
  await seedUsers(now)
  await seedCatalogueAndLots(now)
  await seedCms(now)
  return { now }
}
