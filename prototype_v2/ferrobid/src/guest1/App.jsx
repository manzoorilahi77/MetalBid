import React, { useRef, useState, useEffect, lazy, Suspense } from 'react';
import { motion, useInView, MotionConfig } from 'framer-motion';
import { 
  Search, ChevronDown, TrendingUp, TrendingDown,
  ArrowRight, ShieldCheck, FileCheck, Activity, Lock,
  Truck, HelpCircle, MapPin, CheckCircle, SearchCode,
  Bell, BarChart2, Mail, LayoutGrid, Zap, Droplet,
  ChevronLeft, ChevronRight, Clock, Menu,
  ShoppingBag, Package, ClipboardCheck, Check, X, Calendar, CalendarDays
} from 'lucide-react';
import indiaMapData from '@svg-maps/india';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsAndConditions from './pages/TermsAndConditions';
import Roles from './pages/Roles';
import Pricing from './pages/Pricing';
import AuctionCalendar from './pages/AuctionCalendar';
import { Marketplace } from './pages/Marketplace';
import { HowItWorks } from './pages/HowItWorks';
import { AboutUs } from './pages/AboutUs';
import { HowItWorksSection } from './components/HowItWorksSection';
import { WhyChooseSection } from './components/WhyChooseSection';
import { IndustryInsightsSection } from './components/IndustryInsightsSection';
import { MarketInsightsSection } from './components/MarketInsightsSection';
import { TestimonialsSection } from './components/TestimonialsSection';
import { AnnouncementsSection } from './components/AnnouncementsSection';
import { WhatsAppCommunityModal } from './components/WhatsAppCommunityModal';
import { HeroIllustration } from './components/hero/HeroIllustration';
import { Auth } from './pages/Auth';
import RoleSwitcher from './components/RoleSwitcher';
import './styles/auth.css';

// Secondary footer pages are lazy-loaded to keep the main bundle lean.
const ContactUs = lazy(() => import('./pages/ContactUs'));
const Careers = lazy(() => import('./pages/Careers'));
const FAQs = lazy(() => import('./pages/FAQs'));
const HelpCenter = lazy(() => import('./pages/HelpCenter'));
const Grievance = lazy(() => import('./pages/Grievance'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const KnowledgeCenter = lazy(() => import('./pages/KnowledgeCenter'));
const MarketReports = lazy(() => import('./pages/MarketReports'));

const AnimatedNumber = ({ end, prefix = '', suffix = '', duration = 2000 }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-20px" });

  useEffect(() => {
    if (!isInView) return;
    let startTime = null;
    let animationFrame;

    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.floor(easeProgress * end));
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration, isInView]);

  return <span ref={ref}>{prefix}{count.toLocaleString('en-IN')}{suffix}</span>;
};

const IndiaMapSvg = () => (
  <svg viewBox={indiaMapData.viewBox} xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <defs>
      <linearGradient id="mapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#e5e7eb" />
        <stop offset="100%" stopColor="#9c948c" />
      </linearGradient>
    </defs>
    {indiaMapData.locations.map(location => (
      <motion.path
        key={location.id}
        d={location.path}
        fill="url(#mapGradient)"
        stroke="#ffffff"
        strokeWidth={1.5}
        whileHover={{ fill: '#ef7a52', transition: { duration: 0.2 } }}
        style={{ cursor: 'pointer' }}
      />
    ))}
  </svg>
);

const MotionDiv = motion.div;

const UpcomingAuctionCard = ({ item, i }) => {
  return (
    <MotionDiv
      className="auction-card"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: Math.min(i, 4) * 0.08, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="auction-img">
        <img src={item.img} alt={item.company} loading="lazy" decoding="async" className="auction-img-element"/>
        <div className="upcoming-badge"><Calendar size={11} /> {item.date}</div>
        <div className="auction-cat">{item.cat}</div>
      </div>
      <div className="auction-info">
        <div className="auction-title">{item.company}</div>
        <div className="auction-loc"><MapPin size={12}/> {item.loc}</div>
        <div className="auction-stats">
          <div className="stat-col">
            <span>Auction Date</span>
            <span>{item.date}</span>
          </div>
          <div className="stat-col primary" style={{ textAlign: 'right' }}>
            <span>EMD Value</span>
            <span>{item.emd}</span>
          </div>
        </div>
      </div>
    </MotionDiv>
  );
};

const tickerData = [
  { material: 'MS Plate Offcuts (Fresh)', city: 'Mumbai', state: 'Maharashtra', emd: '₹6.20 L', qty: '11 MT', type: 'ferrous' },
  { material: 'Mixed Aluminium Extrusion Scrap', city: 'Chennai', state: 'Tamil Nadu', emd: '₹7.20 L', qty: '5 MT', type: 'aluminium' },
  { material: 'Heavy Melting Steel Scrap (HMS 80:20)', city: 'Raipur', state: 'Chhattisgarh', emd: '₹8.50 L', qty: '25 MT', type: 'ferrous' },
  { material: 'Copper Cable Scrap (Millberry)', city: 'Pune', state: 'Maharashtra', emd: '₹7.23 L', qty: '1 MT', type: 'copper' },
  { material: 'CR Coil Secondary Stock', city: 'Bhiwadi', state: 'Rajasthan', emd: '₹4.50 L', qty: '10 MT', type: 'ferrous' },
];

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDateTime = (date) => {
    // Render actual IST regardless of the viewer's machine timezone — the
    // label says "IST", so the digits must be IST.
    const ist = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const pad = (n) => n.toString().padStart(2, '0');
    const d = pad(ist.getDate());
    const m = pad(ist.getMonth() + 1);
    const y = ist.getFullYear();
    const hr = pad(ist.getHours());
    const min = pad(ist.getMinutes());
    const sec = pad(ist.getSeconds());
    return `${d}/${m}/${y} | ${hr}:${min}:${sec} IST`;
  };

  return (
    <nav className="navbar">
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="nav-brand">
          <Link to="/"><img src={`${import.meta.env.BASE_URL}headericon.png`} alt="FerroBid Logo" style={{ height: '42px', objectFit: 'contain' }} /></Link>
        </div>
        
        <div className="nav-links">
          <Link to="/marketplace">Marketplace</Link>
          <Link to="/#how-it-works">How it works</Link>
          <Link to="/about-us">About us</Link>
        </div>

        <div className="nav-actions" style={{ alignItems: 'center' }}>
          <div className="nav-ip-widget" style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', marginRight: '16px', textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center', fontVariantNumeric: 'tabular-nums' }}>
            <div>IP: 223.178.83.157</div>
            <div>{formatDateTime(currentTime)}</div>
          </div>
          <Link to="/calendar" className="nav-icon-btn" aria-label="Calendar">
            <CalendarDays size={20} className="text-muted" />
          </Link>
          <Link to="/#announcements" className="nav-icon-btn" aria-label="Announcements">
            <Bell size={20} className="text-muted" />
          </Link>
          <Link to="/marketplace" className="btn btn-outline nav-guest-btn" style={{ textDecoration: 'none' }}>Browse as Guest</Link>
          <Link to="/auth" className="btn btn-primary nav-login-btn" style={{ textDecoration: 'none' }}>Login / Register</Link>
          {import.meta.env.DEV && <RoleSwitcher />}
        </div>

        <button className="mobile-menu-btn" aria-label="Toggle Menu" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {isMenuOpen && (
        <div className="mobile-nav-dropdown">
          <Link to="/marketplace" onClick={() => setIsMenuOpen(false)}>Marketplace</Link>
          <Link to="/#how-it-works" onClick={() => setIsMenuOpen(false)}>How it works</Link>
          <Link to="/#announcements" onClick={() => setIsMenuOpen(false)}>Announcements</Link>
          <Link to="/about-us" onClick={() => setIsMenuOpen(false)}>About us</Link>
          <div className="mobile-nav-actions">
            <Link to="/marketplace" className="btn btn-outline" style={{width: '100%', marginBottom: '10px', textDecoration: 'none'}} onClick={() => setIsMenuOpen(false)}>Browse as Guest</Link>
            <Link to="/auth" className="btn btn-primary" style={{width: '100%', textDecoration: 'none'}} onClick={() => setIsMenuOpen(false)}>Login / Register</Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export const Footer = () => (
  <footer className="footer">
    <div className="container">
      <div className="footer-grid">
          <div className="footer-brand-col">
            <div className="footer-logo">
                <img src={`${import.meta.env.BASE_URL}footericon.png`} alt="FerroBid Logo" loading="lazy" decoding="async" style={{ height: '40px', objectFit: 'contain', marginLeft: '-8px' }} />
            </div>
            <p className="footer-desc" style={{fontSize: '11px', marginTop: '8px'}}>India's Trusted Digital Metal Auction Platform</p>
          </div>

          <div className="footer-col">
            <h4>Marketplace</h4>
            <ul>
                <li><Link to="/marketplace">Upcoming Auctions</Link></li>
                <li><Link to="/marketplace">All Categories</Link></li>
                <li><Link to="/marketplace">All Locations</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Company</h4>
            <ul>
                <li><Link to="/about-us">About Us</Link></li>
                <li><Link to="/how-it-works">How it works</Link></li>
                <li><Link to="/careers">Careers</Link></li>
                <li><Link to="/contact">Contact Us</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Resources</h4>
            <ul>
                <li><Link to="/blog">Blog</Link></li>
                <li><Link to="/knowledge-center">Knowledge Center</Link></li>
                <li><Link to="/market-reports">Market Reports</Link></li>
                <li><Link to="/help-center">Help Center</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Support</h4>
            <ul>
                <li><Link to="/faqs">Help & FAQs</Link></li>
                <li><Link to="/terms">Terms & Conditions</Link></li>
                <li><Link to="/privacy">Privacy Policy</Link></li>
                <li><Link to="/grievance">Grievance Redressal</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Download App</h4>
            <div className="app-buttons">
                <div className="app-btn-img">
                  <img src={`${import.meta.env.BASE_URL}badges/google-play.svg`} alt="Get it on Google Play" loading="lazy" decoding="async" />
                </div>
                <div className="app-btn-img">
                  <img src={`${import.meta.env.BASE_URL}badges/app-store.svg`} alt="Download on the App Store" loading="lazy" decoding="async" />
                </div>
            </div>
          </div>
      </div>

      <div className="footer-bottom">
          <div className="footer-legal-links">
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms and Conditions</Link>
          </div>
          <div className="footer-copyright">© 2026 FerroBid. All rights reserved.</div>
          <div className="social-links" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{color: 'rgba(255,255,255,0.7)'}}>Connect with us:</span>
            <a href="mailto:contact@ferrobid.in" aria-label="Email" style={{display: 'flex', alignItems: 'center'}}><Mail size={16} /></a>
            <a href="https://www.linkedin.com/company/ferrobid" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" style={{display: 'flex', alignItems: 'center'}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
            </a>
          </div>
      </div>
    </div>
  </footer>
);

function Home() {
  const navigate = useNavigate();
  const carouselRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (carouselRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 1);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  const scrollCarousel = (direction) => {
    if (carouselRef.current) {
      const scrollAmount = 320;
      if (direction === 'left' && canScrollLeft) {
        carouselRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      } else if (direction === 'right' && canScrollRight) {
        carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }
  };

  return (
    <>
      {/* Hero Section */}
      <section className="hero-section">
        <div className="container hero-container">
          <MotionDiv
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="hero-content"
          >
            <h1 className="hero-title">
              <span className="hero-lead">India Trades Smarter.</span><br/>
              <span>Digital. Trusted.</span>
            </h1>
            <p className="hero-subtitle">
              The most advanced digital auction platform for scrap, metals, and industrial materials.
            </p>
            <p className="hero-desc">
              <span>Verified sellers</span>
              <span className="hero-desc-sep">•</span>
              <span>Quality-inspected lots</span>
              <span className="hero-desc-sep">•</span>
              <span>Live bidding</span>
              <span className="hero-desc-sep">•</span>
              <span>Secure settlements</span>
            </p>

            <form className="search-bar-wrapper" onSubmit={(e) => { e.preventDefault(); navigate('/marketplace'); }}>
              <div className="search-icon-wrapper"><Search size={18} /></div>
              <input type="text" placeholder="Search metal, lot no, seller..." aria-label="Search by metal, lot number, or seller" className="search-input" />
              <button type="submit" className="search-btn">Search Auctions</button>
            </form>

            <div className="hero-filters">
              <Link to="/marketplace" className="filter-pill">All Categories <ChevronDown size={14}/></Link>
              <Link to="/marketplace" className="filter-pill"><div className="filter-pill-icon"></div> Ferrous</Link>
              <Link to="/marketplace" className="filter-pill"><div className="filter-pill-icon"></div> Non-Ferrous</Link>
              <Link to="/marketplace" className="filter-pill">All Locations <ChevronDown size={14}/></Link>
            </div>
          </MotionDiv>

          {/* The floating cards are live React components, not baked pixels —
              see components/hero/HeroIllustration. */}
          <div className="hero-visual">
            <HeroIllustration />
          </div>
        </div>
      </section>

      {/* Stats Ribbon */}
      <div className="container stats-ribbon-wrapper">
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="stats-ribbon"
        >
          <div className="stat-item">
            <div className="stat-icon"><LayoutGrid size={24} /></div>
            <div>
              <div className="stat-val"><AnimatedNumber end={2400} suffix="+" /></div>
              <div className="stat-label">Lots Auctioned</div>
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-icon"><TrendingUp size={24} /></div>
            <div>
              <div className="stat-val"><AnimatedNumber end={96} prefix="₹" suffix=" Cr+" /></div>
              <div className="stat-label">GMV Realised (FY 25-26)</div>
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-icon"><ShieldCheck size={24} /></div>
            <div>
              <div className="stat-val"><AnimatedNumber end={6000} suffix="+" /></div>
              <div className="stat-label">Verified Bidders</div>
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-icon"><Activity size={24} /></div>
            <div>
              <div className="stat-val">99%</div>
              <div className="stat-label">Fulfilment Rate</div>
            </div>
          </div>
        </MotionDiv>
      </div>

      {/* Ticker Section */}
      <div className="ticker-wrapper">
        <div className="ticker-content">
          {[...tickerData, ...tickerData, ...tickerData, ...tickerData].map((item, i) => (
            <div className="ticker-item" key={i}>
              <div className={`ticker-dot ${item.type}`}></div>
              <span className="ticker-name">{item.material}</span>
              <span className="ticker-loc">{item.city}, {item.state}</span>
              <span className="ticker-price">EMD {item.emd}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Announcements */}
      <AnnouncementsSection />

      {/* Forthcoming Auctions */}
      <section className="live-auctions" style={{ overflow: 'hidden' }}>
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
            <div>
              <div className="section-eyebrow">Forthcoming Auctions</div>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: 'var(--text-section-title)', fontWeight: 700, color: '#1c1917', letterSpacing: 'var(--track-heading)', lineHeight: 1.2 }}>Plan Ahead. Bid Smart.</h2>
              <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#6b6560', fontWeight: 500, lineHeight: 1.6, maxWidth: '56ch' }}>Upcoming lots across India. Register early and be ready to bid.</p>
            </div>
            <Link to="/marketplace" className="view-all" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#e4572e', textDecoration: 'none', background: 'rgba(228,87,46,0.08)', padding: '10px 18px', borderRadius: '24px' }}>
              View all auctions <ArrowRight size={16}/>
            </Link>
          </div>

          <div className="auction-grid-container" style={{position: 'relative'}}>
            <button className={`carousel-nav-btn left ${!canScrollLeft ? 'disabled' : ''}`} aria-label="Previous" onClick={() => canScrollLeft && scrollCarousel('left')}><ChevronLeft size={20} /></button>

            <div className="auction-carousel" ref={carouselRef} onScroll={checkScroll}>
              {[
                { company: 'Shree Balaji Metal Corp', loc: 'Mumbai, Maharashtra', cat: 'ALUMINIUM', date: '28 Jul 2026', emd: '₹25,000', img: `${import.meta.env.BASE_URL}aluminium_scrap.png` },
                { company: 'Om Sai Recycling Pvt Ltd', loc: 'Chennai, TN', cat: 'RUBBER', date: '02 Aug 2026', emd: '₹18,500', img: `${import.meta.env.BASE_URL}rubber_scrap.png` },
                { company: 'Bhilai Ispat Udyog', loc: 'Raipur, Chhattisgarh', cat: 'STEEL', date: '05 Aug 2026', emd: '₹65,000', img: `${import.meta.env.BASE_URL}images/auctions/hms_scrap.png` },
                { company: 'Deccan Alloys & Steel', loc: 'Pune, Maharashtra', cat: 'STEEL', date: '09 Aug 2026', emd: '₹1,20,000', img: `${import.meta.env.BASE_URL}images/auctions/cr_coil.png` },
                { company: 'Saraswati Non-Ferrous Ltd', loc: 'Ahmedabad, Gujarat', cat: 'COPPER', date: '12 Aug 2026', emd: '₹95,000', img: `${import.meta.env.BASE_URL}images/auctions/copper_wire.png` },
                { company: 'Ganges Metal Traders', loc: 'Kolkata, WB', cat: 'ZINC', date: '15 Aug 2026', emd: '₹40,000', img: `${import.meta.env.BASE_URL}images/auctions/zinc_dross.png` }
              ].map((item, i) => (
                <UpcomingAuctionCard key={i} item={item} i={i} />
              ))}
            </div>

            <button className={`carousel-nav-btn right ${!canScrollRight ? 'disabled' : ''}`} aria-label="Next" onClick={() => canScrollRight && scrollCarousel('right')}><ChevronRight size={20} /></button>
          </div>
        </div>
      </section>

      {/* Big Stats */}
      <section style={{ backgroundColor: 'var(--bg-white)', padding: 'var(--space-section-sm) 0' }}>
        <div className="container">
        <div className="big-stats-wrapper">
          <div className="big-stats-grid">
            <div className="big-stat-item">
              <div className="big-stat-val"><AnimatedNumber end={10000} suffix="+" /></div>
              <div className="big-stat-label">Registered Users</div>
            </div>
            <div className="big-stat-divider"></div>
            <div className="big-stat-item">
              <div className="big-stat-val"><AnimatedNumber end={2500} suffix="+" /></div>
              <div className="big-stat-label">Active Sellers</div>
            </div>
            <div className="big-stat-divider"></div>
            <div className="big-stat-item">
              <div className="big-stat-val"><AnimatedNumber end={500} prefix="₹" suffix=" Cr+" /></div>
              <div className="big-stat-label">Traded Since Launch</div>
            </div>
            <div className="big-stat-divider"></div>
            <div className="big-stat-item">
              <div className="big-stat-val"><AnimatedNumber end={25} suffix="+" /></div>
              <div className="big-stat-label">States Covered</div>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section style={{ backgroundColor: 'var(--bg-orange-alt)', padding: 'var(--space-section) 0', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '50%', height: '140%', background: 'radial-gradient(circle, rgba(228, 87, 46,0.03) 0%, transparent 70%)', pointerEvents: 'none' }}></div>

        <div className="container pricing-preview-container" style={{ gap: '48px', alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <MotionDiv
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div style={{ color: 'var(--primary)', fontSize: '11px', fontWeight: 800, letterSpacing: 'var(--track-eyebrow)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Platform Access
            </div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-section-title)', fontWeight: 700, color: '#1c1917', letterSpacing: 'var(--track-heading)', marginBottom: '10px', lineHeight: 1.2 }}>
              Clear, Predictable<br/>Pricing
            </h2>
            <p style={{ color: '#6b6560', fontSize: '14px', lineHeight: 1.6, marginBottom: '28px', maxWidth: '52ch' }}>
              A transparent, value-driven pricing structure. Gain full access to enterprise auction tools with a simple subscription and fixed, transparent platform fees designed for scale.
            </p>
            <Link to="/pricing" style={{ textDecoration: 'none' }}>
              <MotionDiv whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} style={{ display: 'inline-block' }}>
                <button className="btn" style={{
                  background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))', color: 'white', border: 'none', borderRadius: '8px',
                  padding: '13px 26px', fontSize: '14px', fontWeight: 700, display: 'inline-flex',
                  alignItems: 'center', gap: '8px', cursor: 'pointer',
                  boxShadow: '0 8px 20px -6px rgba(200, 68, 31, 0.45), inset 0 1px 0 rgba(255,255,255,0.18)'
                }}>
                  View detailed plans <ArrowRight size={16} />
                </button>
              </MotionDiv>
            </Link>
          </MotionDiv>

          <MotionDiv
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <MotionDiv
              style={{
                background: 'linear-gradient(145deg, #ffffff, var(--color-surface-2))',
                padding: '40px', borderRadius: '16px',
                boxShadow: '0 18px 40px -16px rgba(28,25,23,0.14), 0 4px 12px -4px rgba(28,25,23,0.05)',
                border: '1px solid rgba(228, 87, 46, 0.15)',
                position: 'relative'
              }}
              whileHover={{ y: -4, boxShadow: '0 24px 48px -20px rgba(28,25,23,0.18), 0 6px 16px -6px rgba(28,25,23,0.07)' }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '60%', height: '4px', background: 'var(--primary)', borderBottomLeftRadius: '4px', borderBottomRightRadius: '4px' }}></div>
              
              <p style={{ color: '#6b6560', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 'var(--track-label)', marginBottom: '8px' }}>Starting at</p>
              <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '28px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: '56px', fontWeight: 700, color: 'var(--primary)', lineHeight: 1, letterSpacing: '-1.5px', textShadow: '0 2px 4px rgba(228, 87, 46,0.1)' }}>₹2,999</span>
                <span style={{ color: '#6b6560', fontSize: '14px', marginLeft: '6px', fontWeight: 600 }}>/mo</span>
              </div>
              <div style={{ height: '1px', background: 'linear-gradient(90deg, rgba(228, 87, 46,0.2) 0%, transparent 100%)', marginBottom: '24px' }}></div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[
                  "Fixed, transparent platform fees",
                  "Unlimited lot listings",
                  "Full access to all auction models"
                ].map((item, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 + i * 0.08 }}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#1c1917', fontSize: '14px', fontWeight: 500 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(228, 87, 46,0.1)', color: 'var(--primary)' }}>
                      <Check size={14} strokeWidth={3} />
                    </div>
                    {item}
                  </motion.li>
                ))}
              </ul>
            </MotionDiv>
          </MotionDiv>
        </div>
      </section>

      {/* How It Works Section */}
      <HowItWorksSection />

      {/* Why Choose FerroBid */}
      <WhyChooseSection />

      {/* Trust Section */}
      <section className="trust-section">
        <div className="container">
          <div className="section-eyebrow" style={{ textAlign: 'center', marginBottom: '8px' }}>Trusted By Thousands</div>
          <h2 className="section-title justify-center" style={{fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 'var(--text-section-title)', marginBottom: '8px'}}>Why thousands trust <span style={{color: 'var(--primary)', marginLeft: '6px'}}>FerroBid</span></h2>

          <MotionDiv
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="trust-badges-row"
          >
            {[
              { icon: <ShieldCheck size={20} />, title: "100% Verified", desc: "KYC verified buyers & sellers" },
              { icon: <FileCheck size={20} />, title: "Physically Inspected", desc: "Every lot inspected & documented" },
              { icon: <Activity size={20} />, title: "Live & Transparent", desc: "Real-time bidding you can trust" },
              { icon: <Lock size={20} />, title: "Secure Payments", desc: "Escrow, EMD & auto settlement" },
              { icon: <Truck size={20} />, title: "Pan India Logistics", desc: "End-to-end logistics support" }
            ].map((item, idx) => (
              <React.Fragment key={idx}>
                <MotionDiv whileHover={{ y: -2 }} className="trust-item">
                  <div className="trust-icon">
                    {item.icon}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h4 className="trust-title">{item.title}</h4>
                    <p className="trust-desc">{item.desc}</p>
                  </div>
                </MotionDiv>

                {idx < 4 && <div className="trust-item-divider"></div>}
              </React.Fragment>
            ))}
          </MotionDiv>
        </div>
      </section>

      {/* Industry Insights */}
      <IndustryInsightsSection />

      {/* Market Insights */}
      <MarketInsightsSection />

      {/* Testimonials */}
      <TestimonialsSection />

      {/* CTA Footer Banner */}
      <div className="container">
         <div className="cta-banner">
            <div className="cta-content">
              <h2>Ready to strike while it's hot?</h2>
              <p>Join India's most trusted metal auction platform today.</p>
            </div>
            <div className="cta-actions">
               <MotionDiv whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }}>
                  <Link to="/auth?tab=register" className="btn cta-btn-white" style={{ textDecoration: 'none' }}>Register Now <ArrowRight size={14} className="ml-2"/></Link>
               </MotionDiv>
               <MotionDiv whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }}>
                 <Link to="/marketplace" className="btn cta-btn-outline" style={{ textDecoration: 'none' }}>Browse as Guest</Link>
               </MotionDiv>
            </div>
         </div>
      </div>

      {/* WhatsApp community opt-in — appears ~2.5s after the homepage settles */}
      <WhatsAppCommunityModal />
    </>
  );
}

const App = () => {
  const location = useLocation();
  const isAuthPage = location.pathname === '/auth';

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, location.hash]);

  return (
    <MotionConfig reducedMotion="user">
    <div className="app-wrapper">
      {!isAuthPage && <Navbar />}
      <main>
      <Suspense fallback={<div className="route-loader" aria-busy="true"><span className="route-loader-spinner" /></div>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/about-us" element={<AboutUs />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsAndConditions />} />
        <Route path="/roles" element={<Roles />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/calendar" element={<AuctionCalendar />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/contact" element={<ContactUs />} />
        <Route path="/careers" element={<Careers />} />
        <Route path="/faqs" element={<FAQs />} />
        <Route path="/help-center" element={<HelpCenter />} />
        <Route path="/grievance" element={<Grievance />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/knowledge-center" element={<KnowledgeCenter />} />
        <Route path="/market-reports" element={<MarketReports />} />
      </Routes>
      </Suspense>
      </main>
      {!isAuthPage && <Footer />}
    </div>
    </MotionConfig>
  );
}

export default App;