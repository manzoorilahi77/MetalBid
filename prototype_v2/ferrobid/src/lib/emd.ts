/* ---------------------------------------------------------------------------
   Pre-bid EMD timing rules. Pure functions over a Catalogue — no React, no
   store — so every entry point (dashboard, catalogue page, shortlist, bidroom,
   the Bid Now shortcut) asks the same question and gets the same answer.

   The rule: EMD has to be funded before the catalogue's `emdDeadline`, which
   sits 1–2 days ahead of go-live. Once that deadline passes, shortlisting and
   funding new lots is refused — whether the catalogue is still upcoming or
   has since gone live — until either a sub-admin approves an EMD exemption
   request, or the auction closes. Lots already shortlisted-and-funded before
   the cut-off stay usable (their own per-lot lock, not this one); this only
   blocks picking up *new* lots after the window has shut.
--------------------------------------------------------------------------- */
import type { Catalogue } from '../types'

/** Default lead time between the EMD cut-off and go-live. Per-catalogue
 *  `emdDeadline` overrides this — the seed sets 1–2 days depending on sale. */
export const EMD_LEAD_DAYS = 1

export const DAY_MS = 24 * 3600_000

/** How close a deadline has to be before buyers get nagged about it. */
export const EMD_REMINDER_WINDOW_MS = 24 * 3600_000

/** Deadline as epoch ms. Falls back to `startsAt − EMD_LEAD_DAYS` for
 *  catalogues built before the field existed (or by an older mock run). */
export function emdDeadlineMs(cat: Pick<Catalogue, 'emdDeadline' | 'startsAt'>): number {
  const explicit = cat.emdDeadline ? Date.parse(cat.emdDeadline) : NaN
  return Number.isNaN(explicit) ? Date.parse(cat.startsAt) - EMD_LEAD_DAYS * DAY_MS : explicit
}

/** Default deadline for a catalogue starting at `startsAt`. */
export function defaultEmdDeadline(startsAt: string, leadDays = EMD_LEAD_DAYS): string {
  return new Date(Date.parse(startsAt) - leadDays * DAY_MS).toISOString()
}

/** True once the cut-off has passed for a catalogue that's still upcoming or
 *  live — new EMD funding/shortlisting is refused from here (an approved
 *  exemption reopens it). A closed or draft catalogue was never eligible for
 *  this gate in the first place, so it's excluded rather than always-true. */
export function emdWindowClosed(
  cat: Pick<Catalogue, 'emdDeadline' | 'startsAt' | 'status'>,
  now: number,
): boolean {
  return (cat.status === 'upcoming' || cat.status === 'live') && now > emdDeadlineMs(cat)
}

/** Deadline is still ahead but inside the nag window, so a reminder is due. */
export function emdDeadlineSoon(
  cat: Pick<Catalogue, 'emdDeadline' | 'startsAt' | 'status'>,
  now: number,
): boolean {
  if (cat.status !== 'upcoming') return false
  const left = emdDeadlineMs(cat) - now
  return left > 0 && left <= EMD_REMINDER_WINDOW_MS
}

/** One wording for the refusal, wherever it surfaces. */
export function emdBlockedMessage(cat: Pick<Catalogue, 'code' | 'emdDeadline' | 'startsAt'>): string {
  const d = new Date(emdDeadlineMs(cat))
  const when = d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
  return `EMD for ${cat.code} closed on ${when} IST. Pre-bid EMD has to be funded before the deadline — this auction can no longer be joined.`
}
