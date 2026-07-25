import React, { useMemo, useState } from 'react';
import { HelpCircle, Search, LifeBuoy } from 'lucide-react';
import { PageHero, SectionHead, Accordion, CTABand } from '../components/PageShell';

const CATEGORIES = ['All', 'Getting Started', 'Bidding', 'KYC & Verification', 'Payments', 'Delivery'];

const FAQS = [
  { cat: 'Getting Started', q: 'What is FerroBid?', a: 'FerroBid is India\'s digital auction platform for industrial metal and scrap. Verified sellers list inspected lots, and verified buyers bid transparently in real time.' },
  { cat: 'Getting Started', q: 'How do I register as a buyer?', a: 'Click Login / Register, choose Buyer, and complete KYC verification. Once approved, you can browse lots and participate in auctions.' },
  { cat: 'Getting Started', q: 'Is there a subscription to view prices?', a: 'Live bid values and bid counts are available to subscribers. You can browse lots freely and upgrade from the Pricing page to unlock live pricing.' },
  { cat: 'Bidding', q: 'How does live bidding work?', a: 'During a live auction you place bids in real time. The highest valid bid at close wins. Auto-extension prevents last-second sniping by extending the timer on late bids.' },
  { cat: 'Bidding', q: 'What is an EMD?', a: 'Earnest Money Deposit is a refundable deposit that confirms your intent to bid. It is adjusted against the final payment for winners and refunded to non-winners.' },
  { cat: 'KYC & Verification', q: 'What documents are required for KYC?', a: 'Typically GST registration, PAN, a company registration certificate and authorised-signatory identity proof. Requirements may vary by buyer/seller category.' },
  { cat: 'KYC & Verification', q: 'How long does verification take?', a: 'Most KYC submissions are verified within 24–48 business hours. You are notified by email and SMS once approved.' },
  { cat: 'Payments', q: 'What payment methods are supported?', a: 'Bank transfer (NEFT/RTGS), UPI for smaller amounts, and escrow-backed settlement for high-value lots. All payments are reconciled by our finance team.' },
  { cat: 'Payments', q: 'When is the balance payment due?', a: 'Winning buyers must complete the balance payment within the window stated in the sale confirmation letter, usually 24–72 hours after auction close.' },
  { cat: 'Delivery', q: 'Who arranges logistics?', a: 'Lifting and logistics can be arranged by the buyer, or via FerroBid\'s pan-India logistics partners. Delivery timelines are shown on each lot.' },
  { cat: 'Delivery', q: 'What if the material differs from the listing?', a: 'Every lot is physically inspected and documented before listing. If there is a genuine discrepancy, raise a request through Grievance Redressal within the stated window.' },
];

export const FAQs = () => {
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('All');

  const filtered = useMemo(() => {
    return FAQS.filter((f) => {
      if (cat !== 'All' && f.cat !== cat) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return (f.q + ' ' + f.a).toLowerCase().includes(q);
      }
      return true;
    });
  }, [query, cat]);

  return (
    <div className="ent-page">
      <PageHero
        eyebrow="Help & FAQs"
        eyebrowIcon={HelpCircle}
        title={<>Answers to your <span className="accent">common questions</span></>}
        subtitle="Search our knowledge base or browse by category. Can't find what you need? Our support team is a click away."
        breadcrumb={[{ label: 'Support' }, { label: 'Help & FAQs' }]}
      />

      <section className="ent-section">
        <div className="container">
          <div className="ent-search" style={{ marginBottom: '20px' }}>
            <Search size={18} />
            <input
              type="text"
              placeholder="Search FAQs — e.g. EMD, KYC, payment…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search FAQs"
            />
          </div>

          <div className="ent-pills" style={{ marginBottom: '28px' }}>
            {CATEGORIES.map((c) => (
              <button key={c} className={`ent-pill ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>{c}</button>
            ))}
          </div>

          <div style={{ maxWidth: '820px' }}>
            {filtered.length > 0 ? (
              <Accordion items={filtered.map((f) => ({ q: f.q, a: f.a }))} defaultOpen={0} />
            ) : (
              <div className="ent-card" style={{ textAlign: 'center' }}>
                <SectionHead center title="No matching questions" subtitle="Try a different keyword or reach out to our support team directly." />
                <a href="/contact" className="btn btn-primary" style={{ textDecoration: 'none' }}>Contact support</a>
              </div>
            )}
          </div>
        </div>
      </section>

      <CTABand
        title="Still need help?"
        text="Our support specialists are available Mon–Sat, 9 AM–8 PM IST to help with bidding, KYC, payments and settlement."
        primary={{ label: 'Contact support', to: '/contact' }}
        secondary={{ label: 'Visit Help Center', to: '/help-center' }}
      />
    </div>
  );
};

export default FAQs;
