import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { flushNow, installServerActions, startPersistence } from './api/persist'
import { useHomeData } from './api/useHomeData'
import { bootstrapSession } from './api/auth'
import { useStore } from './store/store'
import Guest1Gate from './guest1/Guest1Gate'
import './index.css'

/** The one fetch everything depends on: public catalogues, announcements and
 *  the user directory. Mounted ABOVE Guest1Gate so it runs for both worlds —
 *  the isolated /home homepage reads the same store, and the manager app's
 *  per-user fetches key on the identity this restores. It uses no router
 *  hooks, so it can sit outside both apps' routers. */
function Bootstrap() {
  useHomeData()
  useRestoredSession()
  return null
}

/**
 * Turn a stored refresh token back into a signed-in session.
 *
 * Without this, a reload signs everybody out — the access token lives in memory
 * only, deliberately. The refresh token survives, so one round trip at boot
 * puts the person back where they were.
 *
 * A failure here is not an error state: it means "nobody is signed in", which
 * is the correct starting point for a visitor.
 */
function useRestoredSession() {
  const adoptSession = useStore((s) => s.adoptSession)
  const sessionResolved = useStore((s) => s.sessionResolved)
  useEffect(() => {
    let cancelled = false
    /* `finally`, not `then`: route guards block until this settles, so the one
       thing that must never happen is it not settling. A visitor with no stored
       token, an expired token and a server that is simply down all have to end
       up in the same 'ready' state — otherwise the app hangs on a spinner
       instead of showing them the login page. */
    void bootstrapSession().then((me) => {
      if (cancelled || !me) return
      adoptSession({
        id: me.user.id,
        name: me.user.name,
        firm: me.user.firm ?? '',
        phone: me.user.phone ?? '',
        email: me.user.email ?? '',
        role: me.user.role as never,
        kycStatus: (me.user.kycStatus ?? 'none') as never,
        sellerVerified: !!me.user.sellerVerified,
        standing: (me.user.standing ?? 'good') as never,
        city: me.user.city ?? '',
        gstin: me.user.gstin ?? '',
        avatarHue: me.user.avatarHue ?? 0,
        joinedAt: me.user.joinedAt ?? new Date().toISOString(),
        bidderId: me.user.bidderId ?? null,
        sellerId: null,
        accountStatus: (me.user.status ?? 'active') as never,
        lastActiveAt: me.user.lastLoginAt ?? undefined,
      })
    }).finally(() => {
      if (!cancelled) sessionResolved()
    })
    return () => { cancelled = true }
  }, [adoptSession, sessionResolved])
}

// apply initial theme class before first paint
// defaults to light unless the user has manually chosen dark mode in settings
const storedTheme = localStorage.getItem('theme')
document.documentElement.classList.toggle('dark', storedTheme === 'dark')

/* Persist every store change to the database, and route the two writes the
   server must own (placing a bid, funding EMD) through it. Started before the
   first render so no action can slip through unsaved. */
startPersistence()
installServerActions()

/* A queued batch is 120ms from being sent; a tab closed inside that window would
   lose it. sendBeacon is not used because the batch may exceed its size cap. */
window.addEventListener('pagehide', () => { void flushNow() })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Bootstrap />
    {/* Guest1Gate renders the isolated /home homepage, or <App /> otherwise. */}
    <Guest1Gate>
      <App />
    </Guest1Gate>
  </StrictMode>,
)
