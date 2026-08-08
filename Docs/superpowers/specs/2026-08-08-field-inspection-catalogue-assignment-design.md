# Field Inspection & Catalogue Assignment — Design Spec

**Repo:** `prototype_v2/ferrobid` (React 19 + Vite + TS, client-only prototype, single Zustand-style store)
**Roles in scope:** `field_exec` (Field Executive Officer), `exec_manager` (Executive Manager)
**Date:** 2026-08-08

## 1. Purpose

Realign the app's lot lifecycle with the client's actual business process, and rebuild the Field Executive's inspection experience to match it:

> Seller creates a lot and sends it for approval → Executive Manager bundles submitted lots into a catalogue and assigns the whole catalogue to one Field Executive → the Field Executive, working off that assigned catalogue's full information, visits the yard(s) and inspects the lots in it one by one.

Today's code does the opposite: `CatalogueBuilder.tsx` only pulls lots that are already inspected and approved (`status === 'approved'`) into a catalogue, and publishing a catalogue opens it for bidding immediately. There is no "assigned, awaiting field visit" state, and the Field Executive's queue (`src/pages/field/Queue.tsx`) is a flat list of individual lots with no batching or catalogue context. This spec reorders the lifecycle so cataloguing and assignment happen before inspection, and rebuilds both roles' screens around that order.

## 2. Revised lifecycle

1. **Seller submits a lot.** Unchanged — `createLot` already sets `status: 'pending_inspection'` (confirmed at `src/store/store.ts:757`) and logs "submitted … for inspection." This status already means exactly what the client described as "sends for approval"; no new status or field is needed here.
2. **Executive Manager builds a catalogue** from the pool of `pending_inspection`, uncatalogued lots (today it wrongly pools `approved` lots — see §5.1).
3. **Executive Manager assigns the catalogue** to one Field Executive. New terminal step in the builder, replacing today's immediate publish. The catalogue is saved with `status: 'draft'` (this value already exists in `CatalogueStatus`, confirmed at `src/types.ts:18` — but nothing sets it today) and a new `assignedFieldExecId`. Bidding does not open yet.
4. **Field Executive works the assigned catalogue.** Their queue lists catalogues assigned to them, not raw lots. Drilling in shows the catalogue's full info and the list of lots inside it (the "catalogue inside a catalogue"), then a per-lot detail page, then the existing inspection form.
5. **Field Executive inspects each lot.** Unchanged — existing `submitInspection` action, existing `InspectLot.tsx` form. Result: `inspected` / `flagged` / `rejected`.
6. **Executive Manager reviews inspected lots.** Unchanged — existing `LotApproval.tsx` / `Pipeline.tsx` screens and `setLotStatus` action. Result: `approved` (or sent back).
7. **Executive Manager publishes the catalogue.** New action, available once every lot in a draft catalogue is `approved` (or waived — see §2.1). Flips the catalogue from `draft` to `live`/`upcoming`, reusing today's publish semantics.

No new `LotStatus` values are introduced. The existing `pending_inspection → inspected → approved → live` chain is preserved; only when cataloguing happens relative to inspection changes. (Verification confirmed `LotStatus` also has three resolution values not otherwise referenced by this spec — `sold`, `sta`, `unsold`, set later by `closeDueLots()` — these are untouched and out of scope here.)

### 2.1 Known-seller waiver (secondary feature, same spec)

The Executive Manager can mark specific lots "waived — known seller" while building or reviewing a draft catalogue. A waived lot skips straight to `approved` without going through the Field Executive at all, via a new `waiveInspection` action (distinct from the raw, unguarded `setLotStatus`, so the waiver is auditable). Waived lots still count toward "all lots approved/waived" for the purpose of enabling catalogue publish (§2 step 7), but never appear as actionable items in the Field Executive's catalogue-detail lot list — they show there read-only with a "Waived" badge, for context only.

## 3. Data model changes

All changes are additive (no renames, no removed fields) — `src/types.ts`.

```ts
export interface Catalogue {
  // ...existing fields unchanged...
  assignedFieldExecId: string | null   // new — set when manager assigns the draft catalogue
}

export interface Lot {
  // ...existing fields unchanged...
  knownSeller: boolean          // new — seeded trust flag (prototype-level; no real Lot.sellerId exists yet)
  inspectionWaived: boolean     // new — true if approved via waiver instead of a real inspection
  waivedBy: string | null       // new — exec_manager user id
  waivedReason: string | null   // new
  waivedAt: string | null       // new — ISO timestamp
}
```

Seed data (`src/data/mock/catalogues.json`, `src/data/mock/lots.json`, loaded via `src/store/seed.ts`) needs `assignedFieldExecId: null` on existing catalogues and `knownSeller`, `inspectionWaived: false`, `waivedBy: null`, `waivedReason: null`, `waivedAt: null` on existing lots, plus a few lots with `knownSeller: true` so the waiver path is demoable.

Verification confirmed the pool for this is already partially in place: `lot-093`, `lot-094`, `lot-095` are already `pending_inspection` with `catalogueId: null` — no new lots need to be created for the builder pool, just the new fields added to all lots. No catalogue is currently `status: 'draft'` — one seeded catalogue needs to be created (or an existing one converted) to `draft` with `assignedFieldExecId` pointing at the demo field exec `u-field-1` (confirmed as `role: 'field_exec'` in `users.json`) so the new Field Executive screens (§6) aren't empty on first load.

## 4. New/changed store actions (`src/store/store.ts`)

- **`assignCatalogue(catalogueId, fieldExecId)`** — sets `assignedFieldExecId` on an existing draft catalogue. Used when a manager reassigns without rebuilding. Audits `catalogue.assign`.
- **`waiveInspection(lotId, managerId, reason)`** — sets `status: 'approved'`, `inspectionWaived: true`, `waivedBy: managerId`, `waivedReason: reason`, `waivedAt: <now>` on one lot. Does not touch `inspectionReportId` (stays `null` — there is no fabricated report). Audits `inspection.waive`.
- **`publishDraftCatalogue(catalogueId, mode: 'now' | 'schedule')`** — the "go live" step of §2 step 7. Validates every lot in `catalogueId` is `approved`/`inspectionWaived` (refuses with a toast otherwise — see §7), then sets the catalogue's status to `live`/`upcoming` and each lot's status to `live`, matching today's `publishCatalogue` status-stamping logic but operating on an already-built draft rather than constructing the catalogue object at publish time.
- **`publishCatalogue` (existing, needs a real code change)** — keep as the low-level "create catalogue row" writer, but stop calling it directly from the builder's step 4 (see §5.2); it becomes an internal helper used by the new "Assign to field executive" action, which calls it with `status: 'draft'` instead of `'live'`/`'upcoming'`.

  **Verified discrepancy to fix:** today `publishCatalogue` (`src/store/store.ts:786-802`) unconditionally stamps lots `'approved'` for any non-`'live'` status and always fires a public `notify()`. Neither is correct for a genuine draft/assignment: lots must stay `pending_inspection` when the catalogue status is `'draft'`, and no public "new catalogue" notification should fire until the catalogue actually publishes (step 7). `publishCatalogue`'s status-stamping logic needs a `'draft'` branch (lots → `pending_inspection`, no `notify()`), not just a new caller passing `'draft'` through unchanged behavior.

## 5. Phase A — Executive Manager

### 5.1 Catalogue builder pool (`src/pages/exec/CatalogueBuilder.tsx`)

Line 85 today (verified exact match):

```ts
const pool = lots.filter((l) => l.status === 'approved' && !l.catalogueId)
```

Change to:

```ts
const pool = lots.filter((l) => l.status === 'pending_inspection' && !l.catalogueId)
```

Update the step-1 empty state copy ("No approved lots match" → something like "No submitted lots match" — approval no longer gates entry to the builder, inspection does, later).

Add a per-row "Waive — known seller" toggle/action in the step-1 lot list, visible only for rows where `l.knownSeller` is true. Calls `waiveInspection`. A waived lot stays visible in the picker (still selectable into the catalogue) but shows a "Waived" chip instead of being selectable for inspection later.

### 5.2 Step 4 — replace immediate publish with assignment

Today, step 4 ("Preview & publish", confirmed 4-step wizard `s1`–`s4` at `CatalogueBuilder.tsx:14`) ends in `publish('now' | 'schedule')` (lines 138-179), which immediately constructs a `Catalogue` with `status: 'live' | 'upcoming'` and calls `publishCatalogue`, then navigates to `/catalogue/:id`.

Replace the two publish buttons (lines 486-494) with:

- **Field executive picker** — `<Select>` of users with `role === 'field_exec'`.
- **"Save & assign for inspection" button** — builds the same `Catalogue` object as today but with `status: 'draft'` and `assignedFieldExecId` set from the picker, and status-stamps its lots to stay `pending_inspection` (not `approved`/`live` as today's `publishCatalogue` does — see §4). Navigates to `/exec/pipeline` instead of the public `/catalogue/:id` buyer page, since the catalogue isn't live yet and no manager-side catalogue-detail view exists (verified — only the buyer-facing `AuctionDetail.tsx` exists today).
- Keep the "viewing as buyer" preview panel as-is — it's still useful to preview before assigning.

The wizard's step labels/copy should reflect that this step now hands off work rather than opening bidding (e.g. "4 · Preview & assign").

### 5.3 Publish gate (new, small)

Once a draft catalogue's lots are all `approved` (or `inspectionWaived`), a manager needs a one-click way to publish it. Home for this: a "Publish catalogue" button on `Pipeline.tsx`, shown per-catalogue (group draft catalogues into a small summary section above the existing Kanban board) — enabled only when 100% of that catalogue's lots are approved/waived. Calls `publishDraftCatalogue`. Disabled state should show progress, e.g. "4/6 lots approved."

**Decided during design review:** `Pipeline.tsx`'s existing per-lot "Assign field exec" button in the "pending" column (confirmed at `Pipeline.tsx:34-40` — today a toast-only stub with no real logic) is **removed**. Assignment is now catalogue-level (§5.2), so a per-lot assign action in the pending column no longer matches the model.

## 6. Phase B — Field Executive

Depends on Phase A's `assignedFieldExecId` field existing and at least one draft catalogue being assigned (seed data, §3).

### 6.1 Inspection queue (`src/pages/field/Queue.tsx`, rewritten)

Lists catalogues assigned to the current user, not raw lots (today it's `lots.filter((l) => l.status === 'pending_inspection')`, confirmed at `Queue.tsx:16` — a flat, platform-wide list with no per-exec filtering):

```ts
const myCatalogues = catalogues.filter((c) => c.status === 'draft' && c.assignedFieldExecId === me?.id)
```

Each card shows: catalogue code/title, yard/region, seller (via `Catalogue.sellerId`), lot count, inspection window (`inspectionFrom`–`inspectionTo`, `inspectionHours`), and progress — e.g. "2 of 6 lots inspected" (derive by cross-referencing `lotIds` against lots status, no new field needed). Tapping a card links to the new Catalogue Detail page (§6.2) instead of straight to an inspection form.

The existing "Recently completed" section stays as a flat, cross-catalogue list — it's a worklog, not something that benefits from batching. While rewriting this file, also drop the hardcoded `'u-field-1'` fallback baked into today's report filter (confirmed at `Queue.tsx:18`: `r.inspectorId === me?.id || r.inspectorId === 'u-field-1'`) — it should just be `me?.id`.

### 6.2 Catalogue Detail — new page (`src/pages/field/CatalogueDetail.tsx`, route `/field/catalogue/:catalogueId`)

This is the "catalogue inside a catalogue": the assignment's full context plus the list of lots to work through.

- Header: catalogue code/title, yard name + address, inspection contact (name/phone), inspection window/hours — all already on `Catalogue`, just not surfaced to the field role today.
- Lot list: one row per `lotIds` entry — lot no, grade/metal, declared qty, current status chip (`pending_inspection` / `inspected` / `flagged` / `rejected` / `approved`-with-"Waived"-badge if `inspectionWaived`). Waived lots render read-only (no action). Non-waived, not-yet-inspected lots link to the Lot Detail page (§6.3); already-inspected lots can still link there in read-only mode for reference.
- No inspection actions live on this page directly — it's a navigation/context hub, not a form.

### 6.3 Lot Detail — new page (`src/pages/field/LotDetail.tsx`, route `/field/lot/:lotId`)

Reached from the catalogue detail lot list (parent catalogue resolved via `lot.catalogueId`, no extra route param needed). Verification confirmed no `LotDetail.tsx` exists anywhere in `src/` today — this is entirely new. Content:

- Full specs & photos — metal/grade/category, declared qty + UOM, hazardous flag, description, photo gallery. Visual pattern lifted from `AuctionDetail.tsx`'s header/facts strip (confirmed reusable class strings at `AuctionDetail.tsx:112-114`: `factCls`, `factLabel`, `factVal`), scoped to a single lot instead of a whole catalogue.
- Visit/logistics — yard name/address, inspection window/hours, yard contact — read from the parent `Catalogue` (resolved via `lot.catalogueId`), not duplicated onto `Lot`.
- Inspection checklist preview — read-only rendering of the checklist items `InspectLot.tsx` will ask about, so the officer knows what's coming before starting.
- Seller trust info — seller firm (via `Catalogue.sellerId`) and a "Known seller" badge when `lot.knownSeller` is true. If the lot is already `inspectionWaived`, show that state prominently and hide/disable the "Start inspection" CTA (nothing to inspect).
- "Start inspection" CTA — links to the existing `/field/inspect/:lotId` (`InspectLot.tsx`), unchanged.

### 6.4 `InspectLot.tsx`

No changes to the form itself — it already does measured-qty variance, condition, checklist, photos, notes, and verify/flag/reject via `submitInspection`. **One change confirmed needed:** today it navigates to `nav('/field')` after submit (`InspectLot.tsx:62`), returning to the flat queue. This changes to navigate back to the Catalogue Detail page (§6.2) — `/field/catalogue/${lot.catalogueId}` — so the officer naturally continues to the next lot in the same catalogue.

## 7. Edge cases & validation

- **Publishing a catalogue with unresolved lots.** `publishDraftCatalogue` must refuse (toast: "N lots still need approval") if any lot in the catalogue is not `approved`/`inspectionWaived`. This is the one place a real guard is needed — everywhere else in the existing store, `setLotStatus` stays the deliberately-unguarded generic setter it is today.
- **Reassigning a catalogue.** If a manager calls `assignCatalogue` on a catalogue the previous field exec has already partially inspected, in-progress work (already-inspected/flagged lots) is preserved — only the assignee changes, no lot state is reset.
- **Waiving a lot already inspected.** Not a normal path (waiver is meant for pre-inspection lots), but `waiveInspection` should still be safe to call — it simply overwrites status to `approved` and stamps waiver fields; no crash, no need to special-case.
- **Field exec queue empty state.** Unchanged pattern from today's `EmptyState` usage — "No catalogues assigned" when `myCatalogues` is empty.
- **Catalogue with zero lots.** Not reachable — `CatalogueBuilder` step 1 already requires `selectedIds.length > 0` before advancing.

## 8. Out of scope

- No new roles, no changes to `sub_admin`/`super_admin`.
- No real `Lot.sellerId` linkage — `knownSeller` stays a seeded boolean flag on `Lot`, not derived from a `User.standing` lookup. Wiring a genuine seller-identity trust signal is a follow-up if the prototype moves toward real seller accounts.
- No changes to the buyer-facing `AuctionDetail.tsx` / `BiddingRoom.tsx` — a catalogue looks and behaves the same to buyers once published; only how it gets to live changes.
- No changes to `InspectLot.tsx`'s internal form fields or `submitInspection` logic (only its post-submit navigation target changes, per §6.4).
- No offline support / real geolocation for "visiting locations" — out of scope for this client-only prototype.

## 9. File map

| File | Change |
|---|---|
| `src/types.ts` | Add `Catalogue.assignedFieldExecId`, `Lot.knownSeller` / `inspectionWaived` / `waivedBy` / `waivedReason` / `waivedAt` |
| `src/store/seed.ts` (+ `src/data/mock/*.json`) | Seed new fields; ensure ≥1 draft catalogue assigned to `u-field-1`; ≥1 `knownSeller` lot |
| `src/store/store.ts` | Add `assignCatalogue`, `waiveInspection`, `publishDraftCatalogue`; adjust `publishCatalogue` status-stamping (draft branch: lots stay `pending_inspection`, no `notify()`) |
| `src/pages/exec/CatalogueBuilder.tsx` | Pool filter → `pending_inspection`; step 4 → assignment instead of publish; waiver toggle in step 1 |
| `src/pages/exec/Pipeline.tsx` | Add publish-gate section for draft catalogues; remove stub per-lot "Assign field exec" button |
| `src/pages/field/Queue.tsx` | Rewrite to list assigned catalogues; drop hardcoded `'u-field-1'` fallback |
| `src/pages/field/CatalogueDetail.tsx` | New — catalogue context + lot list |
| `src/pages/field/LotDetail.tsx` | New — lot specs/photos/logistics/checklist/seller-trust + "Start inspection" CTA |
| `src/pages/field/InspectLot.tsx` | Unchanged except post-submit navigation target |
| `src/App.tsx` | Register `/field/catalogue/:catalogueId` and `/field/lot/:lotId` routes |

## 10. Verified assumptions (from codebase check, 2026-08-08)

- Repo root for `src/` is `prototype_v2/ferrobid/`, nested under the git repo root.
- `CatalogueStatus` already includes `'draft'`; no type-level status changes needed.
- `u-field-1` (Ravi Kumar) is confirmed `role: 'field_exec'`; `u-exec-1` (Meera Nair) is confirmed `role: 'exec_manager'`.
- `lot-093`/`lot-094`/`lot-095` are already `pending_inspection` + uncatalogued — usable as the builder pool without adding new lots.
- Current-user access convention confirmed as `const me = useStore((s) => s.currentUser)`, used consistently across `field/`, `buyer/`, `seller/` pages — new pages should follow the same pattern.
- Role string comparisons use plain literal equality (e.g. `role === 'exec_manager'`), confirmed at `Settlement.tsx:39` — reuse this idiom for the field-exec picker filter.
