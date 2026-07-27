import { memo, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSettlementStats } from '../../hooks/useSettlementStats'

export interface SettlementCardProps {
  readonly animated: boolean
}

/** How long the green confirmation tint lingers after a figure updates. */
const FLASH_MS = 900

/**
 * Card 2 — settlement.
 *
 * The trust half of the hero. No lot, no counterparty and no bid value: just
 * how fast a seller is actually paid once material is lifted, and how rarely a
 * completed trade goes wrong. Those are the two numbers that decide whether a
 * yard lists with you again.
 */
function SettlementCardComponent({ animated }: SettlementCardProps) {
  const { payoutHours, fasterPercent, disputePercent, tick } = useSettlementStats(animated)
  const [flashing, setFlashing] = useState<boolean>(false)
  const previousTick = useRef<number>(0)

  useEffect(() => {
    if (!animated || tick === previousTick.current) return
    previousTick.current = tick

    setFlashing(true)
    const id = window.setTimeout(() => setFlashing(false), FLASH_MS)
    return () => window.clearTimeout(id)
  }, [tick, animated])

  return (
    <div className="flex h-full flex-col">
      <p className="text-[1cqw] font-medium leading-none tracking-[0.07em] text-[#8b8f96]">
        SETTLEMENT
      </p>

      <h3 className="mt-[1cqw] text-[1.7cqw] font-medium leading-none text-[#1f2328]">
        Escrow-released payouts
      </h3>

      <p className="mt-[1.5cqw] text-[1.15cqw] leading-none text-[#6f747c]">Avg. Seller Payout</p>

      <div className="mt-[0.9cqw] flex items-baseline justify-between gap-[1cqw]">
        <span className="relative flex h-[3cqw] items-baseline overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={payoutHours}
              className="text-[2.85cqw] font-semibold leading-none tabular-nums text-[#1f2328]"
              initial={animated ? { y: '85%', opacity: 0 } : false}
              animate={{ y: '0%', opacity: 1 }}
              exit={{ y: '-85%', opacity: 0 }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            >
              {payoutHours} hrs
            </motion.span>
          </AnimatePresence>
        </span>

        <motion.span
          className="flex shrink-0 items-center gap-[0.3cqw] rounded-[0.4cqw] px-[0.4cqw] py-[0.2cqw] text-[1.6cqw] leading-none text-[#1e7f4f]"
          animate={{ backgroundColor: flashing ? 'rgba(30,127,79,0.12)' : 'rgba(30,127,79,0)' }}
          transition={{ duration: flashing ? 0.16 : 0.6, ease: 'easeOut' }}
        >
          <motion.span
            aria-hidden="true"
            animate={animated && flashing ? { y: [0, 1.5, 0] } : { y: 0 }}
            transition={{ duration: 0.42, ease: 'easeOut' }}
          >
            ↓
          </motion.span>
          {fasterPercent}%
        </motion.span>
      </div>

      <div className="mt-[1.6cqw] h-px bg-[#e6e4e1]" />

      <p className="mt-[1.4cqw] text-[1.15cqw] leading-none text-[#6f747c]">Dispute Rate</p>

      <div className="mt-[1cqw] flex items-center justify-between gap-[1cqw]">
        <div className="min-w-0">
          <AnimatePresence initial={false} mode="wait">
            <motion.p
              key={disputePercent}
              className="text-[1.7cqw] font-medium leading-none tabular-nums text-[#1f2328]"
              initial={animated ? { opacity: 0, y: 4 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              {disputePercent.toFixed(2)}%
            </motion.p>
          </AnimatePresence>
          <p className="mt-[0.75cqw] text-[1.25cqw] leading-none text-[#6f747c]">
            of completed lots
          </p>
        </div>

        <span className="flex shrink-0 items-center gap-[0.45cqw] rounded-full bg-[#e8f3ec] px-[0.9cqw] py-[0.5cqw] text-[1.35cqw] leading-none text-[#1e7f4f]">
          <span
            aria-hidden="true"
            className="h-[0.6cqw] w-[0.6cqw] rounded-full bg-[#1e7f4f]"
          />
          Secured
        </span>
      </div>
    </div>
  )
}

export const SettlementCard = memo(SettlementCardComponent)
