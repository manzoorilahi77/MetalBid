/* Fulfilment tracker — from Demand Draft to gate pass for every won lot. */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, FileDown, Landmark, Scale, Truck, UserRound } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, EmptyState, Input, PageHeader, PhotoThumb, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type { FulfilmentStage } from '../../types'

const STAGES: { key: FulfilmentStage; label: string }[] = [
  { key: 'payment_pending', label: 'Payment' },
  { key: 'dd_issued', label: 'DD received' },
  { key: 'lifting_scheduled', label: 'Lifting scheduled' },
  { key: 'lifted', label: 'Lifted' },
  { key: 'completed', label: 'Completed' },
]

export default function Fulfilment() {
  const me = useStore((s) => s.currentUser)
  const deliveryOrders = useStore((s) => s.deliveryOrders)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const advanceDeliveryOrder = useStore((s) => s.advanceDeliveryOrder)
  const toggleLiftingChecklistItem = useStore((s) => s.toggleLiftingChecklistItem)
  const recordWeighment = useStore((s) => s.recordWeighment)
  const completeLifting = useStore((s) => s.completeLifting)
  const pushToast = useStore((s) => s.pushToast)
  const now = useNow()
  const [weighInputs, setWeighInputs] = useState<Record<string, string>>({})

  if (!me) {
    return (
      <Page>
        <EmptyState
          icon={<UserRound size={32} strokeWidth={1.5} />}
          title="Sign in to track fulfilment"
          body="Delivery orders, lifting schedules and weighment for your won lots appear here."
          action={<Link to="/login"><Button>Sign in</Button></Link>}
        />
      </Page>
    )
  }

  const myDos = deliveryOrders
    .filter((d) => d.buyerId === me.id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))

  return (
    <Page>
      <PageHeader
        title="Fulfilment tracker"
        sub="Won lots move Demand Draft → delivery order → lifting → weighbridge checklist → gate pass. Invoices adjust pro-rata on final weighed quantity."
      />

      {myDos.length === 0 ? (
        <EmptyState
          icon={<Truck size={32} strokeWidth={1.5} />}
          title="No delivery orders yet"
          body="Win a lot as confirmed H1 and its delivery order will be tracked here end-to-end."
          action={<Link to="/buyer/bids"><Button variant="secondary">See my bids</Button></Link>}
        />
      ) : (
        <div className="space-y-5">
          {myDos.map((d) => {
            const lot = lots.find((l) => l.id === d.lotId)
            const cat = catalogues.find((c) => c.id === d.catalogueId)
            const total = d.materialValue + d.gstAmount + d.tcsAmount
            const balance = total - d.paidAmount
            const stageIdx = STAGES.findIndex((s) => s.key === d.stage)
            const liftMsLeft = Date.parse(d.liftingBy) - now
            const checklistDone = d.liftingChecklist.every((i) => i.done)
            return (
              <section key={d.id} className="card overflow-hidden">
                {/* ----------------------------- header ---------------------------- */}
                <div className="flex flex-wrap items-center gap-3 px-5 pt-4 pb-3 border-b border-line">
                  <PhotoThumb hue={lot?.photos[0]?.hue ?? 24} category={lot?.category} className="w-14 h-11" />
                  <div className="min-w-0 flex-1 basis-56">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="num text-sm font-bold">{lot?.lotNo ?? d.lotId}</span>
                      <span className="num text-xs text-ink-faint">{cat?.code}</span>
                      <span className="num text-xs text-ink-faint uppercase">{d.id}</span>
                    </div>
                    <div className="font-display font-bold leading-snug line-clamp-1 mt-0.5">{lot?.description ?? 'Awarded lot'}</div>
                    <div className="text-xs text-ink-muted mt-0.5">
                      Awarded <span className="num font-semibold text-ink">{num(d.awardedQty)} {d.uom}</span> at H1{' '}
                      <span className="num font-semibold text-ink">{inr(d.h1Rate)}/{d.uom}</span> · qty indicative — final on weighment
                    </div>
                  </div>
                  {d.stage === 'completed' ? (
                    <Chip tone="success"><Check size={12} /> Fulfilled</Chip>
                  ) : liftMsLeft < 0 ? (
                    <Chip tone="danger" pulse>Lifting overdue — {relTime(d.liftingBy, now)}</Chip>
                  ) : liftMsLeft < 3 * 86400_000 ? (
                    <Chip tone="warning" className="num">Lift {relTime(d.liftingBy, now)}</Chip>
                  ) : (
                    <Chip tone="neutral" className="num">Lift {relTime(d.liftingBy, now)}</Chip>
                  )}
                </div>

                <div className="grid lg:grid-cols-[1fr_290px]">
                  {/* --------------------- stage tracker + actions -------------------- */}
                  <div className="p-5">
                    <ol className="flex items-start">
                      {STAGES.map((s, i) => {
                        const done = i < stageIdx || d.stage === 'completed'
                        const current = i === stageIdx && d.stage !== 'completed'
                        return (
                          <li key={s.key} className="flex-1 flex flex-col items-center relative">
                            {i > 0 && (
                              <span className={cx('absolute top-4 right-1/2 w-full h-0.5 -translate-y-1/2',
                                i <= stageIdx || d.stage === 'completed' ? 'bg-success' : 'bg-line')} />
                            )}
                            <span className={cx('relative z-10 size-8 rounded-full border-2 flex items-center justify-center text-xs font-bold num',
                              done ? 'bg-success border-success text-white'
                                : current ? 'bg-ember border-ember text-white animate-live-pulse'
                                  : 'bg-surface border-line-strong text-ink-faint')}>
                              {done ? <Check size={14} /> : i + 1}
                            </span>
                            <span className={cx('mt-1.5 text-[11px] font-semibold text-center leading-tight px-1',
                              current ? 'text-ember' : done ? 'text-ink' : 'text-ink-faint')}>
                              {s.label}
                            </span>
                          </li>
                        )
                      })}
                    </ol>

                    <div className="mt-5">
                      {d.stage === 'payment_pending' && (
                        <div className="flex items-start gap-2.5 rounded-xl bg-surface-2 px-4 py-3">
                          <Landmark size={16} className="text-ink-faint shrink-0 mt-0.5" />
                          <span className="text-xs text-ink-muted">
                            Balance of <b className="num text-ink">{inr(balance)}</b> is payable via Demand Draft favouring the platform.
                            Once your DD is received, the settlement team confirms it here and issues the delivery order — usually within 1 business day.
                          </span>
                        </div>
                      )}
                      {d.stage === 'dd_issued' && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" variant="secondary"
                            onClick={() => pushToast({ kind: 'success', title: 'Delivery order downloaded (demo)', body: `${d.id.toUpperCase()} — present at the yard gate with your ID.` })}>
                            <FileDown size={14} /> Download DO (PDF)
                          </Button>
                          <Button size="sm" onClick={() => {
                            advanceDeliveryOrder(d.id)
                            pushToast({ kind: 'success', title: 'Lifting scheduled', body: `Slot confirmed at ${lot?.yard ?? 'the yard'}. Carry the DO and e-way bill.` })
                          }}>
                            <Truck size={14} /> Schedule lifting
                          </Button>
                        </div>
                      )}
                      {d.stage === 'lifting_scheduled' && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" onClick={() => {
                            advanceDeliveryOrder(d.id)
                            pushToast({ kind: 'info', title: 'Lifting started', body: 'Track vehicle arrival, loading and weighment against the checklist.' })
                          }}>
                            <Truck size={14} /> Confirm lifting started
                          </Button>
                          <span className="text-xs text-ink-muted num">Lift by {relTime(d.liftingBy, now).replace('in ', '')} from now — demurrage applies after.</span>
                        </div>
                      )}
                      {d.stage === 'lifted' && (
                        <div className="space-y-2">
                          {d.liftingChecklist.map((item) => {
                            if (item.key === 'gross_weighment') {
                              return item.done ? (
                                <div key={item.key} className="flex items-center justify-between gap-2 rounded-xl border border-success/25 bg-success-soft px-3 py-2 text-sm font-semibold text-success">
                                  <span className="flex items-center gap-2"><Check size={14} /> Gross weighment — {num(d.weighedQty ?? d.awardedQty)} {d.uom}</span>
                                  {item.at && <span className="text-xs font-medium">{relTime(item.at, now)}</span>}
                                </div>
                              ) : (
                                <div key={item.key} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2">
                                  <Scale size={14} className="text-ink-faint shrink-0" />
                                  <Input type="number" min={0} className="num h-8 flex-1" placeholder={`Weighed qty (${d.uom})`}
                                    value={weighInputs[d.id] ?? ''}
                                    onChange={(e) => setWeighInputs((w) => ({ ...w, [d.id]: e.target.value }))} />
                                  <Button size="sm" onClick={() => {
                                    const qty = Number(weighInputs[d.id])
                                    if (!(qty > 0)) return
                                    recordWeighment(d.id, qty)
                                    pushToast({ kind: 'success', title: `Weighment confirmed — ${num(qty)} ${d.uom}`, body: `Indicative was ${num(d.awardedQty)} ${d.uom}. Invoice adjusts pro-rata at ${inr(d.h1Rate)}/${d.uom}.` })
                                    setWeighInputs((w) => ({ ...w, [d.id]: '' }))
                                  }}>
                                    Record
                                  </Button>
                                </div>
                              )
                            }
                            return (
                              <button key={item.key} onClick={() => toggleLiftingChecklistItem(d.id, item.key)}
                                className="w-full flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-left hover:border-line-strong transition-colors">
                                <span className="flex items-center gap-2 text-sm font-semibold">
                                  <span className={cx('size-5 rounded-md border-2 flex items-center justify-center shrink-0',
                                    item.done ? 'bg-success border-success text-white' : 'border-line-strong')}>
                                    {item.done && <Check size={12} />}
                                  </span>
                                  {item.label}
                                </span>
                                {item.at && <span className="text-xs text-ink-faint">{relTime(item.at, now)}</span>}
                              </button>
                            )
                          })}
                          <Button size="sm" variant="success" className="mt-1" disabled={!checklistDone} onClick={() => {
                            completeLifting(d.id)
                            pushToast({ kind: 'success', title: 'Lifting complete', body: `${lot?.lotNo ?? d.lotId} — gate pass ready to download.` })
                          }}>
                            <Check size={14} /> Mark lifting complete
                          </Button>
                        </div>
                      )}
                      {d.stage === 'completed' && (
                        <div className="w-full flex flex-wrap items-center gap-3 rounded-xl bg-success-soft border border-success/25 px-4 py-3">
                          <Check size={18} className="text-success shrink-0" />
                          <span className="text-sm font-semibold text-success flex-1">Material lifted & settled — this order is complete.</span>
                          <Button size="sm" variant="success"
                            onClick={() => pushToast({ kind: 'success', title: 'Gate pass downloaded (demo)', body: `Gate pass for ${lot?.lotNo ?? d.lotId} saved as PDF.` })}>
                            <FileDown size={14} /> Download gate pass
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* -------------------------- value breakdown ----------------------- */}
                  <div className="border-t lg:border-t-0 lg:border-l border-line bg-surface-2 p-5">
                    <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint mb-3">Value breakdown</div>
                    <dl className="space-y-1.5 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-muted">Material value</dt>
                        <dd className="num font-semibold text-right">{inr(d.materialValue)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-muted">GST @ 18%</dt>
                        <dd className="num font-semibold text-right">{inr(d.gstAmount)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-muted">TCS @ 1%</dt>
                        <dd className="num font-semibold text-right">{inr(d.tcsAmount)}</dd>
                      </div>
                      <div className="flex justify-between gap-3 pt-2 border-t border-line-strong">
                        <dt className="font-bold">Total</dt>
                        <dd className="num font-bold text-right">{inr(total)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-muted">Paid</dt>
                        <dd className="num font-semibold text-right text-success">{inr(d.paidAmount)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-muted">Balance</dt>
                        <dd className={cx('num font-bold text-right', balance > 0 ? 'text-warning' : 'text-ink-faint')}>{inr(balance)}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </Page>
  )
}
