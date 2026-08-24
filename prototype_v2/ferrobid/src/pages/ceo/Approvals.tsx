/* ---------------------------------------------------------------------------
   CEO / MD — what needs my signature. The fourth question, and the only screen
   in this workspace with buttons.

   The CEO approves and never originates. Every row here was raised by a desk
   that had already done the work and hit its own ceiling: Finance wants to keep
   a buyer's deposit, Operations wants to take a large catalogue to market, the
   Super Admin wants to change what we charge. Nothing any of them proposed has
   taken effect — that is what "waiting for a signature" means, and it is why
   each card says exactly what is being held and who is waiting on it.

   Four things can be done to a request, and a refusal is never a dead end:

   · **Approve** — the movement it was holding completes immediately.
   · **Refuse** — with a reason, which goes back to the requester verbatim.
   · **Ask for more information** — neither yes nor no. It stays in the queue.
   · **Delegate** — hand the whole queue to a named person until a set date.

   Whoever actually presses the button is recorded, so a delegate's signature is
   never mistaken for the CEO's own.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Ban, BadgeIndianRupee, CheckCircle2, FileText, Gavel, HelpCircle, Lock, Percent,
  RotateCcw, ShieldCheck, Signature, UserCog,
} from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, EmptyState, Field, Modal, PageHeader, Textarea, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, num, relTime } from '../../lib/format'
import { KIND_IF_REFUSED, KIND_LABEL, NotMyDecision, PlainStat, Question, useSignatureQueue } from './shared'
import type { CeoApprovalKind, CeoApprovalRequest, FinanceConfig } from '../../types'

const KIND_ICON: Record<CeoApprovalKind, typeof BadgeIndianRupee> = {
  emd_forfeiture: BadgeIndianRupee,
  refund: RotateCcw,
  fee_change: Percent,
  auction_publish: Gavel,
  permanent_ban: Ban,
  super_admin_account: UserCog,
  content_publish: FileText,
}

/** The rates a fee change would move, before and after. Named in the words the
 *  business uses rather than in the config's own field names. */
const FEE_LABEL: Partial<Record<keyof FinanceConfig, string>> = {
  sellerCommissionPct: 'Seller commission (% of the seller\'s upside)',
  buyerPremiumPct: 'Buyer premium (% of material value)',
  listingFeePerLot: 'Listing fee per lot (₹)',
  emdPct: 'Default deposit (% of lot value)',
  gstPct: 'GST (%)',
  tcsPct: 'TCS (%)',
}

type Mode = 'approve' | 'refuse' | 'ask'

const MODE_COPY: Record<Mode, { title: string; confirm: string; hint: string; needsNote: boolean }> = {
  approve: {
    title: 'Approve this',
    confirm: 'Approve',
    hint: 'Optional. Anything you write goes back to whoever raised it, and onto the audit trail under your name.',
    needsNote: false,
  },
  refuse: {
    title: 'Refuse this',
    confirm: 'Refuse with this reason',
    hint: 'Required. The person who raised this sees it word for word — say what would change your mind.',
    needsNote: true,
  },
  ask: {
    title: 'Ask for more information',
    confirm: 'Send the question',
    hint: 'Required. The request stays in your queue and the requester is asked this directly.',
    needsNote: true,
  },
}

export default function CeoApprovals() {
  const queue = useSignatureQueue()
  const cfg = useStore((s) => s.financeConfig)
  const users = useStore((s) => s.users)
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const decide = useStore((s) => s.decideCeoApproval)
  const requestInfo = useStore((s) => s.requestCeoInfo)
  const pushToast = useStore((s) => s.pushToast)
  const role = useStore((s) => s.role)

  const [target, setTarget] = useState<{ req: CeoApprovalRequest; mode: Mode } | null>(null)
  const [note, setNote] = useState('')

  const who = (id: string) => users.find((u) => u.id === id)
  const close = () => { setTarget(null); setNote('') }

  const threshold = (kind: CeoApprovalKind): string | null => {
    if (kind === 'emd_forfeiture') return `Deposits of ${inr(cfg.ceoForfeitureFrom)} or more are signed by you before they are taken.`
    if (kind === 'refund') return `Refunds of ${inr(cfg.ceoRefundFrom)} or more are signed by you before the money goes back.`
    if (kind === 'auction_publish') return `Catalogues worth ${inr(cfg.ceoPublishValueFrom)} or more at reserve are signed by you before they go public.`
    if (kind === 'fee_change') return 'Every change to what we charge is signed by you, whatever the size.'
    if (kind === 'permanent_ban') return 'Closing an account for good is signed by you, whatever the balance.'
    return 'A new administrator account is signed by you before it is created.'
  }

  /** What is physically being held while this sits here. */
  const holding = (req: CeoApprovalRequest) => {
    if (req.kind === 'auction_publish') {
      const cat = catalogues.find((c) => c.id === req.refId)
      const count = lots.filter((l) => l.catalogueId === req.refId).length
      return cat
        ? `${cat.code} — ${num(count)} lot${count === 1 ? '' : 's'} — is finished and private. No buyer can see it.`
        : 'A finished catalogue is being held private.'
    }
    if (req.kind === 'emd_forfeiture') return 'The deposit is still held in the buyer\'s wallet. Nothing has been taken.'
    if (req.kind === 'refund') return 'The money is still with us. The customer has not been paid.'
    if (req.kind === 'fee_change') return 'Rates are unchanged. Every auction is still being charged at today\'s rate.'
    if (req.kind === 'permanent_ban') {
      const u = who(req.refId)
      return u ? `${u.firm} can still sign in and bid.` : 'The account is still open.'
    }
    return 'The account has not been created.'
  }

  const confirm = () => {
    if (!target) return
    const { req, mode } = target
    const text = note.trim()
    if (mode === 'ask') {
      requestInfo(req.id, text)
      pushToast({ kind: 'info', title: 'Question sent', body: `${who(req.requestedBy)?.name ?? 'The requester'} has been asked. It stays in your queue until you decide.` })
    } else {
      const result = decide(req.id, mode === 'approve', text || undefined)
      if (result && !result.ok) {
        pushToast({ kind: 'danger', title: 'Could not refuse this', body: result.error })
      } else {
        pushToast(mode === 'approve'
          ? { kind: 'success', title: 'Signed', body: `${req.summary} — what it was holding now goes ahead.` }
          : { kind: 'info', title: 'Refused', body: `${who(req.requestedBy)?.name ?? 'The requester'} has been told why.` })
      }
    }
    close()
  }

  const canSign = queue.canSign
  const money = queue.open.reduce((s, a) => s + a.amount, 0)

  return (
    <Page>
      <PageHeader
        title="What needs my signature"
        sub="Decisions other people have already worked through and cannot complete on their own authority. Nothing below has taken effect."
        actions={
          queue.open.length > 0
            ? <Chip tone="warning"><Signature size={12} /> {num(queue.open.length)} waiting</Chip>
            : <Chip tone="success"><CheckCircle2 size={12} /> Queue clear</Chip>
        }
      />

      {/* ---------------------------- delegation ---------------------------- */}
      {queue.delegate && (
        <div className="card border-l-4 border-l-steel p-4 mb-5 flex flex-wrap items-center gap-3">
          <ShieldCheck size={16} className="text-steel shrink-0" />
          <div className="text-[13px] text-ink-muted flex-1 min-w-64">
            <strong className="text-ink">{queue.delegate.name} is holding this queue until {queue.delegatedUntil}.</strong>{' '}
            {role === 'ceo'
              ? 'You can still sign anything yourself — a delegation adds a signer, it does not remove you.'
              : 'Anything signed is recorded under the name of whoever signed it, not the CEO\'s.'}
          </div>
          <Link to="/ceo/delegate" className="text-[13px] font-bold text-ember hover:underline inline-flex items-center gap-1 shrink-0">
            Change it <ArrowRight size={13} />
          </Link>
        </div>
      )}

      {!canSign && (
        <div className="card border-l-4 border-l-warning p-4 mb-5 flex items-start gap-3">
          <Lock size={16} className="text-warning shrink-0 mt-0.5" />
          <div className="text-[13px] text-ink-muted">
            <strong className="text-ink">Read-only.</strong> This queue is the CEO&apos;s. You can see what is waiting and
            what it is holding up — that is deliberate, so nothing ever disappears from the desk that raised it — but only
            the CEO, a named delegate or a Super Admin acting in support can sign it.
          </div>
        </div>
      )}

      {queue.signingAsDelegate && (
        <div className="card border-l-4 border-l-ember p-4 mb-5 flex items-start gap-3">
          <ShieldCheck size={16} className="text-ember shrink-0 mt-0.5" />
          <div className="text-[13px] text-ink-muted">
            <strong className="text-ink">You are signing on the CEO&apos;s behalf until {queue.delegatedUntil}.</strong>{' '}
            Every decision is recorded under your own name, and the CEO can take the queue back at any time.
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <PlainStat label="Waiting on you" value={num(queue.open.length)} tone={queue.open.length ? 'risk' : 'plain'}
          sub="nothing has taken effect" />
        <PlainStat label="Money held up" value={inr(money)} tone="held" sub="across every open request" />
        <PlainStat label="Questions outstanding" value={num(queue.queried.length)}
          sub="you asked; they have not answered" />
        <PlainStat label="Signed or refused" value={num(queue.decided.length)} sub="the record of what you decided" />
      </div>

      {/* ------------------------------ the queue --------------------------- */}
      <Question
        q="Waiting for you"
        a="Oldest first — somebody has been waiting longest on the top one."
      />

      {queue.open.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={32} strokeWidth={1.5} />}
          title="Nothing needs your signature"
          body="Every desk is working within its own authority. Anything that goes above a configured threshold — a large forfeiture, a large refund, a high-value publish, a change to what we charge — will appear here."
        />
      ) : (
        <div className="space-y-3">
          {queue.open.map((req, i) => {
            const Icon = KIND_ICON[req.kind]
            const requester = who(req.requestedBy)
            const queried = req.status === 'info_requested'
            return (
              <div key={req.id} className="card overflow-hidden animate-fade-up" style={{ animationDelay: `${i * 45}ms` }}>
                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3.5">
                    <span className={cx('size-10 rounded-xl grid place-items-center shrink-0',
                      queried ? 'bg-steel-soft text-steel' : 'bg-ember-soft text-ember')}>
                      <Icon size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Chip tone={queried ? 'steel' : 'ember'}>{KIND_LABEL[req.kind]}</Chip>
                        {queried && <Chip tone="warning"><HelpCircle size={11} /> You asked a question</Chip>}
                      </div>
                      <h3 className="font-display text-lg font-bold mt-1.5 leading-snug">{req.summary}</h3>
                      <p className="text-[13px] text-ink-muted mt-1 max-w-3xl">{req.reason}</p>
                      <div className="text-[11px] text-ink-faint mt-1.5">
                        Raised by {requester?.name ?? 'a colleague'}
                        {requester?.firm ? ` · ${requester.firm}` : ''} · raised {relTime(req.requestedAt, queue.now)}
                      </div>
                    </div>
                    {req.amount > 0 && (
                      <div className="text-right shrink-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Amount</div>
                        <div className="num text-xl font-bold tabular-nums">{inr(req.amount)}</div>
                      </div>
                    )}
                  </div>

                  {/* ------------------- what a fee change moves ------------------ */}
                  {req.kind === 'fee_change' && req.payload && (
                    <div className="mt-4 card bg-surface-2/60 border-0 p-3.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-2">What would change</div>
                      <div className="divide-y divide-line">
                        {(Object.keys(req.payload) as (keyof FinanceConfig)[]).map((k) => (
                          <div key={k} className="flex items-center justify-between gap-3 py-1.5">
                            <span className="text-[13px] font-medium">{FEE_LABEL[k] ?? k}</span>
                            <span className="num text-[13px] font-bold shrink-0">
                              <span className="text-ink-muted">{String(cfg[k])}</span>
                              <span className="text-ink-faint mx-1.5">→</span>
                              <span className="text-ember-strong">{String(req.payload?.[k])}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[12px] text-ink-faint mt-2">
                        Applies to auctions published after you sign. Anything already listed keeps the rate it was listed under.
                      </p>
                    </div>
                  )}

                  {/* ------------------ what your question was ------------------- */}
                  {queried && req.infoNote && (
                    <div className="mt-4 card bg-steel-soft/40 border-0 p-3.5 text-[13px]">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-steel mb-1">You asked</div>
                      <p className="text-ink">{req.infoNote}</p>
                      <p className="text-[11px] text-ink-faint mt-1.5">
                        Sent {req.infoAskedAt ? relTime(req.infoAskedAt, queue.now) : 'recently'} — still unanswered. You can sign or refuse without waiting.
                      </p>
                    </div>
                  )}

                  {/* --------------------- holding / if refused ------------------ */}
                  <div className="grid sm:grid-cols-2 gap-3 mt-4">
                    <div className="rounded-xl border border-line px-3.5 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">While this waits</div>
                      <p className="text-[13px] text-ink-muted mt-1">{holding(req)}</p>
                    </div>
                    <div className="rounded-xl border border-line px-3.5 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">If you refuse</div>
                      <p className="text-[13px] text-ink-muted mt-1">{KIND_IF_REFUSED[req.kind]}</p>
                    </div>
                  </div>

                  <p className="text-[12px] text-ink-faint mt-3">{threshold(req.kind)}</p>
                </div>

                <div className="px-4 sm:px-5 py-3 border-t border-line bg-surface-2/40 flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="ghost" disabled={!canSign}
                    onClick={() => { setTarget({ req, mode: 'ask' }); setNote(req.infoNote ?? '') }}>
                    <HelpCircle size={14} /> Ask for more
                  </Button>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="secondary" disabled={!canSign}
                      onClick={() => { setTarget({ req, mode: 'refuse' }); setNote('') }}>
                      Refuse
                    </Button>
                    <Button size="sm" variant="success" disabled={!canSign}
                      onClick={() => { setTarget({ req, mode: 'approve' }); setNote('') }}>
                      <Signature size={14} /> Approve
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ---------------------------- what I decided ------------------------ */}
      {queue.decided.length > 0 && (
        <>
          <Question q="What you decided" a="Newest first. A decision here is final — it is not editable by anyone, including you." />
          <div className="card divide-y divide-line overflow-hidden">
            {queue.decided.slice(0, 10).map((req) => {
              const Icon = KIND_ICON[req.kind]
              const signer = who(req.decidedBy ?? '')
              const approved = req.status === 'approved'
              return (
                <div key={req.id} className="flex items-start gap-3.5 px-4 py-3.5">
                  <span className={cx('size-9 rounded-xl grid place-items-center shrink-0 mt-0.5',
                    approved ? 'bg-success-soft text-success' : 'bg-surface-2 text-ink-muted')}>
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm">{req.summary}</span>
                      <Chip tone={approved ? 'success' : 'neutral'}>{approved ? 'Approved' : 'Refused'}</Chip>
                    </div>
                    {req.decisionNote && <p className="text-[13px] text-ink-muted mt-0.5">&ldquo;{req.decisionNote}&rdquo;</p>}
                    <div className="text-[11px] text-ink-faint mt-1">
                      {signer ? `${signer.name}` : 'Signed'} · {req.decidedAt ? relTime(req.decidedAt, queue.now) : ''}
                      {signer && signer.role !== 'ceo' && ' · signed on the CEO\'s behalf'}
                    </div>
                  </div>
                  {req.amount > 0 && <span className="num text-sm font-bold shrink-0 self-center tabular-nums">{inr(req.amount)}</span>}
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="mt-8">
        <NotMyDecision>
          You approve; you never originate. There is no way to start a forfeiture, a refund, a publish or a fee change
          from this screen, and that is the control — the desk that proposed it did the work and stands behind it, and
          your signature is a second pair of eyes rather than a second author. If you will be away, hand the queue to
          someone by name on <Link to="/ceo/delegate" className="text-ember font-semibold hover:underline">Delegate my approvals</Link>{' '}
          rather than leaving people waiting.
        </NotMyDecision>
      </div>

      {/* ------------------------------- decision --------------------------- */}
      <Modal open={!!target} onClose={close} title={target ? MODE_COPY[target.mode].title : ''}>
        {target && (
          <div className="space-y-4">
            <div className={cx('card border-0 p-4 text-sm',
              target.mode === 'approve' ? 'bg-success-soft' : target.mode === 'refuse' ? 'bg-surface-2' : 'bg-steel-soft/60')}>
              <div className="font-bold text-ink">{target.req.summary}</div>
              <p className="text-ink-muted mt-1">
                {target.mode === 'approve'
                  ? `${holding(target.req)} Approving completes it immediately.`
                  : target.mode === 'refuse'
                    ? KIND_IF_REFUSED[target.req.kind]
                    : 'The request stays in your queue and nothing changes until you decide.'}
              </p>
            </div>
            <Field label={target.mode === 'ask' ? 'What do you want to know?' : 'Note'} hint={MODE_COPY[target.mode].hint}>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={target.mode === 'refuse'
                  ? 'e.g. Not until we have the buyer\'s written response on file. Come back with it and I will sign.'
                  : target.mode === 'ask'
                    ? 'e.g. How many times has this buyer done this before, and what did we do last time?'
                    : 'Optional — anything you want on the record with this decision.'}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={close}>Cancel</Button>
              <Button
                variant={target.mode === 'approve' ? 'success' : target.mode === 'refuse' ? 'danger' : 'steel'}
                disabled={MODE_COPY[target.mode].needsNote && note.trim().length < 4}
                onClick={confirm}>
                {MODE_COPY[target.mode].confirm}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  )
}
