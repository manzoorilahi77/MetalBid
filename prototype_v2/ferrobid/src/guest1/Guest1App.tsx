/* ---------------------------------------------------------------------------
   Guest1App — the isolated root of the migrated public homepage.

   This is the ONLY bridge between the manager app and the homepage. It:
     • loads the homepage's fonts + global stylesheets (relocated verbatim from
       the homepage's original src/main.jsx — which is intentionally NOT copied,
       since it carried createRoot + BrowserRouter that we replace here);
     • gives the homepage its OWN router with basename "/home", so every
       absolute path inside the homepage ("/marketplace", "/blog/:slug",
       "/#how-it-works", …) keeps working byte-for-byte, just scoped under
       /home — no page/component/link edits required.

   It deliberately does NOT touch the manager's Chrome / TopNav / Footer or any
   role layout. When this component is mounted, the manager tree is unmounted
   (see the swap in src/App.tsx), so the two apps are fully isolated.
--------------------------------------------------------------------------- */
import { HashRouter } from 'react-router-dom'

/* fonts — relocated verbatim from the homepage's original main.jsx */
import '@fontsource/outfit/400.css'
import '@fontsource/outfit/500.css'
import '@fontsource/outfit/600.css'
import '@fontsource/outfit/700.css'
import '@fontsource/outfit/800.css'
import '@fontsource/outfit/900.css'

import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import '@fontsource/inter/900.css'

import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'

import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/700.css'

import '@fontsource/playfair-display/500.css'
import '@fontsource/playfair-display/600.css'

/* global stylesheets — same order as the homepage's original main.jsx */
import './styles/pages.css'
import './styles/index.css'

/* The homepage app (untyped JS) — see shims.d.ts for the module declaration. */
import HomepageApp from './App.jsx'

export default function Guest1App() {
  return (
    <HashRouter basename="/home">
      <HomepageApp />
    </HashRouter>
  )
}
