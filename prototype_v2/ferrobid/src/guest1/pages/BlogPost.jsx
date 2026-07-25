import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Calendar, ArrowLeft, ArrowRight, Share2, Mail, Link2 } from 'lucide-react';
import { Breadcrumb, SectionHead, RevealGrid, Reveal } from '../components/PageShell';
import { getPost, getRelated, AUTHORS } from '../data/blogPosts';
import '../styles/blog.css';

const Block = ({ block }) => {
  switch (block.type) {
    case 'h2':
      return <h2>{block.text}</h2>;
    case 'ul':
      return <ul>{block.items.map((it, i) => <li key={i}>{it}</li>)}</ul>;
    case 'quote':
      return <blockquote className="blog-quote">{block.text}</blockquote>;
    case 'stat':
      return (
        <div className="blog-statblock">
          <span className="v">{block.value}</span>
          <span className="l">{block.label}</span>
        </div>
      );
    case 'p':
    default:
      return <p>{block.text}</p>;
  }
};

export const BlogPost = () => {
  const { slug } = useParams();
  const post = getPost(slug);

  if (!post) {
    return (
      <div className="ent-page">
        <div className="container">
          <div className="blog-404">
            <h2 className="ent-title" style={{ marginBottom: '12px' }}>Article not found</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
              The article you’re looking for may have moved or no longer exists.
            </p>
            <Link to="/blog" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              <ArrowLeft size={16} /> Back to the blog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const author = AUTHORS[post.author];
  const related = getRelated(post.slug, post.cat, 3);

  return (
    <div className="ent-page blog-article">
      {/* Hero */}
      <header className="blog-article-hero">
        <img className="blog-article-hero-img" src={post.img} alt="" aria-hidden="true" />
        <div className="container">
          <div className="blog-article-hero-inner">
            <Breadcrumb items={[{ label: 'Resources' }, { label: 'Blog', to: '/blog' }, { label: post.cat }]} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
              <span className="blog-article-cat">{post.cat}</span>
              <h1 className="blog-article-title">{post.title}</h1>
              <div className="blog-article-meta">
                {author && (
                  <div className="blog-byline">
                    <span className="blog-avatar">{author.initials}</span>
                    <span>
                      <span className="blog-byline-name" style={{ display: 'block' }}>{author.name}</span>
                      <span className="blog-byline-role">{author.role}</span>
                    </span>
                  </div>
                )}
                <span className="dot" />
                <span className="mi"><Calendar size={14} /> {post.date}</span>
                <span className="dot" />
                <span className="mi"><Clock size={14} /> {post.read} read</span>
              </div>
            </motion.div>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="container">
        <article className="blog-body">
          {post.body.map((block, i) => <Block key={i} block={block} />)}

          {post.tags?.length > 0 && (
            <div className="blog-tags" style={{ marginTop: '36px' }}>
              {post.tags.map((t) => <span key={t} className="blog-chip">#{t}</span>)}
            </div>
          )}
        </article>

        {/* Share */}
        <div className="blog-share">
          <span className="blog-share-label">Share</span>
          <button className="blog-share-btn" aria-label="Share this article"><Share2 size={16} /></button>
          <button className="blog-share-btn" aria-label="Share via email"><Mail size={16} /></button>
          <button className="blog-share-btn" aria-label="Copy link"><Link2 size={16} /></button>
        </div>

        {/* Author */}
        {author && (
          <div className="blog-authorcard">
            <span className="blog-avatar lg">{author.initials}</span>
            <div>
              <span className="blog-byline-name" style={{ fontSize: '15px' }}>{author.name}</span>
              <span className="blog-byline-role" style={{ display: 'block' }}>{author.role} · FerroBid</span>
              <p>Writing on the mechanics of India’s metal &amp; scrap markets — price discovery, trust, and the move from informal trade to transparent auction.</p>
            </div>
          </div>
        )}
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="ent-section alt" style={{ marginTop: '56px' }}>
          <div className="container">
            <SectionHead eyebrow="Keep reading" title="Related articles" />
            <RevealGrid className="ent-grid cols-3">
              {related.map((p) => (
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
                        <span className="ent-article-link">Read <ArrowRight size={14} /></span>
                      </div>
                    </article>
                  </Link>
                </Reveal>
              ))}
            </RevealGrid>
          </div>
        </section>
      )}

      {/* Back link */}
      <div className="container" style={{ marginTop: '48px' }}>
        <Link to="/blog" className="ent-article-link" style={{ fontSize: '15px' }}>
          <ArrowLeft size={16} /> Back to all articles
        </Link>
      </div>
    </div>
  );
};

export default BlogPost;
