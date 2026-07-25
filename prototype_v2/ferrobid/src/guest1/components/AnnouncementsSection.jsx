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

export const AnnouncementsSection = () => {
  const carouselRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollState = () => {
    const el = carouselRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);

    // Match against each card's snapped (left-edge) position rather than the
    // viewport center — with several cards peeking into view at once, the
    // "center" card is usually the 2nd or 3rd one, not the one actually
    // snapped to the start, which is what the dots should track.
    let closest = 0;
    let minDist = Infinity;
    Array.from(el.children).forEach((card, i) => {
      const dist = Math.abs(card.offsetLeft - el.scrollLeft);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });
    setActiveIndex(closest);
  };

  useEffect(() => {
    updateScrollState();
    const el = carouselRef.current;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
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
    const card = el.children[i];
    if (!card) return;
    el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: 'smooth' });
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
        <div className="announcements-carousel" ref={carouselRef}>
          {announcements.map((a, i) => {
            const meta = CATEGORY_META[a.category];
            const Icon = meta.icon;
            return (
              <motion.div
                className="announcement-card"
                key={a.title}
                style={{ '--accent': meta.color, '--accent-bg': meta.bg }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
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
        </div>
      </div>

      <div className="announcements-dots">
        {announcements.map((_, i) => (
          <motion.button
            key={i}
            layout
            className={`announcements-dot ${i === activeIndex ? 'active' : ''}`}
            aria-label={`Go to announcement ${i + 1}`}
            onClick={() => scrollToIndex(i)}
            whileHover={{ scale: i === activeIndex ? 1 : 1.4 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        ))}
        </div>
      </div>
    </section>
  );
};
