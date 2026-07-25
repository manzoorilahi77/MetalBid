import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3, TrendingUp, TrendingDown, Download, FileText, ArrowRight,
  LineChart, Factory, Globe2,
} from 'lucide-react';
import { Sparkline } from '../components/Sparkline';
import { PageHero, SectionHead, RevealGrid, Reveal, CTABand } from '../components/PageShell';

const COMMODITIES = [
  { name: 'Steel HRC', price: '₹52,400 /MT', chg: '+2.4%', dir: 'up', trend: [4, 5, 4.6, 6, 5.5, 6.4, 7] },
  { name: 'Copper (Millberry)', price: '₹7,23,000 /MT', chg: '+3.1%', dir: 'up', trend: [5, 5.2, 5.8, 5.5, 6.3, 6.8, 7.4] },
  { name: 'Aluminium Ingot', price: '₹1,99,800 /MT', chg: '+0.9%', dir: 'up', trend: [4, 4.4, 4.2, 4.8, 5, 5.3, 5.6] },
  { name: 'HMS 80:20', price: '₹34,000 /MT', chg: '-0.4%', dir: 'down', trend: [6, 5.6, 5.8, 5.2, 5, 4.7, 4.4] },
  { name: 'Zinc Dross', price: '₹2,10,000 /MT', chg: '+1.2%', dir: 'up', trend: [3, 3.4, 3.2, 3.8, 4, 4.3, 4.6] },
  { name: 'Lead Scrap', price: '₹1,45,000 /MT', chg: '-0.6%', dir: 'down', trend: [5, 4.8, 4.9, 4.6, 4.3, 4.2, 4] },
];

const INSIGHTS = [
  { icon: TrendingUp, title: 'Ferrous demand firming up', desc: 'Construction and infrastructure spend is lifting HRC and structural steel demand into Q3.' },
  { icon: Globe2, title: 'Import parity narrows', desc: 'Domestic scrap pricing is closing the gap with landed import costs across western ports.' },
  { icon: Factory, title: 'Non-ferrous stays resilient', desc: 'Copper and aluminium continue to outperform on tight secondary supply.' },
];

const REPORTS = [
  { title: 'Monthly Ferrous Market Report — Jul 2026', type: 'Commodity', pages: 24, size: '2.1 MB' },
  { title: 'Non-Ferrous Price Outlook Q3 2026', type: 'Outlook', pages: 18, size: '1.6 MB' },
  { title: 'India Scrap Demand Index — H1 2026', type: 'Industry', pages: 32, size: '3.4 MB' },
  { title: 'Logistics & Freight Cost Review', type: 'Analysis', pages: 14, size: '1.2 MB' },
];

const PERIODS = ['1M', '3M', '6M', '1Y'];

export const MarketReports = () => {
  const [period, setPeriod] = useState('3M');

  return (
    <div className="ent-page">
      <PageHero
        eyebrow="Market Reports"
        eyebrowIcon={BarChart3}
        title={<>Data-driven <span className="accent">market intelligence</span></>}
        subtitle="Commodity pricing, demand indices and industry analysis — curated by the FerroBid research desk to help you time the market."
        breadcrumb={[{ label: 'Resources' }, { label: 'Market Reports' }]}
      />

      {/* Commodity snapshot with charts */}
      <section className="ent-section">
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <SectionHead eyebrow="Live snapshot" title="Commodity price trends" subtitle="Indicative pricing across key ferrous and non-ferrous grades." />
            <div className="ent-pills" style={{ marginBottom: '34px' }}>
              {PERIODS.map((p) => (
                <button key={p} className={`ent-pill ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>{p}</button>
              ))}
            </div>
          </div>
          <RevealGrid className="ent-grid cols-3">
            {COMMODITIES.map((c) => (
              <Reveal key={c.name}>
                <div className="ent-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                  <div>
                    <h3 style={{ marginBottom: '4px' }}>{c.name}</h3>
                    <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--dark)', fontSize: '14px' }}>{c.price}</p>
                    <p style={{ marginTop: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700, fontSize: '12.5px', color: c.dir === 'up' ? '#1e7f4f' : '#c73030' }}>
                      {c.dir === 'up' ? <TrendingUp size={13} /> : <TrendingDown size={13} />} {c.chg}
                    </p>
                  </div>
                  <Sparkline points={c.trend} width={80} height={40} color={c.dir === 'up' ? '#1e7f4f' : '#c73030'} />
                </div>
              </Reveal>
            ))}
          </RevealGrid>
        </div>
      </section>

      {/* Market insights */}
      <section className="ent-section alt">
        <div className="container">
          <SectionHead eyebrow="Market insights" title="What our research desk is watching" />
          <RevealGrid className="ent-grid cols-3">
            {INSIGHTS.map((i) => {
              const Icon = i.icon;
              return (
                <Reveal key={i.title}>
                  <div className="ent-card">
                    <div className="ent-card-icon"><Icon size={22} /></div>
                    <h3>{i.title}</h3>
                    <p>{i.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </RevealGrid>
        </div>
      </section>

      {/* Downloadable reports */}
      <section className="ent-section">
        <div className="container">
          <SectionHead eyebrow="Downloads" title="Published reports" subtitle="Full research reports available to registered members." />
          <div className="ent-steps">
            {REPORTS.map((r) => (
              <div className="ent-job" key={r.title}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div className="ent-card-icon" style={{ margin: 0 }}><FileText size={20} /></div>
                  <div>
                    <h4>{r.title}</h4>
                    <div className="ent-job-meta">
                      <span className="ent-tag">{r.type}</span>
                      <span>{r.pages} pages</span>
                      <span>PDF · {r.size}</span>
                    </div>
                  </div>
                </div>
                <button className="btn btn-outline-primary btn-sm">
                  <Download size={14} style={{ marginRight: '6px' }} /> Download
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTABand
        title="Want deeper market intelligence?"
        text="Subscribers unlock live pricing, full reports and the FerroBid Composite Index dashboard."
        primary={{ label: 'View plans', to: '/pricing' }}
        secondary={{ label: 'Explore marketplace', to: '/marketplace' }}
      />
    </div>
  );
};

export default MarketReports;
