import React from 'react';
import { motion } from 'framer-motion';

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1];
const D = 1.5;

const rootVis = {
  blank: { opacity: 0, transition: { duration: 0.12 } },
  play: { opacity: 1, transition: { duration: 0.12 } },
  settled: { opacity: 1 },
};

// "Sign up + verify KYC" — user appears, two form fields fill in, an ID scan
// line sweeps the profile, a verification ring draws, then a verified badge pops.
const userVariants = {
  blank: { y: 6, opacity: 0 },
  play: { y: [6, 0], opacity: [0, 1], transition: { duration: D, times: [0, 0.14], ease: EASE_OUT_EXPO } },
  settled: { y: 0, opacity: 1, transition: { duration: 0.01 } },
  hover: {},
};

function fieldVariants(startFrac) {
  return {
    blank: { scaleX: 0, opacity: 0 },
    play: { scaleX: [0, 0, 1, 1], opacity: [0, 0.2, 0.8, 0.8], transition: { duration: D, times: [0, startFrac, startFrac + 0.14, 1], ease: EASE_OUT_EXPO } },
    settled: { scaleX: 1, opacity: 0.8, transition: { duration: 0.01 } },
    hover: {},
  };
}

const scanVariants = {
  blank: { opacity: 0, y: -8 },
  play: { opacity: [0, 0, 0.9, 0.9, 0], y: [-8, -8, -8, 8, 8], transition: { duration: D, times: [0, 0.4, 0.44, 0.6, 0.64], ease: 'easeInOut' } },
  settled: { opacity: 0 },
  hover: {},
};

const ringVariants = {
  blank: { pathLength: 0, opacity: 0 },
  play: { pathLength: [0, 0, 1], opacity: [0, 0, 0.5], transition: { duration: D, times: [0, 0.6, 0.82], ease: EASE_OUT_EXPO } },
  settled: { pathLength: 1, opacity: 0.5, transition: { duration: 0.01 } },
  hover: {},
};

const badgeVariants = {
  blank: { scale: 0, opacity: 0 },
  play: { scale: [0, 0, 1.2, 1], opacity: [0, 0, 1, 1], transition: { duration: D, times: [0, 0.74, 0.88, 0.96], ease: 'easeOut' } },
  settled: { scale: 1, opacity: 1, transition: { duration: 0.01 } },
  hover: { scale: [1, 1.18, 1], transition: { duration: 0.5, ease: 'easeInOut' } },
};

const glowVariants = {
  blank: { opacity: 0, scale: 1 },
  play: { opacity: [0, 0, 0.7, 0], scale: [1, 1, 1.9, 2.4], transition: { duration: D, times: [0, 0.82, 0.9, 1], ease: 'easeOut' } },
  settled: { opacity: 0 },
  hover: {},
};

export function AnimatedRegisterIcon({ active, played, reducedMotion, enableHover, size = 66, className }) {
  const state = reducedMotion ? 'settled' : active ? 'play' : played ? 'settled' : 'blank';
  const initial = reducedMotion ? 'settled' : 'blank';
  const hover = enableHover && !reducedMotion ? 'hover' : undefined;

  return (
    <motion.svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} style={{ overflow: 'visible' }}
      variants={rootVis} initial={initial} animate={state} whileHover={hover} aria-hidden="true">
      <motion.rect x="18" y="11" width="10" height="2" rx="1" fill="currentColor" style={{ transformOrigin: '18px 12px' }} variants={fieldVariants(0.18)} initial={initial} animate={state} />
      <motion.rect x="18" y="16" width="8" height="2" rx="1" fill="currentColor" style={{ transformOrigin: '18px 17px' }} variants={fieldVariants(0.32)} initial={initial} animate={state} />

      <motion.g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" variants={userVariants} initial={initial} animate={state}>
        <circle cx="11" cy="11" r="4" />
        <path d="M4 24c0-4.2 3.1-7.4 7-7.4s7 3.2 7 7.4" />
      </motion.g>

      <motion.rect x="4.5" y="15" width="13" height="1.6" rx="0.8" fill="#ffffff" variants={scanVariants} initial={initial} animate={state} />

      <motion.circle cx="11" cy="15" r="11.5" stroke="currentColor" strokeWidth="1.2" fill="none" variants={ringVariants} initial={initial} animate={state} />

      <motion.circle cx="23" cy="23" r="5.6" fill="currentColor" variants={glowVariants} initial={initial} animate={state} />
      <motion.g variants={badgeVariants} initial={initial} animate={state} whileHover={hover} style={{ transformOrigin: '23px 23px' }}>
        <circle cx="23" cy="23" r="4.8" fill="currentColor" />
        <path d="M20.7 23l1.5 1.5 3.1-3.3" stroke="#0a1220" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
    </motion.svg>
  );
}
