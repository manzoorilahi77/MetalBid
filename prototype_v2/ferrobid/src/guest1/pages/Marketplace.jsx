import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuctionCard } from '../components/AuctionCard';
import {
  Search, Filter, X, PackageSearch, RotateCcw, ChevronLeft, ChevronRight,
  Layers, Radio, MapPin, Building2, Wallet, ClipboardCheck, Timer, BookOpen
} from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from 'framer-motion';
// kept from main: the AUCTIONS list below still routes every image through
// asset(), which prefixes BASE_URL so the images resolve under /MetalBid/
import { asset } from '../utils/asset';
import '../styles/enterprise.css';
import '../styles/resources.css';

const PER_PAGE = 6;

const AUCTIONS = [
  { id: 'FA-1022951', material: 'Mixed Aluminium Extrusion Scrap', seller: 'Tata Steel', location: 'Jamshedpur, JH', state: 'Jharkhand', qty: '25 MT', price: '₹6,45,000', priceNum: 645000, type: 'aluminium', category: 'Non-Ferrous', isLive: true, img: asset('/images/auctions/aluminium_scrap.png') },
  { id: 'FA-1022952', material: 'CR Coil Secondary Stock', seller: 'SAIL', location: 'Bhilai, CG', state: 'Chhattisgarh', qty: '40 MT', price: '₹12,20,000', priceNum: 1220000, type: 'ferrous', category: 'Ferrous', isLive: true, img: asset('/images/auctions/cr_coil.png') },
  { id: 'FA-1022953', material: 'Copper Wire Scrap (Millberry)', seller: 'Hindalco', location: 'Renukoot, UP', state: 'Uttar Pradesh', qty: '10 MT', price: '₹8,90,000', priceNum: 890000, type: 'copper', category: 'Non-Ferrous', isLive: false, img: asset('/images/auctions/copper_wire.png') },
  { id: 'FA-1022954', material: 'Heavy Melting Steel Scrap (HMS 1)', seller: 'JSW Steel', location: 'Bellary, KA', state: 'Karnataka', qty: '100 MT', price: '₹34,00,000', priceNum: 3400000, type: 'ferrous', category: 'Ferrous', isLive: false, img: asset('/images/auctions/hms_scrap.png') },
  { id: 'FA-1022955', material: 'Zinc Dross (Top Dross)', seller: 'Hindustan Zinc', location: 'Udaipur, RJ', state: 'Rajasthan', qty: '15 MT', price: '₹4,50,000', priceNum: 450000, type: 'zinc', category: 'Minor Metals', isLive: true, img: asset('/images/auctions/zinc_dross.png') },
  { id: 'FA-1022956', material: 'Brass Borings & Turnings', seller: 'Local Vendor', location: 'Jamnagar, GJ', state: 'Gujarat', qty: '5 MT', price: '₹2,10,000', priceNum: 210000, type: 'brass', category: 'Non-Ferrous', isLive: false, img: asset('/images/auctions/brass_borings.png') },
  { id: 'FA-1022957', material: 'MS Plate Offcuts (Fresh)', seller: 'Tata Steel', location: 'Jamshedpur, JH', state: 'Jharkhand', qty: '11 MT', price: '₹6,20,000', priceNum: 620000, type: 'ferrous', category: 'Ferrous', isLive: true, img: asset('/images/auctions/hms_scrap.png') },
  { id: 'FA-1022958', material: 'Aluminium Ingots ADC-12', seller: 'Hindalco', location: 'Taloja, MH', state: 'Maharashtra', qty: '20 MT', price: '₹39,96,000', priceNum: 3996000, type: 'aluminium', category: 'Non-Ferrous', isLive: true, img: asset('/images/auctions/aluminium_scrap.png') },
  { id: 'FA-1022959', material: 'Stainless Steel 304 Scrap', seller: 'JSW Steel', location: 'Bellary, KA', state: 'Karnataka', qty: '18 MT', price: '₹26,10,000', priceNum: 2610000, type: 'ferrous', category: 'Stainless Steel', isLive: false, img: asset('/images/auctions/cr_coil.png') },
  { id: 'FA-1022960', material: 'Lead Battery Scrap (RSDL)', seller: 'Hindustan Zinc', location: 'Chanderiya, RJ', state: 'Rajasthan', qty: '30 MT', price: '₹41,00,000', priceNum: 4100000, type: 'zinc', category: 'Minor Metals', isLive: true, img: asset('/images/auctions/zinc_dross.png') },
  { id: 'FA-1022961', material: 'Copper Cathode Cut Rods', seller: 'Hindalco', location: 'Dahej, GJ', state: 'Gujarat', qty: '8 MT', price: '₹63,84,000', priceNum: 6384000, type: 'copper', category: 'Non-Ferrous', isLive: false, img: asset('/images/auctions/copper_wire.png') },
  { id: 'FA-1022962', material: 'HMS 80:20 Steel Scrap', seller: 'SAIL', location: 'Rourkela, OD', state: 'Odisha', qty: '60 MT', price: '₹20,40,000', priceNum: 2040000, type: 'ferrous', category: 'Ferrous', isLive: true, img: asset('/images/auctions/hms_scrap.png') },
];

const CATEGORIES = ['Ferrous', 'Non-Ferrous', 'Stainless Steel', 'Minor Metals'];
const SELLERS = [...new Set(AUCTIONS.map((a) => a.seller))];
const STATES = ['All States', ...new Set(AUCTIONS.map((a) => a.state))];

/* Counted off the inventory rather than written by hand — a hero that states
   "12 lots" while the array holds nine is worse than saying nothing. */
const STATS = {
  total: AUCTIONS.length,
  live: AUCTIONS.filter((a) => a.isLive).length,
  sellers: SELLERS.length,
  states: STATES.length - 1,
  tonnage: AUCTIONS
    .reduce((sum, a) => sum + (parseFloat(a.qty) || 0), 0)
    .toLocaleString('en-IN'),
};

/* What a first-time bidder has to know before committing money. Each links to
   the page that carries the detail rather than restating it here. */
const PRE_BID = [
  {
    icon: ClipboardCheck,
    title: 'Read the inspection report first',
    text: 'Every lot was physically inspected before publication. The report — not the photograph — is the operative description of what you are buying.',
    to: '/how-it-works',
    cta: 'See the process',
  },
  {
    icon: Wallet,
    title: 'EMD is per lot, not per account',
    text: 'A deposit unlocks bidding on one specific lot. Lose, and it refunds automatically; win, and it credits against the price.',
    to: '/faqs',
    cta: 'EMD questions',
  },
  {
    icon: Timer,
    title: 'A bid cannot be taken back',
    text: 'Bids are irrevocable, and the clock auto-extends on late bids so a lot closes on price rather than on reflexes.',
    to: '/terms',
    cta: 'Bidding terms',
  },
  {
    icon: BookOpen,
    title: 'Know what the grade names mean',
    text: 'HMS 80:20, millberry, ADC-12, RSDL — the grade reference explains each one and what to check at inspection.',
    to: '/knowledge-center',
    cta: 'Grade reference',
  },
];

const VIEWS = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live Now' },
  { key: 'upcoming', label: 'Upcoming' },
];

export const Marketplace = () => {
  const reduceMotion = useReducedMotion();
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [stateFilter, setStateFilter] = useState('All States');
  const [view, setView] = useState('all');
  const [sort, setSort] = useState('ending');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const gridTopRef = useRef(null);

  const toggle = (list, setList, val) =>
    setList(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);

  const resetAll = () => {
    setSearch('');
    setCategories([]);
    setSellers([]);
    setStateFilter('All States');
    setView('all');
    setSort('ending');
  };

  const filtered = useMemo(() => {
    let list = AUCTIONS.filter((a) => {
      if (view === 'live' && !a.isLive) return false;
      if (view === 'upcoming' && a.isLive) return false;
      if (categories.length && !categories.includes(a.category)) return false;
      if (sellers.length && !sellers.includes(a.seller)) return false;
      if (stateFilter !== 'All States' && a.state !== stateFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${a.material} ${a.id} ${a.seller} ${a.location}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (sort === 'priceLow') list = [...list].sort((a, b) => a.priceNum - b.priceNum);
    else if (sort === 'priceHigh') list = [...list].sort((a, b) => b.priceNum - a.priceNum);
    else if (sort === 'ending') list = [...list].sort((a, b) => Number(b.isLive) - Number(a.isLive));
    else if (sort === 'recent') list = [...list].reverse();
    return list;
  }, [search, categories, sellers, stateFilter, view, sort]);

  // Any filter/sort/view change sends the user back to the first page.
  useEffect(() => {
    setPage(1);
  }, [search, categories, sellers, stateFilter, view, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  const goPage = (p) => {
    const next = Math.min(Math.max(1, p), totalPages);
    setPage(next);
    if (gridTopRef.current) {
      gridTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const activeChips = [
    ...categories.map((c) => ({ label: c, clear: () => toggle(categories, setCategories, c) })),
    ...sellers.map((s) => ({ label: s, clear: () => toggle(sellers, setSellers, s) })),
    ...(stateFilter !== 'All States' ? [{ label: stateFilter, clear: () => setStateFilter('All States') }] : []),
    ...(search.trim() ? [{ label: `"${search.trim()}"`, clear: () => setSearch('') }] : []),
  ];

  return (
    <div className="marketplace-page res-page">
      {/* Opens like every other secondary page — breadcrumb, eyebrow, title,
          lead — with a facts strip counted off the live inventory rather than
          written by hand, so it cannot drift out of date. */}
      <header className="res-hero">
        <div className="container">
          <nav className="ent-breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <ChevronRight size={13} aria-hidden="true" />
            <span className="crumb-current" aria-current="page">Marketplace</span>
          </nav>

          <div className="res-hero-inner">
            <p className="ent-hero-eyebrow"><Layers size={13} aria-hidden="true" /> Live inventory</p>
            <h1 className="res-hero-title">Every lot here has already been inspected.</h1>
            <p className="res-hero-lead">
              Ferrous, non-ferrous, stainless and minor metals from verified corporate sellers.
              Each lot carries a GPS-tagged inspection report — location, photographs, video,
              quantity and condition — published before it reached this page.
            </p>

            <ul className="res-facts">
              <li>
                <p className="res-fact-label"><Layers size={12} aria-hidden="true" />Lots listed</p>
                <p className="res-fact-value">{STATS.total}</p>
              </li>
              <li>
                <p className="res-fact-label"><Radio size={12} aria-hidden="true" />Live now</p>
                <p className="res-fact-value">{STATS.live}</p>
              </li>
              <li>
                <p className="res-fact-label"><Building2 size={12} aria-hidden="true" />Sellers</p>
                <p className="res-fact-value">{STATS.sellers}</p>
              </li>
              <li>
                <p className="res-fact-label"><MapPin size={12} aria-hidden="true" />States</p>
                <p className="res-fact-value">{STATS.states}</p>
              </li>
              <li>
                <p className="res-fact-label"><PackageSearch size={12} aria-hidden="true" />Total tonnage</p>
                <p className="res-fact-value">{STATS.tonnage} MT</p>
              </li>
            </ul>
          </div>
        </div>
      </header>

      <div className="container" style={{ paddingTop: '36px', paddingBottom: '56px' }}>
        <div className="marketplace-layout">
          <div className="mobile-filter-toggle">
            <button className="btn btn-outline w-full" onClick={() => setIsFilterOpen((v) => !v)}>
              <Filter size={18} style={{ marginRight: '8px' }} />
              {isFilterOpen ? 'Hide Filters' : 'Show Filters'}
              {activeChips.length > 0 && <span className="filter-count-pill">{activeChips.length}</span>}
            </button>
          </div>

          {/* Sidebar Filters */}
          <motion.aside
            className={`marketplace-sidebar ${isFilterOpen ? 'open' : ''}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <div className="filter-header">
              <h3>Filters</h3>
              <button className="btn-text filter-reset" onClick={resetAll}>
                <RotateCcw size={13} /> Reset
              </button>
            </div>

            <div className="filter-section">
              <h4>Category</h4>
              {CATEGORIES.map((c) => (
                <label className="checkbox-label" key={c}>
                  <input type="checkbox" checked={categories.includes(c)} onChange={() => toggle(categories, setCategories, c)} />
                  <span className="checkbox-box" aria-hidden="true" />
                  {c}
                  <span className="checkbox-count">{AUCTIONS.filter((a) => a.category === c).length}</span>
                </label>
              ))}
            </div>

            <div className="filter-section">
              <h4>Seller</h4>
              {SELLERS.map((s) => (
                <label className="checkbox-label" key={s}>
                  <input type="checkbox" checked={sellers.includes(s)} onChange={() => toggle(sellers, setSellers, s)} />
                  <span className="checkbox-box" aria-hidden="true" />
                  {s}
                </label>
              ))}
            </div>

            <div className="filter-section" style={{ marginBottom: 0 }}>
              <h4>Location</h4>
              <select className="filter-select w-full" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
                {STATES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </motion.aside>

          {/* Main Content */}
          <main className="marketplace-content">
            <div className="marketplace-top-controls">
              <div className="search-bar-expanded">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search by material, lot ID, seller or location..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button className="search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className="sort-control">
                <span className="text-muted text-sm">Sort by:</span>
                <select className="filter-select" value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="ending">Ending Soonest</option>
                  <option value="recent">Recently Added</option>
                  <option value="priceLow">Price: Low to High</option>
                  <option value="priceHigh">Price: High to Low</option>
                </select>
              </div>
            </div>

            {/* View tabs */}
            <LayoutGroup>
              <div className="marketplace-tabs">
                {VIEWS.map((v) => {
                  const count = v.key === 'all' ? AUCTIONS.length : AUCTIONS.filter((a) => (v.key === 'live' ? a.isLive : !a.isLive)).length;
                  return (
                    <button
                      key={v.key}
                      className={`marketplace-tab ${view === v.key ? 'active' : ''}`}
                      onClick={() => setView(v.key)}
                    >
                      {view === v.key && <motion.span layoutId="mp-tab-pill" className="marketplace-tab-pill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                      <span className="marketplace-tab-label">
                        {v.key === 'live' && <span className="tab-live-dot" />}
                        {v.label} <span className="tab-count">{count}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </LayoutGroup>

            {/* Result bar + active chips */}
            <div className="marketplace-resultbar" ref={gridTopRef}>
              <span className="result-count">
                {filtered.length > 0 ? (
                  <>
                    Showing <strong>{(currentPage - 1) * PER_PAGE + 1}&ndash;{Math.min(currentPage * PER_PAGE, filtered.length)}</strong> of {filtered.length} lots
                  </>
                ) : (
                  <>No lots found</>
                )}
              </span>
              <AnimatePresence>
                {activeChips.length > 0 && (
                  <motion.div className="filter-chips" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {activeChips.map((chip) => (
                      <motion.button
                        key={chip.label}
                        className="filter-chip"
                        onClick={chip.clear}
                        layout
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                      >
                        {chip.label} <X size={12} />
                      </motion.button>
                    ))}
                    <button className="filter-chip-clear" onClick={resetAll}>
                      Clear all
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Grid */}
            <motion.div className="auction-grid-large" layout>
              <AnimatePresence mode="popLayout">
                {paged.map((auction) => (
                  <motion.div
                    key={auction.id}
                    layout
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <AuctionCard auction={auction} isLive={auction.isLive} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

            {/* Pagination */}
            {filtered.length > 0 && totalPages > 1 && (
              <div className="pagination">
                <button className="page-btn page-arrow" disabled={currentPage === 1} onClick={() => goPage(currentPage - 1)}>
                  <ChevronLeft size={16} /> Prev
                </button>
                <div className="page-numbers">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      className={`page-btn page-num ${p === currentPage ? 'active' : ''}`}
                      onClick={() => goPage(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button className="page-btn page-arrow" disabled={currentPage === totalPages} onClick={() => goPage(currentPage + 1)}>
                  Next <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* Empty state */}
            {filtered.length === 0 && (
              <motion.div className="marketplace-empty" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <div className="empty-icon">
                  <PackageSearch size={30} />
                </div>
                <h3>No lots match your filters</h3>
                <p>Try widening your search or clearing a few filters to see more auctions.</p>
                <button className="btn btn-primary" onClick={resetAll}>
                  Reset all filters
                </button>
              </motion.div>
            )}
          </main>
        </div>
      </div>

      {/* ─── Before you bid ─── */}
      <section className="res-band">
        <div className="container">
          <div className="sec-head">
            <p className="sec-eyebrow">Before you bid</p>
            <h2 className="sec-title">Four things that catch people out.</h2>
            <p className="sec-lead">
              The floor is open to browse without an account. Committing money is a different
              step, and these are the parts first-time bidders most often learn the hard way.
            </p>
          </div>

          <div className="res-grid cols-4">
            {PRE_BID.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  {...(reduceMotion ? {} : {
                    initial: { y: 20 },
                    whileInView: { y: 0 },
                    viewport: { once: true, amount: 0.2 },
                    transition: { duration: 0.5, delay: Math.min(i, 4) * 0.07, ease: [0.16, 1, 0.3, 1] },
                  })}
                >
                  <div className="res-band-card">
                    <span className="res-band-icon"><Icon size={17} strokeWidth={1.9} /></span>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                    <Link
                      to={item.to}
                      className="res-card-foot"
                      style={{ textDecoration: 'none', color: 'var(--color-ember-light, #ef7a52)' }}
                    >
                      {item.cta} <ChevronRight size={13} strokeWidth={2.5} />
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <p className="res-band-note">
            Quantities shown are inspection estimates unless the lot states that it settles on
            delivered weighbridge weight. Prices exclude GST and applicable levies.
          </p>
        </div>
      </section>
    </div>
  );
};
