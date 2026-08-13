/* ---------------------------------------------------------------------------
   The menu, for every role — the shipped default.

   This lives in its own module rather than inside Chrome because the store
   seeds its page registry from it, and the Super Admin's Page manager edits
   that registry: rename a tab, hide it for a role, reorder it, attach it
   somewhere else. Chrome and the sub-nav then render the registry, not this
   file, so a change made on that screen is visible immediately and can be
   rolled back from Change history.

   Keeping it out of Chrome.tsx also breaks the import cycle that would
   otherwise exist (Chrome → store → Chrome).
--------------------------------------------------------------------------- */
import type { Role } from '../types'

/** A single source of truth per role: which nav item(s) appear on the top
 *  nav and/or the contextual sub-nav, so the two surfaces can't drift apart. */
export type NavItem = {
  to: string
  label: string
  subLabel?: string
  end?: boolean
  locked?: boolean
  in: ('top' | 'sub')[]
  /** Extra path prefixes (besides `to`) that should also mark this item active —
   *  for routes that conceptually belong to this item but live outside its own
   *  path prefix (e.g. catalogue detail pages reached from a listing tab). */
  activeMatch?: string[]
  /** Pages a role must keep — an audit or record surface the Page manager may
   *  not hide or detach, however the menu is rearranged. */
  retained?: boolean
}

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  guest: [
    { to: '/browse', label: 'Browse auctions', in: ['top'] },
    { to: '/noticeboard', label: 'Noticeboard', in: ['top'] },
    { to: '/help', label: 'How it works', in: ['top'] },
  ],
  // guest1 renders its own standalone app (Guest1App) outside this Chrome
  // shell, so it needs no top/sub nav items here — the map only requires a key.
  guest1: [],
  // Guest 2 (public-site role) — uses the shared chrome like every other role.
  // Lean top nav, no sub-nav (like the guest role); deeper content lives on the
  // home page and the two solution pages.
  guest2: [
    { to: '/g2', label: 'Home', end: true, in: ['top'] },
    { to: '/g2/solutions/buyers', label: 'For buyers', in: ['top'] },
    { to: '/g2/solutions/sellers', label: 'For sellers', in: ['top'] },
    { to: '/g2/how-it-works', label: 'How it works', in: ['top'] },
    { to: '/g2/contact', label: 'Contact', in: ['top'] },
  ],
  buyer: [
    { to: '/buyer', label: 'Home', subLabel: 'Dashboard', end: true, in: ['top', 'sub'] },
    { to: '/buyermarketplace', label: 'Browse & Shortlist', in: ['sub'], activeMatch: ['/catalogue'] },
    { to: '/buyer/emd-shortlisted-catalogue', label: 'EMD & payments', subLabel: 'EMD for shortlisted catalogues', in: ['sub'], activeMatch: ['/buyer/shortlist'] },
    { to: '/buyer/bids', label: 'My bids', subLabel: 'Bid results', in: ['sub'] },
    { to: '/buyer/auction-status', label: 'Auction status', in: ['sub'] },
    { to: '/noticeboard', label: 'Noticeboard', in: ['top'] },
    { to: '/buyer/wallet', label: 'Wallet & ledger', in: ['sub'] },
    { to: '/buyer/kyc', label: 'Become a seller', in: ['sub'] },
  ],
  seller: [
    { to: '/seller', label: 'Workspace', end: true, in: ['sub'] },
    { to: '/seller/create-lot', label: 'Create lot', in: ['sub'] },
    { to: '/seller/lots', label: 'My lots', subLabel: 'My lots & batches', in: ['sub'] },
    { to: '/seller/monitor', label: 'Live monitor', in: ['sub'] },
    { to: '/seller/settlement', label: 'Settlement', subLabel: 'Agree price & pay commission', in: ['sub'] },
    { to: '/seller/reports', label: 'Results & reports', in: ['sub'] },
  ],
  field_exec: [
    { to: '/field', label: 'Inspection queue', in: ['top'] },
  ],
  // Operation Manager — the order the work happens: assemble the catalogue,
  // take the lots in, decide them, then take the sale to market and deliver it.
  // Auction schedule and EMD eligibility are the same screens the Auction
  // Manager works; both roles hold them, and whoever acts is named in the audit
  // entry — so they point at one route rather than a second copy.
  exec_manager: [
    { to: '/exec', label: 'Pipeline', subLabel: 'Lot pipeline', end: true, in: ['top', 'sub'] },
    { to: '/exec/catalogue-builder', label: 'Catalogue builder', in: ['sub'] },
    { to: '/exec/approvals', label: 'Lot approval', subLabel: 'Lot approval · bypass', in: ['sub'] },
    { to: '/auction/schedule', label: 'Schedule & publish', subLabel: 'Auction schedule & publish', in: ['top', 'sub'] },
    { to: '/auction/emd-eligibility', label: 'EMD eligibility', in: ['sub'] },
    { to: '/exec/logistics', label: 'Logistics', in: ['sub'] },
    { to: '/exec/handover', label: 'Handover', subLabel: 'Handover & closure', in: ['sub'] },
    { to: '/exec/settlement', label: 'Post-auction exceptions', subLabel: 'Post-auction exceptions', in: ['sub'] },
    { to: '/browse', label: 'Browse', in: ['top'] },
  ],
  // Auction Manager — ordered the way the work happens: publish, admit, run,
  // watch, close. `Live auctions` also sits on the top bar because it is the
  // one screen this role needs to reach from anywhere, mid-sale.
  auction_manager: [
    { to: '/auction', label: 'Dashboard', end: true, in: ['top', 'sub'] },
    { to: '/auction/schedule', label: 'Schedule & publish', subLabel: 'Auction schedule & publish', in: ['sub'] },
    { to: '/auction/emd-eligibility', label: 'EMD eligibility', in: ['sub'] },
    { to: '/auction/live', label: 'Live auctions', in: ['top', 'sub'] },
    { to: '/auction/rooms', label: 'Bidding rooms', in: ['sub'], activeMatch: ['/auction/rooms'] },
    { to: '/auction/bid-monitor', label: 'Bid monitor', in: ['sub'] },
    { to: '/auction/announcements', label: 'Announcements', in: ['sub'] },
    { to: '/auction/results', label: 'Results', in: ['sub'] },
    { to: '/auction/history', label: 'Auction history', in: ['sub'] },
    { to: '/auction/reports', label: 'Auction reports', in: ['sub'] },
    { to: '/browse', label: 'Browse', in: ['top'] },
  ],
  // Finance Administrator — ordered the way the money moves: in, held, out,
  // then the records that prove it. `Profit & loss` also sits on the top bar
  // because "are we making money" is the question this desk is asked from
  // anywhere, and it is the one screen the CEO reads over their shoulder.
  finance_admin: [
    { to: '/finance', label: 'Dashboard', end: true, in: ['top', 'sub'] },
    { to: '/finance/pnl', label: 'Profit & loss', in: ['top', 'sub'] },
    { to: '/finance/deposits', label: 'Deposits', in: ['sub'] },
    { to: '/finance/payments', label: 'Buyer payments', subLabel: 'Buyer payments & DOs', in: ['sub'] },
    { to: '/finance/commission', label: 'Commission', subLabel: 'Commission settlements', in: ['sub'] },
    { to: '/finance/emd', label: 'EMD ledger', subLabel: 'EMD ledger & forfeiture', in: ['sub'] },
    { to: '/finance/bank-accounts', label: 'Bank accounts', in: ['sub'] },
    { to: '/finance/withdrawals', label: 'Withdrawals', in: ['sub'] },
    { to: '/finance/refunds', label: 'Refunds', in: ['sub'] },
    { to: '/finance/invoices', label: 'Invoices & receipts', in: ['sub'] },
    { to: '/finance/reconciliation', label: 'Reconciliation', in: ['sub'] },
    { to: '/finance/reports', label: 'Financial reports', in: ['sub'], retained: true },
    // Read-only from here: Finance sees the money side of an EMD exemption but
    // never decides it, and cannot change a rate it has to charge.
    { to: '/admin/finance', label: 'Financial config', locked: true, in: ['sub'] },
    { to: '/browse', label: 'Browse', in: ['top'] },
  ],
  // Sub Admin — head of operations. Ordered exactly the way the roles they
  // oversee are ordered: their own desk first, then the pre-auction pipeline in
  // the Operation Manager's order, then the sale in the Auction Manager's
  // order, then what they watch rather than execute, then accounts and admin.
  //
  // Half of these are not copies. Lot pipeline, lot approval, the catalogue
  // builder, the schedule, EMD eligibility and the live floor are the *same*
  // screens the Operation Manager and Auction Manager work — one screen, not a
  // second implementation per role — and whoever acted is named in the audit
  // entry. Same for user accounts, which is the Super Admin's screen.
  //
  // Every Sub Admin account gets exactly this menu. There are no per-account
  // permission templates: the work is divided by assignment on the work queue,
  // never by capability.
  sub_admin: [
    { to: '/sub', label: 'Ops console', subLabel: 'Dashboard · ops console', end: true, in: ['top', 'sub'] },
    { to: '/sub/queue', label: 'Work queue', in: ['top', 'sub'] },
    { to: '/sub/approvals', label: 'Approvals', subLabel: 'Approvals — all roles', in: ['sub'] },
    /* — pre-auction, in the Operation Manager's order — */
    { to: '/sub/seller-verification', label: 'Seller verification', in: ['sub'] },
    { to: '/exec', label: 'Lot pipeline', in: ['sub'] },
    { to: '/sub/field-executives', label: 'Field executives', in: ['sub'] },
    { to: '/exec/approvals', label: 'Lot approval', subLabel: 'Lot approval · bypass', in: ['sub'] },
    { to: '/exec/catalogue-builder', label: 'Catalogue builder', in: ['sub'] },
    /* — the auction, in the Auction Manager's order — */
    { to: '/auction/schedule', label: 'Schedule & publish', subLabel: 'Auction schedule & publish', in: ['sub'] },
    { to: '/auction/emd-eligibility', label: 'EMD eligibility', in: ['sub'] },
    { to: '/auction/live', label: 'Live auctions', in: ['top', 'sub'] },
    { to: '/sub/bid-monitor', label: 'Bid monitor', in: ['sub'] },
    /* — watching, not executing — */
    { to: '/sub/payments', label: 'EMD & payments', subLabel: 'EMD & payment activity', in: ['sub'] },
    { to: '/sub/disputes', label: 'Disputes', subLabel: 'Disputes & support', in: ['sub'] },
    /* — accounts and admin — */
    { to: '/admin/users', label: 'User accounts', subLabel: 'User accounts · password reset', in: ['sub'] },
    { to: '/sub/content', label: 'Content', subLabel: 'Content management', in: ['sub'] },
    { to: '/sub/reports', label: 'Reports', in: ['sub'] },
    { to: '/sub/activity', label: 'My activity', in: ['sub'], retained: true },
  ],
  // CEO / MD — four questions, in order: are we making money, is the business
  // growing, is anything at risk, what needs me. Profit & loss is the landing
  // page; the signature queue also sits on the top bar because it is the one
  // screen in the workspace with buttons and other people are waiting on it.
  ceo: [
    { to: '/ceo', label: 'Profit & loss', end: true, in: ['top', 'sub'] },
    { to: '/ceo/growth', label: 'Business growth', subLabel: 'Growth', in: ['sub'] },
    { to: '/ceo/auctions', label: 'Auction performance', in: ['sub'] },
    { to: '/ceo/risk', label: 'Money at risk', in: ['top', 'sub'] },
    { to: '/ceo/issues', label: 'What went wrong', subLabel: 'Things that went wrong', in: ['sub'] },
    { to: '/ceo/approvals', label: 'Needs my signature', subLabel: 'What needs my signature', in: ['top', 'sub'] },
    { to: '/ceo/delegate', label: 'Delegate my approvals', subLabel: 'Delegate approvals', in: ['sub'] },
    { to: '/ceo/reports', label: 'Reports', in: ['sub'] },
  ],
  // Super Admin — our support role, in the order of the spec: structure first
  // (a role must exist before anyone can hold it), then people, then settings,
  // then the exceptions only we can clear, then the record and the undo.
  // `Ops console` sits on the top bar because a Super Admin also sees
  // everything a Sub Admin sees, and that is the door into it.
  super_admin: [
    { to: '/admin', label: 'Dashboard', end: true, in: ['top', 'sub'] },
    { to: '/admin/roles', label: 'Roles', in: ['sub'] },
    { to: '/admin/pages', label: 'Page manager', in: ['sub'] },
    { to: '/admin/sub-admins', label: 'Sub Admins', subLabel: 'Sub Admin accounts', in: ['sub'] },
    { to: '/admin/users', label: 'User accounts', subLabel: 'All user accounts', in: ['sub'] },
    { to: '/admin/finance', label: 'Financial config', in: ['sub'] },
    { to: '/admin/master-data', label: 'Master data', in: ['sub'] },
    { to: '/admin/content', label: 'Content publishing', in: ['sub'] },
    { to: '/admin/blacklist', label: 'Blacklist', subLabel: 'Blacklist & defaulters', in: ['sub'] },
    { to: '/admin/control-tower', label: 'Emergency override', in: ['top', 'sub'] },
    { to: '/admin/change-history', label: 'Change history', subLabel: 'Change history & rollback', in: ['sub'] },
    { to: '/admin/audit', label: 'Audit trail', in: ['sub'], retained: true },
    { to: '/sub', label: 'Ops console', in: ['top'] },
  ],
}
