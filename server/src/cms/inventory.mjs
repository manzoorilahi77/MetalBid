/* ---------------------------------------------------------------------------
   The section inventory — the Content Atlas, as data.

   Every section named in the atlas, on every page of every portal, with the
   source class it was assigned and whether it can be switched off. This is what
   `section_registry` is seeded from, and it is the reason a toggle has anything
   to toggle.

   Two conventions the whole file follows:

   * `role: '*'` means every role that can see the page. A role key narrows the
     switch to that portal — the same route can carry a different answer for a
     buyer and for staff.

   * A section that is NOT toggleable must carry `lockedReason`. The API refuses
     to register one without it, because a missing switch with no explanation
     reads as a bug rather than as a decision. The reasons here are the atlas's
     own: statutory copy, consequence warnings, bank destinations, retained
     records, and system health.

   Sections whose source is `portal` stay visible by default: switching one off
   hides work somebody else did and is waiting on. The two exceptions are marked
   toggleable in the atlas and are marked toggleable here — the announcements
   strip and the auction calendar, which are digests rather than the record.
--------------------------------------------------------------------------- */

/* Reused reasons, so the same rule is worded the same way everywhere it binds. */
const R = {
  statutory: 'it is a statutory disclosure',
  legal: 'it carries legal weight and must always be shown',
  warning: 'it warns about a consequence that cannot be undone',
  bank: 'payment destinations are never optional and never CMS-editable',
  record: 'it is a retained record',
  health: 'a user must be told when something they expected is missing',
  identity: 'the page cannot render without it',
  product: 'it is the screen itself, not a section of it',
}

/** section(route, key, title, source, opts) */
const s = (route, key, title, source, opts = {}) => ({
  route, key, title, source,
  role: opts.role ?? '*',
  description: opts.description ?? null,
  enabled: opts.enabled !== false,
  toggleable: opts.locked ? false : opts.toggleable !== false,
  /* `locked: 'reason'` is the short form and covers almost every case; the long
     form exists for the few where the reason reads better on its own line. */
  lockedReason: opts.locked ?? opts.lockedReason ?? null,
  reviewRequired: !!opts.review,
  sortOrder: opts.order ?? 0,
})

/* ========================== the public marketplace ======================== */

const HOME = [
  s('/', 'offline_banner', 'Server-offline banner', 'live', { order: 5, locked: R.health }),
  s('/', 'hero', 'Hero', 'cms', { order: 10, locked: R.identity,
    description: 'Headline, sub-copy, both CTAs and the search placeholder' }),
  s('/', 'hero_thumbs', 'Hero lot thumbnails', 'portal', { order: 15,
    description: 'First four lots of any live catalogue' }),
  s('/', 'ticker', 'Live ticker strip', 'live', { order: 20,
    description: 'Catalogues live now, and the next one to close' }),
  s('/', 'live_auctions', 'Live auctions', 'portal', { order: 30, locked: R.identity,
    description: 'Published catalogues that are live or closing' }),
  s('/', 'upcoming_auctions', 'Forthcoming auctions', 'portal', { order: 40,
    description: 'Catalogues past the publish gate, not yet open' }),
  s('/', 'announcements', 'Announcements', 'portal', { order: 50,
    description: 'Platform notices from the auction desk and the ops desk' }),
  s('/', 'todays_coverage', 'Today’s coverage', 'api', { order: 60, enabled: false,
    description: 'External metals-price feed — off until the provider is connected' }),
  s('/', 'testimonials', 'Testimonials', 'portal', { order: 70,
    description: 'Submitted by verified buyers and sellers, moderated before publish' }),
  s('/', 'categories', 'Browse by category', 'cms', { order: 80,
    description: 'Tiles over the master-data category list' }),
  s('/', 'how_it_works', 'How it works', 'cms', { order: 90,
    description: 'Three tracks — buyer, seller, and our field team' }),
  s('/', 'trust_band', 'Trust band', 'live', { order: 100,
    description: 'Platform totals with CMS captions' }),
  s('/', 'trust_footer', 'Trust band footer line', 'cms', { order: 110 }),
  s('/', 'footer', 'Footer', 'cms', { order: 200, locked: R.statutory,
    description: 'Link columns, app badges, contact and social' }),
  s('/', 'seo', 'SEO metadata', 'cms', { order: 900, toggleable: false,
    lockedReason: 'every public page needs a title and description' }),
]

const LEGAL_PAGES = [
  /* Privacy */
  s('/legal/privacy', 'header', 'Title, effective date, version', 'cms', { order: 10, locked: R.statutory, review: true }),
  s('/legal/privacy', 'clauses', 'Clause list', 'cms', { order: 20, locked: R.statutory, review: true }),
  s('/legal/privacy', 'grievance_officer', 'Data-protection & grievance officer', 'cms', { order: 30, locked: R.statutory }),
  s('/legal/privacy', 'archive', 'Superseded versions', 'cms', { order: 40 }),

  /* Terms */
  s('/legal/terms', 'clauses', 'Platform Terms of Use', 'cms', { order: 10, locked: R.legal, review: true }),
  s('/legal/terms', 'auction_terms_template', 'Default auction-terms template', 'cms', { order: 20, locked: R.legal }),
  s('/legal/terms', 'catalogue_terms', 'Per-catalogue terms, as sold', 'portal', { order: 30, locked: R.legal }),
  s('/legal/terms', 'acceptance_notice', 'Acceptance log notice', 'cms', { order: 40 }),

  /* Pricing */
  s('/pricing', 'intro', 'Intro and plan copy', 'cms', { order: 10, locked: R.identity, review: true }),
  s('/pricing', 'rates', 'Commission, EMD, tax rates', 'portal', { order: 20, locked: R.legal,
    description: 'Bound to financial config — never typed into the page' }),
  s('/pricing', 'comparison', 'Comparison table', 'cms', { order: 30 }),
  s('/pricing', 'faq', 'Pricing FAQ', 'cms', { order: 40 }),

  /* About */
  s('/about', 'story', 'Story, mission, hero image', 'cms', { order: 10, locked: R.identity }),
  s('/about', 'leadership', 'Leadership', 'cms', { order: 20 }),
  s('/about', 'milestones', 'Milestones & platform numbers', 'live', { order: 30 }),
  s('/about', 'entity', 'Registered entity, CIN, GSTIN, addresses', 'cms', { order: 40, locked: R.statutory }),

  /* Contact */
  s('/contact', 'offices', 'Offices, phone, email, hours', 'cms', { order: 10, locked: R.identity }),
  s('/contact', 'form', 'Enquiry form', 'own', { order: 20 }),
  s('/contact', 'routing', 'Department routing', 'cms', { order: 30 }),

  /* Blog */
  s('/blog', 'posts', 'Posts', 'cms', { order: 10, locked: R.identity }),
  s('/blog', 'featured', 'Featured posts', 'cms', { order: 20 }),
  s('/blog', 'categories', 'Categories & tags', 'cms', { order: 30 }),
  s('/blog', 'related', 'Related posts, share row, newsletter', 'cms', { order: 40 }),

  /* Knowledge centre */
  s('/knowledge', 'tree', 'Article tree', 'cms', { order: 10, locked: R.identity }),
  s('/knowledge', 'articles', 'Article bodies', 'cms', { order: 20, locked: R.identity }),
  s('/knowledge', 'reference', 'Metal & grade reference tables', 'cms', { order: 30 }),
  s('/knowledge', 'search', 'Search', 'own', { order: 40 }),

  /* Help centre */
  s('/help', 'tracks', 'Role tracks', 'cms', { order: 10, locked: R.identity }),
  s('/help', 'getting_started', 'Getting-started tiles', 'cms', { order: 20 }),
  s('/help', 'support_band', 'Support band', 'cms', { order: 30, locked: 'a help page must always offer a way to reach a person' }),
  s('/help', 'notices', 'Service notices', 'portal', { order: 40 }),

  /* FAQs */
  s('/help/faqs', 'entries', 'FAQ entries', 'cms', { order: 10, locked: R.identity }),
  s('/help/faqs', 'audience', 'Audience filter', 'cms', { order: 20 }),
  s('/help/faqs', 'feedback', '“Was this helpful”', 'cms', { order: 30 }),

  /* Grievance */
  s('/grievance', 'ladder', 'Escalation ladder', 'cms', { order: 10, locked: R.statutory, review: true }),
  s('/grievance', 'officer', 'Nodal / grievance officer', 'cms', { order: 20, locked: R.statutory }),
  s('/grievance', 'form', 'Raise a grievance', 'own', { order: 30, locked: R.statutory }),
  s('/grievance', 'statistics', 'Redressal statistics', 'live', { order: 40, enabled: false }),
]

const SHARED = [
  s('/browse', 'results', 'Catalogue results', 'portal', { order: 10, locked: R.product }),
  s('/browse', 'filters', 'Filter bar', 'own', { order: 20, locked: R.product }),
  s('/browse', 'promo', 'Promotional banner', 'cms', { order: 5, enabled: false }),
  s('/browse', 'empty_state', 'Empty-state copy', 'cms', { order: 30, locked: 'a list with no results must say so' }),
  s('/browse', 'onboarding', '“New to ferroBid?” strip', 'cms', { order: 40 }),

  s('/catalogue', 'header', 'Catalogue header', 'portal', { order: 10, locked: R.product }),
  s('/catalogue', 'lots', 'Lot list', 'portal', { order: 20, locked: 'the inspection record is the product' }),
  s('/catalogue', 'terms', 'Auction terms for this catalogue', 'portal', { order: 30, locked: R.legal }),
  s('/catalogue', 'disclaimers', 'Standing disclaimers', 'cms', { order: 40, locked: R.legal }),
  s('/catalogue', 'inspection_help', 'Inspection-booking helper', 'cms', { order: 50 }),
  s('/catalogue', 'emd', 'EMD requirement & eligibility', 'live', { order: 60, locked: R.legal }),

  s('/noticeboard', 'platform', 'Platform announcements', 'portal', { order: 10, locked: R.product }),
  s('/noticeboard', 'catalogue', 'Catalogue announcements', 'portal', { order: 20, locked: R.product }),
  s('/noticeboard', 'intro', 'Page intro & empty state', 'cms', { order: 5 }),

  s('/bidding', 'ladder', 'Ladder, H1, countdown', 'live', { order: 10, locked: R.product }),
  s('/bidding', 'operator_notes', 'Operator announcements', 'portal', { order: 20, locked: 'bidders must see what the operator says mid-sale' }),
  s('/bidding', 'rules', 'Bidding rules panel', 'cms', { order: 30, locked: R.legal }),
  s('/bidding', 'entry', 'Bid entry', 'own', { order: 40, locked: R.product }),

  s('/disputes', 'raise', 'Raise a ticket & my tickets', 'own', { order: 10, locked: R.product }),
  s('/disputes', 'categories', 'Categories & the stated SLA', 'cms', { order: 20, locked: R.legal }),
  s('/disputes', 'replies', 'Replies from the desk', 'portal', { order: 30, locked: R.product }),
  s('/disputes', 'self_service', 'Self-service FAQ block', 'cms', { order: 5 }),

  s('/login', 'form', 'Sign-in form', 'own', { order: 10, locked: R.product }),
  s('/login', 'side_panel', 'Side panel — value props', 'cms', { order: 20 }),
  s('/login', 'consent', 'Consent & terms copy', 'cms', { order: 30, locked: R.legal }),

  s('/settings/notifications', 'channels', 'Channel descriptions', 'cms', { order: 10 }),
  s('/settings/notifications', 'switches', 'Preference switches', 'own', { order: 20, locked: R.product }),
]

/* ================================= buyer ================================== */

const BUYER = [
  s('/buyer', 'stats', 'Stat row', 'live', { role: 'buyer', order: 10, locked: R.product }),
  s('/buyer', 'attention', 'Needs your attention', 'live', { role: 'buyer', order: 20, locked: 'a buyer must be told what is about to cost them' }),
  s('/buyer', 'welcome_banner', 'Welcome / announcement banner', 'cms', { role: 'buyer', order: 5, enabled: false }),
  s('/buyer', 'calendar', 'Auction calendar', 'portal', { role: 'buyer', order: 30 }),
  s('/buyer', 'notifications', 'Recent notifications', 'portal', { role: 'buyer', order: 40, locked: R.product }),
  s('/buyer', 'bidding_help', '“How bidding works” helper', 'cms', { role: 'buyer', order: 50 }),
  s('/buyer', 'market_coverage', 'Market coverage widget', 'api', { role: 'buyer', order: 60, enabled: false }),
  s('/buyer', 'support_strip', 'Support strip', 'cms', { role: 'buyer', order: 70 }),

  s('/buyermarketplace', 'grid', 'Catalogue grid', 'portal', { role: 'buyer', order: 10, locked: R.product }),
  s('/buyermarketplace', 'controls', 'Search, filters, shortlist', 'own', { role: 'buyer', order: 20, locked: R.product }),
  s('/buyermarketplace', 'featured', 'Featured catalogue slot', 'cms', { role: 'buyer', order: 5, enabled: false }),
  s('/buyermarketplace', 'guidance', 'Category guidance tiles', 'cms', { role: 'buyer', order: 30, enabled: false }),
  s('/buyermarketplace', 'empty_state', 'Empty state', 'cms', { role: 'buyer', order: 40, locked: 'a list with no results must say so' }),

  s('/buyer/emd-shortlisted-catalogue', 'shortlist', 'Shortlisted lots & EMD', 'live', { role: 'buyer', order: 10, locked: R.product }),
  s('/buyer/emd-shortlisted-catalogue', 'key_facts', 'Key-facts strip', 'portal', { role: 'buyer', order: 20, locked: R.product }),
  s('/buyer/emd-shortlisted-catalogue', 'exemption', 'EMD exemption status', 'portal', { role: 'buyer', order: 30, locked: R.product }),
  s('/buyer/emd-shortlisted-catalogue', 'confirm_copy', 'EMD confirmation & irrevocability warning', 'cms', { role: 'buyer', order: 40, locked: R.warning }),
  s('/buyer/emd-shortlisted-catalogue', 'emd_explainer', '“What EMD is” explainer', 'cms', { role: 'buyer', order: 50 }),

  s('/buyer/bid-now', 'live_lots', 'Live catalogues & ladder', 'live', { role: 'buyer', order: 10, locked: R.product }),
  s('/buyer/bid-now', 'entry', 'Bid entry & confirmation', 'own', { role: 'buyer', order: 20, locked: R.product }),
  s('/buyer/bid-now', 'warning', 'Pre-bid warning', 'cms', { role: 'buyer', order: 30, locked: R.warning }),
  s('/buyer/bid-now', 'empty_state', 'Empty state', 'cms', { role: 'buyer', order: 40 }),

  s('/buyer/bids', 'history', 'Active, won and history', 'live', { role: 'buyer', order: 10, locked: R.record }),
  s('/buyer/bids', 'result', 'Result confirmation', 'portal', { role: 'buyer', order: 20, locked: R.product }),
  s('/buyer/bids', 'post_win_help', '“What happens after you win”', 'cms', { role: 'buyer', order: 30 }),

  s('/buyer/auction-status', 'tracker', 'Stage tracker', 'live', { role: 'buyer', order: 10, locked: R.product }),
  s('/buyer/auction-status', 'delivery_order', 'Delivery order & gate pass', 'portal', { role: 'buyer', order: 20, locked: R.product }),
  s('/buyer/auction-status', 'lifting', 'Lifting window & yard instructions', 'portal', { role: 'buyer', order: 30, locked: R.product }),
  s('/buyer/auction-status', 'stage_labels', 'Stage names & explanations', 'cms', { role: 'buyer', order: 40, locked: 'the tracker needs its labels' }),
  s('/buyer/auction-status', 'tax_legend', 'Value-breakdown legend', 'cms', { role: 'buyer', order: 50 }),

  s('/buyer/wallet', 'company_banks', 'Company bank accounts', 'portal', { role: 'buyer', order: 10, locked: R.bank }),
  s('/buyer/wallet', 'forms', 'Deposit, withdrawal, bank, refund forms', 'own', { role: 'buyer', order: 20, locked: R.product }),
  s('/buyer/wallet', 'ledger', 'Balances, claims and activity', 'live', { role: 'buyer', order: 30, locked: R.record }),
  s('/buyer/wallet', 'outcomes', 'Verification outcomes', 'portal', { role: 'buyer', order: 40, locked: R.product }),
  s('/buyer/wallet', 'deposit_help', 'Deposit instructions & turnaround', 'cms', { role: 'buyer', order: 50 }),
  s('/buyer/wallet', 'refund_policy', 'Refund & withdrawal policy', 'cms', { role: 'buyer', order: 60 }),

  s('/buyer/kyc', 'value_props', 'Why sell with us', 'cms', { role: 'buyer', order: 10 }),
  s('/buyer/kyc', 'wizard', 'KYC wizard', 'own', { role: 'buyer', order: 20, locked: R.product }),
  s('/buyer/kyc', 'documents', 'Required-document list', 'cms', { role: 'buyer', order: 30, locked: 'an applicant must know what to bring' }),
  s('/buyer/kyc', 'status', 'Application status', 'portal', { role: 'buyer', order: 40, locked: R.product }),
  s('/buyer/kyc', 'commission_help', 'Commission & settlement explainer', 'cms', { role: 'buyer', order: 50 }),
]

/* ================================ seller ================================== */

const SELLER = [
  s('/seller', 'verification', 'Verification status', 'portal', { role: 'seller', order: 10, locked: 'it is the gate before everything else' }),
  s('/seller', 'catalogues', 'My catalogues', 'portal', { role: 'seller', order: 20, locked: R.product }),
  s('/seller', 'pipeline', 'Pipeline snapshot', 'live', { role: 'seller', order: 30 }),
  s('/seller', 'bid_activity', 'Recent bid activity', 'live', { role: 'seller', order: 40 }),
  s('/seller', 'onboarding', 'Onboarding checklist', 'cms', { role: 'seller', order: 5 }),
  s('/seller', 'commission_help', 'Commission & fee explainer', 'cms', { role: 'seller', order: 50 }),
  s('/seller', 'announcements', 'Announcements strip', 'portal', { role: 'seller', order: 60 }),

  s('/seller/create-lot', 'form', 'Lot form & photo upload', 'own', { role: 'seller', order: 10, locked: R.product }),
  s('/seller/create-lot', 'master_data', 'Category, grade, UOM, yard', 'portal', { role: 'seller', order: 20, locked: 'lots are filed against these keys' }),
  s('/seller/create-lot', 'guidelines', 'Submission guidelines & photo brief', 'cms', { role: 'seller', order: 30 }),
  s('/seller/create-lot', 'field_help', 'Field help & validation messages', 'cms', { role: 'seller', order: 40, locked: 'a form must explain its own fields' }),
  s('/seller/create-lot', 'declaration', 'Declaration on submit', 'cms', { role: 'seller', order: 50, locked: R.legal }),

  s('/seller/lots', 'list', 'Lot list', 'live', { role: 'seller', order: 10, locked: R.product }),
  s('/seller/lots', 'inspection', 'Inspection report & measured quantity', 'portal', { role: 'seller', order: 20, locked: 'the seller must see what was measured' }),
  s('/seller/lots', 'outcome', 'Approval / rejection outcome', 'portal', { role: 'seller', order: 30, locked: R.product }),
  s('/seller/lots', 'overrides', 'What we changed on your lot', 'portal', { role: 'seller', order: 40, locked: 'every override is shown back to the seller' }),
  s('/seller/lots', 'state_labels', 'State names & explanations', 'cms', { role: 'seller', order: 50 }),

  s('/seller/monitor', 'ladder', 'Live ladder', 'live', { role: 'seller', order: 10, locked: R.product }),
  s('/seller/monitor', 'operator_notes', 'Operator announcements', 'portal', { role: 'seller', order: 20 }),
  s('/seller/monitor', 'empty_state', 'Empty state', 'cms', { role: 'seller', order: 30 }),

  s('/seller/settlement', 'awaiting', 'Auctions awaiting your decision', 'portal', { role: 'seller', order: 10, locked: R.product }),
  s('/seller/settlement', 'decision', 'Accept / reject the buyer’s price', 'own', { role: 'seller', order: 20, locked: R.product }),
  s('/seller/settlement', 'commission', 'Commission due & where to pay', 'portal', { role: 'seller', order: 30, locked: R.bank }),
  s('/seller/settlement', 'payment', 'Pay by transfer / cut from EMD', 'own', { role: 'seller', order: 40, locked: R.product }),
  s('/seller/settlement', 'warnings', 'Confirmation warnings', 'cms', { role: 'seller', order: 50, locked: R.warning }),
  s('/seller/settlement', 'explainer', '“How settlement works”', 'cms', { role: 'seller', order: 60 }),

  s('/seller/reports', 'realised', 'Realised value & sell-through', 'live', { role: 'seller', order: 10, locked: R.record }),
  s('/seller/reports', 'commentary', 'Benchmark commentary', 'cms', { role: 'seller', order: 20, enabled: false }),
  s('/seller/reports', 'export_footer', 'Export footer & disclaimer', 'cms', { role: 'seller', order: 30 }),
]

/* ============================ field executive ============================= */

const FIELD = [
  s('/field', 'queue', 'Assigned catalogues & lots', 'portal', { role: 'field_exec', order: 10, locked: 'assignment happens on the ops desk, never here' }),
  s('/field', 'history', 'Inspection history', 'live', { role: 'field_exec', order: 20, locked: R.record }),
  s('/field', 'sop', 'SOP / field brief', 'cms', { role: 'field_exec', order: 5 }),
  s('/field', 'notices', 'Notices to field staff', 'portal', { role: 'field_exec', order: 30 }),
  s('/field', 'empty_state', 'Empty state', 'cms', { role: 'field_exec', order: 40 }),

  s('/field/inspect', 'checklist', 'Inspection checklist', 'cms', { role: 'field_exec', order: 10, locked: 'the checklist is the job' }),
  s('/field/inspect', 'photo_brief', 'Photo brief', 'cms', { role: 'field_exec', order: 20, locked: 'the photo standard is the job' }),
  s('/field/inspect', 'entry', 'Measurement entry & capture', 'own', { role: 'field_exec', order: 30, locked: R.product }),
  s('/field/inspect', 'declared', 'Seller’s declared details', 'portal', { role: 'field_exec', order: 40, locked: 'the inspector measures against a claim' }),
  s('/field/inspect', 'reasons', 'Discrepancy reason list', 'cms', { role: 'field_exec', order: 50, locked: 'a rejection must name its reason' }),

  s('/field/catalogue', 'header', 'Catalogue header & lots', 'portal', { role: 'field_exec', order: 10, locked: R.product }),
  s('/field/catalogue', 'progress', 'Progress against the assignment', 'live', { role: 'field_exec', order: 20 }),
  s('/field/catalogue', 'guidance', 'Category inspection guidance', 'cms', { role: 'field_exec', order: 30 }),
]

/* =========================== operation manager ============================ */

const EXEC = [
  s('/exec', 'board', 'Pipeline board', 'live', { role: 'exec_manager', order: 10, locked: R.product }),
  s('/exec', 'submissions', 'Incoming seller submissions', 'portal', { role: 'exec_manager', order: 20, locked: R.product }),
  s('/exec', 'inspections', 'Inspection outcomes', 'portal', { role: 'exec_manager', order: 30, locked: R.product }),
  s('/exec', 'desk_notices', 'Desk notices & SLA reminder', 'cms', { role: 'exec_manager', order: 5, enabled: false }),

  s('/exec/approvals', 'queues', 'Approval, bypass and bypassed record', 'live', { role: 'exec_manager', order: 10, locked: R.record }),
  s('/exec/approvals', 'reasons', 'Approval / rejection / bypass reasons', 'cms', { role: 'exec_manager', order: 20, locked: 'a decision must name its reason' }),
  s('/exec/approvals', 'bypass_warning', 'Bypass warning', 'cms', { role: 'exec_manager', order: 30, locked: R.warning }),

  s('/exec/catalogue-builder', 'wizard', 'Four-step wizard', 'own', { role: 'exec_manager', order: 10, locked: R.product }),
  s('/exec/catalogue-builder', 'lots', 'Submitted lots', 'portal', { role: 'exec_manager', order: 20, locked: R.product }),
  s('/exec/catalogue-builder', 'terms_template', 'Default auction-terms template', 'cms', { role: 'exec_manager', order: 30, locked: R.legal }),
  s('/exec/catalogue-builder', 'presets', 'Increment ladders & EMD presets', 'cms', { role: 'exec_manager', order: 40, locked: 'a catalogue cannot be built without them' }),
  s('/exec/catalogue-builder', 'changes', 'What we changed on the seller’s lots', 'own', { role: 'exec_manager', order: 50, locked: 'the seller is always told' }),

  s('/exec/logistics', 'orders', 'Paid orders awaiting lifting', 'portal', { role: 'exec_manager', order: 10, locked: R.product }),
  s('/exec/logistics', 'actions', 'Weighment, gate pass, lifting window', 'own', { role: 'exec_manager', order: 20, locked: R.product }),
  s('/exec/logistics', 'templates', 'Gate-pass template & yard snippets', 'cms', { role: 'exec_manager', order: 30, locked: 'a gate pass must be issuable' }),
  s('/exec/logistics', 'delay_reasons', 'Delay / hold reason list', 'cms', { role: 'exec_manager', order: 40, locked: 'the buyer is shown the reason' }),

  s('/exec/handover', 'records', 'Handover records & approvals inbox', 'live', { role: 'exec_manager', order: 10, locked: R.record }),
  s('/exec/handover', 'kyc', 'KYC requests routed here', 'portal', { role: 'exec_manager', order: 20, locked: R.product }),
  s('/exec/handover', 'resubmit_reasons', '“What has to be resubmitted”', 'cms', { role: 'exec_manager', order: 30, locked: 'an applicant must know what to fix' }),
  s('/exec/handover', 'certificate', 'Closure certificate template', 'cms', { role: 'exec_manager', order: 40 }),

  s('/exec/settlement', 'sta', 'STA decisions — H1 below reserve', 'portal', { role: 'exec_manager', order: 10, locked: R.product }),
  s('/exec/settlement', 'refused', 'Prices the seller refused', 'portal', { role: 'exec_manager', order: 20, locked: R.product }),
  s('/exec/settlement', 'payments', 'Payments & delivery orders', 'portal', { role: 'exec_manager', order: 30, locked: R.product }),
  s('/exec/settlement', 'templates', 'Demand-draft & notice templates', 'cms', { role: 'exec_manager', order: 40 }),
]

/* ============================ auction manager ============================= */

const AUCTION = [
  s('/auction', 'sale_day', 'Sale-day strip & what needs you', 'live', { role: 'auction_manager', order: 10, locked: R.product }),
  s('/auction', 'announcements_sent', 'Reaching the floor', 'portal', { role: 'auction_manager', order: 20, locked: R.product }),
  s('/auction', 'desk_notices', 'Desk notices & escalation contacts', 'cms', { role: 'auction_manager', order: 5, enabled: false }),

  s('/auction/schedule', 'waiting', 'Waiting to go to market', 'portal', { role: 'auction_manager', order: 10, locked: R.product }),
  s('/auction/schedule', 'gate', 'Publish gate, reschedule, return', 'own', { role: 'auction_manager', order: 20, locked: 'this is the one step that makes an auction public' }),
  s('/auction/schedule', 'preview', 'Buyer’s-eye preview', 'own', { role: 'auction_manager', order: 30 }),
  s('/auction/schedule', 'checklist', 'Publish checklist & gate warnings', 'cms', { role: 'auction_manager', order: 40, locked: R.warning }),
  s('/auction/schedule', 'return_reasons', 'Return-to-Ops reason list', 'cms', { role: 'auction_manager', order: 50, locked: 'a return must name its reason' }),

  s('/auction/announcements', 'compose', 'Compose', 'own', { role: 'auction_manager', order: 10, locked: R.product }),
  s('/auction/announcements', 'sent', 'What has been sent', 'live', { role: 'auction_manager', order: 20, locked: R.record }),
  s('/auction/announcements', 'templates', 'Announcement templates', 'cms', { role: 'auction_manager', order: 30 }),

  s('/auction/live', 'floor', 'Every running sale', 'live', { role: 'auction_manager', order: 10, locked: R.product }),
  s('/auction/live', 'actions', 'Pause, extend, cancel, void', 'own', { role: 'auction_manager', order: 20, locked: R.product }),
  s('/auction/live', 'reasons', 'Intervention reasons & bidder notices', 'cms', { role: 'auction_manager', order: 30, locked: 'a pause bidders are not told about becomes a dispute' }),
  s('/auction/live', 'explainers', '“What this list is for”', 'cms', { role: 'auction_manager', order: 40 }),

  s('/auction/results', 'queues', 'Waiting on you, and confirmed', 'live', { role: 'auction_manager', order: 10, locked: R.record }),
  s('/auction/results', 'confirm', 'Confirm a result', 'own', { role: 'auction_manager', order: 20, locked: R.product }),
  s('/auction/results', 'definitions', 'Report definitions & metric explainers', 'cms', { role: 'auction_manager', order: 30 }),
  s('/auction/results', 'export', 'Export headers & footers', 'cms', { role: 'auction_manager', order: 40 }),
]

/* ========================= finance administrator ========================== */

const FINANCE = [
  s('/finance', 'position', 'The position, exposure and ageing', 'live', { role: 'finance_admin', order: 10, locked: R.product }),
  s('/finance', 'signature', 'Away for signature', 'portal', { role: 'finance_admin', order: 20, locked: R.product }),
  s('/finance', 'desk_notices', 'Desk notices & cut-off reminders', 'cms', { role: 'finance_admin', order: 5, enabled: false }),

  s('/finance/deposits', 'incoming', 'Claims and requests arriving', 'portal', { role: 'finance_admin', order: 10, locked: R.product }),
  s('/finance/deposits', 'ledgers', 'Held, overdue, ageing', 'live', { role: 'finance_admin', order: 20, locked: R.record }),
  s('/finance/deposits', 'actions', 'Verify, receipt, forfeit, issue a DO', 'own', { role: 'finance_admin', order: 30, locked: R.product }),
  s('/finance/deposits', 'bank_block', 'Where the money should land', 'portal', { role: 'finance_admin', order: 40, locked: R.bank }),
  s('/finance/deposits', 'reasons', 'Rejection reasons & chase notices', 'cms', { role: 'finance_admin', order: 50, locked: 'the buyer reads these' }),
  s('/finance/deposits', 'emd_explainer', '“What releases EMD automatically”', 'cms', { role: 'finance_admin', order: 60 }),

  s('/finance/bank-accounts', 'registered', 'Accounts registered by users', 'portal', { role: 'finance_admin', order: 10, locked: R.bank }),
  s('/finance/bank-accounts', 'queues', 'Refund and withdrawal queues', 'live', { role: 'finance_admin', order: 20, locked: R.record }),
  s('/finance/bank-accounts', 'reasons', 'Refusal reasons & user message', 'cms', { role: 'finance_admin', order: 30, locked: 'the user reads these' }),
  s('/finance/bank-accounts', 'refund_explainer', '“Where refunds come from”', 'cms', { role: 'finance_admin', order: 40 }),

  s('/finance/invoices', 'books', 'Statements, breakdowns, audit pack', 'live', { role: 'finance_admin', order: 10, locked: R.record }),
  s('/finance/invoices', 'templates', 'Invoice, receipt & credit-note templates', 'cms', { role: 'finance_admin', order: 20, locked: 'a document must be issuable', review: true }),
  s('/finance/invoices', 'break_reasons', 'Break / mismatch reason list', 'cms', { role: 'finance_admin', order: 30, locked: 'a break must name its reason' }),
  s('/finance/invoices', 'definitions', 'Report definitions', 'cms', { role: 'finance_admin', order: 40 }),

  s('/admin/finance', 'config', 'Rates, taxes, EMD rules, bank accounts', 'portal', { role: 'finance_admin', order: 10, locked: 'Finance reads the rates it charges; it does not set them' }),
]

/* ================================== CEO =================================== */

const CEO = [
  s('/ceo', 'figures', 'Every figure, chart and trend', 'live', { role: 'ceo', order: 10, locked: R.product }),
  s('/ceo', 'definitions', 'Metric definitions & commentary', 'cms', { role: 'ceo', order: 20, enabled: false }),
  s('/ceo/approvals', 'operational', 'Forfeitures, write-offs, overrides', 'portal', { role: 'ceo', order: 10, locked: 'other people are waiting on these' }),
  s('/ceo/approvals', 'content', 'Pricing & legal content drafts', 'portal', { role: 'ceo', order: 20, locked: 'nothing pricing or legal goes public unsigned' }),
  s('/ceo/delegate', 'delegation', 'Delegate my approvals', 'own', { role: 'ceo', order: 10, locked: R.product }),
]

/* ================================ sub admin =============================== */

const SUB = [
  s('/sub', 'queues', 'Queues, assignments, approval inboxes', 'live', { role: 'sub_admin', order: 10, locked: R.product }),
  s('/sub', 'incoming', 'Seller KYC & field rosters', 'portal', { role: 'sub_admin', order: 20, locked: R.product }),
  s('/sub', 'lists', 'Document lists, reasons, canned replies', 'cms', { role: 'sub_admin', order: 30, locked: 'the applicant sees the same list' }),
  s('/sub', 'desk_notices', 'Desk notices & SLA reminders', 'cms', { role: 'sub_admin', order: 5, enabled: false }),

  s('/sub/disputes', 'watched', 'Everything watched, and the record of it', 'live', { role: 'sub_admin', order: 10, locked: R.record }),
  s('/sub/disputes', 'ladder', 'Categories, SLA, replies, escalation', 'cms', { role: 'sub_admin', order: 20, locked: R.statutory }),
]

export const SECTIONS = [
  ...HOME, ...LEGAL_PAGES, ...SHARED,
  ...BUYER, ...SELLER, ...FIELD, ...EXEC, ...AUCTION, ...FINANCE, ...CEO, ...SUB,
]

/* ---------------------------------------------------------------------------
   Initial content.

   The CMS starts holding EXACTLY what the site already says. Every value below
   is lifted verbatim from the component that hardcodes it today, so seeding
   changes nothing a visitor can see — the words simply become editable.

   That is the whole point of doing it this way: a CMS rollout that also
   rewrites the copy makes it impossible to tell which change broke what.

   `number_label` blocks are captions ONLY. The figure beside them is queried,
   never stored here — see the no-figures rule in api/cms.mjs.
--------------------------------------------------------------------------- */

const block = (pageKey, sectionKey, blockKey, kind, value, order = 0) =>
  ({ pageKey, sectionKey, blockKey, kind, value, sortOrder: order })

export const BLOCKS = [
  /* ------------------------------ home: hero ----------------------------- */
  block('home', 'hero', 'headline_lead', 'text', 'Industrial metal,', 10),
  block('home', 'hero', 'headline_accent', 'text', 'sold the fair way.', 20),
  block('home', 'hero', 'subcopy', 'text',
    'India’s transparent B2B auction marketplace for scrap, flat & long products, ferro alloys and plant assets — every lot physically inspected, catalogued and sold as-is-where-is.', 30),
  block('home', 'hero', 'search_placeholder', 'text', 'Search MS scrap, SS coils, copper, catalogues…', 40),
  block('home', 'hero', 'cta_primary', 'link', { label: 'Browse live auctions', to: '/browse' }, 50),
  block('home', 'hero', 'cta_secondary', 'link', { label: 'Sell your material', to: '/buyer/kyc' }, 60),

  /* --------------------------- home: the rails --------------------------- */
  block('home', 'live_auctions', 'heading', 'text', 'Live auctions', 10),
  block('home', 'live_auctions', 'subcopy', 'text', 'Bidding open now — anti-snipe protected closings.', 20),
  block('home', 'live_auctions', 'empty', 'text',
    'No auctions are live right now — check the upcoming schedule below.', 30),
  block('home', 'live_auctions', 'view_all', 'link', { label: 'View all', to: '/browse?tab=live' }, 40),

  block('home', 'upcoming_auctions', 'heading', 'text', 'Upcoming auctions', 10),
  block('home', 'upcoming_auctions', 'subcopy', 'text',
    'Book yard inspections and fund EMD before the gavel drops.', 20),
  block('home', 'upcoming_auctions', 'empty', 'text',
    'New catalogues are announced every week — watch the noticeboard.', 30),
  block('home', 'upcoming_auctions', 'view_all', 'link', { label: 'View all', to: '/browse?tab=upcoming' }, 40),

  block('home', 'categories', 'heading', 'text', 'Browse by category', 10),

  /* ------------------------- home: how it works -------------------------- */
  block('home', 'how_it_works', 'heading', 'text', 'How it works', 10),
  block('home', 'how_it_works', 'subcopy', 'text',
    'One marketplace, three sides — buyers bid on verified lots, sellers get fair price discovery, and our field team stands behind every catalogue entry.', 20),
  block('home', 'how_it_works', 'tracks', 'list', [
    {
      title: 'For buyers', sub: 'Shortlist → fund EMD → bid → lift', tone: 'ember',
      steps: [
        { icon: 'ListChecks', label: 'Shortlist lots', body: 'Browse live catalogues and shortlist the lots you want to contest.' },
        { icon: 'Wallet', label: 'Fund EMD', body: 'Lock pre-bid EMD per lot from your wallet — refunded if you don’t win.' },
        { icon: 'Gavel', label: 'Bid live', body: 'Forward auction on rate per MT/KG/PCS with anti-snipe extensions.' },
        { icon: 'Truck', label: 'Pay & lift', body: 'H1 gets the delivery order. Pay, schedule lifting, weighment settles final qty.' },
      ],
    },
    {
      title: 'For sellers', sub: 'Submit lots → we inspect → catalogued → paid', tone: 'steel',
      steps: [
        { icon: 'PackagePlus', label: 'Submit lots', body: 'List your material with indicative quantity, grade and yard location.' },
        { icon: 'ClipboardCheck', label: 'We inspect', body: 'Our field team visits your yard, measures and photographs every lot.' },
        { icon: 'BookOpen', label: 'Catalogued', body: 'Verified lots go into a scheduled auction catalogue with reserve protection.' },
        { icon: 'Banknote', label: 'Get paid', body: 'Post-auction settlement with GST/TCS handled, funds to your account.' },
      ],
    },
    {
      title: 'Verified & catalogued by our team', sub: 'Field inspection → measured qty → published', tone: 'success',
      steps: [
        { icon: 'MapPin', label: 'Field inspection', body: 'Trained inspectors physically visit the yard for every single lot.' },
        { icon: 'Ruler', label: 'Measured quantity', body: 'Weighment-backed indicative quantity — final settles on lifting weighment.' },
        { icon: 'FileCheck2', label: 'Published', body: 'Inspection report, photos and checklist attached before a lot goes live.' },
      ],
    },
  ], 30),
  block('home', 'how_it_works', 'footnote', 'text',
    'Quantities shown across the marketplace are indicative — final quantity settles on weighment at lifting.', 40),

  /* --------------------------- home: trust band -------------------------- */
  /* Captions only. The figures beside them are queried — see the no-figures
     rule, which is why these are `number_label` and not `text`. */
  block('home', 'trust_band', 'stat_lots_label', 'number_label', 'lots sold on ferroBid', 10),
  block('home', 'trust_band', 'stat_yards_label', 'number_label', 'verified seller yards', 20),
  block('home', 'trust_band', 'stat_buyers_label', 'number_label', 'registered buyers', 30),
  block('home', 'trust_footer', 'line', 'text',
    'Every lot physically inspected & catalogued by our field team before it goes live.', 10),
  block('home', 'trust_footer', 'cta', 'link', { label: 'Read our process', to: '/help' }, 20),

  /* -------------------------------- offline ------------------------------ */
  block('home', 'offline_banner', 'message', 'text',
    'Server not connected — live auctions cannot be loaded right now.', 10),

  /* --------------------------------- SEO --------------------------------- */
  block('home', 'seo', 'title', 'text', 'ferroBid — transparent B2B metal auctions in India', 10),
  block('home', 'seo', 'description', 'text',
    'Buy and sell industrial metal at auction. Every lot physically inspected, catalogued and sold as-is-where-is.', 20),
]
