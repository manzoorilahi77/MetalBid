/* ---------------------------------------------------------------------------
   The bootstrap fetch: public data + the user directory, merged into the store.

   The store now starts EMPTY (see store/seed.ts) — the database is the only
   source of data. This hook, mounted once in App, is what makes the app light
   up when the server is reachable:

   * catalogues, lots and sellers feed Home, Browse and the catalogue detail
     pages, which sit outside every role layout and so have no fetch of their own;
   * announcements feed the public Noticeboard the same way;
   * the user directory (public columns only) is what the login screen
     resolves a "user not found" message against, before a real password check.

   Who is signed in is a separate concern, deliberately not this hook's job —
   see useRestoredSession in main.tsx, which adopts a real account from a
   real refresh token. currentUser stays null here until that (or a real
   sign-in) says otherwise; the per-role fetches (useBuyerData and friends)
   correctly wait on currentUser.id rather than assuming a demo identity.

   If the API is unreachable, nothing is shown — an empty marketplace, not
   fixtures pretending to be live — `serverStatus` flips to 'offline' so screens
   can say so, and the fetch retries until the server answers.

   Merge, never replace: later per-role fetches layer fuller rows (a buyer's own
   profile, reserve rates for the roles allowed them) on top of these.
--------------------------------------------------------------------------- */
import { useEffect, useState } from 'react'
import { apiGet, ApiError } from './client'
import { hydrateStore } from './persist'
import type { Announcement, Catalogue, Lot, Testimonial, User } from '../types'

interface HomePayload {
  serverTime: string
  catalogues: Catalogue[]
  lots: Lot[]
  users: Partial<User>[]
  announcements?: Announcement[]
  testimonials?: Testimonial[]
}

/** Server rows win; rows already in the store without a counterpart are kept. */
function mergeById<T extends { id: string }>(seeded: T[], incoming: Partial<T>[]): T[] {
  const byId = new Map(seeded.map((r) => [r.id, r]))
  for (const row of incoming) {
    const existing = byId.get(row.id as string)
    byId.set(row.id as string, (existing ? { ...existing, ...row } : row) as T)
  }
  return [...byId.values()]
}

const RETRY_MS = 10_000

export type HomeDataState = { loading: boolean; error: string | null; source: 'api' | 'none' }

export function useHomeData(): HomeDataState {
  const [state, setState] = useState<HomeDataState>({ loading: true, error: null, source: 'none' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const ac = new AbortController()
    let retry: ReturnType<typeof setTimeout> | null = null
    apiGet<HomePayload>('/api/home', ac.signal)
      .then((data) => {
        hydrateStore((s) => ({
          /* Who is signed in comes only from a real session — see
             useRestoredSession in main.tsx, which runs alongside this same
             fetch and adopts a real account from the stored refresh token.
             This hook used to also fabricate a demo identity here, from
             before real authentication existed: it made a page refreshed
             with no session look signed in anyway, which is exactly the
             hole login.mjs's own comment warns against ("no offline
             fallback... would be a hole dressed up as resilience"). */
          serverStatus: 'connected',
          catalogues: mergeById(s.catalogues, data.catalogues),
          lots: mergeById(s.lots, data.lots),
          users: mergeById(s.users, data.users as Partial<User>[]),
          announcements: mergeById(s.announcements, data.announcements ?? []),
          testimonials: mergeById(s.testimonials, data.testimonials ?? []),
        }))
        setState({ loading: false, error: null, source: 'api' })
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return
        hydrateStore(() => ({ serverStatus: 'offline' }))
        const message = err instanceof ApiError ? err.message : 'Failed to load live data'
        setState({ loading: false, error: message, source: 'none' })
        /* Keep knocking — the moment the server comes up, the app fills in
           without anyone having to reload. */
        retry = setTimeout(() => setAttempt((n) => n + 1), RETRY_MS)
      })
    return () => {
      ac.abort()
      if (retry) clearTimeout(retry)
    }
  }, [attempt])

  return state
}
