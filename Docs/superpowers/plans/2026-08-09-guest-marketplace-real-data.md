# Guest marketplace: real data + catalogue detail page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `#/home/marketplace` render real catalogue data from the Zustand store (instead of a hardcoded 12-item array) and make each card navigate to a new, guest-only, read-only catalogue detail page at `#/home/catalogue/:id`.

**Architecture:** A pure adapter function (`marketplaceAdapter.js`) maps `Catalogue + Lot[] + User` from the store into the flat object shape `Marketplace.jsx`/`AuctionCard.jsx` already consume. `Marketplace.jsx` swaps its hardcoded array for a `useMemo` built from `useStore` + the adapter — no other logic in that file changes. `AuctionCard.jsx` gets a click/keyboard handler that navigates to the new detail route, with `stopPropagation` on its two existing `/pricing` links so their behavior is preserved. A new `CatalogueDetail.jsx` page (visually modeled on `BlogPost.jsx`) renders full read-only catalogue + lot details from the same store.

**Tech Stack:** React 19, react-router-dom v7 (HashRouter, `Guest1Gate` mounts this app at `/home`), Zustand store (`src/store/store.ts`), framer-motion, lucide-react icons, plain CSS (no Tailwind in guest1).

## Global Constraints

- Project root for all commands below is `prototype_v2/ferrobid/` (the actual Vite project — the repo root `FerroBid/` one level up is not it). `cd prototype_v2/ferrobid` before running any `npm` command.
- This repo has **no automated test runner** (no vitest/jest, no `*.test.*` files, no `test` script in `package.json`). Per-task verification is `npm run build` (runs `tsc -b && vite build` — `tsc` doesn't type-check `.jsx` since `allowJs` is off, but `vite build` still bundles guest1's JSX through esbuild, so it catches import-path typos, syntax errors, and missing exports). The final task adds a manual browser QA pass via `npm run dev`, matching the design spec's own "Testing" section (manual-only).
- No visual/layout/className changes to `Marketplace.jsx` or `AuctionCard.jsx` — only data source and click behavior change.
- No changes to `#/buyermarketplace` (`src/pages/buyer/Marketplace.tsx`) or the existing buyer `AuctionDetail.tsx` (`#/catalogue/:id` under the buyer app).
- No role-branching on `#/home/marketplace` — it always behaves as the guest experience.
- No live-ticking countdown (`useNow`) — `isLive`/status is computed once per render via `Date.now()`.
- Full spec: `docs/superpowers/specs/2026-08-09-guest-marketplace-real-data-design.md`.

---

### Task 1: Data adapter — `marketplaceAdapter.js`

**Files:**
- Create: `prototype_v2/ferrobid/src/guest1/lib/marketplaceAdapter.js`

**Interfaces:**
- Consumes: `Catalogue` (`id, code, title, sellerId, status, region, ...`), `Lot` (`id, catalogueId, metal, indicativeQty, uom, preBidEmd, ...`), `User` (`id, firm, ...`) from `src/types.ts`; `catalogueUiStatus(cat, now)` and `inr(n)` from the store/lib.
- Produces: `catalogueToAuction(cat, catLots, seller) -> { id, catalogueId, material, seller, location, state, qty, price, priceNum, category, type, isLive, img }` — the exact shape `AuctionCard`/`Marketplace.jsx` already read, plus the new `catalogueId` field. Task 2 imports `catalogueToAuction` from this file.

- [ ] **Step 1: Create the adapter file**

```js
/* Maps real Catalogue + Lot[] + seller User (from the Zustand store) into the
   flat auction-card shape src/guest1/pages/Marketplace.jsx and
   src/guest1/components/AuctionCard.jsx already consume, so the guest
   marketplace can read the same data as #/buyermarketplace without touching
   either component's filtering/sort/pagination/JSX logic. */
import { inr } from '../../lib/format';
import { catalogueUiStatus } from '../../store/store';
import { asset } from '../utils/asset';

const METAL_TO_CATEGORY = {
  MS: 'Ferrous',
  CI: 'Ferrous',
  'SS 304': 'Stainless Steel',
  'SS 316': 'Stainless Steel',
  'SS 409': 'Stainless Steel',
  Aluminium: 'Non-Ferrous',
  Copper: 'Non-Ferrous',
  Brass: 'Non-Ferrous',
  Zinc: 'Non-Ferrous',
  Assets: 'Minor Metals',
  Chemicals: 'Minor Metals',
  Coal: 'Minor Metals',
  'Ferro Alloys': 'Minor Metals',
  'Long Products': 'Minor Metals',
  Minerals: 'Minor Metals',
};

const NON_FERROUS_IMAGE = {
  Aluminium: 'aluminium_scrap.png',
  Copper: 'copper_wire.png',
  Zinc: 'zinc_dross.png',
  Brass: 'brass_borings.png',
};

/** Most common `metal` value across a catalogue's lots. Ties keep whichever
    metal was seen first, so the result is deterministic across renders. */
const dominantMetal = (catLots) => {
  const counts = new Map();
  for (const lot of catLots) counts.set(lot.metal, (counts.get(lot.metal) ?? 0) + 1);
  let best = null;
  let bestCount = 0;
  for (const [metal, count] of counts) {
    if (count > bestCount) {
      best = metal;
      bestCount = count;
    }
  }
  return best;
};

const categoryFor = (catLots) => METAL_TO_CATEGORY[dominantMetal(catLots)] ?? 'Minor Metals';

const imageFor = (category, catLots) => {
  if (category === 'Non-Ferrous') {
    const file = NON_FERROUS_IMAGE[dominantMetal(catLots)] ?? 'hms_scrap.png';
    return asset(`/images/auctions/${file}`);
  }
  if (category === 'Stainless Steel') return asset('/images/auctions/cr_coil.png');
  return asset('/images/auctions/hms_scrap.png');
};

/** One Catalogue (+ its Lot[], + its seller User) -> the AuctionCard shape. */
export function catalogueToAuction(cat, catLots, seller) {
  const category = categoryFor(catLots);
  const uom = catLots[0]?.uom ?? 'MT';
  const qtyTotal = catLots.reduce((sum, lot) => sum + lot.indicativeQty, 0);
  const priceNum = catLots.length ? Math.min(...catLots.map((lot) => lot.preBidEmd)) : 0;
  const uiStatus = catalogueUiStatus(cat, Date.now());

  return {
    id: cat.code,
    catalogueId: cat.id,
    material: cat.title,
    seller: seller?.firm ?? 'Verified Seller',
    location: cat.region,
    state: cat.region,
    qty: `${qtyTotal} ${uom}`,
    price: inr(priceNum),
    priceNum,
    category,
    type: category.toLowerCase(),
    isLive: uiStatus === 'live' || uiStatus === 'closing',
    img: imageFor(category, catLots),
  };
}
```

- [ ] **Step 2: Verify it compiles as part of the bundle**

Run: `cd prototype_v2/ferrobid && npm run build`
Expected: build succeeds (this file has no importers yet, but this confirms the syntax/import paths — `../../lib/format`, `../../store/store`, `../utils/asset` — all resolve).

- [ ] **Step 3: Sanity-check the mapping logic against real seed data**

Run this one-off Node check (uses the repo's own mock JSON, no test framework needed):

```bash
cd prototype_v2/ferrobid && node -e "
const lots = require('./src/data/mock/lots.json');
const cats = require('./src/data/mock/catalogues.json');
const cat = cats.find(c => c.id === 'cat-1');
const catLots = lots.filter(l => l.catalogueId === cat.id);
const metals = {};
for (const l of catLots) metals[l.metal] = (metals[l.metal]||0)+1;
console.log('cat-1 lot metals:', metals);
console.log('total qty:', catLots.reduce((s,l)=>s+l.indicativeQty,0), catLots[0].uom);
console.log('min preBidEmd:', Math.min(...catLots.map(l=>l.preBidEmd)));
"
```

Expected: prints a metal-count breakdown (cat-1's lots are mostly `MS`/`CI`, i.e. Ferrous), a total quantity, and a min EMD — confirms the aggregation logic in Step 1 (dominant metal, qty sum, min EMD) matches real data shapes before it's wired into the UI.

- [ ] **Step 4: Commit**

```bash
git add prototype_v2/ferrobid/src/guest1/lib/marketplaceAdapter.js
git commit -m "feat(guest1): add marketplace data adapter mapping Catalogue+Lot+User to AuctionCard shape"
```

---

### Task 2: Wire `Marketplace.jsx` to real store data

**Files:**
- Modify: `prototype_v2/ferrobid/src/guest1/pages/Marketplace.jsx`

**Interfaces:**
- Consumes: `catalogueToAuction` from Task 1 (`../lib/marketplaceAdapter`); `useStore` from `../../store/store` (reads `s.catalogues`, `s.lots`, `s.users`).
- Produces: no new exports — `Marketplace` component's external behavior (route `/marketplace`, i.e. `#/home/marketplace`) is unchanged except the data source.

- [ ] **Step 1: Replace the import block and drop the hardcoded `AUCTIONS` array**

In `Marketplace.jsx`, replace the top of the file (imports through the `STATS` constant, i.e. everything before `const PRE_BID = [`) with:

```jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuctionCard } from '../components/AuctionCard';
import {
  Search, Filter, X, PackageSearch, RotateCcw, ChevronLeft, ChevronRight,
  Layers, Radio, MapPin, Building2, Wallet, ClipboardCheck, Timer, BookOpen
} from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from 'framer-motion';
import { useStore } from '../../store/store';
import { catalogueToAuction } from '../lib/marketplaceAdapter';
import '../styles/enterprise.css';
import '../styles/resources.css';

const PER_PAGE = 6;

const CATEGORIES = ['Ferrous', 'Non-Ferrous', 'Stainless Steel', 'Minor Metals'];
```

This removes: the hardcoded `AUCTIONS` array (12 mock entries), the `asset` import (now unused here — it's used inside `marketplaceAdapter.js` instead), and the module-level `SELLERS`/`STATES`/`STATS` (they move inside the component in Step 2 below, since they now depend on live store data instead of a static array).

- [ ] **Step 2: Compute `AUCTIONS`/`SELLERS`/`STATES`/`STATS` from the store inside the component**

Find this line near the top of the `Marketplace` component body:

```jsx
  const reduceMotion = useReducedMotion();
```

Add immediately after it:

```jsx
  const reduceMotion = useReducedMotion();

  const catalogues = useStore((s) => s.catalogues);
  const lots = useStore((s) => s.lots);
  const users = useStore((s) => s.users);

  const AUCTIONS = useMemo(
    () =>
      catalogues
        .filter((cat) => cat.status !== 'draft' && cat.status !== 'closed')
        .map((cat) =>
          catalogueToAuction(
            cat,
            lots.filter((l) => l.catalogueId === cat.id),
            users.find((u) => u.id === cat.sellerId),
          ),
        ),
    [catalogues, lots, users],
  );

  const SELLERS = useMemo(() => [...new Set(AUCTIONS.map((a) => a.seller))], [AUCTIONS]);
  const STATES = useMemo(() => ['All States', ...new Set(AUCTIONS.map((a) => a.state))], [AUCTIONS]);
  /* Counted off the inventory rather than written by hand — a hero that states
     "12 lots" while the array holds nine is worse than saying nothing. */
  const STATS = useMemo(
    () => ({
      total: AUCTIONS.length,
      live: AUCTIONS.filter((a) => a.isLive).length,
      sellers: SELLERS.length,
      states: STATES.length - 1,
      tonnage: AUCTIONS
        .reduce((sum, a) => sum + (parseFloat(a.qty) || 0), 0)
        .toLocaleString('en-IN'),
    }),
    [AUCTIONS, SELLERS, STATES],
  );
```

- [ ] **Step 3: Fix the `filtered` memo's dependency array**

`AUCTIONS` is no longer a stable module-level constant — it's a per-render value from `useMemo`. The existing `filtered` memo reads `AUCTIONS` inside its callback but doesn't list it as a dependency (it didn't need to before, since the old `AUCTIONS` never changed). Find:

```jsx
  const filtered = useMemo(() => {
    let list = AUCTIONS.filter((a) => {
      if (view === 'live' && !a.isLive) return false;
      if (view === 'upcoming' && a.isLive) return false;
      if (categories.length && !categories.includes(a.category)) return false;
      if (sellers.length && !sellers.includes(a.seller)) return false;
      if (stateFilter !== 'All States' && a.state !== stateFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${a.material} ${a.id} ${a.seller} ${a.location}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (sort === 'priceLow') list = [...list].sort((a, b) => a.priceNum - b.priceNum);
    else if (sort === 'priceHigh') list = [...list].sort((a, b) => b.priceNum - a.priceNum);
    else if (sort === 'ending') list = [...list].sort((a, b) => Number(b.isLive) - Number(a.isLive));
    else if (sort === 'recent') list = [...list].reverse();
    return list;
  }, [search, categories, sellers, stateFilter, view, sort]);
```

Change only the final dependency array to:

```jsx
  }, [AUCTIONS, search, categories, sellers, stateFilter, view, sort]);
```

(Leave the `useEffect` right below it, which also lists `[search, categories, sellers, stateFilter, view, sort]` for resetting `page`, untouched — it doesn't read `AUCTIONS`.)

Everything else in the file (JSX, pagination, filter sidebar, view tabs, empty state, "Before you bid" band) is unchanged — it already reads `AUCTIONS`/`CATEGORIES`/`SELLERS`/`STATES`/`STATS`/`filtered` generically by name.

- [ ] **Step 4: Verify the build**

Run: `cd prototype_v2/ferrobid && npm run build`
Expected: build succeeds with no errors (in particular, no "unused import" or unresolved-import failures).

- [ ] **Step 5: Manual check**

Run: `cd prototype_v2/ferrobid && npm run dev`, open `http://localhost:5173/MetalBid/#/home/marketplace` (or whatever base/port the dev server prints).
Expected: the grid shows real catalogue titles (e.g. "SAIL Bhilai — Mixed MS Scrap, Turnings & TMT Rejects") instead of the old mock names ("Mixed Aluminium Extrusion Scrap" etc.), the hero stats (lots/live/sellers/states/tonnage) reflect the live count, and category/seller/state filters plus search/sort/pagination still work.

- [ ] **Step 6: Commit**

```bash
git add prototype_v2/ferrobid/src/guest1/pages/Marketplace.jsx
git commit -m "feat(guest1): source Marketplace.jsx auction list from the real catalogue store"
```

---

### Task 3: `AuctionCard.jsx` — click/keyboard navigation to the detail page

**Files:**
- Modify: `prototype_v2/ferrobid/src/guest1/components/AuctionCard.jsx`

**Interfaces:**
- Consumes: `auction.catalogueId` (added by Task 1's adapter, already present on every auction object by the time Task 2 lands).
- Produces: clicking/Enter/Space-ing the card navigates to `/catalogue/${auction.catalogueId}` (i.e. `#/home/catalogue/:id` once Task 4's route exists). No prop/export signature changes.

- [ ] **Step 1: Add navigation to the outer card, preserve the two `/pricing` links**

Replace the top of the file:

```jsx
import React from 'react';
import { Clock, MapPin, Building2, ChevronRight, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { asset } from '../utils/asset';

export const AuctionCard = ({ auction, isLive = false }) => {
  return (
    <motion.div 
      className="auction-card premium-small-card"
      whileHover={{ y: -6, boxShadow: '0 16px 32px -8px rgba(228, 87, 46, 0.2)' }}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
```

with:

```jsx
import React from 'react';
import { Clock, MapPin, Building2, ChevronRight, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { asset } from '../utils/asset';

export const AuctionCard = ({ auction, isLive = false }) => {
  const navigate = useNavigate();
  const goToDetail = () => navigate(`/catalogue/${auction.catalogueId}`);
  const onCardKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      goToDetail();
    }
  };

  return (
    <motion.div 
      className="auction-card premium-small-card"
      role="button"
      tabIndex={0}
      onClick={goToDetail}
      onKeyDown={onCardKeyDown}
      whileHover={{ y: -6, boxShadow: '0 16px 32px -8px rgba(228, 87, 46, 0.2)' }}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
```

- [ ] **Step 2: Stop propagation on the "Subscribers only" price-lock link**

Replace:

```jsx
            <Link to="/pricing" className="price-locked" title="Subscribe to view pricing">
              <Lock size={11} /> Subscribers only
            </Link>
```

with:

```jsx
            <Link to="/pricing" className="price-locked" title="Subscribe to view pricing" onClick={(e) => e.stopPropagation()}>
              <Lock size={11} /> Subscribers only
            </Link>
```

- [ ] **Step 3: Stop propagation on the Join/View link**

Replace:

```jsx
            <Link
              to="/pricing"
              className={`btn ${isLive ? 'btn-primary' : 'btn-outline-primary'} btn-sm`}
              style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '999px', textDecoration: 'none' }}
            >
              {isLive ? 'Join' : 'View'} <ChevronRight size={14} style={{ marginLeft: '2px' }} />
            </Link>
```

with:

```jsx
            <Link
              to="/pricing"
              className={`btn ${isLive ? 'btn-primary' : 'btn-outline-primary'} btn-sm`}
              style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '999px', textDecoration: 'none' }}
              onClick={(e) => e.stopPropagation()}
            >
              {isLive ? 'Join' : 'View'} <ChevronRight size={14} style={{ marginLeft: '2px' }} />
            </Link>
```

No className, layout, or other markup changes.

- [ ] **Step 4: Verify the build**

Run: `cd prototype_v2/ferrobid && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual check**

Run: `cd prototype_v2/ferrobid && npm run dev`, open `#/home/marketplace`.
Expected: clicking anywhere on a card body (not on "Subscribers only" or "Join"/"View") navigates to `#/home/catalogue/<id>` (will 404-render until Task 4 lands — that's expected at this point in the plan). Clicking "Subscribers only" or "Join"/"View" still navigates only to `#/home/pricing`, not the card's detail page. Tabbing to a card and pressing Enter or Space also navigates to the detail URL.

- [ ] **Step 6: Commit**

```bash
git add prototype_v2/ferrobid/src/guest1/components/AuctionCard.jsx
git commit -m "feat(guest1): navigate to catalogue detail on AuctionCard click, keep /pricing links working"
```

---

### Task 4: Guest catalogue detail page + route + stylesheet

**Files:**
- Create: `prototype_v2/ferrobid/src/guest1/pages/CatalogueDetail.jsx`
- Create: `prototype_v2/ferrobid/src/guest1/styles/catalogue-detail.css`
- Modify: `prototype_v2/ferrobid/src/guest1/App.jsx`

**Interfaces:**
- Consumes: `useStore`, `catalogueUiStatus` from `../../store/store`; `inr`, `fmtDateTime`, `relTime` from `../../lib/format`; `Breadcrumb` from `../components/PageShell`.
- Produces: `CatalogueDetail` component, routed at `/catalogue/:id` (→ `#/home/catalogue/:id`).

- [ ] **Step 1: Create the stylesheet**

Create `prototype_v2/ferrobid/src/guest1/styles/catalogue-detail.css`:

```css
/* Guest-only catalogue detail (#/home/catalogue/:id) — layered on top of the
   shared .res-hero / .res-facts scaffolding from resources.css; only the
   pieces unique to this page (status pill, info cards, lot list) live here. */

.cat-detail-badges {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.cat-detail-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.cat-detail-status.is-live,
.cat-detail-status.is-closing {
  background: rgba(228, 87, 46, 0.1);
  color: var(--primary-hover);
}
.cat-detail-status.is-upcoming {
  background: rgb(43 76 126 / 0.1);
  color: var(--color-steel, #2b4c7e);
}
.cat-detail-status.is-closed {
  background: rgb(28 25 23 / 0.07);
  color: var(--text-muted);
}
.cat-detail-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: cat-detail-pulse 1.6s ease-in-out infinite;
}
@keyframes cat-detail-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

.cat-detail-code {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.cat-detail-body {
  padding-top: 40px;
  padding-bottom: 56px;
}

.cat-detail-section {
  margin-bottom: 40px;
}

.cat-detail-section-title {
  font-family: var(--font-heading);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--dark);
  margin: 0 0 16px;
}

.cat-detail-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.cat-detail-info-card {
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-white);
}

.cat-detail-info-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin: 0 0 8px;
}
.cat-detail-info-label svg { color: var(--primary); flex: none; }

.cat-detail-info-value {
  font-size: 14.5px;
  font-weight: 600;
  color: var(--dark);
  margin: 0;
}

.cat-detail-info-sub {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  color: var(--text-muted);
  margin: 4px 0 0;
}

.cat-detail-lots {
  display: grid;
  gap: 12px;
}

.cat-detail-lot {
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-white);
}

.cat-detail-lot-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-bottom: 8px;
}

.cat-detail-lot-no {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  color: var(--primary);
}

.cat-detail-lot-metal {
  font-size: 14px;
  font-weight: 700;
  color: var(--dark);
}

.cat-detail-lot-hazard {
  padding: 2px 9px;
  border-radius: 999px;
  background: rgb(180 83 9 / 0.1);
  color: var(--color-warning, #b45309);
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cat-detail-lot-desc {
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--text-muted);
  margin: 0 0 12px;
}

.cat-detail-lot-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 20px;
  font-size: 12.5px;
  color: var(--text-muted);
}
.cat-detail-lot-stats strong {
  color: var(--dark);
  font-weight: 700;
}
.cat-detail-lot-status {
  margin-left: auto;
  text-transform: capitalize;
}

.cat-detail-cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  padding: 28px 32px;
  border-radius: 16px;
  background: var(--bg-alt);
  border: 1px solid var(--border);
}
.cat-detail-cta h2 {
  font-family: var(--font-heading);
  font-size: 19px;
  font-weight: 700;
  color: var(--dark);
  margin: 0 0 6px;
}
.cat-detail-cta p {
  font-size: 13.5px;
  color: var(--text-muted);
  margin: 0;
}

.cat-detail-404 {
  max-width: 560px;
  margin: 0 auto;
  text-align: center;
  padding: 80px 0;
}

@media (max-width: 640px) {
  .cat-detail-cta { flex-direction: column; align-items: flex-start; }
  .cat-detail-lot-status { margin-left: 0; }
}
```

- [ ] **Step 2: Create the page component**

Create `prototype_v2/ferrobid/src/guest1/pages/CatalogueDetail.jsx`:

```jsx
import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Building2, Calendar, Clock, Layers, MapPin,
  ShieldCheck, Timer, Wallet,
} from 'lucide-react';
import { Breadcrumb } from '../components/PageShell';
import { useStore, catalogueUiStatus } from '../../store/store';
import { inr, fmtDateTime, relTime } from '../../lib/format';
import '../styles/enterprise.css';
import '../styles/resources.css';
import '../styles/catalogue-detail.css';

const STATUS_LABEL = {
  live: 'Live now',
  closing: 'Closing soon',
  upcoming: 'Upcoming',
  closed: 'Closed',
};

export const CatalogueDetail = () => {
  const { id } = useParams();
  const catalogues = useStore((s) => s.catalogues);
  const lots = useStore((s) => s.lots);
  const users = useStore((s) => s.users);

  const cat = catalogues.find((c) => c.id === id && c.status !== 'draft');

  if (!cat) {
    return (
      <div className="ent-page">
        <div className="container">
          <div className="cat-detail-404">
            <h2 className="ent-title" style={{ marginBottom: '12px' }}>Catalogue not found</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
              This listing may have closed or the link may be out of date.
            </p>
            <Link to="/marketplace" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              <ArrowLeft size={16} /> Back to the marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const catLots = lots.filter((l) => l.catalogueId === cat.id);
  const seller = users.find((u) => u.id === cat.sellerId);
  const uiStatus = catalogueUiStatus(cat, Date.now());
  const emdFrom = catLots.length ? Math.min(...catLots.map((l) => l.preBidEmd)) : 0;
  const emdTo = catLots.length ? Math.max(...catLots.map((l) => l.preBidEmd)) : 0;

  return (
    <div className="ent-page cat-detail">
      <header className="res-hero cat-detail-hero">
        <div className="container">
          <Breadcrumb items={[{ label: 'Marketplace', to: '/marketplace' }, { label: cat.title }]} />

          <motion.div
            className="res-hero-inner"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="cat-detail-badges">
              <span className={`cat-detail-status is-${uiStatus}`}>
                {(uiStatus === 'live' || uiStatus === 'closing') && <span className="cat-detail-status-dot" />}
                {STATUS_LABEL[uiStatus]}
              </span>
              <span className="cat-detail-code">{cat.code}</span>
            </div>
            <h1 className="res-hero-title">{cat.title}</h1>
            <p className="res-hero-lead">{cat.description}</p>

            <ul className="res-facts">
              <li>
                <p className="res-fact-label"><Layers size={12} aria-hidden="true" />Lots</p>
                <p className="res-fact-value">{catLots.length}</p>
              </li>
              <li>
                <p className="res-fact-label"><MapPin size={12} aria-hidden="true" />Location</p>
                <p className="res-fact-value">{cat.region}</p>
              </li>
              <li>
                <p className="res-fact-label"><Wallet size={12} aria-hidden="true" />EMD range</p>
                <p className="res-fact-value">{inr(emdFrom)}&ndash;{inr(emdTo)}</p>
              </li>
              <li>
                <p className="res-fact-label"><Clock size={12} aria-hidden="true" />
                  {uiStatus === 'upcoming' ? 'Starts' : 'Ends'}
                </p>
                <p className="res-fact-value">
                  {relTime(uiStatus === 'upcoming' ? cat.startsAt : cat.endsAt, Date.now())}
                </p>
              </li>
            </ul>
          </motion.div>
        </div>
      </header>

      <div className="container cat-detail-body">
        <section className="cat-detail-section">
          <h2 className="cat-detail-section-title">Seller &amp; yard</h2>
          <div className="cat-detail-info-grid">
            <div className="cat-detail-info-card">
              <p className="cat-detail-info-label"><Building2 size={13} /> Seller</p>
              <p className="cat-detail-info-value">{seller?.firm ?? 'Verified Seller'}</p>
              {seller?.sellerVerified && <p className="cat-detail-info-sub"><ShieldCheck size={12} /> KYC verified</p>}
            </div>
            <div className="cat-detail-info-card">
              <p className="cat-detail-info-label"><MapPin size={13} /> Yard</p>
              <p className="cat-detail-info-value">{cat.yardName}</p>
              <p className="cat-detail-info-sub">{cat.yardAddress}</p>
            </div>
            <div className="cat-detail-info-card">
              <p className="cat-detail-info-label"><Clock size={13} /> Inspection contact</p>
              <p className="cat-detail-info-value">{cat.inspectionContact.name}</p>
              <p className="cat-detail-info-sub">{cat.inspectionContact.role} &middot; {cat.inspectionContact.phone}</p>
            </div>
          </div>
        </section>

        <section className="cat-detail-section">
          <h2 className="cat-detail-section-title">Timing</h2>
          <div className="cat-detail-info-grid">
            <div className="cat-detail-info-card">
              <p className="cat-detail-info-label"><Calendar size={13} /> Auction window</p>
              <p className="cat-detail-info-value">{fmtDateTime(cat.startsAt)}</p>
              <p className="cat-detail-info-sub">to {fmtDateTime(cat.endsAt)}</p>
            </div>
            <div className="cat-detail-info-card">
              <p className="cat-detail-info-label"><Calendar size={13} /> Inspection window</p>
              <p className="cat-detail-info-value">{fmtDateTime(cat.inspectionFrom)}</p>
              <p className="cat-detail-info-sub">to {fmtDateTime(cat.inspectionTo)} &middot; {cat.inspectionHours}</p>
            </div>
            <div className="cat-detail-info-card">
              <p className="cat-detail-info-label"><Timer size={13} /> EMD deadline</p>
              <p className="cat-detail-info-value">{fmtDateTime(cat.emdDeadline)}</p>
            </div>
          </div>
        </section>

        <section className="cat-detail-section">
          <h2 className="cat-detail-section-title">Lots in this catalogue</h2>
          <div className="cat-detail-lots">
            {catLots.map((lot) => (
              <div className="cat-detail-lot" key={lot.id}>
                <div className="cat-detail-lot-head">
                  <span className="cat-detail-lot-no">{lot.lotNo}</span>
                  <span className="cat-detail-lot-metal">{lot.metal}{lot.grade ? ` — ${lot.grade}` : ''}</span>
                  {lot.hazardous && <span className="cat-detail-lot-hazard">Hazardous</span>}
                </div>
                <p className="cat-detail-lot-desc">{lot.description}</p>
                <div className="cat-detail-lot-stats">
                  <span><strong>{lot.indicativeQty} {lot.uom}</strong> indicative qty</span>
                  <span><strong>{inr(lot.startRate)}</strong> starting rate/{lot.uom}</span>
                  <span><strong>{inr(lot.preBidEmd)}</strong> pre-bid EMD</span>
                  <span className="cat-detail-lot-status">{lot.status.replace(/_/g, ' ')}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="cat-detail-cta">
          <div>
            <h2>Ready to bid on this catalogue?</h2>
            <p>Create a free account to fund EMD and join the room when it goes live.</p>
          </div>
          <Link to="/pricing" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Create an account to bid <ArrowRight size={16} />
          </Link>
        </section>
      </div>
    </div>
  );
};

export default CatalogueDetail;
```

- [ ] **Step 3: Register the route in `App.jsx`**

Find:

```jsx
import { Marketplace } from './pages/Marketplace';
```

Add immediately after it:

```jsx
import { Marketplace } from './pages/Marketplace';
import { CatalogueDetail } from './pages/CatalogueDetail';
```

Find:

```jsx
        <Route path="/marketplace" element={<Marketplace />} />
```

Add immediately after it:

```jsx
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/catalogue/:id" element={<CatalogueDetail />} />
```

- [ ] **Step 4: Verify the build**

Run: `cd prototype_v2/ferrobid && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual check — happy path and not-found**

Run: `cd prototype_v2/ferrobid && npm run dev`.
- Open `#/home/marketplace`, click a card → lands on `#/home/catalogue/<id>` showing breadcrumb (Home → Marketplace → catalogue title), status badge, code, description, EMD/lots/location facts, seller & yard info, timing, and every lot in the catalogue with metal/grade/qty/rate/EMD/status.
- Open `#/home/catalogue/does-not-exist` directly → "Catalogue not found" message renders with a working link back to `#/home/marketplace`.
- Confirm `#/home/marketplace` itself is still pixel-identical to before this change (no CSS/layout drift — only data and click behavior changed, per Tasks 2–3).

- [ ] **Step 6: Commit**

```bash
git add prototype_v2/ferrobid/src/guest1/pages/CatalogueDetail.jsx prototype_v2/ferrobid/src/guest1/styles/catalogue-detail.css prototype_v2/ferrobid/src/guest1/App.jsx
git commit -m "feat(guest1): add read-only catalogue detail page at #/home/catalogue/:id"
```

---

### Task 5: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Full click-through against the design spec's Testing section**

Run: `cd prototype_v2/ferrobid && npm run dev`. In a browser:

1. `#/home/marketplace` shows the same catalogues (minus draft/closed) that appear on `#/buyermarketplace` (switch role to Buyer via the role switcher, or open `#/buyer/browse`, to cross-check titles/codes match minus the 1 draft + 3 closed catalogues in the seed data).
2. Category/seller/location filters, search, sort (Ending Soonest / Recently Added / Price Low-High / Price High-Low), and pagination all work against the real data.
3. Clicking a card → lands on `#/home/catalogue/:id` with correct catalogue + lots. Clicking "Subscribers only" or "Join"/"View" on a card → still goes to `#/home/pricing`, not the detail page.
4. `#/home/catalogue/does-not-exist` → not-found state renders with a link back to marketplace.
5. `#/home/marketplace` layout/CSS matches the pre-change version (compare against `git show HEAD~4:prototype_v2/ferrobid/src/guest1/pages/Marketplace.jsx` rendering if in doubt — only data/click behavior should differ).

- [ ] **Step 2: Confirm no regressions on the buyer app**

Open `#/buyermarketplace` and `#/catalogue/<some-id>` (buyer `AuctionDetail`) — confirm both are unaffected (Task 1–4 touched only `src/guest1/**`).
