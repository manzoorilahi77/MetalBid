# Prompt: Buyer pre-auction flow — dashboard, EMD deadline, Bid Now shortcut

Drafted via `/prompt-coach`. Target: a Claude Code session working in
`prototype_v2/ferrobid`. Paste the block below as the task prompt.

## Background

Buyers currently have a confusing path from browsing an auction to actually
bidding: the dashboard's "needs attention" EMD-shortfall card is hardcoded to
one catalogue (`cat-1`), there's no concept of an EMD deadline (buyers must
pay EMD 1-2 days before an auction goes live, but nothing in the app enforces
or reminds them of this), and "enter the bidroom" is gated by three separate,
slightly different implementations scattered across the dashboard,
`AuctionDetail.tsx`, and `Shortlist.tsx`.

Explored three dashboard redesigns (a pipeline board, a calendar/schedule
view, and a ranked action feed) as clickable prototypes before deciding.
Landed on the action-feed direction — live auctions pinned to the top,
everything else sorted by EMD urgency — plus a new "Bid Now" header shortcut
that walks a buyer through picking a live auction, reviewing its lots,
clearing any pending EMD, confirming terms, and entering the bidroom, all
through one consistent gate reused by every existing entry point too.

## The prompt

```
Goal:
Redesign the buyer's pre-auction journey in prototype_v2/ferrobid/ so it's easy to go
from browsing an auction to sitting in the bidding room, given that EMD must be paid
1-2 days before an auction goes live. Specifically:

1. Rework the buyer dashboard (src/pages/buyer/Dashboard.tsx) into an "action feed": a
   live, funded auction pins to the top with a one-tap "Enter bidroom" button; every
   other upcoming auction the buyer has shortlisted lots in appears as a row below,
   sorted by EMD fund-by urgency (soonest first), each row showing a 4-step stage label
   (Shortlisted -> Fund EMD -> Waiting -> Bidroom) with the current step highlighted.
   Fix the existing EMD-shortfall card, which is hardcoded to catalogue 'cat-1'
   (Dashboard.tsx ~line 49-50) - it must aggregate shortfall across ALL of the buyer's
   shortlisted catalogues, not just one.
2. Add an EMD deadline concept that doesn't exist today: extend the Catalogue type with
   an `emdDeadline` (auction start minus 1-2 days, configurable) and enforce it in
   `fundEmd()` - funding after the deadline should be blocked with a clear message.
   Add an in-app reminder banner/toast when a shortlisted catalogue's EMD deadline is
   within 24 hours and still has unfunded lots.
3. Add a "Bid Now" button to the buyer's header/nav (visible wherever a buyer is signed
   in) that opens a modal flow:
   a. List every LIVE catalogue where the buyer has at least one shortlisted lot ("my
      auctions"). Empty state if none.
   b. Tapping one opens a lot list showing EVERY lot in that catalogue (not just
      shortlisted ones), each with a star toggle to shortlist/unshortlist right there,
      and a status tag per lot: "Not shortlisted" / "EMD paid" / "EMD pending". An
      "Enter bidding room" button at the bottom is disabled with a hint ("Shortlist at
      least one lot to continue") if nothing is shortlisted.
   c. Tapping "Enter bidding room": if any shortlisted lot in that catalogue has unpaid
      EMD, show a popup listing the pending lots and their total EMD due, with a "Pay"
      action and a "Cancel" action. Cancel returns to the auctions list from step (a).
      Paying funds all pending lots for that catalogue (reuse `fundEmd()`), then
      continues automatically to the next step.
   d. A terms-and-conditions step: "Have you read the terms and conditions?" with a
      checkbox; the "Enter bidding room" button stays disabled until checked. On
      confirm, navigate into `/bidding/:catalogueId` for that catalogue.
4. Wire the SAME sequence (pending-EMD check -> terms check -> navigate) underneath
   every existing "Enter bidroom" / "Enter" trigger already in the app - the dashboard,
   AuctionDetail.tsx's sticky bottom bar, buyer/Shortlist.tsx's per-lot Bid button, and
   buyer/Bids.tsx's "Go to bidding room" button - so there is exactly one gating rule
   for entering the bidroom, not several slightly different ones.

Evidence:
No bug/error - this is a UX redesign. Concretely broken/missing today, confirmed by
reading the code:
- Dashboard's EMD-shortfall "needs attention" card only ever looks at `cat-1`
  (`const cat1 = catalogues.find(c => c.id === 'cat-1')`, Dashboard.tsx ~line 49-50).
- `Catalogue` (types.ts:51-74) has no EMD-deadline field, and `fundEmd()`
  (store.ts:515-556) has zero time-based validation - EMD can currently be funded at
  any time, including after the catalogue goes live.
- There is no reminder/notification mechanic tied to EMD timing anywhere in the app.
- EMD/terms gating is currently implemented three separate times with slightly
  different logic (AuctionDetail.tsx sticky bar, BiddingRoom.tsx's own gate, and
  Shortlist.tsx), which is exactly the inconsistency step 4 above is meant to remove.

Context:
- App: prototype_v2/ferrobid/ - React 19 + Vite + TypeScript + Tailwind v4 (CSS-first
  config, no tailwind.config.js) + Zustand, HashRouter, no backend (mock data + client
  state).
- Data model to build on top of, not replace: `BuyerLotSelection` in types.ts:322-328
  (`{buyerId, catalogueId, lotIds, emdFundedLotIds}`), the `selections` store slice, and
  `selectionSummary()` (store.ts:1102) which already derives
  `{count, required, funded, shortfall, unfundedLotIds}` per buyer/catalogue - reuse
  this selector rather than recomputing shortlist/funded state ad hoc.
- Key files: src/pages/buyer/Dashboard.tsx, src/pages/AuctionDetail.tsx,
  src/pages/BiddingRoom.tsx, src/pages/buyer/Shortlist.tsx, src/pages/buyer/Bids.tsx,
  src/store/store.ts (`fundEmd`, `toggleShortlist`, `selectionSummary`,
  `termsAccepted`), src/types.ts, src/layout/Chrome.tsx (nav/header, `NAV_BY_ROLE`).
- Design system: src/index.css defines the actual palette as CSS variables (ember
  `#e4572e` primary, steel `#2b4c7e` secondary, full light/dark token set) and
  src/components/ui.tsx holds the real `Button`, `Chip`/`StatusChip`, `Modal`, `Stat`,
  `Countdown` components - reuse these rather than introducing new visual patterns.
  `Modal` already renders as a bottom sheet on mobile / centered card on desktop, which
  is what the Bid Now flow's modal chain (steps 3a-3d above) should be built on.

Constraints:
- Do not change the mechanics of `fundEmd()` beyond adding the deadline check - wallet
  debit, `emdLocked` credit, and ledger entry creation must stay exactly as they are.
- Do not change the shape of `BuyerLotSelection` or the `selections` store slice -
  extend `Catalogue` with the new deadline field instead of restructuring how
  shortlist/EMD state is stored.
- Do not change seller, field-exec, exec-manager, sub-admin, or admin pages or their
  data. `AuctionDetail.tsx` and `BiddingRoom.tsx`/`Browse.tsx` are shared with
  guest/exec_manager views - their non-buyer rendering paths must keep working
  unchanged.
- Do not introduce a new component library or styling approach - use the existing
  `Button`/`Chip`/`Modal`/`Stat` primitives and CSS variable tokens from
  src/components/ui.tsx and src/index.css.
- [Judgment call - confirm or override]: the new unified gate (step 4) always shows the
  terms-and-conditions checkbox on every entry into the bidroom, even if
  `termsAccepted` was already recorded true for that catalogue elsewhere. This matches
  what was explicitly decided for the "Bid Now" shortcut, generalized to all entry
  points for consistency. If you'd rather keep the existing skip-if-already-accepted
  behavior for the pre-existing entry points and only force the checkbox every time via
  the new Bid Now shortcut specifically, say so before this is built.

Done when:
- A buyer with a mix of an upcoming catalogue (some lots funded, some not) and a live
  catalogue (fully funded) sees: the live one pinned at the top of the dashboard with a
  working "Enter bidroom" button, and the upcoming one as a row showing its correct
  stage label and EMD-pending status.
- Shortlisting a lot on any upcoming catalogue and funding its EMD makes the aggregate
  "needs attention"/shortfall figure update correctly regardless of which catalogue ID
  it is (not just 'cat-1').
- Attempting to fund EMD after that catalogue's `emdDeadline` has passed is blocked
  with a clear message.
- Clicking "Bid Now" in the header, picking a live auction with 5 lots where 3 are EMD-
  funded and 2 are not, clicking "Enter bidding room" shows the 2 pending lots and their
  correct total, paying funds them, and the flow continues straight to the terms
  checkbox and then into `/bidding/:catalogueId` - without a page reload or losing
  context.
- The same pending-EMD-then-terms sequence is demonstrably identical whether triggered
  from the dashboard, AuctionDetail's sticky bar, Shortlist.tsx, Bids.tsx, or the new
  Bid Now shortcut.
- A buyer with zero shortlisted lots in a given catalogue is blocked from entering its
  bidroom with a clear message, from every entry point.

Size:
This spans multiple files and a data-model addition - plan the approach first, then
build in reviewable steps, roughly: (1) extend `Catalogue` with `emdDeadline` +
enforce it in `fundEmd()` + add the 24h reminder banner, (2) rebuild the dashboard as
the action-feed layout with the fixed aggregate shortfall logic, (3) build the unified
pending-EMD -> terms -> navigate gate as a single reusable piece of logic/component,
(4) wire the Bid Now header button and its modal chain on top of that shared gate, then
(5) replace the existing separate gating logic in AuctionDetail/BiddingRoom/Shortlist/
Bids with calls into that same shared gate. Optional stretch, flag separately rather
than bundling in silently: `Browse.tsx` and `buyer/Marketplace.tsx` are near-duplicate
pages and could be consolidated, but that wasn't part of the original ask - call it out
as a separate follow-up rather than doing it as a side effect of this change.
```
