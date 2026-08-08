import { memo } from 'react'
import { motion } from 'framer-motion'

export interface AssuranceCardProps {
  readonly animated: boolean
}

/** The three protections that apply to every lot, regardless of who is looking. */
const POINTS: readonly string[] = [
  'Escrow-protected payments',
  'KYC-verified buyers & sellers',
  'GST-compliant documentation',
]

/**
 * Card 2 — how a trade is protected.
 *
 * The trust half of the hero, stated as policy rather than performance: what
 * every FerroBid trade carries as standard. Nothing on this card is derived
 * from the order book, so it reads the same for a visitor and a subscriber.
 */
function AssuranceCardComponent({ animated }: AssuranceCardProps) {
  return (
    <div className="flex h-full flex-col">
      <p className="text-[1cqw] font-medium leading-none tracking-[0.07em] text-[#8b8f96]">
        SECURE BY DESIGN
      </p>

      <h3 className="mt-[1.2cqw] text-[1.7cqw] font-medium leading-[1.25] text-[#1f2328]">
        Every trade is protected
      </h3>

      <ul className="mt-[2.2cqw] flex flex-col gap-[2.1cqw]">
        {POINTS.map((point, index) => (
          <motion.li
            key={point}
            className="flex items-center gap-[0.8cqw] text-[1.25cqw] leading-none text-[#4b5058]"
            initial={animated ? { opacity: 0, x: -4 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={
              animated
                ? { duration: 0.45, delay: 0.9 + index * 0.12, ease: [0.22, 1, 0.36, 1] }
                : { duration: 0 }
            }
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-[1.15cqw] w-[1.15cqw] shrink-0 text-[#1e7f4f]"
            >
              <path d="M2.4 6.3 4.7 8.6 9.6 3.5" />
            </svg>
            {point}
          </motion.li>
        ))}
      </ul>

      <div className="mt-auto pt-[1.5cqw]">
        <div className="h-px bg-[#e6e4e1]" />

        <div className="mt-[1.35cqw] flex items-center justify-between gap-[1cqw]">
          <p className="min-w-0 text-[1.15cqw] leading-[1.4] text-[#6f747c]">
            Payment released once delivery is confirmed
          </p>

          <span className="flex shrink-0 items-center gap-[0.45cqw] rounded-full bg-[#e8f3ec] px-[0.9cqw] py-[0.5cqw] text-[1.35cqw] leading-none text-[#1e7f4f]">
            <span aria-hidden="true" className="h-[0.6cqw] w-[0.6cqw] rounded-full bg-[#1e7f4f]" />
            Secured
          </span>
        </div>
      </div>
    </div>
  )
}

export const AssuranceCard = memo(AssuranceCardComponent)
