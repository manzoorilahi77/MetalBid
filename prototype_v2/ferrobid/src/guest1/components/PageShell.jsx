import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown } from 'lucide-react';
import '../styles/enterprise.css';

// Shared fade-up, still used by Reveal / RevealGrid on the article page.
export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

export const Breadcrumb = ({ items = [] }) => (
  <nav className="ent-breadcrumb" aria-label="Breadcrumb">
    <Link to="/">Home</Link>
    {items.map((item, i) => {
      const last = i === items.length - 1;
      return (
        <React.Fragment key={item.label}>
          <ChevronRight size={13} aria-hidden="true" />
          {last || !item.to ? (
            <span className="crumb-current" aria-current="page">{item.label}</span>
          ) : (
            <Link to={item.to}>{item.label}</Link>
          )}
        </React.Fragment>
      );
    })}
  </nav>
);

/* `PageHero` used to live here. Every secondary page now opens with its own
   hero (.res-hero / .doc-hero / .faq-hero / .gr-hero), so it had no callers
   left — and neither did `CTABand`. Both are removed rather than kept as dead
   exports; the `.ent-hero*` rules they carried are gone from enterprise.css
   for the same reason. */

export const SectionHead = ({ eyebrow, title, subtitle, center = false }) => (
  <motion.div
    className={`ent-section-head ${center ? 'center' : ''}`}
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-80px' }}
    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
  >
    {eyebrow && <div className="ent-eyebrow">{eyebrow}</div>}
    {title && <h2 className="ent-title">{title}</h2>}
    {subtitle && <p className="ent-subtitle">{subtitle}</p>}
  </motion.div>
);

export const Accordion = ({ items = [], defaultOpen = 0 }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="ent-accordion">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div className={`ent-accordion-item ${isOpen ? 'open' : ''}`} key={i}>
            <button
              className="ent-accordion-q"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? -1 : i)}
            >
              {item.q}
              <ChevronDown size={18} />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="ent-accordion-a">{item.a}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};

// Small helper to animate a grid of cards into view.
export const RevealGrid = ({ className = '', children }) => (
  <motion.div
    className={className}
    variants={stagger}
    initial="hidden"
    whileInView="show"
    viewport={{ once: true, margin: '-60px' }}
  >
    {children}
  </motion.div>
);

export const Reveal = ({ children, className = '' }) => (
  <motion.div className={className} variants={fadeUp}>
    {children}
  </motion.div>
);
