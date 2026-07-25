import React from 'react';
import { motion } from 'framer-motion';

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1];
const EASE_IN_OUT = [0.65, 0, 0.35, 1];
const D = 1.5;

const rootVis = {
  blank: { opacity: 0, transition: { duration: 0.12 } },
  play: { opacity: 1, transition: { duration: 0.12 } },
  settled: { opacity: 1 },
};

// "Safely lift and deliver on time" — a crane lifts a steel beam and lowers it
// onto the truck; the suspension dips, headlights flash, exhaust puffs, and the
// truck drives off to the right with dust. Final clean pose: loaded truck +
// delivered badge.
const truckVariants = {
  blank: { x: -7, opacity: 0, scaleY: 1 },
  play: {
    x: [-7, 0, 0, 0, 0, 9, 9],
    opacity: [0, 1, 1, 1, 1, 1, 1],
    scaleY: [1, 1, 1, 0.9, 1, 1, 1],
    transition: { duration: D, times: [0, 0.14, 0.7, 0.76, 0.82, 0.96, 1], ease: EASE_OUT_EXPO },
  },
  settled: { x: 9, opacity: 1, scaleY: 1, transition: { duration: 0.01 } },
  hover: {},
};

const craneVariants = {
  blank: { opacity: 0 },
  play: { opacity: [0, 0, 0.85, 0.85, 0], transition: { duration: D, times: [0, 0.14, 0.24, 0.76, 0.86], ease: 'easeInOut' } },
  settled: { opacity: 0 },
  hover: {},
};

const craneBeamVariants = {
  blank: { opacity: 0, x: 12, y: 8 },
  play: {
    opacity: [0, 0, 1, 1, 1, 1, 0],
    x: [12, 12, 12, 12, 0, 0, 0],
    y: [8, 8, 8, -3, -3, 0, 0],
    transition: { duration: D, times: [0, 0.26, 0.32, 0.48, 0.64, 0.74, 0.8], ease: EASE_IN_OUT },
  },
  settled: { opacity: 0 },
  hover: {},
};

const cargoVariants = {
  blank: { opacity: 0 },
  play: { opacity: [0, 0, 1, 1], transition: { duration: D, times: [0, 0.74, 0.8, 1], ease: 'easeOut' } },
  settled: { opacity: 1, transition: { duration: 0.01 } },
  hover: {},
};

const headlightVariants = {
  blank: { opacity: 0 },
  play: { opacity: [0, 0, 1, 0, 1, 0], transition: { duration: D, times: [0, 0.8, 0.83, 0.86, 0.89, 0.92], ease: 'easeInOut' } },
  settled: { opacity: 0 },
  hover: {},
};

const exhaustVariants = {
  blank: { opacity: 0, scale: 0.5 },
  play: { opacity: [0, 0, 0.5, 0], scale: [0.5, 0.5, 1.8, 2.4], transition: { duration: D, times: [0, 0.86, 0.93, 1], ease: 'easeOut' } },
  settled: { opacity: 0 },
  hover: {},
};

function dustVariants(startFrac) {
  return {
    blank: { opacity: 0, scale: 0.6 },
    play: { opacity: [0, 0, 0.6, 0], scale: [0.6, 0.6, 1.3, 1.7], x: [0, 0, -2, -4], transition: { duration: D, times: [0, startFrac, startFrac + 0.05, startFrac + 0.14], ease: 'easeOut' } },
    settled: { opacity: 0 },
    hover: {},
  };
}

const wheelVariants = {
  blank: { rotate: 0 },
  play: { rotate: [0, 0, 0, 240], transition: { duration: D, times: [0, 0.84, 0.9, 1], ease: 'easeIn' } },
  settled: { rotate: 0, transition: { duration: 0.01 } },
  hover: { rotate: [0, 40, 0], transition: { duration: 0.6, ease: 'easeInOut' } },
};

const deliveredVariants = {
  blank: { opacity: 0, scale: 0 },
  play: { opacity: [0, 0, 1, 1], scale: [0, 0, 1.2, 1], transition: { duration: D, times: [0, 0.82, 0.94, 1], ease: 'easeOut' } },
  settled: { opacity: 1, scale: 1, transition: { duration: 0.01 } },
  hover: { scale: [1, 1.15, 1], transition: { duration: 0.5, ease: 'easeInOut' } },
};

export function AnimatedDeliveryIcon({ active, played, reducedMotion, enableHover, size = 66, className }) {
  const state = reducedMotion ? 'settled' : active ? 'play' : played ? 'settled' : 'blank';
  const initial = reducedMotion ? 'settled' : 'blank';
  const hover = enableHover && !reducedMotion ? 'hover' : undefined;

  return (
    <motion.svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} style={{ overflow: 'visible' }}
      variants={rootVis} initial={initial} animate={state} whileHover={hover} aria-hidden="true">
      <motion.g variants={craneVariants} initial={initial} animate={state} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <line x1="29" y1="2" x2="29" y2="8" />
        <line x1="29" y1="3.5" x2="18.5" y2="6.5" />
      </motion.g>

      <motion.g variants={craneBeamVariants} initial={initial} animate={state}>
        <line x1="16" y1="6.5" x2="16" y2="12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
        <path d="M14.6 12.5h2.8l-1.4 1.6z" fill="currentColor" />
        <rect x="11.5" y="13.8" width="9" height="3" rx="0.6" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" />
      </motion.g>

      <motion.g variants={truckVariants} initial={initial} animate={state} style={{ transformOrigin: '16px 27px' }}>
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="18.5" width="12.5" height="6.5" rx="1" />
          <rect x="15.5" y="16.5" width="6" height="8.5" rx="1" />
        </g>
        <motion.circle cx="21" cy="21" r="0.9" fill="#ffffff" variants={headlightVariants} initial={initial} animate={state} />
        <motion.rect x="4.5" y="14.8" width="9.5" height="3.4" rx="0.6" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.6" variants={cargoVariants} initial={initial} animate={state} />
        <motion.g variants={wheelVariants} initial={initial} animate={state} whileHover={hover} style={{ transformOrigin: '8px 26px' }}>
          <circle cx="8" cy="26" r="2.4" stroke="currentColor" strokeWidth="2" />
          <line x1="8" y1="24" x2="8" y2="28" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="6" y1="26" x2="10" y2="26" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </motion.g>
        <motion.g variants={wheelVariants} initial={initial} animate={state} whileHover={hover} style={{ transformOrigin: '18.5px 26px' }}>
          <circle cx="18.5" cy="26" r="2.4" stroke="currentColor" strokeWidth="2" />
          <line x1="18.5" y1="24" x2="18.5" y2="28" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="16.5" y1="26" x2="20.5" y2="26" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </motion.g>
      </motion.g>

      <motion.circle cx="2.5" cy="20" r="1" fill="currentColor" variants={exhaustVariants} initial={initial} animate={state} />
      <motion.circle cx="6" cy="28.5" r="0.9" fill="currentColor" variants={dustVariants(0.86)} initial={initial} animate={state} />
      <motion.circle cx="10" cy="29" r="0.7" fill="currentColor" variants={dustVariants(0.9)} initial={initial} animate={state} />

      <motion.g variants={deliveredVariants} initial={initial} animate={state} whileHover={hover} style={{ transformOrigin: '27px 8px' }}>
        <circle cx="27" cy="8" r="4.8" fill="currentColor" />
        <path d="M24.7 8l1.5 1.5 3-3.2" stroke="#0a1220" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
    </motion.svg>
  );
}
