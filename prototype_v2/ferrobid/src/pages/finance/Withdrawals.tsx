/* ---------------------------------------------------------------------------
   Finance Administrator — withdrawals.

   Money leaving the platform, in two deliberately separate steps by two
   different people. Today one person can review and then process the same
   request; together with deposit approval that gives a single individual a
   complete round trip on customer money. This screen makes the two steps two
   *lists* rather than two buttons on one row — because a checker who is looking
   at the maker's screen is not really a second pair of eyes.

   The reviewer is named on every row in "awaiting processing", and above the
   configured threshold the store refuses a same-user release outright. The
   button is disabled here as well, with the reason on it, so nobody discovers
   the rule by being stopped by it.
--------------------------------------------------------------------------- */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, Banknote, Check, CheckCircle2, Clock, Search, ShieldCheck, UserCheck, X,
} from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Avatar, Button, Chip, EmptyState, Field, Input, Modal, PageHeader, Textarea } from '../../components/ui'
import { useStore, WEEKDAY_LABELS } from '../../store/store'
import { inr, num, fmtDateTime, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import { Ageing, MoneyStat, QueueStrip, ScopeNote, SectionTitle, useFinanceScope } from '../shared/finance'
import type { WithdrawalRequest } from '../../types'

type Tab = 'review' | 'process' | 'done'

/** Is the weekly payout window open right now? The same rule gates the buyer's
 *  request button; showing it here means an operator never wonders why a
 *  release is refused. */
function useWindowState() {
  const now = useNow()
  const w = useStore((s) => s.withdrawalWindow)
  const d = new Date(now)
  const minutes = d.getHours() * 60 + d.getMinutes()
  const open = w.days.includes(d.getDay())
    && minutes >= w.startHour * 60 + w.startMinute
    && minutes < w.endHour * 60 + w.endMinute
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    open,
    label: `${w.days.map((x) => WEEKDAY_LABELS[x]).join(', ')} · ${pad(w.startHour)}:${pad(w.startMinute)}–${pad(w.endHour)}:${pad(w.endMinute)} IST`,
  }
}

export default function Withdrawals() {
  const now = useNow()
  const requests = useStore((s) => s.withdrawalRequests)
  const users = useStore((s) => s.users)
  const wallets = useStore((s) => s.wallets)
  const accounts = useStore((s) => s.bankAccounts)
  const me = useStore((s) => s.currentUser)
  const cfg = useStore((s) => s.financeConfig)
  const review = useStore((s) => s.approveWithdrawal)
  const process = useStore((s) => s.processWithdrawal)
  const fail = useStore((s) => s.failWithdrawal)
  const pushToast = useStore((s) => s.pushToast)

  const { canExecute } = useFinanceScope()
  const win = useWindowState()
  const [tab, setTab] = useState<Tab>('review')
  const [q, setQ] = useState('')
  const [failing, setFailing] = useState<WithdrawalRequest | null>(null)
  const [reason, setReason] = useState('')

  const toReview = requests.filter((r) => r.status === 'requested')
  const toProcess = requests.filter((r) => r.status === 'under_review')
  const done = requests.filter((r) => r.status === 'processed' || r.status === 'failed' || r.status === 'cancelled')

  const decorate = (r: WithdrawalRequest) => {
    const u = users.find((x) => x.id === r.userId)
    const w = wallets.find((x) => x.userId === r.userId)
    const acc = accounts.find((a) => a.id === r.bankAccountId)
    const needsSecond = r.amount >= cfg.withdrawalSecondSignatureFrom
    return {
      r, u, w, acc, needsSecond,
      accountUnverified: !acc || acc.status !== 'verified',
      sameUser: !!r.reviewedBy && r.reviewedBy === me?.id,
      reviewer: users.find((x) => x.id === r.reviewedBy),
      processor: users.find((x) => x.id === r.processedBy),
    }
  }

  const shown = useMemo(() => {
    const base = tab === 'review' ? toReview : tab === 'process' ? toProcess : done
    const query = q.trim().toLowerCase()
    return base
      .map(decorate)
      .filter((x) => !query || (x.u?.firm ?? '').toLowerCase().includes(query) || x.r.ref.toLowerCase().includes(query))
      .sort((a, b) => Date.parse(b.r.requestedAt) - Date.parse(a.r.requestedAt))
  }, [tab, toReview, toProcess, done, q, users, wallets, accounts, me?.id, cfg.withdrawalSecondSignatureFrom])

  const doReview = (r: WithdrawalRequest) => {
    if (!canExecute) { pushToast({ kind: 'warning', title: 'Read-only', body: 'Only the Finance Administrator can review a withdrawal.' }); return }
    review(r.id)
    pushToast({
      kind: 'success', title: 'Reviewed',
      body: r.amount >= cfg.withdrawalSecondSignatureFrom
        ? `${inr(r.amount)} is cleared for release. It now needs a different Finance user to pay it.`
        : `${inr(r.amount)} is cleared for release.`,
    })
  }

  const doProcess = (r: WithdrawalRequest) => {
    process(r.id)
  }

  const doFail = () => {
    if (!failing) return
    if (!canExecute) { pushToast({ kind: 'warning', title: 'Read-only', body: 'Only the Finance Administrator can reverse a withdrawal.' }); setFailing(null); return }
    fail(failing.id, reason.trim())
    pushToast({ kind: 'info', title: 'Withdrawal reversed', body: `${inr(failing.amount)} has gone back to the customer's wallet with the reason shown.` })
    setFailing(null); setReason('')
  }

  return (
    <Page>
      <PageHeader
        title="Withdrawals"
        sub="Money leaving the platform. Reviewed by one Finance user and released by another — deliberately."
        actions={
          <Chip tone={win.open ? 'success' : 'neutral'} pulse={win.open}>
            <Clock size={12} /> Payout window {win.open ? 'open' : 'closed'}
          </Chip>
        }
      />

      <QueueStrip steps={[
        { label: 'Awaiting review', count: toReview.length, urgent: true, onClick: () => setTab('review'), active: tab === 'review' },
        { label: 'Awaiting processing', count: toProcess.length, urgent: true, onClick: () => setTab('process'), active: tab === 'process' },
        { label: 'Settled', count: done.length, onClick: () => setTab('done'), active: tab === 'done' },
        { label: 'Accounts to verify first', count: accounts.filter((a) => a.status === 'pending').length, to: '/finance/bank-accounts' },
      ]} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MoneyStat label="Awaiting review" amount={toReview.reduce((s, r) => s + r.amount, 0)} tone="risk" sub={`${num(toReview.length)} request${toReview.length === 1 ? '' : 's'}`} />
        <MoneyStat label="Cleared, not yet paid" amount={toProcess.reduce((s, r) => s + r.amount, 0)} tone="out" sub="customers are waiting on this" />
        <MoneyStat label="Paid out all time" amount={requests.filter((r) => r.status === 'processed').reduce((s, r) => s + r.amount, 0)} tone="plain" sub={`${num(requests.filter((r) => r.status === 'processed').length)} released`} />
        <MoneyStat label="Reversed" amount={requests.filter((r) => r.status === 'failed').reduce((s, r) => s + r.amount, 0)} tone="in" sub="returned to wallets" />
      </div>

      {/* --------------------------- the rule --------------------------- */}
      <div className="card border-l-4 border-l-steel p-4 mt-6 flex items-start gap-3">
        <ShieldCheck size={16} className="text-steel shrink-0 mt-0.5" />
        <div className="text-[13px] text-ink-muted">
          <strong className="text-ink">Maker–checker.</strong> Both steps are always recorded and always named. At{' '}
          <span className="num font-bold text-ink">{inr(cfg.withdrawalSecondSignatureFrom)}</span> and above, the user who
          reviewed a request cannot be the one who releases it. Below that a single user may do both, and the audit trail
          still names them at each step. Payout window: <span className="num">{win.label}</span> — set by the Super Admin on
          Financial config and not overridable here.
        </div>
      </div>

      <SectionTitle
        title={tab === 'review' ? 'Awaiting review' : tab === 'process' ? 'Awaiting processing' : 'Settled'}
        count={shown.length}
        sub={tab === 'review'
          ? 'Check the balance, the EMD exposure and that the destination account has been verified. Reviewing does not move money.'
          : tab === 'process' ? 'Reviewed and cleared. Releasing this actually pays the customer.'
            : 'Every request that has finished, whether it was paid or reversed.'}
        action={
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            <Input className="h-9 w-56 pl-9" placeholder="Firm or reference…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        }
      />

      {shown.length === 0 ? (
        <EmptyState
          icon={<Banknote size={32} strokeWidth={1.5} />}
          title={tab === 'review' ? 'Nothing to review' : tab === 'process' ? 'Nothing waiting to be paid' : q ? 'Nothing matches that search' : 'Nothing settled yet'}
          body={tab === 'review'
            ? 'Buyers and sellers request a withdrawal from their wallet during the payout window. Requests land here.'
            : tab === 'process' ? 'Reviewed requests appear here for a second Finance user to release.'
              : 'Paid and reversed requests are kept here permanently.'}
        />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {shown.map(({ r, u, w, acc, needsSecond, accountUnverified, sameUser, reviewer, processor }) => {
            const blockedBySameUser = needsSecond && sameUser
            const canProcess = !accountUnverified && !blockedBySameUser
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 hover:bg-surface-2 transition-colors">
                <Avatar name={u?.name ?? '?'} hue={u?.avatarHue ?? 200} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">{u?.firm ?? r.userId}</span>
                    {needsSecond && <Chip tone="steel"><UserCheck size={11} /> Second signature required</Chip>}
                    {r.status === 'processed' && <Chip tone="success"><CheckCircle2 size={11} /> Paid</Chip>}
                    {r.status === 'failed' && <Chip tone="danger">Reversed</Chip>}
                    {r.status === 'cancelled' && <Chip tone="neutral">Cancelled by the customer</Chip>}
                    {accountUnverified && r.status !== 'processed' && r.status !== 'failed' && (
                      <Chip tone="warning"><AlertTriangle size={11} /> Destination not verified</Chip>
                    )}
                  </div>
                  <div className="text-[12px] text-ink-muted mt-0.5 num truncate">
                    {acc ? `${acc.bankName} · ${acc.accountNumberMasked} · ${acc.ifsc}` : 'No payout account on record'}
                  </div>
                  <div className="text-[11px] text-ink-faint mt-0.5">
                    Requested {relTime(r.requestedAt, now)} · wallet balance <span className="num">{inr(w?.balance ?? 0)}</span> ·
                    EMD held <span className="num">{inr(w?.emdLocked ?? 0)}</span>
                  </div>
                  {(reviewer || processor) && (
                    <div className="text-[11px] text-ink-faint mt-0.5">
                      {reviewer && <>Reviewed by <span className="font-semibold text-ink-muted">{reviewer.name}</span>{r.reviewedAt ? ` · ${fmtDateTime(r.reviewedAt)}` : ''}</>}
                      {processor && <> · Released by <span className="font-semibold text-ink-muted">{processor.name}</span></>}
                    </div>
                  )}
                  {r.reason && <div className="text-[12px] text-danger mt-0.5">{r.reason}</div>}
                </div>
                {(r.status === 'requested' || r.status === 'under_review') && (
                  <Ageing since={r.requestedAt} now={now} warnDays={1} dangerDays={3} />
                )}
                <div className="num text-base font-bold tabular-nums shrink-0 w-28 text-right">{inr(r.amount)}</div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.status === 'requested' && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setFailing(r)}><X size={13} /> Reverse</Button>
                      <Button size="sm" disabled={accountUnverified} onClick={() => doReview(r)}>
                        Review <ArrowRight size={13} />
                      </Button>
                    </>
                  )}
                  {r.status === 'under_review' && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setFailing(r)}><X size={13} /> Reverse</Button>
                      <Button size="sm" variant="success" disabled={!canProcess} onClick={() => doProcess(r)}
                        title={blockedBySameUser
                          ? `You reviewed this. Above ${inr(cfg.withdrawalSecondSignatureFrom)} it must be released by a different Finance user.`
                          : accountUnverified ? 'The destination account has not been verified yet.' : undefined}>
                        <Check size={13} /> Release {inr(r.amount)}
                      </Button>
                    </>
                  )}
                </div>
                {blockedBySameUser && (
                  <p className="w-full text-[12px] text-warning pl-12">
                    You reviewed this one. Above {inr(cfg.withdrawalSecondSignatureFrom)} a different Finance user has to release it —
                    that is the control, not a bug.
                  </p>
                )}
                {accountUnverified && (r.status === 'requested' || r.status === 'under_review') && (
                  <p className="w-full text-[12px] text-warning pl-12">
                    The destination account is still pending.{' '}
                    <Link to="/finance/bank-accounts" className="font-bold text-ember hover:underline">Verify it first</Link>.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-8">
        <ScopeNote>
          The Sub Admin sees every withdrawal on their{' '}
          <Link to="/sub/queue" className="text-ember font-semibold hover:underline">work queue</Link> and can chase or
          escalate one, but cannot review or release it. That separation, plus deposit approval sitting on the same desk,
          is what stops any one person moving money into and out of the platform unobserved.
        </ScopeNote>
      </div>

      <Modal open={!!failing} onClose={() => { setFailing(null); setReason('') }} title="Reverse this withdrawal">
        <div className="space-y-4">
          <div className="card bg-warning-soft border-0 p-4 text-sm">
            <span className="num font-bold">{inr(failing?.amount ?? 0)}</span> goes straight back to{' '}
            {users.find((u) => u.id === failing?.userId)?.firm ?? 'the customer'}'s wallet — nothing is lost. The reason
            below is what they see.
          </div>
          <Field label="Why it could not be paid" hint="Shown to the customer, and recorded against your name.">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Beneficiary IFSC rejected by the remitting bank — please re-register the account…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setFailing(null); setReason('') }}>Cancel</Button>
            <Button variant="danger" disabled={reason.trim().length < 4} onClick={doFail}>Reverse to wallet</Button>
          </div>
        </div>
      </Modal>
    </Page>
  )
}
