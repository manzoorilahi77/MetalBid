/* ---------------------------------------------------------------------------
   How it works

   The previous version was five sentences on a decorative timeline — true, and
   useless: no durations, no prerequisites, and no distinction between what the
   reader has to do and what happens on our side while they wait.

   Two changes carry this rebuild. First, the audience switch: a buyer and a
   seller share a platform but almost no steps, and collapsing them into one
   generic list served neither. Second, every step now states who is acting,
   how long it takes, what to have ready, and the mistake people actually make
   at that point.

   Note this page is deliberately not the About page's "five stages". That one
   shows FerroBid's internal chain of authority — who signs off on what. This
   one shows the customer's own journey.
--------------------------------------------------------------------------- */
import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  motion, AnimatePresence, useReducedMotion,
  useScroll, useSpring, useTransform, useMotionValue
} from 'framer-motion';
import {
  Users, Factory, ChevronRight, AlertTriangle, ShieldCheck,
  BadgeCheck, Search, Wallet, Gavel, Receipt, Truck,
  FileCheck, MapPin, ClipboardCheck, Megaphone, Banknote,
  Clock, Layers, Timer
} from 'lucide-react';
import '../styles/enterprise.css';
import '../styles/resources.css';

/* ─── The two journeys ─────────────────────────────────────────────────────
   `you` and `us` are separate fields on purpose: most confusion on a
   marketplace is about who is currently waiting on whom. */
const JOURNEYS = {
  buy: {
    label: 'I want to buy',
    icon: Users,
    lead: 'From a cold account to material in your yard. Five of these six steps are yours; the one in the middle is ours.',
    cta: { to: '/marketplace', label: 'Browse live lots' },
    steps: [
      {
        icon: BadgeCheck, title: 'Register and clear KYC', when: '24–48 hrs',
        you: 'Create an account and upload your enterprise documents — GST certificate, PAN, incorporation document and authorised-signatory ID.',
        us: 'We verify the entity is real, registered and authorised to trade, then notify you by email and SMS.',
        ready: 'Scans must be legible and the entity name must match across GST and PAN — a mismatch is the single most common rejection.'
      },
      {
        icon: Search, title: 'Find a lot and read its report', when: 'Self-paced',
        you: 'Filter by category, grade or location. Open the inspection report before anything else: GPS-tagged location, photographs, video, quantity and condition.',
        us: 'Every lot on the floor has already been physically inspected by a site officer and approved by an executive before publication.',
        ready: 'Check the basis — whether the lot settles on listed quantity or on delivered weighbridge weight. It changes what you are bidding on.'
      },
      {
        icon: Wallet, title: 'Pay the EMD', when: 'Before bidding opens',
        you: 'Pay the Earnest Money Deposit shown on that specific lot. It unlocks bidding and evidences intent.',
        us: 'We hold the deposit against the lot. If you do not win, it is released for refund automatically once the auction closes.',
        ready: 'EMD is per lot, not per account. If you intend to bid on four lots, budget four deposits.'
      },
      {
        icon: Gavel, title: 'Bid in the live window', when: 'Auto-extended',
        you: 'Place bids in real time. The leading bid at close wins, provided reserve is met.',
        us: 'We run auto-extension: any bid arriving late pushes the closing time out, repeatedly, so the lot closes on price rather than on connection speed.',
        ready: 'A bid is irrevocable. It cannot be withdrawn, reduced or cancelled — check quantity and lot number before you confirm.'
      },
      {
        icon: Receipt, title: 'Settle the balance', when: '24–72 hrs',
        you: 'Pay the balance stated on your sale confirmation letter. Your EMD is already credited against it.',
        us: 'We reconcile the payment and issue the delivery order that authorises release of the material.',
        ready: 'The letter, not this page, carries the operative deadline. Miss it and the EMD can be forfeited and the lot relisted.'
      },
      {
        icon: Truck, title: 'Lift the material', when: 'Per lifting window',
        you: 'Collect with your own transporter or use FerroBid logistics. Carry the delivery order, e-way bill and transporter documents to the gate.',
        us: 'We coordinate the handover with the seller and hold the settlement record for both sides.',
        ready: 'Raise any weight or condition dispute at the gate, before the vehicle leaves. Afterwards it is very hard to substantiate.'
      }
    ]
  },

  sell: {
    label: 'I want to sell',
    icon: Factory,
    lead: 'From an auction request to money in your account. The inspection visit is usually the longest link in the chain, so book it early.',
    cta: { to: '/auth?tab=register', label: 'List with FerroBid' },
    steps: [
      {
        icon: FileCheck, title: 'Onboard as a seller', when: '24–48 hrs',
        you: 'Submit the buyer document set plus proof of title, your yard address, and any pollution-control or hazardous-material authorisation.',
        us: 'We verify the entity and the ownership position before anything is scheduled.',
        ready: 'Settlement goes only to the bank account verified during onboarding. Get that right now, not at payout.'
      },
      {
        icon: ClipboardCheck, title: 'Submit an auction request', when: 'Same day',
        you: 'Describe the material — grade, estimated quantity, location and any documentation you hold.',
        us: 'Our team reviews the request and schedules a site visit. Sellers submit requests; they do not create live auctions directly.',
        ready: 'An honest estimate beats an optimistic one. The inspection will correct it anyway, and a large gap delays publication.'
      },
      {
        icon: MapPin, title: 'Site inspection', when: 'Booked to your yard',
        you: 'Give the site officer access to the material and a contact on the ground.',
        us: 'The officer GPS-tags the location, photographs and videos the lot, and records quantity and condition in a formal report.',
        ready: 'This step sets the pace of everything after it. Offer the earliest slot your yard can actually support.'
      },
      {
        icon: ShieldCheck, title: 'Executive approval', when: 'Before publish',
        you: 'Respond to any correction request — the lot can be sent back if the catalog does not match what was inspected.',
        us: 'An executive approves the catalog against the inspection report. The role that approves is deliberately not the role that inspects.',
        ready: 'Agree the reserve price here. It stays confidential from bidders, but it is fixed before the lot goes live.'
      },
      {
        icon: Megaphone, title: 'Your lot runs live', when: 'Published window',
        you: 'Nothing. Keep the material available and unaltered while the auction runs.',
        us: 'We publish to the verified buyer pool, collect EMD from bidders, run the live auction and handle auto-extension.',
        ready: 'Every bidder on your lot has already cleared the same enterprise KYC you did.'
      },
      {
        icon: Banknote, title: 'Settlement and handover', when: 'After buyer pays',
        you: 'Release material against a valid delivery order — and only against a delivery order, never a payment screenshot.',
        us: 'We reconcile the buyer payment, issue the delivery order, then settle your proceeds and commission automatically.',
        ready: 'If a buyer arrives without a delivery order, call the desk. Releasing early puts your own settlement at risk.'
      }
    ]
  }
};

/* Cross-cutting guarantees — the same at every step, for both sides. */
const GUARANTEES = [
  { icon: ShieldCheck, title: 'Both sides are verified', text: 'Nobody bids or lists without clearing enterprise KYC. You are never trading against an unverified counterparty.' },
  { icon: ClipboardCheck, title: 'Nothing lists uninspected', text: 'Every lot is physically inspected and documented before publication — and the role that inspects cannot be the role that approves.' },
  { icon: Timer, title: 'The clock protects the price', text: 'Auto-extension means a lot cannot be taken by a last-second bid. It closes when bidding genuinely stops.' },
  { icon: Wallet, title: 'Money moves through us', text: 'High-value settlement runs through escrow. Funds never pass seller-to-buyer directly, so neither side carries the other’s default risk.' }
];

/* ─── One step ─────────────────────────────────────────────────────────────
   Node lighting and rail fill are decoration on a complete resting state: an
   unlit node is still a legible numeral, an unfilled rail still a hairline. */
const Step = ({ step, idx, total, progress, reduceMotion }) => {
  const Icon = step.icon;
  const [passed, setPassed] = useState(reduceMotion);

  const lit = useTransform(progress, [idx / total, (idx + 0.18) / total], [0, 1]);
  const segment = useTransform(progress, [idx / total, (idx + 1) / total], [0, 1]);

  useEffect(() => {
    if (reduceMotion) { setPassed(true); return undefined; }
    setPassed(lit.get() > 0.5);
    return lit.on('change', v => setPassed(v > 0.5));
  }, [lit, reduceMotion]);

  /* Transforms only — a row whose opacity animated and never got its viewport
     callback is an invisible row. */
  const motionProps = reduceMotion ? {} : {
    initial: { y: 22 },
    whileInView: { y: 0 },
    viewport: { once: true, amount: 0.25 },
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] }
  };

  return (
    <motion.li className={`jrn-step${passed ? ' is-passed' : ''}`} {...motionProps}>
      <div className="jrn-marker">
        <span className="jrn-node">{String(idx + 1).padStart(2, '0')}</span>
        {idx < total - 1 && (
          <span className="jrn-link" aria-hidden="true">
            <motion.span
              className="jrn-link-fill"
              style={reduceMotion ? { scaleY: 1 } : { scaleY: segment }}
            />
          </span>
        )}
      </div>

      <article className="jrn-card">
        <div className="jrn-card-head">
          <span className="jrn-card-icon"><Icon size={16} strokeWidth={1.9} /></span>
          <h3>{step.title}</h3>
          <span className="jrn-when">{step.when}</span>
        </div>

        <div className="jrn-split">
          <div className="jrn-col jrn-col-you">
            <p className="jrn-col-label">You do</p>
            <p>{step.you}</p>
          </div>
          <div className="jrn-col jrn-col-us">
            <p className="jrn-col-label">We do</p>
            <p>{step.us}</p>
          </div>
        </div>

        <div className="jrn-ready">
          <span className="jrn-ready-icon"><AlertTriangle size={13} strokeWidth={2.25} aria-hidden="true" /></span>
          <p><strong>Worth knowing. </strong>{step.ready}</p>
        </div>
      </article>
    </motion.li>
  );
};

export const HowItWorks = () => {
  const reduceMotion = useReducedMotion();
  const [side, setSide] = useState('buy');
  const chainRef = useRef(null);
  const journey = JOURNEYS[side];

  const { scrollYProgress } = useScroll({
    target: chainRef,
    offset: ['start 82%', 'end 82%']
  });

  /* Monotonic: a journey only advances. A rail that un-draws when the reader
     scrolls back up contradicts the thing it is illustrating. */
  const drawn = useMotionValue(0);
  useEffect(() => {
    const advance = v => { if (v > drawn.get()) drawn.set(v); };
    advance(scrollYProgress.get());
    return scrollYProgress.on('change', advance);
  }, [scrollYProgress, drawn]);

  /* Switching audience resets the chain — the new journey has not been read
     yet, so it should draw itself again rather than appear pre-completed. */
  useEffect(() => { drawn.set(0); }, [side, drawn]);

  const progress = useSpring(drawn, { stiffness: 130, damping: 28, mass: 0.4 });

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
    <div className="ent-page res-page">
      {/* ─── Hero ─── */}
      <header className="res-hero">
        <div className="container">
          <nav className="ent-breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <ChevronRight size={13} aria-hidden="true" />
            <span>Company</span>
            <ChevronRight size={13} aria-hidden="true" />
            <span className="crumb-current" aria-current="page">How it works</span>
          </nav>

          <div className="res-hero-inner">
            <p className="ent-hero-eyebrow"><Layers size={13} aria-hidden="true" /> The process</p>
            <h1 className="res-hero-title">Six steps, and who is waiting on whom at each one.</h1>
            <p className="res-hero-lead">
              Buying and selling on FerroBid share a platform but almost no steps. Pick your side
              and every stage tells you what you do, what happens on our side, how long it takes,
              and the mistake people usually make there.
            </p>

            <ul className="res-facts">
              <li>
                <p className="res-fact-label"><BadgeCheck size={12} aria-hidden="true" />KYC clearance</p>
                <p className="res-fact-value">24–48 hrs</p>
              </li>
              <li>
                <p className="res-fact-label"><Clock size={12} aria-hidden="true" />Payment window</p>
                <p className="res-fact-value">24–72 hrs</p>
              </li>
              <li>
                <p className="res-fact-label"><ShieldCheck size={12} aria-hidden="true" />Lots inspected</p>
                <p className="res-fact-value">Every one</p>
              </li>
              <li>
                <p className="res-fact-label"><Truck size={12} aria-hidden="true" />Fulfilment rate</p>
                <p className="res-fact-value">99%</p>
              </li>
            </ul>
          </div>
        </div>
      </header>

      {/* ─── The journey ─── */}
      <section className="ent-section">
        <div className="container">
          <motion.div className="sec-head" {...reveal}>
            <p className="sec-eyebrow">Your journey</p>
            <h2 className="sec-title">Which side of the table are you on?</h2>
            <p className="sec-lead">{journey.lead}</p>
          </motion.div>

          <div className="jrn-switch" role="tablist" aria-label="Choose buyer or seller journey">
            {Object.entries(JOURNEYS).map(([key, item]) => {
              const Icon = item.icon;
              const on = side === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className={`jrn-switch-btn${on ? ' is-active' : ''}`}
                  onClick={() => setSide(key)}
                >
                  {on && (
                    reduceMotion
                      ? <span className="jrn-switch-pill" />
                      : <motion.span
                          className="jrn-switch-pill"
                          layoutId="jrn-switch-pill"
                          transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                        />
                  )}
                  <Icon size={15} strokeWidth={2} aria-hidden="true" />
                  <span className="jrn-switch-label">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="jrn-chain" ref={chainRef}>
            {/* mode="wait" so the outgoing journey clears before the incoming
                one measures its own scroll range. */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.ol
                key={side}
                className="jrn-steps"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                {journey.steps.map((step, idx) => (
                  <Step
                    key={`${side}-${step.title}`}
                    step={step}
                    idx={idx}
                    total={journey.steps.length}
                    progress={progress}
                    reduceMotion={reduceMotion}
                  />
                ))}
              </motion.ol>
            </AnimatePresence>
          </div>

          <div style={{ marginTop: '22px' }}>
            <Link to={journey.cta.to} className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              {journey.cta.label} <ChevronRight size={15} strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Guarantees ─── */}
      <section className="res-band">
        <div className="container">
          <motion.div className="sec-head" {...reveal}>
            <p className="sec-eyebrow">Constant throughout</p>
            <h2 className="sec-title">Four things that hold at every step.</h2>
            <p className="sec-lead">
              These do not depend on which side you are on, which lot you are bidding, or how large
              the trade is. They are the reason the process has six steps rather than two.
            </p>
          </motion.div>

          <div className="res-grid cols-4">
            {GUARANTEES.map((g, i) => {
              const Icon = g.icon;
              return (
                <motion.article className="res-band-card" key={g.title} {...stagger(i)}>
                  <span className="res-band-icon"><Icon size={17} strokeWidth={1.9} /></span>
                  <h3>{g.title}</h3>
                  <p>{g.text}</p>
                </motion.article>
              );
            })}
          </div>

          <p className="res-band-note">
            The internal side of this — which FerroBid role signs off on each stage, and which
            authority each one is denied — is set out in full on the About page.
          </p>
        </div>
      </section>

      {/* ─── Where next ─── */}
      <section className="ent-section">
        <div className="container">
          <motion.div className="sec-head" {...reveal}>
            <p className="sec-eyebrow">Before you start</p>
            <h2 className="sec-title">Three things worth reading first.</h2>
          </motion.div>

          <div className="res-grid cols-3">
            <Link to="/knowledge-center" className="res-card">
              <span className="res-card-icon"><Layers size={17} strokeWidth={1.9} /></span>
              <h3>Learn the grades</h3>
              <p>What HMS 80:20, millberry and ADC-12 actually mean, and what to check at inspection.</p>
              <span className="res-card-foot">Grade reference <ChevronRight size={13} strokeWidth={2.5} /></span>
            </Link>
            <Link to="/faqs" className="res-card">
              <span className="res-card-icon"><Search size={17} strokeWidth={1.9} /></span>
              <h3>Read the answers</h3>
              <p>Forty-one questions covering EMD, lifting windows, weighment disputes and tax.</p>
              <span className="res-card-foot">Help &amp; FAQs <ChevronRight size={13} strokeWidth={2.5} /></span>
            </Link>
            <Link to="/terms" className="res-card">
              <span className="res-card-icon"><Receipt size={17} strokeWidth={1.9} /></span>
              <h3>Know what binds you</h3>
              <p>When a bid becomes irrevocable, what EMD is at risk, and who is liable for what.</p>
              <span className="res-card-foot">Terms &amp; Conditions <ChevronRight size={13} strokeWidth={2.5} /></span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HowItWorks;
