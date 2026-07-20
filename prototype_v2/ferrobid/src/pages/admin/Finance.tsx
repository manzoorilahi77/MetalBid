/* Super Admin — financial configuration. */
import { useState } from 'react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, Input, LockChip, PageHeader, Toggle, cx } from '../../components/ui'
import { useStore, WEEKDAY_LABELS } from '../../store/store'
import { uid } from '../../lib/format'
import type { CompanyBankAccount } from '../../types'

const DEFAULTS = {
  emdPct: '5', emdMin: '10000', emdCap: '500000', emdRelease: '24',
  gst: '18', tcs: '1',
  bidValidity: '7', payWindow: '7', groundRent: '50',
  buyerPremium: '1.0', sellerCommission: '2.5', listingFee: '0',
}

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

const pad2 = (n: number) => String(n).padStart(2, '0')

export default function Finance() {
  const role = useStore((s) => s.role)
  const pushToast = useStore((s) => s.pushToast)
  const companyBankAccounts = useStore((s) => s.companyBankAccounts)
  const setCompanyBankAccounts = useStore((s) => s.setCompanyBankAccounts)
  const withdrawalWindow = useStore((s) => s.withdrawalWindow)
  const setWithdrawalWindow = useStore((s) => s.setWithdrawalWindow)

  const [cfg, setCfg] = useState(DEFAULTS)
  const [tdsNote, setTdsNote] = useState(true)
  const [accounts, setAccounts] = useState<CompanyBankAccount[]>(companyBankAccounts)
  const set = (k: keyof typeof DEFAULTS) => (v: string) => setCfg({ ...cfg, [k]: v })
  const dirty = JSON.stringify(cfg) !== JSON.stringify(DEFAULTS)
  const accountsDirty = JSON.stringify(accounts) !== JSON.stringify(companyBankAccounts)
  const canEdit = role === 'super_admin'

  const groupCls = 'card p-5 divide-y divide-line'
  const h = 'font-bold pb-2'

  const updateAccount = (id: string, patch: Partial<CompanyBankAccount>) =>
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))

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
            <h2 className={h}>Platform fees</h2>
            <Row label="Buyer premium" suffix="%" value={cfg.buyerPremium} onChange={set('buyerPremium')} />
            <Row label="Seller commission" suffix="%" value={cfg.sellerCommission} onChange={set('sellerCommission')} />
            <Row label="Listing fee" suffix="₹/lot" value={cfg.listingFee} onChange={set('listingFee')} />
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
            <span className="text-sm font-semibold text-warning">Unsaved changes</span>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={() => setCfg(DEFAULTS)}>Discard</Button>
              <Button onClick={() => { pushToast({ kind: 'success', title: 'Financial config saved', body: 'Applies to catalogues published from now on.' }); setCfg(DEFAULTS) }}>
                Save configuration
              </Button>
            </div>
          </div>
        </div>
      )}
    </Page>
  )
}
