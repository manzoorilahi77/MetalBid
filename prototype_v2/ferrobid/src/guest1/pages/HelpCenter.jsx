/* ---------------------------------------------------------------------------
   Help Center

   The old page was a second FAQ index — six category cards with invented
   article counts, every one linking to /faqs. With a real forty-one answer FAQ
   now in place, duplicating it is worse than useless.

   So this page takes the job nothing else does: triage. It routes by what the
   reader is trying to do right now ("my refund has not arrived", "I won a lot,
   what happens next"), gives the actual next action rather than a category,
   and states plainly which channel answers what and how fast.
--------------------------------------------------------------------------- */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  LifeBuoy, ChevronRight, ChevronDown, Rocket, BadgeCheck, Trophy,
  Wallet, PackageX, Factory, Clock, Headset, Mail, Scale,
  BookOpen, HelpCircle, ClipboardList, Zap
} from 'lucide-react';
import '../styles/enterprise.css';
/* The accordion, step and answer-meta styles are shared with the support
   pages rather than duplicated here. */
import '../styles/support.css';
import '../styles/resources.css';

/* ─── Intent router ────────────────────────────────────────────────────────
   Six situations that account for most inbound contact. Each opens to the
   actual next action, not to a category page. */
const INTENTS = [
  {
    id: 'start', icon: Rocket, title: 'I want to start bidding',
    line: 'New account, first lot.',
    steps: [
      'Register and submit enterprise KYC — GST certificate, PAN, incorporation document and signatory ID.',
      'Wait for approval. Most submissions clear in 24–48 business hours and you are notified by email and SMS.',
      'Pay the EMD shown on the lot you want. EMD is per lot, not per account.',
      'Bid during the live window. Remember the clock extends if late bids arrive.'
    ],
    link: { to: '/auth?tab=register', label: 'Create an account' }
  },
  {
    id: 'kyc', icon: BadgeCheck, title: 'My KYC is still pending',
    line: 'Submitted, not yet approved.',
    steps: [
      'Check the clock: 24–48 business hours is normal. A Friday evening submission will sit over the weekend.',
      'Check your email — including spam — for a rejection notice. Rejections name the specific document at fault.',
      'The most common causes are an entity-name mismatch between GST and PAN, an expired document, or an unreadable scan.',
      'Correct only the flagged item and resubmit. You do not need to start the application again.'
    ],
    link: { to: '/faqs', label: 'KYC questions' }
  },
  {
    id: 'won', icon: Trophy, title: 'I won a lot — what now?',
    line: 'From winning bid to material in your yard.',
    steps: [
      'Read the sale confirmation letter. It carries the operative payment deadline and lifting window — not this page.',
      'Pay the balance within the stated window, usually 24–72 hours. EMD is already credited against it.',
      'Once payment reconciles, a delivery order is issued. Material is not released without it.',
      'Arrange lifting inside the window. Bring the delivery order, e-way bill and transporter documents to the gate.'
    ],
    link: { to: '/faqs', label: 'Payment & lifting answers' }
  },
  {
    id: 'refund', icon: Wallet, title: 'My EMD refund has not arrived',
    line: 'Lost the lot, waiting on money.',
    steps: [
      'Refunds are released automatically once the auction closes — there is nothing to request.',
      'Bank credit timelines sit outside our control; NEFT and RTGS returns can take a further working day.',
      'Confirm the refund is going to the account registered in your KYC. Payouts go only to the verified account.',
      'Still missing after three working days? Contact the finance desk with the lot ID and the original payment reference.'
    ],
    link: { to: '/contact', label: 'Contact finance' }
  },
  {
    id: 'wrong', icon: PackageX, title: 'The material is not what was listed',
    line: 'Quantity, grade or condition dispute.',
    steps: [
      'Do not lift, process or melt material you intend to dispute. Once it moves, a claim is very hard to substantiate.',
      'Raise weight disputes at the gate, before the vehicle leaves. The nominated weighbridge is the reference.',
      'Photograph the material dated, at the gate or on arrival, with the vehicle in frame where possible.',
      'File a grievance with the lot ID, the inspection report reference and your evidence. Acknowledged within 24 hours.'
    ],
    link: { to: '/grievance', label: 'Raise a grievance' }
  },
  {
    id: 'sell', icon: Factory, title: 'I want to sell material',
    line: 'Listing a lot as a seller.',
    steps: [
      'Complete seller onboarding — the buyer document set, plus proof of title and your yard address.',
      'Submit an auction request. Sellers submit requests; they do not create live auctions directly.',
      'A site officer inspects and GPS-tags the material. Booking this visit is usually the longest step, so book early.',
      'An executive approves the catalog, then the lot publishes to the verified buyer pool.'
    ],
    link: { to: '/auth?tab=register', label: 'List with FerroBid' }
  }
];

/* ─── Who answers what, and how fast ──────────────────────────────────────── */
const CHANNELS = [
  { channel: 'Support desk', handles: 'Bidding, KYC, account access, general questions', hours: 'Mon–Sat, 9 AM–8 PM IST', target: 'Same business day', contact: 'support@ferrobid.in' },
  { channel: 'Finance desk', handles: 'EMD, refunds, invoices, settlement and payment references', hours: 'Mon–Fri, 9 AM–6 PM IST', target: '1 business day', contact: 'support@ferrobid.in' },
  { channel: 'Enterprise / onboarding', handles: 'Seller onboarding, bulk buyer setup, partnerships', hours: 'Mon–Fri, 9 AM–6 PM IST', target: '1 business day', contact: 'enterprise@ferrobid.in' },
  { channel: 'Grievance Officer', handles: 'Formal complaints, disputes, escalations', hours: 'Logged 24/7', target: 'Acknowledged in 24 hrs', contact: 'grievance@ferrobid.in' },
  { channel: 'Privacy desk', handles: 'Data access, correction and erasure requests', hours: 'Mon–Fri', target: 'Acknowledged in 72 hrs', contact: 'privacy@ferrobid.in' }
];

/* ─── Resolvable without us ───────────────────────────────────────────────── */
const SELF_SERVE = [
  { q: 'The auction clock keeps moving and will not close.', a: 'That is auto-extension working. Late bids push the closing time out, repeatedly, so a lot closes on price rather than on connection speed. It will close once bidding stops.' },
  { q: 'I cannot see the live bid value.', a: 'Live bid values and bid counts require an active subscription. Lots, inspection reports and closing times stay visible to everyone.' },
  { q: 'I want to cancel a bid I just placed.', a: 'A bid is irrevocable — it cannot be withdrawn, reduced or cancelled. Contacting support will not change this, so check quantity and lot number before confirming.' },
  { q: 'I am locked out of my account.', a: 'Use the password reset on the login page first. Only if the account is locked for a security reason does it need a person, and then you must write from your registered email address.' },
  { q: 'I want to stop the SMS messages.', a: 'Reply STOP to any message, or disable SMS in account settings. Keep email on — payment deadlines are time-critical and a missed window can forfeit EMD.' }
];

export const HelpCenter = () => {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState('start');
  const [openSelf, setOpenSelf] = useState(null);

  const reveal = reduceMotion ? {} : {
    initial: { y: 18 },
    whileInView: { y: 0 },
    viewport: { once: true, amount: 0.1 },
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
  };

  const stagger = i => (reduceMotion ? {} : {
    initial: { y: 20 },
    whileInView: { y: 0 },
    viewport: { once: true, amount: 0.15 },
    transition: { duration: 0.5, delay: Math.min(i, 4) * 0.06, ease: [0.16, 1, 0.3, 1] }
  });

  return (
    <div className="ent-page res-page">
      {/* ─── Hero ─── */}
      <header className="res-hero">
        <div className="container">
          <nav className="ent-breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <ChevronRight size={13} aria-hidden="true" />
            <span>Resources</span>
            <ChevronRight size={13} aria-hidden="true" />
            <span className="crumb-current" aria-current="page">Help Center</span>
          </nav>

          <div className="res-hero-inner">
            <p className="ent-hero-eyebrow"><LifeBuoy size={13} aria-hidden="true" /> Help Center</p>
            <h1 className="res-hero-title">Tell us what you are trying to do.</h1>
            <p className="res-hero-lead">
              Not a list of categories — the actual next step for the six situations people contact
              us about most. If yours is here, you can probably finish it without waiting for anyone.
            </p>

            <ul className="res-facts">
              <li>
                <p className="res-fact-label"><Clock size={12} aria-hidden="true" />Support hours</p>
                <p className="res-fact-value">Mon–Sat, 9–8 IST</p>
              </li>
              <li>
                <p className="res-fact-label"><Zap size={12} aria-hidden="true" />Typical reply</p>
                <p className="res-fact-value">Same business day</p>
              </li>
              <li>
                <p className="res-fact-label"><Scale size={12} aria-hidden="true" />Grievance ack</p>
                <p className="res-fact-value">Within 24 hrs</p>
              </li>
              <li>
                <p className="res-fact-label"><HelpCircle size={12} aria-hidden="true" />Self-serve answers</p>
                <p className="res-fact-value">41 in the FAQ</p>
              </li>
            </ul>
          </div>
        </div>
      </header>

      {/* ─── Intent router ─── */}
      <section className="ent-section">
        <div className="container">
          <motion.div className="sec-head" {...reveal}>
            <p className="sec-eyebrow">Start here</p>
            <h2 className="sec-title">Six situations, and what to actually do.</h2>
            <p className="sec-lead">
              Open the one that matches. Each gives the sequence in order, including the part people
              usually get wrong.
            </p>
          </motion.div>

          <div className="res-rows">
            {INTENTS.map((intent, i) => {
              const Icon = intent.icon;
              const isOpen = open === intent.id;
              return (
                <motion.div key={intent.id} {...stagger(i)}>
                  <div className={`faq-item${isOpen ? ' is-open' : ''}`}>
                    <h3 style={{ margin: 0 }}>
                      <button
                        type="button"
                        className="faq-q"
                        aria-expanded={isOpen}
                        onClick={() => setOpen(isOpen ? null : intent.id)}
                      >
                        <span className="res-row-icon" aria-hidden="true"><Icon size={16} strokeWidth={1.9} /></span>
                        <span className="faq-q-text">
                          {intent.title}
                          <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, color: 'var(--text-muted)', marginTop: '2px' }}>
                            {intent.line}
                          </span>
                        </span>
                        <span className="faq-chev" aria-hidden="true"><ChevronDown size={15} strokeWidth={2.25} /></span>
                      </button>
                    </h3>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={reduceMotion ? false : { height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div className="faq-a-inner">
                            <ol className="doc-steps" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '10px' }}>
                              {intent.steps.map((step, n) => (
                                <li key={step} style={{ display: 'flex', gap: '11px', fontSize: '13.5px', lineHeight: 1.6, color: 'var(--text-muted)' }}>
                                  <span className="doc-step-n">{String(n + 1).padStart(2, '0')}</span>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ol>
                            <div className="faq-a-meta">
                              <Link to={intent.link.to} className="faq-more">
                                {intent.link.label}
                                <ChevronRight size={13} strokeWidth={2.5} />
                              </Link>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Self-serve ─── */}
      <section className="ent-section alt">
        <div className="container">
          <motion.div className="sec-head" {...reveal}>
            <p className="sec-eyebrow">Before you write to us</p>
            <h2 className="sec-title">Five things that look like faults but are not.</h2>
            <p className="sec-lead">
              These arrive at the support desk daily. Each has an answer you can act on right now,
              and in one case contacting us genuinely cannot help.
            </p>
          </motion.div>

          <div className="faq-list">
            {SELF_SERVE.map((item, i) => {
              const isOpen = openSelf === item.q;
              return (
                <motion.div className={`faq-item${isOpen ? ' is-open' : ''}`} key={item.q} {...stagger(i)}>
                  <h3 style={{ margin: 0 }}>
                    <button
                      type="button"
                      className="faq-q"
                      aria-expanded={isOpen}
                      onClick={() => setOpenSelf(isOpen ? null : item.q)}
                    >
                      <span className="faq-q-text">{item.q}</span>
                      <span className="faq-chev" aria-hidden="true"><ChevronDown size={15} strokeWidth={2.25} /></span>
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={reduceMotion ? false : { height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div className="faq-a-inner">
                          <p className="faq-a-text">{item.a}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Channels ─── */}
      <section className="ent-section">
        <div className="container">
          <motion.div className="sec-head" {...reveal}>
            <p className="sec-eyebrow">Who answers what</p>
            <h2 className="sec-title">Five desks, each with its own clock.</h2>
            <p className="sec-lead">
              Writing to the right desk is the difference between a same-day answer and a forwarded
              email. Response targets below are what we hold ourselves to.
            </p>
          </motion.div>

          <motion.div className="res-table-wrap" {...reveal}>
            <table className="res-table">
              <thead>
                <tr>
                  <th scope="col">Desk</th>
                  <th scope="col">Handles</th>
                  <th scope="col">Hours</th>
                  <th scope="col">Response target</th>
                  <th scope="col">Contact</th>
                </tr>
              </thead>
              <tbody>
                {CHANNELS.map(row => (
                  <tr key={row.channel}>
                    <th scope="row">{row.channel}</th>
                    <td>{row.handles}</td>
                    <td className="num">{row.hours}</td>
                    <td><span className="res-chip is-nonferrous">{row.target}</span></td>
                    <td><a href={`mailto:${row.contact}`} style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>{row.contact}</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>

          <div className="res-note">
            <span className="res-note-icon"><ClipboardList size={15} strokeWidth={2} aria-hidden="true" /></span>
            <p>
              <strong>Include the lot or transaction ID.</strong> It is the single biggest factor in how
              fast anything gets resolved — the FA-number on your sale confirmation letter lets the desk
              pull the inspection report, bid log and payment record in one step.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Where next ─── */}
      <section className="ent-section alt">
        <div className="container">
          <div className="res-grid cols-4">
            <Link to="/faqs" className="res-card">
              <span className="res-card-icon"><HelpCircle size={17} strokeWidth={1.9} /></span>
              <h3>Help &amp; FAQs</h3>
              <p>Forty-one searchable answers, from EMD to e-way bills.</p>
              <span className="res-card-foot">Search the answers <ChevronRight size={13} strokeWidth={2.5} /></span>
            </Link>
            <Link to="/knowledge-center" className="res-card">
              <span className="res-card-icon"><BookOpen size={17} strokeWidth={1.9} /></span>
              <h3>Knowledge Center</h3>
              <p>Grade reference, document checklists and the trade glossary.</p>
              <span className="res-card-foot">Open the reference <ChevronRight size={13} strokeWidth={2.5} /></span>
            </Link>
            <Link to="/grievance" className="res-card">
              <span className="res-card-icon"><Scale size={17} strokeWidth={1.9} /></span>
              <h3>Grievance Redressal</h3>
              <p>Ticketed and time-bound, with a published escalation ladder.</p>
              <span className="res-card-foot">Raise a complaint <ChevronRight size={13} strokeWidth={2.5} /></span>
            </Link>
            <Link to="/contact" className="res-card">
              <span className="res-card-icon"><Headset size={17} strokeWidth={1.9} /></span>
              <h3>Talk to a person</h3>
              <p>Toll-free helpline, direct desk emails and regional offices.</p>
              <span className="res-card-foot">Contact us <ChevronRight size={13} strokeWidth={2.5} /></span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HelpCenter;
