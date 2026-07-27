import React, { useId } from 'react';
import { motion } from 'framer-motion';

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1];
const D = 1.5;

const rootVis = {
  blank: { opacity: 0, transition: { duration: 0.12 } },
  play: { opacity: 1, transition: { duration: 0.12 } },
  settled: { opacity: 1 },
};

// "Pay securely + instantly" — wallet opens, a card lifts out toward a secure
// shield, the lock latches, a processing arc spins, then a green success sweep
// + check. Final clean pose: wallet + secured shield with a check.
const walletVariants = {
  blank: { y: 6, opacity: 0 },
  play: { y: [6, 0], opacity: [0, 1], transition: { duration: D, times: [0, 0.14], ease: EASE_OUT_EXPO } },
  settled: { y: 0, opacity: 1, transition: { duration: 0.01 } },
  hover: {},
};

const cardVariants = {
  blank: { x: 0, y: 0, opacity: 0 },
  play: { opacity: [0, 1, 1, 0], x: [0, 4, 6, 6], y: [0, -4, -8, -8], transition: { duration: D, times: [0, 0.2, 0.42, 0.5], ease: EASE_OUT_EXPO } },
  settled: { opacity: 0 },
  hover: { y: [0, -2, 0], transition: { duration: 0.45, ease: 'easeInOut' } },
};

const shieldVariants = {
  blank: { opacity: 0, scale: 0.6 },
  play: { opacity: [0, 0, 1, 1], scale: [0.6, 0.6, 1.1, 1], transition: { duration: D, times: [0, 0.34, 0.48, 0.56], ease: EASE_OUT_EXPO } },
  settled: { opacity: 1, scale: 1, transition: { duration: 0.01 } },
  hover: { scale: [1, 1.08, 1], transition: { duration: 0.5, ease: 'easeInOut' } },
};

const lockVariants = {
  blank: { opacity: 0, y: -1.5 },
  play: { opacity: [0, 0, 1, 1], y: [-1.5, -1.5, 0, 0], transition: { duration: D, times: [0, 0.48, 0.6, 0.66], ease: 'easeOut' } },
  settled: { opacity: 1, y: 0, transition: { duration: 0.01 } },
  hover: {},
};

const processVariants = {
  blank: { opacity: 0, rotate: 0 },
  play: { opacity: [0, 0, 0.9, 0.9, 0], rotate: [0, 0, 0, 300, 360], transition: { duration: D, times: [0, 0.56, 0.6, 0.76, 0.8], ease: 'easeInOut' } },
  settled: { opacity: 0 },
  hover: {},
};

const sweepVariants = {
  blank: { opacity: 0 },
  play: { opacity: [0, 0, 0.9, 0], x: [0, 0, 6, 6], transition: { duration: D, times: [0, 0.76, 0.84, 0.9], ease: 'easeInOut' } },
  settled: { opacity: 0 },
  hover: {},
};

const checkVariants = {
  blank: { opacity: 0, pathLength: 0 },
  play: { opacity: [0, 0, 1, 1], pathLength: [0, 0, 1, 1], transition: { duration: D, times: [0, 0.8, 0.92, 1], ease: 'easeOut' } },
  settled: { opacity: 1, pathLength: 1, transition: { duration: 0.01 } },
  hover: {},
};

const sparkleVariants = {
  blank: { opacity: 0, scale: 0.5 },
  play: { opacity: [0, 0, 1, 0], scale: [0.5, 0.5, 1.3, 0.7], transition: { duration: D, times: [0, 0.9, 0.95, 1], ease: 'easeOut' } },
  settled: { opacity: 0 },
  hover: {},
};

export function AnimatedPayIcon({ active, played, reducedMotion, enableHover, size = 66, className }) {
  const state = reducedMotion ? 'settled' : active ? 'play' : played ? 'settled' : 'blank';
  const initial = reducedMotion ? 'settled' : 'blank';
  const hover = enableHover && !reducedMotion ? 'hover' : undefined;
  const clipId = useId();

  return (
    <motion.svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} style={{ overflow: 'visible' }}
      variants={rootVis} initial={initial} animate={state} whileHover={hover} aria-hidden="true">
      <motion.g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" variants={walletVariants} initial={initial} animate={state}>
        <rect x="4" y="18" width="15" height="10" rx="2" />
        <path d="M4 21.5h15" />
        <circle cx="15.5" cy="24.5" r="0.9" fill="currentColor" stroke="none" />
      </motion.g>

      <motion.g variants={cardVariants} initial={initial} animate={state} whileHover={hover}>
        <rect x="7" y="14.5" width="9" height="5.5" rx="1" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.4" />
        <rect x="8.4" y="16" width="2.6" height="1.6" rx="0.4" fill="currentColor" />
      </motion.g>

      <motion.g variants={shieldVariants} initial={initial} animate={state} whileHover={hover} style={{ transformOrigin: '22px 10px' }}>
        <defs>
          <clipPath id={clipId}>
            <path d="M22 3.4l6 2.2v4.3c0 3.6-2.6 6-6 7-3.4-1-6-3.4-6-7V5.6z" />
          </clipPath>
        </defs>
        <path d="M22 3.4l6 2.2v4.3c0 3.6-2.6 6-6 7-3.4-1-6-3.4-6-7V5.6z" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <motion.path d="M20 9.5a2 2 0 0 1 4 0" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" variants={lockVariants} initial={initial} animate={state} />
        <rect x="19.6" y="9.3" width="4.8" height="3.6" rx="0.8" fill="currentColor" />
        <motion.path d="M22 3.6a6.4 6.4 0 0 1 0 12.8" stroke="#22c55e" strokeWidth="1.7" fill="none" strokeLinecap="round" variants={processVariants} initial={initial} animate={state} style={{ transformOrigin: '22px 10px' }} />
        <g clipPath={`url(#${clipId})`}>
          <motion.rect x="15" y="3" width="3.2" height="15" fill="#22c55e" opacity="0.7" variants={sweepVariants} initial={initial} animate={state} />
        </g>
      </motion.g>

      <motion.path d="M19.6 10l1.6 1.6 3.2-3.4" stroke="#ffffff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" variants={checkVariants} initial={initial} animate={state} />
      <motion.circle cx="28" cy="15" r="1.1" fill="#ffffff" variants={sparkleVariants} initial={initial} animate={state} />
    </motion.svg>
  );
}
