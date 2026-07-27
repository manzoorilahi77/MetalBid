import { memo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  usePlatformSignals,
  SERIES_MIN_GAP_MS,
  SERIES_MAX_GAP_MS,
} from '../../hooks/usePlatformSignals'
import { LiveChart } from './LiveChart'

export interface PlatformSignalsCardProps {
  readonly animated: boolean
}

/** The scroll is paced to the mean gap so steps hand off without a stutter. */
const MEAN_STEP_MS = (SERIES_MIN_GAP_MS + SERIES_MAX_GAP_MS) / 2

/**
 * Card 3 — operational signals.
 *
 * The bidding tempo across the whole floor, then the two numbers that decide
 * whether a buyer trusts what they are bidding on: how quickly material
 * actually leaves the yard, and how much of the catalogue carries a completed
 * physical inspection.
 */
function PlatformSignalsCardComponent({ animated }: PlatformSignalsCardProps) {
  const { series, seriesTick, liftDays, coverage, coverageLabel } = usePlatformSignals(animated)

  return (
    <div className="flex h-full flex-col">
      <p className="text-[1.15cqw] leading-none text-[#6f747c]">Bidding Tempo</p>
      <p className="mt-[0.9cqw] text-[1.6cqw] leading-none text-[#7c8087]">Last 60 min</p>

      <div className="mt-[1.2cqw]">
        <LiveChart
          series={series}
          tick={seriesTick}
          stepDurationMs={MEAN_STEP_MS}
          animated={animated}
        />
      </div>

      <p className="mt-[1.4cqw] text-[1.15cqw] leading-none text-[#6f747c]">Avg. Lift Time</p>

      <div className="mt-[1cqw] flex items-center justify-between">
        <p className="flex items-center gap-[0.4cqw] text-[1.85cqw] leading-none tabular-nums text-[#1e7f4f]">
          <span aria-hidden="true">↓</span>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={liftDays}
              initial={animated ? { y: '70%', opacity: 0 } : false}
              animate={{ y: '0%', opacity: 1 }}
              exit={{ y: '-70%', opacity: 0 }}
              transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
            >
              {liftDays.toFixed(1)} d
            </motion.span>
          </AnimatePresence>
        </p>

        {/* Decorative affordance carried over from the reference panel. */}
        <span
          aria-hidden="true"
          className="flex h-[1.9cqw] w-[1.9cqw] items-center justify-center rounded-full border border-[#e6e4e1] text-[0.9cqw] leading-none text-[#9aa0a6]"
        >
          ⌃
        </span>
      </div>

      <div className="mt-[1.5cqw] h-px bg-[#e6e4e1]" />

      <p className="mt-[1.4cqw] text-[1.15cqw] leading-none text-[#6f747c]">Inspection Coverage</p>
      <AnimatePresence initial={false} mode="wait">
        <motion.p
          key={coverageLabel}
          className="mt-[1cqw] text-[2cqw] font-medium leading-none text-[#1f2328]"
          initial={animated ? { opacity: 0, y: 3 } : false}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          {coverageLabel}
        </motion.p>
      </AnimatePresence>

      <div
        className="mt-[1.3cqw] h-[0.7cqw] w-full overflow-hidden rounded-full bg-[#eceae7]"
        role="progressbar"
        aria-label="Inspection coverage"
        aria-valuenow={coverage}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <motion.div
          className="h-full rounded-full bg-[#3f8f6a]"
          initial={false}
          animate={{ width: `${coverage}%` }}
          transition={animated ? { duration: 1.1, ease: [0.22, 1, 0.36, 1] } : { duration: 0 }}
        />
      </div>
    </div>
  )
}

export const PlatformSignalsCard = memo(PlatformSignalsCardComponent)
