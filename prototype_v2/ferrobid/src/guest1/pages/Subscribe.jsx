import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, ShoppingBag, Package, Ticket, ShieldCheck, Lock,
  Smartphone, CreditCard, Landmark, Loader2, Check, MapPin, BadgeIndianRupee,
} from 'lucide-react';
import {
  PLAN_PRICE, PLAN_NAME, REFERRAL_COUPON, KARNATAKA_DISTRICTS,
  check, inr, referralDiscount, savePendingSubscription,
} from '../checkout/plan';
import { Stepper, Field, Select, Segments, useFormState } from '../checkout/ui';
import '../styles/checkout.css';

/* ---------------------------------------------------------------------------
   Step 1–2 of the subscription funnel: who is signing up and which side of the
   market they are on, then payment. Everything long-form — GST, addresses,
   bank details, password — waits until after the money clears, on /onboarding.
   Nothing here creates an account; the account is created at the end of
   onboarding, so an abandoned payment never leaves a half-made login behind.
   --------------------------------------------------------------------------- */

const ROLES = [
  {
    value: 'buyer',
    icon: ShoppingBag,
    title: 'I want to buy',
    body: 'Bid on verified ferrous and non-ferrous lots across Karnataka.',
    perks: ['Bid on every live auction', 'Permanent Bidder ID', 'Outbid & closing alerts'],
  },
  {
    value: 'seller',
    icon: Package,
    title: 'I want to sell',
    body: 'List yard scrap and run it in front of verified buyers.',
    perks: ['List unlimited lots', 'Permanent Seller ID', 'Settlement in one ledger'],
  },
];

const PAY_METHODS = [
  { value: 'upi', label: 'UPI', icon: Smartphone },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'netbanking', label: 'Net banking', icon: Landmark },
];

const BANKS = ['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank', 'Canara Bank', 'Karnataka Bank'];

const luhnish = (v) => v.replace(/\D/g, '').length >= 15;

const Subscribe = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState('buyer');
  const [paying, setPaying] = useState(false);

  const f = useFormState({
    name: '', email: '', phone: '', company: '', district: '', referral: '',
  });
  const p = useFormState({
    method: 'upi', upi: '', cardName: '', cardNumber: '', cardExpiry: '', cardCvv: '', bank: '',
  });

  const discount = referralDiscount(f.values.referral);
  const total = PLAN_PRICE - discount;
  const roleMeta = ROLES.find((r) => r.value === role);

  const detailValidators = useMemo(() => ({
    name: check.name,
    email: check.email,
    phone: check.phone,
    company: check.required('Company / firm name'),
    district: check.required('District'),
  }), []);

  const submitDetails = (e) => {
    e.preventDefault();
    if (!f.validateAll(detailValidators)) return;
    setStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const payValidators = () => {
    if (p.values.method === 'upi') return { upi: (v) => (!v ? 'UPI ID is required' : /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(v) ? '' : 'Enter a valid UPI ID (name@bank)') };
    if (p.values.method === 'card') {
      return {
        cardName: check.required('Name on card'),
        cardNumber: (v) => (!v ? 'Card number is required' : luhnish(v) ? '' : 'Enter a valid card number'),
        cardExpiry: (v) => (!v ? 'Expiry is required' : /^(0[1-9]|1[0-2])\/\d{2}$/.test(v) ? '' : 'Use MM/YY'),
        cardCvv: (v) => (!v ? 'CVV is required' : /^\d{3,4}$/.test(v) ? '' : 'CVV is 3 or 4 digits'),
      };
    }
    return { bank: check.required('Bank') };
  };

  const pay = (e) => {
    e.preventDefault();
    if (!p.validateAll(payValidators())) return;
    setPaying(true);
    /* Stands in for the gateway round-trip. On the way back we write down what
       was bought and who bought it, then hand off to onboarding. */
    setTimeout(() => {
      savePendingSubscription({
        role,
        ...f.values,
        amountPaid: total,
        discount,
        method: p.values.method,
        paidAt: Date.now(),
      });
      navigate('/onboarding');
    }, 2100);
  };

  return (
    <div className="ck-page">
      <div className="container ck-shell">
        <Link to="/pricing" className="ck-back"><ArrowLeft size={15} /> Back to pricing</Link>

        <div className="ck-head">
          <h1>Start your FerroBid year</h1>
          <p>One plan, ₹{inr(PLAN_PRICE)} for twelve months of Karnataka auctions.</p>
        </div>

        <Stepper current={step} />

        <div className="ck-grid">
          <div className="ck-main">
            <AnimatePresence mode="wait">
              {step === 0 ? (
                <motion.form
                  key="details"
                  onSubmit={submitDetails}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.28 }}
                  className="ck-card"
                >
                  <h2 className="ck-card-title">Which side of the market are you on?</h2>
                  <p className="ck-card-sub">This decides whether your account gets a Bidder ID or a Seller ID. It is set once, at signup.</p>

                  <div className="ck-roles">
                    {ROLES.map((r) => (
                      <button
                        type="button"
                        key={r.value}
                        className={`ck-role ${role === r.value ? 'is-on' : ''}`}
                        onClick={() => setRole(r.value)}
                        aria-pressed={role === r.value}
                      >
                        <span className="ck-role-icon"><r.icon size={20} /></span>
                        <span className="ck-role-body">
                          <strong>{r.title}</strong>
                          <span>{r.body}</span>
                        </span>
                        <span className="ck-role-tick"><Check size={13} strokeWidth={4} /></span>
                      </button>
                    ))}
                  </div>

                  <h2 className="ck-card-title ck-mt">Your details</h2>
                  <div className="ck-fields">
                    <Field id="name" label="Full name" value={f.values.name} onChange={f.set('name')}
                      onBlur={f.blur('name', check.name)} error={f.errors.name} touched={f.touched.name}
                      placeholder="Ravi Kumar" autoComplete="name" />
                    <Field id="email" label="Work email" type="email" value={f.values.email} onChange={f.set('email')}
                      onBlur={f.blur('email', check.email)} error={f.errors.email} touched={f.touched.email}
                      placeholder="ravi@yardworks.in" autoComplete="email" />
                    <Field id="phone" label="Mobile number" value={f.values.phone} onChange={f.set('phone')}
                      onBlur={f.blur('phone', check.phone)} error={f.errors.phone} touched={f.touched.phone}
                      placeholder="9xxxxxxxxx" maxLength={10} inputMode="numeric" autoComplete="tel" />
                    <Field id="company" label="Company / firm" value={f.values.company} onChange={f.set('company')}
                      onBlur={f.blur('company', check.required('Company / firm name'))} error={f.errors.company} touched={f.touched.company}
                      placeholder="Yardworks Metals Pvt Ltd" autoComplete="organization" />
                    <Select id="district" label="District" value={f.values.district} onChange={f.set('district')}
                      onBlur={f.blur('district', check.required('District'))} error={f.errors.district} touched={f.touched.district}
                      options={KARNATAKA_DISTRICTS} placeholder="Select your district" />
                    <Field id="referral" label="Referral code (optional)" value={f.values.referral} onChange={f.set('referral')}
                      uppercase placeholder="FERRO-KA-4999"
                      hint={discount ? `₹${inr(REFERRAL_COUPON)} off applied` : `Have a friend's code? It takes ₹${inr(REFERRAL_COUPON)} off.`} />
                  </div>

                  <div className="ck-note">
                    <MapPin size={14} />
                    We are live in Karnataka only. Sellers outside the state can join the waitlist from <Link to="/contact">Contact us</Link>.
                  </div>

                  <button type="submit" className="ck-primary">
                    Continue to payment <ArrowRight size={16} />
                  </button>
                </motion.form>
              ) : (
                <motion.form
                  key="pay"
                  onSubmit={pay}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.28 }}
                  className="ck-card"
                >
                  <h2 className="ck-card-title">Payment</h2>
                  <p className="ck-card-sub">You are paying ₹{inr(total)} once, for a full year of access.</p>

                  <Segments
                    options={PAY_METHODS}
                    value={p.values.method}
                    onChange={(v) => { p.setValues((prev) => ({ ...prev, method: v })); p.setErrors({}); }}
                  />

                  <div className="ck-fields">
                    {p.values.method === 'upi' && (
                      <Field id="upi" label="UPI ID" value={p.values.upi} onChange={p.set('upi')}
                        onBlur={p.blur('upi', payValidators().upi)} error={p.errors.upi} touched={p.touched.upi}
                        placeholder="ravi@okhdfcbank" span={2} hint="You will get a collect request on your UPI app." />
                    )}

                    {p.values.method === 'card' && (
                      <>
                        <Field id="cardName" label="Name on card" value={p.values.cardName} onChange={p.set('cardName')}
                          onBlur={p.blur('cardName', check.required('Name on card'))} error={p.errors.cardName} touched={p.touched.cardName}
                          placeholder="RAVI KUMAR" span={2} />
                        <Field id="cardNumber" label="Card number" value={p.values.cardNumber} onChange={p.set('cardNumber')}
                          onBlur={p.blur('cardNumber', payValidators().cardNumber)} error={p.errors.cardNumber} touched={p.touched.cardNumber}
                          placeholder="4111 1111 1111 1111" maxLength={19} inputMode="numeric" span={2} />
                        <Field id="cardExpiry" label="Expiry" value={p.values.cardExpiry} onChange={p.set('cardExpiry')}
                          onBlur={p.blur('cardExpiry', payValidators().cardExpiry)} error={p.errors.cardExpiry} touched={p.touched.cardExpiry}
                          placeholder="MM/YY" maxLength={5} inputMode="numeric" />
                        <Field id="cardCvv" label="CVV" type="password" value={p.values.cardCvv} onChange={p.set('cardCvv')}
                          onBlur={p.blur('cardCvv', payValidators().cardCvv)} error={p.errors.cardCvv} touched={p.touched.cardCvv}
                          placeholder="•••" maxLength={4} inputMode="numeric" />
                      </>
                    )}

                    {p.values.method === 'netbanking' && (
                      <Select id="bank" label="Your bank" value={p.values.bank} onChange={p.set('bank')}
                        onBlur={p.blur('bank', check.required('Bank'))} error={p.errors.bank} touched={p.touched.bank}
                        options={BANKS} placeholder="Select your bank" span={2} />
                    )}
                  </div>

                  <div className="ck-secure"><Lock size={13} /> Payments are encrypted end to end. We never store card details.</div>

                  <div className="ck-actions">
                    <button type="button" className="ck-ghost" onClick={() => setStep(0)} disabled={paying}>
                      <ArrowLeft size={15} /> Back
                    </button>
                    <button type="submit" className="ck-primary" disabled={paying}>
                      {paying ? (<><Loader2 size={16} className="ck-spin" /> Processing payment…</>)
                        : (<><BadgeIndianRupee size={16} /> Pay ₹{inr(total)}</>)}
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          {/* Order summary — the same figures on both steps, so what is being
              bought never leaves the screen. */}
          <aside className="ck-side">
            <div className="ck-summary">
              <div className="ck-summary-head">
                <span className="ck-summary-eyebrow">Order summary</span>
                <h3>{PLAN_NAME}</h3>
                <p>12 months · Karnataka-wide access</p>
              </div>

              <div className="ck-summary-role">
                <roleMeta.icon size={15} />
                <span>Signing up as a <strong>{role === 'buyer' ? 'Buyer' : 'Seller'}</strong></span>
              </div>

              <ul className="ck-summary-perks">
                {roleMeta.perks.map((perk) => (
                  <li key={perk}><Check size={13} strokeWidth={4} /> {perk}</li>
                ))}
              </ul>

              <div className="ck-summary-lines">
                <div className="ck-line"><span>Annual plan</span><span>₹{inr(PLAN_PRICE)}</span></div>
                <AnimatePresence>
                  {discount > 0 && (
                    <motion.div
                      className="ck-line is-credit"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <span><Ticket size={13} /> Referral coupon</span>
                      <span>− ₹{inr(discount)}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="ck-line is-total"><span>Total due today</span><span>₹{inr(total)}</span></div>
              </div>

              <div className="ck-summary-foot">
                <ShieldCheck size={13} /> Verified sellers · One payment, no renewals until next year
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Subscribe;
