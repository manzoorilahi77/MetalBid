import { memo, useEffect } from 'react'
import { motion, useAnimationControls } from 'framer-motion'
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts'
import type { ChartPoint } from '../../hooks/usePlatformSignals'
import { SERIES_LENGTH } from '../../hooks/usePlatformSignals'

export interface LiveChartProps {
  readonly series: readonly ChartPoint[]
  /** Increments per appended point; each change replays one scroll step. */
  readonly tick: number
  /** Nominal gap between points — the scroll is paced to match. */
  readonly stepDurationMs: number
  readonly animated: boolean
}

/**
 * The plot is one point-gap wider than its frame and rests shifted left by that
 * gap. A new point is therefore always rendered just off the right edge, and
 * the scroll simply slides it into view — no redraw, no path re-animation.
 */
const GAP_COUNT = SERIES_LENGTH - 1
const INNER_WIDTH_CLASS = 'w-[104.545%]'
const REST_OFFSET = `-${(100 / GAP_COUNT).toFixed(3)}%`

/**
 * A fixed y-domain is what separates this from a toy chart: the line moves
 * horizontally only, so the eye reads a continuous tape instead of a figure
 * that rescales itself every couple of seconds.
 */
const Y_DOMAIN: [number, number] = [8, 92]

/**
 * Rolling price tape.
 *
 * Recharts renders the path with its own animation disabled; all motion comes
 * from a single compositor-friendly translate on the wrapper, so appending a
 * point costs one cheap SVG path update and nothing repaints or flickers.
 */
function LiveChartComponent({ series, tick, stepDurationMs, animated }: LiveChartProps) {
  const controls = useAnimationControls()

  useEffect(() => {
    if (!animated) {
      controls.set({ x: REST_OFFSET })
      return
    }

    // Snap back by one gap, then glide to rest over exactly one interval —
    // the hand-off between steps is seamless.
    controls.set({ x: '0%' })
    void controls.start({
      x: REST_OFFSET,
      transition: { duration: stepDurationMs / 1000, ease: 'linear' },
    })
  }, [tick, animated, controls, stepDurationMs])

  return (
    /* Height and the faint column rules are both in `cqw`, so the tape keeps the
       same proportions as the panel in the original render at any width. */
    <div
      aria-hidden="true"
      className="h-[6.1cqw] w-full overflow-hidden bg-[repeating-linear-gradient(to_right,rgba(28,25,23,0.055)_0_1px,transparent_1px_25%)]"
    >
      <motion.div className={`h-full ${INNER_WIDTH_CLASS}`} animate={controls}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series as ChartPoint[]} margin={{ top: 3, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="heroTapeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e39a5c" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#e39a5c" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <YAxis hide domain={Y_DOMAIN} />
            <Area
              type="monotone"
              dataKey="v"
              stroke="#dd8f4e"
              strokeWidth={1.5}
              fill="url(#heroTapeFill)"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  )
}

export const LiveChart = memo(LiveChartComponent)
