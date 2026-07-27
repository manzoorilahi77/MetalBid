import { useEffect, useRef, useState } from 'react'
import { randomFloat, randomInt } from '../utils/random'

export interface SettlementState {
  /** Mean hours from lifting confirmation to funds leaving escrow. */
  readonly payoutHours: number
  /** Improvement against the same window last month. */
  readonly fasterPercent: number
  /** Share of completed lots that raised a dispute. */
  readonly disputePercent: number
  /** Increments whenever the payout figure lands; drives the flash. */
  readonly tick: number
}

const PAYOUT_RANGE = [36, 47] as const
const FASTER_RANGE = [8, 17] as const
const DISPUTE_RANGE = [0.18, 0.44] as const

/**
 * Settlement performance for the whole marketplace.
 *
 * This is the trust half of the hero: how quickly a seller is actually paid
 * once material is lifted, and how rarely a completed trade goes wrong. Both
 * are platform-level and carry no lot or counterparty detail.
 *
 * The payout figure and the dispute rate run on separate timers, so the card
 * never refreshes as a single block.
 */
export function useSettlementStats(active: boolean): SettlementState {
  const [payout, setPayout] = useState<{ hours: number; faster: number; tick: number }>(() => ({
    hours: 41,
    faster: 12,
    tick: 0,
  }))
  const [disputePercent, setDisputePercent] = useState<number>(0.3)

  const payoutTimeout = useRef<number | undefined>(undefined)
  const disputeTimeout = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!active) return

    const scheduleNext = (): void => {
      payoutTimeout.current = window.setTimeout(() => {
        setPayout((previous) => ({
          hours: randomInt(PAYOUT_RANGE[0], PAYOUT_RANGE[1]),
          faster: randomInt(FASTER_RANGE[0], FASTER_RANGE[1]),
          tick: previous.tick + 1,
        }))
        scheduleNext()
      }, randomInt(2800, 4600))
    }

    scheduleNext()
    return () => window.clearTimeout(payoutTimeout.current)
  }, [active])

  useEffect(() => {
    if (!active) return

    const scheduleNext = (): void => {
      disputeTimeout.current = window.setTimeout(() => {
        setDisputePercent(Number(randomFloat(DISPUTE_RANGE[0], DISPUTE_RANGE[1]).toFixed(2)))
        scheduleNext()
      }, randomInt(3900, 6300))
    }

    scheduleNext()
    return () => window.clearTimeout(disputeTimeout.current)
  }, [active])

  return {
    payoutHours: payout.hours,
    fasterPercent: payout.faster,
    disputePercent,
    tick: payout.tick,
  }
}
