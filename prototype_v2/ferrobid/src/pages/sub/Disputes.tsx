/* ---------------------------------------------------------------------------
   Sub Admin — Disputes & support.

   A buyer could raise a ticket and nobody could close it: the desk had a reply
   box and no resolution, so every dispute stayed open forever. This is the
   other end of `/disputes`.

   The one rule that shapes the screen: **a Sub Admin decides what is fair, and
   Finance moves the money.** Resolving in the customer's favour with money owed
   raises a refund into Finance's queue and deliberately leaves the ticket open
   until Finance has paid it — because from the customer's side, a dispute that
   is "resolved" and unpaid is not resolved.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Headset, MessageSquareWarning, Send, Timer } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Avatar, Button, Chip, EmptyState, Field, Input, PageHeader, Segmented, Select, Stat, Textarea, cx,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDateTime, inr, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type { Dispute, DisputeOutcome } from '../../types'

type Tab = 'open' | 'mine' | 'resolved'

const CATEGORY_LABEL: Record<Dispute['category'], string> = {
  payment: 'Payment', quality: 'Quality', quantity: 'Quantity', lifting: 'Lifting', other: 'Other',
}

const OUTCOME_LABEL: Record<DisputeOutcome, string> = {
  upheld: 'Upheld — the customer was right',
  declined: 'Declined — no change',
  refund_due: 'Upheld, money owed back',
  goodwill: 'Goodwill — closed without fault',
}

/** How long a ticket has been open, against the 8h SLA this desk works to. */
const ageHours = (iso: string, now: number) => (now - Date.parse(iso)) / 3_600_000

export default function SubDisputes() {
  const now = useNow()
  const disputes = useStore((s) => s.disputes)
  const users = useStore((s) => s.users)
  const lots = useStore((s) => s.lots)
  const refundRequests = useStore((s) => s.refundRequests)
  const me = useStore((s) => s.currentUser)
  const replyToDispute = useStore((s) => s.replyToDispute)
  const resolveDispute = useStore((s) => s.resolveDispute)
  const assignDispute = useStore((s) => s.assignDispute)
  const pushToast = useStore((s) => s.pushToast)

  const [tab, setTab] = useState<Tab>('open')
  const [openId, setOpenId] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [outcome, setOutcome] = useState<DisputeOutcome>('upheld')
  const [resolution, setResolution] = useState('')
  const [amount, setAmount] = useState('')
  const [closing, setClosing] = useState(false)

  const open = disputes.filter((d) => d.status !== 'resolved')
  const resolved = disputes.filter((d) => d.status === 'resolved')
  const mine = open.filter((d) => d.assignedToId === me?.id)
  const list = tab === 'open' ? open : tab === 'mine' ? mine : resolved

  const selected = disputes.find((d) => d.id === openId) ?? null
  const breaching = open.filter((d) => ageHours(d.createdAt, now) > 8)
  const awaitingFinance = open.filter((d) => d.refundId)

  const userOf = (id: string) => users.find((u) => u.id === id)
  const lotNoOf = (id?: string) => (id ? lots.find((l) => l.id === id)?.lotNo : undefined)

  const pick = (d: Dispute) => {
    setOpenId(d.id)
    setReply('')
    setResolution('')
    setAmount('')
    setOutcome('upheld')
    setClosing(false)
    if (!d.assignedToId) assignDispute(d.id)
  }

  const send = () => {
    if (!selected) return
    const r = replyToDispute(selected.id, reply)
    if (!r.ok) { pushToast({ kind: 'warning', title: 'Not sent', body: r.error }); return }
    setReply('')
    pushToast({ kind: 'success', title: 'Reply sent', body: 'The customer sees it on their ticket and in their notifications.' })
  }

  const close = () => {
    if (!selected) return
    const r = resolveDispute(selected.id, outcome, resolution, outcome === 'refund_due' ? Number(amount) : undefined)
    if (!r.ok) { pushToast({ kind: 'danger', title: 'Not closed', body: r.error }); return }
    setClosing(false)
    setResolution('')
    setAmount('')
    pushToast({
      kind: r.refundRaised ? 'info' : 'success',
      title: r.refundRaised ? 'Decided — refund raised with Finance' : 'Ticket resolved',
      body: r.refundRaised
        ? 'The ticket stays open until Finance has paid it. From the customer\'s side it is not resolved until the money is back.'
        : 'The customer has been told how it was resolved.',
    })
  }

  return (
    <Page>
      <PageHeader
        title="Disputes & support"
        sub="Reply, decide and close. Where a decision owes the customer money, this desk raises the refund and Finance pays it."
        actions={
          <Segmented<Tab>
            options={[
              { key: 'open', label: `Open (${open.length})` },
              { key: 'mine', label: `Mine (${mine.length})` },
              { key: 'resolved', label: 'Resolved' },
            ]}
            value={tab}
            onChange={setTab}
          />
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Open tickets" value={num(open.length)} tone={open.length ? 'ember' : undefined} sub="8h first-reply SLA" />
        <Stat label="Past SLA" value={num(breaching.length)} tone={breaching.length ? 'danger' : undefined} sub="Open more than 8 hours" />
        <Stat label="Waiting on Finance" value={num(awaitingFinance.length)} tone="steel" sub="Decided, refund not yet paid" to="/finance/refunds" />
        <Stat label="Resolved" value={num(resolved.length)} sub="All time" />
      </div>

      {list.length === 0 ? (
        <EmptyState
          title={tab === 'resolved' ? 'Nothing resolved yet' : tab === 'mine' ? 'You have not taken a ticket' : 'No open tickets'}
          body={tab === 'mine'
            ? 'Open one from the list — taking it stops two of you replying to the same customer.'
            : 'Buyers and sellers raise tickets against a payment, a weighment or a lifting.'}
        />
      ) : (
        <div className="grid lg:grid-cols-5 gap-4 items-start">
          {/* ------------------------------ the list -------------------------- */}
          <div className="lg:col-span-2 card overflow-hidden">
            <ul className="max-h-[36rem] overflow-y-auto">
              {list.map((d) => {
                const u = userOf(d.userId)
                const age = ageHours(d.createdAt, now)
                const late = d.status !== 'resolved' && age > 8
                const held = d.assignedToId ? userOf(d.assignedToId) : undefined
                return (
                  <li key={d.id}>
                    <button
                      onClick={() => pick(d)}
                      className={cx('w-full text-left flex flex-wrap items-center gap-2.5 px-4 py-3.5 border-b border-line hover:bg-surface-2',
                        openId === d.id && 'bg-surface-2')}>
                      {u && <Avatar name={u.name} hue={u.avatarHue} size={30} />}
                      <div className="flex-1 min-w-32">
                        <div className="font-semibold text-sm">{d.subject}</div>
                        <div className="text-xs text-ink-muted mt-0.5">
                          {u?.firm ?? 'Customer'} · {CATEGORY_LABEL[d.category]}
                          {lotNoOf(d.lotId) && <> · <span className="num">{lotNoOf(d.lotId)}</span></>}
                        </div>
                      </div>
                      {d.refundId
                        ? <Chip tone="steel">Refund with Finance</Chip>
                        : d.status === 'resolved'
                          ? <Chip tone="success">Resolved</Chip>
                          : <Chip tone={late ? 'danger' : 'warning'} className="num">
                            {late ? 'Past SLA' : `${Math.max(0, Math.round(8 - age))}h left`}
                          </Chip>}
                      {held && <span title={`With ${held.name}`}><Avatar name={held.name} hue={held.avatarHue} size={22} /></span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* ------------------------------ the thread ------------------------ */}
          <div className="lg:col-span-3 card overflow-hidden self-start">
            {!selected ? (
              <p className="px-5 py-16 text-center text-sm text-ink-muted">Pick a ticket to read it.</p>
            ) : (
              <>
                <div className="px-5 py-4 border-b border-line">
                  <div className="flex flex-wrap items-center gap-2">
                    <MessageSquareWarning size={18} className="text-danger" />
                    <h2 className="font-display font-bold text-lg flex-1 min-w-40">{selected.subject}</h2>
                    <Chip tone="neutral">{CATEGORY_LABEL[selected.category]}</Chip>
                    {selected.status === 'resolved'
                      ? <Chip tone="success"><CheckCircle2 size={11} /> Resolved</Chip>
                      : <Chip tone="warning"><Timer size={11} /> {selected.status === 'in_review' ? 'In review' : 'Open'}</Chip>}
                  </div>
                  <div className="text-xs text-ink-muted mt-1.5">
                    <span className="num">{selected.id.toUpperCase()}</span> · {userOf(selected.userId)?.firm ?? 'Customer'} ·
                    {' '}raised {fmtDateTime(selected.createdAt)}
                    {lotNoOf(selected.lotId) && <> · <span className="num">{lotNoOf(selected.lotId)}</span></>}
                    {selected.assignedToId && <> · with {userOf(selected.assignedToId)?.name}</>}
                  </div>
                </div>

                <div className="px-5 py-4 space-y-3 max-h-[26rem] overflow-y-auto bg-surface-2/40">
                  {selected.messages.map((m, i) => (
                    <div key={i} className={cx('flex gap-2.5 items-end', m.from === 'support' ? 'justify-end' : 'justify-start')}>
                      {m.from === 'user' && (
                        <Avatar name={userOf(selected.userId)?.name ?? 'Customer'} hue={userOf(selected.userId)?.avatarHue ?? 0} size={26} />
                      )}
                      <div className={cx('max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed border',
                        m.from === 'support'
                          ? 'bg-steel-soft border-steel/20 rounded-br-md'
                          : 'bg-surface border-line rounded-bl-md')}>
                        <div className="text-[11px] font-bold uppercase tracking-wider mb-0.5 opacity-60">
                          {m.from === 'support' ? 'ferroBid support' : userOf(selected.userId)?.firm ?? 'Customer'}
                        </div>
                        {m.body}
                        <div className="text-[11px] text-ink-faint mt-1.5">{fmtDateTime(m.at)}</div>
                      </div>
                      {m.from === 'support' && (
                        <span className="size-7 rounded-full bg-steel-soft text-steel-strong grid place-items-center shrink-0">
                          <Headset size={14} />
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {selected.status === 'resolved' ? (
                  <div className="px-5 py-4 bg-success-soft/40 border-t border-line text-sm">
                    <div className="font-semibold">
                      {selected.outcome ? OUTCOME_LABEL[selected.outcome] : 'Resolved'}
                    </div>
                    <p className="text-ink-muted mt-1">{selected.resolution}</p>
                    <div className="text-xs text-ink-faint mt-1.5">
                      Closed by {userOf(selected.resolvedById ?? '')?.name ?? 'the desk'}
                      {selected.resolvedAt && <> · {relTime(selected.resolvedAt, now)}</>}
                    </div>
                  </div>
                ) : selected.refundId ? (
                  <div className="px-5 py-4 bg-warning-soft/40 border-t border-line text-sm">
                    <div className="font-semibold">Decided — waiting on Finance</div>
                    <p className="text-ink-muted mt-1">
                      {selected.resolution} A refund of{' '}
                      <span className="num font-semibold">
                        {inr(refundRequests.find((r) => r.id === selected.refundId)?.amount ?? 0)}
                      </span>{' '}
                      is in Finance's queue. The ticket closes when the money is back with the customer —{' '}
                      <Link to="/finance/refunds" className="font-semibold text-ember hover:underline">Finance refunds</Link>.
                    </p>
                  </div>
                ) : closing ? (
                  <div className="px-5 py-4 border-t border-line space-y-3.5">
                    <Field label="How did it end?">
                      <Select value={outcome} onChange={(e) => setOutcome(e.target.value as DisputeOutcome)}>
                        {(Object.keys(OUTCOME_LABEL) as DisputeOutcome[]).map((k) => (
                          <option key={k} value={k}>{OUTCOME_LABEL[k]}</option>
                        ))}
                      </Select>
                    </Field>
                    {outcome === 'refund_due' && (
                      <Field label="How much goes back" hint="Raised with Finance. This desk never pays it.">
                        <Input
                          className="num"
                          inputMode="numeric"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
                          placeholder="e.g. 84000"
                        />
                      </Field>
                    )}
                    <Field label="What you are telling them" hint="The customer is shown this word for word.">
                      <Textarea
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        rows={3}
                        placeholder="e.g. re-weighment at your yard confirmed an 11% shortfall against the awarded quantity, witnessed by our field executive…"
                      />
                    </Field>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setClosing(false)}>Back to the thread</Button>
                      <Button variant="success" onClick={close}>
                        {outcome === 'refund_due' ? 'Decide and raise the refund' : 'Resolve and close'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="px-5 py-4 border-t border-line space-y-3">
                    <Field label="Reply">
                      <Textarea
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        rows={3}
                        placeholder="Answer the customer…"
                      />
                    </Field>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="secondary" onClick={() => setClosing(true)}>Resolve this ticket</Button>
                      <Button onClick={send}><Send size={14} /> Send reply</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Page>
  )
}
