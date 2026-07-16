/* ---------------------------------------------------------------------------
   Help & FAQ — how ferroBid works, role tracks, FAQ accordion, support band.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronDown, Gavel, ShieldCheck, ClipboardCheck, Phone, Mail, LifeBuoy,
  UserCheck, Search, Wallet, Truck, PackagePlus, FileCheck2, Banknote,
  Ruler, Camera, BadgeCheck,
} from 'lucide-react'
import { Page } from '../layout/Chrome'
import { Button, Chip, cx } from '../components/ui'

interface Step { icon: React.ReactNode; title: string; body: string }
interface Track { key: string; label: string; icon: React.ReactNode; tone: 'ember' | 'steel' | 'success'; steps: Step[] }

const TRACKS: Track[] = [
  {
    key: 'buyer', label: 'For buyers', icon: <Gavel size={18} />, tone: 'ember',
    steps: [
      { icon: <UserCheck size={18} />, title: 'Register & complete KYC', body: 'Sign up with your phone, firm details and GSTIN. Verified buyers get full bidding access.' },
      { icon: <Search size={18} />, title: 'Browse & inspect lots', body: 'Shortlist lots from live and upcoming catalogues, study inspection reports and book a yard visit.' },
      { icon: <Wallet size={18} />, title: 'Fund EMD & bid', body: 'Lock pre-bid EMD lot-wise from your wallet, then bid a rate per UOM in the live English auction.' },
      { icon: <Truck size={18} />, title: 'Win, pay & lift', body: 'If you are H1, pay the material value plus GST/TCS, receive the delivery order and lift within the window.' },
    ],
  },
  {
    key: 'seller', label: 'For sellers', icon: <PackagePlus size={18} />, tone: 'steel',
    steps: [
      { icon: <UserCheck size={18} />, title: 'Apply as a seller', body: 'Submit seller KYC — GSTIN, bank details and yard locations. Approval typically takes one business day.' },
      { icon: <PackagePlus size={18} />, title: 'Submit lots for disposal', body: 'List material with indicative quantity, grade, photos and your reserve expectation.' },
      { icon: <FileCheck2 size={18} />, title: 'We inspect & catalogue', body: 'Our field team physically verifies each lot before it is bundled into an auction catalogue.' },
      { icon: <Banknote size={18} />, title: 'Approve H1 & get paid', body: 'Confirm the highest bid (or review STA cases below reserve). Settlement lands after buyer payment.' },
    ],
  },
  {
    key: 'verification', label: 'Our verification team', icon: <ShieldCheck size={18} />, tone: 'success',
    steps: [
      { icon: <ClipboardCheck size={18} />, title: 'Yard visit scheduled', body: 'Every submitted lot is assigned to a field executive for an on-site inspection at the yard.' },
      { icon: <Ruler size={18} />, title: 'Measure & sample', body: 'Quantity is measured, grade is sampled and a condition checklist is completed on the spot.' },
      { icon: <Camera size={18} />, title: 'Photograph & report', body: 'Geo-tagged photos and the inspection report are attached to the lot for every bidder to see.' },
      { icon: <BadgeCheck size={18} />, title: 'Approve for auction', body: 'A manager verifies the report; only approved lots enter a published catalogue.' },
    ],
  },
]

const FAQS: { q: string; a: string }[] = [
  {
    q: 'What is EMD and when is it refunded?',
    a: 'Earnest Money Deposit is a lot-wise security amount you lock from your wallet before bidding on a lot. If you are not the winning (H1) bidder, the EMD is auto-released back to your wallet within 24 hours of catalogue close. If you win, it is adjusted against your final payment. EMD is forfeited only if you win and fail to pay or lift within the stated timelines.',
  },
  {
    q: 'What does "as-is-where-is" mean?',
    a: 'All material is sold in its present condition, at its present location, with no complaint entertained after sale. Quantity, quality and description in the catalogue are indicative — you are expected to physically inspect the lot (or study the inspection report) and satisfy yourself before bidding.',
  },
  {
    q: 'What is H1 / STA?',
    a: 'H1 is the highest bidder at close. If the H1 rate meets or exceeds the seller’s hidden reserve, the lot is sold outright. If H1 falls below reserve, the result is marked STA (Subject To Approval) and the seller decides within the bid-validity period whether to accept, negotiate or re-auction.',
  },
  {
    q: 'How does the anti-snipe extension work?',
    a: 'Every catalogue carries an anti-snipe window (typically 5 minutes). Any valid bid placed inside the last N minutes of a lot automatically extends that lot’s closing time by N minutes. This repeats until no bid lands inside the window, so a last-second bid can never lock others out.',
  },
  {
    q: 'What are bid validity days?',
    a: 'Your bid stays binding for the number of validity days stated on the catalogue (commonly 7–15 days) after close. During this window the seller can confirm STA results and you must complete payment. Withdrawing a bid inside the validity period leads to EMD forfeiture.',
  },
  {
    q: 'How is the final quantity decided (weighment)?',
    a: 'Catalogue quantities are indicative only. The final invoice quantity is determined by weighment at the designated weighbridge during lifting — your payment is adjusted pro-rata to the actual weighed quantity, up or down, as per the auction terms.',
  },
  {
    q: 'How are GST and TCS applied?',
    a: 'Bid rates are exclusive of taxes. GST (typically 18% on ferrous and most non-ferrous scrap) plus TCS at 1% under Section 206C(1) are added to the material value on your proforma invoice. A GST-compliant tax invoice and e-way bill are issued before the vehicle exits the gate.',
  },
  {
    q: 'How do I book an inspection visit?',
    a: 'Open the catalogue page and use "Book inspection slot" during the published inspection window. Pick a date, time window and the number of visitors — you receive a gate pass code to show at the yard along with a photo ID. Safety shoes and helmets are mandatory in most yards.',
  },
  {
    q: 'What happens if I don’t lift the material in time?',
    a: 'Ground rent applies per day beyond the lifting window stated on your delivery order. Prolonged failure to lift can lead to cancellation of the DO, forfeiture of amounts paid as per terms, and your account being moved to the watchlist or defaulter list.',
  },
  {
    q: 'How do I become a seller on ferroBid?',
    a: 'Go to your profile and start seller KYC — we verify your GSTIN, PAN, bank account and yard address. Once verified you can submit lots for inspection; our team catalogues and auctions them on your behalf.',
  },
  {
    q: 'Can I bid on multiple lots in the same catalogue?',
    a: 'Yes. Shortlist as many lots as you like and fund EMD for each lot you intend to bid on. EMD is per-lot, so you only lock money against lots where you actually compete.',
  },
  {
    q: 'What is an auto-bid (proxy bid)?',
    a: 'Set a maximum rate on a lot and the system bids on your behalf, one increment at a time, whenever you are outbid — up to your ceiling. You are notified if your auto-bid is exhausted so you can raise it before close.',
  },
]

function TrackCard({ track }: { track: Track }) {
  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Chip tone={track.tone}>{track.icon} {track.label}</Chip>
      </div>
      <ol className="space-y-4">
        {track.steps.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="num size-7 rounded-full bg-surface-2 border border-line grid place-items-center text-xs font-bold shrink-0">{i + 1}</span>
              {i < track.steps.length - 1 && <span className="w-px flex-1 bg-line mt-1" />}
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-2 font-semibold text-sm text-ink">
                <span className="text-ink-faint">{s.icon}</span> {s.title}
              </div>
              <p className="text-[13px] text-ink-muted mt-1 leading-relaxed">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function Help() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return (
    <Page>
      {/* Hero */}
      <div className="text-center max-w-2xl mx-auto mb-10 animate-fade-up">
        <Chip tone="ember" className="mb-3">Help centre</Chip>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">How ferroBid works</h1>
        <p className="text-ink-muted mt-3 text-sm sm:text-base leading-relaxed">
          Every lot on ferroBid is physically inspected, catalogued and sold as-is-where-is through a
          transparent English forward auction. Here is the full journey — whichever side of the gavel you are on.
        </p>
      </div>

      {/* Role tracks */}
      <div className="grid md:grid-cols-3 gap-4 mb-12">
        {TRACKS.map((t) => <TrackCard key={t.key} track={t} />)}
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto">
        <h2 className="font-display text-2xl font-bold mb-4">Frequently asked questions</h2>
        <div className="card divide-y divide-line overflow-hidden">
          {FAQS.map((f, i) => {
            const open = openFaq === i
            return (
              <div key={f.q}>
                <button
                  onClick={() => setOpenFaq(open ? null : i)}
                  aria-expanded={open}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ember">
                  <span className="font-semibold text-sm text-ink">{f.q}</span>
                  <ChevronDown size={16} className={cx('text-ink-faint shrink-0 transition-transform duration-200', open && 'rotate-180')} />
                </button>
                {open && (
                  <div className="px-5 pb-4 -mt-1 animate-fade-up">
                    <p className="text-sm text-ink-muted leading-relaxed">{f.a}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Support band */}
      <div className="max-w-3xl mx-auto mt-10">
        <div className="card p-6 sm:p-8 bg-surface-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 font-display text-lg font-bold">
                <LifeBuoy size={18} className="text-ember" /> Still need a hand?
              </div>
              <p className="text-sm text-ink-muted mt-1">
                Our support desk works 09:00–19:00 IST, Monday to Saturday.
              </p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 text-sm font-semibold">
                <a href="tel:18004190000" className="inline-flex items-center gap-1.5 hover:text-ember">
                  <Phone size={14} className="text-ink-faint" /> <span className="num">1800-419-000</span>
                  <span className="text-xs font-medium text-ink-faint">(toll free)</span>
                </a>
                <a href="mailto:support@ferrobid.in" className="inline-flex items-center gap-1.5 hover:text-ember">
                  <Mail size={14} className="text-ink-faint" /> support@ferrobid.in
                </a>
              </div>
            </div>
            <Link to="/disputes" className="shrink-0">
              <Button variant="secondary">Raise a dispute</Button>
            </Link>
          </div>
        </div>
      </div>
    </Page>
  )
}
