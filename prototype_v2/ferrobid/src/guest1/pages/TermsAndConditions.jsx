import React, { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const TermsAndConditions = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="container" style={{ padding: '40px 32px', maxWidth: '800px', margin: '0 auto' }}>
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 600, marginBottom: '32px', textDecoration: 'none' }}>
        <ArrowLeft size={16} /> Back to Home
      </Link>
      <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '24px', color: 'var(--dark)' }}>Terms & Conditions</h1>
      
      <div style={{ lineHeight: '1.7', color: '#6b6560', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <p>These Terms & Conditions govern your use of the FerroBid platform and related services provided by FerroBid LLC ("FerroBid", "we", "us"). By creating an account or using our services you agree to these terms.</p>

        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--dark)', marginBottom: '8px' }}>Services</h2>
          <p>FerroBid provides software that powers online auction platforms operated by our customers. Specific features, fees, and policies for any individual auction site are governed by that site's own terms of service.</p>
        </div>

        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--dark)', marginBottom: '8px' }}>Account Responsibilities</h2>
          <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. Notify us immediately of any unauthorized use.</p>
        </div>

        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--dark)', marginBottom: '8px' }}>SMS / Text Message Program</h2>
          <p><strong>Program name:</strong> FerroBid Transactional SMS Notifications.</p>
          <p style={{ marginTop: '12px' }}><strong>Description:</strong> Transactional text messages related to your FerroBid account and auction activity, including bid alerts (outbid, new high bid, reserve met), auction lifecycle events (auctions starting, ending soon, sold), winning bid confirmations, payment and invoice notifications, and one-time verification codes used for account login and security.</p>
          <p style={{ marginTop: '12px' }}><strong>How to opt in:</strong> By providing your mobile number during registration or in your account settings and explicitly consenting to receive SMS messages, you opt in to receive transactional messages from FerroBid. We do not send marketing messages via SMS.</p>
          <p style={{ marginTop: '12px' }}><strong>Message frequency:</strong> Variable. Frequency depends on your activity on the platform — for example, the number of auctions you participate in, watch, or list. Some users may receive several messages per day during active auctions; others may receive few or none.</p>
          <p style={{ marginTop: '12px' }}><strong>Message and data rates:</strong> Message and data rates may apply. FerroBid does not charge for SMS messages, but your wireless carrier may. Check with your carrier for details.</p>
          <p style={{ marginTop: '12px' }}><strong>How to opt out:</strong> Reply STOP to any message to unsubscribe from all transactional SMS. You may also remove your phone number from your account or disable SMS notifications in your account settings. After opting out, you will no longer receive SMS messages from FerroBid. You may continue to receive notifications by email if you have not opted out of email.</p>
          <p style={{ marginTop: '12px' }}><strong>Help:</strong> Reply HELP to any message for assistance, or contact us at support@ferrobid.com.</p>
          <p style={{ marginTop: '12px' }}><strong>Carrier disclaimer:</strong> Wireless carriers (including but not limited to T-Mobile, AT&T, Verizon) are not liable for delayed or undelivered messages. Service availability depends on your wireless provider and signal coverage.</p>
          <p style={{ marginTop: '12px' }}><strong>Privacy:</strong> Mobile information collected as part of this program is handled in accordance with our Privacy Policy. Mobile information will not be shared with third parties or affiliates for marketing or promotional purposes. Information shared with subprocessors solely to deliver the SMS messages you have consented to receive is not subject to this restriction.</p>
        </div>

        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--dark)', marginBottom: '8px' }}>Acceptable Use</h2>
          <p>You agree not to use FerroBid in any way that violates applicable laws, infringes the rights of others, or interferes with the operation of the platform or other users' use of it.</p>
        </div>

        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--dark)', marginBottom: '8px' }}>Disclaimers</h2>
          <p>The platform is provided on an "as is" and "as available" basis. To the fullest extent permitted by law, FerroBid disclaims all warranties, express or implied, including warranties of merchantability, fitness for a particular purpose, and non-infringement.</p>
        </div>

        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--dark)', marginBottom: '8px' }}>Limitation of Liability</h2>
          <p>To the fullest extent permitted by law, FerroBid shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or relating to your use of the platform.</p>
        </div>

        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--dark)', marginBottom: '8px' }}>Changes to These Terms</h2>
          <p>We may update these terms from time to time. The current version will always be posted on this page along with the effective date. Continued use of the platform after changes are posted constitutes acceptance of the revised terms.</p>
          <p style={{ marginTop: '12px' }}><strong>Last updated:</strong> July 14, 2026</p>
        </div>

        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--dark)', marginBottom: '8px' }}>Contact Us</h2>
          <p>Questions about these terms or the SMS program? Contact us.</p>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;
