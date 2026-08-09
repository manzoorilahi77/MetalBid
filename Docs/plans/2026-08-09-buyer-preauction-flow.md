# Buyer pre-auction flow — implementation plan

**Goal:** Make the buyer's path from "browsing an auction" to "sitting in the bidding room" one
consistent, EMD-deadline-aware journey: an action-feed dashboard, a real EMD fund-by deadline, and a
single gate (pending EMD → terms → navigate) reused by every bidroom entry point plus a new header
"Bid Now" shortcut.

**Architecture:** All gating rules live in two shared, UI-free places — `src/lib/emd.ts` (deadline
maths + window state) and `src/components/BidroomGate.tsx` (the one modal chain, exposed through a
React context). Pages never re-implement "can this buyer enter". This keeps the rules in one seam so
they can be swapped for real API calls later.

**Tech stack:** React 19 + Vite + TypeScript + Tailwind v4 (CSS-first) + Zustand, HashRouter, mock
JSON seed. No test runner in the project — verification is `npm run build` (tsc -b + vite build) plus
the manual walkthroughs in "Done when".

## Global constraints

- Do not change `fundEmd()` mechanics beyond the deadline check (wallet debit, `emdLocked` credit,
  ledger entries stay byte-identical).
- Do not change the shape of `BuyerLotSelection` or the `selections` slice. Extend `Catalogue`.
- Do not touch seller / field-exec / exec-manager / sub-admin / admin pages except where TypeScript
  forces a new required field. `AuctionDetail.tsx`, `BiddingRoom.tsx`, `Browse.tsx` keep their
  non-buyer render paths unchanged.
- No new component library. Reuse `Button` / `Chip` / `StatusChip` / `Modal` / `Stat` / `Countdown`
  from `src/components/ui.tsx` and the CSS variable tokens in `src/index.css`.
- Confirmed decisions: (1) the EMD deadline blocks funding **only while the catalogue is still
  `upcoming`** — the cut-off window between deadline and go-live; once live, per-lot funding keeps
  working as today. (2) The T&C checkbox is shown on **every** entry into a bidroom, from every entry
  point, even if `termsAccepted[catalogueId]` is already true.

## File structure

| File | Responsibility |
| --- | --- |
| `src/lib/emd.ts` (new) | Deadline maths: `emdDeadlineMs`, `emdWindowClosed`, `emdDeadlineSoon`, `emdBlockedMessage`, `EMD_LEAD_DAYS`. Pure, no React, no store. |
| `src/components/BidroomGate.tsx` (new) | `BidroomGateProvider` + `useBidroomGate()`. Owns the whole modal chain: auctions → lots → EMD → terms → navigate. The single gate. |
| `src/components/EmdReminder.tsx` (new) | `<EmdReminderBanner />` — shortlisted catalogues whose EMD deadline is < 24h away with unfunded lots. |
| `src/types.ts` | `Catalogue.emdDeadline: string` |
| `src/store/seed.ts` | Backfill `emdDeadline` when absent from JSON. |
| `src/store/store.ts` | Deadline guard inside `fundEmd`; set `emdDeadline` on publish/schedule. |
| `src/data/mock/*.json`, `scripts/generate-mock.mjs` | Seed `emdDeadline` per catalogue; seed buyer-1 selections that exercise every acceptance case. |
| `src/pages/buyer/Dashboard.tsx` | Action feed + aggregate shortfall. |
| `src/layout/Chrome.tsx` | "Bid Now" header/mobile-nav button for signed-in buyers. |
| `src/pages/AuctionDetail.tsx`, `src/pages/buyer/Shortlist.tsx`, `src/pages/buyer/Bids.tsx`, `src/pages/BiddingRoom.tsx` | Replace their local gating with `useBidroomGate().enterBidroom(...)`. |
| `src/App.tsx` | Mount `BidroomGateProvider` inside `HashRouter`. |

---

### Task 1 — EMD deadline data model + enforcement

**Files:** create `src/lib/emd.ts`; modify `src/types.ts`, `src/store/seed.ts`, `src/store/store.ts`,
`scripts/generate-mock.mjs`, `src/data/mock/catalogues.json`.

- `Catalogue.emdDeadline: string` (ISO). Seeded as `startsAt − EMD_LEAD_DAYS × 24h`, per-catalogue
  overridable in the generator (`emdLeadDays`), so "1–2 days" is configurable rather than hardcoded.
- `emdWindowClosed(cat, now)` = `cat.status === 'upcoming' && now > emdDeadlineMs(cat)`.
- `fundEmd()` returns `false` early when the window is closed — the only mechanic added.
- Every call site pre-checks `emdWindowClosed` so the message says "deadline passed", not
  "insufficient balance". Call sites: BidroomGate, AuctionDetail, Shortlist, BiddingRoom.
- `publishDraftCatalogue` recomputes `emdDeadline` when scheduling.

**Verify:** `npm run build` passes; `cat-4` (upcoming, lead 2 days) is past its deadline in the seed
so its funding is blocked on sight; `cat-5` (upcoming, deadline ~20h out, unfunded lots) drives the
reminder banner.

### Task 2 — Reminder banner

**Files:** create `src/components/EmdReminder.tsx`; render in `Dashboard.tsx` and `Shortlist.tsx`.

Lists each shortlisted catalogue with `emdDeadlineSoon(cat, now)` and `shortfall > 0`, showing the
countdown to the deadline and a "Fund EMD" action that opens the shared gate.

### Task 3 — Dashboard action feed + aggregate shortfall

**Files:** `src/pages/buyer/Dashboard.tsx`.

- Aggregate the shortfall across **all** of the buyer's non-closed shortlisted catalogues (delete the
  `cat-1` lookup entirely).
- Pin live + fully-funded catalogues at the top with a one-tap "Enter bidroom".
- Every other shortlisted catalogue renders a row sorted by `emdDeadline` ascending, with the 4-step
  label `Shortlisted → Fund EMD → Waiting → Bidroom`. Current step =
  `shortfall > 0 ? 'Fund EMD' : (live ? 'Bidroom' : 'Waiting')`; earlier steps render as done.

### Task 4 — The shared gate

**Files:** create `src/components/BidroomGate.tsx`; modify `src/App.tsx`.

```ts
useBidroomGate(): {
  enterBidroom(catalogueId: string, opts?: { lotId?: string }): void
  openBidNow(): void
}
```

Steps: `auctions` (live catalogues with ≥1 shortlisted lot; empty state) → `lots` (every lot in the
catalogue, star toggle, `Not shortlisted` / `EMD paid` / `EMD pending` tag, CTA disabled with a hint
until something is shortlisted) → `emd` (pending lots + total, Pay / Cancel; Cancel returns to
`auctions` when the flow began at Bid Now, otherwise closes) → `terms` (checkbox, always shown) →
`navigate('/bidding/:catalogueId')`.

`enterBidroom` refuses with a toast when the buyer has zero shortlisted lots in that catalogue, and
skips straight to `terms` when nothing is unfunded.

### Task 5 — Bid Now button + rewiring every entry point

**Files:** `src/layout/Chrome.tsx`, `src/pages/buyer/Dashboard.tsx`, `src/pages/AuctionDetail.tsx`,
`src/pages/buyer/Shortlist.tsx`, `src/pages/buyer/Bids.tsx`, `src/pages/BiddingRoom.tsx`.

- Chrome: "Bid Now" in the desktop header and the mobile menu, for signed-in buyers only.
- AuctionDetail sticky bar: both branches collapse into `enterBidroom(cat.id)`; its local
  `FundEmdModal` / `payOpen` state is removed.
- Shortlist per-lot Bid, Bids' "Go to bidding room" (preserving `?lot=`), Dashboard rows and
  BiddingRoom's own EMD gate screen and `gateOr` all call `enterBidroom`.

## Out of scope — flag, don't do

`Browse.tsx` and `buyer/Marketplace.tsx` are near-duplicates and could be consolidated. Not part of
this change; raise as a follow-up.
