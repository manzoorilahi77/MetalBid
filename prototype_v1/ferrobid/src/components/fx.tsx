import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CONFETTI_COLORS } from '../constants/theme';
import { cx } from '../utils';

/** Scroll-triggered reveal (IntersectionObserver). */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setSeen(true); ob.disconnect(); } },
      { threshold: 0.15 }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, []);
  return (
    <div ref={ref} className={cx(seen ? 'reveal-visible' : 'reveal-hidden', className)} style={seen ? { animationDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}

/** Animates numeric changes with an ease-out count. */
export function useAnimatedValue(target: number, duration = 500): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(step);
      else fromRef.current = target;
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return value;
}

/** ₹ price that counts between values and pops on change. */
export function AnimatedInr({ value, className }: { value: number; className?: string }) {
  const shown = useAnimatedValue(value);
  const [popKey, setPopKey] = useState(0);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value) { setPopKey((k) => k + 1); prev.current = value; }
  }, [value]);
  return (
    <span key={popKey} className={cx('inline-block animate-price-pop tabular-nums', className)}>
      ₹{shown.toLocaleString('en-IN')}
    </span>
  );
}

/** Count-up stat for landing/dashboards; starts when scrolled into view. */
export function CountUp({ to, suffix = '', prefix = '', duration = 1400, className }: { to: number; suffix?: string; prefix?: string; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      ob.disconnect();
      const start = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - start) / duration);
        setVal(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.4 });
    ob.observe(el);
    return () => ob.disconnect();
  }, [to, duration]);
  return <span ref={ref} className={cx('tabular-nums', className)}>{prefix}{val.toLocaleString('en-IN')}{suffix}</span>;
}

/** Countdown where each segment flips when it changes. */
export function FlipClock({ text, className }: { text: string; className?: string }) {
  const parts = text.split('');
  const prev = useRef<string[]>(parts);
  const rendered = parts.map((ch, i) => {
    const changed = prev.current[i] !== ch;
    return (
      <span key={`${i}-${ch}`} className={cx('inline-block', changed && 'animate-tick')}>
        {ch}
      </span>
    );
  });
  prev.current = parts;
  return <span className={cx('font-mono', className)}>{rendered}</span>;
}

/** Celebration burst — fixed overlay, fire-and-forget. */
export function Confetti({ count = 60 }: { count?: number }) {
  const pieces = useRef(
    Array.from({ length: count }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      duration: 2.4 + Math.random() * 2,
      size: 6 + Math.random() * 7,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      round: Math.random() > 0.5,
    }))
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      {pieces.current.map((p, i) => (
        <span
          key={i}
          className="animate-confetti absolute top-0"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * (p.round ? 1 : 0.45),
            backgroundColor: p.color,
            borderRadius: p.round ? '50%' : '2px',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
