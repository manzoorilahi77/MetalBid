import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// apply initial theme class before first paint
// defaults to light unless the user has manually chosen dark mode in settings
const storedTheme = localStorage.getItem('theme')
document.documentElement.classList.toggle('dark', storedTheme === 'dark')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
