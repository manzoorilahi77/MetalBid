/* ---------------------------------------------------------------------------
   ScrollToTop — route-change scroll management.

   React Router's built-in <ScrollRestoration /> only works with a data router
   (createBrowserRouter/createHashRouter). This app uses <HashRouter> + <Routes>,
   so nothing resets the offset on navigation: the browser simply keeps the
   previous scroll position. Clicking "For buyers" from the footer of the Guest 2
   home page therefore dropped you into the *bottom* of the buyers page.

   Three behaviours, matching what people expect from a real site:
   · PUSH / REPLACE (clicking a nav link) → top of the new page, instantly.
   · POP (browser back / forward)         → the offset you left that page at.
     Always jumping to top on Back is the giveaway of a naive implementation —
     it loses the reader's place in a long marketing page.
   · #anchor in the URL                   → that section, and it wins over both.

   Two details that make it feel right rather than merely correct:
   · index.css sets `html { scroll-behavior: smooth }` globally, so the
     route-change jump passes behavior:'instant' explicitly. Without it the page
     visibly animates all the way up from the footer on every navigation, which
     reads as a bug rather than a transition.
   · Guest 2 pages are lazy()-loaded, so the new route mounts empty and the
     document is briefly too short to restore into. Restores retry across a few
     frames instead of silently landing short.
--------------------------------------------------------------------------- */
import { useLayoutEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/** scrollY per history entry, so Back/Forward can put the reader back. */
const offsets = new Map<string, number>()

/** ~200ms of frames — enough for a lazy chunk to mount, short enough that a
 *  genuinely missing anchor falls back quickly. */
const MAX_FRAMES = 12

export default function ScrollToTop() {
  const { key, hash } = useLocation()
  const navigationType = useNavigationType()

  /* Apply the right offset for the incoming route. Layout phase, not passive:
     a passive effect runs after paint, so the new page would flash at the old
     offset for a frame before snapping. */
  useLayoutEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const target = navigationType === 'POP' ? offsets.get(key) ?? 0 : 0
    let raf = 0
    let frames = 0

    const jump = (top: number) => window.scrollTo({ top, left: 0, behavior: 'instant' })

    /** Returns true once the scroll has been settled and we can stop retrying. */
    const apply = (): boolean => {
      if (hash) {
        // An anchor is an explicit request for one section — honour it over
        // both the top-jump and any saved offset.
        let el: Element | null = null
        try {
          el = document.querySelector(hash)
        } catch {
          el = null // not a valid CSS selector (e.g. "#2024-report")
        }
        if (el) {
          // scroll-mt-* on the section clears the sticky header.
          el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
          return true
        }
        return false // section not mounted yet — wait a frame
      }

      jump(target)
      // A lazy page mounts short: if the document can't reach `target` yet the
      // jump lands at the bottom instead, so keep retrying until it can.
      if (target === 0) return true
      return document.documentElement.scrollHeight - window.innerHeight >= target
    }

    if (apply()) return

    const tick = () => {
      frames += 1
      if (apply()) return
      if (frames >= MAX_FRAMES) {
        // Anchor never showed up — don't strand the reader mid-page.
        if (hash) jump(0)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(raf)
  }, [key, hash, navigationType])

  /* Remember where this entry was left, so POP can restore it.
     Recorded live while the reader scrolls rather than once on teardown: by
     teardown the next page's DOM is already committed, and if it is shorter the
     browser has clamped window.scrollY — so a save there would persist a
     truncated offset for the page being left.
     Layout phase again, so the listener is detached synchronously at commit,
     before any clamp-induced scroll event can be dispatched into it. */
  useLayoutEffect(() => {
    const entry = key
    const save = () => offsets.set(entry, window.scrollY)
    window.addEventListener('scroll', save, { passive: true })
    return () => window.removeEventListener('scroll', save)
  }, [key])

  return null
}
