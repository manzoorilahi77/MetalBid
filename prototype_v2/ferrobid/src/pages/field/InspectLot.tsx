/* Field executive — per-lot inspection form (mobile-first). */
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Camera, Check, ChevronLeft, Flag, X } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, EmptyState, Field, Input, PhotoThumb, Segmented, Textarea, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { num } from '../../lib/format'
import type { InspectionReport } from '../../types'

const CHECK_ITEMS = [
  'Material matches declared grade',
  'Quantity verified (visual/weighment)',
  'No hazardous contamination',
  'Loading access available',
  'Photos captured',
]

export default function InspectLot() {
  const { lotId } = useParams()
  const nav = useNavigate()
  const me = useStore((s) => s.currentUser)
  const lots = useStore((s) => s.lots)
  const submitInspection = useStore((s) => s.submitInspection)
  const pushToast = useStore((s) => s.pushToast)

  const lot = lots.find((l) => l.id === lotId)
  const [measured, setMeasured] = useState(lot ? String(lot.indicativeQty) : '')
  const [condition, setCondition] = useState<'good' | 'fair' | 'mixed' | 'poor'>('good')
  const [notes, setNotes] = useState('')
  const [shots, setShots] = useState<boolean[]>([false, false, false, false])
  const [checks, setChecks] = useState<boolean[]>([true, true, true, true, false])

  if (!lot) {
    return <Page className="max-w-xl"><EmptyState title="Lot not found" action={<Link to="/field"><Button variant="secondary">Back to queue</Button></Link>} /></Page>
  }

  const photoCount = shots.filter(Boolean).length
  const measuredNum = Number(measured) || 0
  const variance = lot.indicativeQty > 0 ? ((measuredNum - lot.indicativeQty) / lot.indicativeQty) * 100 : 0
  const checklist = CHECK_ITEMS.map((item, i) => ({ item, ok: i === 4 ? photoCount > 0 : checks[i] }))
  const canVerify = photoCount > 0 && measuredNum > 0
  const canFlag = photoCount > 0 && notes.trim().length > 0

  const submit = (outcome: 'verified' | 'flagged' | 'rejected') => {
    const report: Omit<InspectionReport, 'id' | 'lotId' | 'date'> = {
      inspectorId: me?.id ?? 'u-field-1',
      measuredQty: measuredNum,
      uom: lot.uom,
      condition,
      notes: notes.trim() || 'Verified at yard. Quantity indicative — final on weighment.',
      checklist,
      photoCount,
      status: outcome,
    }
    submitInspection(lot.id, report, outcome)
    pushToast({
      kind: outcome === 'verified' ? 'success' : outcome === 'flagged' ? 'warning' : 'danger',
      title: `${lot.lotNo} ${outcome}`,
      body: outcome === 'verified' ? 'Report sent to Executive Manager for approval.' : 'Escalated with your notes.',
    })
    nav('/field')
  }

  return (
    <Page className="max-w-xl pb-28">
      <Link to="/field" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-ink mb-4">
        <ChevronLeft size={16} /> Queue
      </Link>

      {/* sticky lot summary */}
      <div className="card p-4 sticky top-[7.5rem] z-20 bg-surface">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="num font-bold">{lot.lotNo}</span>
          <Chip tone="steel">{lot.metal}</Chip>
          <span className="font-semibold text-sm">{lot.grade}</span>
        </div>
        <div className="num text-xs text-ink-muted mt-1">
          Declared {num(lot.indicativeQty)} {lot.uom} · {lot.yard}
        </div>
      </div>

      <div className="mt-5 space-y-6">
        <Field label={`Measured quantity (${lot.uom})`}
          hint={measuredNum > 0 ? undefined : 'Enter the measured/weighed quantity'}>
          <div className="flex items-center gap-3">
            <Input inputMode="decimal" className="num text-lg h-12 w-40" value={measured}
              onChange={(e) => setMeasured(e.target.value.replace(/[^\d.]/g, ''))} />
            <span className={cx('num text-sm font-bold', Math.abs(variance) > 5 ? 'text-warning' : 'text-success')}>
              {variance >= 0 ? '+' : ''}{variance.toFixed(1)}% vs declared
            </span>
          </div>
        </Field>

        <Field label="Condition">
          <Segmented value={condition} onChange={setCondition}
            options={(['good', 'fair', 'mixed', 'poor'] as const).map((c) => ({ key: c, label: c[0].toUpperCase() + c.slice(1) }))} />
        </Field>

        <div>
          <span className="block text-[13px] font-semibold mb-2">Photos <span className="num text-ink-faint font-normal">({photoCount}/4)</span></span>
          <div className="grid grid-cols-2 gap-3">
            {shots.map((taken, i) => (
              <button key={i} onClick={() => setShots(shots.map((x, j) => (j === i ? true : x)))}
                className={cx('h-28 rounded-2xl grid place-items-center transition-colors overflow-hidden',
                  taken ? 'p-0' : 'border-2 border-dashed border-line-strong text-ink-faint hover:border-ember/60 hover:text-ember')}>
                {taken
                  ? <PhotoThumb hue={22 + i * 12} label={['Overview', 'Close-up', 'Stack view', 'Access'][i]} className="w-full h-full rounded-2xl" />
                  : <span className="flex flex-col items-center gap-1.5 text-sm font-semibold"><Camera size={22} /> Tap to capture</span>}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="block text-[13px] font-semibold mb-2">Checklist</span>
          <div className="card divide-y divide-line">
            {CHECK_ITEMS.map((item, i) => {
              const ok = i === 4 ? photoCount > 0 : checks[i]
              const locked = i === 4
              return (
                <button key={item} disabled={locked}
                  onClick={() => setChecks(checks.map((x, j) => (j === i ? !x : x)))}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left disabled:cursor-default">
                  <span className={cx('size-6 rounded-lg grid place-items-center border shrink-0 transition-colors',
                    ok ? 'bg-success border-success text-white' : 'border-line-strong text-transparent')}>
                    <Check size={14} />
                  </span>
                  <span className={cx('text-sm font-medium', ok ? 'text-ink' : 'text-ink-muted')}>{item}</span>
                  {locked && <span className="ml-auto text-[11px] text-ink-faint">auto</span>}
                </button>
              )
            })}
          </div>
        </div>

        <Field label="Notes" hint="Required for Flag / Reject. Buyers see verified notes on the lot.">
          <Textarea placeholder="Stack verified against yard register. Access for 20 ft trucks confirmed…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>

      {/* sticky action bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
        <div className="max-w-xl mx-auto px-4 py-3 grid grid-cols-3 gap-2">
          <Button variant="success" size="lg" disabled={!canVerify} onClick={() => submit('verified')}>
            <Check size={17} /> Verify
          </Button>
          <Button variant="secondary" size="lg" disabled={!canFlag} onClick={() => submit('flagged')}
            className="text-warning border-warning/40 hover:bg-warning-soft">
            <Flag size={16} /> Flag
          </Button>
          <Button variant="secondary" size="lg" disabled={!canFlag} onClick={() => submit('rejected')}
            className="text-danger border-danger/40 hover:bg-danger-soft">
            <X size={17} /> Reject
          </Button>
        </div>
        {(!canVerify || !canFlag) && (
          <p className="text-center text-[11px] text-ink-faint pb-2 -mt-1">
            {photoCount === 0 ? 'Capture at least one photo. ' : ''}{!canFlag && photoCount > 0 ? 'Notes are required to flag or reject.' : ''}
          </p>
        )}
      </div>
    </Page>
  )
}
