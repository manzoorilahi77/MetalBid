/* ---------------------------------------------------------------------------
   exitInterstitial — a one-slot registry that lets chrome-level "you're
   leaving" actions (today: the demo role switcher) hand control to a
   page-owned interstitial before they run.

   Deliberately generic and dependency-free in both directions: Chrome doesn't
   know what the interstitial is, and if nothing is registered the caller just
   proceeds. That keeps pages/guest2/ deletable — remove the folder and the
   role switcher navigates immediately, as it always did.

   One slot, not a list: only the mounted route can claim it, and two competing
   interstitials would be a bug rather than a feature.
--------------------------------------------------------------------------- */

/** Return `true` to take over the action; `proceed` then runs on close. */
type Interstitial = (proceed: () => void) => boolean

let current: Interstitial | null = null

/** Claim the slot. Returns an unregister fn for effect cleanup. */
export function registerExitInterstitial(fn: Interstitial): () => void {
  current = fn
  return () => { if (current === fn) current = null }
}

/**
 * Offer an action to the registered interstitial.
 * `true`  — it took over; the caller must NOT act. `proceed` runs on close.
 * `false` — nothing claimed it; the caller should act immediately.
 */
export function requestExitInterstitial(proceed: () => void): boolean {
  return current ? current(proceed) : false
}
