import { useEffect, useMemo, useRef, useState } from 'react'
import { clamp, randomFloat, randomInt } from '../utils/random'

export interface ChartPoint {
  /** Monotonic sequence index — used as the x domain. */
  readonly t: number
  readonly v: number
}

export type CoverageLabel = 'High' | 'Very High' | 'Full'

export interface PlatformSignalsState {
  /** Rolling tape of bidding tempo across the floor. */
  readonly series: readonly ChartPoint[]
  /** Increments on every appended point; drives the chart's scroll step. */
  readonly seriesTick: number
  /** Mean days from auction close to material leaving the yard. */
  readonly liftDays: number
  /** Share of listed lots carrying a completed physical inspection. */
  readonly coverage: number
  readonly coverageLabel: CoverageLabel
}

/** Points held in the rolling window. */
export const SERIES_LENGTH = 24

/** The tape advances on its own cadence, independent of the other cards. */
export const SERIES_MIN_GAP_MS = 1500
export const SERIES_MAX_GAP_MS = 2300

const LIFT_DAYS_RANGE = [2.6, 3.8] as const
const COVERAGE_RANGE = [92, 99] as const

/** The tape oscillates inside this band so the line never runs off-frame. */
const SERIES_FLOOR = 12
const SERIES_CEILING = 88

/**
 * Seeds a plausible history so the tape has shape on first paint rather than
 * animating in from a flat line.
 */
function createInitialSeries(): ChartPoint[] {
  const points: ChartPoint[] = []
  let value = 46

  for (let index = 0; index < SERIES_LENGTH; index += 1) {
    value = clamp(value + randomFloat(-5, 6.4), SERIES_FLOOR, SERIES_CEILING)
    points.push({ t: index, v: Number(value.toFixed(2)) })
  }

  return points
}

function toCoverageLabel(coverage: number): CoverageLabel {
  if (coverage < 95) return 'High'
  if (coverage < 98) return 'Very High'
  return 'Full'
}

/**
 * Operational signals for the marketplace.
 *
 * Three independent timers: the bidding tempo tape, the mean lifting time and
 * inspection coverage. Nothing here describes an individual lot — these are the
 * numbers a buyer weighs before deciding the platform is worth their time.
 */
export function usePlatformSignals(active: boolean): PlatformSignalsState {
  const [series, setSeries] = useState<ChartPoint[]>(createInitialSeries)
  const [seriesTick, setSeriesTick] = useState<number>(0)
  const [liftDays, setLiftDays] = useState<number>(3.2)
  const [coverage, setCoverage] = useState<number>(97)

  const seriesTimeout = useRef<number | undefined>(undefined)
  const liftTimeout = useRef<number | undefined>(undefined)
  const coverageTimeout = useRef<number | undefined>(undefined)

  // Rolling tempo tape — append one point, drop the oldest.
  useEffect(() => {
    if (!active) return

    const scheduleNextPoint = (): void => {
      seriesTimeout.current = window.setTimeout(() => {
        setSeries((previous) => {
          const last = previous[previous.length - 1]
          const next = clamp(last.v + randomFloat(-4.2, 5.1), SERIES_FLOOR, SERIES_CEILING)
          return [...previous.slice(1), { t: last.t + 1, v: Number(next.toFixed(2)) }]
        })
        setSeriesTick((previous) => previous + 1)
        scheduleNextPoint()
      }, randomInt(SERIES_MIN_GAP_MS, SERIES_MAX_GAP_MS))
    }

    scheduleNextPoint()
    return () => window.clearTimeout(seriesTimeout.current)
  }, [active])

  // Mean lifting time.
  useEffect(() => {
    if (!active) return

    const scheduleNextLift = (): void => {
      liftTimeout.current = window.setTimeout(() => {
        setLiftDays(Number(randomFloat(LIFT_DAYS_RANGE[0], LIFT_DAYS_RANGE[1]).toFixed(1)))
        scheduleNextLift()
      }, randomInt(3400, 5600))
    }

    scheduleNextLift()
    return () => window.clearTimeout(liftTimeout.current)
  }, [active])

  // Inspection coverage.
  useEffect(() => {
    if (!active) return

    const scheduleNextCoverage = (): void => {
      coverageTimeout.current = window.setTimeout(() => {
        setCoverage(randomInt(COVERAGE_RANGE[0], COVERAGE_RANGE[1]))
        scheduleNextCoverage()
      }, randomInt(2900, 4800))
    }

    scheduleNextCoverage()
    return () => window.clearTimeout(coverageTimeout.current)
  }, [active])

  const coverageLabel = useMemo(() => toCoverageLabel(coverage), [coverage])

  return { series, seriesTick, liftDays, coverage, coverageLabel }
}
