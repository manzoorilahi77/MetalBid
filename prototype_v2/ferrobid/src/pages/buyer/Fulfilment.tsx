/* Fulfilment tracker — auction-wise. The index lists every auction you won lots
   in; opening one shows the full DD → delivery order → lifting → gate pass
   tracker for each of its lots. */
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, FileDown, Landmark, MapPin, Scale, Truck, UserRound } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, EmptyState, Input, PageHeader, PhotoThumb, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, inrCompact, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type { Catalogue, DeliveryOrder, FulfilmentStage } from '../../types'

const STAGES: { key: FulfilmentStage; label: string }[] = [
  { key: 'payment_pending', label: 'Payment' },
  { key: 'dd_issued', label: 'DD received' },
  { key: 'lifting_scheduled', label: 'Lifting scheduled' },
  { key: 'lifted', label: 'Lifted' },
  { key: 'completed', label: 'Completed' },
]

const stageIndex = (d: DeliveryOrder) => Math.max(0, STAGES.findIndex((s) => s.key === d.stage))

/** How far one delivery order has travelled through the stage pipeline, 0–1. */
const stageProgress = (d: DeliveryOrder) => stageIndex(d) / (STAGES.length - 1)

/** Money + stage rollup for one auction's delivery orders. */
function summarise(dos: DeliveryOrder[]) {
  const total = dos.reduce((s, d) => s + d.materialValue + d.gstAmount + d.tcsAmount, 0)
  const paid = dos.reduce((s, d) => s + d.paidAmount, 0)
  const open = dos.filter((d) => d.stage !== 'completed')
  const completed = dos.length - open.length
  const progress = dos.reduce((s, d) => s + stageProgress(d), 0) / dos.length
  // Quantity only aggregates when every lot shares a unit — MT and PCS don't add up
  const uom = dos.every((d) => d.uom === dos[0].uom) ? dos[0].uom : null
  return {
    total,
    balance: total - paid,
    completed,
    awaitingPayment: dos.filter((d) => d.stage === 'payment_pending').length,
    open,
    uom,
    qty: dos.reduce((s, d) => s + d.awardedQty, 0),
    // hold short of 100 unless every lot is truly closed — a rounded-up 100% lies
    pct: completed === dos.length ? 100 : Math.min(99, Math.round(progress * 100)),
    // soonest deadline still outstanding — that's what the buyer must act on
    nextLiftingBy: open.length
      ? open.reduce((a, b) => (Date.parse(a.liftingBy) < Date.parse(b.liftingBy) ? a : b)).liftingBy
      : null,
  }
}

export default function Fulfilment() {
  const me = useStore((s) => s.currentUser)
  const deliveryOrders = useStore((s) => s.deliveryOrders)
  const catalogues = useStore((s) => s.catalogues)
  // ?auction= drives the drill-down, so a specific auction's tracker is linkable
  const [params] = useSearchParams()

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

  // One group per auction, newest delivery order first (myDos is already sorted)
  const groups = catalogues
    .map((cat) => ({ cat, dos: myDos.filter((d) => d.catalogueId === cat.id) }))
    .filter((g) => g.dos.length > 0)
    .sort((a, b) => Date.parse(b.dos[0].createdAt) - Date.parse(a.dos[0].createdAt))

  const openId = params.get('auction')
  const open = groups.find((g) => g.cat.id === openId) ?? null

  if (myDos.length === 0) {
    return (
      <Page>
        <PageHeader title="Fulfilment tracker" sub={INTRO} />
        <EmptyState
          icon={<Truck size={32} strokeWidth={1.5} />}
          title="No delivery orders yet"
          body="Win a lot as confirmed H1 and its delivery order will be tracked here end-to-end."
          action={<Link to="/buyer/bids"><Button variant="secondary">See my bids</Button></Link>}
        />
      </Page>
    )
  }

  /* ----------------------------- auction detail ---------------------------- */
  if (open) {
    const s = summarise(open.dos)
    return (
      <Page>
        <Link to="/buyer/fulfilment"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-steel hover:underline mb-3">
          <ArrowLeft size={14} /> All auctions
        </Link>
        <PageHeader
          title={open.cat.title}
          sub={`${open.dos.length} won lot${open.dos.length > 1 ? 's' : ''} in this auction. ${INTRO}`}
        />
        <div className="flex flex-wrap items-center gap-2 -mt-2 mb-5">
          <span className="num text-sm font-bold">{open.cat.code}</span>
          <span className="text-sm text-ink-muted inline-flex items-center gap-1">
            <MapPin size={13} className="text-ink-faint" /> {open.cat.yardName} · {open.cat.region}
          </span>
          <span className="text-sm text-ink-muted">
            Order value <b className="num text-ink">{inr(s.total)}</b>
          </span>
          {s.balance > 0 && (
            <Chip tone="warning" className="num">Balance {inr(s.balance)}</Chip>
          )}
        </div>

        <div className="space-y-5">
          {open.dos.map((d) => <DeliveryOrderCard key={d.id} d={d} />)}
        </div>
      </Page>
    )
  }

  /* ------------------------------ auction list ----------------------------- */
  return (
    <Page>
      <PageHeader title="Fulfilment tracker" sub={INTRO} />
      <div className="grid md:grid-cols-2 gap-3">
        {groups.map(({ cat, dos }) => <AuctionCard key={cat.id} cat={cat} dos={dos} />)}
      </div>
    </Page>
  )
}

const INTRO = 'Won lots move Demand Draft → delivery order → lifting → weighbridge checklist → gate pass. Invoices adjust pro-rata on final weighed quantity.'

/* --------------------------------------------------------------------------
   Auction summary tile — one per auction on the index.
--------------------------------------------------------------------------- */
function AuctionCard({ cat, dos }: { cat: Catalogue; dos: DeliveryOrder[] }) {
  const lots = useStore((s) => s.lots)
  const now = useNow()
  const s = summarise(dos)
  const lotById = new Map(lots.map((l) => [l.id, l]))
  const myLots = dos.map((d) => lotById.get(d.lotId)).filter((l): l is NonNullable<typeof l> => !!l)
  const allDone = s.open.length === 0
  const overdue = s.nextLiftingBy != null && Date.parse(s.nextLiftingBy) - now < 0

  return (
    <Link to={`/buyer/fulfilment?auction=${cat.id}`} className="card card-hover group p-4 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="num text-sm font-bold">{cat.code}</span>
            {allDone
              ? <Chip tone="success"><Check size={12} /> All fulfilled</Chip>
              : s.awaitingPayment > 0
                ? <Chip tone="warning">{s.awaitingPayment} awaiting payment</Chip>
                : <Chip tone="ember">{s.open.length} in progress</Chip>}
          </div>
          <div className="font-display font-bold leading-snug line-clamp-2 mt-1">{cat.title}</div>
          <div className="text-xs text-ink-muted mt-0.5 flex items-start gap-1">
            <MapPin size={12} className="text-ink-faint shrink-0 mt-[3px]" />
            <span>{cat.yardName} · {cat.region}</span>
          </div>
        </div>
        <div className="flex -space-x-2 shrink-0">
          {myLots.slice(0, 3).map((l) => (
            <PhotoThumb key={l.id} hue={l.photos[0]?.hue ?? 24} category={l.category}
              className="w-11 h-9 ring-2 ring-surface" />
          ))}
        </div>
      </div>

      {/* Labels stay on one line at every width — a wrapped label would drop its
          own column's figure out of line with the other two. */}
      <dl className={cx('grid grid-cols-3 gap-2 text-center [&_dt]:whitespace-nowrap [&_dd]:whitespace-nowrap',
        '[&_dt]:text-[10px] sm:[&_dt]:text-[11px] [&_dt]:uppercase [&_dt]:tracking-wide sm:[&_dt]:tracking-wider [&_dt]:text-ink-faint')}>
        <div>
          <dt>Won lots</dt>
          <dd className="num text-base sm:text-lg font-bold">{dos.length}</dd>
          <dd className="text-[10px] sm:text-[11px] text-ink-faint">
            {s.uom ? <><span className="num">{num(s.qty)}</span> {s.uom}</> : 'mixed units'}
          </dd>
        </div>
        <div>
          <dt>Order value</dt>
          <dd className="num text-base sm:text-lg font-bold">{inrCompact(s.total)}</dd>
          <dd className="text-[10px] sm:text-[11px] text-ink-faint">incl. GST &amp; TCS</dd>
        </div>
        <div>
          <dt>Balance</dt>
          <dd className={cx('num text-base sm:text-lg font-bold', s.balance > 0 ? 'text-warning' : 'text-ink-faint')}>
            {s.balance > 0 ? inrCompact(s.balance) : '—'}
          </dd>
          <dd className="text-[10px] sm:text-[11px] text-ink-faint">{s.balance > 0 ? 'payable by DD' : 'fully paid'}</dd>
        </div>
      </dl>

      {/* Fulfilment progress — one segment per won lot, each filled by how far
          that lot has moved through the five stages. Green = closed, ember =
          under way; the same colour language as the per-lot stage tracker. */}
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Fulfilment</span>
          <span className={cx('num text-sm font-bold', allDone ? 'text-success' : 'text-ember')}>{s.pct}%</span>
        </div>
        <div className="mt-1.5 flex items-center gap-1" role="progressbar"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.pct}
          aria-label={`Fulfilment ${s.pct}% complete across ${dos.length} lot${dos.length > 1 ? 's' : ''}`}>
          {dos.map((d) => {
            const done = d.stage === 'completed'
            return (
              <span key={d.id} className="h-1.5 flex-1 rounded-full bg-surface-3 overflow-hidden"
                title={`${lotById.get(d.lotId)?.lotNo ?? d.lotId} — ${STAGES[stageIndex(d)].label}`}>
                <span className={cx('block h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.33,1,0.68,1)]',
                  done ? 'bg-success' : 'bg-ember')}
                  style={{ width: `${Math.round(stageProgress(d) * 100)}%` }} />
              </span>
            )
          })}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-3 border-t border-line">
        <span className="text-xs text-ink-muted">
          {allDone
            ? <span className="text-success font-semibold">Lifted &amp; settled</span>
            : s.nextLiftingBy && (
              <>Next lifting <span className={cx('num font-semibold', overdue ? 'text-danger' : 'text-ink')}>
                {relTime(s.nextLiftingBy, now)}</span></>
            )}
        </span>
        <span className="text-xs font-semibold text-steel inline-flex items-center gap-1">
          View lots
          <ArrowRight size={13} className="transition-transform duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  )
}

/* --------------------------------------------------------------------------
   Per-lot delivery order tracker.
--------------------------------------------------------------------------- */
function DeliveryOrderCard({ d }: { d: DeliveryOrder }) {
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const advanceDeliveryOrder = useStore((s) => s.advanceDeliveryOrder)
  const toggleLiftingChecklistItem = useStore((s) => s.toggleLiftingChecklistItem)
  const recordWeighment = useStore((s) => s.recordWeighment)
  const completeLifting = useStore((s) => s.completeLifting)
  const pushToast = useStore((s) => s.pushToast)
  const now = useNow()
  const [weighInput, setWeighInput] = useState('')

  const lot = lots.find((l) => l.id === d.lotId)
  const cat = catalogues.find((c) => c.id === d.catalogueId)
  const total = d.materialValue + d.gstAmount + d.tcsAmount
  const balance = total - d.paidAmount
  const stageIdx = STAGES.findIndex((s) => s.key === d.stage)
  const liftMsLeft = Date.parse(d.liftingBy) - now
  const checklistDone = d.liftingChecklist.every((i) => i.done)

  return (
    <section className="card overflow-hidden">
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
                          value={weighInput}
                          onChange={(e) => setWeighInput(e.target.value)} />
                        <Button size="sm" onClick={() => {
                          const qty = Number(weighInput)
                          if (!(qty > 0)) return
                          recordWeighment(d.id, qty)
                          pushToast({ kind: 'success', title: `Weighment confirmed — ${num(qty)} ${d.uom}`, body: `Indicative was ${num(d.awardedQty)} ${d.uom}. Invoice adjusts pro-rata at ${inr(d.h1Rate)}/${d.uom}.` })
                          setWeighInput('')
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
}
