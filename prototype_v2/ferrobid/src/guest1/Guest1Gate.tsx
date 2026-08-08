/* ---------------------------------------------------------------------------
   Guest1Gate — the single, self-contained switch between the manager app and
   the isolated Guest1 homepage. ALL swap logic lives here (inside the guest1/
   module) so the shared entry point only needs a one-line wrap and App.tsx
   needs no Guest1 references at all.

   Guest1 runs as a fully isolated app with its OWN <HashRouter basename="/home">
   (see Guest1App.tsx). React Router forbids nesting one router inside another,
   so Guest1 cannot live inside the manager's <HashRouter>. Instead this gate
   swaps at the very top: when the URL hash is under /home it renders ONLY
   Guest1App; otherwise it renders `children` (the manager app). The two never
   mount together — no shared Chrome, nav, layout, router, or engine.

   Guest1 is the site's official homepage: a bare URL (no hash, or "/") is
   normalized to "#/home" — both eagerly below (covers the first render) and
   on every subsequent navigation event inside subscribe() (covers in-app
   links back to "/", like the manager Chrome's logo) — so this gate always
   sees the homepage as a Guest1 hash rather than falling through to the
   manager app's own root route.
--------------------------------------------------------------------------- */
import { lazy, Suspense, useLayoutEffect, useSyncExternalStore, type ReactNode } from 'react'

// Lazy so the entire homepage bundle (framer sections, react-simple-maps,
// world-atlas topojson, @fontsource CSS, …) is code-split into its own chunk
// and only downloaded when a visitor actually opens the homepage — it never
// weighs down the manager app's initial load.
const Guest1App = lazy(() => import('./Guest1App'))

function currentPath() {
  // Strip any secondary #anchor or ?query first: the homepage's own hash-anchor
  // links (e.g. to="/#how-it-works", the notification bell's "/#announcements")
  // produce a URL like "#/home#how-it-works". Without stripping, the raw hash
  // "/home#how-it-works" matches neither branch below, the gate wrongly leaves
  // Guest1, and the manager app 404s. Match on the router path portion only.
  return window.location.hash.replace(/^#/, '').split(/[?#]/)[0]
}

/** Rewrites a bare root path ("" or "/") to "/home" in place, using the
 *  native History method directly (not the pushState/replaceState patch
 *  below) so it never re-enters the patched setters or fires a second
 *  onChange from inside subscribe()'s own handler. No-op otherwise. */
function normalizeRootToHome() {
  if (currentPath() !== '' && currentPath() !== '/') return
  const { pathname, search } = window.location
  History.prototype.replaceState.call(window.history, null, '', `${pathname}${search}#/home`)
}

// Runs once at module load — before Guest1Gate's first render — so a fresh
// "http://host/" load already resolves to "/home" by the time isGuest1Hash
// takes its first snapshot.
normalizeRootToHome()

function isGuest1Hash() {
  const path = currentPath()
  return path === '/home' || path.startsWith('/home/')
}

/* ---------------------------------------------------------------------------
   CSS isolation. The homepage ships its OWN global stylesheets (a `* { margin:0 }`
   reset, `body`/`img`/`a`/`ul` element rules, and utility classes like `.text-sm`
   / `.flex` that collide with the manager's Tailwind). Once loaded they'd leak
   into and restyle the manager app. We keep them active ONLY while Guest1 is on
   screen and disable them otherwise — no homepage edits, guest1 looks identical.
--------------------------------------------------------------------------- */
function isGuest1StyleNode(node: Element): boolean {
  // Dev: Vite tags each injected <style> with its source path.
  const devId = node.getAttribute('data-vite-dev-id')
  if (devId) return devId.includes('/guest1/') || devId.includes('@fontsource')
  // Prod: the manager ships one entry stylesheet (index-<hash>.css); every other
  // runtime-loaded /assets/*.css chunk belongs to the lazily-loaded guest1 app.
  const href = node.getAttribute('href')
  if (href && href.includes('/assets/')) return !/\/index-[\w-]+\.css(\?|$)/.test(href)
  return false
}

function setGuest1StylesEnabled(enabled: boolean) {
  for (const sheet of Array.from(document.styleSheets)) {
    const node = sheet.ownerNode as Element | null
    if (node && node.nodeType === 1 && isGuest1StyleNode(node)) {
      try {
        sheet.disabled = !enabled
      } catch {
        /* cross-origin sheet — cannot toggle, ignore */
      }
    }
  }
}

function subscribe(onChange: () => void) {
  // A React Router navigation (e.g. the manager Chrome's logo, `<Link to="/">`)
  // uses history.pushState — that fires NEITHER `hashchange` NOR `popstate`.
  // Listening only to `hashchange` would miss those switches (the gate would
  // show the wrong app until a manual refresh). So we also patch
  // pushState/replaceState to notify us, covering every kind of navigation:
  // direct hash writes, browser back/forward, and router pushes. Each handler
  // normalizes a bare root path back to "/home" before notifying React, so
  // Guest1 stays the landing page no matter how "/" was reached.
  const handleChange = () => {
    normalizeRootToHome()
    onChange()
  }
  window.addEventListener('hashchange', handleChange)
  window.addEventListener('popstate', handleChange)

  const { pushState, replaceState } = window.history
  window.history.pushState = function (...args) {
    pushState.apply(this, args)
    handleChange()
  }
  window.history.replaceState = function (...args) {
    replaceState.apply(this, args)
    handleChange()
  }

  return () => {
    window.removeEventListener('hashchange', handleChange)
    window.removeEventListener('popstate', handleChange)
    window.history.pushState = pushState
    window.history.replaceState = replaceState
  }
}

export default function Guest1Gate({ children }: { children: ReactNode }) {
  // "/home" (or a bare "/", normalized above) hands the whole screen to the
  // isolated homepage app.
  const isGuest1 = useSyncExternalStore(subscribe, isGuest1Hash, () => false)

  // Toggle the homepage's stylesheets with the gate so they never leak into the
  // manager app. useLayoutEffect runs BEFORE the browser paints, so leaving
  // Guest1 disables the homepage's global `* { padding:0 }` reset before the
  // manager renders — no flash of edge-to-edge (unpadded) content.
  useLayoutEffect(() => {
    setGuest1StylesEnabled(isGuest1)
  }, [isGuest1])

  if (!isGuest1) return <>{children}</>
  return (
    <Suspense fallback={null}>
      <Guest1App />
    </Suspense>
  )
}
