/* ---------------------------------------------------------------------------
   The store's own State contract — split out of store.ts so slice files can
   import it without importing the store's module-level seed/constant setup.
   Structural split only: every field and action signature here is unchanged
   from store.ts's original `interface State`.
--------------------------------------------------------------------------- */
import type {
  AccountStatus, ActionReview, ActionVerdict, Announcement, AppNotification, AuditEvent, AutoBidSetting, BankAccount, BankStatementLine, Bid, BidType, BidVoidRequest, BuyerLotSelection,
  CancellationRequest, Catalogue, CeoApprovalKind, CeoApprovalRequest, CeoDelegation, CommissionSettlement, CompanyBankAccount, ContentDraft, DemandDraft, DeliveryOrder, DepositClaim, Dispute, DisputeOutcome,
  EmdExemptionRequest, EmdForfeiture, FinanceConfig, HandoverNote, RefundSource, InspectionReport, InspectionSlot, Invoice, LiftingChecklistItem, Lot, LotStatus,
  MasterCategory, MasterUom, MasterYard, NotificationKind, PageDef, PasswordReset, RefundRequest,
  ResultConfirmation, Role, RoleDef, StaReferral, StructuralChange, Testimonial, TermsSet, User, Wallet, WatchlistEntry, WithdrawalRequest, WithdrawalWindowConfig,
} from '../types'

export interface Toast {
  id: string
  kind: 'success' | 'info' | 'warning' | 'danger'
  title: string
  body?: string
}

export interface State {
  now: number
  theme: 'light' | 'dark'
  role: Role
  currentUser: User | null
  paused: Record<string, boolean> // catalogueId → paused
  /** Whether the API has answered this session. The store starts empty and only
   *  the server fills it, so screens read this to say "not connected" rather
   *  than passing an empty database off as a quiet marketplace. */
  serverStatus: 'checking' | 'connected' | 'offline'
  /** Whether the boot-time session restore has finished.
   *
   *  Separate from `serverStatus`, which is about data: this is about identity.
   *  At boot we hold a refresh token but not yet an answer, so `currentUser` is
   *  legitimately null for one round trip. A route guard that read that as
   *  "signed out" would bounce a returning user to the login page every reload,
   *  so guards wait for 'ready' before deciding anything. */
  sessionStatus: 'restoring' | 'ready'
  /** Set while a Sub/Super Admin is signed in as somebody else. Who they were
   *  before, so Chrome can show "Viewing as X — back to your own account" and
   *  the exit action knows there is a real admin session parked to return to. */
  impersonatedBy: { id: string; name: string; role: Role } | null

  catalogues: Catalogue[]
  lots: Lot[]
  users: User[]
  bids: Bid[]
  wallets: Wallet[]
  inspectionReports: InspectionReport[]
  notifications: AppNotification[]
  termsSets: TermsSet[]
  deliveryOrders: DeliveryOrder[]
  demandDrafts: DemandDraft[]
  announcements: Announcement[]
  disputes: Dispute[]
  testimonials: Testimonial[]
  auditEvents: AuditEvent[]
  selections: BuyerLotSelection[]
  /** Catalogue-level "interested" marker — separate from `selections` (interest vs. committed-to-bid). */
  watchlist: WatchlistEntry[]
  autoBids: AutoBidSetting[]
  inspectionSlots: InspectionSlot[]
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
  /** Sign in against the server. This is the real one — scrypt, throttling,
   *  lockout and a token, all on the API. `signIn` above stays as the offline
   *  demo path and is NOT a fallback for this: signing somebody in without a
   *  password because the server is unreachable would be a hole dressed as
   *  resilience. */
  signInRemote: (identifier: string, password: string) =>
    Promise<{ ok: boolean; role?: Role; error?: string; mustChangePassword?: boolean }>
  /** Adopt a session the API confirmed — used at boot, from a stored refresh
   *  token, so a reload does not sign everybody out. */
  adoptSession: (user: User) => void
  /** Called once the boot-time restore has settled, whichever way it went, so
   *  route guards stop waiting and start deciding. */
  sessionResolved: () => void
  /** Sub/Super Admin only — a real server session for `userId`, no password.
   *  See server/src/api/auth.mjs's `impersonate` for which roles may be a
   *  target; refused there reads back here as `error`. */
  impersonateUser: (userId: string) => Promise<{ ok: boolean; error?: string }>
  /** Hand the tab back to whoever was signed in before `impersonateUser`. */
  endImpersonation: () => Promise<{ ok: boolean }>
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
  /** flagged -> inspected. Phase 28b: guarded replacement for the exec/Pipeline
   *  "Resolve" button, which used to call setLotStatus with no role or
   *  source-status check at all. */
  resolveFlaggedLot: (lotId: string) => { ok: boolean; error?: string }
  /** sta -> sold. Phase 28b: guarded replacement for exec/Settlement's
   *  approveSale, previously a bare setLotStatus call. */
  approveStaSale: (lotId: string) => { ok: boolean; error?: string }
  /** sta -> unsold. Phase 28b: guarded replacement for exec/Settlement's
   *  markUnsold, previously a bare setLotStatus call. */
  markStaUnsold: (lotId: string) => { ok: boolean; error?: string }
  /** sold|sta -> unsold, on a lot whose seller refused the cleared price.
   *  Phase 28b: guarded replacement for exec/Settlement's returnToPipeline,
   *  previously a bare setLotStatus call. */
  returnRefusedLotToPipeline: (lotId: string) => { ok: boolean; error?: string }
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
  setSellerLotDecision: (lotId: string, decision: 'accepted' | 'rejected' | null) => { ok: boolean; error?: string }
  recordCommissionSettlement: (catalogueId: string, amount: number, mode: 'transfer' | 'emd', reference?: string) => { ok: boolean; error?: string }
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
  setUserStanding: (userId: string, standing: User['standing'], reason?: string) => { ok: boolean; error?: string }
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
  waiveEmdForfeiture: (id: string, reason: string, ceoQueueAuthorized?: boolean) => { ok: boolean }
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
  decideCeoApproval: (id: string, approve: boolean, note?: string) => { ok: false; error: string } | void
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
    Promise<{ ok: boolean; error?: string; password?: string }>

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
  /** A buyer or seller's own account of the platform. Starts `pending` — see
   *  `moderateTestimonial` for the only way it becomes public. */
  submitTestimonial: (quote: string, rating?: number) => { ok: boolean; error?: string }
  /** A Sub/Super Admin's verdict on a submitted testimonial. */
  moderateTestimonial: (id: string, approve: boolean, note?: string) => { ok: boolean; error?: string }

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
