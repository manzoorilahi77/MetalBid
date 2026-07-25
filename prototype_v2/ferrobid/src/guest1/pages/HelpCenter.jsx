import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LifeBuoy, Search, Rocket, Gavel, ShieldCheck, Wallet, Truck, Settings,
  FileText, ArrowRight, Star,
} from 'lucide-react';
import { PageHero, SectionHead, RevealGrid, Reveal, CTABand } from '../components/PageShell';

const CATEGORIES = [
  { icon: Rocket, title: 'Getting Started', count: 12, desc: 'Account setup, registration and first steps.' },
  { icon: Gavel, title: 'Bidding & Auctions', count: 18, desc: 'How live and forward auctions work.' },
  { icon: ShieldCheck, title: 'KYC & Verification', count: 9, desc: 'Documents, timelines and approvals.' },
  { icon: Wallet, title: 'Payments & EMD', count: 14, desc: 'Deposits, settlement and refunds.' },
  { icon: Truck, title: 'Delivery & Logistics', count: 8, desc: 'Lifting, transport and tracking.' },
  { icon: Settings, title: 'Account & Security', count: 11, desc: 'Profile, roles and login security.' },
];

const POPULAR = [
  'How do I complete buyer KYC verification?',
  'What is EMD and how is it refunded?',
  'How does auto-extension work in live auctions?',
  'When is the balance payment due after winning?',
  'How do I arrange lifting and logistics?',
];

export const HelpCenter = () => {
  const [query, setQuery] = useState('');
  const cats = useMemo(
    () => (query.trim() ? CATEGORIES.filter((c) => (c.title + c.desc).toLowerCase().includes(query.toLowerCase())) : CATEGORIES),
    [query]
  );

  return (
    <div className="ent-page">
      <PageHero
        eyebrow="Help Center"
        eyebrowIcon={LifeBuoy}
        title={<>How can we <span className="accent">help you today?</span></>}
        subtitle="Search our knowledge base, browse support categories, or connect with a specialist. Everything you need to trade with confidence."
        breadcrumb={[{ label: 'Resources' }, { label: 'Help Center' }]}
      />

      <section className="ent-section">
        <div className="container">
          <div className="ent-search" style={{ margin: '0 auto 34px' }}>
            <Search size={18} />
            <input
              type="text"
              placeholder="Search for help — bidding, KYC, payments…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search the help center"
            />
          </div>

          <SectionHead eyebrow="Browse by topic" title="Support categories" />
          <RevealGrid className="ent-grid cols-3">
            {cats.map((c) => {
              const Icon = c.icon;
              return (
                <Reveal key={c.title}>
                  <Link to="/faqs" className="ent-card" style={{ display: 'block', textDecoration: 'none' }}>
                    <div className="ent-card-icon"><Icon size={22} /></div>
                    <h3>{c.title}</h3>
                    <p>{c.desc}</p>
                    <p style={{ marginTop: '10px', color: 'var(--primary)', fontWeight: 700, fontSize: '12.5px' }}>
                      {c.count} articles <ArrowRight size={13} style={{ verticalAlign: 'middle' }} />
                    </p>
                  </Link>
                </Reveal>
              );
            })}
          </RevealGrid>
        </div>
      </section>

      <section className="ent-section alt">
        <div className="container">
          <div className="ent-split">
            <div>
              <SectionHead eyebrow="Most read" title="Popular articles" />
              <div className="ent-steps">
                {POPULAR.map((p, i) => (
                  <Link key={p} to="/faqs" className="ent-job" style={{ textDecoration: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div className="ent-card-icon" style={{ margin: 0, width: '38px', height: '38px' }}><Star size={16} /></div>
                      <h4 style={{ margin: 0 }}>{p}</h4>
                    </div>
                    <ArrowRight size={16} style={{ color: 'var(--primary)' }} />
                  </Link>
                ))}
              </div>
            </div>

            <aside className="ent-aside-sticky">
              <div className="ent-card">
                <div className="ent-card-icon"><FileText size={22} /></div>
                <h3>Prefer documentation?</h3>
                <p>Step-by-step guides, tutorials and downloads for buyers and sellers.</p>
                <Link to="/knowledge-center" className="ent-article-link">Open Knowledge Center <ArrowRight size={14} /></Link>
              </div>
              <div className="ent-card" style={{ marginTop: '16px' }}>
                <div className="ent-card-icon"><LifeBuoy size={22} /></div>
                <h3>Talk to support</h3>
                <p>Our team is available Mon–Sat, 9 AM–8 PM IST for anything you can't find here.</p>
                <Link to="/contact" className="ent-article-link">Contact support <ArrowRight size={14} /></Link>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <CTABand
        title="Can't find an answer?"
        text="Raise a ticket and our specialists will get back to you within one business day."
        primary={{ label: 'Contact support', to: '/contact' }}
        secondary={{ label: 'Read FAQs', to: '/faqs' }}
      />
    </div>
  );
};

export default HelpCenter;
