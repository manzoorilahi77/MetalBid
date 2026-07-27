import React from 'react';
import { motion } from 'framer-motion';
import { HowItWorksAnimationController } from './HowItWorksAnimationController';
import { useHoverCapable } from '../hooks/useHoverCapable';
import { AnimatedDiscoverIcon } from './icons/AnimatedDiscoverIcon';
import { AnimatedRegisterIcon } from './icons/AnimatedRegisterIcon';
import { AnimatedBidIcon } from './icons/AnimatedBidIcon';
import { AnimatedPayIcon } from './icons/AnimatedPayIcon';
import { AnimatedDeliveryIcon } from './icons/AnimatedDeliveryIcon';

// `accent` drives the whole card while its step plays: the step number, the
// icon's base line-work (via `currentColor`), the top-edge glow, the connector
// spark and the active wash. `accentSoft` is the same hue at wash strength —
// kept as a literal rgba so the CSS never has to derive alpha from a var.
//
// Once the full sequence has run, every card swaps back to the theme ember
// (see `unified` below) so the finished row reads as one brand-coloured strip.
const THEME_ACCENT = 'var(--color-ember-light)';
const THEME_ACCENT_SOFT = 'rgba(239, 122, 82, 0.28)';

const steps = [
  { num: '01', Icon: AnimatedDiscoverIcon, title: 'Discover', desc: 'Find the best deals from verified sellers',
    accent: '#38bdf8', accentSoft: 'rgba(56, 189, 248, 0.28)' },
  { num: '02', Icon: AnimatedRegisterIcon, title: 'Register', desc: 'Sign up and complete your KYC',
    accent: '#a78bfa', accentSoft: 'rgba(167, 139, 250, 0.28)' },
  { num: '03', Icon: AnimatedBidIcon, title: 'Bid', desc: 'Join live auctions or place forward bids',
    accent: '#ff8f5e', accentSoft: 'rgba(255, 143, 94, 0.28)' },
  { num: '04', Icon: AnimatedPayIcon, title: 'Pay', desc: 'Enjoy secure payments and instant confirmation',
    accent: '#34d399', accentSoft: 'rgba(52, 211, 153, 0.28)' },
  { num: '05', Icon: AnimatedDeliveryIcon, title: 'Lift & Deliver', desc: 'Safe logistics and on-time delivery assured',
    accent: '#fbbf24', accentSoft: 'rgba(251, 191, 36, 0.28)' },
];

export const HowItWorksSection = () => {
  const enableHover = useHoverCapable();

  return (
    <section id="how-it-works" className="hiw-horizontal-section">
      <div className="container">
        <HowItWorksAnimationController stepCount={steps.length}>
          {({ sectionRef, reducedMotion, unified, isStepActive, isStepDone, isConnectorLit }) => (
            <div className="hiw-dark-panel" ref={sectionRef}>
              <div className="hiw-dark-header">
                <div className="hiw-dark-eyebrow">How It Works</div>
                <h2 className="hiw-dark-title">Buy Smarter in <span>5 Steps</span></h2>
              </div>

              <div className="hiw-steps-row">
                {steps.map((step, idx) => {
                  const { Icon } = step;
                  const active = isStepActive(idx);

                  return (
                    <motion.div
                      key={idx}
                      className={`hiw-step-card${active ? ' is-active' : ''}`}
                      style={{
                        '--hiw-accent': unified ? THEME_ACCENT : step.accent,
                        '--hiw-accent-soft': unified ? THEME_ACCENT_SOFT : step.accentSoft,
                      }}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-50px' }}
                      transition={{ duration: 0.4, delay: idx * 0.06, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {idx > 0 && (
                        <motion.span
                          className="hiw-connector-glow"
                          aria-hidden="true"
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={
                            isConnectorLit(idx - 1)
                              ? { opacity: [0, 1, 0], scale: [0.6, 1.5, 0.6], transition: { duration: 0.5, ease: 'easeInOut' } }
                              : { opacity: 0, scale: 0.6 }
                          }
                        />
                      )}

                      <span className="hiw-step-num">{step.num}</span>

                      <motion.span
                        className="hiw-step-icon-stage"
                        initial={{ scale: 1 }}
                        animate={
                          active
                            ? { scale: [0.92, 1.04, 1], transition: { duration: 0.5, ease: 'easeOut' } }
                            : { scale: 1 }
                        }
                      >
                        <Icon
                          active={active}
                          played={isStepDone(idx)}
                          unified={unified}
                          reducedMotion={reducedMotion}
                          enableHover={enableHover}
                          size={82}
                          className="hiw-step-icon"
                        />
                      </motion.span>

                      <motion.div
                        initial={{ opacity: 1, y: 0 }}
                        animate={
                          active
                            ? { opacity: [0.5, 1], y: [4, 0], transition: { duration: 0.3, ease: 'easeOut' } }
                            : { opacity: 1, y: 0 }
                        }
                      >
                        <h4>{step.title}</h4>
                        <p>{step.desc}</p>
                      </motion.div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </HowItWorksAnimationController>
      </div>
    </section>
  );
};
