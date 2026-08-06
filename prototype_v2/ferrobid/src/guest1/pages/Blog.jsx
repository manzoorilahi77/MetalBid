/* ---------------------------------------------------------------------------
   Blog

   This page had the strongest content of the secondary set already — seven
   full articles with real bodies, named authors and working categories — so
   this is a re-skin, not a rebuild. What changed: the hero and filters now
   match the rest of the Resources family, category pills carry live counts,
   search reports what it found and offers a way out when it finds nothing,
   and the article cards use the same surface and motion language as every
   other card on the site.
--------------------------------------------------------------------------- */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Newspaper, Search, X, ChevronRight, SearchX, Clock,
  TrendingUp, Mail, CheckCircle2, PenLine, Layers, Users
} from 'lucide-react';
import { POSTS, CATEGORIES, AUTHORS, POPULAR_SLUGS, getFeatured, getPost } from '../data/blogPosts';
import '../styles/enterprise.css';
/* The result-count line and reset button are shared with the FAQ page. */
import '../styles/support.css';
import '../styles/resources.css';

const Author = ({ authorKey }) => {
  const a = AUTHORS[authorKey];
  if (!a) return null;
  return (
    <span className="blg-author">
      <span className="blg-avatar" aria-hidden="true">{a.initials}</span>
      <span style={{ minWidth: 0 }}>
        <span className="blg-author-name">{a.name}</span>
        <span className="blg-author-role">{a.role}</span>
      </span>
    </span>
  );
};

export const Blog = () => {
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('All');
  const [subscribed, setSubscribed] = useState(false);

  const featured = getFeatured();
  const needle = query.trim().toLowerCase();

  /* Search covers title, excerpt and tags — tags are how a reader looks for
     "e-way bill" when the title never says it. */
  const searched = useMemo(() => POSTS.filter(p => {
    if (p.slug === featured.slug) return false;
    if (!needle) return true;
    return `${p.title} ${p.excerpt} ${p.tags.join(' ')}`.toLowerCase().includes(needle);
  }), [needle, featured.slug]);

  const counts = useMemo(() => {
    const map = { All: searched.length };
    for (const p of searched) map[p.cat] = (map[p.cat] || 0) + 1;
    return map;
  }, [searched]);

  const filtered = useMemo(
    () => (cat === 'All' ? searched : searched.filter(p => p.cat === cat)),
    [searched, cat]
  );

  const popular = POPULAR_SLUGS.map(getPost).filter(Boolean);
  const authorCount = new Set(POSTS.map(p => p.author)).size;
  const isFiltered = needle !== '' || cat !== 'All';
  const reset = () => { setQuery(''); setCat('All'); };

  const reveal = reduceMotion ? {} : {
    initial: { y: 18 },
    whileInView: { y: 0 },
    viewport: { once: true, amount: 0.12 },
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
  };

  const stagger = i => (reduceMotion ? {} : {
    initial: { y: 22 },
    whileInView: { y: 0 },
    viewport: { once: true, amount: 0.15 },
    transition: { duration: 0.5, delay: Math.min(i, 5) * 0.06, ease: [0.16, 1, 0.3, 1] }
  });

  return (
    <div className="ent-page res-page">
      {/* ─── Hero ─── */}
      <header className="res-hero">
        <div className="container">
          <nav className="ent-breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <ChevronRight size={13} aria-hidden="true" />
            <span>Resources</span>
            <ChevronRight size={13} aria-hidden="true" />
            <span className="crumb-current" aria-current="page">Blog</span>
          </nav>

          <div className="res-hero-inner">
            <p className="ent-hero-eyebrow"><Newspaper size={13} aria-hidden="true" /> FerroBid Blog</p>
            <h1 className="res-hero-title">Written by the people who run the floor.</h1>
            <p className="res-hero-lead">
              Market analysis, compliance changes and practical guides for buyers and sellers —
              from the market intelligence, compliance, product and logistics desks.
            </p>

            <div className="res-search">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search articles, topics and tags…"
                aria-label="Search articles"
              />
              {query && (
                <button type="button" className="res-search-clear" onClick={reset} aria-label="Clear search">
                  <X size={16} strokeWidth={2.25} />
                </button>
              )}
            </div>

            <ul className="res-facts">
              <li>
                <p className="res-fact-label"><Layers size={12} aria-hidden="true" />Articles</p>
                <p className="res-fact-value">{POSTS.length} published</p>
              </li>
              <li>
                <p className="res-fact-label"><PenLine size={12} aria-hidden="true" />Categories</p>
                <p className="res-fact-value">{CATEGORIES.length - 1}</p>
              </li>
              <li>
                <p className="res-fact-label"><Users size={12} aria-hidden="true" />Contributors</p>
                <p className="res-fact-value">{authorCount} desks</p>
              </li>
              <li>
                <p className="res-fact-label"><Clock size={12} aria-hidden="true" />Latest</p>
                <p className="res-fact-value">{featured.date}</p>
              </li>
            </ul>
          </div>
        </div>
      </header>

      {/* ─── Featured + most read ─── */}
      <section className="ent-section">
        <div className="container">
          <div className="ent-split">
            <motion.div {...reveal}>
              <Link to={`/blog/${featured.slug}`} className="blg-featured">
                <div className="blg-featured-media">
                  <img src={featured.img} alt="" loading="lazy" decoding="async" />
                  <span className="blg-badge">Featured · {featured.cat}</span>
                </div>
                <div className="blg-featured-body">
                  <div className="blg-meta">
                    <span>{featured.date}</span>
                    <span className="blg-meta-dot" aria-hidden="true" />
                    <span>{featured.read} read</span>
                  </div>
                  <h2>{featured.title}</h2>
                  <p>{featured.excerpt}</p>
                  <div className="blg-foot">
                    <Author authorKey={featured.author} />
                    <span className="blg-go">Read article <ChevronRight size={13} strokeWidth={2.5} /></span>
                  </div>
                </div>
              </Link>
            </motion.div>

            <aside className="ent-aside-sticky">
              <div className="res-card" style={{ cursor: 'default' }}>
                <span className="res-card-icon"><TrendingUp size={17} strokeWidth={1.9} /></span>
                <h3>Most read this month</h3>
                <div className="blg-popular" style={{ marginTop: '10px' }}>
                  {popular.map((p, i) => (
                    <Link key={p.slug} to={`/blog/${p.slug}`} className="blg-popular-item">
                      <span className="blg-popular-n">{String(i + 1).padStart(2, '0')}</span>
                      <span>
                        <span className="blg-popular-title">{p.title}</span>
                        <span className="blg-popular-meta">{p.cat} · {p.read} read</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ─── Article grid ─── */}
      <section className="ent-section alt">
        <div className="container">
          <motion.div className="sec-head" {...reveal}>
            <p className="sec-eyebrow">Latest articles</p>
            <h2 className="sec-title">From the newsroom.</h2>
          </motion.div>

          <div className="res-pills">
            {CATEGORIES.map(c => (
              <button
                key={c}
                type="button"
                className={`res-pill${cat === c ? ' is-active' : ''}`}
                onClick={() => setCat(c)}
                aria-pressed={cat === c}
              >
                {c}
                <span className="res-pill-count">{counts[c] || 0}</span>
              </button>
            ))}
          </div>

          <div className="faq-resultline">
            <span>
              <strong>{filtered.length}</strong> {filtered.length === 1 ? 'article' : 'articles'}
              {needle && <> matching “<strong>{query.trim()}</strong>”</>}
              {cat !== 'All' && <> in {cat}</>}
            </span>
            {isFiltered && (
              <button type="button" className="faq-reset" onClick={reset}>Clear filters</button>
            )}
          </div>

          {filtered.length > 0 ? (
            <div className="res-grid cols-3">
              {filtered.map((p, i) => (
                <motion.div key={p.slug} {...stagger(i)} style={{ display: 'flex' }}>
                  <Link to={`/blog/${p.slug}`} className="blg-card">
                    <div className="blg-card-media">
                      <img src={p.img} alt="" loading="lazy" decoding="async" />
                      <span className="blg-badge">{p.cat}</span>
                    </div>
                    <div className="blg-card-body">
                      <div className="blg-meta">
                        <span>{p.date}</span>
                        <span className="blg-meta-dot" aria-hidden="true" />
                        <span>{p.read} read</span>
                      </div>
                      <h3>{p.title}</h3>
                      <p>{p.excerpt}</p>
                      <div className="blg-foot">
                        <Author authorKey={p.author} />
                        <span className="blg-go">Read <ChevronRight size={13} strokeWidth={2.5} /></span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="res-empty">
              <span className="res-empty-icon"><SearchX size={20} strokeWidth={1.9} /></span>
              <h3>Nothing matches {needle ? `“${query.trim()}”` : `the ${cat} filter`}</h3>
              <p style={{ marginBottom: '16px' }}>
                Try a broader term, or clear the filters to see all {POSTS.length} articles.
              </p>
              <button type="button" className="faq-reset" onClick={reset}>Clear filters</button>
            </div>
          )}
        </div>
      </section>

      {/* ─── Newsletter ─── */}
      <section className="ent-section">
        <div className="container">
          <motion.div className="blg-news" {...reveal}>
            <div className="sec-head is-center" style={{ marginBottom: '22px' }}>
              <p className="sec-eyebrow">Stay informed</p>
              <h2 className="sec-title">Market insights, once a month.</h2>
              <p className="sec-lead">
                Price movement, policy changes that affect scrap, and what the research desk is
                watching. One email a month, and unsubscribing takes one click.
              </p>
            </div>

            {subscribed ? (
              <span className="blg-news-done">
                <CheckCircle2 size={16} strokeWidth={2.25} aria-hidden="true" />
                Subscribed. Check your inbox to confirm.
              </span>
            ) : (
              <form className="blg-news-form" onSubmit={e => { e.preventDefault(); setSubscribed(true); }}>
                <Mail size={16} style={{ alignSelf: 'center', flex: 'none', color: 'var(--text-muted)' }} aria-hidden="true" />
                <input type="email" required placeholder="you@company.com" aria-label="Work email address" />
                <button type="submit">Subscribe</button>
              </form>
            )}
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Blog;
