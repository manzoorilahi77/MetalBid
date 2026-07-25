import React from 'react';
import { motion } from 'framer-motion';

const reasons = [
  { img: `${import.meta.env.BASE_URL}transparent.jfif`, title: 'Transparent Auctions' },
  { img: `${import.meta.env.BASE_URL}ai.jfif`, title: 'AI Fraud Detection' },
  { img: `${import.meta.env.BASE_URL}global.jfif`, title: 'Pan-India Enterprise Network' },
];

export const WhyChooseSection = () => (
  <section className="why-choose-section">
    <div className="container">
      <div className="why-choose-eyebrow">Why Choose FerroBid</div>
      <h2 className="why-choose-heading">Built for Trust. Designed for Indian Industry.</h2>

      <div className="why-choose-grid">
        {reasons.map((r, i) => (
          <motion.div
            key={i}
            className="why-choose-card"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <img src={r.img} alt={r.title} loading="lazy" decoding="async" className="why-choose-card-img" />
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);
