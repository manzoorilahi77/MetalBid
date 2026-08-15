import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, ArrowLeft, CheckCircle2, ShieldCheck, Loader2, Lock, PartyPopper,
  Building2, Landmark, FileText, Package, ShoppingBag,
} from 'lucide-react';
import { useStore, ROLE_HOME } from '../../store/store';
import {
  KARNATAKA_DISTRICTS, MATERIALS, check, inr, passwordStrength,
  readPendingSubscription, clearPendingSubscription, orderRef,
} from '../checkout/plan';
import { Stepper, Field, Select, Textarea, ChipGroup, Segments, useFormState } from '../checkout/ui';
import '../styles/checkout.css';

/* ---------------------------------------------------------------------------
   Step 3–4 of the funnel, reached only after payment: the full KYC-shaped form
   for whichever side of the market they bought into, then the password.

   The account is created here, at the end — one call to registerAccount, which
   assigns the permanent Bidder ID / Seller ID and signs them straight into
   their portal. Landing here without a paid subscription in session sends you
   back to /subscribe rather than showing an empty form.
   --------------------------------------------------------------------------- */

const BUYER_TYPES = ['Trader / Dealer', 'Re-roller / Furnace', 'Foundry', 'Manufacturer', 'Exporter', 'Other'];
const SELLER_TYPES = ['Manufacturing plant', 'Scrap yard', 'Dismantler', 'Government / PSU', 'Contractor', 'Other'];
const VOLUMES = ['Under 50 MT', '50 – 200 MT', '200 – 500 MT', '500 – 1,000 MT', 'Over 1,000 MT'];

const Onboarding = () => {
  const navigate = useNavigate();
  const registerAccount = useStore((s) => s.registerAccount);

  const [pending, setPending] = useState(() => readPendingSubscription());
  const [step, setStep] = useState(2);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [matError, setMatError] = useState('');
  const [terms, setTerms] = useState(false);
  const [termsError, setTermsError] = useState('');

  /* Nobody should be filling in a settlement account they have not paid for. */
  useEffect(() => {
    if (!pending) navigate('/subscribe', { replace: true });
  }, [pending, navigate]);

  const isSeller = pending?.role === 'seller';

  const b = useFormState({
    entityType: '', gstin: '', pan: '', address: '', district: pending?.district || '', pincode: '',
    volume: '', contactRole: '', weighbridge: 'yes', accountName: '', accountNumber: '', ifsc: '',
  });
  const pw = useFormState({ password: '', confirm: '' });

  const detailValidators = useMemo(() => {
    const common = {
      entityType: check.required('Business type'),
      gstin: check.gstin,
      pan: check.pan,
      address: check.required(isSeller ? 'Yard / plant address' : 'Billing address'),
      district: check.required('District'),
      pincode: check.pincode,
      volume: check.required('Monthly volume'),
      contactRole: check.required('Your designation'),
    };
    /* Sellers are paid by us, so the settlement account is part of their
       onboarding — a buyer pays the seller directly and needs no such account. */
    return isSeller
      ? { ...common, accountName: check.required('Account holder name'), accountNumber: check.account, ifsc: check.ifsc }
      : common;
  }, [isSeller]);

  const submitDetails = (e) => {
    e.preventDefault();
    const okFields = b.validateAll(detailValidators);
    const okMaterials = materials.length > 0;
    setMatError(okMaterials ? '' : 'Pick at least one material');
    if (!okFields || !okMaterials) return;
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const finish = (e) => {
    e.preventDefault();
    const okPw = pw.validateAll({
      password: check.password,
      confirm: (v) => check.confirm(v, pw.values.password),
    });
    setTermsError(terms ? '' : 'Please accept the terms to continue');
    if (!okPw || !terms) return;

    setSaving(true);
    setTimeout(() => {
      /* The one moment a permanent Bidder ID / Seller ID is assigned. The store
         signs the new account in as part of this call, which is what makes the
         portal button below open a real session rather than a preview. */
      const user = registerAccount({
        name: pending.name,
        email: pending.email,
        phone: pending.phone,
        firm: pending.company,
        role: pending.role,
        city: b.values.district,
        gstin: b.values.gstin,
      });
      clearPendingSubscription();
      setSaving(false);
      setCreated(user);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 1500);
  };

  if (!pending) return null;

  const strength = passwordStrength(pw.values.password);
  const RoleIcon = isSeller ? Package : ShoppingBag;

  /* ── done ── */
  if (created) {
    return (
      <div className="ck-page">
        <div className="container ck-shell ck-shell-narrow">
          <motion.div className="ck-done" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <motion.div
              className="ck-done-mark"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
            >
              <PartyPopper size={30} />
            </motion.div>
            <h1>You're in, {created.name.split(' ')[0]}.</h1>
            <p className="ck-done-lead">
              Your {isSeller ? 'seller' : 'buyer'} account is active for the next 12 months.
            </p>

            <div className="ck-idcard">
              <span className="ck-idcard-label">{isSeller ? 'Seller ID' : 'Bidder ID'}</span>
              <span className="ck-idcard-val">{isSeller ? created.sellerId : created.bidderId}</span>
              <span className="ck-idcard-note">
                {isSeller
                  ? 'Assigned once, for good. Our team verifies your firm before your first lot goes live.'
                  : 'Assigned once, for good. This is the only ID sellers ever see in a bid room.'}
              </span>
            </div>

            <button className="ck-primary ck-done-cta" onClick={() => { window.location.hash = ROLE_HOME[pending.role]; }}>
              <RoleIcon size={17} /> Open my {isSeller ? 'seller' : 'buyer'} portal <ArrowRight size={16} />
            </button>
            <Link to="/" className="ck-done-link">Back to the public site</Link>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ── steps 3 & 4 ── */
  return (
    <div className="ck-page">
      <div className="container ck-shell">
        <div className="ck-paid">
          <CheckCircle2 size={16} />
          <div>
            <strong>Payment received — ₹{inr(pending.amountPaid)}</strong>
            <span>Order {orderRef(pending.paidAt)} · {pending.method === 'upi' ? 'UPI' : pending.method === 'card' ? 'Card' : 'Net banking'}{pending.discount ? ` · ₹${inr(pending.discount)} referral coupon applied` : ''}</span>
          </div>
        </div>

        <div className="ck-head">
          <h1>{isSeller ? 'Tell us about your yard' : 'Tell us about your business'}</h1>
          <p>We verify these details before your account goes fully live. It takes about two minutes.</p>
        </div>

        <Stepper current={step} />

        <div className="ck-grid">
          <div className="ck-main">
            <AnimatePresence mode="wait">
              {step === 2 ? (
                <motion.form
                  key="details"
                  onSubmit={submitDetails}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.28 }}
                  className="ck-card"
                >
                  <h2 className="ck-card-title"><Building2 size={16} /> {isSeller ? 'Yard & firm' : 'Firm & billing'}</h2>
                  <div className="ck-fields">
                    <Select id="entityType" label={isSeller ? 'What kind of seller are you?' : 'What kind of buyer are you?'}
                      value={b.values.entityType} onChange={b.set('entityType')}
                      onBlur={b.blur('entityType', check.required('Business type'))} error={b.errors.entityType} touched={b.touched.entityType}
                      options={isSeller ? SELLER_TYPES : BUYER_TYPES} span={2} />
                    <Field id="gstin" label="GSTIN" value={b.values.gstin} onChange={b.set('gstin')} uppercase
                      onBlur={b.blur('gstin', check.gstin)} error={b.errors.gstin} touched={b.touched.gstin}
                      placeholder="29ABCDE1234F1Z5" maxLength={15} hint="Karnataka GSTINs start with 29." />
                    <Field id="pan" label="PAN" value={b.values.pan} onChange={b.set('pan')} uppercase
                      onBlur={b.blur('pan', check.pan)} error={b.errors.pan} touched={b.touched.pan}
                      placeholder="ABCDE1234F" maxLength={10} />
                    <Textarea id="address" label={isSeller ? 'Yard / plant address' : 'Billing address'}
                      value={b.values.address} onChange={b.set('address')}
                      onBlur={b.blur('address', check.required(isSeller ? 'Yard / plant address' : 'Billing address'))}
                      error={b.errors.address} touched={b.touched.address}
                      placeholder={isSeller ? 'Plot 14, KIADB Industrial Area, …' : 'Door no, street, area, …'} />
                    <Select id="district" label="District" value={b.values.district} onChange={b.set('district')}
                      onBlur={b.blur('district', check.required('District'))} error={b.errors.district} touched={b.touched.district}
                      options={KARNATAKA_DISTRICTS} />
                    <Field id="pincode" label="PIN code" value={b.values.pincode} onChange={b.set('pincode')}
                      onBlur={b.blur('pincode', check.pincode)} error={b.errors.pincode} touched={b.touched.pincode}
                      placeholder="560103" maxLength={6} inputMode="numeric" />
                  </div>

                  <h2 className="ck-card-title ck-mt"><FileText size={16} /> {isSeller ? 'What you sell' : 'What you buy'}</h2>
                  <div className="ck-fields">
                    <ChipGroup
                      label={isSeller ? 'Materials you generate' : 'Materials you bid on'}
                      options={MATERIALS}
                      selected={materials}
                      onToggle={(m) => {
                        setMaterials((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
                        setMatError('');
                      }}
                      error={matError}
                      touched={!!matError}
                    />
                    <Select id="volume" label={isSeller ? 'Monthly scrap generated' : 'Monthly purchase volume'}
                      value={b.values.volume} onChange={b.set('volume')}
                      onBlur={b.blur('volume', check.required('Monthly volume'))} error={b.errors.volume} touched={b.touched.volume}
                      options={VOLUMES} />
                    <Field id="contactRole" label="Your designation" value={b.values.contactRole} onChange={b.set('contactRole')}
                      onBlur={b.blur('contactRole', check.required('Your designation'))} error={b.errors.contactRole} touched={b.touched.contactRole}
                      placeholder="Proprietor / Purchase Head" />
                    {isSeller && (
                      <Segments
                        label="Weighbridge on site?"
                        value={b.values.weighbridge}
                        onChange={(v) => b.setValues((prev) => ({ ...prev, weighbridge: v }))}
                        options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No — nearest public weighbridge' }]}
                      />
                    )}
                  </div>

                  {isSeller && (
                    <>
                      <h2 className="ck-card-title ck-mt"><Landmark size={16} /> Settlement account</h2>
                      <p className="ck-card-sub">Where we release your sale proceeds once a lot is lifted and paid for.</p>
                      <div className="ck-fields">
                        <Field id="accountName" label="Account holder name" value={b.values.accountName} onChange={b.set('accountName')}
                          onBlur={b.blur('accountName', check.required('Account holder name'))} error={b.errors.accountName} touched={b.touched.accountName}
                          placeholder="As printed in your bank records" span={2} />
                        <Field id="accountNumber" label="Account number" value={b.values.accountNumber} onChange={b.set('accountNumber')}
                          onBlur={b.blur('accountNumber', check.account)} error={b.errors.accountNumber} touched={b.touched.accountNumber}
                          inputMode="numeric" maxLength={18} />
                        <Field id="ifsc" label="IFSC" value={b.values.ifsc} onChange={b.set('ifsc')} uppercase
                          onBlur={b.blur('ifsc', check.ifsc)} error={b.errors.ifsc} touched={b.touched.ifsc}
                          placeholder="HDFC0001234" maxLength={11} />
                      </div>
                    </>
                  )}

                  <button type="submit" className="ck-primary">
                    Continue to password <ArrowRight size={16} />
                  </button>
                </motion.form>
              ) : (
                <motion.form
                  key="password"
                  onSubmit={finish}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.28 }}
                  className="ck-card"
                >
                  <h2 className="ck-card-title"><Lock size={16} /> Set your password</h2>
                  <p className="ck-card-sub">You will sign in with <strong>{pending.email}</strong> and this password.</p>

                  <div className="ck-fields">
                    <Field id="password" label="Password" type="password" value={pw.values.password} onChange={pw.set('password')}
                      onBlur={pw.blur('password', check.password)} error={pw.errors.password} touched={pw.touched.password}
                      autoComplete="new-password" span={2} />
                    {pw.values.password && (
                      <div className="ck-strength" data-span="2">
                        <div className="ck-strength-track">
                          <motion.div className="ck-strength-fill" animate={{ width: `${strength.pct}%`, backgroundColor: strength.color }} transition={{ duration: 0.35 }} />
                        </div>
                        <span style={{ color: strength.color }}>{strength.label}</span>
                      </div>
                    )}
                    <Field id="confirm" label="Confirm password" type="password" value={pw.values.confirm} onChange={pw.set('confirm')}
                      onBlur={pw.blur('confirm', (v) => check.confirm(v, pw.values.password))} error={pw.errors.confirm} touched={pw.touched.confirm}
                      autoComplete="new-password" span={2} />
                  </div>

                  <label className={`ck-terms ${termsError ? 'is-bad' : ''}`}>
                    <input type="checkbox" checked={terms} onChange={(e) => { setTerms(e.target.checked); setTermsError(''); }} />
                    <span>
                      I accept the <Link to="/terms">Terms of Use</Link> and <Link to="/privacy">Privacy Policy</Link>, and confirm the details above are correct.
                    </span>
                  </label>
                  {termsError && <p className="ck-err ck-err-block">{termsError}</p>}

                  <div className="ck-actions">
                    <button type="button" className="ck-ghost" onClick={() => setStep(2)} disabled={saving}>
                      <ArrowLeft size={15} /> Back
                    </button>
                    <button type="submit" className="ck-primary" disabled={saving}>
                      {saving ? (<><Loader2 size={16} className="ck-spin" /> Creating your account…</>)
                        : (<>Create my account <ArrowRight size={16} /></>)}
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          <aside className="ck-side">
            <div className="ck-summary">
              <div className="ck-summary-head">
                <span className="ck-summary-eyebrow">Your subscription</span>
                <h3>{pending.company}</h3>
                <p>{pending.name} · {pending.district}</p>
              </div>

              <div className="ck-summary-role">
                <RoleIcon size={15} />
                <span>Joining as a <strong>{isSeller ? 'Seller' : 'Buyer'}</strong></span>
              </div>

              <div className="ck-summary-lines">
                <div className="ck-line"><span>Paid today</span><span>₹{inr(pending.amountPaid)}</span></div>
                <div className="ck-line"><span>Valid for</span><span>12 months</span></div>
                <div className="ck-line"><span>Coverage</span><span>Karnataka</span></div>
              </div>

              <div className="ck-summary-foot">
                <ShieldCheck size={13} />
                {isSeller
                  ? 'Your firm goes to our verification desk as soon as you finish. We reply within one working day.'
                  : 'Your bidding access opens the moment your account is created.'}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
