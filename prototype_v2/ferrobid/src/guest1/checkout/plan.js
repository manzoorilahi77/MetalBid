/* ---------------------------------------------------------------------------
   The subscription plan, in one place.

   Pricing.jsx renders these numbers, Subscribe.jsx charges them and
   Onboarding.jsx confirms them, so they live here rather than being retyped on
   three screens. The launch is Karnataka-only, one yearly plan, no tiers.
   --------------------------------------------------------------------------- */

export const PLAN_PRICE = 4999;
export const PLAN_NAME = 'Annual Membership';
export const REFERRAL_COUPON = 500;
/** Referrals that fully cover a year — the number the pricing calculator counts to. */
export const FREE_AT = Math.ceil(PLAN_PRICE / REFERRAL_COUPON);
/** The code a subscriber shares. One prototype code for everybody. */
export const REFERRAL_CODE = 'FERRO-KA-4999';

export const inr = (n) => n.toLocaleString('en-IN');

/** Karnataka only, so the district list is fixed rather than a free-text field —
 *  it is also what tells a visitor at a glance where we do and don't operate. */
export const KARNATAKA_DISTRICTS = [
  'Bagalkote', 'Ballari', 'Belagavi', 'Bengaluru Rural', 'Bengaluru Urban', 'Bidar',
  'Chamarajanagara', 'Chikkaballapura', 'Chikkamagaluru', 'Chitradurga', 'Dakshina Kannada',
  'Davanagere', 'Dharwad', 'Gadag', 'Hassan', 'Haveri', 'Kalaburagi', 'Kodagu', 'Kolar',
  'Koppal', 'Mandya', 'Mysuru', 'Raichur', 'Ramanagara', 'Shivamogga', 'Tumakuru',
  'Udupi', 'Uttara Kannada', 'Vijayanagara', 'Vijayapura', 'Yadgir',
];

export const MATERIALS = [
  'HMS 1 & 2', 'Turnings & Borings', 'Cast Iron', 'MS Scrap', 'Copper',
  'Aluminium', 'Brass', 'Stainless Steel', 'Lead', 'Zinc', 'E-scrap',
];

/* --- validators ---------------------------------------------------------- */
const RX = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[6-9]\d{9}$/,
  gstin: /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/,
  pan: /^[A-Z]{5}\d{4}[A-Z]$/,
  pincode: /^[1-9]\d{5}$/,
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  account: /^\d{9,18}$/,
};

export const check = {
  required: (label) => (v) => (String(v || '').trim() ? '' : `${label} is required`),
  name: (v) => {
    if (!v?.trim()) return 'Full name is required';
    if (v.trim().split(/\s+/).length < 2) return 'Enter your full name (first & last)';
    return '';
  },
  email: (v) => (!v ? 'Email is required' : RX.email.test(v) ? '' : 'Enter a valid email address'),
  phone: (v) => (!v ? 'Mobile number is required' : RX.phone.test(String(v).replace(/\s/g, '')) ? '' : 'Enter a valid 10-digit Indian mobile number'),
  gstin: (v) => (!v ? 'GSTIN is required' : RX.gstin.test(v.toUpperCase()) ? '' : 'Enter a valid 15-character GSTIN'),
  pan: (v) => (!v ? 'PAN is required' : RX.pan.test(v.toUpperCase()) ? '' : 'Enter a valid PAN (e.g. ABCDE1234F)'),
  pincode: (v) => (!v ? 'PIN code is required' : RX.pincode.test(v) ? '' : 'Enter a valid 6-digit PIN code'),
  ifsc: (v) => (!v ? 'IFSC is required' : RX.ifsc.test(v.toUpperCase()) ? '' : 'Enter a valid IFSC (e.g. HDFC0001234)'),
  account: (v) => (!v ? 'Account number is required' : RX.account.test(String(v).replace(/\s/g, '')) ? '' : 'Enter a valid account number'),
  password: (v) => {
    if (!v) return 'Password is required';
    if (v.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(v)) return 'Include at least one uppercase letter';
    if (!/[0-9]/.test(v)) return 'Include at least one number';
    if (!/[!@#$%^&*]/.test(v)) return 'Include at least one special character (!@#$%^&*)';
    return '';
  },
  confirm: (v, pw) => (!v ? 'Confirm your password' : v !== pw ? 'Passwords do not match' : ''),
};

export const passwordStrength = (pw) => {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[!@#$%^&*]/.test(pw)) score++;
  if (score <= 1) return { label: 'Weak', color: '#c73030', pct: 20 };
  if (score <= 2) return { label: 'Fair', color: '#b45309', pct: 40 };
  if (score <= 3) return { label: 'Good', color: '#eab308', pct: 60 };
  if (score <= 4) return { label: 'Strong', color: '#1e7f4f', pct: 80 };
  return { label: 'Excellent', color: '#1e7f4f', pct: 100 };
};

/** A referral code is worth one coupon off this year's price. Any code of the
 *  right shape is honoured in the prototype; the real check belongs server-side. */
export const referralDiscount = (code) => (String(code || '').trim().length >= 6 ? REFERRAL_COUPON : 0);

/* --- hand-off between /subscribe and /onboarding -------------------------
   Payment and onboarding are two screens on purpose — you pay, then you fill
   in the long form — so what was paid for has to survive the navigation. It
   sits in sessionStorage rather than router state so a refresh on the
   onboarding page doesn't strand somebody who has already been charged. */
const KEY = 'ferrobid.pendingSubscription';

export const savePendingSubscription = (data) => {
  try { sessionStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode — the flow still works in-session */ }
};

export const readPendingSubscription = () => {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export const clearPendingSubscription = () => {
  try { sessionStorage.removeItem(KEY); } catch { /* nothing to clean up */ }
};

/** Human-readable order number for the receipt line, derived from the paid-at
 *  timestamp so the same order always reads the same. */
export const orderRef = (paidAt) => `FB-${String(paidAt).slice(-8, -3)}-KA`;
