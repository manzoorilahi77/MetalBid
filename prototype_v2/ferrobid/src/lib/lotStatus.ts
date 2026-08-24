/* ---------------------------------------------------------------------------
   Lot status is still not a generic state machine — target status is still
   decided by each writer's own logic (caller input, catalogue state), and
   several writers accept any current status by design. What Phase 28 (Step
   2/3) did extract is the role/source-status *guard* shape those writers
   share: see application/lotTransitions.ts for the table every discretionary
   lot-status writer now checks against, and its own header for why two of
   the nine (publishDraftCatalogue's multi-lot count check, and the
   auction-close resolution in the engine/scheduler) stay outside it.

   The one genuine, reusable pure rule living here is the inspection outcome
   → lot status mapping below — moved here verbatim.
--------------------------------------------------------------------------- */
import type { LotStatus } from '../types'

export type InspectionOutcome = 'verified' | 'flagged' | 'rejected'

/** What a filed inspection report does to the lot's status. */
export function inspectionOutcomeToLotStatus(outcome: InspectionOutcome): LotStatus {
  return outcome === 'verified' ? 'inspected' : outcome === 'flagged' ? 'flagged' : 'rejected'
}
