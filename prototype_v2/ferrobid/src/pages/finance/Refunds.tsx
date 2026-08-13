/* ---------------------------------------------------------------------------
   Finance Administrator — refunds.

   Money can enter the platform and be held, but until now it could never be
   deliberately returned outside the automatic EMD release. That left three real
   situations with nowhere to go: a cancelled auction, a weighment that came in
   short of the awarded quantity, and a dispute resolved in the buyer's favour.

   Approving a refund and paying it are two different acts, and the page keeps
   them apart: raise → decide → process. Above the configured threshold the
   decision leaves this desk for the CEO's signature; the request stays visible
   here the whole time, because an item that vanishes while it is being decided
   is how people end up raising it twice.
--------------------------------------------------------------------------- */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Check, CheckCircle2, Plus, RotateCcw, Scale, Search, Signature, Truck, X,
} from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Button, Chip, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea, cx,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, num, fmtDateTime, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import { doDue } from '../../lib/money'
import { Ageing, MoneyReasonModal, MoneyStat, QueueStrip, ScopeNote, SectionTitle, ThresholdNote } from './shared'
import type { RefundRequest, RefundSource } from '../../types'

type Tab = 'decide' | 'process' | 'signature' | 'done'

const SOURCE_LABEL: Record<RefundSource, string> = {
  cancellation: 'Auction cancelled',
  weighment_shortfall: 'Weighment shortfall',
  dispute: 'Dispute resolved',
  overpayment: 'Overpayment',
}
const SOURCE_ICON: Record<RefundSource, typeof Truck> = {
  cancellation: X, weighment_shortfall: Scale, dispute: RotateCcw, overpayment: Plus,
}

/* ---------------------------- raise a refund -------------------------------- */
function RaiseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const users = useStore((s) => s.users)
  const deliveryOrders = useStore((s) => s.deliveryOrders)
  const lots = useStore((s) => s.lots)
  const cfg = useStore((s) => s.financeConfig)
  const raiseRefund = useStore((s) => s.raiseRefund)
  const pushToast = useStore((s) => s.pushToast)

  const [userId, setUserId] = useState('')
  const [source, setSource] = useState<RefundSource>('weighment_shortfall')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [doId, setDoId] = useState('')

  const customers = users.filter((u) => u.role === 'buyer' || u.role === 'seller')
  const theirOrders = deliveryOrders.filter((d) => d.buyerId === userId)
  const value = Number(amount.replace(/[^\d]/g, ''))
  const picked = deliveryOrders.find((d) => d.id === doId)
  const overThreshold = value >= cfg.ceoRefundFrom
  const canSubmit = !!userId && value > 0 && reason.trim().length >= 4

  const reset = () => { setUserId(''); setSource('weighment_shortfall'); setAmount(''); setReason(''); setDoId('') }
  const close = () => { reset(); onClose() }

  const submit = () => {
    const res = raiseRefund({
      userId, amount: value, source, reason: reason.trim(),
      lotId: picked?.lotId, catalogueId: picked?.catalogueId,
    })
    if (!res.ok) {
      pushToast({ kind: 'danger', title: 'Not raised', body: res.error })
      return
    }
    pushToast(res.awaitingCeo
      ? { kind: 'info', title: 'Sent for CEO signature', body: `${inr(value)} is above ${inr(cfg.ceoRefundFrom)}. Nothing is credited until it is signed.` }
      : { kind: 'success', title: 'Refund raised', body: 'Decide it, then process it — approving and paying are two steps.' })
    close()
  }

  return (
    <Modal open={open} onClose={close} title="Raise a refund">
      <div className="space-y-4">
        <Field label="Who is owed the money">
          <Select value={userId} onChange={(e) => { setUserId(e.target.value); setDoId('') }}>
            <option value="">Choose a customer…</option>
            {customers.map((u) => <option key={u.id} value={u.id}>{u.firm} — {u.name}</option>)}
          </Select>
        </Field>

        <Field label="Why the money goes back">
          <Select value={source} onChange={(e) => setSource(e.target.value as RefundSource)}>
            {(Object.keys(SOURCE_LABEL) as RefundSource[]).map((k) => <option key={k} value={k}>{SOURCE_LABEL[k]}</option>)}
          </Select>
        </Field>

        {theirOrders.length > 0 && (
          <Field label="Against which delivery order" hint="Optional, but it is what makes the refund traceable to a lot.">
            <Select value={doId} onChange={(e) => setDoId(e.target.value)}>
              <option value="">Not tied to a specific lot</option>
              {theirOrders.map((d) => {
                const l = lots.find((x) => x.id === d.lotId)
                return <option key={d.id} value={d.id}>{l?.lotNo ?? d.lotId} — paid {inr(d.paidAmount)} of {inr(doDue(d))}</option>
              })}
            </Select>
          </Field>
        )}

        <Field label="Amount" hint={picked ? `The buyer has paid ${inr(picked.paidAmount)} on this order.` : undefined}>
          <Input className="num text-right" inputMode="numeric"
            value={value ? value.toLocaleString('en-IN') : ''}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} placeholder="0" />
        </Field>

        <Field label="Reason" hint="Shown to the customer and recorded against your name.">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Gross weighment came in 1.8% under the awarded quantity — value of the shortfall returns to the buyer…" />
        </Field>

        {overThreshold && (
          <div className="card border-l-4 border-l-steel bg-steel-soft/30 p-3.5 text-[13px] flex items-start gap-2.5">
            <Signature size={15} className="text-steel shrink-0 mt-0.5" />
            <span>
              <strong className="text-ink">This goes to the CEO.</strong> {inr(value)} is at or above{' '}
              <span className="num font-bold">{inr(cfg.ceoRefundFrom)}</span>, so it is raised as a request rather than
              approved here. It stays on this screen while it waits.
            </span>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button disabled={!canSubmit} onClick={submit}>{overThreshold ? 'Send for signature' : 'Raise refund'}</Button>
        </div>
      </div>
    </Modal>
  )
}

/* --------------------------------- page ------------------------------------ */
export default function Refunds() {
  const now = useNow()
  const refunds = useStore((s) => s.refundRequests)
  const users = useStore((s) => s.users)
  const lots = useStore((s) => s.lots)
  const cfg = useStore((s) => s.financeConfig)
  const decide = useStore((s) => s.decideRefund)
  const process = useStore((s) => s.processRefund)
  const pushToast = useStore((s) => s.pushToast)

  const [tab, setTab] = useState<Tab>('decide')
  const [q, setQ] = useState('')
  const [raising, setRaising] = useState(false)
  const [refusing, setRefusing] = useState<RefundRequest | null>(null)

  const toDecide = refunds.filter((r) => r.status === 'pending')
  const awaitingCeo = refunds.filter((r) => r.status === 'awaiting_ceo')
  const toProcess = refunds.filter((r) => r.status === 'approved')
  const done = refunds.filter((r) => r.status === 'processed' || r.status === 'rejected')

  const shown = useMemo(() => {
    const base = tab === 'decide' ? toDecide : tab === 'process' ? toProcess : tab === 'signature' ? awaitingCeo : done
    const query = q.trim().toLowerCase()
    return base
      .filter((r) => {
        if (!query) return true
        const u = users.find((x) => x.id === r.userId)
        return (u?.firm ?? '').toLowerCase().includes(query) || r.reason.toLowerCase().includes(query)
      })
      .sort((a, b) => Date.parse(b.raisedAt) - Date.parse(a.raisedAt))
  }, [tab, toDecide, toProcess, awaitingCeo, done, q, users])

  const doProcess = (r: RefundRequest) => {
    const res = process(r.id)
    if (!res.ok) {
      pushToast({ kind: 'danger', title: 'Not processed', body: res.error })
      return
    }
    const u = users.find((x) => x.id === r.userId)
    pushToast({ kind: 'success', title: 'Refund credited', body: `${inr(r.amount)} is back in ${u?.firm ?? 'the customer'}'s wallet.` })
  }

  return (
    <Page>
      <PageHeader
        title="Refunds"
        sub="Money going deliberately back to a customer — outside the automatic EMD release, which needs no decision at all."
        actions={<Button size="sm" onClick={() => setRaising(true)}><Plus size={15} /> Raise a refund</Button>}
      />

      <QueueStrip steps={[
        { label: 'To decide', count: toDecide.length, urgent: true, onClick: () => setTab('decide'), active: tab === 'decide' },
        { label: 'Approved — to pay', count: toProcess.length, urgent: toProcess.length > 0, onClick: () => setTab('process'), active: tab === 'process' },
        { label: 'Away for signature', count: awaitingCeo.length, onClick: () => setTab('signature'), active: tab === 'signature' },
        { label: 'Settled', count: done.length, onClick: () => setTab('done'), active: tab === 'done' },
      ]} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MoneyStat label="Awaiting a decision" amount={toDecide.reduce((s, r) => s + r.amount, 0)} tone="risk" sub={`${num(toDecide.length)} raised`} />
        <MoneyStat label="Approved, not yet paid" amount={toProcess.reduce((s, r) => s + r.amount, 0)} tone="out" sub="customers are waiting" />
        <MoneyStat label="With the CEO" amount={awaitingCeo.reduce((s, r) => s + r.amount, 0)} tone="held" sub={`at or above ${inr(cfg.ceoRefundFrom)}`} />
        <MoneyStat label="Returned all time" amount={refunds.filter((r) => r.status === 'processed').reduce((s, r) => s + r.amount, 0)} tone="in" sub="credited to wallets" />
      </div>

      <SectionTitle
        title={tab === 'decide' ? 'Awaiting a decision'
          : tab === 'process' ? 'Approved — waiting to be paid'
            : tab === 'signature' ? 'Away for the CEO’s signature' : 'Settled'}
        count={shown.length}
        sub={tab === 'decide' ? 'Approving does not move any money. Paying it is a separate step, so an approval can be reviewed before it lands.'
          : tab === 'process' ? 'Processing credits the wallet immediately and notifies the customer.'
            : tab === 'signature' ? 'Above the threshold. Nothing has been credited and the customer has not been promised anything.'
              : 'Every refund that has finished, whether it was paid or refused.'}
        action={
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            <Input className="h-9 w-56 pl-9" placeholder="Firm or reason…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        }
      />

      {shown.length === 0 ? (
        <EmptyState
          icon={<RotateCcw size={32} strokeWidth={1.5} />}
          title={tab === 'decide' ? 'No refund is waiting on a decision' : q ? 'Nothing matches that search' : 'Nothing here'}
          body={tab === 'decide'
            ? 'Refunds arise from cancelled auctions, weighment shortfalls and resolved disputes. Raise one from the button above, or from a dispute.'
            : 'Refunds move through raise → decide → pay, and every step stays on the record.'}
          action={tab === 'decide' ? <Button size="sm" onClick={() => setRaising(true)}><Plus size={15} /> Raise a refund</Button> : undefined}
        />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {shown.map((r) => {
            const u = users.find((x) => x.id === r.userId)
            const lot = lots.find((l) => l.id === r.lotId)
            const decider = users.find((x) => x.id === r.decidedBy)
            const Icon = SOURCE_ICON[r.source]
            return (
              <div key={r.id} className="flex flex-wrap items-start gap-3 px-4 py-3.5 hover:bg-surface-2 transition-colors">
                <span className={cx('size-9 rounded-xl grid place-items-center shrink-0 mt-0.5',
                  r.status === 'processed' ? 'bg-success-soft text-success'
                    : r.status === 'rejected' ? 'bg-danger-soft text-danger'
                      : r.status === 'awaiting_ceo' ? 'bg-steel-soft text-steel' : 'bg-warning-soft text-warning')}>
                  {r.status === 'awaiting_ceo' ? <Signature size={16} /> : <Icon size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">{u?.firm ?? r.userId}</span>
                    <Chip tone="neutral">{SOURCE_LABEL[r.source]}</Chip>
                    {lot && <span className="num text-[12px] font-bold text-ember">{lot.lotNo}</span>}
                    {r.status === 'processed' && <Chip tone="success"><CheckCircle2 size={11} /> Credited</Chip>}
                    {r.status === 'rejected' && <Chip tone="danger">Refused</Chip>}
                    {r.status === 'approved' && <Chip tone="warning">Approved — not yet paid</Chip>}
                    {r.status === 'awaiting_ceo' && <Chip tone="steel">With the CEO</Chip>}
                  </div>
                  <div className="text-[13px] text-ink-muted mt-0.5">{r.reason}</div>
                  <div className="text-[11px] text-ink-faint mt-1">
                    Raised {relTime(r.raisedAt, now)}
                    {r.decidedAt && <> · {r.status === 'rejected' ? 'refused' : 'approved'} by {decider?.name ?? 'Finance'} {fmtDateTime(r.decidedAt)}</>}
                    {r.processedAt && <> · credited {fmtDateTime(r.processedAt)}</>}
                  </div>
                  {r.decisionNote && <div className="text-[12px] text-ink-muted mt-0.5 italic">{r.decisionNote}</div>}
                </div>
                {(r.status === 'pending' || r.status === 'approved') && <Ageing since={r.raisedAt} now={now} warnDays={3} dangerDays={7} />}
                <div className="num text-base font-bold tabular-nums shrink-0 w-28 text-right">{inr(r.amount)}</div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.status === 'pending' && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setRefusing(r)}><X size={13} /> Refuse</Button>
                      <Button size="sm" onClick={() => { decide(r.id, true); pushToast({ kind: 'success', title: 'Refund approved', body: 'Now process it to actually credit the wallet.' }) }}>
                        <Check size={13} /> Approve
                      </Button>
                    </>
                  )}
                  {r.status === 'approved' && (
                    <Button size="sm" variant="success" onClick={() => doProcess(r)}>Credit {inr(r.amount)} <ArrowRight size={13} /></Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-4">
        <ThresholdNote amount={cfg.ceoRefundFrom} label="Refunds" />
      </div>

      <SectionTitle title="Where refunds come from" sub="Three situations produce one, and each is somebody else's decision before it becomes Finance's." />
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { icon: X, title: 'An auction is cancelled', body: 'A Super Admin approving a cancellation releases every locked EMD automatically. Anything already paid against a delivery order needs a refund raising here.', to: '/admin/control-tower', cta: 'Emergency override' },
          { icon: Scale, title: 'Weighment comes in short', body: 'The buyer records gross weighment at lifting. If it is under the awarded quantity, the value of the shortfall goes back.', to: '/finance/payments', cta: 'Delivery orders' },
          { icon: RotateCcw, title: 'A dispute is resolved', body: 'The Sub Admin resolves the ticket and the commercial outcome lands here. Finance decides the money, not the dispute.', to: '/disputes', cta: 'Disputes' },
        ].map((c) => (
          <div key={c.title} className="card p-4">
            <span className="size-9 rounded-xl bg-surface-2 text-ink-muted grid place-items-center"><c.icon size={16} /></span>
            <div className="font-semibold text-sm mt-2.5">{c.title}</div>
            <p className="text-[12px] text-ink-muted mt-1">{c.body}</p>
            <Link to={c.to} className="text-[12px] font-bold text-ember hover:underline mt-2 inline-flex items-center gap-1">{c.cta} <ArrowRight size={11} /></Link>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <ScopeNote>
          Returning money to a customer is the one direction this desk can move on its own up to{' '}
          {inr(cfg.ceoRefundFrom)} — because refusing a refund is the harmful act, not granting one. Whether a dispute
          was decided correctly is not settled here; the Sub Admin closes the ticket and Finance pays what follows from it.
        </ScopeNote>
      </div>

      <RaiseModal open={raising} onClose={() => setRaising(false)} />

      <MoneyReasonModal
        open={!!refusing}
        onClose={() => setRefusing(null)}
        title="Refuse this refund"
        intent="danger"
        confirmLabel="Refuse"
        summary={
          <>
            <strong>{inr(refusing?.amount ?? 0)}</strong> will not be returned to{' '}
            <strong>{users.find((u) => u.id === refusing?.userId)?.firm ?? 'the customer'}</strong>. They are told why, and any
            open dispute stays open — refusing a refund does not close anything.
          </>
        }
        presets={[
          'Weighment variance is inside the tolerance stated in the auction terms.',
          'The dispute was resolved in the platform’s favour — no adjustment is due.',
          'Amount already recovered against a later delivery order.',
        ]}
        placeholder="Why the money stays with us…"
        onConfirm={(reason) => {
          if (!refusing) return
          decide(refusing.id, false, reason)
          pushToast({ kind: 'info', title: 'Refund refused', body: 'The customer has been told the reason.' })
          setRefusing(null)
        }}
      />
    </Page>
  )
}
