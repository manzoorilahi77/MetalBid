# Guest marketplace: real data + catalogue detail page

Date: 2026-08-09

## Goal

`#/home/marketplace` (the public, guest-facing homepage's marketplace page,
`src/guest1/pages/Marketplace.jsx`) currently renders a hardcoded, 12-item
mock array (`AUCTIONS`) and its cards are not clickable to any detail page
(two inner links go to `/pricing` instead). `#/buyermarketplace`
(`src/pages/buyer/Marketplace.tsx`) already shows the real catalogue data
from the Zustand store.

This change makes `#/home/marketplace` show the same underlying catalogue
data as `#/buyermarketplace`, without changing its UI/layout, and makes
clicking a card navigate to a new, guest-only, read-only catalogue detail
page.

## Non-goals

- No visual/layout changes to `Marketplace.jsx` or `AuctionCard.jsx`.
- No changes to `#/buyermarketplace` or the existing buyer `AuctionDetail`
  page (`#/catalogue/:id`).
- No role-branching: `#/home/marketplace` always behaves as the guest
  experience, regardless of whether the visitor happens to be logged in via
  the demo role switcher (confirmed decision — see Open questions below).
- No live-ticking countdown wiring (`useNow`) for the guest list — "live"
  status is computed once per render from `Date.now()`, matching the
  original mock's static (non-ticking) `isLive` semantics.

## Current state (for reference)

- `home/marketplace`: `src/guest1/pages/Marketplace.jsx` reads a local
  `AUCTIONS` array (one row per lot) and renders `AuctionCard`
  (`src/guest1/components/AuctionCard.jsx`). Filters/sort/pagination all
  operate on this array's fields: `id, material, seller, location, state,
  qty, price, priceNum, type, category, isLive, img`. `CATEGORIES` is a
  fixed literal (`Ferrous, Non-Ferrous, Stainless Steel, Minor Metals`);
  `SELLERS`/`STATES`/`STATS` are derived from `AUCTIONS` via `Set`.
- `buyermarketplace`: `src/pages/buyer/Marketplace.tsx` reads
  `catalogues`/`lots`/`users` from the Zustand store (`src/store/store.ts`,
  seeded once from `src/data/mock/*.json`) and renders `CatalogueCard`
  (`src/components/domain.tsx`), one row per `Catalogue` (which owns many
  `Lot`s via `lotIds`).
- Both apps share one JS bundle and can both import `useStore` — Guest1's
  own `Auth.jsx` already does this — despite living under two separate,
  mutually-exclusive `HashRouter` trees (`Guest1Gate.tsx` picks one by URL
  hash prefix, never both).
- A catalogue detail page already exists for the buyer app at
  `#/catalogue/:id` (`src/pages/AuctionDetail.tsx`), but it's a large,
  Tailwind-styled, buyer-oriented page (bid room, EMD funding, shortlist
  modals) — not a fit for the guest-styled homepage.

## Design

### 1. Data adapter — `src/guest1/lib/marketplaceAdapter.js` (new)

A pure function, e.g. `catalogueToAuction(cat, catLots, seller)`, that maps
one real `Catalogue` (+ its `Lot[]`, + its seller `User`) into the exact
object shape `AuctionCard` and `Marketplace.jsx`'s filters already consume,
plus one new field:

| Field | Source |
|---|---|
| `id` | `cat.code` (display code, e.g. `AUC-2418`) |
| `catalogueId` | `cat.id` — new field, used only for routing to the detail page |
| `material` | `cat.title` |
| `seller` | `seller?.firm ?? 'Verified Seller'` |
| `location` | `cat.region` |
| `state` | `cat.region` (same string — filter dropdown groups by whatever unique values exist here; matches existing dynamic-derivation pattern via `[...new Set(...)]`, so no separate state-name lookup table is needed) |
| `qty` | sum of `indicativeQty` across `catLots`, formatted with the first lot's `uom`, e.g. `"78 MT"` |
| `price` / `priceNum` | `priceNum` = lowest `preBidEmd` across `catLots` (mirrors buyer UI's own EMD low→high sort); `price` = `inr(priceNum)`. Note: `AuctionCard` never actually renders this text today (always shown behind the "Subscribers only" lock) — it's only read for the Price sort, so this is a safe, low-stakes value. |
| `category` | Derived from `catLots`' `metal` values via a fixed lookup (below), majority vote across the catalogue's lots, default `'Minor Metals'` |
| `type` | Same bucket as `category`, lowercased — kept for shape parity; unused today in filters/display (verified: no `.type` reference exists in current `Marketplace.jsx`/`AuctionCard.jsx`) |
| `isLive` | `catalogueUiStatus(cat, Date.now()) ∈ {'live', 'closing'}` |
| `img` | Static stock image keyed off the same dominant-metal bucket (below) |

**Metal → category lookup** (built from the actual values present in
`src/data/mock/lots.json`):

```
MS, CI                      → Ferrous
SS 304, SS 316, SS 409      → Stainless Steel
Aluminium, Copper, Brass, Zinc → Non-Ferrous
Assets, Chemicals, Coal, Ferro Alloys, Long Products, Minerals → Minor Metals
```

**Category → stock image** (reusing the 6 images already bundled under
`src/guest1/.../images/auctions/`, since catalogues carry no real photos —
buyer UI itself only shows procedural color-swatch placeholders, not
photos):

```
Non-Ferrous (Aluminium)  → aluminium_scrap.png
Non-Ferrous (Copper)     → copper_wire.png
Non-Ferrous (Zinc)       → zinc_dross.png
Non-Ferrous (Brass)      → brass_borings.png
Stainless Steel          → cr_coil.png
Ferrous / Minor Metals   → hms_scrap.png
```

**Exclusions**: catalogues with `status === 'draft'` (never public — matches
the buyer page's own `if (cat.status === 'draft') return false` guard) or
`status === 'closed'` are filtered out before mapping. The guest page's
"View" tabs are only `All / Live Now / Upcoming` — there is no "closed"
concept in this UI, so including closed catalogues would silently
mislabel them as "Upcoming". This also keeps the hero stats
(`STATS.total`, `STATS.live`, etc.) meaningful.

### 2. `src/guest1/pages/Marketplace.jsx`

Replace the hardcoded `AUCTIONS` literal with:

```js
const catalogues = useStore((s) => s.catalogues)
const lots = useStore((s) => s.lots)
const users = useStore((s) => s.users)
const AUCTIONS = useMemo(
  () => catalogues
    .filter(/* not draft, not closed */)
    .map((cat) => catalogueToAuction(cat, lots.filter(l => l.catalogueId === cat.id), users.find(u => u.id === cat.sellerId))),
  [catalogues, lots, users]
)
```

Everything downstream (`CATEGORIES` literal, `SELLERS`/`STATES`/`STATS`
derivation, `filtered` memo, pagination, JSX) is unchanged — it already
operates generically on whatever array `AUCTIONS` holds.

### 3. `src/guest1/components/AuctionCard.jsx`

Today the outer `motion.div` card has no click handler; the only
interactive elements are two `<Link to="/pricing">`s nested inside it (the
"Subscribers only" price lock, and the "Join/View" button). I'll:

- Add `onClick`/`onKeyDown` (Enter/Space) + `role="button" tabIndex={0}` to
  the outer card that calls `navigate(\`/catalogue/${auction.catalogueId}\`)`.
- Add `onClick={(e) => e.stopPropagation()}` to both existing `/pricing`
  links so their current behavior is unchanged (clicking them still only
  goes to `/pricing`, not the new detail page).

No className, layout, or visible-markup changes.

### 4. New guest catalogue detail page

- New file: `src/guest1/pages/CatalogueDetail.jsx`.
- New route in `src/guest1/App.jsx`: `<Route path="/catalogue/:id"
  element={<CatalogueDetail />} />`, which (combined with Guest1's
  `basename="/home"`) resolves to `#/home/catalogue/:id`.
- Visual pattern: modeled on the existing `BlogPost.jsx` page (hero with
  `Breadcrumb` from `guest1/components/PageShell.jsx` + `.container` body),
  so it matches the rest of the guest site's design language rather than
  the buyer app's Tailwind UI kit. New minimal stylesheet
  `src/guest1/styles/catalogue-detail.css`, reusing existing CSS custom
  properties from `enterprise.css`/`resources.css` (tokens, `.res-card`
  patterns) where they fit.
- Content (all read-only, sourced from `useStore`):
  - Header: breadcrumb (Home → Marketplace → catalogue title), code,
    title, status badge, countdown/relative time (same `catalogueUiStatus`
    used elsewhere).
  - Seller & yard: seller firm, yard name/address, inspection contact.
  - Timing: `startsAt`, `endsAt`, `inspectionFrom/To` + hours, `emdDeadline`.
  - Lots list: for every lot in the catalogue — lot no, metal, grade, qty +
    uom, description, hazardous flag, starting/current rate, EMD, status.
  - No shortlist, EMD-funding, watchlist, PDF download, or bid-room
    actions — this is intentionally a read-only view for anonymous
    visitors.
  - Closing CTA: "Create an account to bid" linking to `/pricing`.
- Not-found state: same pattern as `BlogPost.jsx`'s 404 branch — if no
  catalogue matches `:id` (or it's `draft`), show a simple "Catalogue not
  found" message with a link back to `/marketplace`.

## Data flow summary

```
Zustand store (catalogues, lots, users)
        │
        ▼
marketplaceAdapter.catalogueToAuction()   ─── used by ───▶  Marketplace.jsx (list, unchanged UI)
        │                                                          │
        │                                                   click on AuctionCard
        │                                                          ▼
        └── same store, looked up by :id ──────────────▶  CatalogueDetail.jsx (#/home/catalogue/:id, new)
```

## Testing

- Manual: load `#/home/marketplace`, confirm the same catalogues (minus
  draft/closed) that appear on `#/buyermarketplace` show up, with filters
  (category/seller/location), search, sort, and pagination all still
  working against the real data.
- Manual: click a card → lands on `#/home/catalogue/:id` showing correct
  catalogue + lots; click "Subscribers only" / "Join"/"View" → still goes
  to `/pricing`, not the detail page.
- Manual: visit an invalid `#/home/catalogue/does-not-exist` → not-found
  state renders.
- Visual diff: `#/home/marketplace` layout/CSS is pixel-identical to
  before this change (only the data and click behavior changed).

## Open questions (resolved during brainstorming)

- **Item granularity**: one card per catalogue (not per lot) — confirmed.
- **Detail destination**: new guest-only page, not the existing buyer
  `AuctionDetail` — confirmed.
- **Non-guest visitors on `#/home/marketplace`**: always treated as guest,
  no role branching — confirmed.
- **Detail page content depth**: full read-only details (not a
  teaser/paywall) — confirmed.
