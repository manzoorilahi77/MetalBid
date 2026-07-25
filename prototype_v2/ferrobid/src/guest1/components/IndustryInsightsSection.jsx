import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

// Today's top industry headlines — refreshed daily in a real deployment;
// hardcoded here for the prototype, dated to the in-fiction "today".
const newsItems = [
  {
    date: '23 Jul 2026',
    time: '2h ago',
    source: 'NMDC Ltd.',
    category: 'Earnings',
    title: 'NMDC reports 15% profit growth on scrap & surplus asset disposal',
    desc: "NMDC's focus on structured digital auctions has yielded significant returns, with its vehicle fleet auction posting record participation across regional yards.",
  },
  {
    date: '23 Jul 2026',
    time: '3h ago',
    source: 'Ministry of Steel',
    category: 'Policy',
    title: 'Union Ministry initiates specialised PLI scheme for ferro-alloy sector',
    desc: 'The scheme aims to boost domestic production of rare metals, with a focus on secondary steel manufacturers and structured raw-material sourcing.',
  },
  {
    date: '23 Jul 2026',
    time: '5h ago',
    source: 'Tata Steel',
    category: 'Sustainability',
    title: "Tata Steel's Jamshedpur plant achieves near-zero scrap landfill status",
    desc: 'A milestone in circular economy practice, driven by optimised material handling and waste-to-energy conversion across the facility.',
  },
  {
    date: '23 Jul 2026',
    time: '6h ago',
    source: 'Coal India Ltd.',
    category: 'Auctions',
    title: 'Coal India to auction 10 new mining blocks for private bidders',
    desc: 'Expected to boost domestic energy production, with transparent digital bidding open to both private and public sector companies.',
  },
  {
    date: '23 Jul 2026',
    time: '8h ago',
    source: 'SAIL',
    category: 'Recycling',
    title: 'SAIL scrap recycling division reports record Q1 volumes',
    desc: 'Structured yard audits and digital lot verification helped the division post its highest quarterly recovery volumes to date.',
  },
  {
    date: '23 Jul 2026',
    time: '11h ago',
    source: 'SteelMint',
    category: 'Markets',
    title: "India's steel scrap imports rise 12% amid domestic demand surge",
    desc: 'Rising induction furnace capacity across northern hubs is driving import volumes even as domestic collection networks expand.',
  },
  {
    date: '23 Jul 2026',
    time: '14h ago',
    source: 'JSW Steel',
    category: 'Capacity',
    title: 'JSW Steel commissions new EAF furnace fed by domestic scrap',
    desc: 'The new electric arc furnace line is designed to run primarily on locally sourced scrap, reducing dependence on iron ore inputs.',
  },
  {
    date: '23 Jul 2026',
    time: '18h ago',
    source: 'Ministry of Steel',
    category: 'Policy',
    title: 'Government proposes stricter quality norms for scrap-based steel',
    desc: 'Draft guidelines call for standardised grading and inspection protocols across all scrap-fed steelmaking units nationwide.',
  },
];

// Datelines give the lead story a broadsheet "CITY — " byline feel.
const datelines = ['Hyderabad', 'New Delhi', 'Jamshedpur', 'Kolkata', 'New Delhi', 'Mumbai', 'Mumbai', 'New Delhi'];

// Pull quotes + a second paragraph fill out each lead like a real article column.
const quotes = [
  'Digital auctions have fundamentally changed how we realise value from surplus assets.',
  'The incentive rewards scale, quality and traceable sourcing — not volume alone.',
  'Near-zero landfill is no longer aspirational for us; it is an operating standard.',
  'Opening these blocks to competitive bidding widens participation without diluting oversight.',
  'Verification at the lot level is what turns recovered scrap into a dependable input.',
  'Domestic collection is expanding, but furnace appetite is still outpacing it.',
  'Feeding the furnace with local scrap is both a cost decision and a carbon decision.',
  'Standardised grading gives every buyer the same starting line.',
];
const quoteBys = [
  'Chairman, NMDC',
  'Ministry of Steel',
  'Operations Head, Tata Steel',
  'Coal India Ltd.',
  'SAIL Recycling Division',
  'SteelMint Research Desk',
  'JSW Steel',
  'Ministry of Steel',
];
const bodies = [
  'Analysts attribute the jump to tighter reserve-price discipline and a wider bidder pool drawn in by the platform’s transparent, real-time process — with more idle plant and machinery set to move online next quarter.',
  'Officials said the scheme would prioritise secondary manufacturers that can demonstrate verified raw-material trails, aligning with a broader push toward auditable, lower-emission steelmaking across the country.',
  'The plant now diverts almost all process residue into reuse or energy recovery, an outcome the company credits to granular material tracking and closed-loop handling introduced over the past two years.',
  'The blocks span multiple states and will be offered through the same transparent digital process used for recent surplus sales, with outcomes published in real time for every registered bidder.',
  'Record quarterly volumes followed a shift to structured yard audits, which the division says has reduced disputes and lifted buyer confidence across its wider recovery network.',
  'The widening gap has kept import demand firm even as new scrap-processing capacity comes online across northern industrial clusters, analysts noted in the latest market read.',
  'The electric-arc line is engineered to run predominantly on domestically sourced material — a move the company says trims exposure to iron-ore price swings while lowering emissions intensity.',
  'The draft proposes uniform inspection and grading protocols for scrap-fed units nationwide, a step industry bodies have long sought to curb quality disputes in fast-growing secondary steel.',
];

const N = newsItems.length;
const EASE = [0.16, 1, 0.3, 1];

const leadVariants = {
  enter: (dir) => ({ opacity: 0, y: dir >= 0 ? 12 : -12 }),
  center: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
  exit: (dir) => ({ opacity: 0, y: dir >= 0 ? -10 : 10, transition: { duration: 0.24, ease: 'easeIn' } }),
};

export const IndustryInsightsSection = () => {
  const reducedMotion = usePrefersReducedMotion();
  const [[index, dir], setState] = React.useState([0, 0]);
  const active = newsItems[index];

  const go = (n, direction) => setState([(n + N) % N, direction]);
  const prev = () => go(index - 1, -1);
  const next = () => go(index + 1, 1);
  const pick = (i) => go(i, i > index ? 1 : -1);

  return (
    <section className="industry-insights-section">
      <div className="container">
        <div className="cov-header">
          <div className="cov-header-left">
            <div className="cov-eyebrow">Today&apos;s Coverage</div>
            <h2 className="cov-heading">Industry Insights</h2>
          </div>
          <div className="cov-header-right">
            <Link to="/market-reports" className="cov-viewall">
              View all coverage <ArrowRight size={14} />
            </Link>
            <div className="cov-nav">
              <button className="cov-nav-btn" aria-label="Previous story" onClick={prev}>
                <ChevronLeft size={18} />
              </button>
              <button className="cov-nav-btn" aria-label="Next story" onClick={next}>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="cov-rule" />

        <div className="cov-grid">
          {/* Lead story */}
          <div className="cov-lead">
            <AnimatePresence custom={dir} mode="wait" initial={false}>
              <motion.article
                className="cov-lead-body"
                key={index}
                custom={dir}
                variants={reducedMotion ? undefined : leadVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <div className="cov-paper-kicker">
                  <span>{active.category}</span>
                  <span className="cov-paper-kicker-tag">Today&apos;s Lead</span>
                </div>
                <h3 className="cov-paper-title">{active.title}</h3>
                <div className="cov-paper-byline">
                  By <strong>{active.source}</strong>
                  <span className="cov-byline-loc">{datelines[index]}</span>
                  <span className="cov-byline-time">{active.date} · {active.time}</span>
                </div>
                <p className="cov-paper-dek">{active.desc}</p>
                <figure className="cov-paper-quote">
                  <blockquote>{quotes[index]}</blockquote>
                  <figcaption>— {quoteBys[index]}</figcaption>
                </figure>
                <p className="cov-paper-body">{bodies[index]}</p>
                <Link to="/market-reports" className="cov-lead-link">
                  Continue reading <ArrowRight size={15} />
                </Link>
              </motion.article>
            </AnimatePresence>

            {/* Auto-advance progress: the CSS animation fills the bar and, on
                completion, advances to the next story. Hovering pauses it. */}
            {!reducedMotion && (
              <div className="cov-progress">
                <span key={index} className="cov-progress-fill" onAnimationEnd={next} />
              </div>
            )}
          </div>

          {/* Headline list */}
          <ul className="cov-list">
            {newsItems.map((news, i) => {
              const isActive = i === index;
              return (
                <li key={news.title}>
                  <button
                    className={`cov-row${isActive ? ' is-active' : ''}`}
                    onClick={() => pick(i)}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    {isActive && !reducedMotion && (
                      <motion.span className="cov-row-mark" layoutId="cov-active" transition={{ type: 'spring', stiffness: 480, damping: 42 }} />
                    )}
                    <span className="cov-row-num">{String(i + 1).padStart(2, '0')}</span>
                    <div className="cov-row-main">
                      <div className="cov-row-meta">
                        <span className="cov-row-cat">{news.category}</span>
                        <span className="cov-row-src">{news.source}</span>
                        <span className="cov-row-time">{news.time}</span>
                      </div>
                      <span className="cov-row-title">{news.title}</span>
                    </div>
                    <ArrowUpRight className="cov-row-arrow" size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
};
