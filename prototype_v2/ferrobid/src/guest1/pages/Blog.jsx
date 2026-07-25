import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Newspaper, Search, ArrowRight, Clock, TrendingUp } from 'lucide-react';
import { PageHero, SectionHead, RevealGrid, Reveal } from '../components/PageShell';
import { POSTS, CATEGORIES, AUTHORS, POPULAR_SLUGS, getFeatured, getPost } from '../data/blogPosts';
import '../styles/blog.css';

const Byline = ({ authorKey, size }) => {
  const a = AUTHORS[authorKey];
  if (!a) return null;
  return (
    <div className="blog-byline">
      <span className={`blog-avatar ${size === 'lg' ? 'lg' : ''}`}>{a.initials}</span>
      <span>
        <span className="blog-byline-name" style={{ display: 'block' }}>{a.name}</span>
        <span className="blog-byline-role">{a.role}</span>
      </span>
    </div>
  );
};

export const Blog = () => {
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('All');

  const featured = getFeatured();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return POSTS.filter((p) => p.slug !== featured.slug).filter((p) => {
      if (cat !== 'All' && p.cat !== cat) return false;
      if (q) return p.title.toLowerCase().includes(q) || p.excerpt.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q));
      return true;
    });
  }, [query, cat, featured.slug]);

  const popular = POPULAR_SLUGS.map(getPost).filter(Boolean);

  return (
    <div className="ent-page">
      <PageHero
        eyebrow="FerroBid Blog"
        eyebrowIcon={Newspaper}
        title={<>Insights on <span className="accent">metal &amp; scrap trade</span></>}
        subtitle="Market analysis, product updates, compliance news and practical guides for buyers and sellers on India's most transparent metal auction platform."
        breadcrumb={[{ label: 'Resources' }, { label: 'Blog' }]}
      />

      {/* Featured + sidebar */}
      <section className="ent-section">
        <div className="container">
          <div className="ent-split">
            <Link to={`/blog/${featured.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <article className="ent-article-card" style={{ cursor: 'pointer' }}>
                <div className="ent-article-thumb" style={{ height: '320px' }}>
                  <img src={featured.img} alt={featured.title} />
                  <span className="ent-article-tag">Featured · {featured.cat}</span>
                </div>
                <div className="ent-article-body">
                  <div className="ent-article-meta">
                    <Clock size={12} style={{ verticalAlign: 'middle' }} /> {featured.date} · {featured.read} read
                  </div>
                  <h3 style={{ fontSize: '24px' }}>{featured.title}</h3>
                  <p>{featured.excerpt}</p>
                  <div className="ent-article-foot">
                    <Byline authorKey={featured.author} />
                    <span className="ent-article-link">Read article <ArrowRight size={14} /></span>
                  </div>
                </div>
              </article>
            </Link>

            <aside className="ent-aside-sticky">
              <div className="ent-search" style={{ height: '48px', maxWidth: 'none', marginBottom: '20px' }}>
                <Search size={16} />
                <input type="text" placeholder="Search articles…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search articles" />
              </div>
              <div className="ent-card">
                <div className="ent-card-icon"><TrendingUp size={22} /></div>
                <h3>Most read</h3>
                <div style={{ display: 'grid', gap: '14px', marginTop: '10px' }}>
                  {popular.map((p, i) => (
                    <Link key={p.slug} to={`/blog/${p.slug}`} style={{ display: 'flex', gap: '12px', fontSize: '13.5px', color: 'var(--text-muted)', textDecoration: 'none', lineHeight: 1.5, alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{String(i + 1).padStart(2, '0')}</span>
                      <span>{p.title}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Article grid */}
      <section className="ent-section alt">
        <div className="container">
          <SectionHead eyebrow="Latest articles" title="From the newsroom" />
          <div className="ent-pills" style={{ marginBottom: '24px' }}>
            {CATEGORIES.map((c) => (
              <button key={c} className={`ent-pill ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>{c}</button>
            ))}
          </div>
          <RevealGrid className="ent-grid cols-3">
            {filtered.map((p) => (
              <Reveal key={p.slug}>
                <Link to={`/blog/${p.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <article className="ent-article-card">
                    <div className="ent-article-thumb">
                      <img src={p.img} alt={p.title} />
                      <span className="ent-article-tag">{p.cat}</span>
                    </div>
                    <div className="ent-article-body">
                      <div className="ent-article-meta">{p.date} · {p.read} read</div>
                      <h3>{p.title}</h3>
                      <p style={{ fontSize: '13.5px' }}>{p.excerpt}</p>
                      <div className="ent-article-foot">
                        <Byline authorKey={p.author} />
                        <span className="ent-article-link">Read <ArrowRight size={14} /></span>
                      </div>
                    </div>
                  </article>
                </Link>
              </Reveal>
            ))}
          </RevealGrid>
          {filtered.length === 0 && (
            <div className="ent-card" style={{ textAlign: 'center' }}>
              <p>No articles match your search.</p>
            </div>
          )}
        </div>
      </section>

      {/* Newsletter */}
      <section className="ent-section">
        <div className="container">
          <div className="ent-card" style={{ padding: '40px', textAlign: 'center' }}>
            <SectionHead center eyebrow="Stay informed" title="Get market insights in your inbox" subtitle="Monthly analysis, product updates and auction highlights. No spam — unsubscribe anytime." />
            <form className="ent-newsletter" style={{ margin: '0 auto', justifyContent: 'center' }} onSubmit={(e) => e.preventDefault()}>
              <input type="email" placeholder="you@company.com" aria-label="Email address" required />
              <button type="submit" className="btn btn-primary">Subscribe</button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Blog;
