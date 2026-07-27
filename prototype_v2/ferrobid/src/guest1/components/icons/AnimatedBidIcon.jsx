import React from 'react';
import { motion } from 'framer-motion';

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1];
const D = 1.5;

const rootVis = {
  blank: { opacity: 0, transition: { duration: 0.12 } },
  play: { opacity: 1, transition: { duration: 0.12 } },
  settled: { opacity: 1 },
};

// "Join a live auction and win" — a digital live-bidding screen: the LIVE dot
// pulses, competing bids blip in as the price climbs, a rising line tracks the
// bid trend, the winning bid tag rises, the frame flashes, then a WON badge
// confirms. Final clean pose: the auction screen with LIVE dot, climbing line
// + arrow, and a WON check.

const screenVariants = {
  blank: { opacity: 0, scale: 0.9 },
  play: { opacity: [0, 1], scale: [0.9, 1], transition: { duration: D, times: [0, 0.14], ease: EASE_OUT_EXPO } },
  settled: { opacity: 1, scale: 1, transition: { duration: 0.01 } },
  hover: {},
};

const liveDotVariants = {
  blank: { opacity: 0 },
  play: { opacity: [0, 1, 0.3, 1, 0.3, 1, 1], transition: { duration: D, times: [0, 0.14, 0.26, 0.38, 0.5, 0.62, 1], ease: 'easeInOut' } },
  settled: { opacity: 1, transition: { duration: 0.01 } },
  hover: { opacity: [1, 0.3, 1], transition: { duration: 0.5, ease: 'easeInOut' } },
};

const liveBarVariants = {
  blank: { opacity: 0, scaleX: 0 },
  play: { opacity: [0, 1], scaleX: [0, 1], transition: { duration: D, times: [0, 0.2], ease: EASE_OUT_EXPO } },
  settled: { opacity: 1, scaleX: 1, transition: { duration: 0.01 } },
  hover: {},
};

// Climbing bid-trend line draws itself.
const lineVariants = {
  blank: { pathLength: 0, opacity: 0 },
  play: { pathLength: [0, 0, 1], opacity: [0, 1, 1], transition: { duration: D, times: [0, 0.22, 0.68], ease: 'easeInOut' } },
  settled: { pathLength: 1, opacity: 1, transition: { duration: 0.01 } },
  hover: {},
};

const arrowVariants = {
  blank: { opacity: 0, scale: 0 },
  play: { opacity: [0, 0, 1], scale: [0, 0, 1], transition: { duration: D, times: [0, 0.62, 0.72], ease: 'easeOut' } },
  settled: { opacity: 1, scale: 1, transition: { duration: 0.01 } },
  hover: {},
};

// Competing bids blip along the trend, then fade.
function bidBlipVariants(atFrac) {
  return {
    blank: { opacity: 0, scale: 0 },
    play: { opacity: [0, 0, 1, 0], scale: [0, 0, 1.3, 0.6], transition: { duration: D, times: [0, atFrac, atFrac + 0.06, atFrac + 0.18], ease: 'easeOut' } },
    settled: { opacity: 0 },
    hover: {},
  };
}

// Winning bid tag rises and locks, then clears for the clean final.
const tagVariants = {
  blank: { opacity: 0, y: 3 },
  play: { opacity: [0, 0, 1, 1, 0], y: [3, 3, 0, 0, -2], transition: { duration: D, times: [0, 0.4, 0.5, 0.72, 0.82], ease: 'easeOut' } },
  settled: { opacity: 0 },
  hover: {},
};

// Frame flashes on the winning moment.
const flashVariants = {
  blank: { opacity: 0 },
  play: { opacity: [0, 0, 0.85, 0], transition: { duration: D, times: [0, 0.66, 0.74, 0.86], ease: 'easeOut' } },
  settled: { opacity: 0 },
  hover: {},
};

const wonBadgeVariants = {
  blank: { opacity: 0, scale: 0 },
  play: { opacity: [0, 0, 1, 1], scale: [0, 0, 1.25, 1], transition: { duration: D, times: [0, 0.72, 0.88, 0.98], ease: 'easeOut' } },
  settled: { opacity: 1, scale: 1, transition: { duration: 0.01 } },
  hover: { scale: [1, 1.16, 1], transition: { duration: 0.5, ease: 'easeInOut' } },
};
const wonGlowVariants = {
  blank: { opacity: 0, scale: 1 },
  play: { opacity: [0, 0, 0.7, 0], scale: [1, 1, 1.9, 2.4], transition: { duration: D, times: [0, 0.74, 0.86, 0.98], ease: 'easeOut' } },
  settled: { opacity: 0 },
  hover: {},
};

export function AnimatedBidIcon({ active, played, reducedMotion, enableHover, size = 82, className }) {
  const state = reducedMotion ? 'settled' : active ? 'play' : played ? 'settled' : 'blank';
  const initial = reducedMotion ? 'settled' : 'blank';
  const hover = enableHover && !reducedMotion ? 'hover' : undefined;

  return (
    <motion.svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} style={{ overflow: 'visible' }}
      variants={rootVis} initial={initial} animate={state} whileHover={hover} aria-hidden="true">
      {/* auction screen */}
      <motion.g variants={screenVariants} initial={initial} animate={state} style={{ transformOrigin: '15px 16px' }}>
        <rect x="3.5" y="7" width="23" height="18" rx="2.6" stroke="currentColor" strokeWidth="2" fill="none" />
        {/* LIVE indicator */}
        <motion.circle cx="7" cy="10.6" r="1.3" fill="currentColor" variants={liveDotVariants} initial={initial} animate={state} whileHover={hover} />
        <motion.rect x="9.4" y="9.8" width="6" height="1.6" rx="0.8" fill="currentColor" style={{ transformOrigin: '9.4px 10.6px' }} variants={liveBarVariants} initial={initial} animate={state} />
      </motion.g>

      {/* competing bid blips along the trend */}
      <motion.circle cx="11.5" cy="19.5" r="1" fill="currentColor" variants={bidBlipVariants(0.3)} initial={initial} animate={state} />
      <motion.circle cx="16" cy="18" r="1" fill="currentColor" variants={bidBlipVariants(0.42)} initial={initial} animate={state} />

      {/* climbing bid-trend line */}
      <motion.path d="M7 21 L12 18.5 L16 19.5 L20 14.5 L23.5 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"
        variants={lineVariants} initial={initial} animate={state} />
      <motion.path d="M23.5 12l-2.7-.1 1.1 2.5z" fill="currentColor" style={{ transformOrigin: '23px 13px' }} variants={arrowVariants} initial={initial} animate={state} />

      {/* winning bid tag */}
      <motion.text x="15" y="15.5" textAnchor="middle" fontSize="4.6" fontWeight="700" fontFamily="var(--font-mono, monospace)" fill="currentColor"
        variants={tagVariants} initial={initial} animate={state}>₹1.55L</motion.text>

      {/* winning-frame flash */}
      <motion.rect x="3.5" y="7" width="23" height="18" rx="2.6" stroke="#ffffff" strokeWidth="1.6" fill="none" variants={flashVariants} initial={initial} animate={state} />

      {/* WON check badge, top-right corner */}
      <motion.circle cx="26" cy="8" r="6" fill="currentColor" variants={wonGlowVariants} initial={initial} animate={state} />
      <motion.g variants={wonBadgeVariants} initial={initial} animate={state} whileHover={hover} style={{ transformOrigin: '26px 8px' }}>
        <circle cx="26" cy="8" r="5" fill="currentColor" stroke="#0a1220" strokeWidth="1.4" />
        <path d="M23.6 8l1.5 1.5 3.2-3.4" stroke="#0a1220" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
    </motion.svg>
  );
}
