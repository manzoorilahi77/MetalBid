/** All static copy for the public landing page — edit text here, not in the component. */

export const HERO = {
  titleLine1: 'Where India trades metal,',
  titleLine2: 'transparently. Live.',
  sub: 'Verified sellers. Physically inspected lots. Competitive live bidding with managed settlement, logistics and handover — the complete lifecycle on one platform.',
  ctaPrimary: 'Start bidding',
  ctaSecondary: 'Explore live auctions',
} as const;

export const HERO_STATS = [
  { v: 2400, s: '+', label: 'Lots auctioned' },
  { v: 96, s: ' Cr+', label: 'GMV realised', p: '₹' },
  { v: 1800, s: '+', label: 'Verified bidders' },
  { v: 99, s: '%', label: 'Fulfilment rate' },
] as const;

export const LIVE_SECTION = {
  kicker: 'Live right now',
  title: 'Bidding is open',
  viewAll: 'View all',
} as const;

export const CATEGORY_SECTION = {
  kicker: 'Browse by metal',
  title: 'Every category, one marketplace',
  sub: 'Jump straight into live lots for the metal you trade.',
} as const;

/** Fixed display order for the metal category tiles (WBS §1 metal list). */
export const CATEGORY_ORDER = ['Ferrous', 'Copper', 'Aluminium', 'Brass', 'Stainless', 'Zinc', 'Lead', 'Tin'] as const;

export const NOTICE_SECTION = {
  kicker: 'Stay informed',
  title: 'Latest announcements',
  viewAll: 'View noticeboard',
} as const;

export const HOW_SECTION = {
  kicker: 'The lifecycle',
  title: 'From listing to handover — managed end to end',
  steps: [
    { icon: 'ClipboardCheck', t: '1 · Verify', s: 'Entities pass KYC & document checks; every lot is physically inspected with reports and photos.' },
    { icon: 'Gavel', t: '2 · Bid live', s: 'Real-time ladders, auto-bid, and anti-sniping auto-extension keep the bidding fair and fierce.' },
    { icon: 'Banknote', t: '3 · Settle', s: 'Winner payment, EMD auto-refunds for losers, invoices — handled by the operations pipeline.' },
    { icon: 'Truck', t: '4 · Fulfil', s: 'Scheduled pickup, assigned handlers, proof-of-handover. The lot closes with a full audit trail.' },
  ],
} as const;

export const TRUST_ITEMS = [
  { icon: 'ShieldCheck', t: 'Verified entities only', s: 'Sellers unlock listing after entity verification' },
  { icon: 'BadgeCheck', t: 'Inspected lots', s: 'Checklist, report & photos before any auction' },
  { icon: 'TrendingUp', t: 'Fair price discovery', s: 'Open ladders · anti-sniping extensions' },
] as const;

export const ROLES_SECTION = {
  kicker: 'Guided tour',
  title: 'Walk the prototype as any role',
  sub: 'Jump straight into a persona — switch anytime from the header. Every hand-off between roles is fully clickable.',
} as const;

export const CTA_SECTION = {
  title: "Ready to strike while it's hot?",
  sub: 'Register in under a minute with mobile + OTP. Every account starts as a Buyer — verified entities unlock selling on the same login.',
  button: 'Create your account →',
} as const;
