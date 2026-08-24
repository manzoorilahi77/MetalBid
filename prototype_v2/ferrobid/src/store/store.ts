/* ---------------------------------------------------------------------------
   ferroBid client store — the in-memory source of truth.
   Seeded from local JSON; all mutations happen here. A 1s tick drives
   countdowns, competing-bidder bots, anti-snipe extensions and lot closing.

   This file is the composition root: module-level seed data (unchanged from
   before the store was split) plus the single `create<State>()` call, which
   merges the ~127 actions in from src/store/slices/*.ts — one file per
   bounded context, each a `StateCreator` closure that reads the same
   `set`/`get` this file passes it. Shared internal helpers (bidding, wallet/
   EMD movement, notification fan-out, Super Admin snapshot/undo) live in
   ./internal.ts; shared pure constants (role groups, demo credentials, CEO
   helpers) live in ./constants.ts, imported by both this file and the
   slices. The external contract — `useStore`, and every other named export
   this file already had — is unchanged; see ARCHITECTURE.md and this file's
   own re-exports below.
--------------------------------------------------------------------------- */
import { create } from 'zustand'
import { loadSeed, SEEDED_LOCALLY } from './seed'
import { inr } from '../lib/format'
import { NAV_BY_ROLE } from '../layout/nav'
import { CATEGORY_META } from '../data/categoryMeta'
import { createInternalHelpers } from './internal'
import type { State } from './types'
import {
  DEFAULT_FINANCE_CONFIG, DEFAULT_WITHDRAWAL_WINDOW, ROLE_HOME, ROLE_KEY, ROLE_LABEL, ROLE_ORDER, hash,
} from './constants'
import { createEngineSlice } from './slices/engineSlice'
import { createSessionSlice } from './slices/sessionSlice'
import { createBuyerSlice } from './slices/buyerSlice'
import { createSellerSlice } from './slices/sellerSlice'
import { createOpsSlice } from './slices/opsSlice'
import { createAuctionFloorSlice } from './slices/auctionFloorSlice'
import { createFinanceSlice } from './slices/financeSlice'
import { createCeoSlice } from './slices/ceoSlice'
import { createSuperAdminSlice } from './slices/superAdminSlice'
import { createMiscSlice } from './slices/miscSlice'
import { createSubAdminSlice } from './slices/subAdminSlice'
import type {
  AuditEvent, BankAccount, BankStatementLine, Bid, BidType, BidVoidRequest, Catalogue,
  CeoApprovalRequest, CommissionSettlement, ContentDraft, DeliveryOrder, DepositClaim,
  EmdExemptionRequest, EmdForfeiture, HandoverNote, Invoice, Lot, MasterUom, MasterYard,
  PageDef, RefundRequest, Role, RoleDef, StructuralChange, User, WithdrawalRequest,
} from '../types'

/* Re-exports of everything this file exported before it was split — the
   external contract (every `from '../store/store'` import elsewhere in the
   app) is unchanged. The role-group constants, demo credentials and other
   values slices needed cross-file live in ./constants.ts and were not
   previously exported from here, so they are not re-exported here either. */
export {
  ANONYMOUS_ROLES, isAnonymousRole, ROLE_DEMO_USER, ROLE_LABEL, ROLE_HOME,
  SUB_ADMIN_ROLES, IMPERSONATION_BLOCKED_ROLES, CEO_REQUEST_HREF, canSignForCeo,
  delegationActive, ROLE_ORDER, DEMO_LOGINS, DEMO_PASSWORD, ENFORCE_LOGIN_PASSWORD,
  DEFAULT_WITHDRAWAL_WINDOW, DEFAULT_FINANCE_CONFIG, FINANCE_FIELD_LABEL, WEEKDAY_LABELS,
  selectionSummary, isCatalogueEmdLocked, fmtClock, withinWithdrawalWindow, nextWithdrawalWindowLabel,
} from './constants'
export type { AnonymousRole } from './constants'
export type { Toast } from './types'

const seed = loadSeed()

/* ------------------------------ demo escalations ---------------------------
   The EMD-eligibility queue and the surveillance queue are both fed by actions
   a fresh session hasn't performed yet, so both screens would open empty on
   every reload and read as broken rather than as clear. These derive their rows
   from the mock catalogues and bids rather than hard-coding ids in JSON, so
   they keep pointing at real records however the mock data is edited. */

const EXEMPTION_REASONS = [
  'RTGS cut-off missed by nine minutes — transfer went out the same evening, UTR attached.',
  'Our current account was frozen for KYC re-verification and only released this morning.',
  'Director sign-off for the EMD came through after the deadline. Funds are ready now.',
  'Deadline fell on a bank holiday in our state; first working slot was today.',
]

function seedEmdExemptions(): EmdExemptionRequest[] {
  const open = seed.catalogues.filter((c) => c.status === 'live' || c.status === 'upcoming').slice(0, 4)
  const buyers = seed.users.filter((u) => u.role === 'buyer')
  if (open.length === 0 || buyers.length === 0) return []
  const nowMs = Date.now()
  return open.map((c, i) => {
    const buyer = buyers[i % buyers.length]
    // the last one is pre-decided so the "already decided" list is never empty
    const decided = i === open.length - 1 && open.length > 2
    return {
      id: `emx-seed-${i + 1}`,
      buyerId: buyer.id,
      catalogueId: c.id,
      reason: EXEMPTION_REASONS[i % EXEMPTION_REASONS.length],
      status: decided ? ('approved' as const) : ('pending' as const),
      createdAt: new Date(nowMs - (i + 1) * 47 * 60_000).toISOString(),
      ...(decided ? { decidedAt: new Date(nowMs - 20 * 60_000).toISOString(), decidedBy: 'u-auction-1' } : {}),
    }
  })
}

function seedBidFlags(): BidVoidRequest[] {
  const liveIds = new Set(seed.catalogues.filter((c) => c.status === 'live').map((c) => c.id))
  const reasons = ['Rapid-fire pattern', 'Suspected collusion']
  return seed.bids
    .filter((b) => b.status === 'valid' && liveIds.has(b.catalogueId))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 2)
    .map((b, i) => ({
      id: `bvr-seed-${i + 1}`,
      bidId: b.id,
      lotId: b.lotId,
      catalogueId: b.catalogueId,
      reason: reasons[i % reasons.length],
      notes: i === 0
        ? 'Four bids inside 20 seconds from the same firm, each at the exact minimum increment.'
        : 'Two firms alternating at identical intervals across three lots in the same catalogue.',
      raisedBy: 'u-sub-1',
      raisedAt: new Date(Date.parse(b.at) + 90_000).toISOString(),
      stage: 'flagged' as const,
      status: 'pending' as const,
    }))
}

/* ------------------------------ demo money ---------------------------------
   bankAccounts.json, depositClaims.json and withdrawalRequests.json all ship
   empty — they were only ever filled by a buyer using the app. That is fine for
   the buyer's wallet, which starts empty on purpose, but it would open every
   money-in and money-out screen in the Finance workspace on a blank list, and a
   desk with nothing on it reads as broken rather than as clear.

   These derive their rows from the real seeded users, wallets and delivery
   orders rather than hard-coding ids, so they keep pointing at live records
   however the mock data is edited. Every generated figure is deterministic —
   the same reload always produces the same desk. */

const IFSC_BY_BANK: Record<string, string> = {
  'HDFC Bank': 'HDFC0000060', 'ICICI Bank': 'ICIC0000004', 'State Bank of India': 'SBIN0011513',
  'Axis Bank': 'UTIB0000234', 'Kotak Mahindra Bank': 'KKBK0000958',
}
const BANKS = Object.keys(IFSC_BY_BANK)

/** Stable pseudo-random from a string — so a demo row never changes between
 *  reloads, which is what makes a screenshot of this desk reproducible. */
const utrFor = (key: string) => `UTR${String(hash(key)).padStart(12, '0').slice(0, 12)}`
const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString()

/** Buyers and sellers with a wallet, in a fixed order. */
function moneyUsers(): User[] {
  const withWallet = new Set(seed.wallets.map((w) => w.userId))
  return seed.users.filter((u) => (u.role === 'buyer' || u.role === 'seller') && withWallet.has(u.id))
}

function seedBankAccounts(): BankAccount[] {
  return moneyUsers().slice(0, 7).map((u, i) => {
    const bank = BANKS[hash(u.id) % BANKS.length]
    const last4 = String(hash(`${u.id}acct`) % 10000).padStart(4, '0')
    // one pending and one rejected, so the queue has something to work and the
    // "decided" list is never empty
    const status = i === 2 ? 'pending' : i === 5 ? 'rejected' : i === 6 ? 'pending' : 'verified'
    return {
      id: `ba-seed-${i + 1}`,
      userId: u.id,
      bankName: bank,
      ifsc: IFSC_BY_BANK[bank],
      accountHolderName: u.firm,
      last4,
      accountNumberMasked: `•••• •••• ${last4}`,
      status: status as BankAccount['status'],
      ...(status === 'rejected' ? { rejectionReason: 'Account holder name does not match the registered firm name' } : {}),
      createdAt: minutesAgo(60 * 24 * (i + 2)),
    }
  })
}

function seedDepositClaims(): DepositClaim[] {
  const buyers = moneyUsers().filter((u) => u.role === 'buyer')
  if (buyers.length === 0) return []
  const rows: DepositClaim[] = buyers.slice(0, 6).map((u, i) => {
    const amount = 100_000 + (hash(`${u.id}dep`) % 18) * 50_000
    // three still on the desk, the rest already decided
    const status = i < 3 ? 'submitted' : i === 4 ? 'rejected' : 'approved'
    return {
      id: `dep-seed-${i + 1}`,
      userId: u.id,
      amount,
      utr: utrFor(`${u.id}dep`),
      transferDate: minutesAgo(60 * (6 + i * 9)).slice(0, 10),
      proofFilename: `neft-advice-${u.id.slice(-1)}.pdf`,
      status: status as DepositClaim['status'],
      ...(status === 'rejected' ? { rejectionReason: 'The UTR quoted does not appear on our statement for that date' } : {}),
      createdAt: minutesAgo(60 * (3 + i * 7)),
      ...(status === 'submitted' ? {} : { decidedAt: minutesAgo(60 * (1 + i * 5)), decidedBy: 'u-fin-1' }),
    }
  })
  // a duplicate UTR against the same buyer — the single most common reason a
  // deposit should not be credited, and the one the screen must warn about
  if (rows.length > 1) {
    rows.push({
      ...rows[0],
      id: 'dep-seed-dup',
      amount: rows[0].amount,
      status: 'submitted',
      createdAt: minutesAgo(45),
      decidedAt: undefined,
      decidedBy: undefined,
    })
  }
  return rows
}

function seedWithdrawals(): WithdrawalRequest[] {
  const accounts = seedBankAccounts().filter((a) => a.status === 'verified')
  return accounts.slice(0, 4).map((a, i) => {
    const amount = 75_000 + (hash(`${a.userId}wd`) % 12) * 25_000
    // one waiting to be reviewed, one reviewed and waiting on a *second* pair of
    // hands, one already paid, one that bounced
    const status = (['requested', 'under_review', 'processed', 'failed'] as const)[i]
    return {
      id: `wd-seed-${i + 1}`,
      userId: a.userId,
      amount,
      bankAccountId: a.id,
      ref: utrFor(`${a.userId}wd`),
      status,
      requestedAt: minutesAgo(60 * (2 + i * 8)),
      ...(status === 'under_review' ? { reviewedBy: 'u-fin-1', reviewedAt: minutesAgo(60 * (1 + i * 6)) } : {}),
      ...(status === 'processed' ? { reviewedBy: 'u-fin-1', reviewedAt: minutesAgo(60 * 20), processedBy: 'u-fin-2', decidedAt: minutesAgo(60 * 18) } : {}),
      ...(status === 'failed' ? { reviewedBy: 'u-fin-2', reviewedAt: minutesAgo(60 * 30), reason: 'Beneficiary IFSC rejected by the remitting bank', decidedAt: minutesAgo(60 * 28) } : {}),
    }
  })
}

/** The company statement, built so that most rows match a platform record and a
 *  handful deliberately do not — an unmatched credit, an unmatched debit and a
 *  short credit are exactly the three breaks this screen exists to surface. */
function seedBankStatement(claims: DepositClaim[], withdrawals: WithdrawalRequest[]): BankStatementLine[] {
  const emdPool = seed.companyBankAccounts[0]?.id ?? 'cba-1'
  const settlement = seed.companyBankAccounts[1]?.id ?? emdPool
  const users = new Map(seed.users.map((u) => [u.id, u]))
  const lines: BankStatementLine[] = []

  claims.forEach((c, i) => {
    // the last submitted claim has no bank credit behind it at all — which is
    // precisely why a deposit must never be approved on a typed UTR alone
    if (c.id === 'dep-seed-dup') return
    lines.push({
      id: `bsl-dep-${i + 1}`,
      at: c.createdAt,
      accountId: emdPool,
      direction: 'credit',
      // one credit arrives short of what the buyer claimed
      amount: i === 1 ? c.amount - 5_000 : c.amount,
      ref: c.utr,
      narration: `NEFT ${users.get(c.userId)?.firm ?? c.userId}`,
      status: c.status === 'approved' ? 'matched' : 'unmatched',
      ...(c.status === 'approved' ? { matchedTo: c.id, matchedKind: 'deposit' as const, matchedBy: 'u-fin-1', matchedAt: c.decidedAt } : {}),
    })
  })

  withdrawals.filter((w) => w.status === 'processed').forEach((w, i) => {
    lines.push({
      id: `bsl-wd-${i + 1}`,
      at: w.decidedAt ?? w.requestedAt,
      accountId: emdPool,
      direction: 'debit',
      amount: w.amount,
      ref: w.ref,
      narration: `RTGS OUT ${users.get(w.userId)?.firm ?? w.userId}`,
      status: 'matched',
      matchedTo: w.id, matchedKind: 'withdrawal', matchedBy: 'u-fin-2', matchedAt: w.decidedAt,
    })
  })

  lines.push({
    id: 'bsl-unmatched-1',
    at: minutesAgo(300),
    accountId: settlement,
    direction: 'credit',
    amount: 148_500,
    ref: utrFor('orphan-credit'),
    narration: 'IMPS INWARD — no remitter reference quoted',
    status: 'unmatched',
  })
  lines.push({
    id: 'bsl-unmatched-2',
    at: minutesAgo(60 * 52),
    accountId: emdPool,
    direction: 'debit',
    amount: 2_360,
    ref: utrFor('bank-charges'),
    narration: 'QUARTERLY ACCOUNT MAINTENANCE CHARGES + GST',
    status: 'break',
    breakNote: 'Bank charges — no platform record exists, book to costs',
  })
  return lines.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

/** Refunds the platform genuinely owes: a weighment shortfall on a lifted lot
 *  and a resolved dispute. Both are money already collected that has to go
 *  back — the case the build has no path for today. */
function seedRefunds(): RefundRequest[] {
  const lifted = seed.deliveryOrders.filter((d) => d.stage === 'lifted' || d.stage === 'completed')
  const rows: RefundRequest[] = []
  const first = lifted[0]
  if (first) {
    rows.push({
      id: 'ref-seed-1',
      userId: first.buyerId,
      amount: Math.round(first.materialValue * 0.018),
      source: 'weighment_shortfall',
      reason: 'Gross weighment came in 1.8% under the awarded quantity — value of the shortfall returns to the buyer.',
      lotId: first.lotId,
      catalogueId: first.catalogueId,
      status: 'pending',
      raisedBy: 'u-fin-1',
      raisedAt: minutesAgo(190),
    })
  }
  const dispute = seed.disputes.find((d) => d.status !== 'resolved') ?? seed.disputes[0]
  if (dispute) {
    rows.push({
      id: 'ref-seed-2',
      userId: dispute.userId,
      amount: 62_500,
      source: 'dispute',
      reason: `Dispute ${dispute.id} resolved in the buyer's favour — agreed goodwill adjustment on the lifted quantity.`,
      disputeId: dispute.id,
      lotId: dispute.lotId,
      status: 'approved',
      raisedBy: 'u-fin-1',
      raisedAt: minutesAgo(60 * 26),
      decidedBy: 'u-fin-2',
      decidedAt: minutesAgo(60 * 22),
      decisionNote: 'Below the CEO threshold — approved at Finance.',
    })
  }
  return rows
}

/* --------------------------- the commission chain ---------------------------
   Only two lots in the mock data carry a seller decision, so the whole
   commercial chain downstream of the auction — accept a price, owe commission,
   settle it, have Finance confirm it, recognise the income — had nothing to
   work with. The Finance desk opened on a loss made entirely of costs, which
   says "this business is failing" when it actually means "no sale has been
   settled yet".

   These fill that in from the closed auctions that already exist: most cleared
   prices accepted, a few rejected, and settlements at every stage Finance has
   to deal with — confirmed, recorded-and-waiting, queried, and simply unpaid. */

/** Seller decisions on cleared lots in closed auctions. Deterministic, and it
 *  never overwrites a decision the mock data already states. */
function seedSellerDecisions(): Lot[] {
  const closedAt = new Map(
    seed.catalogues.filter((c) => c.status === 'closed').map((c) => [c.id, Date.parse(c.endsAt)]),
  )
  return seed.lots.map((l) => {
    if (l.sellerDecision) return l
    const closed = closedAt.get(l.catalogueId)
    if (closed == null) return l
    if (l.status !== 'sold' && l.status !== 'sta') return l
    const h = hash(l.id)
    /* A price left undecided is a live piece of work, and work does not sit for
       a year — beyond the decision window every historical lot has been
       answered one way or the other. Only recent closes are still open. */
    const decided = Date.now() - closed > 21 * 86_400_000
    // A seller accepts most prices. They reject where the lot cleared below
    // their reserve, which is exactly what "subject to approval" means.
    if (l.status === 'sta') {
      if (decided) return h % 4 === 0 ? { ...l, sellerDecision: 'accepted' as const } : { ...l, sellerDecision: 'rejected' as const }
      return h % 3 === 0 ? l : { ...l, sellerDecision: 'rejected' as const }
    }
    if (decided) return h % 17 === 0 ? { ...l, sellerDecision: 'rejected' as const } : { ...l, sellerDecision: 'accepted' as const }
    return h % 9 === 0 ? l : { ...l, sellerDecision: 'accepted' as const }
  })
}

/** Commission settlements across every state the Finance desk has to handle. */
function seedCommissionSettlements(lots: Lot[]): CommissionSettlement[] {
  const rate = DEFAULT_FINANCE_CONFIG.sellerCommissionPct / 100
  const closed = seed.catalogues.filter((c) => c.status === 'closed')
  const rows: CommissionSettlement[] = []
  let i = 0
  for (const cat of closed) {
    const accepted = lots.filter((l) => l.catalogueId === cat.id && l.sellerDecision === 'accepted')
    if (accepted.length === 0) continue
    const amount = Math.round(accepted.reduce((sum, l) => {
      const cleared = l.resultH1Rate != null ? l.resultH1Rate * l.indicativeQty : 0
      return sum + Math.max(0, cleared - l.reserveRate * l.indicativeQty) * rate
    }, 0))
    if (amount <= 0) continue
    /* Cycle the states so every tab on the Commission screen has rows: two
       confirmed (income the P&L can recognise), one recorded and waiting, one
       queried, one left entirely unpaid so there is something to chase.

       Only auctions that closed recently get the unsettled states. A year of
       history cycled the same way would show commission still unconfirmed from
       nine months ago, which reads as a desk that never collects rather than a
       desk with work on it — so anything older than the ageing window is
       settled and confirmed, bar the occasional genuine bad debt. */
    const daysSinceClose = (Date.now() - Date.parse(cat.endsAt)) / 86_400_000
    const aged = daysSinceClose > 60
    const state = aged ? (hash(`${cat.id}s`) % 11 === 0 ? 4 : hash(`${cat.id}s`) % 2) : i % 5
    i += 1
    if (state === 4) continue // owed, nothing recorded — the chase case
    const mode: CommissionSettlement['mode'] = state === 1 ? 'emd' : 'transfer'
    /* A settlement is dated off the auction it settles, never off "now" — with
       a year of closed auctions behind us, stamping them all in the last few
       weeks would book twelve months of commission into this month's P&L. The
       seller pays a few days after close; Finance sees the credit a day or two
       after that, and neither instant is ever allowed into the future. */
    const closedAt = Date.parse(cat.endsAt)
    const at = new Date(Math.min(Date.now(), closedAt + (2 + (hash(cat.id) % 6)) * 86_400_000)).toISOString()
    const confirmedAt = new Date(Math.min(Date.now(), Date.parse(at) + (1 + (hash(`${cat.id}c`) % 3)) * 86_400_000)).toISOString()
    rows.push({
      id: `settle-seed-${i}`,
      catalogueId: cat.id,
      sellerId: cat.sellerId,
      amount,
      mode,
      at,
      reference: mode === 'emd' ? `EMD-NET-${cat.code}` : `${cat.code}-${utrFor(cat.id).slice(3, 12)}`,
      status: state === 2 ? 'recorded' : state === 3 ? 'queried' : 'confirmed',
      ...(state === 0 || state === 1
        ? { confirmedBy: 'u-fin-1', confirmedAt }
        : {}),
      ...(state === 3
        ? { queryNote: 'No credit matching this reference appears on the settlement account for that date. Please confirm the UTR.' }
        : {}),
    })
  }
  return rows
}

/** Tax documents already issued against paid delivery orders, so the register
 *  opens with a history rather than a blank page. */
function seedInvoices(): Invoice[] {
  return seed.deliveryOrders
    .filter((d) => d.paidAmount > 0)
    // Oldest first, so the invoice numbers run in the order the sales did.
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map((d, i) => ({
      id: `inv-seed-${i + 1}`,
      number: `FB/INV/26/${String(1001 + i)}`,
      kind: 'buyer_invoice' as const,
      partyId: d.buyerId,
      catalogueId: d.catalogueId,
      lotId: d.lotId,
      doId: d.id,
      issuedAt: d.createdAt,
      issuedBy: 'u-fin-1',
      taxable: d.materialValue,
      gst: d.gstAmount,
      tcs: d.tcsAmount,
      total: d.materialValue + d.gstAmount + d.tcsAmount,
      status: 'issued' as const,
    }))
}

/* ------------------------ the CEO's signature queue -------------------------
   The CEO approves and never originates: every row in this queue was raised by
   a desk that had already done the work and hit its own ceiling. So the seed
   builds the *underlying records first* and points the requests at them — sign
   the forfeiture here and the EMD genuinely moves; sign the publish and the
   catalogue genuinely becomes publishable. A queue of decorative rows would
   teach the wrong thing about what a signature does.

   Every threshold below is read from DEFAULT_FINANCE_CONFIG rather than typed,
   so tuning a threshold moves what reaches this desk. */

const CEO_CFG = DEFAULT_FINANCE_CONFIG

/** The overdue delivery order with the most EMD behind it. Finance raises the
 *  forfeiture; whether it stops at Finance or comes here is the threshold's
 *  call, not ours. */
function seedEmdForfeitures(): EmdForfeiture[] {
  const overdue = seed.deliveryOrders
    .filter((d) => d.stage === 'payment_pending')
    .map((d) => ({ d, lot: seed.lots.find((l) => l.id === d.lotId) }))
    .filter((r): r is { d: DeliveryOrder; lot: Lot } => !!r.lot && r.lot.preBidEmd >= CEO_CFG.ceoForfeitureFrom)
    .sort((a, b) => b.lot.preBidEmd - a.lot.preBidEmd)
  const top = overdue[0]
  if (!top) return []
  const due = top.d.materialValue + top.d.gstAmount + top.d.tcsAmount
  return [{
    id: 'emf-seed-1',
    buyerId: top.d.buyerId,
    lotId: top.lot.id,
    catalogueId: top.d.catalogueId,
    amount: top.lot.preBidEmd,
    reason: `Payment window closed with ${inr(Math.max(0, due - top.d.paidAmount))} of ${inr(due)} still unpaid on ${top.lot.lotNo}. Three reminders sent, no response.`,
    status: 'awaiting_ceo',
    raisedBy: 'u-fin-1',
    raisedAt: minutesAgo(60 * 5),
  }]
}

/** A refund Finance has raised that is above its own ceiling. Built off a
 *  completed sale, because the money is already collected — that is exactly
 *  what makes returning it a decision rather than a formality. */
function seedCeoRefund(): RefundRequest | null {
  const settled = seed.deliveryOrders
    .filter((d) => d.stage === 'completed' && d.paidAmount > 0)
    .sort((a, b) => b.materialValue - a.materialValue)[0]
  if (!settled) return null
  const amount = Math.round(settled.materialValue * 0.11)
  if (amount < CEO_CFG.ceoRefundFrom) return null
  return {
    id: 'ref-seed-ceo',
    userId: settled.buyerId,
    amount,
    source: 'dispute',
    reason: 'Re-weighment at the buyer\'s yard came in 11% under the awarded quantity, witnessed by our field executive. Dispute resolved in the buyer\'s favour — the value of the shortfall goes back.',
    lotId: settled.lotId,
    catalogueId: settled.catalogueId,
    status: 'awaiting_ceo',
    raisedBy: 'u-fin-1',
    raisedAt: minutesAgo(60 * 9),
  }
}

/** The largest catalogue Operations has finished and cannot publish on its own
 *  authority. Signing it is what unblocks the Publish button on Schedule. */
function seedPublishRequest(): { catalogueId: string; code: string; reserveValue: number } | null {
  const value = (id: string) => seed.lots
    .filter((l) => l.catalogueId === id)
    .reduce((sum, l) => sum + l.reserveRate * l.indicativeQty, 0)
  const ready = seed.catalogues
    .filter((c) => c.status === 'draft' && seed.lots.some((l) => l.catalogueId === c.id))
    .filter((c) => seed.lots.filter((l) => l.catalogueId === c.id).every((l) => l.status === 'approved'))
    .map((c) => ({ catalogueId: c.id, code: c.code, reserveValue: value(c.id) }))
    .filter((c) => c.reserveValue >= CEO_CFG.ceoPublishValueFrom)
    .sort((a, b) => b.reserveValue - a.reserveValue)
  return ready[0] ?? null
}

/** The queue itself: the open items above, plus enough decided history that the
 *  CEO can see what signing has actually done. */
function seedCeoApprovals(forfeitures: EmdForfeiture[], refund: RefundRequest | null): CeoApprovalRequest[] {
  const rows: CeoApprovalRequest[] = []
  const defaulter = seed.users.find((u) => u.standing === 'defaulter')
  const publish = seedPublishRequest()
  const liveBig = seed.catalogues.find((c) => c.status === 'live')

  for (const f of forfeitures) {
    const lot = seed.lots.find((l) => l.id === f.lotId)
    const buyer = seed.users.find((u) => u.id === f.buyerId)
    rows.push({
      id: 'ceo-seed-forfeit',
      kind: 'emd_forfeiture', refId: f.id, amount: f.amount,
      summary: `Forfeit ${inr(f.amount)} of EMD held from ${buyer?.firm ?? 'a buyer'} on ${lot?.lotNo ?? 'a lot'}`,
      reason: f.reason,
      requestedBy: f.raisedBy, requestedAt: f.raisedAt, status: 'pending',
    })
  }

  if (refund) {
    const buyer = seed.users.find((u) => u.id === refund.userId)
    rows.push({
      id: 'ceo-seed-refund',
      kind: 'refund', refId: refund.id, amount: refund.amount,
      summary: `Refund ${inr(refund.amount)} to ${buyer?.firm ?? 'a buyer'}`,
      reason: refund.reason,
      requestedBy: refund.raisedBy, requestedAt: refund.raisedAt, status: 'pending',
    })
  }

  if (publish) {
    rows.push({
      id: 'ceo-seed-publish',
      kind: 'auction_publish', refId: publish.catalogueId, amount: publish.reserveValue,
      summary: `Publish ${publish.code} — ${inr(publish.reserveValue)} at reserve`,
      reason: `Every lot is approved and the catalogue is assembled. It is above the ${inr(CEO_CFG.ceoPublishValueFrom)} publish threshold, so Operations is holding it rather than taking it to market.`,
      requestedBy: 'u-exec-1', requestedAt: minutesAgo(60 * 14), status: 'pending',
    })
  }

  rows.push({
    id: 'ceo-seed-fee',
    kind: 'fee_change', refId: 'financeConfig', amount: 0,
    payload: { sellerCommissionPct: 12 },
    summary: 'Raise seller commission from 10% to 12% of the seller\'s upside',
    reason: 'Two competitors moved to 12% this quarter and our sell-through is holding. Proposed for new catalogues only; auctions already published keep the rate they were listed under.',
    requestedBy: 'u-super-1', requestedAt: minutesAgo(60 * 31), status: 'pending',
  })

  if (defaulter) {
    rows.push({
      id: 'ceo-seed-ban',
      kind: 'permanent_ban', refId: defaulter.id, amount: 0,
      summary: `Permanently ban ${defaulter.firm}`,
      reason: defaulter.blacklistReason
        ? `${defaulter.blacklistReason}. Second occurrence — Operations recommends the account is closed rather than watchlisted.`
        : 'Repeated non-payment after winning. Operations recommends the account is closed rather than watchlisted.',
      requestedBy: 'u-sub-1', requestedAt: minutesAgo(60 * 40), status: 'pending',
    })
  }

  /* --- decided, so the record of what a signature does is never empty --- */
  if (liveBig) {
    const reserve = seed.lots.filter((l) => l.catalogueId === liveBig.id).reduce((s, l) => s + l.reserveRate * l.indicativeQty, 0)
    rows.push({
      id: 'ceo-seed-history-publish',
      kind: 'auction_publish', refId: liveBig.id, amount: reserve,
      summary: `Publish ${liveBig.code} — ${inr(reserve)} at reserve`,
      reason: 'Largest single catalogue this quarter. Ops asked for sign-off before it went to market.',
      requestedBy: 'u-exec-1', requestedAt: minutesAgo(60 * 96), status: 'approved',
      decidedBy: 'u-ceo-1', decidedAt: minutesAgo(60 * 93),
      decisionNote: 'Go ahead. Keep the anti-snipe window at five minutes on a sale this size.',
    })
  }
  rows.push({
    id: 'ceo-seed-history-fee',
    kind: 'fee_change', refId: 'financeConfig', amount: 0,
    payload: { buyerPremiumPct: 1.5 },
    summary: 'Raise buyer premium from 1% to 1.5%',
    reason: 'Proposed to offset the rise in payment gateway charges.',
    requestedBy: 'u-super-1', requestedAt: minutesAgo(60 * 130), status: 'refused',
    decidedBy: 'u-ceo-1', decidedAt: minutesAgo(60 * 121),
    decisionNote: 'Not while we are still winning buyers off the incumbents. Come back with the gateway cost as a line in the P&L and we will look again next quarter.',
  })

  return rows.sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt))
}
/* ---------------------- the platform's own structure -----------------------
   Roles and pages are seeded from the shipped defaults rather than from JSON,
   so the Super Admin's Roles and Page manager screens open on exactly what the
   app is actually rendering. Every later edit is a diff against this. */

const PLATFORM_EPOCH = new Date(Date.now() - 90 * 24 * 3600_000).toISOString()

function seedRoleRegistry(): RoleDef[] {
  /* guest1 and guest_buyer are presentations of the public site rather
     than roles anyone is granted, so they are not accounts a Super Admin
     administers and do not belong on the Roles screen. */
  return ROLE_ORDER.filter((r) => r !== 'guest1' && r !== 'guest_buyer').map((key) => ({
    key,
    label: ROLE_LABEL[key],
    home: ROLE_HOME[key],
    builtIn: true,
    status: 'active' as const,
    createdAt: PLATFORM_EPOCH,
  }))
}

function seedPageRegistry(): PageDef[] {
  const rows: PageDef[] = []
  for (const [roleKey, items] of Object.entries(NAV_BY_ROLE)) {
    items.forEach((it, i) => {
      rows.push({
        id: `pg-${roleKey}-${i + 1}`,
        roleKey,
        to: it.to,
        label: it.label,
        subLabel: it.subLabel,
        end: it.end,
        locked: it.locked,
        inTop: it.in.includes('top'),
        inSub: it.in.includes('sub'),
        activeMatch: it.activeMatch,
        hidden: false,
        order: i,
        builtIn: true,
        retained: it.retained,
        category: it.category,
      })
    })
  }
  return rows
}

/** Two changes already on the record, so Change history and the dashboard's
 *  "recently changed" rail open on something real rather than on an empty
 *  state that reads as broken. Both are undoable like any other. */
function seedStructuralChanges(pages: PageDef[]): StructuralChange[] {
  const bidResults = pages.find((p) => p.roleKey === 'buyer' && p.to === '/buyer/bids')
  const at = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString()
  const rows: StructuralChange[] = []
  if (bidResults) {
    rows.push({
      id: 'sc-seed-1', at: at(60 * 26), byId: 'u-super-1', kind: 'page.rename',
      target: `${ROLE_LABEL.buyer} · ${bidResults.to}`,
      summary: 'Buyer sub-nav tab renamed after a support call — buyers were looking for their results, not their bids',
      before: 'My bids', after: 'Bid results',
    })
  }
  rows.push({
    id: 'sc-seed-2', at: at(60 * 5), byId: 'u-super-1', kind: 'master.terms_version',
    target: 'Standard scrap T&C',
    summary: 'New terms version drafted for the ground-rent clause',
    before: 'v2.0', after: 'v2.1',
  })
  return rows
}

const CONTENT_SEED: Omit<ContentDraft, 'id' | 'authorId' | 'submittedAt'>[] = [
  {
    page: 'Home', section: 'Hero subheading',
    before: "India's B2B marketplace for industrial metal auctions. Physically inspected, catalogued and sold as-is-where-is.",
    after: "India's B2B marketplace for industrial metal auctions. Every lot physically inspected, catalogued and sold as-is-where-is.",
    status: 'submitted', needsCeo: false,
  },
  {
    page: 'Pricing', section: 'What we charge',
    before: 'Sellers pay a commission on the upside over their own reserve. Buyers pay a premium on the material value of every paid delivery order.',
    after: 'Sellers pay commission only on what we win them above their own reserve — no listing fee, no subscription. Buyers pay a premium on the material value of every paid delivery order.',
    status: 'submitted', needsCeo: true,
  },
  {
    page: 'Help', section: 'EMD — what happens to my deposit',
    before: 'EMD is released after the auction closes.',
    after: 'Your EMD is released automatically the moment the lot you funded closes, if you did not win it. Nothing is deducted and nobody has to approve it.',
    status: 'submitted', needsCeo: false,
  },
  {
    page: 'Legal', section: 'Grievance redressal',
    before: 'Write to grievance@ferrobid.in.',
    after: 'Write to grievance@ferrobid.in. We acknowledge within one working day and respond within seven.',
    status: 'returned', needsCeo: true,
    note: 'Legal has to sign the response window before we commit to it in public. Bring their confirmation and resubmit.',
  },
]

function seedContentDrafts(): ContentDraft[] {
  return CONTENT_SEED.map((c, i) => ({
    ...c,
    id: `cnt-seed-${i + 1}`,
    authorId: 'u-sub-1',
    submittedAt: new Date(Date.now() - (i + 1) * 5 * 3600_000).toISOString(),
    ...(c.status === 'returned' ? { decidedAt: new Date(Date.now() - 3600_000).toISOString(), decidedBy: 'u-super-1' } : {}),
  }))
}

/** What the shift before this one left behind. Two notes, both the kind of
 *  thing that only gets passed on by a person: a lot to watch, and a customer
 *  who has already been promised a call back. */
function seedHandoverNotes(): HandoverNote[] {
  const at = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()
  return [
    {
      id: 'hn-seed-1', byId: 'u-sub-1', at: at(9),
      body: 'Kanchan Ispat rang about the weighment variance on their last lifting — promised them a call back before close today. Do not resolve the ticket until they have been spoken to.',
    },
    {
      id: 'hn-seed-2', byId: 'u-sub-1', at: at(17),
      body: 'Jamshedpur yard is on reduced gate hours all week. Anything lifting from there needs the slot confirmed with the yard before the DO goes out.',
    },
  ]
}

function seedMasterYards(): MasterYard[] {
  const seen = new Map<string, MasterYard>()
  seed.catalogues.forEach((c, i) => {
    if (seen.has(c.yardName)) return
    seen.set(c.yardName, {
      id: `yard-${i + 1}`, name: c.yardName, region: c.region, address: c.yardAddress,
      contactName: c.inspectionContact.name, contactPhone: c.inspectionContact.phone,
      builtIn: true, active: true,
    })
  })
  return [...seen.values()]
}

const SEED_UOMS: MasterUom[] = [
  { code: 'MT', label: 'Metric tonne', precision: 'Up to 3 decimals', builtIn: true, active: true },
  { code: 'KG', label: 'Kilogram', precision: 'Whole numbers', builtIn: true, active: true },
  { code: 'PCS', label: 'Pieces / numbers', precision: 'Whole numbers', builtIn: true, active: true },
  { code: 'LOT', label: 'Composite lot (one price)', precision: 'Not applicable', builtIn: true, active: true },
]

// defaults to light unless the user has manually chosen dark mode in settings
const storedTheme = typeof window !== 'undefined' ? localStorage.getItem('theme') : null

/** Which nav strip to draw before the real session (see `bootstrapSession` in
 *  main.tsx) has had a chance to answer. Remembered across a refresh so a
 *  signed-in seller reloading `/seller` sees their own nav immediately rather
 *  than a flash of the wrong one.
 *
 *  The fallback used to be `'buyer'`, from before real authentication
 *  existed: this whole file's `currentUser` started as a demo identity, no
 *  sign-in required, because there was no account behind any of it to be
 *  wrong about. That is exactly backwards now — a fresh browser (or one with
 *  storage cleared, or a first-ever visit) would show "Namaste, Arvind" with
 *  no session behind it at all, and every real request would then correctly
 *  401. `'guest'` is the honest default: nobody, until sign-in says otherwise. */
const storedRole: Role = (() => {
  try {
    const r = localStorage.getItem(ROLE_KEY) as Role | null
    if (r && ROLE_ORDER.includes(r)) return r
  } catch {
    /* private mode — fall through to the default */
  }
  return 'guest'
})()

/* Computed once at module load: the withdrawal rows reference the account rows,
   and the statement references both, so all three have to agree. */
const seededBankAccounts = seedBankAccounts()
const seededDepositClaims = seedDepositClaims()
const seededWithdrawals = seedWithdrawals()
/* The settlements are computed from the decided lots, so the two have to agree. */
const seededLots = seedSellerDecisions()
const seededCommissionSettlements = seedCommissionSettlements(seededLots)

/** Delivery orders that already carry a weighment were recorded before the
 *  figure was attributed to anybody. A handover now closes only against a
 *  reading one of our own people witnessed, so these are stamped with the field
 *  executive who covered the yard — which is who actually took them. Without
 *  this the seeded handovers would be unclosable, and the control would look
 *  like a bug rather than a control. */
function seedWeighmentWitness(): DeliveryOrder[] {
  const inspectors = seed.users.filter((u) => u.role === 'field_exec')
  if (inspectors.length === 0) return seed.deliveryOrders
  return seed.deliveryOrders.map((d) => {
    if (d.weighedQty == null || d.weighedById) return d
    const cat = seed.catalogues.find((c) => c.id === d.catalogueId)
    const witness = inspectors.find((u) => u.id === cat?.assignedFieldExecId)
      ?? inspectors[hash(d.id) % inspectors.length]
    return { ...d, weighedById: witness.id, weighedAt: d.createdAt }
  })
}
const seededDeliveryOrders = seedWeighmentWitness()
/* The CEO's queue points at these records, so all three are built together. */
const seededForfeitures = seedEmdForfeitures()
const seededCeoRefund = seedCeoRefund()
const seededRefunds = [...seedRefunds(), ...(seededCeoRefund ? [seededCeoRefund] : [])]
const seededCeoApprovals = seedCeoApprovals(seededForfeitures, seededCeoRefund)
/* The seeded change history points at real page rows, so both are built together. */
const seededPages = seedPageRegistry()

export const useStore = create<State>((set, get) => {
  const helpers = createInternalHelpers(set, get)

  return {
    now: Date.now(),
    theme: storedTheme === 'dark' ? 'dark' : 'light',
    role: storedRole,
    /* Never a fabricated identity — only useRestoredSession (a real refresh
       token) or a real sign-in ever sets this. See the note on storedRole. */
    currentUser: null,
    paused: {},
    serverStatus: 'checking',
    sessionStatus: 'restoring',
    impersonatedBy: null,

    ...seed,
    lots: seededLots,
    deliveryOrders: seededDeliveryOrders,

    withdrawalWindow: DEFAULT_WITHDRAWAL_WINDOW,
    emdExemptionRequests: seedEmdExemptions(),
    cancellationRequests: [],
    bidVoidRequests: seedBidFlags(),
    resultConfirmations: [],
    staReferrals: [],

    /* Sub Admin — the supervisory layer. Reviews and claims start empty; the
       shift starts on a note from the shift before it, because an ops console
       that opens on "nothing here yet" reads as broken rather than as quiet.
       The hand-written rows below (notes, drafts, change history, the orphan
       statement lines and the CEO fee requests) are gated on SEEDED_LOCALLY:
       they do not derive from the seed arrays, so without the gate a browser
       with no server behind it would still show them — and they live in the
       database now, so the server brings them back when it is reachable. */
    actionReviews: [],
    workClaims: {},
    handoverNotes: SEEDED_LOCALLY ? seedHandoverNotes() : [],
    termsAccepted: {},
    commissionSettlements: seededCommissionSettlements,

    /* Finance — the money-in / money-out records the mock JSON ships empty. */
    financeConfig: DEFAULT_FINANCE_CONFIG,
    bankAccounts: seededBankAccounts,
    depositClaims: seededDepositClaims,
    withdrawalRequests: seededWithdrawals,
    bankStatementLines: SEEDED_LOCALLY ? seedBankStatement(seededDepositClaims, seededWithdrawals) : [],
    refundRequests: seededRefunds,
    emdForfeitures: seededForfeitures,
    invoices: seedInvoices(),
    ceoApprovals: SEEDED_LOCALLY ? seededCeoApprovals : [],
    ceoDelegation: null,

    /* Super Admin — the shape of the platform, seeded from what ships. The role
       and page registries stay seeded in every mode: navigation is built from
       them, so an empty registry is not an empty screen but no app at all. */
    roleRegistry: seedRoleRegistry(),
    pageRegistry: seededPages,
    structuralChanges: SEEDED_LOCALLY ? seedStructuralChanges(seededPages) : [],
    passwordResets: [],
    contentDrafts: SEEDED_LOCALLY ? seedContentDrafts() : [],
    masterCategories: CATEGORY_META.map((c) => ({ ...c, builtIn: true, active: true })),
    masterUoms: SEED_UOMS,
    masterYards: seedMasterYards(),
    testimonials: [],

    toasts: [],
    lastWonLotId: null,


    ...createEngineSlice(set, get, helpers),
    ...createSessionSlice(set, get, helpers),
    ...createBuyerSlice(set, get, helpers),
    ...createSellerSlice(set, get, helpers),
    ...createOpsSlice(set, get, helpers),
    ...createAuctionFloorSlice(set, get, helpers),
    ...createFinanceSlice(set, get, helpers),
    ...createCeoSlice(set, get, helpers),
    ...createSuperAdminSlice(set, get, helpers),
    ...createMiscSlice(set, get, helpers),
    ...createSubAdminSlice(set, get, helpers),
  }
})

/* ------------------------- derived-data helpers --------------------------- */

/** The buyer's most recent EMD exemption request for a catalogue, if any —
 *  a rejected request doesn't block a fresh one, so only the latest matters. */
export function latestEmdExemptionRequest(
  s: Pick<State, 'emdExemptionRequests'>, buyerId: string | undefined, catalogueId: string,
): EmdExemptionRequest | null {
  if (!buyerId) return null
  const mine = s.emdExemptionRequests.filter((r) => r.buyerId === buyerId && r.catalogueId === catalogueId)
  if (mine.length === 0) return null
  return mine.reduce((latest, r) => (Date.parse(r.createdAt) > Date.parse(latest.createdAt) ? r : latest))
}

/** True once a sub-admin has approved reopening EMD funding for this buyer on
 *  this catalogue despite the deadline having passed. */
export function hasApprovedEmdExemption(
  s: Pick<State, 'emdExemptionRequests'>, buyerId: string | undefined, catalogueId: string,
): boolean {
  return latestEmdExemptionRequest(s, buyerId, catalogueId)?.status === 'approved'
}

/** A catalogue counts as "shortlisted" (Browse & Shortlist's scope filter) if the
 *  buyer has watchlisted it. Browse & Shortlist only ever shortlists whole
 *  catalogues — lot-level selection happens later, inside the EMD flow — so
 *  this deliberately ignores per-lot `selections`. */
export function isCatalogueShortlisted(
  s: Pick<State, 'watchlist'>, buyerId: string | undefined, catalogueId: string,
): boolean {
  if (!buyerId) return false
  return s.watchlist.some((w) => w.buyerId === buyerId && w.catalogueId === catalogueId)
}

/** Status of a catalogue for chips: live / closing-soon / upcoming / closed. */
export function catalogueUiStatus(cat: Catalogue, now: number, lots?: Lot[]): 'live' | 'closing' | 'upcoming' | 'closed' {
  if (cat.status === 'closed' || cat.status === 'draft') return 'closed'
  if (cat.status === 'upcoming') return 'upcoming'
  const end = lots?.length
    ? Math.max(...lots.filter((l) => l.status === 'live').map((l) => Date.parse(l.endsAt)), Date.parse(cat.endsAt))
    : Date.parse(cat.endsAt)
  return end - now < 30 * 60_000 ? 'closing' : 'live'
}

export interface LadderRow {
  rank: number
  bidderId: string
  rate: number
  at: string
  type: BidType
  isMe: boolean
}

/** Full bid ranking for a lot — valid bids deduped to each bidder's best
 *  rate, ranked descending (ties broken by earliest bid). Uncapped. */
export function rankBidders(bids: Bid[], lotId: string, meId?: string): LadderRow[] {
  const best = new Map<string, Bid>()
  for (const b of bids) {
    if (b.lotId !== lotId || b.status !== 'valid') continue
    const cur = best.get(b.bidderId)
    if (!cur || b.rate > cur.rate || (b.rate === cur.rate && Date.parse(b.at) < Date.parse(cur.at))) {
      best.set(b.bidderId, b)
    }
  }
  return [...best.values()]
    .sort((a, b) => b.rate - a.rate || Date.parse(a.at) - Date.parse(b.at))
    .map((b, i) => ({ rank: i + 1, bidderId: b.bidderId, rate: b.rate, at: b.at, type: b.type, isMe: b.bidderId === meId }))
}

/** How many ranks the bid ladder shows before falling back to "your position". */
export const LADDER_DEPTH = 5

/** Bid ladder standings for a lot. Returns the top {@link LADDER_DEPTH} plus the
 *  current user's own row (only when they're not already inside that band). */
export function ladderStandings(bids: Bid[], lotId: string, meId: string | undefined) {
  const ranked = rankBidders(bids, lotId, meId)
  const top = ranked.slice(0, LADDER_DEPTH)
  const myRow = meId ? ranked.find((r) => r.bidderId === meId && r.rank > LADDER_DEPTH) ?? null : null
  return { top, myRow }
}

export interface MyBidTrailRow {
  id: string
  rate: number
  at: string
  type: BidType
  struck: boolean
  reasonLabel: string
  tone: 'success' | 'danger' | 'neutral' | 'warning'
  detail?: string // longer explanation (e.g. the void audit note) — never chip content
}

/** The current user's own bid trail on a lot, newest first, with a
 *  plain-language outcome per bid (leading / outbid / won / voided). */
export function myBidTrail(bids: Bid[], auditEvents: AuditEvent[], lot: Lot, meId: string | undefined): MyBidTrailRow[] {
  if (!meId) return []
  return bids
    .filter((b) => b.lotId === lot.id && b.bidderId === meId)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .map((b) => {
      if (b.status === 'void') {
        const detail = auditEvents.find((e) => e.action === 'bid.void' && e.target === b.id)?.detail
        return { id: b.id, rate: b.rate, at: b.at, type: b.type, struck: true, reasonLabel: 'Voided', tone: 'danger' as const, detail }
      }
      const leading = b.rate === lot.currentRate && lot.leadingBidderId === meId
      if (leading) {
        const label = lot.status === 'sold' ? 'Won' : 'Leading'
        return { id: b.id, rate: b.rate, at: b.at, type: b.type, struck: false, reasonLabel: label, tone: 'success' as const }
      }
      return { id: b.id, rate: b.rate, at: b.at, type: b.type, struck: false, reasonLabel: 'Outbid', tone: 'neutral' as const }
    })
}

export interface MyLotResult {
  rank: number
  myBestRate: number
  outcome: 'won' | 'lost' | 'sta' | 'unsold'
  closingH1: number | null
}

/** My standing on a (closed) lot I bid on — rank, best bid, outcome, closing
 *  H1 — for post-auction results. Null if I never placed a valid bid on it. */
export function myLotResult(bids: Bid[], lot: Lot, meId: string | undefined): MyLotResult | null {
  if (!meId) return null
  const ranked = rankBidders(bids, lot.id, meId)
  const mine = ranked.find((r) => r.bidderId === meId)
  if (!mine) return null
  const outcome: MyLotResult['outcome'] =
    lot.status === 'unsold' ? 'unsold'
      : lot.status === 'sold' ? (lot.leadingBidderId === meId ? 'won' : 'lost')
      : lot.status === 'sta' ? (lot.leadingBidderId === meId ? 'sta' : 'lost')
      : 'lost'
  return { rank: mine.rank, myBestRate: mine.rate, outcome, closingH1: lot.resultH1Rate ?? lot.currentRate ?? null }
}

/* --------------------------- navigation selectors --------------------------
   Chrome and the contextual sub-nav render the page registry rather than the
   shipped defaults, so a rename, a reorder or a hidden tab made in the Super
   Admin's Page manager is live the moment it is saved — and comes back
   instantly when the change is rolled back.

   Both take `pageRegistry` from the store as an argument rather than
   subscribing themselves: a selector that filters has to return a new array
   every call, which is exactly what a store subscription must not do. */

/** One role's menu, in menu order, with hidden entries dropped. */
export function visiblePages(pages: PageDef[], role: Role | string): PageDef[] {
  return pages.filter((p) => p.roleKey === role && !p.hidden).sort((a, b) => a.order - b.order)
}

/** Does this page cover where we are? The rule NavLink applies — exact match
 *  when `end`, prefix match otherwise — plus the extra prefixes a page claims
 *  through `activeMatch`. */
export function pageMatches(page: PageDef, pathname: string): boolean {
  if (page.activeMatch?.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true
  return page.end ? pathname === page.to : pathname === page.to || pathname.startsWith(`${page.to}/`)
}

/** The role's categories, in menu order, each with the pages inside it. Empty
 *  for a role whose menu is one flat list — which is every role but the five
 *  staff desks, whose menus are too long to read as one row of tabs. */
export function categoriesFrom(pages: PageDef[], role: Role | string) {
  const out: { label: string; pages: PageDef[] }[] = []
  const seen = new Map<string, { label: string; pages: PageDef[] }>()
  for (const p of visiblePages(pages, role)) {
    if (!p.category) continue
    const group = seen.get(p.category)
    if (group) { group.pages.push(p); continue }
    const next = { label: p.category, pages: [p] }
    seen.set(p.category, next)
    out.push(next)
  }
  return out
}

/** The category we are currently inside, or null when the route belongs to none
 *  of them — a shared page like Browse, or a role with no categories at all. */
export function activeCategory(pages: PageDef[], role: Role | string, pathname: string) {
  return categoriesFrom(pages, role).find((c) => c.pages.some((p) => pageMatches(p, pathname))) ?? null
}

/** The tab strip under the header, in the shape SubNav consumes.
 *
 *  For a role with categories this is the pages of the *open* category only —
 *  the top bar picks the category, this strip picks the page inside it. A role
 *  without categories gets its whole menu, exactly as it always has. */
export function subNavFrom(pages: PageDef[], role: Role | string, pathname?: string) {
  const scope = categoriesFrom(pages, role).length === 0 || pathname === undefined
    ? visiblePages(pages, role)
    : (activeCategory(pages, role, pathname)?.pages ?? [])
  return scope
    .filter((p) => p.inSub)
    .map((p) => ({ to: p.to, label: p.subLabel ?? p.label, end: p.end, locked: p.locked, activeMatch: p.activeMatch }))
}

/** One link on the sticky top bar: either a category — which opens on its first
 *  page and stays lit anywhere inside itself — or a single page that belongs to
 *  no category and earns its own place up there. */
export type TopNavLink = {
  key: string
  label: string
  to: string
  /** Every page this link stands for, for working out whether it is active. */
  pages: PageDef[]
  /** True for a lone page, which keeps NavLink's own matching rules. */
  standalone: boolean
}

/** The links on the sticky top bar. A role with categories shows those rather
 *  than its individual pages: the whole point of grouping an eighteen-screen
 *  menu is that the bar names three places to go, not eighteen. Pages outside
 *  every category (Browse, the Ops console door) keep their own link. */
export function topNavFrom(pages: PageDef[], role: Role | string): TopNavLink[] {
  const out: TopNavLink[] = []
  const byCategory = new Map<string, TopNavLink>()
  for (const p of visiblePages(pages, role)) {
    if (p.category) {
      const group = byCategory.get(p.category)
      if (group) { group.pages.push(p); continue }
      const link: TopNavLink = { key: `cat:${p.category}`, label: p.category, to: p.to, pages: [p], standalone: false }
      byCategory.set(p.category, link)
      out.push(link)
    } else if (p.inTop) {
      out.push({ key: p.to, label: p.label, to: p.to, pages: [p], standalone: true })
    }
  }
  return out
}
