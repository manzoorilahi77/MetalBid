/* ---------------------------------------------------------------------------
   Phase 23 — characterization tests for src/api/bidding.mjs.

   These record CURRENT behavior against a real MySQL instance, at the
   function level (placeBid/fundEmd/creditWallet called directly, the same
   way server.mjs's routes call them) — real transactions, real FOR UPDATE
   locks, real DECIMAL/BIGINT-string coercions. This is the baseline the next
   phases refactor against: if one of these assertions ever needs to change,
   that change is the behavior change, and should be called out as one.
--------------------------------------------------------------------------- */
import { test, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { pool, closePool } from '../../src/db.mjs'
import { placeBid, fundEmd, creditWallet } from '../../src/api/bidding.mjs'
import { resetDb, ids } from './helpers/reset.mjs'

before(async () => { await resetDb() })
beforeEach(async () => { await resetDb() })
after(async () => { await closePool() })

test('placeBid — happy path: rate at the floor is accepted and the lot updates', async () => {
  const res = await placeBid({ lotId: ids.lots.fwd, bidderId: ids.users.buyerRich, rate: 30_000 })
  assert.equal(res.ok, true)
  assert.equal(res.bid.rate, 30_000)
  assert.equal(res.bid.status, 'valid')
  assert.equal(res.lot.currentRate, 30_000)
  assert.equal(res.lot.leadingBidderId, ids.users.buyerRich)
  assert.equal(res.lot.bidCount, 1)
  assert.equal(res.outbid, null)
  assert.equal(res.extended, false)

  const [[lot]] = await pool.query('SELECT current_rate, leading_bidder_id, bid_count FROM lots WHERE id = ?', [ids.lots.fwd])
  assert.equal(Number(lot.current_rate), 30_000)
  assert.equal(lot.leading_bidder_id, ids.users.buyerRich)
  assert.equal(Number(lot.bid_count), 1)
})

test('placeBid — a second bid below the increment is rejected, and outbid names the previous leader', async () => {
  await placeBid({ lotId: ids.lots.fwd, bidderId: ids.users.buyerRich, rate: 30_000 })
  await assert.rejects(
    () => placeBid({ lotId: ids.lots.fwd, bidderId: ids.users.buyerPoor, rate: 30_100 }),
    (err) => { assert.equal(err.message, 'Minimum next bid is 30500 per MT'); assert.equal(err.status, 409); return true })

  const res = await placeBid({ lotId: ids.lots.fwd, bidderId: ids.users.buyerPoor, rate: 30_500 })
  assert.equal(res.outbid, ids.users.buyerRich)
})

test('placeBid — refuses a lot whose own status is not live', async () => {
  await assert.rejects(
    () => placeBid({ lotId: ids.lots.fwdSold, bidderId: ids.users.buyerRich, rate: 30_000 }),
    (err) => { assert.equal(err.message, 'Lot is not live'); return true })
})

test('placeBid — refuses a live lot whose catalogue is not live', async () => {
  await assert.rejects(
    () => placeBid({ lotId: ids.lots.inUpcomingCatalogue, bidderId: ids.users.buyerRich, rate: 30_000 }),
    (err) => { assert.equal(err.message, 'Lot is not live'); return true })
})

test('placeBid — refuses a bid after the lot\'s close time, even though status is still live', async () => {
  await assert.rejects(
    () => placeBid({ lotId: ids.lots.fwdPastDeadline, bidderId: ids.users.buyerRich, rate: 30_000 }),
    (err) => { assert.equal(err.message, 'Bidding on this lot has closed'); return true })
})

test('placeBid — anti-snipe: a bid inside the window pushes ends_at out and increments extensions', async () => {
  const before = await pool.query('SELECT ends_at, extensions FROM lots WHERE id = ?', [ids.lots.fwdNearSnipe])
  const beforeEndsAt = before[0][0].ends_at

  const res = await placeBid({ lotId: ids.lots.fwdNearSnipe, bidderId: ids.users.buyerRich, rate: 30_000 })
  assert.equal(res.extended, true)

  const [[lot]] = await pool.query('SELECT ends_at, extensions FROM lots WHERE id = ?', [ids.lots.fwdNearSnipe])
  assert.equal(Number(lot.extensions), 1)
  assert.equal(new Date(lot.ends_at).getTime() - new Date(beforeEndsAt).getTime(), 5 * 60_000)
})

test('placeBid — tender: an offer at the start rate is accepted with no visible current rate logic beyond the floor', async () => {
  const res = await placeBid({ lotId: ids.lots.tender, bidderId: ids.users.buyerRich, rate: 20_000 })
  assert.equal(res.ok, true)
  assert.equal(res.lot.currentRate, 20_000)
  assert.equal(res.extended, false) // tender lots are exempt from anti-snipe
})

test('placeBid — tender: a second offer from the same bidder is refused', async () => {
  await placeBid({ lotId: ids.lots.tender, bidderId: ids.users.buyerRich, rate: 20_000 })
  await assert.rejects(
    () => placeBid({ lotId: ids.lots.tender, bidderId: ids.users.buyerRich, rate: 25_000 }),
    (err) => { assert.equal(err.message, 'You have already submitted an offer for this lot'); return true })
})

test('placeBid — missing required fields throws a 400', async () => {
  await assert.rejects(
    () => placeBid({ lotId: null, bidderId: ids.users.buyerRich, rate: 30_000 }),
    (err) => { assert.equal(err.status, 400); return true })
})

test('placeBid — an unknown lot throws a 404', async () => {
  await assert.rejects(
    () => placeBid({ lotId: 'lot-does-not-exist', bidderId: ids.users.buyerRich, rate: 30_000 }),
    (err) => { assert.equal(err.message, 'Lot not found'); assert.equal(err.status, 404); return true })
})

/* ================================ fundEmd ================================= */

test('fundEmd — happy path: debits the wallet, records the ledger entry, marks the lot funded', async () => {
  const res = await fundEmd({ buyerId: ids.users.buyerRich, catalogueId: ids.catalogues.emdOpen, lotIds: [ids.lots.emdOpen] })
  assert.equal(res.ok, true)
  assert.deepEqual(res.funded, [ids.lots.emdOpen])
  assert.deepEqual(res.skipped, [])
  assert.equal(res.amount, 2_000)
  assert.equal(res.wallet.balance, 98_000)

  const [[wallet]] = await pool.query('SELECT balance, emd_locked FROM wallets WHERE user_id = ?', [ids.users.buyerRich])
  assert.equal(Number(wallet.balance), 98_000)
  assert.equal(Number(wallet.emd_locked), 2_000)

  const [[sel]] = await pool.query(
    'SELECT emd_funded FROM selection_lots WHERE buyer_id = ? AND lot_id = ?', [ids.users.buyerRich, ids.lots.emdOpen])
  assert.equal(sel.emd_funded, 1)

  const [ledger] = await pool.query('SELECT type, amount FROM wallet_ledger WHERE user_id = ?', [ids.users.buyerRich])
  assert.equal(ledger.length, 1)
  assert.equal(ledger[0].type, 'emd_lock')
  assert.equal(Number(ledger[0].amount), -2_000)
})

test('fundEmd — an already-funded lot is skipped, not double-charged', async () => {
  const res = await fundEmd({
    buyerId: ids.users.buyerRich, catalogueId: ids.catalogues.emdOpen,
    lotIds: [ids.lots.emdAlreadyFunded, ids.lots.emdOpen],
  })
  assert.deepEqual(res.funded, [ids.lots.emdOpen])
  assert.deepEqual(res.skipped, [ids.lots.emdAlreadyFunded])
  assert.equal(res.amount, 2_000) // only the fresh lot's EMD, not both
})

test('fundEmd — refuses a catalogue that is not open for EMD at all (status closed)', async () => {
  await assert.rejects(
    () => fundEmd({ buyerId: ids.users.buyerRich, catalogueId: ids.catalogues.emdNotOpenStatus, lotIds: [ids.lots.emdNotOpenStatus] }),
    (err) => { assert.equal(err.message, 'This auction is not open for EMD'); return true })
})

test('fundEmd — refuses before the EMD window has opened', async () => {
  await assert.rejects(
    () => fundEmd({ buyerId: ids.users.buyerRich, catalogueId: ids.catalogues.emdNotYetOpen, lotIds: [ids.lots.emdNotYetOpen] }),
    (err) => { assert.match(err.message, /has not opened yet$/); return true })
})

test('fundEmd — refuses after the deadline with no approved exemption', async () => {
  await assert.rejects(
    () => fundEmd({ buyerId: ids.users.buyerRich, catalogueId: ids.catalogues.emdClosedNoExempt, lotIds: [ids.lots.emdClosedNoExempt] }),
    (err) => { assert.match(err.message, /closed at its deadline/); return true })
})

test('fundEmd — an approved exemption reopens a closed window', async () => {
  const res = await fundEmd({ buyerId: ids.users.buyerRich, catalogueId: ids.catalogues.emdClosedExempt, lotIds: [ids.lots.emdClosedExempt] })
  assert.equal(res.ok, true)
  assert.deepEqual(res.funded, [ids.lots.emdClosedExempt])
})

test('fundEmd — refuses when the total exceeds the buyer\'s balance', async () => {
  await assert.rejects(
    () => fundEmd({ buyerId: ids.users.buyerPoor, catalogueId: ids.catalogues.emdOpen, lotIds: [ids.lots.emdExpensive] }),
    (err) => { assert.equal(err.message, 'EMD of 200000 exceeds the available balance of 1000'); return true })
})

test('fundEmd — a buyer with no wallet row throws a 404', async () => {
  await assert.rejects(
    () => fundEmd({ buyerId: ids.users.buyerNoWallet, catalogueId: ids.catalogues.emdOpen, lotIds: [ids.lots.emdOpen] }),
    (err) => { assert.equal(err.message, 'No wallet for this buyer'); assert.equal(err.status, 404); return true })
})

test('fundEmd — missing required fields throws a 400', async () => {
  await assert.rejects(
    () => fundEmd({ buyerId: ids.users.buyerRich, catalogueId: ids.catalogues.emdOpen, lotIds: [] }),
    (err) => { assert.equal(err.status, 400); return true })
})

/* ============================= creditWallet ================================ */

test('creditWallet — happy path: adds to the balance and records a ledger entry', async () => {
  const res = await creditWallet({ userId: ids.users.buyerRich, amount: 500, type: 'topup', ref: 'test-ref' })
  assert.equal(res.ok, true)
  assert.equal(res.wallet.balance, 100_500)

  const [[wallet]] = await pool.query('SELECT balance FROM wallets WHERE user_id = ?', [ids.users.buyerRich])
  assert.equal(Number(wallet.balance), 100_500)
})

test('creditWallet — a user with no wallet row throws a 404', async () => {
  await assert.rejects(
    () => creditWallet({ userId: ids.users.buyerNoWallet, amount: 500 }),
    (err) => { assert.equal(err.status, 404); return true })
})

test('creditWallet — a non-positive amount throws a 400', async () => {
  await assert.rejects(
    () => creditWallet({ userId: ids.users.buyerRich, amount: 0 }),
    (err) => { assert.equal(err.status, 400); return true })
})
