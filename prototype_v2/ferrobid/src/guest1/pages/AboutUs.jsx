import React, { useState } from 'react';
import { 
  Building2, Users, Network, ShieldCheck, 
  Banknote, ArrowRight, TrendingUp, Cpu, 
  MapPin, Database, Server, Eye, Factory,
  ClipboardCheck, Truck, Scale, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import '../styles/about.css';

// ─── Shared Animation Variants ───
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

// ─── Component: Ecosystem Hierarchy (Interactive Tree) ───
const EcosystemHierarchy = () => {
  const rolesData = {
    superAdmin: {
      title: 'Super Admin', icon: Building2,
      purpose: 'Complete ownership of the platform with unrestricted access.',
      responsibilities: ['Manage every module', 'Assign permissions', 'System configurations', 'Financial visibility', 'Audit logs', 'Delete/restore data'],
      permissions: ['Full access to all modules', 'Can approve/reject any workflow', 'Can manage organization structure']
    },
    ceo: {
      title: 'CEO / Managing Director', icon: TrendingUp,
      purpose: 'Monitors business growth and financial performance.',
      responsibilities: ['Revenue dashboards', 'Commission reports', 'Auction performance', 'Business KPIs', 'Monthly reports', 'High-value auction monitoring'],
      permissions: ['View all operational data', 'No operational editing', 'No catalog or auction creation']
    },
    executive: {
      title: 'Executive Officer', icon: ShieldCheck,
      purpose: 'Operational approval authority ensuring only valid auctions proceed.',
      responsibilities: ['Approve seller onboarding', 'Approve site inspection reports', 'Approve lot verification', 'Monitor site officers and sub admins'],
      permissions: ['Send back for corrections', 'Assign work', 'Approve publishing']
    },
    investor: {
      title: 'Investor / Board Member', icon: Eye,
      purpose: 'Read-only access for external monitoring and audits.',
      responsibilities: ['View revenue reports', 'View auction statistics', 'Monitor KPIs', 'Track company performance'],
      permissions: ['View only', 'Cannot modify anything']
    },
    subAdmin: {
      title: 'Sub Admin (Operations)', icon: Network,
      purpose: 'Operational backbone managing the complete auction lifecycle.',
      responsibilities: ['Create catalogs, lots, and auctions', 'Manage buyer registration & EMD verification', 'Generate approval and sale confirmation letters', 'Close auctions and send final documents'],
      permissions: ['Manage auction operations', 'Cannot approve site inspections', 'Cannot access executive financial dashboards']
    },
    siteOfficer: {
      title: 'Site Officer', icon: MapPin,
      purpose: 'Works completely in the field for physical verification.',
      responsibilities: ['Visit seller locations', 'Inspect scrap, machinery, assets', 'Upload photos, videos, GPS locations', 'Submit inspection reports'],
      permissions: ['Recommend approvals or rejections to Executives']
    },
    finance: {
      title: 'Finance Officer', icon: Banknote,
      purpose: 'Manages all financial transactions securely.',
      responsibilities: ['EMD and Refunds', 'Commission calculations', 'Buyer payments', 'Seller settlements', 'Financial reconciliation'],
      permissions: ['Manage all transaction ledgers']
    },
    seller: {
      title: 'Seller', icon: Factory,
      purpose: 'Corporate entities owning the industrial assets.',
      responsibilities: ['Submit auction requests', 'Upload documents', 'View sold lots and payments'],
      permissions: ['Cannot create their own auctions']
    },
    buyer: {
      title: 'Buyer', icon: Users,
      purpose: 'Verified enterprises purchasing materials.',
      responsibilities: ['Complete KYC', 'Pay EMD', 'Participate in live auctions', 'Download invoices and sale orders'],
      permissions: ['Bid on approved public or private auctions']
    }
  };

  const flatRoles = [
    { icon: Building2, label: 'Super Admin' },
    { icon: TrendingUp, label: 'CEO' },
    { icon: ShieldCheck, label: 'Executive' },
    { icon: Network, label: 'Sub Admin' },
    { icon: Banknote, label: 'Finance' },
    { icon: MapPin, label: 'Site Officer' },
    { icon: Eye, label: 'Investor' },
    { icon: Users, label: 'Support' },
    { icon: Factory, label: 'Seller' },
    { icon: Users, label: 'Buyer' },
    { icon: Network, label: 'Transporter' },
    { icon: ShieldCheck, label: 'Compliance' },
    { icon: MapPin, label: 'Inspection' }
  ];

  return (
    <section className="ecosystem-section">
      <div style={{ textAlign: 'center', marginBottom: '80px', position: 'relative', zIndex: 100 }}>
        <h2 className="story-hero-title" style={{ fontSize: '36px', color: '#1c1917' }}>Enterprise Ecosystem.</h2>
        <p style={{ color: '#6b6560' }}>A massive, multi-layered organization ensuring scale, security, and absolute trust.</p>
      </div>

      <div className="eco-wrapper">
        <motion.div className="orbit-container" initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ duration: 1 }} viewport={{ once: true }}>

          {/* Core Hub */}
          <div className="orbit-core">
            <Building2 size={28}/>
            <span>Super Admin</span>
          </div>

          {/* Inner Ring (Operations) */}
          <div className="orbit-ring orbit-ring-1">
            <div className="orbit-node"><TrendingUp size={16} color="var(--primary)"/> CEO</div>
            <div className="orbit-node"><ShieldCheck size={16} color="var(--primary)"/> Executive</div>
            <div className="orbit-node"><Network size={16} color="var(--primary)"/> Sub Admin</div>
            <div className="orbit-node"><Banknote size={16} color="var(--primary)"/> Finance</div>
          </div>

          {/* Outer Ring (External / Market) */}
          <div className="orbit-ring orbit-ring-2">
            <div className="orbit-node"><MapPin size={16}/> Site Officer</div>
            <div className="orbit-node"><Eye size={16}/> Investor</div>
            <div className="orbit-node"><Users size={16}/> Support</div>
            <div className="orbit-node"><Factory size={16}/> Seller</div>
            <div className="orbit-node"><Users size={16}/> Buyer</div>
            <div className="orbit-node"><Network size={16}/> Transporter</div>
            <div className="orbit-node"><ShieldCheck size={16}/> Compliance</div>
            <div className="orbit-node"><MapPin size={16}/> Inspection</div>
          </div>

        </motion.div>

        {/* Mobile fallback: the radial orbit diagram can't fit phone widths, show a flat grid instead */}
        <div className="eco-mobile-grid">
          {flatRoles.map((role, idx) => {
            const Icon = role.icon;
            return (
              <div className="eco-mobile-item" key={idx}>
                <div className="eco-mobile-icon"><Icon size={18}/></div>
                <span>{role.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export const AboutUs = () => {
  return (
    <div className="story-page">
      
      {/* ─── 1. Unified Hero & Command Center ─── */}
      <section className="unified-hero">
        <div className="hero-blueprint"></div>
        <div className="unified-hero-container">
          
          <motion.div 
            className="unified-hero-text"
            initial="hidden" animate="visible" variants={staggerContainer}
          >
            <motion.h1 variants={fadeInUp} className="story-hero-title">
              The Digital <span className="gold-accent">Architecture</span> of<br/>Industrial Trade.
            </motion.h1>
            <motion.p variants={fadeInUp} className="hero-subtitle">
              Scale, precision, and enterprise trust. We are digitizing the entire industrial supply chain.
            </motion.p>
          </motion.div>

          <motion.div className="hero-kpi-grid" variants={staggerContainer} initial="hidden" animate="visible">
            {[
              { value: '₹5,000Cr+', label: 'Gross Merchandise Value' },
              { value: '12,000+', label: 'Verified Buyers' },
              { value: '99.9%', label: 'Platform Reliability' }
            ].map((stat, idx) => (
              <motion.div key={idx} variants={fadeInUp} className="hero-kpi-card">
                <div className="kpi-val">{stat.value}</div>
                <div className="kpi-lab">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>

        </div>
      </section>

      {/* ─── 3. 3D Transaction Pipeline (Ultra Compact) ─── */}
      <section className="workflow-section">
        <div className="workflow-container">
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
             <h2 className="story-hero-title" style={{ fontSize: '36px' }}>Transaction Architecture.</h2>
          </div>

          <motion.div className="wf-pipeline" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            {[
              { title: 'Seller Onboarding', desc: 'Enterprise KYC & Corporate Verification.' },
              { title: 'Site Inspection', desc: 'GPS & Physical verification by on-site officers.' },
              { title: 'Executive Approval', desc: 'Strict governance sign-off on catalog details.' },
              { title: 'Live Auction', desc: 'Real-time forward and reverse bidding execution.' },
              { title: 'Finance Settlement', desc: 'Automated EMD clearing & commission distribution.' }
            ].map((step, idx) => (
              <motion.div key={idx} variants={fadeInUp} className="wf-item">
                <div className="wf-number">0{idx + 1}</div>
                <div className="wf-content">
                  <h4>{step.title}</h4>
                  <p>{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <EcosystemHierarchy />

      {/* ─── 5. Operational Infrastructure (Bento Grid) ─── */}
      <section className="bento-section">
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h2 className="story-hero-title" style={{ fontSize: '36px' }}>Operational Infrastructure.</h2>
          <p style={{ color: '#6b6560', fontSize: '16px', maxWidth: '600px', margin: '0 auto' }}>
            A meticulously designed enterprise framework ensuring complete control over every step of the transaction lifecycle.
          </p>
        </div>
        
        <motion.div className="bento-grid" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          
          {/* Card 1: Site Inspection (Spans 2 columns) */}
          <motion.div variants={fadeInUp} className="bento-card span-col-2">
            <div className="bento-icon"><MapPin size={24}/></div>
            <h4>Site Inspection & Valuation</h4>
            <p>Field officers deployed directly to physical locations for rigorous asset verification before any catalog is built.</p>
            <ul className="bento-list">
              <li>GPS-tagged location verification</li>
              <li>High-resolution photo & video capture</li>
              <li>On-site quantity & condition estimation</li>
            </ul>
          </motion.div>

          {/* Card 2: Live Auction (Spans 2 columns) */}
          <motion.div variants={fadeInUp} className="bento-card span-col-2">
            <div className="bento-icon"><Cpu size={24}/></div>
            <h4>Live Auction Engine</h4>
            <p>Our real-time WebSocket infrastructure manages high-stakes bidding environments with zero latency.</p>
            <ul className="bento-list">
              <li>Instantaneous forward & reverse bidding</li>
              <li>Automated EMD barrier verification</li>
              <li>Live bid tracking & winner declaration</li>
            </ul>
          </motion.div>

          {/* Card 3: Finance Settlement */}
          <motion.div variants={fadeInUp} className="bento-card">
            <div className="bento-icon"><Banknote size={24}/></div>
            <h4>Finance & Settlement</h4>
            <p>Strict financial oversight handling multi-crore transactions.</p>
            <ul className="bento-list">
              <li>Automated EMD clearing</li>
              <li>Real-time commission calculation</li>
              <li>Rapid seller settlements</li>
            </ul>
          </motion.div>

          {/* Card 4: Logistics */}
          <motion.div variants={fadeInUp} className="bento-card">
            <div className="bento-icon"><Truck size={24}/></div>
            <h4>Material Logistics</h4>
            <p>End-to-end tracking of physical asset delivery.</p>
            <ul className="bento-list">
              <li>Transporter assignments</li>
              <li>Digital Proof of Delivery (POD)</li>
              <li>Dual-party confirmations</li>
            </ul>
          </motion.div>

          {/* Card 5: Compliance (Spans 2 columns) */}
          <motion.div variants={fadeInUp} className="bento-card span-col-2">
            <div className="bento-icon"><ShieldAlert size={24}/></div>
            <h4>Compliance & Legal Verification</h4>
            <p>Automated enterprise KYC and AML checks integrated directly into the corporate onboarding flow.</p>
            <ul className="bento-list">
              <li>Strict corporate document verification</li>
              <li>Multi-tier executive approval routing</li>
              <li>Complete legal audit trail generation</li>
            </ul>
          </motion.div>

        </motion.div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="ent-cta">
        <h2 className="story-hero-title" style={{ fontSize: '32px' }}>Digitize your supply chain today.</h2>
        <Link to="/auth?tab=register" style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px', 
          background: 'linear-gradient(135deg, var(--primary), #c8441f)',
          color: 'white', padding: '12px 32px', borderRadius: '999px',
          fontWeight: '700', textDecoration: 'none', marginTop: '16px'
        }}>
          Partner With FerroBid <ArrowRight size={18}/>
        </Link>
      </section>

    </div>
  );
};
