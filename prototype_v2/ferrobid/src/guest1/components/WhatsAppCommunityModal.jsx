import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { fireConfetti } from '../../lib/confetti';

/* ==========================================================================
   WhatsApp Community opt-in — styled as a real WhatsApp chat.
   A teal chat header (avatar · name · online), one received message bubble on
   the classic beige wallpaper, and a green "Join on WhatsApp" button. Calm,
   one-shot motion only; nothing loops. Collapses to a plain fade under
   prefers-reduced-motion.
   ========================================================================== */

// TODO: swap for the real community invite before launch.
const WHATSAPP_COMMUNITY_URL = 'https://chat.whatsapp.com/';

const SEEN_KEY = 'fb_wa_modal_seen';        // sessionStorage — once per tab session
const SUBSCRIBED_KEY = 'fb_wa_subscribed';  // localStorage — never nag a member again

// REVIEW MODE: while true the modal opens on EVERY homepage load, ignoring the
// once-per-session / subscribed gate. Set to false before launch.
const ALWAYS_SHOW = true;
const OPEN_DELAY_MS = 1500;

// Session-scoped fallback flags for when Web Storage is blocked (private mode).
let shownThisSession = false;
let joinedThisSession = false;

// Canonical WhatsApp glyph, rendered white on the green avatar / button.
const WaGlyph = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.359.101 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.652a11.96 11.96 0 005.71 1.454h.005c6.581 0 11.945-5.359 11.948-11.945a11.9 11.9 0 00-3.489-8.436z" />
  </svg>
);

// Current clock time, WhatsApp-style (e.g. "10:24 AM").
const formatTime = () =>
  new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// WhatsApp "read" double-tick.
const BlueTicks = () => (
  <svg className="wa-ticks" width="16" height="11" viewBox="0 0 16 11" fill="none" aria-hidden="true">
    <path d="M1 6.1 3.3 8.5 7.7 3.2" stroke="#53bdeb" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5.6 6.1 7.9 8.5 12.3 3.2" stroke="#53bdeb" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const WhatsAppCommunityModal = () => {
  const reduced = usePrefersReducedMotion();
  const MOTION = !reduced;

  const [open, setOpen] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [msgTime, setMsgTime] = useState(formatTime);

  const cardRef = useRef(null);
  const ctaRef = useRef(null);
  const lastFocusRef = useRef(null);
  const autoCloseRef = useRef(null);

  const close = useCallback((didSubscribe = false) => {
    clearTimeout(autoCloseRef.current);
    setOpen(false);
    lastFocusRef.current?.focus?.();
    if (didSubscribe) {
      joinedThisSession = true;
      try { localStorage.setItem(SUBSCRIBED_KEY, '1'); } catch { /* private mode */ }
    }
  }, []);

  // --- Trigger: OPEN_DELAY_MS after the homepage settles. ---
  useEffect(() => {
    let already = false;
    if (!ALWAYS_SHOW) {
      already = shownThisSession || joinedThisSession;
      try {
        if (sessionStorage.getItem(SEEN_KEY) || localStorage.getItem(SUBSCRIBED_KEY)) already = true;
      } catch { /* storage blocked — fall back to in-memory flags */ }
    }
    if (already) return;

    const reveal = () => {
      shownThisSession = true;
      try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
      lastFocusRef.current = document.activeElement;
      setOpen(true);
    };
    const timer = setTimeout(reveal, OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // --- While open: scroll-lock, Esc, focus trap, initial focus. ---
  useEffect(() => {
    if (!open) return;
    setMsgTime(formatTime()); // stamp the message with the time it "arrived"
    const html = document.documentElement;
    const prevOverflow = document.body.style.overflow;
    const prevGutter = html.style.scrollbarGutter;
    document.body.style.overflow = 'hidden';
    html.style.scrollbarGutter = 'stable';

    cardRef.current?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      const nodes = cardRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
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
      html.style.scrollbarGutter = prevGutter;
    };
  }, [open, close]);

  useEffect(() => () => clearTimeout(autoCloseRef.current), []);

  const onSubscribe = (e) => {
    if (subscribed) return;
    e.preventDefault();
    setSubscribed(true);
    if (MOTION) fireConfetti(1200);
    window.open(WHATSAPP_COMMUNITY_URL, '_blank', 'noopener,noreferrer');
    autoCloseRef.current = setTimeout(() => close(true), 1600);
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="wa-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.16 : 0.28, ease: [0.2, 0, 0, 1] }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="wa-title"
          aria-describedby="wa-desc"
        >
          <motion.div
            ref={cardRef}
            className="wa-card"
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
            {/* Chat header */}
            <div className="wa-head">
              <div className="wa-head-avatar">
                <img src="/image.png" alt="FerroBid" />
              </div>
              <div className="wa-head-meta">
                <div className="wa-head-name">FerroBid Alerts</div>
                <div className="wa-head-status"><span className="wa-online-dot" /> online</div>
              </div>
              <button className="wa-close" onClick={() => close()} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            {/* Chat wallpaper + one received message bubble */}
            <div className="wa-chat">
              <motion.div
                className="wa-bubble"
                initial={reduced ? false : { opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={reduced ? { duration: 0 } : { delay: 0.16, type: 'spring', stiffness: 460, damping: 28 }}
              >
                <div className="wa-bubble-title" id="wa-title">Never miss a live lot 🔔</div>
                <p className="wa-bubble-text" id="wa-desc">
                  New scrap lots go live with <strong>minutes</strong> of notice — get every
                  drop, reserve and closing bell right here.
                </p>
                <div className="wa-bubble-meta">{msgTime}<BlueTicks /></div>
              </motion.div>
            </div>

            {/* Footer: green join button */}
            <div className="wa-footer">
              <motion.button
                ref={ctaRef}
                className={`wa-cta${subscribed ? ' is-done' : ''}`}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduced ? { duration: 0 } : { delay: 0.26, duration: 0.34, ease: [0.21, 1.02, 0.73, 1] }}
                onClick={onSubscribe}
                whileTap={reduced ? undefined : { scale: 0.98 }}
              >
                {subscribed ? (
                  <><Check size={19} /> You&apos;re in — see you on WhatsApp</>
                ) : (
                  <><WaGlyph size={20} /> Join on WhatsApp</>
                )}
              </motion.button>
              <div className="wa-foot">Free to join · Broadcast-only, no spam</div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default WhatsAppCommunityModal;
