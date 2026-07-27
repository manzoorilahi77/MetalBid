import { memo, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export interface LiveAvatarsProps {
  /** Total bidders in the room. */
  readonly count: number
  /** Signed change that produced `count`; positive values raise a join badge. */
  readonly delta: number
  /** Monotonic counter — a change replays the pulse. */
  readonly tick: number
  readonly animated: boolean
}

/**
 * A stable cast of traders. Initials rather than stock portraits: it reads as a
 * real member list, carries no licensing risk, and can never 404.
 */
const MEMBERS: readonly { readonly initials: string; readonly tone: string }[] = [
  { initials: 'RK', tone: 'bg-[#6b7280]' },
  { initials: 'AM', tone: 'bg-[#8b6f5e]' },
  { initials: 'SV', tone: 'bg-[#5b6b82]' },
  { initials: 'PJ', tone: 'bg-[#9a7b6b]' },
]

/** How long the join badge stays up before fading. */
const BADGE_VISIBLE_MS = 1600

/**
 * The bidder presence row.
 *
 * On every join the avatar whose turn it is swells briefly and a small green
 * "+n" badge surfaces then fades — the visual grammar of someone entering a
 * room, rather than a number silently changing.
 */
function LiveAvatarsComponent({ count, delta, tick, animated }: LiveAvatarsProps) {
  const [badgeVisible, setBadgeVisible] = useState<boolean>(false)

  useEffect(() => {
    if (!animated || tick === 0 || delta <= 0) return

    setBadgeVisible(true)
    const id = window.setTimeout(() => setBadgeVisible(false), BADGE_VISIBLE_MS)
    return () => window.clearTimeout(id)
  }, [tick, delta, animated])

  // Rotate which face reacts so the same avatar never pulses twice running.
  const pulsingIndex = tick % MEMBERS.length
  const overflow = Math.max(count - MEMBERS.length, 0)

  return (
    <div className="flex items-center">
      {MEMBERS.map((member, index) => (
        <motion.span
          key={member.initials}
          className={[
            'relative -ml-[0.5cqw] flex h-[2.5cqw] w-[2.5cqw] items-center justify-center',
            'rounded-full text-[0.85cqw] font-semibold text-white first:ml-0',
            'ring-[0.18cqw] ring-white',
            member.tone,
          ].join(' ')}
          animate={
            animated && badgeVisible && index === pulsingIndex
              ? { scale: [1, 1.16, 1] }
              : { scale: 1 }
          }
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          {member.initials}
        </motion.span>
      ))}

      <span className="ml-[0.5cqw] rounded-full bg-[#f2efec] px-[0.75cqw] py-[0.45cqw] text-[1cqw] font-medium leading-none text-[#5f646b]">
        + {overflow}
      </span>

      <AnimatePresence>
        {badgeVisible && (
          <motion.span
            key={tick}
            className="ml-[0.5cqw] flex items-center gap-[0.3cqw] text-[0.95cqw] font-semibold leading-none text-[#1e7f4f]"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, ease: 'easeOut' }}
          >
            <span className="h-[0.45cqw] w-[0.45cqw] rounded-full bg-[#1e7f4f]" />+{delta}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

export const LiveAvatars = memo(LiveAvatarsComponent)
