/* ---------------------------------------------------------------------------
   ferroBid client store — the in-memory source of truth.
   Seeded from local JSON; all mutations happen here. A 1s tick drives
   countdowns, competing-bidder bots, anti-snipe extensions and lot closing.
--------------------------------------------------------------------------- */
import { create } from 'zustand'
import { loadSeed } from './seed'
import { uid, inr, num, genBidderId, genSellerId } from '../lib/format'
import { defaultEmdDeadline, emdWindowClosed, emdWindowNotOpen } from '../lib/emd'
import { NAV_BY_ROLE } from '../layout/nav'
import { CATEGORY_META } from '../data/categoryMeta'
import type {
  AccountStatus, ActionReview, ActionVerdict, Announcement, AppNotification, AuditEvent, AutoBidSetting, BankAccount, BankStatementLine, Bid, BidType, BidVoidRequest, BuyerLotSelection,
  CancellationRequest, Catalogue, CeoApprovalKind, CeoApprovalRequest, CeoDelegation, CommissionSettlement, CompanyBankAccount, ContentDraft, DemandDraft, DeliveryOrder, DepositClaim, Dispute, DisputeOutcome,
  EmdExemptionRequest, EmdForfeiture, FinanceConfig, HandoverNote, RefundSource, InspectionReport, Invoice, LiftingChecklistItem, Lot, LotOverride, LotStatus,
  MasterCategory, MasterUom, MasterYard, NotificationKind, PageDef, PasswordReset, RefundRequest,
  StructureSnapshot,
  ResultConfirmation, Role, RoleDef, StaReferral, StructuralChange, StructuralChangeKind, User, WatchlistEntry, WithdrawalRequest, WithdrawalWindowConfig,
} from '../types'

const seed = loadSeed()

/** Demo identity per role for the header role switcher. 'guest', 'guest1' and
 *  'guest2' are all public/unauthenticated shells — anonymous, so there is no
 *  demo user to look up. */
export const ROLE_DEMO_USER: Record<Exclude<Role, 'guest' | 'guest1' | 'guest2'>, string> = {
  buyer: 'u-buyer-1',
  seller: 'u-seller-2',
  field_exec: 'u-field-1',
  exec_manager: 'u-exec-1',
  auction_manager: 'u-auction-1',
  finance_admin: 'u-fin-1',
  sub_admin: 'u-sub-1',
  super_admin: 'u-super-1',
  ceo: 'u-ceo-1',
}

export const ROLE_LABEL: Record<Role, string> = {
  guest: 'Guest',
  guest1: 'Guest 1',
  guest2: 'Guest 2',
  buyer: 'Buyer',
  seller: 'Seller',
  field_exec: 'Field Executive',
  exec_manager: 'Operation Manager',
  auction_manager: 'Auction Manager',
  finance_admin: 'Finance Administrator',
  sub_admin: 'Sub-Admin',
  super_admin: 'Super Admin',
  ceo: 'CEO / MD',
}

export const ROLE_HOME: Record<Role, string> = {
  guest: '/',
  guest1: '/home',
  guest2: '/g2',
  buyer: '/buyer',
  seller: '/seller',
  field_exec: '/field',
  exec_manager: '/exec',
  auction_manager: '/auction',
  finance_admin: '/finance',
  sub_admin: '/sub',
  super_admin: '/admin',
  ceo: '/ceo',
}

/* --------------------------- capability groups -----------------------------
   The role architecture shares a handful of screens across several roles on
   purpose, so a sale never waits on one person being at their desk. Declaring
   those groups once — rather than repeating role lists at each call site — is
   what keeps the permission model auditable. */

/** PUBLISH and EMD eligibility. Four roles hold the same powers; whoever acts
 *  is named in the audit entry. */
const PUBLISH_ROLES: Role[] = ['auction_manager', 'exec_manager', 'sub_admin', 'super_admin']
/** Pause · resume · extend, and raising a cancellation request. */
const AUCTION_FLOOR_ROLES: Role[] = ['auction_manager', 'sub_admin', 'super_admin']
/** Confirming a closed auction's results and referring a below-reserve lot. */
const RESULT_ROLES: Role[] = ['auction_manager', 'sub_admin', 'super_admin']
/** The pre-auction quality gate — approve, bypass, send back or reject a lot,
 *  verify a seller, close a handover. The Operation Manager runs it day to day
 *  and the Sub Admin does the same job when covering; both act directly, and
 *  every action is audited by name. */
const LOT_GATE_ROLES: Role[] = ['exec_manager', 'sub_admin', 'super_admin']
/** Broadcasting to a catalogue's participants. */
const ANNOUNCE_ROLES: Role[] = ['auction_manager', 'exec_manager', 'sub_admin', 'super_admin']
/** Putting a bid on the record, and escalating it as a void request. */
const SURVEILLANCE_ROLES: Role[] = ['auction_manager', 'sub_admin', 'super_admin']
/** Executing a money movement — verifying a deposit, paying a withdrawal,
 *  confirming a commission, forfeiting an EMD, returning a refund. Deliberately
 *  narrow: the Sub Admin *sees* every one of these and may recommend, but only
 *  Finance approves and processes. Super Admin holds it for support and
 *  recovery, never as a routine desk. */
const FINANCE_ROLES: Role[] = ['finance_admin', 'super_admin']
/** Who may put a gross weighment on the record on the platform's behalf. The
 *  figure decides the final invoice and any shortfall refund, so a buyer's own
 *  reading is a declaration: one of these has to witness it before Operations
 *  can close the handover against it. */
const WEIGHMENT_WITNESS_ROLES: Role[] = ['exec_manager', 'field_exec', 'sub_admin', 'super_admin']
/** The head of operations. Every Sub Admin account is identical — the same full
 *  menu and the same powers — so this is the whole of the access question for
 *  the supervisory screens; there is deliberately no per-account template. */
const SUB_ADMIN_ROLES: Role[] = ['sub_admin', 'super_admin']
/** Answering and closing a customer's ticket. */
const SUPPORT_ROLES: Role[] = ['sub_admin', 'exec_manager', 'super_admin']
/** Findings a Sub Admin cannot act on themselves, whatever they conclude: a
 *  bid, a ban and a live auction are Super Admin levers, so a "reverse this"
 *  verdict on one is a hand-off rather than an action. */
const REVERSAL_NEEDS_SUPER = ['bid.', 'auction.cancel', 'account.status', 'user.standing']
/** Clearing a CEO-threshold decision. The CEO signs; the Super Admin holds it
 *  for support and recovery, and a named delegate may sign while a delegation
 *  is running (see `canSignForCeo`). The record always names whoever actually
 *  decided, so a delegated signature is never mistaken for the CEO's own. */
const CEO_ROLES: Role[] = ['ceo', 'super_admin']

/** Where a decision goes back to when it is signed, refused or queried — the
 *  screen the requesting desk raised it from, never a generic inbox. */
export const CEO_REQUEST_HREF: Record<CeoApprovalKind, string> = {
  emd_forfeiture: '/finance/emd',
  refund: '/finance/refunds',
  fee_change: '/admin/finance',
  auction_publish: '/auction/schedule',
  permanent_ban: '/admin/blacklist',
  super_admin_account: '/admin/sub-admins',
  content_publish: '/admin/content',
}

/** Who may sign the CEO's queue right now. The CEO always; a named delegate
 *  while their delegation is still running; a Super Admin as our support and
 *  recovery role. Whoever it is, the record names them rather than the CEO. */
export function canSignForCeo(role: Role, userId: string | undefined, delegation: CeoDelegation | null, now: number): boolean {
  if (CEO_ROLES.includes(role)) return true
  if (!delegation || !userId || delegation.toUserId !== userId) return false
  return Date.parse(`${delegation.until}T23:59:59`) > now
}

/** True while a delegation is live — a lapsed one is left on the record rather
 *  than deleted, so "who could sign last week" is still answerable. */
export const delegationActive = (d: CeoDelegation | null, now: number): boolean =>
  !!d && Date.parse(`${d.until}T23:59:59`) > now

/** Canonical display order for the role switcher(s). Single source of truth —
 *  consumed by the Chrome header switcher and the Guest1 homepage switcher so
 *  the list can't drift between them, and used to validate the persisted role
 *  read back from localStorage. */
export const ROLE_ORDER: Role[] = [
  'guest', 'guest1', 'guest2', 'buyer', 'seller', 'field_exec', 'exec_manager', 'auction_manager', 'finance_admin', 'sub_admin', 'super_admin', 'ceo',
]

/** Demo sign-in credentials for the manager Login page: user ID → role.
 *  Every account uses DEMO_PASSWORD. */
export const DEMO_LOGINS: Record<string, Exclude<Role, 'guest' | 'guest1' | 'guest2'>> = {
  'buy@gmail.com': 'buyer',
  'sell@gmail.com': 'seller',
  'field@gmail.com': 'field_exec',
  'executive@gmail.com': 'exec_manager',
  'auction@gmail.com': 'auction_manager',
  'finance@gmail.com': 'finance_admin',
  'sub@gmail.com': 'sub_admin',
  'ceo@gmail.com': 'ceo',
}
export const DEMO_PASSWORD = 'Admin@123'

/** Break-glass developer account. Deliberately absent from DEMO_LOGINS, from the
 *  quick-access grid on the sign-in page and from every public page: nobody at
 *  ferroBid, and neither side of the market, is told this role exists. It is how
 *  we get back in when something has to be fixed in an emergency, so it is the
 *  one account with a real password check — the exact pair below, or the attempt
 *  fails as an unknown user ID and gives nothing away. Keep both values out of
 *  anything user-facing. */
const BREAK_GLASS_ID = 'super@gmail.com'
const BREAK_GLASS_PASSWORD = 'FamySys@123'

/** Password enforcement on the Login page. OFF for now — any password (or none)
 *  signs in as long as the user ID is known. Flip to true to require
 *  DEMO_PASSWORD again. */
export const ENFORCE_LOGIN_PASSWORD = false

const BOT_IDS = ['u-buyer-2', 'u-buyer-3', 'u-buyer-5', 'u-buyer-6', 'u-buyer-7']

const emptyLiftingChecklist = (): LiftingChecklistItem[] => [
  { key: 'vehicle_at_weighbridge', label: 'Vehicle at weighbridge', done: false },
  { key: 'loading_complete', label: 'Loading complete', done: false },
  { key: 'gross_weighment', label: 'Gross weighment recorded', done: false },
]

/** Default withdrawal processing window — Mon–Fri, 11:00–14:00 IST. */
export const DEFAULT_WITHDRAWAL_WINDOW: WithdrawalWindowConfig = {
  days: [1, 2, 3, 4, 5],
  startHour: 11, startMinute: 0, endHour: 14, endMinute: 0,
}

/** Platform-wide money rules. One set of numbers, read everywhere a rate or a
 *  threshold is needed — the seller's commission on Settlement, the tax on a
 *  delivery order, the point at which a forfeiture leaves Finance for the CEO.
 *  Editable by Super Admin on Financial config; nothing recomputes a rate
 *  locally, so a rate can never mean two different things on two screens. */
export const DEFAULT_FINANCE_CONFIG: FinanceConfig = {
  emdPct: 5, emdMin: 10_000, emdCap: 500_000, emdReleaseHours: 24,
  gstPct: 18, tcsPct: 1,
  bidValidityDays: 7, paymentWindowDays: 7, groundRentPerDayPerMt: 50,
  buyerPremiumPct: 1, sellerCommissionPct: 10, listingFeePerLot: 0,
  /* Client Decision 2 — the business has not set these yet. They are sized to
     the volumes this build actually carries, so the rule bites on real records
     rather than lying dormant: the largest single EMD here is ₹3.2L, the
     largest unpublished catalogue ₹56L. Raise them once the queue proves
     manageable; they live here, not in code, precisely so they can be tuned. */
  ceoForfeitureFrom: 150_000,
  ceoRefundFrom: 250_000,
  ceoPublishValueFrom: 5_000_000,
  withdrawalSecondSignatureFrom: 200_000,
}

/** What each money rule is called in the business, rather than in the config
 *  object. Change history and the audit trail are read by people who never see
 *  this file, so "emdPct" is not an answer to "what changed". */
export const FINANCE_FIELD_LABEL: Record<keyof FinanceConfig, string> = {
  emdPct: 'Default EMD (% of lot value)', emdMin: 'Minimum EMD', emdCap: 'EMD cap per lot',
  emdReleaseHours: 'EMD auto-release after close (hours)',
  gstPct: 'GST on scrap (%)', tcsPct: 'TCS u/s 206C(1H) (%)',
  bidValidityDays: 'Bid validity (days)', paymentWindowDays: 'Payment window after award (days)',
  groundRentPerDayPerMt: 'Ground rent (per day per MT)',
  buyerPremiumPct: 'Buyer premium (%)', sellerCommissionPct: 'Seller commission (%)', listingFeePerLot: 'Listing fee per lot',
  ceoForfeitureFrom: 'EMD forfeiture needs the CEO from', ceoRefundFrom: 'Refund needs the CEO from',
  ceoPublishValueFrom: 'Auction publish needs the CEO from', withdrawalSecondSignatureFrom: 'Withdrawal needs a second Finance user from',
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Mask a bank account number immediately — only the last 4 digits are ever
 *  persisted or displayed again after initial entry. */
const maskAccountNumber = (accountNumber: string): { last4: string; masked: string } => {
  const digits = accountNumber.replace(/\D/g, '')
  const last4 = digits.slice(-4).padStart(4, '•')
  const groups = Math.max(0, Math.ceil(Math.max(0, digits.length - 4) / 4))
  return { last4, masked: `${'•••• '.repeat(groups)}${last4}` }
}

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
const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return Math.abs(h)
}
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
  const closed = new Set(seed.catalogues.filter((c) => c.status === 'closed').map((c) => c.id))
  return seed.lots.map((l) => {
    if (l.sellerDecision) return l
    if (!closed.has(l.catalogueId)) return l
    if (l.status !== 'sold' && l.status !== 'sta') return l
    const h = hash(l.id)
    // A seller accepts most prices. They reject where the lot cleared below
    // their reserve, which is exactly what "subject to approval" means.
    if (l.status === 'sta') return h % 3 === 0 ? l : { ...l, sellerDecision: 'rejected' as const }
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
    // Cycle the states so every tab on the Commission screen has rows: two
    // confirmed (income the P&L can recognise), one recorded and waiting, one
    // queried, one left entirely unpaid so there is something to chase.
    const state = i % 5
    i += 1
    if (state === 4) continue // owed, nothing recorded — the chase case
    const mode: CommissionSettlement['mode'] = state === 1 ? 'emd' : 'transfer'
    const at = minutesAgo(60 * (12 + i * 9))
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
        ? { confirmedBy: 'u-fin-1', confirmedAt: minutesAgo(60 * (6 + i * 7)) }
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
    .slice(0, 5)
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

export interface Toast {
  id: string
  kind: 'success' | 'info' | 'warning' | 'danger'
  title: string
  body?: string
}

interface State {
  now: number
  theme: 'light' | 'dark'
  role: Role
  currentUser: User | null
  paused: Record<string, boolean> // catalogueId → paused

  catalogues: Catalogue[]
  lots: Lot[]
  users: User[]
  bids: Bid[]
  wallets: typeof seed.wallets
  inspectionReports: InspectionReport[]
  notifications: AppNotification[]
  termsSets: typeof seed.termsSets
  deliveryOrders: DeliveryOrder[]
  demandDrafts: DemandDraft[]
  announcements: typeof seed.announcements
  disputes: Dispute[]
  auditEvents: typeof seed.auditEvents
  selections: BuyerLotSelection[]
  /** Catalogue-level "interested" marker — separate from `selections` (interest vs. committed-to-bid). */
  watchlist: WatchlistEntry[]
  autoBids: AutoBidSetting[]
  inspectionSlots: typeof seed.inspectionSlots
  bankAccounts: BankAccount[]
  depositClaims: DepositClaim[]
  withdrawalRequests: WithdrawalRequest[]
  companyBankAccounts: CompanyBankAccount[]
  withdrawalWindow: WithdrawalWindowConfig
  emdExemptionRequests: EmdExemptionRequest[]

  /* --- Sub Admin: the supervisory layer over everyone else's work ---
     None of this gates a functional role. The operational roles act first and
     their action takes effect immediately; what lives here is the review after
     the fact, who picked a piece of work up, and what the shift was told. */
  /** Verdicts on operational actions, held against the audit entry. */
  actionReviews: ActionReview[]
  /** Work item id → the Sub Admin who claimed it. Work on this desk is divided
   *  by assignment, never by capability — every account can do everything. */
  workClaims: Record<string, { byId: string; at: string }>
  /** Shift notes, newest first. */
  handoverNotes: HandoverNote[]

  /* --- auction floor (Auction Manager workspace) --- */
  cancellationRequests: CancellationRequest[]
  bidVoidRequests: BidVoidRequest[]
  resultConfirmations: ResultConfirmation[]
  staReferrals: StaReferral[]

  /* --- Finance workspace --- */
  /** Platform-wide money rules. Read by every rate/tax/threshold calculation. */
  financeConfig: FinanceConfig
  refundRequests: RefundRequest[]
  emdForfeitures: EmdForfeiture[]
  invoices: Invoice[]
  bankStatementLines: BankStatementLine[]
  /** Decisions above a CEO threshold, parked until they are signed. */
  ceoApprovals: CeoApprovalRequest[]
  /** Who may sign that queue besides the CEO, and until when. One at a time. */
  ceoDelegation: CeoDelegation | null

  /* --- Super Admin: the shape of the platform ---
     Structure, not business data. Every one of these can be changed and rolled
     back from Change history; nothing below ever touches an auction, a bid, a
     payment or an audit entry. */
  /** Every role that exists, including removed ones — kept, never deleted. */
  roleRegistry: RoleDef[]
  /** The navigation itself. Chrome and the sub-nav render this. */
  pageRegistry: PageDef[]
  /** Every structural change in time order, with the snapshot to undo it. */
  structuralChanges: StructuralChange[]
  /** Passwords issued by support, shown once. */
  passwordResets: PasswordReset[]
  /** Copy drafted by Sub Admins, waiting on us to publish it. */
  contentDrafts: ContentDraft[]
  /** The controlled vocabularies every catalogue is built from. */
  masterCategories: MasterCategory[]
  masterUoms: MasterUom[]
  masterYards: MasterYard[]

  termsAccepted: Record<string, string> // catalogueId → version accepted (per current session)
  commissionSettlements: CommissionSettlement[]
  toasts: Toast[]
  lastWonLotId: string | null // confetti trigger

  /* --- engine --- */
  tick: () => void

  /* --- session --- */
  toggleTheme: () => void
  switchRole: (role: Role) => void
  signIn: (username: string, password: string) => { ok: boolean; role?: Role; error?: string }
  login: (phone: string) => void
  logout: () => void
  /** Creates a brand-new account and signs it in — the only place a `bidderId`
   *  (role 'buyer') or `sellerId` (role 'seller') is ever assigned, once, for
   *  the lifetime of the account. */
  registerAccount: (input: {
    name: string; email: string; phone: string; firm: string; role: 'buyer' | 'seller'; city?: string; gstin?: string
  }) => User

  /* --- buyer --- */
  toggleShortlist: (catalogueId: string, lotId: string) => void
  toggleWatchlist: (catalogueId: string) => void
  fundEmd: (catalogueId: string, lotIds: string[], method: string) => boolean
  placeBid: (lotId: string, rate: number, bidderId?: string, type?: BidType) => { ok: boolean; error?: string }
  setAutoBid: (lotId: string, maxRate: number, active: boolean) => void
  topUpWallet: (amount: number, method: string) => void
  acceptTerms: (catalogueId: string) => void
  bookInspectionSlot: (catalogueId: string, date: string, window: string, persons: number) => void
  submitKyc: () => void
  advanceDeliveryOrder: (doId: string) => void
  toggleLiftingChecklistItem: (doId: string, key: LiftingChecklistItem['key']) => void
  recordWeighment: (doId: string, qty: number) => void
  completeLifting: (doId: string) => void
  registerBankAccount: (bankName: string, accountNumber: string, ifsc: string, accountHolderName: string) => void
  submitDepositClaim: (amount: number, utr: string, transferDate: string, proofFilename?: string) => { ok: boolean; error?: string }
  requestWithdrawal: (amount: number, bankAccountId: string) => { ok: boolean; error?: string }
  cancelWithdrawal: (id: string) => void
  requestEmdExemption: (catalogueId: string, reason: string) => { ok: boolean; error?: string }

  /* --- seller --- */
  /** Gated on seller verification — an unverified account cannot put material
   *  in front of buyers. Hands the lot to Operations on success. */
  createLot: (lot: Partial<Lot>) => { ok: boolean; error?: string; lotId?: string }

  /* --- ops / admin --- */
  submitInspection: (lotId: string, report: Omit<InspectionReport, 'id' | 'lotId' | 'date'>, outcome: 'verified' | 'flagged' | 'rejected') => void
  setLotStatus: (lotId: string, status: LotStatus) => void
  /** The quality gate: approve, send back for re-inspection, or reject a lot.
   *  Every outcome is audited by name and the seller is told — this is the one
   *  decision that puts material in front of buyers, and it used to write
   *  nothing at all. Reason is mandatory on anything but a plain approval. */
  decideLot: (lotId: string, outcome: 'approved' | 'flagged' | 'rejected', reason?: string) => { ok: boolean; error?: string }
  /** Seller KYC. Held by the Operation Manager and the Sub Admin — four screens
   *  used to offer this and none of them changed anything. */
  decideSellerKyc: (userId: string, approve: boolean, reason?: string) => { ok: boolean; error?: string }
  /** Operations closes the delivery against the weighment-final quantity. */
  confirmHandover: (doId: string, note?: string) => { ok: boolean; error?: string }
  setSellerLotDecision: (lotId: string, decision: 'accepted' | 'rejected' | null) => void
  recordCommissionSettlement: (catalogueId: string, amount: number, mode: 'transfer' | 'emd', reference?: string) => void
  publishCatalogue: (cat: Catalogue, lotIds: string[], overrides: Record<string, Partial<Lot>>) => void
  assignCatalogue: (catalogueId: string, fieldExecId: string) => void
  /** **Bypass** — accept a trusted seller's lot without a yard visit. Not gated
   *  behind a second approval by design; controlled instead by a typed reason,
   *  an audit entry at warning severity and a marker that stays on the lot. */
  waiveInspection: (lotId: string, managerId: string, reason: string) => { ok: boolean; error?: string }
  publishDraftCatalogue: (catalogueId: string, mode: 'now' | 'schedule') => { ok: boolean; error?: string }
  pauseCatalogue: (catalogueId: string, reason?: string) => void
  resumeCatalogue: (catalogueId: string) => void
  extendCatalogue: (catalogueId: string, minutes: number, reason?: string) => void
  cancelCatalogue: (catalogueId: string) => void
  voidBid: (bidId: string) => void

  /* --- auction floor: Auction Manager acts, Super Admin closes --- */
  /** All four instants of a sale, set together: a sale is an EMD window
   *  followed by a bidding window, and moving one without the other is how a
   *  catalogue ends up open for bids nobody could fund. */
  rescheduleCatalogue: (catalogueId: string, schedule: {
    emdOpensAt: string; emdDeadline: string; startsAt: string; endsAt: string; antiSnipeMinutes: number
  }) => { ok: boolean; error?: string }
  returnCatalogueToOps: (catalogueId: string, comments: string) => void
  requestCancellation: (catalogueId: string, reason: string) => { ok: boolean; error?: string }
  decideCancellationRequest: (id: string, approve: boolean, note?: string) => void
  flagBid: (bidId: string, reason: string, notes?: string) => void
  requestBidVoid: (requestId: string, note?: string) => void
  dismissBidFlag: (requestId: string, note?: string) => void
  decideBidVoidRequest: (id: string, approve: boolean, note?: string) => void
  sendAnnouncement: (input: { scope: 'platform' | 'catalogue'; catalogueId?: string; title: string; body: string; severity: Announcement['severity'] }) => { ok: boolean; error?: string }
  confirmAuctionResults: (catalogueId: string) => { ok: boolean; error?: string }
  referStaLot: (lotId: string, note: string) => void
  setUserStanding: (userId: string, standing: User['standing'], reason?: string) => void
  issueDemandDraft: (doId: string, dd: { ddNumber: string; issuingBank: string; amount: number }) => void
  verifyBankAccount: (id: string) => void
  rejectBankAccount: (id: string, reason?: string) => void
  approveDepositClaim: (id: string) => void
  rejectDepositClaim: (id: string, reason?: string) => void
  approveWithdrawal: (id: string) => void
  processWithdrawal: (id: string) => void
  failWithdrawal: (id: string, reason?: string) => void
  approveEmdExemption: (id: string) => void
  rejectEmdExemption: (id: string, reason?: string) => void
  setWithdrawalWindow: (config: WithdrawalWindowConfig) => void
  setCompanyBankAccounts: (accounts: CompanyBankAccount[]) => void

  /* --- Finance Administrator --- */
  setFinanceConfig: (patch: Partial<FinanceConfig>) => void
  /** Finance's side of the seller's Settlement page. */
  confirmCommissionSettlement: (id: string, bankLineId?: string) => { ok: boolean; error?: string }
  queryCommissionSettlement: (id: string, note: string) => void
  /** Buyer paid for a won lot — releases the delivery order to Operations. */
  confirmBuyerPayment: (doId: string, method: string, ref: string) => { ok: boolean; error?: string }
  flagOverduePayment: (doId: string, note: string) => void
  /** EMD taken from a buyer who breached the payment window. Above the CEO
   *  threshold this parks as a request rather than applying. */
  raiseEmdForfeiture: (lotId: string, buyerId: string, reason: string) => { ok: boolean; error?: string; awaitingCeo?: boolean }
  waiveEmdForfeiture: (id: string, reason: string) => void
  raiseRefund: (input: { userId: string; amount: number; source: RefundSource; reason: string; lotId?: string; catalogueId?: string; disputeId?: string }) => { ok: boolean; error?: string; awaitingCeo?: boolean }
  decideRefund: (id: string, approve: boolean, note?: string) => void
  processRefund: (id: string) => { ok: boolean; error?: string }
  issueInvoice: (input: { kind: Invoice['kind']; partyId: string; catalogueId: string; lotId?: string; doId?: string; taxable: number; gst: number; tcs: number; note?: string }) => Invoice | null
  reissueInvoice: (id: string, note: string) => void
  cancelInvoice: (id: string, note: string) => void
  matchBankLine: (lineId: string, matchedTo: string, kind: BankStatementLine['matchedKind']) => void
  unmatchBankLine: (lineId: string) => void
  flagBankBreak: (lineId: string, note: string) => void
  escalateBankBreak: (lineId: string) => void
  /* --- CEO / MD --- */
  /** Raised by whichever desk hit its own ceiling. Nothing it is holding takes
   *  effect until it is signed, and the requester keeps sight of it throughout. */
  requestCeoSignoff: (input: {
    kind: CeoApprovalKind; refId: string; amount: number; summary: string; reason: string; payload?: Partial<FinanceConfig>
  }) => CeoApprovalRequest | null
  /** Signed by the CEO, by a named delegate while a delegation is running, or
   *  by a Super Admin for support and recovery. Approving completes the
   *  movement it was holding; refusing releases it with the reason attached. */
  decideCeoApproval: (id: string, approve: boolean, note?: string) => void
  /** Neither a yes nor a no: the item stays in the queue and the requester is
   *  asked a question. A refusal is never the way to ask for more detail. */
  requestCeoInfo: (id: string, note: string) => void
  /** Hand the whole queue to a named person until a set date. */
  delegateCeoApprovals: (toUserId: string, until: string, note?: string) => { ok: boolean; error?: string }
  clearCeoDelegation: () => void

  /* --- Super Admin: structure ---
     A role must exist before anyone can hold it, and a page must belong to a
     role before anyone can open it — so roles come first and pages second, in
     that order, on the menu and here. */
  addRole: (input: { label: string; home?: string; note?: string }) => { ok: boolean; error?: string; key?: string }
  /** Removing suspends every account holding the role. It never deletes one. */
  removeRole: (key: string, reason: string) => { ok: boolean; error?: string }
  duplicateRole: (key: string, label: string) => { ok: boolean; error?: string; key?: string }
  restoreRole: (key: string) => { ok: boolean; error?: string }
  renamePage: (id: string, label: string) => { ok: boolean; error?: string }
  setPageHidden: (id: string, hidden: boolean) => { ok: boolean; error?: string }
  movePage: (id: string, direction: -1 | 1) => { ok: boolean; error?: string }
  /** Attach a copy of a page to another role's menu, or detach one we added. */
  attachPage: (id: string, roleKey: string) => { ok: boolean; error?: string }
  detachPage: (id: string) => { ok: boolean; error?: string }
  addSubPage: (roleKey: string, label: string, to: string) => { ok: boolean; error?: string }
  /** Put the structure back as it stood immediately before one change. */
  undoStructuralChange: (id: string) => { ok: boolean; error?: string }
  /** Put the structure back as it stood at a point in time. */
  restoreStructureTo: (id: string) => { ok: boolean; error?: string }

  /* --- Super Admin: people --- */
  createSubAdmin: (input: { name: string; username: string; email: string; phone: string; city: string }) =>
    { ok: boolean; error?: string; password?: string; userId?: string }
  setAccountStatus: (userId: string, status: AccountStatus, reason?: string) => { ok: boolean; error?: string }
  /** Correct an account's own details — the "edit any account" half of the
   *  accounts power a Sub Admin and a Super Admin share. */
  updateUserDetails: (userId: string, patch: Partial<Pick<User, 'name' | 'firm' | 'email' | 'phone' | 'city' | 'gstin'>>) =>
    { ok: boolean; error?: string }
  /** Auto-generate a strong password, or set one manually. Shown once; the user
   *  is prompted to keep it or set their own at next sign-in. */
  resetUserPassword: (userId: string, mode: 'auto' | 'manual', manualPassword?: string) =>
    { ok: boolean; error?: string; password?: string }

  /* --- Super Admin: content, drafted by a Sub Admin --- */
  publishContent: (id: string) => { ok: boolean; error?: string }
  returnContent: (id: string, note: string) => { ok: boolean; error?: string }

  /* --- Super Admin: master data --- */
  addMasterCategory: (label: string) => { ok: boolean; error?: string }
  addMasterUom: (code: string, label: string, precision: string) => { ok: boolean; error?: string }
  upsertMasterYard: (yard: Omit<MasterYard, 'builtIn' | 'active'> & { id?: string }) => { ok: boolean; error?: string }
  setMasterActive: (kind: 'category' | 'uom' | 'yard', id: string, active: boolean) => { ok: boolean; error?: string }
  addTermsVersion: (termsSetId: string, note: string) => { ok: boolean; error?: string }
  /** Rename what a category or unit is *called*. The key and the code never
   *  move — every record already using them has to keep resolving. */
  renameMasterEntry: (kind: 'category' | 'uom', id: string, label: string) => { ok: boolean; error?: string }

  /* --- misc --- */
  pushToast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
  notify: (n: { userId: string | null; kind: NotificationKind; title: string; body: string; href?: string }) => void
  markNotificationsRead: () => void
  createDispute: (subject: string, category: Dispute['category'], body: string, lotId?: string) => void
  clearWinFlag: () => void

  /* --- Sub Admin: supervision, support and the shift ---
     The Sub Admin is the head of operations, not a narrower version of one.
     Every account holds the same full menu; what divides the work is which
     items each one has claimed, which is why claiming lives here and a
     permission template does not. */
  /** Pick a piece of work up, or put it back on the board for someone else. */
  claimWorkItem: (itemId: string) => { ok: boolean; error?: string }
  releaseWorkItem: (itemId: string) => void
  /** Confirm, question or reverse something an operational role already did.
   *  A verdict never rewinds the original action — the roles that hold the
   *  levers do that — it records the finding and, where the fix belongs to
   *  someone else, hands it on. */
  reviewAction: (eventId: string, verdict: ActionVerdict, note: string) =>
    { ok: boolean; error?: string; escalatedTo?: Role }
  /** Reply on a support ticket, as the desk rather than as a person. */
  replyToDispute: (id: string, body: string) => { ok: boolean; error?: string }
  /** Take a ticket, so two people do not answer the same customer. */
  assignDispute: (id: string) => void
  /** Close a ticket. Where the outcome owes the customer money this raises the
   *  refund for Finance and leaves the ticket open until Finance has paid it —
   *  a Sub Admin decides what is fair, Finance moves the money. */
  resolveDispute: (id: string, outcome: DisputeOutcome, resolution: string, amount?: number) =>
    { ok: boolean; error?: string; refundRaised?: boolean }
  /** Draft a change to public copy. Nothing here is public until a Super Admin
   *  presses Publish — and no number is ever typed into it. */
  submitContentDraft: (input: { page: string; section: string; before: string; after: string; needsCeo: boolean }) =>
    { ok: boolean; error?: string }
  /** Leave the next shift what they need to know. */
  saveHandoverNote: (body: string) => { ok: boolean; error?: string }
  audit: (action: string, target: string, detail: string, severity?: 'info' | 'warning' | 'critical') => void
}

/* ---------------------- the platform's own structure -----------------------
   Roles and pages are seeded from the shipped defaults rather than from JSON,
   so the Super Admin's Roles and Page manager screens open on exactly what the
   app is actually rendering. Every later edit is a diff against this. */

const PLATFORM_EPOCH = new Date(Date.now() - 90 * 24 * 3600_000).toISOString()

/** A role key from a typed name — lower case, hyphens, nothing exotic, because
 *  it ends up in a route. */
const slugKey = (label: string) =>
  label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32)

/** The pages a brand-new role starts with. A role with no menu is a role
 *  nobody can use, so one is created with it — and the record it must retain is
 *  created too, rather than left to be remembered later. */
const DEFAULT_NEW_ROLE_PAGES: { to: string; label: string; retained?: boolean }[] = [
  { to: '@home', label: 'Dashboard' },
  { to: '/browse', label: 'Browse' },
  { to: '/admin/audit', label: 'My activity', retained: true },
]

/** Routes that are somebody's way into a running sale. While an auction is
 *  live these cannot be hidden from the role that runs it. */
const isLiveAuctionRoute = (p: { to: string }) =>
  p.to === '/auction' || p.to === '/auction/live' || p.to === '/auction/rooms' || p.to.startsWith('/bidding')

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
/** A strong password, shown once. Deliberately excludes the character pairs
 *  people mis-read down a phone line — 0/O, 1/l/I — because that is exactly how
 *  this one gets delivered. */
function generatePassword(): string {
  const pick = (n: number) => Array.from({ length: n }, () => PASSWORD_ALPHABET[Math.floor(Math.random() * PASSWORD_ALPHABET.length)]).join('')
  return `${pick(4)}-${pick(4)}-${pick(4)}`
}

const fmtStamp = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

function seedRoleRegistry(): RoleDef[] {
  return ROLE_ORDER.filter((r) => r !== 'guest1' && r !== 'guest2').map((key) => ({
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

const ROLE_KEY = 'fb.demo.role'

/** The demo role has to survive a refresh. HashRouter keeps the URL, so a role
 *  that resets to 'buyer' on load leaves the switcher chip contradicting the
 *  page you're actually looking at (refresh on /g2 → chip reads "Buyer"). */
const storedRole: Role = (() => {
  try {
    const r = localStorage.getItem(ROLE_KEY) as Role | null
    if (r && ROLE_ORDER.includes(r)) return r
  } catch {
    /* private mode — fall through to the default */
  }
  return 'buyer'
})()

function rememberRole(role: Role) {
  try {
    localStorage.setItem(ROLE_KEY, role)
  } catch {
    /* private mode — role just won't survive the refresh */
  }
}

/** Demo user backing a role; the anonymous public shells have none. */
const demoUserFor = (role: Role) =>
  role === 'guest' || role === 'guest1' || role === 'guest2'
    ? null
    : seed.users.find((u) => u.id === ROLE_DEMO_USER[role]) ?? null

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
  /* ---------- internal helpers (operate via set/get) ---------- */

  const wallet = (userId: string) => get().wallets.find((w) => w.userId === userId)

  /** An approved exemption reopens EMD funding for that buyer on that
   *  catalogue despite `emdWindowClosed` — the whole point of the request. */
  const hasApprovedEmdExemption = (buyerId: string, catalogueId: string) =>
    get().emdExemptionRequests.some((r) => r.buyerId === buyerId && r.catalogueId === catalogueId && r.status === 'approved')

  const ensureWallet = (userId: string) => {
    if (!wallet(userId)) {
      set((s) => ({ wallets: [...s.wallets, { userId, balance: 0, emdLocked: 0, ledger: [] }] }))
    }
    return wallet(userId)!
  }

  /** Parks a decision that is above a configured rupee threshold. It does not
   *  complete here — it completes when it is signed, in `decideCeoApproval`. */
  const raiseCeoApproval = (kind: CeoApprovalRequest['kind'], refId: string, amount: number, summary: string, reason: string) => {
    const s = get()
    const record: CeoApprovalRequest = {
      id: uid('ceo'), kind, refId, amount, summary, reason,
      requestedBy: s.currentUser?.id ?? 'system',
      requestedAt: new Date(s.now).toISOString(),
      status: 'pending',
    }
    set((st) => ({ ceoApprovals: [record, ...st.ceoApprovals] }))
    notifyRole('ceo', {
      kind: 'system',
      title: 'Needs your signature', body: `${summary} — ${reason}`, href: '/ceo/approvals',
    })
    /* A named delegate is holding the queue right now — they are the person who
       can actually sign, so they are told as well as the CEO. */
    const del = get().ceoDelegation
    if (delegationActive(del, get().now) && del) {
      get().notify({
        userId: del.toUserId, kind: 'system',
        title: 'Needs a signature — you hold the CEO queue',
        body: `${summary} — ${reason}`, href: '/ceo/approvals',
      })
    }
    /* The Super Admin holds the same queue for support and recovery, so it is
       never invisible if the CEO is unreachable and no delegate is named. */
    notifyRole('super_admin', {
      kind: 'system',
      title: 'Awaiting sign-off', body: `${summary} — ${reason}`, href: '/admin/control-tower',
    })
    return record
  }

  /** Called after any decision that can be the *last* one a catalogue was
   *  waiting on. A draft whose every lot is approved is ready to go to market —
   *  which nothing announced, so an assembled sale could sit unpublished simply
   *  because the desk that presses Publish never learned it could. */
  function announceCatalogueReady(catalogueId: string | null) {
    if (!catalogueId) return
    const s = get()
    const cat = s.catalogues.find((c) => c.id === catalogueId)
    if (!cat || cat.status !== 'draft') return
    const catLots = s.lots.filter((l) => l.catalogueId === catalogueId)
    if (catLots.length === 0 || !catLots.every((l) => l.status === 'approved')) return
    const reserveValue = catLots.reduce((sum, l) => sum + l.reserveRate * l.indicativeQty, 0)
    const needsCeo = reserveValue >= s.financeConfig.ceoPublishValueFrom
    const signed = s.ceoApprovals.some(
      (a) => a.kind === 'auction_publish' && a.refId === catalogueId && a.status === 'approved')
    get().audit('catalogue.ready', cat.code,
      `Every lot approved — ${inr(reserveValue)} at reserve, ready to publish${needsCeo && !signed ? ' once the CEO signs' : ''}`)
    notifyRole(PUBLISH_ROLES, {
      kind: 'system', title: `${cat.code} is ready to publish`,
      body: `${catLots.length} lot${catLots.length === 1 ? '' : 's'} approved · ${inr(reserveValue)} at reserve.${needsCeo && !signed ? ` Above the ${inr(s.financeConfig.ceoPublishValueFrom)} threshold — send it for the CEO's signature first.` : ''}`,
      href: '/auction/schedule',
    })
  }

  /* ---------- Super Admin helpers ----------
     Structure changes are the one family of operations in this store where the
     *previous* state matters as much as the next one, because they have to be
     reversible without a release. Every one of them goes through these three. */

  /** Only our role changes the shape of the platform. Returned rather than
   *  thrown so the calling screen can say so in words. */
  const requireSuperAdmin = (): { ok: false; error: string } | null =>
    get().role === 'super_admin' ? null : { ok: false, error: 'Only a Super Admin can change the shape of the platform' }

  /** The platform's shape right now — captured *before* a change so undoing it
   *  is exact. Roles, menus, the vocabularies and the public copy: everything
   *  that can be rebuilt without touching a record of something that happened.
   *  Auctions, bids, payments, invoices and audit entries are deliberately not
   *  in here and never will be. */
  const structureSnapshot = (): StructureSnapshot => {
    const s = get()
    return {
      roles: s.roleRegistry, pages: s.pageRegistry,
      categories: s.masterCategories, uoms: s.masterUoms, yards: s.masterYards,
      drafts: s.contentDrafts,
    }
  }

  /** Put a snapshot back. One place, so undo and restore-to-a-point can never
   *  disagree about what rollback covers. */
  const applySnapshot = (snap: StructureSnapshot) => ({
    roleRegistry: snap.roles, pageRegistry: snap.pages,
    masterCategories: snap.categories, masterUoms: snap.uoms, masterYards: snap.yards,
    contentDrafts: snap.drafts,
  })

  const roleLabelFor = (key: string) =>
    get().roleRegistry.find((r) => r.key === key)?.label ?? key

  /** A role cannot be removed out from under a sale it is running. */
  const liveAuctionsOwnedBy = (key: string) => {
    const runsAuctions = ['auction_manager', 'exec_manager', 'sub_admin'].includes(key)
    return runsAuctions ? get().catalogues.filter((c) => c.status === 'live') : []
  }

  const recordStructural = (
    kind: StructuralChangeKind, target: string, summary: string,
    before: string | null, after: string | null,
    snapshot?: StructureSnapshot,
  ) => {
    set((st) => ({
      structuralChanges: [{
        id: uid('sc'), at: new Date(st.now).toISOString(), byId: st.currentUser?.id ?? 'system',
        kind, target, summary, before, after, snapshot,
      }, ...st.structuralChanges],
    }))
  }

  /** Moves EMD out of the buyer's held balance for good. Only ever reached once
   *  a person has decided it — never from the tick, never from a close. */
  const applyForfeiture = (record: EmdForfeiture) => {
    const s = get()
    const lot = s.lots.find((l) => l.id === record.lotId)
    ensureWallet(record.buyerId)
    set((st) => ({
      wallets: st.wallets.map((w) =>
        w.userId === record.buyerId
          ? {
              ...w,
              emdLocked: Math.max(0, w.emdLocked - record.amount),
              ledger: [{
                id: uid('led'), at: new Date(st.now).toISOString(), type: 'emd_forfeit' as const,
                amount: -record.amount, ref: record.id, lotId: record.lotId, catalogueId: record.catalogueId,
                note: `EMD forfeited — ${record.reason}`,
              }, ...w.ledger],
            }
          : w,
      ),
      // Forfeiting for non-payment is what puts a buyer on the watchlist.
      users: st.users.map((u) => (u.id === record.buyerId && u.standing === 'good' ? { ...u, standing: 'watchlist' as const, blacklistReason: `EMD forfeited on ${lot?.lotNo ?? record.lotId}` } : u)),
    }))
    get().audit('emd.forfeit', lot?.lotNo ?? record.lotId, `EMD of ${inr(record.amount)} forfeited — ${record.reason}`, 'critical')
    get().notify({
      userId: record.buyerId, kind: 'wallet', title: 'EMD forfeited',
      body: `${inr(record.amount)} held against ${lot?.lotNo ?? 'a lot'} has been forfeited. ${record.reason}`,
      href: '/buyer/wallet',
    })
  }

  const applyBid = (lotId: string, rate: number, bidderId: string, type: BidType): { ok: boolean; error?: string } => {
    const s = get()
    const lot = s.lots.find((l) => l.id === lotId)
    if (!lot) return { ok: false, error: 'Lot not found' }
    const cat = s.catalogues.find((c) => c.id === lot.catalogueId)
    if (!cat || cat.status !== 'live' || lot.status !== 'live') return { ok: false, error: 'Lot is not live' }
    if (s.paused[cat.id]) return { ok: false, error: 'Auction is paused by the administrator' }
    const isTender = cat.type === 'tender'
    // Sealed tender: exactly one offer per buyer per lot — no revision, no resubmission.
    if (isTender && s.bids.some((b) => b.lotId === lotId && b.bidderId === bidderId && b.status === 'valid')) {
      return { ok: false, error: 'You have already submitted an offer for this lot' }
    }
    // Tender offers aren't ranked against a visible current rate — only against the floor.
    const minRate = isTender ? lot.startRate : lot.currentRate == null ? lot.startRate : lot.currentRate + lot.increment
    if (rate < minRate) return { ok: false, error: `Minimum ${isTender ? 'offer' : 'next bid'} is ${inr(minRate)}/${lot.uom}` }

    const prevLeader = lot.leadingBidderId
    const bid: Bid = {
      id: uid('bid'), lotId, catalogueId: cat.id, bidderId, rate,
      at: new Date(s.now).toISOString(), type, status: 'valid',
    }

    // anti-snipe: a bid inside the last N minutes extends the lot by N minutes.
    // Tender lots have no visible countdown pressure to snipe, so they're exempt.
    let endsAt = lot.endsAt
    let extensions = lot.extensions
    if (!isTender) {
      const msLeft = Date.parse(lot.endsAt) - s.now
      if (msLeft < cat.antiSnipeMinutes * 60_000) {
        endsAt = new Date(Date.parse(lot.endsAt) + cat.antiSnipeMinutes * 60_000).toISOString()
        extensions += 1
      }
    }

    set((st) => ({
      bids: [...st.bids, bid],
      lots: st.lots.map((l) =>
        l.id === lotId
          ? { ...l, currentRate: rate, leadingBidderId: bidderId, bidCount: l.bidCount + 1, endsAt, extensions }
          : l,
      ),
    }))

    /* Sealed tender offers have no visible leader, so there is nothing to be
       "outbid" from. Everywhere else the buyer who just lost the lead is told —
       whoever they are. This used to fire only when the outbid buyer happened
       to be the signed-in user, so in a real sale nobody else ever learned they
       had been overtaken. */
    if (!isTender && prevLeader && prevLeader !== bidderId) {
      const bidder = get().users.find((u) => u.id === bidderId)
      get().notify({
        userId: prevLeader, kind: 'bid', title: `Outbid on ${lot.lotNo}`,
        body: `${bidder?.firm ?? 'Another bidder'} is leading at ${inr(rate)}/${lot.uom}.`,
        href: `/bidding/${cat.id}?lot=${lot.id}`,
      })
    }
    return { ok: true }
  }

  /** counter-bid from the current user's proxy when a rival takes the lead */
  const runProxyBids = () => {
    const s = get()
    const me = s.currentUser
    if (!me) return
    for (const ab of s.autoBids.filter((a) => a.active && a.buyerId === me.id)) {
      const lot = s.lots.find((l) => l.id === ab.lotId)
      if (!lot || lot.status !== 'live' || lot.leadingBidderId === me.id) continue
      const cat = s.catalogues.find((c) => c.id === lot.catalogueId)
      if (cat?.type === 'tender') continue // no auto-bid resolution on sealed tender lots
      const next = (lot.currentRate ?? lot.startRate - lot.increment) + lot.increment
      if (next <= ab.maxRate) applyBid(lot.id, next, me.id, 'auto')
    }
  }

  const runBots = () => {
    const s = get()
    for (const lot of s.lots) {
      if (lot.status !== 'live' || !lot.catalogueId) continue
      const cat = s.catalogues.find((c) => c.id === lot.catalogueId)
      if (!cat || cat.status !== 'live' || s.paused[cat.id] || cat.type === 'tender') continue
      const msLeft = Date.parse(lot.endsAt) - s.now
      if (msLeft <= 0) continue
      // bots bid more aggressively as close approaches
      const minLeft = msLeft / 60_000
      const p = minLeft > 30 ? 0.0015 : minLeft > 5 ? 0.006 : minLeft > 1 ? 0.025 : 0.06
      if (Math.random() > p) continue
      const ceiling = lot.startRate * 1.35
      const next = (lot.currentRate ?? lot.startRate - lot.increment) + lot.increment * (1 + Math.floor(Math.random() * 2))
      if (next > ceiling) continue
      const rivals = BOT_IDS.filter((b) => b !== lot.leadingBidderId)
      const bot = rivals[Math.floor(Math.random() * rivals.length)]
      applyBid(lot.id, next, bot, 'bot')
    }
  }

  const closeDueLots = () => {
    const s = get()
    const me = s.currentUser
    for (const lot of s.lots) {
      if (lot.status !== 'live' || !lot.catalogueId) continue
      const cat = s.catalogues.find((c) => c.id === lot.catalogueId)!
      if (s.paused[cat.id]) continue
      if (Date.parse(lot.endsAt) - s.now > 0) continue

      // resolve: H1 ≥ reserve → sold; H1 < reserve → STA; no bids → unsold
      const status: LotStatus =
        lot.currentRate == null ? 'unsold' : lot.currentRate >= lot.reserveRate ? 'sold' : 'sta'
      set((st) => ({
        lots: st.lots.map((l) => (l.id === lot.id ? { ...l, status, resultH1Rate: l.currentRate } : l)),
      }))

      /* A lot resolves for *everyone* who took part in it, not only for whoever
         happens to be signed in. The winner's delivery order is what Finance
         collects against and what Operations lifts against, so gating any of
         this on the current session would sever the whole post-auction chain
         for every other buyer in the sale. */
      const winnerId = status === 'sold' ? lot.leadingBidderId : null
      const at = new Date(s.now).toISOString()

      if (winnerId) {
        ensureWallet(winnerId)
        const doId = uid('do')
        const materialValue = Math.round(lot.currentRate! * lot.indicativeQty)
        set((st) => ({
          deliveryOrders: [...st.deliveryOrders, {
            id: doId, lotId: lot.id, catalogueId: cat.id, buyerId: winnerId,
            stage: 'payment_pending' as const, h1Rate: lot.currentRate!, awardedQty: lot.indicativeQty, uom: lot.uom,
            materialValue,
            gstAmount: Math.round(materialValue * (st.financeConfig.gstPct / 100)),
            tcsAmount: Math.round(materialValue * (st.financeConfig.tcsPct / 100)),
            liftingChecklist: emptyLiftingChecklist(),
            paidAmount: 0, liftingBy: new Date(s.now + st.financeConfig.paymentWindowDays * 86400_000).toISOString(),
            createdAt: at,
          }],
        }))
        // confetti is for the person at the screen; the notification is for the winner
        if (me?.id === winnerId) set({ lastWonLotId: lot.id })
        get().notify({
          userId: winnerId, kind: 'bid', title: `You won ${lot.lotNo} 🎉`,
          body: `H1 confirmed at ${inr(lot.currentRate!)}/${lot.uom}. Your delivery order is raised — payment opens the lifting.`,
          href: '/buyer/auction-status',
        })
        // Money to collect is Finance's work the moment the lot closes.
        notifyRole('finance_admin', {
          kind: 'system', title: `Delivery order raised — ${lot.lotNo}`,
          body: `${get().users.find((u) => u.id === winnerId)?.firm ?? 'A buyer'} won at ${inr(lot.currentRate!)}/${lot.uom}. ${inr(materialValue)} before tax is due.`,
          href: '/finance/payments',
        })
      }

      // Every unsuccessful funder gets their EMD back the moment the lot closes.
      for (const sel of s.selections.filter((x) => x.catalogueId === cat.id && x.emdFundedLotIds.includes(lot.id))) {
        if (sel.buyerId === winnerId) continue
        ensureWallet(sel.buyerId)
        set((st) => ({
          wallets: st.wallets.map((w) =>
            w.userId === sel.buyerId
              ? {
                  ...w, balance: w.balance + lot.preBidEmd, emdLocked: Math.max(0, w.emdLocked - lot.preBidEmd),
                  ledger: [{ id: uid('led'), at, type: 'emd_release' as const, amount: lot.preBidEmd, ref: uid('EMDR').toUpperCase(), lotId: lot.id, catalogueId: cat.id, note: `EMD auto-released — ${lot.lotNo} (${cat.code})` }, ...w.ledger],
                }
              : w,
          ),
          selections: st.selections.map((x) =>
            x.buyerId === sel.buyerId && x.catalogueId === cat.id
              ? { ...x, emdFundedLotIds: x.emdFundedLotIds.filter((id) => id !== lot.id) }
              : x,
          ),
        }))
        get().notify({
          userId: sel.buyerId, kind: 'wallet', title: `EMD released — ${lot.lotNo}`,
          body: `${inr(lot.preBidEmd)} returned to your wallet (auction closed, not H1).`, href: '/buyer/wallet',
        })
      }
    }
    // catalogue lifecycle: go live / close when all lots resolved
    const wentLive: Catalogue[] = []
    const wentClosed: Catalogue[] = []
    set((st) => ({
      catalogues: st.catalogues.map((c) => {
        if (c.status === 'upcoming' && Date.parse(c.startsAt) <= st.now) {
          const s2 = get()
          for (const id of c.lotIds) {
            const l = s2.lots.find((x) => x.id === id)
            if (l && l.status === 'approved') {
              set((s3) => ({ lots: s3.lots.map((x) => (x.id === id ? { ...x, status: 'live' as LotStatus, endsAt: c.endsAt } : x)) }))
            }
          }
          wentLive.push(c)
          return { ...c, status: 'live' as const }
        }
        if (c.status === 'live') {
          const catLots = get().lots.filter((l) => l.catalogueId === c.id)
          if (catLots.length > 0 && catLots.every((l) => !['live', 'approved'].includes(l.status))) {
            wentClosed.push(c)
            return { ...c, status: 'closed' as const }
          }
        }
        return c
      }),
    }))

    /* A sale opening and a sale ending are both hand-offs, and both used to
       happen in silence. Going live is the seller's cue to watch; closing is the
       Auction Manager's cue to confirm the results, which is the step the
       seller's whole settlement waits on. */
    for (const c of wentLive) {
      get().audit('auction.open', c.code, `${c.title} opened on schedule — bidding is live`)
      if (c.sellerId) {
        get().notify({
          userId: c.sellerId, kind: 'lifecycle', title: `${c.code} is live`,
          body: `Bidding has opened on ${c.title}. You can follow it lot by lot.`,
          href: '/seller/monitor',
        })
      }
    }
    for (const c of wentClosed) {
      const catLots = get().lots.filter((l) => l.catalogueId === c.id)
      const sold = catLots.filter((l) => l.status === 'sold').length
      const sta = catLots.filter((l) => l.status === 'sta').length
      get().audit('auction.close', c.code,
        `${c.title} closed — ${sold} of ${catLots.length} lots sold${sta ? `, ${sta} below reserve` : ''}`)
      notifyRole(['auction_manager', 'sub_admin'], {
        kind: 'lifecycle', title: `${c.code} has closed`,
        body: `${sold} of ${catLots.length} lots sold${sta ? `, ${sta} cleared below reserve and need an Operations decision` : ''}. Confirm the results to release the seller's settlement.`,
        href: '/auction/results',
      })
      if (sta > 0) {
        notifyRole(['exec_manager', 'sub_admin'], {
          kind: 'system', title: `${sta} lot${sta === 1 ? '' : 's'} below reserve — ${c.code}`,
          body: 'Subject-to-approval lots are waiting on an Operations decision before the results can be confirmed.',
          href: '/exec/settlement',
        })
      }
      if (c.sellerId) {
        get().notify({
          userId: c.sellerId, kind: 'lifecycle', title: `${c.code} has closed`,
          body: `${sold} of ${catLots.length} lots sold. You can act on each cleared price once the results are confirmed.`,
          href: '/seller/settlement',
        })
      }
    }
  }

  /** Everyone with a stake in one auction — anyone who has shortlisted a lot in
   *  it or bid on one. Pausing, extending, cancelling and catalogue-scoped
   *  announcements all have to reach exactly this set. */
  function notifyParticipants(catalogueId: string, n: { kind: NotificationKind; title: string; body: string; href?: string }) {
    const s = get()
    const ids = new Set<string>([
      ...s.bids.filter((b) => b.catalogueId === catalogueId && b.status === 'valid').map((b) => b.bidderId),
      ...s.selections.filter((x) => x.catalogueId === catalogueId).map((x) => x.buyerId),
    ])
    const href = n.href ?? `/catalogue/${catalogueId}`
    for (const userId of ids) get().notify({ ...n, href, userId })
  }

  /** Everyone currently holding one of these roles.
   *
   *  Work is handed to a *desk*, not to a person: if two Operation Managers are
   *  on shift, both are told, and if one is suspended neither the notice nor the
   *  work silently disappears. Every staff hand-off in this store goes through
   *  here rather than naming a single account, so adding a second Finance user
   *  never leaves them unaddressed.
   *
   *  `exceptUserId` keeps the person who just acted off their own notification —
   *  a Sub Admin who flags a bid does not need telling that a bid was flagged. */
  function notifyRole(
    roles: Role | Role[],
    n: { kind: NotificationKind; title: string; body: string; href?: string },
    exceptUserId?: string,
  ) {
    const wanted = Array.isArray(roles) ? roles : [roles]
    const recipients = get().users.filter((u) =>
      wanted.includes(u.role) && (u.accountStatus ?? 'active') === 'active' && u.id !== exceptUserId)
    for (const u of recipients) get().notify({ ...n, userId: u.id })
    /* A desk with nobody at it must not swallow the hand-off. Falling back to
       the demo holder of the role keeps the chain visible in the prototype
       rather than dropping the work on the floor. */
    if (recipients.length === 0) {
      for (const r of wanted) {
        const fallback = ROLE_DEMO_USER[r as keyof typeof ROLE_DEMO_USER]
        if (fallback && fallback !== exceptUserId) get().notify({ ...n, userId: fallback })
      }
    }
  }

  return {
    now: Date.now(),
    theme: storedTheme === 'dark' ? 'dark' : 'light',
    role: storedRole,
    currentUser: demoUserFor(storedRole),
    paused: {},

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
       that opens on "nothing here yet" reads as broken rather than as quiet. */
    actionReviews: [],
    workClaims: {},
    handoverNotes: seedHandoverNotes(),
    termsAccepted: {},
    commissionSettlements: seededCommissionSettlements,

    /* Finance — the money-in / money-out records the mock JSON ships empty. */
    financeConfig: DEFAULT_FINANCE_CONFIG,
    bankAccounts: seededBankAccounts,
    depositClaims: seededDepositClaims,
    withdrawalRequests: seededWithdrawals,
    bankStatementLines: seedBankStatement(seededDepositClaims, seededWithdrawals),
    refundRequests: seededRefunds,
    emdForfeitures: seededForfeitures,
    invoices: seedInvoices(),
    ceoApprovals: seededCeoApprovals,
    ceoDelegation: null,

    /* Super Admin — the shape of the platform, seeded from what ships. */
    roleRegistry: seedRoleRegistry(),
    pageRegistry: seededPages,
    structuralChanges: seedStructuralChanges(seededPages),
    passwordResets: [],
    contentDrafts: seedContentDrafts(),
    masterCategories: CATEGORY_META.map((c) => ({ ...c, builtIn: true, active: true })),
    masterUoms: SEED_UOMS,
    masterYards: seedMasterYards(),

    toasts: [],
    lastWonLotId: null,

    /* ------------------------------ engine ------------------------------ */
    tick: () => {
      const now = Date.now()
      // paused catalogues freeze their countdowns: shift end times forward
      const s = get()
      const pausedIds = Object.keys(s.paused).filter((k) => s.paused[k])
      if (pausedIds.length) {
        const dms = now - s.now
        set((st) => ({
          catalogues: st.catalogues.map((c) => (pausedIds.includes(c.id) ? { ...c, endsAt: new Date(Date.parse(c.endsAt) + dms).toISOString() } : c)),
          lots: st.lots.map((l) => (l.catalogueId && pausedIds.includes(l.catalogueId) ? { ...l, endsAt: new Date(Date.parse(l.endsAt) + dms).toISOString() } : l)),
        }))
      }
      set({ now })
      runBots()
      runProxyBids()
      closeDueLots()
    },

    /* ------------------------------ session ----------------------------- */
    toggleTheme: () => {
      const theme = get().theme === 'dark' ? 'light' : 'dark'
      document.documentElement.classList.toggle('dark', theme === 'dark')
      localStorage.setItem('theme', theme)
      set({ theme })
    },
    switchRole: (role) => {
      rememberRole(role)
      // guest, guest1 and guest2 are unauthenticated public shells — no demo identity
      if (role === 'guest' || role === 'guest1' || role === 'guest2') {
        set({ role, currentUser: null })
        return
      }
      const user = get().users.find((u) => u.id === ROLE_DEMO_USER[role]) ?? null
      set({ role, currentUser: user })
    },
    signIn: (username, password) => {
      const id = username.trim().toLowerCase()
      /* Break-glass is checked first and always returns, so the hidden account
         never falls through to the ordinary lookup: a wrong password reads
         exactly like an email nobody has ever registered. */
      if (id === BREAK_GLASS_ID) {
        if (password !== BREAK_GLASS_PASSWORD) return { ok: false, error: 'Unknown user ID' }
        get().switchRole('super_admin')
        return { ok: true, role: 'super_admin' }
      }
      const demoRole = DEMO_LOGINS[id]
      /* Accounts a Super Admin created sign in by their own ID, not by the demo
         map — otherwise "create a Sub Admin" would create somebody who cannot
         get in. */
      const account = demoRole
        ? get().users.find((u) => u.id === ROLE_DEMO_USER[demoRole]) ?? null
        : get().users.find((u) => u.username === id || u.email.toLowerCase() === id) ?? null
      const role = demoRole ?? account?.role
      if (!role || (!demoRole && !account)) return { ok: false, error: 'Unknown user ID' }
      /* The only door into Super Admin is the break-glass pair above. Signing in
         as the seeded HQ account by its own email would leak that the role is
         there at all, so that path is closed with the same blank answer. */
      if (role === 'super_admin') return { ok: false, error: 'Unknown user ID' }
      // Password check is disabled for now (ENFORCE_LOGIN_PASSWORD = false).
      if (ENFORCE_LOGIN_PASSWORD && password !== DEMO_PASSWORD) {
        return { ok: false, error: 'Incorrect password' }
      }
      /* Suspending an account is only real if it stops the sign-in. Removing a
         role suspends everyone holding it, so this is also what makes a role
         removal take effect for the people who held it. */
      const status = account?.accountStatus ?? 'active'
      if (status !== 'active') {
        return {
          ok: false,
          error: status === 'banned'
            ? 'This account has been closed. Contact support if you believe that is a mistake.'
            : `This account is ${status}. Ask a Super Admin to reinstate it.`,
        }
      }
      if (demoRole) get().switchRole(demoRole)
      else if (account) { rememberRole(account.role); set({ role: account.role, currentUser: account }) }

      /* A password issued by support is spent the moment it is used. Whether
         they keep it or set their own is their choice, on the next screen. */
      const openReset = get().passwordResets.find((r) => r.userId === account?.id && !r.consumed)
      if (openReset) {
        set((st) => ({ passwordResets: st.passwordResets.map((r) => (r.id === openReset.id ? { ...r, consumed: true } : r)) }))
        get().pushToast({
          kind: 'info', title: 'You signed in with a password support issued',
          body: 'Keep it, or set your own from Profile & settings.',
        })
      }
      if (account) {
        set((st) => ({
          users: st.users.map((u) => (u.id === account.id ? { ...u, lastActiveAt: new Date(st.now).toISOString() } : u)),
        }))
      }
      return { ok: true, role }
    },
    login: (phone) => {
      const existing = get().users.find((u) => u.phone.replace(/\D/g, '').endsWith(phone.replace(/\D/g, '').slice(-10)))
      const user = existing ?? get().users.find((u) => u.id === 'u-buyer-1')!
      rememberRole(user.role)
      set({ role: user.role, currentUser: user })
    },
    logout: () => {
      rememberRole('guest')
      set({ role: 'guest', currentUser: null })
    },
    registerAccount: ({ name, email, phone, firm, role, city = '', gstin = '' }) => {
      const s = get()
      const existingBidderIds = s.users.map((u) => u.bidderId).filter((v): v is string => !!v)
      const existingSellerIds = s.users.map((u) => u.sellerId).filter((v): v is string => !!v)
      const user: User = {
        id: uid('u'),
        name, email, phone, firm, role,
        /* Signing up *as a seller* is itself the application to sell: the
           account lands on the verification desk straight away. It used to be
           created at 'none', which no queue looks for — and the only screen that
           could move it to 'pending' lived on the buyer's menu, so a direct
           seller signup could never be verified by anybody. */
        kycStatus: role === 'seller' ? 'pending' : 'none',
        sellerVerified: false,
        standing: 'good',
        accountStatus: 'active',
        city, gstin,
        avatarHue: Math.floor(Math.random() * 360),
        joinedAt: new Date(s.now).toISOString(),
        bidderId: role === 'buyer' ? genBidderId(existingBidderIds) : null,
        sellerId: role === 'seller' ? genSellerId(existingSellerIds) : null,
      }
      set((st) => ({ users: [...st.users, user], wallets: [...st.wallets, { userId: user.id, balance: 0, emdLocked: 0, ledger: [] }] }))
      rememberRole(role)
      set({ role, currentUser: user })
      get().audit('account.register', firm, `New ${ROLE_LABEL[role].toLowerCase()} account — ${name}, ${city || 'city not given'}`)
      if (role === 'seller') {
        notifyRole(['exec_manager', 'sub_admin'], {
          kind: 'system', title: `New seller to verify — ${firm}`,
          body: `${name} registered as a seller${gstin ? ` with GSTIN ${gstin}` : ''}. They cannot submit lots until you verify them.`,
          href: '/sub/seller-verification',
        })
        get().notify({
          userId: user.id, kind: 'system', title: 'Your seller account is with our team',
          body: 'We verify your firm details before you can submit lots. You will hear from us within one business day.',
          href: '/seller',
        })
      }
      return user
    },

    /* ------------------------------- buyer ------------------------------ */
    toggleShortlist: (catalogueId, lotId) => {
      const me = get().currentUser
      if (!me) return
      const cat = get().catalogues.find((c) => c.id === catalogueId)
      // Cut-off guard, same rule fundEmd enforces. Callers pre-check
      // `emdWindowClosed` so they can show the deadline message; this is the backstop.
      // An approved exemption request reopens this despite the deadline.
      if (cat && emdWindowClosed(cat, get().now) && !hasApprovedEmdExemption(me.id, catalogueId)) return
      // Symmetric guard on the other side of the window — nothing to fund yet.
      if (cat && emdWindowNotOpen(cat, get().now)) return
      set((st) => {
        const existing = st.selections.find((x) => x.buyerId === me.id && x.catalogueId === catalogueId)
        if (!existing) {
          return { selections: [...st.selections, { buyerId: me.id, catalogueId, lotIds: [lotId], emdFundedLotIds: [] }] }
        }
        const has = existing.lotIds.includes(lotId)
        return {
          selections: st.selections.map((x) =>
            x === existing
              ? {
                  ...x,
                  lotIds: has ? x.lotIds.filter((id) => id !== lotId) : [...x.lotIds, lotId],
                  // deselecting an unfunded lot is free; funded lots stay funded until close
                  emdFundedLotIds: has ? x.emdFundedLotIds : x.emdFundedLotIds,
                }
              : x,
          ),
        }
      })
    },

    toggleWatchlist: (catalogueId) => {
      const me = get().currentUser
      if (!me) return
      set((st) => {
        const has = st.watchlist.some((w) => w.buyerId === me.id && w.catalogueId === catalogueId)
        const cat = st.catalogues.find((c) => c.id === catalogueId)
        // Read-only once either EMD is funded, or the pre-bid EMD deadline has
        // passed without full funding — the buyer missed the cut-off, so the
        // entry stays put (visible, locked) as a record of what fell through,
        // rather than letting them quietly unshortlist and lose that signal.
        if (has && (isCatalogueEmdLocked(st, me.id, catalogueId) || (cat && emdWindowClosed(cat, st.now)))) return st
        // Can't shortlist before the EMD window has even opened — nothing to fund yet.
        if (!has && cat && emdWindowNotOpen(cat, st.now)) return st
        return {
          watchlist: has
            ? st.watchlist.filter((w) => !(w.buyerId === me.id && w.catalogueId === catalogueId))
            : [...st.watchlist, { buyerId: me.id, catalogueId }],
        }
      })
    },

    fundEmd: (catalogueId, lotIds, method) => {
      const s = get()
      const me = s.currentUser
      if (!me) return false
      const w = ensureWallet(me.id)
      const lots = s.lots.filter((l) => lotIds.includes(l.id))
      const total = lots.reduce((sum, l) => sum + l.preBidEmd, 0)
      if (w.balance < total) return false
      const cat = s.catalogues.find((c) => c.id === catalogueId)!
      // Cut-off guard. Callers pre-check `emdWindowClosed` so they can show the
      // deadline message rather than the balance one; this is the backstop.
      // An approved exemption request reopens this despite the deadline.
      if (emdWindowClosed(cat, s.now) && !hasApprovedEmdExemption(me.id, catalogueId)) return false
      // Symmetric guard on the other side of the window — nothing to fund yet.
      if (emdWindowNotOpen(cat, s.now)) return false
      set((st) => ({
        wallets: st.wallets.map((x) =>
          x.userId === me.id
            ? {
                ...x, balance: x.balance - total, emdLocked: x.emdLocked + total,
                ledger: [
                  ...lots.map((l) => ({
                    id: uid('led'), at: new Date(st.now).toISOString(), type: 'emd_lock' as const,
                    amount: -l.preBidEmd, ref: uid('EMD').toUpperCase(), lotId: l.id, catalogueId,
                    note: `Pre-bid EMD locked — ${l.lotNo} (${cat.code}) via ${method}`,
                  })),
                  ...x.ledger,
                ],
              }
            : x,
        ),
        selections: (() => {
          const existing = st.selections.find((x) => x.buyerId === me.id && x.catalogueId === catalogueId)
          if (!existing) {
            return [...st.selections, { buyerId: me.id, catalogueId, lotIds: [...lotIds], emdFundedLotIds: [...lotIds] }]
          }
          return st.selections.map((x) =>
            x === existing
              ? { ...x, lotIds: [...new Set([...x.lotIds, ...lotIds])], emdFundedLotIds: [...new Set([...x.emdFundedLotIds, ...lotIds])] }
              : x,
          )
        })(),
      }))
      get().notify({
        userId: me.id, kind: 'wallet', title: `EMD locked for ${lots.length} lot${lots.length > 1 ? 's' : ''}`,
        body: `${inr(total)} locked against ${cat.code} via ${method}.`, href: '/buyer/emd-shortlisted-catalogue',
      })
      return true
    },

    placeBid: (lotId, rate, bidderId, type = 'manual') => {
      const me = get().currentUser
      const who = bidderId ?? me?.id
      if (!who) return { ok: false, error: 'Sign in to bid' }
      return applyBid(lotId, rate, who, type)
    },

    setAutoBid: (lotId, maxRate, active) => {
      const me = get().currentUser
      if (!me) return
      set((st) => {
        const rest = st.autoBids.filter((a) => !(a.buyerId === me.id && a.lotId === lotId))
        return { autoBids: active ? [...rest, { buyerId: me.id, lotId, maxRate, active }] : rest }
      })
    },

    topUpWallet: (amount, method) => {
      const me = get().currentUser
      if (!me) return
      ensureWallet(me.id)
      set((st) => ({
        wallets: st.wallets.map((w) =>
          w.userId === me.id
            ? {
                ...w, balance: w.balance + amount,
                ledger: [{ id: uid('led'), at: new Date(st.now).toISOString(), type: 'topup' as const, amount, ref: uid('UTR').toUpperCase(), note: `Wallet top-up via ${method}` }, ...w.ledger],
              }
            : w,
        ),
      }))
      get().notify({ userId: me.id, kind: 'wallet', title: 'Wallet top-up successful', body: `${inr(amount)} added via ${method}.`, href: '/buyer/wallet' })
    },

    acceptTerms: (catalogueId) => {
      const s = get()
      const cat = s.catalogues.find((c) => c.id === catalogueId)
      const ts = s.termsSets.find((t) => t.id === cat?.termsSetId)
      set((st) => ({ termsAccepted: { ...st.termsAccepted, [catalogueId]: ts?.version ?? 'v1' } }))
    },

    bookInspectionSlot: (catalogueId, date, window, persons) => {
      const me = get().currentUser
      if (!me) return
      set((st) => ({
        inspectionSlots: [...st.inspectionSlots, {
          id: uid('slot'), catalogueId, userId: me.id, date, window, persons,
          status: 'booked' as const, passCode: `FB-GATE-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        }],
      }))
      const slotCat = get().catalogues.find((c) => c.id === catalogueId)
      get().audit('inspection.slot_book', slotCat?.code ?? catalogueId,
        `${me.firm} booked a yard visit for ${persons} on ${date} (${window})`)
      /* Somebody has to be at the gate. Operations runs the yard window and the
         assigned field executive is usually the person on site. */
      notifyRole(['exec_manager', 'sub_admin'], {
        kind: 'system', title: `Yard visit booked — ${slotCat?.code ?? 'a catalogue'}`,
        body: `${me.firm} · ${persons} visitor${persons === 1 ? '' : 's'} on ${date}, ${window}, at ${slotCat?.yardName ?? 'the yard'}.`,
        href: '/exec/logistics',
      })
      if (slotCat?.assignedFieldExecId) {
        get().notify({
          userId: slotCat.assignedFieldExecId, kind: 'system',
          title: `Buyer visiting ${slotCat.yardName}`,
          body: `${me.firm} · ${persons} visitor${persons === 1 ? '' : 's'} on ${date}, ${window}.`,
          href: `/field/catalogue/${catalogueId}`,
        })
      }
    },

    submitKyc: () => {
      const me = get().currentUser
      if (!me) return
      set((st) => ({
        users: st.users.map((u) => (u.id === me.id ? { ...u, kycStatus: 'pending' as const } : u)),
        currentUser: { ...me, kycStatus: 'pending' },
      }))
      get().audit('kyc.submit', me.firm, `${me.name} applied to sell — GSTIN ${me.gstin || 'not given'}`)
      get().notify({ userId: me.id, kind: 'system', title: 'Seller KYC submitted', body: 'Our team will verify your GSTIN and bank details within 1 business day.', href: '/buyer/kyc' })
      // The desk that has to act on it is told, rather than left to find it.
      notifyRole(['exec_manager', 'sub_admin'], {
        kind: 'system', title: `Seller verification — ${me.firm}`,
        body: `${me.name} applied to sell${me.gstin ? ` with GSTIN ${me.gstin}` : ''}. Verify before they can submit lots.`,
        href: '/sub/seller-verification',
      })
    },

    // valid only for the two hops needing no extra data — payment_pending needs
    // issueDemandDraft, and lifted needs completeLifting (checklist-gated)
    advanceDeliveryOrder: (doId) => {
      const order = ['payment_pending', 'dd_issued', 'lifting_scheduled', 'lifted', 'completed'] as const
      set((st) => ({
        deliveryOrders: st.deliveryOrders.map((d) => {
          if (d.id !== doId) return d
          if (d.stage !== 'dd_issued' && d.stage !== 'lifting_scheduled') return d
          const idx = order.indexOf(d.stage)
          return { ...d, stage: order[idx + 1] }
        }),
      }))
    },

    toggleLiftingChecklistItem: (doId, key) => {
      const me = get().currentUser
      set((st) => ({
        deliveryOrders: st.deliveryOrders.map((d) => {
          if (d.id !== doId || d.stage !== 'lifted' || !me || d.buyerId !== me.id) return d
          return {
            ...d,
            liftingChecklist: d.liftingChecklist.map((item) =>
              item.key !== key ? item : { ...item, done: !item.done, at: !item.done ? new Date(st.now).toISOString() : undefined },
            ),
          }
        }),
      }))
    },

    recordWeighment: (doId, qty) => {
      const me = get().currentUser
      const d = get().deliveryOrders.find((x) => x.id === doId)
      if (!d || !me || d.stage !== 'lifted') return
      /* Either side may put a reading on the record — the buyer at their own
         weighbridge, or our people at the yard. Who it was is stamped, because
         only a staff reading can close the handover. */
      const isBuyer = d.buyerId === me.id
      const isStaff = WEIGHMENT_WITNESS_ROLES.includes(get().role)
      if (!isBuyer && !isStaff) return
      const at = new Date(get().now).toISOString()
      set((st) => ({
        deliveryOrders: st.deliveryOrders.map((x) => (x.id === doId
          ? {
            ...x,
            weighedQty: qty,
            weighedById: me.id,
            weighedAt: at,
            liftingChecklist: x.liftingChecklist.map((item) =>
              item.key !== 'gross_weighment' ? item : { ...item, done: true, at },
            ),
          }
          : x)),
      }))
      const lot = get().lots.find((l) => l.id === d.lotId)
      const variance = d.awardedQty > 0 ? ((qty - d.awardedQty) / d.awardedQty) * 100 : 0
      get().audit('do.weighment', lot?.lotNo ?? doId,
        `Gross weighment ${num(qty)} ${d.uom} recorded by ${isStaff ? me.name : `${me.firm} (buyer)`} against ${num(d.awardedQty)} ${d.uom} awarded — ${variance >= 0 ? '+' : ''}${variance.toFixed(1)}%`,
        Math.abs(variance) >= 1 ? 'warning' : 'info')

      if (isBuyer) {
        // A buyer's reading is a declaration until we have stood at the bridge.
        notifyRole(['exec_manager', 'sub_admin'], {
          kind: 'system', title: `Weighment declared — ${lot?.lotNo ?? 'a lot'}`,
          body: `${me.firm} recorded ${num(qty)} ${d.uom} against ${num(d.awardedQty)} ${d.uom} awarded (${variance >= 0 ? '+' : ''}${variance.toFixed(1)}%). Witness it before closing the handover.`,
          href: '/exec/logistics',
        })
      } else {
        get().notify({
          userId: d.buyerId, kind: 'system', title: `Weighment confirmed — ${lot?.lotNo ?? 'your lot'}`,
          body: `Recorded at ${num(qty)} ${d.uom}, witnessed by ${me.name}. This is the quantity your invoice is raised on.`,
          href: '/buyer/auction-status',
        })
      }
      /* A material shortfall is money owed back. Finance is told rather than the
         buyer having to open a ticket to get it noticed. */
      if (variance <= -1) {
        notifyRole('finance_admin', {
          kind: 'system', title: `Weighment shortfall — ${lot?.lotNo ?? 'a lot'}`,
          body: `${num(qty)} ${d.uom} against ${num(d.awardedQty)} ${d.uom} awarded (${variance.toFixed(1)}%). The value of the shortfall goes back to the buyer.`,
          href: '/finance/refunds',
        })
      }
    },

    completeLifting: (doId) => {
      const me = get().currentUser
      const d = get().deliveryOrders.find((x) => x.id === doId)
      if (!d || !me || d.stage !== 'lifted' || !d.liftingChecklist.every((i) => i.done)) return
      if (d.buyerId !== me.id && !WEIGHMENT_WITNESS_ROLES.includes(get().role)) return
      set((st) => ({
        deliveryOrders: st.deliveryOrders.map((x) => (x.id === doId ? { ...x, stage: 'completed' as const } : x)),
      }))
      const lot = get().lots.find((l) => l.id === d.lotId)
      get().audit('do.complete', lot?.lotNo ?? doId, `Lifting completed — ${num(d.weighedQty ?? d.awardedQty)} ${d.uom} weighed vs ${num(d.awardedQty)} ${d.uom} indicative`)
      // Closing the handover is Operations' step, and it comes next.
      notifyRole(['exec_manager', 'sub_admin'], {
        kind: 'system', title: `Lifting complete — ${lot?.lotNo ?? doId}`,
        body: `${num(d.weighedQty ?? d.awardedQty)} ${d.uom} off site. Close the handover to finish the sale.`,
        href: '/exec/handover',
      })
    },

    registerBankAccount: (bankName, accountNumber, ifsc, accountHolderName) => {
      const me = get().currentUser
      if (!me) return
      const { last4, masked } = maskAccountNumber(accountNumber)
      const acc: BankAccount = {
        id: uid('bank'), userId: me.id, bankName, ifsc, accountHolderName,
        last4, accountNumberMasked: masked, status: 'pending', createdAt: new Date(get().now).toISOString(),
      }
      set((st) => ({ bankAccounts: [...st.bankAccounts, acc] }))
      get().audit('bankaccount.register', acc.id, `${bankName} account ${masked} registered for verification`)
      // Verification is Finance's decision, so Finance is told it is waiting.
      notifyRole('finance_admin', {
        kind: 'system', title: `Payout account to verify — ${me.firm}`,
        body: `${bankName} ${masked}, held by ${accountHolderName}. Nothing can be withdrawn to it until you verify it.`,
        href: '/finance/bank-accounts',
      })
    },

    submitDepositClaim: (amount, utr, transferDate, proofFilename) => {
      const me = get().currentUser
      if (!me) return { ok: false, error: 'Sign in to submit a claim' }
      const norm = utr.trim().toLowerCase()
      if (!norm) return { ok: false, error: 'Enter the UTR / reference number' }
      if (get().depositClaims.some((c) => c.utr.trim().toLowerCase() === norm)) {
        return { ok: false, error: 'A claim with this reference already exists' }
      }
      const claim: DepositClaim = {
        id: uid('dep'), userId: me.id, amount, utr: utr.trim(), transferDate, proofFilename,
        status: 'submitted', createdAt: new Date(get().now).toISOString(),
      }
      set((st) => ({ depositClaims: [...st.depositClaims, claim] }))
      get().audit('deposit.submit', claim.id, `Deposit claim of ${inr(amount)} submitted — UTR ${claim.utr}`)
      // Nothing is credited until Finance matches it to the bank, so Finance
      // hears about it the moment the buyer claims it.
      notifyRole('finance_admin', {
        kind: 'system', title: `Deposit claimed — ${inr(amount)}`,
        body: `${me.firm} · UTR ${claim.utr} dated ${transferDate}. Match it against the statement before crediting the wallet.`,
        href: '/finance/deposits',
      })
      return { ok: true }
    },

    requestWithdrawal: (amount, bankAccountId) => {
      const me = get().currentUser
      if (!me) return { ok: false, error: 'Sign in to request a withdrawal' }
      const account = get().bankAccounts.find((a) => a.id === bankAccountId && a.userId === me.id)
      if (!account || account.status !== 'verified') return { ok: false, error: 'Select a verified bank account' }
      if (!(amount > 0)) return { ok: false, error: 'Enter an amount to withdraw' }
      const w = wallet(me.id)
      if (!w || amount > w.balance) return { ok: false, error: 'Insufficient available balance' }
      if (!withinWithdrawalWindow(get().withdrawalWindow, get().now)) {
        return { ok: false, error: `Outside the withdrawal processing window. ${nextWithdrawalWindowLabel(get().withdrawalWindow, get().now)}` }
      }
      const ref = uid('wdr').toUpperCase()
      const req: WithdrawalRequest = {
        id: uid('wdr'), userId: me.id, amount, bankAccountId, ref,
        status: 'requested', requestedAt: new Date(get().now).toISOString(),
      }
      set((st) => ({
        withdrawalRequests: [...st.withdrawalRequests, req],
        wallets: st.wallets.map((x) =>
          x.userId === me.id
            ? {
                ...x, balance: x.balance - amount,
                ledger: [{ id: uid('led'), at: new Date(st.now).toISOString(), type: 'withdraw' as const, amount: -amount, ref, note: `Withdrawal requested to •••• ${account.last4}` }, ...x.ledger],
              }
            : x,
        ),
      }))
      get().audit('withdrawal.request', req.id, `Withdrawal of ${inr(amount)} requested to •••• ${account.last4}`)
      // Money out runs on a window and a maker–checker; Finance is told at the
      // start of it, not when someone next opens the screen.
      notifyRole('finance_admin', {
        kind: 'system', title: `Withdrawal to review — ${inr(amount)}`,
        body: `${me.firm} to ${account.bankName} •••• ${account.last4}.${amount >= get().financeConfig.withdrawalSecondSignatureFrom ? ' Above the second-signature threshold — a different Finance user must release it.' : ''}`,
        href: '/finance/withdrawals',
      })
      return { ok: true }
    },

    cancelWithdrawal: (id) => {
      const me = get().currentUser
      const req = get().withdrawalRequests.find((r) => r.id === id)
      if (!req || !me || req.userId !== me.id || req.status !== 'requested') return
      set((st) => ({
        withdrawalRequests: st.withdrawalRequests.map((r) => (r.id === id ? { ...r, status: 'cancelled' as const, decidedAt: new Date(st.now).toISOString() } : r)),
        wallets: st.wallets.map((w) =>
          w.userId === req.userId
            ? { ...w, balance: w.balance + req.amount, ledger: [{ id: uid('led'), at: new Date(st.now).toISOString(), type: 'refund' as const, amount: req.amount, ref: req.ref, note: 'Withdrawal cancelled by buyer — reversed' }, ...w.ledger] }
            : w,
        ),
      }))
      get().audit('withdrawal.cancel', id, `Withdrawal of ${inr(req.amount)} cancelled by buyer — reversed`)
      // It was on Finance's desk; it has to visibly leave it.
      notifyRole('finance_admin', {
        kind: 'system', title: `Withdrawal withdrawn — ${inr(req.amount)}`,
        body: `${me.firm} cancelled their request before it was released. The balance is back in their wallet; nothing to process.`,
        href: '/finance/withdrawals',
      })
      get().notify({
        userId: me.id, kind: 'wallet', title: 'Withdrawal cancelled',
        body: `${inr(req.amount)} is back in your available balance.`, href: '/buyer/wallet',
      })
    },

    requestEmdExemption: (catalogueId, reason) => {
      const s = get()
      const me = s.currentUser
      if (!me) return { ok: false, error: 'Sign in to request an exemption' }
      const cat = s.catalogues.find((c) => c.id === catalogueId)
      if (!cat) return { ok: false, error: 'Catalogue not found' }
      if (!reason.trim()) return { ok: false, error: 'Enter a reason for missing the EMD deadline' }
      const existing = s.emdExemptionRequests.find(
        (r) => r.buyerId === me.id && r.catalogueId === catalogueId && r.status !== 'rejected',
      )
      if (existing) return { ok: false, error: 'A request is already pending or approved for this catalogue' }
      const req: EmdExemptionRequest = {
        id: uid('exm'), buyerId: me.id, catalogueId, reason: reason.trim(),
        status: 'pending', createdAt: new Date(s.now).toISOString(),
      }
      set((st) => ({ emdExemptionRequests: [...st.emdExemptionRequests, req] }))
      get().audit('emd_exemption.request', cat.code, `${me.firm} requested an EMD deadline exemption — ${req.reason}`, 'warning')
      get().notify({
        userId: me.id, kind: 'system', title: 'EMD exemption requested',
        body: `Your request for ${cat.code} is with the auction desk. You will be told either way before bidding opens.`,
        href: '/buyer/emd-shortlisted-catalogue',
      })
      /* This expires with the auction, so the three roles that can decide it are
         told rather than left to find it on a queue. */
      notifyRole(['auction_manager', 'exec_manager', 'sub_admin'], {
        kind: 'system', title: `EMD exemption — ${me.firm}`,
        body: `${cat.code} · ${req.reason}`,
        href: '/auction/emd-eligibility',
      })
      return { ok: true }
    },

    /* ------------------------------ seller ------------------------------ */
    createLot: (partial) => {
      const me = get().currentUser
      /* The verification gate is only a gate if it stops something. A seller
         whose KYC has not been approved may not put material in front of
         buyers — the decision belongs to Operations, not to the seller. */
      if (!me) return { ok: false, error: 'Sign in as a seller to submit a lot' }
      if (me.role === 'seller' && !me.sellerVerified && me.kycStatus !== 'verified') {
        return {
          ok: false,
          error: me.kycStatus === 'pending'
            ? 'Your seller verification is still with our team. You can submit lots as soon as it is approved.'
            : me.kycStatus === 'rejected'
              ? 'Your seller verification was not approved. Resubmit your details, or appeal to the Operation Manager.'
              : 'Complete seller verification before submitting a lot.',
        }
      }
      const id = uid('lot')
      const lot: Lot = {
        id, lotNo: `UNL-${id.slice(-4).toUpperCase()}`, catalogueId: null as unknown as string,
        sellerId: me.id,
        metal: 'MS', category: 'scrap', grade: '', indicativeQty: 0, uom: 'MT',
        yard: '', description: '', startRate: 0, increment: 100, reserveRate: 0,
        preBidEmd: 10000, saleBasis: 'as-is-where-is', hazardous: false,
        photos: [{ id: `${id}-p0`, label: 'Overview', hue: 24 }],
        inspectionReportId: null, status: 'pending_inspection',
        currentRate: null, leadingBidderId: null, bidCount: 0,
        endsAt: new Date(get().now + 30 * 86400_000).toISOString(), extensions: 0, resultH1Rate: null,
        knownSeller: false, inspectionWaived: false, waivedBy: null, waivedReason: null, waivedAt: null,
        ...partial,
      }
      set((st) => ({ lots: [...st.lots, lot] }))
      get().audit('lot.create', lot.lotNo, `${me.firm} submitted ${lot.grade || lot.metal} for inspection`)
      /* A submitted lot is work for Operations — it has to be taken into the
         pipeline and assembled into a catalogue before any inspector can ever
         see it, so it cannot be left to be noticed. */
      notifyRole(['exec_manager', 'sub_admin'], {
        kind: 'system', title: `New lot from ${me.firm}`,
        body: `${lot.grade || lot.metal} · ${num(lot.indicativeQty)} ${lot.uom} at ${lot.yard || 'a yard'} — take it into the pipeline and assign an inspection.`,
        href: '/exec',
      })
      get().notify({
        userId: me.id, kind: 'system', title: `${lot.lotNo} submitted`,
        body: 'Operations will assemble it into a catalogue and book a yard inspection. It stays private until then.',
        href: '/seller/lots',
      })
      return { ok: true, lotId: lot.id }
    },

    /* ---------------------------- ops / admin --------------------------- */
    submitInspection: (lotId, report, outcome) => {
      const me = get().currentUser
      const lot = get().lots.find((l) => l.id === lotId)
      // A filed report is evidence — it is never edited. A correction is a
      // re-inspection, which appends a new version and leaves the earlier one
      // on record.
      const version = get().inspectionReports.filter((r) => r.lotId === lotId).length + 1
      const rep: InspectionReport = {
        ...report, id: uid('ir'), lotId, date: new Date(get().now).toISOString(),
        status: outcome, inspectorId: me?.id ?? 'u-field-1',
      }
      const lotStatus: LotStatus = outcome === 'verified' ? 'inspected' : outcome === 'flagged' ? 'flagged' : 'rejected'
      set((st) => ({
        inspectionReports: [...st.inspectionReports, rep],
        lots: st.lots.map((l) => (l.id === lotId ? { ...l, status: lotStatus, inspectionReportId: rep.id } : l)),
      }))
      get().audit('inspection.submit', lot?.lotNo ?? lotId,
        `Inspection ${outcome} — measured ${report.measuredQty} ${report.uom}${version > 1 ? ` (version ${version})` : ''}`)

      // The two people whose work waits on the report hear about it as it lands:
      // Operations decides the lot, the seller owns the material.
      const cat = get().catalogues.find((c) => c.id === lot?.catalogueId)
      const title = `${lot?.lotNo ?? 'Lot'} inspection ${outcome}`
      const measured = `${report.measuredQty} ${report.uom} measured against ${lot?.indicativeQty ?? '—'} ${report.uom} declared`
      // Both roles hold the lot gate, so both are told a report has landed.
      notifyRole(['exec_manager', 'sub_admin'], {
        kind: 'system', title,
        body: `${me?.name ?? 'Field executive'} filed report ${version > 1 ? `v${version} ` : ''}— ${measured}. Awaiting your decision.`,
        href: '/exec/approvals',
      })
      if (cat?.sellerId) {
        get().notify({
          userId: cat.sellerId, kind: 'system', title,
          body: `${measured}. Operations decides the lot next.`,
          href: '/seller/lots',
        })
      }
    },

    setLotStatus: (lotId, status) => {
      set((st) => ({ lots: st.lots.map((l) => (l.id === lotId ? { ...l, status } : l)) }))
    },

    decideLot: (lotId, outcome, reason) => {
      if (!LOT_GATE_ROLES.includes(get().role)) return { ok: false, error: 'Only Operations or a Sub Admin decides a lot' }
      const lot = get().lots.find((l) => l.id === lotId)
      if (!lot) return { ok: false, error: 'Lot not found' }
      if (outcome !== 'approved' && !reason?.trim()) {
        return { ok: false, error: 'A reason is required — the seller is shown it word for word' }
      }
      set((st) => ({ lots: st.lots.map((l) => (l.id === lotId ? { ...l, status: outcome } : l)) }))

      const cat = get().catalogues.find((c) => c.id === lot.catalogueId)
      const detail = {
        approved: `Cleared for auction${reason ? ` — ${reason}` : ''}`,
        flagged: `Sent back for re-inspection — ${reason}`,
        rejected: `Rejected — ${reason}`,
      }[outcome]
      get().audit(`lot.${outcome === 'flagged' ? 'send_back' : outcome}`, lot.lotNo, detail,
        outcome === 'rejected' ? 'warning' : 'info')

      // The seller finds out from us, not by noticing their lot is missing.
      if (cat?.sellerId) {
        get().notify({
          userId: cat.sellerId, kind: 'system',
          title: {
            approved: `${lot.lotNo} approved`,
            flagged: `${lot.lotNo} sent back for re-inspection`,
            rejected: `${lot.lotNo} rejected`,
          }[outcome],
          body: detail,
          href: '/seller/lots',
        })
      }
      // A re-inspection is work for whoever is holding the catalogue.
      if (outcome === 'flagged' && cat?.assignedFieldExecId) {
        get().notify({
          userId: cat.assignedFieldExecId, kind: 'system',
          title: `Re-inspect ${lot.lotNo}`,
          body: reason ?? 'Sent back by Operations.',
          href: `/field/lot/${lot.id}`,
        })
      }
      // This may have been the last lot the catalogue was waiting on.
      if (outcome === 'approved') announceCatalogueReady(lot.catalogueId)
      return { ok: true }
    },

    decideSellerKyc: (userId, approve, reason) => {
      if (!LOT_GATE_ROLES.includes(get().role)) return { ok: false, error: 'Only Operations or a Sub Admin verifies a seller' }
      const user = get().users.find((u) => u.id === userId)
      if (!user) return { ok: false, error: 'Account not found' }
      if (!approve && !reason?.trim()) return { ok: false, error: 'Say what has to be resubmitted' }
      set((st) => ({
        users: st.users.map((u) => (u.id === userId
          ? { ...u, kycStatus: approve ? ('verified' as const) : ('rejected' as const), sellerVerified: approve ? true : u.sellerVerified }
          : u)),
        currentUser: st.currentUser?.id === userId
          ? { ...st.currentUser, kycStatus: approve ? ('verified' as const) : ('rejected' as const), sellerVerified: approve ? true : st.currentUser.sellerVerified }
          : st.currentUser,
      }))
      get().audit(approve ? 'kyc.approve' : 'kyc.reject', user.firm,
        approve ? 'Seller verified — may submit lots' : `Rejected — ${reason}`, approve ? 'info' : 'warning')
      get().notify({
        userId, kind: 'system',
        title: approve ? 'You are verified as a seller' : 'Your seller verification needs more',
        body: approve
          ? 'You can submit lots for inspection now. They stay private until Operations catalogues and publishes them.'
          : `${reason} — resubmit and we will look again. You can appeal to the Operation Manager.`,
        href: approve ? '/seller/create-lot' : '/buyer/kyc',
      })
      return { ok: true }
    },

    confirmHandover: (doId, note) => {
      if (!LOT_GATE_ROLES.includes(get().role)) return { ok: false, error: 'Only Operations or a Sub Admin closes a handover' }
      const s = get()
      const order = s.deliveryOrders.find((d) => d.id === doId)
      if (!order) return { ok: false, error: 'Delivery order not found' }
      if (order.stage !== 'completed') return { ok: false, error: 'The material has not been lifted yet' }
      if (order.handoverConfirmedAt) return { ok: false, error: 'This handover is already closed' }
      /* Weighment-final means final. The quantity here becomes the invoice and
         any shortfall refund, so it cannot rest on the buyer's own reading —
         one of our people has to have witnessed it. */
      if (order.weighedQty != null) {
        const weigher = s.users.find((u) => u.id === order.weighedById)
        if (!weigher || !WEIGHMENT_WITNESS_ROLES.includes(weigher.role)) {
          return {
            ok: false,
            error: 'The weighment on this order was declared by the buyer. Record the witnessed figure on Logistics before closing the handover.',
          }
        }
      }
      const at = new Date(s.now).toISOString()
      set((st) => ({
        deliveryOrders: st.deliveryOrders.map((d) =>
          d.id === doId ? { ...d, handoverConfirmedAt: at, handoverConfirmedBy: st.currentUser?.id, handoverNote: note } : d,
        ),
      }))
      const lot = s.lots.find((l) => l.id === order.lotId)
      const qty = order.weighedQty ?? order.awardedQty
      get().audit('delivery.handover', lot?.lotNo ?? doId,
        `Handover closed at ${num(qty)} ${order.uom} weighment-final${note ? ` — ${note}` : ''}`)
      get().notify({
        userId: order.buyerId, kind: 'system',
        title: `Handover closed on ${lot?.lotNo ?? 'your lot'}`,
        body: `Recorded at ${num(qty)} ${order.uom}, weighment-final. Your closure certificate is available.`,
        href: '/buyer/auction-status',
      })
      // Finance books the sale off the back of this.
      notifyRole('finance_admin', {
        kind: 'system',
        title: 'Delivery closed',
        body: `${lot?.lotNo ?? doId} handed over at ${num(qty)} ${order.uom}. Ready to book.`,
        href: '/finance/payments',
      })
      return { ok: true }
    },

    setSellerLotDecision: (lotId, decision) => {
      set((st) => ({ lots: st.lots.map((l) => (l.id === lotId ? { ...l, sellerDecision: decision } : l)) }))
      const s = get()
      const lot = s.lots.find((l) => l.id === lotId)
      const cat = s.catalogues.find((c) => c.id === lot?.catalogueId)
      const seller = s.users.find((u) => u.id === cat?.sellerId)
      get().audit('lot.seller_decision', lot?.lotNo ?? lotId,
        decision ? `Seller ${decision} the cleared price` : 'Seller decision reset to pending',
        decision === 'rejected' ? 'warning' : 'info')

      /* Rejecting is not the end of the lot — it is the start of an operational
         exception, and the material is sitting in a yard while it waits. Ops
         used to have to notice. */
      if (decision === 'rejected') {
        notifyRole(['exec_manager', 'sub_admin'], {
          kind: 'system', title: `${lot?.lotNo ?? 'A lot'} — seller refused the cleared price`,
          body: `${seller?.firm ?? 'The seller'} refused ${inr(lot?.resultH1Rate ?? lot?.currentRate ?? 0)}/${lot?.uom ?? 'MT'} on ${cat?.code ?? 'a closed auction'}. No commission is due — decide what happens to the material.`,
          href: '/exec/settlement',
        })
      }
      /* Accepting is what makes commission owed, so Finance is told a receipt is
         coming rather than discovering it when the seller records payment. */
      if (decision === 'accepted') {
        notifyRole('finance_admin', {
          kind: 'system', title: `Cleared price accepted — ${lot?.lotNo ?? 'a lot'}`,
          body: `${seller?.firm ?? 'A seller'} accepted ${inr(lot?.resultH1Rate ?? lot?.currentRate ?? 0)}/${lot?.uom ?? 'MT'} on ${cat?.code ?? 'a closed auction'}. Commission becomes due on this lot.`,
          href: '/finance/commission',
        })
      }
    },

    recordCommissionSettlement: (catalogueId, amount, mode, reference) => {
      const me = get().currentUser
      const at = new Date(get().now).toISOString()
      const record: CommissionSettlement = {
        id: uid('settle'), catalogueId, sellerId: me?.id ?? '', amount, mode, at,
        reference: reference ?? (mode === 'emd' ? `EMD-NET-${catalogueId}` : undefined),
        // The seller says they have paid. Finance still has to see it arrive —
        // until then this is a claim, not a confirmed receipt.
        status: 'recorded',
      }
      set((st) => ({ commissionSettlements: [...st.commissionSettlements, record] }))
      const cat = get().catalogues.find((c) => c.id === catalogueId)
      get().audit('lot.commission_settled', cat?.code ?? catalogueId,
        `Commission ${mode === 'emd' ? 'netted from EMD' : 'paid by transfer'} — ${inr(amount)}`)
      // Hands the record straight to the Finance desk that has to confirm it.
      notifyRole('finance_admin', {
        kind: 'system',
        title: `Commission recorded — ${cat?.code ?? 'auction'}`,
        body: `${me?.firm ?? 'A seller'} settled ${inr(amount)} ${mode === 'emd' ? 'from held EMD' : 'by transfer'}. Confirm it against the bank.`,
        href: '/finance/commission',
      })
    },

    publishCatalogue: (cat, lotIds, overrides) => {
      const isDraft = cat.status === 'draft'
      const at = new Date(get().now).toISOString()
      const by = get().currentUser?.id ?? 'u-exec-1'
      /* Bulk-setting an increment, an EMD or a unit across a catalogue changes
         terms the seller submitted. The new value applies, but the original is
         kept on the lot rather than overwritten, the change is audited, and the
         seller is told — see the role architecture, Part 4.4. */
      const changesFor = (l: Lot): LotOverride[] => {
        const o = overrides[l.id]
        if (!o) return []
        const rows: LotOverride[] = []
        const add = (field: LotOverride['field'], label: string, from: string, to: string) =>
          rows.push({ field, label, from, to, by, at, catalogueCode: cat.code })
        if (o.increment != null && o.increment !== l.increment) add('increment', 'Bid increment', inr(l.increment), inr(o.increment))
        if (o.preBidEmd != null && o.preBidEmd !== l.preBidEmd) add('preBidEmd', 'Pre-bid EMD', inr(l.preBidEmd), inr(o.preBidEmd))
        if (o.uom && o.uom !== l.uom) add('uom', 'Unit of measure', l.uom, o.uom)
        return rows
      }
      const changed = get().lots.filter((l) => lotIds.includes(l.id)).flatMap(changesFor)

      set((st) => ({
        catalogues: [...st.catalogues, { ...cat, lotIds }],
        lots: st.lots.map((l) => {
          if (!lotIds.includes(l.id)) return l
          const idx = lotIds.indexOf(l.id)
          const rows = changesFor(l)
          return {
            ...l, ...overrides[l.id], catalogueId: cat.id,
            ...(rows.length > 0 ? { overrides: [...(l.overrides ?? []), ...rows] } : {}),
            lotNo: `LOT-${String(idx + 1).padStart(2, '0')}`,
            status: cat.status === 'live'
              ? 'live' as LotStatus
              : isDraft
                ? (l.inspectionWaived ? 'approved' as LotStatus : 'pending_inspection' as LotStatus)
                : 'approved' as LotStatus,
            endsAt: isDraft ? l.endsAt : cat.endsAt,
          }
        }),
      }))
      get().audit(
        isDraft ? 'catalogue.assign' : 'catalogue.publish',
        cat.code,
        isDraft ? `Assembled "${cat.title}" with ${lotIds.length} lots — assigned for field inspection` : `Published "${cat.title}" with ${lotIds.length} lots`,
        'info',
      )
      if (changed.length > 0) {
        get().audit('catalogue.override', cat.code,
          `${changed.length} seller term${changed.length === 1 ? '' : 's'} overridden — ${changed.map((c) => `${c.label} ${c.from} → ${c.to}`).join('; ')}`,
          'warning')
        if (cat.sellerId) {
          get().notify({
            userId: cat.sellerId, kind: 'system',
            title: `Terms adjusted on ${cat.code}`,
            body: `${changed.map((c) => `${c.label}: ${c.from} → ${c.to}`).join(' · ')}. Your original values are kept on the lot record.`,
            href: '/seller/lots',
          })
        }
      }
      if (!isDraft) {
        get().notify({ userId: null, kind: 'lifecycle', title: `New catalogue ${cat.code}`, body: cat.title, href: `/catalogue/${cat.id}` })
      } else if (cat.assignedFieldExecId) {
        // Assembled as a draft and routed for inspection — the field executive
        // is told, rather than left to discover it on their queue.
        get().notify({
          userId: cat.assignedFieldExecId, kind: 'system',
          title: `${cat.code} assigned to you`,
          body: `${lotIds.length} lot${lotIds.length === 1 ? '' : 's'} at ${cat.yardName} — ${cat.title}.`,
          href: `/field/catalogue/${cat.id}`,
        })
      }
    },

    assignCatalogue: (catalogueId, fieldExecId) => {
      set((st) => ({
        catalogues: st.catalogues.map((c) => (c.id === catalogueId ? { ...c, assignedFieldExecId: fieldExecId } : c)),
      }))
      const cat = get().catalogues.find((c) => c.id === catalogueId)
      const exec = get().users.find((u) => u.id === fieldExecId)
      get().audit('catalogue.assign', cat?.code ?? catalogueId, `Assigned to ${exec?.name ?? fieldExecId} for field inspection`)
      // Work never lands silently on the field executive's queue.
      if (cat) {
        get().notify({
          userId: fieldExecId, kind: 'system',
          title: `${cat.code} assigned to you`,
          body: `${cat.lotIds.length} lot${cat.lotIds.length === 1 ? '' : 's'} at ${cat.yardName} — inspection window ${new Date(cat.inspectionFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}–${new Date(cat.inspectionTo).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}.`,
          href: `/field/catalogue/${cat.id}`,
        })
      }
    },

    waiveInspection: (lotId, managerId, reason) => {
      if (!LOT_GATE_ROLES.includes(get().role)) return { ok: false, error: 'Only Operations or a Sub Admin may bypass an inspection' }
      const lot = get().lots.find((l) => l.id === lotId)
      if (!lot) return { ok: false, error: 'Lot not found' }
      // The typed reason *is* the control. Bypass is deliberately not gated
      // behind a second approver, so an empty reason would leave nothing at all
      // standing between a seller's word and the marketplace.
      if (!reason.trim()) return { ok: false, error: 'A typed reason is required to bypass an inspection' }
      set((st) => ({
        lots: st.lots.map((l) =>
          l.id === lotId
            ? { ...l, status: 'approved' as LotStatus, inspectionWaived: true, waivedBy: managerId, waivedReason: reason, waivedAt: new Date(st.now).toISOString() }
            : l,
        ),
      }))
      // Warning severity, not info: this lot goes to market described on the
      // seller's word alone, and the monthly count of these is a quality metric.
      get().audit('inspection.bypass', lot.lotNo, `Inspection bypassed — ${reason}`, 'warning')
      const cat = get().catalogues.find((c) => c.id === lot.catalogueId)
      if (cat?.sellerId) {
        get().notify({
          userId: cat.sellerId, kind: 'system',
          title: `${lot.lotNo} accepted without inspection`,
          body: `Accepted on your description — ${reason}. The quantity stays indicative and is final on weighment.`,
          href: '/seller/lots',
        })
      }
      announceCatalogueReady(lot.catalogueId)
      return { ok: true }
    },

    publishDraftCatalogue: (catalogueId, mode) => {
      const s = get()
      // The publish gate is a state boundary, not a role boundary: four roles
      // may press it, and whoever does is named in the audit entry.
      if (!PUBLISH_ROLES.includes(s.role)) return { ok: false, error: 'Not permitted for this role' }
      const cat = s.catalogues.find((c) => c.id === catalogueId)
      if (!cat) return { ok: false, error: 'Catalogue not found' }
      const catLots = s.lots.filter((l) => l.catalogueId === catalogueId)
      const unresolved = catLots.filter((l) => l.status !== 'approved')
      if (unresolved.length > 0) {
        return { ok: false, error: `${unresolved.length} lot${unresolved.length > 1 ? 's' : ''} still need${unresolved.length > 1 ? '' : 's'} approval` }
      }
      /* The CEO threshold is a rule about the sale, not about the button that
         starts it — so it is enforced here rather than only by a disabled
         control on one screen. Anything at or above the configured value stays
         private until a signature is on record. */
      const reserveValue = catLots.reduce((sum, l) => sum + l.reserveRate * l.indicativeQty, 0)
      if (reserveValue >= s.financeConfig.ceoPublishValueFrom) {
        const signed = s.ceoApprovals.some(
          (a) => a.kind === 'auction_publish' && a.refId === catalogueId && a.status === 'approved',
        )
        if (!signed) {
          const pending = s.ceoApprovals.find(
            (a) => a.kind === 'auction_publish' && a.refId === catalogueId
              && (a.status === 'pending' || a.status === 'info_requested'),
          )
          return {
            ok: false,
            error: pending
              ? `${cat.code} is with the CEO for signature — ${inr(reserveValue)} at reserve is above the ${inr(s.financeConfig.ceoPublishValueFrom)} threshold.`
              : `${inr(reserveValue)} at reserve is above the ${inr(s.financeConfig.ceoPublishValueFrom)} publish threshold. Send it for the CEO's signature first.`,
          }
        }
      }
      const nowMs = s.now
      let endsAt = Date.parse(cat.endsAt)
      if (mode === 'now' && endsAt <= nowMs) endsAt = nowMs + 3 * 3600_000
      const status = mode === 'now' ? ('live' as const) : ('upcoming' as const)
      const endsAtIso = new Date(endsAt).toISOString()
      set((st) => ({
        catalogues: st.catalogues.map((c) =>
          c.id === catalogueId
            ? (() => {
                const startsAt = new Date(mode === 'now' ? nowMs : Date.parse(c.startsAt)).toISOString()
                const nowIso = new Date(nowMs).toISOString()
                return {
                  ...c, status, startsAt, endsAt: endsAtIso,
                  /* Going live now leaves no pre-auction window, so the window
                     is shut at "now". A scheduled sale keeps the times the
                     desk set on Schedule & publish — recomputing them here
                     would quietly overwrite a cut-off somebody chose. */
                  emdOpensAt: mode === 'now' && c.emdOpensAt && Date.parse(c.emdOpensAt) > nowMs ? nowIso : c.emdOpensAt,
                  emdDeadline: mode === 'now' ? nowIso : (c.emdDeadline || defaultEmdDeadline(startsAt)),
                }
              })()
            : c,
        ),
        lots: st.lots.map((l) =>
          l.catalogueId === catalogueId
            ? { ...l, status: status === 'live' ? ('live' as LotStatus) : ('approved' as LotStatus), endsAt: endsAtIso }
            : l,
        ),
      }))
      get().audit('catalogue.publish', cat.code, `Published "${cat.title}" with ${catLots.length} lots`, 'info')
      // Public from here: the marketplace notice is genuinely for everyone.
      get().notify({ userId: null, kind: 'lifecycle', title: `New catalogue ${cat.code}`, body: cat.title, href: `/catalogue/${cat.id}` })
      /* Publishing hands the sale to the auction floor and tells the seller
         their material is on the market — neither used to be said. */
      notifyRole(['auction_manager', 'sub_admin'], {
        kind: 'lifecycle', title: `${cat.code} is ${status === 'live' ? 'live' : 'scheduled'}`,
        body: `${catLots.length} lot${catLots.length === 1 ? '' : 's'} at ${cat.yardName}. ${status === 'live' ? 'It is on the floor now.' : `Opens ${new Date(Date.parse(cat.startsAt)).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}.`}`,
        href: status === 'live' ? '/auction/live' : '/auction/schedule',
      }, s.currentUser?.id)
      if (cat.sellerId) {
        get().notify({
          userId: cat.sellerId, kind: 'lifecycle',
          title: `${cat.code} is ${status === 'live' ? 'live' : 'scheduled'}`,
          body: status === 'live'
            ? `Your ${catLots.length} lot${catLots.length === 1 ? ' is' : 's are'} on the marketplace and EMD funding is open.`
            : `Your ${catLots.length} lot${catLots.length === 1 ? '' : 's'} go to market on schedule. Buyers can see the catalogue and fund EMD now.`,
          href: '/seller/monitor',
        })
      }
      return { ok: true }
    },

    pauseCatalogue: (catalogueId, reason) => {
      if (!AUCTION_FLOOR_ROLES.includes(get().role)) return
      set((st) => ({ paused: { ...st.paused, [catalogueId]: true } }))
      const cat = get().catalogues.find((c) => c.id === catalogueId)
      get().audit('auction.pause', cat?.code ?? catalogueId, `Auction paused${reason ? ` — ${reason}` : ''}`, 'warning')
      notifyParticipants(catalogueId, {
        kind: 'lifecycle', title: `${cat?.code ?? 'Auction'} paused`,
        body: reason || 'Bidding is on hold and every countdown is frozen. You will be told when it resumes.',
      })
    },
    resumeCatalogue: (catalogueId) => {
      if (!AUCTION_FLOOR_ROLES.includes(get().role)) return
      set((st) => ({ paused: { ...st.paused, [catalogueId]: false } }))
      const cat = get().catalogues.find((c) => c.id === catalogueId)
      get().audit('auction.resume', cat?.code ?? catalogueId, 'Auction resumed — countdowns running again', 'warning')
      notifyParticipants(catalogueId, {
        kind: 'lifecycle', title: `${cat?.code ?? 'Auction'} resumed`,
        body: 'Bidding is open again. Countdowns have restarted from where they froze.',
      })
    },
    extendCatalogue: (catalogueId, minutes, reason) => {
      if (!AUCTION_FLOOR_ROLES.includes(get().role)) return
      const ms = minutes * 60_000
      set((st) => ({
        catalogues: st.catalogues.map((c) => (c.id === catalogueId ? { ...c, endsAt: new Date(Date.parse(c.endsAt) + ms).toISOString() } : c)),
        lots: st.lots.map((l) => (l.catalogueId === catalogueId && l.status === 'live' ? { ...l, endsAt: new Date(Date.parse(l.endsAt) + ms).toISOString() } : l)),
      }))
      const cat = get().catalogues.find((c) => c.id === catalogueId)
      get().audit('auction.extend', cat?.code ?? catalogueId, `Extended by ${minutes} minutes${reason ? ` — ${reason}` : ''}`, 'warning')
      notifyParticipants(catalogueId, {
        kind: 'lifecycle', title: `${cat?.code ?? 'Auction'} extended by ${minutes} min`,
        body: reason || 'Every live lot in this auction now closes later. Your existing bids stand.',
      })
    },
    cancelCatalogue: (catalogueId) => {
      // Executing a cancellation is Super Admin only — the Auction Manager and
      // Sub Admin raise it as a request (see requestCancellation).
      if (get().role !== 'super_admin') return
      set((st) => ({
        catalogues: st.catalogues.map((c) => (c.id === catalogueId ? { ...c, status: 'closed' as const } : c)),
        lots: st.lots.map((l) => (l.catalogueId === catalogueId && ['live', 'approved'].includes(l.status) ? { ...l, status: 'unsold' as LotStatus } : l)),
      }))
      const cat = get().catalogues.find((c) => c.id === catalogueId)
      get().audit('auction.cancel', cat?.code ?? catalogueId, 'Auction cancelled — all open lots voided, EMD released', 'critical')
      notifyParticipants(catalogueId, {
        kind: 'lifecycle', title: `${cat?.code ?? 'Auction'} cancelled`,
        body: 'Every open lot is now unsold and the EMD you had locked on this auction has been released.',
      })
    },
    voidBid: (bidId) => {
      if (get().role !== 'super_admin') return
      const s = get()
      const bid = s.bids.find((b) => b.id === bidId)
      if (!bid) return
      const remaining = s.bids.filter((b) => b.lotId === bid.lotId && b.status === 'valid' && b.id !== bidId)
      const top = remaining.sort((a, b) => b.rate - a.rate)[0] ?? null
      const lot = s.lots.find((l) => l.id === bid.lotId)
      set((st) => ({
        bids: st.bids.map((b) => (b.id === bidId ? { ...b, status: 'void' as const } : b)),
        lots: st.lots.map((l) =>
          l.id === bid.lotId
            ? { ...l, currentRate: top?.rate ?? null, leadingBidderId: top?.bidderId ?? null, bidCount: remaining.length }
            : l,
        ),
      }))
      get().audit('bid.void', lot?.lotNo ?? bidId, `Bid of ${inr(bid.rate)} on ${lot?.lotNo ?? bid.lotId} voided — ladder recomputed`, 'critical')
      /* Voiding a bid changes two people's position in a live sale and neither
         used to be told: the bidder whose offer was struck out, and whoever the
         recomputed ladder has just put in front. */
      get().notify({
        userId: bid.bidderId, kind: 'bid', title: `Your bid on ${lot?.lotNo ?? 'a lot'} was voided`,
        body: `${inr(bid.rate)}/${lot?.uom ?? 'MT'} has been struck from the ladder after review. You can bid again if the lot is still open.`,
        href: lot?.catalogueId ? `/bidding/${lot.catalogueId}?lot=${bid.lotId}` : '/buyer/bids',
      })
      if (top && top.bidderId !== bid.bidderId) {
        get().notify({
          userId: top.bidderId, kind: 'bid', title: `You are leading ${lot?.lotNo ?? 'a lot'}`,
          body: `A bid above yours was voided after review. Your ${inr(top.rate)}/${lot?.uom ?? 'MT'} is now H1.`,
          href: lot?.catalogueId ? `/bidding/${lot.catalogueId}?lot=${bid.lotId}` : '/buyer/bids',
        })
      }
    },

    /* ------------------------- auction floor -------------------------------
       Publishing and EMD eligibility are shared with Operations; running the
       sale is this desk's own. The two irreversible calls — cancelling a sale
       and voiding a bid — leave here as requests and are closed by a Super
       Admin, which is why they are modelled as records with evidence. */

    rescheduleCatalogue: (catalogueId, { emdOpensAt, emdDeadline, startsAt, endsAt, antiSnipeMinutes }) => {
      if (!PUBLISH_ROLES.includes(get().role)) return { ok: false, error: 'Not permitted for this role' }
      const cat = get().catalogues.find((c) => c.id === catalogueId)
      if (!cat) return { ok: false, error: 'Auction not found' }
      if (cat.status === 'live' || cat.status === 'closed') {
        return { ok: false, error: 'Only an auction that has not gone live can be rescheduled' }
      }
      /* The four instants have to run in order — EMD opens, EMD closes, bidding
         opens, bidding closes. An EMD window that shuts after bidding starts
         would let a buyer join a sale they were never able to fund, and one
         that opens after it shuts can be funded by nobody at all. */
      if (Date.parse(emdDeadline) <= Date.parse(emdOpensAt)) {
        return { ok: false, error: 'EMD has to close after it opens' }
      }
      if (Date.parse(emdDeadline) > Date.parse(startsAt)) {
        return { ok: false, error: 'EMD has to close before bidding opens — buyers fund first, then bid' }
      }
      if (Date.parse(endsAt) <= Date.parse(startsAt)) return { ok: false, error: 'The close must fall after the start' }
      set((st) => ({
        catalogues: st.catalogues.map((c) =>
          c.id === catalogueId
            ? { ...c, startsAt, endsAt, antiSnipeMinutes, emdOpensAt, emdDeadline }
            : c,
        ),
        lots: st.lots.map((l) => (l.catalogueId === catalogueId ? { ...l, endsAt } : l)),
      }))
      const stamp = (iso: string) => new Date(iso).toLocaleString('en-IN')
      get().audit('auction.reschedule', cat.code, `Rescheduled — EMD ${stamp(emdOpensAt)} → ${stamp(emdDeadline)}, bidding ${stamp(startsAt)} → ${stamp(endsAt)}, anti-snipe ${antiSnipeMinutes} min`, 'warning')
      /* Buyers plan around these times — they have shortlisted lots and in most
         cases already locked EMD against them — and the seller is waiting on
         the sale. Moving the dates without telling either was the gap. */
      notifyParticipants(catalogueId, {
        kind: 'lifecycle', title: `${cat.code} has been rescheduled`,
        // the EMD cut-off moves with the sale now, so it is stated rather than
        // left for a buyer to discover when funding is refused
        body: `Bidding now opens ${new Date(startsAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} and closes ${new Date(endsAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}, with pre-bid EMD open until ${new Date(emdDeadline).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}. EMD you have already funded, and your shortlist, carry over.`,
      })
      if (cat.sellerId) {
        get().notify({
          userId: cat.sellerId, kind: 'lifecycle', title: `${cat.code} has been rescheduled`,
          body: `Your sale now runs ${new Date(startsAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} → ${new Date(endsAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}. Nothing about your lots or reserves has changed.`,
          href: '/seller/monitor',
        })
      }
      return { ok: true }
    },

    returnCatalogueToOps: (catalogueId, comments) => {
      if (!PUBLISH_ROLES.includes(get().role)) return
      const cat = get().catalogues.find((c) => c.id === catalogueId)
      if (!cat || cat.status === 'live' || cat.status === 'closed') return
      set((st) => ({
        catalogues: st.catalogues.map((c) => (c.id === catalogueId ? { ...c, status: 'draft' as const } : c)),
      }))
      get().audit('auction.return_to_ops', cat.code, `Returned to Operations before publish — ${comments}`, 'warning')
      notifyRole(['exec_manager', 'sub_admin'], {
        kind: 'system',
        title: `${cat.code} returned to Operations`, body: comments, href: '/exec/catalogue-builder',
      })
    },

    requestCancellation: (catalogueId, reason) => {
      if (!AUCTION_FLOOR_ROLES.includes(get().role)) return { ok: false, error: 'Not permitted for this role' }
      const s = get()
      const cat = s.catalogues.find((c) => c.id === catalogueId)
      if (!cat) return { ok: false, error: 'Auction not found' }
      if (s.cancellationRequests.some((r) => r.catalogueId === catalogueId && r.status === 'pending')) {
        return { ok: false, error: 'A cancellation request for this auction is already with the Super Admin' }
      }
      const req: CancellationRequest = {
        id: uid('cxr'), catalogueId, reason,
        requestedBy: s.currentUser?.id ?? 'system',
        requestedAt: new Date(s.now).toISOString(),
        status: 'pending',
      }
      set((st) => ({ cancellationRequests: [req, ...st.cancellationRequests] }))
      get().audit('auction.cancel_request', cat.code, `Cancellation requested — ${reason}`, 'critical')
      notifyRole('super_admin', {
        kind: 'system',
        title: `Cancellation requested — ${cat.code}`, body: reason, href: '/admin/control-tower',
      })
      return { ok: true }
    },

    decideCancellationRequest: (id, approve, note) => {
      if (get().role !== 'super_admin') return
      const s = get()
      const req = s.cancellationRequests.find((r) => r.id === id)
      if (!req || req.status !== 'pending') return
      set((st) => ({
        cancellationRequests: st.cancellationRequests.map((r) =>
          r.id === id
            ? { ...r, status: approve ? ('approved' as const) : ('rejected' as const), decidedBy: st.currentUser?.id, decidedAt: new Date(st.now).toISOString(), decisionNote: note }
            : r,
        ),
      }))
      const cat = s.catalogues.find((c) => c.id === req.catalogueId)
      if (approve) get().cancelCatalogue(req.catalogueId)
      get().audit(
        approve ? 'auction.cancel_approve' : 'auction.cancel_refuse',
        cat?.code ?? req.catalogueId,
        approve ? `Cancellation approved${note ? ` — ${note}` : ''}` : `Cancellation refused${note ? ` — ${note}` : ''} — the auction runs to its scheduled close`,
        'critical',
      )
      get().notify({
        userId: req.requestedBy, kind: 'system',
        title: approve ? `${cat?.code ?? 'Auction'} cancellation approved` : `${cat?.code ?? 'Auction'} cancellation refused`,
        body: note || (approve ? 'Open lots are unsold and EMD has been released.' : 'The auction continues to its scheduled close.'),
        href: '/auction/live',
      })
    },

    flagBid: (bidId, reason, notes) => {
      if (!SURVEILLANCE_ROLES.includes(get().role)) return
      const s = get()
      const bid = s.bids.find((b) => b.id === bidId)
      if (!bid || s.bidVoidRequests.some((r) => r.bidId === bidId && r.status === 'pending')) return
      const lot = s.lots.find((l) => l.id === bid.lotId)
      const req: BidVoidRequest = {
        id: uid('bvr'), bidId, lotId: bid.lotId, catalogueId: bid.catalogueId,
        reason, notes,
        raisedBy: s.currentUser?.id ?? 'system',
        raisedAt: new Date(s.now).toISOString(),
        stage: 'flagged', status: 'pending',
      }
      set((st) => ({ bidVoidRequests: [req, ...st.bidVoidRequests] }))
      get().audit('bid.flag', lot?.lotNo ?? bid.lotId, `${reason} — ${inr(bid.rate)} on ${lot?.lotNo ?? bid.lotId}${notes ? ` · ${notes}` : ''}`, 'warning')
      /* A flag is only worth raising if the desk that can escalate it hears
         about it while the auction is still running. Whoever flagged is left
         off — they know. */
      notifyRole(['auction_manager', 'sub_admin'], {
        kind: 'system', title: `Bid flagged — ${lot?.lotNo ?? 'a lot'}`,
        body: `${reason} · ${inr(bid.rate)}/${lot?.uom ?? 'MT'}${notes ? ` — ${notes}` : ''}. Decide whether to request a void from the Super Admin.`,
        href: '/auction/bid-monitor',
      }, s.currentUser?.id)
    },

    requestBidVoid: (requestId, note) => {
      if (!SURVEILLANCE_ROLES.includes(get().role)) return
      const s = get()
      const req = s.bidVoidRequests.find((r) => r.id === requestId)
      if (!req || req.status !== 'pending' || req.stage !== 'flagged') return
      set((st) => ({
        bidVoidRequests: st.bidVoidRequests.map((r) =>
          r.id === requestId
            ? { ...r, stage: 'requested' as const, requestedBy: st.currentUser?.id, requestedAt: new Date(st.now).toISOString(), notes: note ? `${r.notes ? `${r.notes} · ` : ''}${note}` : r.notes }
            : r,
        ),
      }))
      const lot = s.lots.find((l) => l.id === req.lotId)
      get().audit('bid.void_request', lot?.lotNo ?? req.lotId, `Void requested from Super Admin — ${req.reason}${note ? ` · ${note}` : ''}`, 'critical')
      notifyRole('super_admin', {
        kind: 'system',
        title: `Void requested — ${lot?.lotNo ?? 'bid'}`, body: req.reason, href: '/admin/control-tower',
      })
    },

    dismissBidFlag: (requestId, note) => {
      if (!SURVEILLANCE_ROLES.includes(get().role)) return
      const s = get()
      const req = s.bidVoidRequests.find((r) => r.id === requestId)
      if (!req || req.status !== 'pending') return
      set((st) => ({
        bidVoidRequests: st.bidVoidRequests.map((r) =>
          r.id === requestId
            ? { ...r, status: 'rejected' as const, decidedBy: st.currentUser?.id, decidedAt: new Date(st.now).toISOString(), decisionNote: note ?? 'Reviewed — bidding was legitimate' }
            : r,
        ),
      }))
      const lot = s.lots.find((l) => l.id === req.lotId)
      // Dismissed, not erased — the flag stays on the record either way.
      get().audit('bid.flag_dismiss', lot?.lotNo ?? req.lotId, `Flag reviewed and dismissed${note ? ` — ${note}` : ''} — the bid stands`, 'warning')
      // Whoever raised the flag is told what came of it — a surveillance chain
      // that never answers back stops being used.
      if (req.raisedBy && req.raisedBy !== s.currentUser?.id) {
        get().notify({
          userId: req.raisedBy, kind: 'system', title: `Flag dismissed — ${lot?.lotNo ?? 'a lot'}`,
          body: note || 'Reviewed and found legitimate. The bid stands and the flag remains on record.',
          href: '/sub/bid-monitor',
        })
      }
    },

    decideBidVoidRequest: (id, approve, note) => {
      if (get().role !== 'super_admin') return
      const s = get()
      const req = s.bidVoidRequests.find((r) => r.id === id)
      if (!req || req.status !== 'pending') return
      set((st) => ({
        bidVoidRequests: st.bidVoidRequests.map((r) =>
          r.id === id
            ? { ...r, status: approve ? ('approved' as const) : ('rejected' as const), decidedBy: st.currentUser?.id, decidedAt: new Date(st.now).toISOString(), decisionNote: note }
            : r,
        ),
      }))
      if (approve) get().voidBid(req.bidId)
      const lot = s.lots.find((l) => l.id === req.lotId)
      get().audit(
        approve ? 'bid.void_approve' : 'bid.void_refuse',
        lot?.lotNo ?? req.lotId,
        approve ? `Void approved${note ? ` — ${note}` : ''}` : `Void refused${note ? ` — ${note}` : ''} — the bid stands, the flag remains on record`,
        'critical',
      )
      get().notify({
        userId: req.requestedBy ?? req.raisedBy, kind: 'system',
        title: approve ? 'Bid voided' : 'Void request refused',
        body: note || (approve ? 'The ladder has been recomputed from the remaining valid bids.' : 'The bid stands. The flag remains on record.'),
        href: '/auction/bid-monitor',
      })
    },

    sendAnnouncement: ({ scope, catalogueId, title, body, severity }) => {
      if (!ANNOUNCE_ROLES.includes(get().role)) return { ok: false, error: 'Not permitted for this role' }
      if (!title.trim() || !body.trim()) return { ok: false, error: 'A title and a message are both required' }
      if (scope === 'catalogue' && !catalogueId) return { ok: false, error: 'Pick the auction this notice belongs to' }
      const s = get()
      const cat = catalogueId ? s.catalogues.find((c) => c.id === catalogueId) : undefined
      const record: Announcement = {
        id: uid('ann'), scope, catalogueId: scope === 'catalogue' ? catalogueId : undefined,
        title: title.trim(), body: body.trim(),
        at: new Date(s.now).toISOString(), severity,
      }
      set((st) => ({ announcements: [record, ...st.announcements] }))
      get().audit('announcement.send', cat?.code ?? 'platform', `${severity.toUpperCase()} · ${title.trim()}`, severity === 'critical' ? 'warning' : 'info')
      if (scope === 'catalogue' && catalogueId) {
        notifyParticipants(catalogueId, { kind: 'system', title, body, href: `/catalogue/${catalogueId}` })
      } else {
        get().notify({ userId: null, kind: 'system', title, body, href: '/noticeboard' })
      }
      return { ok: true }
    },

    confirmAuctionResults: (catalogueId) => {
      if (!RESULT_ROLES.includes(get().role)) return { ok: false, error: 'Not permitted for this role' }
      const s = get()
      const cat = s.catalogues.find((c) => c.id === catalogueId)
      if (!cat) return { ok: false, error: 'Auction not found' }
      if (cat.status !== 'closed') return { ok: false, error: 'Results can only be confirmed once the auction has closed' }
      if (s.resultConfirmations.some((r) => r.catalogueId === catalogueId)) {
        return { ok: false, error: 'These results have already been confirmed' }
      }
      const catLots = s.lots.filter((l) => l.catalogueId === catalogueId)
      const undecided = catLots.filter((l) => l.status === 'sta' && !s.staReferrals.some((r) => r.lotId === l.id))
      if (undecided.length > 0) {
        return { ok: false, error: `${undecided.length} lot${undecided.length > 1 ? 's' : ''} cleared below reserve and still need${undecided.length > 1 ? '' : 's'} an Operations decision` }
      }
      const sold = catLots.filter((l) => l.status === 'sold')
      const realisation = sold.reduce((sum, l) => sum + (l.resultH1Rate ?? l.currentRate ?? 0) * l.indicativeQty, 0)
      const record: ResultConfirmation = {
        catalogueId,
        confirmedBy: s.currentUser?.id ?? 'system',
        confirmedAt: new Date(s.now).toISOString(),
        lotsSold: sold.length,
        lotsUnsold: catLots.filter((l) => l.status === 'unsold').length,
        realisation,
      }
      set((st) => ({ resultConfirmations: [record, ...st.resultConfirmations] }))
      get().audit('auction.results_confirm', cat.code, `Results confirmed — ${sold.length} of ${catLots.length} lots sold, realisation ${inr(realisation)}`, 'info')
      // Confirmation is the hand-off that opens the seller's accept/reject step.
      get().notify({
        userId: cat.sellerId, kind: 'system', title: `${cat.code} results confirmed`,
        body: `${sold.length} lot${sold.length === 1 ? '' : 's'} sold. Review each cleared price and settle commission.`,
        href: '/seller/settlement',
      })
      return { ok: true }
    },

    referStaLot: (lotId, note) => {
      if (!RESULT_ROLES.includes(get().role)) return
      const s = get()
      const lot = s.lots.find((l) => l.id === lotId)
      if (!lot || lot.status !== 'sta' || s.staReferrals.some((r) => r.lotId === lotId)) return
      const referral: StaReferral = {
        id: uid('star'), lotId, catalogueId: lot.catalogueId, note,
        referredBy: s.currentUser?.id ?? 'system',
        referredAt: new Date(s.now).toISOString(),
      }
      set((st) => ({ staReferrals: [referral, ...st.staReferrals] }))
      const cat = s.catalogues.find((c) => c.id === lot.catalogueId)
      get().audit('auction.sta_refer', lot.lotNo, `Below-reserve lot referred to Operations (${cat?.code ?? lot.catalogueId}) — ${note}`, 'warning')
      notifyRole(['exec_manager', 'sub_admin'], {
        kind: 'system',
        title: `${lot.lotNo} referred — cleared below reserve`,
        body: note, href: '/exec/settlement',
      })
    },
    setUserStanding: (userId, standing, reason) => {
      set((st) => ({
        users: st.users.map((u) => (u.id === userId ? { ...u, standing, blacklistReason: reason ?? u.blacklistReason } : u)),
      }))
      const u = get().users.find((x) => x.id === userId)
      get().audit('user.standing', u?.firm ?? userId, `Standing set to ${standing}${reason ? ` — ${reason}` : ''}`, standing === 'defaulter' ? 'critical' : 'warning')
      /* Standing changes what a customer may do on the platform, so they are
         told what changed and why rather than finding out at a locked button. */
      get().notify({
        userId, kind: 'system',
        title: {
          good: 'Your account standing has been restored',
          watchlist: 'Your account has been placed on watchlist',
          defaulter: 'Your account has been restricted',
        }[standing],
        body: standing === 'good'
          ? 'Full access is back. Nothing further is needed from you.'
          : `${reason ?? 'Reviewed by our operations team.'} Contact support if you believe this is a mistake.`,
        href: '/disputes',
      })
      // Money at risk against a restricted account is Finance's problem too.
      if (standing === 'defaulter') {
        notifyRole('finance_admin', {
          kind: 'system', title: `Account restricted — ${u?.firm ?? userId}`,
          body: `${reason ?? 'Marked as a defaulter by operations.'} Check any EMD held and open delivery orders against this account.`,
          href: '/finance/emd',
        })
      }
    },
    // Recording a Demand Draft received from the buyer offline — Finance's
    // collection step, which replaces the generic advance for
    // payment_pending→dd_issued. Operations keeps it too: the DD often arrives
    // at the yard rather than at the finance desk.
    issueDemandDraft: (doId, dd) => {
      const role = get().role
      if (!FINANCE_ROLES.includes(role) && role !== 'sub_admin' && role !== 'exec_manager') return
      const me = get().currentUser
      const d = get().deliveryOrders.find((x) => x.id === doId)
      if (!d || d.stage !== 'payment_pending') return
      const draft: DemandDraft = {
        id: uid('dd'), doId, ddNumber: dd.ddNumber, issuingBank: dd.issuingBank, amount: dd.amount,
        issuedAt: new Date(get().now).toISOString(), issuedBy: me?.id ?? 'system',
      }
      set((st) => ({
        demandDrafts: [...st.demandDrafts, draft],
        deliveryOrders: st.deliveryOrders.map((x) =>
          x.id === doId
            ? { ...x, ddId: draft.id, stage: 'dd_issued' as const, paidAmount: x.materialValue + x.gstAmount + x.tcsAmount }
            : x,
        ),
      }))
      const ddLot = get().lots.find((l) => l.id === d.lotId)
      get().audit('dd.issue', ddLot?.lotNo ?? doId, `Demand Draft ${dd.ddNumber} (${dd.issuingBank}) for ${inr(dd.amount)} recorded`)
      /* Recording the draft is what releases the order for lifting, so both the
         buyer and the desk that did not record it are told. A DD taken at the
         yard has to reach Finance; one taken at the desk has to reach
         Operations. */
      get().notify({
        userId: d.buyerId, kind: 'wallet', title: `Payment recorded — ${ddLot?.lotNo ?? 'your lot'}`,
        body: `Demand Draft ${dd.ddNumber} for ${inr(dd.amount)} is on the record. Lifting can be scheduled.`,
        href: '/buyer/auction-status',
      })
      notifyRole(FINANCE_ROLES.includes(role) ? ['exec_manager', 'sub_admin'] : ['finance_admin'], {
        kind: 'system', title: `Demand Draft recorded — ${ddLot?.lotNo ?? doId}`,
        body: `${dd.ddNumber} (${dd.issuingBank}) for ${inr(dd.amount)}, recorded by ${me?.name ?? 'a colleague'}.`,
        href: FINANCE_ROLES.includes(role) ? '/exec/logistics' : '/finance/payments',
      })
    },

    verifyBankAccount: (id) => {
      const role = get().role
      if (!FINANCE_ROLES.includes(role)) return
      const a = get().bankAccounts.find((x) => x.id === id)
      if (!a || a.status !== 'pending') return
      set((st) => ({ bankAccounts: st.bankAccounts.map((x) => (x.id === id ? { ...x, status: 'verified' as const } : x)) }))
      get().audit('bankaccount.verify', id, `${a.bankName} account •••• ${a.last4} verified`)
      get().notify({ userId: a.userId, kind: 'wallet', title: 'Bank account verified', body: `${a.bankName} •••• ${a.last4} can now receive withdrawals.`, href: '/buyer/wallet' })
    },

    rejectBankAccount: (id, reason) => {
      const role = get().role
      if (!FINANCE_ROLES.includes(role)) return
      const a = get().bankAccounts.find((x) => x.id === id)
      if (!a || a.status !== 'pending') return
      set((st) => ({ bankAccounts: st.bankAccounts.map((x) => (x.id === id ? { ...x, status: 'rejected' as const, rejectionReason: reason } : x)) }))
      get().audit('bankaccount.reject', id, `${a.bankName} account •••• ${a.last4} rejected${reason ? ` — ${reason}` : ''}`, 'warning')
      get().notify({ userId: a.userId, kind: 'wallet', title: 'Bank account rejected', body: reason || 'Please re-register with correct details.', href: '/buyer/wallet' })
    },

    approveDepositClaim: (id) => {
      const role = get().role
      if (!FINANCE_ROLES.includes(role)) return
      const me = get().currentUser
      const claim = get().depositClaims.find((c) => c.id === id)
      if (!claim || claim.status !== 'submitted') return
      ensureWallet(claim.userId)
      set((st) => ({
        depositClaims: st.depositClaims.map((c) => (c.id === id ? { ...c, status: 'approved' as const, decidedAt: new Date(st.now).toISOString(), decidedBy: me?.id } : c)),
        wallets: st.wallets.map((w) =>
          w.userId === claim.userId
            ? {
                ...w, balance: w.balance + claim.amount,
                ledger: [{ id: uid('led'), at: new Date(st.now).toISOString(), type: 'topup' as const, amount: claim.amount, ref: claim.utr, note: `Deposit claim approved — UTR ${claim.utr}` }, ...w.ledger],
              }
            : w,
        ),
      }))
      get().audit('deposit.approve', id, `Deposit claim approved — ${inr(claim.amount)} credited (UTR ${claim.utr})`)
      get().notify({ userId: claim.userId, kind: 'wallet', title: 'Deposit approved', body: `${inr(claim.amount)} credited to your wallet.`, href: '/buyer/wallet' })
    },

    rejectDepositClaim: (id, reason) => {
      const role = get().role
      if (!FINANCE_ROLES.includes(role)) return
      const me = get().currentUser
      const claim = get().depositClaims.find((c) => c.id === id)
      if (!claim || claim.status !== 'submitted') return
      set((st) => ({
        depositClaims: st.depositClaims.map((c) => (c.id === id ? { ...c, status: 'rejected' as const, rejectionReason: reason, decidedAt: new Date(st.now).toISOString(), decidedBy: me?.id } : c)),
      }))
      get().audit('deposit.reject', id, `Deposit claim rejected${reason ? ` — ${reason}` : ''}`, 'warning')
      get().notify({ userId: claim.userId, kind: 'wallet', title: 'Deposit claim rejected', body: reason || 'Contact support for details.', href: '/buyer/wallet' })
    },

    /* Money out is two deliberate steps by two people. Review accepts the
       request into processing and records who did it; Process releases the
       payment and, above the configured threshold, refuses to be the same
       person. Together with deposit approval, one individual doing both would
       otherwise hold a complete round trip on customer money. */
    approveWithdrawal: (id) => {
      const role = get().role
      if (!FINANCE_ROLES.includes(role)) return
      const me = get().currentUser
      const req = get().withdrawalRequests.find((r) => r.id === id)
      if (!req || req.status !== 'requested') return
      set((st) => ({
        withdrawalRequests: st.withdrawalRequests.map((r) =>
          r.id === id ? { ...r, status: 'under_review' as const, reviewedBy: me?.id, reviewedAt: new Date(st.now).toISOString() } : r,
        ),
      }))
      get().audit('withdrawal.review', id, `Withdrawal of ${inr(req.amount)} reviewed into processing by ${me?.name ?? 'Finance'}`)
      /* Maker–checker only works if the checker knows there is something to
         release. Above the threshold it has to be a different Finance user, so
         whoever reviewed it is left off their own hand-off. */
      const needsSecond = req.amount >= get().financeConfig.withdrawalSecondSignatureFrom
      notifyRole('finance_admin', {
        kind: 'system', title: `Withdrawal ready to release — ${inr(req.amount)}`,
        body: `${get().users.find((u) => u.id === req.userId)?.firm ?? 'A customer'} · reviewed by ${me?.name ?? 'Finance'}.${needsSecond ? ' Above the second-signature threshold — a different Finance user must release it.' : ''}`,
        href: '/finance/withdrawals',
      }, needsSecond ? me?.id : undefined)
      get().notify({
        userId: req.userId, kind: 'wallet', title: 'Withdrawal under review',
        body: `${inr(req.amount)} has passed review and is queued for release to your verified account.`,
        href: '/buyer/wallet',
      })
    },

    processWithdrawal: (id) => {
      const role = get().role
      if (!FINANCE_ROLES.includes(role)) return
      const s = get()
      const me = s.currentUser
      const req = s.withdrawalRequests.find((r) => r.id === id)
      if (!req || req.status !== 'under_review') return
      if (
        req.amount >= s.financeConfig.withdrawalSecondSignatureFrom
        && req.reviewedBy
        && req.reviewedBy === me?.id
      ) {
        get().pushToast({
          kind: 'danger',
          title: 'A second pair of hands is required',
          body: `You reviewed this withdrawal. Above ${inr(s.financeConfig.withdrawalSecondSignatureFrom)} it must be released by a different Finance user.`,
        })
        get().audit('withdrawal.maker_checker_block', id, `Same-user release refused on ${inr(req.amount)} — reviewer and processor must differ`, 'warning')
        return
      }
      set((st) => ({
        withdrawalRequests: st.withdrawalRequests.map((r) =>
          r.id === id ? { ...r, status: 'processed' as const, processedBy: me?.id, decidedAt: new Date(st.now).toISOString() } : r,
        ),
      }))
      const reviewer = s.users.find((u) => u.id === req.reviewedBy)
      get().audit('withdrawal.process', id, `Withdrawal of ${inr(req.amount)} released to bank by ${me?.name ?? 'Finance'} — reviewed by ${reviewer?.name ?? 'Finance'}`)
      get().notify({ userId: req.userId, kind: 'wallet', title: 'Withdrawal processed', body: `${inr(req.amount)} sent to your bank account.`, href: '/buyer/wallet' })
    },

    failWithdrawal: (id, reason) => {
      const role = get().role
      if (!FINANCE_ROLES.includes(role)) return
      const req = get().withdrawalRequests.find((r) => r.id === id)
      if (!req || req.status !== 'under_review') return
      set((st) => ({
        withdrawalRequests: st.withdrawalRequests.map((r) => (r.id === id ? { ...r, status: 'failed' as const, reason, decidedAt: new Date(st.now).toISOString() } : r)),
        wallets: st.wallets.map((w) =>
          w.userId === req.userId
            ? { ...w, balance: w.balance + req.amount, ledger: [{ id: uid('led'), at: new Date(st.now).toISOString(), type: 'refund' as const, amount: req.amount, ref: req.ref, note: `Withdrawal failed — reversed${reason ? `: ${reason}` : ''}` }, ...w.ledger] }
            : w,
        ),
      }))
      get().audit('withdrawal.fail', id, `Withdrawal of ${inr(req.amount)} failed${reason ? ` — ${reason}` : ''} — reversed to wallet`, 'warning')
      get().notify({ userId: req.userId, kind: 'wallet', title: 'Withdrawal failed', body: `${inr(req.amount)} reversed to your wallet.${reason ? ` Reason: ${reason}` : ''}`, href: '/buyer/wallet' })
    },

    approveEmdExemption: (id) => {
      // An eligibility call, not a payment one — Finance sees it, never decides it.
      if (!PUBLISH_ROLES.includes(get().role)) return
      const me = get().currentUser
      const req = get().emdExemptionRequests.find((r) => r.id === id)
      if (!req || req.status !== 'pending') return
      set((st) => ({
        emdExemptionRequests: st.emdExemptionRequests.map((r) =>
          r.id === id ? { ...r, status: 'approved' as const, decidedAt: new Date(st.now).toISOString(), decidedBy: me?.id } : r,
        ),
      }))
      const cat = get().catalogues.find((c) => c.id === req.catalogueId)
      get().audit('emd_exemption.approve', cat?.code ?? req.catalogueId, 'EMD deadline exemption approved for buyer', 'warning')
      get().notify({
        userId: req.buyerId, kind: 'system', title: 'EMD exemption approved',
        body: `You can now fund EMD for ${cat?.code ?? 'this catalogue'} and join the auction.`, href: '/buyer/emd-shortlisted-catalogue',
      })
    },

    rejectEmdExemption: (id, reason) => {
      if (!PUBLISH_ROLES.includes(get().role)) return
      const me = get().currentUser
      const req = get().emdExemptionRequests.find((r) => r.id === id)
      if (!req || req.status !== 'pending') return
      set((st) => ({
        emdExemptionRequests: st.emdExemptionRequests.map((r) =>
          r.id === id ? { ...r, status: 'rejected' as const, rejectionReason: reason, decidedAt: new Date(st.now).toISOString(), decidedBy: me?.id } : r,
        ),
      }))
      const cat = get().catalogues.find((c) => c.id === req.catalogueId)
      get().audit('emd_exemption.reject', cat?.code ?? req.catalogueId, `EMD deadline exemption rejected${reason ? ` — ${reason}` : ''}`, 'warning')
      get().notify({
        userId: req.buyerId, kind: 'system', title: 'EMD exemption rejected',
        body: reason || `Your request for ${cat?.code ?? 'this catalogue'} was not approved.`, href: '/buyer/emd-shortlisted-catalogue',
      })
    },

    setWithdrawalWindow: (config) => {
      const role = get().role
      if (role !== 'super_admin') return
      set({ withdrawalWindow: config })
      get().audit('withdrawal.window_config', 'withdrawal_window', `Withdrawal window updated — ${config.days.length} day(s)/week, ${String(config.startHour).padStart(2, '0')}:${String(config.startMinute).padStart(2, '0')}–${String(config.endHour).padStart(2, '0')}:${String(config.endMinute).padStart(2, '0')} IST`)
    },

    setCompanyBankAccounts: (accounts) => {
      const role = get().role
      if (role !== 'super_admin') return
      set({ companyBankAccounts: accounts })
      get().audit('companybank.update', 'company_bank_accounts', `Company bank account list updated — ${accounts.length} account(s)`)
    },

    /* ======================= Finance Administrator =======================
       Money in → money held → money out → the records that prove it. Two rules
       run through every action below. Anything that takes money away from a
       customer needs a person and a typed reason. Anything above a CEO
       threshold leaves this desk as a request rather than completing here — and
       the requester keeps sight of it while it is away. */

    setFinanceConfig: (patch) => {
      if (get().role !== 'super_admin') return
      const before = get().financeConfig
      const next = { ...before, ...patch }
      const moved = (Object.keys(patch) as (keyof FinanceConfig)[]).filter((k) => before[k] !== next[k])
      const changed = moved.map((k) => `${FINANCE_FIELD_LABEL[k]}: ${before[k]} → ${next[k]}`)
      if (changed.length === 0) return
      set({ financeConfig: next })
      get().audit('finance.config', 'financial_configuration', changed.join(' · '), 'warning')
      /* Recorded with no snapshot on purpose. A rate is not structure: the fee
         half only moves on the CEO's signature, and putting one back is itself
         a rate change needing the same signature. So Change history answers
         "what changed, when and by whom", and Financial config stays the one
         place a rate is actually set. */
      recordStructural('config.update', 'Financial configuration',
        `${moved.map((k) => FINANCE_FIELD_LABEL[k]).join(', ')} changed. Every screen reading these figures moved at the same moment.`,
        moved.map((k) => `${FINANCE_FIELD_LABEL[k]} ${before[k]}`).join(' · '),
        moved.map((k) => `${FINANCE_FIELD_LABEL[k]} ${next[k]}`).join(' · '))
    },

    /* ------------------------- commission settlements ------------------- */
    confirmCommissionSettlement: (id, bankLineId) => {
      if (!FINANCE_ROLES.includes(get().role)) return { ok: false, error: 'Only Finance can confirm a settlement' }
      const s = get()
      const me = s.currentUser
      const record = s.commissionSettlements.find((r) => r.id === id)
      if (!record) return { ok: false, error: 'Settlement not found' }
      if (record.status === 'confirmed') return { ok: false, error: 'This settlement is already confirmed' }
      // A transfer is only confirmed against a real bank credit. An EMD-netted
      // settlement never touches the bank, so it needs no statement line.
      if (record.mode === 'transfer' && !bankLineId) {
        return { ok: false, error: 'Match the transfer to a credit on the statement before confirming it' }
      }
      const at = new Date(s.now).toISOString()
      set((st) => ({
        commissionSettlements: st.commissionSettlements.map((r) =>
          r.id === id ? { ...r, status: 'confirmed' as const, confirmedBy: me?.id, confirmedAt: at, queryNote: undefined } : r,
        ),
        bankStatementLines: bankLineId
          ? st.bankStatementLines.map((l) =>
              l.id === bankLineId ? { ...l, status: 'matched' as const, matchedTo: id, matchedKind: 'commission' as const, matchedBy: me?.id, matchedAt: at } : l,
            )
          : st.bankStatementLines,
      }))
      const cat = s.catalogues.find((c) => c.id === record.catalogueId)
      get().audit('commission.confirm', cat?.code ?? record.catalogueId, `Commission of ${inr(record.amount)} confirmed against the bank (${record.mode === 'emd' ? 'netted from EMD' : `transfer ${record.reference ?? '—'}`})`)
      get().notify({
        userId: record.sellerId, kind: 'wallet', title: 'Commission confirmed',
        body: `We have matched your ${inr(record.amount)} settlement for ${cat?.code ?? 'the auction'}. It now appears in your History.`,
        href: '/seller/settlement',
      })
      return { ok: true }
    },

    queryCommissionSettlement: (id, note) => {
      if (!FINANCE_ROLES.includes(get().role)) return
      const s = get()
      const record = s.commissionSettlements.find((r) => r.id === id)
      if (!record || record.status === 'confirmed') return
      set((st) => ({
        commissionSettlements: st.commissionSettlements.map((r) =>
          r.id === id ? { ...r, status: 'queried' as const, queryNote: note } : r,
        ),
      }))
      const cat = s.catalogues.find((c) => c.id === record.catalogueId)
      get().audit('commission.query', cat?.code ?? record.catalogueId, `Commission of ${inr(record.amount)} queried — ${note}`, 'warning')
      get().notify({
        userId: record.sellerId, kind: 'wallet', title: 'Commission payment queried',
        body: note, href: '/seller/settlement',
      })
    },

    /* --------------------------- buyer payments ------------------------- */
    confirmBuyerPayment: (doId, method, ref) => {
      if (!FINANCE_ROLES.includes(get().role)) return { ok: false, error: 'Only Finance can confirm a receipt' }
      const s = get()
      const d = s.deliveryOrders.find((x) => x.id === doId)
      if (!d) return { ok: false, error: 'Delivery order not found' }
      const due = d.materialValue + d.gstAmount + d.tcsAmount
      if (d.paidAmount >= due) return { ok: false, error: 'This delivery order is already paid in full' }
      set((st) => ({
        deliveryOrders: st.deliveryOrders.map((x) =>
          x.id === doId ? { ...x, paidAmount: due, stage: x.stage === 'payment_pending' ? ('dd_issued' as const) : x.stage } : x,
        ),
      }))
      const lot = s.lots.find((l) => l.id === d.lotId)
      get().audit('payment.confirm', lot?.lotNo ?? doId, `Receipt of ${inr(due)} confirmed via ${method} (${ref}) — delivery order released to Operations`)
      // Finance confirming the money is what lets Operations schedule lifting.
      notifyRole(['exec_manager', 'sub_admin'], {
        kind: 'system',
        title: `Payment cleared — ${lot?.lotNo ?? 'delivery order'}`,
        body: `${inr(due)} received. Lifting can be scheduled.`, href: '/exec/logistics',
      })
      get().notify({
        userId: d.buyerId, kind: 'wallet', title: 'Payment received',
        body: `We have received ${inr(due)} for ${lot?.lotNo ?? 'your lot'}. Lifting will be scheduled.`,
        href: '/buyer/auction-status',
      })
      return { ok: true }
    },

    flagOverduePayment: (doId, note) => {
      if (!FINANCE_ROLES.includes(get().role)) return
      const s = get()
      const d = s.deliveryOrders.find((x) => x.id === doId)
      if (!d) return
      const lot = s.lots.find((l) => l.id === d.lotId)
      get().audit('payment.overdue', lot?.lotNo ?? doId, `Payment chased — ${note}`, 'warning')
      get().notify({
        userId: d.buyerId, kind: 'wallet', title: 'Payment overdue',
        body: note, href: '/buyer/auction-status',
      })
    },

    /* ------------------------- EMD held & forfeited --------------------- */
    raiseEmdForfeiture: (lotId, buyerId, reason) => {
      if (!FINANCE_ROLES.includes(get().role)) return { ok: false, error: 'Only Finance can forfeit an EMD' }
      const s = get()
      const me = s.currentUser
      const lot = s.lots.find((l) => l.id === lotId)
      if (!lot) return { ok: false, error: 'Lot not found' }
      if (s.emdForfeitures.some((f) => f.lotId === lotId && f.buyerId === buyerId && f.status !== 'waived')) {
        return { ok: false, error: 'A forfeiture already exists on this lot for this buyer' }
      }
      const w = s.wallets.find((x) => x.userId === buyerId)
      const amount = Math.min(lot.preBidEmd, w?.emdLocked ?? 0)
      if (amount <= 0) return { ok: false, error: 'No EMD is held against this lot' }
      const overThreshold = amount >= s.financeConfig.ceoForfeitureFrom
      const record: EmdForfeiture = {
        id: uid('emf'), buyerId, lotId, catalogueId: lot.catalogueId, amount, reason,
        status: overThreshold ? 'awaiting_ceo' : 'applied',
        raisedBy: me?.id ?? 'system',
        raisedAt: new Date(s.now).toISOString(),
        ...(overThreshold ? {} : { decidedBy: me?.id, decidedAt: new Date(s.now).toISOString() }),
      }
      set((st) => ({ emdForfeitures: [record, ...st.emdForfeitures] }))
      if (overThreshold) {
        raiseCeoApproval('emd_forfeiture', record.id, amount,
          `Forfeit ${inr(amount)} of EMD held against ${lot.lotNo}`, reason)
        get().audit('emd.forfeit_request', lot.lotNo, `Forfeiture of ${inr(amount)} sent for CEO sign-off — ${reason}`, 'critical')
        // Their money is frozen pending a decision; they are told that, and why.
        get().notify({
          userId: buyerId, kind: 'wallet', title: `EMD held pending review — ${lot.lotNo}`,
          body: `${inr(amount)} stays locked while a forfeiture is decided. ${reason}`,
          href: '/buyer/wallet',
        })
        return { ok: true, awaitingCeo: true }
      }
      applyForfeiture(record)
      return { ok: true }
    },

    waiveEmdForfeiture: (id, reason) => {
      if (!FINANCE_ROLES.includes(get().role)) return
      const s = get()
      const record = s.emdForfeitures.find((f) => f.id === id)
      if (!record || record.status === 'applied') return
      set((st) => ({
        emdForfeitures: st.emdForfeitures.map((f) =>
          f.id === id ? { ...f, status: 'waived' as const, decidedBy: st.currentUser?.id, decidedAt: new Date(st.now).toISOString(), decisionNote: reason } : f,
        ),
        ceoApprovals: st.ceoApprovals.map((a) =>
          a.kind === 'emd_forfeiture' && a.refId === id && a.status === 'pending'
            ? { ...a, status: 'refused' as const, decidedBy: st.currentUser?.id, decidedAt: new Date(st.now).toISOString(), decisionNote: 'Withdrawn by Finance' }
            : a,
        ),
      }))
      const lot = s.lots.find((l) => l.id === record.lotId)
      get().audit('emd.forfeit_waive', lot?.lotNo ?? record.lotId, `Forfeiture of ${inr(record.amount)} waived — ${reason}`, 'warning')
      get().notify({
        userId: record.buyerId, kind: 'wallet', title: 'EMD forfeiture waived',
        body: `${inr(record.amount)} stays with you. ${reason}`, href: '/buyer/wallet',
      })
    },

    /* -------------------------------- refunds --------------------------- */
    raiseRefund: ({ userId, amount, source, reason, lotId, catalogueId, disputeId }) => {
      // Raising is a request, not a movement — which is why a Sub Admin closing
      // a dispute in the customer's favour may raise the refund it owes. It
      // still lands in Finance's queue at `pending` and Finance both approves
      // and pays it; nothing here touches a wallet.
      const mayRaise = FINANCE_ROLES.includes(get().role) || (get().role === 'sub_admin' && !!disputeId)
      if (!mayRaise) return { ok: false, error: 'Only Finance can raise a refund' }
      if (!(amount > 0)) return { ok: false, error: 'Enter the amount to return' }
      const s = get()
      const overThreshold = amount >= s.financeConfig.ceoRefundFrom
      const record: RefundRequest = {
        id: uid('ref'), userId, amount, source, reason, lotId, catalogueId, disputeId,
        status: overThreshold ? 'awaiting_ceo' : 'pending',
        raisedBy: s.currentUser?.id ?? 'system',
        raisedAt: new Date(s.now).toISOString(),
      }
      set((st) => ({ refundRequests: [record, ...st.refundRequests] }))
      const party = s.users.find((u) => u.id === userId)
      if (overThreshold) {
        raiseCeoApproval('refund', record.id, amount, `Refund ${inr(amount)} to ${party?.firm ?? userId}`, reason)
        get().audit('refund.raise', party?.firm ?? userId, `Refund of ${inr(amount)} sent for CEO sign-off — ${reason}`, 'warning')
        return { ok: true, awaitingCeo: true }
      }
      get().audit('refund.raise', party?.firm ?? userId, `Refund of ${inr(amount)} raised — ${reason}`)
      /* A Sub Admin closing a dispute in the customer's favour can raise this,
         but only Finance approves and pays it — so Finance is told rather than
         the request waiting to be noticed on a queue. */
      notifyRole('finance_admin', {
        kind: 'system', title: `Refund to decide — ${inr(amount)}`,
        body: `${party?.firm ?? 'A customer'} · ${reason}${disputeId ? ' (raised from a dispute — the ticket stays open until it is paid)' : ''}`,
        href: '/finance/refunds',
      }, s.currentUser?.id)
      return { ok: true }
    },

    decideRefund: (id, approve, note) => {
      if (!FINANCE_ROLES.includes(get().role)) return
      const s = get()
      const record = s.refundRequests.find((r) => r.id === id)
      if (!record || (record.status !== 'pending' && record.status !== 'awaiting_ceo')) return
      set((st) => ({
        refundRequests: st.refundRequests.map((r) =>
          r.id === id
            ? { ...r, status: approve ? ('approved' as const) : ('rejected' as const), decidedBy: st.currentUser?.id, decidedAt: new Date(st.now).toISOString(), decisionNote: note }
            : r,
        ),
      }))
      const party = s.users.find((u) => u.id === record.userId)
      get().audit(approve ? 'refund.approve' : 'refund.reject', party?.firm ?? record.userId,
        `${approve ? 'Refund approved' : 'Refund refused'} — ${inr(record.amount)}${note ? ` · ${note}` : ''}`,
        approve ? 'info' : 'warning')
      if (!approve) {
        get().notify({
          userId: record.userId, kind: 'wallet', title: 'Refund not approved',
          body: note || 'Held pending review. Your dispute stays open.', href: '/disputes',
        })
      }
    },

    processRefund: (id) => {
      if (!FINANCE_ROLES.includes(get().role)) return { ok: false, error: 'Only Finance can process a refund' }
      const s = get()
      const record = s.refundRequests.find((r) => r.id === id)
      if (!record) return { ok: false, error: 'Refund not found' }
      if (record.status !== 'approved') return { ok: false, error: 'Approve the refund before processing it' }
      ensureWallet(record.userId)
      const at = new Date(s.now).toISOString()
      set((st) => ({
        refundRequests: st.refundRequests.map((r) =>
          r.id === id ? { ...r, status: 'processed' as const, processedBy: st.currentUser?.id, processedAt: at } : r,
        ),
        wallets: st.wallets.map((w) =>
          w.userId === record.userId
            ? {
                ...w,
                balance: w.balance + record.amount,
                ledger: [{ id: uid('led'), at, type: 'refund' as const, amount: record.amount, ref: record.id, lotId: record.lotId, catalogueId: record.catalogueId, note: `Refund — ${record.reason}` }, ...w.ledger],
              }
            : w,
        ),
      }))
      const party = s.users.find((u) => u.id === record.userId)
      get().audit('refund.process', party?.firm ?? record.userId, `Refund of ${inr(record.amount)} credited to wallet — ${record.reason}`)
      get().notify({
        userId: record.userId, kind: 'wallet', title: 'Refund credited',
        body: `${inr(record.amount)} has been returned to your wallet.`, href: '/buyer/wallet',
      })

      // The last link in the support chain. A Sub Admin decided the dispute and
      // held it open because money was owed; paying it is what actually closes
      // it, so Finance closes it here rather than leaving the customer with a
      // ticket that is only resolved once somebody remembers to say so.
      if (record.disputeId) {
        const d = s.disputes.find((x) => x.id === record.disputeId)
        if (d && d.status !== 'resolved') {
          set((st) => ({
            disputes: st.disputes.map((x) => (x.id === record.disputeId
              ? {
                ...x,
                status: 'resolved' as const,
                resolvedAt: at,
                resolvedById: x.resolvedById ?? x.assignedToId,
                messages: [...x.messages, {
                  from: 'support' as const,
                  body: `${inr(record.amount)} has been returned to your wallet. This closes the ticket — reply here if anything is still outstanding.`,
                  at,
                }],
              }
              : x)),
          }))
          get().audit('dispute.closed', d.id.toUpperCase(), `Closed on payment of the ${inr(record.amount)} refund`)
        }
      }
      return { ok: true }
    },

    /* --------------------------- invoices & receipts -------------------- */
    issueInvoice: ({ kind, partyId, catalogueId, lotId, doId, taxable, gst, tcs, note }) => {
      if (!FINANCE_ROLES.includes(get().role)) return null
      const s = get()
      const seq = 1001 + s.invoices.length
      const record: Invoice = {
        id: uid('inv'),
        number: `FB/${kind === 'buyer_invoice' ? 'INV' : 'RCP'}/26/${seq}`,
        kind, partyId, catalogueId, lotId, doId,
        issuedAt: new Date(s.now).toISOString(),
        issuedBy: s.currentUser?.id ?? 'system',
        taxable, gst, tcs, total: taxable + gst + tcs,
        status: 'issued', note,
      }
      set((st) => ({ invoices: [record, ...st.invoices] }))
      const party = s.users.find((u) => u.id === partyId)
      get().audit('invoice.issue', record.number, `${kind === 'buyer_invoice' ? 'Buyer invoice' : 'Commission receipt'} for ${inr(record.total)} issued to ${party?.firm ?? partyId}`)
      get().notify({
        userId: partyId, kind: 'system',
        title: kind === 'buyer_invoice' ? 'Invoice issued' : 'Commission receipt issued',
        body: `${record.number} — ${inr(record.total)}.`,
        href: kind === 'buyer_invoice' ? '/buyer/auction-status' : '/seller/settlement',
      })
      return record
    },

    reissueInvoice: (id, note) => {
      if (!FINANCE_ROLES.includes(get().role)) return
      const s = get()
      const original = s.invoices.find((i) => i.id === id)
      if (!original || original.status !== 'issued') return
      const replacement: Invoice = {
        ...original,
        id: uid('inv'),
        number: `${original.number}-R`,
        issuedAt: new Date(s.now).toISOString(),
        issuedBy: s.currentUser?.id ?? 'system',
        status: 'issued',
        supersedesId: original.id,
        note,
      }
      // Superseded, not overwritten — the original stays on the record.
      set((st) => ({
        invoices: [replacement, ...st.invoices.map((i) => (i.id === id ? { ...i, status: 'superseded' as const } : i))],
      }))
      get().audit('invoice.reissue', replacement.number, `Replaces ${original.number} — ${note}`, 'warning')
      get().notify({
        userId: original.partyId, kind: 'system', title: 'Document reissued',
        body: `${replacement.number} replaces ${original.number}. ${note}`,
      })
    },

    cancelInvoice: (id, note) => {
      if (!FINANCE_ROLES.includes(get().role)) return
      const original = get().invoices.find((i) => i.id === id)
      if (!original || original.status === 'cancelled') return
      set((st) => ({ invoices: st.invoices.map((i) => (i.id === id ? { ...i, status: 'cancelled' as const, note } : i)) }))
      get().audit('invoice.cancel', original.number, `Cancelled — ${note}`, 'warning')
      // A tax document the customer is holding has stopped being valid.
      get().notify({
        userId: original.partyId, kind: 'wallet', title: `Invoice ${original.number} cancelled`,
        body: `${note} A corrected document follows if one is due.`,
        href: '/buyer/auction-status',
      })
    },

    /* ------------------------------ reconciliation ---------------------- */
    matchBankLine: (lineId, matchedTo, kind) => {
      if (!FINANCE_ROLES.includes(get().role)) return
      const line = get().bankStatementLines.find((l) => l.id === lineId)
      if (!line) return
      set((st) => ({
        bankStatementLines: st.bankStatementLines.map((l) =>
          l.id === lineId
            ? { ...l, status: 'matched' as const, matchedTo, matchedKind: kind, matchedBy: st.currentUser?.id, matchedAt: new Date(st.now).toISOString(), breakNote: undefined, escalated: false }
            : l,
        ),
      }))
      get().audit('recon.match', line.ref, `${line.direction === 'credit' ? 'Credit' : 'Debit'} of ${inr(line.amount)} matched to ${matchedTo}`)
    },

    unmatchBankLine: (lineId) => {
      if (!FINANCE_ROLES.includes(get().role)) return
      const line = get().bankStatementLines.find((l) => l.id === lineId)
      if (!line) return
      set((st) => ({
        bankStatementLines: st.bankStatementLines.map((l) =>
          l.id === lineId ? { ...l, status: 'unmatched' as const, matchedTo: undefined, matchedKind: undefined, matchedBy: undefined, matchedAt: undefined } : l,
        ),
      }))
      get().audit('recon.unmatch', line.ref, `Match reversed on ${inr(line.amount)}`, 'warning')
    },

    flagBankBreak: (lineId, note) => {
      if (!FINANCE_ROLES.includes(get().role)) return
      const line = get().bankStatementLines.find((l) => l.id === lineId)
      if (!line) return
      set((st) => ({
        bankStatementLines: st.bankStatementLines.map((l) => (l.id === lineId ? { ...l, status: 'break' as const, breakNote: note } : l)),
      }))
      get().audit('recon.break', line.ref, `Break flagged on ${inr(line.amount)} — ${note}`, 'warning')
    },

    escalateBankBreak: (lineId) => {
      if (!FINANCE_ROLES.includes(get().role)) return
      const line = get().bankStatementLines.find((l) => l.id === lineId)
      if (!line) return
      set((st) => ({ bankStatementLines: st.bankStatementLines.map((l) => (l.id === lineId ? { ...l, escalated: true } : l)) }))
      get().audit('recon.escalate', line.ref, `Break of ${inr(line.amount)} escalated — ${line.breakNote ?? 'no note'}`, 'critical')
      notifyRole('super_admin', {
        kind: 'system',
        title: 'Reconciliation break escalated',
        body: `${inr(line.amount)} on ${line.ref} — ${line.breakNote ?? 'unmatched'}`,
        href: '/finance/reconciliation',
      })
    },

    /* -------------------------- CEO sign-off queue ---------------------- */
    requestCeoSignoff: ({ kind, refId, amount, summary, reason, payload }) => {
      const role = get().role
      // Customers never raise one of these; every kind comes off a staff desk.
      if (role === 'guest' || role === 'guest1' || role === 'guest2' || role === 'buyer' || role === 'seller') return null
      const existing = get().ceoApprovals.find(
        (a) => a.refId === refId && a.kind === kind && (a.status === 'pending' || a.status === 'info_requested'),
      )
      if (existing) return existing
      const record = raiseCeoApproval(kind, refId, amount, summary, reason)
      if (payload) {
        set((st) => ({ ceoApprovals: st.ceoApprovals.map((a) => (a.id === record.id ? { ...a, payload } : a)) }))
      }
      get().audit('ceo.request', summary, `Sent for the CEO's signature — ${reason}`, 'warning')
      return record
    },

    requestCeoInfo: (id, note) => {
      const s = get()
      if (!canSignForCeo(s.role, s.currentUser?.id, s.ceoDelegation, s.now)) return
      const req = s.ceoApprovals.find((a) => a.id === id)
      if (!req || (req.status !== 'pending' && req.status !== 'info_requested')) return
      const at = new Date(s.now).toISOString()
      set((st) => ({
        ceoApprovals: st.ceoApprovals.map((a) =>
          a.id === id ? { ...a, status: 'info_requested' as const, infoNote: note, infoAskedAt: at } : a,
        ),
      }))
      get().audit('ceo.query', req.summary, `More information asked for — ${note}`, 'info')
      get().notify({
        userId: req.requestedBy, kind: 'system',
        title: 'The CEO has a question',
        body: `${req.summary} — ${note}`,
        href: CEO_REQUEST_HREF[req.kind],
      })
    },

    delegateCeoApprovals: (toUserId, until, note) => {
      const s = get()
      if (s.role !== 'ceo') return { ok: false, error: 'Only the CEO can hand this queue to someone else.' }
      const to = s.users.find((u) => u.id === toUserId)
      if (!to) return { ok: false, error: 'That account no longer exists.' }
      if (to.id === s.currentUser?.id) return { ok: false, error: 'The queue is already yours.' }
      if (Date.parse(`${until}T23:59:59`) <= s.now) return { ok: false, error: 'Pick a date in the future — a delegation with no time left changes nothing.' }
      const record: CeoDelegation = {
        toUserId, until, note,
        setBy: s.currentUser?.id ?? 'u-ceo-1',
        setAt: new Date(s.now).toISOString(),
      }
      set({ ceoDelegation: record })
      get().audit('ceo.delegate', to.name, `Approval queue delegated until ${until}${note ? ` — ${note}` : ''}`, 'critical')
      get().notify({
        userId: toUserId, kind: 'system',
        title: 'You are holding the CEO approval queue',
        body: `Until ${until}. Every decision you sign is recorded under your own name.${note ? ` ${note}` : ''}`,
        href: '/ceo/approvals',
      })
      return { ok: true }
    },

    clearCeoDelegation: () => {
      const s = get()
      if (s.role !== 'ceo') return
      const current = s.ceoDelegation
      if (!current) return
      set({ ceoDelegation: null })
      const to = s.users.find((u) => u.id === current.toUserId)
      get().audit('ceo.delegate_end', to?.name ?? current.toUserId, 'Delegation ended — the queue is back with the CEO', 'critical')
      get().notify({
        userId: current.toUserId, kind: 'system',
        title: 'Approval queue handed back',
        body: 'The CEO has taken the signature queue back. Anything you signed stands, under your name.',
      })
    },

    decideCeoApproval: (id, approve, note) => {
      const s = get()
      if (!canSignForCeo(s.role, s.currentUser?.id, s.ceoDelegation, s.now)) return
      const req = s.ceoApprovals.find((a) => a.id === id)
      if (!req || (req.status !== 'pending' && req.status !== 'info_requested')) return
      const at = new Date(s.now).toISOString()
      set((st) => ({
        ceoApprovals: st.ceoApprovals.map((a) =>
          a.id === id ? { ...a, status: approve ? ('approved' as const) : ('refused' as const), decidedBy: st.currentUser?.id, decidedAt: at, decisionNote: note } : a,
        ),
      }))
      get().audit(approve ? 'ceo.approve' : 'ceo.refuse', req.summary, `${inr(req.amount)}${note ? ` — ${note}` : ''}`, 'critical')

      // A signature completes the movement it was holding, or releases it.
      if (req.kind === 'emd_forfeiture') {
        const record = get().emdForfeitures.find((f) => f.id === req.refId)
        if (record && record.status === 'awaiting_ceo') {
          if (approve) {
            set((st) => ({
              emdForfeitures: st.emdForfeitures.map((f) => (f.id === record.id ? { ...f, status: 'applied' as const, decidedBy: st.currentUser?.id, decidedAt: at, decisionNote: note } : f)),
            }))
            applyForfeiture(record)
          } else {
            get().waiveEmdForfeiture(record.id, note || 'Refused at CEO sign-off — EMD released back to the buyer')
          }
        }
      }
      if (req.kind === 'refund') {
        const record = get().refundRequests.find((r) => r.id === req.refId)
        if (record && record.status === 'awaiting_ceo') {
          set((st) => ({
            refundRequests: st.refundRequests.map((r) =>
              r.id === record.id
                ? { ...r, status: approve ? ('approved' as const) : ('rejected' as const), decidedBy: st.currentUser?.id, decidedAt: at, decisionNote: note }
                : r,
            ),
          }))
        }
      }
      // A fee change is the one kind where the signature *is* the change: the
      // proposed rates are held on the request and never touch the config until
      // they are signed, so no sale is ever priced by an unapproved rate.
      if (req.kind === 'fee_change' && approve && req.payload) {
        const before = get().financeConfig
        set((st) => ({ financeConfig: { ...st.financeConfig, ...req.payload } }))
        const changed = Object.keys(req.payload)
          .map((k) => `${k} ${String(before[k as keyof FinanceConfig])} → ${String(req.payload?.[k as keyof FinanceConfig])}`)
          .join(', ')
        get().audit('config.fee_change', 'Financial configuration', `Signed by the CEO — ${changed}`, 'critical')
      }
      // A ban closes the account's standing; it is never deleted, so the
      // history behind the decision stays readable.
      if (req.kind === 'permanent_ban' && approve) {
        set((st) => ({
          users: st.users.map((u) => (u.id === req.refId ? { ...u, standing: 'defaulter' as const, blacklistReason: note || req.reason } : u)),
        }))
      }
      // 'auction_publish' applies nothing here by design — the catalogue is
      // still Operations' to publish. The signature only removes the block.
      get().notify({
        userId: req.requestedBy, kind: 'system',
        title: approve ? 'Signed off' : 'Refused',
        body: `${req.summary}${note ? ` — ${note}` : ''}`,
        href: CEO_REQUEST_HREF[req.kind],
      })
    },

    /* ------------------- Super Admin — the platform itself -----------------
       Structure, never business data. Everything here is recorded in
       `structuralChanges` with the snapshot that undoes it, which is what lets
       a bad change be reversed in a click instead of an emergency release.
       Auctions, bids, payments and audit entries are deliberately outside that
       snapshot and can never be rolled back. */

    addRole: (input) => {
      const err = requireSuperAdmin()
      if (err) return err
      const label = input.label.trim()
      if (!label) return { ok: false, error: 'A role needs a name' }
      const key = slugKey(label)
      if (get().roleRegistry.some((r) => r.key === key)) return { ok: false, error: `A role called "${label}" already exists` }
      const home = input.home?.trim() || `/${key}`
      const snapshot = structureSnapshot()
      const at = new Date(get().now).toISOString()
      const pages: PageDef[] = DEFAULT_NEW_ROLE_PAGES.map((p, i) => ({
        id: uid('pg'), roleKey: key, to: p.to === '@home' ? home : p.to, label: p.label,
        inTop: i === 0, inSub: true, hidden: false, order: i, builtIn: false,
        end: i === 0, retained: p.retained,
      }))
      set((st) => ({
        roleRegistry: [...st.roleRegistry, {
          key, label, home, builtIn: false, status: 'active' as const,
          createdAt: at, createdBy: st.currentUser?.id, note: input.note,
        }],
        pageRegistry: [...st.pageRegistry, ...pages],
      }))
      recordStructural('role.add', label, `Role added with ${pages.length} default pages, landing on ${home}`, null, label, snapshot)
      get().audit('role.add', label, `New role "${label}" (${key}) created with default pages`, 'critical')
      return { ok: true, key }
    },

    removeRole: (key, reason) => {
      const err = requireSuperAdmin()
      if (err) return err
      const role = get().roleRegistry.find((r) => r.key === key)
      if (!role || role.status === 'removed') return { ok: false, error: 'That role is not active' }
      if (key === 'super_admin') return { ok: false, error: 'The Super Admin role cannot be removed — it is the only way back in' }
      if (!reason.trim()) return { ok: false, error: 'A typed reason is required' }
      const liveOwned = liveAuctionsOwnedBy(key)
      if (liveOwned.length > 0) {
        return { ok: false, error: `${role.label} is running ${liveOwned.map((c) => c.code).join(', ')} right now. Wait for it to close, or cancel it from Emergency override first.` }
      }
      const snapshot = structureSnapshot()
      const at = new Date(get().now).toISOString()
      const holders = get().users.filter((u) => u.role === key)
      set((st) => ({
        roleRegistry: st.roleRegistry.map((r) =>
          r.key === key ? { ...r, status: 'removed' as const, removedAt: at, removedBy: st.currentUser?.id, removedReason: reason } : r),
        // Accounts are suspended, never deleted — the history behind everything
        // they decided has to stay readable.
        users: st.users.map((u) => (u.role === key ? { ...u, accountStatus: 'suspended' as AccountStatus } : u)),
      }))
      recordStructural('role.remove', role.label,
        `Role removed — ${holders.length} account${holders.length === 1 ? '' : 's'} suspended, none deleted. ${reason}`,
        role.label, null, snapshot)
      get().audit('role.remove', role.label, `${reason} — ${holders.length} account(s) suspended`, 'critical')
      /* Suspension is only real because it stops the sign-in — which means the
         people it stops have to be told, rather than meeting a locked door. */
      for (const u of holders) {
        get().notify({
          userId: u.id, kind: 'system', title: 'Your access has been suspended',
          body: `The ${role.label} role was withdrawn — ${reason}. Your account and its history are intact. Contact a Super Admin to be reinstated.`,
        })
      }
      return { ok: true }
    },

    duplicateRole: (key, label) => {
      const err = requireSuperAdmin()
      if (err) return err
      const source = get().roleRegistry.find((r) => r.key === key)
      if (!source) return { ok: false, error: 'No such role' }
      const name = label.trim()
      if (!name) return { ok: false, error: 'The copy needs a name' }
      const newKey = slugKey(name)
      if (get().roleRegistry.some((r) => r.key === newKey)) return { ok: false, error: `A role called "${name}" already exists` }
      const snapshot = structureSnapshot()
      const at = new Date(get().now).toISOString()
      const copies: PageDef[] = get().pageRegistry
        .filter((p) => p.roleKey === key)
        .map((p) => ({ ...p, id: uid('pg'), roleKey: newKey, builtIn: false, attachedFrom: key }))
      set((st) => ({
        roleRegistry: [...st.roleRegistry, {
          key: newKey, label: name, home: source.home, builtIn: false, status: 'active' as const,
          createdAt: at, createdBy: st.currentUser?.id, basedOn: key,
        }],
        pageRegistry: [...st.pageRegistry, ...copies],
      }))
      recordStructural('role.duplicate', name, `Duplicated from ${source.label} with all ${copies.length} of its pages. Nobody holds it yet.`, source.label, name, snapshot)
      get().audit('role.duplicate', name, `Duplicated from ${source.label} (${copies.length} pages)`, 'warning')
      return { ok: true, key: newKey }
    },

    restoreRole: (key) => {
      const err = requireSuperAdmin()
      if (err) return err
      const role = get().roleRegistry.find((r) => r.key === key)
      if (!role || role.status !== 'removed') return { ok: false, error: 'That role is not removed' }
      const snapshot = structureSnapshot()
      const restored = get().users.filter((u) => u.role === key && u.accountStatus === 'suspended')
      set((st) => ({
        roleRegistry: st.roleRegistry.map((r) =>
          r.key === key ? { ...r, status: 'active' as const, removedAt: undefined, removedBy: undefined, removedReason: undefined } : r),
        users: st.users.map((u) => (u.role === key && u.accountStatus === 'suspended' ? { ...u, accountStatus: 'active' as AccountStatus } : u)),
      }))
      recordStructural('role.restore', role.label,
        `Role restored — ${restored.length} suspended account${restored.length === 1 ? '' : 's'} can sign in again`,
        null, role.label, snapshot)
      get().audit('role.restore', role.label, `${restored.length} account(s) reinstated`, 'critical')
      return { ok: true }
    },

    renamePage: (id, label) => {
      const err = requireSuperAdmin()
      if (err) return err
      const page = get().pageRegistry.find((p) => p.id === id)
      if (!page) return { ok: false, error: 'No such page' }
      const next = label.trim()
      if (!next) return { ok: false, error: 'A tab needs a label' }
      if (next.length > 32) return { ok: false, error: 'Keep a tab label under 32 characters — longer ones push the strip into a scroll' }
      if (next === page.label) return { ok: true }
      const snapshot = structureSnapshot()
      set((st) => ({ pageRegistry: st.pageRegistry.map((p) => (p.id === id ? { ...p, label: next } : p)) }))
      recordStructural('page.rename', `${roleLabelFor(page.roleKey)} · ${page.to}`,
        'Menu tab renamed. What the page does is unchanged.', page.label, next, snapshot)
      get().audit('page.rename', page.to, `${roleLabelFor(page.roleKey)}: "${page.label}" → "${next}"`, 'warning')
      return { ok: true }
    },

    setPageHidden: (id, hidden) => {
      const err = requireSuperAdmin()
      if (err) return err
      const s = get()
      const page = s.pageRegistry.find((p) => p.id === id)
      if (!page) return { ok: false, error: 'No such page' }
      if (hidden && page.retained) {
        return { ok: false, error: `${roleLabelFor(page.roleKey)} has to keep "${page.label}" — a role that must retain its record cannot have it hidden` }
      }
      if (hidden && isLiveAuctionRoute(page) && s.catalogues.some((c) => c.status === 'live')) {
        return { ok: false, error: `An auction is live. "${page.label}" is ${roleLabelFor(page.roleKey)}'s route to it and cannot be hidden while it is running.` }
      }
      if (hidden && s.pageRegistry.filter((p) => p.roleKey === page.roleKey && !p.hidden).length <= 1) {
        return { ok: false, error: `That is the last visible page for ${roleLabelFor(page.roleKey)} — hiding it would leave the role with nowhere to go` }
      }
      const snapshot = structureSnapshot()
      set((st) => ({ pageRegistry: st.pageRegistry.map((p) => (p.id === id ? { ...p, hidden } : p)) }))
      recordStructural('page.visibility', `${roleLabelFor(page.roleKey)} · ${page.label}`,
        hidden ? 'Hidden from this role\'s menu. The route still exists and the page is unchanged.' : 'Shown on this role\'s menu again.',
        hidden ? 'Visible' : 'Hidden', hidden ? 'Hidden' : 'Visible', snapshot)
      get().audit('page.visibility', page.to, `${roleLabelFor(page.roleKey)}: "${page.label}" ${hidden ? 'hidden' : 'shown'}`, 'warning')
      return { ok: true }
    },

    movePage: (id, direction) => {
      const err = requireSuperAdmin()
      if (err) return err
      const s = get()
      const page = s.pageRegistry.find((p) => p.id === id)
      if (!page) return { ok: false, error: 'No such page' }
      const siblings = s.pageRegistry.filter((p) => p.roleKey === page.roleKey).sort((a, b) => a.order - b.order)
      const i = siblings.findIndex((p) => p.id === id)
      const j = i + direction
      if (j < 0 || j >= siblings.length) return { ok: false, error: 'Already at the end of the menu' }
      const other = siblings[j]
      const snapshot = structureSnapshot()
      set((st) => ({
        pageRegistry: st.pageRegistry.map((p) =>
          p.id === page.id ? { ...p, order: other.order } : p.id === other.id ? { ...p, order: page.order } : p),
      }))
      recordStructural('page.reorder', `${roleLabelFor(page.roleKey)} · ${page.label}`,
        `Moved ${direction === -1 ? 'before' : 'after'} "${other.label}"`,
        `position ${i + 1}`, `position ${j + 1}`, snapshot)
      get().audit('page.reorder', page.to, `${roleLabelFor(page.roleKey)}: "${page.label}" → position ${j + 1}`, 'info')
      return { ok: true }
    },

    attachPage: (id, roleKey) => {
      const err = requireSuperAdmin()
      if (err) return err
      const s = get()
      const page = s.pageRegistry.find((p) => p.id === id)
      const target = s.roleRegistry.find((r) => r.key === roleKey && r.status === 'active')
      if (!page || !target) return { ok: false, error: 'Pick a page and an active role' }
      if (page.roleKey === roleKey) return { ok: false, error: `${target.label} already has that page` }
      if (s.pageRegistry.some((p) => p.roleKey === roleKey && p.to === page.to)) {
        return { ok: false, error: `${target.label} already has a tab pointing at ${page.to}` }
      }
      const snapshot = structureSnapshot()
      const order = Math.max(-1, ...s.pageRegistry.filter((p) => p.roleKey === roleKey).map((p) => p.order)) + 1
      set((st) => ({
        pageRegistry: [...st.pageRegistry, {
          ...page, id: uid('pg'), roleKey, order, builtIn: false, hidden: false,
          inTop: false, inSub: true, retained: undefined, attachedFrom: page.roleKey,
          // The heading belonged to the menu it came from. It lands at the end
          // of the target's strip as a plain tab rather than dragging a stray
          // category across from another role's workflow.
          category: undefined,
        }],
      }))
      recordStructural('page.attach', `${target.label} · ${page.label}`,
        `Attached from ${roleLabelFor(page.roleKey)}. One screen, two menus — whoever acts is still named in the audit entry.`,
        null, target.label, snapshot)
      get().audit('page.attach', page.to, `"${page.label}" attached to ${target.label}`, 'warning')
      return { ok: true }
    },

    detachPage: (id) => {
      const err = requireSuperAdmin()
      if (err) return err
      const page = get().pageRegistry.find((p) => p.id === id)
      if (!page) return { ok: false, error: 'No such page' }
      if (page.builtIn) return { ok: false, error: 'That page ships with the role. Hide it instead — detaching is only for pages attached here.' }
      if (page.retained) return { ok: false, error: 'That page is a record this role must retain' }
      const snapshot = structureSnapshot()
      set((st) => ({ pageRegistry: st.pageRegistry.filter((p) => p.id !== id) }))
      recordStructural('page.detach', `${roleLabelFor(page.roleKey)} · ${page.label}`,
        'Detached from this role\'s menu. The page itself is untouched.', page.label, null, snapshot)
      get().audit('page.detach', page.to, `"${page.label}" detached from ${roleLabelFor(page.roleKey)}`, 'warning')
      return { ok: true }
    },

    addSubPage: (roleKey, label, to) => {
      const err = requireSuperAdmin()
      if (err) return err
      const s = get()
      const role = s.roleRegistry.find((r) => r.key === roleKey && r.status === 'active')
      if (!role) return { ok: false, error: 'Pick an active role' }
      if (!label.trim()) return { ok: false, error: 'The sub-page needs a label' }
      const route = to.trim()
      if (!route.startsWith('/')) return { ok: false, error: 'A route starts with /' }
      if (s.pageRegistry.some((p) => p.roleKey === roleKey && p.to === route)) {
        return { ok: false, error: `${role.label} already has a tab pointing at ${route}` }
      }
      const snapshot = structureSnapshot()
      const order = Math.max(-1, ...s.pageRegistry.filter((p) => p.roleKey === roleKey).map((p) => p.order)) + 1
      set((st) => ({
        pageRegistry: [...st.pageRegistry, {
          id: uid('pg'), roleKey, to: route, label: label.trim(),
          inTop: false, inSub: true, hidden: false, order, builtIn: false,
        }],
      }))
      recordStructural('page.add', `${role.label} · ${label.trim()}`, `Sub-page added, pointing at ${route}`, null, label.trim(), snapshot)
      get().audit('page.add', route, `Sub-page "${label.trim()}" added to ${role.label}`, 'warning')
      return { ok: true }
    },

    undoStructuralChange: (id) => {
      const err = requireSuperAdmin()
      if (err) return err
      const change = get().structuralChanges.find((c) => c.id === id)
      if (!change) return { ok: false, error: 'No such change' }
      if (change.undoneAt) return { ok: false, error: 'That change has already been undone' }
      if (!change.snapshot) return { ok: false, error: 'That change is on the record but is not a structural one — business data is never rolled back' }
      const now = structureSnapshot()
      set((st) => ({
        ...applySnapshot(change.snapshot!),
        structuralChanges: st.structuralChanges.map((c) =>
          c.id === id ? { ...c, undoneAt: new Date(st.now).toISOString(), undoneBy: st.currentUser?.id } : c),
      }))
      recordStructural('structure.rollback', change.target, `Undid: ${change.summary}`, change.after, change.before, now)
      get().audit('structure.undo', change.target, `Undid ${change.kind} — ${change.summary}`, 'critical')
      return { ok: true }
    },

    restoreStructureTo: (id) => {
      const err = requireSuperAdmin()
      if (err) return err
      const s = get()
      const change = s.structuralChanges.find((c) => c.id === id)
      if (!change?.snapshot) return { ok: false, error: 'There is no structure snapshot at that point' }
      const later = s.structuralChanges.filter((c) => Date.parse(c.at) >= Date.parse(change.at) && !c.undoneAt && c.snapshot)
      const now = structureSnapshot()
      const at = new Date(s.now).toISOString()
      const laterIds = new Set(later.map((c) => c.id))
      set((st) => ({
        ...applySnapshot(change.snapshot!),
        structuralChanges: st.structuralChanges.map((c) =>
          laterIds.has(c.id) ? { ...c, undoneAt: at, undoneBy: st.currentUser?.id } : c),
      }))
      recordStructural('structure.rollback', 'The platform\'s shape',
        `Restored to ${fmtStamp(change.at)} — ${later.length} change${later.length === 1 ? '' : 's'} undone. No auction, bid, payment or audit entry was touched.`,
        `${later.length} changes since`, fmtStamp(change.at), now)
      get().audit('structure.restore', 'Roles & pages', `Restored to ${change.at} (${later.length} changes undone)`, 'critical')
      return { ok: true }
    },

    /* ------------------- Super Admin — people --------------------------- */

    createSubAdmin: (input) => {
      const err = requireSuperAdmin()
      if (err) return err
      const s = get()
      const name = input.name.trim()
      const username = input.username.trim().toLowerCase()
      if (!name || !username) return { ok: false, error: 'Both a name and a sign-in ID are needed' }
      if (s.users.some((u) => u.username === username || u.email === input.email.trim())) {
        return { ok: false, error: 'Those sign-in details are already in use' }
      }
      const password = generatePassword()
      const id = uid('u-sub')
      const at = new Date(s.now).toISOString()
      const user: User = {
        id, name, firm: 'ferroBid Technologies', phone: input.phone.trim(), email: input.email.trim(),
        role: 'sub_admin', kycStatus: 'verified', sellerVerified: false, standing: 'good',
        city: input.city.trim() || 'Mumbai', gstin: '—', avatarHue: (hash(id) % 360),
        joinedAt: at, bidderId: null, sellerId: null,
        accountStatus: 'active', username, lastActiveAt: at,
      }
      set((st) => ({
        users: [...st.users, user],
        passwordResets: [{ id: uid('pwr'), userId: id, mode: 'auto', password, at, byId: st.currentUser?.id ?? 'system', consumed: false }, ...st.passwordResets],
      }))
      recordStructural('account.create', name, `Sub Admin account created — ${username}. Every Sub Admin account is identical; work is divided by assignment, not by capability.`, null, username)
      get().audit('account.create', username, `Sub Admin account created for ${name}`, 'critical')
      // The CEO is told, and does not approve it — Part 8.
      const ceo = s.users.find((u) => u.role === 'ceo')
      if (ceo) {
        get().notify({
          userId: ceo.id, kind: 'system', title: 'New Sub Admin account',
          body: `${name} (${username}) now has full operational access.`, href: '/admin/sub-admins',
        })
      }
      return { ok: true, password, userId: id }
    },

    setAccountStatus: (userId, status, reason) => {
      const s = get()
      if (s.role !== 'super_admin' && s.role !== 'sub_admin') return { ok: false, error: 'Accounts are administered by a Sub Admin or a Super Admin' }
      const user = s.users.find((u) => u.id === userId)
      if (!user) return { ok: false, error: 'No such account' }
      if (user.role === 'super_admin' && s.role !== 'super_admin') return { ok: false, error: 'Only another Super Admin can change a Super Admin account' }
      if (status === 'banned') {
        // Part 8 — a permanent ban is executed here but signed by the CEO.
        const signed = s.ceoApprovals.some((a) => a.kind === 'permanent_ban' && a.refId === userId && a.status === 'approved')
        if (!signed) return { ok: false, error: 'A permanent ban needs the CEO\'s signature first — raise it from Blacklist & defaulters' }
      }
      const before = user.accountStatus ?? 'active'
      if (before === status) return { ok: true }
      set((st) => ({ users: st.users.map((u) => (u.id === userId ? { ...u, accountStatus: status } : u)) }))
      recordStructural('account.status', `${user.name} · ${user.firm}`,
        reason?.trim() || `Account ${status}`, before, status)
      get().audit('account.status', user.name, `${before} → ${status}${reason ? ` — ${reason}` : ''}`, 'critical')
      get().notify({
        userId, kind: 'system',
        title: status === 'active' ? 'Your account is active again' : `Your account has been ${status}`,
        body: reason?.trim() || 'Contact support if you believe this is a mistake.',
      })
      return { ok: true }
    },

    resetUserPassword: (userId, mode, manualPassword) => {
      const s = get()
      if (s.role !== 'super_admin' && s.role !== 'sub_admin') return { ok: false, error: 'Passwords are reset by a Sub Admin or a Super Admin' }
      const user = s.users.find((u) => u.id === userId)
      if (!user) return { ok: false, error: 'No such account' }
      // A Super Admin's password is only ever reset by another Super Admin.
      if (user.role === 'super_admin' && s.role !== 'super_admin') {
        return { ok: false, error: 'A Super Admin password can only be reset by another Super Admin' }
      }
      const password = mode === 'auto' ? generatePassword() : (manualPassword ?? '').trim()
      if (mode === 'manual') {
        if (password.length < 8) return { ok: false, error: 'A password set by hand needs at least 8 characters' }
        if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) return { ok: false, error: 'Include at least one capital letter and one digit' }
      }
      const at = new Date(s.now).toISOString()
      set((st) => ({
        passwordResets: [{ id: uid('pwr'), userId, mode, password, at, byId: st.currentUser?.id ?? 'system', consumed: false }, ...st.passwordResets],
      }))
      recordStructural('account.password_reset', `${user.name} · ${user.firm}`,
        `Password reset ${mode === 'auto' ? 'to a generated password' : 'by hand'}. Shown once; ${user.name.split(' ')[0]} is asked to keep it or set their own at next sign-in.`,
        null, mode)
      get().audit('account.password_reset', user.name, `Password reset (${mode}) for ${user.email}`, 'critical')
      get().notify({
        userId, kind: 'system', title: 'Your password was reset',
        body: 'Support issued a new password. Sign in with it, then keep it or set your own.',
      })
      return { ok: true, password }
    },

    /* ------------- Super Admin — content a Sub Admin drafted ------------ */

    publishContent: (id) => {
      const err = requireSuperAdmin()
      if (err) return err
      const s = get()
      const draft = s.contentDrafts.find((d) => d.id === id)
      if (!draft) return { ok: false, error: 'No such draft' }
      if (draft.status === 'published') return { ok: false, error: 'Already published' }
      if (draft.needsCeo) {
        const signed = s.ceoApprovals.some((a) => a.kind === 'content_publish' && a.refId === id && a.status === 'approved')
        if (!signed) return { ok: false, error: 'Pricing and legal copy needs the CEO as well. Send it for signature first.' }
      }
      const at = new Date(s.now).toISOString()
      const snapshot = structureSnapshot()
      set((st) => ({
        contentDrafts: st.contentDrafts.map((d) =>
          d.id === id ? { ...d, status: 'published' as const, decidedAt: at, decidedBy: st.currentUser?.id, note: undefined } : d),
      }))
      recordStructural('content.publish', `${draft.page} · ${draft.section}`, 'Published — live on the public site now.', draft.before, draft.after, snapshot)
      get().audit('content.publish', `${draft.page} · ${draft.section}`, 'Draft published to the public site', 'warning')
      get().notify({ userId: draft.authorId, kind: 'system', title: 'Your copy is live', body: `${draft.page} — ${draft.section}`, href: '/sub' })
      return { ok: true }
    },

    returnContent: (id, note) => {
      const err = requireSuperAdmin()
      if (err) return err
      const draft = get().contentDrafts.find((d) => d.id === id)
      if (!draft) return { ok: false, error: 'No such draft' }
      if (!note.trim()) return { ok: false, error: 'Say what needs changing — a return without a comment is a dead end' }
      const at = new Date(get().now).toISOString()
      const snapshot = structureSnapshot()
      set((st) => ({
        contentDrafts: st.contentDrafts.map((d) =>
          d.id === id ? { ...d, status: 'returned' as const, note: note.trim(), decidedAt: at, decidedBy: st.currentUser?.id } : d),
      }))
      recordStructural('content.return', `${draft.page} · ${draft.section}`, `Returned to the author — ${note.trim()}`, draft.after, draft.before, snapshot)
      get().audit('content.return', `${draft.page} · ${draft.section}`, note.trim(), 'info')
      get().notify({ userId: draft.authorId, kind: 'system', title: 'Copy returned with comments', body: note.trim(), href: '/sub' })
      return { ok: true }
    },

    /* ------------------- Super Admin — master data ---------------------- */

    addMasterCategory: (label) => {
      const err = requireSuperAdmin()
      if (err) return err
      const name = label.trim()
      if (!name) return { ok: false, error: 'A category needs a name' }
      const key = slugKey(name)
      if (get().masterCategories.some((c) => c.key === key)) return { ok: false, error: `${name} already exists` }
      const snapshot = structureSnapshot()
      set((st) => ({ masterCategories: [...st.masterCategories, { key, label: name, hue: hash(key) % 360, builtIn: false, active: true }] }))
      recordStructural('master.add', `Category · ${name}`, 'Added to the metal taxonomy. Available to the catalogue builder from now on.', null, name, snapshot)
      get().audit('master.add', name, 'Metal category added', 'warning')
      return { ok: true }
    },

    addMasterUom: (code, label, precision) => {
      const err = requireSuperAdmin()
      if (err) return err
      const c = code.trim().toUpperCase()
      if (!c || !label.trim()) return { ok: false, error: 'A unit needs a code and a name' }
      if (get().masterUoms.some((u) => u.code === c)) return { ok: false, error: `${c} already exists` }
      const snapshot = structureSnapshot()
      set((st) => ({ masterUoms: [...st.masterUoms, { code: c, label: label.trim(), precision: precision.trim() || 'Whole numbers', builtIn: false, active: true }] }))
      recordStructural('master.add', `Unit · ${c}`, `${label.trim()} — ${precision.trim() || 'Whole numbers'}`, null, c, snapshot)
      get().audit('master.add', c, 'Unit of measurement added', 'warning')
      return { ok: true }
    },

    upsertMasterYard: (yard) => {
      const err = requireSuperAdmin()
      if (err) return err
      if (!yard.name.trim()) return { ok: false, error: 'A yard needs a name' }
      const existing = yard.id ? get().masterYards.find((y) => y.id === yard.id) : undefined
      const snapshot = structureSnapshot()
      if (existing) {
        set((st) => ({ masterYards: st.masterYards.map((y) => (y.id === existing.id ? { ...y, ...yard, id: existing.id } : y)) }))
        recordStructural('master.edit', `Yard · ${existing.name}`, 'Yard details updated', existing.address, yard.address, snapshot)
        get().audit('master.edit', existing.name, 'Yard details updated', 'info')
        return { ok: true }
      }
      const id = uid('yard')
      set((st) => ({ masterYards: [...st.masterYards, { ...yard, id, builtIn: false, active: true }] }))
      recordStructural('master.add', `Yard · ${yard.name}`, `${yard.region} — available to the catalogue builder`, null, yard.name, snapshot)
      get().audit('master.add', yard.name, 'Yard added', 'warning')
      return { ok: true }
    },

    setMasterActive: (kind, id, active) => {
      const err = requireSuperAdmin()
      if (err) return err
      const s = get()
      const snapshot = structureSnapshot()
      if (kind === 'category') {
        const row = s.masterCategories.find((c) => c.key === id)
        if (!row) return { ok: false, error: 'No such category' }
        const inUse = s.lots.filter((l) => l.category === id && l.catalogueId).length
        if (!active && inUse > 0) return { ok: false, error: `${row.label} is on ${inUse} catalogued lot${inUse === 1 ? '' : 's'}. Retiring it would orphan them.` }
        set((st) => ({ masterCategories: st.masterCategories.map((c) => (c.key === id ? { ...c, active } : c)) }))
        recordStructural(active ? 'master.edit' : 'master.deactivate', `Category · ${row.label}`, active ? 'Back in use' : 'Retired — existing lots keep it, new ones cannot pick it', String(!active), String(active), snapshot)
      } else if (kind === 'uom') {
        const row = s.masterUoms.find((u) => u.code === id)
        if (!row) return { ok: false, error: 'No such unit' }
        const inUse = s.lots.filter((l) => l.uom === id).length
        if (!active && inUse > 0) return { ok: false, error: `${row.code} is on ${inUse} lot${inUse === 1 ? '' : 's'}` }
        set((st) => ({ masterUoms: st.masterUoms.map((u) => (u.code === id ? { ...u, active } : u)) }))
        recordStructural(active ? 'master.edit' : 'master.deactivate', `Unit · ${row.code}`, active ? 'Back in use' : 'Retired', String(!active), String(active), snapshot)
      } else {
        const row = s.masterYards.find((y) => y.id === id)
        if (!row) return { ok: false, error: 'No such yard' }
        const inUse = s.catalogues.filter((c) => c.yardName === row.name && c.status !== 'closed').length
        if (!active && inUse > 0) return { ok: false, error: `${row.name} has ${inUse} open catalogue${inUse === 1 ? '' : 's'}` }
        set((st) => ({ masterYards: st.masterYards.map((y) => (y.id === id ? { ...y, active } : y)) }))
        recordStructural(active ? 'master.edit' : 'master.deactivate', `Yard · ${row.name}`, active ? 'Back in use' : 'Retired', String(!active), String(active), snapshot)
      }
      get().audit(active ? 'master.activate' : 'master.deactivate', id, `${kind} ${active ? 'reactivated' : 'retired'}`, 'warning')
      return { ok: true }
    },

    renameMasterEntry: (kind, id, label) => {
      const err = requireSuperAdmin()
      if (err) return err
      const next = label.trim()
      if (!next) return { ok: false, error: 'A name is required' }
      const s = get()
      const snapshot = structureSnapshot()
      if (kind === 'category') {
        const row = s.masterCategories.find((c) => c.key === id)
        if (!row) return { ok: false, error: 'No such category' }
        if (row.label === next) return { ok: true }
        set((st) => ({ masterCategories: st.masterCategories.map((c) => (c.key === id ? { ...c, label: next } : c)) }))
        /* The slug stays put on purpose: every lot already catalogued points at
           it, so a rename changes what a buyer reads, never what a record holds. */
        recordStructural('master.edit', `Category · ${next}`,
          `Renamed. The slug "${row.key}" is unchanged, so every lot already using it is unaffected.`, row.label, next, snapshot)
        get().audit('master.edit', row.key, `Category renamed "${row.label}" → "${next}"`, 'warning')
      } else {
        const row = s.masterUoms.find((u) => u.code === id)
        if (!row) return { ok: false, error: 'No such unit' }
        if (row.label === next) return { ok: true }
        set((st) => ({ masterUoms: st.masterUoms.map((u) => (u.code === id ? { ...u, label: next } : u)) }))
        recordStructural('master.edit', `Unit · ${row.code}`,
          `Renamed. The code "${row.code}" is unchanged, so every lot priced in it is unaffected.`, row.label, next, snapshot)
        get().audit('master.edit', row.code, `Unit renamed "${row.label}" → "${next}"`, 'warning')
      }
      return { ok: true }
    },

    updateUserDetails: (userId, patch) => {
      const s = get()
      if (s.role !== 'super_admin' && s.role !== 'sub_admin') return { ok: false, error: 'Accounts are administered by a Sub Admin or a Super Admin' }
      const user = s.users.find((u) => u.id === userId)
      if (!user) return { ok: false, error: 'No such account' }
      if (user.role === 'super_admin' && s.role !== 'super_admin') return { ok: false, error: 'Only another Super Admin can edit a Super Admin account' }
      const clean = {
        name: patch.name?.trim(), firm: patch.firm?.trim(), email: patch.email?.trim(),
        phone: patch.phone?.trim(), city: patch.city?.trim(), gstin: patch.gstin?.trim(),
      }
      if (clean.name === '') return { ok: false, error: 'A name cannot be blank' }
      if (clean.email && s.users.some((u) => u.id !== userId && u.email.toLowerCase() === clean.email!.toLowerCase())) {
        return { ok: false, error: 'Another account already uses that email' }
      }
      const fields = (Object.keys(clean) as (keyof typeof clean)[]).filter((k) => clean[k] !== undefined && clean[k] !== user[k])
      if (fields.length === 0) return { ok: true }
      const before = fields.map((k) => `${k} ${user[k] || '—'}`).join(' · ')
      const after = fields.map((k) => `${k} ${clean[k]}`).join(' · ')
      const next = fields.reduce((acc, k) => ({ ...acc, [k]: clean[k] }), {} as Partial<User>)
      set((st) => ({
        users: st.users.map((u) => (u.id === userId ? { ...u, ...next } : u)),
        currentUser: st.currentUser?.id === userId ? { ...st.currentUser, ...next } : st.currentUser,
      }))
      /* Recorded, never reversed from Change history: putting a contact detail
         back is a correction of its own, made here, with its own entry. */
      recordStructural('account.edit', `${user.name} · ${user.firm}`, `Account details corrected — ${fields.join(', ')}`, before, after)
      get().audit('account.edit', user.name, `${before} → ${after}`, 'warning')
      /* Support changed something on someone else's account. They are told what
         changed, which is what makes a wrong correction findable. */
      if (userId !== s.currentUser?.id) {
        get().notify({
          userId, kind: 'system', title: 'Your account details were updated',
          body: `Support corrected: ${after}. If that is not right, reply on a support ticket and we will put it back.`,
          href: '/profile',
        })
      }
      return { ok: true }
    },

    addTermsVersion: (termsSetId, note) => {
      const err = requireSuperAdmin()
      if (err) return err
      const set0 = get().termsSets.find((t) => t.id === termsSetId)
      if (!set0) return { ok: false, error: 'No such terms set' }
      if (!note.trim()) return { ok: false, error: 'Say what changed — a terms version without a note cannot be explained to a buyer later' }
      const [major, minor] = String(set0.version).replace(/^v/i, '').split('.')
      const next = `v${major}.${Number(minor ?? 0) + 1}`
      set((st) => ({ termsSets: st.termsSets.map((t) => (t.id === termsSetId ? { ...t, version: next } : t)) }))
      recordStructural('master.terms_version', set0.name, note.trim(), String(set0.version), next)
      get().audit('master.terms_version', set0.name, `${set0.version} → ${next} — ${note.trim()}`, 'critical')
      return { ok: true }
    },

    /* ------------------------------- misc ------------------------------- */
    pushToast: (t) => {
      const toast = { ...t, id: uid('toast') }
      set((st) => ({ toasts: [...st.toasts, toast] }))
      setTimeout(() => get().dismissToast(toast.id), 4200)
    },
    dismissToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),

    notify: (n) => {
      set((st) => ({
        notifications: [
          { ...n, id: uid('ntf'), at: new Date(st.now).toISOString(), read: false },
          ...st.notifications,
        ],
      }))
    },
    markNotificationsRead: () => {
      const me = get().currentUser
      set((st) => ({
        notifications: st.notifications.map((n) => (n.userId === null || n.userId === me?.id ? { ...n, read: true } : n)),
      }))
    },

    createDispute: (subject, category, body, lotId) => {
      const me = get().currentUser
      if (!me) return
      const id = uid('dsp')
      set((st) => ({
        disputes: [{
          id, userId: me.id, subject, category, lotId,
          status: 'open' as const, createdAt: new Date(st.now).toISOString(),
          messages: [{ from: 'user' as const, body, at: new Date(st.now).toISOString() }],
        }, ...st.disputes],
      }))
      /* A ticket is a customer waiting. It used to be the one customer-initiated
         action in the store that wrote no audit entry and told nobody — so the
         Sub Admin's own Approvals screen, which reviews the audit trail, could
         not see that support had been asked for anything. */
      get().audit('dispute.open', id.toUpperCase(), `${me.firm} raised "${subject}" (${category})`, 'warning')
      notifyRole(['sub_admin', 'exec_manager'], {
        kind: 'system', title: `New ticket — ${subject}`,
        body: `${me.firm} · ${category}${lotId ? ` · ${get().lots.find((l) => l.id === lotId)?.lotNo ?? ''}` : ''} — ${body.slice(0, 120)}`,
        href: '/sub/disputes',
      })
      get().notify({
        userId: me.id, kind: 'system', title: 'Your ticket is with support',
        body: 'Someone on the support desk will pick it up and reply here.',
        href: '/disputes',
      })
    },

    /* ================= Sub Admin — supervision, support, shift =============
       Every Sub Admin account is identical: the same full menu, the same
       powers. So nothing below asks what an account is *allowed* to do — it
       asks who has picked a piece of work up, which is the only thing that
       actually divides this desk. */

    claimWorkItem: (itemId) => {
      const s = get()
      if (!SUB_ADMIN_ROLES.includes(s.role)) return { ok: false, error: 'Only a Sub Admin claims from this board' }
      const me = s.currentUser
      if (!me) return { ok: false, error: 'Sign in first' }
      const held = s.workClaims[itemId]
      if (held && held.byId !== me.id) {
        const who = s.users.find((u) => u.id === held.byId)
        return { ok: false, error: `${who?.name ?? 'Another Sub Admin'} is already on this one` }
      }
      set((st) => ({ workClaims: { ...st.workClaims, [itemId]: { byId: me.id, at: new Date(st.now).toISOString() } } }))
      return { ok: true }
    },

    releaseWorkItem: (itemId) => {
      set((st) => {
        const next = { ...st.workClaims }
        delete next[itemId]
        return { workClaims: next }
      })
    },

    reviewAction: (eventId, verdict, note) => {
      const s = get()
      if (!SUB_ADMIN_ROLES.includes(s.role)) return { ok: false, error: 'Only a Sub Admin reviews another role\'s work' }
      const ev = s.auditEvents.find((e) => e.id === eventId)
      if (!ev) return { ok: false, error: 'That entry is no longer on the record' }
      if (s.actionReviews.some((r) => r.eventId === eventId)) return { ok: false, error: 'You have already reviewed this one' }
      if (verdict !== 'confirmed' && !note.trim()) {
        return { ok: false, error: 'Say what is wrong with it — the person who did it is shown this word for word' }
      }

      // Questioning or reversing a finding does not rewind the action: whoever
      // holds the lever does that. What this decides is where the finding goes.
      const escalatedTo: Role | undefined = verdict === 'reversed'
        ? (REVERSAL_NEEDS_SUPER.some((a) => ev.action.startsWith(a)) ? 'super_admin' : undefined)
        : undefined

      const review: ActionReview = {
        id: uid('rev'), eventId, verdict, note: note.trim(),
        at: new Date(s.now).toISOString(), byId: s.currentUser?.id ?? 'system', escalatedTo,
      }
      set((st) => ({ actionReviews: [review, ...st.actionReviews] }))

      get().audit(`review.${verdict}`, ev.target,
        `${ev.action} by ${s.users.find((u) => u.id === ev.actorId)?.name ?? 'system'} — ${verdict}${review.note ? `: ${review.note}` : ''}`,
        verdict === 'confirmed' ? 'info' : 'warning')

      // The role that did the work hears about it, not just the record.
      if (ev.actorId !== 'system' && ev.actorId !== review.byId) {
        get().notify({
          userId: ev.actorId, kind: 'system',
          title: verdict === 'confirmed' ? `${ev.target} — reviewed and confirmed`
            : verdict === 'questioned' ? `A question about ${ev.target}`
              : `${ev.target} — sent back`,
          body: review.note || 'Reviewed by a Sub Admin. No change needed.',
        })
      }
      if (escalatedTo) {
        /* Addressed to the desk that can act on it. This used to be a
           null-addressed notice, which every buyer and seller received. */
        notifyRole('super_admin', {
          kind: 'system',
          title: `Sub Admin review needs Super Admin — ${ev.target}`,
          body: review.note, href: '/admin/control-tower',
        })
      }
      return { ok: true, escalatedTo }
    },

    assignDispute: (id) => {
      const me = get().currentUser
      if (!me) return
      set((st) => ({
        disputes: st.disputes.map((d) => (d.id === id
          ? { ...d, assignedToId: me.id, status: d.status === 'open' ? ('in_review' as const) : d.status }
          : d)),
      }))
    },

    replyToDispute: (id, body) => {
      const s = get()
      if (!SUPPORT_ROLES.includes(s.role)) return { ok: false, error: 'Only the support desk replies on a ticket' }
      if (!body.trim()) return { ok: false, error: 'Write the reply first' }
      const d = s.disputes.find((x) => x.id === id)
      if (!d) return { ok: false, error: 'Ticket not found' }
      if (d.status === 'resolved') return { ok: false, error: 'This ticket is closed' }
      const at = new Date(s.now).toISOString()
      set((st) => ({
        disputes: st.disputes.map((x) => (x.id === id
          ? {
            ...x,
            status: 'in_review' as const,
            assignedToId: x.assignedToId ?? st.currentUser?.id,
            messages: [...x.messages, { from: 'support' as const, body: body.trim(), at }],
          }
          : x)),
      }))
      get().audit('dispute.reply', d.id.toUpperCase(), `Replied on "${d.subject}"`)
      get().notify({
        userId: d.userId, kind: 'system',
        title: 'Support replied to your ticket',
        body: body.trim().slice(0, 140), href: '/disputes',
      })
      return { ok: true }
    },

    resolveDispute: (id, outcome, resolution, amount) => {
      const s = get()
      if (!SUPPORT_ROLES.includes(s.role)) return { ok: false, error: 'Only the support desk closes a ticket' }
      const d = s.disputes.find((x) => x.id === id)
      if (!d) return { ok: false, error: 'Ticket not found' }
      if (d.status === 'resolved') return { ok: false, error: 'Already closed' }
      if (!resolution.trim()) return { ok: false, error: 'Say how it was resolved — the customer is shown this' }

      // Money owed is where this desk stops. The refund is raised here so the
      // customer sees a decision immediately, but it is Finance that approves
      // and pays it — and until they have, the ticket stays open.
      let refundRaised = false
      let refundId: string | undefined
      if (outcome === 'refund_due') {
        if (!(amount && amount > 0)) return { ok: false, error: 'Enter the amount owed back' }
        const before = get().refundRequests.length
        const res = get().raiseRefund({
          userId: d.userId, amount, source: 'dispute', reason: resolution.trim(), disputeId: d.id, lotId: d.lotId,
        })
        if (!res.ok) return { ok: false, error: res.error }
        refundRaised = true
        if (get().refundRequests.length > before) refundId = get().refundRequests[0].id
      }

      const at = new Date(s.now).toISOString()
      const closes = outcome !== 'refund_due'
      set((st) => ({
        disputes: st.disputes.map((x) => (x.id === id
          ? {
            ...x,
            status: closes ? ('resolved' as const) : ('in_review' as const),
            outcome, resolution: resolution.trim(), refundId,
            assignedToId: x.assignedToId ?? st.currentUser?.id,
            ...(closes ? { resolvedAt: at, resolvedById: st.currentUser?.id } : {}),
            messages: [...x.messages, { from: 'support' as const, body: resolution.trim(), at }],
          }
          : x)),
      }))
      get().audit('dispute.resolve', d.id.toUpperCase(),
        `"${d.subject}" — ${outcome.replace('_', ' ')}${refundRaised ? `, refund of ${inr(amount ?? 0)} raised with Finance` : ''}: ${resolution.trim()}`,
        outcome === 'declined' ? 'warning' : 'info')
      get().notify({
        userId: d.userId, kind: 'system',
        title: closes ? 'Your ticket has been resolved' : 'Your ticket has been decided — refund with Finance',
        body: refundRaised
          ? `${resolution.trim()} A refund of ${inr(amount ?? 0)} is with Finance; the ticket stays open until it has been paid.`
          : resolution.trim(),
        href: '/disputes',
      })
      return { ok: true, refundRaised }
    },

    submitContentDraft: ({ page, section, before, after, needsCeo }) => {
      const s = get()
      if (!SUB_ADMIN_ROLES.includes(s.role)) return { ok: false, error: 'Only a Sub Admin drafts platform copy' }
      if (!page.trim() || !section.trim()) return { ok: false, error: 'Say which page and which section' }
      if (!after.trim()) return { ok: false, error: 'Write the new copy' }
      if (after.trim() === before.trim()) return { ok: false, error: 'The new copy is the same as what is live' }
      // Every public number comes from the system that owns it. A content
      // editor typing a lot count, a rate or a fee into a page is exactly how
      // the site ends up contradicting the books.
      if (/(₹|\bRs\.?\b|\d[\d,]*\s*(%|MT\b|lots?\b|crore|lakh))/i.test(after)) {
        return { ok: false, error: 'Figures cannot be typed into copy — lot counts, rates and fees are read from the system that owns them' }
      }
      const draft: ContentDraft = {
        id: uid('cnt'), page: page.trim(), section: section.trim(),
        authorId: s.currentUser?.id ?? 'system',
        submittedAt: new Date(s.now).toISOString(),
        before: before.trim(), after: after.trim(),
        status: 'submitted', needsCeo,
      }
      set((st) => ({ contentDrafts: [draft, ...st.contentDrafts] }))
      get().audit('content.draft', `${draft.page} · ${draft.section}`,
        `Submitted for publishing${needsCeo ? ' — pricing/legal copy, needs the CEO as well as us' : ''}`)
      /* Publishing is the Super Admin's, and pricing or legal copy needs the CEO
         too. Addressed to them — not broadcast to every buyer and seller, which
         is what a null userId does. */
      notifyRole('super_admin', {
        kind: 'system',
        title: 'Content waiting to be published',
        body: `${draft.page} · ${draft.section} — drafted by ${s.currentUser?.name ?? 'a Sub Admin'}.`,
        href: '/admin/content',
      })
      if (needsCeo) {
        notifyRole('ceo', {
          kind: 'system',
          title: 'Content needs your signature',
          body: `${draft.page} · ${draft.section} — pricing or legal copy, so it does not go live on our say-so alone.`,
          href: '/ceo/approvals',
        })
      }
      return { ok: true }
    },

    saveHandoverNote: (body) => {
      const s = get()
      if (!body.trim()) return { ok: false, error: 'Nothing to hand over yet' }
      const note: HandoverNote = {
        id: uid('hn'), byId: s.currentUser?.id ?? 'system',
        at: new Date(s.now).toISOString(), body: body.trim(),
      }
      set((st) => ({ handoverNotes: [note, ...st.handoverNotes] }))
      get().audit('shift.handover', s.currentUser?.name ?? 'Sub Admin', body.trim().slice(0, 160))
      return { ok: true }
    },

    clearWinFlag: () => set({ lastWonLotId: null }),

    audit: (action, target, detail, severity = 'info') => {
      const me = get().currentUser
      set((st) => ({
        auditEvents: [{
          id: uid('aud'), at: new Date(st.now).toISOString(),
          actorId: me?.id ?? 'system', action, target, detail, severity,
        }, ...st.auditEvents],
      }))
    },
  }
})

/* ------------------------- derived-data helpers --------------------------- */

/** Selection summary for §9 — N lots · EMD required/funded/shortfall. */
export function selectionSummary(s: Pick<State, 'selections' | 'lots'>, buyerId: string | undefined, catalogueId: string) {
  const sel = buyerId ? s.selections.find((x) => x.buyerId === buyerId && x.catalogueId === catalogueId) : undefined
  const lotIds = sel?.lotIds ?? []
  const funded = sel?.emdFundedLotIds ?? []
  const selLots = s.lots.filter((l) => lotIds.includes(l.id))
  const required = selLots.reduce((sum, l) => sum + l.preBidEmd, 0)
  const fundedAmt = s.lots.filter((l) => funded.includes(l.id)).reduce((sum, l) => sum + l.preBidEmd, 0)
  return {
    sel, lotIds, fundedLotIds: funded,
    count: lotIds.length, required, funded: fundedAmt,
    shortfall: Math.max(0, required - fundedAmt),
    unfundedLotIds: lotIds.filter((id) => !funded.includes(id)),
  }
}

/** True once every shortlisted lot's pre-bid EMD is funded — the catalogue is
 *  "done": lot selection AND the catalogue-level watchlist star both lock from
 *  here (Browse & Shortlist, the catalogue detail page, and the EMD drill-down
 *  all read this the same way) until the lot closes. */
export function isCatalogueEmdLocked(
  s: Pick<State, 'selections' | 'lots'>, buyerId: string | undefined, catalogueId: string,
): boolean {
  const summary = selectionSummary(s, buyerId, catalogueId)
  return summary.count > 0 && summary.shortfall === 0
}

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

const IST_OFFSET_MS = 5.5 * 60 * 60_000

/** IST wall-clock components for an epoch ms instant, via explicit UTC+5:30
 *  offset arithmetic — never Date#getHours(), which reads the host's own
 *  timezone (state.now is real Date.now(), not a timezone-shifted clock). */
const istParts = (nowMs: number) => {
  const ist = new Date(nowMs + IST_OFFSET_MS)
  return { day: ist.getUTCDay(), minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes() }
}

export const fmtClock = (h: number, m: number): string => {
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

/** Pure — is `nowMs` inside the configured withdrawal processing window?
 *  Used by BOTH requestWithdrawal (enforcement) and the Wallet UI (button
 *  gating + copy) — one source of truth, not duplicated logic. */
export function withinWithdrawalWindow(config: WithdrawalWindowConfig, nowMs: number): boolean {
  const { day, minutes } = istParts(nowMs)
  if (!config.days.includes(day)) return false
  const start = config.startHour * 60 + config.startMinute
  const end = config.endHour * 60 + config.endMinute
  return minutes >= start && minutes < end
}

/** Pure — human copy for the next available window, e.g.
 *  "Next window: Monday 11:00 AM". */
export function nextWithdrawalWindowLabel(config: WithdrawalWindowConfig, nowMs: number): string {
  if (config.days.length === 0) return 'Withdrawals are currently disabled.'
  const { day: today, minutes: nowMinutes } = istParts(nowMs)
  const start = config.startHour * 60 + config.startMinute
  for (let add = 0; add <= 7; add++) {
    const day = (today + add) % 7
    if (!config.days.includes(day)) continue
    if (add === 0 && nowMinutes >= start) continue
    const dayLabel = add === 0 ? 'today' : add === 1 ? 'tomorrow' : WEEKDAY_FULL[day]
    return `Next window: ${dayLabel} ${fmtClock(config.startHour, config.startMinute)}`
  }
  return 'No upcoming withdrawal window configured.'
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
 *  for a role whose menu is one flat list — which is every role but the three
 *  operations desks, whose menus are too long to read as one row of tabs. */
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
