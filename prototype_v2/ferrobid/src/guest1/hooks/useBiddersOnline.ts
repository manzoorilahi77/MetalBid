import { useEffect, useRef, useState } from 'react'
import { clamp, pickOne, randomInt } from '../utils/random'

export interface BiddersOnlineState {
  readonly count: number
  /** Signed change that produced `count` — drives the "+3" join badge. */
  readonly delta: number
  /** Monotonic counter; consumers key their avatar pulse off this. */
  readonly tick: number
}

/** Traders arrive in small clusters, never one-by-one on a metronome. */
const GROUP_SIZES: readonly number[] = [1, 3, 7]

/** The room breathes inside this band — never empty, never implausibly full. */
const MIN_ONLINE = 95
const MAX_ONLINE = 165

const MIN_GAP_MS = 2700
const MAX_GAP_MS = 4900

/**
 * Simulates the bidder presence counter.
 *
 * The direction is pressure-based rather than a coin flip: a near-empty room
 * fills, a crowded one thins out, and in between it drifts upward slightly more
 * often than not. That asymmetry is what stops the number reading as noise.
 */
export function useBiddersOnline(initialCount: number, active: boolean): BiddersOnlineState {
  const [state, setState] = useState<BiddersOnlineState>(() => ({
    count: initialCount,
    delta: 0,
    tick: 0,
  }))

  const timeoutRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!active) return

    const scheduleNextChange = (): void => {
      timeoutRef.current = window.setTimeout(() => {
        setState((previous) => {
          const size = pickOne(GROUP_SIZES)

          // Pull back toward the middle of the band at the extremes, and lean
          // gently positive elsewhere so the room trends busy.
          let joining: boolean
          if (previous.count <= MIN_ONLINE + 10) joining = true
          else if (previous.count >= MAX_ONLINE - 10) joining = false
          else joining = Math.random() < 0.62

          const delta = joining ? size : -size

          return {
            count: clamp(previous.count + delta, MIN_ONLINE, MAX_ONLINE),
            delta,
            tick: previous.tick + 1,
          }
        })
        scheduleNextChange()
      }, randomInt(MIN_GAP_MS, MAX_GAP_MS))
    }

    scheduleNextChange()
    return () => window.clearTimeout(timeoutRef.current)
  }, [active])

  return state
}
