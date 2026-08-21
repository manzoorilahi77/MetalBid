import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Quote, X, Check, PenLine } from 'lucide-react';
import { useStore } from '../../store/store';

/* ---------------------------------------------------------------------------
   Real testimonials, not fixtures.

   Every quote below comes from the `testimonials` table via the store: a buyer
   or seller writes one from their own workspace, a Sub Admin moderates it in
   the CMS queue, and only `status === 'approved'` rows ever reach this deck.
   The author's name, firm and city are resolved out of `users` by `userId` —
   the record line is that account, not a label typed next to a quote.

   The one thing the record does NOT carry is a headline figure. The old
   fixtures each had an invented result ("+12% realisation", "40+ lots won");
   nothing in the schema backs that, and making one up would be fabricating a
   customer outcome. The result slip therefore renders only when the submitter
   actually left a rating, and the card drops to a single column when they
   did not (see .tst-body-nofig in styles/pages.css).
--------------------------------------------------------------------------- */

const EASE = [0.16, 1, 0.3, 1];
const SWIPE_THRESHOLD = 70;
/* Front card plus the two behind it. Everything deeper waits off-stage at
   opacity 0 — five sheets of visible edge would read as noise, not a deck. */
const DECK_DEPTH = 3;
/* The deck was laid out for a handful of sheets, not a whole moderation
   queue — the same six the manager app's Home rail took. */
const MAX_CARDS = 6;
const MIN_QUOTE = 20;
const pad2 = (n) => String(n).padStart(2, '0');

/* Where a card sits given how far back in the deck it is.

   Every card pivots from its BOTTOM edge (see transform-origin in the CSS),
   which is what makes the peek honest: scaling a card down from there keeps
   its bottom edge in place and pulls its top edge out of sight under the card
   in front, so the y offset below IS the sliver you see, in pixels, at every
   viewport. Pivoting from the top instead would have the shrink eat into the
   offset — and eat more of it the taller the card gets, which on a phone is
   most of it.

   Off-stage is deliberately to the LEFT for every card, not split by
   direction. Going forward, the front card leaves for that spot; going back,
   the returning card arrives from it. One position, both gestures, and the
   deck never needs to know which way it is travelling. */
const deckTarget = (pos) => {
  if (pos >= DECK_DEPTH) {
    // Down as well as out, and only barely tilted: a wide card rotating about
    // its bottom edge throws its far corner a long way, and anything more than
    // a couple of degrees sends that corner up over the section heading.
    return { x: -120, y: 40, scale: 0.95, rotate: -3, opacity: 0 };
  }
  return { x: 0, y: pos * 14, scale: 1 - pos * 0.045, rotate: 0, opacity: 1 };
};

/* Off-stage cards stay ABOVE the deck rather than dropping behind it: the card
   being thrown has to travel across the front of the stack to read as thrown,
   and it is already fading out, so sitting on top costs nothing. */
const deckLayer = (pos) => (pos >= DECK_DEPTH ? 40 : 30 - pos);

/* Weighted rather than snappy: a card leaving a stack should carry some mass,
   and the spring is soft enough that the thrown sheet is legible on its way out
   instead of being gone by the time the eye reaches it. The fade runs on its
   own clock so the card is still visibly travelling as it goes. */
const deckTransition = {
  default: { type: 'spring', stiffness: 200, damping: 28, mass: 1 },
  opacity: { duration: 0.38, ease: 'easeOut' },
};

/* The contents settle in only when a card reaches the front — behind the front
   sheet they sit at rest, invisible under an opaque card, so nothing is
   wasted. Staged, not simultaneous: the result slip posts first, the quote
   resolves behind it, the record line lands last. */
const innerVariants = {
  rest: {},
  live: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

/* The figure is posted, not faded in: it wipes up from under its own baseline
   the way a printed result appears on a board. */
const figVariants = {
  rest: { opacity: 0, y: 12, clipPath: 'inset(0 0 100% 0)' },
  live: {
    opacity: 1,
    y: 0,
    clipPath: 'inset(0 0 0% 0)',
    transition: { duration: 0.55, ease: EASE },
  },
};

/* The quote resolves out of a blur rather than sliding — the card is already
   travelling, and a second horizontal move inside it would fight the deck. */
const quoteVariants = {
  rest: { opacity: 0, y: 10, filter: 'blur(6px)' },
  live: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.55, ease: EASE },
  },
};

const recordVariants = {
  rest: { opacity: 0, y: 12 },
  live: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/* The page colour-codes every taxonomy it has — announcement severities,
   metal grades on the ticker — so which side of the trade someone sits on gets
   the same treatment here, in the tokens the system already owns. */
const monogram = (label) => {
  const initials = String(label || '')
    .split(' ')
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  return initials || 'FB';
};

const stateClass = (pos) => {
  if (pos === 0) return 'is-front';
  if (pos < DECK_DEPTH) return `is-behind is-behind-${pos}`;
  return 'is-offstage';
};

const monthOf = (iso) => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  return new Date(t).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

/* ==========================================================================
   "Share your experience" — the submit half of the feature, in guest1's own
   modal idiom (portal + overlay + focus trap), NOT the manager app's Tailwind
   Modal: the manager's stylesheet is not on the page while this site is.
   Mechanics mirror AppComingSoonModal, which is the controlled-dialog one.
   ========================================================================== */
const ShareExperienceModal = ({ open, onClose, side }) => {
  const reduced = useReducedMotion();
  const submitTestimonial = useStore((s) => s.submitTestimonial);
  const pushToast = useStore((s) => s.pushToast);

  const [quote, setQuote] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const cardRef = useRef(null);
  const lastFocusRef = useRef(null);
  const closeTimerRef = useRef(null);

  const close = useCallback(() => {
    clearTimeout(closeTimerRef.current);
    onClose();
    lastFocusRef.current?.focus?.();
  }, [onClose]);

  // --- While open: reset, scroll-lock, Esc, focus trap, initial focus. ---
  useEffect(() => {
    if (!open) return undefined;
    lastFocusRef.current = document.activeElement;
    setQuote('');
    setBusy(false);
    setSent(false);
    setError('');

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cardRef.current?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      const nodes = cardRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

  useEffect(() => () => clearTimeout(closeTimerRef.current), []);

  /* Identical to the manager Home's submitShare: same action, same single
     argument, same toast on either outcome. The inline result beside it is
     the one addition — this site mounts no toast host, so a toast alone would
     tell the visitor nothing. */
  const submit = (e) => {
    e.preventDefault();
    if (busy || sent) return;
    setBusy(true);
    const result = submitTestimonial(quote);
    setBusy(false);
    if (result.ok) {
      setSent(true);
      setError('');
      pushToast({ kind: 'success', title: 'Thank you', body: 'A moderator will review it before it appears here.' });
      closeTimerRef.current = setTimeout(close, 2200);
    } else {
      setError(result.error ?? 'Something went wrong.');
      pushToast({ kind: 'danger', title: 'Not submitted', body: result.error ?? 'Something went wrong.' });
    }
  };

  const short = quote.trim().length < MIN_QUOTE;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="tstm-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.16 : 0.28, ease: [0.2, 0, 0, 1] }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tstm-title"
          aria-describedby="tstm-desc"
        >
          <motion.div
            ref={cardRef}
            className="tstm-card"
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
            <button type="button" className="tstm-close" onClick={close} aria-label="Close">
              <X size={18} />
            </button>

            <div className="tstm-icon"><Quote size={22} /></div>
            <h3 className="tstm-title" id="tstm-title">Share your experience</h3>
            <p className="tstm-desc" id="tstm-desc">
              Tell other {side === 'buyer' ? 'buyers' : 'sellers'} what working with ferroBid has
              been like. A moderator reads every submission before it goes public — your name and
              firm will show alongside it once approved.
            </p>

            {sent ? (
              <div className="tstm-done">
                <span className="tstm-done-icon"><Check size={14} /></span>
                Thank you — a moderator will review it before it appears here.
              </div>
            ) : (
              <form className="tstm-form" onSubmit={submit}>
                <label className="tstm-label" htmlFor="tstm-quote">Your experience</label>
                <textarea
                  id="tstm-quote"
                  className="tstm-textarea"
                  rows={4}
                  value={quote}
                  onChange={(e) => { setQuote(e.target.value); if (error) setError(''); }}
                  placeholder="What made the difference for you — the inspection, the price discovery, the settlement…?"
                />
                <div className="tstm-meter">
                  <span className={short ? 'tstm-meter-short' : 'tstm-meter-ok'}>
                    {short
                      ? `${MIN_QUOTE - quote.trim().length} more character${MIN_QUOTE - quote.trim().length === 1 ? '' : 's'}`
                      : 'Ready to send'}
                  </span>
                </div>
                {error && <p className="tstm-error" role="alert">{error}</p>}
                <div className="tstm-actions">
                  <button type="button" className="tstm-btn tstm-btn-ghost" onClick={close}>Cancel</button>
                  <button type="submit" className="tstm-btn tstm-btn-primary" disabled={short || busy}>
                    {busy ? 'Sending…' : 'Submit for review'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export const TestimonialsSection = () => {
  const reduce = useReducedMotion();

  const testimonials = useStore((s) => s.testimonials);
  const users = useStore((s) => s.users);
  const currentUser = useStore((s) => s.currentUser);
  const role = useStore((s) => s.role);

  const [index, setIndex] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);

  /* Approved only — a pending or rejected quote is never public. Newest
     first, same order and same ceiling the manager app's Home used. */
  const entries = useMemo(() => {
    const byId = new Map(users.map((u) => [u.id, u]));
    return testimonials
      .filter((t) => t.status === 'approved')
      .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt))
      .slice(0, MAX_CARDS)
      .map((t) => {
        const author = byId.get(t.userId);
        return {
          id: t.id,
          quote: t.quote,
          name: author?.name ?? 'A ferroBid member',
          firm: author?.firm ?? '',
          city: author?.city ?? '',
          side: t.role === 'seller' ? 'Seller' : 'Buyer',
          rating: typeof t.rating === 'number' ? t.rating : null,
          month: monthOf(t.submittedAt),
        };
      });
  }, [testimonials, users]);

  const count = entries.length;

  /* One quote per account, ever — the CTA disappears once theirs is on record,
     whatever a moderator later decides about it. */
  const myTestimonial = currentUser
    ? testimonials.find((t) => t.userId === currentUser.id)
    : undefined;
  const canShare = !!currentUser && (role === 'buyer' || role === 'seller') && !myTestimonial;

  // The deck can shrink under us — a moderator can pull a quote while the page
  // is open — so the cursor has to stay inside the set.
  useEffect(() => {
    setIndex((i) => (count === 0 ? 0 : Math.min(i, count - 1)));
  }, [count]);

  // No timer and no dwell bar: the deck moves only when the reader moves it —
  // with the arrows, by dragging the top card, or by tapping one behind it.
  const go = useCallback(
    (next) => setIndex(count ? ((next % count) + count) % count : 0),
    [count],
  );

  // Nothing approved and nothing this visitor could add — no heading over an
  // empty band.
  if (count === 0 && !canShare) return null;

  const safeIndex = count ? Math.min(index, count - 1) : 0;

  return (
    <section className="testimonials-section">
      <div className="container">
        <header className="tst-head">
          <div className="tst-head-text">
            <div className="tst-eyebrow">
              <Quote size={13} /> Testimonials
            </div>
            <h2 className="tst-title">From the yards and the mills</h2>
            <p className="tst-lead">
              Foundries, re-rollers and plants clearing surplus — what changed once their
              trade moved onto scheduled, inspected auctions. Every quote is written by a
              verified buyer or seller and moderated before it appears here.
            </p>
          </div>

          <div className="tst-nav">
            {canShare && (
              <button
                type="button"
                className="tst-share-btn"
                onClick={() => setShareOpen(true)}
              >
                <PenLine size={15} /> Share your experience
              </button>
            )}
            {count > 1 && (
              <>
                <span className="tst-count" aria-hidden="true">
                  {pad2(safeIndex + 1)} <span className="tst-count-sep">/</span> {pad2(count)}
                </span>
                <button
                  type="button"
                  className="tst-nav-btn"
                  aria-label="Previous testimonial"
                  onClick={() => go(safeIndex - 1)}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  className="tst-nav-btn"
                  aria-label="Next testimonial"
                  onClick={() => go(safeIndex + 1)}
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}
          </div>
        </header>

        {count === 0 ? (
          /* Approved is empty but this visitor can fix that — the same honest
             prompt the manager Home showed rather than a deck of nothing. */
          <div className="tst-empty">Be the first to share how ferroBid has worked for you.</div>
        ) : (
          <>
            {/* Every entry stays mounted, all of them in the same grid cell, each
                one stretched to the cell — so the deck is as tall as the longest
                quote, every sheet in it is exactly the same size, and the page
                cannot jump as cards cycle. The old invisible sizer existed to do
                that job for a single swapping slide; the stack does it for free. */}
            <div
              className="tst-deck"
              role="group"
              aria-roledescription="carousel"
              aria-label="Customer testimonials"
            >
              {entries.map((e, i) => {
                const pos = (i - safeIndex + count) % count;
                const front = pos === 0;
                const target = reduce
                  ? { opacity: front ? 1 : 0 }
                  : deckTarget(pos);
                const hasFig = e.rating !== null;

                return (
                  <motion.article
                    key={e.id}
                    className={`tst-card is-${e.side.toLowerCase()} ${stateClass(pos)}`}
                    style={{ zIndex: reduce ? (front ? 30 : 1) : deckLayer(pos) }}
                    initial={false}
                    animate={target}
                    transition={reduce ? { duration: 0.2 } : deckTransition}
                    aria-roledescription="slide"
                    aria-hidden={!front}
                    aria-label={`${i + 1} of ${count}: ${e.name}${e.firm ? `, ${e.firm}` : ''}`}
                    /* Only the top sheet is draggable, and only the two visible
                       behind it are clickable — a card at opacity 0 must never
                       catch a pointer. */
                    drag={front && !reduce && count > 1 ? 'x' : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.55}
                    onDragEnd={(_, info) => {
                      if (info.offset.x < -SWIPE_THRESHOLD) go(safeIndex + 1);
                      else if (info.offset.x > SWIPE_THRESHOLD) go(safeIndex - 1);
                    }}
                    onClick={front ? undefined : () => pos < DECK_DEPTH && go(i)}
                  >
                    {/* The tone bar reads the taxonomy before the chip does, and it
                        is the one part of the card that is never covered — it sits
                        on the top edge, which is the edge the deck leaves clear. */}
                    <span className="tst-card-tone" aria-hidden="true" />

                    <motion.div
                      className="tst-card-inner"
                      variants={innerVariants}
                      initial={false}
                      animate={front || reduce ? 'live' : 'rest'}
                    >
                      <div className={`tst-body${hasFig ? '' : ' tst-body-nofig'}`}>
                        {/* The result slip: only ever the rating the submitter
                            actually left, on its own tinted panel rather than
                            floating in the gutter. No rating, no slip — the card
                            collapses to one column instead of inventing a number
                            to fill it. */}
                        {hasFig && (
                          <motion.div className="tst-fig" variants={figVariants}>
                            <span className="tst-fig-num">{e.rating}</span>
                            <span className="tst-fig-label">out of 5</span>
                            <span className="tst-fig-note">{e.month}</span>
                          </motion.div>
                        )}

                        <motion.blockquote className="tst-quote" variants={quoteVariants}>
                          <span className="tst-quote-mark" aria-hidden="true">&ldquo;</span>
                          {e.quote}
                        </motion.blockquote>
                      </div>

                      {/* Two columns matching the body above it, so the seal sits
                          under the slip and the name starts on the quote's own left
                          edge. */}
                      <motion.div
                        className={`tst-record${hasFig ? '' : ' tst-record-nofig'}`}
                        variants={recordVariants}
                      >
                        <span className="tst-seal" aria-hidden="true">{monogram(e.firm || e.name)}</span>
                        <span className="tst-rec-main">
                          <span className="tst-rec-who">
                            <span className="tst-rec-name">{e.name}</span>
                            {e.firm && <span className="tst-rec-role">{e.firm}</span>}
                          </span>
                          {e.city && <span className="tst-rec-place">{e.city}</span>}
                          <span className="tst-rec-side">{e.side}</span>
                        </span>
                      </motion.div>
                    </motion.div>
                  </motion.article>
                );
              })}
            </div>

            {/* The count above is decorative; this is what a screen reader hears
                when the deck moves. */}
            <p className="sr-only" aria-live="polite">
              Testimonial {safeIndex + 1} of {count}: {entries[safeIndex].name}
              {entries[safeIndex].firm ? `, ${entries[safeIndex].firm}` : ''}.
            </p>
          </>
        )}
      </div>

      <ShareExperienceModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        side={role === 'seller' ? 'seller' : 'buyer'}
      />
    </section>
  );
};
