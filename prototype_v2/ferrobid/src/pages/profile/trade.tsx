/* ---------------------------------------------------------------------------
   The two trading roles.

   A buyer's profile is about one question — am I cleared to bid, and how hard
   do I want the platform to hold my hand while I do it. A seller's is about a
   different one — is my yard and my bank on file, and what defaults should
   every lot I create inherit.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BadgeCheck, Banknote, Building, Check, ChevronRight, FileCheck2, Gauge, Gavel,
  MapPin, Percent, Plus, ScrollText, ShieldCheck, Store, Truck, Upload, Warehouse,
} from 'lucide-react'
import { Button, Chip, Field, Input, Select, Toggle, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { CATEGORY_META } from '../../data/categoryMeta'
import { fmtDate, inr } from '../../lib/format'
import type { MetalCategory, User } from '../../types'
import { Granted, Label, Panel, Row, focusRing } from './kit'
import { PillGroup, REGIONS } from './common'

/* ------------------------------ shared: documents -------------------------- */

type DocStatus = 'verified' | 'pending' | 'missing'
type Doc = { name: string; note: string; status: DocStatus }

const DOC_TONE: Record<DocStatus, { tone: 'success' | 'warning' | 'neutral'; label: string }> = {
  verified: { tone: 'success', label: 'Verified' },
  pending: { tone: 'warning', label: 'Under review' },
  missing: { tone: 'neutral', label: 'Not uploaded' },
}

export const BUYER_DOCS: Doc[] = [
  { name: 'GST registration certificate', note: 'GST REG-06', status: 'verified' },
  { name: 'PAN card (firm)', note: 'Statutory', status: 'verified' },
  { name: 'Cancelled cheque', note: 'For EMD refunds', status: 'verified' },
  { name: 'Authorised signatory ID', note: 'Aadhaar or passport', status: 'pending' },
  { name: 'Registered office address proof', note: 'Utility bill or lease', status: 'missing' },
]

export const SELLER_DOCS: Doc[] = [
  { name: 'GST registration certificate', note: 'GST REG-06', status: 'verified' },
  { name: 'PAN card (firm)', note: 'Statutory', status: 'verified' },
  { name: 'Cancelled cheque', note: 'Where sale proceeds are received', status: 'verified' },
  { name: 'Board resolution / authorisation letter', note: 'Who may put material up for sale', status: 'verified' },
  { name: 'Yard ownership or lease deed', note: 'Proof of the premises material lifts from', status: 'pending' },
  { name: 'Pollution board consent', note: 'Required for scrap and hazardous grades', status: 'missing' },
]

export const outstanding = (docs: Doc[]) => docs.filter((d) => d.status !== 'verified').length

function DocumentRows({ docs }: { docs: Doc[] }) {
  const pushToast = useStore((s) => s.pushToast)
  return (
    <>
      {docs.map((d) => {
        const t = DOC_TONE[d.status]
        return (
          <Row key={d.name} label={d.name} desc={d.note}
            control={
              <div className="flex items-center gap-2">
                <Chip tone={t.tone}>{t.label}</Chip>
                <Button variant="secondary" size="sm"
                  onClick={() => pushToast({
                    kind: 'info',
                    title: d.status === 'missing' ? 'Upload document' : 'Document preview',
                    body: `${d.name} would open in a secure viewer (demo).`,
                  })}>
                  {d.status === 'missing' ? <><Upload size={13} /> Upload</> : 'View'}
                </Button>
              </div>
            } />
        )
      })}
    </>
  )
}

/* ================================== BUYER =================================== */

export function BuyerVerificationSection({ me }: { me: User }) {
  const nav = useNavigate()
  const verified = me.kycStatus === 'verified'

  return (
    <>
      <Panel icon={<ShieldCheck size={17} />} title="KYC status"
        desc="ferroBid verifies every bidder before EMD can be locked — sellers rely on it."
        aside={verified
          ? <Chip tone="success"><BadgeCheck size={12} /> Verified</Chip>
          : <Chip tone="warning">Under review</Chip>}>
        <Granted items={[
          { label: 'Verified on', value: verified ? fmtDate(me.joinedAt) : 'Pending' },
          { label: 'Bidding limit', value: verified ? 'No cap' : '₹5,00,000 per lot' },
          { label: 'Standing', value: <span className="font-sans capitalize">{me.standing}</span> },
          { label: 'Next review', value: 'Annual' },
        ]}
          note="A GSTIN or PAN change re-opens verification and pauses bidding until it clears." />
      </Panel>

      <Panel icon={<Banknote size={17} />} title="Refund bank account"
        desc="Where released EMD and any refund is returned. The account name must match your firm.">
        <Button variant="secondary" size="sm" onClick={() => nav('/buyer/wallet')}>
          Manage in SmartPay <ChevronRight size={14} />
        </Button>
      </Panel>

      <Panel wide icon={<FileCheck2 size={17} />} title="Documents"
        desc="Kept encrypted and shared only with ferroBid compliance — never with sellers or rival bidders."
        aside={outstanding(BUYER_DOCS) > 0 ? <Chip tone="warning">{outstanding(BUYER_DOCS)} outstanding</Chip> : undefined}
        flush>
        <DocumentRows docs={BUYER_DOCS} />
      </Panel>

      <Panel wide icon={<Store size={17} />} title="Seller capability"
        desc={me.sellerVerified
          ? 'You can submit lots for inspection and cataloguing from the seller workspace. Your buyer account and bidder ID stay separate and unaffected.'
          : 'Seller KYC adds bank and yard verification on top of your buyer KYC. Your bidder ID stays private — sellers never see it linked to your seller account.'}
        aside={me.sellerVerified
          ? <Chip tone="success"><ShieldCheck size={12} /> Seller verified</Chip>
          : <Chip tone="neutral">Not a seller yet</Chip>}>
        <Button variant="steel" size="sm" onClick={() => nav('/buyer/kyc')}>
          <Store size={14} /> {me.sellerVerified ? 'View KYC details' : 'Start seller KYC'}
        </Button>
      </Panel>
    </>
  )
}

export function BuyerBiddingSection({ city }: { city: string }) {
  const pushToast = useStore((s) => s.pushToast)
  const [confirmBeforeBid, setConfirmBeforeBid] = useState(true)
  const [amountInWords, setAmountInWords] = useState(true)
  const [ladderNames, setLadderNames] = useState(false)
  const [autoBidCeiling, setAutoBidCeiling] = useState('')
  const [exposureCap, setExposureCap] = useState('')
  const [alertLead, setAlertLead] = useState('10')
  const [categories, setCategories] = useState<MetalCategory[]>(['scrap', 'melting-products'])
  const [regions, setRegions] = useState<string[]>(['West'])

  const save = () => pushToast({
    kind: 'success', title: 'Bidding preferences saved',
    body: 'Applied to your next bidding room (demo).',
  })

  return (
    <>
      <Panel wide icon={<Gavel size={17} />} title="Bidding guardrails"
        desc="Applied inside every bidding room, on every lot, before a bid leaves this account."
        flush>
        <Row label="Confirm before placing a bid"
          desc="Shows a one-tap confirmation with the amount in words. Recommended for high-value lots."
          control={<Toggle checked={confirmBeforeBid} onChange={setConfirmBeforeBid} />} />
        <Row label="Show amounts in words"
          desc="Renders ₹12,45,000 as “twelve lakh forty-five thousand” beside the bid box."
          control={<Toggle checked={amountInWords} onChange={setAmountInWords} />} />
        <Row label="Show rival bidder IDs in the ladder"
          desc="Off by default. Turning it on shows the anonymous IDs above and below you — never names or firms, which the platform never reveals to anyone."
          control={<Toggle checked={ladderNames} onChange={setLadderNames} />} />
        <div className="px-5 sm:px-6 py-5 border-t border-line grid sm:grid-cols-3 gap-4">
          <Field label="Default auto-bid ceiling"
            hint="Pre-filled when you arm a proxy bid. Blank means set it lot by lot.">
            <Input className="num" inputMode="numeric" value={autoBidCeiling}
              onChange={(e) => setAutoBidCeiling(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="e.g. 500000" />
          </Field>
          <Field label="Self-imposed exposure cap"
            hint="A ceiling on your own live commitments. The room warns you before a bid crosses it.">
            <Input className="num" inputMode="numeric" value={exposureCap}
              onChange={(e) => setExposureCap(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="e.g. 5000000" />
          </Field>
          <Field label="Closing alert lead time" hint="How early to warn you before a lot you bid on closes.">
            <Select value={alertLead} onChange={(e) => setAlertLead(e.target.value)}>
              <option value="2">2 minutes</option>
              <option value="5">5 minutes</option>
              <option value="10">10 minutes</option>
              <option value="30">30 minutes</option>
            </Select>
          </Field>
        </div>
      </Panel>

      <Panel icon={<ScrollText size={17} />} title="Trade categories you follow"
        desc="New catalogues in these categories surface on your dashboard and can alert you.">
        <PillGroup
          options={CATEGORY_META.map((c) => c.key)}
          value={categories}
          onChange={setCategories}
          render={(k) => CATEGORY_META.find((c) => c.key === k)?.label ?? k} />
      </Panel>

      <Panel icon={<MapPin size={17} />} title="Preferred lifting regions"
        desc="Lots outside these regions stay visible, just ranked lower in Browse."
        aside={<span className="text-xs text-ink-muted flex items-center gap-1.5"><MapPin size={13} /> {city}</span>}>
        <PillGroup options={REGIONS} value={regions} onChange={setRegions} render={(r) => `${r} India`} />
      </Panel>

      <div className="xl:col-span-2 flex justify-end">
        <Button onClick={save}>Save bidding preferences</Button>
      </div>
    </>
  )
}

/* ================================== SELLER ================================== */

const YARDS = [
  { name: 'Kalamboli yard', where: 'Navi Mumbai, MH', note: 'Primary — weighbridge on site', verified: true },
  { name: 'Taloja unit-2', where: 'Raigad, MH', note: 'Flat products only', verified: true },
  { name: 'Bhiwandi shed', where: 'Thane, MH', note: 'Awaiting lease document', verified: false },
]

export function SellerVerificationSection({ me }: { me: User }) {
  const nav = useNavigate()
  const verified = me.sellerVerified

  return (
    <>
      <Panel icon={<ShieldCheck size={17} />} title="Seller verification"
        desc="Nothing you submit can be catalogued until this clears — buyers bid against it."
        aside={verified
          ? <Chip tone="success"><BadgeCheck size={12} /> Verified</Chip>
          : <Chip tone="warning">Under review</Chip>}>
        <Granted items={[
          { label: 'Verified on', value: verified ? fmtDate(me.joinedAt) : 'Pending' },
          { label: 'Verified by', value: <span className="font-sans">Operations desk</span> },
          { label: 'Categories cleared', value: <span className="font-sans">Scrap · Melting · Flat</span> },
          { label: 'Next review', value: 'Annual' },
        ]}
          note="Verification covers the firm, the bank account proceeds are paid into, and every yard material lifts from." />
        <div className="mt-4">
          <Button variant="secondary" size="sm" onClick={() => nav('/seller/verification')}>
            Open verification file <ChevronRight size={14} />
          </Button>
        </div>
      </Panel>

      <Panel icon={<Banknote size={17} />} title="Proceeds bank account"
        desc="Buyers pay you directly — ferroBid never holds your sale proceeds, it only collects its commission. This is the account a buyer is given.">
        <Granted items={[
          { label: 'Account name', value: <span className="font-sans">{me.firm}</span> },
          { label: 'Account number', value: '•••• •••• 4417' },
          { label: 'IFSC', value: 'HDFC0000241' },
          { label: 'Status', value: <span className="font-sans text-success">Verified by penny drop</span> },
        ]}
          note="Changing this account pauses new catalogue publishing until Finance re-verifies it." />
      </Panel>

      <Panel wide icon={<FileCheck2 size={17} />} title="Documents"
        desc="Held by ferroBid compliance. Buyers never see them — they see only that you are a verified seller."
        aside={outstanding(SELLER_DOCS) > 0 ? <Chip tone="warning">{outstanding(SELLER_DOCS)} outstanding</Chip> : undefined}
        flush>
        <DocumentRows docs={SELLER_DOCS} />
      </Panel>

      <Panel wide icon={<Warehouse size={17} />} title="Yards & lifting points"
        desc="Where a buyer inspects and lifts. Each one is verified separately before a lot can name it."
        aside={<Button variant="secondary" size="sm">
          <Plus size={13} /> Add yard
        </Button>}
        flush>
        {YARDS.map((y) => (
          <Row key={y.name} icon={<Warehouse size={15} />}
            label={<span className="flex items-center gap-2">{y.name}
              {!y.verified && <Chip tone="warning" className="h-5 text-[10px]">Unverified</Chip>}</span>}
            desc={`${y.where} · ${y.note}`}
            control={<Button variant="ghost" size="sm">Edit</Button>} />
        ))}
      </Panel>
    </>
  )
}

export function SellerSellingSection() {
  const pushToast = useStore((s) => s.pushToast)
  const [uom, setUom] = useState('MT')
  const [defaultYard, setDefaultYard] = useState(YARDS[0].name)
  const [liftingDays, setLiftingDays] = useState('7')
  const [reservePolicy, setReservePolicy] = useState('always')
  const [settlementMode, setSettlementMode] = useState('emd')
  const [autoAccept, setAutoAccept] = useState(true)
  const [autoAcceptPct, setAutoAcceptPct] = useState('100')
  const [firstBidAlert, setFirstBidAlert] = useState(true)
  const [closingAlert, setClosingAlert] = useState(true)
  const [staAlert, setStaAlert] = useState(true)
  const [categories, setCategories] = useState<MetalCategory[]>(['scrap', 'flat-products'])

  const save = () => pushToast({
    kind: 'success', title: 'Selling defaults saved',
    body: 'Every lot you create from now on starts with these (demo).',
  })

  return (
    <>
      <Panel wide icon={<Truck size={17} />} title="Lot defaults"
        desc="What Create lot is pre-filled with. Every one of these can still be changed lot by lot.">
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Field label="Default unit of measurement">
            <Select value={uom} onChange={(e) => setUom(e.target.value)}>
              <option value="MT">MT — metric tonne</option>
              <option value="KG">KG</option>
              <option value="PCS">PCS — pieces</option>
              <option value="LOT">LOT — whole lot</option>
            </Select>
          </Field>
          <Field label="Default yard">
            <Select value={defaultYard} onChange={(e) => setDefaultYard(e.target.value)}>
              {YARDS.map((y) => <option key={y.name} value={y.name}>{y.name}</option>)}
            </Select>
          </Field>
          <Field label="Lifting window" hint="Days a buyer gets to clear the material after payment.">
            <Select value={liftingDays} onChange={(e) => setLiftingDays(e.target.value)}>
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="10">10 days</option>
              <option value="15">15 days</option>
            </Select>
          </Field>
          <Field label="Reserve price policy" hint="What happens when the highest bid lands below reserve.">
            <Select value={reservePolicy} onChange={(e) => setReservePolicy(e.target.value)}>
              <option value="always">Always set a reserve</option>
              <option value="sta">Allow subject-to-approval</option>
              <option value="none">Sell without reserve</option>
            </Select>
          </Field>
        </div>
      </Panel>

      <Panel icon={<Percent size={17} />} title="Settlement & commission"
        desc="Buyers pay you directly; ferroBid invoices you for its commission on what sold.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="How I prefer to settle commission">
            <Select value={settlementMode} onChange={(e) => setSettlementMode(e.target.value)}>
              <option value="emd">Net it out of the EMD held</option>
              <option value="transfer">Pay by bank transfer</option>
            </Select>
          </Field>
          <Field label="Auto-accept cleared price at or above"
            hint="Below this, the price waits for you on Settlement.">
            <Select value={autoAcceptPct} onChange={(e) => setAutoAcceptPct(e.target.value)} disabled={!autoAccept}>
              <option value="100">100% of reserve</option>
              <option value="105">105% of reserve</option>
              <option value="110">110% of reserve</option>
            </Select>
          </Field>
        </div>
        <div className="mt-5 pt-5 border-t border-line flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink">Accept cleared prices automatically</div>
            <div className="text-[13px] text-ink-muted mt-0.5 leading-relaxed">
              Off means every single result waits for your acceptance, however far above reserve it landed.
            </div>
          </div>
          <Toggle checked={autoAccept} onChange={setAutoAccept} />
        </div>
      </Panel>

      <Panel icon={<Gauge size={17} />} title="Tell me when"
        desc="Sale-floor moments worth interrupting you for. Everything else stays on the Live monitor."
        flush>
        <Row label="First bid lands on one of my lots"
          control={<Toggle checked={firstBidAlert} onChange={setFirstBidAlert} />} />
        <Row label="A lot of mine is 10 minutes from closing"
          control={<Toggle checked={closingAlert} onChange={setClosingAlert} />} />
        <Row label="A lot closes below reserve and goes subject-to-approval"
          desc="This one needs a decision from you before the buyer can be told anything."
          control={<Toggle checked={staAlert} onChange={setStaAlert} />} />
      </Panel>

      <Panel wide icon={<Building size={17} />} title="Material I deal in"
        desc="Used to route your lots to the right field executive and the right catalogue.">
        <PillGroup
          options={CATEGORY_META.map((c) => c.key)}
          value={categories}
          onChange={setCategories}
          render={(k) => CATEGORY_META.find((c) => c.key === k)?.label ?? k} />
      </Panel>

      <div className="xl:col-span-2 flex justify-end">
        <Button onClick={save}>Save selling defaults</Button>
      </div>
    </>
  )
}

/* -------------------------- what a seller cannot do ------------------------- */

export function SellerAnonymityNote({ sellerId }: { sellerId: string }) {
  return (
    <div className={cx('flex gap-3 rounded-xl border border-line bg-surface-2/50 px-4 py-3.5')}>
      <Check size={15} className="text-success shrink-0 mt-0.5" />
      <p className="text-[13px] text-ink-muted leading-relaxed">
        Buyers see <span className="num font-semibold text-ink">{sellerId}</span> and your firm on a catalogue,
        and nothing else. You see the winning <span className="font-semibold text-ink">bidder ID</span> — never a
        buyer's name, firm or contact — until Operations hands the lot over.
      </p>
    </div>
  )
}

export { inr, focusRing, Label }
