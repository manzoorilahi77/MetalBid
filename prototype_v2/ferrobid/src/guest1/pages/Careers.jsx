import React, { useState } from 'react';
import {
  Briefcase, Heart, Rocket, Users, GraduationCap, Globe2, Scale,
  HeartHandshake, MapPin, Clock, ArrowRight, FileText, Phone, CheckCircle2,
} from 'lucide-react';
import { PageHero, SectionHead, RevealGrid, Reveal, CTABand } from '../components/PageShell';

const VALUES = [
  { icon: Scale, title: 'Trust by default', desc: 'We build systems that make fairness and transparency the path of least resistance.' },
  { icon: Rocket, title: 'Bias for shipping', desc: 'Small teams, real ownership, and a strong preference for shipping value quickly.' },
  { icon: HeartHandshake, title: 'Customer obsession', desc: 'Every trader on the platform has a livelihood riding on us. We never forget that.' },
  { icon: Globe2, title: 'Built for scale', desc: 'We engineer for a national marketplace — resilient, compliant and enterprise-grade.' },
];

const BENEFITS = [
  { icon: Heart, title: 'Health & wellness', desc: 'Comprehensive medical cover for you and your family, plus wellness allowance.' },
  { icon: GraduationCap, title: 'Learning budget', desc: 'Annual budget for courses, certifications and conferences.' },
  { icon: Users, title: 'Hybrid & flexible', desc: 'Outcome-driven culture with flexible hours and hybrid working.' },
  { icon: Briefcase, title: 'ESOPs & ownership', desc: 'Meaningful equity for full-time employees — share in what we build.' },
];

const DEPARTMENTS = ['All', 'Engineering', 'Product & Design', 'Operations', 'Sales', 'Finance'];

const JOBS = [
  { title: 'Senior Backend Engineer', dept: 'Engineering', location: 'Bengaluru', type: 'Full-time' },
  { title: 'Frontend Engineer (React)', dept: 'Engineering', location: 'Remote, India', type: 'Full-time' },
  { title: 'Product Designer', dept: 'Product & Design', location: 'Bengaluru', type: 'Full-time' },
  { title: 'Auction Operations Lead', dept: 'Operations', location: 'Raipur', type: 'Full-time' },
  { title: 'Enterprise Sales Manager', dept: 'Sales', location: 'Mumbai', type: 'Full-time' },
  { title: 'Finance & Settlement Analyst', dept: 'Finance', location: 'Bengaluru', type: 'Full-time' },
];

const HIRING = [
  { n: '01', title: 'Application', desc: 'Apply online. Every application is reviewed by a real person within 5 working days.' },
  { n: '02', title: 'Intro call', desc: 'A 30-minute conversation with the hiring manager about your experience and the role.' },
  { n: '03', title: 'Skills round', desc: 'A practical exercise or panel relevant to the role — no trick questions.' },
  { n: '04', title: 'Culture & offer', desc: 'Meet the team, align on values, and receive a transparent offer.' },
];

export const Careers = () => {
  const [dept, setDept] = useState('All');
  const filtered = dept === 'All' ? JOBS : JOBS.filter((j) => j.dept === dept);

  return (
    <div className="ent-page">
      <PageHero
        eyebrow="Careers at FerroBid"
        eyebrowIcon={Briefcase}
        title={<>Build the infrastructure for <span className="accent">industrial trade</span></>}
        subtitle="We're a mission-driven team digitising how India trades metal and scrap — transparently, fairly and at national scale. Come build it with us."
        breadcrumb={[{ label: 'Company' }, { label: 'Careers' }]}
        actions={<a href="#open-roles" className="btn btn-primary" style={{ textDecoration: 'none' }}>View open roles <ArrowRight size={16} style={{ marginLeft: '6px' }} /></a>}
      />

      {/* Culture / values */}
      <section className="ent-section">
        <div className="container">
          <SectionHead eyebrow="Our culture" title="What we value" subtitle="The principles that shape how we work, hire and build." />
          <RevealGrid className="ent-grid cols-4">
            {VALUES.map((v) => {
              const Icon = v.icon;
              return (
                <Reveal key={v.title}>
                  <div className="ent-card">
                    <div className="ent-card-icon"><Icon size={22} /></div>
                    <h3>{v.title}</h3>
                    <p>{v.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </RevealGrid>
        </div>
      </section>

      {/* Benefits */}
      <section className="ent-section alt">
        <div className="container">
          <SectionHead eyebrow="Benefits" title="How we look after our team" />
          <RevealGrid className="ent-grid cols-4">
            {BENEFITS.map((b) => {
              const Icon = b.icon;
              return (
                <Reveal key={b.title}>
                  <div className="ent-card">
                    <div className="ent-card-icon"><Icon size={22} /></div>
                    <h3>{b.title}</h3>
                    <p>{b.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </RevealGrid>
        </div>
      </section>

      {/* Job listings */}
      <section className="ent-section" id="open-roles">
        <div className="container">
          <SectionHead eyebrow="Open positions" title="Find your role" subtitle="Filter by department to find your fit. Don't see a match? Write to us anyway." />
          <div className="ent-pills" style={{ marginBottom: '24px' }}>
            {DEPARTMENTS.map((d) => (
              <button key={d} className={`ent-pill ${dept === d ? 'active' : ''}`} onClick={() => setDept(d)}>{d}</button>
            ))}
          </div>
          <div className="ent-steps">
            {filtered.map((j) => (
              <div className="ent-job" key={j.title}>
                <div>
                  <h4>{j.title}</h4>
                  <div className="ent-job-meta">
                    <span><Briefcase size={13} /> {j.dept}</span>
                    <span><MapPin size={13} /> {j.location}</span>
                    <span><Clock size={13} /> {j.type}</span>
                  </div>
                </div>
                <a href="#apply" className="btn btn-outline-primary btn-sm" style={{ textDecoration: 'none' }}>
                  Apply <ArrowRight size={14} style={{ marginLeft: '4px' }} />
                </a>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="ent-card" style={{ textAlign: 'center' }}>
                <p>No open roles in this department right now — check back soon or send us your profile.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Hiring process */}
      <section className="ent-section alt">
        <div className="container">
          <SectionHead eyebrow="Hiring process" title="What to expect" subtitle="A transparent, respectful process — usually completed within two weeks." />
          <RevealGrid className="ent-grid cols-4">
            {HIRING.map((s) => (
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

      <div id="apply" />
      <CTABand
        title="Don't see the right role?"
        text="We're always looking for exceptional people. Send your CV and tell us how you'd like to contribute."
        primary={{ label: 'Email your CV', to: '/contact' }}
        secondary={{ label: 'Talk to us', to: '/contact' }}
      />
    </div>
  );
};

export default Careers;
