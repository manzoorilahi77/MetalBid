/* ---------------------------------------------------------------------------
   Terms & Conditions

   Every sentence from the previous version is preserved verbatim below — the
   Services, Account Responsibilities, Acceptable Use, Disclaimers, Limitation
   of Liability, Changes and the entire SMS / Text Message Program block. The
   SMS block in particular is written for messaging-carrier programme review,
   so it is quoted word for word rather than paraphrased.

   What is new is the operational half a bidder actually needs before they
   commit money: how a bid becomes binding, what EMD is at risk, when payment
   falls due, who lifts the material, and what the fees are. Those were absent
   entirely, which meant the page could not answer a single practical question.
--------------------------------------------------------------------------- */
import React from 'react';
import {
  ScrollText, UserCheck, Gavel, Wallet, Truck, Receipt,
  MessageSquare, Ban, ShieldAlert, Scale, Mail
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { LegalDoc } from '../components/LegalDoc';

const SECTIONS = [
  {
    id: 'agreement',
    title: 'The agreement and key terms',
    icon: ScrollText,
    plain: 'By using FerroBid you accept these terms. This section defines the words the rest of the document leans on — lot, EMD, reserve, auto-extension, lifting.',
    blocks: [
      { type: 'p', text: <>These Terms &amp; Conditions govern your use of the FerroBid platform and related services provided by FerroBid LLC (“FerroBid”, “we”, “us”). By creating an account or using our services you agree to these terms.</> },
      { type: 'p', text: <>FerroBid provides software that powers online auction platforms operated by our customers. Specific features, fees, and policies for any individual auction site are governed by that site's own terms of service.</> },
      { type: 'p', text: <>Where an auction is operated on FerroBid, the definitions below apply throughout these terms and in every sale confirmation letter we issue.</> },
      {
        type: 'kv',
        items: [
          { k: 'Lot', v: 'A defined quantity of material offered as a single unit at auction, with its own inspection report and lot number.' },
          { k: 'EMD', v: 'Earnest Money Deposit — a refundable deposit that unlocks bidding on a lot and evidences intent to bid.' },
          { k: 'Reserve price', v: 'The minimum price at which the seller is willing to sell. A lot that closes below reserve does not create a binding sale.' },
          { k: 'Forward auction', v: 'Price ascends; the highest valid bid at close wins.' },
          { k: 'Reverse auction', v: 'Price descends; the lowest valid bid at close wins. Used where FerroBid’s customer is procuring rather than disposing.' },
          { k: 'Auto-extension', v: 'A late bid pushes the closing time out by a set interval, so a lot closes on price rather than on reflexes.' },
          { k: 'Lifting', v: 'Physical collection of won material from the seller’s yard, within the window stated in the sale confirmation letter.' },
          { k: 'Sale confirmation letter', v: 'The document issued to a winning bidder recording the lot, price, taxes, payment due date and lifting window.' }
        ]
      }
    ]
  },

  {
    id: 'eligibility',
    title: 'Eligibility, accounts and verification',
    icon: UserCheck,
    plain: 'Accounts are for registered businesses, not individuals. You must clear KYC before you can bid, and you are responsible for everything done under your login.',
    blocks: [
      { type: 'p', text: <>You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. Notify us immediately of any unauthorized use.</> },
      {
        type: 'list',
        items: [
          <><strong>Business accounts only.</strong> Registration is open to entities with a valid GST registration and PAN, acting through an authorised signatory aged 18 or over.</>,
          <><strong>Verification before bidding.</strong> You must complete enterprise KYC — GST registration, PAN, certificate of incorporation and authorised-signatory identity proof — before placing any bid. Most submissions are verified within 24–48 business hours.</>,
          <><strong>Accuracy.</strong> You warrant that the information and documents you submit are true, current and yours to submit, and you will update them when they change.</>,
          <><strong>One account per entity.</strong> Operating multiple accounts for the same entity, or bidding through an undisclosed related party, is a breach of these terms.</>,
          <><strong>Suspension pending checks.</strong> We may suspend access while verifying a document, investigating suspicious activity, or where a regulator requires it.</>
        ]
      },
      {
        type: 'callout',
        tone: 'warn',
        title: 'Your login is your signature',
        text: 'A bid placed from your account is treated as placed by you. Share credentials at your own risk — bids are binding regardless of who typed them.'
      }
    ]
  },

  {
    id: 'auctions',
    title: 'How auctions run and when a bid becomes binding',
    icon: Gavel,
    plain: 'A bid is an irrevocable offer. You cannot retract it. If you are the winning bidder above reserve, you have bought the lot.',
    blocks: [
      {
        type: 'steps',
        items: [
          <>A lot is published only after physical inspection and internal approval. The inspection report, photographs and GPS-tagged location form part of the listing.</>,
          <>You pay the stated EMD for that lot. EMD unlocks bidding; it does not reserve the lot or confer priority.</>,
          <>Bidding runs live for the published window. In a forward auction the highest valid bid leads; in a reverse auction the lowest does.</>,
          <>A bid placed inside the auto-extension window pushes the closing time out. Extension repeats for as long as bids keep arriving.</>,
          <>At close, the leading bid at or above reserve wins. We issue a sale confirmation letter recording price, taxes, payment due date and lifting window.</>
        ]
      },
      {
        type: 'list',
        items: [
          <><strong>Bids are irrevocable.</strong> Once placed, a bid cannot be withdrawn, reduced or cancelled by you.</>,
          <><strong>Reserve is confidential.</strong> Whether reserve has been met may be indicated, but the reserve figure itself is not disclosed.</>,
          <><strong>Below reserve.</strong> A lot that closes below reserve creates no binding sale. The seller may accept, decline, or relist.</>,
          <><strong>Quantities are estimates.</strong> Weights and quantities shown are inspection estimates unless the listing states otherwise. Final settlement is on delivered weighbridge weight where the listing says so.</>,
          <><strong>Condition.</strong> Material is sold on an “as is, where is” basis on the strength of the published inspection report. You are responsible for satisfying yourself before bidding.</>,
          <><strong>Technical faults.</strong> If a fault materially affects an auction, we may extend, pause, void or re-run it. Where an auction is voided, EMD is returned in full.</>
        ]
      },
      {
        type: 'callout',
        tone: 'info',
        title: 'Discrepancies',
        text: <>If the material genuinely does not match the inspection report, raise it through <Link to="/grievance">Grievance Redressal</Link> within the window stated in your sale confirmation letter. Do not lift material you intend to dispute.</>
      }
    ]
  },

  {
    id: 'payment',
    title: 'EMD, payment and settlement',
    icon: Wallet,
    plain: 'EMD comes back if you lose and is adjusted against the price if you win. Miss the payment deadline and you can lose the EMD and the lot.',
    blocks: [
      {
        type: 'table',
        head: ['Stage', 'What happens', 'Timing'],
        rows: [
          ['EMD paid', 'Deposit is held against the lot and bidding is unlocked', 'Before the auction opens'],
          ['You are outbid or the lot closes', 'EMD is released for refund automatically', 'Refund initiated after close'],
          ['You win', 'EMD is adjusted against the total payable', 'On issue of the sale confirmation letter'],
          ['Balance payment', 'Balance due per your sale confirmation letter', 'Typically 24–72 hours after close'],
          ['Release for lifting', 'Delivery order issued once payment is reconciled', 'After funds are confirmed']
        ]
      },
      {
        type: 'list',
        items: [
          <><strong>Accepted methods.</strong> Bank transfer (NEFT/RTGS), UPI for smaller amounts, and escrow-backed settlement for high-value lots. Payment is made to FerroBid or the designated escrow account, never seller-to-buyer directly.</>,
          <><strong>Taxes.</strong> Prices are exclusive of GST and other applicable levies unless stated. Tax is charged at the rate applicable on the invoice date, and tax invoices are issued to the registered GSTIN on your account.</>,
          <><strong>Late payment.</strong> Interest may be charged on overdue amounts at the rate stated in your sale confirmation letter.</>,
          <><strong>Forfeiture.</strong> If you do not pay within the stated window, we may forfeit the EMD, cancel the sale, relist the lot, and recover any shortfall on resale together with costs.</>,
          <><strong>Refund timing.</strong> Refunds are returned to the originating account. Bank credit timelines are outside our control.</>,
          <><strong>Set-off.</strong> We may set off amounts you owe us on one transaction against refunds due on another.</>
        ]
      }
    ]
  },

  {
    id: 'obligations',
    title: 'Seller and buyer obligations',
    icon: Truck,
    plain: 'Sellers must own what they list and describe it honestly. Buyers must lift on time. Risk passes at lifting.',
    blocks: [
      { type: 'p', text: <><strong>If you are selling,</strong> you warrant that you hold clear title to the material, that it is free of encumbrances, that it is lawfully saleable, and that the description, quantity and grade you submit are accurate to the best of your knowledge. You must grant our site officers reasonable access for inspection, keep the lot available and unaltered once published, and hand over on production of a valid delivery order.</> },
      { type: 'p', text: <><strong>If you are buying,</strong> you must complete payment within the stated window, arrange lifting within the stated lifting window, and comply with the seller's site safety, gate and weighbridge procedures. You are responsible for your own transporters, labour and equipment unless you have engaged FerroBid-arranged logistics.</> },
      {
        type: 'list',
        items: [
          <><strong>Risk and title.</strong> Title passes on receipt of full payment. Risk passes on lifting. Material left beyond the lifting window is at your risk and may attract ground-rent or demurrage charges levied by the seller.</>,
          <><strong>Uncollected material.</strong> Material not lifted within the stated window, plus any extension we agree in writing, may be treated as abandoned and disposed of, with costs recoverable from you.</>,
          <><strong>Weighment.</strong> Where settlement is on delivered weight, the weighbridge nominated in the listing is the reference. Disputes must be raised at the gate, before the vehicle leaves.</>,
          <><strong>Statutory compliance.</strong> Both parties are responsible for their own e-way bills, transport documentation, pollution-control and hazardous-material obligations.</>
        ]
      }
    ]
  },

  {
    id: 'fees',
    title: 'Fees, commission and subscriptions',
    icon: Receipt,
    plain: 'Platform fees are published before you commit. Nothing is deducted that was not shown to you first.',
    blocks: [
      { type: 'p', text: <>Subscription plans, platform fees and add-ons are published on the <Link to="/pricing">Pricing</Link> page. Commission and any lot-specific charges are stated on the lot and repeated in your sale confirmation letter before payment falls due.</> },
      {
        type: 'list',
        items: [
          <><strong>No hidden deductions.</strong> We do not deduct a fee that was not disclosed on the lot or in the sale confirmation letter.</>,
          <><strong>Subscription terms.</strong> Subscriptions renew for the term selected unless cancelled before the renewal date. Fees already paid for a current term are non-refundable except where the law requires otherwise.</>,
          <><strong>Changes to fees.</strong> We may revise published fees on <strong>30 days'</strong> notice. Revised fees do not apply to lots already won or auctions already open.</>,
          <><strong>Taxes on fees.</strong> All fees are exclusive of applicable taxes.</>
        ]
      }
    ]
  },

  {
    id: 'sms',
    title: 'SMS / Text Message Program',
    icon: MessageSquare,
    plain: 'Transactional messages only — bid alerts, auction events, payment notices and login codes. Reply STOP to end them at any time.',
    blocks: [
      { type: 'p', text: <><strong>Program name:</strong> FerroBid Transactional SMS Notifications.</> },
      { type: 'p', text: <><strong>Description:</strong> Transactional text messages related to your FerroBid account and auction activity, including bid alerts (outbid, new high bid, reserve met), auction lifecycle events (auctions starting, ending soon, sold), winning bid confirmations, payment and invoice notifications, and one-time verification codes used for account login and security.</> },
      { type: 'p', text: <><strong>How to opt in:</strong> By providing your mobile number during registration or in your account settings and explicitly consenting to receive SMS messages, you opt in to receive transactional messages from FerroBid. We do not send marketing messages via SMS.</> },
      { type: 'p', text: <><strong>Message frequency:</strong> Variable. Frequency depends on your activity on the platform — for example, the number of auctions you participate in, watch, or list. Some users may receive several messages per day during active auctions; others may receive few or none.</> },
      { type: 'p', text: <><strong>Message and data rates:</strong> Message and data rates may apply. FerroBid does not charge for SMS messages, but your wireless carrier may. Check with your carrier for details.</> },
      { type: 'p', text: <><strong>How to opt out:</strong> Reply STOP to any message to unsubscribe from all transactional SMS. You may also remove your phone number from your account or disable SMS notifications in your account settings. After opting out, you will no longer receive SMS messages from FerroBid. You may continue to receive notifications by email if you have not opted out of email.</> },
      { type: 'p', text: <><strong>Help:</strong> Reply HELP to any message for assistance, or contact us at <a href="mailto:support@ferrobid.com">support@ferrobid.com</a>.</> },
      { type: 'p', text: <><strong>Carrier disclaimer:</strong> Wireless carriers (including but not limited to T-Mobile, AT&amp;T, Verizon) are not liable for delayed or undelivered messages. Service availability depends on your wireless provider and signal coverage.</> },
      { type: 'p', text: <><strong>Privacy:</strong> Mobile information collected as part of this program is handled in accordance with our <Link to="/privacy">Privacy Policy</Link>. Mobile information will not be shared with third parties or affiliates for marketing or promotional purposes. Information shared with subprocessors solely to deliver the SMS messages you have consented to receive is not subject to this restriction.</> },
      {
        type: 'callout',
        tone: 'warn',
        title: 'Opting out has consequences',
        text: 'Bid alerts and payment deadlines are time-critical. If you stop SMS, make sure email notifications remain on — missing a payment window can forfeit your EMD.'
      }
    ]
  },

  {
    id: 'acceptable-use',
    title: 'Acceptable use and prohibited conduct',
    icon: Ban,
    plain: 'Do not rig the bidding, scrape the site, or misuse other users’ information. Bid manipulation is the fastest way to lose your account and your EMD.',
    blocks: [
      { type: 'p', text: <>You agree not to use FerroBid in any way that violates applicable laws, infringes the rights of others, or interferes with the operation of the platform or other users' use of it.</> },
      { type: 'p', text: <>In particular, the following are prohibited:</> },
      {
        type: 'list',
        items: [
          <><strong>Collusion or bid-rigging</strong> — coordinating with other bidders to suppress price, or agreeing not to bid against one another.</>,
          <><strong>Shill bidding</strong> — bidding on your own lot, or arranging for a related party to do so, to inflate price.</>,
          <><strong>Misrepresentation</strong> — submitting false KYC documents, or listing material you do not own or cannot lawfully sell.</>,
          <><strong>Automated access</strong> — scraping, crawling, or using bots against the platform without written permission.</>,
          <><strong>Circumvention</strong> — taking a trade off-platform to avoid fees after meeting the counterparty through FerroBid.</>,
          <><strong>Misuse of information</strong> — using counterparty details disclosed for settlement for marketing or any unrelated purpose.</>,
          <><strong>Security testing</strong> — probing, scanning or attempting to breach the platform, other than through a disclosure we invite in writing.</>
        ]
      },
      {
        type: 'callout',
        tone: 'warn',
        title: 'What happens on breach',
        text: 'We may warn, suspend or terminate accounts, void affected auctions, forfeit EMD, withhold settlement pending investigation, report conduct to authorities, and recover losses. Where an auction is voided for manipulation, unaffected bidders are refunded in full.'
      }
    ]
  },

  {
    id: 'suspension',
    title: 'Suspension, termination and closing your account',
    icon: ShieldAlert,
    plain: 'You can close your account once your open obligations are settled. We can suspend one immediately if there is fraud or risk to others.',
    blocks: [
      {
        type: 'list',
        items: [
          <><strong>Your right to leave.</strong> You may close your account at any time once you have no open bids, unpaid lots or unlifted material. Write to support and we will confirm outstanding obligations first.</>,
          <><strong>Our right to suspend.</strong> We may suspend or restrict access immediately where we reasonably suspect fraud, bid manipulation, non-payment, invalid KYC, or a risk to other users or the platform.</>,
          <><strong>Notice.</strong> Other than in the cases above, we will give reasonable notice before terminating an account, with reasons.</>,
          <><strong>What survives.</strong> Termination does not affect accrued rights or obligations — including payment for lots already won, indemnities, and the limitation of liability below.</>,
          <><strong>Records.</strong> Closing an account does not delete records we are required to retain; see the retention schedule in the <Link to="/privacy">Privacy Policy</Link>.</>
        ]
      }
    ]
  },

  {
    id: 'liability',
    title: 'Disclaimers and limitation of liability',
    icon: Scale,
    plain: 'FerroBid runs the auction; it does not guarantee the material. Our financial liability is capped, and we are not liable for indirect losses.',
    blocks: [
      { type: 'p', text: <>The platform is provided on an "as is" and "as available" basis. To the fullest extent permitted by law, FerroBid disclaims all warranties, express or implied, including warranties of merchantability, fitness for a particular purpose, and non-infringement.</> },
      { type: 'p', text: <>To the fullest extent permitted by law, FerroBid shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or relating to your use of the platform.</> },
      {
        type: 'list',
        items: [
          <><strong>Marketplace role.</strong> FerroBid facilitates auctions and verification. The contract for the material itself is between buyer and seller.</>,
          <><strong>Inspection reports.</strong> Reports reflect the condition observed at the time of inspection. They are prepared with care but are not a warranty of grade, yield or fitness for your process.</>,
          <><strong>Excluded losses.</strong> We are not liable for loss of profit, loss of contract, business interruption, or the cost of substitute material.</>,
          <><strong>Force majeure.</strong> Neither party is liable for failure caused by events beyond reasonable control — including strikes, transport disruption, regulatory action, natural events, or failures of public infrastructure.</>,
          <><strong>Nothing excluded that cannot be.</strong> Nothing in these terms limits liability for fraud, or for any liability that cannot be excluded under applicable law.</>
        ]
      }
    ]
  },

  {
    id: 'disputes',
    title: 'Disputes and governing law',
    icon: Gavel,
    plain: 'Raise it with the grievance desk first — most issues end there. If it cannot be settled, Indian law and the courts at Bengaluru apply.',
    blocks: [
      {
        type: 'steps',
        items: [
          <>Raise the issue through <Link to="/grievance">Grievance Redressal</Link>, quoting the lot or transaction ID. You receive a ticket number and acknowledgement within 24 hours.</>,
          <>If the outcome does not resolve it, escalate through the levels published in the escalation matrix.</>,
          <>If escalation is exhausted, the parties will attempt good-faith resolution in writing for 30 days before commencing proceedings.</>,
          <>Failing that, the dispute is subject to the governing law and jurisdiction below.</>
        ]
      },
      { type: 'p', text: <>These terms are governed by the laws of India. Subject to the escalation process above, the courts at Bengaluru, Karnataka have exclusive jurisdiction. Nothing in this clause prevents either party from seeking urgent interim relief from any competent court.</> },
      {
        type: 'callout',
        tone: 'good',
        title: 'Most disputes never get this far',
        text: 'Material discrepancies, payment timing and refund questions are handled by the grievance desk within published SLAs. The clause above exists for the rare case that route cannot settle.'
      }
    ]
  },

  {
    id: 'changes',
    title: 'Changes to these terms and how to reach us',
    icon: Mail,
    plain: 'We publish the current version here with its date. Material changes get 30 days’ notice, and they never apply retrospectively to a lot you have already won.',
    blocks: [
      { type: 'p', text: <>We may update these terms from time to time. The current version will always be posted on this page along with the effective date. Continued use of the platform after changes are posted constitutes acceptance of the revised terms.</> },
      {
        type: 'list',
        items: [
          <><strong>Notice period.</strong> Material changes are notified by email or in-platform at least <strong>30 days</strong> before they take effect.</>,
          <><strong>No retrospective effect.</strong> The terms that govern a transaction are those in force when the auction opened. A later revision does not change a lot you have already won.</>,
          <><strong>Superseded versions.</strong> Previous versions are retained and available on request — useful when a query concerns an older trade.</>
        ]
      },
      {
        type: 'kv',
        items: [
          { k: 'General support', v: <>Mon–Sat, 9 AM–8 PM IST — <a href="mailto:support@ferrobid.in">support@ferrobid.in</a></> },
          { k: 'SMS programme queries', v: <a href="mailto:support@ferrobid.com">support@ferrobid.com</a> },
          { k: 'Grievance Officer', v: <>Ms. A. Iyer, FerroBid, Bengaluru — <a href="mailto:grievance@ferrobid.in">grievance@ferrobid.in</a></> },
          { k: 'Privacy and data requests', v: <a href="mailto:privacy@ferrobid.in">privacy@ferrobid.in</a> }
        ]
      }
    ]
  }
];

const TermsAndConditions = () => (
  <LegalDoc
    eyebrow="Terms & Conditions"
    eyebrowIcon={ScrollText}
    title="What you are agreeing to when you place a bid."
    lead="A bid on FerroBid is a binding offer, and an EMD is real money at risk. These terms set out how an auction runs, when payment falls due, who lifts the material, what the fees are, and what happens when something goes wrong."
    meta={{
      version: 'v2.0',
      effective: '1 August 2026',
      updated: '1 August 2026',
      readingTime: '12 min'
    }}
    sections={SECTIONS}
    related={[
      { to: '/privacy', label: 'Privacy Policy' },
      { to: '/grievance', label: 'Grievance Redressal' },
      { to: '/pricing', label: 'Pricing & fees' },
      { to: '/faqs', label: 'Help & FAQs' }
    ]}
  />
);

export default TermsAndConditions;
