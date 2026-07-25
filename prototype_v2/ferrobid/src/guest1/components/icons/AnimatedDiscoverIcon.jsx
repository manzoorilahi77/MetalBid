import React from 'react';
import { motion } from 'framer-motion';

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1];
const D = 1.5;

// Whole icon is BLANK until its turn, then plays, then holds a clean pose.
const rootVis = {
  blank: { opacity: 0, transition: { duration: 0.12 } },
  play: { opacity: 1, transition: { duration: 0.12 } },
  settled: { opacity: 1 },
};

// "Find the best deals" — a magnifier sweeps across the listings, then locks
// onto the winning one; a star marks it as the best deal.
const glassVariants = {
  blank: { x: 6, y: 2, opacity: 0 },
  play: {
    x: [6, -2, 4, 0, 0],
    y: [2, 0, 0, 0, 0],
    opacity: [0, 1, 1, 1, 1],
    transition: { duration: D, times: [0, 0.2, 0.44, 0.66, 1], ease: EASE_OUT_EXPO },
  },
  settled: { x: 0, y: 0, opacity: 1, transition: { duration: 0.01 } },
  hover: { x: [0, -3, 3, 0], transition: { duration: 0.6, ease: 'easeInOut' } },
};

// Listing rows revealed under the search, then cleared for a clean final pose.
function rowVariants(delayFrac) {
  return {
    blank: { opacity: 0, scaleX: 0 },
    play: { opacity: [0, 0.4, 0.4, 0], scaleX: [0, 1, 1, 1], transition: { duration: D, times: [0, delayFrac, 0.78, 0.92], ease: EASE_OUT_EXPO } },
    settled: { opacity: 0, scaleX: 1, transition: { duration: 0.01 } },
    hover: {},
  };
}

// The best deal's highlight bar — flashes on the locked deal, then clears so
// the final pose is just the magnifier holding the winning star.
const bestBarVariants = {
  blank: { opacity: 0, scaleX: 0 },
  play: { opacity: [0, 0, 1, 1, 0], scaleX: [0, 0, 1, 1, 1], transition: { duration: D, times: [0, 0.62, 0.76, 0.86, 0.96], ease: EASE_OUT_EXPO } },
  settled: { opacity: 0, scaleX: 1, transition: { duration: 0.01 } },
  hover: {},
};
const starVariants = {
  blank: { opacity: 0, scale: 0, rotate: -40 },
  play: { opacity: [0, 0, 1, 1], scale: [0, 0, 1.25, 1], rotate: [-40, -40, 6, 0], transition: { duration: D, times: [0, 0.68, 0.86, 1], ease: 'easeOut' } },
  settled: { opacity: 1, scale: 1, rotate: 0, transition: { duration: 0.01 } },
  hover: { scale: [1, 1.2, 1], rotate: [0, 12, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
};
const glowVariants = {
  blank: { opacity: 0, scale: 0.8 },
  play: { opacity: [0, 0, 0.6, 0], scale: [0.8, 0.8, 1.8, 2.3], transition: { duration: D, times: [0, 0.68, 0.82, 0.96], ease: 'easeOut' } },
  settled: { opacity: 0 },
  hover: {},
};
const sweepVariants = {
  blank: { opacity: 0 },
  play: { opacity: [0, 0.9, 0], x: [-4, 3, 6], transition: { duration: D, times: [0, 0.34, 0.5], ease: 'easeInOut' } },
  settled: { opacity: 0 },
  hover: {},
};

export function AnimatedDiscoverIcon({ active, played, reducedMotion, enableHover, size = 66, className }) {
  const state = reducedMotion ? 'settled' : active ? 'play' : played ? 'settled' : 'blank';
  const initial = reducedMotion ? 'settled' : 'blank';
  const hover = enableHover && !reducedMotion ? 'hover' : undefined;

  return (
    <motion.svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} style={{ overflow: 'visible' }}
      variants={rootVis} initial={initial} animate={state} whileHover={hover} aria-hidden="true">
      {/* listing rows */}
      <motion.rect x="5" y="8" width="12" height="2" rx="1" fill="currentColor" style={{ transformOrigin: '5px 9px' }} variants={rowVariants(0.24)} initial={initial} animate={state} />
      <motion.rect x="5" y="21" width="12" height="2" rx="1" fill="currentColor" style={{ transformOrigin: '5px 22px' }} variants={rowVariants(0.34)} initial={initial} animate={state} />

      {/* best deal highlight bar (middle) */}
      <motion.rect x="4" y="13.6" width="16" height="4.8" rx="1.4" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.4" style={{ transformOrigin: '4px 16px' }} variants={bestBarVariants} initial={initial} animate={state} />

      {/* magnifier */}
      <motion.g variants={glassVariants} initial={initial} animate={state} whileHover={hover}>
        <circle cx="16" cy="16" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
        <line x1="21" y1="21" x2="27" y2="27" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <motion.rect x="10" y="10.5" width="2.2" height="11" rx="1.1" fill="#ffffff" variants={sweepVariants} initial={initial} animate={state} />
      </motion.g>

      {/* winning star */}
      <motion.circle cx="16" cy="16" r="5.5" fill="currentColor" variants={glowVariants} initial={initial} animate={state} />
      <motion.path d="M16 12.4l1.15 2.35 2.6.38-1.88 1.82.44 2.57L16 18.28l-2.31 1.22.44-2.57-1.88-1.82 2.6-.38z"
        fill="currentColor" style={{ transformOrigin: '16px 16px' }} variants={starVariants} initial={initial} animate={state} whileHover={hover} />
    </motion.svg>
  );
}
