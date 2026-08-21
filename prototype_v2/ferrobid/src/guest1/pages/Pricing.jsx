import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import {
  MapPin, Check, Copy, CheckCheck, Gift, Users, ArrowRight, Sparkles,
  ShieldCheck, Gavel, TrendingUp, Headphones, FileText, Bell,
  ChevronDown, PartyPopper, Building2, Share2, Ticket,
} from 'lucide-react';
import {
  PLAN_PRICE, REFERRAL_COUPON, FREE_AT, REFERRAL_CODE, inr,
} from '../checkout/plan';
import { useCmsPage } from '../../api/useCmsPage';
import '../styles/Pricing.css';

/* ---------------------------------------------------------------------------
   Single-plan pricing: one yearly subscription, ₹4,999, Karnataka-only launch.
   With this little to compare, the page has to sell on presentation rather
   than on a feature matrix — hence the tilting plan card and the referral
   calculator that lets a visitor drive the price to zero. Subscribe hands off
   to /subscribe, which collects the basics and payment before onboarding.
   --------------------------------------------------------------------------- */

const PLAN_FEATURES = [
  'Unlimited bidding across every Karnataka auction',
  'Full catalogue, lot photos & assay reports',
  'Live outbid + auction-closing alerts',
  'GST invoices and payment records in one ledger',
  'Up to 5 staff logins on one account',
  'Karnataka support desk, Mon–Sat',
];

const INCLUDED = [
  { icon: Gavel, title: 'Live & timed auctions', body: 'Bid on ferrous and non-ferrous lots the moment they open — no per-auction entry fee, no bid caps.' },
  { icon: FileText, title: 'Verified lot documents', body: 'Weighment slips, assay reports and yard photos attached to every lot before it goes live.' },
  { icon: Bell, title: 'Real-time alerts', body: 'Outbid, closing-soon and new-lot notifications on the categories and yards you follow.' },
  { icon: TrendingUp, title: 'Karnataka price trends', body: 'Closing prices from across the state, so you know what a lot is worth before you bid.' },
  { icon: ShieldCheck, title: 'Verified sellers only', body: 'Every yard on the platform is KYC- and GST-verified before a single lot is listed.' },
  { icon: Headphones, title: 'Support that picks up', body: 'A Bengaluru-based desk that knows the yards, on call through the working week.' },
];

const HUBS = [
  'Bengaluru', 'Hubballi–Dharwad', 'Ballari · Toranagallu', 'Mangaluru',
  'Belagavi', 'Mysuru', 'Davanagere', 'Kalaburagi', 'Tumakuru', 'Shivamogga',
];

const FAQS = [
  { q: 'Is there a monthly plan?', a: 'Not right now. We run a single yearly plan at ₹4,999 so the price stays simple and every subscriber gets the same full access. Monthly billing may follow once the Karnataka rollout settles.' },
  { q: 'Why Karnataka only?', a: 'We are onboarding yards state by state, starting where our verification team is on the ground. Karnataka sellers are live today; other states open as their yards clear verification.' },
  { q: 'How do referral coupons work?', a: `Share your code. When someone subscribes with it, ₹${REFERRAL_COUPON} lands in your coupon wallet. Coupons stack and apply against your next renewal — ${FREE_AT} successful referrals cover a full year.` },
  { q: 'What happens after a year?', a: 'Your access runs for 365 days from activation. We remind you before it lapses, and any referral coupons in your wallet are applied to the renewal automatically.' },
];

/* Ease-out count-up used for the price and the referral wallet. Skipped
   entirely when the visitor asks for reduced motion. */
const useCountUp = (target, duration = 900, active = true) => {
  const reduce = useReducedMotion();
  const initial = reduce || !active ? target : 0;
  const [value, setValue] = useState(initial);
  /* Mirrors the rendered value so a target change mid-animation resumes from
     wherever the digits currently are rather than snapping back to zero. */
  const from = useRef(initial);

  useEffect(() => { from.current = value; }, [value]);

  useEffect(() => {
    if (reduce || !active) { from.current = target; setValue(target); return undefined; }
    const start = from.current;
    const delta = target - start;
    let raf;
    let t0;
    const tick = (t) => {
      if (t0 === undefined) t0 = t;
      const p = Math.min((t - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(start + delta * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, active, reduce]);

  return value;
};

/* Pointer-tracked tilt on the plan card. Returns motion values plus the
   handlers; falls back to a flat card under reduced motion. */
const useTilt = () => {
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spring = { stiffness: 140, damping: 18, mass: 0.6 };
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [7, -7]), spring);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-9, 9]), spring);

  const onMove = useCallback((e) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  }, [px, py, reduce]);

  const onLeave = useCallback(() => { px.set(0); py.set(0); }, [px, py]);

  return { rotateX: reduce ? 0 : rotateX, rotateY: reduce ? 0 : rotateY, onMove, onLeave };
};

const rise = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.07, ease: [0.2, 0, 0, 1] } }),
};

const Pricing = () => {
  /* The public site is what visitors actually see, so this is where published
     CMS copy has to land — the Sub Admin's editor writes to these exact section
     keys under route '/pricing'. Every accessor takes the string this page
     already hardcoded as its fallback, so nothing changes on screen until
     somebody publishes. See api/useCmsPage.ts. */
  const cms = useCmsPage('/pricing');
  const reduce = useReducedMotion();
  const price = useCountUp(PLAN_PRICE, 1100);
  const tilt = useTilt();

  const [referrals, setReferrals] = useState(3);
  const [copied, setCopied] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  const wallet = useCountUp(referrals * REFERRAL_COUPON, 420);
  const effective = Math.max(0, PLAN_PRICE - referrals * REFERRAL_COUPON);
  const effectiveShown = useCountUp(effective, 420);
  const isFree = effective === 0;
  const progress = Math.min(100, (referrals / FREE_AT) * 100);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(REFERRAL_CODE);
    } catch {
      /* Clipboard is blocked on insecure origins — the code is on screen anyway. */
    }
    setCopied(true);
  };

  useEffect(() => {
    if (!copied) return undefined;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const shareText = encodeURIComponent(
    `I'm bidding on scrap metal through FerroBid — Karnataka's yards in one place. Use my code ${REFERRAL_CODE} when you subscribe.`,
  );

  return (
    <div className="pricing-page">

      {/* ── Hero: the plan is the page, so it gets the whole stage ── */}
      <section className="pr-hero">
        <div className="pr-hero-glow" aria-hidden="true" />
        <div className="pr-hero-glow-2" aria-hidden="true" />

        <div className="container pr-hero-inner">
          <motion.div
            className="pr-hero-copy"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.08 } } }}
          >
            <motion.div variants={rise} className="pr-badge">
              <span className="pr-badge-dot" />
              <MapPin size={13} />
              {cms.text('intro', 'badge', 'Now live across Karnataka')}
            </motion.div>

            <motion.h1 variants={rise} className="pr-h1">
              One plan.<br />
              One year.<br />
              <span className="pr-h1-accent">
                {cms.text('intro', 'headline_accent', 'Every yard in Karnataka.')}
              </span>
            </motion.h1>

            <motion.p variants={rise} className="pr-lead">
              {cms.text('intro', 'subcopy',
                'No tiers to decode, no per-auction fees, no transaction cut on your subscription. '
                + 'A single yearly membership opens every verified auction in the state.')}
            </motion.p>

            <motion.ul variants={rise} className="pr-hero-points">
              {PLAN_FEATURES.slice(0, 3).map((f) => (
                <li key={f}><Check size={15} strokeWidth={3} />{f}</li>
              ))}
            </motion.ul>

            <motion.div variants={rise} className="pr-hero-refer">
              <Gift size={16} />
              <span>Refer a yard or a buyer — earn <strong>₹{REFERRAL_COUPON}</strong> in coupons each time.</span>
              <a href="#referral" className="pr-hero-refer-link">See how <ArrowRight size={14} /></a>
            </motion.div>
          </motion.div>

          {/* Plan card */}
          <motion.div
            className="pr-card-stage"
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.2, 0, 0, 1] }}
          >
            <motion.div
              className="pr-plan-card"
              onMouseMove={tilt.onMove}
              onMouseLeave={tilt.onLeave}
              style={{ rotateX: tilt.rotateX, rotateY: tilt.rotateY }}
            >
              <div className="pr-plan-ribbon">
                <Sparkles size={12} /> Founding Karnataka rate
              </div>

              <div className="pr-plan-head">
                <h2>Annual Membership</h2>
                <p>Everything FerroBid does, for twelve months.</p>
              </div>

              <div className="pr-price-row">
                <span className="pr-rupee">₹</span>
                <span className="pr-price">{inr(price)}</span>
                <span className="pr-period">/ year</span>
              </div>

              <div className="pr-price-chips">
                <span>≈ ₹{inr(Math.round(PLAN_PRICE / 12))} a month</span>
                <span>≈ ₹{(PLAN_PRICE / 365).toFixed(0)} a day</span>
                <span>Billed once</span>
              </div>

              <ul className="pr-plan-features">
                {PLAN_FEATURES.map((f, i) => (
                  <motion.li
                    key={f}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.07, duration: 0.35 }}
                  >
                    <span className="pr-tick"><Check size={12} strokeWidth={4} /></span>
                    {f}
                  </motion.li>
                ))}
              </ul>

              <Link to="/subscribe" className="pr-cta-main">
                <span>Subscribe for ₹{inr(PLAN_PRICE)}</span>
                <ArrowRight size={17} />
              </Link>

              <a href="#referral" className="pr-cta-sub">
                Or refer {FREE_AT} people and get the year free
              </a>

              <div className="pr-plan-foot">
                <ShieldCheck size={13} /> Verified sellers · Karnataka-wide access
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Referral calculator ────────────────────────────────────────────── */}
      <section className="pr-referral" id="referral">
        <div className="container">
          <motion.div
            className="sec-head is-center"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
            variants={rise}
          >
            <p className="sec-eyebrow">Referrals</p>
            <h2 className="sec-title">Every referral takes ₹{REFERRAL_COUPON} off your year</h2>
            <p className="sec-lead">
              Share your code with a buyer or a yard. When they subscribe, ₹{REFERRAL_COUPON} in coupons
              drops into your wallet — and coupons stack all the way to a free year.
            </p>
          </motion.div>

          <div className="pr-ref-grid">
            {/* Calculator */}
            <motion.div
              className={`pr-calc ${isFree ? 'is-free' : ''}`}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.55, ease: [0.2, 0, 0, 1] }}
            >
              <div className="pr-calc-top">
                <div className="pr-calc-label">
                  <Users size={15} />
                  People you refer
                </div>
                <motion.div
                  key={referrals}
                  className="pr-calc-count"
                  initial={reduce ? false : { scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                >
                  {referrals}
                </motion.div>
              </div>

              <input
                type="range"
                min="0"
                max={FREE_AT}
                step="1"
                value={referrals}
                onChange={(e) => setReferrals(parseInt(e.target.value, 10))}
                className="pr-range"
                aria-label="Number of people you refer"
                style={{ '--fill': `${progress}%` }}
              />
              <div className="pr-range-ends">
                <span>0</span>
                <span>{FREE_AT}+ = free year</span>
              </div>

              <div className="pr-calc-out">
                <div className="pr-calc-box">
                  <span className="pr-calc-box-label"><Ticket size={13} /> Coupon wallet</span>
                  <span className="pr-calc-box-val pr-earn">₹{inr(wallet)}</span>
                </div>
                <div className="pr-calc-arrow"><ArrowRight size={18} /></div>
                <div className="pr-calc-box">
                  <span className="pr-calc-box-label">You pay for the year</span>
                  <span className="pr-calc-box-val">
                    {isFree ? (
                      <span className="pr-free">FREE</span>
                    ) : (
                      <>
                        <s>₹{inr(PLAN_PRICE)}</s> ₹{inr(effectiveShown)}
                      </>
                    )}
                  </span>
                </div>
              </div>

              <div className="pr-progress" role="presentation">
                <motion.div
                  className="pr-progress-fill"
                  animate={{ width: `${progress}%` }}
                  transition={{ type: 'spring', stiffness: 160, damping: 22 }}
                />
              </div>

              <div className={`pr-calc-note ${isFree ? 'is-free' : ''}`}>
                {isFree ? (
                  <><PartyPopper size={15} /> That is a full year on us. Anything past {FREE_AT} rolls into your next renewal.</>
                ) : (
                  <>{FREE_AT - referrals} more referral{FREE_AT - referrals === 1 ? '' : 's'} and your year costs nothing.</>
                )}
              </div>
            </motion.div>

            {/* Code + steps */}
            <motion.div
              className="pr-ref-side"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.55, delay: 0.1, ease: [0.2, 0, 0, 1] }}
            >
              <div className="pr-code-card">
                <span className="pr-code-label">Your referral code</span>
                <div className="pr-code-row">
                  <code>{REFERRAL_CODE}</code>
                  <button type="button" onClick={copyCode} className={`pr-copy ${copied ? 'is-copied' : ''}`}>
                    {copied ? <><CheckCheck size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                  </button>
                </div>
                <a
                  className="pr-share"
                  href={`https://wa.me/?text=${shareText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Share2 size={14} /> Share on WhatsApp
                </a>
              </div>

              <ol className="pr-steps">
                {[
                  { t: 'Share your code', d: 'Send it to a buyer, a trader or a yard owner in your circle.' },
                  { t: 'They subscribe', d: `They enter your code at checkout and start their ₹${inr(PLAN_PRICE)} year.` },
                  { t: `₹${REFERRAL_COUPON} lands in your wallet`, d: 'Applied against your renewal. No cap on how many you earn.' },
                ].map((s, i) => (
                  <motion.li
                    key={s.t}
                    initial={{ opacity: 0, x: 14 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                  >
                    <span className="pr-step-num">{i + 1}</span>
                    <div>
                      <strong>{s.t}</strong>
                      <p>{s.d}</p>
                    </div>
                  </motion.li>
                ))}
              </ol>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── What the plan includes ─────────────────────────────────────────── */}
      {cms.on('comparison') && (
      <section className="pr-included">
        <div className="container">
          <motion.div
            className="sec-head is-center"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
            variants={rise}
          >
            <p className="sec-eyebrow">What's included</p>
            <h2 className="sec-title">One price. Nothing held back.</h2>
            <p className="sec-lead">There is no upgrade path because there is nothing above this plan.</p>
          </motion.div>

          <div className="pr-inc-grid">
            {INCLUDED.map((item, i) => (
              <motion.div
                key={item.title}
                className="pr-inc-card"
                custom={i}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.3 }}
                variants={rise}
              >
                <div className="pr-inc-icon"><item.icon size={20} /></div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ── Karnataka coverage ─────────────────────────────────────────────── */}
      <section className="pr-state">
        <div className="pr-state-glow" aria-hidden="true" />
        <div className="container pr-state-inner">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5 }}
          >
            <p className="pr-state-eyebrow"><MapPin size={13} /> Karnataka first</p>
            <h2 className="pr-state-title">Built around the yards you already drive to.</h2>
            <p className="pr-state-lead">
              We started in Karnataka on purpose — verified sellers, local support, and lots close
              enough to inspect before you bid. Every hub below is live under the same ₹{inr(PLAN_PRICE)} plan.
            </p>
            <Link to="/marketplace" className="pr-state-link">
              Browse live Karnataka lots <ArrowRight size={15} />
            </Link>
          </motion.div>

          <div className="pr-hub-cloud">
            {HUBS.map((h, i) => (
              <motion.span
                key={h}
                className="pr-hub"
                initial={{ opacity: 0, scale: 0.85 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.35, delay: i * 0.05 }}
              >
                <Building2 size={13} /> {h}
              </motion.span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      {cms.on('faq') && (
      <section className="pr-faq">
        <div className="container pr-faq-inner">
          <div className="sec-head is-center">
            <p className="sec-eyebrow">Questions</p>
            <h2 className="sec-title">Before you subscribe</h2>
          </div>

          <div className="pr-faq-list">
            {FAQS.map((f, i) => (
              <div key={f.q} className={`pr-faq-item ${openFaq === i ? 'is-open' : ''}`}>
                <button
                  type="button"
                  className="pr-faq-q"
                  onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                  aria-expanded={openFaq === i}
                >
                  {f.q}
                  <ChevronDown size={17} className="pr-faq-chevron" />
                </button>
                <motion.div
                  className="pr-faq-a-wrap"
                  initial={false}
                  animate={{ height: openFaq === i ? 'auto' : 0, opacity: openFaq === i ? 1 : 0 }}
                  transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
                >
                  <p className="pr-faq-a">{f.a}</p>
                </motion.div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ── Closing CTA ────────────────────────────────────────────────────── */}
      <section className="pr-close">
        <div className="container text-center">
          <p className="cta-kicker">Karnataka · 2026</p>
          <h2 className="pr-close-title">
            ₹{inr(PLAN_PRICE)} for the year.<br /><span>₹0 if ten people say yes.</span>
          </h2>
          <div className="pr-close-actions">
            <Link to="/subscribe" className="btn btn-primary pr-close-btn">
              Subscribe now <ArrowRight size={16} />
            </Link>
            <Link to="/contact" className="btn btn-outline pr-close-btn">
              Talk to sales
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Pricing;
