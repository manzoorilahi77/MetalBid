import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

const STEP_DURATION_MS = 1000; // snappy, cinematic per-step storytelling; keep in sync with `D` in the step icons
const STEP_GAP_MS = 320;
// Beat after the last step lands, before the five icons drop their per-step
// colours and resolve together into the theme ember.
const FINALE_DELAY_MS = 420;
const VIEWPORT_THRESHOLD = 0.4;

const HowItWorksAnimationContext = createContext(null);

/**
 * Owns the one-shot, five-step intro choreography for the "How It Works" row:
 * watches `sectionRef` with an IntersectionObserver (fires once at 40%
 * visible), then plays step 0..N in sequence with a fixed gap between each,
 * never repeating. Exposes per-step / per-connector state via context so
 * icons and connector glows can read "am I active / already played" without
 * each owning their own timers.
 */
export function HowItWorksAnimationController({ stepCount, children }) {
  const sectionRef = useRef(null);
  const timeoutsRef = useRef([]);
  const reducedMotion = usePrefersReducedMotion();

  const [started, setStarted] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [litConnector, setLitConnector] = useState(-1);
  const [doneSteps, setDoneSteps] = useState(() => new Set());
  // True once every step has played: the whole row unifies on the theme colour.
  const [unified, setUnified] = useState(false);

  // Reduced motion: skip the timed choreography entirely. Every step settles
  // in its resting state immediately — icons render static, cards just fade
  // (handled by the existing whileInView fade on .hiw-step-card).
  useEffect(() => {
    if (!reducedMotion) return;
    setStarted(true);
    setDoneSteps(new Set(Array.from({ length: stepCount }, (_, i) => i)));
    setUnified(true);
  }, [reducedMotion, stepCount]);

  useEffect(() => {
    if (reducedMotion || started) return;
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      // No IO support: fail open rather than never animating.
      setStarted(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= VIEWPORT_THRESHOLD) {
            setStarted(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: [0, VIEWPORT_THRESHOLD, 1] }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reducedMotion, started]);

  useEffect(() => {
    if (!started || reducedMotion) return;
    let cancelled = false;
    const schedule = (fn, ms) => {
      const id = setTimeout(fn, ms);
      timeoutsRef.current.push(id);
      return id;
    };

    const playStep = (i) => {
      if (cancelled || i >= stepCount) return;
      setActiveStep(i);
      schedule(() => {
        if (cancelled) return;
        setDoneSteps((prev) => {
          const next = new Set(prev);
          next.add(i);
          return next;
        });
        setActiveStep(-1);

        const isLastStep = i >= stepCount - 1;
        if (!isLastStep) setLitConnector(i);

        if (isLastStep) {
          schedule(() => {
            if (cancelled) return;
            setUnified(true);
          }, FINALE_DELAY_MS);
          return;
        }

        schedule(() => {
          if (cancelled) return;
          setLitConnector(-1);
          playStep(i + 1);
        }, STEP_GAP_MS);
      }, STEP_DURATION_MS);
    };

    playStep(0);

    return () => {
      cancelled = true;
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, reducedMotion, stepCount]);

  const isStepActive = useCallback((i) => activeStep === i, [activeStep]);
  const isStepDone = useCallback((i) => reducedMotion || doneSteps.has(i), [doneSteps, reducedMotion]);
  const isConnectorLit = useCallback((i) => litConnector === i, [litConnector]);

  const value = {
    sectionRef,
    reducedMotion,
    started,
    activeStep,
    unified,
    isStepActive,
    isStepDone,
    isConnectorLit,
  };

  return (
    <HowItWorksAnimationContext.Provider value={value}>
      {typeof children === 'function' ? children(value) : children}
    </HowItWorksAnimationContext.Provider>
  );
}

export function useHowItWorksAnimation() {
  const ctx = useContext(HowItWorksAnimationContext);
  if (!ctx) {
    throw new Error('useHowItWorksAnimation must be used within a HowItWorksAnimationController');
  }
  return ctx;
}
