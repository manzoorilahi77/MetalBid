import { create } from 'zustand';
import type {
  Role, Lot, Auction, Bid, LedgerEntry, EntityRequest, Settlement,
  LogisticsRecord, AppNotification, Notice, AuditEntry, User, AdminUser, Toast, LotStatus,
  ApprovalRequest, ApprovalType, WorkTask, UserStanding, ModulePermission,
  AuctionEvent, Catalogue, CatalogueDocument, KycDocType, KycDocStatus, KycProfile,
  PlanAudience, SubscriptionPlan, ActiveSubscription, ExecFunction,
  ApprovalLetter, SettlementRound, DeliveryLetter, EmailLog,
} from './types';
import usersSeed from './data/mock/buyer/users.json';
import walletSeed from './data/mock/buyer/wallet.json';
import lotsSeed from './data/mock/seller/lots.json';
import auctionsSeed from './data/mock/shared/auctions.json';
import auctionEventsSeed from './data/mock/shared/auction_events.json';
import cataloguesSeed from './data/mock/shared/catalogues.json';
import entitySeed from './data/mock/executive_admin/entity_requests.json';
import settlementsSeed from './data/mock/executive_admin/settlements.json';
import logisticsSeed from './data/mock/executive_admin/logistics.json';
import adminsSeed from './data/mock/super_admin/admins.json';
import configSeed from './data/mock/super_admin/config.json';
import auditSeed from './data/mock/super_admin/audit.json';
import masterDataSeed from './data/mock/super_admin/master_data.json';
import noticesSeed from './data/mock/shared/notices.json';
import notificationsSeed from './data/mock/shared/notifications.json';
import approvalsSeed from './data/mock/shared/approvals.json';
import plansSeed from './data/mock/shared/plans.json';
import workQueueSeed from './data/mock/sub_admin/work_queue.json';
import { PERM_TEMPLATES, DEFAULT_SUB_SCOPED } from './permissions';
import { nextId, nowStamp } from './utils';

const BOOT = Date.now();
const min = 60_000;

/** Follow-up toggle: v1 always routes verified lots through a manager sign-off (no fast-lane).
 *  Flipping this to false and short-circuiting in submitVerification() is the whole future change. */
const REQUIRE_MANAGER_APPROVAL = true;

/** Cap on settlement escalation rounds — matches "3rd or 4th bidder" in the WBS. */
export const MAX_SETTLEMENT_ROUNDS = 4;

/* ---------- theme ---------- */
export type ThemeMode = 'light' | 'dark';
const THEME_KEY = 'ferrobid-theme';

function initialTheme(): ThemeMode {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return 'light';
}

export function applyTheme(t: ThemeMode) {
  document.documentElement.dataset.theme = t;
}

// bot bidder IPs — b-02 and b-03 deliberately share one IP as a same-IP-fraud demo fixture
const BOTS = [
  { id: 'b-01', name: 'SteelCorp Industries', ip: '103.21.58.10' },
  { id: 'b-02', name: 'Apex Alloys Ltd', ip: '103.21.58.14' },
  { id: 'b-03', name: 'Vulcan Metals', ip: '103.21.58.14' },
  { id: 'b-04', name: 'Nirmal Traders', ip: '117.196.4.88' },
];

export const DEMO_USER_ID = 'u-buyer1';
const DEMO_USER_IP = '49.207.12.201';

/** Resolve the IP a bid should be recorded with — feeds same-IP fraud detection. */
function ipFor(bidderId: string): string {
  if (bidderId === DEMO_USER_ID) return DEMO_USER_IP;
  return BOTS.find((b) => b.id === bidderId)?.ip ?? '0.0.0.0';
}

export interface Persona {
  role: Role;
  execFunction?: ExecFunction;
  label: string;
  name: string;
  sub: string;
}
export const PERSONAS: Persona[] = [
  { role: 'guest', label: 'Guest User', name: 'Guest', sub: 'Browse only — not signed in' },
  { role: 'buyer', label: 'Buyer', name: 'Arjun Mehta', sub: 'Default account · KYC verified' },
  { role: 'seller', label: 'Buyer + Seller', name: 'Kavitha Raman', sub: 'Verified entity · Kavitha Steel Traders' },
  { role: 'exec', execFunction: 'field', label: 'Field Executive Officer', name: 'Meera Pillai', sub: 'Visit queue · lot inspection & approve/reject' },
  { role: 'exec', execFunction: 'manager', label: 'Executive Manager', name: 'Ravi Kumar', sub: 'KYC queue · settlement → logistics → handover' },
  { role: 'subadmin', label: 'Sub-Admin', name: 'Divya Nair', sub: 'Permission-scoped console' },
  { role: 'superadmin', label: 'Super Admin', name: 'Mohammed Farooq', sub: 'Platform governance' },
];

function seedAuctions(): Auction[] {
  return (auctionsSeed as any[]).map((a) => ({
    id: a.id, lotId: a.lotId, catalogueId: a.catalogueId, status: a.status,
    startsAt: BOOT + a.startsInMin * min,
    endsAt: BOOT + a.endsInMin * min,
    startPrice: a.startPrice, currentBid: a.currentBid,
    leaderId: a.leaderId, leaderName: a.leaderName,
    increment: a.increment, reserve: a.reserve, emd: a.emd,
    extensions: a.extensions, bidderCount: a.bidderCount,
  }));
}

function seedEvents(): AuctionEvent[] {
  return (auctionEventsSeed as any[]).map((e) => ({
    id: e.id, name: e.name, description: e.description, status: e.status,
    startsAt: BOOT + e.startsInMin * min, endsAt: BOOT + e.endsInMin * min,
    catalogueIds: e.catalogueIds, location: e.location, coverHues: e.coverHues, createdAt: e.createdAt,
  }));
}

function seedCatalogues(): Catalogue[] {
  return (cataloguesSeed as any[]).map((c) => ({
    id: c.id, eventId: c.eventId, title: c.title, description: c.description,
    lotIds: c.lotIds, closingAt: BOOT + c.closingInMin * min, status: c.status, createdAt: c.createdAt,
    documents: (c.documents ?? []) as CatalogueDocument[],
    additionalInfo: c.additionalInfo ?? { description: c.description ?? '', terms: undefined },
  }));
}

/* ---------- Auction Event / Catalogue selector helpers ---------- */
export const eventById = (events: AuctionEvent[], id: string) => events.find((e) => e.id === id);
export const catalogueById = (catalogues: Catalogue[], id: string) => catalogues.find((c) => c.id === id);
export const catalogueForLot = (catalogues: Catalogue[], lotId: string) => catalogues.find((c) => c.lotIds.includes(lotId));
export const eventForCatalogue = (events: AuctionEvent[], catalogueId: string) => events.find((e) => e.catalogueIds.includes(catalogueId));
export const lotsForCatalogue = (lots: Lot[], catalogue: Catalogue) => lots.filter((l) => catalogue.lotIds.includes(l.id));
/** Single collateral amount for a catalogue's bid room — sized to cover bidding on any lot in it. */
export const catalogueEmdAmount = (lots: Lot[], catalogue: Catalogue) =>
  lotsForCatalogue(lots, catalogue).reduce((max, l) => Math.max(max, l.emdAmount), 0);
/** Bidders ranked by their highest bid on an auction (dedupe to one row per bidder), highest first. */
export function rankedBids(bids: Bid[], auctionId: string): Bid[] {
  const best = new Map<string, Bid>();
  for (const b of bids) {
    if (b.auctionId !== auctionId) continue;
    const cur = best.get(b.bidderId);
    if (!cur || b.amount > cur.amount) best.set(b.bidderId, b);
  }
  return Array.from(best.values()).sort((x, y) => y.amount - x.amount);
}

export function catalogueMeta(lots: Lot[], catalogue: Catalogue) {
  const catLots = lotsForCatalogue(lots, catalogue);
  return { lotCount: catLots.length, metals: Array.from(new Set(catLots.map((l) => l.metal))) };
}

export function eventMeta(catalogues: Catalogue[], event: AuctionEvent) {
  const cats = catalogues.filter((c) => event.catalogueIds.includes(c.id));
  return { catalogueCount: cats.length, lotCount: cats.reduce((n, c) => n + c.lotIds.length, 0) };
}

/** Same-IP fraud signal: distinct bidders on one auction sharing an IP, at/over the configured threshold. */
export interface SameIpGroup { ip: string; bidderIds: string[]; bidderNames: string[] }
export function sameIpGroups(bids: Bid[], auctionId: string, threshold: number): SameIpGroup[] {
  const byIp = new Map<string, { ids: Set<string>; names: Map<string, string> }>();
  for (const b of bids) {
    if (b.auctionId !== auctionId) continue;
    const entry = byIp.get(b.ip) ?? { ids: new Set<string>(), names: new Map<string, string>() };
    entry.ids.add(b.bidderId);
    entry.names.set(b.bidderId, b.bidderName);
    byIp.set(b.ip, entry);
  }
  return Array.from(byIp.entries())
    .filter(([, v]) => v.ids.size >= threshold)
    .map(([ip, v]) => ({ ip, bidderIds: Array.from(v.ids), bidderNames: Array.from(v.names.values()) }));
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
      bids.push({ id: nextId('BID'), auctionId: a.id, bidderId: bot.id, bidderName: bot.name, amount, at: t, ip: ipFor(bot.id) });
      amount += a.increment * (1 + Math.floor(Math.random() * 2));
      t += 3 * min + Math.random() * 4 * min;
      i++;
    }
    bids.push({ id: nextId('BID'), auctionId: a.id, bidderId: a.leaderId!, bidderName: a.leaderName!, amount: a.currentBid, at: Math.min(t, Date.now() - 2 * min), ip: ipFor(a.leaderId!) });
  }
  // deterministic same-IP fixture: b-02 and b-03 share an IP (see BOTS) — guarantee both
  // have an early bid on AU-101 so the collusion flag in Bid Monitor is demoable out of the box
  const flagAuction = auctions.find((a) => a.id === 'AU-101' && a.status === 'live');
  if (flagAuction) {
    bids.push(
      { id: nextId('BID'), auctionId: flagAuction.id, bidderId: 'b-02', bidderName: 'Apex Alloys Ltd', amount: flagAuction.startPrice, at: flagAuction.startsAt + min, ip: ipFor('b-02') },
      { id: nextId('BID'), auctionId: flagAuction.id, bidderId: 'b-03', bidderName: 'Vulcan Metals', amount: flagAuction.startPrice + flagAuction.increment, at: flagAuction.startsAt + 1.5 * min, ip: ipFor('b-03') },
    );
  }
  // winning bid history for the demo buyer's closed auction (Tin Ingots)
  const won = auctions.find((a) => a.id === 'AU-096');
  if (won) {
    bids.push(
      { id: nextId('BID'), auctionId: won.id, bidderId: DEMO_USER_ID, bidderName: 'Arjun Mehta', amount: won.currentBid - won.increment * 3, at: won.endsAt - 22 * min, ip: ipFor(DEMO_USER_ID) },
      { id: nextId('BID'), auctionId: won.id, bidderId: 'b-02', bidderName: 'Apex Alloys Ltd', amount: won.currentBid - won.increment, at: won.endsAt - 9 * min, ip: ipFor('b-02') },
      { id: nextId('BID'), auctionId: won.id, bidderId: DEMO_USER_ID, bidderName: 'Arjun Mehta', amount: won.currentBid, at: won.endsAt - 3 * min, ip: ipFor(DEMO_USER_ID) },
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
  execFunction: ExecFunction; // meaningful only when role === 'exec' — Field Executive Officer vs Executive Manager
  userName: string;
  authenticated: boolean;
  sessionExpiresAt: number | null;
  sessionExpired: boolean;
  now: number;
  theme: ThemeMode;

  // data
  users: User[];
  admins: AdminUser[];
  lots: Lot[];
  auctions: Auction[];
  auctionEvents: AuctionEvent[];
  catalogues: Catalogue[];
  bids: Bid[];
  wallet: { balance: number; emdLocked: number; ledger: LedgerEntry[] };
  emdLockedAuctions: string[];
  emdLockedCatalogues: string[];
  autoBid: Record<string, { max: number; step: number; active: boolean }>;
  entityRequests: EntityRequest[];
  settlements: Settlement[];
  logistics: LogisticsRecord[];
  notifications: AppNotification[];
  notices: Notice[];
  audit: AuditEntry[];
  config: typeof configSeed;
  masterData: typeof masterDataSeed;
  approvals: ApprovalRequest[];
  workQueue: WorkTask[];
  approvalLetters: ApprovalLetter[];
  settlementRounds: SettlementRound[];
  deliveryLetters: DeliveryLetter[];
  emailLogs: EmailLog[];
  toasts: Toast[];
  kycStatus: 'not_submitted' | 'pending' | 'verified';
  kycProfile: KycProfile;
  kycDocs: Record<KycDocType, KycDocStatus>;
  buyerUpgrade: 'none' | 'submitted' | 'approved';
  plans: SubscriptionPlan[];
  subscriptions: Partial<Record<PlanAudience, ActiveSubscription>>;

  // session actions
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
  switchRole: (r: Role, execFunction?: ExecFunction) => void;
  loginAs: (r: Role) => void;
  logout: () => void;
  reauth: () => void;
  expireSessionNow: () => void;

  // buyer/seller onboarding KYC wizard
  updateKycProfile: (patch: Partial<KycProfile>) => void;
  uploadKycDoc: (type: KycDocType) => void;
  submitKycWizard: () => void;
  resetKycDemo: () => void;

  // subscription / billing
  subscribeToPlan: (audience: PlanAudience, planId: string) => void;
  cancelSubscription: (audience: PlanAudience) => void;
  updatePlan: (planId: string, patch: Partial<SubscriptionPlan>) => void;

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
  // maker-checker lot approval (F group 1): field exec submits, Executive Manager decides
  submitVerification: (lotId: string, checklist: Record<string, boolean>, note: string, attachments: { reportUploaded: boolean; photosUploaded: boolean }) => void;
  approveLot: (lotId: string, notes: string) => void;
  rejectLot: (lotId: string, reason: string) => void;
  createAuction: (lotId: string, params: { startsInMin: number; increment: number; reserve: number; emd: number }) => void;

  // auction event / catalogue authoring
  createEvent: (name: string, startsInMin: number, endsInMin: number, location?: string) => string;
  createCatalogue: (eventId: string, title: string) => string;
  assignLotToCatalogue: (lotId: string, catalogueId: string) => void;
  updateCatalogueDocs: (catalogueId: string, documents: CatalogueDocument[]) => void;
  updateCatalogueInfo: (catalogueId: string, info: { description: string; terms?: string }) => void;
  lockCatalogueEmd: (catalogueId: string) => boolean;

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

  // notifications seam (Group 4) — the one place a real mail API would plug in
  sendNotification: (lotId: string, type: EmailLog['type'], recipientRole: 'seller' | 'buyer', recipientId: string, subject: string) => void;

  // post-award settlement — Approval Letter negotiation & escalation (Group 3)
  generateApprovalLetter: (lotId: string, round?: number, bidderId?: string, amount?: number) => void;
  sendApprovalLetter: (alId: string) => void;
  respondToApprovalLetter: (alId: string, party: 'seller' | 'buyer', decision: 'approved' | 'rejected') => void;
  recordSettlementRound: (lotId: string, round: number, bidderId: string, askAmount: number, bidderAgreed: boolean, confirmationRef: string) => void;
  reAuctionLot: (lotId: string) => void;
  cancelAndRefund: (lotId: string) => void;

  // delivery letter + tracking (Group 4)
  generateDeliveryLetter: (lotId: string, approvalLetterId: string) => void;
  acknowledgeDelivery: (dlId: string) => void;
  disputeDelivery: (dlId: string, note: string) => void;

  // admin
  toggleAdminActive: (id: string) => void;
  toggleAdminPermission: (id: string, key: string) => void;
  addAdmin: (name: string, email: string, role: 'exec' | 'subadmin', execFunction?: ExecFunction) => void;
  toggleUserActive: (id: string) => void;
  updateConfig: (section: string, key: string, value: unknown) => void;

  // scoped permission matrix (WBS v3.1 F10)
  updateScopedPermission: (adminId: string, module: string, patch: Partial<ModulePermission>) => void;
  applyPermTemplate: (adminId: string, templateKey: string) => void;

  // maker-checker approvals (F42)
  requestApproval: (req: { type: ApprovalType; title: string; detail: string; refId: string; amount?: number; payload?: Record<string, unknown> }) => void;
  decideApproval: (id: string, decision: 'approved' | 'rejected', note: string) => void;

  // auction control tower (F43)
  pauseAuction: (id: string, reason: string, actor?: string) => void;
  resumeAuction: (id: string, actor?: string) => void;
  extendAuction: (id: string, mins: number, reason: string) => void;
  cancelAuction: (id: string, reason: string) => void;
  voidBid: (bidId: string, reason: string) => void;

  // blacklist & defaulters (F44)
  setUserStanding: (id: string, standing: UserStanding, reason: string) => void;
  recordDefault: (id: string) => void;

  // sub-admin work queue (F45)
  completeTask: (id: string) => void;

  // master data (F48)
  addMasterItem: (kind: keyof typeof masterDataSeed, value: string) => void;
}

const initialAuctions = seedAuctions();
const initialEvents = seedEvents();
const initialCatalogues = seedCatalogues();

export const useApp = create<AppState>((set, get) => ({
  role: 'guest',
  execFunction: 'field',
  userName: 'Guest',
  authenticated: false,
  sessionExpiresAt: null,
  sessionExpired: false,
  now: Date.now(),
  theme: initialTheme(),

  users: usersSeed as User[],
  admins: adminsSeed as unknown as AdminUser[],
  lots: lotsSeed as unknown as Lot[],
  auctions: initialAuctions,
  auctionEvents: initialEvents,
  catalogues: initialCatalogues,
  bids: seedBids(initialAuctions),
  wallet: walletSeed as { balance: number; emdLocked: number; ledger: LedgerEntry[] },
  emdLockedAuctions: [],
  // demo buyer already unlocked the Batch A catalogue room (contains AU-101) out of the box
  emdLockedCatalogues: ['CAT-2026-01-A'],
  autoBid: {},
  entityRequests: entitySeed as EntityRequest[],
  settlements: settlementsSeed as Settlement[],
  logistics: logisticsSeed as unknown as LogisticsRecord[],
  notifications: seedNotifications(),
  notices: noticesSeed as Notice[],
  audit: auditSeed as AuditEntry[],
  config: configSeed,
  masterData: masterDataSeed,
  approvals: approvalsSeed as ApprovalRequest[],
  workQueue: (workQueueSeed as any[]).map((t) => ({
    id: t.id, title: t.title, module: t.module, refId: t.refId,
    assignedBy: t.assignedBy, dueAt: BOOT + t.dueInMin * min, status: t.status,
  })),
  approvalLetters: [],
  settlementRounds: [],
  deliveryLetters: [],
  emailLogs: [],
  toasts: [],
  kycStatus: 'verified',
  kycProfile: {
    fullName: 'Arjun Mehta', email: 'arjun.mehta@gmail.com', phone: '+91 98450 12345',
    panNumber: 'ABCPM1234F', isBusiness: false, businessName: '', gstin: '',
    address: '', city: '', state: '', pincode: '',
  },
  kycDocs: { pan: 'verified', aadhar: 'verified', photo: 'verified', gst: 'pending', address_proof: 'verified', cancelled_cheque: 'verified', itr: 'pending', pcb: 'pending' },
  buyerUpgrade: 'none',
  plans: plansSeed as SubscriptionPlan[],
  subscriptions: { buyer: { planId: 'PLN-BUY-BASIC', renewsAt: BOOT + 30 * 24 * 60 * min, autoRenew: true } },

  setTheme: (t) => {
    localStorage.setItem(THEME_KEY, t);
    applyTheme(t);
    set({ theme: t });
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),

  switchRole: (r, execFunction) => {
    const p = execFunction
      ? (PERSONAS.find((x) => x.role === r && x.execFunction === execFunction) ?? PERSONAS.find((x) => x.role === r)!)
      : PERSONAS.find((x) => x.role === r)!;
    const sessionTimeoutMin = get().config.platform.sessionTimeoutMin;
    set({
      role: r, userName: p.name, authenticated: r !== 'guest',
      execFunction: p.execFunction ?? get().execFunction,
      sessionExpiresAt: r !== 'guest' ? Date.now() + sessionTimeoutMin * min : null,
      sessionExpired: false,
    });
  },
  loginAs: (r) => get().switchRole(r),
  logout: () => set({ role: 'guest', userName: 'Guest', authenticated: false, sessionExpiresAt: null, sessionExpired: false }),
  reauth: () => {
    const sessionTimeoutMin = get().config.platform.sessionTimeoutMin;
    set({ sessionExpired: false, sessionExpiresAt: Date.now() + sessionTimeoutMin * min });
    get().pushToast({ title: 'Session resumed', body: 'Re-verified successfully — welcome back.', tone: 'success' });
  },
  expireSessionNow: () => {
    if (get().role === 'guest') return;
    set({ sessionExpired: true });
  },

  updateKycProfile: (patch) => set((s) => ({ kycProfile: { ...s.kycProfile, ...patch } })),
  uploadKycDoc: (type) => set((s) => ({ kycDocs: { ...s.kycDocs, [type]: 'uploaded' } })),
  submitKycWizard: () => {
    set({ kycStatus: 'pending' });
    get().pushToast({ title: 'KYC submitted', body: 'Documents sent for review (simulated).', tone: 'success' });
    get().notify('buyer', 'KYC submitted for review', 'Your account details and documents are being verified.', 'system');
    setTimeout(() => {
      set((s) => ({
        kycStatus: 'verified',
        kycDocs: Object.fromEntries(
          Object.entries(s.kycDocs).map(([k, v]) => [k, v === 'uploaded' ? 'verified' : v])
        ) as Record<KycDocType, KycDocStatus>,
      }));
      get().notify('buyer', 'KYC verified', 'Your KYC has been approved. You can now bid in live auctions.', 'system');
      get().pushToast({ title: 'KYC verified ✓', body: 'You can now participate in auctions.', tone: 'success' });
    }, 4000);
  },
  resetKycDemo: () => set({
    kycStatus: 'not_submitted',
    kycDocs: { pan: 'pending', aadhar: 'pending', photo: 'pending', gst: 'pending', address_proof: 'pending', cancelled_cheque: 'pending', itr: 'pending', pcb: 'pending' },
  }),

  subscribeToPlan: (audience, planId) => {
    const s = get();
    const plan = s.plans.find((p) => p.id === planId);
    if (!plan) return;
    const renewsAt = Date.now() + (plan.billingCycle === 'yearly' ? 365 : 30) * 24 * 60 * min;
    set((st) => ({ subscriptions: { ...st.subscriptions, [audience]: { planId, renewsAt, autoRenew: true } } }));
    s.logAudit(s.userName, audience === 'buyer' ? 'Buyer' : 'Seller', `Subscribed to ${plan.name} (${audience})`, plan.id, 'Subscription');
    s.notify(audience, `Subscribed to ${plan.name}`, `Your ${audience} plan is now active. Renews ${new Date(renewsAt).toLocaleDateString('en-IN')}.`, 'system');
    s.pushToast({ title: 'Subscription active', body: `${plan.name} — ${audience} plan`, tone: 'success' });
  },
  cancelSubscription: (audience) => {
    set((s) => {
      const next = { ...s.subscriptions };
      delete next[audience];
      return { subscriptions: next };
    });
    get().pushToast({ title: 'Subscription cancelled', tone: 'info' });
  },
  updatePlan: (planId, patch) => {
    set((s) => ({ plans: s.plans.map((p) => (p.id === planId ? { ...p, ...patch } : p)) }));
    get().logAudit('Mohammed Farooq', 'Super Admin', `Plan pricing updated — ${planId}`, planId, 'Configuration');
    get().pushToast({ title: 'Plan updated', tone: 'success' });
  },
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
    get().pushToast({ title: asDraft ? 'Draft saved' : 'Lot submitted', body: asDraft ? 'You can submit it for verification anytime.' : 'Sent to a Field Executive Officer for inspection.', tone: 'success' });
    return id;
  },

  submitLot: (lotId) => {
    get().setLotStatus(lotId, 'submitted');
    const lot = get().lots.find((l) => l.id === lotId);
    get().notify('exec', 'Lot submitted for verification', `${lot?.title} (${lotId}) awaiting inspection.`);
    get().logAudit('Kavitha Raman', 'Seller', 'Lot submitted for verification', lotId, 'Listing');
    get().pushToast({ title: 'Lot submitted', body: 'Sent to a Field Executive Officer for inspection.', tone: 'success' });
  },

  startVerification: (lotId) => {
    get().setLotStatus(lotId, 'under_verification');
    get().logAudit('Meera Pillai', 'Field Executive Officer', 'Verification started', lotId, 'Verification');
    get().notify('seller', `Lot ${lotId} under verification`, 'A Field Executive Officer has started the inspection.');
  },

  submitVerification: (lotId, checklist, note, attachments) => {
    const s = get();
    const lot = s.lots.find((l) => l.id === lotId);
    const allChecked = Object.values(checklist).every(Boolean) && Object.values(checklist).length > 0;
    // Follow-up toggle point: when REQUIRE_MANAGER_APPROVAL is false, a fully-checked lot with
    // both attachments on file could short-circuit straight to 'approved' here instead of queuing.
    const status: LotStatus = (!REQUIRE_MANAGER_APPROVAL && allChecked && attachments.reportUploaded)
      ? 'approved' : 'pending_manager_approval';
    set((st) => ({
      lots: st.lots.map((l) =>
        l.id === lotId
          ? {
              ...l, status,
              verification: {
                checklist, note,
                reportUploaded: attachments.reportUploaded, photosUploaded: attachments.photosUploaded,
                submittedBy: st.userName, submittedAt: nowStamp(),
              },
            }
          : l
      ),
    }));
    s.logAudit(s.userName, 'Field Executive Officer', 'Verification submitted for manager approval', lotId, 'Verification');
    s.notify('exec', 'Lot awaiting manager approval', `${lot?.title} (${lotId}) inspected — ready for Executive Manager sign-off.`);
    s.notify('seller', `Lot ${lotId} inspected`, 'Inspection complete — awaiting Executive Manager approval.');
    s.pushToast({ title: 'Submitted for manager approval', body: lot?.title, tone: 'success' });
  },

  approveLot: (lotId, notes) => {
    const s = get();
    const lot = s.lots.find((l) => l.id === lotId);
    set((st) => ({
      lots: st.lots.map((l) =>
        l.id === lotId
          ? { ...l, status: 'approved' as LotStatus, verification: l.verification && { ...l.verification, managerDecision: 'approved', managerNote: notes, decidedBy: st.userName, decidedAt: nowStamp() } }
          : l
      ),
    }));
    s.logAudit(s.userName, 'Executive Manager', 'Lot approved for auction', lotId, 'Manager Review');
    s.notify('seller', `Lot ${lotId} approved`, notes || `${lot?.title} — approved and ready for auction setup.`);
    s.pushToast({ title: 'Lot approved', body: lot?.title, tone: 'success' });
  },

  rejectLot: (lotId, reason) => {
    const s = get();
    const lot = s.lots.find((l) => l.id === lotId);
    set((st) => ({
      lots: st.lots.map((l) =>
        l.id === lotId
          ? { ...l, status: 'rejected' as LotStatus, rejectReason: reason, verification: l.verification && { ...l.verification, managerDecision: 'rejected', managerNote: reason, decidedBy: st.userName, decidedAt: nowStamp() } }
          : l
      ),
    }));
    s.logAudit(s.userName, 'Executive Manager', 'Lot rejected', lotId, 'Manager Review');
    s.notify('seller', `Lot ${lotId} rejected`, reason || `${lot?.title} — rejected by Executive Manager.`);
    s.pushToast({ title: 'Lot rejected', body: lot?.title, tone: 'error' });
  },

  createAuction: (lotId, params) => {
    const now = Date.now();
    const id = `AU-${100 + Math.floor(Math.random() * 800)}`;
    const lot = get().lots.find((l) => l.id === lotId)!;
    const catalogue = get().catalogues.find((c) => c.id === lot.catalogueId);
    if (!catalogue) return; // guard — UI only allows Create auction once the lot has a catalogue
    const startsAt = now + params.startsInMin * min;
    const auction: Auction = {
      id, lotId, catalogueId: catalogue.id,
      startsAt, endsAt: catalogue.closingAt,
      status: params.startsInMin <= 0 ? 'live' : 'scheduled',
      startPrice: lot.basePrice, currentBid: lot.basePrice,
      increment: params.increment, reserve: params.reserve, emd: params.emd,
      extensions: 0, bidderCount: 0,
    };
    set((s) => ({
      auctions: [...s.auctions, auction],
      lots: s.lots.map((l) => (l.id === lotId ? { ...l, status: auction.status === 'live' ? 'live' : 'scheduled', auctionId: id } : l)),
    }));
    get().logAudit('Ravi Kumar', 'Executive Manager', 'Auction created & scheduled', `${lotId} → ${id}`, 'Auction Setup');
    get().notify('seller', `Auction ${auction.status === 'live' ? 'is live' : 'scheduled'} for ${lotId}`, `${lot.title} — ${auction.status === 'live' ? 'bidding open now' : 'goes live soon'}.`);
    get().notify('buyer', 'New auction published', `${lot.title} (${lot.quantity}) is ${auction.status === 'live' ? 'live now' : 'opening soon'}.`);
    get().pushToast({ title: auction.status === 'live' ? 'Auction published live' : 'Auction scheduled', body: `${lot.title}`, tone: 'success' });
  },

  createEvent: (name, startsInMin, endsInMin, location) => {
    const id = nextId('EVT');
    const startsAt = Date.now() + startsInMin * min;
    const event: AuctionEvent = {
      id, name, status: startsInMin <= 0 ? 'live' : 'scheduled',
      startsAt, endsAt: startsAt + (endsInMin - startsInMin) * min,
      catalogueIds: [], location, coverHues: [210, 230], createdAt: nowStamp(),
    };
    set((s) => ({ auctionEvents: [...s.auctionEvents, event] }));
    get().logAudit('Ravi Kumar', 'Executive Manager', 'Auction Event created', name, 'Auction Setup');
    get().notify('exec', 'Auction Event created', `${name} is ready for catalogues to be added.`);
    return id;
  },

  createCatalogue: (eventId, title) => {
    const id = nextId('CAT');
    const event = get().auctionEvents.find((e) => e.id === eventId);
    const catalogue: Catalogue = {
      id, eventId, title, lotIds: [], closingAt: event?.endsAt ?? Date.now() + 60 * min,
      status: 'draft', createdAt: nowStamp(),
      documents: [], additionalInfo: { description: '' },
    };
    set((s) => ({
      catalogues: [...s.catalogues, catalogue],
      auctionEvents: s.auctionEvents.map((e) => (e.id === eventId ? { ...e, catalogueIds: [...e.catalogueIds, id] } : e)),
    }));
    get().logAudit('Ravi Kumar', 'Executive Manager', 'Catalogue created', `${title} → ${event?.name ?? eventId}`, 'Auction Setup');
    return id;
  },

  updateCatalogueDocs: (catalogueId, documents) => {
    set((s) => ({ catalogues: s.catalogues.map((c) => (c.id === catalogueId ? { ...c, documents } : c)) }));
    get().logAudit('Ravi Kumar', 'Executive Manager', 'Catalogue documents updated', catalogueId, 'Auction Setup');
  },

  updateCatalogueInfo: (catalogueId, info) => {
    set((s) => ({ catalogues: s.catalogues.map((c) => (c.id === catalogueId ? { ...c, additionalInfo: info } : c)) }));
    get().logAudit('Ravi Kumar', 'Executive Manager', 'Catalogue description/terms updated', catalogueId, 'Auction Setup');
  },

  lockCatalogueEmd: (catalogueId) => {
    const s = get();
    const catalogue = s.catalogues.find((c) => c.id === catalogueId);
    if (!catalogue) return false;
    if (s.emdLockedCatalogues.includes(catalogueId)) return true;
    const amount = catalogueEmdAmount(s.lots, catalogue);
    if (s.wallet.balance < amount) {
      s.pushToast({ title: 'Insufficient balance', body: 'Top up your wallet to lock EMD for this catalogue.', tone: 'error' });
      return false;
    }
    set((st) => ({
      emdLockedCatalogues: [...st.emdLockedCatalogues, catalogueId],
      wallet: {
        ...st.wallet,
        balance: st.wallet.balance - amount,
        emdLocked: st.wallet.emdLocked + amount,
        ledger: [{ id: nextId('L'), type: 'emd_lock', amount: -amount, note: `EMD locked — Catalogue ${catalogue.title}`, at: nowStamp() }, ...st.wallet.ledger],
      },
    }));
    s.pushToast({ title: 'EMD locked', body: `₹${amount.toLocaleString('en-IN')} locked. You can now bid on any lot in this catalogue.`, tone: 'success' });
    return true;
  },

  assignLotToCatalogue: (lotId, catalogueId) => {
    const s = get();
    const lot = s.lots.find((l) => l.id === lotId);
    const catalogue = s.catalogues.find((c) => c.id === catalogueId);
    if (!lot || !catalogue) return;
    set((st) => ({
      lots: st.lots.map((l) => (l.id === lotId ? { ...l, catalogueId } : l)),
      catalogues: st.catalogues.map((c) => (c.id === catalogueId ? { ...c, lotIds: Array.from(new Set([...c.lotIds, lotId])) } : c)),
    }));
    get().logAudit('Ravi Kumar', 'Executive Manager', `Lot ${lotId} assigned to catalogue`, catalogue.title, 'Auction Setup');
    get().notify('exec', 'Lot assigned to catalogue', `${lot.title} added to ${catalogue.title}.`);
    get().pushToast({ title: 'Assigned to catalogue', body: catalogue.title, tone: 'success' });
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
    get().pushToast({ title: 'Request submitted', body: 'An Executive Manager will review your entity documents.', tone: 'success' });
  },

  decideEntity: (reqId, decision, note) => {
    const req = get().entityRequests.find((r) => r.id === reqId);
    set((s) => ({
      entityRequests: s.entityRequests.map((r) => (r.id === reqId ? { ...r, status: decision, note } : r)),
      ...(decision === 'approved' && req?.userId === DEMO_USER_ID ? { buyerUpgrade: 'approved' as const } : {}),
      users: s.users.map((u) => (u.id === req?.userId && decision === 'approved' ? { ...u, sellerVerified: true, businessName: req.businessName } : u)),
    }));
    const msg = { approved: 'approved — Seller capability unlocked 🎉', rejected: 'rejected', returned: 'returned for corrections' }[decision];
    get().logAudit('Ravi Kumar', 'Executive Manager', `Entity ${decision} — ${req?.businessName}`, reqId, 'Entity Verification');
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
      bids: [...st.bids, { id: nextId('BID'), auctionId, bidderId: who.id, bidderName: who.name, amount, at: now, auto, ip: ipFor(who.id) }],
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

    if (s.role !== 'guest' && s.sessionExpiresAt && !s.sessionExpired && now >= s.sessionExpiresAt) {
      set({ sessionExpired: true });
      s.notify(s.role, 'Session expired', 'Please re-verify via OTP to continue where you left off.', 'system');
    }

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
        const lotForAuction = s.lots.find((l) => l.id === a.lotId);
        if (met && a.leaderId === DEMO_USER_ID) {
          s.notify('buyer', `You won Lot ${a.lotId} 🎉`, `Winning bid ₹${a.currentBid.toLocaleString('en-IN')}. Settlement will begin shortly.`);
          s.pushToast({ title: `You won Lot ${a.lotId}! 🎉`, body: `Winning bid ₹${a.currentBid.toLocaleString('en-IN')}`, tone: 'success' });
          s.sendNotification(a.lotId, 'auction_won', 'buyer', a.leaderId, `You won Lot ${a.lotId} at ₹${a.currentBid.toLocaleString('en-IN')}`);
          if (lotForAuction) s.sendNotification(a.lotId, 'auction_won', 'seller', lotForAuction.sellerId, `Lot ${a.lotId} sold at ₹${a.currentBid.toLocaleString('en-IN')}`);
        } else if (met) {
          s.notify('buyer', `Auction closed — Lot ${a.lotId}`, `${a.leaderName} won at ₹${a.currentBid.toLocaleString('en-IN')}. Your EMD will be auto-refunded once the catalogue's bidding wraps up.`);
          // auto-refund demo buyer's catalogue EMD once no other live/scheduled auction remains in that catalogue
          const catalogueId = a.catalogueId;
          const otherActiveInCatalogue = s.auctions.some((x) => x.id !== a.id && x.catalogueId === catalogueId && (x.status === 'live' || x.status === 'scheduled'));
          if (catalogueId && s.emdLockedCatalogues.includes(catalogueId) && !otherActiveInCatalogue) {
            const catalogue = s.catalogues.find((c) => c.id === catalogueId);
            const amount = catalogue ? catalogueEmdAmount(s.lots, catalogue) : a.emd;
            set((st) => ({
              emdLockedCatalogues: st.emdLockedCatalogues.filter((id) => id !== catalogueId),
              wallet: {
                ...st.wallet,
                balance: st.wallet.balance + amount,
                emdLocked: Math.max(0, st.wallet.emdLocked - amount),
                ledger: [{ id: nextId('L'), type: 'emd_release', amount, note: `EMD auto-refund — catalogue ${catalogueId} bidding closed`, at: nowStamp() }, ...st.wallet.ledger],
              },
            }));
            s.pushToast({ title: 'EMD refunded', body: `₹${amount.toLocaleString('en-IN')} released back to your wallet.`, tone: 'info' });
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
      get().logAudit('Ravi Kumar', 'Executive Manager', 'Winner payment confirmed (mock)', stId, 'Settlement');
      get().notify('buyer', `Payment confirmed — Lot ${st.lotId}`, 'Your payment has been verified. Pickup will be scheduled next.');
      get().pushToast({ title: 'Payment confirmed', tone: 'success' });
    }
  },
  handleEmd: (stId) => {
    const st = get().settlements.find((x) => x.id === stId);
    set((s) => ({ settlements: s.settlements.map((x) => (x.id === stId ? { ...x, emdHandled: true } : x)) }));
    if (st) {
      get().logAudit('Ravi Kumar', 'Executive Manager', 'EMD released to losers / forfeit processed', stId, 'Settlement');
      get().pushToast({ title: 'EMD processed', body: 'Losing bidders refunded; defaulter forfeits applied (mock).', tone: 'success' });
    }
  },
  generateInvoice: (stId) => {
    set((s) => ({ settlements: s.settlements.map((x) => (x.id === stId ? { ...x, invoiceGenerated: true } : x)) }));
    get().logAudit('Ravi Kumar', 'Executive Manager', 'Invoice & receipt generated (mock)', stId, 'Settlement');
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
    get().logAudit('Ravi Kumar', 'Executive Manager', 'Settlement complete — handed off to logistics', st.lotId, 'Settlement');
    get().notify('buyer', `Lot ${st.lotId} ready for pickup`, 'Settlement completed. Pickup scheduling is underway.');
    get().pushToast({ title: 'Handed off to logistics', tone: 'success' });
  },
  schedulePickup: (lgId, date, slot, handler) => {
    const lg = get().logistics.find((x) => x.id === lgId);
    set((s) => ({ logistics: s.logistics.map((x) => (x.id === lgId ? { ...x, pickupDate: date, slot, handler, status: 'scheduled' } : x)) }));
    if (lg) {
      get().logAudit('Ravi Kumar', 'Executive Manager', `Pickup scheduled + handler assigned (${handler})`, lg.lotId, 'Logistics');
      get().notify('buyer', `Pickup scheduled — Lot ${lg.lotId}`, `${date}, ${slot} · Handler: ${handler}`);
      get().pushToast({ title: 'Pickup scheduled', body: `${date} · ${slot} · ${handler}`, tone: 'success' });
    }
  },
  markInTransit: (lgId) => {
    const lg = get().logistics.find((x) => x.id === lgId);
    set((s) => ({ logistics: s.logistics.map((x) => (x.id === lgId ? { ...x, status: 'in_transit' } : x)) }));
    if (lg) {
      get().setLotStatus(lg.lotId, 'in_logistics');
      get().logAudit('Ravi Kumar', 'Executive Manager', 'Pickup in transit', lg.lotId, 'Logistics');
      set((s) => ({ deliveryLetters: s.deliveryLetters.map((dl) => (dl.lotId === lg.lotId && (dl.status === 'sent' || dl.status === 'acknowledged') ? { ...dl, status: 'in_transit' } : dl)) }));
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
      get().logAudit('Ravi Kumar', 'Executive Manager', 'Handover confirmed — lot closed', lg.lotId, 'Handover');
      get().notify('all', `Lot ${lg.lotId} handed over ✓`, 'Pickup completed with proof. Lifecycle closed.');
      get().pushToast({ title: 'Handover complete — lot closed', tone: 'success' });
      const deliveredAt = nowStamp();
      const lot = get().lots.find((l) => l.id === lg.lotId);
      const dl = get().deliveryLetters.find((x) => x.lotId === lg.lotId);
      set((s) => ({ deliveryLetters: s.deliveryLetters.map((x) => (x.id === dl?.id ? { ...x, status: 'delivered', deliveredAt } : x)) }));
      if (dl && lot) {
        get().sendNotification(lg.lotId, 'delivered', 'seller', lot.sellerId, `Lot ${lg.lotId} delivered and handover confirmed`);
        const winnerId = get().auctions.find((a) => a.id === lot.auctionId)?.leaderId;
        if (winnerId) get().sendNotification(lg.lotId, 'delivered', 'buyer', winnerId, `Lot ${lg.lotId} delivered — handover confirmed`);
      }
    }
  },

  /* ---------- notifications seam (Group 4) ---------- */
  sendNotification: (lotId, type, recipientRole, recipientId, subject) => {
    set((s) => ({
      emailLogs: [{ id: nextId('EM'), lotId, type, recipientRole, recipientId, subject, sentAt: nowStamp() }, ...s.emailLogs],
    }));
    get().pushToast({ title: 'Notification sent (mock)', body: subject, tone: 'info' });
  },

  /* ---------- post-award settlement: Approval Letter negotiation & escalation (Group 3) ---------- */
  generateApprovalLetter: (lotId, round, bidderId, amount) => {
    const s = get();
    const lot = s.lots.find((l) => l.id === lotId);
    const auction = s.auctions.find((a) => a.id === lot?.auctionId);
    if (!lot || !auction) return;
    const resolvedRound = round ?? 1;
    const resolvedBidderId = bidderId ?? auction.leaderId;
    const resolvedAmount = amount ?? auction.currentBid;
    if (!resolvedBidderId) return;
    const id = nextId('AL');
    const al: ApprovalLetter = {
      id, lotId, round: resolvedRound, bidderId: resolvedBidderId, sellerId: lot.sellerId,
      amount: resolvedAmount, pdfUrl: `/mock-pdf/${id}.pdf`, status: 'draft', generatedBy: s.userName,
    };
    set((st) => ({
      approvalLetters: [al, ...st.approvalLetters.map((x) => (x.lotId === lotId && x.status !== 'superseded' ? { ...x, status: 'superseded' as const } : x))],
    }));
    s.logAudit(s.userName, 'Executive Manager', `Approval Letter drafted — round ${resolvedRound} at ₹${resolvedAmount.toLocaleString('en-IN')}`, lotId, 'Settlement Desk');
    s.pushToast({ title: 'Approval Letter drafted', body: `Round ${resolvedRound} · ${lot.title}`, tone: 'success' });
  },

  sendApprovalLetter: (alId) => {
    const s = get();
    const al = s.approvalLetters.find((x) => x.id === alId);
    if (!al) return;
    set((st) => ({ approvalLetters: st.approvalLetters.map((x) => (x.id === alId ? { ...x, status: 'sent', sentAt: nowStamp() } : x)) }));
    s.sendNotification(al.lotId, 'al_sent', 'seller', al.sellerId, `Approval Letter (round ${al.round}) sent for your decision`);
    s.sendNotification(al.lotId, 'al_sent', 'buyer', al.bidderId, `Approval Letter (round ${al.round}) sent for your decision`);
    s.logAudit(s.userName, 'Executive Manager', `Approval Letter sent — round ${al.round}`, al.lotId, 'Settlement Desk');
  },

  respondToApprovalLetter: (alId, party, decision) => {
    const s = get();
    const al = s.approvalLetters.find((x) => x.id === alId);
    if (!al) return;
    // buyer can only respond once the seller has approved — that ordering is what lets a single
    // `status` field stand in for "both parties approved" (see plan notes)
    if (party === 'seller' && al.status !== 'sent') return;
    if (party === 'buyer' && al.status !== 'seller_approved') return;
    const nextStatus = party === 'seller'
      ? (decision === 'approved' ? 'seller_approved' : 'seller_rejected')
      : (decision === 'approved' ? 'buyer_approved' : 'buyer_rejected');
    set((st) => ({ approvalLetters: st.approvalLetters.map((x) => (x.id === alId ? { ...x, status: nextStatus, respondedAt: nowStamp() } : x)) }));
    const otherRole = party === 'seller' ? 'buyer' : 'seller';
    const otherId = party === 'seller' ? al.bidderId : al.sellerId;
    s.sendNotification(al.lotId, decision === 'approved' ? 'al_approved' : 'al_rejected', otherRole, otherId, `${party === 'seller' ? 'Seller' : 'Buyer'} ${decision} the Approval Letter (round ${al.round})`);
    s.logAudit(s.userName, 'Executive Manager', `AL ${party} ${decision} — round ${al.round}`, al.lotId, 'Settlement Desk');
    s.pushToast({ title: `${party === 'seller' ? 'Seller' : 'Buyer'} ${decision}`, body: `Round ${al.round} · AL ${alId}`, tone: decision === 'approved' ? 'success' : 'error' });
  },

  recordSettlementRound: (lotId, round, bidderId, askAmount, bidderAgreed, confirmationRef) => {
    const s = get();
    const lot = s.lots.find((l) => l.id === lotId);
    const auction = s.auctions.find((a) => a.id === lot?.auctionId);
    const row: SettlementRound = {
      id: nextId('SR'), lotId, round, bidderId, askAmount, bidderAgreed, confirmationRef: confirmationRef || undefined,
      outcome: bidderAgreed ? 'confirmed' : 'escalated', decidedBy: s.userName, createdAt: nowStamp(),
    };
    set((st) => ({ settlementRounds: [row, ...st.settlementRounds] }));
    s.logAudit(s.userName, 'Executive Manager', `Settlement round ${round} recorded — bidder ${bidderAgreed ? 'agreed' : 'declined'}`, lotId, 'Settlement Desk');

    if (bidderAgreed) {
      s.generateApprovalLetter(lotId, round, bidderId, askAmount);
      return;
    }
    if (!auction) return;
    const nextRound = round + 1;
    if (nextRound > MAX_SETTLEMENT_ROUNDS) {
      s.pushToast({ title: 'Settlement rounds exhausted', body: `${lot?.title} — re-auction or cancel & refund.`, tone: 'error' });
      return;
    }
    const attempted = new Set(s.settlementRounds.filter((r) => r.lotId === lotId).map((r) => r.bidderId).concat(bidderId));
    const ranked = rankedBids(s.bids, auction.id);
    const nextBidder = ranked.find((b) => !attempted.has(b.bidderId));
    if (!nextBidder) {
      s.pushToast({ title: 'No further bidders', body: `${lot?.title} — re-auction or cancel & refund.`, tone: 'error' });
      return;
    }
    s.sendNotification(lotId, 'escalation_offer', 'buyer', nextBidder.bidderId, `You're next in line for Lot ${lotId} at ₹${nextBidder.amount.toLocaleString('en-IN')}`);
    s.generateApprovalLetter(lotId, nextRound, nextBidder.bidderId, nextBidder.amount);
  },

  reAuctionLot: (lotId) => {
    const s = get();
    const lot = s.lots.find((l) => l.id === lotId);
    set((st) => ({ lots: st.lots.map((l) => (l.id === lotId ? { ...l, status: 'approved' as LotStatus, auctionId: undefined, catalogueId: undefined } : l)) }));
    s.logAudit(s.userName, 'Executive Manager', 'Lot returned to pool for re-auction', lotId, 'Settlement Desk');
    if (lot) s.sendNotification(lotId, 're_auction', 'seller', lot.sellerId, `Lot ${lotId} is being re-auctioned after settlement fell through`);
    s.pushToast({ title: 'Lot sent back for re-auction', body: lot?.title, tone: 'info' });
  },

  cancelAndRefund: (lotId) => {
    const s = get();
    const lot = s.lots.find((l) => l.id === lotId);
    if (!lot) return;
    set((st) => ({ lots: st.lots.map((l) => (l.id === lotId ? { ...l, status: 'cancelled' as LotStatus } : l)) }));
    const catalogueId = lot.catalogueId;
    if (catalogueId && s.emdLockedCatalogues.includes(catalogueId)) {
      const catalogue = s.catalogues.find((c) => c.id === catalogueId);
      const amount = catalogue ? catalogueEmdAmount(s.lots, catalogue) : 0;
      if (amount > 0) {
        set((st) => ({
          emdLockedCatalogues: st.emdLockedCatalogues.filter((id) => id !== catalogueId),
          wallet: {
            ...st.wallet,
            balance: st.wallet.balance + amount,
            emdLocked: Math.max(0, st.wallet.emdLocked - amount),
            ledger: [{ id: nextId('L'), type: 'refund', amount, note: `EMD refund — Lot ${lotId} cancelled`, at: nowStamp() }, ...st.wallet.ledger],
          },
        }));
      }
    }
    s.logAudit(s.userName, 'Executive Manager', 'Lot cancelled — EMDs refunded', lotId, 'Settlement Desk');
    s.sendNotification(lotId, 'emd_refunded', 'seller', lot.sellerId, `Lot ${lotId} cancelled — EMDs refunded to bidders`);
    s.pushToast({ title: 'Lot cancelled', body: 'EMDs refunded.', tone: 'error' });
  },

  /* ---------- delivery letter + tracking (Group 4) ---------- */
  generateDeliveryLetter: (lotId, approvalLetterId) => {
    const s = get();
    const al = s.approvalLetters.find((x) => x.id === approvalLetterId);
    const lot = s.lots.find((l) => l.id === lotId);
    if (!al || !lot || al.status !== 'buyer_approved') {
      s.pushToast({ title: 'Cannot generate Delivery Letter', body: 'The Approval Letter needs both seller and buyer approval first.', tone: 'error' });
      return;
    }
    const id = nextId('DL');
    const dl: DeliveryLetter = { id, lotId, approvalLetterId, pdfUrl: `/mock-pdf/${id}.pdf`, status: 'sent', generatedBy: s.userName, sentAt: nowStamp() };
    set((st) => ({ deliveryLetters: [dl, ...st.deliveryLetters] }));
    s.sendNotification(lotId, 'dl_sent', 'seller', al.sellerId, `Delivery Letter issued for Lot ${lotId}`);
    s.sendNotification(lotId, 'dl_sent', 'buyer', al.bidderId, `Delivery Letter issued for Lot ${lotId}`);
    s.setLotStatus(lotId, 'ready_for_pickup');
    s.logAudit(s.userName, 'Executive Manager', 'Delivery Letter generated & sent', lotId, 'Settlement Desk');
    s.pushToast({ title: 'Delivery Letter sent', body: lot.title, tone: 'success' });
  },

  acknowledgeDelivery: (dlId) => {
    set((s) => ({ deliveryLetters: s.deliveryLetters.map((x) => (x.id === dlId ? { ...x, status: 'acknowledged' } : x)) }));
    get().pushToast({ title: 'Delivery Letter acknowledged', tone: 'success' });
  },

  disputeDelivery: (dlId, note) => {
    const dl = get().deliveryLetters.find((x) => x.id === dlId);
    set((s) => ({ deliveryLetters: s.deliveryLetters.map((x) => (x.id === dlId ? { ...x, status: 'disputed', trackingNotes: note } : x)) }));
    if (dl) get().logAudit(get().userName, get().role, `Delivery disputed — ${note}`, dl.lotId, 'Logistics');
    get().pushToast({ title: 'Dispute recorded', body: note, tone: 'error' });
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
  addAdmin: (name, email, role, execFunction) => {
    const fn = execFunction ?? 'field';
    const perms: Record<string, boolean> =
      role === 'exec'
        ? fn === 'field'
          ? { lotVerification: true }
          : { entityVerification: true, auctionCreation: true, settlement: true, logistics: true, handover: true }
        : { manageAuctions: true, manageLots: true, manageUsers: false, manageCatalogue: true, viewAudit: false, systemConfig: false };
    const roleLabel = role === 'exec' ? (fn === 'field' ? 'Field Executive Officer' : 'Executive Manager') : 'Sub-Admin';
    set((s) => ({
      admins: [...s.admins, {
        id: nextId('adm'), name, email, role, permissions: perms, active: true, createdAt: new Date().toISOString().slice(0, 10),
        ...(role === 'exec' ? { execFunction: fn } : {}),
        ...(role === 'subadmin' ? { scoped: JSON.parse(JSON.stringify(DEFAULT_SUB_SCOPED)) } : {}),
      }],
    }));
    get().logAudit('Mohammed Farooq', 'Super Admin', `${roleLabel} created`, name, 'Administration');
    get().pushToast({ title: `${roleLabel} created`, body: name, tone: 'success' });
  },
  toggleUserActive: (id) =>
    set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, active: !u.active } : u)) })),
  updateConfig: (section, key, value) =>
    set((s) => ({
      config: { ...s.config, [section]: { ...(s.config as any)[section], [key]: value } } as typeof configSeed,
    })),

  /* ---------- scoped permission matrix (F10) ---------- */
  updateScopedPermission: (adminId, module, patch) => {
    set((s) => ({
      admins: s.admins.map((a) =>
        a.id === adminId
          ? { ...a, scoped: { ...(a.scoped ?? DEFAULT_SUB_SCOPED), [module]: { ...(a.scoped ?? DEFAULT_SUB_SCOPED)[module], ...patch } } }
          : a
      ),
    }));
    const adm = get().admins.find((a) => a.id === adminId);
    get().logAudit('Mohammed Farooq', 'Super Admin', `Scoped permission updated — ${module} (${Object.entries(patch).map(([k, v]) => `${k}: ${v}`).join(', ')})`, adm?.name ?? adminId, 'Administration');
  },

  applyPermTemplate: (adminId, templateKey) => {
    const tpl = PERM_TEMPLATES.find((t) => t.key === templateKey);
    if (!tpl) return;
    set((s) => ({
      admins: s.admins.map((a) => (a.id === adminId ? { ...a, scoped: JSON.parse(JSON.stringify(tpl.perms)) } : a)),
    }));
    const adm = get().admins.find((a) => a.id === adminId);
    get().logAudit('Mohammed Farooq', 'Super Admin', `Role template "${tpl.label}" applied`, adm?.name ?? adminId, 'Administration');
    get().pushToast({ title: `Template applied — ${tpl.label}`, body: `${adm?.name}'s console now follows this permission set.`, tone: 'success' });
  },

  /* ---------- maker-checker approvals (F42) ---------- */
  requestApproval: (req) => {
    const s = get();
    // one pending request per action — resubmitting the same thing is a no-op
    if (s.approvals.some((a) => a.status === 'pending' && a.type === req.type && a.refId === req.refId)) {
      s.pushToast({ title: 'Already awaiting approval', body: 'This action has a pending request with the approvers.', tone: 'info' });
      return;
    }
    const requestedRole = s.role === 'superadmin' ? 'Super Admin' : s.role === 'exec' ? 'Executive Manager' : 'Sub-Admin';
    set((st) => ({
      approvals: [
        { id: nextId('AP'), ...req, requestedBy: st.userName, requestedRole, at: nowStamp(), status: 'pending' as const },
        ...st.approvals,
      ],
    }));
    s.logAudit(s.userName, 'Sub-Admin', `Approval requested — ${req.title}`, req.refId, 'Approvals');
    s.notify('exec', 'Approval requested', `${s.userName}: ${req.title}`, 'system');
    s.notify('superadmin', 'Approval requested', `${s.userName}: ${req.title}`, 'system');
    s.pushToast({ title: 'Sent for approval', body: 'Executive/Super Admin will review this action.', tone: 'info' });
  },

  decideApproval: (id, decision, note) => {
    const s = get();
    const ap = s.approvals.find((a) => a.id === id);
    if (!ap || ap.status !== 'pending') return;
    const decider = s.userName;
    const deciderRole = s.role === 'superadmin' ? 'Super Admin' : 'Executive Manager';
    set((st) => ({
      approvals: st.approvals.map((a) =>
        a.id === id ? { ...a, status: decision, decidedBy: decider, decisionNote: note, decidedAt: nowStamp() } : a
      ),
    }));
    // approved requests execute their underlying action
    if (decision === 'approved') {
      switch (ap.type) {
        case 'entity_approve': s.decideEntity(ap.refId, 'approved', note || ap.detail); break;
        case 'entity_reject': if (s.entityRequests.some((r) => r.id === ap.refId && r.status === 'pending')) s.decideEntity(ap.refId, 'rejected', note || ap.detail); break;
        case 'lot_reject': s.rejectLot(ap.refId, note || ap.detail); break;
        case 'emd_forfeit': s.handleEmd(ap.refId); break;
        case 'auction_pause': s.pauseAuction(ap.refId, note || ap.detail, decider); break;
        case 'auction_publish': {
          const p = ap.payload as any;
          if (p) s.createAuction(ap.refId, { startsInMin: p.startsInMin, increment: p.increment, reserve: p.reserve, emd: p.emd });
          break;
        }
        case 'bid_flag': s.voidBid(ap.refId, note || ap.detail); break;
      }
    }
    s.logAudit(decider, deciderRole, `Approval ${decision} — ${ap.title}`, ap.refId, 'Approvals');
    s.notify('subadmin', `Request ${decision}`, `"${ap.title}" was ${decision} by ${decider}.${note ? ` Note: ${note}` : ''}`, 'system');
    s.pushToast({ title: `Request ${decision}`, body: ap.title, tone: decision === 'approved' ? 'success' : 'error' });
  },

  /* ---------- auction control tower (F43) ---------- */
  pauseAuction: (id, reason, actor) => {
    const s = get();
    const a = s.auctions.find((x) => x.id === id);
    if (!a || a.status !== 'live') return;
    const now = Date.now();
    set((st) => ({
      auctions: st.auctions.map((x) =>
        x.id === id ? { ...x, status: 'paused', pausedRemaining: Math.max(0, x.endsAt - now), pauseReason: reason } : x
      ),
    }));
    s.logAudit(actor ?? 'Mohammed Farooq', actor ? 'Executive Manager' : 'Super Admin', `Auction paused — ${reason}`, id, 'Control Tower');
    s.notify('all', `Auction ${id} paused`, `Bidding is temporarily on hold. Reason: ${reason}`, 'system');
    s.pushToast({ title: 'Auction paused', body: `${id} — clock frozen, bidding blocked.`, tone: 'info' });
  },

  resumeAuction: (id, actor) => {
    const s = get();
    const a = s.auctions.find((x) => x.id === id);
    if (!a || a.status !== 'paused') return;
    set((st) => ({
      auctions: st.auctions.map((x) =>
        x.id === id ? { ...x, status: 'live', endsAt: Date.now() + (x.pausedRemaining ?? 0), pausedRemaining: undefined, pauseReason: undefined } : x
      ),
    }));
    s.logAudit(actor ?? 'Mohammed Farooq', 'Super Admin', 'Auction resumed', id, 'Control Tower');
    s.notify('all', `Auction ${id} resumed`, 'Bidding is open again — the clock picks up where it stopped.', 'bid');
    s.pushToast({ title: 'Auction resumed', body: `${id} is live again.`, tone: 'success' });
  },

  extendAuction: (id, mins, reason) => {
    const s = get();
    const a = s.auctions.find((x) => x.id === id);
    if (!a || (a.status !== 'live' && a.status !== 'paused')) return;
    set((st) => ({
      auctions: st.auctions.map((x) =>
        x.id === id
          ? x.status === 'paused'
            ? { ...x, pausedRemaining: (x.pausedRemaining ?? 0) + mins * min }
            : { ...x, endsAt: x.endsAt + mins * min }
          : x
      ),
    }));
    s.logAudit('Mohammed Farooq', 'Super Admin', `Auction force-extended +${mins} min — ${reason}`, id, 'Control Tower');
    s.notify('all', `Auction ${id} extended`, `Closing time extended by ${mins} minutes by the platform.`, 'bid');
    s.pushToast({ title: `Extended +${mins} min`, body: id, tone: 'success' });
  },

  cancelAuction: (id, reason) => {
    const s = get();
    const a = s.auctions.find((x) => x.id === id);
    if (!a || a.status === 'closed' || a.status === 'cancelled') return;
    const wasScheduled = a.status === 'scheduled';
    set((st) => ({
      auctions: st.auctions.map((x) => (x.id === id ? { ...x, status: 'cancelled' } : x)),
      // scheduled lots return to the approved pool for re-auction; live ones close
      lots: st.lots.map((l) => (l.id === a.lotId ? { ...l, status: wasScheduled ? 'approved' : 'closed', auctionId: wasScheduled ? undefined : l.auctionId } : l)),
    }));
    s.logAudit('Mohammed Farooq', 'Super Admin', `Auction cancelled — ${reason}`, id, 'Control Tower');
    s.notify('all', `Auction ${id} cancelled`, `Reason: ${reason}. EMDs will be auto-refunded (mock).`, 'system');
    s.pushToast({ title: 'Auction cancelled', body: wasScheduled ? 'Lot returned to the approved pool.' : 'Lot closed; EMDs refunded (mock).', tone: 'error' });
  },

  voidBid: (bidId, reason) => {
    const s = get();
    const bid = s.bids.find((b) => b.id === bidId);
    if (!bid) return;
    const rest = s.bids.filter((b) => b.id !== bidId);
    const top = rest.filter((b) => b.auctionId === bid.auctionId).sort((x, y) => y.amount - x.amount)[0];
    set((st) => ({
      bids: rest,
      auctions: st.auctions.map((a) =>
        a.id === bid.auctionId
          ? { ...a, currentBid: top?.amount ?? a.startPrice, leaderId: top?.bidderId, leaderName: top?.bidderName }
          : a
      ),
    }));
    s.logAudit('Mohammed Farooq', 'Super Admin', `Bid voided (₹${bid.amount.toLocaleString('en-IN')} by ${bid.bidderName}) — ${reason}`, bid.auctionId, 'Control Tower');
    s.notify('all', `A bid on ${bid.auctionId} was voided`, `Platform removed a bid of ₹${bid.amount.toLocaleString('en-IN')}. Current highest recalculated.`, 'system');
    s.pushToast({ title: 'Bid voided', body: `${bid.bidderName} — ₹${bid.amount.toLocaleString('en-IN')}. Ladder recalculated.`, tone: 'error' });
  },

  /* ---------- blacklist & defaulters (F44) ---------- */
  setUserStanding: (id, standing, reason) => {
    const s = get();
    const u = s.users.find((x) => x.id === id);
    set((st) => ({
      users: st.users.map((x) =>
        x.id === id
          ? { ...x, standing, standingReason: reason || undefined, active: standing === 'suspended' || standing === 'blacklisted' ? false : x.active }
          : x
      ),
    }));
    const labels: Record<UserStanding, string> = { good: 'standing cleared', watchlist: 'added to watchlist', suspended: 'suspended', blacklisted: 'blacklisted' };
    s.logAudit('Mohammed Farooq', 'Super Admin', `User ${labels[standing]}${reason ? ` — ${reason}` : ''}`, u?.name ?? id, 'Risk & Trust');
    s.pushToast({ title: `${u?.name} ${labels[standing]}`, tone: standing === 'good' ? 'success' : 'error' });
  },

  recordDefault: (id) => {
    const s = get();
    const u = s.users.find((x) => x.id === id);
    if (!u) return;
    const defaults = (u.defaults ?? 0) + 1;
    const rule = s.config.risk;
    const autoSuspend = rule.autoSuspendEnabled && defaults >= rule.autoSuspendAfterDefaults && u.standing !== 'blacklisted';
    set((st) => ({
      users: st.users.map((x) =>
        x.id === id
          ? {
              ...x, defaults,
              ...(autoSuspend
                ? { standing: 'suspended' as UserStanding, active: false, standingReason: `Auto-suspended — ${defaults} payment defaults (rule: suspend after ${rule.autoSuspendAfterDefaults})` }
                : { standing: (x.standing === 'good' || !x.standing ? 'watchlist' : x.standing) as UserStanding }),
            }
          : x
      ),
    }));
    s.logAudit('System', 'System', autoSuspend ? `Payment default recorded → auto-suspended (${defaults} defaults)` : `Payment default recorded (${defaults})`, u.name, 'Risk & Trust');
    s.pushToast({ title: autoSuspend ? `${u.name} auto-suspended` : 'Default recorded', body: autoSuspend ? `Hit the ${rule.autoSuspendAfterDefaults}-default threshold.` : `${u.name} now has ${defaults} default(s).`, tone: autoSuspend ? 'error' : 'info' });
  },

  /* ---------- sub-admin work queue (F45) ---------- */
  completeTask: (id) => {
    const s = get();
    const t = s.workQueue.find((x) => x.id === id);
    set((st) => ({ workQueue: st.workQueue.map((x) => (x.id === id ? { ...x, status: 'done' } : x)) }));
    if (t) {
      s.logAudit(s.userName, 'Sub-Admin', `Task completed — ${t.title}`, t.refId, 'Work Queue');
      s.pushToast({ title: 'Task completed', body: t.title, tone: 'success' });
    }
  },

  /* ---------- master data (F48) ---------- */
  addMasterItem: (kind, value) => {
    set((s) => ({ masterData: { ...s.masterData, [kind]: [...s.masterData[kind], value] } }));
    get().logAudit('Mohammed Farooq', 'Super Admin', `Master data added — ${String(kind)}: ${value}`, 'Master Data', 'Configuration');
    get().pushToast({ title: 'Added (mock save)', body: value, tone: 'success' });
  },
}));
