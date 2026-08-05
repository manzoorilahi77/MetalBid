/* ---------------------------------------------------------------------------
   Contact Us

   The old page had three contact cards, a generic form and three office
   addresses — nothing that told a visitor which desk would actually answer, how
   long it would take, or what to include so the first reply could be useful
   rather than a request for more information.

   The rebuild states all three. The form now captures the lot ID and urgency
   up front, because a support desk that has to ask for those loses a day.
--------------------------------------------------------------------------- */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Headset, Mail, Phone, MapPin, Clock, Building2, LifeBuoy,
  ShieldCheck, Send, CheckCircle2, ChevronRight, Wallet,
  Factory, Scale, ClipboardList, Zap, HelpCircle, Users
} from 'lucide-react';
import '../styles/enterprise.css';
import '../styles/resources.css';

/* Desks, with the two facts that decide where a message should go: what it
   handles, and how fast it answers. */
const DESKS = [
  {
    icon: LifeBuoy, title: 'Buyer & seller support',
    handles: 'Bidding, KYC, account access, lifting and anything you cannot find in the FAQ.',
    email: 'support@ferrobid.in', phone: '+91 1800 266 3300',
    hours: 'Mon–Sat, 9 AM – 8 PM IST', target: 'Same business day'
  },
  {
    icon: Wallet, title: 'Finance desk',
    handles: 'EMD, refunds, invoices, settlement working and payment references.',
    email: 'support@ferrobid.in',
    hours: 'Mon–Fri, 9 AM – 6 PM IST', target: '1 business day'
  },
  {
    icon: Factory, title: 'Enterprise & onboarding',
    handles: 'Seller onboarding, bulk buyer setup, logistics and inspection partnerships.',
    email: 'enterprise@ferrobid.in', phone: '+91 1800 266 3376',
    hours: 'Mon–Fri, 9 AM – 6 PM IST', target: '1 business day'
  },
  {
    icon: Scale, title: 'Grievance Officer',
    handles: 'Formal complaints, disputed outcomes and escalations. Ticketed and time-bound.',
    email: 'grievance@ferrobid.in', to: '/grievance',
    hours: 'Logged around the clock', target: 'Acknowledged in 24 hrs'
  }
];

const OFFICES = [
  {
    city: 'Bengaluru', tag: 'Headquarters',
    addr: 'Prestige Tech Park, Marathahalli, Bengaluru, Karnataka 560103',
    role: 'Registered office, engineering, finance and the Grievance Officer.'
  },
  {
    city: 'Mumbai', tag: 'West region',
    addr: 'BKC Financial District, Bandra East, Mumbai, Maharashtra 400051',
    role: 'Enterprise sales and buyer onboarding for the western corridor.'
  },
  {
    city: 'Raipur', tag: 'Operations hub',
    addr: 'Industrial Area Phase II, Urla, Raipur, Chhattisgarh 493221',
    role: 'Site inspection team and ferrous operations for the melting belt.'
  }
];

/* Saying this before the form is what makes the first reply useful. */
const INCLUDE = [
  { k: 'Lot or transaction ID', v: 'The FA-number from your sale confirmation letter. It is the fastest route to your records.' },
  { k: 'Your registered email', v: 'We can only discuss an account with the address it is registered to.' },
  { k: 'What you expected vs what happened', v: 'Stated plainly, with dates and amounts where money is involved.' },
  { k: 'What outcome you want', v: 'Refund, correction, explanation or escalation — it decides which desk picks it up.' }
];

export const ContactUs = () => {
  const reduceMotion = useReducedMotion();
  const [sent, setSent] = useState(false);

  const reveal = reduceMotion ? {} : {
    initial: { y: 18 },
    whileInView: { y: 0 },
    viewport: { once: true, amount: 0.12 },
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
  };

  const stagger = i => (reduceMotion ? {} : {
    initial: { y: 20 },
    whileInView: { y: 0 },
    viewport: { once: true, amount: 0.15 },
    transition: { duration: 0.5, delay: Math.min(i, 4) * 0.07, ease: [0.16, 1, 0.3, 1] }
  });

  return (
    <div className="ent-page res-page">
      {/* ─── Hero ─── */}
      <header className="res-hero">
        <div className="container">
          <nav className="ent-breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <ChevronRight size={13} aria-hidden="true" />
            <span>Company</span>
            <ChevronRight size={13} aria-hidden="true" />
            <span className="crumb-current" aria-current="page">Contact Us</span>
          </nav>

          <div className="res-hero-inner">
            <p className="ent-hero-eyebrow"><Headset size={13} aria-hidden="true" /> Contact FerroBid</p>
            <h1 className="res-hero-title">Four desks. Pick the one that owns your question.</h1>
            <p className="res-hero-lead">
              Writing to the right desk is the difference between an answer today and a forwarded
              email. Each one below states what it handles and how fast it replies — and those
              targets are what we hold ourselves to, not aspirations.
            </p>

            <ul className="res-facts">
              <li>
                <p className="res-fact-label"><Phone size={12} aria-hidden="true" />Toll-free</p>
                <p className="res-fact-value">1800 266 3300</p>
              </li>
              <li>
                <p className="res-fact-label"><Clock size={12} aria-hidden="true" />Support hours</p>
                <p className="res-fact-value">Mon–Sat, 9–8 IST</p>
              </li>
              <li>
                <p className="res-fact-label"><Zap size={12} aria-hidden="true" />Typical reply</p>
                <p className="res-fact-value">Same business day</p>
              </li>
              <li>
                <p className="res-fact-label"><Building2 size={12} aria-hidden="true" />Offices</p>
                <p className="res-fact-value">{OFFICES.length} across India</p>
              </li>
            </ul>
          </div>
        </div>
      </header>

      {/* ─── Desks ─── */}
      <section className="ent-section">
        <div className="container">
          <motion.div className="sec-head" {...reveal}>
            <p className="sec-eyebrow">Reach the right desk</p>
            <h2 className="sec-title">Who handles what.</h2>
            <p className="sec-lead">
              All four are staffed by people who can act, not a shared inbox that routes onwards.
            </p>
          </motion.div>

          {/* The card is a plain <div>, never a <Link>. Each one already
              contains mailto: and tel: anchors, and an anchor cannot nest
              inside another anchor — so the "go here instead" route lives in
              the card footer as its own link. */}
          <div className="res-grid cols-4">
            {DESKS.map((desk, i) => {
              const Icon = desk.icon;
              return (
                <motion.div className="res-card" key={desk.title} {...stagger(i)}>
                  <span className="res-card-icon"><Icon size={17} strokeWidth={1.9} /></span>
                  <h3>{desk.title}</h3>
                  <p>{desk.handles}</p>

                  <div style={{ display: 'grid', gap: '5px', marginTop: '12px' }}>
                    <a
                      href={`mailto:${desk.email}`}
                      style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--primary)', textDecoration: 'none' }}
                    >
                      {desk.email}
                    </a>
                    {desk.phone && (
                      <a
                        href={`tel:${desk.phone.replace(/\s/g, '')}`}
                        style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--dark)', textDecoration: 'none' }}
                      >
                        {desk.phone}
                      </a>
                    )}
                  </div>

                  <div className="res-row-meta">
                    <span className="res-chip">{desk.hours}</span>
                    <span className="res-chip is-nonferrous">{desk.target}</span>
                  </div>

                  {desk.to && (
                    <Link to={desk.to} className="res-card-foot" style={{ textDecoration: 'none' }}>
                      Open the process <ChevronRight size={13} strokeWidth={2.5} />
                    </Link>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Form + what to include ─── */}
      <section className="ent-section alt">
        <div className="container">
          <motion.div className="sec-head" {...reveal}>
            <p className="sec-eyebrow">Send a message</p>
            <h2 className="sec-title">Or write to us here.</h2>
            <p className="sec-lead">
              The lot ID and urgency fields are not decoration — they route the message to the desk
              that can resolve it and set its place in the queue.
            </p>
          </motion.div>

          <div className="ent-split">
            <div className="ent-card" style={{ padding: '28px' }}>
              {sent ? (
                <div className="ent-form-success">
                  <CheckCircle2 size={18} /> Message received. You will get a confirmation by email, and the owning desk will respond within its published target.
                </div>
              ) : (
                <form className="ent-form" onSubmit={e => { e.preventDefault(); setSent(true); }}>
                  <div className="ent-form-row">
                    <div className="ent-field">
                      <label htmlFor="c-name">Full name <span className="req">*</span></label>
                      <input id="c-name" className="ent-input" required placeholder="Your name" />
                    </div>
                    <div className="ent-field">
                      <label htmlFor="c-company">Company</label>
                      <input id="c-company" className="ent-input" placeholder="Registered entity name" />
                    </div>
                  </div>

                  <div className="ent-form-row">
                    <div className="ent-field">
                      <label htmlFor="c-email">Work email <span className="req">*</span></label>
                      <input id="c-email" type="email" className="ent-input" required placeholder="you@company.com" />
                    </div>
                    <div className="ent-field">
                      <label htmlFor="c-phone">Mobile</label>
                      <input id="c-phone" type="tel" className="ent-input" placeholder="+91" />
                    </div>
                  </div>

                  <div className="ent-form-row">
                    <div className="ent-field">
                      <label htmlFor="c-topic">Topic <span className="req">*</span></label>
                      <select id="c-topic" required defaultValue="">
                        <option value="" disabled>Select…</option>
                        <option>Buyer registration &amp; KYC</option>
                        <option>Bidding &amp; auctions</option>
                        <option>EMD, payments &amp; refunds</option>
                        <option>Lifting &amp; logistics</option>
                        <option>Seller onboarding</option>
                        <option>Partnership or enterprise</option>
                        <option>Something else</option>
                      </select>
                    </div>
                    <div className="ent-field">
                      <label htmlFor="c-urgency">Urgency</label>
                      <select id="c-urgency" defaultValue="">
                        <option value="" disabled>Select…</option>
                        <option>General — no deadline</option>
                        <option>Auction closing soon</option>
                        <option>Payment deadline today</option>
                        <option>Vehicle at the gate</option>
                      </select>
                    </div>
                  </div>

                  <div className="ent-field">
                    <label htmlFor="c-lot">Lot / Transaction ID</label>
                    <input id="c-lot" className="ent-input" placeholder="FA-XXXXXXX — if your question is about a specific lot" />
                  </div>

                  <div className="ent-field">
                    <label htmlFor="c-msg">Message <span className="req">*</span></label>
                    <textarea id="c-msg" className="ent-textarea" required placeholder="What you expected, what happened, and any dates or amounts involved." />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start' }}>
                    <Send size={16} style={{ marginRight: '8px' }} /> Send message
                  </button>
                </form>
              )}
            </div>

            <aside className="ent-aside-sticky" style={{ display: 'grid', gap: '14px' }}>
              <div className="ent-contact-card">
                <div className="ci"><Clock size={20} /></div>
                <div>
                  <h4>Business hours</h4>
                  <p>Mon – Fri: 9:00 AM – 8:00 PM IST<br />Saturday: 10:00 AM – 4:00 PM IST<br />Sunday &amp; public holidays: closed</p>
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
                <div className="ci"><ShieldCheck size={20} /></div>
                <div>
                  <h4>Not satisfied with a reply?</h4>
                  <Link to="/grievance">Escalate through Grievance Redressal →</Link>
                </div>
              </div>
              <div className="ent-contact-card">
                <div className="ci"><HelpCircle size={20} /></div>
                <div>
                  <h4>Faster than writing</h4>
                  <Link to="/faqs">41 answers in the FAQ →</Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ─── What to include ─── */}
      <section className="res-band">
        <div className="container">
          <motion.div className="sec-head" {...reveal}>
            <p className="sec-eyebrow">Help us help you</p>
            <h2 className="sec-title">Four details that save a day.</h2>
            <p className="sec-lead">
              A first reply that has to ask for information costs a full cycle. Include these and the
              desk can act on your message instead of answering it with a question.
            </p>
          </motion.div>

          <div className="res-grid cols-4">
            {INCLUDE.map((item, i) => (
              <motion.article className="res-band-card" key={item.k} {...stagger(i)}>
                <span className="res-band-icon"><ClipboardList size={17} strokeWidth={1.9} /></span>
                <h3>{item.k}</h3>
                <p>{item.v}</p>
              </motion.article>
            ))}
          </div>

          <p className="res-band-note">
            We can only discuss an account with the email address it is registered to. If you are
            writing on behalf of a colleague, ask them to copy you in rather than writing as them.
          </p>
        </div>
      </section>

      {/* ─── Offices ─── */}
      <section className="ent-section">
        <div className="container">
          <motion.div className="sec-head" {...reveal}>
            <p className="sec-eyebrow">Our offices</p>
            <h2 className="sec-title">Where we actually are.</h2>
            <p className="sec-lead">
              Visits are by appointment — the operations hub in particular is a working site, not a
              front office.
            </p>
          </motion.div>

          <div className="res-grid cols-3">
            {OFFICES.map((office, i) => (
              <motion.article className="res-card" key={office.city} {...stagger(i)}>
                <span className="res-chip is-nonferrous">{office.tag}</span>
                <h3 style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={15} strokeWidth={2} style={{ color: 'var(--primary)' }} aria-hidden="true" />
                  {office.city}
                </h3>
                <p style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <MapPin size={13} strokeWidth={2} style={{ flexShrink: 0, marginTop: '3px', color: 'var(--primary)' }} aria-hidden="true" />
                  {office.addr}
                </p>
                <p style={{ fontSize: '12.5px', color: 'var(--dark)', fontWeight: 600 }}>{office.role}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Where next ─── */}
      <section className="ent-section alt">
        <div className="container">
          <div className="res-grid cols-3">
            <Link to="/help-center" className="res-card">
              <span className="res-card-icon"><LifeBuoy size={17} strokeWidth={1.9} /></span>
              <h3>Help Center</h3>
              <p>Six common situations with the actual next step — most need no contact at all.</p>
              <span className="res-card-foot">Find your situation <ChevronRight size={13} strokeWidth={2.5} /></span>
            </Link>
            <Link to="/knowledge-center" className="res-card">
              <span className="res-card-icon"><Users size={17} strokeWidth={1.9} /></span>
              <h3>Knowledge Center</h3>
              <p>Grade reference, document checklists and the trade glossary.</p>
              <span className="res-card-foot">Open the reference <ChevronRight size={13} strokeWidth={2.5} /></span>
            </Link>
            <Link to="/grievance" className="res-card">
              <span className="res-card-icon"><Scale size={17} strokeWidth={1.9} /></span>
              <h3>Grievance Redressal</h3>
              <p>Formal complaints — ticketed, acknowledged in 24 hours, with published escalation.</p>
              <span className="res-card-foot">Raise a complaint <ChevronRight size={13} strokeWidth={2.5} /></span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ContactUs;
