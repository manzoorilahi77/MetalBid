import { useEffect } from 'react'
import { useStore } from '../store/store'

/** Mount once at app root — drives countdowns, bots, anti-snipe and closing. */
export function useTick() {
  useEffect(() => {
    const id = setInterval(() => useStore.getState().tick(), 1000)
    return () => clearInterval(id)
  }, [])
}

/** Re-renders each second; returns store "now". */
export const useNow = () => useStore((s) => s.now)
