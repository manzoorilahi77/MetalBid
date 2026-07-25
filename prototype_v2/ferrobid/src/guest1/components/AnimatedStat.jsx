import React, { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';

// Count-up KPI display. Animates from 0 on first appearance, then smoothly
// tweens from the previous value whenever `value` changes (e.g. a tab switch)
// so every dashboard number reads as "live" rather than a static label.
export const AnimatedStat = ({ value, decimals = 0, prefix = '', suffix = '', duration = 900, className }) => {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const prevValue = useRef(0);
  const isInView = useInView(ref, { once: true, margin: '-20px' });

  useEffect(() => {
    if (!isInView) return;
    const from = prevValue.current;
    const to = value;
    let raf;
    let start = null;

    const animate = (t) => {
      if (!start) start = t;
      const progress = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) {
        raf = requestAnimationFrame(animate);
      } else {
        prevValue.current = to;
      }
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [value, isInView, duration]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {prefix}
      {display.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
};
