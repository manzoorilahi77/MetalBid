/* ---------------------------------------------------------------------------
   Market Reports

   The old page showed six prices with no date, no unit basis, no source and no
   method — and four "download" buttons that did nothing. A price with no basis
   is not market intelligence; it is decoration.

   The rebuild states the basis on every figure (ex-yard, per MT, GST exclusive,
   as of a stated date), shows the bid–ask spread rather than a single number,
   carries regional differentials because Indian scrap prices are regional
   before they are national, and publishes the methodology so a reader can
   judge how much weight to put on any of it.
--------------------------------------------------------------------------- */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BarChart3, TrendingUp, TrendingDown, Minus, ChevronRight, Info,
  MapPin, Ruler, CalendarDays, Layers, FileText, Lock, Globe, Factory
} from 'lucide-react';
import { Sparkline } from '../components/Sparkline';
import '../styles/enterprise.css';
import '../styles/resources.css';

const AS_OF = '1 August 2026';

/* Prices are indicative, ex-yard, per metric tonne, exclusive of GST — stated
   once here and repeated on the table so no figure travels without its basis. */
const CATS = [
  { id: 'all', label: 'All' },
  { id: 'ferrous', label: 'Ferrous' },
  { id: 'nonferrous', label: 'Non-ferrous' },
  { id: 'stainless', label: 'Stainless' },
  { id: 'minor', label: 'Minor metals' }
];

const PRICES = [
  { cat: 'ferrous', name: 'HMS 80:20', low: 33200, high: 34800, chg: -0.4, trend: [6, 5.6, 5.8, 5.2, 5, 4.7, 4.4], basis: 'Ex-yard, Raipur' },
  { cat: 'ferrous', name: 'MS plate offcuts', low: 38500, high: 40200, chg: 1.1, trend: [4.2, 4.4, 4.3, 4.7, 4.9, 5.1, 5.4], basis: 'Ex-yard, Mumbai' },
  { cat: 'ferrous', name: 'CR coil secondary', low: 50800, high: 52400, chg: 2.4, trend: [4, 5, 4.6, 6, 5.5, 6.4, 7], basis: 'Ex-mill, Bhiwadi' },
  { cat: 'nonferrous', name: 'Copper millberry', low: 712000, high: 723000, chg: 3.1, trend: [5, 5.2, 5.8, 5.5, 6.3, 6.8, 7.4], basis: 'Ex-yard, Pune' },
  { cat: 'nonferrous', name: 'Aluminium ingot ADC-12', low: 196500, high: 199800, chg: 0.9, trend: [4, 4.4, 4.2, 4.8, 5, 5.3, 5.6], basis: 'Ex-works, Chennai' },
  { cat: 'nonferrous', name: 'Mixed Al extrusion', low: 168000, high: 174500, chg: 0.0, trend: [5, 5.05, 5, 5.1, 5.05, 5, 5.05], basis: 'Ex-yard, Chennai' },
  { cat: 'nonferrous', name: 'Brass borings & turnings', low: 402000, high: 415000, chg: 1.6, trend: [4.4, 4.5, 4.7, 4.6, 5, 5.2, 5.4], basis: 'Ex-yard, Ahmedabad' },
  { cat: 'stainless', name: 'SS 304 scrap', low: 128000, high: 134500, chg: -1.2, trend: [5.6, 5.5, 5.7, 5.3, 5.1, 4.9, 4.8], basis: 'Ex-yard, Ahmedabad' },
  { cat: 'minor', name: 'Zinc top dross', low: 204000, high: 210000, chg: 1.2, trend: [3, 3.4, 3.2, 3.8, 4, 4.3, 4.6], basis: 'Ex-works, Kolkata' },
  { cat: 'minor', name: 'Lead scrap (RSDL)', low: 141500, high: 145000, chg: -0.6, trend: [5, 4.8, 4.9, 4.6, 4.3, 4.2, 4], basis: 'Ex-yard, Raipur' }
];

/* Indian scrap is a regional market before it is a national one — the basis
   differential is often larger than a week of price movement. */
const REGIONS = [
  { region: 'Raipur / Chhattisgarh', driver: 'Sponge iron and induction furnace belt', diff: 'Benchmark', note: 'The reference market for ferrous melting grades.' },
  { region: 'Mumbai / Maharashtra', driver: 'Import parity via JNPT, strong fabrication demand', diff: '+₹600–1,200 /MT', note: 'Ferrous trades at a premium to Raipur on freight and demand.' },
  { region: 'Ahmedabad / Gujarat', driver: 'Alang recycling, stainless and non-ferrous concentration', diff: '−₹300–800 /MT', note: 'Deepest liquidity in stainless and mixed non-ferrous.' },
  { region: 'Chennai / Tamil Nadu', driver: 'Automotive and die-casting demand', diff: '+₹400–900 /MT', note: 'Aluminium alloy grades price above the national average.' },
  { region: 'Kolkata / East', driver: 'Zinc, lead and minor-metal processing', diff: '−₹200–600 /MT', note: 'Thinner ferrous liquidity; strongest for minor metals.' }
];

const INSIGHTS = [
  { icon: TrendingUp, title: 'Ferrous demand firming into Q3', text: 'Construction and infrastructure release is lifting structural and HRC demand. Melting grades have held despite a soft week on HMS.' },
  { icon: Globe, title: 'Import parity is narrowing', text: 'Domestic scrap is closing the gap with landed import cost at western ports, which historically pulls domestic pricing up rather than imports down.' },
  { icon: Factory, title: 'Non-ferrous stays resilient', text: 'Copper and aluminium continue to outperform on tight secondary supply. Millberry availability remains the binding constraint, not demand.' }
];

const REPORTS = [
  { title: 'Monthly Ferrous Market Report', period: 'July 2026', type: 'Commodity', pages: 24, note: 'Grade-wise price movement, regional spreads and furnace demand commentary.' },
  { title: 'Non-Ferrous Price Outlook', period: 'Q3 2026', type: 'Outlook', pages: 18, note: 'Copper, aluminium and brass — supply constraints and LME linkage.' },
  { title: 'India Scrap Demand Index', period: 'H1 2026', type: 'Industry', pages: 32, note: 'Consumption by sector, with import substitution and capacity additions.' },
  { title: 'Logistics & Freight Cost Review', period: 'July 2026', type: 'Analysis', pages: 14, note: 'Road freight per tonne-km by corridor, and its effect on realised yard prices.' }
];

const inr = n => `₹${n.toLocaleString('en-IN')}`;

export const MarketReports = () => {
  const reduceMotion = useReducedMotion();
  const [cat, setCat] = useState('all');

  const rows = useMemo(
    () => (cat === 'all' ? PRICES : PRICES.filter(p => p.cat === cat)),
    [cat]
  );

  const counts = useMemo(() => {
    const map = { all: PRICES.length };
    for (const p of PRICES) map[p.cat] = (map[p.cat] || 0) + 1;
    return map;
  }, []);

  const reveal = reduceMotion ? {} : {
    initial: { y: 18 },
    whileInView: { y: 0 },
    viewport: { once: true, amount: 0.1 },
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
  };

  const stagger = i => (reduceMotion ? {} : {
    initial: { y: 20 },
    whileInView: { y: 0 },
    viewport: { once: true, amount: 0.15 },
    transition: { duration: 0.5, delay: Math.min(i, 4) * 0.07, ease: [0.16, 1, 0.3, 1] }
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
            <span className="crumb-current" aria-current="page">Market Reports</span>
          </nav>

          <div className="res-hero-inner">
            <p className="ent-hero-eyebrow"><BarChart3 size={13} aria-hidden="true" /> Market Reports</p>
            <h1 className="res-hero-title">Prices, with the basis attached.</h1>
            <p className="res-hero-lead">
              A number without a basis is not a price. Everything below states its grade, its
              location, its date and its spread — and the method that produced it is published at
              the foot of the page, so you can judge how much weight it deserves.
            </p>

            <ul className="res-facts">
              <li>
                <p className="res-fact-label"><CalendarDays size={12} aria-hidden="true" />As of</p>
                <p className="res-fact-value">{AS_OF}</p>
              </li>
              <li>
                <p className="res-fact-label"><Ruler size={12} aria-hidden="true" />Basis</p>
                <p className="res-fact-value">Ex-yard · per MT</p>
              </li>
              <li>
                <p className="res-fact-label"><Layers size={12} aria-hidden="true" />Grades tracked</p>
                <p className="res-fact-value">{PRICES.length}</p>
              </li>
              <li>
                <p className="res-fact-label"><MapPin size={12} aria-hidden="true" />Regions</p>
                <p className="res-fact-value">{REGIONS.length} benchmarked</p>
              </li>
            </ul>
          </div>
        </div>
      </header>

      {/* ─── Price table ─── */}
      <section className="ent-section">
        <div className="container">
          <motion.div className="sec-head" {...reveal}>
            <p className="sec-eyebrow">Indicative pricing</p>
            <h2 className="sec-title">Where the grades are trading this week.</h2>
            <p className="sec-lead">
              Shown as a range, not a point — the spread between a workable bid and a workable ask is
              the part that tells you how liquid a grade actually is.
            </p>
          </motion.div>

          <div className="res-pills">
            {CATS.map(c => (
              <button
                key={c.id}
                type="button"
                className={`res-pill${cat === c.id ? ' is-active' : ''}`}
                onClick={() => setCat(c.id)}
                aria-pressed={cat === c.id}
              >
                {c.label}
                <span className="res-pill-count">{counts[c.id] || 0}</span>
              </button>
            ))}
          </div>

          <motion.div className="res-table-wrap" {...reveal}>
            <table className="res-table">
              <thead>
                <tr>
                  <th scope="col">Grade</th>
                  <th scope="col">Low</th>
                  <th scope="col">High</th>
                  <th scope="col">Spread</th>
                  <th scope="col">Week</th>
                  <th scope="col">Trend</th>
                  <th scope="col">Basis</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(p => {
                  const spread = ((p.high - p.low) / p.low) * 100;
                  const flat = Math.abs(p.chg) < 0.05;
                  const up = p.chg > 0;
                  const colour = flat ? 'var(--text-muted)' : up ? '#1e7f4f' : '#c73030';
                  const Arrow = flat ? Minus : up ? TrendingUp : TrendingDown;
                  return (
                    <tr key={p.name}>
                      <th scope="row">{p.name}</th>
                      <td className="num">{inr(p.low)}</td>
                      <td className="num">{inr(p.high)}</td>
                      <td className="num">{spread.toFixed(1)}%</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 700, fontSize: '12.5px', color: colour, fontVariantNumeric: 'tabular-nums' }}>
                          <Arrow size={13} strokeWidth={2.25} aria-hidden="true" />
                          {flat ? 'flat' : `${up ? '+' : ''}${p.chg.toFixed(1)}%`}
                        </span>
                      </td>
                      <td>
                        <Sparkline points={p.trend} width={72} height={26} color={flat ? '#9c948c' : up ? '#1e7f4f' : '#c73030'} />
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{p.basis}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </motion.div>

          <div className="res-note">
            <span className="res-note-icon"><Info size={15} strokeWidth={2} aria-hidden="true" /></span>
            <p>
              <strong>Indicative only.</strong> Figures are per metric tonne, ex-yard, exclusive of GST,
              as of {AS_OF}. They are a reference for orientation — not a quote, not an offer, and not a
              substitute for the reserve or bid on any specific lot. Realised prices depend on grade
              preparation, quantity, location and lifting terms.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Regional differentials ─── */}
      <section className="ent-section alt">
        <div className="container">
          <motion.div className="sec-head" {...reveal}>
            <p className="sec-eyebrow">Regional basis</p>
            <h2 className="sec-title">The same grade is not the same price.</h2>
            <p className="sec-lead">
              Indian scrap is a regional market before it is a national one. The differential between
              two yards is routinely larger than a week of price movement — which is why the location
              on a lot matters as much as the grade.
            </p>
          </motion.div>

          <motion.div className="res-table-wrap" {...reveal}>
            <table className="res-table">
              <thead>
                <tr>
                  <th scope="col">Region</th>
                  <th scope="col">What drives it</th>
                  <th scope="col">Ferrous differential</th>
                  <th scope="col">Note</th>
                </tr>
              </thead>
              <tbody>
                {REGIONS.map(r => (
                  <tr key={r.region}>
                    <th scope="row">{r.region}</th>
                    <td>{r.driver}</td>
                    <td><span className="res-chip is-ferrous">{r.diff}</span></td>
                    <td>{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>

      {/* ─── Desk commentary ─── */}
      <section className="ent-section">
        <div className="container">
          <motion.div className="sec-head" {...reveal}>
            <p className="sec-eyebrow">Research desk</p>
            <h2 className="sec-title">What we are watching this month.</h2>
          </motion.div>

          <div className="res-grid cols-3">
            {INSIGHTS.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.article className="res-card" key={item.title} {...stagger(i)}>
                  <span className="res-card-icon"><Icon size={17} strokeWidth={1.9} /></span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Methodology (dark band) ─── */}
      <section className="res-band">
        <div className="container">
          <motion.div className="sec-head" {...reveal}>
            <p className="sec-eyebrow">Methodology</p>
            <h2 className="sec-title">How these numbers are produced.</h2>
            <p className="sec-lead">
              Published so you can discount it appropriately. A price series whose method is secret
              should be treated as marketing, including ours.
            </p>
          </motion.div>

          <div className="res-grid cols-3">
            {[
              { icon: Layers, title: 'Settled lots first', text: 'The primary input is lots actually settled on the platform in the trailing seven days, weighted by tonnage. Bids that never settled are excluded.' },
              { icon: Globe, title: 'Cross-checked externally', text: 'Non-ferrous series are sanity-checked against LME movement adjusted for the domestic premium. Divergence beyond the usual band is flagged, not smoothed away.' },
              { icon: Ruler, title: 'Ranges, not points', text: 'Where fewer than five lots settled in a grade, the range widens rather than the midpoint being asserted. A wide spread is information, not a defect.' }
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.article className="res-band-card" key={item.title} {...stagger(i)}>
                  <span className="res-band-icon"><Icon size={17} strokeWidth={1.9} /></span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </motion.article>
              );
            })}
          </div>

          <p className="res-band-note">
            Limitations worth knowing: thin grades move on very few trades; regional differentials are
            estimated from settled lots and freight, not surveyed; and nothing here anticipates policy,
            duty or exchange-rate changes. Treat it as orientation, not as a basis for pricing a contract.
          </p>
        </div>
      </section>

      {/* ─── Report library ─── */}
      <section className="ent-section">
        <div className="container">
          <motion.div className="sec-head" {...reveal}>
            <p className="sec-eyebrow">Report library</p>
            <h2 className="sec-title">Longer-form research.</h2>
            <p className="sec-lead">
              Full reports are available to registered members. Each states its own data window and
              method on the first page.
            </p>
          </motion.div>

          <div className="res-rows">
            {REPORTS.map((r, i) => (
              <motion.div className="res-row" key={r.title} {...stagger(i)}>
                <span className="res-row-icon"><FileText size={16} strokeWidth={1.9} /></span>
                <div className="res-row-body">
                  <p className="res-row-title">{r.title} — {r.period}</p>
                  <p className="res-row-desc">{r.note}</p>
                  <div className="res-row-meta">
                    <span className="res-chip">{r.type}</span>
                    <span className="res-chip">{r.pages} pages</span>
                    <span className="res-chip">PDF</span>
                  </div>
                </div>
                <Link
                  to="/auth"
                  className="res-card-foot"
                  style={{ flex: 'none', marginTop: 0, textDecoration: 'none', whiteSpace: 'nowrap' }}
                >
                  <Lock size={13} strokeWidth={2.25} aria-hidden="true" />
                  Sign in to read
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Where next ─── */}
      <section className="ent-section alt">
        <div className="container">
          <div className="res-grid cols-3">
            <Link to="/marketplace" className="res-card">
              <span className="res-card-icon"><Layers size={17} strokeWidth={1.9} /></span>
              <h3>See what is live now</h3>
              <p>The grades above, on real lots with inspection reports and closing times.</p>
              <span className="res-card-foot">Browse the marketplace <ChevronRight size={13} strokeWidth={2.5} /></span>
            </Link>
            <Link to="/knowledge-center" className="res-card">
              <span className="res-card-icon"><Ruler size={17} strokeWidth={1.9} /></span>
              <h3>Decode the grades</h3>
              <p>What HMS 80:20 and millberry actually mean, and what to check at inspection.</p>
              <span className="res-card-foot">Grade reference <ChevronRight size={13} strokeWidth={2.5} /></span>
            </Link>
            <Link to="/pricing" className="res-card">
              <span className="res-card-icon"><BarChart3 size={17} strokeWidth={1.9} /></span>
              <h3>Unlock live pricing</h3>
              <p>Subscribers see live bid values, full reports and the composite index dashboard.</p>
              <span className="res-card-foot">View plans <ChevronRight size={13} strokeWidth={2.5} /></span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MarketReports;
