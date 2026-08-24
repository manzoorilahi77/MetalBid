/* ---------------------------------------------------------------------------
   Operation Manager — catalogue builder: a 4-step wizard that assembles
   submitted lots into a catalogue and routes it for inspection.

   Two rules from the role architecture shape this screen:

   · **Nothing built here is public.** A catalogue leaves this wizard as a
     private draft. It becomes an auction on Auction schedule, when somebody
     presses Publish — there is deliberately no publish button in the builder.
   · **A bulk override changes the seller's own terms.** Setting an increment,
     an EMD or a unit across every selected lot at once is fast and is exactly
     the sort of edit that goes unnoticed, so the original value is kept beside
     the new one on the lot, the change is audited, and the seller is told.

   Terms are edited per lot: clicking a lot opens its own increment / EMD / unit,
   prefilled with what currently applies to it. Opening a second lot saves the
   first — the panel is a per-lot editor, not one setting shared by the batch.
   The bulk form is still there as the batch shortcut when no lot is open.
--------------------------------------------------------------------------- */
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowUp, ArrowDown, EyeOff, X, FileText, Paperclip, CheckCircle2 } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  PageHeader, Tabs, Button, Chip, Field, Input, Select, EmptyState, PhotoThumb, cx,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { defaultEmdDeadline } from '../../lib/emd'
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

/** One lot's terms as they sit in the editor. `init` is what was loaded, so a
 *  field the user never touched is left exactly as it was rather than being
 *  re-derived — an EMD of 5.03% must not drift the rupee figure by a rounding
 *  step just because its lot was opened. */
type TermsDraft = { inc: string; emdPct: string; uom: Uom | ''; init: { inc: string; emdPct: string; uom: Uom | '' } }
const EMPTY_DRAFT: TermsDraft = { inc: '', emdPct: '', uom: '', init: { inc: '', emdPct: '', uom: '' } }

const startValue = (l: Lot) => l.startRate * l.indicativeQty
/** EMD is entered as a percentage but stored in rupees, so read it back out. */
const emdPctOf = (l: Lot, emd: number) => {
  const base = startValue(l)
  return base ? String(Math.round((emd / base) * 10000) / 100) : ''
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
  const pushToast = useStore((s) => s.pushToast)

  const sellers = users.filter((u) => u.role === 'seller')
  const fieldExecs = users.filter((u) => u.role === 'field_exec')

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
  // the lot whose terms are open in the side panel, and its unsaved draft
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState<TermsDraft>(EMPTY_DRAFT)

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
  const [auctionType, setAuctionType] = useState<Catalogue['type']>('forward')
  const [antiSnipe, setAntiSnipe] = useState('5')
  const [validityDays, setValidityDays] = useState('7')
  const [termsSetId, setTermsSetId] = useState(termsSets[0]?.id ?? 'ts-standard')

  // step 3 — documents
  const [attached, setAttached] = useState<CatalogueDocument[]>([])

  // step 4 — yard details (editable) + assignment
  const [yardName, setYardName] = useState('')
  const [yardAddress, setYardAddress] = useState('')
  const [region, setRegion] = useState('')
  const [fieldExecId, setFieldExecId] = useState('')

  /* ------------------------------ derived data ----------------------------- */
  // sourced from pending_inspection (cataloguing now happens before inspection);
  // a waived lot flips to 'approved' but must stay visible here until it's
  // actually placed into a catalogue.
  const pool = lots.filter((l) => !l.catalogueId && (l.status === 'pending_inspection' || (l.inspectionWaived && l.status === 'approved')))
  // A catalogue is sold on behalf of one seller, so picking a seller here is a
  // narrowing of the pool, not a highlight — nobody else's material is shown.
  const filtered = pool.filter((l) =>
    (!sellerFilter || l.sellerId === sellerFilter) &&
    (!metalFilter || `${l.metal} ${l.grade}`.toLowerCase().includes(metalFilter.toLowerCase())) &&
    (!yardFilter || l.yard.toLowerCase().includes(yardFilter.toLowerCase())),
  )
  const selected = selectedIds.map((id) => lots.find((l) => l.id === id)).filter((l): l is Lot => !!l)
  const firstLot = selected[0]
  const code = `AUC-${2430 + catalogues.length}`
  const effective = (l: Lot) => ({ ...l, ...overrides[l.id] })
  const firmOf = (sellerId: string) => users.find((u) => u.id === sellerId)?.firm ?? 'Unknown seller'
  /** How many of this lot's own terms this build has changed. */
  const diffCount = (l: Lot) => {
    const o = overrides[l.id]
    if (!o) return 0
    return (o.increment != null && o.increment !== l.increment ? 1 : 0)
      + (o.preBidEmd != null && o.preBidEmd !== l.preBidEmd ? 1 : 0)
      + (o.uom && o.uom !== l.uom ? 1 : 0)
  }

  const activeLot = activeId ? lots.find((l) => l.id === activeId) ?? null : null
  const activePos = activeId ? selectedIds.indexOf(activeId) : -1
  // A catalogue carries a single sellerId — the seller who is told about every
  // override and notified through the sale — so a mixed selection has no owner.
  const sellerIdsSelected = [...new Set(selected.map((l) => l.sellerId))]
  const mixedSellers = sellerIdsSelected.length > 1

  const step1Done = selectedIds.length > 0
  const step2Done = step1Done && title.trim().length > 0 && !!startLocal && !!endLocal
  const canGo = (s: Step) => s === 's1' || (s === 's2' ? step1Done : step2Done)
  const gotoStep = (s: Step) => {
    // leaving step 1 banks whatever is open, so the annexure and the preview
    // are never built from a half-typed panel
    if (activeId) commit(activeId, draft)
    if (canGo(s)) setStep(s)
    else pushToast({ kind: 'warning', title: 'Complete the current step first', body: s === 's2' ? 'Select at least one lot to continue.' : 'A title and schedule are required before moving on.' })
  }

  /* -------------------------------- actions -------------------------------- */
  const toggleLot = (id: string) => {
    // dropping the lot whose terms are open saves the edit and closes the panel
    if (selectedIds.includes(id) && id === activeId) closeLot()
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  /* --------------------------- per-lot terms editor ------------------------ */
  /** Write a draft onto the lot it belongs to. An emptied field means "put the
   *  seller's own value back", which is why it deletes the override rather than
   *  storing a zero. */
  const commit = (lotId: string, d: TermsDraft) => {
    const l = lots.find((x) => x.id === lotId)
    if (!l) return
    setOverrides((prev) => {
      const o: Partial<Lot> = { ...prev[lotId] }
      // an emptied field is a revert; a field that was already blank (a lot with
      // no start value can't show a percentage) is simply left alone
      if (!d.inc.trim()) { if (d.init.inc) delete o.increment }
      else if (d.inc !== d.init.inc && Number(d.inc) > 0) o.increment = Number(d.inc)
      if (!d.emdPct.trim()) { if (d.init.emdPct) delete o.preBidEmd }
      else if (d.emdPct !== d.init.emdPct && Number(d.emdPct) > 0) o.preBidEmd = Math.round((Number(d.emdPct) / 100) * startValue(l))
      if (d.uom && d.uom !== d.init.uom) o.uom = d.uom
      const next = { ...prev }
      if (Object.keys(o).length) next[lotId] = o
      else delete next[lotId]
      return next
    })
  }

  /** Open a lot's terms. Whatever was open is saved first — the panel belongs
   *  to one lot at a time, and switching lots must not throw the edit away. */
  const openLot = (id: string) => {
    if (activeId === id) return
    if (activeId) commit(activeId, draft)
    const l = lots.find((x) => x.id === id)
    if (!l) return
    if (!selectedIds.includes(id)) setSelectedIds((prev) => [...prev, id])
    const e = { ...l, ...overrides[id] }
    const init = { inc: String(e.increment), emdPct: emdPctOf(l, e.preBidEmd), uom: e.uom as Uom | '' }
    setDraft({ ...init, init })
    setActiveId(id)
  }

  function closeLot() {
    if (activeId) commit(activeId, draft)
    setActiveId(null)
    setDraft(EMPTY_DRAFT)
  }

  const saveActive = () => {
    if (!activeLot) return
    commit(activeLot.id, draft)
    setDraft((d) => ({ ...d, init: { inc: d.inc, emdPct: d.emdPct, uom: d.uom } }))
    pushToast({
      kind: 'info',
      title: `Terms saved for ${activeLot.lotNo}`,
      body: 'They apply to this lot only. The seller keeps their submitted figures and is told what changed.',
    })
  }

  /** Drop every change on the open lot and show the seller's own terms again. */
  const resetActive = () => {
    if (!activeLot) return
    setOverrides((prev) => {
      const next = { ...prev }
      delete next[activeLot.id]
      return next
    })
    const init = { inc: String(activeLot.increment), emdPct: emdPctOf(activeLot, activeLot.preBidEmd), uom: activeLot.uom as Uom | '' }
    setDraft({ ...init, init })
  }

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
    pushToast({
      kind: 'warning',
      title: 'Seller terms overridden',
      body: `${selected.length} lot${selected.length > 1 ? 's' : ''} changed. The originals are kept, and the seller is told when this catalogue is assigned.`,
    })
  }

  /** Every field this build has changed from what the seller submitted, with
   *  the original beside it. Shown before the catalogue is assigned, because
   *  after that it is disclosed to the seller and written to the audit trail. */
  const overrideRows = selected.flatMap((l) => {
    const o = overrides[l.id]
    if (!o) return []
    const rows: { key: string; lotNo: string; label: string; from: string; to: string }[] = []
    if (o.increment != null && o.increment !== l.increment) rows.push({ key: `${l.id}-inc`, lotNo: l.lotNo, label: 'Bid increment', from: inr(l.increment), to: inr(o.increment) })
    if (o.preBidEmd != null && o.preBidEmd !== l.preBidEmd) rows.push({ key: `${l.id}-emd`, lotNo: l.lotNo, label: 'Pre-bid EMD', from: inr(l.preBidEmd), to: inr(o.preBidEmd) })
    if (o.uom && o.uom !== l.uom) rows.push({ key: `${l.id}-uom`, lotNo: l.lotNo, label: 'Unit of measure', from: l.uom, to: o.uom })
    return rows
  })

  const attach = (t: (typeof ATTACH_TILES)[number]) => {
    setAttached((prev) => [...prev, { id: uid('doc'), name: t.name, type: t.type, size: t.size }])
    pushToast({ kind: 'info', title: 'File attached', body: t.name })
  }

  const assign = () => {
    if (!firstLot || !fieldExecId) return
    if (mixedSellers) {
      pushToast({
        kind: 'warning',
        title: 'One catalogue, one seller',
        body: `These lots belong to ${sellerIdsSelected.length} different sellers. Go back to step 1 and keep to one.`,
      })
      return
    }
    const yard = yardName || firstLot.yard
    const cat: Catalogue = {
      id: uid('cat'),
      code,
      title: title.trim(),
      // the lots carry the seller, so the catalogue takes it from them rather
      // than from whatever the filter happens to be left on
      sellerId: firstLot.sellerId,
      type: auctionType,
      status: 'draft',
      assignedFieldExecId: fieldExecId,
      startsAt: new Date(startLocal).toISOString(),
      endsAt: new Date(endLocal).toISOString(),
      // Pre-bid EMD closes a day ahead of go-live (src/lib/emd.ts).
      emdDeadline: defaultEmdDeadline(new Date(startLocal).toISOString()),
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
    const res = publishCatalogue(cat, selectedIds, overrides)
    if (!res.ok) {
      pushToast({ kind: 'danger', title: 'Could not assign this catalogue', body: res.error })
      return
    }
    const exec = users.find((u) => u.id === fieldExecId)
    pushToast({
      kind: 'success',
      title: `${code} assigned`,
      body: `${selected.length} lots routed to ${exec?.name ?? 'the field executive'} for inspection.`,
    })
    navigate('/exec')
  }

  /* -------------------------------- render --------------------------------- */
  return (
    <Page>
      <PageHeader
        title="Catalogue builder"
        sub="Bundle submitted lots into a catalogue — sequence, schedule, documents, then assign it for inspection. Nothing you build here is visible to any buyer or seller until it is published on Auction schedule."
        actions={
          <>
            <Chip tone="steel">Draft <span className="num">{code}</span></Chip>
            <Chip tone="neutral"><EyeOff size={11} /> Private</Chip>
          </>
        }
      />

      <Tabs<Step>
        tabs={[
          { key: 's1', label: '1 · Select lots', count: selectedIds.length },
          { key: 's2', label: '2 · Details' },
          { key: 's3', label: '3 · Documents', count: attached.length + 1 },
          { key: 's4', label: '4 · Preview & assign' },
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

            {mixedSellers && (
              <div className="card border-l-4 border-l-warning px-4 py-3 flex flex-wrap items-center gap-2">
                <AlertTriangle size={15} className="text-warning shrink-0" />
                <span className="text-sm font-semibold">This selection spans {sellerIdsSelected.length} sellers</span>
                <span className="text-[12px] text-ink-muted">
                  A catalogue is sold for one seller — {sellerIdsSelected.map(firmOf).join(', ')}. Pick a seller above and keep to their lots.
                </span>
              </div>
            )}

            {filtered.length === 0 ? (
              <EmptyState
                title="No submitted lots match"
                body={sellerFilter
                  ? `${firmOf(sellerFilter)} has no lots waiting to be catalogued. Choose another seller, or loosen the metal and yard filters.`
                  : 'Wait for sellers to submit lots for inspection, or loosen the filters above.'}
              />
            ) : (
              <div className="card divide-y divide-line overflow-hidden">
                {filtered.map((l) => {
                  const on = selectedIds.includes(l.id)
                  const open = activeId === l.id
                  const e = effective(l)
                  const changed = diffCount(l)
                  return (
                    <div key={l.id} className={cx('flex items-center gap-3 p-3.5 transition-colors', open ? 'bg-ember-soft/70' : on ? 'bg-ember-soft/40' : 'hover:bg-surface-2')}>
                      <input type="checkbox" checked={on} onChange={() => toggleLot(l.id)} aria-label={`Select ${l.lotNo}`}
                        className="size-4 shrink-0 cursor-pointer accent-[var(--color-ember,#c2410c)]" />
                      {/* the row body opens this lot's own terms — selecting it
                          on the way, because terms only travel with a lot that
                          is actually in the catalogue */}
                      <button type="button" onClick={() => openLot(l.id)} aria-pressed={open}
                        className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer">
                        <PhotoThumb hue={l.photos[0]?.hue ?? 24} category={l.category} className="w-14 h-11" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">{l.grade} · {l.metal}</div>
                          <div className="text-xs text-ink-muted truncate">
                            <span className="num">{num(l.indicativeQty)} {e.uom}</span> · {l.yard} · start <span className="num">{inr(l.startRate)}/{e.uom}</span>
                          </div>
                          <div className="text-xs text-ink-faint truncate">{firmOf(l.sellerId)}</div>
                        </div>
                        {changed > 0 && <Chip tone="warning">Terms changed · <span className="num">{changed}</span></Chip>}
                        {/* Bypassing an inspection is a decision, not an assembly
                            step, and it needs a typed reason — so it is made on
                            Lot approval and only shown here as a state. */}
                        {l.inspectionWaived
                          ? <Chip tone="warning">Bypassed — no yard visit</Chip>
                          : l.knownSeller && <Chip tone="success">Known seller</Chip>}
                        <span className="num text-xs text-ink-faint shrink-0">{l.lotNo}</span>
                      </button>
                    </div>
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
              {selected.length === 0 && <div className="text-sm text-ink-faint">Tick lots on the left to build the running order. Click a lot to set its own increment and EMD.</div>}
              <div className="space-y-2">
                {selected.map((l, i) => (
                  <div key={l.id} className={cx('flex items-center gap-2 rounded-xl border p-2', activeId === l.id ? 'border-ember bg-ember-soft/60' : 'border-line bg-surface-2')}>
                    <span className="num text-xs font-bold text-ember-strong bg-ember-soft rounded-md px-1.5 py-0.5 shrink-0">
                      LOT-{String(i + 1).padStart(2, '0')}
                    </span>
                    <button type="button" onClick={() => openLot(l.id)}
                      className="flex-1 min-w-0 flex items-center gap-1.5 text-left text-xs font-semibold cursor-pointer">
                      <span className="truncate">{l.grade}</span>
                      {diffCount(l) > 0 && <span className="size-1.5 rounded-full bg-warning shrink-0" title="Terms changed on this lot" />}
                    </button>
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

            {/* One panel, two modes: the terms of the lot you have open, or —
                when nothing is open — the batch shortcut across the selection. */}
            {activeLot ? (
              <div className="card p-4 space-y-3 ring-2 ring-ember/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Terms for this lot</div>
                    <div className="text-sm font-semibold truncate mt-1">
                      {activePos >= 0 && <span className="num text-ember-strong mr-1.5">LOT-{String(activePos + 1).padStart(2, '0')}</span>}
                      {activeLot.grade}
                    </div>
                    <div className="text-xs text-ink-faint truncate">
                      <span className="num">{activeLot.lotNo}</span> · {firmOf(activeLot.sellerId)} · <span className="num">{num(activeLot.indicativeQty)} {draft.uom || activeLot.uom}</span> at <span className="num">{inr(activeLot.startRate)}</span>
                    </div>
                  </div>
                  <button onClick={closeLot} aria-label="Close lot terms"
                    className="p-1 rounded-md text-ink-faint hover:text-ink hover:bg-surface-2 shrink-0"><X size={14} /></button>
                </div>

                <Field label="Increment (₹)" hint={<>Seller submitted <span className="num">{inr(activeLot.increment)}</span></>}>
                  <Input type="number" placeholder={String(activeLot.increment)} value={draft.inc}
                    onChange={(e) => setDraft((d) => ({ ...d, inc: e.target.value }))} />
                </Field>
                <Field
                  label="EMD (% of start value)"
                  hint={Number(draft.emdPct) > 0
                    ? <>Works out to <span className="num">{inr(Math.round((Number(draft.emdPct) / 100) * startValue(activeLot)))}</span> on this lot · seller submitted <span className="num">{inr(activeLot.preBidEmd)}</span></>
                    : <>Seller submitted <span className="num">{inr(activeLot.preBidEmd)}</span> — clear the field to keep it</>}
                >
                  <Input type="number" step="0.01" placeholder={emdPctOf(activeLot, activeLot.preBidEmd)} value={draft.emdPct}
                    onChange={(e) => setDraft((d) => ({ ...d, emdPct: e.target.value }))} />
                </Field>
                <Field label="Unit of measure">
                  <Select value={draft.uom} onChange={(e) => setDraft((d) => ({ ...d, uom: e.target.value as Uom | '' }))}>
                    <option value="MT">MT</option><option value="KG">KG</option><option value="PCS">PCS</option><option value="LOT">LOT</option>
                  </Select>
                </Field>

                <div className="flex items-center justify-between gap-2">
                  {diffCount(activeLot) > 0
                    ? <button onClick={resetActive} className="text-xs font-semibold text-ink-muted hover:text-danger">Reset to seller&apos;s values</button>
                    : <Chip tone="neutral">Sale basis: as-is-where-is</Chip>}
                  <Button size="sm" variant="secondary" onClick={saveActive}>Save</Button>
                </div>
                <p className="text-[11px] text-ink-faint border-t border-line pt-2.5">
                  These figures apply to this lot alone. Opening another lot saves this one first.
                  {selected.length > 1 && <> Need the same change on every lot? <button onClick={closeLot} className="font-semibold text-ember hover:underline">Bulk-set instead</button>.</>}
                </p>
              </div>
            ) : (
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
                <p className="text-[11px] text-ink-faint border-t border-line pt-2.5">
                  Applies to all <span className="num">{selected.length}</span> selected lots. To set one lot on its own, click it in the list.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------ STEP 2 ------------------------------ */}
      {step === 's2' && (
        <div className="card p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Field label="Catalogue title" className="md:col-span-2 xl:col-span-2">
            <Input placeholder="e.g. Mixed non-ferrous & slag disposal — July window" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Auction type" hint="Tender switches every buyer to a single sealed offer — no visible ladder, no auto-bid.">
            <Select value={auctionType} onChange={(e) => setAuctionType(e.target.value as Catalogue['type'])}>
              <option value="forward">Forward (English, on rate)</option>
              <option value="tender">Tender (sealed bid)</option>
            </Select>
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
                {auctionType === 'tender' ? <Chip tone="steel">Sealed tender</Chip> : <Chip tone="ember" pulse>Forward e-auction</Chip>}
                <Chip tone="neutral">As-is-where-is</Chip>
              </div>
              <h2 className="font-display text-2xl font-bold mt-2">{title.trim() || 'Untitled catalogue'}</h2>
              <div className="text-sm text-ink-muted mt-1">
                {yardName || firstLot?.yard} · {region || (firstLot ? YARD_REGION[firstLot.yard] : '') || '—'}
                {firstLot && <> · sold for {firmOf(firstLot.sellerId)}</>}
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

          {/* ---------------- what we changed on the seller's lots ------------- */}
          {overrideRows.length > 0 && (
            <div className="card border-l-4 border-l-warning overflow-hidden">
              <div className="px-4 py-3 border-b border-line bg-warning-soft/40 flex flex-wrap items-center gap-2">
                <AlertTriangle size={15} className="text-warning shrink-0" />
                <span className="font-bold text-sm">You have changed {overrideRows.length} thing{overrideRows.length === 1 ? '' : 's'} the seller submitted</span>
                <span className="text-[12px] text-ink-muted ml-auto">Disclosed to the seller · originals kept · written to the audit trail</span>
              </div>
              <div className="divide-y divide-line">
                {overrideRows.map((r) => (
                  <div key={r.key} className="px-4 py-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]">
                    <span className="num font-bold w-16 shrink-0">{r.lotNo}</span>
                    <span className="font-medium">{r.label}</span>
                    <span className="num ml-auto shrink-0">
                      <span className="text-ink-muted line-through">{r.from}</span>
                      <span className="text-ink-faint mx-2">→</span>
                      <span className="font-bold text-ember-strong">{r.to}</span>
                    </span>
                  </div>
                ))}
              </div>
              <p className="px-4 py-3 border-t border-line text-[12px] text-ink-muted">
                A bulk change is fast and easy to miss, which is why it is listed here rather than left in the annexure.
                The seller keeps their original figures on the lot record and is notified of every line above the moment
                this catalogue is assigned.
              </p>
            </div>
          )}

          {mixedSellers && (
            <div className="card border-l-4 border-l-danger px-4 py-3 flex flex-wrap items-center gap-2">
              <AlertTriangle size={15} className="text-danger shrink-0" />
              <span className="text-sm font-semibold">This catalogue has no single seller</span>
              <span className="text-[12px] text-ink-muted">
                {sellerIdsSelected.map(firmOf).join(', ')} are all in it. Every override is disclosed to one seller and the sale settles to one account,
                so drop the others on step 1 before assigning.
              </span>
            </div>
          )}

          <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Assign to field executive" className="w-56">
                <Select value={fieldExecId} onChange={(e) => setFieldExecId(e.target.value)}>
                  <option value="">Select field executive…</option>
                  {fieldExecs.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </Select>
              </Field>
              <div className="text-sm text-ink-muted max-w-sm">
                Assigning locks lot numbering <span className="num">LOT-01…LOT-{String(selected.length).padStart(2, '0')}</span> and routes this
                catalogue to the field executive&apos;s inspection queue. It stays private throughout — it only reaches
                buyers when somebody publishes it on <Link to="/auction/schedule" className="text-ember font-semibold hover:underline">Auction schedule</Link>.
              </div>
            </div>
            <Button onClick={assign} disabled={!step2Done || !fieldExecId || mixedSellers}>Save &amp; assign for inspection</Button>
          </div>
        </div>
      )}

      {/* wizard nav */}
      <div className="flex items-center justify-between mt-6">
        <Button variant="ghost" disabled={step === 's1'} onClick={() => gotoStep(STEPS[STEPS.indexOf(step) - 1])}>← Back</Button>
        {step !== 's4' && (
          <Button variant="secondary" onClick={() => gotoStep(STEPS[STEPS.indexOf(step) + 1])}>Next →</Button>
        )}
      </div>
    </Page>
  )
}
