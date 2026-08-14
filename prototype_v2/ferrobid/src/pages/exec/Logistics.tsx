/* Executive Manager — lifting & logistics board across delivery orders.

   Also the desk where the gross weighment is witnessed. The buyer can declare a
   reading from their own weighbridge, but the figure that closes a handover —
   and therefore the figure the invoice and any shortfall refund are built on —
   has to be put on the record by one of our people. That is what the weighment
   panel on a lifting card is for. */
import { useState } from 'react'
import { Truck, Scale } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Link } from 'react-router-dom'
import { ArrowRight, Lock } from 'lucide-react'
import { PageHeader, Button, Chip, Field, Input, Modal, Stat, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { num, relTime, fmtDate } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type { DeliveryOrder } from '../../types'

const hash = (s: string) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0)

const VEHICLES = ['TN-28-AQ-4471 · 25 MT tipper', 'JH-05-BX-9034 · 30 MT trailer', 'OD-02-CJ-1187 · 18 MT truck', 'CG-04-KL-6620 · 25 MT tipper', 'KA-35-MN-3309 · 40 MT trailer']
const vehicleFor = (d: DeliveryOrder) => VEHICLES[hash(d.id) % VEHICLES.length]
const gatePassFor = (d: DeliveryOrder) => `GP-${String(1000 + (hash(d.id) % 9000))}`

export default function Logistics() {
  const now = useNow()
  const deliveryOrders = useStore((s) => s.deliveryOrders)
  const lots = useStore((s) => s.lots)
  const users = useStore((s) => s.users)
  const catalogues = useStore((s) => s.catalogues)
  const advanceDeliveryOrder = useStore((s) => s.advanceDeliveryOrder)
  const recordWeighment = useStore((s) => s.recordWeighment)
  const toggleLiftingChecklistItem = useStore((s) => s.toggleLiftingChecklistItem)
  const completeLifting = useStore((s) => s.completeLifting)
  const pushToast = useStore((s) => s.pushToast)

  const [weighTarget, setWeighTarget] = useState<DeliveryOrder | null>(null)
  const [weighQty, setWeighQty] = useState('')

  /** Who put the current reading on the record. A buyer's own figure is a
   *  declaration and cannot close the handover; ours can. */
  const witness = (d: DeliveryOrder) => {
    if (d.weighedQty == null) return null
    const by = users.find((u) => u.id === d.weighedById)
    const staff = !!by && by.role !== 'buyer' && by.role !== 'seller'
    return { by, staff, label: staff ? by.name : `${by?.firm ?? 'Buyer'} (buyer's reading)` }
  }

  const saveWeighment = () => {
    if (!weighTarget) return
    const qty = Number(weighQty)
    if (!(qty > 0)) {
      pushToast({ kind: 'danger', title: 'Weighment not recorded', body: 'Enter the gross weighment reading.' })
      return
    }
    recordWeighment(weighTarget.id, qty)
    const variance = ((qty - weighTarget.awardedQty) / weighTarget.awardedQty) * 100
    pushToast({
      kind: Math.abs(variance) >= 1 ? 'warning' : 'success',
      title: `Weighment witnessed — ${num(qty)} ${weighTarget.uom}`,
      body: Math.abs(variance) < 1
        ? 'On the awarded quantity. Handover can be closed against this figure.'
        : `${variance >= 0 ? '+' : ''}${variance.toFixed(1)}% against the awarded quantity — Finance has been told.`,
    })
    setWeighTarget(null)
    setWeighQty('')
  }

  const awaiting = deliveryOrders.filter((d) => d.stage === 'payment_pending' || d.stage === 'dd_issued')
  const lifting = deliveryOrders.filter((d) => d.stage === 'lifting_scheduled' || d.stage === 'lifted')
  const completed = deliveryOrders.filter((d) => d.stage === 'completed')

  const firm = (id: string) => users.find((u) => u.id === id)?.firm ?? '—'
  const region = (catId: string) => catalogues.find((c) => c.id === catId)?.region ?? '—'

  const card = (d: DeliveryOrder, kind: 'awaiting' | 'lifting' | 'completed') => {
    const l = lots.find((x) => x.id === d.lotId)
    const overdue = Date.parse(d.liftingBy) < now && kind !== 'completed'
    return (
      <div key={d.id} className="card p-3.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="num text-xs font-bold">{d.id.toUpperCase()}</span>
          {kind === 'completed'
            ? <Chip tone="success">Lifted</Chip>
            : overdue
              ? <Chip tone="danger">Deadline passed</Chip>
              : <Chip tone="neutral"><span className="num">{relTime(d.liftingBy, now)}</span></Chip>}
        </div>
        <div className="text-sm font-semibold leading-tight">{l ? `${l.grade} · ${l.metal}` : d.lotId}</div>
        <div className="text-xs text-ink-muted">{firm(d.buyerId)}</div>
        <div className="text-xs text-ink-faint">
          <span className="num">{num(d.awardedQty)} {d.uom}</span> · {region(d.catalogueId)} · lift by <span className="num">{fmtDate(d.liftingBy)}</span>
        </div>
        {kind === 'lifting' && (
          <>
            <div className="flex items-center gap-2 rounded-lg bg-surface-2 border border-line px-2.5 py-1.5 text-xs">
              <Truck size={13} className="text-ink-faint shrink-0" />
              <span className="num font-semibold">{vehicleFor(d)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-faint">Gate pass</span>
              <Chip tone="steel"><span className="num">{gatePassFor(d)}</span></Chip>
            </div>
            <div className="flex gap-1.5 pt-1">
              <Button size="sm" variant="secondary" className="flex-1"
                onClick={() => pushToast({ kind: 'success', title: `Gate pass ${gatePassFor(d)} issued`, body: `${vehicleFor(d)} cleared for entry — SMS sent to the driver.` })}>
                Issue gate pass
              </Button>
              {d.stage === 'lifting_scheduled' ? (
                <Button size="sm" variant="success" className="flex-1"
                  onClick={() => {
                    advanceDeliveryOrder(d.id)
                    pushToast({ kind: 'success', title: `${d.id.toUpperCase()} lifting started`, body: 'Weighbridge checklist now active — buyer tracks it in Auction status.' })
                  }}>
                  Confirm lifting started
                </Button>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-ink-muted num">
                  {d.liftingChecklist.filter((i) => i.done).length}/{d.liftingChecklist.length} checklist complete
                </div>
              )}
            </div>

            {/* The weighment panel — the figure the invoice is built on. */}
            {d.stage === 'lifted' && (() => {
              const w = witness(d)
              const variance = w && d.weighedQty != null
                ? ((d.weighedQty - d.awardedQty) / d.awardedQty) * 100 : 0
              return (
                <div className={cx('rounded-lg border px-2.5 py-2 space-y-1.5',
                  !w ? 'border-line bg-surface-2'
                    : w.staff ? 'border-success/25 bg-success-soft/50' : 'border-warning/30 bg-warning-soft/50')}>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                    <Scale size={12} /> Gross weighment
                  </div>
                  {w ? (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="num text-sm font-bold">{num(d.weighedQty!)} {d.uom}</span>
                        <span className={cx('num text-[11px] font-semibold',
                          Math.abs(variance) < 1 ? 'text-ink-faint' : variance < 0 ? 'text-danger' : 'text-warning')}>
                          {variance >= 0 ? '+' : ''}{variance.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-[11px] text-ink-muted">{w.label}</div>
                      {!w.staff && (
                        <p className="text-[11px] text-ink-muted">
                          A buyer&apos;s own reading cannot close the handover. Witness it to confirm the figure.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-[11px] text-ink-muted">Not recorded yet. The handover closes against this figure.</p>
                  )}
                  <div className="flex gap-1.5">
                    <Button size="sm" variant={w?.staff ? 'ghost' : 'secondary'} className="flex-1"
                      onClick={() => { setWeighTarget(d); setWeighQty(String(d.weighedQty ?? d.awardedQty)) }}>
                      {w?.staff ? 'Re-weigh' : 'Witness weighment'}
                    </Button>
                    {d.liftingChecklist.every((i) => i.done) && (
                      <Button size="sm" variant="success" className="flex-1"
                        onClick={() => {
                          completeLifting(d.id)
                          pushToast({ kind: 'success', title: `${d.id.toUpperCase()} lifted`, body: 'Handover is ready to close.' })
                        }}>
                        Mark lifted
                      </Button>
                    )}
                  </div>
                  {!d.liftingChecklist.every((i) => i.done) && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {d.liftingChecklist.filter((i) => !i.done).map((i) => (
                        <button key={i.key} onClick={() => toggleLiftingChecklistItem(d.id, i.key)}
                          className="text-[11px] px-2 py-0.5 rounded-full border border-line-strong text-ink-muted hover:border-success/50 hover:text-success transition-colors">
                          {i.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}
          </>
        )}
        {kind === 'awaiting' && (
          <div className="text-xs text-ink-faint pt-0.5">
            {d.stage === 'payment_pending' ? 'Balance due before the Demand Draft is recorded.' : 'DD received — buyer to schedule lifting.'}
          </div>
        )}
      </div>
    )
  }

  const columns: { title: string; items: DeliveryOrder[]; kind: 'awaiting' | 'lifting' | 'completed' }[] = [
    { title: 'Awaiting payment', items: awaiting, kind: 'awaiting' },
    { title: 'Lifting scheduled', items: lifting, kind: 'lifting' },
    { title: 'Completed', items: completed, kind: 'completed' },
  ]

  return (
    <Page>
      <PageHeader title="Logistics" sub="Yard lifting, weighment and gate movement across all open delivery orders." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Stat label="Lots awaiting lift" value={awaiting.length + lifting.length} tone="steel" sub="Across all yards" />
        <Stat label="Avg lifting time" value="4.2 days" sub="From DO issue to gate-out" />
        <Stat label="Yards congested" value="1" tone="warning" sub="MSTC Paradip — weighbridge queue" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((col) => (
          <div key={col.title}>
            <div className="flex items-center justify-between px-3 py-2 rounded-t-2xl bg-surface-2 border border-b-0 border-line">
              <span className="text-sm font-bold">{col.title}</span>
              <span className="num text-xs font-bold px-2 py-0.5 rounded-full bg-surface text-ink-muted border border-line">{col.items.length}</span>
            </div>
            <div className={cx('rounded-b-2xl border border-t-0 border-line p-2 space-y-2 min-h-32 bg-canvas')}>
              {col.items.length === 0 && <div className="text-xs text-ink-faint text-center py-8">Nothing here</div>}
              {col.items.map((d) => card(d, col.kind))}
            </div>
          </div>
        ))}
      </div>

      {/* Operations moves the material; Finance owns the money that releases it.
          Stating the boundary here stops a truck being scheduled against an
          unpaid order, which is the expensive version of this mistake. */}
      <div className="card bg-surface-2/60 border-dashed px-4 py-3 flex flex-wrap items-start gap-2.5 text-[13px] text-ink-muted mt-6">
        <Lock size={14} className="mt-0.5 shrink-0 text-ink-faint" />
        <p className="flex-1 min-w-56 max-w-3xl">
          A delivery order only reaches this board once <strong>Finance has confirmed the buyer&apos;s payment</strong>. If a
          lot is missing here, the money has not landed yet — chase it there rather than advancing the stage by hand.
        </p>
        <Link to="/finance/payments" className="text-[13px] font-bold text-ember hover:underline inline-flex items-center gap-1 shrink-0">
          Buyer payments <ArrowRight size={13} />
        </Link>
      </div>

      <Modal open={!!weighTarget} onClose={() => setWeighTarget(null)} title="Witness the gross weighment">
        {weighTarget && (
          <div className="space-y-4">
            <p className="text-[13px] text-ink-muted">
              {lots.find((l) => l.id === weighTarget.lotId)?.grade ?? weighTarget.lotId} for {firm(weighTarget.buyerId)}.
              Awarded at <span className="num font-semibold text-ink">{num(weighTarget.awardedQty)} {weighTarget.uom}</span>.
              This figure is weighment-final: the invoice and any shortfall refund are built on it.
            </p>
            <Field label={`Gross weighment (${weighTarget.uom})`} hint="As read at the weighbridge, in our presence.">
              <Input inputMode="decimal" className="num" value={weighQty}
                onChange={(e) => setWeighQty(e.target.value.replace(/[^\d.]/g, ''))} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setWeighTarget(null)}>Cancel</Button>
              <Button onClick={saveWeighment} disabled={!(Number(weighQty) > 0)}>Record weighment</Button>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  )
}
