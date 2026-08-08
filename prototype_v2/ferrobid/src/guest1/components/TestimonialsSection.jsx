import React, { useCallback, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';

/* ---------------------------------------------------------------------------
   PLACEHOLDER CONTENT — TODO: replace with the client's real customer quotes,
   names, roles, firms, cities and figures before this page goes near
   production.

   Every person, firm and number below is invented. None of these companies
   exist and none has endorsed the platform. They are written to be
   representative of a two-sided scrap marketplace (buyers = foundries,
   re-rollers, traders; sellers = plants and manufacturers clearing surplus)
   so the layout can be judged with realistic copy lengths.
--------------------------------------------------------------------------- */
const entries = [
  {
    quote:
      'We used to drive to three yards a week just to inspect material. Now the inspection report, weighbridge slip and photographs are on screen before the auction opens — we bought eleven lots last quarter without leaving Coimbatore.',
    name: 'Senthil Kumar',
    role: 'Managing Director',
    firm: 'Aravind Alloys & Castings',
    city: 'Coimbatore',
    side: 'Buyer',
    figure: '40+',
    figureLabel: 'lots won',
    note: 'since 2023',
  },
  {
    quote:
      'Our surplus used to sit in the yard for months while we chased buyers one at a time. Listing it on a scheduled auction cleared eight months of backlog in a single catalogue.',
    name: 'Neha Deshpande',
    role: 'GM, Materials',
    firm: 'Sahyadri Steelworks',
    city: 'Pune',
    side: 'Seller',
    figure: '8',
    figureLabel: 'months cleared',
    note: 'first catalogue',
  },
  {
    quote:
      'The EMD system is what won me over. My deposit is locked against the lots I am actually bidding on, released the moment I do not win, and I am not chasing anyone for a refund.',
    name: 'Imran Qureshi',
    role: 'Proprietor',
    firm: 'Qureshi Re-Rolling',
    city: 'Bhiwandi',
    side: 'Buyer',
    figure: '26',
    figureLabel: 'lots bid',
    note: 'no refund disputes',
  },
  {
    quote:
      'Transparent bidding pushed our realisation up nearly 12% against what we were getting through negotiated sales. The audit trail alone made the switch worth it for our board.',
    name: 'Kavita Rao',
    role: 'Head of Procurement',
    firm: 'Deccan Industrial Works',
    city: 'Hyderabad',
    side: 'Seller',
    figure: '+12%',
    figureLabel: 'realisation',
    note: 'vs. negotiated',
  },
  {
    quote:
      'Delivery orders come through the same day payment settles, and the paperwork is already in order. My transporters can finally plan a week ahead instead of a day.',
    name: 'Harpreet Singh',
    role: 'Partner',
    firm: 'Singh Metal Traders',
    city: 'Ludhiana',
    side: 'Buyer',
    figure: '19',
    figureLabel: 'orders lifted',
    note: 'same-day DO',
  },
];

const EASE = [0.16, 1, 0.3, 1];
const SWIPE_THRESHOLD = 70;
/* Front card plus the two behind it. Everything deeper waits off-stage at
   opacity 0 — five sheets of visible edge would read as noise, not a deck. */
const DECK_DEPTH = 3;
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

/* The page colour-codes every taxonomy it has — announcement categories, metal
   grades on the ticker — so which side of the trade someone sits on gets the
   same treatment here, in the tokens the system already owns. */
const monogram = (firm) =>
  firm
    .split(' ')
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

const stateClass = (pos) => {
  if (pos === 0) return 'is-front';
  if (pos < DECK_DEPTH) return `is-behind is-behind-${pos}`;
  return 'is-offstage';
};

export const TestimonialsSection = () => {
  const reduce = useReducedMotion();
  const count = entries.length;
  const [index, setIndex] = useState(0);

  // No timer and no dwell bar: the deck moves only when the reader moves it —
  // with the arrows, by dragging the top card, or by tapping one behind it.
  const go = useCallback(
    (next) => setIndex(((next % count) + count) % count),
    [count],
  );

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
              trade moved onto scheduled, inspected auctions.
            </p>
          </div>

          <div className="tst-nav">
            <span className="tst-count" aria-hidden="true">
              {pad2(index + 1)} <span className="tst-count-sep">/</span> {pad2(count)}
            </span>
            <button
              type="button"
              className="tst-nav-btn"
              aria-label="Previous testimonial"
              onClick={() => go(index - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="tst-nav-btn"
              aria-label="Next testimonial"
              onClick={() => go(index + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </header>

        {/* Every entry stays mounted, all five in the same grid cell, each one
            stretched to the cell — so the deck is as tall as the longest quote,
            every sheet in it is exactly the same size, and the page cannot jump
            as cards cycle. The old invisible sizer existed to do that job for a
            single swapping slide; the stack does it for free. */}
        <div
          className="tst-deck"
          role="group"
          aria-roledescription="carousel"
          aria-label="Customer testimonials"
        >
          {entries.map((e, i) => {
            const pos = (i - index + count) % count;
            const front = pos === 0;
            const target = reduce
              ? { opacity: front ? 1 : 0 }
              : deckTarget(pos);

            return (
              <motion.article
                key={e.name}
                className={`tst-card is-${e.side.toLowerCase()} ${stateClass(pos)}`}
                style={{ zIndex: reduce ? (front ? 30 : 1) : deckLayer(pos) }}
                initial={false}
                animate={target}
                transition={reduce ? { duration: 0.2 } : deckTransition}
                aria-roledescription="slide"
                aria-hidden={!front}
                aria-label={`${i + 1} of ${count}: ${e.name}, ${e.firm}`}
                /* Only the top sheet is draggable, and only the two visible
                   behind it are clickable — a card at opacity 0 must never
                   catch a pointer. */
                drag={front && !reduce ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.55}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -SWIPE_THRESHOLD) go(index + 1);
                  else if (info.offset.x > SWIPE_THRESHOLD) go(index - 1);
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
                  <div className="tst-body">
                    {/* The result slip: the figure the quote earned, on its own
                        tinted panel rather than floating in the gutter — the
                        card reads as two materials, and the panel carries the
                        left of the card at any quote length. */}
                    <motion.div className="tst-fig" variants={figVariants}>
                      <span className="tst-fig-num">{e.figure}</span>
                      <span className="tst-fig-label">{e.figureLabel}</span>
                      <span className="tst-fig-note">{e.note}</span>
                    </motion.div>

                    <motion.blockquote className="tst-quote" variants={quoteVariants}>
                      <span className="tst-quote-mark" aria-hidden="true">&ldquo;</span>
                      {e.quote}
                    </motion.blockquote>
                  </div>

                  {/* Two columns matching the body above it, so the seal sits
                      under the slip and the name starts on the quote's own left
                      edge. */}
                  <motion.div className="tst-record" variants={recordVariants}>
                    <span className="tst-seal" aria-hidden="true">{monogram(e.firm)}</span>
                    <span className="tst-rec-main">
                      <span className="tst-rec-who">
                        <span className="tst-rec-name">{e.name}</span>
                        <span className="tst-rec-role">
                          {e.role}, {e.firm}
                        </span>
                      </span>
                      <span className="tst-rec-place">{e.city}</span>
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
          Testimonial {index + 1} of {count}: {entries[index].name},{' '}
          {entries[index].firm}.
        </p>
      </div>
    </section>
  );
};
