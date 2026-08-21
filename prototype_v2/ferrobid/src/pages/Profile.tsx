/* ---------------------------------------------------------------------------
   Profile — one page, nine desks.

   The old profile was a bidder's account with a couple of sections hidden for
   everybody else. It is now built the other way round: every role gets the same
   *object* — a credential — and the credential says something different
   depending on who is holding it.

   Three things change per role and nothing else does:

     · the number.      A buyer trades under a bidder ID, a seller under a
                        seller ID, a staff account under an employee code.
     · the ledger.      Four figures that decide what this desk can do today,
                        each one a doorway to the screen that owns it.
     · the rail.        Account, Security and Preferences are always on it.
                        Between them sit the sections that only make sense for
                        this desk — a buyer's guardrails, a seller's lot
                        defaults, a field executive's kit, an Auction Manager's
                        floor alerts, the CEO's signature thresholds.

   The accent hue is published as a CSS variable on the page root (see
   `profile/kit`), so switching role visibly re-skins the whole page rather than
   just swapping its text.

   Everything editable here is session-local: the real mutation path is
   admin-side `updateUserDetails`, so Save fires a toast rather than writing.
--------------------------------------------------------------------------- */
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlarmClock, BellRing, Building2, ClipboardList, Compass, Crown, FileSignature,
  Gavel, Globe, HardHat, KeyRound, Landmark, ListChecks, LogOut, ScrollText,
  ShieldAlert, ShieldCheck, Store, Users, UserRound,
} from 'lucide-react'
import { Page } from '../layout/Chrome'
import { Button, EmptyState, PageHeader } from '../components/ui'
import { useStore, ROLE_LABEL } from '../store/store'
import { inr, inrCompact, fmtDate } from '../lib/format'
import type { Role, User } from '../types'
import {
  IdentityPlate, LedgerRail, PanelGrid, SectionRail, accentStyle,
  type Metric, type PlateBadge, type TabDef,
} from './profile/kit'
import {
  AccountSection, PreferencesSection, SecuritySection, staffCode, useAccountForm,
  type AccountVariant,
} from './profile/common'
import {
  BuyerBiddingSection, BuyerVerificationSection, SellerSellingSection,
  SellerVerificationSection,
} from './profile/trade'
import {
  AuctionDeskSection, BreakGlassSection, CeoDelegationSection, CeoReportsSection,
  DelegationSection, FieldCoverageSection, FieldKitSection, FinanceControlsSection,
  FinanceDeskSection, FloorAlertsSection, OpsDeskSection, PlatformAuthoritySection,
  ShiftSection, SignatureAuthoritySection, SubAdminDeskSection,
} from './profile/staff'

/* -------------------------------- sections --------------------------------- */

type SectionKey =
  | 'account' | 'security' | 'prefs'
  | 'verify' | 'bidding' | 'selling'
  | 'kit' | 'coverage' | 'desk' | 'cover' | 'floor' | 'controls' | 'shift'
  | 'platform' | 'breakglass' | 'signature' | 'delegate' | 'reports'

const ACCOUNT_TAB: TabDef<SectionKey> = { key: 'account', label: 'Account', icon: <UserRound size={15} /> }
const SECURITY_TAB: TabDef<SectionKey> = { key: 'security', label: 'Security', icon: <KeyRound size={15} /> }
const PREFS_TAB: TabDef<SectionKey> = { key: 'prefs', label: 'Preferences', icon: <Globe size={15} /> }

/** The middle of the section rail, per role. Account is always at the top and
    Security and Preferences are always at the bottom, so the two ends of the
    list never move when you switch desks. */
const MIDDLE_TABS: Record<Role, TabDef<SectionKey>[]> = {
  guest: [], guest1: [], guest_buyer: [],
  buyer: [
    { key: 'verify', label: 'Verification', icon: <ShieldCheck size={15} /> },
    { key: 'bidding', label: 'Bidding', icon: <Gavel size={15} /> },
  ],
  seller: [
    { key: 'verify', label: 'Verification', icon: <ShieldCheck size={15} /> },
    { key: 'selling', label: 'Selling', icon: <Store size={15} /> },
  ],
  field_exec: [
    { key: 'kit', label: 'Field kit', icon: <HardHat size={15} /> },
    { key: 'coverage', label: 'Coverage', icon: <Compass size={15} /> },
  ],
  exec_manager: [
    { key: 'desk', label: 'My desk', icon: <ClipboardList size={15} /> },
    { key: 'cover', label: 'Cover', icon: <Users size={15} /> },
  ],
  auction_manager: [
    { key: 'desk', label: 'Auction desk', icon: <Gavel size={15} /> },
    { key: 'floor', label: 'Floor alerts', icon: <BellRing size={15} /> },
  ],
  finance_admin: [
    { key: 'desk', label: 'Finance desk', icon: <Landmark size={15} /> },
    { key: 'controls', label: 'Controls', icon: <ShieldAlert size={15} /> },
  ],
  sub_admin: [
    { key: 'desk', label: 'Ops desk', icon: <ListChecks size={15} /> },
    { key: 'shift', label: 'Shift', icon: <AlarmClock size={15} /> },
  ],
  super_admin: [
    { key: 'platform', label: 'Platform', icon: <Building2 size={15} /> },
    { key: 'breakglass', label: 'Break-glass', icon: <ShieldAlert size={15} /> },
  ],
  ceo: [
    { key: 'signature', label: 'Signature', icon: <FileSignature size={15} /> },
    { key: 'delegate', label: 'Delegation', icon: <Users size={15} /> },
    { key: 'reports', label: 'Briefings', icon: <ScrollText size={15} /> },
  ],
}

const TRADE_ROLES = new Set<Role>(['buyer', 'seller'])
/** The three desks whose credential is worth stealing. */
const HARDENED_ROLES = new Set<Role>(['finance_admin', 'super_admin', 'ceo'])
const STAFF_ROLES: Role[] = [
  'field_exec', 'exec_manager', 'auction_manager', 'finance_admin',
  'sub_admin', 'super_admin', 'ceo',
]

/* ------------------------------ what the ID is ----------------------------- */

function credential(me: User, role: Role) {
  if (me.bidderId) {
    return {
      label: 'Bidder ID',
      value: me.bidderId,
      note: 'How you appear in every bid room. Sellers are shown this as proof of who won a lot — your name and firm never are.',
    }
  }
  if (me.sellerId) {
    return {
      label: 'Seller ID',
      value: me.sellerId,
      note: 'Shown on every catalogue your material appears in. You see the winning bidder ID in return — never a buyer’s name.',
    }
  }
  return {
    label: 'Employee code',
    value: staffCode(me),
    note: `Every action this account takes is written to the audit trail against this code and the ${ROLE_LABEL[role]} desk — not against a device or a session.`,
  }
}

/* ------------------------------ what it permits ---------------------------- */

type Clearance = { label: string; value: string; note: string; tone: 'success' | 'warning' | 'danger' }

function clearanceFor(me: User, role: Role): Clearance {
  const kycOk = me.kycStatus === 'verified'
  switch (role) {
    case 'buyer':
      return kycOk
        ? { label: 'Clearance', value: 'Cleared to bid', note: 'No per-lot cap. Fund EMD on a catalogue and the bid room opens.', tone: 'success' }
        : { label: 'Clearance', value: 'Limited', note: 'Capped at ₹5,00,000 per lot until KYC clears. Documents are on Verification.', tone: 'warning' }
    case 'seller':
      return me.sellerVerified
        ? { label: 'Clearance', value: 'Cleared to list', note: 'Submit material any time. Each lot still passes inspection and approval before it is catalogued.', tone: 'success' }
        : { label: 'Clearance', value: 'Verification pending', note: 'Lots can be drafted but not catalogued until Operations verifies the firm, bank and yard.', tone: 'warning' }
    case 'field_exec':
      return { label: 'Field status', value: 'Available for visits', note: 'Inspection only — no auction, no pricing, no money. That separation is what makes your report worth bidding against.', tone: 'success' }
    case 'exec_manager':
      return { label: 'Approval authority', value: 'No value cap', note: 'Approve, send back, reject and publish. A live auction and any money movement belong to other desks.', tone: 'success' }
    case 'auction_manager':
      return { label: 'Floor authority', value: 'Publish · pause · extend', note: 'Cancelling an auction and voiding a bid are raised as requests to the Super Admin, never executed here.', tone: 'success' }
    case 'finance_admin':
      return { label: 'Money authority', value: 'Maker–checker', note: 'The only desk that moves money, and the only one that cannot decide what the platform charges.', tone: 'success' }
    case 'sub_admin':
      return { label: 'Oversight', value: 'All eighteen screens', note: 'Every Sub-Admin account is identical. Work is divided by assignment, never by capability.', tone: 'success' }
    case 'super_admin':
      return { label: 'Access level', value: 'Root — support & recovery', note: 'Structure can always be rolled back. An auction, a bid, a payment and an audit entry never can.', tone: 'danger' }
    case 'ceo':
      return { label: 'Signature', value: 'Final', note: 'Above the configured thresholds nothing moves without you, or without a delegate named on the record.', tone: 'success' }
    default:
      return { label: 'Clearance', value: 'Guest', note: 'Sign in to trade.', tone: 'warning' }
  }
}

/* ---------------------------------- badges --------------------------------- */

function badgesFor(me: User, role: Role, variant: AccountVariant): PlateBadge[] {
  const out: PlateBadge[] = [{ label: ROLE_LABEL[role], tone: 'accent' }]
  if (variant === 'trade') {
    out.push(
      me.standing === 'good' ? { label: 'Good standing', tone: 'success' }
        : me.standing === 'watchlist' ? { label: 'Watchlist', tone: 'warning' }
        : { label: 'Defaulter', tone: 'danger' },
    )
    out.push(
      me.kycStatus === 'verified' ? { label: 'KYC verified', tone: 'success' }
        : me.kycStatus === 'pending' ? { label: 'KYC under review', tone: 'warning' }
        : me.kycStatus === 'rejected' ? { label: 'KYC rejected', tone: 'danger' }
        : { label: 'KYC not started', tone: 'neutral' },
    )
  } else {
    const status = me.accountStatus ?? 'active'
    out.push(status === 'active'
      ? { label: 'Account active', tone: 'success' }
      : { label: `Account ${status}`, tone: 'danger' })
    if (HARDENED_ROLES.has(role)) out.push({ label: 'Two-factor enforced', tone: 'neutral' })
  }
  return out
}

/* ------------------------------- the page body ----------------------------- */

function ProfileBody({ me }: { me: User }) {
  const role = useStore((s) => s.role)
  const nav = useNavigate()

  /* Every collection the ledger rail can need, read unconditionally so the
     hook order never depends on which desk is signed in. */
  const wallets = useStore((s) => s.wallets)
  const bids = useStore((s) => s.bids)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const users = useStore((s) => s.users)
  const deliveryOrders = useStore((s) => s.deliveryOrders)
  const inspectionReports = useStore((s) => s.inspectionReports)
  const commissionSettlements = useStore((s) => s.commissionSettlements)
  const depositClaims = useStore((s) => s.depositClaims)
  const withdrawalRequests = useStore((s) => s.withdrawalRequests)
  const refundRequests = useStore((s) => s.refundRequests)
  const disputes = useStore((s) => s.disputes)
  const auditEvents = useStore((s) => s.auditEvents)
  const actionReviews = useStore((s) => s.actionReviews)
  const workClaims = useStore((s) => s.workClaims)
  const roleRegistry = useStore((s) => s.roleRegistry)
  const pageRegistry = useStore((s) => s.pageRegistry)
  const structuralChanges = useStore((s) => s.structuralChanges)
  const ceoApprovals = useStore((s) => s.ceoApprovals)
  const ceoDelegation = useStore((s) => s.ceoDelegation)
  const resultConfirmations = useStore((s) => s.resultConfirmations)

  const variant: AccountVariant = TRADE_ROLES.has(role) ? 'trade' : 'staff'
  const account = useAccountForm(me, variant)

  const tabs = useMemo<TabDef<SectionKey>[]>(
    () => [ACCOUNT_TAB, ...(MIDDLE_TABS[role] ?? []), SECURITY_TAB, PREFS_TAB],
    [role],
  )
  const [wanted, setWanted] = useState<SectionKey>('account')
  /* Switching role mid-session can leave the selected tab behind; fall back to
     Account rather than rendering nothing. */
  const section = tabs.some((t) => t.key === wanted) ? wanted : 'account'

  /* Picking a section from halfway down a long sheet used to drop you into the
     middle of the new one. Move back up to where the sheet starts — but only
     when you are already below it, so choosing a section while reading the
     credential at the top never yanks the page downwards. */
  const sheet = useRef<HTMLDivElement>(null)

  const selectSection = (key: SectionKey) => {
    setWanted(key)
    const el = sheet.current
    if (!el) return
    /* 76px clears the 64px sticky header and leaves a hairline of breathing
       room above the rail. */
    const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - 76)
    if (window.scrollY <= top + 1) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top, behavior: still ? 'instant' : 'smooth' })
  }

  const jumpTo = (id: string) => {
    setWanted('account')
    window.setTimeout(() => {
      const el = document.getElementById(id)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el?.focus({ preventScroll: true })
    }, 80)
  }

  /* ------------------------------ the ledger ------------------------------- */
  const metrics = useMemo<Metric[]>(() => {
    switch (role) {
      case 'buyer': {
        const wallet = wallets.find((w) => w.userId === me.id)
        const myOrders = deliveryOrders.filter((d) => d.buyerId === me.id)
        const myBids = bids.filter((b) => b.bidderId === me.id && b.status === 'valid')
        const purchased = myOrders.reduce((s, d) => s + d.materialValue, 0)
        return [
          { label: 'Wallet available', value: inr(wallet?.balance ?? 0), sub: 'Ready for EMD', to: '/buyer/wallet' },
          { label: 'EMD locked', value: inr(wallet?.emdLocked ?? 0), sub: 'Across live catalogues', to: '/buyer/wallet' },
          { label: 'Lots won', value: String(myOrders.length), sub: `${inrCompact(purchased)} purchased`, to: '/buyer/auction-status' },
          { label: 'Bids placed', value: String(myBids.length), sub: 'Lifetime, valid bids', to: '/buyer/bids' },
        ]
      }
      case 'seller': {
        const myLots = lots.filter((l) => l.sellerId === me.id)
        const live = myLots.filter((l) => l.status === 'live')
        /* Realisation off the lot itself rather than the delivery order: a lot
           is sold the moment it clears, and the DO only exists once the buyer
           has been invoiced. */
        const sold = myLots
          .filter((l) => l.status === 'sold' && l.resultH1Rate)
          .reduce((s, l) => s + (l.resultH1Rate ?? 0) * l.indicativeQty, 0)
        const owing = commissionSettlements
          .filter((c) => c.sellerId === me.id && c.status !== 'confirmed')
          .reduce((s, c) => s + c.amount, 0)
        return [
          { label: 'Lots submitted', value: String(myLots.length), sub: 'Lifetime', to: '/seller/lots' },
          { label: 'Live right now', value: String(live.length), sub: 'On the floor', to: '/seller/monitor', tone: live.length > 0 ? 'success' : 'default' },
          { label: 'Sold value', value: inrCompact(sold), sub: 'Paid to you directly', to: '/seller/reports' },
          { label: 'Commission outstanding', value: inrCompact(owing), sub: 'Owed to ferroBid', to: '/seller/settlement', tone: owing > 0 ? 'warning' : 'default' },
        ]
      }
      case 'field_exec': {
        const mine = inspectionReports.filter((r) => r.inspectorId === me.id)
        const myCatalogues = new Set(catalogues.filter((c) => c.assignedFieldExecId === me.id).map((c) => c.id))
        const queue = lots.filter((l) => myCatalogues.has(l.catalogueId) && l.status === 'pending_inspection')
        const flagged = mine.filter((r) => r.status === 'flagged')
        const photos = mine.reduce((s, r) => s + r.photoCount, 0)
        return [
          { label: 'Waiting on me', value: String(queue.length), sub: 'Lots to inspect', to: '/field', tone: queue.length > 0 ? 'warning' : 'default' },
          { label: 'Reports filed', value: String(mine.length), sub: 'Lifetime', to: '/field' },
          { label: 'Flagged by me', value: String(flagged.length), sub: 'Did not match the declaration' },
          { label: 'Photographs', value: String(photos), sub: 'What buyers bid against' },
        ]
      }
      case 'exec_manager': {
        const awaiting = lots.filter((l) => l.status === 'inspected')
        const sellersPending = users.filter((u) => u.role === 'seller' && !u.sellerVerified)
        const building = catalogues.filter((c) => c.status === 'draft')
        const handovers = deliveryOrders.filter((d) => d.stage !== 'completed')
        return [
          { label: 'Lots to approve', value: String(awaiting.length), sub: 'Inspected, not yet cleared', to: '/exec/approvals', tone: awaiting.length > 0 ? 'warning' : 'default' },
          { label: 'Sellers to verify', value: String(sellersPending.length), sub: 'Before they can submit', to: '/sub/seller-verification' },
          { label: 'Catalogues in build', value: String(building.length), sub: 'Draft, unpublished', to: '/exec/catalogue-builder' },
          { label: 'Handovers open', value: String(handovers.length), sub: 'Not yet closed', to: '/exec/handover' },
        ]
      }
      case 'auction_manager': {
        const live = catalogues.filter((c) => c.status === 'live')
        const onFloor = lots.filter((l) => l.status === 'live')
        const dayAgo = Date.now() - 24 * 60 * 60 * 1000
        const today = bids.filter((b) => Date.parse(b.at) >= dayAgo)
        const confirmed = new Set(resultConfirmations.map((r) => r.catalogueId))
        const toConfirm = catalogues.filter((c) => c.status === 'closed' && !confirmed.has(c.id))
        return [
          { label: 'Live auctions', value: String(live.length), sub: 'Running now', to: '/auction/live', tone: live.length > 0 ? 'success' : 'default' },
          { label: 'Lots on the floor', value: String(onFloor.length), sub: 'Open for bidding', to: '/auction/rooms' },
          { label: 'Bids in 24 hours', value: String(today.length), sub: 'Across every room', to: '/auction/bid-monitor' },
          { label: 'Results to confirm', value: String(toConfirm.length), sub: 'Closed, unconfirmed', to: '/auction/results', tone: toConfirm.length > 0 ? 'warning' : 'default' },
        ]
      }
      case 'finance_admin': {
        const deposits = depositClaims.filter((d) => d.status === 'submitted')
        const payouts = withdrawalRequests.filter((w) => w.status === 'requested' || w.status === 'under_review')
        const refunds = refundRequests.filter((r) => r.status === 'pending' || r.status === 'awaiting_ceo')
        const emdHeld = wallets.reduce((s, w) => s + w.emdLocked, 0)
        return [
          { label: 'Deposits to verify', value: String(deposits.length), sub: 'Against the bank statement', to: '/finance/deposits', tone: deposits.length > 0 ? 'warning' : 'default' },
          { label: 'Withdrawals queued', value: String(payouts.length), sub: 'Awaiting release', to: '/finance/withdrawals' },
          { label: 'Refunds open', value: String(refunds.length), sub: 'Raised or awaiting signature', to: '/finance/refunds' },
          { label: 'EMD held', value: inrCompact(emdHeld), sub: 'Buyers’ money, not ours', to: '/finance/emd' },
        ]
      }
      case 'sub_admin': {
        const reviewed = new Set(actionReviews.map((r) => r.eventId))
        const unreviewed = auditEvents.filter((e) => !reviewed.has(e.id))
        const mine = actionReviews.filter((r) => r.byId === me.id)
        const claimed = Object.values(workClaims).filter((c) => c.byId === me.id)
        const myDisputes = disputes.filter((d) => d.assignedToId === me.id && d.status !== 'resolved')
        return [
          { label: 'Unreviewed actions', value: String(unreviewed.length), sub: 'Across every desk', to: '/sub/approvals', tone: unreviewed.length > 0 ? 'warning' : 'default' },
          { label: 'Verdicts by me', value: String(mine.length), sub: 'On the record', to: '/sub/activity' },
          { label: 'Claimed by me', value: String(claimed.length), sub: 'Work I picked up', to: '/sub/queue' },
          { label: 'Disputes on me', value: String(myDisputes.length), sub: 'Still open', to: '/sub/disputes', tone: myDisputes.length > 0 ? 'warning' : 'default' },
        ]
      }
      case 'super_admin': {
        const staff = users.filter((u) => STAFF_ROLES.includes(u.role))
        return [
          { label: 'Roles defined', value: String(roleRegistry.length), sub: 'Including removed ones', to: '/admin/roles' },
          { label: 'Pages in the menu', value: String(pageRegistry.length), sub: 'Across every role', to: '/admin/pages' },
          { label: 'Staff accounts', value: String(staff.length), sub: 'Never deleted, only closed', to: '/admin/users' },
          { label: 'Structural changes', value: String(structuralChanges.length), sub: 'Every one undoable', to: '/admin/change-history' },
        ]
      }
      case 'ceo': {
        const pending = ceoApprovals.filter((a) => a.status === 'pending' || a.status === 'info_requested')
        const value = pending.reduce((s, a) => s + a.amount, 0)
        const signed = ceoApprovals.filter((a) => a.status === 'approved' || a.status === 'refused')
        return [
          { label: 'Needs my signature', value: String(pending.length), sub: 'People are waiting', to: '/ceo/approvals', tone: pending.length > 0 ? 'warning' : 'default' },
          { label: 'Value held up', value: inrCompact(value), sub: 'Blocked until signed', to: '/ceo/approvals' },
          { label: 'Decided', value: String(signed.length), sub: 'Signed or refused', to: '/ceo/approvals' },
          { label: 'Delegation', value: ceoDelegation ? 'Active' : 'None', sub: ceoDelegation ? `Until ${fmtDate(ceoDelegation.until)}` : 'Everything waits for me', to: '/ceo/delegate' },
        ]
      }
      default:
        return []
    }
  }, [
    role, me.id, wallets, bids, lots, catalogues, users, deliveryOrders,
    inspectionReports, commissionSettlements, depositClaims, withdrawalRequests,
    refundRequests, disputes, auditEvents, actionReviews, workClaims,
    roleRegistry, pageRegistry, structuralChanges, ceoApprovals, ceoDelegation,
    resultConfirmations,
  ])

  /* ----------------------------- the middle -------------------------------- */
  const middle = (): ReactNode => {
    switch (section) {
      case 'verify':
        return role === 'buyer' ? <BuyerVerificationSection me={me} /> : <SellerVerificationSection me={me} />
      case 'bidding': return <BuyerBiddingSection city={account.form.city} />
      case 'selling': return <SellerSellingSection />
      case 'kit': return <FieldKitSection />
      case 'coverage': return <FieldCoverageSection baseCity={account.form.baseLocation || me.city} />
      case 'desk':
        return role === 'exec_manager' ? <OpsDeskSection />
          : role === 'auction_manager' ? <AuctionDeskSection />
          : role === 'finance_admin' ? <FinanceDeskSection />
          : <SubAdminDeskSection />
      case 'cover':
        return <DelegationSection roleLabel="Operations"
          candidates={['Sub-Admin on shift', 'Auction Manager', 'Another Operation Manager']} />
      case 'floor': return <FloorAlertsSection />
      case 'controls': return <FinanceControlsSection />
      case 'shift': return <ShiftSection />
      case 'platform': return <PlatformAuthoritySection />
      case 'breakglass': return <BreakGlassSection />
      case 'signature': return <SignatureAuthoritySection />
      case 'delegate': return <CeoDelegationSection />
      case 'reports': return <CeoReportsSection />
      default: return null
    }
  }

  const body = (): ReactNode => {
    if (section === 'account') {
      return (
        <AccountSection me={me} variant={variant} form={account.form} setF={account.setF}
          dirty={account.dirty} reset={account.reset} />
      )
    }
    if (section === 'security') {
      return <SecuritySection me={me} hardened={HARDENED_ROLES.has(role)} canDeactivate={variant === 'trade'} />
    }
    if (section === 'prefs') {
      return (
        <PreferencesSection variant={variant}
          notificationSummary={variant === 'trade'
            ? 'Outbid alerts, closing reminders, EMD movement and result announcements.'
            : 'Work assigned to you, escalations, signature requests and anything addressed to you by name.'}
          supportLinks={variant === 'staff' ? [
            { icon: <ScrollText size={15} />, label: 'Platform terms & policies', desc: 'The rules every desk works inside.', to: '/legal' },
            { icon: <Crown size={15} />, label: 'Help centre', desc: 'How the pipeline, the floor and the money flow fit together.', to: '/help' },
          ] : undefined} />
      )
    }
    return middle()
  }

  const cred = credential(me, role)
  const clearance = clearanceFor(me, role)

  return (
    <div style={accentStyle(role)}>
      <IdentityPlate
        name={me.name}
        hue={me.avatarHue}
        headline={me.name}
        sub={variant === 'trade' ? `${me.firm} · ${me.city}` : `${account.form.department} · ${account.form.baseLocation || me.city}`}
        meta={`Member since ${fmtDate(me.joinedAt)}`}
        badges={badgesFor(me, role, variant)}
        idLabel={cred.label}
        idValue={cred.value}
        idNote={cred.note}
        done={account.done}
        total={account.fields.length}
        gaps={account.gaps}
        onJumpToGap={jumpTo}
        clearance={clearance}
      />

      {metrics.length > 0 && <LedgerRail metrics={metrics} />}

      {/* The sections stack down the left and the sheet sits beside them, so the
          whole profile is one map rather than a strip you have to remember. */}
      <div ref={sheet} className="mt-6 grid lg:grid-cols-[212px_minmax(0,1fr)] gap-4 lg:gap-6 items-start scroll-mt-20">
        <SectionRail tabs={tabs} value={section} onChange={selectSection} />
        <PanelGrid sectionKey={section}>{body()}</PanelGrid>
      </div>

      {/* Every desk gets one door back to the work the profile describes. */}
      <div className="mt-6 flex justify-center">
        <Button variant="ghost" size="sm" onClick={() => nav(-1)}>Back to where I was</Button>
      </div>
    </div>
  )
}

/* ----------------------------------- page ---------------------------------- */

export default function Profile() {
  const me = useStore((s) => s.currentUser)
  const role = useStore((s) => s.role)
  const logout = useStore((s) => s.logout)
  const nav = useNavigate()

  return (
    <Page>
      <PageHeader
        title="Profile & settings"
        sub={me ? `Your ${ROLE_LABEL[role]} credential — what it says about you, and what it lets you do.` : undefined}
        actions={me && (
          // Same destination as the header's Sign out — see Chrome.tsx.
          <Button variant="ghost" onClick={() => { logout(); nav('/home/auth') }}>
            <LogOut size={15} /> Sign out
          </Button>
        )}
      />
      {me ? (
        <ProfileBody key={me.id} me={me} />
      ) : (
        <EmptyState
          title="You are not signed in"
          body="Sign in with your registered phone number to view and edit your profile."
          action={<Link to="/login"><Button>Sign in</Button></Link>}
        />
      )}
    </Page>
  )
}
