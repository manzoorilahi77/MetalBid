import { useEffect, useState } from 'react';

const QUERY = '(hover: hover) and (pointer: fine)';

// Desktop-only micro-interactions (icon replays on hover) should never fire
// on touch devices, where "hover" is simulated by a tap and would otherwise
// replay the animation on every scroll-triggered touch.
export function useHoverCapable() {
  const [hoverCapable, setHoverCapable] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY).matches : false
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(QUERY);
    const handler = (e) => setHoverCapable(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return hoverCapable;
}
