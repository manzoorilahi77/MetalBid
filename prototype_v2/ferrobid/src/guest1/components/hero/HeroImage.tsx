import { memo } from 'react'
import { motion } from 'framer-motion'

export interface HeroImageProps {
  readonly animated: boolean
}

/**
 * The supplied render has three information cards baked into the pixels. Each
 * rectangle below covers one of them.
 *
 * This works because the plate is composited with `mix-blend-multiply` against
 * the section's near-white backdrop: anything pure white multiplies away to
 * exactly the background behind it. A white rectangle is therefore an eraser
 * that leaves no seam — the baked cards disappear and the live components take
 * their place.
 *
 * Bounds are expressed as percentages of the render, so they hold at every
 * width. They are deliberately generous into empty background and tight against
 * the materials, so no steel, copper or plant is clipped.
 */
const BAKED_CARD_ERASERS: readonly string[] = [
  'left-[2%] top-[11%] h-[59%] w-[25%]', // countdown card, mid-left
  'left-[63.2%] top-[1%] h-[45%] w-[30%]', // live auction card, top-right
  'left-[77.8%] top-[41%] h-[55%] w-[21.7%]', // market intelligence card, lower-right
]

/**
 * The industrial still life at the centre of the hero.
 *
 * The render is completely static — it fades and settles once on load and then
 * holds absolutely still, with only a soft contact shadow grounding it. No
 * drift, no cursor tracking: the artwork behaves exactly like the flat image it
 * replaces.
 */
function HeroImageComponent({ animated }: HeroImageProps) {
  return (
    <div className="relative w-full">
      {/* Contact shadow. It sits behind the plate, so the plate's multiply pass
          lets it read straight through the render's white backdrop and ground
          the podium — without outlining the image's rectangle. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[6%] left-1/2 h-[9%] w-[62%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(28,25,23,0.20),rgba(28,25,23,0))] blur-md"
      />

      {/* Blend layer — carries no transform of its own, so it keeps blending
          with the section background instead of isolating itself from it. */}
      <div className="relative mix-blend-multiply">
        <motion.div
          initial={animated ? { opacity: 0, scale: 0.96 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={animated ? { duration: 0.9, ease: [0.22, 1, 0.36, 1] } : { duration: 0 }}
        >
          <div className="relative">
            <img
              /* Vite rewrites asset URLs in index.html but not string literals
                 in JS, so public/ assets must go through BASE_URL or they 404
                 when the site is served from a sub-path (GitHub Pages). */
              src={`${import.meta.env.BASE_URL}hero.jpg`}
              alt="Steel coils, copper wire, steel pipes, a shipping container and an excavator staged for auction"
              width={1483}
              height={933}
              fetchPriority="high"
              decoding="async"
              className="block h-auto w-full"
            />

            {BAKED_CARD_ERASERS.map((bounds) => (
              <span
                key={bounds}
                aria-hidden="true"
                className={`pointer-events-none absolute bg-white ${bounds}`}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export const HeroImage = memo(HeroImageComponent)
