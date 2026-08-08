import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Newspaper, ChevronRight, ArrowUpRight, Clock } from 'lucide-react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { asset } from '../utils/asset';

/* Magazine layout: one large image-led featured story and a ranked headline
   list beside it — mirrors the guest2 "News & Insights" section so both
   fronts share one editorial language. Today's top industry headlines,
   hardcoded here for the prototype and dated to the in-fiction "today". */
const TONES = {
  ember: { text: 'text-ember-strong', solid: 'bg-ember' },
  steel: { text: 'text-steel-strong', solid: 'bg-steel' },
  warning: { text: 'text-warning', solid: 'bg-warning' },
  success: { text: 'text-success', solid: 'bg-success' },
};

const insights = [
  {
    tone: 'ember',
    category: 'Earnings',
    title: 'NMDC reports 15% profit growth on scrap & surplus asset disposal',
    excerpt: "NMDC's focus on structured digital auctions has yielded significant returns, with its vehicle fleet auction posting record participation across regional yards.",
    source: 'NMDC Ltd.',
    date: '23 Jul 2026',
    time: '2h ago',
    img: asset('/images/auction_steel_coils.png'),
  },
  {
    tone: 'steel',
    category: 'Policy',
    title: 'Union Ministry initiates specialised PLI scheme for ferro-alloy sector',
    source: 'Ministry of Steel',
    date: '23 Jul 2026',
    time: '3h ago',
    img: asset('/images/hero_steel_mill.png'),
  },
  {
    tone: 'warning',
    category: 'Auctions',
    title: 'Coal India to auction 10 new mining blocks for private bidders',
    source: 'Coal India Ltd.',
    date: '23 Jul 2026',
    time: '6h ago',
    img: asset('/images/auction_cat_excavator.png'),
  },
  {
    tone: 'success',
    category: 'Recycling',
    title: 'SAIL scrap recycling division reports record Q1 volumes',
    source: 'SAIL',
    date: '23 Jul 2026',
    time: '8h ago',
    img: asset('/images/auction_copper_cathodes.png'),
  },
  {
    tone: 'steel',
    category: 'Capacity',
    title: 'JSW Steel commissions new EAF furnace fed by domestic scrap',
    source: 'JSW Steel',
    date: '23 Jul 2026',
    time: '14h ago',
    img: asset('/images/tile_steel.jpg'),
  },
];

export const IndustryInsightsSection = () => {
  const reduceMotion = usePrefersReducedMotion();
  const [featured, ...rest] = insights;
  const ft = TONES[featured.tone];

  const featuredReveal = reduceMotion ? {} : {
    initial: { opacity: 0, y: 26 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
    transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] },
  };

  const rowReveal = (i) => reduceMotion ? {} : {
    initial: { opacity: 0, x: 30 },
    whileInView: { opacity: 1, x: 0 },
    viewport: { once: true, amount: 0.3 },
    transition: { duration: 0.55, delay: i * 0.09, ease: [0.16, 1, 0.3, 1] },
  };

  return (
    <section className="industry-insights-section">
      <div className="container">
        <div className="cov-header">
          <div className="cov-header-left">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ember-strong mb-1.5">
              <Newspaper size={14} aria-hidden="true" /> Today&apos;s Coverage
            </div>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-ink text-balance">
              Industry Insights, <span className="text-ember">decoded</span>.
            </h2>
          </div>
          <Link to="/market-reports" className="cov-viewall shrink-0">
            View all coverage <ChevronRight size={16} />
          </Link>
        </div>

        <div className="grid lg:grid-cols-12 gap-6 mt-8">
          {/* Featured story — full-bleed image with overlaid headline */}
          <motion.div className="lg:col-span-7" {...featuredReveal}>
            <Link
              to="/market-reports"
              className="group relative flex w-full h-full min-h-[360px] sm:min-h-[440px] overflow-hidden rounded-2xl border border-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
            >
              <img
                src={featured.img}
                alt={featured.title}
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/5" />
              <div className="relative z-10 mt-auto space-y-3 p-6 text-white sm:p-8">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sm ${ft.solid}`}>
                  {featured.category}
                </span>
                <h3 className="font-heading max-w-2xl text-xl font-bold leading-snug tracking-tight text-balance sm:text-3xl">
                  {featured.title}
                </h3>
                {featured.excerpt && (
                  <p className="max-w-xl text-sm leading-relaxed text-white/80 line-clamp-2">{featured.excerpt}</p>
                )}
                <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs text-white/70">
                  <span className="font-semibold text-white/90">{featured.source}</span>
                  <span className="size-1 rounded-full bg-white/40" aria-hidden="true" />
                  <span>{featured.date}</span>
                  <span className="size-1 rounded-full bg-white/40" aria-hidden="true" />
                  <span className="inline-flex items-center gap-1"><Clock size={12} /> {featured.time}</span>
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Ranked headline list */}
          <div className="flex flex-col justify-between lg:col-span-5">
            {rest.map((a, i) => {
              const t = TONES[a.tone];
              return (
                <motion.div key={a.title} {...rowReveal(i)}>
                  <Link
                    to="/market-reports"
                    className={`group flex items-start gap-4 rounded-lg py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember ${i > 0 ? 'border-t border-line' : ''}`}
                  >
                    <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl">
                      <img
                        src={a.img}
                        alt={a.title}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider ${t.text}`}>{a.category}</span>
                      <h4 className="font-heading mt-0.5 text-sm font-bold leading-snug text-ink line-clamp-2 transition-colors group-hover:text-ember">
                        {a.title}
                      </h4>
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-muted">
                        <Clock size={12} className="shrink-0" /> {a.date} · {a.time}
                      </div>
                    </div>
                    <ArrowUpRight size={16} className="mt-0.5 shrink-0 text-ink-faint transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ember" />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default IndustryInsightsSection;
