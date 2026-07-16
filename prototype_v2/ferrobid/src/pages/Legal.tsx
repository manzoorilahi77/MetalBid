/* ---------------------------------------------------------------------------
   Legal — Terms of Use, Privacy Policy and the seeded Auction Terms sets,
   toggled with a Segmented control on one page.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { AlertTriangle, ScrollText } from 'lucide-react'
import { Page } from '../layout/Chrome'
import { PageHeader, Segmented, Chip } from '../components/ui'
import { useStore } from '../store/store'

type Section = { title: string; body: string }

const TERMS_OF_USE: Section[] = [
  { title: 'Acceptance of terms', body: 'By registering on or using the ferroBid platform ("Platform"), operated by ferroBid Technologies Pvt Ltd, you agree to be bound by these Terms of Use, the applicable Auction Terms of each catalogue, and all policies referenced herein. If you act on behalf of a firm, you represent that you are authorised to bind that firm.' },
  { title: 'Eligibility & registration', body: 'The Platform is available only to business entities and individuals competent to contract under the Indian Contract Act, 1872, holding a valid GSTIN where applicable. You must provide accurate KYC information and keep it current. We may suspend or terminate accounts that provide false, incomplete or outdated information.' },
  { title: 'Nature of the service', body: 'ferroBid is an intermediary marketplace facilitating forward auctions of industrial material between sellers and buyers. Except where expressly stated, ferroBid is not the seller of the material and does not warrant its quality, quantity or fitness. All lots are sold on an as-is-where-is, no-complaint basis.' },
  { title: 'Bidding & binding offers', body: 'Every bid placed is an irrevocable offer valid for the bid-validity period stated on the catalogue. Bids cannot be withdrawn or reduced once placed. Manipulative practices — shill bidding, bid rotation, collusion or interference with the auction engine — are prohibited and lead to forfeiture of EMD and blacklisting.' },
  { title: 'EMD, payments & default', body: 'Pre-bid EMD must be funded lot-wise before bidding. Successful bidders must pay the material value plus applicable GST, TCS and levies within the stipulated period. Failure to pay or lift material within the timelines constitutes default, entitling the seller to forfeit EMD and re-auction the material at your risk and cost.' },
  { title: 'Account standing & suspension', body: 'We maintain a standing status (good / watchlist / defaulter) for every account based on payment and lifting behaviour. We may restrict bidding rights, withhold participation in select catalogues, or terminate access for accounts in default, with notice where practicable.' },
  { title: 'Limitation of liability', body: 'To the maximum extent permitted by law, ferroBid’s aggregate liability arising out of any auction shall not exceed the platform fee earned by ferroBid on that transaction. ferroBid is not liable for indirect or consequential losses, yard delays, statutory changes or force majeure events.' },
  { title: 'Governing law & disputes', body: 'These terms are governed by the laws of India. Subject to the dispute-resolution process on the Platform, courts at Mumbai shall have exclusive jurisdiction. Disputes may first be raised through the in-platform dispute desk, which we endeavour to resolve within 7 working days.' },
]

const PRIVACY: Section[] = [
  { title: 'Information we collect', body: 'We collect the information you provide at registration (name, firm, phone, email, GSTIN, address, bank details for settlement), KYC documents, and activity data generated on the Platform — bids, shortlists, EMD transactions, inspection bookings and support conversations.' },
  { title: 'How we use it', body: 'Your information is used to operate auctions, verify identity and eligibility, process wallet and EMD transactions, issue delivery orders and tax documents, prevent fraud and market abuse, and send you transactional and (with consent) promotional communications.' },
  { title: 'Sharing with sellers & authorities', body: 'When you win a lot, relevant details (name, firm, GSTIN, contact) are shared with the seller to complete the sale, issue invoices and gate passes. We disclose information to statutory and tax authorities where required by law, including GST and TCS reporting.' },
  { title: 'Cookies & analytics', body: 'We use strictly necessary cookies to keep you signed in and functional cookies to remember preferences such as theme and notification settings. Aggregated, anonymised analytics help us improve catalogue discovery and auction performance. We do not sell personal data.' },
  { title: 'Data security & retention', body: 'Data is encrypted in transit and at rest and access is restricted on a need-to-know basis. Transaction and KYC records are retained for 8 years to meet audit and statutory requirements; other data is retained only as long as your account is active plus applicable limitation periods.' },
  { title: 'Your rights', body: 'You may access and correct your profile information at any time from Profile & settings. You can request a copy of your data, withdraw promotional consent, or seek account deletion (subject to statutory retention) by writing to privacy@ferrobid.in.' },
  { title: 'Grievance officer', body: 'For privacy concerns, contact the Grievance Officer: Ms. Kavita Rao, ferroBid Technologies Pvt Ltd, Unit 12, Steel Exchange House, Lower Parel, Mumbai 400013 — grievance@ferrobid.in. We acknowledge complaints within 48 hours and resolve them within 15 days.' },
]

function ProseSections({ sections, updated }: { sections: Section[]; updated: string }) {
  return (
    <div className="card p-6 sm:p-8 max-w-3xl">
      <p className="text-xs text-ink-faint mb-6">Last updated: {updated}</p>
      <ol className="space-y-6">
        {sections.map((s, i) => (
          <li key={s.title}>
            <h3 className="font-display font-bold text-ink">
              <span className="num text-ink-faint mr-2">{i + 1}.</span>{s.title}
            </h3>
            <p className="text-sm text-ink-muted leading-relaxed mt-1.5">{s.body}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

function AuctionTerms() {
  const termsSets = useStore((s) => s.termsSets)
  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-sm text-ink-muted">
        Each catalogue is governed by one of the following terms sets. The applicable set and version
        are shown on the catalogue page and must be accepted before bidding.
      </p>
      {termsSets.map((ts) => (
        <div key={ts.id} className="card p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2.5 mb-5">
            <ScrollText size={18} className="text-steel" />
            <h3 className="font-display text-lg font-bold">{ts.name}</h3>
            <Chip tone="steel" className="num">{ts.version}</Chip>
          </div>

          <h4 className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-2">General conditions</h4>
          <ol className="space-y-2 mb-6">
            {ts.general.map((g, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-ink-muted leading-relaxed">
                <span className="num text-ink-faint shrink-0">{i + 1}.</span>{g}
              </li>
            ))}
          </ol>

          <h4 className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-2">Special conditions</h4>
          <ol className="space-y-2 mb-6">
            {ts.special.map((g, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-ink-muted leading-relaxed">
                <span className="num text-ink-faint shrink-0">S{i + 1}.</span>{g}
              </li>
            ))}
          </ol>

          <div className="rounded-xl border border-warning/30 bg-warning-soft p-4 flex gap-2.5">
            <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
            <p className="text-sm text-warning leading-relaxed font-medium">
              Order of precedence — {ts.lotSpecificNote}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

type Seg = 'terms' | 'privacy' | 'auction'

export default function Legal() {
  const [seg, setSeg] = useState<Seg>('terms')
  return (
    <Page>
      <PageHeader
        title="Terms & privacy"
        sub="The legal framework behind every auction on ferroBid — platform terms, how we handle your data, and the standard auction conditions."
      />
      <Segmented<Seg>
        className="mb-6"
        value={seg}
        onChange={setSeg}
        options={[
          { key: 'terms', label: 'Terms of Use' },
          { key: 'privacy', label: 'Privacy Policy' },
          { key: 'auction', label: 'Auction Terms' },
        ]}
      />
      {seg === 'terms' && <ProseSections sections={TERMS_OF_USE} updated="01 Apr 2026" />}
      {seg === 'privacy' && <ProseSections sections={PRIVACY} updated="01 Apr 2026" />}
      {seg === 'auction' && <AuctionTerms />}
    </Page>
  )
}
