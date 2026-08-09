# Prompt: Browse/shortlist split, EMD & payments page, wallet cleanup, tender auctions, dashboard trim

Follow-up to `ferrobid-buyer-flow.md` (already implemented: EMD deadline model in
`src/lib/emd.ts`, the shared `BidroomGate` provider, the buyer dashboard action feed). This
prompt is self-contained — paste the block below as the task prompt in a fresh session.

## Background

The previous change built a single gate into the bidding room and an EMD-deadline model. This
round reshapes navigation and adds a second sale format:

1. The buyer's "Shortlist & EMD" page currently does two unrelated jobs — browsing/starring lots
   and paying EMD — while a separate, faceted "Browse Catalogues" page also exists. These need to
   split cleanly: one page for discovery + shortlisting, one page for paying EMD.
2. `buyer/Wallet.tsx` buries the balance/ledger behind a "Dashboard" tab instead of showing it
   immediately.
3. Every auction today is a live, ascending-price forward auction (`Catalogue.type: 'forward'`).
   Research into how MSTC/metaljunction actually run industrial scrap sales
   ([MSTC e-auction services](https://www.mstcindia.co.in/content/eauction_services.aspx),
   [MSTC e-auction guide](https://tenderkart.in/blog/mstc-auction-guide)) confirms the two formats
   buyers expect: **e-auctions** (live, ascending, price visible to all) and **e-tenders**
   (sealed bid — one confidential offer per bidder, submitted once, opened at close, no visible
   competing price). The admin decides the format per catalogue at publish time; buyers on a
   tender lot get a "type your offer, submit once" flow instead of the bid ladder.
4. The dashboard's "Your auctions" action-feed section (built last round) is being removed per
   product decision — Stats, EMD reminder, Needs your attention, and notifications stay.

## The prompt

```
Goal:
In prototype_v2/ferrobid/, split buyer discovery from EMD payment, clean up the wallet page,
introduce sealed-bid tender auctions alongside the existing forward auctions, and trim the buyer
dashboard. Five independent changes — implement and verify each on its own before moving to the
next.

1. Browse & Shortlist (upgrade src/pages/buyer/Marketplace.tsx, mounted at /buyermarketplace):
   a. Rename the page title to "Browse & Shortlist". Add a scope control above the existing
      Live/Upcoming/Closed status tabs: "All" / "Shortlisted <count>". Both dimensions combine
      (e.g. Shortlisted + Upcoming is a real, filterable view).
   b. A catalogue counts as "Shortlisted" if the buyer has watchlisted it (new — see below) OR has
      at least one starred lot in it via the existing `selections` slice.
   c. Extend src/components/domain.tsx's `CatalogueCard` with a footer row: a star toggle for the
      new catalogue-level watchlist, a "Shortlist lots" button that opens a lot-picker modal
      (every lot in the catalogue, star to shortlist/unshortlist, tags: "Not shortlisted" / "EMD
      paid" / "EMD pending" — this is the same picker built for the Bid Now flow's step (b); pull
      `LotPickerStep` out of src/components/BidroomGate.tsx into a standalone, reusable
      `LotShortlistModal` component rather than writing a second lot list), a PDF download action
      (reuse the existing toast-only demo pattern from AuctionDetail.tsx), and "View details" →
      /catalogue/:id. Also surface EMD range, yard/region, inspection window, and an
      Auction/Tender badge (see item 3) on the card.
   d. New store slice: `watchlist: { buyerId: string; catalogueId: string }[]` in
      src/store/store.ts, with a `toggleWatchlist(catalogueId)` action and a helper (e.g.
      `isCatalogueShortlisted(state, buyerId, catalogueId)`) buyer pages can call. Do NOT fold this
      into `BuyerLotSelection` or the `selections` slice — it's a separate concern (interest vs.
      committed-to-bid).
   e. Update src/layout/Chrome.tsx's buyer nav: label "Browse Catalogues" → "Browse & Shortlist".

2. EMD & payments (src/pages/buyer/Shortlist.tsx, still mounted at /buyer/shortlist):
   Strip this page down to catalogue-level only. Remove the lot rows, the per-lot "Bid" button,
   and the Live/Upcoming segmented control. Keep: the EMD reminder banner
   (src/components/EmdReminder.tsx), and one card per catalogue the buyer has shortlisted lots in,
   showing code/title/status/countdown, the EMD summary strip (N lots selected · required ·
   funded · shortfall — reuse `selectionSummary()`), a "Fund EMD" button (existing `fundEmd()`
   flow, respecting the EMD deadline guard from src/lib/emd.ts), and a "View catalogue" link to
   /catalogue/:id. No lot-level detail, no Bid CTA anywhere on this page. Sort cards by EMD
   fund-by urgency (soonest deadline first) rather than the old live/upcoming split. Update
   Chrome.tsx's nav label "Shortlist" → "EMD & payments" (sub-label can stay close to "EMD for
   shortlisted catalogues").

3. Wallet & ledger (src/pages/buyer/Wallet.tsx):
   Remove the "Dashboard" tab entirely (delete 'dashboard' from the TabKey union and the Tabs
   list). Move the 4 Stat tiles (Available balance, EMD locked, Withdrawal pending, Total) and the
   "Recent activity" list out of the tab-conditional body so they render unconditionally, directly
   below PageHeader, above the remaining tabs (Deposits, Withdrawals, Bank accounts, EMD Refunds,
   Reports). Change the default tab from 'dashboard' to 'deposits'.

4. Tender auctions — sealed-bid alongside the existing forward (live-price) auctions:
   a. Extend src/types.ts: `Catalogue.type: 'forward' | 'tender'` (was hardcoded to the literal
      'forward'). Add 'tender' to `BidType` (currently 'manual' | 'auto' | 'bot') so a tender
      offer is a normal `Bid` row — reuse the Bid/award/delivery-order pipeline unchanged rather
      than inventing a parallel data model.
   b. Buyer-facing behavior for a tender catalogue, everywhere a forward-auction lot shows a
      price/ladder:
      - No visible current rate, no H1/leading-bidder indicator, no outbid notifications, no
        auto-bid, no anti-snipe extension. The countdown-to-close still applies.
      - Instead of the bid ladder/AmountStepper in src/pages/BiddingRoom.tsx, a tender lot shows a
        single rate input (must be ≥ lot.startRate) and one "Submit offer" action. On submit,
        record it as a Bid with type: 'tender' via the existing placeBid()/applyBid() path in
        src/store/store.ts, then the lot's control disables and shows "Offer submitted ₹X" — no
        revision, no second submission, exactly one offer per buyer per lot.
      - In src/store/store.ts's `tick()` engine: skip bot-bid generation, auto-bid resolution, and
        anti-snipe extension for lots whose catalogue is type 'tender'.
      - Award/result logic (highest rate wins at close) needs no change — it already operates on
        Bid.rate.
   c. Admin sets the type when creating a catalogue: add an Auction/Tender toggle to
      src/pages/exec/CatalogueBuilder.tsx's creation flow (defaults to 'forward'), and show it
      (read-only once published, or editable pre-publish — your call, note which you picked) on
      src/pages/exec/AuctionSetup.tsx's catalogue detail.
   d. src/pages/AuctionDetail.tsx: swap the "Forward e-auction" chip for "Sealed tender" on tender
      catalogues, and hide the live-price/H1 columns in the lot list for tender lots (indicative
      start rate and EMD still show).
   e. src/pages/buyer/Bids.tsx and the `myLotResult()` helper in store.ts: tender results should
      read naturally ("Offer accepted" / "Offer not accepted" or similar) rather than "H1" /
      "outbid" language, which doesn't apply to a sealed bid.
   f. Seed one catalogue as type: 'tender' in scripts/generate-mock.mjs (regenerate
      src/data/mock/*.json with `npm run mock`) so the flow is demoable immediately on load,
      without disturbing the other seven catalogues' data or the buyer-1 selections/EMD-deadline
      scenarios built in the previous round.

5. Buyer dashboard (src/pages/buyer/Dashboard.tsx):
   Remove the "Your auctions" section entirely — the `rows`/`pinned`/`queued` computation and the
   `PinnedAuction`, `QueuedAuction`, `StageTrack` components (currently lines ~72-90 and
   ~251-360-ish; re-check exact ranges before cutting, the file has moved since). Keep everything
   else: the stat row, EmdReminderBanner, "Needs your attention", and "Recent notifications". The
   header's "Bid Now" shortcut (src/layout/Chrome.tsx) remains the one-tap route into a live
   auction and is unaffected by this removal.

Context:
- App: prototype_v2/ferrobid/ — React 19 + Vite + TypeScript + Tailwind v4 (CSS-first config) +
  Zustand, HashRouter, no backend (mock data + client state). No test runner — verify with
  `npm run build` (tsc -b + vite build) plus manual walkthroughs.
- Already built this round (do not re-implement, build on top of it):
  - src/lib/emd.ts — EMD deadline maths (`emdDeadlineMs`, `emdWindowClosed`, `emdDeadlineSoon`,
    `emdBlockedMessage`). `Catalogue.emdDeadline: string` already exists in types.ts.
  - src/components/BidroomGate.tsx — `BidroomGateProvider` + `useBidroomGate()`, mounted in
    App.tsx inside HashRouter. `enterBidroom(catalogueId, opts?)` and `openBidNow()` are the only
    entry points into a bidroom; every existing trigger (dashboard, AuctionDetail, Shortlist,
    Bids, BiddingRoom's own gate) already calls through it. Keep using it — do not reintroduce a
    second gating path for tender lots; tender entry should still go through
    `enterBidroom`/`openBidNow` for the EMD + terms steps before the sealed-bid room itself.
  - src/components/EmdReminder.tsx — `<EmdReminderBanner />`, used on Dashboard and (still) on the
    EMD & payments page.
  - The Bid Now shortcut in src/layout/Chrome.tsx (`Bid Now` button, buyer-only, calls
    `openBidNow()`).
- Key files by area:
  - Browse/shortlist: src/pages/buyer/Marketplace.tsx, src/components/domain.tsx (CatalogueCard),
    src/components/BidroomGate.tsx (LotPickerStep to extract).
  - EMD page: src/pages/buyer/Shortlist.tsx.
  - Wallet: src/pages/buyer/Wallet.tsx.
  - Tender: src/types.ts, src/store/store.ts (`applyBid`, `tick`, `myLotResult`, `placeBid`),
    src/pages/BiddingRoom.tsx, src/pages/exec/CatalogueBuilder.tsx, src/pages/exec/AuctionSetup.tsx,
    src/pages/AuctionDetail.tsx, src/pages/buyer/Bids.tsx, scripts/generate-mock.mjs,
    src/data/mock/catalogues.json (+ lots/bids as needed).
  - Dashboard trim: src/pages/buyer/Dashboard.tsx.
  - Nav labels: src/layout/Chrome.tsx (`NAV_BY_ROLE.buyer`).
- Data model already in place, reuse rather than recreate: `BuyerLotSelection` in
  types.ts:322-328 (`{buyerId, catalogueId, lotIds, emdFundedLotIds}`), the `selections` store
  slice, `selectionSummary()` (store.ts) which derives `{count, required, funded, shortfall,
  unfundedLotIds}` per buyer/catalogue, and `catalogueUiStatus()` for live/closing/upcoming/closed
  chips.
- Design system: src/index.css (CSS variable tokens, ember/steel palette) and
  src/components/ui.tsx (`Button`, `Chip`/`StatusChip`, `Modal`, `Stat`, `Countdown`, `Segmented`,
  `Tabs`) — reuse these, no new visual patterns or component libraries.

Constraints:
- Do not change the shape of `BuyerLotSelection` or the `selections` store slice. The catalogue
  watchlist is a new, separate slice.
- Do not change `fundEmd()` mechanics beyond what's already there (the EMD deadline guard from the
  previous round) — wallet debit, `emdLocked` credit, ledger entries stay as-is.
- Do not touch seller / field-exec / sub-admin / super-admin pages except where introducing the
  Catalogue.type field forces it (CatalogueBuilder, AuctionSetup) — and there, keep the change
  additive (defaults to 'forward', existing catalogues unaffected).
- Tender lots reuse the Bid/placeBid/award pipeline — do not invent a parallel "TenderOffer" data
  type or a second results/delivery-order path.
- Every entry into any bidroom (forward or tender) still goes through
  `useBidroomGate().enterBidroom()` / `openBidNow()` — do not add a second, tender-specific gate.
- No new component library. Reuse Button/Chip/Modal/Stat/Tabs/Segmented from
  src/components/ui.tsx and the CSS variable tokens in src/index.css.
- Treat the five numbered changes as independent — implement, typecheck, and manually verify each
  before starting the next, so a partial session still leaves working software.

Done when:
- /buyermarketplace is titled "Browse & Shortlist", has a working All/Shortlisted scope alongside
  the existing status tabs, and its cards support catalogue-level watchlist star, "Shortlist lots"
  (opens the shared lot picker), PDF download, and View details.
- /buyer/shortlist (nav: "EMD & payments") shows only catalogue-level EMD cards — no lot rows, no
  Bid button anywhere on the page — sorted by fund-by urgency, and funding still respects the EMD
  deadline guard.
- /buyer/wallet shows balance/EMD-locked/withdrawal-pending/total and recent activity immediately
  under the title on every tab; there is no "Dashboard" tab.
- An exec manager can mark a new catalogue as Tender in Catalogue Builder; a buyer entering that
  catalogue's bidroom sees a single rate-entry + Submit control per lot (no ladder, no H1, no
  outbid alerts), and after submitting, that lot's control is disabled showing the submitted
  amount — permanently, for that buyer, for that lot.
- The buyer dashboard no longer shows "Your auctions" / the 4-step stage track, but still shows
  stats, the EMD reminder banner, "Needs your attention", and notifications.
- `npm run build` passes (tsc -b + vite build) with no new errors.

Size:
Five independent changes. Suggested order — least to most invasive: (1) dashboard trim, (2) wallet
cleanup, (3) browse/shortlist split (includes extracting the shared lot-picker component), (4) EMD
& payments page, (5) tender auctions (touches the bidding engine, exec pages, and mock data —
build and verify this one last, on its own).
```
