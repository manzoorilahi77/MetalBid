import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Headset, Mail, Phone, MapPin, Clock, Building2, LifeBuoy,
  ShieldCheck, Send, CheckCircle2, MessageSquare,
} from 'lucide-react';
import { PageHero, SectionHead, RevealGrid, Reveal, CTABand } from '../components/PageShell';

const CONTACTS = [
  { icon: Headset, title: 'Sales & Enterprise', lines: ['enterprise@ferrobid.in', '+91 1800 266 3376'], note: 'For onboarding & bulk buyers' },
  { icon: LifeBuoy, title: 'Buyer / Seller Support', lines: ['support@ferrobid.in', '+91 1800 266 3300'], note: 'Mon–Sat, 9 AM – 8 PM IST' },
  { icon: ShieldCheck, title: 'Grievance Officer', lines: ['grievance@ferrobid.in'], note: 'Escalations & disputes', to: '/grievance' },
];

const OFFICES = [
  { city: 'Bengaluru (HQ)', addr: 'Prestige Tech Park, Marathahalli, Bengaluru, Karnataka 560103', tag: 'Headquarters' },
  { city: 'Mumbai', addr: 'BKC Financial District, Bandra East, Mumbai, Maharashtra 400051', tag: 'West Region' },
  { city: 'Raipur', addr: 'Industrial Area Phase II, Urla, Raipur, Chhattisgarh 493221', tag: 'Operations Hub' },
];

export const ContactUs = () => {
  const [sent, setSent] = useState(false);

  const onSubmit = (e) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="ent-page">
      <PageHero
        eyebrow="Contact FerroBid"
        eyebrowIcon={Headset}
        title={<>Talk to our <span className="accent">enterprise team</span></>}
        subtitle="Whether you're onboarding as a verified seller, scaling procurement, or need help with a live auction — our specialists respond within one business day."
        breadcrumb={[{ label: 'Company' }, { label: 'Contact Us' }]}
      />

      {/* Contact cards */}
      <section className="ent-section">
        <div className="container">
          <SectionHead eyebrow="Reach the right desk" title="Enterprise contact channels" />
          <RevealGrid className="ent-grid cols-3">
            {CONTACTS.map((c) => {
              const Icon = c.icon;
              const inner = (
                <>
                  <div className="ent-card-icon"><Icon size={22} /></div>
                  <h3>{c.title}</h3>
                  {c.lines.map((l) => <p key={l} style={{ fontWeight: 600, color: 'var(--dark)' }}>{l}</p>)}
                  <p style={{ marginTop: '6px' }}>{c.note}</p>
                </>
              );
              return (
                <Reveal key={c.title}>
                  {c.to
                    ? <Link to={c.to} className="ent-card" style={{ display: 'block', textDecoration: 'none' }}>{inner}</Link>
                    : <div className="ent-card">{inner}</div>}
                </Reveal>
              );
            })}
          </RevealGrid>
        </div>
      </section>

      {/* Form + business hours */}
      <section className="ent-section alt">
        <div className="container">
          <div className="ent-split">
            <div className="ent-card" style={{ padding: '32px' }}>
              <SectionHead eyebrow="Send an enquiry" title="Message our team" />
              {sent ? (
                <div className="ent-form-success">
                  <CheckCircle2 size={18} /> Thank you — your enquiry has been received. Our team will respond within one business day.
                </div>
              ) : (
                <form className="ent-form" onSubmit={onSubmit}>
                  <div className="ent-form-row">
                    <div className="ent-field">
                      <label htmlFor="c-name">Full name <span className="req">*</span></label>
                      <input id="c-name" className="ent-input" required placeholder="Your name" />
                    </div>
                    <div className="ent-field">
                      <label htmlFor="c-company">Company</label>
                      <input id="c-company" className="ent-input" placeholder="Organization" />
                    </div>
                  </div>
                  <div className="ent-form-row">
                    <div className="ent-field">
                      <label htmlFor="c-email">Work email <span className="req">*</span></label>
                      <input id="c-email" type="email" className="ent-input" required placeholder="you@company.com" />
                    </div>
                    <div className="ent-field">
                      <label htmlFor="c-topic">Topic</label>
                      <select id="c-topic">
                        <option>General enquiry</option>
                        <option>Seller onboarding</option>
                        <option>Buyer registration & KYC</option>
                        <option>Payments & settlement</option>
                        <option>Partnership</option>
                      </select>
                    </div>
                  </div>
                  <div className="ent-field">
                    <label htmlFor="c-msg">Message <span className="req">*</span></label>
                    <textarea id="c-msg" className="ent-textarea" required placeholder="How can we help?" />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start' }}>
                    <Send size={16} style={{ marginRight: '8px' }} /> Send message
                  </button>
                </form>
              )}
            </div>

            <aside className="ent-aside-sticky" style={{ display: 'grid', gap: '16px' }}>
              <div className="ent-contact-card">
                <div className="ci"><Clock size={20} /></div>
                <div>
                  <h4>Business hours</h4>
                  <p>Mon – Fri: 9:00 AM – 8:00 PM IST<br />Saturday: 10:00 AM – 4:00 PM IST<br />Sunday & public holidays: Closed</p>
                </div>
              </div>
              <div className="ent-contact-card">
                <div className="ci"><Phone size={20} /></div>
                <div>
                  <h4>Toll-free helpline</h4>
                  <a href="tel:+9118002663300">+91 1800 266 3300</a>
                </div>
              </div>
              <div className="ent-contact-card">
                <div className="ci"><MessageSquare size={20} /></div>
                <div>
                  <h4>Prefer self-service?</h4>
                  <Link to="/help-center">Visit the Help Center →</Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Offices */}
      <section className="ent-section">
        <div className="container">
          <SectionHead eyebrow="Our offices" title="Where we operate" subtitle="Registered offices and operations hubs across India." />
          <RevealGrid className="ent-grid cols-3">
            {OFFICES.map((o) => (
              <Reveal key={o.city}>
                <div className="ent-card">
                  <span className="ent-tag">{o.tag}</span>
                  <h3 style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building2 size={16} style={{ color: 'var(--primary)' }} /> {o.city}
                  </h3>
                  <p style={{ display: 'flex', gap: '8px' }}><MapPin size={14} style={{ flexShrink: 0, marginTop: '3px', color: 'var(--primary)' }} /> {o.addr}</p>
                </div>
              </Reveal>
            ))}
          </RevealGrid>
        </div>
      </section>

      <CTABand
        title="Looking for quick answers?"
        text="Browse our FAQs and Help Center for instant guidance on bidding, KYC, payments and settlement."
        primary={{ label: 'Help & FAQs', to: '/faqs' }}
        secondary={{ label: 'Help Center', to: '/help-center' }}
      />
    </div>
  );
};

export default ContactUs;
