/* Super Admin — financial configuration. */
import { useState } from 'react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, Input, PageHeader, Toggle, cx } from '../../components/ui'
import { useStore } from '../../store/store'

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

export default function Finance() {
  const pushToast = useStore((s) => s.pushToast)
  const [cfg, setCfg] = useState(DEFAULTS)
  const [tdsNote, setTdsNote] = useState(true)
  const set = (k: keyof typeof DEFAULTS) => (v: string) => setCfg({ ...cfg, [k]: v })
  const dirty = JSON.stringify(cfg) !== JSON.stringify(DEFAULTS)

  const groupCls = 'card p-5 divide-y divide-line'
  const h = 'font-bold pb-2'

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
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-bold mb-3">Escrow accounts</h2>
            <div className="space-y-3 text-sm">
              {[
                { bank: 'HDFC Bank', ac: '5020 00•• ••81 234', ifsc: 'HDFC0000060', purpose: 'EMD pool' },
                { bank: 'ICICI Bank', ac: '0004 05•• ••77 910', ifsc: 'ICIC0000004', purpose: 'Settlement' },
              ].map((a) => (
                <div key={a.ifsc} className="card bg-surface-2 border-0 p-3.5">
                  <div className="flex justify-between"><span className="font-semibold">{a.bank}</span><Chip tone="steel">{a.purpose}</Chip></div>
                  <div className="num text-xs text-ink-muted mt-1">{a.ac} · {a.ifsc}</div>
                </div>
              ))}
            </div>
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
