import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useApp, applyTheme } from './store'

// set the theme attribute before first paint to avoid a flash of the wrong theme
applyTheme(useApp.getState().theme)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
