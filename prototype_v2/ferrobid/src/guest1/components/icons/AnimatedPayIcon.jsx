import React, { useId } from 'react';
import { motion } from 'framer-motion';
import { ICON_COLORS as C, makeTint } from './palette';

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1];
const D = 1; // master play duration — matches STEP_DURATION_MS in the controller

const rootVis = {
  blank: { opacity: 0, transition: { duration: 0.12 } },
  play: { opacity: 1, transition: { duration: 0.12 } },
  settled: { opacity: 1 },
};

// "Secure payments and instant confirmation" — the wallet rises, a gold card
// lifts out and catches a glint, two coins arc across into a sky shield, the
// lock latches, a gold arc processes the payment, a mint sweep clears it and
// the white check draws in a green flash.
//
//   0.00 wallet rises            0.52 lock latches
//   0.12 card lifts + glints     0.56 processing arc spins
//   0.26 coin 1 arcs over        0.76 mint success sweep
//   0.34 coin 2 arcs over        0.84 check draws + glow
//   0.40 shield scales in        0.90 gold sparks
const walletVariants = {
  blank: { y: 7, opacity: 0 },
  play: { y: [7, 0], opacity: [0, 1], transition: { duration: D, times: [0, 0.14], ease: EASE_OUT_EXPO } },
  settled: { y: 0, opacity: 1, transition: { duration: 0.01 } },
  hover: {},
};

const cardVariants = {
  blank: { x: 0, y: 0, opacity: 0 },
  play: { opacity: [0, 1, 1, 0], x: [0, 3, 5, 5], y: [0, -4, -7, -7], transition: { duration: D, times: [0, 0.18, 0.36, 0.46], ease: EASE_OUT_EXPO } },
  settled: { opacity: 0 },
  hover: { y: [0, -2, 0], transition: { duration: 0.45, ease: 'easeInOut' } },
};

// Light catching the card as it clears the wallet.
const cardGlintVariants = {
  blank: { opacity: 0, x: -4 },
  play: { opacity: [0, 0, 0.9, 0], x: [-4, -4, 6, 6], transition: { duration: D, times: [0, 0.2, 0.32, 0.4], ease: 'easeInOut' } },
  settled: { opacity: 0 },
  hover: {},
};

// A coin arcing from the card into the shield.
function coinVariants(startFrac) {
  return {
    blank: { opacity: 0, x: 0, y: 0, scale: 0.4 },
    play: {
      opacity: [0, 0, 1, 1, 0], scale: [0.4, 0.4, 1, 0.9, 0.5],
      x: [0, 0, 4, 8.5, 11], y: [0, 0, -5.5, -8, -8.5],
      transition: { duration: D, times: [0, startFrac, startFrac + 0.06, startFrac + 0.12, startFrac + 0.17], ease: EASE_OUT_EXPO },
    },
    settled: { opacity: 0 },
    hover: {},
  };
}

const shieldVariants = {
  blank: { opacity: 0, scale: 0.6 },
  play: { opacity: [0, 0, 1, 1], scale: [0.6, 0.6, 1.12, 1], transition: { duration: D, times: [0, 0.38, 0.5, 0.58], ease: EASE_OUT_EXPO } },
  settled: { opacity: 1, scale: 1, transition: { duration: 0.01 } },
  hover: { scale: [1, 1.08, 1], transition: { duration: 0.5, ease: 'easeInOut' } },
};

const lockVariants = {
  blank: { opacity: 0, y: -1.8 },
  play: { opacity: [0, 0, 1, 1], y: [-1.8, -1.8, 0, 0], transition: { duration: D, times: [0, 0.5, 0.6, 0.66], ease: 'easeOut' } },
  settled: { opacity: 1, y: 0, transition: { duration: 0.01 } },
  hover: {},
};

// Latch snap: a ring flicks out the moment the lock closes.
const latchPingVariants = {
  blank: { opacity: 0, scale: 0.5 },
  play: { opacity: [0, 0, 0.8, 0], scale: [0.5, 0.5, 1.9, 2.4], transition: { duration: D, times: [0, 0.58, 0.66, 0.76], ease: 'easeOut' } },
  settled: { opacity: 0 },
  hover: {},
};

const processVariants = {
  blank: { opacity: 0, rotate: 0 },
  play: { opacity: [0, 0, 0.95, 0.95, 0], rotate: [0, 0, 0, 320, 380], transition: { duration: D, times: [0, 0.56, 0.6, 0.76, 0.8], ease: 'easeInOut' } },
  settled: { opacity: 0 },
  hover: {},
};

const sweepVariants = {
  blank: { opacity: 0 },
  play: { opacity: [0, 0, 0.9, 0], x: [0, 0, 7, 7], transition: { duration: D, times: [0, 0.76, 0.84, 0.9], ease: 'easeInOut' } },
  settled: { opacity: 0 },
  hover: {},
};

const successGlowVariants = {
  blank: { opacity: 0, scale: 0.8 },
  play: { opacity: [0, 0, 0.6, 0], scale: [0.8, 0.8, 1.7, 2.1], transition: { duration: D, times: [0, 0.82, 0.9, 1], ease: 'easeOut' } },
  settled: { opacity: 0 },
  hover: {},
};

const checkVariants = {
  blank: { opacity: 0, pathLength: 0 },
  play: { opacity: [0, 0, 1, 1], pathLength: [0, 0, 1, 1], transition: { duration: D, times: [0, 0.82, 0.94, 1], ease: 'easeOut' } },
  settled: { opacity: 1, pathLength: 1, transition: { duration: 0.01 } },
  hover: {},
};

// "Instant" — a receipt slip drops out under the wallet as the payment clears.
const receiptVariants = {
  blank: { opacity: 0, y: -3 },
  play: { opacity: [0, 0, 0.9, 0.9, 0], y: [-3, -3, 0, 0, 1.5], transition: { duration: D, times: [0, 0.84, 0.9, 0.96, 1], ease: 'easeOut' } },
  settled: { opacity: 0 },
  hover: {},
};

function sparkVariants(dx, dy, startFrac) {
  return {
    blank: { opacity: 0, scale: 0, x: 0, y: 0 },
    play: {
      opacity: [0, 0, 1, 0], scale: [0, 0, 1.2, 0.5],
      x: [0, 0, dx, dx * 1.6], y: [0, 0, dy, dy * 1.6],
      transition: { duration: D, times: [0, startFrac, startFrac + 0.05, startFrac + 0.12], ease: 'easeOut' },
    },
    settled: { opacity: 0 },
    hover: {},
  };
}

export function AnimatedPayIcon({ active, played, unified, reducedMotion, enableHover, size = 82, className }) {
  const state = reducedMotion ? 'settled' : active ? 'play' : played ? 'settled' : 'blank';
  const initial = reducedMotion ? 'settled' : 'blank';
  const hover = enableHover && !reducedMotion ? 'hover' : undefined;
  const clipId = useId();
  const tint = makeTint(unified);

  return (
    <motion.svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} style={{ overflow: 'visible' }}
      variants={rootVis} initial={initial} animate={state} whileHover={hover} aria-hidden="true">
      {/* wallet */}
      <motion.g variants={walletVariants} initial={initial} animate={state}>
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="18" width="15" height="10" rx="2" />
          <path d="M4 21.5h15" />
        </g>
        <circle cx="15.5" cy="24.5" r="0.9" fill="currentColor" />
      </motion.g>

      {/* the card lifting out */}
      <motion.g variants={cardVariants} initial={initial} animate={state} whileHover={hover}>
        <rect x="7" y="14.5" width="9" height="5.5" rx="1" fill={tint(C.gold)} fillOpacity="0.2" stroke={tint(C.gold)} strokeWidth="1.4" />
        <rect x="8.4" y="16" width="2.6" height="1.6" rx="0.4" fill={tint(C.gold)} />
        <rect x="8.4" y="18.4" width="6" height="0.8" rx="0.4" fill={tint(C.gold)} fillOpacity="0.55" />
        <motion.rect x="7.2" y="14.7" width="1.6" height="5.1" rx="0.6" fill={C.white} variants={cardGlintVariants} initial={initial} animate={state} />
      </motion.g>

      {/* the money crossing over */}
      {[0.26, 0.34].map((at) => (
        <motion.g key={at} variants={coinVariants(at)} initial={initial} animate={state}>
          <circle cx="12" cy="17" r="1.9" fill={tint(C.gold)} />
          <circle cx="12" cy="17" r="1.05" fill="none" stroke={C.ink} strokeWidth="0.6" strokeOpacity="0.7" />
        </motion.g>
      ))}

      {/* secure shield */}
      <motion.g variants={shieldVariants} initial={initial} animate={state} whileHover={hover} style={{ transformOrigin: '22px 10px' }}>
        <defs>
          <clipPath id={clipId}>
            <path d="M22 3.4l6 2.2v4.3c0 3.6-2.6 6-6 7-3.4-1-6-3.4-6-7V5.6z" />
          </clipPath>
        </defs>
        <path d="M22 3.4l6 2.2v4.3c0 3.6-2.6 6-6 7-3.4-1-6-3.4-6-7V5.6z" fill={tint(C.sky)} fillOpacity="0.15" stroke={tint(C.sky)} strokeWidth="1.7" strokeLinejoin="round" />
        <motion.path d="M20 9.5a2 2 0 0 1 4 0" stroke={tint(C.sky)} strokeWidth="1.5" fill="none" strokeLinecap="round" variants={lockVariants} initial={initial} animate={state} />
        <rect x="19.6" y="9.3" width="4.8" height="3.6" rx="0.8" fill={tint(C.sky)} />
        <motion.circle cx="22" cy="11" r="2.6" fill="none" stroke={tint(C.white)} strokeWidth="0.8" style={{ transformOrigin: '22px 11px' }}
          variants={latchPingVariants} initial={initial} animate={state} />
        <motion.path d="M22 3.6a6.4 6.4 0 0 1 0 12.8" stroke={tint(C.gold)} strokeWidth="1.7" fill="none" strokeLinecap="round"
          variants={processVariants} initial={initial} animate={state} style={{ transformOrigin: '22px 10px' }} />
        <g clipPath={`url(#${clipId})`}>
          <motion.rect x="15" y="3" width="3.2" height="15" fill={tint(C.mint)} opacity="0.8" variants={sweepVariants} initial={initial} animate={state} />
        </g>
      </motion.g>

      {/* confirmation */}
      <motion.circle cx="22" cy="10" r="6.5" fill={tint(C.green)} style={{ transformOrigin: '22px 10px' }} variants={successGlowVariants} initial={initial} animate={state} />
      <motion.path d="M19.6 10l1.6 1.6 3.2-3.4" stroke={C.white} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" variants={checkVariants} initial={initial} animate={state} />

      {/* instant receipt */}
      <motion.g variants={receiptVariants} initial={initial} animate={state}>
        <rect x="21.5" y="19" width="7.5" height="9" rx="1" fill={tint(C.mint)} fillOpacity="0.16" stroke={tint(C.mint)} strokeWidth="1.1" />
        <path d="M23.2 21.6h4.1M23.2 23.6h4.1M23.2 25.6h2.4" stroke={tint(C.mint)} strokeWidth="0.9" strokeLinecap="round" />
      </motion.g>

      <motion.circle cx="22" cy="10" r="1" fill={tint(C.gold)} variants={sparkVariants(6.5, -4, 0.86)} initial={initial} animate={state} />
      <motion.circle cx="22" cy="10" r="0.75" fill={tint(C.white)} variants={sparkVariants(-6, -3.5, 0.88)} initial={initial} animate={state} />
    </motion.svg>
  );
}
