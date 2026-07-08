import { create } from 'zustand';
import type {
  Role, Lot, Auction, Bid, LedgerEntry, EntityRequest, Settlement,
  LogisticsRecord, AppNotification, Notice, AuditEntry, User, AdminUser, Toast, LotStatus,
} from './types';
import usersSeed from './data/mock/buyer/users.json';
import walletSeed from './data/mock/buyer/wallet.json';
import lotsSeed from './data/mock/seller/lots.json';
import auctionsSeed from './data/mock/shared/auctions.json';
import entitySeed from './data/mock/executive_admin/entity_requests.json';
import settlementsSeed from './data/mock/executive_admin/settlements.json';
import logisticsSeed from './data/mock/executive_admin/logistics.json';
import adminsSeed from './data/mock/super_admin/admins.json';
import configSeed from './data/mock/super_admin/config.json';
import auditSeed from './data/mock/super_admin/audit.json';
import noticesSeed from './data/mock/shared/notices.json';
import notificationsSeed from './data/mock/shared/notifications.json';
import { nextId, nowStamp } from './utils';

const BOOT = Date.now();
const min = 60_000;

const BOTS = [
  { id: 'b-01', name: 'SteelCorp Industries' },
  { id: 'b-02', name: 'Apex Alloys Ltd' },
  { id: 'b-03', name: 'Vulcan Metals' },
  { id: 'b-04', name: 'Nirmal Traders' },
];

export const DEMO_USER_ID = 'u-buyer1';

export interface Persona {
  role: Role;
  label: string;
  name: string;
  sub: string;
}
export const PERSONAS: Persona[] = [
  { role: 'guest', label: 'Guest User', name: 'Guest', sub: 'Browse only — not signed in' },
  { role: 'buyer', label: 'Buyer', name: 'Arjun Mehta', sub: 'Default account · KYC verified' },
  { role: 'seller', label: 'Buyer + Seller', name: 'Kavitha Raman', sub: 'Verified entity · Kavitha Steel Traders' },
  { role: 'exec', label: 'Executive Admin', name: 'Ravi Kumar', sub: 'Verify → Auction → Fulfil pipeline' },
  { role: 'subadmin', label: 'Sub-Admin', name: 'Divya Nair', sub: 'Permission-scoped console' },
  { role: 'superadmin', label: 'Super Admin', name: 'Mohammed Farooq', sub: 'Platform governance' },
];

function seedAuctions(): Auction[] {
  return (auctionsSeed as any[]).map((a) => ({
    id: a.id, lotId: a.lotId, status: a.status,
    startsAt: BOOT + a.startsInMin * min,
    endsAt: BOOT + a.endsInMin * min,
    startPrice: a.startPrice, currentBid: a.currentBid,
    leaderId: a.leaderId, leaderName: a.leaderName,
    increment: a.increment, reserve: a.reserve, emd: a.emd,
    extensions: a.extensions, bidderCount: a.bidderCount,
  }));
}

function seedBids(auctions: Auction[]): Bid[] {
  const bids: Bid[] = [];
  for (const a of auctions.filter((x) => x.status === 'live')) {
    let amount = a.startPrice;
    let t = a.startsAt + 2 * min;
    let i = 0;
    while (amount < a.currentBid) {
      // sprinkle a couple of demo-user bids into the first live auction so
      // "My Bids" shows an outbid state out of the box
      const demoTurn = a.id === 'AU-101' && (i === 2 || i === 5);
      const bot = demoTurn ? { id: DEMO_USER_ID, name: 'Arjun Mehta' } : BOTS[i % BOTS.length];
      bids.push({ id: nextId('BID'), auctionId: a.id, bidderId: bot.id, bidderName: bot.name, amount, at: t });
      amount += a.increment * (1 + Math.floor(Math.random() * 2));
      t += 3 * min + Math.random() * 4 * min;
      i++;
    }
    bids.push({ id: nextId('BID'), auctionId: a.id, bidderId: a.leaderId!, bidderName: a.leaderName!, amount: a.currentBid, at: Math.min(t, Date.now() - 2 * min) });
  }
  // winning bid history for the demo buyer's closed auction (Tin Ingots)
  const won = auctions.find((a) => a.id === 'AU-096');
  if (won) {
    bids.push(
      { id: nextId('BID'), auctionId: won.id, bidderId: DEMO_USER_ID, bidderName: 'Arjun Mehta', amount: won.currentBid - won.increment * 3, at: won.endsAt - 22 * min },
      { id: nextId('BID'), auctionId: won.id, bidderId: 'b-02', bidderName: 'Apex Alloys Ltd', amount: won.currentBid - won.increment, at: won.endsAt - 9 * min },
      { id: nextId('BID'), auctionId: won.id, bidderId: DEMO_USER_ID, bidderName: 'Arjun Mehta', amount: won.currentBid, at: won.endsAt - 3 * min },
    );
  }
  return bids.sort((x, y) => x.at - y.at);
}

function seedNotifications(): AppNotification[] {
  return (notificationsSeed as any[]).map((n) => ({
    id: n.id, audience: n.audience, title: n.title, body: n.body,
    at: BOOT - n.minsAgo * min, read: n.read, kind: n.kind,
  }));
}

interface AppState {
  // session
  role: Role;
  userName: string;
  authenticated: boolean;
  now: number;

  // data
  users: User[];
  admins: AdminUser[];
  lots: Lot[];
  auctions: Auction[];
  bids: Bid[];
  wallet: { balance: number; emdLocked: number; ledger: LedgerEntry[] };
  emdLockedAuctions: string[];
  autoBid: Record<string, { max: number; step: number; active: boolean }>;
  entityRequests: EntityRequest[];
  settlements: Settlement[];
  logistics: LogisticsRecord[];
  notifications: AppNotification[];
  notices: Notice[];
  audit: AuditEntry[];
  config: typeof configSeed;
  toasts: Toast[];
  kycStatus: 'not_submitted' | 'pending' | 'verified';
  buyerUpgrade: 'none' | 'submitted' | 'approved';

  // session actions
  switchRole: (r: Role) => void;
  loginAs: (r: Role) => void;
  logout: () => void;
  submitKyc: () => void;

  // toast / notify
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  notify: (audience: Role | 'all', title: string, body: string, kind?: AppNotification['kind']) => void;
  markAllRead: (role: Role) => void;
  logAudit: (actor: string, role: string, action: string, target: string, stage: string) => void;

  // wallet
  topUp: (amount: number, method: string) => void;
  lockEmd: (auctionId: string) => boolean;

  // lifecycle actions
  setLotStatus: (lotId: string, status: LotStatus) => void;
  createLot: (lot: Omit<Lot, 'id' | 'status' | 'createdAt' | 'sellerId'>, asDraft: boolean) => string;
  submitLot: (lotId: string) => void;
  startVerification: (lotId: string) => void;
  decideLot: (lotId: string, decision: 'verified' | 'flagged' | 'rejected', checklist: Record<string, boolean>, note: string) => void;
  createAuction: (lotId: string, params: { startsInMin: number; durationMin: number; increment: number; reserve: number; emd: number }) => void;

  // entity verification
  submitEntityRequest: (businessName: string, gstin: string, pan: string, docs: { name: string; type: string }[]) => void;
  decideEntity: (reqId: string, decision: 'approved' | 'rejected' | 'returned', note: string) => void;

  // bidding
  placeBid: (auctionId: string, amount: number, bidder?: { id: string; name: string }, auto?: boolean) => void;
  setAutoBid: (auctionId: string, max: number, step: number, active: boolean) => void;
  tick: () => void;

  // fulfilment
  confirmPayment: (stId: string) => void;
  handleEmd: (stId: string) => void;
  generateInvoice: (stId: string) => void;
  handoffToLogistics: (stId: string) => void;
  schedulePickup: (lgId: string, date: string, slot: string, handler: string) => void;
  markInTransit: (lgId: string) => void;
  toggleHandoverCheck: (lgId: string, key: string) => void;
  uploadProof: (lgId: string) => void;
  confirmHandover: (lgId: string) => void;

  // admin
  toggleAdminActive: (id: string) => void;
  toggleAdminPermission: (id: string, key: string) => void;
  addAdmin: (name: string, email: string, role: 'exec' | 'subadmin') => void;
  toggleUserActive: (id: string) => void;
  updateConfig: (section: string, key: string, value: unknown) => void;
}

const initialAuctions = seedAuctions();

export const useApp = create<AppState>((set, get) => ({
  role: 'guest',
  userName: 'Guest',
  authenticated: false,
  now: Date.now(),

  users: usersSeed as User[],
  admins: adminsSeed as unknown as AdminUser[],
  lots: lotsSeed as unknown as Lot[],
  auctions: initialAuctions,
  bids: seedBids(initialAuctions),
  wallet: walletSeed as { balance: number; emdLocked: number; ledger: LedgerEntry[] },
  emdLockedAuctions: ['AU-101'],
  autoBid: {},
  entityRequests: entitySeed as EntityRequest[],
  settlements: settlementsSeed as Settlement[],
  logistics: logisticsSeed as unknown as LogisticsRecord[],
  notifications: seedNotifications(),
  notices: noticesSeed as Notice[],
  audit: auditSeed as AuditEntry[],
  config: configSeed,
  toasts: [],
  kycStatus: 'verified',
  buyerUpgrade: 'none',

  switchRole: (r) => {
    const p = PERSONAS.find((x) => x.role === r)!;
    set({ role: r, userName: p.name, authenticated: r !== 'guest' });
  },
  loginAs: (r) => get().switchRole(r),
  logout: () => set({ role: 'guest', userName: 'Guest', authenticated: false }),
  submitKyc: () => {
    set({ kycStatus: 'pending' });
    get().pushToast({ title: 'KYC submitted', body: 'Documents sent for review (simulated).', tone: 'success' });
    setTimeout(() => {
      set({ kycStatus: 'verified' });
      get().notify('buyer', 'KYC verified', 'Your KYC has been approved. You can now bid in live auctions.', 'system');
      get().pushToast({ title: 'KYC verified ✓', body: 'You can now participate in auctions.', tone: 'success' });
    }, 4000);
  },

  pushToast: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    setTimeout(() => get().dismissToast(id), 5200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  notify: (audience, title, body, kind = 'lifecycle') =>
    set((s) => ({
      notifications: [
        { id: nextId('NT'), audience, title, body, at: Date.now(), read: false, kind },
        ...s.notifications,
      ],
    })),
  markAllRead: (role) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.audience === role || n.audience === 'all' ? { ...n, read: true } : n
      ),
    })),
  logAudit: (actor, role, action, target, stage) =>
    set((s) => ({
      audit: [{ id: nextId('AUD'), actor, role, action, target, stage, at: nowStamp() }, ...s.audit],
    })),

  topUp: (amount, method) => {
    set((s) => ({
      wallet: {
        ...s.wallet,
        balance: s.wallet.balance + amount,
        ledger: [{ id: nextId('L'), type: 'topup', amount, note: `Wallet top-up via ${method} (mock)`, at: nowStamp() }, ...s.wallet.ledger],
      },
    }));
    get().pushToast({ title: 'Top-up successful', body: `Wallet credited (simulated payment).`, tone: 'success' });
    get().notify('buyer', 'Wallet credited', `Top-up of ₹${amount.toLocaleString('en-IN')} was successful.`, 'wallet');
  },

  lockEmd: (auctionId) => {
    const s = get();
    const a = s.auctions.find((x) => x.id === auctionId);
    if (!a) return false;
    if (s.emdLockedAuctions.includes(auctionId)) return true;
    if (s.wallet.balance < a.emd) {
      s.pushToast({ title: 'Insufficient balance', body: 'Top up your wallet to lock EMD for this lot.', tone: 'error' });
      return false;
    }
    const lot = s.lots.find((l) => l.id === a.lotId);
    set((st) => ({
      emdLockedAuctions: [...st.emdLockedAuctions, auctionId],
      wallet: {
        ...st.wallet,
        balance: st.wallet.balance - a.emd,
        emdLocked: st.wallet.emdLocked + a.emd,
        ledger: [{ id: nextId('L'), type: 'emd_lock', amount: -a.emd, note: `EMD locked — Lot ${a.lotId} (${lot?.title ?? ''})`, at: nowStamp() }, ...st.wallet.ledger],
      },
    }));
    s.pushToast({ title: 'EMD locked', body: `₹${a.emd.toLocaleString('en-IN')} locked. You can now bid on this lot.`, tone: 'success' });
    return true;
  },

  setLotStatus: (lotId, status) =>
    set((s) => ({ lots: s.lots.map((l) => (l.id === lotId ? { ...l, status } : l)) })),

  createLot: (lot, asDraft) => {
    const id = `FB-2026-${String(100 + Math.floor(Math.random() * 800))}`;
    const full: Lot = {
      ...lot, id, sellerId: 'u-seller1',
      status: asDraft ? 'draft' : 'submitted',
      createdAt: new Date().toISOString().slice(0, 10),
    };
    set((s) => ({ lots: [full, ...s.lots] }));
    if (!asDraft) {
      get().notify('exec', 'Lot submitted for verification', `${lot.title} (${id}) awaiting inspection.`);
      get().logAudit('Kavitha Raman', 'Seller', 'Lot submitted for verification', id, 'Listing');
    }
    get().pushToast({ title: asDraft ? 'Draft saved' : 'Lot submitted', body: asDraft ? 'You can submit it for verification anytime.' : 'Sent to Executive Admin for verification.', tone: 'success' });
    return id;
  },

  submitLot: (lotId) => {
    get().setLotStatus(lotId, 'submitted');
    const lot = get().lots.find((l) => l.id === lotId);
    get().notify('exec', 'Lot submitted for verification', `${lot?.title} (${lotId}) awaiting inspection.`);
    get().logAudit('Kavitha Raman', 'Seller', 'Lot submitted for verification', lotId, 'Listing');
    get().pushToast({ title: 'Lot submitted', body: 'Sent to Executive Admin for verification.', tone: 'success' });
  },

  startVerification: (lotId) => {
    get().setLotStatus(lotId, 'under_verification');
    get().logAudit('Ravi Kumar', 'Executive Admin', 'Verification started', lotId, 'Verification');
    get().notify('seller', `Lot ${lotId} under verification`, 'Executive Admin has started the inspection.');
  },

  decideLot: (lotId, decision, checklist, note) => {
    const s = get();
    const lot = s.lots.find((l) => l.id === lotId);
    const status: LotStatus = decision === 'verified' ? 'approved' : decision === 'rejected' ? 'rejected' : 'under_verification';
    set((st) => ({
      lots: st.lots.map((l) =>
        l.id === lotId
          ? {
              ...l, status,
              rejectReason: decision === 'rejected' ? note : undefined,
              verification: { checklist, note, reportUploaded: true, photosUploaded: true, decision, decidedBy: 'Ravi Kumar' },
            }
          : l
      ),
    }));
    const labels = { verified: 'verified & approved for auction', flagged: 'flagged for re-inspection', rejected: 'rejected' } as const;
    s.logAudit('Ravi Kumar', 'Executive Admin', `Lot ${labels[decision]}`, lotId, 'Verification');
    s.notify('seller', `Lot ${lotId} ${labels[decision]}`, note || `${lot?.title} — ${labels[decision]}.`);
    s.pushToast({ title: `Lot ${labels[decision]}`, tone: decision === 'rejected' ? 'error' : 'success' });
  },

  createAuction: (lotId, params) => {
    const now = Date.now();
    const id = `AU-${100 + Math.floor(Math.random() * 800)}`;
    const lot = get().lots.find((l) => l.id === lotId)!;
    const startsAt = now + params.startsInMin * min;
    const auction: Auction = {
      id, lotId,
      startsAt, endsAt: startsAt + params.durationMin * min,
      status: params.startsInMin <= 0 ? 'live' : 'scheduled',
      startPrice: lot.basePrice, currentBid: lot.basePrice,
      increment: params.increment, reserve: params.reserve, emd: params.emd,
      extensions: 0, bidderCount: 0,
    };
    set((s) => ({
      auctions: [...s.auctions, auction],
      lots: s.lots.map((l) => (l.id === lotId ? { ...l, status: auction.status === 'live' ? 'live' : 'scheduled', auctionId: id } : l)),
    }));
    get().logAudit('Ravi Kumar', 'Executive Admin', 'Auction created & scheduled', `${lotId} → ${id}`, 'Auction Setup');
    get().notify('seller', `Auction ${auction.status === 'live' ? 'is live' : 'scheduled'} for ${lotId}`, `${lot.title} — ${auction.status === 'live' ? 'bidding open now' : 'goes live soon'}.`);
    get().notify('buyer', 'New auction published', `${lot.title} (${lot.quantity}) is ${auction.status === 'live' ? 'live now' : 'opening soon'}.`);
    get().pushToast({ title: auction.status === 'live' ? 'Auction published live' : 'Auction scheduled', body: `${lot.title}`, tone: 'success' });
  },

  submitEntityRequest: (businessName, gstin, pan, docs) => {
    set((s) => ({
      buyerUpgrade: 'submitted',
      entityRequests: [
        { id: nextId('EV'), userId: DEMO_USER_ID, userName: 'Arjun Mehta', businessName, gstin, pan, docs, status: 'pending', submittedAt: nowStamp() },
        ...s.entityRequests,
      ],
    }));
    get().notify('exec', 'New entity verification request', `${businessName} submitted documents for seller verification.`);
    get().pushToast({ title: 'Request submitted', body: 'Executive Admin will review your entity documents.', tone: 'success' });
  },

  decideEntity: (reqId, decision, note) => {
    const req = get().entityRequests.find((r) => r.id === reqId);
    set((s) => ({
      entityRequests: s.entityRequests.map((r) => (r.id === reqId ? { ...r, status: decision, note } : r)),
      ...(decision === 'approved' && req?.userId === DEMO_USER_ID ? { buyerUpgrade: 'approved' as const } : {}),
      users: s.users.map((u) => (u.id === req?.userId && decision === 'approved' ? { ...u, sellerVerified: true, businessName: req.businessName } : u)),
    }));
    const msg = { approved: 'approved — Seller capability unlocked 🎉', rejected: 'rejected', returned: 'returned for corrections' }[decision];
    get().logAudit('Ravi Kumar', 'Executive Admin', `Entity ${decision} — ${req?.businessName}`, reqId, 'Entity Verification');
    get().notify('buyer', `Entity verification ${msg}`, note || `Your request for ${req?.businessName} was ${decision}.`);
    get().pushToast({ title: `Entity ${msg}`, tone: decision === 'rejected' ? 'error' : 'success' });
  },

  placeBid: (auctionId, amount, bidder, auto) => {
    const s = get();
    const a = s.auctions.find((x) => x.id === auctionId);
    if (!a || a.status !== 'live') return;
    if (amount < a.currentBid + a.increment) {
      if (!bidder) s.pushToast({ title: 'Bid too low', body: `Minimum next bid is ₹${(a.currentBid + a.increment).toLocaleString('en-IN')}.`, tone: 'error' });
      return;
    }
    const who = bidder ?? { id: DEMO_USER_ID, name: s.userName };
    const now = Date.now();
    const cfg = s.config.platform;
    const withinWindow = a.endsAt - now < cfg.auctionAutoExtensionWindowSec * 1000;
    const extend = withinWindow && a.extensions < cfg.maxAutoExtensions;
    const prevLeader = a.leaderId;

    set((st) => ({
      auctions: st.auctions.map((x) =>
        x.id === auctionId
          ? {
              ...x, currentBid: amount, leaderId: who.id, leaderName: who.name,
              bidderCount: x.bidderCount + (st.bids.some((b) => b.auctionId === auctionId && b.bidderId === who.id) ? 0 : 1),
              endsAt: extend ? x.endsAt + cfg.auctionAutoExtensionBySec * 1000 : x.endsAt,
              extensions: extend ? x.extensions + 1 : x.extensions,
            }
          : x
      ),
      bids: [...st.bids, { id: nextId('BID'), auctionId, bidderId: who.id, bidderName: who.name, amount, at: now, auto }],
    }));

    if (extend) get().notify('all', 'Auction auto-extended', `Late bid on ${a.lotId} — closing time extended by ${cfg.auctionAutoExtensionBySec / 60} min.`, 'bid');
    if (prevLeader === DEMO_USER_ID && who.id !== DEMO_USER_ID) {
      get().notify('buyer', `Outbid on Lot ${a.lotId}`, `${who.name} bid ₹${amount.toLocaleString('en-IN')}. Bid again to regain the lead.`, 'bid');
      get().pushToast({ title: `You've been outbid!`, body: `${who.name} → ₹${amount.toLocaleString('en-IN')} on ${a.lotId}`, tone: 'bid' });
    }
  },

  setAutoBid: (auctionId, max, step, active) => {
    set((s) => ({ autoBid: { ...s.autoBid, [auctionId]: { max, step, active } } }));
    if (active) get().pushToast({ title: 'Auto-bid armed', body: `Bidding up to ₹${max.toLocaleString('en-IN')} automatically.`, tone: 'success' });
  },

  /** Simulation engine tick: starts scheduled auctions, closes ended ones, fires bot bids & auto-bids. */
  tick: () => {
    const now = Date.now();
    const s = get();
    set({ now });

    for (const a of s.auctions) {
      // scheduled → live
      if (a.status === 'scheduled' && now >= a.startsAt) {
        set((st) => ({
          auctions: st.auctions.map((x) => (x.id === a.id ? { ...x, status: 'live' } : x)),
          lots: st.lots.map((l) => (l.id === a.lotId ? { ...l, status: 'live' } : l)),
        }));
        s.notify('all', 'Auction is live', `Bidding is now open on Lot ${a.lotId}.`, 'bid');
        continue;
      }
      if (a.status !== 'live') continue;

      // live → closed
      if (now >= a.endsAt) {
        const met = a.currentBid >= a.reserve && a.leaderId;
        set((st) => ({
          auctions: st.auctions.map((x) => (x.id === a.id ? { ...x, status: 'closed' } : x)),
          lots: st.lots.map((l) => (l.id === a.lotId ? { ...l, status: met ? 'won' : 'closed' } : l)),
          ...(met
            ? {
                settlements: [
                  { id: nextId('ST'), lotId: a.lotId, auctionId: a.id, winnerId: a.leaderId!, winnerName: a.leaderName!, amount: a.currentBid, paymentConfirmed: false, emdHandled: false, invoiceGenerated: false },
                  ...st.settlements,
                ],
              }
            : {}),
        }));
        if (met && a.leaderId === DEMO_USER_ID) {
          s.notify('buyer', `You won Lot ${a.lotId} 🎉`, `Winning bid ₹${a.currentBid.toLocaleString('en-IN')}. Settlement will begin shortly.`);
          s.pushToast({ title: `You won Lot ${a.lotId}! 🎉`, body: `Winning bid ₹${a.currentBid.toLocaleString('en-IN')}`, tone: 'success' });
        } else if (met) {
          s.notify('buyer', `Auction closed — Lot ${a.lotId}`, `${a.leaderName} won at ₹${a.currentBid.toLocaleString('en-IN')}. Your EMD will be auto-refunded.`);
          // auto-refund demo buyer's EMD if they participated and lost
          if (s.emdLockedAuctions.includes(a.id)) {
            set((st) => ({
              wallet: {
                ...st.wallet,
                balance: st.wallet.balance + a.emd,
                emdLocked: Math.max(0, st.wallet.emdLocked - a.emd),
                ledger: [{ id: nextId('L'), type: 'emd_release', amount: a.emd, note: `EMD auto-refund — Lot ${a.lotId} (lost)`, at: nowStamp() }, ...st.wallet.ledger],
              },
            }));
            s.pushToast({ title: 'EMD refunded', body: `₹${a.emd.toLocaleString('en-IN')} released back to your wallet for Lot ${a.lotId}.`, tone: 'info' });
          }
        }
        s.notify('exec', `Auction closed — ${a.lotId}`, met ? `Winner: ${a.leaderName}. Move to settlement.` : 'Reserve not met — lot closed unsold.');
        s.logAudit('System', 'System', met ? 'Auction closed — winner declared' : 'Auction closed — reserve not met', a.id, 'Auction');
        continue;
      }

      // bot bids: ~ every 10-18s per live auction, more aggressive near close
      const closeness = (a.endsAt - now) / min;
      const p = closeness < 2 ? 0.16 : 0.07;
      if (Math.random() < p) {
        const bot = BOTS[Math.floor(Math.random() * BOTS.length)];
        if (bot.id !== a.leaderId) {
          get().placeBid(a.id, a.currentBid + a.increment * (1 + Math.floor(Math.random() * 2)), bot, false);
        }
      }

      // auto-bid response for demo user
      const ab = s.autoBid[a.id];
      const fresh = get().auctions.find((x) => x.id === a.id)!;
      if (ab?.active && fresh.leaderId !== DEMO_USER_ID) {
        const next = Math.min(ab.max, fresh.currentBid + Math.max(ab.step, fresh.increment));
        if (next >= fresh.currentBid + fresh.increment && next <= ab.max) {
          get().placeBid(a.id, next, { id: DEMO_USER_ID, name: 'Arjun Mehta' }, true);
        }
      }
    }
  },

  confirmPayment: (stId) => {
    const st = get().settlements.find((x) => x.id === stId);
    set((s) => ({ settlements: s.settlements.map((x) => (x.id === stId ? { ...x, paymentConfirmed: true } : x)) }));
    if (st) {
      get().setLotStatus(st.lotId, 'in_settlement');
      get().logAudit('Ravi Kumar', 'Executive Admin', 'Winner payment confirmed (mock)', stId, 'Settlement');
      get().notify('buyer', `Payment confirmed — Lot ${st.lotId}`, 'Your payment has been verified. Pickup will be scheduled next.');
      get().pushToast({ title: 'Payment confirmed', tone: 'success' });
    }
  },
  handleEmd: (stId) => {
    const st = get().settlements.find((x) => x.id === stId);
    set((s) => ({ settlements: s.settlements.map((x) => (x.id === stId ? { ...x, emdHandled: true } : x)) }));
    if (st) {
      get().logAudit('Ravi Kumar', 'Executive Admin', 'EMD released to losers / forfeit processed', stId, 'Settlement');
      get().pushToast({ title: 'EMD processed', body: 'Losing bidders refunded; defaulter forfeits applied (mock).', tone: 'success' });
    }
  },
  generateInvoice: (stId) => {
    set((s) => ({ settlements: s.settlements.map((x) => (x.id === stId ? { ...x, invoiceGenerated: true } : x)) }));
    get().logAudit('Ravi Kumar', 'Executive Admin', 'Invoice & receipt generated (mock)', stId, 'Settlement');
    get().pushToast({ title: 'Invoice generated', body: 'Receipt shared with the winner (mock PDF).', tone: 'success' });
  },
  handoffToLogistics: (stId) => {
    const st = get().settlements.find((x) => x.id === stId);
    if (!st) return;
    set((s) => ({
      logistics: [
        { id: nextId('LG'), lotId: st.lotId, status: 'awaiting', checklist: { 'Weighbridge re-check': false, 'Material tally with invoice': false, 'Gate pass issued': false, 'Loading photos captured': false }, proofUploaded: false },
        ...s.logistics,
      ],
    }));
    get().setLotStatus(st.lotId, 'ready_for_pickup');
    get().logAudit('Ravi Kumar', 'Executive Admin', 'Settlement complete — handed off to logistics', st.lotId, 'Settlement');
    get().notify('buyer', `Lot ${st.lotId} ready for pickup`, 'Settlement completed. Pickup scheduling is underway.');
    get().pushToast({ title: 'Handed off to logistics', tone: 'success' });
  },
  schedulePickup: (lgId, date, slot, handler) => {
    const lg = get().logistics.find((x) => x.id === lgId);
    set((s) => ({ logistics: s.logistics.map((x) => (x.id === lgId ? { ...x, pickupDate: date, slot, handler, status: 'scheduled' } : x)) }));
    if (lg) {
      get().logAudit('Ravi Kumar', 'Executive Admin', `Pickup scheduled + handler assigned (${handler})`, lg.lotId, 'Logistics');
      get().notify('buyer', `Pickup scheduled — Lot ${lg.lotId}`, `${date}, ${slot} · Handler: ${handler}`);
      get().pushToast({ title: 'Pickup scheduled', body: `${date} · ${slot} · ${handler}`, tone: 'success' });
    }
  },
  markInTransit: (lgId) => {
    const lg = get().logistics.find((x) => x.id === lgId);
    set((s) => ({ logistics: s.logistics.map((x) => (x.id === lgId ? { ...x, status: 'in_transit' } : x)) }));
    if (lg) {
      get().setLotStatus(lg.lotId, 'in_logistics');
      get().logAudit('Ravi Kumar', 'Executive Admin', 'Pickup in transit', lg.lotId, 'Logistics');
    }
  },
  toggleHandoverCheck: (lgId, key) =>
    set((s) => ({
      logistics: s.logistics.map((x) =>
        x.id === lgId ? { ...x, checklist: { ...x.checklist, [key]: !x.checklist[key] } } : x
      ),
    })),
  uploadProof: (lgId) => {
    set((s) => ({ logistics: s.logistics.map((x) => (x.id === lgId ? { ...x, proofUploaded: true } : x)) }));
    get().pushToast({ title: 'Proof uploaded', body: 'Photo, gate pass & signature captured (mock).', tone: 'success' });
  },
  confirmHandover: (lgId) => {
    const lg = get().logistics.find((x) => x.id === lgId);
    set((s) => ({ logistics: s.logistics.map((x) => (x.id === lgId ? { ...x, status: 'completed' } : x)) }));
    if (lg) {
      get().setLotStatus(lg.lotId, 'closed');
      get().logAudit('Ravi Kumar', 'Executive Admin', 'Handover confirmed — lot closed', lg.lotId, 'Handover');
      get().notify('all', `Lot ${lg.lotId} handed over ✓`, 'Pickup completed with proof. Lifecycle closed.');
      get().pushToast({ title: 'Handover complete — lot closed', tone: 'success' });
    }
  },

  toggleAdminActive: (id) =>
    set((s) => ({ admins: s.admins.map((a) => (a.id === id ? { ...a, active: !a.active } : a)) })),
  toggleAdminPermission: (id, key) => {
    set((s) => ({
      admins: s.admins.map((a) =>
        a.id === id ? { ...a, permissions: { ...a.permissions, [key]: !a.permissions[key] } } : a
      ),
    }));
    get().logAudit('Mohammed Farooq', 'Super Admin', `Permission "${key}" toggled`, id, 'Administration');
  },
  addAdmin: (name, email, role) => {
    const perms: Record<string, boolean> =
      role === 'exec'
        ? { entityVerification: true, lotVerification: true, auctionCreation: true, settlement: true, logistics: true, handover: true }
        : { manageAuctions: true, manageLots: true, manageUsers: false, manageCatalogue: true, viewAudit: false, systemConfig: false };
    set((s) => ({
      admins: [...s.admins, { id: nextId('adm'), name, email, role, permissions: perms, active: true, createdAt: new Date().toISOString().slice(0, 10) }],
    }));
    get().logAudit('Mohammed Farooq', 'Super Admin', `${role === 'exec' ? 'Executive Admin' : 'Sub-Admin'} created`, name, 'Administration');
    get().pushToast({ title: `${role === 'exec' ? 'Executive Admin' : 'Sub-Admin'} created`, body: name, tone: 'success' });
  },
  toggleUserActive: (id) =>
    set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, active: !u.active } : u)) })),
  updateConfig: (section, key, value) =>
    set((s) => ({
      config: { ...s.config, [section]: { ...(s.config as any)[section], [key]: value } } as typeof configSeed,
    })),
}));
