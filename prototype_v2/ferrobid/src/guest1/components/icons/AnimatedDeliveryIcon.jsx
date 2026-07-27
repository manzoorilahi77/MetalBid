import React from 'react';
import { motion } from 'framer-motion';
import { ICON_COLORS as C, makeTint } from './palette';

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1];
const EASE_IN_OUT = [0.65, 0, 0.35, 1];
const D = 1; // master play duration — matches STEP_DURATION_MS in the controller

const rootVis = {
  blank: { opacity: 0, transition: { duration: 0.12 } },
  play: { opacity: 1, transition: { duration: 0.12 } },
  settled: { opacity: 1 },
};

// "Safe logistics and on-time delivery assured" — the truck rolls in, a crane
// hooks a steel beam, swings it across and lowers it onto the bed (the
// suspension takes the weight), a strap snaps over the load, headlights flash
// and the truck pulls away on time with a green delivered badge.
//
//   0.00 truck rolls in          0.66 suspension dips under the load
//   0.14 crane swings in         0.70 strap snaps over the cargo
//   0.26 hook lowers, grabs      0.78 headlights flash, exhaust puffs
//   0.44 beam lifts              0.84 truck pulls away, wheels spin, dust
//   0.56 beam swings across      0.88 delivered badge + on-time ping
const truckVariants = {
  blank: { x: -8, opacity: 0, scaleY: 1 },
  play: {
    x: [-8, 0, 0, 0, 0, 9, 9],
    opacity: [0, 1, 1, 1, 1, 1, 1],
    scaleY: [1, 1, 1, 0.9, 1, 1, 1],
    transition: { duration: D, times: [0, 0.14, 0.64, 0.7, 0.78, 0.96, 1], ease: EASE_OUT_EXPO },
  },
  settled: { x: 9, opacity: 1, scaleY: 1, transition: { duration: 0.01 } },
  hover: {},
};

// Crane mast + jib, with the jib slewing across as it carries the load.
const craneVariants = {
  blank: { opacity: 0 },
  play: { opacity: [0, 0, 0.9, 0.9, 0], transition: { duration: D, times: [0, 0.12, 0.22, 0.72, 0.82], ease: 'easeInOut' } },
  settled: { opacity: 0 },
  hover: {},
};
const jibVariants = {
  blank: { rotate: 0 },
  play: { rotate: [0, 0, 0, 12, 12], transition: { duration: D, times: [0, 0.44, 0.5, 0.64, 1], ease: EASE_IN_OUT } },
  settled: { rotate: 0 },
  hover: {},
};

// The beam: hook drops to it, it lifts, swings left over the bed, then lands.
const craneBeamVariants = {
  blank: { opacity: 0, x: 12, y: 9 },
  play: {
    opacity: [0, 0, 1, 1, 1, 1, 0],
    x: [12, 12, 12, 12, 0, 0, 0],
    y: [9, 9, 9, -3, -3, 0, 0],
    transition: { duration: D, times: [0, 0.24, 0.3, 0.46, 0.6, 0.7, 0.76], ease: EASE_IN_OUT },
  },
  settled: { opacity: 0 },
  hover: {},
};

// Slight pendulum on the suspended load — the detail that sells the weight.
const beamSwayVariants = {
  blank: { rotate: 0 },
  play: { rotate: [0, 0, -6, 4, -2, 0], transition: { duration: D, times: [0, 0.46, 0.56, 0.64, 0.69, 0.74], ease: 'easeInOut' } },
  settled: { rotate: 0 },
  hover: {},
};

const cargoVariants = {
  blank: { opacity: 0 },
  play: { opacity: [0, 0, 1, 1], transition: { duration: D, times: [0, 0.7, 0.76, 1], ease: 'easeOut' } },
  settled: { opacity: 1, transition: { duration: 0.01 } },
  hover: {},
};

// Impact puff where the beam meets the bed.
const impactVariants = {
  blank: { opacity: 0, scaleX: 0.4 },
  play: { opacity: [0, 0, 0.8, 0], scaleX: [0.4, 0.4, 1.5, 1.9], transition: { duration: D, times: [0, 0.68, 0.74, 0.82], ease: 'easeOut' } },
  settled: { opacity: 0 },
  hover: {},
};

// Lashing strap snapping across the load — "safe logistics".
const strapVariants = {
  blank: { opacity: 0, scaleY: 0 },
  play: { opacity: [0, 0, 1, 1], scaleY: [0, 0, 1.25, 1], transition: { duration: D, times: [0, 0.72, 0.79, 0.84], ease: 'easeOut' } },
  settled: { opacity: 1, scaleY: 1, transition: { duration: 0.01 } },
  hover: {},
};

const headlightVariants = {
  blank: { opacity: 0 },
  play: { opacity: [0, 0, 1, 0, 1, 0], transition: { duration: D, times: [0, 0.78, 0.81, 0.84, 0.87, 0.9], ease: 'easeInOut' } },
  settled: { opacity: 0 },
  hover: {},
};

const beamLightVariants = {
  blank: { opacity: 0, scaleX: 0.3 },
  play: { opacity: [0, 0, 0.45, 0, 0.45, 0], scaleX: [0.3, 0.3, 1, 1, 1, 1], transition: { duration: D, times: [0, 0.78, 0.81, 0.84, 0.87, 0.9], ease: 'easeOut' } },
  settled: { opacity: 0 },
  hover: {},
};

const exhaustVariants = {
  blank: { opacity: 0, scale: 0.5 },
  play: { opacity: [0, 0, 0.5, 0], scale: [0.5, 0.5, 1.8, 2.4], transition: { duration: D, times: [0, 0.84, 0.92, 1], ease: 'easeOut' } },
  settled: { opacity: 0 },
  hover: {},
};

function dustVariants(startFrac) {
  return {
    blank: { opacity: 0, scale: 0.6 },
    play: { opacity: [0, 0, 0.6, 0], scale: [0.6, 0.6, 1.3, 1.7], x: [0, 0, -2, -4], transition: { duration: D, times: [0, startFrac, startFrac + 0.04, startFrac + 0.09], ease: 'easeOut' } },
    settled: { opacity: 0 },
    hover: {},
  };
}

const wheelVariants = {
  blank: { rotate: 0 },
  play: { rotate: [0, 0, 0, 260], transition: { duration: D, times: [0, 0.82, 0.88, 1], ease: 'easeIn' } },
  settled: { rotate: 0, transition: { duration: 0.01 } },
  hover: { rotate: [0, 40, 0], transition: { duration: 0.6, ease: 'easeInOut' } },
};

const deliveredVariants = {
  blank: { opacity: 0, scale: 0 },
  play: { opacity: [0, 0, 1, 1], scale: [0, 0, 1.25, 1], transition: { duration: D, times: [0, 0.86, 0.95, 1], ease: 'easeOut' } },
  settled: { opacity: 1, scale: 1, transition: { duration: 0.01 } },
  hover: { scale: [1, 1.15, 1], transition: { duration: 0.5, ease: 'easeInOut' } },
};

const deliveredPingVariants = {
  blank: { opacity: 0, scale: 0.6 },
  play: { opacity: [0, 0, 0.7, 0], scale: [0.6, 0.6, 1.9, 2.4], transition: { duration: D, times: [0, 0.88, 0.95, 1], ease: 'easeOut' } },
  settled: { opacity: 0 },
  hover: {},
};

export function AnimatedDeliveryIcon({ active, played, unified, reducedMotion, enableHover, size = 82, className }) {
  const state = reducedMotion ? 'settled' : active ? 'play' : played ? 'settled' : 'blank';
  const initial = reducedMotion ? 'settled' : 'blank';
  const hover = enableHover && !reducedMotion ? 'hover' : undefined;
  const tint = makeTint(unified);

  return (
    <motion.svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} style={{ overflow: 'visible' }}
      variants={rootVis} initial={initial} animate={state} whileHover={hover} aria-hidden="true">
      {/* crane rig */}
      <motion.g variants={craneVariants} initial={initial} animate={state} stroke={tint(C.steel)} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <line x1="29" y1="2" x2="29" y2="8" />
        <motion.line x1="29" y1="3.5" x2="18.5" y2="6.5" style={{ transformOrigin: '29px 3.5px' }} variants={jibVariants} initial={initial} animate={state} />
      </motion.g>

      {/* the beam on the hook */}
      <motion.g variants={craneBeamVariants} initial={initial} animate={state}>
        <motion.g style={{ transformOrigin: '16px 6.5px' }} variants={beamSwayVariants} initial={initial} animate={state}>
          <line x1="16" y1="6.5" x2="16" y2="12.5" stroke={tint(C.steel)} strokeWidth="1.3" strokeLinecap="round" opacity="0.75" />
          <path d="M14.6 12.5h2.8l-1.4 1.6z" fill={tint(C.steel)} />
          <rect x="11.5" y="13.8" width="9" height="3" rx="0.6" fill={tint(C.sky)} fillOpacity="0.26" stroke={tint(C.sky)} strokeWidth="1.5" />
        </motion.g>
      </motion.g>

      {/* landing puff under the load */}
      <motion.ellipse cx="9.2" cy="18.6" rx="4.6" ry="0.7" fill={tint(C.steel)} style={{ transformOrigin: '9.2px 18.6px' }}
        variants={impactVariants} initial={initial} animate={state} />

      <motion.g variants={truckVariants} initial={initial} animate={state} style={{ transformOrigin: '16px 27px' }}>
        {/* headlight beam — drawn first so the cab sits over it */}
        <motion.path d="M21.6 21l5.4-1.7v3.4z" fill={tint(C.gold)} style={{ transformOrigin: '21.6px 21px' }}
          variants={beamLightVariants} initial={initial} animate={state} />

        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="18.5" width="12.5" height="6.5" rx="1" />
          <rect x="15.5" y="16.5" width="6" height="8.5" rx="1" />
        </g>
        <rect x="16.6" y="17.8" width="3.8" height="2.6" rx="0.6" fill={tint(C.sky)} fillOpacity="0.3" />
        <motion.circle cx="21" cy="21" r="0.9" fill={C.white} variants={headlightVariants} initial={initial} animate={state} />

        {/* the load, now on the bed */}
        <motion.rect x="4.5" y="14.8" width="9.5" height="3.4" rx="0.6" fill={tint(C.sky)} fillOpacity="0.26" stroke={tint(C.sky)} strokeWidth="1.6"
          variants={cargoVariants} initial={initial} animate={state} />
        {/* lashing strap */}
        <motion.g variants={strapVariants} initial={initial} animate={state} style={{ transformOrigin: '9.2px 16.5px' }}>
          <rect x="8.5" y="14.2" width="1.4" height="4.6" rx="0.5" fill={tint(C.violet)} />
          <rect x="7.9" y="15.8" width="2.6" height="1.4" rx="0.5" fill={tint(C.violet)} stroke={C.ink} strokeWidth="0.4" />
        </motion.g>

        <motion.g variants={wheelVariants} initial={initial} animate={state} whileHover={hover} style={{ transformOrigin: '8px 26px' }}>
          <circle cx="8" cy="26" r="2.4" stroke={tint(C.steel)} strokeWidth="2" />
          <line x1="8" y1="24" x2="8" y2="28" stroke={tint(C.steel)} strokeWidth="1.2" strokeLinecap="round" />
          <line x1="6" y1="26" x2="10" y2="26" stroke={tint(C.steel)} strokeWidth="1.2" strokeLinecap="round" />
        </motion.g>
        <motion.g variants={wheelVariants} initial={initial} animate={state} whileHover={hover} style={{ transformOrigin: '18.5px 26px' }}>
          <circle cx="18.5" cy="26" r="2.4" stroke={tint(C.steel)} strokeWidth="2" />
          <line x1="18.5" y1="24" x2="18.5" y2="28" stroke={tint(C.steel)} strokeWidth="1.2" strokeLinecap="round" />
          <line x1="16.5" y1="26" x2="20.5" y2="26" stroke={tint(C.steel)} strokeWidth="1.2" strokeLinecap="round" />
        </motion.g>
      </motion.g>

      <motion.circle cx="2.5" cy="20" r="1" fill={tint(C.steel)} variants={exhaustVariants} initial={initial} animate={state} />
      <motion.circle cx="6" cy="28.5" r="0.9" fill={tint(C.steel)} variants={dustVariants(0.86)} initial={initial} animate={state} />
      <motion.circle cx="10" cy="29" r="0.7" fill={tint(C.steel)} variants={dustVariants(0.9)} initial={initial} animate={state} />

      {/* delivered on time */}
      <motion.circle cx="27" cy="8" r="4.8" fill="none" stroke={tint(C.green)} strokeWidth="1" style={{ transformOrigin: '27px 8px' }}
        variants={deliveredPingVariants} initial={initial} animate={state} />
      <motion.g variants={deliveredVariants} initial={initial} animate={state} whileHover={hover} style={{ transformOrigin: '27px 8px' }}>
        <circle cx="27" cy="8" r="4.8" fill={tint(C.green)} />
        <path d="M24.7 8l1.5 1.5 3-3.2" stroke={C.ink} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
    </motion.svg>
  );
}
