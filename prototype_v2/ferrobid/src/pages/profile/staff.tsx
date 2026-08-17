/* ---------------------------------------------------------------------------
   The seven staff desks.

   A staff profile is not a settings page — it is the desk itself, written down:
   what this account may decide alone, what it must hand to somebody else, what
   every screen it opens is pre-filled with, and who covers it when the person
   holding it is away. The authority half is deliberately read-only. It is
   granted by the Super Admin and the spec's approval matrix, and a desk that
   could raise its own ceiling would not be a control at all.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlarmClock, BellRing, Bookmark, Building2, Camera, ClipboardCheck, Compass,
  Crown, FileSignature, FileSpreadsheet, Gauge, Gavel, HardHat, Landmark, Layers,
  ListChecks, Lock, Megaphone, PenLine, Radio, Receipt, Route, ScrollText,
  ShieldAlert, Signature, SlidersHorizontal, Timer, UserCog, Users, Wrench,
} from 'lucide-react'
import { Button, Chip, Field, Input, Select, Textarea, Toggle } from '../../components/ui'
import { useStore } from '../../store/store'
import { CATEGORY_META } from '../../data/categoryMeta'
import { fmtDate, inr } from '../../lib/format'
import type { MetalCategory } from '../../types'
import { AuthorityList, Granted, Panel, Row } from './kit'
import { PillGroup, REGIONS } from './common'

/** Every staff section ends with the same affordance — nothing here writes to
    the store, so saving is an acknowledgement rather than a mutation. */
function SaveRow({ label, onSave }: { label: string; onSave: () => void }) {
  return (
    <div className="xl:col-span-2 flex justify-end">
      <Button onClick={onSave}>{label}</Button>
    </div>
  )
}

function useSave(title: string, body: string) {
  const pushToast = useStore((s) => s.pushToast)
  return () => pushToast({ kind: 'success', title, body })
}

/* ============================ FIELD EXECUTIVE =============================== */

const DISTRICTS = ['Mumbai', 'Thane', 'Raigad', 'Pune', 'Nashik', 'Jamshedpur', 'Rourkela', 'Bhilai', 'Vizag']
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function FieldKitSection() {
  const save = useSave('Field kit saved', 'Your next inspection opens with these settings (demo).')
  const [photoQuality, setPhotoQuality] = useState('high')
  const [minPhotos, setMinPhotos] = useState('8')
  const [geoStamp, setGeoStamp] = useState(true)
  const [offline, setOffline] = useState(true)
  const [wifiSync, setWifiSync] = useState(true)
  const [uom, setUom] = useState('MT')
  const [weighSource, setWeighSource] = useState('weighbridge')
  const [tolerance, setTolerance] = useState('5')
  const [checklist, setChecklist] = useState('standard')

  return (
    <>
      <Panel wide icon={<Camera size={17} />} title="Capture"
        desc="How the app records a lot in the yard. A buyer bids on these photos and nothing else, so the defaults are deliberately strict."
        flush>
        <div className="px-5 sm:px-6 py-5 border-t border-line grid sm:grid-cols-3 gap-4">
          <Field label="Photo quality" hint="Higher uploads slower on a weak yard signal.">
            <Select value={photoQuality} onChange={(e) => setPhotoQuality(e.target.value)}>
              <option value="high">High — 4 MP</option>
              <option value="balanced">Balanced — 2 MP</option>
              <option value="light">Light — 1 MP</option>
            </Select>
          </Field>
          <Field label="Minimum photos per lot" hint="The app will not let you submit below this.">
            <Select value={minPhotos} onChange={(e) => setMinPhotos(e.target.value)}>
              <option value="4">4</option>
              <option value="6">6</option>
              <option value="8">8</option>
              <option value="12">12</option>
            </Select>
          </Field>
          <Field label="Default checklist">
            <Select value={checklist} onChange={(e) => setChecklist(e.target.value)}>
              <option value="standard">Standard — all categories</option>
              <option value="scrap">Scrap & melting</option>
              <option value="assets">Plant & machinery</option>
            </Select>
          </Field>
        </div>
        <Row label="Stamp every photo with location and time"
          desc="Proves the visit happened at the yard on the day claimed. Operations relies on it when a buyer disputes condition."
          control={<Toggle checked={geoStamp} onChange={setGeoStamp} />} />
        <Row label="Work offline"
          desc="Keeps the full assignment on the device so a yard with no signal does not stop an inspection."
          control={<Toggle checked={offline} onChange={setOffline} />} />
        <Row label="Upload only on Wi-Fi"
          desc="Holds photos until you are back on Wi-Fi. Turn off if a report is urgent."
          control={<Toggle checked={wifiSync} onChange={setWifiSync} />} />
      </Panel>

      <Panel icon={<Gauge size={17} />} title="Measurement"
        desc="What the measured quantity on your report defaults to, and when it flags itself.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Default unit">
            <Select value={uom} onChange={(e) => setUom(e.target.value)}>
              <option value="MT">MT — metric tonne</option>
              <option value="KG">KG</option>
              <option value="PCS">PCS — pieces</option>
            </Select>
          </Field>
          <Field label="Quantity source">
            <Select value={weighSource} onChange={(e) => setWeighSource(e.target.value)}>
              <option value="weighbridge">Weighbridge slip</option>
              <option value="estimate">Visual estimate</option>
              <option value="seller">Seller declaration</option>
            </Select>
          </Field>
          <Field label="Flag when measured differs from declared by more than" className="sm:col-span-2"
            hint="Above this the lot is raised to Operations instead of passing straight through.">
            <Select className="max-w-40" value={tolerance} onChange={(e) => setTolerance(e.target.value)}>
              <option value="2">2%</option>
              <option value="5">5%</option>
              <option value="10">10%</option>
            </Select>
          </Field>
        </div>
      </Panel>

      <Panel icon={<Signature size={17} />} title="Inspector signature"
        desc="Goes on the bottom of every report you file. Buyers see the report, not the signature.">
        <div className="rounded-xl border border-dashed border-line-strong bg-surface-2/40 px-4 py-6 text-center">
          <PenLine size={20} className="mx-auto text-ink-faint" />
          <p className="text-[13px] text-ink-muted mt-2">No signature on file yet.</p>
          <Button variant="secondary" size="sm" className="mt-3">Draw signature</Button>
        </div>
      </Panel>

      <SaveRow label="Save field kit" onSave={save} />
    </>
  )
}

export function FieldCoverageSection({ baseCity }: { baseCity: string }) {
  const save = useSave('Coverage saved', 'Operations will see this when assigning your next visit (demo).')
  const [districts, setDistricts] = useState<string[]>(['Mumbai', 'Thane', 'Raigad'])
  const [days, setDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
  const [radius, setRadius] = useState('120')
  const [maxPerDay, setMaxPerDay] = useState('4')
  const [autoAccept, setAutoAccept] = useState(true)
  const [vehicle, setVehicle] = useState('own')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')

  return (
    <>
      <Panel wide icon={<Compass size={17} />} title="Where I cover"
        desc="Operations assigns yard visits from this. Somewhere outside it can still be assigned — you will just be asked first."
        aside={<Chip tone="steel">Base · {baseCity}</Chip>}>
        <PillGroup options={DISTRICTS} value={districts} onChange={setDistricts} />
        <div className="grid sm:grid-cols-2 gap-4 mt-5">
          <Field label="Travel radius from base" hint="Straight-line distance, used to rank assignments.">
            <Select value={radius} onChange={(e) => setRadius(e.target.value)}>
              <option value="60">60 km</option>
              <option value="120">120 km</option>
              <option value="250">250 km</option>
              <option value="0">No limit</option>
            </Select>
          </Field>
          <Field label="Vehicle">
            <Select value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
              <option value="own">Own vehicle — claim mileage</option>
              <option value="company">Company vehicle</option>
              <option value="public">Public transport — claim fare</option>
            </Select>
          </Field>
        </div>
      </Panel>

      <Panel icon={<AlarmClock size={17} />} title="When I am available"
        desc="Nothing outside these hours is auto-assigned to you.">
        <PillGroup options={WEEKDAYS} value={days} onChange={setDays} />
        <div className="grid grid-cols-2 gap-4 mt-5">
          <Field label="From"><Input type="time" className="num" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></Field>
          <Field label="To"><Input type="time" className="num" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></Field>
        </div>
      </Panel>

      <Panel icon={<Route size={17} />} title="Assignments"
        desc="How much work the queue may push at you without asking." flush>
        <div className="px-5 sm:px-6 py-5 border-t border-line">
          <Field label="Maximum inspections per day">
            <Select className="max-w-40" value={maxPerDay} onChange={(e) => setMaxPerDay(e.target.value)}>
              <option value="2">2</option>
              <option value="4">4</option>
              <option value="6">6</option>
              <option value="8">8</option>
            </Select>
          </Field>
        </div>
        <Row label="Accept auto-assigned visits"
          desc="Off means Operations has to offer each visit to you and wait for you to take it."
          control={<Toggle checked={autoAccept} onChange={setAutoAccept} />} />
      </Panel>

      <Panel wide icon={<HardHat size={17} />} title="What this desk decides"
        desc="Inspection only. No auction, no pricing, no money — by design, so what a buyer bids against is never written by anyone with a stake in the price.">
        <AuthorityList
          can={[
            'File an inspection report against an assigned lot',
            'Record measured quantity, condition and defects',
            'Upload yard photographs and the weighbridge slip',
            'Flag a lot that does not match what the seller declared',
            'Witness a gross weighment at handover',
          ]}
          cannot={[
            { what: 'Approving the lot into a catalogue', who: 'Operation Manager' },
            { what: 'Setting or seeing a reserve price', who: 'Seller and Operations only' },
            { what: 'Anything to do with EMD, payment or refund', who: 'Finance' },
            { what: 'Re-assigning your own visit', who: 'Operation Manager or Sub-Admin' },
          ]} />
      </Panel>

      <SaveRow label="Save coverage" onSave={save} />
    </>
  )
}

/* =========================== OPERATION MANAGER ============================== */

export function OpsDeskSection() {
  const save = useSave('Desk defaults saved', 'Applied to the pipeline screens you open next (demo).')
  const [categories, setCategories] = useState<MetalCategory[]>(['scrap', 'melting-products', 'flat-products'])
  const [regions, setRegions] = useState<string[]>(['West', 'East'])
  const [inspectionSla, setInspectionSla] = useState('3')
  const [autoAssign, setAutoAssign] = useState(true)
  const [requireTwoPhotos, setRequirePhotos] = useState(true)
  const [confirmBypass, setConfirmBypass] = useState(true)

  return (
    <>
      <Panel wide icon={<Layers size={17} />} title="What lands on my pipeline"
        desc="The lot pipeline, lot approval and the catalogue builder all open filtered to this.">
        <div className="space-y-5">
          <div>
            <p className="text-[13px] font-semibold text-ink mb-2.5">Categories I own</p>
            <PillGroup options={CATEGORY_META.map((c) => c.key)} value={categories} onChange={setCategories}
              render={(k) => CATEGORY_META.find((c) => c.key === k)?.label ?? k} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-ink mb-2.5">Regions I own</p>
            <PillGroup options={REGIONS} value={regions} onChange={setRegions} render={(r) => `${r} India`} />
          </div>
        </div>
      </Panel>

      <Panel icon={<ClipboardCheck size={17} />} title="Intake standards"
        desc="The gate a lot has to clear before it can be catalogued." flush>
        <div className="px-5 sm:px-6 py-5 border-t border-line">
          <Field label="Inspection turnaround target"
            hint="An assigned visit older than this shows as overdue on the pipeline.">
            <Select className="max-w-48" value={inspectionSla} onChange={(e) => setInspectionSla(e.target.value)}>
              <option value="1">1 working day</option>
              <option value="2">2 working days</option>
              <option value="3">3 working days</option>
              <option value="5">5 working days</option>
            </Select>
          </Field>
        </div>
        <Row label="Auto-assign field executives"
          desc="Matches a new lot to the nearest available executive covering that district. Off means you assign every visit by hand."
          control={<Toggle checked={autoAssign} onChange={setAutoAssign} />} />
        <Row label="Require photographs before approval"
          desc="Blocks the approve button on a lot with no inspection photographs on file."
          control={<Toggle checked={requireTwoPhotos} onChange={setRequirePhotos} />} />
        <Row label="Ask me to type a reason when I bypass inspection"
          desc="A bypass is the one route a lot can take into a catalogue without a yard visit, and it is named in the audit entry either way."
          control={<Toggle checked={confirmBypass} onChange={setConfirmBypass} />} />
      </Panel>

      <Panel icon={<Lock size={17} />} title="My authority"
        desc="Granted by the Super Admin. Ask them to change any of it."
        aside={<Chip tone="steel">Read-only</Chip>}>
        <Granted items={[
          { label: 'Lot approval ceiling', value: 'No cap', sub: 'Any reserve value' },
          { label: 'Catalogue publish', value: <span className="font-sans">Permitted</span>, sub: 'Shared with the Auction Manager' },
          { label: 'Inspection bypass', value: <span className="font-sans">Permitted</span>, sub: 'Reason required, always audited' },
          { label: 'Seller verification', value: <span className="font-sans">Permitted</span> },
        ]} />
      </Panel>

      <Panel wide icon={<Wrench size={17} />} title="What this desk decides"
        desc="Operations runs the pre-auction gate and closes the file after the hammer. The floor itself belongs to the Auction Manager.">
        <AuthorityList
          can={[
            'Approve, send back or reject a lot into a catalogue',
            'Verify a seller and clear them to submit material',
            'Assign and re-assign a field executive to a yard visit',
            'Build a catalogue, schedule it and publish it',
            'Close a handover against a witnessed weighment',
          ]}
          cannot={[
            { what: 'Pausing, extending or cancelling a live auction', who: 'Auction Manager, cancellation to Super Admin' },
            { what: 'Voiding a bid on the record', who: 'Super Admin' },
            { what: 'Moving any money — refund, forfeiture, payout', who: 'Finance' },
            { what: 'A publish above the CEO value threshold', who: 'CEO / MD signature' },
          ]} />
      </Panel>

      <SaveRow label="Save desk defaults" onSave={save} />
    </>
  )
}

/** Cover while away. Operations, the auction floor and the ops console all
    need one, and it is the same shape on each — so it is written once. */
export function DelegationSection({ roleLabel, candidates }: { roleLabel: string; candidates: string[] }) {
  const save = useSave('Cover arranged', 'Your work would route to them for the window set (demo).')
  const [away, setAway] = useState(false)
  const [to, setTo] = useState(candidates[0] ?? '')
  const [from, setFrom] = useState('')
  const [until, setUntil] = useState('')
  const [note, setNote] = useState('')
  const [forward, setForward] = useState(true)

  return (
    <>
      <Panel wide icon={<Users size={17} />} title="Cover while I am away"
        desc={`Nothing on the ${roleLabel} desk waits for one person to be back. Naming cover routes your queue to them — and the audit still names whoever actually acted.`}
        aside={away ? <Chip tone="warning">Away</Chip> : <Chip tone="success">At my desk</Chip>}
        flush>
        <Row label="I am away"
          desc="Turns on the redirect below and marks you unavailable on every work queue."
          control={<Toggle checked={away} onChange={setAway} />} />
        <div className="px-5 sm:px-6 py-5 border-t border-line grid sm:grid-cols-3 gap-4">
          <Field label="Cover is">
            <Select value={to} onChange={(e) => setTo(e.target.value)} disabled={!away}>
              {candidates.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="From"><Input type="date" className="num" value={from} onChange={(e) => setFrom(e.target.value)} disabled={!away} /></Field>
          <Field label="Until"><Input type="date" className="num" value={until} onChange={(e) => setUntil(e.target.value)} disabled={!away} /></Field>
          <Field label="What they should know" className="sm:col-span-3">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} disabled={!away}
              className="min-h-20" placeholder="Anything open, anything to watch for." />
          </Field>
        </div>
        <Row label="Forward my alerts to them as well"
          desc="Off means they see the work on the queue but are not interrupted for it."
          control={<Toggle checked={forward} onChange={setForward} />} />
      </Panel>

      <SaveRow label="Save cover" onSave={save} />
    </>
  )
}

/* ============================= AUCTION MANAGER ============================== */

const TEMPLATES = [
  { name: 'Lot withdrawn before bidding', use: 'Sent to everyone admitted to the catalogue' },
  { name: 'Inspection window extended', use: 'Pre-auction, to shortlisted buyers' },
  { name: 'Auction paused — technical', use: 'To the room, mid-sale' },
  { name: 'Results published', use: 'To every participant after close' },
]

export function AuctionDeskSection() {
  const save = useSave('Auction defaults saved', 'New catalogues you schedule start with these (demo).')
  const [antiSnipe, setAntiSnipe] = useState('3')
  const [validity, setValidity] = useState('7')
  const [increment, setIncrement] = useState('percent')
  const [confirmExtend, setConfirmExtend] = useState(true)
  const [publishChecklist, setPublishChecklist] = useState(true)

  return (
    <>
      <Panel wide icon={<Gavel size={17} />} title="Auction defaults"
        desc="What Schedule & publish is pre-filled with. Every catalogue can still override them before it goes live.">
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Anti-snipe window"
            hint="A bid inside the last N minutes extends the lot by N minutes.">
            <Select value={antiSnipe} onChange={(e) => setAntiSnipe(e.target.value)}>
              <option value="2">2 minutes</option>
              <option value="3">3 minutes</option>
              <option value="5">5 minutes</option>
              <option value="10">10 minutes</option>
            </Select>
          </Field>
          <Field label="Bid validity" hint="How long H1 stays bound to their price after close.">
            <Select value={validity} onChange={(e) => setValidity(e.target.value)}>
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="15">15 days</option>
            </Select>
          </Field>
          <Field label="Increment policy">
            <Select value={increment} onChange={(e) => setIncrement(e.target.value)}>
              <option value="percent">Percentage of current rate</option>
              <option value="fixed">Fixed step per category</option>
              <option value="slab">Slab — rises with the price</option>
            </Select>
          </Field>
        </div>
      </Panel>

      <Panel icon={<ListChecks size={17} />} title="Before I publish"
        desc="The checks that stand between a built catalogue and a public one." flush>
        <Row label="Run the publish checklist"
          desc="Terms set, EMD deadline ahead of go-live, every lot approved, inspection window open. Nothing publishes with a red line."
          control={<Toggle checked={publishChecklist} onChange={setPublishChecklist} />} />
        <Row label="Confirm before I extend a live lot"
          desc="An extension moves a closing time buyers are watching, so it asks first."
          control={<Toggle checked={confirmExtend} onChange={setConfirmExtend} />} />
      </Panel>

      <Panel icon={<Megaphone size={17} />} title="Announcement templates"
        desc="Pre-written broadcasts, so a mid-sale message is never drafted under pressure."
        aside={<Button variant="secondary" size="sm">New</Button>}
        flush>
        {TEMPLATES.map((t) => (
          <Row key={t.name} icon={<Megaphone size={15} />} label={t.name} desc={t.use}
            control={<Button variant="ghost" size="sm">Edit</Button>} />
        ))}
      </Panel>

      <Panel wide icon={<Radio size={17} />} title="What this desk decides"
        desc="The floor is yours from publish to close. Two things are deliberately out of your hands — because both are irreversible for somebody else.">
        <AuthorityList
          can={[
            'Publish a catalogue and admit buyers to it',
            'Set EMD eligibility for a catalogue',
            'Pause, resume and extend a live auction',
            'Broadcast an announcement to a room mid-sale',
            'Confirm results and refer a below-reserve lot for approval',
          ]}
          cannot={[
            { what: 'Cancelling an auction outright', who: 'raised as a request to Super Admin' },
            { what: 'Voiding a bid already on the record', who: 'raised as a request to Super Admin' },
            { what: 'A publish above the CEO value threshold', who: 'CEO / MD signature' },
            { what: 'Anything touching EMD or payment', who: 'Finance' },
          ]} />
      </Panel>

      <SaveRow label="Save auction defaults" onSave={save} />
    </>
  )
}

export function FloorAlertsSection() {
  const save = useSave('Floor alerts saved', 'Applied to the rooms you are watching (demo).')
  const [closingLead, setClosingLead] = useState('5')
  const [suspicious, setSuspicious] = useState(true)
  const [idleRoom, setIdleRoom] = useState(true)
  const [noBids, setNoBids] = useState(true)
  const [sound, setSound] = useState(true)
  const [desktop, setDesktop] = useState(true)
  const [pinLive, setPinLive] = useState(true)

  return (
    <>
      <Panel wide icon={<BellRing size={17} />} title="Interrupt me when"
        desc="A live floor generates more events than anyone can read. These are the ones worth pulling you out of another screen for."
        flush>
        <div className="px-5 sm:px-6 py-5 border-t border-line">
          <Field label="Warn me before a lot closes">
            <Select className="max-w-44" value={closingLead} onChange={(e) => setClosingLead(e.target.value)}>
              <option value="2">2 minutes ahead</option>
              <option value="5">5 minutes ahead</option>
              <option value="15">15 minutes ahead</option>
            </Select>
          </Field>
        </div>
        <Row label="Bidding pattern looks wrong"
          desc="Two accounts trading the lead in a tight loop, or a bid far outside the ladder. Surveillance is this desk's job — the void itself is not."
          control={<Toggle checked={suspicious} onChange={setSuspicious} />} />
        <Row label="A live room has gone quiet"
          desc="No bid for a long stretch on a lot that should be moving."
          control={<Toggle checked={idleRoom} onChange={setIdleRoom} />} />
        <Row label="A lot is about to close with no bids at all"
          desc="Early enough to extend it or announce something, rather than reading it in the results."
          control={<Toggle checked={noBids} onChange={setNoBids} />} />
      </Panel>

      <Panel icon={<Timer size={17} />} title="How I am told"
        desc="Only applies while you have a bidding room or the live floor open." flush>
        <Row label="Sound on urgent alerts" control={<Toggle checked={sound} onChange={setSound} />} />
        <Row label="Desktop notifications" control={<Toggle checked={desktop} onChange={setDesktop} />} />
        <Row label="Pin live rooms to the top of every list"
          desc="Anything running stays above anything scheduled or closed, everywhere."
          control={<Toggle checked={pinLive} onChange={setPinLive} />} />
      </Panel>

      <SaveRow label="Save floor alerts" onSave={save} />
    </>
  )
}

/* ============================ FINANCE ADMINISTRATOR ========================= */

export function FinanceDeskSection() {
  const cfg = useStore((s) => s.financeConfig)
  const save = useSave('Finance desk saved', 'Applied to the ledger screens you open next (demo).')
  const [invoicePrefix, setInvoicePrefix] = useState('FB/INV/26')
  const [matchTolerance, setMatchTolerance] = useState('100')
  const [statementFormat, setStatementFormat] = useState('csv')
  const [autoMatch, setAutoMatch] = useState(true)
  const [dailyClose, setDailyClose] = useState(true)

  return (
    <>
      <Panel wide icon={<Landmark size={17} />} title="Rates I have to charge"
        desc="Set on Financial config and signed by the CEO above threshold. This desk applies them; it never edits them."
        aside={<Chip tone="steel">Read-only</Chip>}>
        <Granted items={[
          { label: 'GST', value: `${cfg.gstPct}%` },
          { label: 'TCS', value: `${cfg.tcsPct}%` },
          { label: 'Buyer premium', value: `${cfg.buyerPremiumPct}%` },
          { label: 'Seller commission', value: `${cfg.sellerCommissionPct}%`, sub: 'On the upside over reserve' },
          { label: 'EMD', value: `${cfg.emdPct}%`, sub: `Min ${inr(cfg.emdMin)} · cap ${inr(cfg.emdCap)}` },
          { label: 'Payment window', value: `${cfg.paymentWindowDays} days` },
        ]}
          note="A change to any of these is a CEO signature, not a Finance edit — which is why the figures a buyer was charged can always be reconstructed from the record." />
      </Panel>

      <Panel icon={<Receipt size={17} />} title="Documents I issue"
        desc="Numbering and format for everything that leaves this desk on paper.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Invoice series prefix" hint="Sequence continues from the last issued number.">
            <Input className="num" value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value)} />
          </Field>
          <Field label="Statement import format">
            <Select value={statementFormat} onChange={(e) => setStatementFormat(e.target.value)}>
              <option value="csv">CSV — bank export</option>
              <option value="mt940">MT940</option>
              <option value="xlsx">XLSX</option>
            </Select>
          </Field>
        </div>
      </Panel>

      <Panel icon={<FileSpreadsheet size={17} />} title="Reconciliation"
        desc="How hard the platform tries to match a bank line to a platform record before it asks you." flush>
        <div className="px-5 sm:px-6 py-5 border-t border-line">
          <Field label="Auto-match amount tolerance"
            hint="A statement line inside this of a claimed deposit is matched without asking.">
            <Select className="max-w-44" value={matchTolerance} onChange={(e) => setMatchTolerance(e.target.value)}>
              <option value="0">Exact only</option>
              <option value="100">± ₹100</option>
              <option value="500">± ₹500</option>
            </Select>
          </Field>
        </div>
        <Row label="Auto-match on an exact UTR"
          desc="A deposit whose UTR appears verbatim on the statement is matched for you. You still approve it."
          control={<Toggle checked={autoMatch} onChange={setAutoMatch} />} />
        <Row label="Remind me to close the day"
          desc="A prompt at end of day listing anything unmatched, unverified or unpaid."
          control={<Toggle checked={dailyClose} onChange={setDailyClose} />} />
      </Panel>

      <SaveRow label="Save finance desk" onSave={save} />
    </>
  )
}

export function FinanceControlsSection() {
  const cfg = useStore((s) => s.financeConfig)
  const save = useSave('Controls acknowledged', 'Your own limits are recorded (demo).')
  const [myLimit, setMyLimit] = useState('1000000')
  const [alertDual, setAlertDual] = useState(true)
  const [alertLargeOut, setAlertLargeOut] = useState(true)

  return (
    <>
      <Panel wide icon={<ShieldAlert size={17} />} title="Maker–checker"
        desc="The control that stops one person both approving and paying the same money."
        aside={<Chip tone="steel">Platform policy</Chip>}>
        <Granted items={[
          { label: 'Second signature required at', value: inr(cfg.withdrawalSecondSignatureFrom), sub: 'A different Finance user must release it' },
          { label: 'CEO signs refunds from', value: inr(cfg.ceoRefundFrom) },
          { label: 'CEO signs forfeitures from', value: inr(cfg.ceoForfeitureFrom) },
          { label: 'EMD auto-release', value: `${cfg.emdReleaseHours} hours`, sub: 'Releasing money is automatic; taking it never is' },
        ]}
          note="Below the second-signature threshold one user may do both steps — the audit entry still names them twice, once as reviewer and once as processor." />
      </Panel>

      <Panel icon={<SlidersHorizontal size={17} />} title="My own ceiling"
        desc="A limit you set on yourself, below the platform's. Anything above it goes to a colleague even where policy would let you release it.">
        <Field label="I will not release more than" hint="Leave at the platform limit to opt out.">
          <Input className="num max-w-56" inputMode="numeric" value={myLimit}
            onChange={(e) => setMyLimit(e.target.value.replace(/[^\d]/g, ''))} />
        </Field>
        <p className="text-xs text-ink-muted mt-3">Currently {inr(Number(myLimit) || 0)}.</p>
      </Panel>

      <Panel icon={<BellRing size={17} />} title="Tell me when" flush>
        <Row label="A payment is waiting on my second signature"
          desc="Somebody else reviewed it and cannot release it themselves."
          control={<Toggle checked={alertDual} onChange={setAlertDual} />} />
        <Row label="Money leaves above my ceiling"
          desc="Even when a colleague released it. This desk is the one that has to explain it."
          control={<Toggle checked={alertLargeOut} onChange={setAlertLargeOut} />} />
      </Panel>

      <Panel wide icon={<Landmark size={17} />} title="What this desk decides"
        desc="Finance is the only desk that moves money. It is also the only one that cannot decide what it is charging.">
        <AuthorityList
          can={[
            'Verify a deposit against the bank statement',
            'Process a withdrawal within the maker–checker rules',
            'Confirm or query a seller commission settlement',
            'Issue, reissue and cancel an invoice or receipt',
            'Return a refund the CEO has signed',
          ]}
          cannot={[
            { what: 'Changing a fee, rate or threshold', who: 'Super Admin config, CEO signature' },
            { what: 'A refund or forfeiture above threshold', who: 'CEO / MD signature' },
            { what: 'Releasing a payment you also reviewed, above threshold', who: 'a second Finance user' },
            { what: 'Anything on the auction floor or the lot pipeline', who: 'Auction Manager, Operations' },
          ]} />
      </Panel>

      <SaveRow label="Save controls" onSave={save} />
    </>
  )
}

/* ================================ SUB ADMIN ================================= */

export function SubAdminDeskSection() {
  const save = useSave('Ops desk saved', 'Your work queue opens with these (demo).')
  const [autoClaim, setAutoClaim] = useState(false)
  const [defaultTab, setDefaultTab] = useState('unreviewed')
  const [notableOnly, setNotableOnly] = useState(true)
  const [categories, setCategories] = useState<MetalCategory[]>(['scrap', 'assets'])
  const [regions, setRegions] = useState<string[]>(['West', 'East', 'South'])
  const [escalate, setEscalate] = useState('super_admin')

  return (
    <>
      <Panel wide icon={<ListChecks size={17} />} title="My work queue"
        desc="Work on this desk is divided by assignment, never by capability — every Sub-Admin account can do everything, so these are only about what you see first."
        flush>
        <div className="px-5 sm:px-6 py-5 border-t border-line grid sm:grid-cols-2 gap-4">
          <Field label="Approvals opens on">
            <Select value={defaultTab} onChange={(e) => setDefaultTab(e.target.value)}>
              <option value="unreviewed">Unreviewed</option>
              <option value="reviewed">Reviewed</option>
              <option value="escalated">Escalated</option>
            </Select>
          </Field>
          <Field label="Findings I cannot close go to">
            <Select value={escalate} onChange={(e) => setEscalate(e.target.value)}>
              <option value="super_admin">Super Admin</option>
              <option value="ceo">CEO / MD</option>
            </Select>
          </Field>
        </div>
        <Row label="Claim work automatically"
          desc="Takes the oldest unclaimed item matching your categories the moment you open the queue. Off means you pick."
          control={<Toggle checked={autoClaim} onChange={setAutoClaim} />} />
        <Row label="Start on “worth a second look”"
          desc="Filters the approvals feed to the actions the platform flagged, rather than every action taken."
          control={<Toggle checked={notableOnly} onChange={setNotableOnly} />} />
      </Panel>

      <Panel icon={<Bookmark size={17} />} title="What I watch"
        desc="Categories and regions you are the named supervisor for.">
        <div className="space-y-5">
          <PillGroup options={CATEGORY_META.map((c) => c.key)} value={categories} onChange={setCategories}
            render={(k) => CATEGORY_META.find((c) => c.key === k)?.label ?? k} />
          <PillGroup options={REGIONS} value={regions} onChange={setRegions} render={(r) => `${r} India`} />
        </div>
      </Panel>

      <Panel icon={<UserCog size={17} />} title="My access"
        desc="Every Sub-Admin account is identical — the same eighteen screens and the same powers. There is deliberately no per-account template."
        aside={<Chip tone="steel">Read-only</Chip>}>
        <Granted items={[
          { label: 'Screens', value: '18', sub: 'Ops desk · pipeline · oversight' },
          { label: 'Shared screens', value: '7', sub: 'Same screen as Ops and Auction, not a copy' },
          { label: 'Money powers', value: <span className="font-sans">None</span>, sub: 'Sees everything, moves nothing' },
          { label: 'Account actions', value: <span className="font-sans">Reset password</span>, sub: 'Status changes go to Super Admin' },
        ]} />
      </Panel>

      <Panel wide icon={<ShieldAlert size={17} />} title="What this desk decides"
        desc="Supervisory, not a gate. The operational role acts first and it takes effect immediately; what happens here is the verdict afterwards.">
        <AuthorityList
          can={[
            'Put a verdict against any operational action on the record',
            'Verify a seller and assign a field executive',
            'Work the lot pipeline, approval and catalogue builder directly',
            'Resolve a dispute and raise the refund it owes',
            'Reset a user password and leave a shift handover note',
          ]}
          cannot={[
            { what: 'Reversing a bid you judged wrong', who: 'Super Admin' },
            { what: 'Banning an account or changing its status', who: 'Super Admin' },
            { what: 'Cancelling a live auction', who: 'Super Admin' },
            { what: 'Paying the refund you raised', who: 'Finance' },
          ]} />
      </Panel>

      <SaveRow label="Save ops desk" onSave={save} />
    </>
  )
}

export function ShiftSection() {
  const save = useSave('Shift saved', 'Your handover would carry these (demo).')
  const [shift, setShift] = useState('general')
  const [onCall, setOnCall] = useState(false)
  const [handTo, setHandTo] = useState('Next Sub-Admin on shift')
  const [template, setTemplate] = useState(
    'Open items:\nWatch for:\nAnything I promised somebody:',
  )
  const [remind, setRemind] = useState(true)

  return (
    <>
      <Panel wide icon={<AlarmClock size={17} />} title="My shift"
        desc="The ops console shows who is on and who is next. Nothing waits for one person to be at their desk."
        flush>
        <div className="px-5 sm:px-6 py-5 border-t border-line grid sm:grid-cols-2 gap-4">
          <Field label="Shift">
            <Select value={shift} onChange={(e) => setShift(e.target.value)}>
              <option value="general">General — 09:30 to 18:30</option>
              <option value="early">Early — 06:00 to 14:00</option>
              <option value="late">Late — 14:00 to 22:00</option>
              <option value="night">Night — 22:00 to 06:00</option>
            </Select>
          </Field>
          <Field label="I hand over to">
            <Select value={handTo} onChange={(e) => setHandTo(e.target.value)}>
              <option>Next Sub-Admin on shift</option>
              <option>Operation Manager</option>
              <option>Auction Manager</option>
            </Select>
          </Field>
        </div>
        <Row label="On call outside my shift"
          desc="A live-floor incident or a stuck payment can reach you when nobody else is on."
          control={<Toggle checked={onCall} onChange={setOnCall} />} />
        <Row label="Remind me to write a handover note"
          desc="Prompts 15 minutes before your shift ends, with anything still claimed by you listed."
          control={<Toggle checked={remind} onChange={setRemind} />} />
      </Panel>

      <Panel wide icon={<ScrollText size={17} />} title="Handover note template"
        desc="Pre-filled every time you write one, so the same three things are always answered.">
        <Textarea value={template} onChange={(e) => setTemplate(e.target.value)} className="min-h-32 font-mono text-[13px]" />
      </Panel>

      <SaveRow label="Save shift" onSave={save} />
    </>
  )
}

/* =============================== SUPER ADMIN =============================== */

export function PlatformAuthoritySection() {
  const changes = useStore((s) => s.structuralChanges)
  const roles = useStore((s) => s.roleRegistry)
  const pages = useStore((s) => s.pageRegistry)
  const save = useSave('Platform preferences saved', 'Applied to the structure screens (demo).')
  const [confirmStructural, setConfirmStructural] = useState(true)
  const [rollbackWindow, setRollbackWindow] = useState('30')
  const [previewBefore, setPreviewBefore] = useState(true)

  return (
    <>
      <Panel wide icon={<Building2 size={17} />} title="The shape of the platform"
        desc="Structure, not business data — and that distinction is the whole safety model. Everything here can be rolled back; an auction, a bid, a payment and an audit entry never can."
        aside={<Chip tone="steel">Live counts</Chip>}>
        <Granted items={[
          { label: 'Roles defined', value: String(roles.length) },
          { label: 'Pages in the registry', value: String(pages.length) },
          { label: 'Structural changes', value: String(changes.length), sub: 'Every one of them undoable' },
          { label: 'Last change', value: changes[0] ? fmtDate(changes[0].at) : '—' },
        ]} />
      </Panel>

      <Panel icon={<SlidersHorizontal size={17} />} title="How I change structure"
        desc="Guardrails on the screens that rename a tab, hide a page or remove a role." flush>
        <div className="px-5 sm:px-6 py-5 border-t border-line">
          <Field label="Keep changes rollable back for"
            hint="After this a change stays on the record but the one-click undo expires.">
            <Select className="max-w-48" value={rollbackWindow} onChange={(e) => setRollbackWindow(e.target.value)}>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="0">Never expires</option>
            </Select>
          </Field>
        </div>
        <Row label="Confirm every structural change"
          desc="A role removed suspends everyone holding it, so it asks first — with the count of who it affects."
          control={<Toggle checked={confirmStructural} onChange={setConfirmStructural} />} />
        <Row label="Preview the menu before I save it"
          desc="Shows the affected role's top bar and sub-nav exactly as they will see it."
          control={<Toggle checked={previewBefore} onChange={setPreviewBefore} />} />
      </Panel>

      <Panel icon={<Crown size={17} />} title="What only this desk can do"
        desc="The levers no other role holds, however senior.">
        <ul className="space-y-2.5">
          {[
            'Void a bid already on the record',
            'Ban an account or change its status',
            'Cancel a live auction',
            'Create and remove a role, and the menu every role sees',
            'Roll back a structural change',
          ].map((t) => (
            <li key={t} className="flex gap-2.5 text-[13px] text-ink leading-relaxed">
              <Lock size={14} className="text-danger shrink-0 mt-0.5" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <SaveRow label="Save platform preferences" onSave={save} />
    </>
  )
}

export function BreakGlassSection() {
  const save = useSave('Break-glass policy saved', 'Applied to the emergency override screen (demo).')
  const [armed, setArmed] = useState(false)
  const [reasonRequired, setReasonRequired] = useState(true)
  const [notifyCeo, setNotifyCeo] = useState(true)
  const [expiry, setExpiry] = useState('30')
  const [ipAllow, setIpAllow] = useState('103.21.44.0/24\n49.36.128.0/20')

  return (
    <>
      <Panel wide icon={<ShieldAlert size={17} />} title="Emergency override"
        desc="Support and recovery, never a routine desk. Arming it is itself an audited event, and it disarms on its own."
        aside={armed ? <Chip tone="danger" pulse>Armed</Chip> : <Chip tone="neutral">Disarmed</Chip>}
        flush>
        <Row label="Arm emergency override"
          desc="Unlocks the control tower for the window below. Everything done while armed is written to the audit trail with the reason given."
          control={<Toggle checked={armed} onChange={setArmed} />} />
        <div className="px-5 sm:px-6 py-5 border-t border-line">
          <Field label="Disarm automatically after">
            <Select className="max-w-44" value={expiry} onChange={(e) => setExpiry(e.target.value)}>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">1 hour</option>
            </Select>
          </Field>
        </div>
        <Row label="Require a written reason"
          desc="Typed before the override opens, and shown verbatim on the audit entry and to the CEO."
          control={<Toggle checked={reasonRequired} onChange={setReasonRequired} />} />
        <Row label="Notify the CEO whenever it is armed"
          desc="Recommended. An override with nobody watching is the one control the platform cannot audit its way out of."
          control={<Toggle checked={notifyCeo} onChange={setNotifyCeo} />} />
      </Panel>

      <Panel wide icon={<Lock size={17} />} title="Where this account may sign in from"
        desc="CIDR ranges, one per line. A sign-in from anywhere else is refused outright rather than challenged.">
        <Textarea value={ipAllow} onChange={(e) => setIpAllow(e.target.value)} className="min-h-24 font-mono text-[13px]" />
        <p className="text-xs text-ink-muted mt-3 leading-relaxed">
          Locking yourself out is recoverable only through the platform host. Leave a second Super Admin
          account on a different range before narrowing this.
        </p>
      </Panel>

      <SaveRow label="Save break-glass policy" onSave={save} />
    </>
  )
}

/* =================================== CEO ==================================== */

export function SignatureAuthoritySection() {
  const cfg = useStore((s) => s.financeConfig)
  const approvals = useStore((s) => s.ceoApprovals)
  const nav = useNavigate()
  const save = useSave('Signature preferences saved', 'Applied to your approval queue (demo).')
  const [briefBefore, setBriefBefore] = useState(true)
  const [sla, setSla] = useState('24')
  const [batch, setBatch] = useState(false)

  const pending = approvals.filter((a) => a.status === 'pending' || a.status === 'info_requested')
  const value = pending.reduce((s, a) => s + a.amount, 0)

  return (
    <>
      <Panel wide icon={<FileSignature size={17} />} title="What reaches me for signature"
        desc="Thresholds live on Financial config. A decision under them is made by the desk that raised it and never appears here."
        aside={<Chip tone="steel">Read-only</Chip>}>
        <Granted items={[
          { label: 'Refunds from', value: inr(cfg.ceoRefundFrom) },
          { label: 'EMD forfeitures from', value: inr(cfg.ceoForfeitureFrom) },
          { label: 'Catalogue publish from', value: inr(cfg.ceoPublishValueFrom) },
          { label: 'Always, at any value', value: <span className="font-sans">Fee changes · permanent bans · new Super Admins · public content</span> },
        ]} />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => nav('/ceo/approvals')}>
            {pending.length} waiting{value > 0 ? ` · ${inr(value)}` : ''}
          </Button>
          <span className="text-xs text-ink-muted">Other people are blocked until each of these is signed or refused.</span>
        </div>
      </Panel>

      <Panel icon={<Timer size={17} />} title="How I work the queue" flush>
        <div className="px-5 sm:px-6 py-5 border-t border-line">
          <Field label="My turnaround target"
            hint="Anything older shows as overdue to the desk waiting on it, not just to you.">
            <Select className="max-w-48" value={sla} onChange={(e) => setSla(e.target.value)}>
              <option value="4">4 hours</option>
              <option value="24">1 working day</option>
              <option value="48">2 working days</option>
            </Select>
          </Field>
        </div>
        <Row label="Brief me before I sign"
          desc="Opens each request with the money at risk, who raised it, and what happens if it is refused."
          control={<Toggle checked={briefBefore} onChange={setBriefBefore} />} />
        <Row label="Let me sign in batches"
          desc="Off by default. Each signature is a named decision on the record, and batching makes it easy to sign one you had not read."
          control={<Toggle checked={batch} onChange={setBatch} />} />
      </Panel>

      <SaveRow label="Save signature preferences" onSave={save} />
    </>
  )
}

export function CeoDelegationSection() {
  const delegation = useStore((s) => s.ceoDelegation)
  const users = useStore((s) => s.users)
  const nav = useNavigate()
  const delegate = delegation ? users.find((u) => u.id === delegation.toUserId) : null

  return (
    <>
      <Panel wide icon={<Users size={17} />} title="Delegate my approvals"
        desc="One delegate at a time, for a fixed window. The record always names whoever actually decided, so a delegated signature is never mistaken for yours."
        aside={delegation ? <Chip tone="warning">Active</Chip> : <Chip tone="neutral">Nobody delegated</Chip>}>
        {delegation ? (
          <Granted items={[
            { label: 'Delegate', value: <span className="font-sans">{delegate?.name ?? delegation.toUserId}</span> },
            { label: 'Runs until', value: fmtDate(delegation.until), sub: 'Lapses on its own at end of day' },
            { label: 'Set on', value: fmtDate(delegation.setAt) },
            { label: 'Note', value: <span className="font-sans">{delegation.note ?? '—'}</span> },
          ]} />
        ) : (
          <p className="text-[13px] text-ink-muted leading-relaxed">
            Nothing is delegated. Every request in your queue waits for you — or for a Super Admin acting
            in support and recovery, which is itself audited as such.
          </p>
        )}
        <div className="mt-4">
          <Button variant="secondary" size="sm" onClick={() => nav('/ceo/delegate')}>
            {delegation ? 'Change or revoke' : 'Set up a delegation'}
          </Button>
        </div>
      </Panel>
    </>
  )
}

export function CeoReportsSection() {
  const save = useSave('Briefing saved', 'Your next brief would follow this (demo).')
  const [briefTime, setBriefTime] = useState('08:00')
  const [boardPack, setBoardPack] = useState(true)
  const [channel, setChannel] = useState('email')
  const [kpis, setKpis] = useState<string[]>(['Revenue', 'Money at risk', 'Auction realisation'])

  return (
    <>
      <Panel wide icon={<ScrollText size={17} />} title="My daily brief"
        desc="One message, before the desks start. Everything in it links to the screen it came from.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Send at">
            <Input type="time" className="num" value={briefTime} onChange={(e) => setBriefTime(e.target.value)} />
          </Field>
          <Field label="Deliver by">
            <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="both">Both</option>
            </Select>
          </Field>
        </div>
        <div className="mt-5">
          <p className="text-[13px] font-semibold text-ink mb-2.5">What it opens with</p>
          <PillGroup
            options={['Revenue', 'Money at risk', 'Auction realisation', 'Growth', 'What went wrong', 'Awaiting signature']}
            value={kpis} onChange={setKpis} />
        </div>
      </Panel>

      <Panel icon={<FileSpreadsheet size={17} />} title="Board pack"
        desc="A fuller read, weekly, with the month to date beside the same week last year." flush>
        <Row label="Send me the weekly board pack"
          desc="Monday morning, as a PDF, with every figure traceable to a screen."
          control={<Toggle checked={boardPack} onChange={setBoardPack} />} />
      </Panel>

      <SaveRow label="Save briefing" onSave={save} />
    </>
  )
}
