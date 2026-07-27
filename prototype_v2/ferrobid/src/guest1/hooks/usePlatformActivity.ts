import { useEffect, useRef, useState } from 'react'
import { clamp, pickOne, randomInt } from '../utils/random'

export interface PlatformActivityState {
  /** Auction rooms open for bidding right now, across every category. */
  readonly auctionsLive: number
  /** Rooms scheduled to close before end of day. */
  readonly closingToday: number
  /** Distinct seller yards with a lot on the floor. */
  readonly activeYards: number
  /** Rolling count of bids placed platform-wide in the last sixty minutes. */
  readonly bidsLastHour: number
}

/** Bands each figure breathes inside — busy, but never implausible. */
const AUCTIONS_RANGE = [26, 44] as const
const CLOSING_RANGE = [78, 112] as const
const YARDS_RANGE = [54, 82] as const
const BIDS_RANGE = [880, 1960] as const

/**
 * Nudges a value within its band, leaning back toward the middle at the edges
 * so the figure wanders without ever drifting somewhere absurd.
 */
function drift(value: number, [min, max]: readonly [number, number], step: number): number {
  const rising = value <= min + step ? true : value >= max - step ? false : Math.random() < 0.5
  const delta = randomInt(1, step) * (rising ? 1 : -1)
  return clamp(value + delta, min, max)
}

/**
 * Subscribes a single figure to its own randomised timer.
 *
 * Every metric on the card ticks on a separate, deliberately un-aligned beat —
 * that is what stops the trio updating as one synchronised block and reads as
 * four independent feeds rather than one scripted refresh.
 */
function useDriftingValue(
  initial: number,
  range: readonly [number, number],
  step: number,
  minGapMs: number,
  maxGapMs: number,
  active: boolean,
): number {
  const [value, setValue] = useState<number>(initial)
  const timeoutRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!active) return

    const scheduleNext = (): void => {
      timeoutRef.current = window.setTimeout(() => {
        setValue((previous) => drift(previous, range, step))
        scheduleNext()
      }, randomInt(minGapMs, maxGapMs))
    }

    scheduleNext()
    return () => window.clearTimeout(timeoutRef.current)
  }, [active, range, step, minGapMs, maxGapMs])

  return value
}

/**
 * Platform-wide floor activity.
 *
 * Deliberately aggregate: the hero speaks for the whole marketplace, so nothing
 * here is tied to a single lot or room. Each figure runs on its own short beat
 * so something on the card is always visibly moving within a few seconds of
 * landing on the page.
 */
export function usePlatformActivity(active: boolean): PlatformActivityState {
  const auctionsLive = useDriftingValue(34, AUCTIONS_RANGE, 2, 2600, 4200, active)
  const closingToday = useDriftingValue(96, CLOSING_RANGE, 3, 3100, 5200, active)
  const activeYards = useDriftingValue(68, YARDS_RANGE, 2, 3700, 6100, active)

  const [bidsLastHour, setBidsLastHour] = useState<number>(1284)
  const bidsTimeout = useRef<number | undefined>(undefined)

  // Bids arrive in clusters rather than single increments, and fastest of all —
  // this is the number a visitor is most likely to catch moving.
  useEffect(() => {
    if (!active) return

    const scheduleNext = (): void => {
      bidsTimeout.current = window.setTimeout(() => {
        setBidsLastHour((previous) =>
          clamp(previous + pickOne([-31, -14, 9, 17, 26, 38, 52]), BIDS_RANGE[0], BIDS_RANGE[1]),
        )
        scheduleNext()
      }, randomInt(1900, 3400))
    }

    scheduleNext()
    return () => window.clearTimeout(bidsTimeout.current)
  }, [active])

  return { auctionsLive, closingToday, activeYards, bidsLastHour }
}
