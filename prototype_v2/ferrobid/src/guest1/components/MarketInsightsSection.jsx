import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, ArrowRight, Activity, Users, Package, Percent, Gavel } from 'lucide-react';
import indiaMapData from '@svg-maps/india';
import { AnimatedStat } from './AnimatedStat';

// Benchmark prices a bidder checks before valuing a lot. Domestic ferrous
// grades in ₹/MT; non-ferrous in ₹/kg (MCX convention). In production these
// map to real feeds — LME/MCX for non-ferrous, domestic scrap indices
// (SteelMint / BigMint / Metal Junction) and mandi rates for ferrous.
const priceWatch = [
  { name: 'HMS 80:20', price: 34200, unit: '/MT', changePct: 2.4, dir: 'up', low: 33600, high: 34700 },
  { name: 'Shredded', price: 36900, unit: '/MT', changePct: 1.1, dir: 'up', low: 36400, high: 37250 },
  { name: 'Steel HRC', price: 52400, unit: '/MT', changePct: 0.8, dir: 'up', low: 51900, high: 52850 },
  { name: 'Copper', price: 742, unit: '/kg', changePct: 1.6, dir: 'up', low: 731, high: 748 },
  { name: 'Aluminium', price: 198, unit: '/kg', changePct: 0.5, dir: 'down', low: 196, high: 201 },
];

// FerroBid Scrap Index — the platform's own volume-weighted clearing price for
// ferrous lots (₹/MT). First-party data: the average price at which lots
// actually settled, so it reflects live auction demand, not a quoted rate.
const ranges = {
  '1D': { labels: ['9 AM', '12 PM', '3 PM', '6 PM', '9 PM'], prices: [36600, 36720, 36680, 36850, 36900] },
  '7D': { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], prices: [35800, 36100, 35950, 36400, 36250, 36800, 36900] },
  '3M': { labels: ['Apr 22', 'May 7', 'May 22', 'Jun 7', 'Jun 22', 'Jul 22'], prices: [34200, 34800, 34500, 35600, 35200, 36900] },
  '1Y': { labels: ['Sep', 'Nov', 'Jan', 'Mar', 'May', 'Jul'], prices: [31500, 32800, 32100, 34200, 35400, 36900] },
};

// Live lots by state — first-party bid activity. Colours a national demand map.
const stateLots = {
  mh: 312, gj: 268, tn: 214, ct: 188, wb: 176, jh: 142, or: 128, ka: 116,
  up: 104, rj: 88, pb: 82, tg: 76, mp: 71, hr: 64, ap: 58, kl: 44, dl: 52,
  br: 38, ut: 30, hp: 22, ga: 16, as: 14, jk: 18,
};
const DEFAULT_LOTS = 11;
const MAX_LOTS = 312;
const lotFill = (lots) => {
  const t = Math.min((lots || DEFAULT_LOTS) / MAX_LOTS, 1);
  const light = [246, 235, 224]; // pale ember tint
  const dark = [200, 68, 31];    // --color-ember-hover
  const c = light.map((l, i) => Math.round(l + (dark[i] - l) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};

const CHART_W = 320;
const CHART_H = 110;

const buildLinePath = (prices) => {
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const step = CHART_W / (prices.length - 1);
  const coords = prices.map((p, i) => [i * step, CHART_H - ((p - min) / range) * CHART_H]);
  const d = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${d} L ${CHART_W},${CHART_H} L 0,${CHART_H} Z`;
  return { line: d, area, coords };
};

export const MarketInsightsSection = () => {
  const [range, setRange] = useState('3M');
  const [chartHover, setChartHover] = useState(null);
  const [mapHover, setMapHover] = useState(null);
  const current = ranges[range];
  const { line, area, coords } = buildLinePath(current.prices);

  const last = current.prices[current.prices.length - 1];
  const first = current.prices[0];
  const changePct = ((last - first) / first) * 100;
  const dir = changePct >= 0 ? 'up' : 'down';

  const handleChartMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * CHART_W;
    let nearest = 0;
    let minDist = Infinity;
    coords.forEach(([x], i) => {
      const dist = Math.abs(x - svgX);
      if (dist < minDist) {
        minDist = dist;
        nearest = i;
      }
    });
    const [px, py] = coords[nearest];
    setChartHover({
      i: nearest,
      left: (px / CHART_W) * rect.width,
      top: (py / CHART_H) * rect.height,
    });
  };

  return (
    <section className="market-insights-section">
      <div className="container">
        <div className="market-insights-eyebrow">Market Insights</div>
        <h2 className="market-insights-heading">Live Data. Smarter Decisions.</h2>

        <div className="market-insights-grid">
          {/* 1 — Metal price watch */}
          <motion.div
            className="insight-card asset-snapshot-card"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="insight-card-header price-watch-header">
              <h4>Metal Price Watch</h4>
              <span className="live-pill"><span className="live-dot" /> Live</span>
            </div>
            {priceWatch.map((a) => (
              <div className="asset-snapshot-row" key={a.name}>
                <span className="asset-snapshot-name">{a.name}</span>
                <div className="asset-snapshot-meta">
                  <span className="asset-snapshot-price">
                    <AnimatedStat value={a.price} decimals={0} prefix="₹" suffix={a.unit} />
                  </span>
                  <span className={`asset-snapshot-change ${a.dir}`}>
                    {a.dir === 'up' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    <AnimatedStat value={a.changePct} decimals={1} suffix="%" />
                  </span>
                </div>
                <span className="row-hover-tip">
                  24H Range: ₹{a.low.toLocaleString('en-IN')} – ₹{a.high.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
            <Link to="/market-reports" className="market-dashboard-link">
              View Full Price Board <ArrowRight size={14} />
            </Link>
          </motion.div>

          {/* 2 — FerroBid Scrap Index trend */}
          <motion.div
            className="insight-card trend-card"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="insight-card-header">
              <div>
                <h4>Ferrous Scrap Index ({range === '1D' ? 'Today' : range === '7D' ? '7 Days' : range === '3M' ? '90 Days' : '12 Months'})</h4>
                <span className="trend-card-unit">₹ / MT · avg. clearing price</span>
              </div>
              <div className="range-toggle">
                {Object.keys(ranges).map((r) => (
                  <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="insight-card-value">
              <AnimatedStat value={last} prefix="₹" />
              <span className={`insight-card-change ${dir}`}>
                {dir === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                <AnimatedStat value={Math.abs(changePct)} decimals={2} suffix="%" />
              </span>
            </div>

            <div
              className="trend-chart-wrap"
              onMouseMove={handleChartMove}
              onMouseLeave={() => setChartHover(null)}
            >
              <svg className="trend-chart" viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-steel)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="var(--color-steel)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={area} fill="url(#trendFill)" />
                <motion.path
                  d={line}
                  fill="none"
                  stroke="var(--color-steel)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, ease: 'easeInOut' }}
                />
                {coords.map(([x, y], i) => (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={chartHover?.i === i ? 4.5 : 3}
                    fill="#fff"
                    stroke="var(--color-steel)"
                    strokeWidth="2"
                  />
                ))}
                {chartHover && (
                  <line
                    x1={coords[chartHover.i][0]}
                    y1="0"
                    x2={coords[chartHover.i][0]}
                    y2={CHART_H}
                    stroke="var(--color-steel)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity="0.35"
                  />
                )}
              </svg>
              {chartHover && (
                <div
                  className="chart-hover-tooltip"
                  style={{ left: chartHover.left, top: chartHover.top }}
                >
                  <div className="chart-hover-label">{current.labels[chartHover.i]}</div>
                  <div className="chart-hover-value">₹{current.prices[chartHover.i].toLocaleString('en-IN')}/MT</div>
                </div>
              )}
            </div>
            <div className="trend-chart-labels">
              {current.labels.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
          </motion.div>

          {/* 3 — Regional demand (India) */}
          <motion.div
            className="insight-card"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="insight-card-header">
              <h4>Regional Demand</h4>
            </div>
            <div className="insight-card-footnote-top">
              {mapHover
                ? <><strong>{mapHover.name}</strong> · {mapHover.lots} live lots</>
                : 'Live lots by state · hover to explore'}
            </div>
            <div className="india-demand-map">
              <svg
                viewBox={indiaMapData.viewBox}
                className="india-demand-svg"
                onMouseLeave={() => setMapHover(null)}
              >
                {indiaMapData.locations.map((loc) => (
                  <path
                    key={loc.id}
                    d={loc.path}
                    fill={lotFill(stateLots[loc.id])}
                    stroke="#ffffff"
                    strokeWidth="0.8"
                    onMouseEnter={() => setMapHover({ name: loc.name, lots: stateLots[loc.id] || DEFAULT_LOTS })}
                  />
                ))}
              </svg>
            </div>
            <div className="mini-map-legend">
              <span>Low</span>
              <div className="legend-gradient-bar ember"></div>
              <span>High</span>
            </div>
          </motion.div>

          {/* 4 — Market pulse */}
          <motion.div
            className="insight-card pulse-card"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="insight-card-header">
              <div className="pulse-title">
                <span className="pulse-title-icon"><Activity size={13} /></span>
                <h4>Market Pulse</h4>
              </div>
              <span className="pulse-window-pill"><span className="pulse-window-dot" /> 30-day</span>
            </div>
            <div className="insight-card-footnote-top">Auction momentum</div>

            <div className="pulse-hero">
              <div className="pulse-hero-content">
                <div className="pulse-value">
                  <span className="pulse-value-icon"><TrendingUp size={14} /></span>
                  <AnimatedStat className="pulse-value-num" value={3.24} decimals={2} suffix="%" />
                </div>
                <div className="pulse-value-note">bid value vs last month</div>
              </div>
            </div>

            <div className="pulse-stat-grid">
              <div className="pulse-stat tone-success">
                <span className="pulse-stat-icon"><Users size={13} /></span>
                <span className="pulse-stat-label">Buyer Demand</span>
                <span className="pulse-stat-value pulse-positive">
                  <span className="pulse-dot success" /> High
                </span>
              </div>
              <div className="pulse-stat tone-warn">
                <span className="pulse-stat-icon"><Package size={13} /></span>
                <span className="pulse-stat-label">Scrap Supply</span>
                <span className="pulse-stat-value pulse-warn">
                  <span className="pulse-dot warn" /> Tightening
                </span>
              </div>
              <div className="pulse-stat tone-success">
                <span className="pulse-stat-icon"><Percent size={13} /></span>
                <span className="pulse-stat-label">Sell-Through</span>
                <span className="pulse-stat-value pulse-positive">92%</span>
                <div className="pulse-bar">
                  <motion.div
                    className="pulse-bar-fill"
                    initial={{ width: 0 }}
                    whileInView={{ width: '92%' }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>
              <div className="pulse-stat tone-steel">
                <span className="pulse-stat-icon"><Gavel size={13} /></span>
                <span className="pulse-stat-label">Avg. Bids / Lot</span>
                <span className="pulse-stat-value">14.6</span>
                <div className="pulse-bar">
                  <motion.div
                    className="pulse-bar-fill neutral"
                    initial={{ width: 0 }}
                    whileInView={{ width: '73%' }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
