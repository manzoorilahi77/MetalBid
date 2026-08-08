import { memo } from 'react'
import { useRotatingIndex } from '../../hooks/useRotatingIndex'

export interface MarketplaceCardProps {
  readonly animated: boolean
}

/** The four catalogue categories, matching the marketplace filter bar exactly. */
const CATEGORIES: readonly string[] = [
  'Ferrous',
  'Non-Ferrous',
  'Stainless Steel',
  'Minor Metals',
]

/** Offset from the journey card's beat so the two highlights never move together. */
const CATEGORY_INTERVAL_MS = 2200

/**
 * Card 3 — what trades on the platform.
 *
 * Scope rather than activity: the categories a buyer can bid on, the national
 * footprint behind them, and the auction formats FerroBid runs. All of it is
 * catalogue-level information a visitor could read off the marketplace page.
 */
function MarketplaceCardComponent({ animated }: MarketplaceCardProps) {
  const activeIndex = useRotatingIndex(CATEGORIES.length, CATEGORY_INTERVAL_MS, animated)

  return (
    <div className="flex h-full flex-col">
      <p className="text-[1cqw] font-medium leading-none tracking-[0.07em] text-[#8b8f96]">
        ON THE FLOOR
      </p>

      <h3 className="mt-[1cqw] text-[1.6cqw] font-medium leading-[1.25] text-[#1f2328]">
        What trades here
      </h3>

      <ul className="mt-[1.5cqw] flex flex-col gap-[1.05cqw]">
        {CATEGORIES.map((category, index) => {
          const active = index === activeIndex

          // Same CSS-transition highlight as the journey card, for the same
          // reason: the target style must survive dropped frames.
          return (
            <li key={category} className="flex items-center gap-[0.75cqw]">
              <span
                aria-hidden="true"
                className={[
                  'h-[0.65cqw] w-[0.65cqw] shrink-0 rounded-full',
                  'transition-colors duration-500 ease-out',
                  active ? 'bg-[#e4572e]' : 'bg-[#d5d1cc]',
                ].join(' ')}
              />
              <span
                className={[
                  'text-[1.2cqw] leading-none transition-colors duration-500 ease-out',
                  active ? 'text-[#1f2328]' : 'text-[#8b8f96]',
                ].join(' ')}
              >
                {category}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="mt-[1.5cqw] h-px bg-[#e6e4e1]" />

      <p className="mt-[1.25cqw] text-[1.15cqw] leading-none text-[#6f747c]">Seller Network</p>
      <p className="mt-[0.8cqw] text-[1.9cqw] font-semibold leading-none tabular-nums text-[#1f2328]">
        25+
      </p>
      <p className="mt-[0.65cqw] text-[1.15cqw] leading-none text-[#6f747c]">states covered</p>

      <div className="mt-auto pt-[1.3cqw]">
        <div className="h-px bg-[#e6e4e1]" />
        <p className="mt-[1.15cqw] text-[1.05cqw] leading-none text-[#8b8f96]">Auction formats</p>
        <p className="mt-[0.8cqw] text-[1.1cqw] leading-[1.35] text-[#4b5058]">
          Forward · Reverse · Sealed
        </p>
      </div>
    </div>
  )
}

export const MarketplaceCard = memo(MarketplaceCardComponent)
