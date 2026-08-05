import React, { useCallback, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
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
const EASE_OUT = [0.4, 0, 1, 1];
const SWIPE_THRESHOLD = 70;
const pad2 = (n) => String(n).padStart(2, '0');

/* The card travels the way you sent it: forward pushes the outgoing card left
   and brings the next in from the right, back reverses both. Direction is the
   custom passed down, so one variant set covers both. */
const cardVariants = {
  enter: (dir) => ({ x: dir > 0 ? 64 : -64, opacity: 0 }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.55, ease: EASE, staggerChildren: 0.05 },
  },
  exit: (dir) => ({
    x: dir > 0 ? -64 : 64,
    opacity: 0,
    transition: { duration: 0.3, ease: EASE_OUT },
  }),
};

/* The figure is posted, not faded in: it wipes up from under its own baseline
   the way a printed result appears on a board. */
const figVariants = {
  enter: { opacity: 0, y: 14, clipPath: 'inset(0 0 100% 0)' },
  center: {
    opacity: 1,
    y: 0,
    clipPath: 'inset(0 0 0% 0)',
    transition: { duration: 0.6, ease: EASE },
  },
};

/* The quote resolves out of a blur as its words rise — fast enough to read as
   one wave rather than a typewriter, so it never fights the card's travel. */
const quoteVariants = {
  enter: { opacity: 0, filter: 'blur(5px)' },
  center: {
    opacity: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.5, ease: EASE, staggerChildren: 0.009 },
  },
};

const wordVariants = {
  enter: { opacity: 0, y: '0.4em' },
  center: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE } },
};

const recordVariants = {
  enter: { opacity: 0, y: 10 },
  center: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE, delay: 0.12 } },
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

/* Shared by the live card and by the invisible sizer underneath it, so the two
   can never drift apart and mis-measure the card's height. */
const EntryBody = ({ e, animate }) => (
  <>
    <div className="tst-body">
      {/* The result slip: the figure the quote earned, on its own tinted panel
          rather than floating in the gutter — the card reads as two materials,
          and the panel carries the left of the card at any quote length. */}
      <motion.div className="tst-fig" variants={animate ? figVariants : undefined}>
        <span className="tst-fig-num">{e.figure}</span>
        <span className="tst-fig-label">{e.figureLabel}</span>
        <span className="tst-fig-note">{e.note}</span>
      </motion.div>

      <motion.blockquote className="tst-quote" variants={animate ? quoteVariants : undefined}>
        <span className="tst-quote-mark" aria-hidden="true">&ldquo;</span>
        {e.quote.split(' ').map((word, w) => (
          <motion.span className="tst-word" key={w} variants={animate ? wordVariants : undefined}>
            {word + ' '}
          </motion.span>
        ))}
      </motion.blockquote>
    </div>

    {/* Two columns matching the body above it, so the seal sits under the slip
        and the name starts on the quote's own left edge. */}
    <motion.div className="tst-record" variants={animate ? recordVariants : undefined}>
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
  </>
);

export const TestimonialsSection = () => {
  const reduce = useReducedMotion();
  const [[index, direction], setState] = useState([0, 1]);

  // No timer and no dwell bar: the card moves only when the reader moves it,
  // with the arrows or by dragging.
  const go = useCallback((next, dir) => {
    setState(([current]) => {
      const target = (next + entries.length) % entries.length;
      if (target === current) return [current, dir];
      // Wrapping 4 → 0 should still read as "forward", so trust the caller's
      // direction when it gives one and only fall back to index order.
      return [target, dir ?? (target > current ? 1 : -1)];
    });
  }, []);

  const active = entries[index];

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
              {pad2(index + 1)} <span className="tst-count-sep">/</span> {pad2(entries.length)}
            </span>
            <button
              type="button"
              className="tst-nav-btn"
              aria-label="Previous testimonial"
              onClick={() => go(index - 1, -1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="tst-nav-btn"
              aria-label="Next testimonial"
              onClick={() => go(index + 1, 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </header>

        <div className="tst-board">
          <div className="tst-card">
            {/* Invisible, but it is what fixes the card's height: all five
                entries stacked in one cell, so the card is always as tall as
                the longest quote and the page never jumps mid-carousel. */}
            <div className="tst-sizer" aria-hidden="true">
              {entries.map((e) => (
                <div className="tst-sizer-entry" key={e.name}>
                  <EntryBody e={e} animate={false} />
                </div>
              ))}
            </div>

            {/* Default sync mode, not popLayout: both slides already occupy
                the same grid cell, so they overlap correctly without framer
                pulling the outgoing one out of flow and shrink-wrapping it. */}
            <AnimatePresence initial={false} custom={direction}>
              <motion.article
                className={`tst-slide is-${active.side.toLowerCase()}`}
                key={index}
                custom={direction}
                variants={reduce ? undefined : cardVariants}
                initial={reduce ? false : 'enter'}
                animate={reduce ? undefined : 'center'}
                exit={reduce ? undefined : 'exit'}
                aria-live="off"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${entries.length}: ${active.name}, ${active.firm}`}
                drag={reduce ? false : 'x'}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.14}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -SWIPE_THRESHOLD) go(index + 1, 1);
                  else if (info.offset.x > SWIPE_THRESHOLD) go(index - 1, -1);
                }}
              >
                <EntryBody e={active} animate={!reduce} />
              </motion.article>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};
