import React from 'react';
import { motion } from 'framer-motion';
import { ICON_COLORS as C, makeTint } from './palette';

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1];
const D = 1; // master play duration — matches STEP_DURATION_MS in the controller

// Whole icon is BLANK until its turn, then plays, then holds a clean pose.
const rootVis = {
  blank: { opacity: 0, transition: { duration: 0.12 } },
  play: { opacity: 1, transition: { duration: 0.12 } },
  settled: { opacity: 1 },
};

// "Find the best deals from verified sellers" — a board of live listings racks
// up, a magnifier scans down the column, locks onto the middle one, that row
// verifies green and its price flashes gold, then a star crowns the winner.
//
//   0.00 board frame                0.44 magnifier settles on row 2
//   0.08 row 1 (ferrous, steel)     0.54 losing rows dim out
//   0.14 row 2 (copper, amber)      0.58 green lock frame + verified tick
//   0.20 row 3 (aluminium, sky)     0.66 gold price flash
//   0.16 magnifier enters, scans    0.72 star pops + glow + sparks
const boardVariants = {
  blank: { opacity: 0, scale: 0.88 },
  play: { opacity: [0, 0.9, 0.9, 0], scale: [0.88, 1, 1, 1], transition: { duration: D, times: [0, 0.12, 0.84, 0.94], ease: EASE_OUT_EXPO } },
  settled: { opacity: 0 },
  hover: {},
};

// A listing row. The winner holds through the lock-on; the two losers dim away
// the moment the magnifier picks its deal.
function rowVariants(startFrac, isWinner) {
  return {
    blank: { opacity: 0, x: -6 },
    play: isWinner
      ? { opacity: [0, 1, 1, 1, 0], x: [-6, 0, 0, 0, 0], transition: { duration: D, times: [0, startFrac + 0.1, 0.62, 0.86, 0.94], ease: EASE_OUT_EXPO } }
      : { opacity: [0, 0.9, 0.9, 0.18, 0], x: [-6, 0, 0, 0, 0], transition: { duration: D, times: [0, startFrac + 0.1, 0.5, 0.62, 0.86], ease: EASE_OUT_EXPO } },
    settled: { opacity: 0 },
    hover: {},
  };
}

// Magnifier: in from the right, up to row 1, down to row 3, then locks on row 2.
const glassVariants = {
  blank: { x: 10, y: -6, opacity: 0 },
  play: {
    x: [10, 3, 3, -5, -5, 0, 0],
    y: [-6, -6, -6, 5.4, 5.4, 0, 0],
    opacity: [0, 1, 1, 1, 1, 1, 1],
    transition: { duration: D, times: [0, 0.16, 0.24, 0.34, 0.4, 0.5, 1], ease: EASE_OUT_EXPO },
  },
  settled: { x: 0, y: 0, opacity: 1, transition: { duration: 0.01 } },
  hover: { x: [0, -3, 3, 0], transition: { duration: 0.6, ease: 'easeInOut' } },
};

// Glint travelling across the glass while it scans.
const glintVariants = {
  blank: { opacity: 0, x: -5 },
  play: { opacity: [0, 0, 0.85, 0], x: [-5, -5, 5, 5], transition: { duration: D, times: [0, 0.18, 0.32, 0.44], ease: 'easeInOut' } },
  settled: { opacity: 0 },
  hover: {},
};

// Green "this is the one" frame around the winning row.
const lockVariants = {
  blank: { opacity: 0, scaleX: 0.72 },
  play: { opacity: [0, 0, 1, 1, 0], scaleX: [0.72, 0.72, 1, 1, 1], transition: { duration: D, times: [0, 0.54, 0.62, 0.82, 0.9], ease: EASE_OUT_EXPO } },
  settled: { opacity: 0 },
  hover: {},
};

// Verified-seller tick on the winning row.
const tickVariants = {
  blank: { opacity: 0, scale: 0 },
  play: { opacity: [0, 0, 1, 1, 0], scale: [0, 0, 1.35, 1, 1], transition: { duration: D, times: [0, 0.58, 0.66, 0.82, 0.9], ease: 'easeOut' } },
  settled: { opacity: 0 },
  hover: {},
};

// The winning price chip flashes gold as the deal is struck.
const priceFlashVariants = {
  blank: { opacity: 0 },
  play: { opacity: [0, 0, 1, 0.35, 0], transition: { duration: D, times: [0, 0.64, 0.7, 0.8, 0.9], ease: 'easeOut' } },
  settled: { opacity: 0 },
  hover: {},
};

const starVariants = {
  blank: { opacity: 0, scale: 0, rotate: -50 },
  play: { opacity: [0, 0, 1, 1], scale: [0, 0, 1.35, 1], rotate: [-50, -50, 8, 0], transition: { duration: D, times: [0, 0.72, 0.88, 1], ease: 'easeOut' } },
  settled: { opacity: 1, scale: 1, rotate: 0, transition: { duration: 0.01 } },
  hover: { scale: [1, 1.2, 1], rotate: [0, 12, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
};

const glowVariants = {
  blank: { opacity: 0, scale: 0.7 },
  play: { opacity: [0, 0, 0.55, 0], scale: [0.7, 0.7, 2, 2.6], transition: { duration: D, times: [0, 0.7, 0.84, 0.98], ease: 'easeOut' } },
  settled: { opacity: 0 },
  hover: {},
};

// Sparks thrown off the star as it lands.
function sparkVariants(dx, dy, startFrac) {
  return {
    blank: { opacity: 0, scale: 0, x: 0, y: 0 },
    play: {
      opacity: [0, 0, 1, 0], scale: [0, 0, 1, 0.4],
      x: [0, 0, dx, dx * 1.6], y: [0, 0, dy, dy * 1.6],
      transition: { duration: D, times: [0, startFrac, startFrac + 0.07, startFrac + 0.15], ease: 'easeOut' },
    },
    settled: { opacity: 0 },
    hover: {},
  };
}

export function AnimatedDiscoverIcon({ active, played, unified, reducedMotion, enableHover, size = 82, className }) {
  const state = reducedMotion ? 'settled' : active ? 'play' : played ? 'settled' : 'blank';
  const initial = reducedMotion ? 'settled' : 'blank';
  const hover = enableHover && !reducedMotion ? 'hover' : undefined;
  const tint = makeTint(unified);

  return (
    <motion.svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} style={{ overflow: 'visible' }}
      variants={rootVis} initial={initial} animate={state} whileHover={hover} aria-hidden="true">
      {/* listings board */}
      <motion.g variants={boardVariants} initial={initial} animate={state} style={{ transformOrigin: '16px 16px' }}>
        <rect x="2.4" y="5.6" width="27.2" height="20.8" rx="3" fill={tint(C.sky)} fillOpacity="0.07" stroke={tint(C.sky)} strokeWidth="1.3" />
      </motion.g>

      {/* row 1 — ferrous scrap */}
      <motion.g variants={rowVariants(0.08, false)} initial={initial} animate={state}>
        <circle cx="6.4" cy="10" r="1.5" fill={tint(C.steel)} />
        <rect x="9.4" y="9.1" width="8.4" height="1.8" rx="0.9" fill="currentColor" fillOpacity="0.5" />
        <rect x="19.6" y="8.5" width="6.4" height="3" rx="1.5" fill={tint(C.steel)} fillOpacity="0.3" stroke={tint(C.steel)} strokeWidth="0.8" />
      </motion.g>

      {/* row 2 — copper, the best deal */}
      <motion.g variants={rowVariants(0.14, true)} initial={initial} animate={state}>
        <circle cx="6.4" cy="16" r="1.5" fill={tint(C.amber)} />
        <rect x="9.4" y="15.1" width="8.4" height="1.8" rx="0.9" fill="currentColor" fillOpacity="0.8" />
        <rect x="19.6" y="14.5" width="6.4" height="3" rx="1.5" fill={tint(C.amber)} fillOpacity="0.32" stroke={tint(C.amber)} strokeWidth="0.8" />
      </motion.g>

      {/* row 3 — aluminium */}
      <motion.g variants={rowVariants(0.2, false)} initial={initial} animate={state}>
        <circle cx="6.4" cy="22" r="1.5" fill={tint(C.violet)} />
        <rect x="9.4" y="21.1" width="8.4" height="1.8" rx="0.9" fill="currentColor" fillOpacity="0.5" />
        <rect x="19.6" y="20.5" width="6.4" height="3" rx="1.5" fill={tint(C.violet)} fillOpacity="0.3" stroke={tint(C.violet)} strokeWidth="0.8" />
      </motion.g>

      {/* lock-on frame + verified tick + gold price flash on the winning row */}
      <motion.rect x="4.2" y="13.2" width="23.6" height="5.6" rx="1.8" fill="none" stroke={tint(C.green)} strokeWidth="1.4"
        style={{ transformOrigin: '16px 16px' }} variants={lockVariants} initial={initial} animate={state} />
      <motion.g variants={tickVariants} initial={initial} animate={state} style={{ transformOrigin: '29px 16px' }}>
        <circle cx="29" cy="16" r="2.6" fill={tint(C.green)} />
        <path d="M27.8 16l0.85 0.9 1.65-1.9" stroke={C.ink} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
      <motion.rect x="19.6" y="14.5" width="6.4" height="3" rx="1.5" fill={tint(C.gold)}
        variants={priceFlashVariants} initial={initial} animate={state} />

      {/* magnifier */}
      <motion.g variants={glassVariants} initial={initial} animate={state} whileHover={hover}>
        <circle cx="16" cy="16" r="6.6" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="16" cy="16" r="6.6" fill={tint(C.sky)} fillOpacity="0.08" />
        <line x1="20.8" y1="20.8" x2="26.4" y2="26.4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <motion.rect x="15" y="10.4" width="2" height="11.2" rx="1" fill={C.white} variants={glintVariants} initial={initial} animate={state} />
      </motion.g>

      {/* winning star */}
      <motion.circle cx="16" cy="16" r="5.5" fill={tint(C.gold)} variants={glowVariants} initial={initial} animate={state} />
      <motion.path d="M16 12.4l1.15 2.35 2.6.38-1.88 1.82.44 2.57L16 18.28l-2.31 1.22.44-2.57-1.88-1.82 2.6-.38z"
        fill={tint(C.gold)} style={{ transformOrigin: '16px 16px' }} variants={starVariants} initial={initial} animate={state} whileHover={hover} />

      {/* sparks off the star */}
      <motion.circle cx="16" cy="16" r="0.85" fill={tint(C.gold)} variants={sparkVariants(5.5, -4.5, 0.8)} initial={initial} animate={state} />
      <motion.circle cx="16" cy="16" r="0.7" fill={tint(C.white)} variants={sparkVariants(-5.5, -3.5, 0.84)} initial={initial} animate={state} />
      <motion.circle cx="16" cy="16" r="0.6" fill={tint(C.amber)} variants={sparkVariants(2.5, 6, 0.82)} initial={initial} animate={state} />
    </motion.svg>
  );
}
