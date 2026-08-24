/* ---------------------------------------------------------------------------
   Pure, side-effect-free constants and small helper functions shared across
   the store's composition root (store.ts) and its slices. Split out of
   store.ts unchanged — every value and every doc comment here is copied
   verbatim from where it used to live in that one file, so that both the
   seed-building code in store.ts and every slices/*.ts file can depend on
   them without a circular import between store.ts and its own slices.
--------------------------------------------------------------------------- */
import type { CeoApprovalKind, CeoDelegation, FinanceConfig, LiftingChecklistItem, Role, User, WithdrawalWindowConfig } from '../types'
import type { MeResponse } from '../api/auth'
import type { State } from './types'

/** Every role that is a public, unauthenticated shell: no account, no demo
 *  identity, nothing of their own on the platform. `guest_buyer` is one of them
 *  — it walks the buyer's screens read-only, but it is still nobody. */
export const ANONYMOUS_ROLES = ['guest', 'guest1', 'guest_buyer'] as const
export type AnonymousRole = (typeof ANONYMOUS_ROLES)[number]
export const isAnonymousRole = (role: Role): role is AnonymousRole =>
  (ANONYMOUS_ROLES as readonly string[]).includes(role)

/** Demo identity per role for the header role switcher. The anonymous shells
 *  above have none — there is no demo user to look up. */
export const ROLE_DEMO_USER: Record<Exclude<Role, AnonymousRole>, string> = {
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
  guest_buyer: 'Guest preview',
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
  // A guest preview lands where the tour is: the buyer's own marketplace.
  guest_buyer: '/buyermarketplace',
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
export const PUBLISH_ROLES: Role[] = ['auction_manager', 'exec_manager', 'sub_admin', 'super_admin']
/** Pause · resume · extend, and raising a cancellation request. */
export const AUCTION_FLOOR_ROLES: Role[] = ['auction_manager', 'sub_admin', 'super_admin']
/** Confirming a closed auction's results and referring a below-reserve lot. */
export const RESULT_ROLES: Role[] = ['auction_manager', 'sub_admin', 'super_admin']
/** The pre-auction quality gate — approve, bypass, send back or reject a lot,
 *  verify a seller, close a handover. The Operation Manager runs it day to day
 *  and the Sub Admin does the same job when covering; both act directly, and
 *  every action is audited by name. */
export const LOT_GATE_ROLES: Role[] = ['exec_manager', 'sub_admin', 'super_admin']
/** Filing a field inspection report — matches /field/inspect's RequireRole. */
export const FIELD_INSPECTION_ROLES: Role[] = ['field_exec', 'exec_manager', 'sub_admin', 'super_admin']
/** Broadcasting to a catalogue's participants. */
export const ANNOUNCE_ROLES: Role[] = ['auction_manager', 'exec_manager', 'sub_admin', 'super_admin']
/** Putting a bid on the record, and escalating it as a void request. */
export const SURVEILLANCE_ROLES: Role[] = ['auction_manager', 'sub_admin', 'super_admin']
/** Executing a money movement — verifying a deposit, paying a withdrawal,
 *  confirming a commission, forfeiting an EMD, returning a refund. Deliberately
 *  narrow: the Sub Admin *sees* every one of these and may recommend, but only
 *  Finance approves and processes. Super Admin holds it for support and
 *  recovery, never as a routine desk. */
export const FINANCE_ROLES: Role[] = ['finance_admin', 'super_admin']
/** Who may put a gross weighment on the record on the platform's behalf. The
 *  figure decides the final invoice and any shortfall refund, so a buyer's own
 *  reading is a declaration: one of these has to witness it before Operations
 *  can close the handover against it. */
export const WEIGHMENT_WITNESS_ROLES: Role[] = ['exec_manager', 'field_exec', 'sub_admin', 'super_admin']
/** The head of operations. Every Sub Admin account is identical — the same full
 *  menu and the same powers — so this is the whole of the access question for
 *  the supervisory screens; there is deliberately no per-account template. */
export const SUB_ADMIN_ROLES: Role[] = ['sub_admin', 'super_admin']

/** Mirrors IMPERSONATION_BLOCKED_ROLES in server/src/api/auth.mjs — the
 *  server is the one that actually enforces this; this copy is only for
 *  deciding whether to show the "Log in as" button at all. See that file's
 *  comment for why these three specifically. */
export const IMPERSONATION_BLOCKED_ROLES: Role[] = ['super_admin', 'sub_admin', 'ceo']
/** Answering and closing a customer's ticket. */
export const SUPPORT_ROLES: Role[] = ['sub_admin', 'exec_manager', 'super_admin']
/** Findings a Sub Admin cannot act on themselves, whatever they conclude: a
 *  bid, a ban and a live auction are Super Admin levers, so a "reverse this"
 *  verdict on one is a hand-off rather than an action. */
export const REVERSAL_NEEDS_SUPER = ['bid.', 'auction.cancel', 'account.status', 'user.standing']
/** Clearing a CEO-threshold decision. The CEO signs; the Super Admin holds it
 *  for support and recovery, and a named delegate may sign while a delegation
 *  is running (see `canSignForCeo`). The record always names whoever actually
 *  decided, so a delegated signature is never mistaken for the CEO's own. */
export const CEO_ROLES: Role[] = ['ceo', 'super_admin']

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
  'guest', 'guest1', 'guest_buyer', 'buyer', 'seller', 'field_exec', 'exec_manager', 'auction_manager', 'finance_admin', 'sub_admin', 'super_admin', 'ceo',
]

/** Demo sign-in credentials for the manager Login page: user ID → role.
 *  Every account uses DEMO_PASSWORD. */
export const DEMO_LOGINS: Record<string, Exclude<Role, AnonymousRole>> = {
  'buy@gmail.com': 'buyer',
  'sell@gmail.com': 'seller',
  'field@gmail.com': 'field_exec',
  'executive@gmail.com': 'exec_manager',
  'auction@gmail.com': 'auction_manager',
  'finance@gmail.com': 'finance_admin',
  'sub@gmail.com': 'sub_admin',
  'ceo@gmail.com': 'ceo',
}
export const DEMO_PASSWORD = 'FerroBid@Dev2026'

/** Break-glass developer account. Deliberately absent from DEMO_LOGINS, from the
 *  quick-access grid on the sign-in page and from every public page: nobody at
 *  ferroBid, and neither side of the market, is told this role exists. It is how
 *  we get back in when something has to be fixed in an emergency, so it is the
 *  one account with a real password check — the exact pair below, or the attempt
 *  fails as an unknown user ID and gives nothing away. Keep both values out of
 *  anything user-facing. */
export const BREAK_GLASS_ID = 'super@gmail.com'
export const BREAK_GLASS_PASSWORD = 'FamySys@123'

/** Password enforcement in the OFFLINE `signIn` action below.
 *
 *  The Login page no longer uses that action — it calls `signInRemote`, which
 *  posts to /api/auth/login where the password is always checked against a
 *  scrypt hash and cannot be disabled from here. This flag now governs only the
 *  local demo path, which nothing user-facing reaches. */
export const ENFORCE_LOGIN_PASSWORD = true

export const BOT_IDS = ['u-buyer-2', 'u-buyer-3', 'u-buyer-5', 'u-buyer-6', 'u-buyer-7']

export const emptyLiftingChecklist = (): LiftingChecklistItem[] => [
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
export const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Mask a bank account number immediately — only the last 4 digits are ever
 *  persisted or displayed again after initial entry. */
export const maskAccountNumber = (accountNumber: string): { last4: string; masked: string } => {
  const digits = accountNumber.replace(/\D/g, '')
  const last4 = digits.slice(-4).padStart(4, '•')
  const groups = Math.max(0, Math.ceil(Math.max(0, digits.length - 4) / 4))
  return { last4, masked: `${'•••• '.repeat(groups)}${last4}` }
}

/** Stable pseudo-random from a string — so a demo row never changes between
 *  reloads, which is what makes a screenshot of this desk reproducible. */
export const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return Math.abs(h)
}

/** A role key from a typed name — lower case, hyphens, nothing exotic, because
 *  it ends up in a route. */
export const slugKey = (label: string) =>
  label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32)

/** The pages a brand-new role starts with. A role with no menu is a role
 *  nobody can use, so one is created with it — and the record it must retain is
 *  created too, rather than left to be remembered later. */
export const DEFAULT_NEW_ROLE_PAGES: { to: string; label: string; retained?: boolean }[] = [
  { to: '@home', label: 'Dashboard' },
  { to: '/browse', label: 'Browse' },
  { to: '/admin/audit', label: 'My activity', retained: true },
]

/** Routes that are somebody's way into a running sale. While an auction is
 *  live these cannot be hidden from the role that runs it. */
export const isLiveAuctionRoute = (p: { to: string }) =>
  p.to === '/auction' || p.to === '/auction/live' || p.to === '/auction/rooms' || p.to.startsWith('/bidding')

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
/** A strong password, shown once. Deliberately excludes the character pairs
 *  people mis-read down a phone line — 0/O, 1/l/I — because that is exactly how
 *  this one gets delivered. */
export function generatePassword(): string {
  const pick = (n: number) => Array.from({ length: n }, () => PASSWORD_ALPHABET[Math.floor(Math.random() * PASSWORD_ALPHABET.length)]).join('')
  return `${pick(4)}-${pick(4)}-${pick(4)}`
}

export const fmtStamp = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export const ROLE_KEY = 'fb.demo.role'

/** Remembered across a refresh so a signed-in seller reloading `/seller` sees
 *  their own nav immediately rather than a flash of the wrong one — see the
 *  `storedRole` read this pairs with, in store.ts. */
export function rememberRole(role: Role) {
  try {
    localStorage.setItem(ROLE_KEY, role)
  } catch {
    /* private mode — role just won't survive the refresh */
  }
}

/** Selection summary for §9 — N lots · EMD required/funded/shortfall.
 *
 *  Moved here (out of store.ts's own derived-data section) alongside
 *  `isCatalogueEmdLocked`, which depends on it and is needed by buyerSlice's
 *  `toggleWatchlist` — store.ts re-exports both unchanged via `export *`, so
 *  every existing `from '../store/store'` import keeps working. */
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

/** The server's account shape, projected onto the store's `User`. Shared by
 *  every path that adopts a real session — signing in, restoring one at boot,
 *  and impersonating — so the mapping can't drift between them. */
export function userFromMe(me: MeResponse): User {
  return {
    id: me.user.id,
    name: me.user.name,
    firm: me.user.firm ?? '',
    phone: me.user.phone ?? '',
    email: me.user.email ?? '',
    role: me.user.role as Role,
    kycStatus: (me.user.kycStatus ?? 'none') as User['kycStatus'],
    sellerVerified: !!me.user.sellerVerified,
    standing: (me.user.standing ?? 'good') as User['standing'],
    city: me.user.city ?? '',
    gstin: me.user.gstin ?? '',
    avatarHue: me.user.avatarHue ?? 0,
    joinedAt: me.user.joinedAt ?? new Date().toISOString(),
    bidderId: me.user.bidderId ?? null,
    sellerId: null,
    accountStatus: (me.user.status ?? 'active') as User['accountStatus'],
    lastActiveAt: me.user.lastLoginAt ?? undefined,
  }
}
