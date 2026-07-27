import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { usePageActive } from '../../hooks/usePageActive'
import { randomInt } from '../../utils/random'
import { HeroImage } from './HeroImage'
import { FloatingCard } from './FloatingCard'
import { LiveFloorCard } from './LiveFloorCard'
import { SettlementCard } from './SettlementCard'
import { PlatformSignalsCard } from './PlatformSignalsCard'

/**
 * Card placement, measured directly off the original render.
 *
 * Each card occupies exactly the rectangle its baked-in counterpart used to,
 * expressed as percentages of the artwork. Because the bounds and every type
 * size scale together (the cards are sized in `cqw`), the composition is
 * pixel-proportional to the reference at every viewport — the arrangement never
 * reflows, exactly as a flat image would not.
 */
const CARDS = [
  {
    key: 'floor',
    label: 'Live auction floor activity',
    anchor: 'left-[5.95%] top-[16.3%] w-[20.8%] h-[49.5%]',
  },
  {
    key: 'settlement',
    label: 'Settlement performance',
    anchor: 'left-[63.4%] top-[3.4%] w-[25.9%] h-[38.3%]',
  },
  {
    key: 'signals',
    label: 'Platform operating signals',
    anchor: 'left-[77.8%] top-[44.6%] w-[18.7%] h-[50.9%]',
  },
] as const

/** Idle attention cycle — one card, barely perceptibly, every 20–40 seconds. */
const IDLE_MIN_MS = 20000
const IDLE_MAX_MS = 40000
const IDLE_GLOW_MS = 500

/**
 * The FerroBid hero.
 *
 * A still industrial render at the centre, ringed by three genuinely live
 * cards. Everything a visitor sees moving — the clock, the bid ladder, the
 * price tape, the room's presence count — is real component state on its own
 * independent cadence, never a scripted loop.
 *
 * The orchestrator itself holds almost no state: each card owns its simulation,
 * so a bid landing or a second ticking over re-renders exactly one subtree. The
 * only state up here is the idle glow, which changes at most twice a minute.
 */
export function HeroIllustration() {
  const reducedMotion = usePrefersReducedMotion()
  const pageActive = usePageActive()

  /** Simulations pause off-screen and for reduced-motion users. */
  const animated = !reducedMotion && pageActive

  const [glowingIndex, setGlowingIndex] = useState<number>(-1)

  useEffect(() => {
    if (!animated) return

    let cycleTimer = 0
    let clearTimer = 0

    const scheduleNextGlow = (): void => {
      cycleTimer = window.setTimeout(() => {
        setGlowingIndex(randomInt(0, CARDS.length - 1))
        clearTimer = window.setTimeout(() => setGlowingIndex(-1), IDLE_GLOW_MS)
        scheduleNextGlow()
      }, randomInt(IDLE_MIN_MS, IDLE_MAX_MS))
    }

    scheduleNextGlow()

    return () => {
      window.clearTimeout(cycleTimer)
      window.clearTimeout(clearTimer)
    }
  }, [animated])

  return (
    <div className="relative w-full">
      <HeroImage animated={animated} />

      {/* The card layer is its own container so every `cqw` inside resolves
          against the artwork's width. It is a sibling of the plate rather than
          an ancestor: `container-type` establishes containment, which would
          otherwise isolate the plate's multiply blend from the section behind
          it and leave the render sitting on a visible white rectangle. */}
      <div className="@container pointer-events-none absolute inset-0">
        {CARDS.map((card, index) => (
          <FloatingCard
            key={card.key}
            index={index}
            label={card.label}
            anchorClassName={card.anchor}
            glowing={glowingIndex === index}
            animated={animated}
          >
            {card.key === 'floor' && <LiveFloorCard animated={animated} />}
            {card.key === 'settlement' && <SettlementCard animated={animated} />}
            {card.key === 'signals' && <PlatformSignalsCard animated={animated} />}
          </FloatingCard>
        ))}
      </div>
    </div>
  )
}

export default HeroIllustration
