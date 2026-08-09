# Prompt: Staff on-behalf-of access (buyer fulfilment + seller visibility)

Drafted via `/prompt-coach`. Target: a Claude Code session working in
`prototype_v2/ferrobid`. Paste the block below as the task prompt.

## Background

Currently, `sub_admin` and `exec_manager` cannot act on behalf of a buyer
for the post-auction-win fulfilment steps (lifting checklist, weighment,
marking lifting complete) — those are hard-locked to the buyer's own
account in the store. On the seller side there's effectively nothing to
unlock, but there's also a real capability gap: sellers have no visibility
into the delivery-order/fulfilment status of their own sold lots, and
`Lot` records aren't attributed to a seller until an exec_manager manually
assigns one during catalogue building.

This prompt scopes a fix: give staff full parity for the buyer fulfilment
lifecycle (post-win only — not bidding/wallet), and build the missing
seller-side delivery-order visibility with equivalent staff on-behalf-of
actions, in two reviewable steps.

## The prompt

```
Goal: Give sub_admin and exec_manager full "act on behalf of" parity for the
POST-AUCTION-WIN buyer fulfilment lifecycle, and build equivalent seller-side
visibility + on-behalf-of actions for the post-sale lifecycle — via an
explicit "select the buyer/seller's order, then perform the action" UI
(extending the existing pattern in Settlement.tsx), not a generic
impersonation/view-as mode. Scope excludes pre-auction actions (bidding,
wallet top-up/withdrawal, shortlist/EMD funding) — those stay buyer/seller-only.

Context:
- Buyer fulfilment lifecycle: DeliveryOrder stages payment_pending →
  dd_issued → lifting_scheduled → lifted → completed (src/types.ts,
  FulfilmentStage). Buyer-facing UI: src/pages/buyer/Fulfilment.tsx.
  Staff-facing UI today: src/pages/exec/Settlement.tsx (DD issuance +
  stage-advance, already works for sub_admin/exec_manager) and
  src/pages/exec/Logistics.tsx / Handover.tsx.
- Store actions needing an on-behalf-of path: toggleLiftingChecklistItem,
  recordWeighment, completeLifting in src/store/store.ts (~lines 634-673) —
  each is currently hard-gated to `d.buyerId === me.id` with no staff bypass.
- advanceDeliveryOrder (store.ts ~622) and issueDemandDraft already have
  adequate/no staff gating — reuse as-is, don't rewrite.
- sub_admin's own nav (NAV_BY_ROLE.sub_admin, src/layout/Chrome.tsx ~77-84)
  doesn't link to /exec/settlement even though Settlement.tsx already checks
  for sub_admin — fix that nav gap as part of this work.
- Seller side has almost nothing to unlock: createLot (store.ts ~751) is
  already ungated, and Lot has no sellerId field at all — seller ownership
  is only established later, manually, when exec_manager's CatalogueBuilder
  assigns a seller to a catalogue (CatalogueBuilder.tsx ~152). Sellers
  currently have ZERO visibility into delivery-order/fulfilment status of
  their own sold lots (no DeliveryOrder references anywhere in
  src/pages/seller/).
- Staff pages that already touch post-sale seller-facing data:
  src/pages/exec/Handover.tsx, src/pages/exec/Logistics.tsx.

Constraints:
- Do NOT extend on-behalf-of access to pre-auction-win buyer actions
  (bidding, wallet, shortlist/EMD) or to auction-integrity actions
  (extendCatalogue, cancelCatalogue, voidBid, pauseCatalogue/resumeCatalogue)
  — those stay exactly as gated today (super_admin/exec_manager only, no
  buyer/seller-impersonation angle).
- sub_admin and exec_manager get IDENTICAL access for these on-behalf-of
  actions — no further role split between them for this feature.
- Every on-behalf-of action must show a visible "acting on behalf of
  <buyer/seller name>" confirmation before it fires, and must be tagged
  distinctly in the audit trail (reuse the existing audit() store action —
  add an actor / on-behalf-of note to the message) so it's traceable as
  staff-performed, not buyer/seller-performed.
- Existing buyer/seller self-service must keep working completely unchanged
  — this is additive parity, not a replacement.
- Match existing code patterns exactly: Zustand store actions in store.ts,
  page components under src/pages/<role>/, NAV_BY_ROLE + SubNav for
  navigation, Chip/Modal/Button UI primitives from src/components/ui,
  audit() calls, pushToast() for feedback — don't introduce new
  state-management or UI libraries.

Done when:
- A sub_admin or exec_manager can, from a staff-facing page, pick any
  buyer's post-win delivery order and drive it through every fulfilment
  stage end-to-end (issue DD → advance to lifting_scheduled → tick all 3
  checklist items → record weighment → mark lifting complete) without ever
  needing the buyer's own login — by extending Settlement.tsx and/or
  Logistics.tsx.
- sub_admin's own nav actually links to wherever this lives (the current
  /exec/settlement nav gap is fixed).
- A sub_admin or exec_manager can see, for any seller, the live fulfilment
  status of that seller's sold lots (a new seller-facing delivery-order
  view, staff-operable) — first work out the cleanest way to reliably
  attribute a DeliveryOrder back to its seller from existing data
  (Catalogue.sellerId) before adding any new field.
- Every action taken this way produces a distinct, readable audit entry
  naming which staff member acted on behalf of which buyer/seller.
- Existing buyer Fulfilment.tsx and seller pages (Workspace/MyLots/
  LiveMonitor/Reports) still work exactly as before for buyer/seller logins.

Size: Plan and build in 2 reviewable steps.
Step 1 — buyer fulfilment on-behalf-of parity: unlock the 3 gated store
actions for staff use, surface them in a staff UI, fix the sub_admin nav gap.
Step 2 — seller-side delivery-order visibility + on-behalf-of actions:
work out seller attribution first, then build the view + actions.
Show me Step 1 for review before starting Step 2.
```
