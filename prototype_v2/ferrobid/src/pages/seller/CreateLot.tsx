/* Create Lot — single form + bulk CSV placeholder mode. */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Check, Download, ShieldAlert, UploadCloud } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Button, Chip, Field, Input, PageHeader, Segmented, Select, Textarea, Toggle, cx,
} from '../../components/ui'
import { CATEGORY_META } from '../../components/domain'
import { useStore } from '../../store/store'
import type { MetalCategory, Uom } from '../../types'

const METALS = ['MS', 'SS 304', 'SS 316', 'CI', 'Aluminium', 'Copper', 'Brass', 'Zinc', 'Assets']

const CSV_PREVIEW = [
  { grade: 'HMS 1 Plate Cuttings', metal: 'MS', qty: '42 MT', rate: '₹29,500', emd: '₹65,000' },
  { grade: 'SS 304 Coil Ends', metal: 'SS 304', qty: '6,400 KG', rate: '₹126', emd: '₹40,000' },
  { grade: 'CI Borings (dry)', metal: 'CI', qty: '28 MT', rate: '₹21,800', emd: '₹30,000' },
]

export default function CreateLot() {
  const nav = useNavigate()
  const createLot = useStore((s) => s.createLot)
  const pushToast = useStore((s) => s.pushToast)
  const me = useStore((s) => s.currentUser)

  /* Verification is Operations' decision, so the form says where the account
     stands rather than letting the seller find out on submit. */
  const verified = !!me && (me.sellerVerified || me.kycStatus === 'verified')
  const gate = verified ? null : me?.kycStatus === 'pending'
    ? { tone: 'warning' as const, title: 'Verification in progress', body: 'Our team is checking your firm details. You can submit lots the moment it is approved — we will notify you.' }
    : me?.kycStatus === 'rejected'
      ? { tone: 'danger' as const, title: 'Verification was not approved', body: 'Check the reason on your notifications, resubmit your details, or appeal to the Operation Manager.' }
      : { tone: 'warning' as const, title: 'Seller verification needed', body: 'We verify every seller before their material goes in front of buyers. Submit your firm details to start.' }

  const [mode, setMode] = useState<'single' | 'bulk'>('single')
  const [photos, setPhotos] = useState<boolean[]>([false, false, false, false])
  const [csvLoaded, setCsvLoaded] = useState(false)
  const [f, setF] = useState({
    metal: 'MS', category: 'scrap', grade: '', description: '',
    qty: '', uom: 'MT', yard: '', startRate: '', increment: '100', emdRequired: true, emd: '25000', hazardous: false,
  })
  const set = (k: string, v: string | boolean) => setF({ ...f, [k]: v })
  const valid = f.grade && f.description && Number(f.qty) > 0 && Number(f.startRate) > 0

  const submitSingle = () => {
    const res = createLot({
      metal: f.metal, category: f.category as MetalCategory, grade: f.grade,
      description: f.description, indicativeQty: Number(f.qty), uom: f.uom as Uom,
      yard: f.yard || 'Seller yard', startRate: Number(f.startRate),
      increment: Number(f.increment) || 100, reserveRate: Math.round(Number(f.startRate) * 1.07),
      preBidEmd: f.emdRequired ? Number(f.emd) || 10000 : 0, hazardous: f.hazardous,
    })
    if (!res.ok) {
      pushToast({ kind: 'danger', title: 'Lot not submitted', body: res.error })
      return
    }
    pushToast({ kind: 'success', title: 'Lot submitted for inspection', body: 'Operations will catalogue it and book a yard visit. You will be told at every step.' })
    nav('/seller/lots')
  }

  const importCsv = () => {
    let imported = 0
    let failure: string | undefined
    for (const row of CSV_PREVIEW) {
      const res = createLot({
        metal: row.metal, category: 'scrap', grade: row.grade,
        description: `${row.grade} — imported via bulk CSV`, indicativeQty: parseFloat(row.qty.replace(/[^\d.]/g, '')),
        uom: row.qty.includes('KG') ? 'KG' : 'MT', yard: 'Seller yard',
        startRate: Number(row.rate.replace(/[^\d]/g, '')), preBidEmd: Number(row.emd.replace(/[^\d]/g, '')),
      })
      if (res.ok) imported += 1
      else failure = res.error
    }
    if (imported === 0) {
      pushToast({ kind: 'danger', title: 'Nothing imported', body: failure })
      return
    }
    pushToast({ kind: 'success', title: `${imported} lots imported`, body: 'All queued with Operations for cataloguing and inspection.' })
    nav('/seller/lots')
  }

  return (
    <Page className="max-w-4xl">
      <PageHeader title="Create lot" sub="Declare your material — we physically inspect, measure and catalogue it before auction. Quantity stays indicative until weighment." />

      {gate && (
        <div className={cx('card p-4 mb-5 flex items-start gap-3',
          gate.tone === 'danger' ? 'bg-danger-soft/60 border-danger/25' : 'bg-warning-soft/60 border-warning/25')}>
          <ShieldAlert size={18} className={cx('mt-0.5 shrink-0', gate.tone === 'danger' ? 'text-danger' : 'text-warning')} />
          <div className="text-[13px]">
            <div className="font-semibold text-ink">{gate.title}</div>
            <p className="text-ink-muted mt-0.5">{gate.body}</p>
            {me?.kycStatus !== 'pending' && (
              <Button size="sm" variant="secondary" className="mt-2.5" onClick={() => nav('/buyer/kyc')}>
                Go to seller verification
              </Button>
            )}
          </div>
        </div>
      )}

      <Segmented options={[{ key: 'single', label: 'Single lot' }, { key: 'bulk', label: 'Bulk upload (CSV + photos)' }]} value={mode} onChange={setMode} />

      {mode === 'single' && (
        <div className="card p-6 mt-5 space-y-5">
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Metal">
              <Select value={f.metal} onChange={(e) => set('metal', e.target.value)}>{METALS.map((m) => <option key={m}>{m}</option>)}</Select>
            </Field>
            <Field label="Category">
              <Select value={f.category} onChange={(e) => set('category', e.target.value)}>
                {CATEGORY_META.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </Select>
            </Field>
            <Field label="Grade / name">
              <Input placeholder="e.g. HMS 1 Plate Cuttings" value={f.grade} onChange={(e) => set('grade', e.target.value)} />
            </Field>
          </div>
          <Field label="Description" hint="Condition, sizes, storage, loading notes — buyers see this verbatim.">
            <Textarea placeholder="Heavy melting scrap — plate cuttings and structural offcuts…" value={f.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label="Indicative qty"><Input inputMode="decimal" className="num" value={f.qty} onChange={(e) => set('qty', e.target.value.replace(/[^\d.]/g, ''))} /></Field>
            <Field label="UOM">
              <Select value={f.uom} onChange={(e) => set('uom', e.target.value)}>
                <option>MT</option><option>KG</option><option>PCS</option><option>LOT</option>
              </Select>
            </Field>
            <Field label={`Start rate (₹/${f.uom})`}><Input inputMode="numeric" className="num" value={f.startRate} onChange={(e) => set('startRate', e.target.value.replace(/[^\d]/g, ''))} /></Field>
            <Field label="Suggested increment (₹)"><Input inputMode="numeric" className="num" value={f.increment} onChange={(e) => set('increment', e.target.value.replace(/[^\d]/g, ''))} /></Field>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 items-end">
            <Field label="Pre-bid EMD required?">
              <Segmented options={[{ key: 'yes', label: 'Yes' }, { key: 'no', label: 'No' }]}
                value={f.emdRequired ? 'yes' : 'no'} onChange={(v) => set('emdRequired', v === 'yes')} />
            </Field>
            {f.emdRequired && (
              <Field label="Pre-bid EMD (₹)" hint="Typically ~5% of lot value.">
                <Input inputMode="numeric" className="num" value={f.emd} onChange={(e) => set('emd', e.target.value.replace(/[^\d]/g, ''))} />
              </Field>
            )}
            <Field label="Yard / location"><Input placeholder="Yard name, city" value={f.yard} onChange={(e) => set('yard', e.target.value)} /></Field>
          </div>
          <Toggle checked={f.hazardous} onChange={(v) => set('hazardous', v)} label="Hazardous / regulated material" />
          <div>
            <span className="block text-[13px] font-semibold mb-2">Photos <span className="text-ink-faint font-normal">(our inspector re-shoots officially)</span></span>
            <div className="grid grid-cols-4 gap-2 max-w-md">
              {photos.map((p, i) => (
                <button key={i} onClick={() => setPhotos(photos.map((x, j) => (j === i ? true : x)))}
                  className={cx('aspect-square rounded-xl border-2 border-dashed grid place-items-center transition-colors',
                    p ? 'border-success bg-success-soft text-success' : 'border-line-strong text-ink-faint hover:border-ember/50 hover:text-ember')}>
                  {p ? <Check size={20} /> : <Camera size={20} />}
                </button>
              ))}
            </div>
          </div>
          <div className="pt-2 border-t border-line flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-ink-faint max-w-sm">Submitting sends the lot to the ferroBid inspection queue. You'll be notified when it's verified and catalogued.</p>
            <Button size="lg" disabled={!valid || !verified} onClick={submitSingle}>Submit for inspection</Button>
          </div>
        </div>
      )}

      {mode === 'bulk' && (
        <div className="card p-6 mt-5 space-y-5">
          {!csvLoaded ? (
            <button onClick={() => setCsvLoaded(true)}
              className="w-full h-44 rounded-2xl border-2 border-dashed border-line-strong hover:border-ember/60 grid place-items-center text-ink-faint hover:text-ember transition-colors">
              <span className="flex flex-col items-center gap-2">
                <UploadCloud size={32} />
                <span className="font-semibold text-sm">Drop your lots CSV here, or click to browse</span>
                <span className="text-xs">Photos can be zipped alongside (demo — click simulates upload)</span>
              </span>
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Chip tone="success"><Check size={12} /> lots_july.csv parsed</Chip>
                <Chip tone="success" className="num">12 rows valid</Chip>
                <Chip tone="neutral" className="num">showing first 3</Chip>
              </div>
              <div className="overflow-x-auto card border-line">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-line">
                      <th className="px-4 py-2.5">Grade</th><th className="px-4 py-2.5">Metal</th>
                      <th className="px-4 py-2.5 text-right">Qty</th><th className="px-4 py-2.5 text-right">Start rate</th><th className="px-4 py-2.5 text-right">EMD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {CSV_PREVIEW.map((r, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 font-semibold">{r.grade}</td>
                        <td className="px-4 py-2.5">{r.metal}</td>
                        <td className="px-4 py-2.5 num text-right">{r.qty}</td>
                        <td className="px-4 py-2.5 num text-right">{r.rate}</td>
                        <td className="px-4 py-2.5 num text-right">{r.emd}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button size="lg" disabled={!verified} onClick={importCsv}>Import lots</Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => useStore.getState().pushToast({ kind: 'info', title: 'Template downloading', body: 'ferrobid_lots_template.csv (demo)' })}>
            <Download size={14} /> Download CSV template
          </Button>
        </div>
      )}
    </Page>
  )
}
