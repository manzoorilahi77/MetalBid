import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, Search, FileText, GraduationCap, Download, PlayCircle,
  Gavel, ShieldCheck, Wallet, Truck, ArrowRight, Star,
} from 'lucide-react';
import { PageHero, SectionHead, RevealGrid, Reveal, CTABand } from '../components/PageShell';

const DOCS = [
  { icon: Gavel, title: 'Auction Rules & Formats', desc: 'Forward, reverse and sealed-bid auction mechanics explained.' },
  { icon: ShieldCheck, title: 'KYC & Onboarding', desc: 'Document checklists and verification workflows for buyers and sellers.' },
  { icon: Wallet, title: 'Payments & Settlement', desc: 'EMD, escrow, invoicing and refund policies in detail.' },
  { icon: Truck, title: 'Logistics & Lifting', desc: 'Delivery options, timelines and pan-India logistics support.' },
];

const GUIDES = [
  { title: 'Getting started as a buyer', tag: 'Buyer', read: '8 min' },
  { title: 'Listing your first lot as a seller', tag: 'Seller', read: '10 min' },
  { title: 'Winning strategies for live auctions', tag: 'Buyer', read: '6 min' },
  { title: 'Preparing inspection-ready documentation', tag: 'Seller', read: '7 min' },
];

const DOWNLOADS = [
  { title: 'Buyer onboarding checklist (PDF)', size: '240 KB' },
  { title: 'Seller lot submission template (XLSX)', size: '85 KB' },
  { title: 'EMD & settlement policy (PDF)', size: '310 KB' },
  { title: 'Platform terms summary (PDF)', size: '190 KB' },
];

const TUTORIALS = [
  { title: 'Placing your first bid', len: '3:20' },
  { title: 'Completing KYC verification', len: '4:45' },
  { title: 'Tracking a won lot to delivery', len: '5:10' },
];

export const KnowledgeCenter = () => {
  const [query, setQuery] = useState('');
  const docs = useMemo(
    () => (query.trim() ? DOCS.filter((d) => (d.title + d.desc).toLowerCase().includes(query.toLowerCase())) : DOCS),
    [query]
  );

  return (
    <div className="ent-page">
      <PageHero
        eyebrow="Knowledge Center"
        eyebrowIcon={BookOpen}
        title={<>Everything you need to <span className="accent">trade with confidence</span></>}
        subtitle="Documentation, step-by-step guides, downloadable templates and video tutorials for buyers and sellers."
        breadcrumb={[{ label: 'Resources' }, { label: 'Knowledge Center' }]}
      />

      {/* Search + documentation */}
      <section className="ent-section">
        <div className="container">
          <div className="ent-search" style={{ margin: '0 auto 34px' }}>
            <Search size={18} />
            <input type="text" placeholder="Search documentation, guides and downloads…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search the knowledge center" />
          </div>

          <SectionHead eyebrow="Documentation" title="Browse the docs" />
          <RevealGrid className="ent-grid cols-4">
            {docs.map((d) => {
              const Icon = d.icon;
              return (
                <Reveal key={d.title}>
                  <Link to="/faqs" className="ent-card" style={{ display: 'block', textDecoration: 'none' }}>
                    <div className="ent-card-icon"><Icon size={22} /></div>
                    <h3>{d.title}</h3>
                    <p>{d.desc}</p>
                  </Link>
                </Reveal>
              );
            })}
          </RevealGrid>
        </div>
      </section>

      {/* Guides + downloads */}
      <section className="ent-section alt">
        <div className="container">
          <div className="ent-split">
            <div>
              <SectionHead eyebrow="Guides" title="Step-by-step guides" />
              <div className="ent-steps">
                {GUIDES.map((g) => (
                  <Link key={g.title} to="/faqs" className="ent-job" style={{ textDecoration: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div className="ent-card-icon" style={{ margin: 0, width: '38px', height: '38px' }}><GraduationCap size={16} /></div>
                      <div>
                        <h4 style={{ margin: 0 }}>{g.title}</h4>
                        <div className="ent-job-meta" style={{ marginTop: '4px' }}><span className="ent-tag">{g.tag}</span><span>{g.read} read</span></div>
                      </div>
                    </div>
                    <ArrowRight size={16} style={{ color: 'var(--primary)' }} />
                  </Link>
                ))}
              </div>
            </div>

            <aside className="ent-aside-sticky">
              <div className="ent-card">
                <div className="ent-card-icon"><Download size={22} /></div>
                <h3>Downloads</h3>
                <div style={{ display: 'grid', gap: '10px', marginTop: '10px' }}>
                  {DOWNLOADS.map((d) => (
                    <a key={d.title} href="#" onClick={(e) => e.preventDefault()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', fontSize: '13px', color: 'var(--dark)', textDecoration: 'none', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={14} style={{ color: 'var(--primary)' }} /> {d.title}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', whiteSpace: 'nowrap' }}>{d.size}</span>
                    </a>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Tutorials */}
      <section className="ent-section">
        <div className="container">
          <SectionHead eyebrow="Video tutorials" title="Watch and learn" />
          <RevealGrid className="ent-grid cols-3">
            {TUTORIALS.map((t) => (
              <Reveal key={t.title}>
                <div className="ent-article-card">
                  <div className="ent-article-thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PlayCircle size={48} style={{ color: 'var(--primary)' }} />
                    <span className="ent-article-tag">{t.len}</span>
                  </div>
                  <div className="ent-article-body">
                    <h3>{t.title}</h3>
                    <span className="ent-article-link">Watch tutorial <ArrowRight size={14} /></span>
                  </div>
                </div>
              </Reveal>
            ))}
          </RevealGrid>
        </div>
      </section>

      <CTABand
        title="Need something more specific?"
        text="Our support team can point you to the right resource or walk you through any process."
        primary={{ label: 'Contact support', to: '/contact' }}
        secondary={{ label: 'Browse FAQs', to: '/faqs' }}
      />
    </div>
  );
};

export default KnowledgeCenter;
