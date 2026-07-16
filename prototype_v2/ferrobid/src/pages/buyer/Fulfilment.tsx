/* Fulfilment tracker — from payment to gate pass for every won lot. */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, FileDown, Scale, Truck, UserRound } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, EmptyState, MockPayModal, PageHeader, PhotoThumb, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type { FulfilmentStage } from '../../types'

const STAGES: { key: FulfilmentStage; label: string }[] = [
  { key: 'payment_pending', label: 'Payment' },
  { key: 'do_issued', label: 'DO issued' },
  { key: 'lifting_scheduled', label: 'Lifting scheduled' },
  { key: 'weighment', label: 'Weighment' },
  { key: 'completed', label: 'Completed' },
]

export default function Fulfilment() {
  const me = useStore((s) => s.currentUser)
  const deliveryOrders = useStore((s) => s.deliveryOrders)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const advanceDeliveryOrder = useStore((s) => s.advanceDeliveryOrder)
  const pushToast = useStore((s) => s.pushToast)
  const now = useNow()
  const [payDoId, setPayDoId] = useState<string | null>(null)

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

  const payDo = myDos.find((d) => d.id === payDoId)
  const payBalance = payDo ? payDo.materialValue + payDo.gstAmount + payDo.tcsAmount - payDo.paidAmount : 0

  return (
    <Page>
      <PageHeader
        title="Fulfilment tracker"
        sub="Won lots move payment → delivery order → lifting → weighment → gate pass. Invoices adjust pro-rata on final weighed quantity."
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
            return (
              <section key={d.id} className="card overflow-hidden">
                {/* ----------------------------- header ---------------------------- */}
                <div className="flex flex-wrap items-center gap-3 px-5 pt-4 pb-3 border-b border-line">
                  <PhotoThumb hue={lot?.photos[0]?.hue ?? 24} className="w-14 h-11" />
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

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      {d.stage === 'payment_pending' && (
                        <>
                          <Button size="sm" onClick={() => setPayDoId(d.id)}>Pay balance {inr(balance)}</Button>
                          <span className="text-xs text-ink-muted">Delivery order is issued once the full sale value is settled.</span>
                        </>
                      )}
                      {d.stage === 'do_issued' && (
                        <>
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
                        </>
                      )}
                      {d.stage === 'lifting_scheduled' && (
                        <>
                          <Button size="sm" onClick={() => {
                            advanceDeliveryOrder(d.id)
                            pushToast({ kind: 'info', title: 'Vehicle at weighbridge', body: 'Tare recorded — gross weighment in progress at the yard.' })
                          }}>
                            <Scale size={14} /> Vehicle at weighbridge
                          </Button>
                          <span className="text-xs text-ink-muted num">Lift by {relTime(d.liftingBy, now).replace('in ', '')} from now — demurrage applies after.</span>
                        </>
                      )}
                      {d.stage === 'weighment' && (
                        <Button size="sm" variant="success" onClick={() => {
                          const weighed = Math.round(d.awardedQty * (1 + (Math.random() * 0.06 - 0.03)) * 100) / 100
                          advanceDeliveryOrder(d.id)
                          pushToast({
                            kind: 'success',
                            title: `Weighment confirmed — ${num(weighed)} ${d.uom}`,
                            body: `Indicative was ${num(d.awardedQty)} ${d.uom}. Invoice adjusts pro-rata at ${inr(d.h1Rate)}/${d.uom} on the weighed quantity.`,
                          })
                        }}>
                          <Scale size={14} /> Confirm weighment
                        </Button>
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

      <MockPayModal
        open={!!payDo && payBalance > 0}
        onClose={() => setPayDoId(null)}
        title={`Balance payment — ${payDo?.id.toUpperCase() ?? ''}`}
        amount={inr(payBalance)}
        onSuccess={() => {
          if (!payDo) return
          advanceDeliveryOrder(payDo.id)
          pushToast({ kind: 'success', title: 'Payment settled — DO issued', body: 'Your delivery order is ready to download.' })
          setPayDoId(null)
        }}
      />
    </Page>
  )
}
