/* Executive Manager — §8 catalogue builder: a 4-step full-width wizard that
   assembles approved lots into a published auction catalogue. */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUp, ArrowDown, X, FileText, Paperclip, CheckCircle2 } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  PageHeader, Tabs, Button, Chip, Field, Input, Select, EmptyState, PhotoThumb, cx,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, inrCompact, num, uid, fmtDateTime, fmtDate } from '../../lib/format'
import type { Catalogue, CatalogueDocument, Lot, Uom } from '../../types'

type Step = 's1' | 's2' | 's3' | 's4'
const STEPS: Step[] = ['s1', 's2', 's3', 's4']

const pad2 = (n: number) => String(n).padStart(2, '0')
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
const toLocalDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

const YARD_REGION: Record<string, string> = {
  'Burma Mines Yard': 'Jamshedpur, JH',
  'VJNR Yard B': 'Vijayanagar, KA',
  'BSP Scrap Yard 3': 'Bhilai, CG',
  'Mancheswar Depot': 'Bhubaneswar, OD',
  'MSTC Paradip Yard': 'Paradip, OD',
  'RSTPS Ash Yard': 'Ramagundam, TS',
}

const ATTACH_TILES = [
  { name: 'Annexure — lot schedule.xlsx', type: 'xlsx' as const, size: '96 KB' },
  { name: 'Yard access map.pdf', type: 'pdf' as const, size: '1.1 MB' },
  { name: 'Material photographs.zip', type: 'zip' as const, size: '18 MB' },
]

export default function CatalogueBuilder() {
  const navigate = useNavigate()
  const lots = useStore((s) => s.lots)
  const users = useStore((s) => s.users)
  const catalogues = useStore((s) => s.catalogues)
  const termsSets = useStore((s) => s.termsSets)
  const publishCatalogue = useStore((s) => s.publishCatalogue)
  const waiveInspection = useStore((s) => s.waiveInspection)
  const me = useStore((s) => s.currentUser)
  const pushToast = useStore((s) => s.pushToast)

  const sellers = users.filter((u) => u.role === 'seller')

  /* ------------------------------ wizard state ----------------------------- */
  const [step, setStep] = useState<Step>('s1')

  // step 1 — selection
  const [sellerFilter, setSellerFilter] = useState('')
  const [metalFilter, setMetalFilter] = useState('')
  const [yardFilter, setYardFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [overrides, setOverrides] = useState<Record<string, Partial<Lot>>>({})
  const [bulkInc, setBulkInc] = useState('')
  const [bulkEmdPct, setBulkEmdPct] = useState('')
  const [bulkUom, setBulkUom] = useState<Uom | ''>('')

  // step 2 — details
  const tomorrow2pm = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(14, 0, 0, 0); return d }, [])
  const tomorrow5pm = useMemo(() => { const d = new Date(tomorrow2pm); d.setHours(17, 0, 0, 0); return d }, [tomorrow2pm])
  const [title, setTitle] = useState('')
  const [startLocal, setStartLocal] = useState(toLocalInput(tomorrow2pm))
  const [endLocal, setEndLocal] = useState(toLocalInput(tomorrow5pm))
  const [inspFrom, setInspFrom] = useState(toLocalDate(new Date()))
  const [inspTo, setInspTo] = useState(toLocalDate(tomorrow2pm))
  const [inspHours, setInspHours] = useState('10:00–16:00 IST')
  const [contactName, setContactName] = useState('R. Venkatesan')
  const [contactPhone, setContactPhone] = useState('+91 94430 18276')
  const [antiSnipe, setAntiSnipe] = useState('5')
  const [validityDays, setValidityDays] = useState('7')
  const [termsSetId, setTermsSetId] = useState(termsSets[0]?.id ?? 'ts-standard')

  // step 3 — documents
  const [attached, setAttached] = useState<CatalogueDocument[]>([])

  // step 4 — yard details (editable)
  const [yardName, setYardName] = useState('')
  const [yardAddress, setYardAddress] = useState('')
  const [region, setRegion] = useState('')

  /* ------------------------------ derived data ----------------------------- */
  // sourced from pending_inspection (cataloguing now happens before inspection);
  // a waived lot flips to 'approved' but must stay visible here until it's
  // actually placed into a catalogue.
  const pool = lots.filter((l) => !l.catalogueId && (l.status === 'pending_inspection' || (l.inspectionWaived && l.status === 'approved')))
  const filtered = pool.filter((l) =>
    (!metalFilter || `${l.metal} ${l.grade}`.toLowerCase().includes(metalFilter.toLowerCase())) &&
    (!yardFilter || l.yard.toLowerCase().includes(yardFilter.toLowerCase())),
  )
  const selected = selectedIds.map((id) => lots.find((l) => l.id === id)).filter((l): l is Lot => !!l)
  const firstLot = selected[0]
  const code = `AUC-${2430 + catalogues.length}`
  const effective = (l: Lot) => ({ ...l, ...overrides[l.id] })

  const step1Done = selectedIds.length > 0
  const step2Done = step1Done && title.trim().length > 0 && !!startLocal && !!endLocal
  const canGo = (s: Step) => s === 's1' || (s === 's2' ? step1Done : step2Done)
  const gotoStep = (s: Step) => {
    if (canGo(s)) setStep(s)
    else pushToast({ kind: 'warning', title: 'Complete the current step first', body: s === 's2' ? 'Select at least one lot to continue.' : 'A title and schedule are required before moving on.' })
  }

  /* -------------------------------- actions -------------------------------- */
  const toggleLot = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const move = (idx: number, dir: -1 | 1) =>
    setSelectedIds((prev) => {
      const next = [...prev]
      const j = idx + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })

  const applyBulk = () => {
    const inc = Number(bulkInc)
    const pct = Number(bulkEmdPct)
    setOverrides((prev) => {
      const next = { ...prev }
      for (const l of selected) {
        const o: Partial<Lot> = { ...next[l.id] }
        if (bulkInc && inc > 0) o.increment = inc
        if (bulkEmdPct && pct > 0) o.preBidEmd = Math.round((pct / 100) * l.startRate * l.indicativeQty)
        if (bulkUom) o.uom = bulkUom
        next[l.id] = o
      }
      return next
    })
    pushToast({ kind: 'success', title: 'Bulk settings applied', body: `Updated ${selected.length} selected lot${selected.length > 1 ? 's' : ''}.` })
  }

  const attach = (t: (typeof ATTACH_TILES)[number]) => {
    setAttached((prev) => [...prev, { id: uid('doc'), name: t.name, type: t.type, size: t.size }])
    pushToast({ kind: 'info', title: 'File attached', body: t.name })
  }

  const publish = (mode: 'now' | 'schedule') => {
    if (!firstLot) return
    const nowMs = Date.now()
    let endsAt = new Date(endLocal).getTime()
    if (mode === 'now' && endsAt <= nowMs) endsAt = nowMs + 3 * 3600_000
    const yard = yardName || firstLot.yard
    const cat: Catalogue = {
      id: uid('cat'),
      code,
      title: title.trim(),
      sellerId: sellerFilter || 'u-seller-1',
      type: 'forward',
      status: mode === 'now' ? 'live' : 'upcoming',
      assignedFieldExecId: null,
      startsAt: new Date(mode === 'now' ? nowMs : new Date(startLocal).getTime()).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      inspectionFrom: new Date(`${inspFrom}T10:00`).toISOString(),
      inspectionTo: new Date(`${inspTo}T16:00`).toISOString(),
      inspectionHours: inspHours,
      inspectionContact: { name: contactName, phone: contactPhone, role: 'Yard In-charge' },
      yardName: yard,
      yardAddress: yardAddress || `${yard}, Gate 2, weighbridge lane`,
      region: region || YARD_REGION[firstLot.yard] || 'Jamshedpur, JH',
      antiSnipeMinutes: Number(antiSnipe),
      bidValidityDays: Number(validityDays) || 7,
      lotIds: selectedIds,
      documents: [
        { id: uid('doc'), name: `${code} — Catalogue.pdf`, type: 'pdf', size: '2.4 MB' },
        ...attached,
      ],
      termsSetId,
      description: `${selected.length} lot${selected.length > 1 ? 's' : ''} of ${[...new Set(selected.map((l) => l.metal))].join(', ')} offered as-is-where-is from ${yard}. E-auction on ferroBid; quantity indicative — final on weighment.`,
    }
    publishCatalogue(cat, selectedIds, overrides)
    pushToast({
      kind: 'success',
      title: mode === 'now' ? `${code} is live` : `${code} scheduled`,
      body: mode === 'now'
        ? `${selected.length} lots are open for bidding until ${fmtDateTime(cat.endsAt)}.`
        : `Goes live ${fmtDateTime(cat.startsAt)} with ${selected.length} lots.`,
    })
    navigate(`/catalogue/${cat.id}`)
  }

  /* -------------------------------- render --------------------------------- */
  return (
    <Page>
      <PageHeader
        title="Catalogue builder"
        sub="Bundle approved lots into an auction catalogue — sequence, schedule, documents, publish."
        actions={<Chip tone="steel">Draft <span className="num">{code}</span></Chip>}
      />

      <Tabs<Step>
        tabs={[
          { key: 's1', label: '1 · Select lots', count: selectedIds.length },
          { key: 's2', label: '2 · Details' },
          { key: 's3', label: '3 · Documents', count: attached.length + 1 },
          { key: 's4', label: '4 · Preview & publish' },
        ]}
        value={step}
        onChange={gotoStep}
        className="mb-6"
      />

      {/* ------------------------------ STEP 1 ------------------------------ */}
      {step === 's1' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <div className="space-y-4">
            <div className="card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Seller">
                <Select value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)}>
                  <option value="">All sellers</option>
                  {sellers.map((s) => <option key={s.id} value={s.id}>{s.firm}</option>)}
                </Select>
              </Field>
              <Field label="Metal / grade">
                <Input placeholder="e.g. Copper, FeMn…" value={metalFilter} onChange={(e) => setMetalFilter(e.target.value)} />
              </Field>
              <Field label="Yard">
                <Input placeholder="e.g. VJNR Yard B" value={yardFilter} onChange={(e) => setYardFilter(e.target.value)} />
              </Field>
            </div>

            {filtered.length === 0 ? (
              <EmptyState title="No submitted lots match" body="Wait for sellers to submit lots for inspection, or loosen the filters above." />
            ) : (
              <div className="card divide-y divide-line overflow-hidden">
                {filtered.map((l) => {
                  const on = selectedIds.includes(l.id)
                  return (
                    <label key={l.id} className={cx('flex items-center gap-3 p-3.5 cursor-pointer transition-colors', on ? 'bg-ember-soft/40' : 'hover:bg-surface-2')}>
                      <input type="checkbox" checked={on} onChange={() => toggleLot(l.id)} className="size-4 accent-[var(--color-ember,#c2410c)]" />
                      <PhotoThumb hue={l.photos[0]?.hue ?? 24} category={l.category} className="w-14 h-11" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{l.grade} · {l.metal}</div>
                        <div className="text-xs text-ink-muted truncate">
                          <span className="num">{num(l.indicativeQty)} {l.uom}</span> · {l.yard} · start <span className="num">{inr(l.startRate)}/{l.uom}</span>
                        </div>
                      </div>
                      {l.knownSeller && (
                        l.inspectionWaived ? (
                          <Chip tone="success">Waived</Chip>
                        ) : (
                          <Button
                            type="button" size="sm" variant="secondary"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              waiveInspection(l.id, me?.id ?? 'u-exec-1', 'Known seller — trusted, skipping field inspection')
                              pushToast({ kind: 'success', title: `${l.lotNo} waived`, body: 'Approved without field inspection — known seller.' })
                            }}
                          >
                            Waive — known seller
                          </Button>
                        )
                      )}
                      <span className="num text-xs text-ink-faint shrink-0">{l.lotNo}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* selected panel (content grid column — not a nav sidebar) */}
          <div className="space-y-4">
            <div className="card p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint mb-3">
                Selected lots <span className="num">({selectedIds.length})</span>
              </div>
              {selected.length === 0 && <div className="text-sm text-ink-faint">Tick lots on the left to build the running order.</div>}
              <div className="space-y-2">
                {selected.map((l, i) => (
                  <div key={l.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 p-2">
                    <span className="num text-xs font-bold text-ember-strong bg-ember-soft rounded-md px-1.5 py-0.5 shrink-0">
                      LOT-{String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1 min-w-0 text-xs font-semibold truncate">{l.grade}</div>
                    <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"
                      className="p-1 rounded-md text-ink-muted hover:bg-surface disabled:opacity-30"><ArrowUp size={13} /></button>
                    <button onClick={() => move(i, 1)} disabled={i === selected.length - 1} aria-label="Move down"
                      className="p-1 rounded-md text-ink-muted hover:bg-surface disabled:opacity-30"><ArrowDown size={13} /></button>
                    <button onClick={() => toggleLot(l.id)} aria-label="Remove"
                      className="p-1 rounded-md text-ink-faint hover:text-danger hover:bg-surface"><X size={13} /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Bulk-set for selected</div>
              <Field label="Increment (₹)"><Input type="number" placeholder="e.g. 200" value={bulkInc} onChange={(e) => setBulkInc(e.target.value)} /></Field>
              <Field label="EMD (% of start value)" hint="Computed per lot on start rate × quantity">
                <Input type="number" placeholder="e.g. 2" value={bulkEmdPct} onChange={(e) => setBulkEmdPct(e.target.value)} />
              </Field>
              <Field label="Unit of measure">
                <Select value={bulkUom} onChange={(e) => setBulkUom(e.target.value as Uom | '')}>
                  <option value="">Keep as-is</option>
                  <option value="MT">MT</option><option value="KG">KG</option><option value="PCS">PCS</option><option value="LOT">LOT</option>
                </Select>
              </Field>
              <div className="flex items-center justify-between">
                <Chip tone="neutral">Sale basis: as-is-where-is</Chip>
                <Button size="sm" variant="secondary" onClick={applyBulk} disabled={selected.length === 0}>Apply</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------ STEP 2 ------------------------------ */}
      {step === 's2' && (
        <div className="card p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Field label="Catalogue title" className="md:col-span-2 xl:col-span-2">
            <Input placeholder="e.g. Mixed non-ferrous & slag disposal — July window" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Auction type">
            <Select defaultValue="forward"><option value="forward">Forward (English, on rate)</option></Select>
          </Field>
          <Field label="Auction starts">
            <Input type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
          </Field>
          <Field label="Auction ends">
            <Input type="datetime-local" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
          </Field>
          <Field label="Anti-snipe window">
            <Select value={antiSnipe} onChange={(e) => setAntiSnipe(e.target.value)}>
              <option value="3">3 minutes</option><option value="5">5 minutes</option><option value="10">10 minutes</option>
            </Select>
          </Field>
          <Field label="Inspection from">
            <Input type="date" value={inspFrom} onChange={(e) => setInspFrom(e.target.value)} />
          </Field>
          <Field label="Inspection to">
            <Input type="date" value={inspTo} onChange={(e) => setInspTo(e.target.value)} />
          </Field>
          <Field label="Visiting hours">
            <Input value={inspHours} onChange={(e) => setInspHours(e.target.value)} />
          </Field>
          <Field label="Yard contact name">
            <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </Field>
          <Field label="Yard contact phone">
            <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </Field>
          <Field label="Bid validity (days)" hint="H1 offers remain binding for this many days after close">
            <Input type="number" value={validityDays} onChange={(e) => setValidityDays(e.target.value)} />
          </Field>
          <Field label="Terms & conditions set">
            <Select value={termsSetId} onChange={(e) => setTermsSetId(e.target.value)}>
              {termsSets.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.version})</option>)}
            </Select>
          </Field>
        </div>
      )}

      {/* ------------------------------ STEP 3 ------------------------------ */}
      {step === 's3' && (
        <div className="space-y-4">
          <div className="card p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint mb-3">Attachments</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl border border-success/30 bg-success-soft p-3.5 flex items-center gap-2.5">
                <FileText size={18} className="text-success shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{code} — Catalogue.pdf</div>
                  <div className="text-xs text-success">Auto-generated · attached</div>
                </div>
              </div>
              {ATTACH_TILES.map((t) => {
                const done = attached.some((d) => d.name === t.name)
                return done ? (
                  <div key={t.name} className="rounded-xl border border-line bg-surface p-3.5 flex items-center gap-2.5">
                    <CheckCircle2 size={18} className="text-success shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{t.name}</div>
                      <div className="text-xs text-ink-faint">{t.size} · attached</div>
                    </div>
                  </div>
                ) : (
                  <button key={t.name} onClick={() => attach(t)}
                    className="rounded-xl border-2 border-dashed border-line-strong p-3.5 flex items-center gap-2.5 text-left hover:border-ember hover:bg-surface-2 transition-colors">
                    <Paperclip size={18} className="text-ink-faint shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-ink-muted truncate">Attach file</div>
                      <div className="text-xs text-ink-faint truncate">{t.name}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="card bg-surface p-6">
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <div className="font-display text-lg font-bold">Annexure A — Schedule of lots</div>
                <div className="text-xs text-ink-faint">Auto-generated from the selected lots · {code}</div>
              </div>
              <Chip tone="neutral">Preview</Chip>
            </div>
            {selected.length === 0 ? (
              <EmptyState title="No lots selected yet" body="Go back to step 1 and pick lots — the annexure builds itself." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-ink-faint border-b border-line-strong">
                      <th className="py-2 pr-3 font-semibold">Lot no</th>
                      <th className="py-2 pr-3 font-semibold">Description</th>
                      <th className="py-2 pr-3 font-semibold text-right">Qty</th>
                      <th className="py-2 pr-3 font-semibold text-right">Start rate</th>
                      <th className="py-2 pr-3 font-semibold text-right">Increment</th>
                      <th className="py-2 font-semibold text-right">Pre-bid EMD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.map((l, i) => {
                      const e = effective(l)
                      return (
                        <tr key={l.id} className="border-b border-line last:border-0">
                          <td className="py-2.5 pr-3 num font-semibold">LOT-{String(i + 1).padStart(2, '0')}</td>
                          <td className="py-2.5 pr-3">{l.grade} · {l.metal} <span className="text-ink-faint">— {l.yard}</span></td>
                          <td className="py-2.5 pr-3 num text-right">{num(l.indicativeQty)} {e.uom}</td>
                          <td className="py-2.5 pr-3 num text-right">{inr(l.startRate)}/{e.uom}</td>
                          <td className="py-2.5 pr-3 num text-right">{inr(e.increment ?? l.increment)}</td>
                          <td className="py-2.5 num text-right">{inr(e.preBidEmd ?? l.preBidEmd)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------ STEP 4 ------------------------------ */}
      {step === 's4' && (
        <div className="space-y-4">
          <div className="card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Yard name"><Input value={yardName} placeholder={firstLot?.yard ?? 'Yard'} onChange={(e) => setYardName(e.target.value)} /></Field>
            <Field label="Yard address"><Input value={yardAddress} placeholder={`${firstLot?.yard ?? 'Yard'}, Gate 2, weighbridge lane`} onChange={(e) => setYardAddress(e.target.value)} /></Field>
            <Field label="Region"><Input value={region} placeholder={firstLot ? (YARD_REGION[firstLot.yard] ?? 'Region, ST') : 'Region, ST'} onChange={(e) => setRegion(e.target.value)} /></Field>
          </div>

          {/* buyer-view preview */}
          <div className="card overflow-hidden">
            <div className="px-5 py-2.5 bg-surface-2 border-b border-line text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Viewing as buyer — auction detail preview
            </div>
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="steel"><span className="num">{code}</span></Chip>
                <Chip tone="ember" pulse>Forward e-auction</Chip>
                <Chip tone="neutral">As-is-where-is</Chip>
              </div>
              <h2 className="font-display text-2xl font-bold mt-2">{title.trim() || 'Untitled catalogue'}</h2>
              <div className="text-sm text-ink-muted mt-1">
                {yardName || firstLot?.yard} · {region || (firstLot ? YARD_REGION[firstLot.yard] : '') || '—'}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <div className="card bg-surface-2 p-3">
                  <div className="text-xs text-ink-faint">Bidding window</div>
                  <div className="num text-sm font-semibold mt-0.5">{fmtDateTime(new Date(startLocal).toISOString())} → {fmtDateTime(new Date(endLocal).toISOString())}</div>
                </div>
                <div className="card bg-surface-2 p-3">
                  <div className="text-xs text-ink-faint">Inspection window</div>
                  <div className="num text-sm font-semibold mt-0.5">{fmtDate(new Date(`${inspFrom}T10:00`).toISOString())} – {fmtDate(new Date(`${inspTo}T16:00`).toISOString())}</div>
                  <div className="text-xs text-ink-faint mt-0.5">{inspHours}</div>
                </div>
                <div className="card bg-surface-2 p-3">
                  <div className="text-xs text-ink-faint">Lots · total EMD</div>
                  <div className="num text-sm font-semibold mt-0.5">{selected.length} · {inrCompact(selected.reduce((s, l) => s + (effective(l).preBidEmd ?? l.preBidEmd), 0))}</div>
                </div>
                <div className="card bg-surface-2 p-3">
                  <div className="text-xs text-ink-faint">Anti-snipe · validity</div>
                  <div className="num text-sm font-semibold mt-0.5">{antiSnipe} min · {validityDays} days</div>
                </div>
              </div>

              <div className="mt-4 divide-y divide-line border border-line rounded-xl overflow-hidden">
                {selected.map((l, i) => {
                  const e = effective(l)
                  return (
                    <div key={l.id} className="flex items-center gap-3 p-3 bg-surface">
                      <PhotoThumb hue={l.photos[0]?.hue ?? 24} category={l.category} className="w-14 h-11" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">
                          <span className="num text-ember-strong mr-1.5">LOT-{String(i + 1).padStart(2, '0')}</span>{l.grade} · {l.metal}
                        </div>
                        <div className="text-xs text-ink-muted"><span className="num">{num(l.indicativeQty)} {e.uom}</span> indicative — final on weighment</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="num text-sm font-bold">{inr(l.startRate)}<span className="text-ink-faint font-normal">/{e.uom}</span></div>
                        <div className="num text-xs text-ink-faint">EMD {inrCompact(e.preBidEmd ?? l.preBidEmd)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-ink-muted">
              Publishing notifies all registered buyers and locks lot numbering <span className="num">LOT-01…LOT-{String(selected.length).padStart(2, '0')}</span>.
            </div>
            <div className="flex gap-2">
              <Button variant="steel" onClick={() => publish('schedule')} disabled={!step2Done}>Schedule for start time</Button>
              <Button onClick={() => publish('now')} disabled={!step2Done}>Publish now</Button>
            </div>
          </div>
        </div>
      )}

      {/* wizard nav */}
      <div className="flex items-center justify-between mt-6">
        <Button variant="ghost" disabled={step === 's1'} onClick={() => setStep(STEPS[STEPS.indexOf(step) - 1])}>← Back</Button>
        {step !== 's4' && (
          <Button variant="secondary" onClick={() => gotoStep(STEPS[STEPS.indexOf(step) + 1])}>Next →</Button>
        )}
      </div>
    </Page>
  )
}
