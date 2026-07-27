import { memo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePlatformActivity } from '../../hooks/usePlatformActivity'
import { useBiddersOnline } from '../../hooks/useBiddersOnline'
import { LiveAvatars } from './LiveAvatars'

export interface LiveFloorCardProps {
  readonly animated: boolean
}

const INITIAL_BIDDERS = 128

interface FloorStatProps {
  readonly value: number
  readonly label: string
  readonly animated: boolean
}

/** One column of the headline trio. The value rolls when it changes. */
function FloorStat({ value, label, animated }: FloorStatProps) {
  return (
    <div className="flex flex-col items-center">
      <span className="flex h-[2.5cqw] items-baseline overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={value}
            className="text-[2.5cqw] font-semibold leading-none tabular-nums text-[#1f2328]"
            initial={animated ? { y: '80%', opacity: 0 } : false}
            animate={{ y: '0%', opacity: 1 }}
            exit={{ y: '-80%', opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="mt-[0.55cqw] text-[0.85cqw] font-medium leading-none tracking-[0.05em] text-[#8b8f96]">
        {label}
      </span>
    </div>
  )
}

/**
 * Card 1 — the live floor.
 *
 * Speaks for the marketplace rather than any one room: how many auctions are
 * open, how many close today, how many seller yards are represented, and how
 * hard the floor is being worked right now.
 */
function LiveFloorCardComponent({ animated }: LiveFloorCardProps) {
  const activity = usePlatformActivity(animated)
  const bidders = useBiddersOnline(INITIAL_BIDDERS, animated)

  return (
    <div className="flex h-full flex-col">
      <p className="text-center text-[1.2cqw] leading-none text-[#6f747c]">Auction Floor · Live</p>

      <div className="mt-[1.5cqw] flex items-start justify-center gap-[1.5cqw]">
        <FloorStat value={activity.auctionsLive} label="LIVE" animated={animated} />
        <FloorStat value={activity.closingToday} label="TODAY" animated={animated} />
        <FloorStat value={activity.activeYards} label="YARDS" animated={animated} />
      </div>

      <div className="mt-[1.5cqw] h-px bg-[#e6e4e1]" />

      <p className="mt-[1.35cqw] text-[1.15cqw] leading-none text-[#6f747c]">Bids · Last Hour</p>
      <p className="mt-[1cqw] flex items-center gap-[0.55cqw] text-[1.6cqw] font-semibold leading-none tabular-nums text-[#1f2328]">
        <span
          aria-hidden="true"
          className="inline-block h-[0.7cqw] w-[0.7cqw] rounded-full bg-[#e4572e]"
        />
        {activity.bidsLastHour.toLocaleString('en-IN')}
      </p>

      <div className="mt-[1.4cqw] h-px bg-[#e6e4e1]" />

      <p className="mt-[1.35cqw] text-[1.15cqw] leading-none text-[#6f747c]">Bidders Active</p>
      <p className="mt-[0.9cqw] text-[2.15cqw] font-semibold leading-none tabular-nums text-[#1f2328]">
        {bidders.count}
      </p>

      <div className="mt-[1.2cqw]">
        <LiveAvatars
          count={bidders.count}
          delta={bidders.delta}
          tick={bidders.tick}
          animated={animated}
        />
      </div>
    </div>
  )
}

export const LiveFloorCard = memo(LiveFloorCardComponent)
