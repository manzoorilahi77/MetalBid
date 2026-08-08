import { useEffect, useState } from 'react'

/**
 * Walks 0 → length-1 → 0 on a fixed beat.
 *
 * The hero cards carry evergreen copy rather than live figures, so their motion
 * has to come from somewhere other than changing data: each card simply moves a
 * highlight down its own list. Every card passes its own interval so the two
 * lists never advance on the same frame, which is what keeps the composition
 * feeling alive instead of metronomic.
 *
 * Returns 0 and never advances when `active` is false — off-screen, and for
 * reduced-motion visitors, the first item simply stays highlighted.
 */
export function useRotatingIndex(length: number, intervalMs: number, active: boolean): number {
  const [index, setIndex] = useState<number>(0)

  useEffect(() => {
    if (!active || length <= 1) return

    const id = window.setInterval(() => {
      setIndex((previous) => (previous + 1) % length)
    }, intervalMs)

    return () => window.clearInterval(id)
  }, [active, length, intervalMs])

  return index
}
