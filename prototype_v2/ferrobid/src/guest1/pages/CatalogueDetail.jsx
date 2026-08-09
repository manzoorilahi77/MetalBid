import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Building2, Calendar, Clock, Layers, MapPin,
  ShieldCheck, Timer, Wallet,
} from 'lucide-react';
import { Breadcrumb } from '../components/PageShell';
import { useStore, catalogueUiStatus } from '../../store/store';
import { inr, fmtDateTime, relTime } from '../../lib/format';
import '../styles/enterprise.css';
import '../styles/resources.css';
import '../styles/catalogue-detail.css';

const STATUS_LABEL = {
  live: 'Live now',
  closing: 'Closing soon',
  upcoming: 'Upcoming',
  closed: 'Closed',
};

export const CatalogueDetail = () => {
  const { id } = useParams();
  const catalogues = useStore((s) => s.catalogues);
  const lots = useStore((s) => s.lots);
  const users = useStore((s) => s.users);

  const cat = catalogues.find((c) => c.id === id && c.status !== 'draft');

  if (!cat) {
    return (
      <div className="ent-page">
        <div className="container">
          <div className="cat-detail-404">
            <h2 className="ent-title" style={{ marginBottom: '12px' }}>Catalogue not found</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
              This listing may have closed or the link may be out of date.
            </p>
            <Link to="/marketplace" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              <ArrowLeft size={16} /> Back to the marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const catLots = lots.filter((l) => l.catalogueId === cat.id);
  const seller = users.find((u) => u.id === cat.sellerId);
  const uiStatus = catalogueUiStatus(cat, Date.now());
  const emdFrom = catLots.length ? Math.min(...catLots.map((l) => l.preBidEmd)) : 0;
  const emdTo = catLots.length ? Math.max(...catLots.map((l) => l.preBidEmd)) : 0;

  return (
    <div className="ent-page cat-detail">
      <header className="res-hero cat-detail-hero">
        <div className="container">
          <Breadcrumb items={[{ label: 'Marketplace', to: '/marketplace' }, { label: cat.title }]} />

          <motion.div
            className="res-hero-inner"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="cat-detail-badges">
              <span className={`cat-detail-status is-${uiStatus}`}>
                {(uiStatus === 'live' || uiStatus === 'closing') && <span className="cat-detail-status-dot" />}
                {STATUS_LABEL[uiStatus]}
              </span>
              <span className="cat-detail-code">{cat.code}</span>
            </div>
            <h1 className="res-hero-title">{cat.title}</h1>
            <p className="res-hero-lead">{cat.description}</p>

            <ul className="res-facts">
              <li>
                <p className="res-fact-label"><Layers size={12} aria-hidden="true" />Lots</p>
                <p className="res-fact-value">{catLots.length}</p>
              </li>
              <li>
                <p className="res-fact-label"><MapPin size={12} aria-hidden="true" />Location</p>
                <p className="res-fact-value">{cat.region}</p>
              </li>
              <li>
                <p className="res-fact-label"><Wallet size={12} aria-hidden="true" />EMD range</p>
                <p className="res-fact-value">{inr(emdFrom)}&ndash;{inr(emdTo)}</p>
              </li>
              <li>
                <p className="res-fact-label"><Clock size={12} aria-hidden="true" />
                  {uiStatus === 'upcoming' ? 'Starts' : 'Ends'}
                </p>
                <p className="res-fact-value">
                  {relTime(uiStatus === 'upcoming' ? cat.startsAt : cat.endsAt, Date.now())}
                </p>
              </li>
            </ul>
          </motion.div>
        </div>
      </header>

      <div className="container cat-detail-body">
        <section className="cat-detail-section">
          <h2 className="cat-detail-section-title">Seller &amp; yard</h2>
          <div className="cat-detail-info-grid">
            <div className="cat-detail-info-card">
              <p className="cat-detail-info-label"><Building2 size={13} /> Seller</p>
              <p className="cat-detail-info-value">{seller?.firm ?? 'Verified Seller'}</p>
              {seller?.sellerVerified && <p className="cat-detail-info-sub"><ShieldCheck size={12} /> KYC verified</p>}
            </div>
            <div className="cat-detail-info-card">
              <p className="cat-detail-info-label"><MapPin size={13} /> Yard</p>
              <p className="cat-detail-info-value">{cat.yardName}</p>
              <p className="cat-detail-info-sub">{cat.yardAddress}</p>
            </div>
            <div className="cat-detail-info-card">
              <p className="cat-detail-info-label"><Clock size={13} /> Inspection contact</p>
              <p className="cat-detail-info-value">{cat.inspectionContact.name}</p>
              <p className="cat-detail-info-sub">{cat.inspectionContact.role} &middot; {cat.inspectionContact.phone}</p>
            </div>
          </div>
        </section>

        <section className="cat-detail-section">
          <h2 className="cat-detail-section-title">Timing</h2>
          <div className="cat-detail-info-grid">
            <div className="cat-detail-info-card">
              <p className="cat-detail-info-label"><Calendar size={13} /> Auction window</p>
              <p className="cat-detail-info-value">{fmtDateTime(cat.startsAt)}</p>
              <p className="cat-detail-info-sub">to {fmtDateTime(cat.endsAt)}</p>
            </div>
            <div className="cat-detail-info-card">
              <p className="cat-detail-info-label"><Calendar size={13} /> Inspection window</p>
              <p className="cat-detail-info-value">{fmtDateTime(cat.inspectionFrom)}</p>
              <p className="cat-detail-info-sub">to {fmtDateTime(cat.inspectionTo)} &middot; {cat.inspectionHours}</p>
            </div>
            <div className="cat-detail-info-card">
              <p className="cat-detail-info-label"><Timer size={13} /> EMD deadline</p>
              <p className="cat-detail-info-value">{fmtDateTime(cat.emdDeadline)}</p>
            </div>
          </div>
        </section>

        <section className="cat-detail-section">
          <h2 className="cat-detail-section-title">Lots in this catalogue</h2>
          <div className="cat-detail-lots">
            {catLots.map((lot) => (
              <div className="cat-detail-lot" key={lot.id}>
                <div className="cat-detail-lot-head">
                  <span className="cat-detail-lot-no">{lot.lotNo}</span>
                  <span className="cat-detail-lot-metal">{lot.metal}{lot.grade ? ` — ${lot.grade}` : ''}</span>
                  {lot.hazardous && <span className="cat-detail-lot-hazard">Hazardous</span>}
                </div>
                <p className="cat-detail-lot-desc">{lot.description}</p>
                <div className="cat-detail-lot-stats">
                  <span><strong>{lot.indicativeQty} {lot.uom}</strong> indicative qty</span>
                  <span><strong>{inr(lot.startRate)}</strong> starting rate/{lot.uom}</span>
                  <span><strong>{inr(lot.preBidEmd)}</strong> pre-bid EMD</span>
                  <span className="cat-detail-lot-status">{lot.status.replace(/_/g, ' ')}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="cat-detail-cta">
          <div>
            <h2>Ready to bid on this catalogue?</h2>
            <p>Create a free account to fund EMD and join the room when it goes live.</p>
          </div>
          <Link to="/pricing" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Create an account to bid <ArrowRight size={16} />
          </Link>
        </section>
      </div>
    </div>
  );
};

export default CatalogueDetail;
