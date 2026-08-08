import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Building2, Users, Network, ShieldCheck,
  Banknote, ArrowRight, TrendingUp,
  MapPin, Eye, Factory,
  Check, Ban, ChevronRight,
  Layers, CircuitBoard, FlaskConical,
  PackageCheck, Timer, Lock, BadgeCheck, Wallet,
  Gavel, PenLine, MousePointerClick
} from 'lucide-react';
import {
  motion, AnimatePresence, useReducedMotion,
  useScroll, useSpring, useTransform, useMotionValue
} from 'framer-motion';
import { Link } from 'react-router-dom';
import { asset } from '../utils/asset';
import '../styles/about.css';

/* This page has exactly one authored moment: switching roles in the governance
   map. Nothing here fades in on scroll — five identical section entrances read
   as a template, and content gated behind an animation is content that is
   blank if the animation never runs. */

/* ─── The governance map ───────────────────────────────────────────────────
   Every role carries what it does, the authority it holds, and — the part that
   actually matters on an auction platform — the authority it is denied.
   Segregation of duties is the product story, so `limits` is first-class
   content rather than a footnote.

   Ordered visitor-first: almost everyone reading this page is a prospective
   buyer or seller, so the two roles they would actually hold lead the rail.
   FerroBid's own hierarchy follows, as the answer to "who checks the lot
   before I bid on it?".
   ------------------------------------------------------------------------- */
/* The five stages every lot passes through, shared by the pipeline section and
   the governance map so the two read as one system.

   `signedBy` names the role accountable for the stage's output and points at
   its id in the governance map below — the section claims five signatures, so
   each one is named, and clicking it opens that role's access panel rather
   than leaving the reader to go find it. */
const PIPELINE = [
  {
    title: 'Seller onboarding',
    desc: 'Enterprise KYC and corporate verification.',
    output: 'A verified corporate account — GST, PAN, incorporation certificate and signatory ID, cleared in 24–48 hrs.',
    icon: BadgeCheck,
    sla: '24–48 hrs',
    signedBy: { id: 'executive', title: 'Executive Officer' }
  },
  {
    title: 'Site inspection',
    desc: 'GPS and physical verification by on-site officers.',
    output: 'An inspection report: GPS-tagged location, photo and video, quantity and condition.',
    icon: MapPin,
    sla: 'On site',
    signedBy: { id: 'site-officer', title: 'Site Officer' }
  },
  {
    title: 'Executive approval',
    desc: 'Strict governance sign-off on catalog details.',
    output: 'A published catalog — or the lot sent back for corrections.',
    icon: ShieldCheck,
    sla: 'Before publish',
    signedBy: { id: 'executive', title: 'Executive Officer' }
  },
  {
    title: 'Live auction',
    desc: 'Real-time forward and reverse bidding execution.',
    output: 'A winning bid, protected by auto-extension against last-second sniping.',
    icon: Gavel,
    sla: 'Auto-extended',
    signedBy: { id: 'sub-admin', title: 'Sub Admin' }
  },
  {
    title: 'Finance settlement',
    desc: 'Automated EMD clearing and commission distribution.',
    output: 'A sale confirmation letter, with the balance due 24–72 hrs after close.',
    icon: Banknote,
    sla: '24–72 hrs',
    signedBy: { id: 'finance', title: 'Finance Officer' }
  }
];

/* Tier accents, drawn from tokens the design system already owns (ember, ink,
   steel, warning). Colour encodes which side of the table a role sits on, so
   it carries information rather than decorating the panel. */
const ACCENTS = {
  you:        { base: '#e4572e', soft: 'rgba(228, 87, 46, 0.10)',  line: 'rgba(228, 87, 46, 0.34)' },
  ownership:  { base: '#1c1917', soft: 'rgba(28, 25, 23, 0.06)',   line: 'rgba(28, 25, 23, 0.22)' },
  governance: { base: '#2b4c7e', soft: 'rgba(43, 76, 126, 0.10)',  line: 'rgba(43, 76, 126, 0.30)' },
  operations: { base: '#b45309', soft: 'rgba(180, 83, 9, 0.10)',   line: 'rgba(180, 83, 9, 0.30)' }
};

const LEGEND = [
  { key: 'you', label: 'Customers' },
  { key: 'ownership', label: 'Ownership' },
  { key: 'governance', label: 'Governance' },
  { key: 'operations', label: 'Operations' }
];

const TEAM_TIERS = [
  {
    id: 'ownership',
    label: 'Ownership',
    accent: 'ownership',
    roles: [
      {
        id: 'super-admin',
        title: 'Super Admin',
        icon: Building2,
        purpose: 'Complete ownership of the platform with unrestricted access.',
        stages: [1, 2, 3, 4, 5],
        mandate: ['Manage every module', 'Assign permissions', 'System configurations', 'Financial visibility', 'Audit logs', 'Delete and restore data'],
        authority: ['Full access to all modules', 'Approve or reject any workflow', 'Manage organization structure'],
        limits: []
      }
    ]
  },
  {
    id: 'governance',
    label: 'Governance',
    accent: 'governance',
    roles: [
      {
        id: 'ceo',
        title: 'CEO / Managing Director',
        icon: TrendingUp,
        purpose: 'Monitors business growth and financial performance.',
        stages: [],
        mandate: ['Revenue dashboards', 'Commission reports', 'Auction performance', 'Business KPIs', 'Monthly reports', 'High-value auction monitoring'],
        authority: ['View all operational data'],
        limits: ['No operational editing', 'No catalog or auction creation']
      },
      {
        id: 'executive',
        title: 'Executive Officer',
        icon: ShieldCheck,
        purpose: 'Operational approval authority ensuring only valid auctions proceed.',
        stages: [1, 2, 3],
        mandate: ['Approve seller onboarding', 'Approve site inspection reports', 'Approve lot verification', 'Monitor site officers and sub admins'],
        authority: ['Send back for corrections', 'Assign work', 'Approve publishing'],
        limits: []
      },
      {
        id: 'investor',
        title: 'Investor / Board Member',
        icon: Eye,
        purpose: 'Read-only access for external monitoring and audits.',
        stages: [],
        mandate: ['View revenue reports', 'View auction statistics', 'Monitor KPIs', 'Track company performance'],
        authority: ['View only'],
        limits: ['Cannot modify anything']
      }
    ]
  },
  {
    id: 'operations',
    label: 'Operations',
    accent: 'operations',
    roles: [
      {
        id: 'sub-admin',
        title: 'Sub Admin',
        icon: Network,
        purpose: 'Operational backbone managing the complete auction lifecycle.',
        stages: [1, 4, 5],
        mandate: ['Create catalogs, lots, and auctions', 'Manage buyer registration and EMD verification', 'Generate approval and sale confirmation letters', 'Close auctions and send final documents'],
        authority: ['Manage auction operations'],
        limits: ['Cannot approve site inspections', 'Cannot access executive financial dashboards']
      },
      {
        id: 'finance',
        title: 'Finance Officer',
        icon: Banknote,
        purpose: 'Manages all financial transactions securely.',
        stages: [5],
        mandate: ['EMD and refunds', 'Commission calculations', 'Buyer payments', 'Seller settlements', 'Financial reconciliation'],
        authority: ['Manage all transaction ledgers'],
        limits: []
      },
      {
        id: 'site-officer',
        title: 'Site Officer',
        icon: MapPin,
        purpose: 'Works entirely in the field for physical verification.',
        stages: [2],
        mandate: ['Visit seller locations', 'Inspect scrap, machinery, and assets', 'Upload photos, videos, and GPS locations', 'Submit inspection reports'],
        authority: ['Recommend approvals or rejections to Executives'],
        limits: []
      }
    ]
  }
];

const CUSTOMER_TIERS = [
  {
    id: 'market',
    label: null,
    accent: 'you',
    roles: [
      {
        id: 'buyer',
        title: 'Buyer',
        icon: Users,
        purpose: 'Verified enterprises purchasing materials.',
        stages: [4, 5],
        mandate: ['Complete KYC', 'Pay EMD', 'Participate in live auctions', 'Download invoices and sale orders'],
        authority: ['Bid on approved public or private auctions'],
        limits: []
      },
      {
        id: 'seller',
        title: 'Seller',
        icon: Factory,
        purpose: 'Corporate entities owning the industrial assets.',
        stages: [1, 5],
        mandate: ['Submit auction requests', 'Upload documents', 'View sold lots and payments'],
        authority: ['Submit auction requests for review'],
        limits: ['Cannot create their own auctions']
      }
    ]
  }
];

/* Two sides of the table. The split is what a visitor needs first: which of
   these am I, and who are the rest of them? */
const RAIL = [
  {
    id: 'you',
    heading: 'You on FerroBid',
    sub: 'The two roles our customers hold.',
    audience: 'you',
    tiers: CUSTOMER_TIERS
  },
  {
    id: 'team',
    heading: 'FerroBid’s side',
    sub: 'Who verifies, approves, and settles every lot.',
    audience: 'team',
    tiers: TEAM_TIERS
  }
];

const ALL_ROLES = RAIL.flatMap(section =>
  section.tiers.flatMap(tier =>
    tier.roles.map(role => ({ ...role, audience: section.audience, accent: tier.accent }))
  )
);

/* Focal sequence: the panel re-enters as a short list stagger, capped well
   under 300ms total so repeated clicking never feels like latency. Exits are
   faster than entrances. */
const panelVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.045, delayChildren: 0.03 } }
};

const panelItem = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.34, ease: [0.16, 1, 0.3, 1] } }
};

const GovernanceMap = ({ activeId, onSelect }) => {
  const active = ALL_ROLES.find(role => role.id === activeId) ?? ALL_ROLES[0];
  const ActiveIcon = active.icon;
  const isCustomer = active.audience === 'you';
  const accent = ACCENTS[active.accent];

  return (
    <section className="ecosystem-section" id="ecosystem">
      <div className="ecosystem-container">
        <header className="sec-head gov-head">
          <p className="sec-eyebrow">Access &amp; authority</p>
          <h2 className="sec-title">Nine roles. One chain of authority.</h2>
          <p className="sec-lead">
            No single person moves a lot from a seller's yard to a settled invoice. Start with
            your own role, then see who stands behind it.
          </p>
        </header>

        <div
          className="gov-map"
          style={{
            '--role-accent': accent.base,
            '--role-accent-soft': accent.soft,
            '--role-accent-line': accent.line
          }}
        >
          {/* Console chrome: names the instrument and carries the colour key,
              so the accent on the panel is readable as a tier, not a mood. */}
          <div className="gov-chrome">
            <p className="gov-chrome-title">Access control map</p>
            <ul className="gov-legend">
              {LEGEND.map(item => (
                <li key={item.key}>
                  <span className="gov-legend-dot" style={{ background: ACCENTS[item.key].base }} />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="gov-body">
            {/* Rail affordance: the group headings and tier labels are plain
                text on the rail's own tint, while every selectable role is a
                raised card with an icon chip and a permanent chevron. The
                instruction at the top says outright that the cards are the
                controls — nothing here should need a hover to be discovered. */}
            <nav className="gov-rail" aria-label="Platform roles">
              <p className="gov-rail-hint">
                <MousePointerClick size={13} strokeWidth={2.25} aria-hidden="true" />
                Select a role
              </p>

              {RAIL.map(section => (
                <div className={`gov-section gov-section-${section.id}`} key={section.id}>
                  <div className="gov-section-head">
                    <p className="gov-section-title">{section.heading}</p>
                    <p className="gov-section-sub">{section.sub}</p>
                  </div>

                  {section.tiers.map(tier => (
                    <div className="gov-tier" key={tier.id}>
                      {tier.label && <p className="gov-tier-label">{tier.label}</p>}
                      {tier.roles.map(role => {
                        const Icon = role.icon;
                        const selected = role.id === activeId;
                        const tone = ACCENTS[tier.accent];
                        return (
                          <button
                            key={role.id}
                            type="button"
                            id={`gov-role-${role.id}`}
                            className={`gov-role${selected ? ' is-active' : ''}`}
                            style={{
                              '--row-accent': tone.base,
                              '--row-accent-soft': tone.soft,
                              '--row-accent-line': tone.line
                            }}
                            aria-pressed={selected}
                            onClick={() => onSelect(role.id)}
                          >
                            <span className="gov-role-icon"><Icon size={15} strokeWidth={2} /></span>
                            <span className="gov-role-name">{role.title}</span>
                            <ChevronRight size={15} strokeWidth={2.25} className="gov-role-chevron" />
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </nav>

            <div className="gov-detail">
              {/* initial={false} so the first paint is the panel itself, not an
                  empty box waiting on a transition. The sequence only plays
                  once the reader actually switches roles. */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.article
                  key={active.id}
                  variants={panelVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.16 } }}
                >
                  <motion.div className="gov-detail-head" variants={panelItem}>
                    <span className="gov-detail-icon">
                      <ActiveIcon size={23} strokeWidth={1.75} />
                    </span>
                    <div className="gov-detail-heading">
                      <div className="gov-detail-titlerow">
                        <h3>{active.title}</h3>
                        <span className={`gov-badge${isCustomer ? ' is-you' : ''}`}>
                          {isCustomer ? 'This could be you' : 'FerroBid team'}
                        </span>
                      </div>
                      <p>{active.purpose}</p>
                    </div>
                  </motion.div>

                  {/* Ties the role back to the five stages above it — the part
                      that makes "chain of authority" literal rather than a claim. */}
                  <motion.div className="gov-stages" variants={panelItem}>
                    <div className="gov-stages-head">
                      <p className="gov-block-label">Where they act</p>
                      <span className="gov-count">
                        {active.stages.length > 0
                          ? `${active.stages.length} of 5 stages`
                          : 'Oversight only'}
                      </span>
                    </div>

                    {active.stages.length > 0 ? (
                      <ol className="gov-stage-track">
                        {PIPELINE.map((stage, idx) => {
                          const on = active.stages.includes(idx + 1);
                          /* Colour the segment only when the role owns both
                             ends of it, so the track shows the span of their
                             reach rather than a dotted scatter. */
                          const linked = on && active.stages.includes(idx + 2);
                          return (
                            <li
                              key={stage.title}
                              className={`${on ? 'is-on' : ''}${linked ? ' link-on' : ''}`}
                              style={{ '--i': idx }}
                            >
                              <span className="gov-stage-pip" />
                              <span className="gov-stage-num">{String(idx + 1).padStart(2, '0')}</span>
                              <span className="gov-stage-name">{stage.title}</span>
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <p className="gov-stage-none">
                        This role reads the chain but never acts inside it — every figure it sees
                        was produced by someone else.
                      </p>
                    )}
                  </motion.div>

                  <motion.div className="gov-detail-body" variants={panelItem}>
                    <div className="gov-block">
                      <div className="gov-stages-head">
                        <p className="gov-block-label">What they do</p>
                        <span className="gov-count">{active.mandate.length}</span>
                      </div>
                      <ul className="gov-mandate">
                        {active.mandate.map(item => <li key={item}>{item}</li>)}
                      </ul>
                    </div>

                    <div className="gov-block">
                      <div className="gov-stages-head">
                        <p className="gov-block-label">Can</p>
                        <span className="gov-count">{active.authority.length}</span>
                      </div>
                      <ul className="gov-rules">
                        {active.authority.map(item => (
                          <li key={item}><Check size={14} strokeWidth={2.5} className="gov-yes" />{item}</li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>

                  {/* The constraint is the most interesting thing about any role
                      here, so it gets a band of its own rather than a third
                      column nobody reaches. */}
                  {active.limits.length > 0 && (
                    <motion.div className="gov-limits" variants={panelItem}>
                      <p className="gov-limits-label">
                        <Ban size={13} strokeWidth={2.5} />Cannot — by design
                      </p>
                      <ul className="gov-limits-list">
                        {active.limits.map(item => <li key={item}>{item}</li>)}
                      </ul>
                    </motion.div>
                  )}

                  {/* A visitor reading their own role has an obvious next step;
                      the internal roles are context, not something to sign up for. */}
                  {isCustomer && (
                    <motion.div variants={panelItem}>
                      <Link to="/auth?tab=register" className="gov-cta">
                        <span>
                          <strong>Register as a {active.title.toLowerCase()}</strong>
                          Enterprise KYC, then you are on the floor.
                        </span>
                        <ArrowRight size={17} strokeWidth={2} />
                      </Link>
                    </motion.div>
                  )}
                </motion.article>
              </AnimatePresence>

              <p className="gov-footnote">
                Support, transport, compliance, and inspection partners operate against the same
                audit trail under delegated access.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};


/* ─── What actually trades here ───────────────────────────────────────────
   Categories, materials, sellers and states are taken from the live
   marketplace inventory (pages/Marketplace.jsx), not written for this page —
   so a visitor reading About sees the same universe they will see when they
   open the marketplace. Imagery is the project's own material photography. */
const CATALOGUE = [
  {
    id: 'ferrous',
    name: 'Ferrous',
    img: asset('/images/tile_steel.jpg'),
    alt: 'Coiled steel wire rod in a mill',
    blurb: 'Mill scrap, secondary coil and plate offcuts from integrated steel plants.',
    examples: ['Heavy Melting Steel (HMS 1)', 'HMS 80:20', 'CR coil secondary stock', 'MS plate offcuts']
  },
  {
    id: 'non-ferrous',
    name: 'Non-ferrous',
    img: asset('/images/tile_copper.jpg'),
    alt: 'Coiled copper tube stock',
    blurb: 'Aluminium, copper and brass streams, from turnings to cathode-grade rod.',
    examples: ['Mixed aluminium extrusion', 'Copper millberry wire', 'Aluminium ingots ADC-12', 'Brass borings & turnings']
  },
  {
    id: 'stainless',
    name: 'Stainless steel',
    img: asset('/images/tile_aluminium.jpg'),
    alt: 'Polished metal billets',
    blurb: 'Grade-sorted stainless scrap with documented composition.',
    examples: ['SS 304 scrap']
  },
  {
    id: 'minor',
    name: 'Minor metals',
    img: asset('/images/tile_pipes.jpg'),
    alt: 'Stacked galvanised pipe sections',
    blurb: 'Process residues and recovery streams from smelters and refiners.',
    examples: ['Zinc top dross', 'Lead battery scrap (RSDL)']
  }
];

const SELLERS = ['Tata Steel', 'SAIL', 'Hindalco', 'JSW Steel', 'Hindustan Zinc'];

const STATES = [
  'Jharkhand', 'Chhattisgarh', 'Uttar Pradesh', 'Karnataka',
  'Rajasthan', 'Gujarat', 'Maharashtra', 'Odisha'
];

/* ─── Risk ledger ─────────────────────────────────────────────────────────
   Every safeguard below is an existing published policy (see pages/FAQs.jsx).
   Framing them against the risk they answer is the useful part: a buyer
   evaluating the platform is asking "what happens when this goes wrong?" */
const SAFEGUARDS = [
  {
    risk: 'The material is not what the listing said.',
    icon: PackageCheck,
    answer: 'Every lot is physically inspected and documented before it is listed — GPS-tagged location, high-resolution photo and video, and on-site quantity and condition estimation.',
    recourse: 'Genuine discrepancies go to Grievance Redressal within the stated window.'
  },
  {
    risk: 'Someone snipes the lot in the last second.',
    icon: Timer,
    answer: 'Live auctions auto-extend. A bid placed late pushes the timer out, so the lot closes on price rather than on reflexes.',
    recourse: 'Forward and reverse bidding both run on the same real-time engine.'
  },
  {
    risk: 'I pay and the counterparty disappears.',
    icon: Lock,
    answer: 'High-value lots settle through escrow. Bank transfer (NEFT/RTGS) and UPI for smaller amounts are reconciled by the finance team, never seller-to-buyer directly.',
    recourse: 'Balance is due 24–72 hours after close, per your sale confirmation letter.'
  },
  {
    risk: 'I am bidding against unverified companies.',
    icon: BadgeCheck,
    answer: 'Both sides clear enterprise KYC before they transact — GST registration, PAN, certificate of incorporation and authorised-signatory identity proof.',
    recourse: 'Most submissions are verified within 24–48 business hours.'
  },
  {
    risk: 'My deposit is stuck if I lose.',
    icon: Wallet,
    answer: 'EMD is a refundable deposit that only confirms intent to bid. Winners have it adjusted against the final payment; everyone else is refunded.',
    recourse: 'Clearing and refunds are automated, not manual goodwill.'
  }
];

const PATHS = [
  {
    id: 'buy',
    title: 'If you are buying',
    icon: Users,
    lead: 'Verified enterprises bidding on inspected lots.',
    steps: [
      'Register and complete enterprise KYC (24–48 hrs)',
      'Pay EMD to unlock bidding on a lot',
      'Bid live, with auto-extension against sniping',
      'Settle the balance within 24–72 hrs of winning',
      'Lift yourself or use pan-India logistics partners'
    ],
    cta: { label: 'Register as a buyer', to: '/auth?tab=register' },
    alt: { label: 'Browse live lots', to: '/marketplace' }
  },
  {
    id: 'sell',
    title: 'If you are selling',
    icon: Factory,
    lead: 'Corporates disposing of industrial assets and process scrap.',
    steps: [
      'Submit an auction request with your documents',
      'A site officer inspects and GPS-tags the material',
      'An executive approves the catalog before it publishes',
      'Your lot runs to a verified buyer pool',
      'Settlement and commission are reconciled automatically'
    ],
    cta: { label: 'List with FerroBid', to: '/auth?tab=register' },
    alt: { label: 'Talk to our team', to: '/contact' }
  }
];

/* ─── Five stages ─────────────────────────────────────────────────────────
   One continuous chain down the section. The rail between nodes fills to
   scroll position and each node lights as the fill reaches it, so the reader
   watches the hand-off happen rather than reading that it does.

   Everything scroll-driven here is decoration. The rail's resting state is a
   visible hairline and every node's resting state is a legible outlined
   numeral, so a row is complete even if the scroll listener never runs (it
   did not, in one headless render) — the same rule the rest of this page
   follows: never gate content behind an animation.
   ------------------------------------------------------------------------- */
const StageRow = ({ step, idx, total, progress, reduceMotion, onSignature }) => {
  const Icon = step.icon;
  const [passed, setPassed] = useState(reduceMotion);

  /* Node i lights just as the fill arrives; segment i draws across the gap
     between node i and node i+1. Both read off the same scroll value, so the
     chain fills as one movement rather than five independent ones. */
  const lit = useTransform(progress, [idx / total, (idx + 0.18) / total], [0, 1]);
  const segment = useTransform(progress, [idx / total, (idx + 1) / total], [0, 1]);

  useEffect(() => {
    if (reduceMotion) {
      setPassed(true);
      return undefined;
    }
    setPassed(lit.get() > 0.5);
    return lit.on('change', value => setPassed(value > 0.5));
  }, [lit, reduceMotion]);

  /* Transforms only — never opacity. A row that animated its opacity and
     never got its viewport callback is an invisible row; a row that animated
     only its offset is still perfectly readable, just 22px low. */
  const rowMotion = reduceMotion ? {} : {
    initial: { y: 22 },
    whileInView: { y: 0 },
    viewport: { once: true, amount: 0.3 },
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] }
  };

  return (
    <motion.li className={`stage-row${passed ? ' is-passed' : ''}`} {...rowMotion}>
      <div className="stage-marker">
        <span className="stage-node">
          <span className="stage-node-ring" aria-hidden="true" />
          {String(idx + 1).padStart(2, '0')}
        </span>

        {idx < total - 1 && (
          <span className="stage-link" aria-hidden="true">
            <motion.span
              className="stage-link-fill"
              style={reduceMotion ? { scaleY: 1 } : { scaleY: segment }}
            />
          </span>
        )}
      </div>

      <article className="stage-card">
        <div className="stage-body">
          <div className="stage-head">
            <span className="stage-icon"><Icon size={16} strokeWidth={1.9} /></span>
            <h3>{step.title}</h3>
            <span className="stage-sla">{step.sla}</span>
          </div>

          <p className="stage-desc">{step.desc}</p>

          {/* The signature is the section's whole argument, so it is the one
              control on the row: it opens that role in the map below. */}
          <button
            type="button"
            className="stage-sign"
            onClick={() => onSignature(step.signedBy.id)}
          >
            <PenLine size={13} strokeWidth={2} aria-hidden="true" />
            <span>Signed off by <strong>{step.signedBy.title}</strong></span>
            <ChevronRight size={14} strokeWidth={2.25} aria-hidden="true" />
          </button>
        </div>

        <p className="stage-output">
          <span>Produces</span>
          {step.output}
        </p>
      </article>
    </motion.li>
  );
};

const StagesSection = ({ onSignature }) => {
  const reduceMotion = useReducedMotion();
  const chainRef = useRef(null);

  /* Measured across the chain rather than the viewport: the fill should track
     how far through the five stages you are, not how far down the page. The
     range closes while the last row is still comfortably on screen — a chain
     whose final node only lights after you have scrolled past it never gets
     seen lit. */
  const { scrollYProgress } = useScroll({
    target: chainRef,
    offset: ['start 82%', 'end 82%']
  });

  /* Monotonic: the chain only ever advances. Signatures accumulate down the
     pipeline, so a rail that un-draws when the reader scrolls back up would
     contradict the thing it is illustrating. */
  const drawn = useMotionValue(0);
  useEffect(() => {
    const advance = value => {
      if (value > drawn.get()) drawn.set(value);
    };
    advance(scrollYProgress.get());
    return scrollYProgress.on('change', advance);
  }, [scrollYProgress, drawn]);

  const progress = useSpring(drawn, {
    stiffness: 130, damping: 28, mass: 0.4
  });

  return (
    <section className="stages-section">
      <div className="stages-inner">
        <header className="sec-head">
          <p className="sec-eyebrow">The lot pipeline</p>
          <h2 className="sec-title">Five stages, five signatures.</h2>
          <p className="sec-lead">
            A lot only reaches the floor after every preceding stage has been signed off by
            someone who cannot sign off on the next.
          </p>
        </header>

        <div className="stage-chain" ref={chainRef}>
          <ol className="stage-list">
            {PIPELINE.map((step, idx) => (
              <StageRow
                key={step.title}
                step={step}
                idx={idx}
                total={PIPELINE.length}
                progress={progress}
                reduceMotion={reduceMotion}
                onSignature={onSignature}
              />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
};

export const AboutUs = () => {
  /* The pipeline and the governance map describe the same chain, so the role
     selection lives above both: clicking a signature in the pipeline opens
     that role in the map rather than leaving the reader to go find it. */
  const [activeRole, setActiveRole] = useState('buyer');

  const goToRole = useCallback(id => {
    setActiveRole(id);
    const target = document.getElementById('ecosystem');
    if (!target) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  }, []);

  return (
    <div className="story-page">

      {/* ─── Hero ───────────────────────────────────────────────────────────
          The same light warm-to-white opening the other sub-pages use, with the
          stat band closing it on the page's own ground rather than on a slab. */}
      <section className="ab-hero">
        <div className="ab-hero-body">
          <div className="ab-hero-copy">
            <h1 className="ab-hero-title">
              India's auction floor for <span className="accent">industrial metal</span>.
            </h1>
            <p className="ab-hero-lead">
              Every lot is physically inspected before it lists. Every bidder clears enterprise
              KYC before they bid. High-value settlement runs through escrow, with a complete
              audit trail on both sides of the trade.
            </p>
            <div className="ab-hero-actions">
              <Link to="/marketplace" className="ab-hero-btn primary">
                Browse live lots <ArrowRight size={17} strokeWidth={2} />
              </Link>
              <Link to="/auth?tab=register" className="ab-hero-btn ghost">Create an account</Link>
            </div>
          </div>
        </div>

        {/* Figures match the homepage ribbon — one set of numbers across the site. */}
        <dl className="ab-hero-stats">
          {[
            { value: '2,400+', label: 'Lots auctioned' },
            { value: '₹96 Cr+', label: 'GMV realised (FY 25–26)' },
            { value: '6,000+', label: 'Verified bidders' },
            { value: '99%', label: 'Fulfilment rate' }
          ].map(stat => (
            <div key={stat.label}>
              <dd>{stat.value}</dd>
              <dt>{stat.label}</dt>
            </div>
          ))}
        </dl>
      </section>

      {/* ─── What trades here ─── */}
      <section className="trade-section">
        <div className="trade-container">
          {/* Heading and provenance sit side by side: the seller roster and
              geography used to be a separate block at the foot of the section,
              which cost ~150px of scroll to say two short things. */}
          <div className="trade-head">
            <header className="sec-head">
              <p className="sec-eyebrow">Live inventory</p>
              <h2 className="sec-title">What actually trades here.</h2>
              <p className="sec-lead">
                Four categories, sourced from integrated steel plants, smelters and refiners.
                These are the streams live on the platform right now.
              </p>
            </header>

            <div className="trade-meta">
              <div className="trade-fact">
                <p className="trade-fact-label">Sellers on the platform</p>
                <ul className="trade-chips">
                  {SELLERS.map(s => <li key={s}>{s}</li>)}
                </ul>
              </div>
              <div className="trade-fact">
                <p className="trade-fact-label">Listed across {STATES.length} states</p>
                <ul className="trade-chips is-quiet">
                  {STATES.map(s => <li key={s}>{s}</li>)}
                </ul>
              </div>
            </div>
          </div>

          <div className="about-cat-grid">
            {CATALOGUE.map(cat => (
              <article className="cat-card" key={cat.id}>
                <div className="cat-media">
                  <img src={cat.img} alt={cat.alt} loading="lazy" decoding="async" />
                  <div className="cat-overlay">
                    <h3>{cat.name}</h3>
                    <p>{cat.blurb}</p>
                  </div>
                </div>
                <ul className="cat-examples">
                  {cat.examples.map(ex => <li key={ex}>{ex}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ─── The five stages ─── */}
      <StagesSection onSignature={goToRole} />

      <GovernanceMap activeId={activeRole} onSelect={setActiveRole} />

      {/* ─── Risk ledger: the page's dark band ─── */}
      <section className="risk-section">
        <div className="risk-container">
          <header className="sec-head risk-head">
            <p className="sec-eyebrow">Safeguards</p>
            <h2 className="sec-title">What happens when it goes wrong.</h2>
            <p className="sec-lead">
              Any auction platform can promise trust. These are the five failures that actually
              cost people money in scrap trading, and the mechanism that answers each one.
            </p>
          </header>

          <div className="risk-list">
            {SAFEGUARDS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <article className="risk-row" key={item.risk}>
                  <div className="risk-q">
                    <span className="risk-num">{String(idx + 1).padStart(2, '0')}</span>
                    <span className="risk-icon"><Icon size={18} strokeWidth={1.75} /></span>
                    <p>“{item.risk}”</p>
                  </div>
                  <div className="risk-a">
                    <p>{item.answer}</p>
                    <p className="risk-recourse">{item.recourse}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Start here ─── */}
      <section className="paths-section">
        <div className="paths-container">
          <header className="sec-head is-center paths-head">
            <p className="sec-eyebrow">Get started</p>
            <h2 className="sec-title">Start on the right side of the table.</h2>
            <p className="sec-lead">
              Both paths begin with the same enterprise KYC. What follows depends on whether you
              are moving material out or bringing it in.
            </p>
          </header>

          <div className="paths-grid">
            {PATHS.map(path => {
              const Icon = path.icon;
              return (
                <article className={`path-card path-${path.id}`} key={path.id}>
                  <div className="path-head">
                    <span className="path-icon"><Icon size={20} strokeWidth={1.75} /></span>
                    <div>
                      <h3>{path.title}</h3>
                      <p>{path.lead}</p>
                    </div>
                  </div>

                  <ol className="path-steps">
                    {path.steps.map(step => <li key={step}>{step}</li>)}
                  </ol>

                  <div className="path-actions">
                    <Link to={path.cta.to} className="path-btn primary">
                      {path.cta.label} <ArrowRight size={16} strokeWidth={2} />
                    </Link>
                    <Link to={path.alt.to} className="path-btn ghost">{path.alt.label}</Link>
                  </div>
                </article>
              );
            })}
          </div>

          <p className="paths-note">
            Questions before you commit? The <Link to="/faqs">help centre</Link> covers EMD,
            KYC, payment windows and logistics in detail.
          </p>
        </div>
      </section>

    </div>
  );
};
