/* ---------------------------------------------------------------------------
   Finance Administrator — payout bank accounts.

   This screen heads the money-out group rather than sitting with the records,
   because it is a prerequisite: an account has to be verified before a
   withdrawal can be paid to it. Filed under "records" it looked like admin;
   filed here it reads as what it is — the gate on every rupee that leaves.

   Only the last four digits of an account number are ever persisted, and that
   happens at entry rather than at display. There is nothing on this screen to
   redact because the full number was never kept.
--------------------------------------------------------------------------- */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Building2, Check, CheckCircle2, Search, ShieldCheck, X } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Avatar, Button, Chip, EmptyState, Field, Input, Modal, PageHeader, Textarea, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, num, fmtDate, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import { Ageing, MoneyStat, QueueStrip, ScopeNote, SectionTitle, useFinanceScope } from '../shared/finance'
import type { BankAccount } from '../../types'

type Tab = 'pending' | 'verified' | 'rejected'

export default function BankAccounts() {
  const now = useNow()
  const accounts = useStore((s) => s.bankAccounts)
  const users = useStore((s) => s.users)
  const withdrawals = useStore((s) => s.withdrawalRequests)
  const verify = useStore((s) => s.verifyBankAccount)
  const reject = useStore((s) => s.rejectBankAccount)
  const pushToast = useStore((s) => s.pushToast)
  const { canExecute } = useFinanceScope()

  const [tab, setTab] = useState<Tab>('pending')
  const [q, setQ] = useState('')
  const [rejecting, setRejecting] = useState<BankAccount | null>(null)
  const [reason, setReason] = useState('')

  const pending = accounts.filter((a) => a.status === 'pending')
  const verified = accounts.filter((a) => a.status === 'verified')
  const rejected = accounts.filter((a) => a.status === 'rejected')

  const shown = useMemo(() => {
    const base = tab === 'pending' ? pending : tab === 'verified' ? verified : rejected
    const query = q.trim().toLowerCase()
    return base
      .filter((a) => {
        if (!query) return true
        const u = users.find((x) => x.id === a.userId)
        return (u?.firm ?? '').toLowerCase().includes(query)
          || a.bankName.toLowerCase().includes(query)
          || a.last4.includes(query)
          || a.ifsc.toLowerCase().includes(query)
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  }, [tab, pending, verified, rejected, q, users])

  /** A pending account with a withdrawal already queued against it is the one
   *  that actually holds someone up — surfaced rather than left to be noticed. */
  const blocking = useMemo(() => {
    const pendingIds = new Set(pending.map((a) => a.id))
    return withdrawals.filter((w) => pendingIds.has(w.bankAccountId) && (w.status === 'requested' || w.status === 'under_review'))
  }, [pending, withdrawals])

  const doVerify = (a: BankAccount) => {
    // The store refuses a caller who cannot move money; say so rather than
    // reporting a success that never happened.
    if (!canExecute) { pushToast({ kind: 'warning', title: 'Read-only', body: 'Only the Finance Administrator can verify a payout account.' }); return }
    verify(a.id)
    const u = users.find((x) => x.id === a.userId)
    pushToast({ kind: 'success', title: 'Account verified', body: `${u?.firm ?? 'The customer'} can now receive withdrawals to ${a.bankName} ${a.accountNumberMasked}.` })
  }

  const doReject = () => {
    if (!rejecting) return
    if (!canExecute) { pushToast({ kind: 'warning', title: 'Read-only', body: 'Only the Finance Administrator can reject a payout account.' }); setRejecting(null); return }
    reject(rejecting.id, reason.trim())
    pushToast({ kind: 'info', title: 'Account rejected', body: 'They have been told why and can re-register with correct details.' })
    setRejecting(null); setReason('')
  }

  return (
    <Page>
      <PageHeader
        title="Payout bank accounts"
        sub="Where money leaves to. Nothing can be paid to an account until it has been checked against the registered firm."
        actions={
          blocking.length > 0
            ? <Chip tone="warning"><AlertTriangle size={12} /> {num(blocking.length)} withdrawal{blocking.length === 1 ? '' : 's'} blocked</Chip>
            : <Chip tone="success"><ShieldCheck size={12} /> Nothing blocked</Chip>
        }
      />

      <QueueStrip steps={[
        { label: 'Awaiting verification', count: pending.length, urgent: true, onClick: () => setTab('pending'), active: tab === 'pending' },
        { label: 'Verified', count: verified.length, onClick: () => setTab('verified'), active: tab === 'verified' },
        { label: 'Rejected', count: rejected.length, onClick: () => setTab('rejected'), active: tab === 'rejected' },
        { label: 'Withdrawals held up by this', count: blocking.length, to: '/finance/withdrawals', urgent: blocking.length > 0 },
      ]} />

      {blocking.length > 0 && (
        <div className="card border-l-4 border-l-warning p-4 flex flex-wrap items-center gap-3 mb-6">
          <AlertTriangle size={18} className="text-warning shrink-0" />
          <p className="text-[13px] text-ink-muted flex-1 min-w-56">
            {num(blocking.length)} customer{blocking.length === 1 ? ' is' : 's are'} waiting on{' '}
            <span className="num font-bold text-ink">{inr(blocking.reduce((s, w) => s + w.amount, 0))}</span> that cannot be paid
            until the destination account is verified. These come first.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MoneyStat label="Awaiting verification" amount={0} tone="risk" sub={`${num(pending.length)} account${pending.length === 1 ? '' : 's'}`} exact />
        <MoneyStat label="Payable to verified accounts" amount={withdrawals.filter((w) => verified.some((a) => a.id === w.bankAccountId) && w.status !== 'cancelled').reduce((s, w) => s + w.amount, 0)} tone="out" sub="requested all time" />
        <MoneyStat label="Held up by verification" amount={blocking.reduce((s, w) => s + w.amount, 0)} tone="risk" sub="cannot be paid yet" to="/finance/withdrawals" />
        <MoneyStat label="Rejected" amount={0} tone="plain" sub={`${num(rejected.length)} — customer may re-register`} exact />
      </div>

      <SectionTitle
        title={tab === 'pending' ? 'On the desk' : tab === 'verified' ? 'Verified' : 'Rejected'}
        count={shown.length}
        sub={tab === 'pending'
          ? 'Check the account holder name against the registered firm. A mismatch is the single commonest reason a payout goes to the wrong place.'
          : 'Nothing is deleted from this list — a rejected account stays visible with its reason.'}
        action={
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            <Input className="h-9 w-56 pl-9" placeholder="Firm, bank, IFSC or last 4…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        }
      />

      {shown.length === 0 ? (
        <EmptyState
          icon={<Building2 size={32} strokeWidth={1.5} />}
          title={tab === 'pending' ? 'No account is waiting' : q ? 'Nothing matches that search' : `No ${tab} accounts`}
          body={tab === 'pending'
            ? 'Buyers and sellers register a payout account from their wallet. New registrations land here to be checked.'
            : 'Decided accounts appear here with who decided them and why.'}
        />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {shown.map((a) => {
            const u = users.find((x) => x.id === a.userId)
            const nameMismatch = u && a.accountHolderName.trim().toLowerCase() !== u.firm.trim().toLowerCase()
            const queued = withdrawals.filter((w) => w.bankAccountId === a.id && (w.status === 'requested' || w.status === 'under_review'))
            return (
              <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 hover:bg-surface-2 transition-colors">
                <Avatar name={u?.name ?? '?'} hue={u?.avatarHue ?? 200} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">{u?.firm ?? a.userId}</span>
                    <Chip tone="neutral">{u?.role === 'seller' ? 'Seller' : 'Buyer'}</Chip>
                    {a.status === 'verified' && <Chip tone="success"><CheckCircle2 size={11} /> Verified</Chip>}
                    {a.status === 'rejected' && <Chip tone="danger">Rejected</Chip>}
                    {a.status === 'pending' && queued.length > 0 && (
                      <Chip tone="warning"><AlertTriangle size={11} /> {num(queued.length)} withdrawal waiting</Chip>
                    )}
                  </div>
                  <div className="text-[12px] text-ink-muted mt-0.5 num truncate">
                    {a.bankName} · {a.accountNumberMasked} · {a.ifsc}
                  </div>
                  <div className={cx('text-[12px] mt-0.5 truncate', nameMismatch && a.status === 'pending' ? 'text-warning font-semibold' : 'text-ink-faint')}>
                    Account holder: {a.accountHolderName}
                    {nameMismatch && a.status === 'pending' && ' — does not match the registered firm name'}
                  </div>
                  {a.rejectionReason && <div className="text-[12px] text-danger mt-0.5">{a.rejectionReason}</div>}
                  <div className="text-[11px] text-ink-faint mt-0.5">Registered {fmtDate(a.createdAt)} · {relTime(a.createdAt, now)}</div>
                </div>
                {a.status === 'pending' && <Ageing since={a.createdAt} now={now} warnDays={2} dangerDays={5} />}
                {a.status === 'pending' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="secondary" onClick={() => setRejecting(a)}><X size={13} /> Reject</Button>
                    <Button size="sm" variant="success" onClick={() => doVerify(a)}><Check size={13} /> Verify</Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-8">
        <ScopeNote>
          Only the last four digits of an account number are ever stored — masking happens when the customer types it,
          not when this page renders it, so there is nothing here to leak. Verifying an account is what unblocks the
          matching request on{' '}
          <Link to="/finance/withdrawals" className="text-ember font-semibold hover:underline">Withdrawals</Link>, which is
          then reviewed and released by two different Finance users.
        </ScopeNote>
      </div>

      <Modal open={!!rejecting} onClose={() => { setRejecting(null); setReason('') }} title="Reject this account">
        <div className="space-y-4">
          <div className="card bg-warning-soft border-0 p-4 text-sm">
            {users.find((u) => u.id === rejecting?.userId)?.firm ?? 'The customer'} registered{' '}
            <span className="num font-semibold">{rejecting?.bankName} {rejecting?.accountNumberMasked}</span>. Rejecting means no
            payout can go to it. They can re-register with corrected details straight away.
          </div>
          <Field label="Reason" hint="Shown to the customer so they know exactly what to fix.">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Account holder name does not match the registered firm name on your KYC…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setRejecting(null); setReason('') }}>Cancel</Button>
            <Button variant="danger" disabled={reason.trim().length < 4} onClick={doReject}>Reject account</Button>
          </div>
        </div>
      </Modal>
    </Page>
  )
}
