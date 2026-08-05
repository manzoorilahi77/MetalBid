/* ---------------------------------------------------------------------------
   Grievance Redressal

   Somebody opens this page because a trade went wrong and they want to know
   two things: how long until someone looks at it, and what happens if the
   answer is unsatisfactory. The previous version had the four-step process and
   an escalation table but nothing a complainant could act on — no statement of
   what to attach, no way to check a ticket, and no mention of the statutory
   backstop that exists behind our own SLA.

   This version leads with the timings, states the rights that sit behind them,
   and tells the reader exactly what evidence makes a complaint resolvable.
--------------------------------------------------------------------------- */
import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Scale, Clock, UserCheck, CheckCircle2, Mail, Send, Check,
  ChevronRight, Ticket, Search, Info, ShieldCheck, Timer,
  FileSearch, Gavel, Landmark, ClipboardList
} from 'lucide-react';
import { Accordion } from '../components/PageShell';
import '../styles/enterprise.css';
import '../styles/support.css';

/* The numbers a complainant is actually looking for, stated before anything
   else on the page. */
const PLEDGE = [
  { value: '24 hrs', label: 'Acknowledgement', note: 'Ticket number issued by email and SMS.' },
  { value: '7 days', label: 'First resolution', note: 'Working days, from the Grievance Officer.' },
  { value: '3', label: 'Escalation levels', note: 'Each with a named owner and its own SLA.' },
  { value: '30 days', label: 'Outer limit', note: 'Statutory backstop for e-commerce grievances.' }
];

const STEPS = [
  {
    n: '01', when: 'Day 0', title: 'Raise it',
    desc: 'Submit the form below or email the Grievance Officer with your lot or transaction ID and any supporting evidence.'
  },
  {
    n: '02', when: 'Within 24 hrs', title: 'Acknowledgement',
    desc: 'You receive a ticket number by email and SMS, plus the name of the officer who owns the case.'
  },
  {
    n: '03', when: 'Day 1–5', title: 'Investigation',
    desc: 'We pull the inspection report, bid log, weighbridge slip and payment records for the transaction and assess them against your account.'
  },
  {
    n: '04', when: 'By day 7', title: 'Resolution',
    desc: 'A written outcome with reasons. If corrective action is due — a refund, adjustment or re-inspection — the letter states when it will complete.'
  }
];

/* A complaint stalls for one reason more than any other: it arrives without
   the record needed to check it. Say so up front. */
const EVIDENCE = [
  { k: 'Lot or transaction ID', v: 'The FA-number on your sale confirmation letter. Without it we are searching by guesswork.' },
  { k: 'What you expected vs what you got', v: 'Stated plainly. "Grade below listing" is actionable; "poor quality" is not.' },
  { k: 'Dated photographs', v: 'Taken at the gate or on arrival, showing the material and, where possible, the vehicle.' },
  { k: 'Weighbridge slip', v: 'Essential for any quantity or short-weight claim. Raise weight disputes at the gate, before the vehicle leaves.' },
  { k: 'Payment reference', v: 'UTR or UPI reference for any payment or refund issue, with the date and amount.' },
  { k: 'What outcome you want', v: 'Refund, adjustment, re-inspection or replacement. It shapes which team picks the case up.' }
];

const LEVELS = [
  {
    badge: 'L1', name: 'Support Desk', role: 'Customer Support Team',
    sla: '48 hours', contact: 'support@ferrobid.in',
    scope: 'First response on any issue — bidding, KYC, payments, lifting.'
  },
  {
    badge: 'L2', name: 'Grievance Officer', role: 'Nodal Grievance Officer',
    sla: '7 working days', contact: 'grievance@ferrobid.in',
    scope: 'Formal complaints, and anything unresolved at Level 1.'
  },
  {
    badge: 'L3', name: 'Head of Operations', role: 'Operations Leadership',
    sla: '15 working days', contact: 'escalations@ferrobid.in',
    scope: 'Disputed outcomes, repeat failures, and cases involving multiple lots.'
  }
];

/* The rights are real and worth stating: an e-commerce platform in India owes
   these regardless of what its own policy says. */
const RIGHTS = [
  {
    icon: Clock, title: 'A response within fixed time',
    text: 'A grievance officer must acknowledge your complaint within 48 hours and redress it within one month of receipt. Our own SLA is tighter, but that is the floor you are entitled to.'
  },
  {
    icon: UserCheck, title: 'A named officer',
    text: 'You are entitled to the name and contact details of the grievance officer handling your case — not a shared inbox with nobody accountable behind it.'
  },
  {
    icon: FileSearch, title: 'Reasons, in writing',
    text: 'If a complaint is rejected, you get the reasoning and the records it was based on — not a one-line decline.'
  },
  {
    icon: ShieldCheck, title: 'No penalty for complaining',
    text: 'Raising a grievance never affects your account standing, your bidding access, or your position on any open lot.'
  },
  {
    icon: Gavel, title: 'Escalation beyond us',
    text: 'If our process fails you, the National Consumer Helpline and the consumer commissions remain open to you. Using our process first does not waive that.'
  },
  {
    icon: Landmark, title: 'Your records, on request',
    text: 'You can ask for the inspection report, bid log and settlement working for your own transaction at any time, complaint or not.'
  }
];

const FAQ = [
  { q: 'What can I raise a grievance about?', a: 'Material discrepancies, payment or refund issues, auction conduct concerns, KYC delays, or any conduct that violates our platform policies.' },
  { q: 'How do I track my complaint?', a: 'Use the ticket number sent in your acknowledgement email. You can quote it in any follow-up, enter it in the tracker above, or check status via the support desk.' },
  { q: 'What if my grievance is not resolved in time?', a: 'If a resolution is not provided within the stated SLA, the complaint is automatically eligible for escalation to the next level in the matrix above. You do not need to re-file — quote the same ticket number.' },
  { q: 'Can I raise a grievance about a lot I have already lifted?', a: 'Yes, but it is much harder to substantiate. Quantity and condition disputes should be raised at the gate before the vehicle leaves, and material you intend to dispute should not be lifted or processed.' },
  { q: 'Is there a time limit for raising a complaint?', a: 'Discrepancy claims must be raised within the window stated on your sale confirmation letter. Payment, refund and conduct issues can be raised at any time, though evidence naturally weakens as records age.' },
  { q: 'Will raising a complaint affect my bidding access?', a: 'No. A grievance is not a mark against your account. Access is only ever restricted for non-payment, invalid KYC or conduct breaches — never for complaining.' }
];

export const Grievance = () => {
  const reduceMotion = useReducedMotion();
  const [sent, setSent] = useState(false);
  const [ticket, setTicket] = useState('');
  const [lookup, setLookup] = useState(null);

  /* Transform-only reveals: if a viewport callback never fires, a section is
     still fully readable — just a few pixels low. */
  const reveal = reduceMotion ? {} : {
    initial: { y: 18 },
    whileInView: { y: 0 },
    viewport: { once: true, amount: 0.12 },
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
  };

  const stagger = i => (reduceMotion ? {} : {
    initial: { y: 20 },
    whileInView: { y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: 0.5, delay: Math.min(i, 4) * 0.07, ease: [0.16, 1, 0.3, 1] }
  });

  return (
    <div className="ent-page doc-page">
      {/* ─── Hero ─── */}
      <header className="gr-hero">
        <div className="container">
          <nav className="ent-breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <ChevronRight size={13} aria-hidden="true" />
            <span>Support</span>
            <ChevronRight size={13} aria-hidden="true" />
            <span className="crumb-current" aria-current="page">Grievance Redressal</span>
          </nav>

          <div className="gr-hero-inner">
            <p className="ent-hero-eyebrow"><Scale size={13} aria-hidden="true" /> Grievance Redressal</p>
            <h1 className="doc-hero-title">Something went wrong. Here is exactly what happens next.</h1>
            <p className="doc-hero-lead">
              Every complaint gets a ticket number, a named officer and a deadline. If the first
              answer does not settle it, there are two more levels above it — each published,
              each with its own clock.
            </p>
          </div>

          <ul className="gr-pledge">
            {PLEDGE.map((item, i) => (
              <motion.li className="gr-pledge-card" key={item.label} {...stagger(i)}>
                <p className="gr-pledge-val">{item.value}</p>
                <p className="gr-pledge-label">{item.label}</p>
                <p className="gr-pledge-note">{item.note}</p>
              </motion.li>
            ))}
          </ul>
        </div>
      </header>

      {/* ─── Process ─── */}
      <section className="ent-section">
        <div className="container">
          <motion.div className="sec-head" {...reveal}>
            <p className="sec-eyebrow">How it works</p>
            <h2 className="sec-title">Four stages, each with a clock on it.</h2>
            <p className="sec-lead">
              Ownership changes hands at every stage, and every hand-off is dated. You are never
              left wondering who is holding your case.
            </p>
          </motion.div>

          <ol className="gr-steps">
            {STEPS.map((step, i) => (
              <motion.li className="gr-step" key={step.n} {...stagger(i)}>
                <div className="gr-step-top">
                  <span className="gr-step-n">{step.n}</span>
                  <span className="gr-step-when">{step.when}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      {/* ─── Your rights (dark band) ─── */}
      <section className="gr-rights">
        <div className="container">
          <motion.div className="sec-head" {...reveal}>
            <p className="sec-eyebrow">Your rights</p>
            <h2 className="sec-title">What you are owed, regardless of our policy.</h2>
            <p className="sec-lead">
              An e-commerce platform operating in India carries statutory redressal duties. Our
              own service levels are tighter than the floor below — but the floor is yours by
              right, not by our goodwill.
            </p>
          </motion.div>

          <div className="gr-rights-grid">
            {RIGHTS.map((right, i) => {
              const Icon = right.icon;
              return (
                <motion.article className="gr-right" key={right.title} {...stagger(i)}>
                  <span className="gr-right-icon"><Icon size={17} strokeWidth={1.9} /></span>
                  <h3>{right.title}</h3>
                  <p>{right.text}</p>
                </motion.article>
              );
            })}
          </div>

          <p className="gr-rights-note">
            Timelines above reflect the Consumer Protection (E-Commerce) Rules, 2020. Nothing on
            this page limits any remedy otherwise available to you under law.
          </p>
        </div>
      </section>

      {/* ─── What to include ─── */}
      <section className="ent-section">
        <div className="container">
          <motion.div className="sec-head" {...reveal}>
            <p className="sec-eyebrow">Before you submit</p>
            <h2 className="sec-title">Six things that make a complaint resolvable.</h2>
            <p className="sec-lead">
              Complaints stall for one reason more than any other: they arrive without the record
              needed to check them. Attach these and the case moves on day one.
            </p>
          </motion.div>

          <ul className="gr-check">
            {EVIDENCE.map((item, i) => (
              <motion.li key={item.k} {...stagger(i)}>
                <span className="gr-check-mark"><Check size={13} strokeWidth={3} /></span>
                <span><strong>{item.k}</strong>{item.v}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      </section>

      {/* ─── Form + officer ─── */}
      <section className="ent-section alt">
        <div className="container">
          <motion.div className="sec-head" {...reveal}>
            <p className="sec-eyebrow">Submit a complaint</p>
            <h2 className="sec-title">Raise it here, or write to the officer directly.</h2>
            <p className="sec-lead">
              Either route creates the same ticket and starts the same 24-hour acknowledgement
              clock. Use whichever is faster for you.
            </p>
          </motion.div>

          <div className="ent-split">
            <div className="ent-card" style={{ padding: '28px' }}>
              {sent ? (
                <div className="ent-form-success">
                  <CheckCircle2 size={18} /> Complaint received. Your ticket number has been sent to your email. We'll acknowledge within 24 hours.
                </div>
              ) : (
                <form className="ent-form" onSubmit={e => { e.preventDefault(); setSent(true); }}>
                  <div className="ent-form-row">
                    <div className="ent-field">
                      <label htmlFor="g-name">Full name <span className="req">*</span></label>
                      <input id="g-name" className="ent-input" required />
                    </div>
                    <div className="ent-field">
                      <label htmlFor="g-id">Lot / Transaction ID</label>
                      <input id="g-id" className="ent-input" placeholder="FA-XXXXXXX" />
                    </div>
                  </div>
                  <div className="ent-form-row">
                    <div className="ent-field">
                      <label htmlFor="g-email">Email <span className="req">*</span></label>
                      <input id="g-email" type="email" className="ent-input" required />
                    </div>
                    <div className="ent-field">
                      <label htmlFor="g-type">Category <span className="req">*</span></label>
                      <select id="g-type" required defaultValue="">
                        <option value="" disabled>Select…</option>
                        <option>Material discrepancy</option>
                        <option>Quantity / short weight</option>
                        <option>Payment / refund</option>
                        <option>Auction conduct</option>
                        <option>KYC / verification delay</option>
                        <option>Lifting / logistics</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="ent-form-row">
                    <div className="ent-field">
                      <label htmlFor="g-outcome">Outcome you are seeking</label>
                      <select id="g-outcome" defaultValue="">
                        <option value="" disabled>Select…</option>
                        <option>Refund</option>
                        <option>Price adjustment</option>
                        <option>Re-inspection</option>
                        <option>Replacement lot</option>
                        <option>Explanation only</option>
                      </select>
                    </div>
                    <div className="ent-field">
                      <label htmlFor="g-date">Date of incident</label>
                      <input id="g-date" type="date" className="ent-input" />
                    </div>
                  </div>
                  <div className="ent-field">
                    <label htmlFor="g-desc">Describe your grievance <span className="req">*</span></label>
                    <textarea id="g-desc" className="ent-textarea" required placeholder="What you expected, what you received, and any dates, weights and amounts involved." />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start' }}>
                    <Send size={16} style={{ marginRight: '8px' }} /> Submit complaint
                  </button>
                </form>
              )}
            </div>

            <aside className="ent-aside-sticky" style={{ display: 'grid', gap: '14px' }}>
              <div className="ent-contact-card">
                <div className="ci"><UserCheck size={20} /></div>
                <div>
                  <h4>Nodal Grievance Officer</h4>
                  <p>Ms. A. Iyer, Grievance Officer<br />FerroBid, Bengaluru</p>
                </div>
              </div>
              <div className="ent-contact-card">
                <div className="ci"><Mail size={20} /></div>
                <div>
                  <h4>Email</h4>
                  <a href="mailto:grievance@ferrobid.in">grievance@ferrobid.in</a>
                </div>
              </div>
              <div className="ent-contact-card">
                <div className="ci"><Timer size={20} /></div>
                <div>
                  <h4>Resolution SLA</h4>
                  <p>Acknowledgement: 24 hours<br />Resolution: up to 7 working days</p>
                </div>
              </div>
              <div className="ent-contact-card">
                <div className="ci"><ClipboardList size={20} /></div>
                <div>
                  <h4>Office hours</h4>
                  <p>Mon–Sat, 9 AM–8 PM IST<br />Complaints are logged around the clock</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ─── Escalation ladder ─── */}
      <section className="ent-section">
        <div className="container">
          <motion.div className="sec-head" {...reveal}>
            <p className="sec-eyebrow">Escalation matrix</p>
            <h2 className="sec-title">If the answer does not settle it.</h2>
            <p className="sec-lead">
              A complaint that misses its SLA becomes eligible for the next level automatically.
              You do not re-file — quote the same ticket number and it moves up with its history.
            </p>
          </motion.div>

          <div className="gr-ladder">
            {LEVELS.map((level, i) => (
              <motion.div className="gr-level" key={level.badge} {...stagger(i)}>
                <span className="gr-level-badge">{level.badge}</span>
                <div>
                  <p className="gr-level-name">{level.name}</p>
                  <p className="gr-level-role">{level.role} — {level.scope}</p>
                </div>
                <span className="gr-level-sla">
                  <Clock size={14} strokeWidth={2} aria-hidden="true" />{level.sla}
                </span>
                <a className="gr-level-contact" href={`mailto:${level.contact}`}>{level.contact}</a>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Ticket tracker ─── */}
      <section className="ent-section alt">
        <div className="container">
          <motion.div className="sec-head" {...reveal}>
            <p className="sec-eyebrow">Track a complaint</p>
            <h2 className="sec-title">Check where your ticket has reached.</h2>
            <p className="sec-lead">
              Enter the reference from your acknowledgement email to see the current stage, the
              officer holding it, and the date its SLA expires.
            </p>
          </motion.div>

          <motion.div {...reveal}>
            <form
              className="gr-track"
              onSubmit={e => {
                e.preventDefault();
                setLookup(ticket.trim() ? 'found' : 'empty');
              }}
            >
              <Ticket size={17} aria-hidden="true" />
              <input
                value={ticket}
                onChange={e => setTicket(e.target.value)}
                placeholder="Ticket number — e.g. GRV-2026-04812"
                aria-label="Ticket number"
              />
              <button type="submit"><Search size={14} strokeWidth={2.5} style={{ marginRight: '6px' }} />Track</button>
            </form>

            {lookup && (
              <div className="gr-track-result">
                <Info size={15} strokeWidth={2} aria-hidden="true" />
                <span>
                  {lookup === 'empty'
                    ? <>Enter the ticket number from your acknowledgement email — it looks like <strong>GRV-2026-04812</strong>.</>
                    : <>Live ticket status is available once you are signed in. <Link to="/auth">Sign in</Link> to see the full history for <strong>{ticket.trim()}</strong>, or quote it to the support desk and they will read it out.</>}
                </span>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="ent-section">
        <div className="container">
          <motion.div className="sec-head" {...reveal}>
            <p className="sec-eyebrow">Common questions</p>
            <h2 className="sec-title">Before you raise one.</h2>
          </motion.div>
          <div style={{ maxWidth: '840px' }}>
            <Accordion items={FAQ} defaultOpen={0} />
          </div>
        </div>
      </section>

      {/* ─── Close ─── */}
      <section className="ent-section alt">
        <div className="container">
          <div className="faq-help-grid">
            <Link to="/contact" className="faq-help-card">
              <span className="faq-help-icon"><Mail size={17} strokeWidth={1.9} /></span>
              <h4>Talk to support first</h4>
              <p>Many issues — a delayed refund, a missing invoice — are settled at Level 1 the same day.</p>
              <span className="faq-help-value">Contact the desk <ChevronRight size={13} strokeWidth={2.5} /></span>
            </Link>
            <Link to="/faqs" className="faq-help-card">
              <span className="faq-help-icon"><Scale size={17} strokeWidth={1.9} /></span>
              <h4>Check the FAQs</h4>
              <p>Weighment, lifting windows and payment deadlines are covered in detail.</p>
              <span className="faq-help-value">Read the answers <ChevronRight size={13} strokeWidth={2.5} /></span>
            </Link>
            <Link to="/terms" className="faq-help-card">
              <span className="faq-help-icon"><Gavel size={17} strokeWidth={1.9} /></span>
              <h4>Read the terms</h4>
              <p>Dispute resolution, governing law and the obligations on each side of a trade.</p>
              <span className="faq-help-value">Terms &amp; Conditions <ChevronRight size={13} strokeWidth={2.5} /></span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Grievance;
