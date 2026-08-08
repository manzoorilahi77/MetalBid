import { memo } from 'react'
import { useRotatingIndex } from '../../hooks/useRotatingIndex'

export interface HowItWorksCardProps {
  readonly animated: boolean
}

/** The trade journey, in the order a visitor actually experiences it. */
const STEPS = [
  { key: 'list', label: 'Verified listing' },
  { key: 'inspect', label: 'Quality inspection' },
  { key: 'bid', label: 'Live bidding' },
  { key: 'settle', label: 'Escrow settlement' },
] as const

/** One step every ~2.9s — a full pass reads in about the time a hero holds attention. */
const STEP_INTERVAL_MS = 2900

/**
 * Card 1 — how the platform works.
 *
 * Public-facing by design: it explains the four stages of a FerroBid trade and
 * carries no marketplace data, so nothing here is withheld from a signed-out
 * visitor. The travelling highlight is the only thing that moves.
 */
function HowItWorksCardComponent({ animated }: HowItWorksCardProps) {
  const activeIndex = useRotatingIndex(STEPS.length, STEP_INTERVAL_MS, animated)

  return (
    <div className="flex h-full flex-col">
      <p className="text-[1cqw] font-medium leading-none tracking-[0.07em] text-[#8b8f96]">
        HOW IT WORKS
      </p>

      <h3 className="mt-[1.1cqw] text-[1.6cqw] font-medium leading-[1.25] text-[#1f2328]">
        From listing
        <br />
        to payout
      </h3>

      <ol className="relative mt-[2cqw] flex flex-col gap-[1.85cqw]">
        {/* The rail threading the four markers — inset by half a marker at each
            end so it starts and stops dead on the first and last dot. */}
        <span
          aria-hidden="true"
          className="absolute bottom-[0.55cqw] left-[0.55cqw] top-[0.55cqw] w-px -translate-x-1/2 bg-[#e6e4e1]"
        />

        {STEPS.map((step, index) => {
          const active = index === activeIndex

          return (
            <li key={step.key} className="relative flex items-center gap-[1.05cqw]">
              {/* The highlight is a CSS transition rather than an animated
                  value: the browser holds the target style even if it drops
                  every frame in between, so a backgrounded or throttled tab can
                  never leave two markers lit at once. */}
              <span className="relative flex h-[1.1cqw] w-[1.1cqw] shrink-0 items-center justify-center">
                {/* A halo, not a scale: the marker itself never changes size, so
                    the four labels stay locked to their baselines. */}
                <span
                  aria-hidden="true"
                  className={[
                    'absolute inset-[-0.62cqw] rounded-full bg-[#e4572e]',
                    'transition-opacity duration-500 ease-out',
                    active ? 'opacity-[0.12]' : 'opacity-0',
                  ].join(' ')}
                />
                <span
                  aria-hidden="true"
                  className={[
                    'h-full w-full rounded-full transition-colors duration-500 ease-out',
                    active ? 'bg-[#e4572e]' : 'bg-[#d5d1cc]',
                  ].join(' ')}
                />
              </span>

              <span
                className={[
                  'text-[1.25cqw] leading-none transition-colors duration-500 ease-out',
                  active ? 'text-[#1f2328]' : 'text-[#8b8f96]',
                ].join(' ')}
              >
                {step.label}
              </span>
            </li>
          )
        })}
      </ol>

      <div className="mt-auto pt-[1.6cqw]">
        <div className="h-px bg-[#e6e4e1]" />
        <p className="mt-[1.3cqw] text-[1.05cqw] leading-[1.5] text-[#6f747c]">
          Free to browse.
          <br />
          Register once to bid.
        </p>
      </div>
    </div>
  )
}

export const HowItWorksCard = memo(HowItWorksCardComponent)
