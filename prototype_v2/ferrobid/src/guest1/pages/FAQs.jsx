/* ---------------------------------------------------------------------------
   Help & FAQs

   The previous version held eleven answers, which a reader could simply scroll.
   This one holds enough to cover a scrap trade end to end — bidding mechanics,
   EMD at risk, lifting windows, weighment disputes, GST and e-way bills — and
   at that size the page has to be searchable rather
   than browsable. So search is the primary control: it matches question, answer
   and keyword, highlights the hit, and every category carries a live count so
   a filter can be judged before it is clicked.
--------------------------------------------------------------------------- */
import React, { useMemo, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  HelpCircle, Search, X, ChevronDown, ChevronRight, SearchX,
  Sparkles, Gavel, Wallet, BadgeCheck, Truck, Receipt,
  Factory, KeyRound, LayoutGrid, ThumbsUp, ThumbsDown,
  Headset, MessageSquare, BookOpen
} from 'lucide-react';
import '../styles/enterprise.css';
import '../styles/support.css';

/* ─── Categories ───────────────────────────────────────────────────────── */
const CATEGORIES = [
  { id: 'all', label: 'All questions', icon: LayoutGrid },
  { id: 'start', label: 'Getting started', icon: Sparkles },
  { id: 'bidding', label: 'Bidding & auctions', icon: Gavel },
  { id: 'emd', label: 'EMD & payments', icon: Wallet },
  { id: 'kyc', label: 'KYC & verification', icon: BadgeCheck },
  { id: 'lifting', label: 'Lifting & logistics', icon: Truck },
  { id: 'tax', label: 'Tax & invoicing', icon: Receipt },
  { id: 'selling', label: 'Selling on FerroBid', icon: Factory },
  { id: 'account', label: 'Account & security', icon: KeyRound }
];

/* Terms a first-time buyer will not think to search for. Offering the
   vocabulary is most of the help. */
const SUGGESTED = ['EMD', 'auto-extension', 'lifting', 'e-way bill', 'reserve price', 'weighment', 'GST'];

/* ─── The answers ───────────────────────────────────────────────────────── */
const FAQS = [
  /* Getting started */
  {
    cat: 'start', q: 'What is FerroBid?',
    a: <>FerroBid is India's digital auction platform for industrial metal and scrap. Verified sellers list physically inspected lots; verified buyers bid on them in real time. Every lot passes five stages — seller onboarding, site inspection, executive approval, live auction, finance settlement — before money moves.</>,
    keys: 'about platform what is'
  },
  {
    cat: 'start', q: 'Who can register on FerroBid?',
    a: <>Registered businesses, not individuals. You need a valid GST registration and PAN, and you must register through an authorised signatory. Both buyers and sellers clear the same enterprise KYC before they can transact.</>,
    keys: 'eligibility who can register business individual'
  },
  {
    cat: 'start', q: 'How do I register as a buyer?',
    a: <>Choose <strong>Login / Register</strong>, select Buyer, and submit your enterprise KYC documents. Once approved you can browse lots, pay EMD and bid. Most approvals land within 24–48 business hours.</>,
    keys: 'signup register buyer account create',
    link: { to: '/auth?tab=register', label: 'Create an account' }
  },
  {
    cat: 'start', q: 'Can I browse lots before registering?',
    a: <>Yes. The marketplace is open to guests — you can see lots, categories, locations and inspection details without an account. Live bid values, bid counts and the bidding controls themselves require a verified account and, for live pricing, an active subscription.</>,
    keys: 'browse guest free view lots without account',
    link: { to: '/marketplace', label: 'Browse live lots' }
  },
  {
    cat: 'start', q: 'How soon after registering can I place a bid?',
    a: <>As soon as two things are done: your KYC is approved, and the EMD for that specific lot has been received. EMD is per lot, not per account, so budget for it ahead of an auction you intend to enter.</>,
    keys: 'how soon bid after register wait time'
  },

  /* Bidding */
  {
    cat: 'bidding', q: 'How does live bidding work?',
    a: <>During the published window you place bids in real time and the leaderboard updates live. In a forward auction the highest valid bid leads; in a reverse auction the lowest does. At close, the leading bid at or above reserve wins and a sale confirmation letter is issued.</>,
    keys: 'live bidding how works real time'
  },
  {
    cat: 'bidding', q: 'What is auto-extension, and why does the clock keep moving?',
    a: <>Auto-extension pushes the closing time out whenever a bid arrives inside the final window, and it repeats for as long as bids keep coming. It exists to stop last-second sniping, so a lot closes on price rather than on who has the faster connection. A moving clock is the feature working, not a fault.</>,
    keys: 'auto extension sniping timer clock extend closing'
  },
  {
    cat: 'bidding', q: 'Can I cancel, reduce or retract a bid?',
    a: <>No. A bid is an irrevocable offer the moment it is placed. It cannot be withdrawn, reduced or cancelled by you. Check the quantity, grade and lot number before you confirm — if you win above reserve, you have bought the lot.</>,
    keys: 'cancel retract withdraw reduce bid mistake'
  },
  {
    cat: 'bidding', q: 'What is a reserve price, and will I know if it is met?',
    a: <>The reserve is the minimum the seller will accept. The figure itself stays confidential, but the lot indicates whether reserve has been met. A lot that closes below reserve creates no binding sale — the seller may accept it anyway, decline, or relist.</>,
    keys: 'reserve price minimum met confidential'
  },
  {
    cat: 'bidding', q: 'What is the difference between a forward and a reverse auction?',
    a: <>In a <strong>forward</strong> auction the price ascends and the highest bid wins — this is the normal case, where a seller is disposing of material. In a <strong>reverse</strong> auction the price descends and the lowest bid wins; that format is used when the buyer is procuring and suppliers compete to supply.</>,
    keys: 'forward reverse auction difference descending ascending'
  },
  {
    cat: 'bidding', q: 'Can I inspect the material before I bid?',
    a: <>Every lot is physically inspected by a FerroBid site officer before it is published, and the report — GPS-tagged location, photographs, video, quantity and condition — is attached to the listing. For high-value lots you can request a site visit through the support desk before the auction opens.</>,
    keys: 'inspect view material before bidding site visit report'
  },
  {
    cat: 'bidding', q: 'The quantity looks approximate. What am I actually buying?',
    a: <>Quantities shown are inspection estimates unless the listing states otherwise. Where a lot settles on delivered weighbridge weight, the listing says so and names the reference weighbridge. Material is sold on an <strong>“as is, where is”</strong> basis against the published inspection report.</>,
    keys: 'quantity estimate approximate weight actual tonnage'
  },
  {
    cat: 'bidding', q: 'What happens if the platform fails mid-auction?',
    a: <>If a technical fault materially affects an auction we may extend, pause, void or re-run it. Where an auction is voided, EMD is returned in full and nobody is held to a bid placed during the affected window.</>,
    keys: 'technical fault outage down failure void auction'
  },

  /* EMD & payments */
  {
    cat: 'emd', q: 'What is an EMD?',
    a: <>Earnest Money Deposit — a refundable deposit that unlocks bidding on a lot and evidences your intent to bid. It is set per lot and shown on the listing. Paying EMD does not reserve the lot or give you priority; it only makes you eligible to bid.</>,
    keys: 'emd earnest money deposit what is'
  },
  {
    cat: 'emd', q: 'When do I get my EMD back if I do not win?',
    a: <>Automatically. Once the auction closes, the EMD of every non-winning bidder is released for refund to the originating account. Clearing and refunds are automated rather than manual goodwill — though the bank credit timeline itself is outside our control.</>,
    keys: 'emd refund lose losing bidder return money back'
  },
  {
    cat: 'emd', q: 'What happens to my EMD if I win?',
    a: <>It is adjusted against the total payable and shown as a credit on your sale confirmation letter. You pay the balance, not the full amount again.</>,
    keys: 'emd win adjusted credit balance'
  },
  {
    cat: 'emd', q: 'What payment methods are supported?',
    a: <>Bank transfer (NEFT/RTGS), UPI for smaller amounts, and escrow-backed settlement for high-value lots. Payment always goes to FerroBid or the designated escrow account — never seller-to-buyer directly. All payments are reconciled by our finance team.</>,
    keys: 'payment methods neft rtgs upi escrow bank transfer'
  },
  {
    cat: 'emd', q: 'When is the balance payment due?',
    a: <>Within the window stated on your sale confirmation letter — usually <strong>24–72 hours</strong> after the auction closes. The exact date and time is on the letter; that document, not this page, is the operative deadline.</>,
    keys: 'balance payment due when deadline window 24 72 hours'
  },
  {
    cat: 'emd', q: 'What happens if I miss the payment deadline?',
    a: <>The EMD may be forfeited, the sale cancelled and the lot relisted. If the lot resells for less, the shortfall and associated costs are recoverable from you. If you are going to be late, contact the finance desk <em>before</em> the deadline rather than after.</>,
    keys: 'miss deadline late payment forfeit emd penalty default'
  },
  {
    cat: 'emd', q: 'Is my money safe before the material is handed over?',
    a: <>High-value lots settle through escrow, and no funds move seller-to-buyer directly. The delivery order that releases material is issued only after your payment is reconciled, so neither side is exposed to the other's default.</>,
    keys: 'escrow safe secure protection money counterparty risk'
  },

  /* KYC */
  {
    cat: 'kyc', q: 'What documents are required for KYC?',
    a: <>GST registration certificate, PAN, certificate of incorporation (or equivalent constitution document), and authorised-signatory identity proof. Sellers additionally provide bank details for settlement. Requirements can vary slightly by entity type.</>,
    keys: 'kyc documents required gst pan incorporation signatory'
  },
  {
    cat: 'kyc', q: 'How long does verification take?',
    a: <>Most submissions are verified within <strong>24–48 business hours</strong>. You are notified by email and SMS when the decision is made. Submissions arriving on a Friday evening or before a public holiday will naturally sit longer.</>,
    keys: 'kyc how long verification time approval duration'
  },
  {
    cat: 'kyc', q: 'My KYC was rejected. What now?',
    a: <>The rejection notice states the reason — most commonly a mismatch between the entity name on the GST certificate and the PAN, an expired document, or an unreadable scan. Correct the specific item and resubmit; you do not have to start the whole application again.</>,
    keys: 'kyc rejected declined failed resubmit reason'
  },
  {
    cat: 'kyc', q: 'Do I have to redo KYC periodically?',
    a: <>Not on a fixed cycle, but you must keep your records current. If your GST registration, authorised signatory or bank account changes, update it before your next trade — settlement is made only to the verified account on file.</>,
    keys: 'kyc renew periodic update expire refresh'
  },

  /* Lifting & logistics */
  {
    cat: 'lifting', q: 'Who arranges transport after I win?',
    a: <>Either you or us. You can lift with your own transporter and labour, or engage FerroBid's pan-India logistics partners. If you use your own, you are responsible for vehicles, labour, equipment and compliance with the seller's site rules.</>,
    keys: 'transport logistics lifting who arranges vehicle'
  },
  {
    cat: 'lifting', q: 'How long do I have to lift the material?',
    a: <>The lifting window is stated on your sale confirmation letter. Material left beyond it is at your risk and may attract ground-rent or demurrage charged by the seller. Material left well beyond the window, plus any written extension, may be treated as abandoned.</>,
    keys: 'lifting window how long collect deadline demurrage abandoned'
  },
  {
    cat: 'lifting', q: 'What do I need at the seller\'s gate to collect?',
    a: <>The delivery order issued after your payment is reconciled, your transporter's documentation, and a valid e-way bill where the consignment value requires one. Sellers will not release material against a payment receipt alone.</>,
    keys: 'gate documents delivery order collect pickup dispatch'
  },
  {
    cat: 'lifting', q: 'The weighbridge reading differs from the listed quantity. What do I do?',
    a: <>Raise it at the gate, before the vehicle leaves. Where the listing states that settlement is on delivered weight, the nominated weighbridge is the reference and the invoice is adjusted to it. A weight dispute raised after the vehicle has departed is very difficult to substantiate.</>,
    keys: 'weighment weighbridge weight difference short dispute shortage'
  },
  {
    cat: 'lifting', q: 'Who is responsible for the e-way bill?',
    a: <>Generating transport documentation — including the e-way bill, and any pollution-control or hazardous-material paperwork — is the responsibility of the party moving the goods, under the applicable rules. Our team can tell you which documents a given lot needs, but cannot file them for you.</>,
    keys: 'eway bill e-way transport documentation gst movement'
  },

  /* Tax & invoicing */
  {
    cat: 'tax', q: 'Does the bid price include GST?',
    a: <>No. Bid prices are exclusive of GST and other applicable levies unless the lot explicitly states otherwise. Tax is applied at the rate in force on the invoice date and shown as a separate line on your sale confirmation letter and invoice.</>,
    keys: 'gst included bid price tax exclusive inclusive'
  },
  {
    cat: 'tax', q: 'When do I receive my tax invoice?',
    a: <>After payment is reconciled, issued to the GSTIN registered on your account. Check that GSTIN is correct <em>before</em> you bid — reissuing an invoice against a different GSTIN after the fact is slow and sometimes not possible.</>,
    keys: 'invoice tax when receive gstin billing document'
  },
  {
    cat: 'tax', q: 'Can I claim input tax credit on a purchase?',
    a: <>We issue a compliant tax invoice against the GSTIN on your account, which is what your credit claim would rest on. Whether you can actually claim it depends on your own registration, the nature of the material and your use of it — confirm with your tax adviser rather than relying on this page.</>,
    keys: 'input tax credit itc claim gst set off'
  },
  {
    cat: 'tax', q: 'Are TDS or TCS applicable on scrap purchases?',
    a: <>Tax deduction and collection at source can apply to scrap transactions depending on the parties, turnover and the material. Where a deduction applies to your transaction it is reflected in the settlement working shown to you. Your finance team should confirm the treatment for your own entity before bidding.</>,
    keys: 'tds tcs deduction collection source scrap tax'
  },

  /* Selling */
  {
    cat: 'selling', q: 'How do I list material for auction?',
    a: <>Submit an auction request with your documents. A site officer then inspects and GPS-tags the material, an executive approves the catalog, and only then does the lot publish to the verified buyer pool. Sellers submit requests — they do not create their own live auctions.</>,
    keys: 'sell list material auction request seller onboarding',
    link: { to: '/auth?tab=register', label: 'List with FerroBid' }
  },
  {
    cat: 'selling', q: 'How long from auction request to a live lot?',
    a: <>Onboarding and KYC take 24–48 business hours; the site inspection is scheduled around your yard's availability; executive approval happens before publication. The inspection visit is normally the longest link in the chain, so book it early.</>,
    keys: 'seller timeline how long list live publish lead time'
  },
  {
    cat: 'selling', q: 'When do I get paid as a seller?',
    a: <>After the buyer's payment is reconciled and the material is handed over, settlement and commission are reconciled automatically to the bank account verified during your KYC. The exact schedule is in your seller agreement.</>,
    keys: 'seller payment payout when settlement commission paid'
  },
  {
    cat: 'selling', q: 'Can I set a reserve price on my lot?',
    a: <>Yes. The reserve is agreed during catalog approval and stays confidential from bidders. If the lot closes below reserve you are not obliged to sell — you can accept the bid anyway, decline it, or relist.</>,
    keys: 'reserve set seller minimum price protect'
  },

  /* Account & security */
  {
    cat: 'account', q: 'Can several people from my company use one account?',
    a: <>Bids are attributed to the account that placed them, and a bid placed from your account is treated as placed by you regardless of who typed it. Where multiple people need access, ask the support desk about delegated access rather than sharing one password.</>,
    keys: 'multiple users team share account login colleagues'
  },
  {
    cat: 'account', q: 'I have been locked out of my account.',
    a: <>Use the password reset on the login page first. If the account is locked for a security reason — repeated failed logins, or a suspected compromise — contact the support desk from your registered email address and we will verify you and restore access.</>,
    keys: 'locked out password reset forgot login access recover'
  },
  {
    cat: 'account', q: 'How do I stop receiving SMS notifications?',
    a: <>Reply <strong>STOP</strong> to any message, or turn SMS off in your account settings. Keep email notifications on if you do — bid alerts and payment deadlines are time-critical, and a missed payment window can forfeit your EMD.</>,
    keys: 'sms stop unsubscribe opt out notifications messages',
    link: { to: '/terms', label: 'SMS programme terms' }
  },
  {
    cat: 'account', q: 'What can I raise a grievance about?',
    a: <>Material discrepancies, payment or refund issues, auction conduct concerns, KYC delays, or any conduct that breaches platform policy. You get a ticket number and acknowledgement within 24 hours, and there is a published escalation ladder if the first answer does not resolve it.</>,
    keys: 'grievance complaint dispute raise escalate problem',
    link: { to: '/grievance', label: 'Raise a grievance' }
  }
];

/* ─── Search index ─────────────────────────────────────────────────────────
   Answers are JSX, so their text has to be walked out of the element tree
   before it can be searched. Done once at module load rather than per
   keystroke — the set is static. */
const textOf = node => {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  return textOf(node.props?.children);
};

const INDEX = new Map(
  FAQS.map(item => [item.q, `${item.q} ${textOf(item.a)} ${item.keys || ''}`.toLowerCase()])
);

/* ─── Match highlighting ────────────────────────────────────────────────── */
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const Highlight = ({ text, query }) => {
  if (!query.trim()) return text;
  const parts = String(text).split(new RegExp(`(${escapeRe(query.trim())})`, 'ig'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.trim().toLowerCase()
      ? <mark key={i}>{part}</mark>
      : <React.Fragment key={i}>{part}</React.Fragment>
  );
};

/* ─── One question ──────────────────────────────────────────────────────── */
const FaqItem = ({ item, query, isOpen, onToggle, reduceMotion }) => {
  const [vote, setVote] = useState(null);
  const category = CATEGORIES.find(c => c.id === item.cat);

  return (
    <div className={`faq-item${isOpen ? ' is-open' : ''}`}>
      <h3 style={{ margin: 0 }}>
        <button type="button" className="faq-q" aria-expanded={isOpen} onClick={onToggle}>
          <span className="faq-q-text"><Highlight text={item.q} query={query} /></span>
          <span className="faq-chev" aria-hidden="true"><ChevronDown size={15} strokeWidth={2.25} /></span>
        </button>
      </h3>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={reduceMotion ? false : { height: 0 }}
            animate={{ height: 'auto' }}
            exit={reduceMotion ? { height: 0 } : { height: 0 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="faq-a-inner">
              <p className="faq-a-text">{item.a}</p>

              <div className="faq-a-meta">
                <span className="faq-tag">{category?.label ?? 'General'}</span>

                {item.link && (
                  <Link to={item.link.to} className="faq-more">
                    {item.link.label}
                    <ChevronRight size={13} strokeWidth={2.5} />
                  </Link>
                )}

                {/* The only signal a support desk gets that an answer is
                    actually wrong. Cheap to offer, expensive to lack. */}
                <span className="faq-vote">
                  {vote ? (
                    <span className="faq-vote-done">
                      {vote === 'up' ? 'Thanks for the feedback.' : 'Thanks — we\'ll rewrite this one.'}
                    </span>
                  ) : (
                    <>
                      Helpful?
                      <button type="button" onClick={() => setVote('up')} aria-label="This answer was helpful">
                        <ThumbsUp size={13} strokeWidth={2} />
                      </button>
                      <button type="button" onClick={() => setVote('down')} aria-label="This answer was not helpful">
                        <ThumbsDown size={13} strokeWidth={2} />
                      </button>
                    </>
                  )}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─── Page ──────────────────────────────────────────────────────────────── */
export const FAQs = () => {
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('all');
  const [openKey, setOpenKey] = useState(FAQS[0].q);
  const inputRef = useRef(null);

  /* Search reads the question, the answer's full text and a keyword field, so
     "sniping" finds auto-extension even though the word is only in the body. */
  const searched = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return FAQS;
    return FAQS.filter(item => INDEX.get(item.q).includes(needle));
  }, [query]);

  const counts = useMemo(() => {
    const map = { all: searched.length };
    for (const item of searched) map[item.cat] = (map[item.cat] || 0) + 1;
    return map;
  }, [searched]);

  const filtered = useMemo(
    () => (cat === 'all' ? searched : searched.filter(item => item.cat === cat)),
    [searched, cat]
  );

  const reset = () => { setQuery(''); setCat('all'); inputRef.current?.focus(); };
  const isFiltered = query.trim() !== '' || cat !== 'all';

  const reveal = reduceMotion ? {} : {
    initial: { y: 16 },
    whileInView: { y: 0 },
    viewport: { once: true, amount: 0.1 },
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] }
  };

  return (
    <div className="ent-page doc-page">
      {/* ─── Hero + search ─── */}
      <header className="faq-hero">
        <div className="container">
          <nav className="ent-breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <ChevronRight size={13} aria-hidden="true" />
            <span>Support</span>
            <ChevronRight size={13} aria-hidden="true" />
            <span className="crumb-current" aria-current="page">Help &amp; FAQs</span>
          </nav>

          <div className="faq-hero-inner">
            <p className="ent-hero-eyebrow"><HelpCircle size={13} aria-hidden="true" /> Help &amp; FAQs</p>
            <h1 className="doc-hero-title">{FAQS.length} answers, before you put money on a lot.</h1>
            <p className="doc-hero-lead">
              Everything from what an EMD actually is to who files the e-way bill. Search the
              whole set, or work through a category.
            </p>

            <div className="faq-search">
              <Search size={18} aria-hidden="true" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search — try “EMD”, “lifting window”, “GST”…"
                aria-label="Search frequently asked questions"
              />
              {query && (
                <button type="button" className="faq-search-clear" onClick={reset} aria-label="Clear search">
                  <X size={16} strokeWidth={2.25} />
                </button>
              )}
            </div>

            <div className="faq-suggest">
              <span>Common searches:</span>
              {SUGGESTED.map(term => (
                <button key={term} type="button" onClick={() => { setQuery(term); setCat('all'); }}>
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ─── Categories + results ─── */}
      <div className="container">
        <div className="faq-layout">
          <nav className="faq-cats" aria-label="Question categories">
            <p className="faq-cats-title">Categories</p>
            {CATEGORIES.map(category => {
              const Icon = category.icon;
              const count = counts[category.id] || 0;
              const on = cat === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  className={`faq-cat${on ? ' is-active' : ''}`}
                  onClick={() => setCat(category.id)}
                  aria-current={on ? 'true' : undefined}
                >
                  {on && !reduceMotion && (
                    <motion.span
                      className="faq-cat-marker"
                      layoutId="faq-cat-marker"
                      transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                    />
                  )}
                  {on && reduceMotion && <span className="faq-cat-marker" />}
                  <span className="faq-cat-icon"><Icon size={14} strokeWidth={2} /></span>
                  <span className="faq-cat-label">{category.label}</span>
                  <span className="faq-cat-count">{count}</span>
                </button>
              );
            })}
          </nav>

          <main className="faq-main">
            <div className="faq-resultline">
              <span>
                <strong>{filtered.length}</strong> {filtered.length === 1 ? 'answer' : 'answers'}
                {query.trim() && <> matching “<strong>{query.trim()}</strong>”</>}
                {cat !== 'all' && <> in {CATEGORIES.find(c => c.id === cat)?.label}</>}
              </span>
              {isFiltered && (
                <button type="button" className="faq-reset" onClick={reset}>Clear filters</button>
              )}
            </div>

            {filtered.length > 0 ? (
              <div className="faq-list">
                {filtered.map(item => (
                  <FaqItem
                    key={item.q}
                    item={item}
                    query={query}
                    reduceMotion={reduceMotion}
                    isOpen={openKey === item.q}
                    onToggle={() => setOpenKey(openKey === item.q ? null : item.q)}
                  />
                ))}
              </div>
            ) : (
              <div className="faq-empty">
                <span className="faq-empty-icon"><SearchX size={20} strokeWidth={1.9} /></span>
                <h3>Nothing matches “{query.trim()}”</h3>
                <p>
                  Try a shorter term, or clear the filters to see all {FAQS.length} answers.
                  If it is genuinely not covered here, the support desk will answer directly.
                </p>
                <button type="button" className="faq-reset" onClick={reset}>Clear filters</button>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ─── Where to go next ─── */}
      <section className="ent-section alt">
        <div className="container">
          <motion.div className="sec-head" {...reveal}>
            <p className="sec-eyebrow">Still stuck</p>
            <h2 className="sec-title">Three ways to reach a person.</h2>
            <p className="sec-lead">
              If the answer is not here, it is faster to ask than to keep searching. Support
              runs Mon–Sat, 9 AM–8 PM IST.
            </p>
          </motion.div>

          <motion.div className="faq-help-grid" {...reveal}>
            <Link to="/contact" className="faq-help-card">
              <span className="faq-help-icon"><Headset size={17} strokeWidth={1.9} /></span>
              <h4>Talk to support</h4>
              <p>Bidding, KYC, payments and settlement — the general desk handles all of it.</p>
              <span className="faq-help-value">Contact the team <ChevronRight size={13} strokeWidth={2.5} /></span>
            </Link>

            <Link to="/grievance" className="faq-help-card">
              <span className="faq-help-icon"><MessageSquare size={17} strokeWidth={1.9} /></span>
              <h4>Raise a grievance</h4>
              <p>Something went wrong on a trade. Ticketed, time-bound, with a published escalation ladder.</p>
              <span className="faq-help-value">Acknowledged in 24 hrs <ChevronRight size={13} strokeWidth={2.5} /></span>
            </Link>

            <Link to="/knowledge-center" className="faq-help-card">
              <span className="faq-help-icon"><BookOpen size={17} strokeWidth={1.9} /></span>
              <h4>Read the guides</h4>
              <p>Longer walkthroughs of onboarding, catalog preparation and settlement.</p>
              <span className="faq-help-value">Knowledge Center <ChevronRight size={13} strokeWidth={2.5} /></span>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default FAQs;
