/* ---------------------------------------------------------------------------
   ferroBid client store — the in-memory source of truth.
   Seeded from local JSON; all mutations happen here. A 1s tick drives
   countdowns, competing-bidder bots, anti-snipe extensions and lot closing.
--------------------------------------------------------------------------- */
import { create } from 'zustand'
import { loadSeed } from './seed'
import { uid, inr, num } from '../lib/format'
import type {
  AppNotification, AuditEvent, AutoBidSetting, Bid, BidType, BuyerLotSelection,
  Catalogue, DemandDraft, DeliveryOrder, Dispute, InspectionReport, LiftingChecklistItem, Lot, LotStatus,
  NotificationKind, Role, User,
} from '../types'

const seed = loadSeed()

/** Demo identity per role for the header role switcher. */
export const ROLE_DEMO_USER: Record<Exclude<Role, 'guest'>, string> = {
  buyer: 'u-buyer-1',
  seller: 'u-seller-2',
  field_exec: 'u-field-1',
  exec_manager: 'u-exec-1',
  sub_admin: 'u-sub-1',
  super_admin: 'u-super-1',
}

export const ROLE_LABEL: Record<Role, string> = {
  guest: 'Guest',
  buyer: 'Buyer',
  seller: 'Seller',
  field_exec: 'Field Executive',
  exec_manager: 'Executive Manager',
  sub_admin: 'Sub-Admin',
  super_admin: 'Super Admin',
}

export const ROLE_HOME: Record<Role, string> = {
  guest: '/',
  buyer: '/buyer',
  seller: '/seller',
  field_exec: '/field',
  exec_manager: '/exec',
  sub_admin: '/sub',
  super_admin: '/admin',
}

const BOT_IDS = ['u-buyer-2', 'u-buyer-3', 'u-buyer-5', 'u-buyer-6', 'u-buyer-7']

const emptyLiftingChecklist = (): LiftingChecklistItem[] => [
  { key: 'vehicle_at_weighbridge', label: 'Vehicle at weighbridge', done: false },
  { key: 'loading_complete', label: 'Loading complete', done: false },
  { key: 'gross_weighment', label: 'Gross weighment recorded', done: false },
]

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

  termsAccepted: Record<string, string> // catalogueId → version accepted (per current session)
  toasts: Toast[]
  lastWonLotId: string | null // confetti trigger

  /* --- engine --- */
  tick: () => void

  /* --- session --- */
  toggleTheme: () => void
  switchRole: (role: Role) => void
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

  /* --- seller --- */
  createLot: (lot: Partial<Lot>) => void

  /* --- ops / admin --- */
  submitInspection: (lotId: string, report: Omit<InspectionReport, 'id' | 'lotId' | 'date'>, outcome: 'verified' | 'flagged' | 'rejected') => void
  setLotStatus: (lotId: string, status: LotStatus) => void
  publishCatalogue: (cat: Catalogue, lotIds: string[], overrides: Record<string, Partial<Lot>>) => void
  pauseCatalogue: (catalogueId: string) => void
  resumeCatalogue: (catalogueId: string) => void
  extendCatalogue: (catalogueId: string, minutes: number) => void
  cancelCatalogue: (catalogueId: string) => void
  voidBid: (bidId: string) => void
  setUserStanding: (userId: string, standing: User['standing'], reason?: string) => void
  issueDemandDraft: (doId: string, dd: { ddNumber: string; issuingBank: string; amount: number }) => void

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
    role: 'buyer',
    currentUser: seed.users.find((u) => u.id === ROLE_DEMO_USER.buyer) ?? null,
    paused: {},

    ...seed,

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
      if (role === 'guest') {
        set({ role, currentUser: null })
        return
      }
      const user = get().users.find((u) => u.id === ROLE_DEMO_USER[role]) ?? null
      set({ role, currentUser: user })
    },
    login: (phone) => {
      const existing = get().users.find((u) => u.phone.replace(/\D/g, '').endsWith(phone.replace(/\D/g, '').slice(-10)))
      const user = existing ?? get().users.find((u) => u.id === 'u-buyer-1')!
      set({ role: user.role, currentUser: user })
    },
    logout: () => set({ role: 'guest', currentUser: null }),

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
      set((st) => ({
        catalogues: [...st.catalogues, { ...cat, lotIds }],
        lots: st.lots.map((l) => {
          if (!lotIds.includes(l.id)) return l
          const idx = lotIds.indexOf(l.id)
          return {
            ...l, ...overrides[l.id], catalogueId: cat.id,
            lotNo: `LOT-${String(idx + 1).padStart(2, '0')}`,
            status: cat.status === 'live' ? 'live' as LotStatus : 'approved' as LotStatus,
            endsAt: cat.endsAt,
          }
        }),
      }))
      get().audit('catalogue.publish', cat.code, `Published "${cat.title}" with ${lotIds.length} lots`, 'info')
      get().notify({ userId: null, kind: 'lifecycle', title: `New catalogue ${cat.code}`, body: cat.title, href: `/catalogue/${cat.id}` })
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

/** Bid ladder standings for a lot. Returns the top 3 plus the current user's
 *  own row (only when they're not already inside the top 3). */
export function ladderStandings(bids: Bid[], lotId: string, meId: string | undefined) {
  const ranked = rankBidders(bids, lotId, meId)
  const top3 = ranked.slice(0, 3)
  const myRow = meId ? ranked.find((r) => r.bidderId === meId && r.rank > 3) ?? null : null
  return { top3, myRow }
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
