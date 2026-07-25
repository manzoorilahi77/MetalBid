import React, { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const PrivacyPolicy = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="container" style={{ padding: '40px 32px', maxWidth: '800px', margin: '0 auto' }}>
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 600, marginBottom: '32px', textDecoration: 'none' }}>
        <ArrowLeft size={16} /> Back to Home
      </Link>
      <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '24px', color: 'var(--dark)' }}>Privacy Policy</h1>
      
      <div style={{ lineHeight: '1.7', color: '#6b6560', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <p>Your privacy is important to us. This privacy policy explains how we collect, use, and protect your personal information.</p>

        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--dark)', marginBottom: '8px' }}>Information We Collect</h2>
          <p>We collect information that you provide directly to us, such as when you create an account, subscribe to our newsletter, or contact us. This information may include your name, email address, and any other details you provide.</p>
        </div>

        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--dark)', marginBottom: '8px' }}>How We Use Your Information</h2>
          <p>We use the information we collect to provide, maintain, and improve our services, to communicate with you, and to protect our users.</p>
        </div>

        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--dark)', marginBottom: '8px' }}>SMS / Text Message Communications</h2>
          <p>If you provide a mobile phone number and consent to receive SMS messages, we use that number solely to send transactional notifications related to your account and activity on the FerroBid platform — including bid alerts, auction lifecycle updates, winning bid confirmations, payment notifications, and one-time verification codes for login and security purposes. We do not use your mobile number for marketing.</p>
          <p style={{ marginTop: '12px' }}>Mobile information will not be shared with third parties or affiliates for marketing or promotional purposes. Information shared with subprocessors solely to deliver the SMS messages you have consented to receive is not subject to this restriction.</p>
          <p style={{ marginTop: '12px' }}>For SMS program details — including message frequency, opt-out instructions, and carrier disclaimers — see our Terms & Conditions.</p>
        </div>

        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--dark)', marginBottom: '8px' }}>Sharing Your Information</h2>
          <p>We do not share your personal information with third parties except as necessary to provide our services or comply with the law.</p>
        </div>

        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--dark)', marginBottom: '8px' }}>Security</h2>
          <p>We take reasonable measures to protect your personal information from unauthorized access, use, or disclosure.</p>
        </div>

        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--dark)', marginBottom: '8px' }}>Your Choices</h2>
          <p>You may update or delete your account information at any time by contacting us. You may also opt out of receiving promotional communications from us.</p>
        </div>

        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--dark)', marginBottom: '8px' }}>Changes to This Policy</h2>
          <p>We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on our website.</p>
        </div>

        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--dark)', marginBottom: '8px' }}>Contact Us</h2>
          <p>If you have any questions about this privacy policy, please contact us.</p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
