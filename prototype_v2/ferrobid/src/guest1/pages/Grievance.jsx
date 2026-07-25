import React, { useState } from 'react';
import {
  Scale, FileWarning, Clock, UserCheck, ArrowUpDown, CheckCircle2,
  Mail, Phone, ShieldCheck, Send,
} from 'lucide-react';
import { PageHero, SectionHead, RevealGrid, Reveal, Accordion, CTABand } from '../components/PageShell';

const STEPS = [
  { n: '01', title: 'Raise complaint', desc: 'Submit your grievance through the form below or email the Grievance Officer with your lot / transaction ID.' },
  { n: '02', title: 'Acknowledgement', desc: 'You receive a ticket number and acknowledgement within 24 hours by email and SMS.' },
  { n: '03', title: 'Investigation', desc: 'Our team reviews records, inspection reports and transaction logs to assess the issue.' },
  { n: '04', title: 'Resolution', desc: 'A resolution or corrective action is communicated within the applicable SLA window.' },
];

const SLA = [
  { level: 'Level 1 — Support Desk', role: 'Customer Support Team', sla: '48 hours', contact: 'support@ferrobid.in' },
  { level: 'Level 2 — Grievance Officer', role: 'Nodal Grievance Officer', sla: '7 working days', contact: 'grievance@ferrobid.in' },
  { level: 'Level 3 — Head of Operations', role: 'Operations Leadership', sla: '15 working days', contact: 'escalations@ferrobid.in' },
];

const FAQ = [
  { q: 'What can I raise a grievance about?', a: 'Material discrepancies, payment or refund issues, auction conduct concerns, KYC delays, or any conduct that violates our platform policies.' },
  { q: 'How do I track my complaint?', a: 'Use the ticket number sent in your acknowledgement email. You can quote it in any follow-up or check status via the support desk.' },
  { q: 'What if my grievance is not resolved in time?', a: 'If a resolution is not provided within the stated SLA, the complaint is automatically eligible for escalation to the next level in the matrix above.' },
];

export const Grievance = () => {
  const [sent, setSent] = useState(false);

  return (
    <div className="ent-page">
      <PageHero
        eyebrow="Grievance Redressal"
        eyebrowIcon={Scale}
        title={<>A fair, time-bound <span className="accent">redressal process</span></>}
        subtitle="We are committed to resolving every concern transparently and within defined service levels. Here's how to raise, track and escalate a grievance."
        breadcrumb={[{ label: 'Support' }, { label: 'Grievance Redressal' }]}
      />

      {/* Process / timeline */}
      <section className="ent-section">
        <div className="container">
          <SectionHead eyebrow="How it works" title="The complaint process" subtitle="Four clear stages, each with defined ownership and timelines." />
          <RevealGrid className="ent-grid cols-4">
            {STEPS.map((s) => (
              <Reveal key={s.n}>
                <div className="ent-step" style={{ flexDirection: 'column', gap: '14px' }}>
                  <div className="ent-step-num">{s.n}</div>
                  <div>
                    <h4>{s.title}</h4>
                    <p>{s.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </RevealGrid>
        </div>
      </section>

      {/* Form + officer info */}
      <section className="ent-section alt">
        <div className="container">
          <div className="ent-split">
            <div className="ent-card" style={{ padding: '32px' }}>
              <SectionHead eyebrow="Submit a complaint" title="Grievance submission form" />
              {sent ? (
                <div className="ent-form-success">
                  <CheckCircle2 size={18} /> Complaint received. Your ticket number has been sent to your email. We'll acknowledge within 24 hours.
                </div>
              ) : (
                <form className="ent-form" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
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
                      <select id="g-type" required>
                        <option value="">Select…</option>
                        <option>Material discrepancy</option>
                        <option>Payment / refund</option>
                        <option>Auction conduct</option>
                        <option>KYC / verification</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="ent-field">
                    <label htmlFor="g-desc">Describe your grievance <span className="req">*</span></label>
                    <textarea id="g-desc" className="ent-textarea" required placeholder="Please include dates, amounts and any relevant details." />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start' }}>
                    <Send size={16} style={{ marginRight: '8px' }} /> Submit complaint
                  </button>
                </form>
              )}
            </div>

            <aside className="ent-aside-sticky" style={{ display: 'grid', gap: '16px' }}>
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
                <div className="ci"><Clock size={20} /></div>
                <div>
                  <h4>Resolution SLA</h4>
                  <p>Acknowledgement: 24 hours<br />Resolution: up to 7 working days</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Escalation matrix */}
      <section className="ent-section">
        <div className="container">
          <SectionHead eyebrow="Escalation matrix" title="If you're not satisfied" subtitle="Unresolved concerns automatically qualify for escalation to the next level." />
          <div className="ent-table-wrap">
            <table className="ent-table">
              <thead>
                <tr>
                  <th>Escalation level</th>
                  <th>Responsible</th>
                  <th>Resolution SLA</th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {SLA.map((r) => (
                  <tr key={r.level}>
                    <td style={{ fontWeight: 700 }}>{r.level}</td>
                    <td>{r.role}</td>
                    <td>{r.sla}</td>
                    <td><a href={`mailto:${r.contact}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{r.contact}</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="ent-section alt">
        <div className="container">
          <SectionHead eyebrow="FAQ" title="Grievance questions" />
          <div style={{ maxWidth: '820px' }}>
            <Accordion items={FAQ} defaultOpen={0} />
          </div>
        </div>
      </section>

      <CTABand
        title="Need to speak to someone?"
        text="Our support desk can help you raise or track a complaint and guide you through escalation."
        primary={{ label: 'Contact support', to: '/contact' }}
        secondary={{ label: 'Read FAQs', to: '/faqs' }}
      />
    </div>
  );
};

export default Grievance;
