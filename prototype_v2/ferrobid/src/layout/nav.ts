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
  /** Splits a long menu into two levels: this page's category is what the role
   *  sees on the **top bar**, and the pages sharing that category are what fill
   *  the **strip below it** once the category is open.
   *
   *  Roles with a handful of screens read fine as one flat strip. The five
   *  staff desks do not: the Sub Admin alone holds eighteen, which is more tabs
   *  than anyone can scan, and the strip scrolls sideways so the last ones are
   *  simply out of sight. Categorised, the bar names three or four places to go
   *  and each opens a handful — and both levels run left to right in the order
   *  the work happens, so the next thing you need is the next thing along.
   *
   *  Two rules keep the two levels honest, and every categorised role below
   *  follows them:
   *
   *  · A category opens on its first page, so whatever that role reaches for
   *    most inside a category goes first and stays one click from anywhere.
   *  · Only pages that leave the workspace (Browse, the Ops console door) stay
   *    uncategorised on the top bar. A workspace page kept out of every category
   *    would show an empty strip beneath it, which reads as a broken screen.
   *
   *  A categorised page no longer needs `'top'` in `in`: the category holds that
   *  slot on its behalf. Leave `category` unset and nothing changes — the page
   *  keeps its own top-bar link if it had one, and a role with no categories at
   *  all keeps the single flat strip it always had. */
  category?: string
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
  // "Browse as Guest" — the buyer's own menu, shown to somebody who does not
  // hold it yet. The two things a visitor came to do (see what is for sale, and
  // see what is inside a catalogue) are open; every tab that only means
  // something once you have an account is `locked`, which for THIS role means
  // the tab is a subscription prompt rather than a link (see GuestGate).
  //
  // The locked tabs stay on the strip on purpose: hiding them would show a
  // visitor a smaller product than the one they are being asked to pay for.
  guest_buyer: [
    { to: '/buyermarketplace', label: 'Marketplace', subLabel: 'Browse catalogues', end: true, in: ['top', 'sub'], activeMatch: ['/catalogue'] },
    { to: '/buyer', label: 'Dashboard', locked: true, in: ['sub'] },
    { to: '/buyer/shortlist', label: 'EMD & payments', locked: true, in: ['sub'] },
    { to: '/buyer/bids', label: 'My bids', locked: true, in: ['sub'] },
    { to: '/buyer/auction-status', label: 'Auction status', locked: true, in: ['sub'] },
    { to: '/buyer/wallet', label: 'Wallet & ledger', locked: true, in: ['sub'] },
    { to: '/buyer/kyc', label: 'Become a seller', locked: true, in: ['sub'] },
    { to: '/noticeboard', label: 'Noticeboard', in: ['top'] },
    { to: '/help', label: 'How it works', in: ['top'] },
  ],
  buyer: [
    { to: '/buyer', label: 'Home', subLabel: 'Dashboard', end: true, in: ['top', 'sub'] },
    { to: '/buyermarketplace', label: 'Browse & Shortlist', in: ['sub'], activeMatch: ['/catalogue'] },
    { to: '/buyer/shortlist', label: 'EMD & payments', subLabel: 'EMD for shortlisted catalogues', in: ['sub'] },
    { to: '/buyer/bids', label: 'My bids', subLabel: 'Bid results', in: ['sub'] },
    { to: '/buyer/auction-status', label: 'Auction status', in: ['sub'] },
    { to: '/noticeboard', label: 'Noticeboard', in: ['top'] },
    { to: '/buyer/wallet', label: 'Wallet & ledger', in: ['sub'] },
    // Raising a ticket was reachable from the wallet and from nowhere else, so
    // the one route into the support chain depended on knowing it was there.
    { to: '/disputes', label: 'Support', subLabel: 'Support & disputes', in: ['sub'] },
    { to: '/buyer/kyc', label: 'Become a seller', in: ['sub'] },
  ],
  // Seller — submit → track → watch → settle. Verification is deliberately not
  // a menu tab: it is a one-time step, so it lives as a status card on the
  // workspace (`/seller/verification` stays routable and is reached from there)
  // rather than a permanent header entry the seller passes every day.
  seller: [
    { to: '/seller', label: 'Workspace', end: true, in: ['sub'], activeMatch: ['/seller/verification'] },
    { to: '/seller/create-lot', label: 'Create lot', in: ['sub'] },
    { to: '/seller/lots', label: 'My lots', subLabel: 'My lots & batches', in: ['sub'] },
    { to: '/seller/monitor', label: 'Live monitor', in: ['sub'] },
    { to: '/seller/settlement', label: 'Settlement', subLabel: 'Agree price & pay commission', in: ['sub'] },
    { to: '/seller/reports', label: 'Results & reports', in: ['sub'] },
    { to: '/disputes', label: 'Support', subLabel: 'Support & disputes', in: ['sub'] },
  ],
  field_exec: [
    { to: '/field', label: 'Inspection queue', in: ['top'] },
  ],
  // Operation Manager — the order the work happens, in three headings that are
  // themselves in that order: take the goods in, take the sale to market, then
  // deliver it and close the file. Auction schedule and EMD eligibility are the
  // same screens the Auction Manager works; both roles hold them, and whoever
  // acts is named in the audit entry — so they point at one route rather than a
  // second copy.
  exec_manager: [
    /* — Intake: nothing can be sold until a seller is verified, their lot is
         inspected in the yard and the lot is approved. — */
    { to: '/exec', label: 'Pipeline', subLabel: 'Lot pipeline', end: true, in: ['sub'], category: 'Intake & approval' },
    /* Seller verification and Field executives are NOT here, though Part 13 of
       the spec gives Operations both. Both screens are served by /api/sub, and
       the server grants that to the two admin roles only — an Operation Manager
       asking for it gets a 403, so the tabs opened a page that could never
       load. Restoring them is a server change (widen the endpoint, or split the
       two screens onto a payload Ops may read), not a nav entry. */
    { to: '/exec/approvals', label: 'Lot approval', subLabel: 'Lot approval · bypass', in: ['sub'], category: 'Intake & approval' },
    /* — Sale: approved lots become a catalogue, the catalogue gets a date, and
         buyers are admitted to bid on it. — */
    { to: '/exec/catalogue-builder', label: 'Catalogue builder', in: ['sub'], category: 'Catalogue & sale' },
    { to: '/auction/schedule', label: 'Schedule & publish', subLabel: 'Auction schedule & publish', in: ['sub'], category: 'Catalogue & sale' },
    { to: '/auction/emd-eligibility', label: 'EMD eligibility', in: ['sub'], category: 'Catalogue & sale' },
    /* — After the hammer: move the goods, hand them over, then clear whatever
         did not go to plan. — */
    { to: '/exec/logistics', label: 'Logistics', in: ['sub'], category: 'Delivery & closure' },
    { to: '/exec/handover', label: 'Handover', subLabel: 'Handover & closure', in: ['sub'], category: 'Delivery & closure' },
    { to: '/exec/settlement', label: 'Post-auction exceptions', subLabel: 'Post-auction exceptions', in: ['sub'], category: 'Delivery & closure' },
    /* Disputes is out for the same reason as the two above: the screen reads
       /api/sub, which Operations is refused. The old comment here claimed Ops
       "already holds the permission" — it does not, and the tab proved it by
       opening an empty screen. */
    { to: '/browse', label: 'Browse', in: ['top'] },
  ],
  // Auction Manager — a sale has three states and so does this menu: before it
  // opens, while it is running, and after the hammer. The headings are in that
  // order and so are the screens inside each one.
  //
  // The middle heading opens on `Live auctions`, which is deliberate: that is
  // the intervention desk, the one screen this role needs mid-sale from
  // wherever they happen to be, and as the first page of its category it is
  // still a single click from anywhere.
  auction_manager: [
    /* — before it opens: what needs me today, then put the catalogue on the
         market with a date, then decide who is let in to bid on it. — */
    { to: '/auction', label: 'Dashboard', end: true, in: ['sub'], category: 'Setup & scheduling' },
    { to: '/auction/schedule', label: 'Schedule & publish', subLabel: 'Auction schedule & publish', in: ['sub'], category: 'Setup & scheduling' },
    { to: '/auction/emd-eligibility', label: 'EMD eligibility', in: ['sub'], category: 'Setup & scheduling' },
    /* — while it runs: every sale at once, then one room, then the bids inside
         it, then whatever the system cannot tell the bidders by itself. — */
    { to: '/auction/live', label: 'Live auctions', in: ['sub'], category: 'Live floor' },
    { to: '/auction/rooms', label: 'Bidding rooms', in: ['sub'], activeMatch: ['/auction/rooms'], category: 'Live floor' },
    { to: '/auction/bid-monitor', label: 'Bid monitor', in: ['sub'], category: 'Live floor' },
    { to: '/auction/announcements', label: 'Announcements', in: ['sub'], category: 'Live floor' },
    /* — after the hammer: confirm the outcomes so the seller can settle, then
         the record of what happened, then how well the sales are running. — */
    { to: '/auction/results', label: 'Results', in: ['sub'], category: 'Results & records' },
    { to: '/auction/history', label: 'Auction history', in: ['sub'], category: 'Results & records' },
    { to: '/auction/reports', label: 'Auction reports', in: ['sub'], category: 'Results & records' },
    { to: '/browse', label: 'Browse', in: ['top'] },
  ],
  // Finance Administrator — thirteen screens, which is more than a flat strip
  // can show, and they divide the way the money itself divides: what comes in,
  // what goes out, and the books that have to agree with both.
  //
  //   Money in         — every rupee entering the platform, in the order of a sale
  //   Money out        — every rupee leaving it, behind the gate that lets it
  //   Books & records  — the documents, the bank match, and the result
  //
  // Buyers pay sellers directly, so there is no payout screen here: the only
  // money the platform keeps is commission, which is why it closes "Money in"
  // rather than opening "Money out".
  finance_admin: [
    /* — in, in the order one sale collects it: EMD funded before bidding, held
         while it runs, the buyer's payment after the hammer, and the platform's
         commission last. `Dashboard` heads it because "what needs me today" is
         where the desk starts, and it is already laid out in this same order. — */
    { to: '/finance', label: 'Dashboard', subLabel: 'Dashboard · finance desk', end: true, in: ['sub'], category: 'Money in' },
    { to: '/finance/deposits', label: 'Deposits', in: ['sub'], category: 'Money in' },
    { to: '/finance/emd', label: 'EMD ledger', subLabel: 'EMD ledger & forfeiture', in: ['sub'], category: 'Money in' },
    { to: '/finance/payments', label: 'Buyer payments', subLabel: 'Buyer payments & DOs', in: ['sub'], category: 'Money in' },
    { to: '/finance/commission', label: 'Commission', subLabel: 'Commission settlements', in: ['sub'], category: 'Money in' },
    /* — out, and `Bank accounts` opens it rather than sitting with the records
         because it is the prerequisite, not admin: an account has to be verified
         before a single rupee can be paid to it. Then the two ways money leaves
         — returned because something went wrong, or drawn out by its owner. — */
    { to: '/finance/bank-accounts', label: 'Bank accounts', in: ['sub'], category: 'Money out' },
    { to: '/finance/refunds', label: 'Refunds', in: ['sub'], category: 'Money out' },
    { to: '/finance/withdrawals', label: 'Withdrawals', in: ['sub'], category: 'Money out' },
    /* — the record chain, in the order it is built: issue the document, match it
         against the bank, read what it added up to, export it, and the rates it
         was all computed from. — */
    { to: '/finance/invoices', label: 'Invoices & receipts', in: ['sub'], category: 'Books & records' },
    { to: '/finance/reconciliation', label: 'Reconciliation', in: ['sub'], category: 'Books & records' },
    { to: '/finance/pnl', label: 'Profit & loss', in: ['sub'], category: 'Books & records' },
    { to: '/finance/reports', label: 'Financial reports', in: ['sub'], retained: true, category: 'Books & records' },
    // Read-only from here: Finance sees the money side of an EMD exemption but
    // never decides it, and cannot change a rate it has to charge.
    { to: '/admin/finance', label: 'Financial config', locked: true, in: ['sub'], category: 'Books & records' },
    { to: '/browse', label: 'Browse', in: ['top'] },
  ],
  // Sub Admin — head of operations, and the widest menu on the platform: this
  // is the highest role the company itself knows about (see the roles
  // decision in the Content Atlas — Super Admin is our own break-glass
  // account, never issued to the company). Five headings, left to right in
  // the order a day runs:
  //
  //   Ops desk               — where they start, and who they let onto the platform
  //   Auction pipeline       — a lot from arrival to a live sale, in one straight line
  //   CMS                    — the public site's words, and every portal's section switches
  //   Settings & configuration — rates, reference data, tab labels, who is barred
  //   Oversight & records    — what they watch after the hammer, and the record of it
  //
  // Many of these are not copies. Lot pipeline, lot approval, the catalogue
  // builder, the schedule, EMD eligibility and the live floor are the *same*
  // screens the Operation Manager and Auction Manager work; the CMS and
  // Settings screens are the same screens Super Admin's own menu links to —
  // one implementation per screen, not one per role, and whoever acted is
  // named in the audit entry or the change log.
  //
  // Every Sub Admin account gets exactly this menu. There are no per-account
  // permission templates: the work is divided by assignment on the work queue,
  // never by capability.
  sub_admin: [
    /* — their own desk: what landed overnight, what is assigned to them, what
         is waiting on their decision — then the three doors onto the platform
         they alone hold open (sellers, field staff, everybody's accounts). — */
    { to: '/sub', label: 'Ops console', subLabel: 'Dashboard · ops console', end: true, in: ['sub'], category: 'Ops desk' },
    { to: '/sub/queue', label: 'Work queue', in: ['sub'], category: 'Ops desk' },
    { to: '/sub/approvals', label: 'Approvals', subLabel: 'Approvals — all roles', in: ['sub'], category: 'Ops desk' },
    { to: '/sub/seller-verification', label: 'Seller verification', in: ['sub'], category: 'Ops desk' },
    { to: '/sub/field-executives', label: 'Field executives', in: ['sub'], category: 'Ops desk' },
    { to: '/admin/users', label: 'User accounts', subLabel: 'User accounts · password reset', in: ['sub'], category: 'Ops desk' },
    /* — one lot's whole journey, in the Operation Manager's order and then the
         Auction Manager's: it arrives, it is approved, it is catalogued, it is
         given a date, buyers are admitted, and it goes live. — */
    { to: '/exec', label: 'Lot pipeline', in: ['sub'], category: 'Auction pipeline' },
    { to: '/exec/approvals', label: 'Lot approval', subLabel: 'Lot approval · bypass', in: ['sub'], category: 'Auction pipeline' },
    { to: '/exec/catalogue-builder', label: 'Catalogue builder', in: ['sub'], category: 'Auction pipeline' },
    { to: '/auction/schedule', label: 'Schedule & publish', subLabel: 'Auction schedule & publish', in: ['sub'], category: 'Auction pipeline' },
    { to: '/auction/emd-eligibility', label: 'EMD eligibility', in: ['sub'], category: 'Auction pipeline' },
    { to: '/auction/live', label: 'Live auctions', in: ['sub'], category: 'Auction pipeline' },
    /* — watching, not executing: the sale as it runs, the money it moved, what
         went wrong, what the platform told people, and the record of it all. — */
    { to: '/sub/bid-monitor', label: 'Bid monitor', in: ['sub'], category: 'Oversight & records' },
    { to: '/sub/payments', label: 'EMD & payments', subLabel: 'EMD & payment activity', in: ['sub'], category: 'Oversight & records' },
    { to: '/sub/disputes', label: 'Disputes', subLabel: 'Disputes & support', in: ['sub'], category: 'Oversight & records' },
    { to: '/sub/content', label: 'Content', subLabel: 'Content management', in: ['sub'], category: 'Oversight & records' },
    /* — the CMS. A category rather than a tab: eleven pages plus the section
         switches is more than one strip can hold, and it reads left to right in
         the order content is made — the site first, then the pages that support
         it, then what is switched on.

         The Sub Admin's copy is the real one. Nothing in it waits on anybody:
         they write, they publish, they switch. Only pricing and legal copy
         leaves this desk, and it leaves for the CEO. — */
    { to: '/cms', label: 'Overview', end: true, in: ['sub'], category: 'CMS' },
    { to: '/cms/page/home', label: 'Home page', in: ['sub'], category: 'CMS' },
    { to: '/cms/page/pricing', label: 'Pricing', in: ['sub'], category: 'CMS' },
    { to: '/cms/page/about', label: 'About us', in: ['sub'], category: 'CMS' },
    { to: '/cms/page/contact', label: 'Contact us', in: ['sub'], category: 'CMS' },
    { to: '/cms/page/terms', label: 'Terms', subLabel: 'Terms & conditions', in: ['sub'], category: 'CMS' },
    { to: '/cms/page/privacy', label: 'Privacy', subLabel: 'Privacy policy', in: ['sub'], category: 'CMS' },
    { to: '/cms/page/grievance', label: 'Grievance', subLabel: 'Grievance redressal', in: ['sub'], category: 'CMS' },
    { to: '/cms/page/help', label: 'Help centre', in: ['sub'], category: 'CMS' },
    { to: '/cms/page/faqs', label: 'FAQs', subLabel: 'Help & FAQs', in: ['sub'], category: 'CMS' },
    { to: '/cms/page/knowledge', label: 'Knowledge', subLabel: 'Knowledge centre', in: ['sub'], category: 'CMS' },
    { to: '/cms/page/blog', label: 'Blog', in: ['sub'], category: 'CMS' },
    { to: '/cms/sections', label: 'Portal sections', subLabel: 'Section visibility', in: ['sub'], category: 'CMS' },
    /* — settings & configuration. The company's own business config: what a
         rate is, what a category is called, what a tab is called, who is
         barred, and the undo behind the last three. Nothing here waits on
         anybody — see the roles decision in the Content Atlas: this desk is
         the highest role the company knows, so it holds this outright rather
         than reading it locked, the way Finance reads it below. — */
    { to: '/admin/finance', label: 'Financial config', in: ['sub'], category: 'Settings & configuration' },
    { to: '/admin/master-data', label: 'Master data', in: ['sub'], category: 'Settings & configuration' },
    { to: '/admin/pages', label: 'Page manager', in: ['sub'], category: 'Settings & configuration' },
    { to: '/admin/blacklist', label: 'Blacklist', subLabel: 'Blacklist & defaulters', in: ['sub'], category: 'Settings & configuration' },
    { to: '/admin/change-history', label: 'Change history', subLabel: 'Change history & rollback', in: ['sub'], category: 'Settings & configuration' },
    { to: '/sub/reports', label: 'Reports', in: ['sub'], category: 'Oversight & records' },
    { to: '/sub/activity', label: 'My activity', in: ['sub'], retained: true, category: 'Oversight & records' },
  ],
  // CEO / MD — four questions, in order: are we making money, is the business
  // growing, is anything at risk, what needs me. Nine screens is more than a
  // flat strip reads well, so — same two-level menu as the five staff desks
  // below — three categories carry that order left to right:
  //
  //   Performance       — the dashboard that answers all four at a glance,
  //                        then the money and growth screens behind it
  //   Risk & issues      — what could lose money, and what already did
  //   Approvals & reports — the one screen in the workspace with buttons other
  //                        people are waiting on, who covers it while away,
  //                        and the record of it all
  ceo: [
    { to: '/ceo', label: 'Dashboard', end: true, in: ['sub'], category: 'Performance' },
    { to: '/ceo/pnl', label: 'Profit & loss', in: ['sub'], category: 'Performance' },
    { to: '/ceo/growth', label: 'Business growth', subLabel: 'Growth', in: ['sub'], category: 'Performance' },
    { to: '/ceo/auctions', label: 'Auction performance', in: ['sub'], category: 'Performance' },
    { to: '/ceo/risk', label: 'Money at risk', in: ['sub'], category: 'Risk & issues' },
    { to: '/ceo/issues', label: 'What went wrong', subLabel: 'Things that went wrong', in: ['sub'], category: 'Risk & issues' },
    { to: '/ceo/approvals', label: 'Needs my signature', subLabel: 'What needs my signature', in: ['sub'], category: 'Approvals & reports' },
    { to: '/ceo/delegate', label: 'Delegate my approvals', subLabel: 'Delegate approvals', in: ['sub'], category: 'Approvals & reports' },
    { to: '/ceo/reports', label: 'Reports', in: ['sub'], category: 'Approvals & reports' },
  ],
  // Super Admin — our own break-glass role, never issued to the company (see
  // the roles decision in the Content Atlas: for the company, Sub Admin is the
  // highest role that exists). Four headings, in the order of the spec:
  // structure first (a role must exist before anyone can hold it), then the
  // people who hold it, then the settings they work inside, then the
  // exceptions only we can clear and the record that proves it. `Ops console`
  // sits on the top bar because a Super Admin also sees everything a Sub
  // Admin sees, and that is the door into it.
  //
  // Most of what follows is not a wider power — it is the identical screen
  // the Sub Admin's own menu links to, kept here as the recovery mirror the
  // CMS entries below already establish the pattern for. Only Roles, Sub
  // Admin accounts, Emergency override and Audit trail are ground the company
  // never reaches at all.
  super_admin: [
    /* — what exists before anyone can use it — */
    { to: '/admin', label: 'Dashboard', end: true, in: ['sub'], category: 'Structure' },
    { to: '/admin/roles', label: 'Roles', in: ['sub'], category: 'Structure' },
    /* Shared with the Sub Admin's menu — same route, same data. */
    { to: '/admin/pages', label: 'Page manager', in: ['sub'], category: 'Structure' },
    /* — who holds those roles, and who is barred from the platform — */
    { to: '/admin/sub-admins', label: 'Sub Admins', subLabel: 'Sub Admin accounts', in: ['sub'], category: 'People & access' },
    /* Shared with the Sub Admin's menu — same route, same data. */
    { to: '/admin/users', label: 'User accounts', subLabel: 'All user accounts', in: ['sub'], category: 'People & access' },
    { to: '/admin/blacklist', label: 'Blacklist', subLabel: 'Blacklist & defaulters', in: ['sub'], category: 'People & access' },
    /* — the rules and reference data everyone then works inside — */
    { to: '/admin/finance', label: 'Financial config', in: ['sub'], category: 'Settings & content' },
    { to: '/admin/master-data', label: 'Master data', in: ['sub'], category: 'Settings & content' },
    { to: '/admin/content', label: 'Content publishing', in: ['sub'], category: 'Settings & content' },
    /* The same CMS, over the same data. A mirror we hold for recovery, not a
       tier above the Sub Admin's: nothing in the CMS routes here for approval. */
    { to: '/cms', label: 'Overview', end: true, in: ['sub'], category: 'CMS' },
    { to: '/cms/page/home', label: 'Home page', in: ['sub'], category: 'CMS' },
    { to: '/cms/page/pricing', label: 'Pricing', in: ['sub'], category: 'CMS' },
    { to: '/cms/page/about', label: 'About us', in: ['sub'], category: 'CMS' },
    { to: '/cms/page/contact', label: 'Contact us', in: ['sub'], category: 'CMS' },
    { to: '/cms/page/terms', label: 'Terms', subLabel: 'Terms & conditions', in: ['sub'], category: 'CMS' },
    { to: '/cms/page/privacy', label: 'Privacy', subLabel: 'Privacy policy', in: ['sub'], category: 'CMS' },
    { to: '/cms/page/grievance', label: 'Grievance', subLabel: 'Grievance redressal', in: ['sub'], category: 'CMS' },
    { to: '/cms/page/help', label: 'Help centre', in: ['sub'], category: 'CMS' },
    { to: '/cms/page/faqs', label: 'FAQs', subLabel: 'Help & FAQs', in: ['sub'], category: 'CMS' },
    { to: '/cms/page/knowledge', label: 'Knowledge', subLabel: 'Knowledge centre', in: ['sub'], category: 'CMS' },
    { to: '/cms/page/blog', label: 'Blog', in: ['sub'], category: 'CMS' },
    { to: '/cms/sections', label: 'Portal sections', subLabel: 'Section visibility', in: ['sub'], category: 'CMS' },
    /* — what only we can clear, and the record and undo behind it — */
    { to: '/admin/control-tower', label: 'Emergency override', in: ['sub'], category: 'Exceptions & record' },
    /* Shared with the Sub Admin's menu — same route, same data. */
    { to: '/admin/change-history', label: 'Change history', subLabel: 'Change history & rollback', in: ['sub'], category: 'Exceptions & record' },
    { to: '/admin/audit', label: 'Audit trail', in: ['sub'], retained: true, category: 'Exceptions & record' },
    { to: '/sub', label: 'Ops console', in: ['top'] },
  ],
}
