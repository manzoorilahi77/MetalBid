/* ---------------------------------------------------------------------------
   Disputes — raise a ticket against a lot / payment / lifting issue and
   follow the support conversation.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { ChevronDown, Headset, MessageSquarePlus } from 'lucide-react'
import { Page } from '../layout/Chrome'
import {
  PageHeader, Button, Chip, Modal, Field, Input, Select, Textarea, EmptyState, Avatar, cx,
} from '../components/ui'
import { useStore } from '../store/store'
import { fmtDateTime } from '../lib/format'
import type { Dispute } from '../types'

const CATEGORY_LABEL: Record<Dispute['category'], string> = {
  payment: 'Payment', quality: 'Quality', quantity: 'Quantity', lifting: 'Lifting', other: 'Other',
}

function statusChip(status: Dispute['status']) {
  switch (status) {
    case 'open': return <Chip tone="warning">Open</Chip>
    case 'in_review': return <Chip tone="steel">In review</Chip>
    case 'resolved': return <Chip tone="success">Resolved</Chip>
  }
}

function DisputeRow({ d, lotNo }: { d: Dispute; lotNo?: string }) {
  const [open, setOpen] = useState(false)
  const me = useStore((s) => s.currentUser)
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-4 text-left hover:bg-surface-2">
        <div className="flex-1 min-w-52">
          <div className="font-semibold text-sm text-ink">{d.subject}</div>
          <div className="text-xs text-ink-faint mt-0.5">
            <span className="num">{d.id.toUpperCase()}</span> · raised {fmtDateTime(d.createdAt)}
            {lotNo && <> · <span className="num">{lotNo}</span></>}
          </div>
        </div>
        <Chip tone="neutral">{CATEGORY_LABEL[d.category]}</Chip>
        {statusChip(d.status)}
        <ChevronDown size={16} className={cx('text-ink-faint transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-line bg-surface-2/50 px-5 py-4 space-y-3 animate-fade-up">
          {d.messages.map((m, i) => (
            <div key={i} className={cx('flex gap-2.5 items-end', m.from === 'user' ? 'justify-end' : 'justify-start')}>
              {m.from === 'support' && (
                <span className="size-7 rounded-full bg-steel-soft text-steel-strong grid place-items-center shrink-0">
                  <Headset size={14} />
                </span>
              )}
              <div className={cx('max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed border',
                m.from === 'user'
                  ? 'bg-ember-soft border-ember/20 text-ink rounded-br-md'
                  : 'bg-surface border-line text-ink rounded-bl-md')}>
                <div className="text-[11px] font-bold uppercase tracking-wider mb-0.5 opacity-60">
                  {m.from === 'user' ? 'You' : 'ferroBid support'}
                </div>
                {m.body}
                <div className="text-[11px] text-ink-faint mt-1.5">{fmtDateTime(m.at)}</div>
              </div>
              {m.from === 'user' && me && <Avatar name={me.name} hue={me.avatarHue} size={28} />}
            </div>
          ))}
          {d.status !== 'resolved' && (
            <p className="text-xs text-ink-faint pt-1">
              Support typically replies within 1 working day. You will be notified here and by email.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function Disputes() {
  const role = useStore((s) => s.role)
  const me = useStore((s) => s.currentUser)
  const disputes = useStore((s) => s.disputes)
  const deliveryOrders = useStore((s) => s.deliveryOrders)
  const lots = useStore((s) => s.lots)
  const createDispute = useStore((s) => s.createDispute)
  const pushToast = useStore((s) => s.pushToast)

  const [modalOpen, setModalOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<Dispute['category']>('payment')
  const [lotId, setLotId] = useState('')
  const [body, setBody] = useState('')

  const mine = disputes.filter((d) => d.userId === me?.id)
  const wonLots = deliveryOrders
    .filter((d) => d.buyerId === me?.id)
    .map((d) => lots.find((l) => l.id === d.lotId))
    .filter((l): l is NonNullable<typeof l> => Boolean(l))

  const lotNoFor = (id?: string) => (id ? lots.find((l) => l.id === id)?.lotNo : undefined)

  const submit = () => {
    if (!subject.trim() || !body.trim()) {
      pushToast({ kind: 'warning', title: 'Missing details', body: 'Please add a subject and describe the issue.' })
      return
    }
    createDispute(subject.trim(), category, body.trim(), lotId || undefined)
    pushToast({ kind: 'success', title: 'Dispute raised', body: 'Our support desk will respond within 1 working day.' })
    setModalOpen(false)
    setSubject(''); setCategory('payment'); setLotId(''); setBody('')
  }

  return (
    <Page>
      <PageHeader
        title="Disputes & support tickets"
        sub="Raise an issue about payment, quality, quantity or lifting — our desk aims to resolve tickets within 7 working days."
        actions={
          <Button onClick={() => me ? setModalOpen(true) : pushToast({ kind: 'info', title: 'Sign in required', body: 'Please sign in to raise a dispute.' })}>
            <MessageSquarePlus size={16} /> Raise a dispute
          </Button>
        }
      />

      {role !== 'buyer' && role !== 'seller' && (
        <div className="card bg-surface-2 p-4 mb-6 text-sm text-ink-muted">
          Disputes are normally raised by buyers and sellers. You are viewing this screen as{' '}
          <span className="font-semibold text-ink">{role.replace('_', ' ')}</span> — the list below is shown for demo purposes.
        </div>
      )}

      {mine.length === 0 ? (
        <EmptyState
          title="No disputes yet"
          body="If something goes wrong with a payment, weighment or lifting, raise a ticket and track the conversation here."
          action={<Button variant="secondary" onClick={() => me && setModalOpen(true)}>Raise a dispute</Button>}
        />
      ) : (
        <div className="space-y-3 max-w-3xl">
          {mine.map((d) => <DisputeRow key={d.id} d={d} lotNo={lotNoFor(d.lotId)} />)}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Raise a dispute">
        <div className="space-y-4">
          <Field label="Subject">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Weighment variance on LOT-04"
              maxLength={120}
            />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Category">
              <Select value={category} onChange={(e) => setCategory(e.target.value as Dispute['category'])}>
                <option value="payment">Payment</option>
                <option value="quality">Quality</option>
                <option value="quantity">Quantity</option>
                <option value="lifting">Lifting</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Related lot" hint="Optional — lots you have won">
              <Select value={lotId} onChange={(e) => setLotId(e.target.value)}>
                <option value="">Not lot-specific</option>
                {wonLots.map((l) => (
                  <option key={l.id} value={l.id}>{l.lotNo} — {l.metal} {l.grade}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Describe the issue" hint="Include dates, vehicle numbers, weighment slips or UTR references where relevant.">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Tell us what happened…"
              rows={5}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={submit}>Submit dispute</Button>
          </div>
        </div>
      </Modal>
    </Page>
  )
}
