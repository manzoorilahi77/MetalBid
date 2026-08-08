import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, Bell, Check } from 'lucide-react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { asset } from '../utils/asset';

/* ==========================================================================
   "App launching soon" announcement — opens when either store badge in the
   footer is clicked. Mirrors WhatsAppCommunityModal's overlay/focus-trap
   mechanics but is a controlled dialog (parent owns open/close) rather than
   a self-timed one.
   ========================================================================== */

export const AppComingSoonModal = ({ open, onClose }) => {
  const reduced = usePrefersReducedMotion();

  const [email, setEmail] = useState('');
  const [notified, setNotified] = useState(false);

  const cardRef = useRef(null);
  const lastFocusRef = useRef(null);

  const close = useCallback(() => {
    onClose();
    lastFocusRef.current?.focus?.();
  }, [onClose]);

  // --- While open: reset form, scroll-lock, Esc, focus trap, initial focus. ---
  useEffect(() => {
    if (!open) return;
    lastFocusRef.current = document.activeElement;
    setNotified(false);
    setEmail('');

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cardRef.current?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      const nodes = cardRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!nodes || !nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!cardRef.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  const onNotify = (e) => {
    e.preventDefault();
    if (notified) return;
    setNotified(true);
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="soon-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.16 : 0.28, ease: [0.2, 0, 0, 1] }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="soon-title"
          aria-describedby="soon-desc"
        >
          <motion.div
            ref={cardRef}
            className="soon-card"
            tabIndex={-1}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 16 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduced
              ? { opacity: 0, transition: { duration: 0.16 } }
              : { opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.18, ease: 'easeOut' } }}
            transition={reduced
              ? { duration: 0.18 }
              : { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="soon-close" onClick={close} aria-label="Close">
              <X size={18} />
            </button>

            <div className="soon-icon">
              <Smartphone size={26} />
            </div>

            <h3 className="soon-title" id="soon-title">The FerroBid app is on its way</h3>
            <p className="soon-desc" id="soon-desc">
              We&apos;re putting the finishing touches on iOS &amp; Android. Leave your
              email and we&apos;ll ping you the moment it&apos;s live — no spam, one message.
            </p>

            <AnimatePresence mode="wait">
              {notified ? (
                <motion.div
                  key="done"
                  className="soon-done"
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <span className="soon-done-icon"><Check size={14} /></span>
                  You&apos;re on the list — we&apos;ll email you at launch.
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  className="soon-form"
                  onSubmit={onNotify}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <input
                    type="email"
                    required
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="soon-input"
                    aria-label="Email address"
                  />
                  <button type="submit" className="soon-cta">
                    <Bell size={16} /> Notify me
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="soon-badges">
              <img src={asset('/badges/google-play.svg')} alt="Google Play — coming soon" loading="lazy" decoding="async" />
              <img src={asset('/badges/app-store.svg')} alt="App Store — coming soon" loading="lazy" decoding="async" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default AppComingSoonModal;
