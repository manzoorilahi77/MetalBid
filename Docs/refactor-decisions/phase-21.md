# Phase 21 — role/permission-gap audit (decision only, no code change)

**Type:** audit. Produced no commit — this phase's job was to enumerate every ad hoc
role/permission check found while doing prior refactor phases and decide, per finding,
whether it was a real gap worth fixing or a pre-existing behavior to leave alone.
7 findings were surfaced. 6 were approved for a fix in Phase 22
(commit `343caa9`); 1 was reviewed and deliberately left as-is.

Source material for this file: the `it.skip('BEFORE Phase 22: ...')` characterization
tests each finding's fix left behind (kept for the record, not deleted, per this
project's standing rule), plus `application/structuralRollback.ts`'s doc comment for
the one finding that was not fixed.

## Finding #1 — resolveDispute → raiseRefund: exec_manager could start a resolution but not close it

`exec_manager` is on `SUPPORT_ROLES` (can resolve tickets), but `raiseRefund`'s
carve-out named only `sub_admin`, not `exec_manager` — so an `exec_manager` closing a
ticket with a `refund_due` outcome always failed one level deeper than the
`SUPPORT_ROLES` check that let them start the resolution in the first place.

**Decision:** approved for a fix in Phase 22.
Source: `tests/store/disputes.characterization.test.ts`.

## Finding #2 — waiveEmdForfeiture silently dropped a real CEO's refusal

`waiveEmdForfeiture`'s own guard only admitted `FINANCE_ROLES`
(`finance_admin`, `super_admin`). `ceo` is not in that set, so when the actual CEO —
not a `super_admin`, not a delegate holding a finance role — refused an
EMD-forfeiture sign-off, the `ceoApprovals` record correctly flipped to `'refused'`,
but the cascaded `waiveEmdForfeiture` call was made and its result discarded: the
underlying forfeiture silently stayed stuck at `'awaiting_ceo'` and the buyer's EMD
was never released, while the CEO saw what looked like a normal refusal.

**Decision:** approved for a fix in Phase 22. (Phase 22b then surfaced this and two
related failure paths in the UI itself — see below.)
Source: `tests/store/admin_workflows.characterization.test.ts`.

## Finding #3 — setSellerLotDecision / recordCommissionSettlement had no role guard at all

Neither action had any role check — a buyer calling either directly (e.g. via the
browser console) went through unchecked; only the seller-only page gated who saw the
button.

**Decision:** approved for a fix in Phase 22.
Source: `tests/store/seller.characterization.test.ts`.

## Finding #4 — setUserStanding had no role guard at all

Same shape as #3: any signed-in role, including `buyer`, could flip another account's
standing. Only the page (`/admin/users`, `/admin/blacklist`) gated who saw the
control.

**Decision:** approved for a fix in Phase 22.
Source: `tests/store/eligibility_and_admin_tail.characterization.test.ts`.

## Finding #5 — undoStructuralChange's one-step, non-cascading undo

`undoStructuralChange` marks ONLY the one target change as undone. If a later
structural change has already been applied on top of it, undoing the earlier one
silently reverts the platform to a state that predates the later change too — but the
later change's own record is left showing as NOT undone, because nothing walks
forward from the target. (`restoreStructureTo` does not have this gap — it explicitly
finds and marks every snapshot-carrying change at or after the target's timestamp.)

**Decision:** reviewed and deliberately left as-is. Documented, not fixed — this is
the one finding of the 7 that was not approved for a Phase 22 fix.
Source: `application/structuralRollback.ts`'s doc comment (cites "Phase 21/22,
documented not fixed").

## Finding #6 — restoreStructureTo overcounted its own meta-rollback record

`restoreStructureTo`'s "later" filter counted every snapshot-carrying, not-yet-undone
record at or after the target's timestamp — including a `'structure.rollback'`
meta-record created by a prior individual undo. So the summary read one higher than
the real business-action count a human skimming the sequence would expect.

**Decision:** approved for a fix in Phase 22.
Source: `tests/store/rbac_structure.characterization.test.ts`.

## Finding #7 — createSubAdmin's email duplicate check was case-sensitive

The email side of the duplicate check compared exact/case-sensitive while the
username side was already trim+lowercase — so two accounts could be created with the
same email differing only in case, even though `signIn` itself matches email
case-insensitively.

**Decision:** approved for a fix in Phase 22.
Source: `tests/store/account_lifecycle.characterization.test.ts`.

## Net disposition

7 findings → 6 approved and fixed (commit `343caa9`, plus the UI-surfacing follow-on
`f076cde`, Phase 22b) → 1 (finding #5) reviewed and deliberately left unfixed,
documented in place. See Phase 30's final report, Section 6, for how this pair is
treated as this project's first deliberate behavior-change exception (Phase 28b/28c
being the second).
