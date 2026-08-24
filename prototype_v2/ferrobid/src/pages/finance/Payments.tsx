/* ---------------------------------------------------------------------------
   Finance Administrator — buyer payments & delivery orders.

   Moved out of Operations' Settlement screen. The distinction matters: the
   *material* is Operations' problem and the *money* is this desk's, and until
   Finance confirms the money has arrived, Operations should not be scheduling a
   truck. Confirming a receipt here is the hand-off that releases the delivery
   order for lifting.

   The page is ordered by what it costs to leave alone — overdue first, then due,
   then paid — rather than by delivery stage, because a lot that is three weeks
   unpaid is a forfeiture waiting to happen, not a logistics row.
--------------------------------------------------------------------------- */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, BellRing, Check, FileText, Search, Truck } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Avatar, Button, Chip, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea, cx,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, inrCompact, num, fmtDate } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import { AGE_BUCKETS, ageBucket, daysOverdue, doDue, doOutstanding } from '../../lib/money'
import { MoneyStat, QueueStrip, ScopeNote, SectionTitle } from '../shared/finance'
import type { DeliveryOrder } from '../../types'

type Tab = 'overdue' | 'due' | 'paid' | 'all'

const STAGE_LABEL: Record<DeliveryOrder['stage'], string> = {
  payment_pending: 'Payment pending',
  dd_issued: 'Payment received',
  lifting_scheduled: 'Lifting scheduled',
  lifted: 'Lifted',
  completed: 'Completed',
}

/* --------------------------- record a receipt ------------------------------ */
function ReceiptModal({ order, onClose }: { order: DeliveryOrder | null; onClose: () => void }) {
  const users = useStore((s) => s.users)
  const lots = useStore((s) => s.lots)
  const cfg = useStore((s) => s.financeConfig)
  const confirmBuyerPayment = useStore((s) => s.confirmBuyerPayment)
  const issueDemandDraft = useStore((s) => s.issueDemandDraft)
  const issueInvoice = useStore((s) => s.issueInvoice)
  const pushToast = useStore((s) => s.pushToast)

  const [method, setMethod] = useState('RTGS')
  const [ref, setRef] = useState('')
  const [ddNumber, setDdNumber] = useState('')
  const [bank, setBank] = useState('HDFC Bank')
  const [alsoInvoice, setAlsoInvoice] = useState(true)

  if (!order) return null
  const buyer = users.find((u) => u.id === order.buyerId)
  const lot = lots.find((l) => l.id === order.lotId)
  const due = doDue(order)
  const isDd = method === 'Demand Draft'
  const canSubmit = isDd ? ddNumber.trim().length >= 4 : ref.trim().length >= 4

  const submit = () => {
    if (isDd) {
      issueDemandDraft(order.id, { ddNumber: ddNumber.trim(), issuingBank: bank, amount: due })
    } else {
      const res = confirmBuyerPayment(order.id, method, ref.trim())
      if (!res.ok) {
        pushToast({ kind: 'danger', title: 'Could not record the receipt', body: res.error })
        return
      }
    }
    if (alsoInvoice) {
      issueInvoice({
        kind: 'buyer_invoice', partyId: order.buyerId, catalogueId: order.catalogueId,
        lotId: order.lotId, doId: order.id,
        taxable: order.materialValue, gst: order.gstAmount, tcs: order.tcsAmount,
      })
    }
    pushToast({
      kind: 'success', title: 'Receipt recorded',
      body: `${inr(due)} against ${lot?.lotNo ?? 'the lot'}. Operations can schedule lifting.`,
    })
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="Record what the buyer has paid">
      <div className="space-y-4">
        <div className="card bg-surface-2 border-0 p-4">
          <div className="flex items-start gap-3">
            <Avatar name={buyer?.name ?? '?'} hue={buyer?.avatarHue ?? 200} size={36} />
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm">{buyer?.firm ?? order.buyerId}</div>
              <div className="text-xs text-ink-muted">{lot?.lotNo ?? order.lotId} · {lot?.metal} {lot?.grade}</div>
            </div>
            <div className="num text-lg font-bold shrink-0">{inr(due)}</div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-line text-[12px]">
            <div><div className="text-ink-faint">Material</div><div className="num font-semibold">{inr(order.materialValue)}</div></div>
            <div><div className="text-ink-faint">GST @ {cfg.gstPct}%</div><div className="num font-semibold">{inr(order.gstAmount)}</div></div>
            <div><div className="text-ink-faint">TCS @ {cfg.tcsPct}%</div><div className="num font-semibold">{inr(order.tcsAmount)}</div></div>
          </div>
        </div>

        <Field label="How it came in">
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option>RTGS</option>
            <option>NEFT</option>
            <option>UPI</option>
            <option>Demand Draft</option>
          </Select>
        </Field>

        {isDd ? (
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="DD number"><Input className="num" value={ddNumber} onChange={(e) => setDdNumber(e.target.value)} placeholder="004512" /></Field>
            <Field label="Issuing bank"><Input value={bank} onChange={(e) => setBank(e.target.value)} /></Field>
          </div>
        ) : (
          <Field label="Bank reference / UTR" hint="Recorded on the receipt and used when this is reconciled against the statement.">
            <Input className="num" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="UTR…" />
          </Field>
        )}

        <label className="flex items-start gap-2.5 text-[13px] cursor-pointer">
          <input type="checkbox" checked={alsoInvoice} onChange={(e) => setAlsoInvoice(e.target.checked)} className="mt-0.5 accent-ember size-4" />
          <span>Issue the tax invoice at the same time — <span className="text-ink-muted">GST and TCS are already computed on this order; the document is generated, never typed.</span></span>
        </label>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="success" disabled={!canSubmit} onClick={submit}><Check size={15} /> Confirm {inr(due)} received</Button>
        </div>
      </div>
    </Modal>
  )
}

/* --------------------------------- page ------------------------------------ */
export default function Payments() {
  const now = useNow()
  const deliveryOrders = useStore((s) => s.deliveryOrders)
  const users = useStore((s) => s.users)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const cfg = useStore((s) => s.financeConfig)
  const flagOverdue = useStore((s) => s.flagOverduePayment)
  const pushToast = useStore((s) => s.pushToast)

  const [tab, setTab] = useState<Tab>('overdue')
  const [q, setQ] = useState('')
  const [receipt, setReceipt] = useState<DeliveryOrder | null>(null)
  const [chase, setChase] = useState<DeliveryOrder | null>(null)
  const [chaseNote, setChaseNote] = useState('')

  const rows = useMemo(() => deliveryOrders.map((d) => {
    const overdueBy = daysOverdue(d, cfg, now)
    return {
      d,
      buyer: users.find((u) => u.id === d.buyerId),
      lot: lots.find((l) => l.id === d.lotId),
      cat: catalogues.find((c) => c.id === d.catalogueId),
      due: doDue(d),
      outstanding: doOutstanding(d),
      overdueBy,
    }
  }), [deliveryOrders, users, lots, catalogues, cfg, now])

  const overdue = rows.filter((r) => r.outstanding > 0 && r.overdueBy > 0)
  const dueSoon = rows.filter((r) => r.outstanding > 0 && r.overdueBy <= 0)
  const paid = rows.filter((r) => r.outstanding <= 0)

  const shown = useMemo(() => {
    const base = tab === 'overdue' ? overdue : tab === 'due' ? dueSoon : tab === 'paid' ? paid : rows
    const query = q.trim().toLowerCase()
    return base
      .filter((r) => !query
        || (r.buyer?.firm ?? '').toLowerCase().includes(query)
        || (r.lot?.lotNo ?? '').toLowerCase().includes(query)
        || (r.cat?.code ?? '').toLowerCase().includes(query))
      .sort((a, b) => b.overdueBy - a.overdueBy || b.outstanding - a.outstanding)
  }, [tab, overdue, dueSoon, paid, rows, q])

  /* Ageing on what is owed — how old the exposure is, not how big it is. */
  const ageing = useMemo(() => {
    const map = new Map(AGE_BUCKETS.map((b) => [b, { count: 0, amount: 0 }]))
    for (const r of rows) {
      if (r.outstanding <= 0) continue
      const b = map.get(ageBucket(r.d.createdAt, now))!
      b.count += 1
      b.amount += r.outstanding
    }
    return AGE_BUCKETS.map((b) => ({ bucket: b, ...map.get(b)! }))
  }, [rows, now])

  const doChase = () => {
    if (!chase) return
    flagOverdue(chase.id, chaseNote.trim())
    pushToast({ kind: 'info', title: 'Buyer chased', body: 'They have been notified, and the chase is on the audit trail.' })
    setChase(null); setChaseNote('')
  }

  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0)
  const forfeitable = overdue.filter((r) => r.overdueBy > 0)

  return (
    <Page>
      <PageHeader
        title="Buyer payments &amp; delivery orders"
        sub="What every winning buyer owes, what has arrived, and what is late. Confirming a receipt here is what releases the material for lifting."
        actions={
          forfeitable.length > 0
            ? <Link to="/finance/emd" className="inline-flex"><Chip tone="danger"><AlertTriangle size={12} /> {num(forfeitable.length)} past the payment window</Chip></Link>
            : <Chip tone="success">Everything inside terms</Chip>
        }
      />

      <QueueStrip steps={[
        { label: `Overdue · past ${cfg.paymentWindowDays} days`, count: overdue.length, urgent: true, onClick: () => setTab('overdue'), active: tab === 'overdue' },
        { label: 'Due, inside terms', count: dueSoon.length, onClick: () => setTab('due'), active: tab === 'due' },
        { label: 'Paid in full', count: paid.length, onClick: () => setTab('paid'), active: tab === 'paid' },
        { label: 'All delivery orders', count: rows.length, onClick: () => setTab('all'), active: tab === 'all' },
      ]} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MoneyStat label="Owed by buyers" amount={totalOutstanding} tone="risk" sub={`across ${num(rows.filter((r) => r.outstanding > 0).length)} delivery orders`} />
        <MoneyStat label="Overdue" amount={overdue.reduce((s, r) => s + r.outstanding, 0)} tone="out" sub={`past the ${cfg.paymentWindowDays}-day window`} />
        <MoneyStat label="Collected all time" amount={rows.reduce((s, r) => s + r.d.paidAmount, 0)} tone="in" sub="material, GST and TCS" />
        <MoneyStat label="Tax collected" amount={rows.reduce((s, r) => s + r.d.gstAmount + r.d.tcsAmount, 0)} tone="plain" sub={`GST ${cfg.gstPct}% · TCS ${cfg.tcsPct}%`} to="/finance/invoices" />
      </div>

      {/* ------------------------------ ageing ----------------------------- */}
      <SectionTitle title="How old the exposure is" sub="Age is what turns an unpaid lot into a forfeiture. Size alone does not." />
      <div className="card overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-line">
          {ageing.map((a) => (
            <div key={a.bucket} className={cx('px-4 py-3.5', a.bucket === '30+' && a.amount > 0 && 'bg-danger-soft/40')}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{a.bucket} days</div>
              <div className={cx('num text-xl font-bold mt-1', a.amount === 0 ? 'text-ink-faint' : a.bucket === '30+' ? 'text-danger' : a.bucket === '16–30' ? 'text-warning' : 'text-ink')}>
                {inrCompact(a.amount)}
              </div>
              <div className="text-[11px] text-ink-muted mt-0.5">{num(a.count)} order{a.count === 1 ? '' : 's'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------- rows ------------------------------ */}
      <SectionTitle
        title={tab === 'overdue' ? 'Overdue' : tab === 'due' ? 'Due, inside terms' : tab === 'paid' ? 'Paid' : 'Every delivery order'}
        count={shown.length}
        action={
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            <Input className="h-9 w-56 pl-9" placeholder="Firm, lot or auction…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        }
      />

      {shown.length === 0 ? (
        <EmptyState
          icon={<Truck size={32} strokeWidth={1.5} />}
          title={tab === 'overdue' ? 'Nothing is overdue' : q ? 'Nothing matches that search' : 'Nothing here'}
          body={tab === 'overdue'
            ? `Every buyer is inside the ${cfg.paymentWindowDays}-day payment window. Anything that slips past it appears here, and its EMD becomes forfeitable.`
            : 'Delivery orders are created automatically when a lot is won.'}
        />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {shown.map((r) => (
            <div key={r.d.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 hover:bg-surface-2 transition-colors">
              <Avatar name={r.buyer?.name ?? '?'} hue={r.buyer?.avatarHue ?? 200} size={34} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm truncate">{r.buyer?.firm ?? r.d.buyerId}</span>
                  <span className="num text-[12px] font-bold text-ember">{r.lot?.lotNo ?? ''}</span>
                  <Chip tone={r.outstanding <= 0 ? 'success' : r.overdueBy > 0 ? 'danger' : 'steel'}>
                    {r.outstanding <= 0 ? STAGE_LABEL[r.d.stage] : r.overdueBy > 0 ? `${r.overdueBy}d overdue` : 'Inside terms'}
                  </Chip>
                </div>
                <div className="text-[12px] text-ink-muted mt-0.5 truncate">
                  <span className="num">{r.cat?.code}</span> · {r.lot?.metal} {r.lot?.grade} · awarded {fmtDate(r.d.createdAt)} · lifting by {fmtDate(r.d.liftingBy)}
                </div>
                <div className="text-[11px] text-ink-faint mt-0.5 num">
                  material {inr(r.d.materialValue)} + GST {inr(r.d.gstAmount)} + TCS {inr(r.d.tcsAmount)}
                </div>
              </div>
              <div className="text-right shrink-0 w-32">
                <div className={cx('num text-base font-bold tabular-nums', r.outstanding > 0 ? 'text-warning' : 'text-success')}>
                  {r.outstanding > 0 ? inr(r.outstanding) : inr(r.due)}
                </div>
                <div className="text-[11px] text-ink-faint">{r.outstanding > 0 ? 'outstanding' : 'paid in full'}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {r.outstanding > 0 && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => setChase(r.d)}><BellRing size={13} /> Chase</Button>
                    <Button size="sm" onClick={() => setReceipt(r.d)}>Record receipt</Button>
                  </>
                )}
                {r.outstanding <= 0 && (
                  <Link to="/finance/invoices" className="text-[12px] font-bold text-ember hover:underline inline-flex items-center gap-1">
                    <FileText size={12} /> Invoice
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {forfeitable.length > 0 && (
        <>
          <SectionTitle
            title="Where this goes next"
            sub="A buyer past the payment window has EMD held against the same lot."
          />
          <div className="card border-l-4 border-l-warning p-4 flex flex-wrap items-center gap-3">
            <AlertTriangle size={18} className="text-warning shrink-0" />
            <p className="text-[13px] text-ink-muted flex-1 min-w-56">
              {num(forfeitable.length)} buyer{forfeitable.length === 1 ? ' is' : 's are'} past the {cfg.paymentWindowDays}-day window,
              holding {inrCompact(forfeitable.reduce((s, r) => s + (r.lot?.preBidEmd ?? 0), 0))} of EMD between them. Chase first —
              forfeiting takes money away from a customer and is never the opening move.
            </p>
            <Link to="/finance/emd" className="text-[13px] font-bold text-ember hover:underline inline-flex items-center gap-1 shrink-0">
              EMD ledger <ArrowRight size={13} />
            </Link>
          </div>
        </>
      )}

      <div className="mt-8">
        <ScopeNote>
          Finance confirms the money; Operations moves the material. Once a receipt is recorded here, the delivery order
          is released and the Operation Manager can schedule lifting on{' '}
          <Link to="/exec/logistics" className="text-ember font-semibold hover:underline">Logistics</Link>. This desk never
          advances a lifting stage, schedules a vehicle or closes a handover.
        </ScopeNote>
      </div>

      <ReceiptModal order={receipt} onClose={() => setReceipt(null)} />

      <Modal open={!!chase} onClose={() => setChase(null)} title="Chase this payment">
        <div className="space-y-4">
          <div className="card bg-warning-soft border-0 p-4 text-sm">
            The buyer is notified immediately and the chase is recorded against your name. It does not change the amount
            owed or the lifting deadline.
          </div>
          <Field label="What to tell them" hint="Shown to the buyer in their notifications.">
            <Textarea value={chaseNote} onChange={(e) => setChaseNote(e.target.value)}
              placeholder="Payment for LOT-14 is now past the 7-day window. Please transfer today to keep your lifting slot…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setChase(null)}>Cancel</Button>
            <Button variant="steel" disabled={chaseNote.trim().length < 4} onClick={doChase}>Send the chase</Button>
          </div>
        </div>
      </Modal>
    </Page>
  )
}
