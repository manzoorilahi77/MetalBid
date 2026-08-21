/* ---------------------------------------------------------------------------
   Reading CMS content in the app.

   The rule this hook is built around: **a page must render identically whether
   or not the CMS answers.** Every accessor takes a fallback, and the fallback is
   the string the component hardcodes today. So switching a page over to the CMS
   is a change nobody can see — until an editor edits something, which is the
   whole point.

   That also means a slow API, a failed fetch or an unseeded page degrade to the
   copy already in the bundle rather than to an empty box.

   Content is fetched once per route and cached for the session. Site copy does
   not change while somebody is reading it, and refetching on every mount would
   put a request on the wire for every navigation.
--------------------------------------------------------------------------- */
import { useEffect, useState } from 'react'
import { apiGet } from './client'

export interface CmsSection {
  key: string
  title: string
  description: string | null
  source: 'cms' | 'portal' | 'api' | 'live' | 'own'
  toggleable: boolean
  lockedReason: string | null
  content: Record<string, unknown>
}

interface CmsPagePayload {
  route: string
  sections: CmsSection[]
}

/** What a page gets back. Never null — an unanswered fetch behaves as an empty
 *  CMS, which every accessor already handles by returning its fallback. */
export interface CmsPage {
  /** Whether a section is switched on. Unknown sections read as ON, so a page
   *  whose sections have not been registered yet still renders in full. */
  on: (sectionKey: string) => boolean
  /** A string block, or the fallback. */
  text: (sectionKey: string, blockKey: string, fallback: string) => string
  /** A structured block (a list, a link, an object), or the fallback. */
  value: <T>(sectionKey: string, blockKey: string, fallback: T) => T
  /** True once the server has answered, either way. For skeletons; most pages
   *  do not need it, because the fallback is already the right thing to show. */
  loaded: boolean
}

const cache = new Map<string, CmsPagePayload>()
const inFlight = new Map<string, Promise<CmsPagePayload | null>>()

function load(route: string): Promise<CmsPagePayload | null> {
  const hit = cache.get(route)
  if (hit) return Promise.resolve(hit)

  const running = inFlight.get(route)
  if (running) return running

  const promise = apiGet<CmsPagePayload>(`/api/cms/page?route=${encodeURIComponent(route)}`)
    .then((payload) => {
      cache.set(route, payload)
      return payload
    })
    .catch(() => null)   // no server, no content: fall back to the bundle
    .finally(() => { inFlight.delete(route) })

  inFlight.set(route, promise)
  return promise
}

export function useCmsPage(route: string): CmsPage {
  const [payload, setPayload] = useState<CmsPagePayload | null>(() => cache.get(route) ?? null)
  const [loaded, setLoaded] = useState(() => cache.has(route))

  useEffect(() => {
    let cancelled = false
    const cached = cache.get(route)
    if (cached) { setPayload(cached); setLoaded(true); return }

    setLoaded(false)
    void load(route).then((next) => {
      if (cancelled) return
      setPayload(next)
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [route])

  const sections = payload?.sections
  const find = (key: string) => sections?.find((s) => s.key === key)

  return {
    /* Unknown reads as ON. A section the registry has never heard of is a
       section nobody has switched off, and hiding it would mean a page going
       blank because somebody forgot a seed row. */
    on: (key) => (sections ? sections.some((s) => s.key === key) || !isKnownRoute(payload) : true),
    text: (key, block, fallback) => {
      const raw = find(key)?.content?.[block]
      return typeof raw === 'string' && raw.length ? raw : fallback
    },
    value: <T,>(key: string, block: string, fallback: T): T => {
      const raw = find(key)?.content?.[block]
      return raw === undefined || raw === null ? fallback : (raw as T)
    },
    loaded,
  }
}

/* A route the server answered for at all. If it returned no sections, the page
   is unregistered rather than fully switched off, and everything renders. */
const isKnownRoute = (payload: CmsPagePayload | null) => !!payload && payload.sections.length > 0

/**
 * The section list for a route, in registry order, including sections that have
 * no content yet — an editor has to be able to see what is missing.
 *
 * Shares the cache with `useCmsPage`, so a page using both makes one request.
 */
export function useCmsSections(route: string): CmsSection[] {
  const [sections, setSections] = useState<CmsSection[]>(() => cache.get(route)?.sections ?? [])

  useEffect(() => {
    let cancelled = false
    const cached = cache.get(route)
    if (cached) { setSections(cached.sections); return }
    void load(route).then((next) => {
      if (!cancelled) setSections(next?.sections ?? [])
    })
    return () => { cancelled = true }
  }, [route])

  return sections
}

/** Drop the cache — used by the CMS editor after publishing, so the author sees
 *  their own change without a reload. */
export function invalidateCmsPage(route?: string): void {
  if (route) cache.delete(route)
  else cache.clear()
}
