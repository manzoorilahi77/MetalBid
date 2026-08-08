/**
 * Small randomness helpers used by the hero.
 *
 * Randomness here is a texture, not a dice roll: it exists so timings never
 * fall into a visible pattern, and is always drawn from a deliberately narrow
 * band.
 */

/** Random integer in the inclusive range [min, max]. */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** Random float in the half-open range [min, max). */
export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

/** Picks one member of a non-empty list. */
export function pickOne<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length - 1)]
}

/** Constrains `value` to the inclusive range [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
