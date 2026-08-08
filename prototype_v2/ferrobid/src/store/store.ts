/* ---------------------------------------------------------------------------
   ferroBid client store — the in-memory source of truth.
   Seeded from local JSON; all mutations happen here. A 1s tick drives
   countdowns, competing-bidder bots, anti-snipe extensions and lot closing.
--------------------------------------------------------------------------- */
import { create } from 'zustand'
import { loadSeed } from './seed'
import { uid, inr, num } from '../lib/format'
import type {
  AppNotification, AuditEvent, AutoBidSetting, BankAccount, Bid, BidType, BuyerLotSelection,
  Catalogue, CompanyBankAccount, DemandDraft, DeliveryOrder, DepositClaim, Dispute, InspectionReport,
  LiftingChecklistItem, Lot, LotStatus, NotificationKind, Role, User, WithdrawalRequest, WithdrawalWindowConfig,
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
  sub_admin: 'u-sub-1',
  super_admin: 'u-super-1',
}

export const ROLE_LABEL: Record<Role, string> = {
  guest: 'Guest',
  guest1: 'Guest 1',
  guest2: 'Guest 2',
  buyer: 'Buyer',
  seller: 'Seller',
  field_exec: 'Field Executive',
  exec_manager: 'Executive Manager',
  sub_admin: 'Sub-Admin',
  super_admin: 'Super Admin',
}

export const ROLE_HOME: Record<Role, string> = {
  guest: '/',
  guest1: '/home',
  guest2: '/g2',
  buyer: '/buyer',
  seller: '/seller',
  field_exec: '/field',
  exec_manager: '/exec',
  sub_admin: '/sub',
  super_admin: '/admin',
}

/** Canonical display order for the role switcher(s). Single source of truth —
 *  consumed by the Chrome header switcher and the Guest1 homepage switcher so
 *  the list can't drift between them, and used to validate the persisted role
 *  read back from localStorage. */
export const ROLE_ORDER: Role[] = [
  'guest', 'guest1', 'guest2', 'buyer', 'seller', 'field_exec', 'exec_manager', 'sub_admin', 'super_admin',
]

/** Demo sign-in credentials for the manager Login page: user ID → role.
 *  Every account uses DEMO_PASSWORD. */
export const DEMO_LOGINS: Record<string, Exclude<Role, 'guest' | 'guest1' | 'guest2'>> = {
  'buy@gmail.com': 'buyer',
  'sell@gmail.com': 'seller',
  'field@gmail.com': 'field_exec',
  'executive@gmail.com': 'exec_manager',
  'sub@gmail.com': 'sub_admin',
  'super@gmail.com': 'super_admin',
}
export const DEMO_PASSWORD = 'Admin@123'

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
  autoBids: AutoBidSetting[]
  inspectionSlots: typeof seed.inspectionSlots
  bankAccounts: BankAccount[]
  depositClaims: DepositClaim[]
  withdrawalRequests: WithdrawalRequest[]
  companyBankAccounts: CompanyBankAccount[]
  withdrawalWindow: WithdrawalWindowConfig

  termsAccepted: Record<string, string> // catalogueId → version accepted (per current session)
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

  /* --- buyer --- */
  toggleShortlist: (catalogueId: string, lotId: string) => void
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

  /* --- seller --- */
  createLot: (lot: Partial<Lot>) => void

  /* --- ops / admin --- */
  submitInspection: (lotId: string, report: Omit<InspectionReport, 'id' | 'lotId' | 'date'>, outcome: 'verified' | 'flagged' | 'rejected') => void
  setLotStatus: (lotId: string, status: LotStatus) => void
  publishCatalogue: (cat: Catalogue, lotIds: string[], overrides: Record<string, Partial<Lot>>) => void
  assignCatalogue: (catalogueId: string, fieldExecId: string) => void
  waiveInspection: (lotId: string, managerId: string, reason: string) => void
  publishDraftCatalogue: (catalogueId: string, mode: 'now' | 'schedule') => { ok: boolean; error?: string }
  pauseCatalogue: (catalogueId: string) => void
  resumeCatalogue: (catalogueId: string) => void
  extendCatalogue: (catalogueId: string, minutes: number) => void
  cancelCatalogue: (catalogueId: string) => void
  voidBid: (bidId: string) => void
  setUserStanding: (userId: string, standing: User['standing'], reason?: string) => void
  issueDemandDraft: (doId: string, dd: { ddNumber: string; issuingBank: string; amount: number }) => void
  verifyBankAccount: (id: string) => void
  rejectBankAccount: (id: string, reason?: string) => void
  approveDepositClaim: (id: string) => void
  rejectDepositClaim: (id: string, reason?: string) => void
  approveWithdrawal: (id: string) => void
  processWithdrawal: (id: string) => void
  failWithdrawal: (id: string, reason?: string) => void
  setWithdrawalWindow: (config: WithdrawalWindowConfig) => void
  setCompanyBankAccounts: (accounts: CompanyBankAccount[]) => void

  /* --- misc --- */
  pushToast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
  notify: (n: { userId: string | null; kind: NotificationKind; title: string; body: string; href?: string }) => void
  markNotificationsRead: () => void
  createDispute: (subject: string, category: Dispute['category'], body: string, lotId?: string) => void
  clearWinFlag: () => void
  audit: (action: string, target: string, detail: string, severity?: 'info' | 'warning' | 'critical') => void
}

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

export const useStore = create<State>((set, get) => {
  /* ---------- internal helpers (operate via set/get) ---------- */

  const wallet = (userId: string) => get().wallets.find((w) => w.userId === userId)

  const ensureWallet = (userId: string) => {
    if (!wallet(userId)) {
      set((s) => ({ wallets: [...s.wallets, { userId, balance: 0, emdLocked: 0, ledger: [] }] }))
    }
    return wallet(userId)!
  }

  const applyBid = (lotId: string, rate: number, bidderId: string, type: BidType): { ok: boolean; error?: string } => {
    const s = get()
    const lot = s.lots.find((l) => l.id === lotId)
    if (!lot) return { ok: false, error: 'Lot not found' }
    const cat = s.catalogues.find((c) => c.id === lot.catalogueId)
    if (!cat || cat.status !== 'live' || lot.status !== 'live') return { ok: false, error: 'Lot is not live' }
    if (s.paused[cat.id]) return { ok: false, error: 'Auction is paused by the administrator' }
    const minRate = lot.currentRate == null ? lot.startRate : lot.currentRate + lot.increment
    if (rate < minRate) return { ok: false, error: `Minimum next bid is ${inr(minRate)}/${lot.uom}` }

    const prevLeader = lot.leadingBidderId
    const bid: Bid = {
      id: uid('bid'), lotId, catalogueId: cat.id, bidderId, rate,
      at: new Date(s.now).toISOString(), type, status: 'valid',
    }

    // anti-snipe: a bid inside the last N minutes extends the lot by N minutes
    let endsAt = lot.endsAt
    let extensions = lot.extensions
    const msLeft = Date.parse(lot.endsAt) - s.now
    if (msLeft < cat.antiSnipeMinutes * 60_000) {
      endsAt = new Date(Date.parse(lot.endsAt) + cat.antiSnipeMinutes * 60_000).toISOString()
      extensions += 1
    }

    set((st) => ({
      bids: [...st.bids, bid],
      lots: st.lots.map((l) =>
        l.id === lotId
          ? { ...l, currentRate: rate, leadingBidderId: bidderId, bidCount: l.bidCount + 1, endsAt, extensions }
          : l,
      ),
    }))

    const me = get().currentUser
    if (me && prevLeader === me.id && bidderId !== me.id) {
      const bidder = get().users.find((u) => u.id === bidderId)
      get().notify({
        userId: me.id, kind: 'bid', title: `Outbid on ${lot.lotNo}`,
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
      const next = (lot.currentRate ?? lot.startRate - lot.increment) + lot.increment
      if (next <= ab.maxRate) applyBid(lot.id, next, me.id, 'auto')
    }
  }

  const runBots = () => {
    const s = get()
    for (const lot of s.lots) {
      if (lot.status !== 'live' || !lot.catalogueId) continue
      const cat = s.catalogues.find((c) => c.id === lot.catalogueId)
      if (!cat || cat.status !== 'live' || s.paused[cat.id]) continue
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

      if (me) {
        const sel = s.selections.find((x) => x.buyerId === me.id && x.catalogueId === cat.id)
        const funded = sel?.emdFundedLotIds.includes(lot.id)
        if (lot.leadingBidderId === me.id && status === 'sold') {
          set({ lastWonLotId: lot.id })
          get().notify({
            userId: me.id, kind: 'bid', title: `You won ${lot.lotNo} 🎉`,
            body: `H1 confirmed at ${inr(lot.currentRate!)}/${lot.uom}. Delivery order will be issued after settlement.`,
            href: '/buyer/fulfilment',
          })
          set((st) => ({
            deliveryOrders: [...st.deliveryOrders, {
              id: uid('do'), lotId: lot.id, catalogueId: cat.id, buyerId: me.id,
              stage: 'payment_pending' as const, h1Rate: lot.currentRate!, awardedQty: lot.indicativeQty, uom: lot.uom,
              materialValue: Math.round(lot.currentRate! * lot.indicativeQty),
              gstAmount: Math.round(lot.currentRate! * lot.indicativeQty * 0.18),
              tcsAmount: Math.round(lot.currentRate! * lot.indicativeQty * 0.01),
              liftingChecklist: emptyLiftingChecklist(),
              paidAmount: 0, liftingBy: new Date(s.now + 7 * 86400_000).toISOString(),
              createdAt: new Date(s.now).toISOString(),
            }],
          }))
        } else if (funded && lot.leadingBidderId !== me.id) {
          // unsuccessful bidder — EMD auto-refund
          set((st) => ({
            wallets: st.wallets.map((w) =>
              w.userId === me.id
                ? {
                    ...w, balance: w.balance + lot.preBidEmd, emdLocked: Math.max(0, w.emdLocked - lot.preBidEmd),
                    ledger: [{ id: uid('led'), at: new Date(s.now).toISOString(), type: 'emd_release' as const, amount: lot.preBidEmd, ref: uid('EMDR').toUpperCase(), lotId: lot.id, catalogueId: cat.id, note: `EMD auto-released — ${lot.lotNo} (${cat.code})` }, ...w.ledger],
                  }
                : w,
            ),
            selections: st.selections.map((x) =>
              x.buyerId === me.id && x.catalogueId === cat.id
                ? { ...x, emdFundedLotIds: x.emdFundedLotIds.filter((id) => id !== lot.id) }
                : x,
            ),
          }))
          get().notify({
            userId: me.id, kind: 'wallet', title: `EMD released — ${lot.lotNo}`,
            body: `${inr(lot.preBidEmd)} returned to your wallet (auction closed, not H1).`, href: '/buyer/wallet',
          })
        }
      }
    }
    // catalogue lifecycle: go live / close when all lots resolved
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
          return { ...c, status: 'live' as const }
        }
        if (c.status === 'live') {
          const catLots = get().lots.filter((l) => l.catalogueId === c.id)
          if (catLots.length > 0 && catLots.every((l) => !['live', 'approved'].includes(l.status))) {
            return { ...c, status: 'closed' as const }
          }
        }
        return c
      }),
    }))
  }

  return {
    now: Date.now(),
    theme: storedTheme === 'dark' ? 'dark' : 'light',
    role: storedRole,
    currentUser: demoUserFor(storedRole),
    paused: {},

    ...seed,

    withdrawalWindow: DEFAULT_WITHDRAWAL_WINDOW,
    termsAccepted: {},
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
      const role = DEMO_LOGINS[username.trim().toLowerCase()]
      if (!role) return { ok: false, error: 'Unknown user ID' }
      // Password check is disabled for now (ENFORCE_LOGIN_PASSWORD = false).
      if (ENFORCE_LOGIN_PASSWORD && password !== DEMO_PASSWORD) {
        return { ok: false, error: 'Incorrect password' }
      }
      get().switchRole(role)
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

    /* ------------------------------- buyer ------------------------------ */
    toggleShortlist: (catalogueId, lotId) => {
      const me = get().currentUser
      if (!me) return
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

    fundEmd: (catalogueId, lotIds, method) => {
      const s = get()
      const me = s.currentUser
      if (!me) return false
      const w = ensureWallet(me.id)
      const lots = s.lots.filter((l) => lotIds.includes(l.id))
      const total = lots.reduce((sum, l) => sum + l.preBidEmd, 0)
      if (w.balance < total) return false
      const cat = s.catalogues.find((c) => c.id === catalogueId)!
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
        body: `${inr(total)} locked against ${cat.code} via ${method}.`, href: '/buyer/shortlist',
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
    },

    submitKyc: () => {
      const me = get().currentUser
      if (!me) return
      set((st) => ({
        users: st.users.map((u) => (u.id === me.id ? { ...u, kycStatus: 'pending' as const } : u)),
        currentUser: { ...me, kycStatus: 'pending' },
      }))
      get().notify({ userId: me.id, kind: 'system', title: 'Seller KYC submitted', body: 'Our team will verify your GSTIN and bank details within 1 business day (demo: instantly approvable from Sub-Admin).' })
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
      set((st) => ({
        deliveryOrders: st.deliveryOrders.map((d) => {
          if (d.id !== doId || d.stage !== 'lifted' || !me || d.buyerId !== me.id) return d
          return {
            ...d,
            weighedQty: qty,
            liftingChecklist: d.liftingChecklist.map((item) =>
              item.key !== 'gross_weighment' ? item : { ...item, done: true, at: new Date(st.now).toISOString() },
            ),
          }
        }),
      }))
    },

    completeLifting: (doId) => {
      const me = get().currentUser
      const d = get().deliveryOrders.find((x) => x.id === doId)
      if (!d || !me || d.buyerId !== me.id || d.stage !== 'lifted' || !d.liftingChecklist.every((i) => i.done)) return
      set((st) => ({
        deliveryOrders: st.deliveryOrders.map((x) => (x.id === doId ? { ...x, stage: 'completed' as const } : x)),
      }))
      get().audit('do.complete', doId, `Lifting completed — ${num(d.weighedQty ?? d.awardedQty)} ${d.uom} weighed vs ${num(d.awardedQty)} ${d.uom} indicative`)
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
    },

    /* ------------------------------ seller ------------------------------ */
    createLot: (partial) => {
      const me = get().currentUser
      const id = uid('lot')
      const lot: Lot = {
        id, lotNo: `UNL-${id.slice(-4).toUpperCase()}`, catalogueId: null as unknown as string,
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
      get().audit('lot.create', lot.lotNo, `${me?.firm ?? 'Seller'} submitted ${lot.grade || lot.metal} for inspection`)
    },

    /* ---------------------------- ops / admin --------------------------- */
    submitInspection: (lotId, report, outcome) => {
      const me = get().currentUser
      const lot = get().lots.find((l) => l.id === lotId)
      const rep: InspectionReport = {
        ...report, id: uid('ir'), lotId, date: new Date(get().now).toISOString(),
        status: outcome, inspectorId: me?.id ?? 'u-field-1',
      }
      const lotStatus: LotStatus = outcome === 'verified' ? 'inspected' : outcome === 'flagged' ? 'flagged' : 'rejected'
      set((st) => ({
        inspectionReports: [...st.inspectionReports, rep],
        lots: st.lots.map((l) => (l.id === lotId ? { ...l, status: lotStatus, inspectionReportId: rep.id } : l)),
      }))
      get().audit('inspection.submit', lot?.lotNo ?? lotId, `Inspection ${outcome} — measured ${report.measuredQty} ${report.uom}`)
    },

    setLotStatus: (lotId, status) => {
      set((st) => ({ lots: st.lots.map((l) => (l.id === lotId ? { ...l, status } : l)) }))
    },

    publishCatalogue: (cat, lotIds, overrides) => {
      const isDraft = cat.status === 'draft'
      set((st) => ({
        catalogues: [...st.catalogues, { ...cat, lotIds }],
        lots: st.lots.map((l) => {
          if (!lotIds.includes(l.id)) return l
          const idx = lotIds.indexOf(l.id)
          return {
            ...l, ...overrides[l.id], catalogueId: cat.id,
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
      if (!isDraft) {
        get().notify({ userId: null, kind: 'lifecycle', title: `New catalogue ${cat.code}`, body: cat.title, href: `/catalogue/${cat.id}` })
      }
    },

    assignCatalogue: (catalogueId, fieldExecId) => {
      set((st) => ({
        catalogues: st.catalogues.map((c) => (c.id === catalogueId ? { ...c, assignedFieldExecId: fieldExecId } : c)),
      }))
      const cat = get().catalogues.find((c) => c.id === catalogueId)
      const exec = get().users.find((u) => u.id === fieldExecId)
      get().audit('catalogue.assign', cat?.code ?? catalogueId, `Assigned to ${exec?.name ?? fieldExecId} for field inspection`)
    },

    waiveInspection: (lotId, managerId, reason) => {
      const lot = get().lots.find((l) => l.id === lotId)
      set((st) => ({
        lots: st.lots.map((l) =>
          l.id === lotId
            ? { ...l, status: 'approved' as LotStatus, inspectionWaived: true, waivedBy: managerId, waivedReason: reason, waivedAt: new Date(st.now).toISOString() }
            : l,
        ),
      }))
      get().audit('inspection.waive', lot?.lotNo ?? lotId, `Inspection waived — known seller${reason ? `: ${reason}` : ''}`)
    },

    publishDraftCatalogue: (catalogueId, mode) => {
      const s = get()
      const cat = s.catalogues.find((c) => c.id === catalogueId)
      if (!cat) return { ok: false, error: 'Catalogue not found' }
      const catLots = s.lots.filter((l) => l.catalogueId === catalogueId)
      const unresolved = catLots.filter((l) => l.status !== 'approved')
      if (unresolved.length > 0) {
        return { ok: false, error: `${unresolved.length} lot${unresolved.length > 1 ? 's' : ''} still need${unresolved.length > 1 ? '' : 's'} approval` }
      }
      const nowMs = s.now
      let endsAt = Date.parse(cat.endsAt)
      if (mode === 'now' && endsAt <= nowMs) endsAt = nowMs + 3 * 3600_000
      const status = mode === 'now' ? ('live' as const) : ('upcoming' as const)
      const endsAtIso = new Date(endsAt).toISOString()
      set((st) => ({
        catalogues: st.catalogues.map((c) =>
          c.id === catalogueId
            ? { ...c, status, startsAt: new Date(mode === 'now' ? nowMs : Date.parse(c.startsAt)).toISOString(), endsAt: endsAtIso }
            : c,
        ),
        lots: st.lots.map((l) =>
          l.catalogueId === catalogueId
            ? { ...l, status: status === 'live' ? ('live' as LotStatus) : ('approved' as LotStatus), endsAt: endsAtIso }
            : l,
        ),
      }))
      get().audit('catalogue.publish', cat.code, `Published "${cat.title}" with ${catLots.length} lots`, 'info')
      get().notify({ userId: null, kind: 'lifecycle', title: `New catalogue ${cat.code}`, body: cat.title, href: `/catalogue/${cat.id}` })
      return { ok: true }
    },

    pauseCatalogue: (catalogueId) => {
      set((st) => ({ paused: { ...st.paused, [catalogueId]: true } }))
      const cat = get().catalogues.find((c) => c.id === catalogueId)
      get().audit('auction.pause', cat?.code ?? catalogueId, 'Catalogue paused from Control Tower', 'warning')
    },
    resumeCatalogue: (catalogueId) => {
      set((st) => ({ paused: { ...st.paused, [catalogueId]: false } }))
      const cat = get().catalogues.find((c) => c.id === catalogueId)
      get().audit('auction.resume', cat?.code ?? catalogueId, 'Catalogue resumed from Control Tower')
    },
    extendCatalogue: (catalogueId, minutes) => {
      const ms = minutes * 60_000
      set((st) => ({
        catalogues: st.catalogues.map((c) => (c.id === catalogueId ? { ...c, endsAt: new Date(Date.parse(c.endsAt) + ms).toISOString() } : c)),
        lots: st.lots.map((l) => (l.catalogueId === catalogueId && l.status === 'live' ? { ...l, endsAt: new Date(Date.parse(l.endsAt) + ms).toISOString() } : l)),
      }))
      const cat = get().catalogues.find((c) => c.id === catalogueId)
      get().audit('auction.extend', cat?.code ?? catalogueId, `Extended by ${minutes} minutes from Control Tower`, 'warning')
    },
    cancelCatalogue: (catalogueId) => {
      set((st) => ({
        catalogues: st.catalogues.map((c) => (c.id === catalogueId ? { ...c, status: 'closed' as const } : c)),
        lots: st.lots.map((l) => (l.catalogueId === catalogueId && ['live', 'approved'].includes(l.status) ? { ...l, status: 'unsold' as LotStatus } : l)),
      }))
      const cat = get().catalogues.find((c) => c.id === catalogueId)
      get().audit('auction.cancel', cat?.code ?? catalogueId, 'Catalogue cancelled — all open lots voided, EMD released', 'critical')
    },
    voidBid: (bidId) => {
      const s = get()
      const bid = s.bids.find((b) => b.id === bidId)
      if (!bid) return
      const remaining = s.bids.filter((b) => b.lotId === bid.lotId && b.status === 'valid' && b.id !== bidId)
      const top = remaining.sort((a, b) => b.rate - a.rate)[0] ?? null
      set((st) => ({
        bids: st.bids.map((b) => (b.id === bidId ? { ...b, status: 'void' as const } : b)),
        lots: st.lots.map((l) =>
          l.id === bid.lotId
            ? { ...l, currentRate: top?.rate ?? null, leadingBidderId: top?.bidderId ?? null, bidCount: remaining.length }
            : l,
        ),
      }))
      get().audit('bid.void', bidId, `Bid of ${inr(bid.rate)} on ${bid.lotId} voided from Control Tower`, 'critical')
    },
    setUserStanding: (userId, standing, reason) => {
      set((st) => ({
        users: st.users.map((u) => (u.id === userId ? { ...u, standing, blacklistReason: reason ?? u.blacklistReason } : u)),
      }))
      const u = get().users.find((x) => x.id === userId)
      get().audit('user.standing', u?.firm ?? userId, `Standing set to ${standing}${reason ? ` — ${reason}` : ''}`, standing === 'defaulter' ? 'critical' : 'warning')
    },
    // ops-only — staff record a Demand Draft they received from the buyer
    // offline; this replaces the generic advance for payment_pending→dd_issued
    issueDemandDraft: (doId, dd) => {
      const role = get().role
      if (role !== 'sub_admin' && role !== 'exec_manager') return
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
      get().audit('dd.issue', doId, `Demand Draft ${dd.ddNumber} (${dd.issuingBank}) for ${inr(dd.amount)} recorded`)
    },

    verifyBankAccount: (id) => {
      const role = get().role
      if (role !== 'sub_admin' && role !== 'exec_manager') return
      const a = get().bankAccounts.find((x) => x.id === id)
      if (!a || a.status !== 'pending') return
      set((st) => ({ bankAccounts: st.bankAccounts.map((x) => (x.id === id ? { ...x, status: 'verified' as const } : x)) }))
      get().audit('bankaccount.verify', id, `${a.bankName} account •••• ${a.last4} verified`)
      get().notify({ userId: a.userId, kind: 'wallet', title: 'Bank account verified', body: `${a.bankName} •••• ${a.last4} can now receive withdrawals.`, href: '/buyer/wallet' })
    },

    rejectBankAccount: (id, reason) => {
      const role = get().role
      if (role !== 'sub_admin' && role !== 'exec_manager') return
      const a = get().bankAccounts.find((x) => x.id === id)
      if (!a || a.status !== 'pending') return
      set((st) => ({ bankAccounts: st.bankAccounts.map((x) => (x.id === id ? { ...x, status: 'rejected' as const, rejectionReason: reason } : x)) }))
      get().audit('bankaccount.reject', id, `${a.bankName} account •••• ${a.last4} rejected${reason ? ` — ${reason}` : ''}`, 'warning')
      get().notify({ userId: a.userId, kind: 'wallet', title: 'Bank account rejected', body: reason || 'Please re-register with correct details.', href: '/buyer/wallet' })
    },

    approveDepositClaim: (id) => {
      const role = get().role
      if (role !== 'sub_admin' && role !== 'exec_manager') return
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
      if (role !== 'sub_admin' && role !== 'exec_manager') return
      const me = get().currentUser
      const claim = get().depositClaims.find((c) => c.id === id)
      if (!claim || claim.status !== 'submitted') return
      set((st) => ({
        depositClaims: st.depositClaims.map((c) => (c.id === id ? { ...c, status: 'rejected' as const, rejectionReason: reason, decidedAt: new Date(st.now).toISOString(), decidedBy: me?.id } : c)),
      }))
      get().audit('deposit.reject', id, `Deposit claim rejected${reason ? ` — ${reason}` : ''}`, 'warning')
      get().notify({ userId: claim.userId, kind: 'wallet', title: 'Deposit claim rejected', body: reason || 'Contact support for details.', href: '/buyer/wallet' })
    },

    approveWithdrawal: (id) => {
      const role = get().role
      if (role !== 'sub_admin' && role !== 'exec_manager') return
      const req = get().withdrawalRequests.find((r) => r.id === id)
      if (!req || req.status !== 'requested') return
      set((st) => ({ withdrawalRequests: st.withdrawalRequests.map((r) => (r.id === id ? { ...r, status: 'under_review' as const } : r)) }))
      get().audit('withdrawal.review', id, `Withdrawal of ${inr(req.amount)} picked up for processing`)
    },

    processWithdrawal: (id) => {
      const role = get().role
      if (role !== 'sub_admin' && role !== 'exec_manager') return
      const req = get().withdrawalRequests.find((r) => r.id === id)
      if (!req || req.status !== 'under_review') return
      set((st) => ({ withdrawalRequests: st.withdrawalRequests.map((r) => (r.id === id ? { ...r, status: 'processed' as const, decidedAt: new Date(st.now).toISOString() } : r)) }))
      get().audit('withdrawal.process', id, `Withdrawal of ${inr(req.amount)} processed to bank`)
      get().notify({ userId: req.userId, kind: 'wallet', title: 'Withdrawal processed', body: `${inr(req.amount)} sent to your bank account.`, href: '/buyer/wallet' })
    },

    failWithdrawal: (id, reason) => {
      const role = get().role
      if (role !== 'sub_admin' && role !== 'exec_manager') return
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
      set((st) => ({
        disputes: [{
          id: uid('dsp'), userId: me.id, subject, category, lotId,
          status: 'open' as const, createdAt: new Date(st.now).toISOString(),
          messages: [{ from: 'user' as const, body, at: new Date(st.now).toISOString() }],
        }, ...st.disputes],
      }))
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
