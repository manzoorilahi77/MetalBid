# Phase 28, Step 1 — lot-status transition enumeration (decision only, no code change)

**Type:** audit. Produced no commit — this step's job was to enumerate every existing
place in the codebase that checks or enforces a lot-status transition, ahead of
building the shared transition table (Phase 28's Step 2/3). Per the standing rule, an
inconsistency between two places checking "the same" transition differently had to be
reported and stopped on, not silently resolved.

Source material: `application/lotTransitions.ts`'s and `application/lotResolution.ts`'s
doc comments (both cite Step 1's audit directly), plus this session's own record of
the finding as reported and approved across Phases 28b/28c/28-Step2-3.

## What Step 1 found

- **`setLotStatus`** — a raw, fully unguarded Zustand setter. Four real UI transitions
  routed through it (Pipeline.tsx's Resolve action; Settlement.tsx's approveSale,
  markUnsold, returnToPipeline) with zero role or status check at the store layer —
  each page's route access and array-filtering were the only thing standing between a
  caller and the write.
- **`submitInspection`, `decideLot`, `waiveInspection`, `publishCatalogue`** — none had
  a status guard; three of the four also had no role guard at the time of this audit.
  Later confirmed (Phase 28's Step 2/3) as *intentional* design, not an oversight:
  these four legitimately accept a lot in any status — re-inspection and re-decision
  are meant to be possible regardless of where a lot currently sits.
- **`publishDraftCatalogue`** — the one writer in this cluster with a real status
  precondition: every lot in the catalogue must be `'approved'`, enforced with a
  count-and-pluralize error message ("3 lots still need approval") rather than a
  single-lot check.
- **Permanently excluded, confirmed still out of scope:** `closeDueLots`,
  `cancelCatalogue`, `voidBid`, and `placeBid` (in `bidding.mjs`) — all covered by
  CLAUDE.md's standing exclusions (scheduler engine, live-sale floor controls,
  server-authoritative bidding), not touched by this audit or by any phase in this
  project.

## The inconsistency that was reported and stopped on

Two families of lot-status writers existed side by side with no shared enforcement
model: a **UI-trust family** (`setLotStatus`'s four real transitions — guarded only by
which page rendered which button) and a **defense-in-depth family** (writers that
already checked role and/or status for themselves, independent of the calling page).
Per the standing rule, this was reported to the user as a decision to make — which
family was the actual intended design, not something to silently pick a winner for —
rather than fixed inline during the audit.

## Decision and disposition

The `setLotStatus` gap was treated as a genuine defect (same family as Phase 21's
findings #3 and #4: a UI-only gate with no store-layer enforcement), not an
intentional escape hatch. Fixed across two follow-on phases:

- **Phase 28b** (commits `20095d6`, `1ae04e3`): four named, guarded application-layer
  actions replaced the four real `setLotStatus` call sites; the raw setter was then
  confirmed unused and deleted.
- **Phase 28c** (commit `ca42133`): role guards added to `submitInspection` and
  `publishCatalogue` (the two writers still ungated after 28b). No status guard was
  added to either — confirmed as intentional design, not left open by omission.

Both are treated as this project's second deliberate behavior-change exception (Phase
21/22's finding pair being the first) — see Phase 30's final report, Section 6.

After both fixes landed, Step 1's enumeration was re-run twice (once after 28b, once
after 28c) to confirm the UI-trust/defense-in-depth split no longer existed before
Phase 28's Step 2/3 (the shared transition table, commit `29e1dba`) was built on top
of it.
