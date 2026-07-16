/* Executive Manager — lifting & logistics board across delivery orders. */
import { Truck } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { PageHeader, Button, Chip, Stat, cx } from '../../components/ui'
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
  const pushToast = useStore((s) => s.pushToast)

  const awaiting = deliveryOrders.filter((d) => d.stage === 'payment_pending' || d.stage === 'do_issued')
  const lifting = deliveryOrders.filter((d) => d.stage === 'lifting_scheduled' || d.stage === 'weighment')
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
              <Button size="sm" variant="success" className="flex-1"
                onClick={() => {
                  advanceDeliveryOrder(d.id)
                  pushToast({ kind: 'success', title: `${d.id.toUpperCase()} weighment recorded`, body: d.stage === 'weighment' ? 'Delivery order completed.' : 'Moved to weighment.' })
                }}>
                Mark weighment done
              </Button>
            </div>
          </>
        )}
        {kind === 'awaiting' && (
          <div className="text-xs text-ink-faint pt-0.5">
            {d.stage === 'payment_pending' ? 'Full payment due before the DO is released.' : 'DO issued — buyer to schedule lifting.'}
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
    </Page>
  )
}
