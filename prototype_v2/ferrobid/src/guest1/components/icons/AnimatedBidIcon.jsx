import React from 'react';
import { motion } from 'framer-motion';
import { ICON_COLORS as C, makeTint } from './palette';

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1];
const D = 1; // master play duration — matches STEP_DURATION_MS in the controller

const rootVis = {
  blank: { opacity: 0, transition: { duration: 0.12 } },
  play: { opacity: 1, transition: { duration: 0.12 } },
  settled: { opacity: 1 },
};

// "Join live auctions or place forward bids" — the bidding screen boots, the
// LIVE dot starts pulsing red, a countdown hand sweeps down, rival bids blip
// along a climbing green trend while the price ticks ₹1.20L → ₹1.42L → ₹1.55L,
// the frame flashes on the winning bid and a green WON badge lands in confetti.
//
//   0.00 screen boots               0.62 arrowhead pops on the trend
//   0.10 LIVE dot pulses            0.66 winning-frame flash
//   0.14 countdown hand sweeps      0.72 WON badge + glow
//   0.22 trend line climbs          0.80 confetti bursts
//   0.28 rival bids blip (×3)
//   0.34 price ticks up (×3)
const screenVariants = {
  blank: { opacity: 0, scale: 0.9 },
  play: { opacity: [0, 1], scale: [0.9, 1], transition: { duration: D, times: [0, 0.14], ease: EASE_OUT_EXPO } },
  settled: { opacity: 1, scale: 1, transition: { duration: 0.01 } },
  hover: {},
};

const liveDotVariants = {
  blank: { opacity: 0 },
  play: { opacity: [0, 1, 0.25, 1, 0.25, 1, 1], transition: { duration: D, times: [0, 0.12, 0.24, 0.36, 0.48, 0.6, 1], ease: 'easeInOut' } },
  settled: { opacity: 1, transition: { duration: 0.01 } },
  hover: { opacity: [1, 0.3, 1], transition: { duration: 0.5, ease: 'easeInOut' } },
};

// Halo ringing out of the LIVE dot on each pulse.
const livePingVariants = {
  blank: { opacity: 0, scale: 0.6 },
  play: { opacity: [0, 0.5, 0, 0.5, 0], scale: [0.6, 2.2, 2.2, 2.2, 2.2], transition: { duration: D, times: [0, 0.18, 0.3, 0.42, 0.54], ease: 'easeOut' } },
  settled: { opacity: 0 },
  hover: {},
};

const liveBarVariants = {
  blank: { opacity: 0, scaleX: 0 },
  play: { opacity: [0, 1], scaleX: [0, 1], transition: { duration: D, times: [0, 0.2], ease: EASE_OUT_EXPO } },
  settled: { opacity: 1, scaleX: 1, transition: { duration: 0.01 } },
  hover: {},
};

// Auction countdown: the clock face fades in and its hand sweeps a full turn.
const clockVariants = {
  blank: { opacity: 0 },
  play: { opacity: [0, 0, 0.95, 0.95, 0], transition: { duration: D, times: [0, 0.12, 0.2, 0.66, 0.76], ease: 'easeOut' } },
  settled: { opacity: 0 },
  hover: {},
};
const clockHandVariants = {
  blank: { rotate: 0 },
  play: { rotate: [0, 0, 330], transition: { duration: D, times: [0, 0.16, 0.68], ease: 'easeInOut' } },
  settled: { rotate: 0 },
  hover: {},
};

// Climbing bid-trend line draws itself.
const lineVariants = {
  blank: { pathLength: 0, opacity: 0 },
  play: { pathLength: [0, 0, 1], opacity: [0, 1, 1], transition: { duration: D, times: [0, 0.22, 0.66], ease: 'easeInOut' } },
  settled: { pathLength: 1, opacity: 1, transition: { duration: 0.01 } },
  hover: {},
};

const arrowVariants = {
  blank: { opacity: 0, scale: 0 },
  play: { opacity: [0, 0, 1, 1], scale: [0, 0, 1.3, 1], transition: { duration: D, times: [0, 0.62, 0.7, 0.76], ease: 'easeOut' } },
  settled: { opacity: 1, scale: 1, transition: { duration: 0.01 } },
  hover: {},
};

// A rival's bid landing on the trend, with a ring pinging out of it.
function bidBlipVariants(atFrac) {
  return {
    blank: { opacity: 0, scale: 0 },
    play: { opacity: [0, 0, 1, 0], scale: [0, 0, 1.4, 0.6], transition: { duration: D, times: [0, atFrac, atFrac + 0.05, atFrac + 0.16], ease: 'easeOut' } },
    settled: { opacity: 0 },
    hover: {},
  };
}
function bidRingVariants(atFrac) {
  return {
    blank: { opacity: 0, scale: 0.4 },
    play: { opacity: [0, 0, 0.7, 0], scale: [0.4, 0.4, 2.4, 3], transition: { duration: D, times: [0, atFrac, atFrac + 0.07, atFrac + 0.17], ease: 'easeOut' } },
    settled: { opacity: 0 },
    hover: {},
  };
}

// The price ticking up: three quotes cross-fading in place.
function priceVariants(inFrac, outFrac) {
  return {
    blank: { opacity: 0, y: 2.5 },
    play: { opacity: [0, 0, 1, 1, 0], y: [2.5, 2.5, 0, 0, -2], transition: { duration: D, times: [0, inFrac, inFrac + 0.05, outFrac, outFrac + 0.05], ease: 'easeOut' } },
    settled: { opacity: 0 },
    hover: {},
  };
}

const flashVariants = {
  blank: { opacity: 0 },
  play: { opacity: [0, 0, 0.9, 0], transition: { duration: D, times: [0, 0.66, 0.72, 0.84], ease: 'easeOut' } },
  settled: { opacity: 0 },
  hover: {},
};

const wonBadgeVariants = {
  blank: { opacity: 0, scale: 0 },
  play: { opacity: [0, 0, 1, 1], scale: [0, 0, 1.3, 1], transition: { duration: D, times: [0, 0.72, 0.86, 0.96], ease: 'easeOut' } },
  settled: { opacity: 1, scale: 1, transition: { duration: 0.01 } },
  hover: { scale: [1, 1.16, 1], transition: { duration: 0.5, ease: 'easeInOut' } },
};
const wonGlowVariants = {
  blank: { opacity: 0, scale: 1 },
  play: { opacity: [0, 0, 0.7, 0], scale: [1, 1, 1.9, 2.4], transition: { duration: D, times: [0, 0.74, 0.86, 0.98], ease: 'easeOut' } },
  settled: { opacity: 0 },
  hover: {},
};

// Confetti thrown out of the WON badge.
function confettiVariants(dx, dy, spin, startFrac) {
  return {
    blank: { opacity: 0, x: 0, y: 0, scale: 0, rotate: 0 },
    play: {
      opacity: [0, 0, 1, 0], scale: [0, 0, 1, 0.7], rotate: [0, 0, spin, spin * 1.5],
      x: [0, 0, dx, dx * 1.7], y: [0, 0, dy, dy * 1.7 + 3],
      transition: { duration: D, times: [0, startFrac, startFrac + 0.06, startFrac + 0.15], ease: 'easeOut' },
    },
    settled: { opacity: 0 },
    hover: {},
  };
}

export function AnimatedBidIcon({ active, played, unified, reducedMotion, enableHover, size = 82, className }) {
  const state = reducedMotion ? 'settled' : active ? 'play' : played ? 'settled' : 'blank';
  const initial = reducedMotion ? 'settled' : 'blank';
  const hover = enableHover && !reducedMotion ? 'hover' : undefined;
  const tint = makeTint(unified);

  return (
    <motion.svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} style={{ overflow: 'visible' }}
      variants={rootVis} initial={initial} animate={state} whileHover={hover} aria-hidden="true">
      {/* bidding screen */}
      <motion.g variants={screenVariants} initial={initial} animate={state} style={{ transformOrigin: '15px 16px' }}>
        <rect x="3.5" y="7" width="23" height="18" rx="2.6" stroke="currentColor" strokeWidth="2" fill="none" />
        <rect x="3.5" y="7" width="23" height="18" rx="2.6" fill={tint(C.sky)} fillOpacity="0.05" />

        {/* LIVE indicator */}
        <motion.circle cx="7" cy="10.6" r="1.3" fill={tint(C.red)} variants={livePingVariants} initial={initial} animate={state} style={{ transformOrigin: '7px 10.6px' }} />
        <motion.circle cx="7" cy="10.6" r="1.3" fill={tint(C.red)} variants={liveDotVariants} initial={initial} animate={state} whileHover={hover} />
        <motion.rect x="9.4" y="9.8" width="6" height="1.6" rx="0.8" fill={tint(C.red)} fillOpacity="0.6" style={{ transformOrigin: '9.4px 10.6px' }}
          variants={liveBarVariants} initial={initial} animate={state} />
      </motion.g>

      {/* auction countdown clock */}
      <motion.g variants={clockVariants} initial={initial} animate={state}>
        <circle cx="22.6" cy="10.6" r="2.9" stroke={tint(C.amber)} strokeWidth="1.1" fill="none" />
        <motion.line x1="22.6" y1="10.6" x2="22.6" y2="8.5" stroke={tint(C.amber)} strokeWidth="1.1" strokeLinecap="round"
          style={{ transformOrigin: '22.6px 10.6px' }} variants={clockHandVariants} initial={initial} animate={state} />
      </motion.g>

      {/* rival bids landing on the trend */}
      {[
        { cx: 11.5, cy: 19.4, at: 0.28 },
        { cx: 16, cy: 18.2, at: 0.38 },
        { cx: 19, cy: 16, at: 0.48 },
      ].map((blip) => (
        <React.Fragment key={blip.cx}>
          <motion.circle cx={blip.cx} cy={blip.cy} r="1" fill="none" stroke={tint(C.gold)} strokeWidth="0.7"
            style={{ transformOrigin: `${blip.cx}px ${blip.cy}px` }} variants={bidRingVariants(blip.at)} initial={initial} animate={state} />
          <motion.circle cx={blip.cx} cy={blip.cy} r="1" fill={tint(C.gold)}
            style={{ transformOrigin: `${blip.cx}px ${blip.cy}px` }} variants={bidBlipVariants(blip.at)} initial={initial} animate={state} />
        </React.Fragment>
      ))}

      {/* climbing bid-trend line */}
      <motion.path d="M7 21 L12 18.5 L16 19.5 L20 14.5 L23.5 12" stroke={tint(C.green)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"
        variants={lineVariants} initial={initial} animate={state} />
      <motion.path d="M23.5 12l-2.7-.1 1.1 2.5z" fill={tint(C.green)} style={{ transformOrigin: '23px 13px' }} variants={arrowVariants} initial={initial} animate={state} />

      {/* the price ticking up as the bids land */}
      <motion.text x="14.5" y="15.6" textAnchor="middle" fontSize="4.4" fontWeight="700" fontFamily="var(--font-mono, monospace)" fill={tint(C.steel)}
        variants={priceVariants(0.3, 0.4)} initial={initial} animate={state}>₹1.20L</motion.text>
      <motion.text x="14.5" y="15.6" textAnchor="middle" fontSize="4.4" fontWeight="700" fontFamily="var(--font-mono, monospace)" fill={tint(C.amber)}
        variants={priceVariants(0.42, 0.52)} initial={initial} animate={state}>₹1.42L</motion.text>
      <motion.text x="14.5" y="15.6" textAnchor="middle" fontSize="4.4" fontWeight="700" fontFamily="var(--font-mono, monospace)" fill={tint(C.gold)}
        variants={priceVariants(0.54, 0.74)} initial={initial} animate={state}>₹1.55L</motion.text>

      {/* winning-frame flash */}
      <motion.rect x="3.5" y="7" width="23" height="18" rx="2.6" stroke={C.white} strokeWidth="1.6" fill="none" variants={flashVariants} initial={initial} animate={state} />

      {/* WON check badge, top-right corner */}
      <motion.circle cx="26" cy="8" r="6" fill={tint(C.green)} variants={wonGlowVariants} initial={initial} animate={state} />
      <motion.g variants={wonBadgeVariants} initial={initial} animate={state} whileHover={hover} style={{ transformOrigin: '26px 8px' }}>
        <circle cx="26" cy="8" r="5" fill={tint(C.green)} stroke={C.ink} strokeWidth="1.4" />
        <path d="M23.6 8l1.5 1.5 3.2-3.4" stroke={C.ink} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>

      {/* confetti on the win */}
      {[
        { c: C.gold, dx: 6, dy: -4.5, spin: 90, at: 0.8 },
        { c: C.sky, dx: -5.5, dy: -5, spin: -120, at: 0.82 },
        { c: C.violet, dx: 7, dy: 2, spin: 140, at: 0.84 },
        { c: C.red, dx: -3, dy: -7, spin: -80, at: 0.83 },
      ].map((bit, i) => (
        <motion.rect key={i} x="25.2" y="7.2" width="1.6" height="1.6" rx="0.35" fill={tint(bit.c)}
          style={{ transformOrigin: '26px 8px' }} variants={confettiVariants(bit.dx, bit.dy, bit.spin, bit.at)} initial={initial} animate={state} />
      ))}
    </motion.svg>
  );
}
