import React from 'react';
import { motion } from 'framer-motion';
import { HowItWorksAnimationController } from './HowItWorksAnimationController';
import { useHoverCapable } from '../hooks/useHoverCapable';
import { AnimatedDiscoverIcon } from './icons/AnimatedDiscoverIcon';
import { AnimatedRegisterIcon } from './icons/AnimatedRegisterIcon';
import { AnimatedBidIcon } from './icons/AnimatedBidIcon';
import { AnimatedPayIcon } from './icons/AnimatedPayIcon';
import { AnimatedDeliveryIcon } from './icons/AnimatedDeliveryIcon';

const steps = [
  { num: '01', Icon: AnimatedDiscoverIcon, title: 'Discover', desc: 'Find the best deals from verified sellers' },
  { num: '02', Icon: AnimatedRegisterIcon, title: 'Register', desc: 'Sign up and complete your KYC' },
  { num: '03', Icon: AnimatedBidIcon, title: 'Bid', desc: 'Join live auctions or place forward bids' },
  { num: '04', Icon: AnimatedPayIcon, title: 'Pay', desc: 'Enjoy secure payments and instant confirmation' },
  { num: '05', Icon: AnimatedDeliveryIcon, title: 'Lift & Deliver', desc: 'Safe logistics and on-time delivery assured' },
];

export const HowItWorksSection = () => {
  const enableHover = useHoverCapable();

  return (
    <section id="how-it-works" className="hiw-horizontal-section">
      <div className="container">
        <HowItWorksAnimationController stepCount={steps.length}>
          {({ sectionRef, reducedMotion, isStepActive, isStepDone, isConnectorLit }) => (
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
