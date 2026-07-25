/* ---------------------------------------------------------------------------
   Guest1Gate — the single, self-contained switch between the manager app and
   the isolated Guest1 homepage. ALL swap logic lives here (inside the guest1/
   module) so the shared entry point only needs a one-line wrap and App.tsx
   needs no Guest1 references at all.

   Guest1 runs as a fully isolated app with its OWN <HashRouter basename="/guest1">
   (see Guest1App.tsx). React Router forbids nesting one router inside another,
   so Guest1 cannot live inside the manager's <HashRouter>. Instead this gate
   swaps at the very top: when the URL hash is under /guest1 it renders ONLY
   Guest1App; otherwise it renders `children` (the manager app). The two never
   mount together — no shared Chrome, nav, layout, router, or engine.
--------------------------------------------------------------------------- */
import { lazy, Suspense, useLayoutEffect, useSyncExternalStore, type ReactNode } from 'react'

// Lazy so the entire homepage bundle (framer sections, react-simple-maps,
// world-atlas topojson, @fontsource CSS, …) is code-split into its own chunk
// and only downloaded when a visitor actually opens /guest1 — it never weighs
// down the manager app's initial load.
const Guest1App = lazy(() => import('./Guest1App'))

function isGuest1Hash() {
  // Strip any secondary #anchor or ?query first: the homepage's own hash-anchor
  // links (e.g. to="/#how-it-works", the notification bell's "/#announcements")
  // produce a URL like "#/guest1#how-it-works". Without stripping, the raw hash
  // "/guest1#how-it-works" matches neither branch below, the gate wrongly leaves
  // Guest1, and the manager app 404s. Match on the router path portion only.
  const path = window.location.hash.replace(/^#/, '').split(/[?#]/)[0]
  return path === '/guest1' || path.startsWith('/guest1/')
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
  // The manager's Chrome RoleSwitcher navigates into /guest1 via React Router,
  // whose HashRouter uses history.pushState — that fires NEITHER `hashchange`
  // NOR `popstate`. Listening only to `hashchange` would miss role→Guest1
  // switches (the gate would show the manager's 404 until a manual refresh).
  // So we also patch pushState/replaceState to notify us, covering every kind
  // of navigation: direct hash writes, browser back/forward, and router pushes.
  window.addEventListener('hashchange', onChange)
  window.addEventListener('popstate', onChange)

  const { pushState, replaceState } = window.history
  window.history.pushState = function (...args) {
    pushState.apply(this, args)
    onChange()
  }
  window.history.replaceState = function (...args) {
    replaceState.apply(this, args)
    onChange()
  }

  return () => {
    window.removeEventListener('hashchange', onChange)
    window.removeEventListener('popstate', onChange)
    window.history.pushState = pushState
    window.history.replaceState = replaceState
  }
}

export default function Guest1Gate({ children }: { children: ReactNode }) {
  // Selecting "Guest 1" in the RoleSwitcher navigates to #/guest1, which flips
  // this and hands the whole screen to the isolated homepage app.
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
