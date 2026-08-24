/* ---------------------------------------------------------------------------
   Internal helpers shared across the store's action slices — bidding,
   wallet/EMD movement, notification fan-out, and Super Admin structural
   snapshot/undo. Extracted verbatim from inside the old store.ts's single
   `create<State>((set, get) => { ... })` closure, where these were plain
   `const`/`function` declarations shared by lexical scope with every action.
   Splitting actions into separate files removes that shared scope, so each
   slice now takes this factory's return value as an explicit `helpers`
   argument instead — same functions, same closures over the same store's
   `set`/`get`, just passed in rather than closed over implicitly.
--------------------------------------------------------------------------- */
import type { StateCreator } from 'zustand'
import { uid, inr } from '../lib/format'
import { catalogueReserveValue } from '../lib/money'
import { checkAuth } from '../application/authorization'
import { BOT_IDS, ROLE_DEMO_USER, PUBLISH_ROLES, delegationActive, emptyLiftingChecklist } from './constants'
import type { State } from './types'
import type {
  Bid, BidType, Catalogue, CeoApprovalRequest, EmdForfeiture, Lot, LotStatus,
  NotificationKind, Role, StructuralChangeKind, StructureSnapshot,
} from '../types'

export type StoreSet = Parameters<StateCreator<State, [], []>>[0]
export type StoreGet = Parameters<StateCreator<State, [], []>>[1]

export function createInternalHelpers(set: StoreSet, get: StoreGet) {
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

  /** Who to tell about a lot.
   *
   *  A lot carries its own `sellerId` from the moment it is submitted — long
   *  before any catalogue holds it — which is exactly why the field is on the
   *  lot and not read off the catalogue. Reading the seller off the catalogue
   *  instead drops every hand-off in the stage *between* submission and the
   *  catalogue builder: a lot inspected, approved, rejected or bypassed while
   *  still uncatalogued told its seller nothing at all, because there was no
   *  catalogue to find them through. The catalogue is the fallback here, never
   *  the source. */
  const sellerOfLot = (lot: Lot | undefined) =>
    lot?.sellerId ?? get().catalogues.find((c) => c.id === lot?.catalogueId)?.sellerId ?? null

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
    const reserveValue = catalogueReserveValue(catLots)
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
  const requireSuperAdmin = (): { ok: false; error: string } | null => {
    const error = checkAuth('changePlatformShape', get().role)
    return error ? { ok: false, error } : null
  }

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
    wallet, hasApprovedEmdExemption, ensureWallet, sellerOfLot, raiseCeoApproval, announceCatalogueReady,
    requireSuperAdmin, structureSnapshot, applySnapshot, roleLabelFor, liveAuctionsOwnedBy, recordStructural,
    applyForfeiture, applyBid, runProxyBids, runBots, closeDueLots, notifyParticipants, notifyRole,
  }
}

export type InternalHelpers = ReturnType<typeof createInternalHelpers>
