import React, { useRef } from 'react';
import { ShieldCheck, Search, Gavel, Trophy, Truck } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';

const steps = [
  { icon: ShieldCheck, title: "1. Register & KYC", desc: "Create your account and complete our secure KYC verification to join our trusted network of buyers." },
  { icon: Search, title: "2. Browse Lots", desc: "Explore thousands of premium industrial lots across ferrous, non-ferrous, and minor metals." },
  { icon: Gavel, title: "3. Place Bids", desc: "Participate in live or forward auctions. Use our auto-bid feature to stay ahead effortlessly." },
  { icon: Trophy, title: "4. Win the Auction", desc: "Get notified instantly when you win a lot. Complete your payment securely through our portal." },
  { icon: Truck, title: "5. Logistics & Delivery", desc: "Coordinate with the seller for seamless lifting, loading, and delivery of your material." }
];

export const HowItWorks = () => {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"]
  });

  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <div className="marketplace-page">
      <div className="container" style={{ paddingTop: '80px', paddingBottom: '120px' }}>
        
        <motion.div 
          className="page-header-clean" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 80px' }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <span className="clean-badge" style={{ marginBottom: '24px' }}>The Process</span>
          <h1 className="clean-title" style={{ fontSize: '48px' }}>How FerroBid Works</h1>
          <p className="clean-subtitle" style={{ fontSize: '18px' }}>A transparent, secure, and seamless journey from registration to delivery. Engineered for enterprise scale.</p>
        </motion.div>

        <div className="timeline-container-premium" ref={containerRef}>
          {/* Background Track Line */}
          <div className="timeline-track-bg"></div>
          
          {/* Animated Glow Line */}
          <motion.div className="timeline-track-fill" style={{ height: lineHeight }}></motion.div>

          {steps.map((step, idx) => (
            <motion.div 
              key={idx}
              className={`timeline-step-premium ${idx % 2 === 0 ? 'left' : 'right'}`}
              initial={{ opacity: 0, x: idx % 2 === 0 ? -50 : 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            >
              <div className="timeline-content-premium">
                <motion.div 
                  className="timeline-icon-glow"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <step.icon size={36} className="text-primary" />
                </motion.div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
                <div className="timeline-connector-dot"></div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
