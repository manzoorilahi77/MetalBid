import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, EyeOff, Mail, Lock, User, Phone, Building2,
  ArrowLeft, ShieldCheck, CheckCircle, AlertCircle,
  Loader2, ArrowRight, Globe, Gavel, TrendingUp,
  Award, Users, Zap
} from 'lucide-react';
import { useStore, ROLE_HOME } from '../../store/store';

/* ─── helpers ─── */
const validate = {
  email: (v) => {
    if (!v) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email address';
    return '';
  },
  password: (v) => {
    if (!v) return 'Password is required';
    if (v.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(v)) return 'Include at least one uppercase letter';
    if (!/[0-9]/.test(v)) return 'Include at least one number';
    if (!/[!@#$%^&*]/.test(v)) return 'Include at least one special character (!@#$%^&*)';
    return '';
  },
  name: (v) => {
    if (!v) return 'Full name is required';
    if (v.trim().split(' ').length < 2) return 'Enter your full name (first & last)';
    return '';
  },
  phone: (v) => {
    if (!v) return 'Phone number is required';
    if (!/^[6-9]\d{9}$/.test(v.replace(/\s/g, ''))) return 'Enter a valid 10-digit Indian mobile number';
    return '';
  },
  company: (v) => {
    if (!v) return 'Company / Organisation name is required';
    return '';
  },
  confirmPassword: (v, pw) => {
    if (!v) return 'Please confirm your password';
    if (v !== pw) return 'Passwords do not match';
    return '';
  },
};

const passwordStrength = (pw) => {
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

/* ─── floating input ─── */
const FloatingInput = ({
  id, label, type = 'text', icon: Icon, value, onChange, error, touched,
  onBlur, autoComplete, maxLength, inputMode
}) => {
  const [showPw, setShowPw] = useState(false);
  const isPw = type === 'password';
  const actualType = isPw ? (showPw ? 'text' : 'password') : type;

  return (
    <div className={`auth-field ${touched && error ? 'auth-field--error' : ''} ${touched && !error && value ? 'auth-field--valid' : ''}`}>
      <div className="auth-field-icon"><Icon size={16} /></div>
      <div className="auth-field-input-wrap">
        <input
          id={id}
          type={actualType}
          className={`auth-field-input ${value ? 'has-value' : ''}`}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          autoComplete={autoComplete}
          maxLength={maxLength}
          inputMode={inputMode}
          required
        />
        <label htmlFor={id} className="auth-field-label">{label}</label>
      </div>
      {isPw && (
        <button type="button" className="auth-pw-toggle" onClick={() => setShowPw(!showPw)} tabIndex={-1} aria-label="Toggle password visibility">
          {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      )}
      {touched && !error && value && (
        <div className="auth-field-check"><CheckCircle size={14} /></div>
      )}
      <AnimatePresence>
        {touched && error && (
          <motion.div
            className="auth-field-error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            <AlertCircle size={10} /> {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─── password strength bar ─── */
const PasswordStrengthBar = ({ password }) => {
  if (!password) return null;
  const s = passwordStrength(password);
  return (
    <div className="auth-pw-strength">
      <div className="auth-pw-strength-track">
        <motion.div
          className="auth-pw-strength-fill"
          animate={{ width: `${s.pct}%`, backgroundColor: s.color }}
          transition={{ duration: 0.4 }}
        />
      </div>
      <span style={{ color: s.color, fontSize: '11px', fontWeight: 600 }}>{s.label}</span>
    </div>
  );
};

/* ─── main component ─── */
export const Auth = () => {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'register' ? 'register' : 'login';
  const signIn = useStore((s) => s.signIn);

  const [tab, setTab] = useState(initialTab);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  /* login form */
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginTouched, setLoginTouched] = useState({ email: false, password: false });
  const [loginErrors, setLoginErrors] = useState({ email: '', password: '' });

  /* register form */
  const [regForm, setRegForm] = useState({ name: '', email: '', phone: '', company: '', password: '', confirmPassword: '' });
  const [regTouched, setRegTouched] = useState({ name: false, email: false, phone: false, company: false, password: false, confirmPassword: false });
  const [regErrors, setRegErrors] = useState({ name: '', email: '', phone: '', company: '', password: '', confirmPassword: '' });
  const [acceptTerms, setAcceptTerms] = useState(false);

  /* forgot password */
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotTouched, setForgotTouched] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  /* OTP Verification */
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpTimer, setOtpTimer] = useState(30);
  const otpRefs = useRef([]);

  useEffect(() => {
    if (otpStep && otpTimer > 0) {
      const t = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [otpStep, otpTimer]);

  /* handlers */
  const handleLoginChange = (field) => (e) => {
    const val = e.target.value;
    setLoginForm((p) => ({ ...p, [field]: val }));
    if (loginTouched[field]) setLoginErrors((p) => ({ ...p, [field]: validate[field](val) }));
  };
  const handleLoginBlur = (field) => () => {
    setLoginTouched((p) => ({ ...p, [field]: true }));
    setLoginErrors((p) => ({ ...p, [field]: validate[field](loginForm[field]) }));
  };

  const handleRegChange = (field) => (e) => {
    const val = e.target.value;
    setRegForm((p) => ({ ...p, [field]: val }));
    if (regTouched[field]) {
      if (field === 'confirmPassword') {
        setRegErrors((p) => ({ ...p, [field]: validate.confirmPassword(val, regForm.password) }));
      } else {
        setRegErrors((p) => ({ ...p, [field]: validate[field](val) }));
      }
    }
  };
  const handleRegBlur = (field) => () => {
    setRegTouched((p) => ({ ...p, [field]: true }));
    if (field === 'confirmPassword') {
      setRegErrors((p) => ({ ...p, [field]: validate.confirmPassword(regForm[field], regForm.password) }));
    } else {
      setRegErrors((p) => ({ ...p, [field]: validate[field](regForm[field]) }));
    }
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    const errors = { email: validate.email(loginForm.email), password: validate.password(loginForm.password) };
    setLoginErrors(errors);
    setLoginTouched({ email: true, password: true });
    if (errors.email || errors.password) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // Authenticate against the demo role logins and open that role's portal.
      const res = signIn(loginForm.email, loginForm.password);
      if (!res.ok || !res.role) {
        if (res.error === 'Incorrect password') {
          setLoginErrors((p) => ({ ...p, password: 'Incorrect password' }));
          setLoginTouched((p) => ({ ...p, password: true }));
        } else {
          setLoginErrors((p) => ({ ...p, email: 'No account found for this email' }));
          setLoginTouched((p) => ({ ...p, email: true }));
        }
        return;
      }
      setSuccess('Login successful! Redirecting to your portal...');
      // Leave the /guest1 router and open the manager portal for this role.
      setTimeout(() => { window.location.hash = ROLE_HOME[res.role]; }, 600);
    }, 1200);
  };

  const handleRegSubmit = (e) => {
    e.preventDefault();
    const errors = {
      name: validate.name(regForm.name),
      email: validate.email(regForm.email),
      phone: validate.phone(regForm.phone),
      company: validate.company(regForm.company),
      password: validate.password(regForm.password),
      confirmPassword: validate.confirmPassword(regForm.confirmPassword, regForm.password),
    };
    setRegErrors(errors);
    setRegTouched({ name: true, email: true, phone: true, company: true, password: true, confirmPassword: true });
    if (Object.values(errors).some(Boolean) || !acceptTerms) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setOtpStep(true);
      setOtpTimer(30);
    }, 1800);
  };

  const handleForgotSubmit = (e) => {
    e.preventDefault();
    setForgotTouched(true);
    const err = validate.email(forgotEmail);
    setForgotError(err);
    if (err) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setForgotSent(true);
    }, 1500);
  };

  const handleOtpChange = (idx, val) => {
    if (val.length > 1) val = val.slice(-1);
    if (val && !/\d/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
  };
  const handleOtpKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) otpRefs.current[idx - 1]?.focus();
  };
  const handleOtpSubmit = (e) => {
    e.preventDefault();
    if (otp.join('').length < 6) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setOtpStep(false);
      setSuccess('Account verified! Redirecting to dashboard...');
      setTimeout(() => setSuccess(''), 4000);
    }, 1500);
  };

  const resendOtp = () => {
    setOtpTimer(30);
    setOtp(['', '', '', '', '', '']);
  };

  /* animated stats */
  const stats = [
    { icon: <Globe size={16} />, val: '25+', label: 'States Covered' },
    { icon: <Gavel size={16} />, val: '2,400+', label: 'Lots Auctioned' },
    { icon: <TrendingUp size={16} />, val: '₹500 Cr+', label: 'Total Traded' },
    { icon: <Users size={16} />, val: '10,000+', label: 'Verified Users' },
  ];

  const benefits = [
    { icon: <ShieldCheck size={15} />, text: '100% KYC Verified Marketplace' },
    { icon: <Zap size={15} />, text: 'Real-time Live Bidding Engine' },
    { icon: <Award size={15} />, text: 'Escrow-protected Payments' },
    { icon: <Globe size={15} />, text: 'Pan-India Logistics Network' },
  ];

  return (
    <div className="auth-page">
      {/* Left Visual Panel */}
      <div className="auth-left">
        <div className="auth-left-bg">
          <div className="auth-left-gradient"></div>
          <div className="auth-left-pattern"></div>
        </div>

        <div className="auth-left-content">
          <Link to="/" className="auth-home-link">
            <ArrowLeft size={14} />
            <span>Back to Home</span>
          </Link>

          <div className="auth-left-hero">
            <div className="auth-left-badge">
              <div className="auth-badge-dot"></div>
              India's #1 Metal Auction Platform
            </div>
            <h1 className="auth-left-title">
              Trade Metals with<br />
              <span>Confidence & Trust</span>
            </h1>
            <p className="auth-left-desc">
              Join thousands of verified buyers and sellers on India's most transparent digital auction marketplace for scrap & metals.
            </p>
          </div>

          <div className="auth-stats-grid">
            {stats.map((s, i) => (
              <motion.div
                key={i}
                className="auth-stat-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
              >
                <div className="auth-stat-icon">{s.icon}</div>
                <div className="auth-stat-val">{s.val}</div>
                <div className="auth-stat-label">{s.label}</div>
              </motion.div>
            ))}
          </div>

          <div className="auth-benefits">
            {benefits.map((b, i) => (
              <motion.div
                key={i}
                className="auth-benefit"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.1 }}
              >
                <div className="auth-benefit-icon">{b.icon}</div>
                <span>{b.text}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="auth-right">
        <div className="auth-right-inner">
          {/* Logo */}
          <Link to="/" className="auth-logo-link">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="FerroBid Logo" className="auth-logo-img" />
          </Link>

          {/* Success Message */}
          <AnimatePresence>
            {success && (
              <motion.div
                className="auth-success-banner"
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
              >
                <CheckCircle size={20} />
                <span>{success}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* OTP Verification */}
          {otpStep ? (
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              className="auth-otp-section"
            >
              <div className="auth-otp-icon-wrap">
                <Mail size={24} />
              </div>
              <h2 className="auth-form-title">Verify Your Email</h2>
              <p className="auth-form-subtitle">
                We've sent a 6-digit OTP to <strong>{regForm.email}</strong>
              </p>
              <form onSubmit={handleOtpSubmit}>
                <div className="auth-otp-inputs">
                  {otp.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => (otpRefs.current[i] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      className={`auth-otp-box ${d ? 'filled' : ''}`}
                      value={d}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      autoFocus={i === 0}
                    />
                  ))}
                </div>
                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={loading || otp.join('').length < 6}
                >
                  {loading ? <Loader2 size={18} className="auth-spin" /> : 'Verify & Create Account'}
                </button>
              </form>
              <div className="auth-otp-footer">
                {otpTimer > 0 ? (
                  <span className="auth-otp-timer">Resend OTP in <strong>{otpTimer}s</strong></span>
                ) : (
                  <button className="auth-link-btn" onClick={resendOtp}>Resend OTP</button>
                )}
              </div>
              <button className="auth-link-btn" style={{ marginTop: '12px' }} onClick={() => { setOtpStep(false); setOtp(['', '', '', '', '', '']); }}>
                <ArrowLeft size={14} /> Back to Registration
              </button>
            </motion.div>
          ) : forgotOpen ? (
            /* Forgot Password */
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              className="auth-forgot-section"
            >
              <div className="auth-otp-icon-wrap">
                <Lock size={24} />
              </div>
              <h2 className="auth-form-title">Reset Password</h2>
              <p className="auth-form-subtitle">
                {forgotSent
                  ? 'Check your inbox for a password reset link.'
                  : 'Enter your registered email and we\'ll send you a reset link.'}
              </p>
              {forgotSent ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="auth-forgot-done"
                >
                  <div className="auth-forgot-done-icon">
                    <CheckCircle size={48} />
                  </div>
                  <p>A password reset link has been sent to <strong>{forgotEmail}</strong></p>
                  <p className="auth-forgot-hint">Didn't receive it? Check your spam folder or try again.</p>
                  <button
                    className="auth-submit-btn"
                    onClick={() => { setForgotOpen(false); setForgotSent(false); setForgotEmail(''); setForgotTouched(false); }}
                  >
                    Back to Login
                  </button>
                </motion.div>
              ) : (
                <form onSubmit={handleForgotSubmit}>
                  <FloatingInput
                    id="forgot-email"
                    label="Registered Email Address"
                    type="email"
                    icon={Mail}
                    value={forgotEmail}
                    onChange={(e) => { setForgotEmail(e.target.value); if (forgotTouched) setForgotError(validate.email(e.target.value)); }}
                    error={forgotError}
                    touched={forgotTouched}
                    onBlur={() => { setForgotTouched(true); setForgotError(validate.email(forgotEmail)); }}
                    autoComplete="email"
                  />
                  <button type="submit" className="auth-submit-btn" disabled={loading}>
                    {loading ? <Loader2 size={18} className="auth-spin" /> : <>Send Reset Link <ArrowRight size={16} /></>}
                  </button>
                </form>
              )}
              <button className="auth-link-btn" style={{ marginTop: '16px' }} onClick={() => { setForgotOpen(false); setForgotSent(false); setForgotEmail(''); setForgotTouched(false); }}>
                <ArrowLeft size={14} /> Back to Login
              </button>
            </motion.div>
          ) : (
            /* Main Login / Register */
            <>
              {/* Tab Switcher */}
              <div className="auth-tab-bar">
                <button
                  className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
                  onClick={() => setTab('login')}
                  id="auth-tab-login"
                >
                  Sign In
                </button>
                <button
                  className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
                  onClick={() => setTab('register')}
                  id="auth-tab-register"
                >
                  Create Account
                </button>
                <div className={`auth-tab-indicator ${tab === 'register' ? 'right' : ''}`} />
              </div>

              <AnimatePresence mode="wait">
                {tab === 'login' ? (
                  <motion.div
                    key="login"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <h2 className="auth-form-title">Welcome Back</h2>
                    <p className="auth-form-subtitle">Sign in to access your auctions, bids & dashboard</p>

                    <form onSubmit={handleLoginSubmit} noValidate>
                      <FloatingInput
                        id="login-email"
                        label="Email Address"
                        type="email"
                        icon={Mail}
                        value={loginForm.email}
                        onChange={handleLoginChange('email')}
                        error={loginErrors.email}
                        touched={loginTouched.email}
                        onBlur={handleLoginBlur('email')}
                        autoComplete="email"
                      />
                      <FloatingInput
                        id="login-password"
                        label="Password"
                        type="password"
                        icon={Lock}
                        value={loginForm.password}
                        onChange={handleLoginChange('password')}
                        error={loginErrors.password}
                        touched={loginTouched.password}
                        onBlur={handleLoginBlur('password')}
                        autoComplete="current-password"
                      />
                      <div className="auth-form-options">
                        <label className="auth-checkbox-label" htmlFor="remember-me">
                          <input type="checkbox" id="remember-me" className="auth-checkbox" />
                          <span className="auth-checkbox-custom"></span>
                          Remember me
                        </label>
                        <button type="button" className="auth-link-btn" onClick={() => setForgotOpen(true)}>
                          Forgot Password?
                        </button>
                      </div>
                      <button type="submit" className="auth-submit-btn" disabled={loading} id="auth-login-submit">
                        {loading ? <Loader2 size={18} className="auth-spin" /> : <>Sign In <ArrowRight size={16} /></>}
                      </button>
                    </form>

                    <div className="auth-divider">
                      <span>or continue with</span>
                    </div>

                    <div className="auth-social-row">
                      <button className="auth-social-btn" type="button">
                        <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#fbc02d" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#e53935" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4caf50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1565c0" d="M43.611 20.083L43.595 20H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
                        Google
                      </button>
                      <button className="auth-social-btn" type="button">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877f2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                        Facebook
                      </button>
                    </div>

                    <p className="auth-switch-text">
                      Don't have an account? <button className="auth-link-btn" onClick={() => setTab('register')}>Create one now</button>
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="register"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <h2 className="auth-form-title">Create Your Account</h2>
                    <p className="auth-form-subtitle">Join 10,000+ verified metal traders across India</p>

                    <form onSubmit={handleRegSubmit} noValidate>
                      <div className="auth-form-row">
                        <FloatingInput
                          id="reg-name"
                          label="Full Name"
                          icon={User}
                          value={regForm.name}
                          onChange={handleRegChange('name')}
                          error={regErrors.name}
                          touched={regTouched.name}
                          onBlur={handleRegBlur('name')}
                          autoComplete="name"
                        />
                        <FloatingInput
                          id="reg-phone"
                          label="Mobile Number"
                          type="tel"
                          icon={Phone}
                          value={regForm.phone}
                          onChange={handleRegChange('phone')}
                          error={regErrors.phone}
                          touched={regTouched.phone}
                          onBlur={handleRegBlur('phone')}
                          autoComplete="tel"
                          maxLength={10}
                          inputMode="numeric"
                        />
                      </div>
                      <FloatingInput
                        id="reg-email"
                        label="Email Address"
                        type="email"
                        icon={Mail}
                        value={regForm.email}
                        onChange={handleRegChange('email')}
                        error={regErrors.email}
                        touched={regTouched.email}
                        onBlur={handleRegBlur('email')}
                        autoComplete="email"
                      />
                      <FloatingInput
                        id="reg-company"
                        label="Company / Organisation"
                        icon={Building2}
                        value={regForm.company}
                        onChange={handleRegChange('company')}
                        error={regErrors.company}
                        touched={regTouched.company}
                        onBlur={handleRegBlur('company')}
                        autoComplete="organization"
                      />
                      <div className="auth-form-row">
                        <div style={{ flex: 1 }}>
                          <FloatingInput
                            id="reg-password"
                            label="Password"
                            type="password"
                            icon={Lock}
                            value={regForm.password}
                            onChange={handleRegChange('password')}
                            error={regErrors.password}
                            touched={regTouched.password}
                            onBlur={handleRegBlur('password')}
                            autoComplete="new-password"
                          />
                          <PasswordStrengthBar password={regForm.password} />
                        </div>
                        <FloatingInput
                          id="reg-confirm-password"
                          label="Confirm Password"
                          type="password"
                          icon={Lock}
                          value={regForm.confirmPassword}
                          onChange={handleRegChange('confirmPassword')}
                          error={regErrors.confirmPassword}
                          touched={regTouched.confirmPassword}
                          onBlur={handleRegBlur('confirmPassword')}
                          autoComplete="new-password"
                        />
                      </div>

                      <label className="auth-checkbox-label auth-terms-label" htmlFor="accept-terms">
                        <input
                          type="checkbox"
                          id="accept-terms"
                          className="auth-checkbox"
                          checked={acceptTerms}
                          onChange={(e) => setAcceptTerms(e.target.checked)}
                        />
                        <span className="auth-checkbox-custom"></span>
                        I agree to the <Link to="/terms" className="auth-inline-link">Terms & Conditions</Link> and <Link to="/privacy" className="auth-inline-link">Privacy Policy</Link>
                      </label>

                      <button type="submit" className="auth-submit-btn" disabled={loading || !acceptTerms} id="auth-register-submit">
                        {loading ? <Loader2 size={18} className="auth-spin" /> : <>Create Account <ArrowRight size={16} /></>}
                      </button>
                    </form>

                    <div className="auth-divider">
                      <span>or sign up with</span>
                    </div>

                    <div className="auth-social-row">
                      <button className="auth-social-btn" type="button">
                        <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#fbc02d" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#e53935" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4caf50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1565c0" d="M43.611 20.083L43.595 20H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
                        Google
                      </button>
                      <button className="auth-social-btn" type="button">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877f2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                        Facebook
                      </button>
                    </div>

                    <p className="auth-switch-text">
                      Already have an account? <button className="auth-link-btn" onClick={() => setTab('login')}>Sign in</button>
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {/* Security Footer */}
          <div className="auth-security-footer">
            <ShieldCheck size={14} />
            <span>256-bit SSL Encrypted · CERT-In Compliant · ISO 27001 Certified</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
