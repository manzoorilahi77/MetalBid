/* ---------------------------------------------------------------------------
   LegalDoc — the shared shell behind Terms & Conditions and Privacy Policy.

   Legal pages fail for one reason: nobody can find the clause that applies to
   them. So the shell is built around navigation rather than decoration — a
   scroll-spy contents rail, a reading-progress bar, deep-linkable sections,
   and a plain-language summary at the head of every clause. The page files
   supply nothing but content; everything structural lives here.

   Motion rule, inherited from the About page: reveals animate transforms only,
   never opacity. If an intersection callback never fires, a section is still
   fully readable — just a few pixels low. Nothing here is gated behind an
   animation running.
--------------------------------------------------------------------------- */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, useScroll, useSpring, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ChevronRight, Check, Info, AlertTriangle, ShieldCheck,
  ArrowUp, Link2, Clock, FileText, CalendarDays
} from 'lucide-react';
/* Both stylesheets, in this order: the shell reuses the enterprise page
   chrome (.ent-page, .ent-breadcrumb, .ent-hero-eyebrow) and support.css
   layers the document-specific pieces on top of it. */
import '../styles/enterprise.css';
import '../styles/support.css';

/* ─── Reading progress ─────────────────────────────────────────────────── */
export const ReadingProgress = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 180, damping: 34, mass: 0.28 });
  return <motion.div className="doc-progress" style={{ scaleX }} aria-hidden="true" />;
};

/* ─── Block renderer ───────────────────────────────────────────────────────
   A clause is a list of blocks rather than free-form JSX so both documents
   render identically and a table never turns into a wall of prose on one page
   and a real table on the other. */
const Block = ({ block }) => {
  switch (block.type) {
    case 'p':
      return <p className="doc-p">{block.text}</p>;

    case 'list':
      return (
        /* The content is wrapped: an item is often a fragment of `<strong>`
           plus prose, and without the wrapper each becomes its own flex child
           and the lead-in stacks into a column of its own. */
        <ul className="doc-list">
          {block.items.map((item, i) => (
            <li key={i}>
              <Check size={14} strokeWidth={2.75} aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );

    case 'steps':
      return (
        <ol className="doc-steps">
          {block.items.map((item, i) => (
            <li key={i}>
              <span className="doc-step-n">{String(i + 1).padStart(2, '0')}</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      );

    /* Definition pairs — "Term: meaning" rows. Reads far better than a
       paragraph that buries six definitions in one sentence. */
    case 'kv':
      return (
        <dl className="doc-kv">
          {block.items.map(item => (
            <div className="doc-kv-row" key={item.k}>
              <dt>{item.k}</dt>
              <dd>{item.v}</dd>
            </div>
          ))}
        </dl>
      );

    case 'table':
      return (
        <div className="doc-table-wrap">
          <table className="doc-table">
            <thead>
              <tr>{block.head.map(h => <th key={h} scope="col">{h}</th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    j === 0
                      ? <th key={j} scope="row">{cell}</th>
                      : <td key={j} data-label={block.head[j]}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'callout': {
      const icons = { info: Info, warn: AlertTriangle, good: ShieldCheck };
      const Icon = icons[block.tone] || Info;
      return (
        <aside className={`doc-callout is-${block.tone || 'info'}`}>
          <span className="doc-callout-icon"><Icon size={16} strokeWidth={2} /></span>
          <div>
            {block.title && <p className="doc-callout-title">{block.title}</p>}
            <p className="doc-callout-text">{block.text}</p>
          </div>
        </aside>
      );
    }

    default:
      return null;
  }
};

/* ─── One clause ───────────────────────────────────────────────────────────
   The plain-language line sits above the legal text, not below it: a reader
   scanning for the clause that affects them should be able to decide from the
   summary whether to read the rest. */
const Clause = ({ section, index, onRegister, reduceMotion }) => {
  const ref = useRef(null);
  const [copied, setCopied] = useState(false);
  const Icon = section.icon;

  useEffect(() => onRegister(section.id, ref.current), [section.id, onRegister]);

  const copyLink = useCallback(() => {
    const url = `${window.location.href.split('#').slice(0, 2).join('#')}#${section.id}`;
    const done = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(done);
    } else {
      done();
    }
  }, [section.id]);

  const reveal = reduceMotion ? {} : {
    initial: { y: 18 },
    whileInView: { y: 0 },
    viewport: { once: true, amount: 0.06 },
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
  };

  return (
    <motion.section className="doc-clause" id={section.id} ref={ref} {...reveal}>
      <header className="doc-clause-head">
        <span className="doc-clause-icon">
          <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
        </span>
        <div className="doc-clause-heading">
          <p className="doc-clause-num">Section {String(index + 1).padStart(2, '0')}</p>
          <h2>{section.title}</h2>
        </div>
        <button
          type="button"
          className={`doc-anchor${copied ? ' is-copied' : ''}`}
          onClick={copyLink}
          aria-label={`Copy link to “${section.title}”`}
        >
          {copied ? <Check size={14} strokeWidth={2.5} /> : <Link2 size={14} strokeWidth={2} />}
          <span>{copied ? 'Copied' : 'Link'}</span>
        </button>
      </header>

      {section.plain && (
        <div className="doc-plain">
          <p className="doc-plain-label">In plain English</p>
          <p className="doc-plain-text">{section.plain}</p>
        </div>
      )}

      <div className="doc-clause-body">
        {section.blocks.map((block, i) => <Block key={i} block={block} />)}
      </div>
    </motion.section>
  );
};

/* ─── The shell ─────────────────────────────────────────────────────────── */
export const LegalDoc = ({ eyebrow, eyebrowIcon: HeroIcon, title, lead, meta, sections, related }) => {
  const reduceMotion = useReducedMotion();
  const [activeId, setActiveId] = useState(sections[0]?.id);
  const [showTop, setShowTop] = useState(false);
  const nodes = useRef(new Map());

  const register = useCallback((id, node) => {
    if (node) nodes.current.set(id, node);
    return () => nodes.current.delete(id);
  }, []);

  /* Scroll-spy. Purely navigational: if this never runs, the rail simply keeps
     the first item marked and every link still works. */
  useEffect(() => {
    const onScroll = () => {
      setShowTop(window.scrollY > 700);
      const line = window.innerHeight * 0.28;
      let current = sections[0]?.id;
      for (const [id, node] of nodes.current) {
        if (node && node.getBoundingClientRect().top <= line) current = id;
      }
      setActiveId(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [sections]);

  const jump = useCallback(id => {
    const node = nodes.current.get(id);
    if (!node) return;
    const top = node.getBoundingClientRect().top + window.scrollY - 92;
    window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [reduceMotion]);

  /* Deep links (…#/home/privacy#data-we-collect) land on the clause rather
     than the top of the document. */
  useEffect(() => {
    const target = window.location.hash.split('#')[2];
    if (!target) return;
    const timer = window.setTimeout(() => jump(target), 260);
    return () => window.clearTimeout(timer);
  }, [jump]);

  return (
    <div className="ent-page doc-page">
      <ReadingProgress />

      {/* ─── Hero ─── */}
      <header className="doc-hero">
        <div className="container">
          <nav className="ent-breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <ChevronRight size={13} aria-hidden="true" />
            <span>Support</span>
            <ChevronRight size={13} aria-hidden="true" />
            <span className="crumb-current" aria-current="page">{eyebrow}</span>
          </nav>

          <div className="doc-hero-inner">
            <p className="ent-hero-eyebrow">
              {HeroIcon && <HeroIcon size={13} aria-hidden="true" />} {eyebrow}
            </p>
            <h1 className="doc-hero-title">{title}</h1>
            <p className="doc-hero-lead">{lead}</p>

            {/* Document metadata as data, not a footnote: version, dates and
                length are the first things a reader checks on a policy. */}
            <dl className="doc-meta">
              <div>
                <dt><FileText size={13} aria-hidden="true" />Version</dt>
                <dd>{meta.version}</dd>
              </div>
              <div>
                <dt><CalendarDays size={13} aria-hidden="true" />Effective</dt>
                <dd>{meta.effective}</dd>
              </div>
              <div>
                <dt><CalendarDays size={13} aria-hidden="true" />Last updated</dt>
                <dd>{meta.updated}</dd>
              </div>
              <div>
                <dt><Clock size={13} aria-hidden="true" />Reading time</dt>
                <dd>{meta.readingTime}</dd>
              </div>
            </dl>
          </div>
        </div>
      </header>

      {/* ─── Contents rail + document ─── */}
      <div className="container">
        <div className="doc-shell">
          <aside className="doc-rail" aria-label="On this page">
            <div className="doc-rail-inner">
              <p className="doc-rail-title">On this page</p>
              <ol className="doc-rail-list">
                {sections.map((section, i) => {
                  const on = section.id === activeId;
                  return (
                    <li key={section.id}>
                      <button
                        type="button"
                        className={`doc-rail-link${on ? ' is-active' : ''}`}
                        onClick={() => jump(section.id)}
                        aria-current={on ? 'true' : undefined}
                      >
                        {/* One shared marker that slides between entries,
                            rather than five that fade in and out. */}
                        {on && !reduceMotion && (
                          <motion.span
                            className="doc-rail-marker"
                            layoutId="doc-rail-marker"
                            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                          />
                        )}
                        {on && reduceMotion && <span className="doc-rail-marker" />}
                        <span className="doc-rail-num">{String(i + 1).padStart(2, '0')}</span>
                        <span className="doc-rail-label">{section.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>

              {related?.length > 0 && (
                <div className="doc-rail-related">
                  <p className="doc-rail-title">Related</p>
                  {related.map(item => (
                    <Link key={item.to} to={item.to} className="doc-rail-related-link">
                      {item.label}
                      <ChevronRight size={13} strokeWidth={2.25} aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </aside>

          <main className="doc-body">
            {sections.map((section, i) => (
              <Clause
                key={section.id}
                section={section}
                index={i}
                onRegister={register}
                reduceMotion={reduceMotion}
              />
            ))}
          </main>
        </div>
      </div>

      <button
        type="button"
        className={`doc-totop${showTop ? ' is-on' : ''}`}
        onClick={() => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })}
        aria-label="Back to top"
      >
        <ArrowUp size={17} strokeWidth={2.25} />
      </button>
    </div>
  );
};

export default LegalDoc;
