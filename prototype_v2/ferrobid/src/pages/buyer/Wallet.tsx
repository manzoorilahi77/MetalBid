/* SmartPay — wallet dashboard, manual deposits/withdrawals, bank accounts,
   refunds and a ledger statement. All money movement here is simulated and
   human-verified (no real payment rail) — see the Deposits/Withdrawals tabs
   for the manual claim/request flow this platform actually uses. */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, UserRound } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Page } from '../../layout/Chrome'
import {
  Button, Chip, EmptyState, Field, Input, MockPayModal, Modal, PageHeader, Select, Stat, Tabs, Segmented, cx,
} from '../../components/ui'
import { fmtClock, nextWithdrawalWindowLabel, useStore, WEEKDAY_LABELS, withinWithdrawalWindow } from '../../store/store'
import { fmtDateTime, inr, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type { LedgerType, WithdrawalWindowConfig } from '../../types'

type TabKey = 'dashboard' | 'deposits' | 'withdrawals' | 'bank' | 'refunds' | 'reports'

type LedgerFilter = 'all' | 'locks' | 'releases' | 'topups' | 'payments'
const LEDGER_TYPES: Record<Exclude<LedgerFilter, 'all'>, LedgerType[]> = {
  locks: ['emd_lock'],
  releases: ['emd_release', 'refund'],
  topups: ['topup'],
  payments: ['payment', 'withdraw', 'emd_forfeit'],
}

const QUICK = [
  { label: '₹50,000', value: 50_000 },
  { label: '₹1,00,000', value: 100_000 },
  { label: '₹5,00,000', value: 500_000 },
]

const DEPOSIT_STATUS: Record<string, { tone: 'success' | 'warning' | 'danger'; label: string }> = {
  submitted: { tone: 'warning', label: 'Under review' },
  approved: { tone: 'success', label: 'Approved' },
  rejected: { tone: 'danger', label: 'Rejected' },
}
const WITHDRAWAL_STATUS: Record<string, { tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string }> = {
  requested: { tone: 'warning', label: 'Requested' },
  under_review: { tone: 'warning', label: 'Under review' },
  processed: { tone: 'success', label: 'Processed' },
  failed: { tone: 'danger', label: 'Failed' },
  cancelled: { tone: 'neutral', label: 'Cancelled' },
}
const BANK_STATUS: Record<string, { tone: 'success' | 'warning' | 'danger'; label: string }> = {
  pending: { tone: 'warning', label: 'Pending verification' },
  verified: { tone: 'success', label: 'Verified' },
  rejected: { tone: 'danger', label: 'Rejected' },
}

const windowDaysLabel = (config: WithdrawalWindowConfig) => {
  const days = [...config.days].sort((a, b) => a - b)
  if (days.length === 0) return 'no days'
  const contiguous = days.length > 1 && days.every((d, i) => i === 0 || d === days[i - 1] + 1)
  return contiguous ? `${WEEKDAY_LABELS[days[0]]}–${WEEKDAY_LABELS[days[days.length - 1]]}` : days.map((d) => WEEKDAY_LABELS[d]).join(', ')
}

export default function Wallet() {
  const me = useStore((s) => s.currentUser)
  const wallets = useStore((s) => s.wallets)
  const lots = useStore((s) => s.lots)
  const disputes = useStore((s) => s.disputes)
  const deliveryOrders = useStore((s) => s.deliveryOrders)
  const bankAccounts = useStore((s) => s.bankAccounts)
  const depositClaims = useStore((s) => s.depositClaims)
  const withdrawalRequests = useStore((s) => s.withdrawalRequests)
  const companyBankAccounts = useStore((s) => s.companyBankAccounts)
  const withdrawalWindow = useStore((s) => s.withdrawalWindow)
  const topUpWallet = useStore((s) => s.topUpWallet)
  const registerBankAccount = useStore((s) => s.registerBankAccount)
  const submitDepositClaim = useStore((s) => s.submitDepositClaim)
  const requestWithdrawal = useStore((s) => s.requestWithdrawal)
  const cancelWithdrawal = useStore((s) => s.cancelWithdrawal)
  const createDispute = useStore((s) => s.createDispute)
  const pushToast = useStore((s) => s.pushToast)
  const now = useNow()

  const [tab, setTab] = useState<TabKey>('dashboard')

  // add funds (instant, unchanged)
  const [pickOpen, setPickOpen] = useState(false)
  const [amount, setAmount] = useState(100_000)
  const [payOpen, setPayOpen] = useState(false)

  // deposit claim
  const [depAmount, setDepAmount] = useState('')
  const [depUtr, setDepUtr] = useState('')
  const [depDate, setDepDate] = useState('')
  const [depProof, setDepProof] = useState('')
  const [depConfirm, setDepConfirm] = useState(false)

  // withdrawal request
  const [wdAmount, setWdAmount] = useState('')
  const [wdAccountId, setWdAccountId] = useState('')
  const [wdConfirm, setWdConfirm] = useState(false)

  // bank account registration
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [holderName, setHolderName] = useState('')
  const [bankConfirm, setBankConfirm] = useState(false)

  // refund request
  const [refSubject, setRefSubject] = useState('')
  const [refLotId, setRefLotId] = useState('')
  const [refBody, setRefBody] = useState('')
  const [refConfirm, setRefConfirm] = useState(false)

  // reports
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  if (!me) {
    return (
      <Page>
        <EmptyState
          icon={<UserRound size={32} strokeWidth={1.5} />}
          title="Sign in to see your wallet"
          body="Balance, deposits, withdrawals and the full ledger are tied to your account."
          action={<Link to="/login"><Button>Sign in</Button></Link>}
        />
      </Page>
    )
  }

  const wallet = wallets.find((w) => w.userId === me.id)
  const balance = wallet?.balance ?? 0
  const locked = wallet?.emdLocked ?? 0
  const ledger = wallet?.ledger ?? []

  const myBankAccounts = bankAccounts.filter((a) => a.userId === me.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const verifiedAccounts = myBankAccounts.filter((a) => a.status === 'verified')
  const myDeposits = depositClaims.filter((c) => c.userId === me.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const myWithdrawals = withdrawalRequests.filter((r) => r.userId === me.id).sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt))
  const pendingWithdrawal = myWithdrawals.filter((r) => r.status === 'requested' || r.status === 'under_review').reduce((s, r) => s + r.amount, 0)
  const myRefunds = disputes.filter((d) => d.userId === me.id && d.category === 'payment').sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const wonLots = deliveryOrders.filter((d) => d.buyerId === me.id).map((d) => lots.find((l) => l.id === d.lotId)).filter((l): l is NonNullable<typeof l> => Boolean(l))

  const inWindow = withinWithdrawalWindow(withdrawalWindow, now)
  const windowLabel = nextWithdrawalWindowLabel(withdrawalWindow, now)

  const wdAmountNum = Number(wdAmount) || 0
  const wdAccount = myBankAccounts.find((a) => a.id === wdAccountId)
  const wdEligible = verifiedAccounts.length > 0 && wdAmountNum > 0 && wdAmountNum <= balance && inWindow && !!wdAccountId

  const rows = ledger
    .filter((e) => ledgerFilter === 'all' || LEDGER_TYPES[ledgerFilter].includes(e.type))
    .filter((e) => !fromDate || Date.parse(e.at) >= Date.parse(fromDate))
    .filter((e) => !toDate || Date.parse(e.at) <= Date.parse(toDate) + 86_400_000 - 1)

  const reportChart = (['topup', 'emd_lock', 'emd_release', 'payment', 'withdraw', 'refund', 'emd_forfeit'] as LedgerType[])
    .map((type) => ({ name: type.replace('_', ' '), value: Math.round(rows.filter((e) => e.type === type).reduce((s, e) => s + Math.abs(e.amount), 0) / 100) / 100 }))
    .filter((d) => d.value > 0)

  return (
    <Page>
      <PageHeader
        title="SmartPay wallet"
        sub="Deposits and withdrawals are manually verified against your bank reference — no card or auto-debit is stored on this platform."
        actions={<Button onClick={() => setPickOpen(true)}><Banknote size={16} /> Add funds</Button>}
      />

      <Tabs<TabKey>
        tabs={[
          { key: 'dashboard', label: 'Dashboard' },
          { key: 'deposits', label: 'Deposits', count: myDeposits.length },
          { key: 'withdrawals', label: 'Withdrawals', count: myWithdrawals.length },
          { key: 'bank', label: 'Bank accounts', count: myBankAccounts.length },
          { key: 'refunds', label: 'EMD Refunds', count: myRefunds.length },
          { key: 'reports', label: 'Reports' },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-5"
      />

      {/* ------------------------------ Dashboard ------------------------------ */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Available balance" value={inr(balance)} tone="success" sub="Free to fund EMD or withdraw" />
            <Stat label="EMD locked" value={inr(locked)} tone="steel" sub="Held against shortlisted lots in play" />
            <Stat label="Withdrawal pending" value={inr(pendingWithdrawal)} tone={pendingWithdrawal > 0 ? 'warning' : undefined} sub="Debited, not yet processed" />
            <Stat label="Total" value={inr(balance + locked)} sub="Available + locked" />
          </div>

          <div>
            <h2 className="font-bold text-sm mb-2">Recent activity</h2>
            {ledger.length === 0 ? (
              <EmptyState title="No activity yet" body="Top-ups, EMD locks and payments will appear here." />
            ) : (
              <div className="card divide-y divide-line overflow-hidden">
                {ledger.slice(0, 5).map((e) => (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{e.note}</div>
                      <div className="text-xs text-ink-faint">{fmtDateTime(e.at)}</div>
                    </div>
                    <span className={cx('num font-semibold whitespace-nowrap', e.amount > 0 ? 'text-success' : 'text-ink')}>
                      {e.amount > 0 ? `+${inr(e.amount)}` : `−${inr(Math.abs(e.amount))}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------- Deposits ------------------------------- */}
      {tab === 'deposits' && (
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="font-bold mb-3">Company bank accounts</h2>
            <p className="text-xs text-ink-muted mb-3">Transfer funds via NEFT/RTGS/UPI to any account below, then submit a claim with your reference number.</p>
            <div className="space-y-2.5">
              {companyBankAccounts.map((a) => (
                <div key={a.id} className="card bg-surface-2 border-0 p-3.5 text-sm flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{a.bank}</div>
                    <div className="num text-xs text-ink-muted mt-0.5">{a.accountNumberMasked} · {a.ifsc}</div>
                  </div>
                  <Chip tone="steel">{a.purpose}</Chip>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-bold mb-3">Submit a deposit claim</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Amount transferred">
                <Input type="number" min={1} className="num" value={depAmount} onChange={(e) => setDepAmount(e.target.value)} placeholder="e.g. 100000" />
              </Field>
              <Field label="UTR / reference number">
                <Input value={depUtr} onChange={(e) => setDepUtr(e.target.value)} placeholder="e.g. UTR2026071912345" />
              </Field>
              <Field label="Transfer date">
                <Input type="date" value={depDate} onChange={(e) => setDepDate(e.target.value)} />
              </Field>
              <Field label="Proof of payment" hint="Optional — screenshot or receipt">
                <Input type="file" onChange={(e) => setDepProof(e.target.files?.[0]?.name ?? '')} />
              </Field>
            </div>
            <Button className="mt-4" disabled={!depAmount || Number(depAmount) <= 0 || !depUtr.trim() || !depDate}
              onClick={() => setDepConfirm(true)}>
              Submit claim
            </Button>
          </div>

          <div>
            <h2 className="font-bold text-sm mb-2">Your claims</h2>
            {myDeposits.length === 0 ? (
              <EmptyState title="No deposit claims yet" body="Claims you submit will show their review status here." />
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-ink-faint border-b border-line">
                      <th className="px-4 py-3 font-semibold">Amount</th>
                      <th className="px-4 py-3 font-semibold">UTR</th>
                      <th className="px-4 py-3 font-semibold">Submitted</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {myDeposits.map((c) => {
                      const s = DEPOSIT_STATUS[c.status]
                      return (
                        <tr key={c.id}>
                          <td className="px-4 py-2.5 num font-semibold">{inr(c.amount)}</td>
                          <td className="px-4 py-2.5 num text-xs text-ink-muted">{c.utr}</td>
                          <td className="px-4 py-2.5 text-xs text-ink-muted">
                            Submitted {relTime(c.createdAt, now)} · usually reviewed within 1 business day
                          </td>
                          <td className="px-4 py-2.5">
                            <Chip tone={s.tone}>{s.label}</Chip>
                            {c.status === 'rejected' && c.rejectionReason && <div className="text-xs text-danger mt-1">{c.rejectionReason}</div>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------ Withdrawals ----------------------------- */}
      {tab === 'withdrawals' && (
        <div className="space-y-6">
          <div className={cx('rounded-xl border px-4 py-3 text-sm', inWindow ? 'bg-success-soft border-success/25 text-success' : 'bg-warning-soft border-warning/25 text-warning')}>
            <div className="font-semibold">
              Withdrawals are processed {windowDaysLabel(withdrawalWindow)}, {fmtClock(withdrawalWindow.startHour, withdrawalWindow.startMinute)}–{fmtClock(withdrawalWindow.endHour, withdrawalWindow.endMinute)} IST.
            </div>
            <div className="text-xs mt-0.5 opacity-90">{inWindow ? 'The window is open right now.' : windowLabel}</div>
          </div>

          {verifiedAccounts.length === 0 ? (
            <div className="card p-5 text-center">
              <p className="text-sm text-ink-muted mb-3">Register and verify a bank account before requesting a withdrawal.</p>
              <Button variant="secondary" onClick={() => setTab('bank')}>Go to bank accounts</Button>
            </div>
          ) : (
            <div className="card p-5">
              <h2 className="font-bold mb-3">Request a withdrawal</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Amount" hint={`Available balance ${inr(balance)}`}>
                  <Input type="number" min={1} className="num" value={wdAmount} onChange={(e) => setWdAmount(e.target.value)} placeholder="e.g. 50000" />
                </Field>
                <Field label="Payout bank account">
                  <Select value={wdAccountId} onChange={(e) => setWdAccountId(e.target.value)}>
                    <option value="">Select a verified account</option>
                    {verifiedAccounts.map((a) => <option key={a.id} value={a.id}>{a.bankName} · {a.accountNumberMasked}</option>)}
                  </Select>
                </Field>
              </div>
              <Button className="mt-4" disabled={!wdEligible} onClick={() => setWdConfirm(true)}>
                Request withdrawal
              </Button>
              {wdAmountNum > balance && <p className="text-xs font-semibold text-danger mt-2">Amount exceeds your available balance.</p>}
            </div>
          )}

          <div>
            <h2 className="font-bold text-sm mb-2">Your requests</h2>
            {myWithdrawals.length === 0 ? (
              <EmptyState title="No withdrawal requests yet" body="Requests you submit will track through requested → under review → processed here." />
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-ink-faint border-b border-line">
                      <th className="px-4 py-3 font-semibold">Amount</th>
                      <th className="px-4 py-3 font-semibold">To account</th>
                      <th className="px-4 py-3 font-semibold">Requested</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {myWithdrawals.map((r) => {
                      const s = WITHDRAWAL_STATUS[r.status]
                      const acc = myBankAccounts.find((a) => a.id === r.bankAccountId)
                      return (
                        <tr key={r.id}>
                          <td className="px-4 py-2.5 num font-semibold">{inr(r.amount)}</td>
                          <td className="px-4 py-2.5 num text-xs text-ink-muted">{acc?.accountNumberMasked ?? '—'}</td>
                          <td className="px-4 py-2.5 text-xs text-ink-muted">Requested {relTime(r.requestedAt, now)}</td>
                          <td className="px-4 py-2.5"><Chip tone={s.tone}>{s.label}</Chip></td>
                          <td className="px-4 py-2.5 text-right">
                            {r.status === 'requested' && (
                              <Button size="sm" variant="ghost" className="text-danger hover:text-danger" onClick={() => {
                                cancelWithdrawal(r.id)
                                pushToast({ kind: 'info', title: 'Withdrawal cancelled', body: `${inr(r.amount)} returned to your wallet.` })
                              }}>Cancel</Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ----------------------------- Bank accounts ---------------------------- */}
      {tab === 'bank' && (
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="font-bold mb-3">Register a payout bank account</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Account holder name">
                <Input value={holderName} onChange={(e) => setHolderName(e.target.value)} placeholder="As per bank records" />
              </Field>
              <Field label="Bank name">
                <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. HDFC Bank" />
              </Field>
              <Field label="Account number">
                <Input inputMode="numeric" className="num" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))} placeholder="Digits only" />
              </Field>
              <Field label="IFSC">
                <Input className="num" value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} placeholder="e.g. HDFC0000060" />
              </Field>
            </div>
            <p className="text-xs text-ink-faint mt-2">Only the last 4 digits are stored — the full number is never saved or shown again after this form.</p>
            <Button className="mt-4" disabled={!holderName.trim() || !bankName.trim() || accountNumber.length < 4 || !ifsc.trim()}
              onClick={() => setBankConfirm(true)}>
              Register account
            </Button>
          </div>

          <div>
            <h2 className="font-bold text-sm mb-2">Your bank accounts</h2>
            {myBankAccounts.length === 0 ? (
              <EmptyState title="No bank accounts yet" body="Register a payout account to unlock withdrawals." />
            ) : (
              <div className="space-y-2.5">
                {myBankAccounts.map((a) => {
                  const s = BANK_STATUS[a.status]
                  return (
                    <div key={a.id} className="card p-3.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-sm">{a.bankName} · <span className="num">{a.accountNumberMasked}</span></div>
                        <div className="text-xs text-ink-muted mt-0.5">{a.accountHolderName} · {a.ifsc}</div>
                        {a.status === 'rejected' && a.rejectionReason && <div className="text-xs text-danger mt-1">{a.rejectionReason}</div>}
                      </div>
                      <Chip tone={s.tone}>{s.label}</Chip>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------------------- Refunds ------------------------------- */}
      {tab === 'refunds' && (
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="font-bold mb-2">Request a refund</h2>
            <p className="text-xs text-ink-muted mb-3">For disputed forfeitures or other payment edge cases. This raises a support ticket — track the full conversation under Disputes.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Subject">
                <Input value={refSubject} onChange={(e) => setRefSubject(e.target.value)} placeholder="e.g. EMD forfeited in error on LOT-04" />
              </Field>
              <Field label="Related lot" hint="Optional — lots you have won">
                <Select value={refLotId} onChange={(e) => setRefLotId(e.target.value)}>
                  <option value="">Not lot-specific</option>
                  {wonLots.map((l) => <option key={l.id} value={l.id}>{l.lotNo} — {l.metal} {l.grade}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Describe the issue" className="mt-4">
              <Input value={refBody} onChange={(e) => setRefBody(e.target.value)} placeholder="Tell us what happened…" />
            </Field>
            <Button className="mt-4" disabled={!refSubject.trim() || !refBody.trim()} onClick={() => setRefConfirm(true)}>
              Request refund
            </Button>
          </div>

          <div>
            <h2 className="font-bold text-sm mb-2">Your refund requests</h2>
            {myRefunds.length === 0 ? (
              <EmptyState title="No refund requests yet" body="Payment-related disputes you raise appear here." />
            ) : (
              <div className="space-y-2.5">
                {myRefunds.map((d) => (
                  <Link key={d.id} to="/disputes" className="card p-3.5 flex items-center justify-between gap-3 hover:border-line-strong transition-colors">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{d.subject}</div>
                      <div className="text-xs text-ink-muted mt-0.5">Raised {relTime(d.createdAt, now)} · usually reviewed within 1 business day</div>
                    </div>
                    <Chip tone={d.status === 'resolved' ? 'success' : d.status === 'in_review' ? 'steel' : 'warning'}>
                      {d.status === 'in_review' ? 'In review' : d.status === 'resolved' ? 'Resolved' : 'Open'}
                    </Chip>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------------------- Reports ------------------------------- */}
      {tab === 'reports' && (
        <div className="space-y-6">
          <div className="card p-5">
            <div className="flex flex-wrap items-end gap-4">
              <Field label="From">
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </Field>
              <Field label="To">
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </Field>
              <Segmented<LedgerFilter> value={ledgerFilter} onChange={setLedgerFilter} options={[
                { key: 'all', label: 'All' },
                { key: 'locks', label: 'EMD locks' },
                { key: 'releases', label: 'Releases' },
                { key: 'topups', label: 'Top-ups' },
                { key: 'payments', label: 'Payments' },
              ]} />
            </div>
          </div>

          {reportChart.length > 0 && (
            <div className="card p-5">
              <h2 className="font-bold mb-4">Movement by type <span className="text-xs text-ink-faint font-normal">(₹, selected range)</span></h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => [inr(Number(v)), 'Amount']}
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 13 }} />
                    <Bar dataKey="value" fill="#E4572E" radius={[6, 6, 0, 0]} maxBarSize={56} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {rows.length === 0 ? (
            <EmptyState title="No entries in this range" body="Adjust the date range or filter to see transactions." />
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-ink-faint border-b border-line">
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Date</th>
                    <th className="px-4 py-3 font-semibold">Particulars</th>
                    <th className="px-4 py-3 font-semibold">Lot</th>
                    <th className="px-4 py-3 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((e) => {
                    const lot = e.lotId ? lots.find((l) => l.id === e.lotId) : undefined
                    const credit = e.amount > 0
                    return (
                      <tr key={e.id} className="hover:bg-surface-2 transition-colors">
                        <td className="px-4 py-2.5 num text-ink-muted whitespace-nowrap">{fmtDateTime(e.at)}</td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{e.note}</div>
                          <div className="num text-xs text-ink-faint mt-0.5">{e.ref}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          {lot && e.catalogueId ? (
                            <Link to={`/catalogue/${e.catalogueId}`}>
                              <Chip tone="steel" className="num hover:opacity-80">{lot.lotNo}</Chip>
                            </Link>
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </td>
                        <td className={cx('px-4 py-2.5 num font-semibold text-right whitespace-nowrap', credit ? 'text-success' : 'text-ink')}>
                          {credit ? `+${inr(e.amount)}` : `−${inr(Math.abs(e.amount))}`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --------------------------- Add-funds picker (unchanged, instant) --------------------------- */}
      <Modal open={pickOpen} onClose={() => setPickOpen(false)} title="Add funds to wallet">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {QUICK.map((q) => (
              <button key={q.value} onClick={() => setAmount(q.value)}
                className={cx('num h-12 rounded-xl border text-sm font-bold transition-colors',
                  amount === q.value
                    ? 'border-ember bg-ember-soft text-ember-strong'
                    : 'border-line bg-surface text-ink-muted hover:border-line-strong')}>
                {q.label}
              </button>
            ))}
          </div>
          <Field label="Or enter a custom amount" hint="Minimum ₹10,000 — funds are available instantly (demo).">
            <Input
              type="number"
              min={10_000}
              step={5_000}
              value={amount}
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
              className="num"
              aria-label="Custom amount"
            />
          </Field>
          <Button className="w-full" size="lg" disabled={amount < 10_000}
            onClick={() => { setPickOpen(false); setPayOpen(true) }}>
            Proceed to pay {inr(amount)}
          </Button>
        </div>
      </Modal>

      <MockPayModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Wallet top-up"
        amount={amount}
        onSuccess={(method) => {
          topUpWallet(amount, method)
          pushToast({ kind: 'success', title: 'Wallet top-up successful', body: `${inr(amount)} added via ${method}.` })
          setPayOpen(false)
        }}
      />

      {/* --------------------------- Confirm: deposit claim --------------------------- */}
      <Modal open={depConfirm} onClose={() => setDepConfirm(false)} title="Confirm deposit claim">
        <div className="space-y-4">
          <div className="card bg-surface-2 border-0 p-3.5 text-sm space-y-1.5">
            <div className="flex justify-between"><span className="text-ink-muted">Amount</span><span className="num font-bold">{inr(Number(depAmount) || 0)}</span></div>
            <div className="flex justify-between"><span className="text-ink-muted">UTR</span><span className="num font-semibold">{depUtr}</span></div>
            <div className="flex justify-between"><span className="text-ink-muted">Transfer date</span><span className="num font-semibold">{depDate}</span></div>
            {depProof && <div className="flex justify-between"><span className="text-ink-muted">Proof</span><span className="font-semibold truncate ml-2">{depProof}</span></div>}
          </div>
          <p className="text-xs text-ink-faint">A sub-admin manually verifies this reference against the bank statement before crediting your wallet.</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setDepConfirm(false)}>Cancel</Button>
            <Button className="flex-1" onClick={() => {
              const res = submitDepositClaim(Number(depAmount), depUtr, depDate, depProof || undefined)
              if (res.ok) {
                pushToast({ kind: 'success', title: 'Deposit claim submitted', body: 'We will review it within 1 business day.' })
                setDepAmount(''); setDepUtr(''); setDepDate(''); setDepProof('')
              } else {
                pushToast({ kind: 'danger', title: 'Claim not submitted', body: res.error })
              }
              setDepConfirm(false)
            }}>
              Confirm & submit
            </Button>
          </div>
        </div>
      </Modal>

      {/* --------------------------- Confirm: withdrawal --------------------------- */}
      <Modal open={wdConfirm} onClose={() => setWdConfirm(false)} title="Confirm withdrawal">
        <div className="space-y-4">
          <div className="card bg-surface-2 border-0 p-3.5 text-sm space-y-1.5">
            <div className="flex justify-between"><span className="text-ink-muted">Amount</span><span className="num font-bold">{inr(wdAmountNum)}</span></div>
            <div className="flex justify-between"><span className="text-ink-muted">To account</span><span className="num font-semibold">{wdAccount?.bankName} · {wdAccount?.accountNumberMasked}</span></div>
          </div>
          {!withinWithdrawalWindow(withdrawalWindow, now) && (
            <div className="rounded-xl bg-warning-soft border border-warning/25 px-3.5 py-2.5 text-sm font-semibold text-warning">
              The processing window just closed. {nextWithdrawalWindowLabel(withdrawalWindow, now)}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setWdConfirm(false)}>Cancel</Button>
            <Button className="flex-1" onClick={() => {
              const res = requestWithdrawal(wdAmountNum, wdAccountId)
              if (res.ok) {
                pushToast({ kind: 'success', title: 'Withdrawal requested', body: `${inr(wdAmountNum)} will be processed within the current window.` })
                setWdAmount(''); setWdAccountId('')
              } else {
                pushToast({ kind: 'danger', title: 'Withdrawal not requested', body: res.error })
              }
              setWdConfirm(false)
            }}>
              Confirm & request
            </Button>
          </div>
        </div>
      </Modal>

      {/* --------------------------- Confirm: bank account --------------------------- */}
      <Modal open={bankConfirm} onClose={() => setBankConfirm(false)} title="Confirm bank account">
        <div className="space-y-4">
          <div className="card bg-surface-2 border-0 p-3.5 text-sm space-y-1.5">
            <div className="flex justify-between"><span className="text-ink-muted">Holder</span><span className="font-semibold">{holderName}</span></div>
            <div className="flex justify-between"><span className="text-ink-muted">Bank</span><span className="font-semibold">{bankName}</span></div>
            <div className="flex justify-between"><span className="text-ink-muted">Account</span><span className="num font-semibold">•••• {accountNumber.slice(-4)}</span></div>
            <div className="flex justify-between"><span className="text-ink-muted">IFSC</span><span className="num font-semibold">{ifsc}</span></div>
          </div>
          <p className="text-xs text-ink-faint">A sub-admin will verify this account before it can receive withdrawals.</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setBankConfirm(false)}>Cancel</Button>
            <Button className="flex-1" onClick={() => {
              registerBankAccount(bankName.trim(), accountNumber, ifsc.trim(), holderName.trim())
              pushToast({ kind: 'success', title: 'Bank account submitted', body: 'Pending verification before it can receive withdrawals.' })
              setBankName(''); setAccountNumber(''); setIfsc(''); setHolderName('')
              setBankConfirm(false)
            }}>
              Confirm & register
            </Button>
          </div>
        </div>
      </Modal>

      {/* --------------------------- Confirm: refund --------------------------- */}
      <Modal open={refConfirm} onClose={() => setRefConfirm(false)} title="Confirm refund request">
        <div className="space-y-4">
          <div className="card bg-surface-2 border-0 p-3.5 text-sm space-y-1.5">
            <div className="flex justify-between"><span className="text-ink-muted">Subject</span><span className="font-semibold">{refSubject}</span></div>
            {refLotId && <div className="flex justify-between"><span className="text-ink-muted">Lot</span><span className="num font-semibold">{lots.find((l) => l.id === refLotId)?.lotNo}</span></div>}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setRefConfirm(false)}>Cancel</Button>
            <Button className="flex-1" onClick={() => {
              createDispute(refSubject.trim(), 'payment', refBody.trim(), refLotId || undefined)
              pushToast({ kind: 'success', title: 'Refund request submitted', body: 'Track the conversation under Disputes — usually reviewed within 1 business day.' })
              setRefSubject(''); setRefLotId(''); setRefBody('')
              setRefConfirm(false)
            }}>
              Confirm & submit
            </Button>
          </div>
        </div>
      </Modal>
    </Page>
  )
}
