import React from 'react';
import { Clock, MapPin, Building2, ChevronRight, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export const AuctionCard = ({ auction, isLive = false }) => {
  return (
    <motion.div 
      className="auction-card premium-small-card"
      whileHover={{ y: -6, boxShadow: '0 16px 32px -8px rgba(228, 87, 46, 0.2)' }}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <div className="auction-card-image-wrap">
        <img src={auction.img || '/hero.jpg'} alt={auction.material} className="auction-card-bg-img" />
        <div className="auction-card-img-overlay"></div>
        
        {isLive ? (
          <div className="live-badge-glass">
            <span className="live-dot pulse"></span>
            LIVE NOW
          </div>
        ) : (
          <div className="upcoming-badge-glass">
            <span className="upcoming-dot"></span>
            UPCOMING
          </div>
        )}
        
        <div className="auction-time-glass">
          <Clock size={12} /> 
          {isLive ? 'Ends in 02:45:10' : 'Starts in 2 Days'}
        </div>
      </div>
      
      <div className="auction-card-content">
        <div className="auction-meta">
          <span className="auction-id">{auction.id}</span>
          <span className="auction-qty">{auction.qty}</span>
        </div>
        
        <h3 className="auction-title">{auction.material}</h3>
        
        <div className="auction-details-grid">
          <div className="detail-item">
            <Building2 size={12} className="text-primary" />
            <span>{auction.seller || 'Verified Seller'}</span>
          </div>
          <div className="detail-item">
            <MapPin size={12} className="text-primary" />
            <span>{auction.location || 'Pan India'}</span>
          </div>
        </div>

        <div className="auction-price-row">
          <div className="price-block">
            <span className="price-label">{isLive ? 'Current Bid' : 'Starting Price'}</span>
            <Link to="/pricing" className="price-locked" title="Subscribe to view pricing">
              <Lock size={11} /> Subscribers only
            </Link>
          </div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              to="/pricing"
              className={`btn ${isLive ? 'btn-primary' : 'btn-outline-primary'} btn-sm`}
              style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '999px', textDecoration: 'none' }}
            >
              {isLive ? 'Join' : 'View'} <ChevronRight size={14} style={{ marginLeft: '2px' }} />
            </Link>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

