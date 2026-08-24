/* ---------------------------------------------------------------------------
   Lot status is not a generic state machine in this codebase — every action
   that changes a lot's status decides the new value itself, inline, gated by
   its own role/business checks (`decideLot`, `setLotStatus`, `waiveInspection`,
   `publishDraftCatalogue`, the auction-close resolution in the engine). There
   is no single "allowed transitions" table to extract without inventing one.

   The one genuine, reusable pure rule already living inline is the inspection
   outcome → lot status mapping below — moved here verbatim.
--------------------------------------------------------------------------- */
import type { LotStatus } from '../types'

export type InspectionOutcome = 'verified' | 'flagged' | 'rejected'

/** What a filed inspection report does to the lot's status. */
export function inspectionOutcomeToLotStatus(outcome: InspectionOutcome): LotStatus {
  return outcome === 'verified' ? 'inspected' : outcome === 'flagged' ? 'flagged' : 'rejected'
}
