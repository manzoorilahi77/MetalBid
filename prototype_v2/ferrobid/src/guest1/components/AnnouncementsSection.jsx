import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Gift,
  Wrench,
  Award,
  FileText,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  BellRing,
} from 'lucide-react';

const CATEGORY_META = {
  feature: { label: 'New Feature', icon: Sparkles, color: '#3a5a8c', bg: '#eef2f9' },
  promo: { label: 'Promotion', icon: Gift, color: '#b8451f', bg: '#faf0ea' },
  maintenance: { label: 'Maintenance', icon: Wrench, color: '#96631a', bg: '#f8f2e6' },
  milestone: { label: 'Milestone', icon: Award, color: '#2c7a57', bg: '#ecf5ef' },
  policy: { label: 'Policy Update', icon: FileText, color: '#5c5750', bg: '#f2f0ec' },
};

// Newest first — this is the correct order for an announcements feed.
const announcements = [
  {
    category: 'feature',
    title: 'AI Fraud Detection is now live',
    desc: 'Every transaction is scanned in real time for suspicious bidding patterns, keeping every auction fair.',
    date: 'Jul 18, 2026',
    unread: true,
  },
  {
    category: 'promo',
    title: 'Zero-commission week',
    desc: 'List your scrap and metal lots commission-free from July 21 to July 27.',
    date: 'Jul 16, 2026',
    unread: true,
  },
  {
    category: 'feature',
    title: 'Equipment resale marketplace launched',
    desc: 'Buy and sell used industrial equipment like excavators, forklifts, and cranes right alongside metal scrap.',
    date: 'Jul 12, 2026',
    unread: false,
  },
  {
    category: 'maintenance',
    title: 'Scheduled maintenance, July 25',
    desc: 'The platform will be briefly unavailable between 2 AM and 4 AM IST for infrastructure upgrades.',
    date: 'Jul 9, 2026',
    unread: false,
  },
  {
    category: 'milestone',
    title: 'Now tracking 46 countries',
    desc: "FerroBid's Market Intelligence dashboard now covers real-time industrial demand across 46 countries.",
    date: 'Jul 3, 2026',
    unread: false,
  },
  {
    category: 'policy',
    title: 'Updated KYC verification policy',
    desc: 'All sellers must complete enhanced KYC verification by August 1 to continue listing lots.',
    date: 'Jun 28, 2026',
    unread: false,
  },
];

const unreadCount = announcements.filter((a) => a.unread).length;

/* One dot per *reachable* scroll position, not one per card.

   A dot-per-card is wrong whenever the carousel shows several cards at once:
   with 6 cards and 4 in view, only the first 3 card positions can ever be
   scrolled to — the last 3 clamp against maxScroll, so their dots looked dead
   and the active pip never moved past the 3rd. Here we take each card's start
   offset, clamp it to the real scroll range, and collapse the duplicates that
   clamping produces. Every dot that survives maps to a distinct position the
   carousel can actually reach, so every dot is clickable — at any announcement
   count and at any breakpoint (4 / 3 / ~2 / 1 cards in view). */
const DEDUPE_PX = 8;

const measureDotOffsets = (el) => {
  const cards = Array.from(el.children);
  if (!cards.length) return [0];
  const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
  // Offsets relative to the first card, so the maths is independent of which
  // ancestor happens to be the cards' offsetParent and of the row's padding.
  const base = cards[0].offsetLeft;
  const offsets = [];
  cards.forEach((card) => {
    const target = Math.min(Math.max(card.offsetLeft - base, 0), maxScroll);
    if (!offsets.length || target - offsets[offsets.length - 1] > DEDUPE_PX) offsets.push(target);
  });
  return offsets;
};

export const AnnouncementsSection = () => {
  const carouselRef = useRef(null);
  const [dotOffsets, setDotOffsets] = useState([0]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollState = () => {
    const el = carouselRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);

    const offsets = measureDotOffsets(el);
    setDotOffsets((prev) =>
      prev.length === offsets.length && prev.every((v, i) => Math.abs(v - offsets[i]) < 1) ? prev : offsets,
    );

    // Track the dot whose scroll position we are nearest to. Because the
    // offsets are clamped, the last dot stays selectable at the end of the
    // track instead of the pip stranding itself mid-row.
    let closest = 0;
    let minDist = Infinity;
    offsets.forEach((target, i) => {
      const dist = Math.abs(target - el.scrollLeft);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });
    setActiveIndex(closest);
  };

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return undefined;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    // Card widths are percentage-based and change at the 1100/900/560px
    // breakpoints, which changes how many positions are reachable — so the dot
    // count has to be re-measured whenever the row itself resizes.
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollByCard = (dir) => {
    const el = carouselRef.current;
    const card = el.children[0];
    if (!card) return;
    const style = getComputedStyle(el);
    const gap = parseFloat(style.columnGap || style.gap || '20');
    el.scrollBy({ left: dir * (card.offsetWidth + gap), behavior: 'smooth' });
  };

  const scrollToIndex = (i) => {
    const el = carouselRef.current;
    if (!el || dotOffsets[i] === undefined) return;
    el.scrollTo({ left: dotOffsets[i], behavior: 'smooth' });
  };

  return (
    <section id="announcements" className="announcements-section">
      <div className="container">
        <div className="announcements-header">
          <div className="announcements-header-text">
            <div className="announcements-eyebrow">
              <BellRing size={13} /> Announcements
            </div>
            <h2 className="announcements-heading">
              What&apos;s New on FerroBid
              {unreadCount > 0 && (
                <span className="announcements-unread-badge">{unreadCount} New</span>
              )}
            </h2>
            <p className="announcements-desc">
              Product updates, platform policies, and limited-time offers, delivered as they happen.
            </p>
          </div>
          <div className="announcements-nav">
            <button
              className={`announcements-nav-btn ${!canScrollLeft ? 'disabled' : ''}`}
              aria-label="Previous announcement"
              onClick={() => canScrollLeft && scrollByCard(-1)}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              className={`announcements-nav-btn ${!canScrollRight ? 'disabled' : ''}`}
              aria-label="Next announcement"
              onClick={() => canScrollRight && scrollByCard(1)}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="announcements-carousel-wrap">
        {/* The reveal is driven from the row, not from each card. Per-card
            whileInView keyed off each card's own intersection, and the cards
            parked off the right-hand edge of the track never intersect the
            viewport — so they stayed frozen at the initial state: invisible,
            and still translated 20px down. That leftover transform grew the
            row's vertical scrollable overflow past its own height, quietly
            turning this horizontal carousel into an 8px-tall vertical
            scroller that swallowed the first part of every wheel gesture over
            it. Staggering from the container keys the reveal to the row's
            vertical position only, so all cards land at y:0 regardless of
            where they sit horizontally. */}
        <motion.div
          className="announcements-carousel"
          ref={carouselRef}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
        >
          {announcements.map((a) => {
            const meta = CATEGORY_META[a.category];
            const Icon = meta.icon;
            return (
              <motion.div
                className="announcement-card"
                key={a.title}
                style={{ '--accent': meta.color, '--accent-bg': meta.bg }}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
                  },
                }}
              >
                {a.unread && <span className="announcement-card-new">New</span>}
                <div className="announcement-card-top">
                  <span className="announcement-card-icon" style={{ color: meta.color, background: meta.bg }}>
                    <Icon size={14} />
                  </span>
                  <span className="announcement-card-tag" style={{ color: meta.color }}>{meta.label}</span>
                </div>
                <h4 className="announcement-card-title">{a.title}</h4>
                <p className="announcement-card-desc">{a.desc}</p>
                <div className="announcement-card-footer">
                  <span className="announcement-card-date">{a.date}</span>
                  <Link to="/blog" className="announcement-card-link">
                    Learn More <ArrowRight size={12} />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* One dot is a dot with nowhere to go — when every card already fits,
          the row has nothing to navigate, so the control disappears. */}
      {dotOffsets.length > 1 && (
        <div className="announcements-dots">
          {dotOffsets.map((_, i) => (
          <motion.button
            key={i}
            layout
            className={`announcements-dot ${i === activeIndex ? 'active' : ''}`}
            aria-label={`Go to announcement ${i + 1}`}
            aria-current={i === activeIndex ? 'true' : undefined}
            onClick={() => scrollToIndex(i)}
            whileHover={{ scale: i === activeIndex ? 1 : 1.4 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
          ))}
        </div>
      )}
      </div>
    </section>
  );
};
