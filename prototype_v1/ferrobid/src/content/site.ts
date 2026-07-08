/** Brand-level static content — shared across headers, footers and auth. */
export const SITE = {
  name: 'ferroBid',
  namePrefix: 'ferro', // rendered plain
  nameAccent: 'Bid',   // rendered in ember accent
  tagline: 'Digital Metal Auctions',
  taglineShort: 'Metal Auctions',
  footerNote: 'Prototype by AspiraSys for Metal Bid Technologies · All transactions, payments and data are simulated',
} as const;
