/** Brand-level static content — shared across headers, footers and auth. */
export const SITE = {
  name: 'ferroBid',
  namePrefix: 'ferro', // rendered plain
  nameAccent: 'Bid',   // rendered in ember accent
  tagline: 'Digital Metal Auctions',
  taglineShort: 'Metal Auctions',
  footerNote: 'Prototype by AspiraSys for Metal Bid Technologies · All transactions, payments and data are simulated',
  supportPhone: '1800-000-4636',
  supportEmail: 'support@ferrobid.in',
} as const;

/** Thin top utility strip shown above the main header on the landing page. */
export const UTILITY_BAR = {
  helpLabel: 'Help Center',
  sellerLabel: 'Become a Seller',
} as const;

/** Footer sitemap columns — every link points at a real in-app route, no dead links. */
export const FOOTER_COLUMNS = [
  {
    heading: 'Marketplace',
    links: [
      { label: 'Live & upcoming auctions', to: '/browse' },
      { label: 'Categories', hash: '#categories' },
      { label: 'Noticeboard', to: '/noticeboard' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'How it works', hash: '#how' },
      { label: 'Guided role tour', hash: '#roles' },
      { label: 'Register / Login', to: '/auth/login' },
    ],
  },
] as const;

export const FOOTER_COMPLIANCE = [
  'KYC-verified sellers',
  'EMD-protected bidding',
  'Field-verified lots',
  'Transparent audit trail',
] as const;
