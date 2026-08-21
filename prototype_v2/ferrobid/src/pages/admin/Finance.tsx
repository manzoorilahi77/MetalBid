/* ---------------------------------------------------------------------------
   Super Admin — financial configuration.

   Every rate and threshold the platform charges or enforces, in one place. This
   page used to hold its own local copy of the numbers and a Save button that
   did nothing; now it reads and writes the store's `financeConfig`, which is
   what the seller's Settlement page, the Finance workspace, every tax
   calculation and every CEO threshold actually consume.

   That is the point of it being one screen: a rate is stated once and shown
   many times. A commission that could be typed in two places would eventually
   mean two different things.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Signature } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, Input, LockChip, PageHeader, Toggle, cx } from '../../components/ui'
import { useStore, WEEKDAY_LABELS, SUB_ADMIN_ROLES } from '../../store/store'
import { inr, relTime, uid } from '../../lib/format'
import type { CompanyBankAccount, FinanceConfig } from '../../types'

/** The store's config as the string-shaped form this page edits. Kept as a
 *  projection rather than a second source of truth — the store is authoritative
 *  and this is only what the inputs hold while they are being typed in. */
const toForm = (c: FinanceConfig) => ({
  emdPct: String(c.emdPct), emdMin: String(c.emdMin), emdCap: String(c.emdCap), emdRelease: String(c.emdReleaseHours),
  gst: String(c.gstPct), tcs: String(c.tcsPct),
  bidValidity: String(c.bidValidityDays), payWindow: String(c.paymentWindowDays), groundRent: String(c.groundRentPerDayPerMt),
  buyerPremium: String(c.buyerPremiumPct), sellerCommission: String(c.sellerCommissionPct), listingFee: String(c.listingFeePerLot),
  ceoForfeiture: String(c.ceoForfeitureFrom), ceoRefund: String(c.ceoRefundFrom),
  ceoPublish: String(c.ceoPublishValueFrom), secondSignature: String(c.withdrawalSecondSignatureFrom),
})

const n = (v: string) => Number(v.replace(/[^\d.]/g, '')) || 0

const fromForm = (f: ReturnType<typeof toForm>): Partial<FinanceConfig> => ({
  emdPct: n(f.emdPct), emdMin: n(f.emdMin), emdCap: n(f.emdCap), emdReleaseHours: n(f.emdRelease),
  gstPct: n(f.gst), tcsPct: n(f.tcs),
  bidValidityDays: n(f.bidValidity), paymentWindowDays: n(f.payWindow), groundRentPerDayPerMt: n(f.groundRent),
  buyerPremiumPct: n(f.buyerPremium), sellerCommissionPct: n(f.sellerCommission), listingFeePerLot: n(f.listingFee),
  ceoForfeitureFrom: n(f.ceoForfeiture), ceoRefundFrom: n(f.ceoRefund),
  ceoPublishValueFrom: n(f.ceoPublish), withdrawalSecondSignatureFrom: n(f.secondSignature),
})

function Row({ label, suffix, value, onChange, hint }: {
  label: string; suffix?: string; value: string; onChange: (v: string) => void; hint?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        {hint && <div className="text-xs text-ink-faint">{hint}</div>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Input className="num w-28 h-9 text-right" inputMode="decimal" value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))} />
        {suffix && <span className="text-xs font-semibold text-ink-faint w-10">{suffix}</span>}
      </div>
    </div>
  )
}

/** The three rates a CEO signature governs, in the words the request will use. */
const FEE_LABELS: [keyof FinanceConfig, string, string][] = [
  ['buyerPremiumPct', 'Buyer premium', '%'],
  ['sellerCommissionPct', 'Seller commission', '%'],
  ['listingFeePerLot', 'Listing fee', '₹/lot'],
]

const pad2 = (n: number) => String(n).padStart(2, '0')

export default function Finance() {
  const role = useStore((s) => s.role)
  const pushToast = useStore((s) => s.pushToast)
  const companyBankAccounts = useStore((s) => s.companyBankAccounts)
  const setCompanyBankAccounts = useStore((s) => s.setCompanyBankAccounts)
  const withdrawalWindow = useStore((s) => s.withdrawalWindow)
  const setWithdrawalWindow = useStore((s) => s.setWithdrawalWindow)
  const financeConfig = useStore((s) => s.financeConfig)
  const setFinanceConfig = useStore((s) => s.setFinanceConfig)
  const requestCeoSignoff = useStore((s) => s.requestCeoSignoff)
  const ceoApprovals = useStore((s) => s.ceoApprovals)

  const saved = toForm(financeConfig)
  const [cfg, setCfg] = useState(saved)
  const [tdsNote, setTdsNote] = useState(true)
  const [accounts, setAccounts] = useState<CompanyBankAccount[]>(companyBankAccounts)
  const set = (k: keyof typeof cfg) => (v: string) => setCfg({ ...cfg, [k]: v })
  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved)
  const accountsDirty = JSON.stringify(accounts) !== JSON.stringify(companyBankAccounts)
  /* This screen runs on the Sub Admin's own menu now — see the roles decision
     in the Content Atlas — with Super Admin holding the identical route as a
     recovery mirror. Both edit; there is no third role that merely reads it. */
  const canEdit = SUB_ADMIN_ROLES.includes(role)

  const groupCls = 'card p-5 divide-y divide-line'
  const h = 'font-bold pb-2'

  const updateAccount = (id: string, patch: Partial<CompanyBankAccount>) =>
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))

  /* What we charge is the one part of this screen the Super Admin cannot simply
     set: a fee change is signed by the CEO before it takes effect. So a save
     splits in two — everything else applies now, and the proposed rates travel
     to the CEO's queue as a request carrying the new numbers. Nothing here
     re-prices a published auction either way. */
  const FEE_FIELDS = ['buyerPremiumPct', 'sellerCommissionPct', 'listingFeePerLot'] as const
  const proposed = fromForm(cfg)
  const feeChange = FEE_FIELDS.reduce<Partial<FinanceConfig>>((acc, k) => {
    if (proposed[k] !== undefined && proposed[k] !== financeConfig[k]) acc[k] = proposed[k]
    return acc
  }, {})
  const hasFeeChange = Object.keys(feeChange).length > 0
  const pendingFeeRequest = ceoApprovals.find(
    (a) => a.kind === 'fee_change' && (a.status === 'pending' || a.status === 'info_requested'),
  )

  const save = () => {
    const rest = { ...proposed }
    for (const k of FEE_FIELDS) delete rest[k]
    setFinanceConfig(rest)

    if (!hasFeeChange) {
      pushToast({
        kind: 'success',
        title: 'Financial configuration saved',
        body: `GST ${cfg.gst}% · TCS ${cfg.tcs}%. Applied everywhere immediately.`,
      })
      return
    }
    const described = FEE_LABELS
      .filter(([k]) => feeChange[k] !== undefined)
      .map(([k, label, unit]) => `${label} ${financeConfig[k]}${unit} → ${feeChange[k]}${unit}`)
      .join(' · ')
    requestCeoSignoff({
      kind: 'fee_change',
      refId: 'financeConfig',
      amount: 0,
      summary: described,
      reason: 'Proposed from Financial configuration. Rates are unchanged until this is signed, and every auction already published keeps the rate it was listed under.',
      payload: feeChange,
    })
    pushToast({
      kind: 'info',
      title: 'Sent to the CEO',
      body: `${described}. Nothing is charged at the new rate until it is signed.`,
    })
  }

  const toggleDay = (d: number) => {
    const days = withdrawalWindow.days.includes(d) ? withdrawalWindow.days.filter((x) => x !== d) : [...withdrawalWindow.days, d].sort((a, b) => a - b)
    setWithdrawalWindow({ ...withdrawalWindow, days })
  }

  return (
    <Page className={cx(dirty && 'pb-24')}>
      <PageHeader title="Financial config" sub="Platform-wide money rules — EMD sizing, taxes, payment windows and fees. Changes apply to newly published catalogues." />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
          <div className={groupCls}>
            <h2 className={h}>EMD</h2>
            <Row label="Default EMD" suffix="% of value" value={cfg.emdPct} onChange={set('emdPct')} hint="pre-bid EMD as % of start rate × qty" />
            <Row label="Minimum EMD" suffix="₹" value={cfg.emdMin} onChange={set('emdMin')} />
            <Row label="EMD cap per lot" suffix="₹" value={cfg.emdCap} onChange={set('emdCap')} />
            <Row label="Auto-release after close" suffix="hours" value={cfg.emdRelease} onChange={set('emdRelease')} hint="for unsuccessful bidders" />
          </div>
          <div className={groupCls}>
            <h2 className={h}>Taxes</h2>
            <Row label="GST on scrap" suffix="%" value={cfg.gst} onChange={set('gst')} />
            <Row label="TCS u/s 206C(1H)" suffix="%" value={cfg.tcs} onChange={set('tcs')} hint="collected with final payment" />
            <div className="flex items-center justify-between py-2.5">
              <div>
                <div className="text-sm font-semibold">Show 194Q TDS note on invoices</div>
                <div className="text-xs text-ink-faint">buyer-side TDS declaration reminder</div>
              </div>
              <Toggle checked={tdsNote} onChange={setTdsNote} />
            </div>
          </div>
          <div className={groupCls}>
            <h2 className={h}>Payments</h2>
            <Row label="Default bid validity" suffix="days" value={cfg.bidValidity} onChange={set('bidValidity')} />
            <Row label="Payment window after award" suffix="days" value={cfg.payWindow} onChange={set('payWindow')} hint="EMD forfeits on breach" />
            <Row label="Ground rent" suffix="₹/day/MT" value={cfg.groundRent} onChange={set('groundRent')} hint="after the lifting window lapses" />
          </div>
          <div className={groupCls}>
            <div className="flex items-center justify-between pb-2">
              <h2 className="font-bold">Platform fees</h2>
              <Chip tone="warning"><Signature size={11} /> CEO approves</Chip>
            </div>
            <Row label="Buyer premium" suffix="%" value={cfg.buyerPremium} onChange={set('buyerPremium')} hint="charged on the material value of every paid delivery order" />
            <Row label="Seller commission" suffix="%" value={cfg.sellerCommission} onChange={set('sellerCommission')} hint="of the seller's upside over their own reserve, on accepted lots" />
            <Row label="Listing fee" suffix="₹/lot" value={cfg.listingFee} onChange={set('listingFee')} />
            {pendingFeeRequest && (
              <div className="card bg-steel-soft/50 border-0 p-3 mt-2 text-xs text-ink">
                <strong>With the CEO for signature.</strong> {pendingFeeRequest.summary} — proposed{' '}
                {relTime(pendingFeeRequest.requestedAt, Date.now())}. Rates stay as they are until it is signed.
              </div>
            )}
            <p className="text-xs text-ink-faint pt-2">
              These are the platform's entire income, and the one part of this screen you cannot simply set: a change is
              sent to the CEO and takes effect when they sign it. They are read live by the seller's{' '}
              <Link to="/seller/settlement" className="text-ember font-semibold hover:underline">Settlement</Link> page and by
              every figure on the{' '}
              <Link to="/finance/pnl" className="text-ember font-semibold hover:underline">profit &amp; loss</Link> —
              change one here and both move together.
            </p>
          </div>

          {/* ------------------------ CEO thresholds ------------------------- */}
          <div className={cx(groupCls, 'sm:col-span-2')}>
            <div className="flex items-center justify-between pb-2">
              <h2 className="font-bold">Decisions that leave the desk</h2>
              {!canEdit && <LockChip label="Editable by Super Admin only" />}
            </div>
            <Row label="EMD forfeiture needs the CEO from" suffix="₹" value={cfg.ceoForfeiture} onChange={set('ceoForfeiture')}
              hint="below this, Finance forfeits with a typed reason and an audit entry" />
            <Row label="Refund needs the CEO from" suffix="₹" value={cfg.ceoRefund} onChange={set('ceoRefund')}
              hint="returning money is the safer direction, so this sits higher than it looks" />
            <Row label="Auction publish needs the CEO from" suffix="₹" value={cfg.ceoPublish} onChange={set('ceoPublish')}
              hint="total reserve value of the catalogue being published" />
            <Row label="Withdrawal needs a second Finance user from" suffix="₹" value={cfg.secondSignature} onChange={set('secondSignature')}
              hint="below this one Finance user may review and release; the audit still names them at each step" />
            <p className="text-xs text-ink-faint pt-2">
              Set these to the business's own risk appetite. Start conservative and raise them once the queue proves
              manageable — they are here rather than in code precisely so they can be tuned without a release.
            </p>
          </div>

          {/* -------------------------- Withdrawal window -------------------------- */}
          <div className={cx(groupCls, 'sm:col-span-2')}>
            <div className="flex items-center justify-between pb-2">
              <h2 className="font-bold">Withdrawal window</h2>
              {!canEdit && <LockChip label="Editable by Super Admin only" />}
            </div>
            <div className="py-3">
              <div className="text-sm font-semibold mb-2">Enabled days</div>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_LABELS.map((label, d) => (
                  <button key={d} type="button" disabled={!canEdit} onClick={() => toggleDay(d)}
                    className={cx('h-8 w-12 rounded-lg text-xs font-bold border transition-colors',
                      withdrawalWindow.days.includes(d) ? 'border-ember bg-ember-soft text-ember-strong' : 'border-line bg-surface text-ink-muted',
                      canEdit ? 'hover:border-line-strong' : 'opacity-70 cursor-not-allowed')}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="py-3 flex items-center gap-4 flex-wrap">
              <div>
                <div className="text-sm font-semibold mb-1.5">Start time (IST)</div>
                <Input type="time" disabled={!canEdit} className="num w-32"
                  value={`${pad2(withdrawalWindow.startHour)}:${pad2(withdrawalWindow.startMinute)}`}
                  onChange={(e) => {
                    const [hh, mm] = e.target.value.split(':').map(Number)
                    if (!Number.isNaN(hh) && !Number.isNaN(mm)) setWithdrawalWindow({ ...withdrawalWindow, startHour: hh, startMinute: mm })
                  }} />
              </div>
              <div>
                <div className="text-sm font-semibold mb-1.5">End time (IST)</div>
                <Input type="time" disabled={!canEdit} className="num w-32"
                  value={`${pad2(withdrawalWindow.endHour)}:${pad2(withdrawalWindow.endMinute)}`}
                  onChange={(e) => {
                    const [hh, mm] = e.target.value.split(':').map(Number)
                    if (!Number.isNaN(hh) && !Number.isNaN(mm)) setWithdrawalWindow({ ...withdrawalWindow, endHour: hh, endMinute: mm })
                  }} />
              </div>
            </div>
            <p className="text-xs text-ink-faint pt-2">Gates the buyer-side Withdrawals tab in real time — sub-admin can see this but not edit it.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold">Company bank accounts</h2>
              {!canEdit && <LockChip label="Editable by Super Admin only" />}
            </div>
            <div className="space-y-3 text-sm">
              {accounts.map((a) => (
                <div key={a.id} className="card bg-surface-2 border-0 p-3.5 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input className="h-8 text-xs" disabled={!canEdit} value={a.bank} placeholder="Bank name"
                      onChange={(e) => updateAccount(a.id, { bank: e.target.value })} />
                    <Input className="h-8 text-xs" disabled={!canEdit} value={a.purpose} placeholder="Purpose"
                      onChange={(e) => updateAccount(a.id, { purpose: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input className="num h-8 text-xs" disabled={!canEdit} value={a.accountNumberMasked} placeholder="Masked account no."
                      onChange={(e) => updateAccount(a.id, { accountNumberMasked: e.target.value })} />
                    <Input className="num h-8 text-xs" disabled={!canEdit} value={a.ifsc} placeholder="IFSC"
                      onChange={(e) => updateAccount(a.id, { ifsc: e.target.value })} />
                  </div>
                  {canEdit && (
                    <button className="text-xs font-semibold text-danger hover:underline" onClick={() => setAccounts((prev) => prev.filter((x) => x.id !== a.id))}>
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            {canEdit && (
              <div className="flex items-center gap-2 mt-3">
                <Button variant="secondary" size="sm"
                  onClick={() => setAccounts((prev) => [...prev, { id: uid('cba'), bank: '', accountNumberMasked: '', ifsc: '', purpose: '' }])}>
                  Add account
                </Button>
                <Button size="sm" disabled={!accountsDirty}
                  onClick={() => { setCompanyBankAccounts(accounts); pushToast({ kind: 'success', title: 'Company bank accounts saved', body: 'Shown to buyers on the Deposits tab.' }) }}>
                  Save accounts
                </Button>
              </div>
            )}
          </div>
          <div className="card p-5">
            <h2 className="font-bold mb-3">Payment gateway</h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between"><span>UPI</span><Chip tone="success" pulse>Operational</Chip></div>
              <div className="flex items-center justify-between"><span>NetBanking</span><Chip tone="success" pulse>Operational</Chip></div>
              <div className="flex items-center justify-between"><span>RTGS/NEFT auto-recon</span><Chip tone="warning">Degraded · 12 min lag</Chip></div>
            </div>
          </div>
        </div>
      </div>

      {dirty && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-warning">Unsaved changes</span>
            <span className="text-xs text-ink-muted hidden sm:block">
              {hasFeeChange
                ? 'Everything but the fees applies immediately. The fee change goes to the CEO and is charged to nobody until it is signed.'
                : 'Saving moves every screen that reads these figures at once, and writes a before-and-after entry to the audit trail.'}
            </span>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={() => setCfg(saved)}>Discard</Button>
              <Button disabled={!canEdit} onClick={save}>
                {feeChange ? 'Save, and send the fees to the CEO' : 'Save configuration'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------- where these are read ---------------------- */}
      <div className="card border-l-4 border-l-steel p-4 mt-6 flex flex-wrap items-center gap-3">
        <div className="text-[13px] text-ink-muted flex-1 min-w-64">
          <strong className="text-ink">One set of numbers, read in many places.</strong> Commission at{' '}
          <span className="num font-bold text-ink">{financeConfig.sellerCommissionPct}%</span>, buyer premium at{' '}
          <span className="num font-bold text-ink">{financeConfig.buyerPremiumPct}%</span>, GST at{' '}
          <span className="num font-bold text-ink">{financeConfig.gstPct}%</span> and TCS at{' '}
          <span className="num font-bold text-ink">{financeConfig.tcsPct}%</span> are charged on every sale; a forfeiture
          above <span className="num font-bold text-ink">{inr(financeConfig.ceoForfeitureFrom)}</span> and a withdrawal above{' '}
          <span className="num font-bold text-ink">{inr(financeConfig.withdrawalSecondSignatureFrom)}</span> both need a
          second person. Nothing recomputes a rate locally.
        </div>
        <Link to="/finance/pnl" className="text-[13px] font-bold text-ember hover:underline inline-flex items-center gap-1 shrink-0">
          See it in the P&amp;L <ArrowRight size={13} />
        </Link>
      </div>
    </Page>
  )
}
