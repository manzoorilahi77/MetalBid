import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' so the static build works when hosted under a sub-path (GitHub Pages)
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
