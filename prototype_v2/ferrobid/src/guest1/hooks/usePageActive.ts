import { useEffect, useState } from 'react'

/**
 * True while the document is visible.
 *
 * Every live simulation in the hero subscribes to this, so all timers stop the
 * moment the tab goes to the background. That keeps a backgrounded tab at zero
 * CPU and — just as importantly — prevents a burst of catch-up state when the
 * user returns, which would make the "live" numbers jump implausibly.
 */
export function usePageActive(): boolean {
  const [active, setActive] = useState<boolean>(() =>
    typeof document === 'undefined' ? true : !document.hidden,
  )

  useEffect(() => {
    const handleVisibility = (): void => setActive(!document.hidden)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  return active
}
