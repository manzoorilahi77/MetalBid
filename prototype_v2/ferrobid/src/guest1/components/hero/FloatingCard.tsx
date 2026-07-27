import { memo } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

export interface FloatingCardProps {
  /** Ordinal position — drives the entrance stagger. */
  readonly index: number
  /** Absolute bounds, as percentages of the render, matching the reference plate. */
  readonly anchorClassName: string
  /** True for the one card currently taking its turn in the idle glow cycle. */
  readonly glowing: boolean
  readonly animated: boolean
  readonly label: string
  readonly children: ReactNode
}

/** Entrance easing — decelerating, and deliberately never overshooting. */
const ENTRANCE_EASE = [0.22, 1, 0.36, 1] as const

/**
 * The card shell, matched to the panels in the original render: a frosted
 * near-white surface, hairline edge and a soft, wide shadow.
 *
 * Every dimension is expressed in `cqw` (percent of the hero's width) rather
 * than pixels, so the card scales in exact lock-step with the artwork behind it
 * at any viewport — the same way the baked-in panels used to.
 *
 * The card is fixed in place: it fades up once on entrance and then never
 * moves again, so the composition reads exactly like the still it replaces.
 */
function FloatingCardComponent({
  index,
  anchorClassName,
  glowing,
  animated,
  label,
  children,
}: FloatingCardProps) {
  return (
    <motion.div
      className={`absolute ${anchorClassName}`}
      initial={animated ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={
        animated
          ? { duration: 0.6, delay: 0.45 + index * 0.15, ease: ENTRANCE_EASE }
          : { duration: 0 }
      }
    >
      {/* Depth is built from four stacked layers rather than one blunt shadow:
          a hairline top highlight that catches the light, a tight contact
          shadow that seats the card on the artwork, and two progressively
          wider ambient shadows. The result reads as a real pane of glass
          sitting above the render — present, but never demanding attention. */}
      <section
        aria-label={label}
        className={[
          'h-full w-full rounded-[1.35cqw] px-[1.45cqw] py-[1.35cqw]',
          'border border-white/85 bg-gradient-to-b from-white/90 to-white/76',
          'backdrop-blur-[0.9cqw] transition-shadow duration-700 ease-out',
          glowing
            ? 'shadow-[inset_0_0.08cqw_0_rgba(255,255,255,0.95),0_0.1cqw_0.28cqw_rgba(28,25,23,0.06),0_0.9cqw_1.7cqw_-0.5cqw_rgba(28,25,23,0.13),0_2.6cqw_5cqw_-1.5cqw_rgba(28,25,23,0.22)]'
            : 'shadow-[inset_0_0.08cqw_0_rgba(255,255,255,0.9),0_0.1cqw_0.28cqw_rgba(28,25,23,0.05),0_0.7cqw_1.4cqw_-0.5cqw_rgba(28,25,23,0.09),0_2.2cqw_4.2cqw_-1.5cqw_rgba(28,25,23,0.16)]',
        ].join(' ')}
      >
        {children}
      </section>
    </motion.div>
  )
}

export const FloatingCard = memo(FloatingCardComponent)
