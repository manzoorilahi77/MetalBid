## DDD/SOLID Refactor — Standing Rules (applies to every refactor phase)

ABSOLUTE RULE: this is a behavior-preserving refactor, not a redesign. Never change
business logic, workflows, RBAC, permissions, API contracts, database schema/behavior,
mock/seed data, UI output, routes, the Zustand public API, persistence behavior,
notification wording/recipients, audit strings, thresholds, rounding, financial
calculations, status semantics, error behavior, or concurrency behavior. If something
looks wrong, document it — do not fix it, unless a phase explicitly says otherwise.

PERMANENT EXCLUSIONS (never touch, no phase overrides this without a dedicated,
explicitly-scoped decision):
- placeBid, fundEmd, and all server-authoritative bidding/EMD logic
- the scheduler engine: tick, closeDueLots, live-sale floor controls
  (pause/resume/extend/cancelCatalogue, voidBid), and other auction-lifecycle-core actions
- all of sessionSlice.ts (auth/session)
- guest1/ (separate untyped auth world)
- database schema, migrations, triggers

PATTERN: Zustand action → application planning/use-case function → existing pure
domain/lib functions → returned plan/result → Zustand applies set()/audit()/notify()/
notifyRole(). No new repositories/gateways/ports/DI frameworks/service classes/
factories unless the code demonstrates a real existing boundary.

TESTING: characterization tests first, against the CURRENT implementation, green
baseline — THEN refactor — THEN same tests green again. Never write tests that assert
new/"corrected" behavior unless a phase explicitly says this is a behavior-change phase.

PER-CANDIDATE SAFETY: if any individual action/file is ambiguous, under-tested, or
touches a permanent exclusion, skip just that one and continue with the rest — don't
skip the whole phase over one hard case, and don't guess.

VERIFICATION before calling any phase done: `tsc --noEmit`, `npm test`, `vite build`
(or the backend's equivalents when working in server/), then `git diff --stat` and
`git diff` to confirm no unrelated files changed and no contract/API/Zustand-API drift.

Files deleted should be zero unless it's a pure verbatim move with every consumer
updated in the same commit (as in Phase 18) — justify explicitly if it happens.

END OF PHASE: report what was migrated, what was skipped and why, test counts
before/after, build status, and any risks/findings discovered but not fixed. Then stop
and wait, unless the phase says otherwise.

## Git hygiene

At the end of every phase, `git add` and commit that phase's changes before reporting
it done — don't let work sit untracked across sessions. Use the established commit
message pattern: `refactor(<area>): phase <n> — <one-line summary>`.
