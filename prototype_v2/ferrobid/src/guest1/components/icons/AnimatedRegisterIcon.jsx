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

// "Sign up and complete your KYC" — the profile appears, two fields type
// themselves in behind a gold caret, a scanner frames the face and sweeps it,
// three KYC checks (PAN / GST / Bank) clear one by one, the verification ring
// closes and a green verified badge lands.
//
//   0.00 avatar rises              0.56 PAN clears
//   0.10 field 1 types             0.64 GST clears
//   0.24 field 2 types             0.72 Bank clears
//   0.36 scanner brackets snap     0.74 verification ring draws
//   0.42 scan sweeps the face      0.84 verified badge + glow + sparks
const userVariants = {
  blank: { y: 7, opacity: 0 },
  play: { y: [7, 0], opacity: [0, 1], transition: { duration: D, times: [0, 0.14], ease: EASE_OUT_EXPO } },
  settled: { y: 0, opacity: 1, transition: { duration: 0.01 } },
  hover: {},
};

// A form field filling left-to-right, as if typed.
function fieldVariants(startFrac) {
  return {
    blank: { scaleX: 0, opacity: 0 },
    play: { scaleX: [0, 0, 1, 1], opacity: [0, 0.25, 0.85, 0.85], transition: { duration: D, times: [0, startFrac, startFrac + 0.13, 1], ease: EASE_OUT_EXPO } },
    settled: { scaleX: 1, opacity: 0.85, transition: { duration: 0.01 } },
    hover: {},
  };
}

// Gold caret riding the end of the field being typed.
function caretVariants(startFrac, toX) {
  return {
    blank: { opacity: 0, x: 0 },
    play: {
      opacity: [0, 1, 1, 0], x: [0, 0, toX, toX],
      transition: { duration: D, times: [0, startFrac, startFrac + 0.13, startFrac + 0.17], ease: EASE_OUT_EXPO },
    },
    settled: { opacity: 0 },
    hover: {},
  };
}

// Scanner viewfinder brackets snapping around the face.
const bracketVariants = {
  blank: { opacity: 0, scale: 1.35 },
  play: { opacity: [0, 0, 0.9, 0.9, 0], scale: [1.35, 1.35, 1, 1, 1], transition: { duration: D, times: [0, 0.34, 0.42, 0.68, 0.78], ease: EASE_OUT_EXPO } },
  settled: { opacity: 0 },
  hover: {},
};

const scanVariants = {
  blank: { opacity: 0, y: -8 },
  play: { opacity: [0, 0, 0.95, 0.95, 0], y: [-8, -8, -8, 8, 8], transition: { duration: D, times: [0, 0.4, 0.44, 0.62, 0.66], ease: 'easeInOut' } },
  settled: { opacity: 0 },
  hover: {},
};

// The three KYC documents, clearing in sequence: outline → filled green tick.
function kycPillVariants(startFrac) {
  return {
    blank: { opacity: 0, y: 3 },
    play: { opacity: [0, 0, 0.9, 0.9, 0], y: [3, 3, 0, 0, 0], transition: { duration: D, times: [0, startFrac, startFrac + 0.08, 0.82, 0.9], ease: EASE_OUT_EXPO } },
    settled: { opacity: 0 },
    hover: {},
  };
}
function kycTickVariants(atFrac) {
  return {
    blank: { opacity: 0, scale: 0 },
    play: { opacity: [0, 0, 1, 1, 0], scale: [0, 0, 1.4, 1, 1], transition: { duration: D, times: [0, atFrac, atFrac + 0.06, 0.82, 0.9], ease: 'easeOut' } },
    settled: { opacity: 0 },
    hover: {},
  };
}

const ringVariants = {
  blank: { pathLength: 0, opacity: 0 },
  play: { pathLength: [0, 0, 1], opacity: [0, 0, 0.6], transition: { duration: D, times: [0, 0.7, 0.9], ease: EASE_OUT_EXPO } },
  settled: { pathLength: 1, opacity: 0.6, transition: { duration: 0.01 } },
  hover: {},
};

const badgeVariants = {
  blank: { scale: 0, opacity: 0 },
  play: { scale: [0, 0, 1.25, 1], opacity: [0, 0, 1, 1], transition: { duration: D, times: [0, 0.8, 0.92, 0.98], ease: 'easeOut' } },
  settled: { scale: 1, opacity: 1, transition: { duration: 0.01 } },
  hover: { scale: [1, 1.18, 1], transition: { duration: 0.5, ease: 'easeInOut' } },
};

const glowVariants = {
  blank: { opacity: 0, scale: 1 },
  play: { opacity: [0, 0, 0.7, 0], scale: [1, 1, 1.9, 2.4], transition: { duration: D, times: [0, 0.84, 0.92, 1], ease: 'easeOut' } },
  settled: { opacity: 0 },
  hover: {},
};

function sparkVariants(dx, dy, startFrac) {
  return {
    blank: { opacity: 0, scale: 0, x: 0, y: 0 },
    play: {
      opacity: [0, 0, 1, 0], scale: [0, 0, 1, 0.4],
      x: [0, 0, dx, dx * 1.6], y: [0, 0, dy, dy * 1.6],
      transition: { duration: D, times: [0, startFrac, startFrac + 0.06, startFrac + 0.13], ease: 'easeOut' },
    },
    settled: { opacity: 0 },
    hover: {},
  };
}

export function AnimatedRegisterIcon({ active, played, unified, reducedMotion, enableHover, size = 82, className }) {
  const state = reducedMotion ? 'settled' : active ? 'play' : played ? 'settled' : 'blank';
  const initial = reducedMotion ? 'settled' : 'blank';
  const hover = enableHover && !reducedMotion ? 'hover' : undefined;
  const tint = makeTint(unified);

  return (
    <motion.svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} style={{ overflow: 'visible' }}
      variants={rootVis} initial={initial} animate={state} whileHover={hover} aria-hidden="true">
      {/* sign-up form fields */}
      <motion.rect x="18" y="8.6" width="10" height="2" rx="1" fill="currentColor" style={{ transformOrigin: '18px 9.6px' }}
        variants={fieldVariants(0.1)} initial={initial} animate={state} />
      <motion.rect x="18" y="13.4" width="8" height="2" rx="1" fill="currentColor" style={{ transformOrigin: '18px 14.4px' }}
        variants={fieldVariants(0.24)} initial={initial} animate={state} />

      {/* typing caret */}
      <motion.rect x="18" y="8.1" width="1.1" height="3" rx="0.5" fill={tint(C.gold)} variants={caretVariants(0.1, 9)} initial={initial} animate={state} />
      <motion.rect x="18" y="12.9" width="1.1" height="3" rx="0.5" fill={tint(C.gold)} variants={caretVariants(0.24, 7)} initial={initial} animate={state} />

      {/* profile */}
      <motion.g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" variants={userVariants} initial={initial} animate={state}>
        <circle cx="11" cy="10.4" r="4" />
        <path d="M4 23c0-4.2 3.1-7.4 7-7.4s7 3.2 7 7.4" />
      </motion.g>

      {/* scanner viewfinder + scan sweep */}
      <motion.g stroke={tint(C.sky)} strokeWidth="1.3" strokeLinecap="round" fill="none" variants={bracketVariants} initial={initial} animate={state}
        style={{ transformOrigin: '11px 12px' }}>
        <path d="M4.4 8.4V6.2h2.4" />
        <path d="M17.6 8.4V6.2h-2.4" />
        <path d="M4.4 15.6v2.2h2.4" />
        <path d="M17.6 15.6v2.2h-2.4" />
      </motion.g>
      <motion.rect x="4.4" y="11.2" width="13.2" height="1.6" rx="0.8" fill={tint(C.sky)} variants={scanVariants} initial={initial} animate={state} />

      {/* KYC checklist — PAN, GST, Bank clearing one by one */}
      {[
        { x: 3.4, at: 0.56 },
        { x: 12.2, at: 0.64 },
        { x: 21, at: 0.72 },
      ].map((pill, i) => (
        <React.Fragment key={pill.x}>
          <motion.rect x={pill.x} y="25.4" width="7.6" height="3.6" rx="1.8" fill={tint(C.violet)} fillOpacity="0.16" stroke={tint(C.violet)} strokeWidth="0.9"
            variants={kycPillVariants(0.28 + i * 0.04)} initial={initial} animate={state} />
          <motion.g variants={kycTickVariants(pill.at)} initial={initial} animate={state} style={{ transformOrigin: `${pill.x + 3.8}px 27.2px` }}>
            <circle cx={pill.x + 3.8} cy="27.2" r="1.75" fill={tint(C.green)} />
            <path d={`M${pill.x + 3} 27.2l0.6 0.65 1.15-1.3`} stroke={C.ink} strokeWidth="0.85" strokeLinecap="round" strokeLinejoin="round" />
          </motion.g>
        </React.Fragment>
      ))}

      {/* verification ring */}
      <motion.circle cx="11" cy="14.5" r="11" stroke={tint(C.sky)} strokeWidth="1.2" fill="none" variants={ringVariants} initial={initial} animate={state} />

      {/* verified badge */}
      <motion.circle cx="24" cy="22.5" r="5.6" fill={tint(C.green)} variants={glowVariants} initial={initial} animate={state} />
      <motion.g variants={badgeVariants} initial={initial} animate={state} whileHover={hover} style={{ transformOrigin: '24px 22.5px' }}>
        <circle cx="24" cy="22.5" r="4.8" fill={tint(C.green)} />
        <path d="M21.7 22.5l1.5 1.5 3.1-3.3" stroke={C.ink} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
      <motion.circle cx="24" cy="22.5" r="0.8" fill={tint(C.white)} variants={sparkVariants(5.5, -4, 0.85)} initial={initial} animate={state} />
      <motion.circle cx="24" cy="22.5" r="0.65" fill={tint(C.gold)} variants={sparkVariants(-5, -4.8, 0.87)} initial={initial} animate={state} />
    </motion.svg>
  );
}
