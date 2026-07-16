/* Wallet & EMD ledger — balance, locks, releases and every rupee's paper trail. */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, UserRound } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Button, Chip, EmptyState, Field, Input, MockPayModal, Modal, PageHeader, Stat, Tabs, cx,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDateTime, inr } from '../../lib/format'
import type { LedgerType } from '../../types'

type TabKey = 'all' | 'locks' | 'releases' | 'topups' | 'payments'

const TAB_TYPES: Record<Exclude<TabKey, 'all'>, LedgerType[]> = {
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

export default function Wallet() {
  const me = useStore((s) => s.currentUser)
  const wallets = useStore((s) => s.wallets)
  const lots = useStore((s) => s.lots)
  const topUpWallet = useStore((s) => s.topUpWallet)
  const pushToast = useStore((s) => s.pushToast)
  const [tab, setTab] = useState<TabKey>('all')
  const [pickOpen, setPickOpen] = useState(false)
  const [amount, setAmount] = useState(100_000)
  const [payOpen, setPayOpen] = useState(false)

  if (!me) {
    return (
      <Page>
        <EmptyState
          icon={<UserRound size={32} strokeWidth={1.5} />}
          title="Sign in to see your wallet"
          body="Balance, EMD locks and the full ledger are tied to your account."
          action={<Link to="/login"><Button>Sign in</Button></Link>}
        />
      </Page>
    )
  }

  const wallet = wallets.find((w) => w.userId === me.id)
  const balance = wallet?.balance ?? 0
  const locked = wallet?.emdLocked ?? 0
  const ledger = wallet?.ledger ?? []
  const rows = tab === 'all' ? ledger : ledger.filter((e) => TAB_TYPES[tab].includes(e.type))

  const counts = {
    all: ledger.length,
    locks: ledger.filter((e) => TAB_TYPES.locks.includes(e.type)).length,
    releases: ledger.filter((e) => TAB_TYPES.releases.includes(e.type)).length,
    topups: ledger.filter((e) => TAB_TYPES.topups.includes(e.type)).length,
    payments: ledger.filter((e) => TAB_TYPES.payments.includes(e.type)).length,
  }

  return (
    <Page>
      <PageHeader
        title="Wallet & EMD ledger"
        sub="Pre-bid EMD locks from your available balance and auto-releases if you don't finish H1. Every movement is logged with a UTR reference."
        actions={
          <>
            <Button variant="secondary"
              onClick={() => pushToast({ kind: 'info', title: 'Withdrawal request noted (demo)', body: 'In production, funds return to your registered bank account within T+1.' })}>
              Withdraw
            </Button>
            <Button onClick={() => setPickOpen(true)}><Banknote size={16} /> Add funds</Button>
          </>
        }
      />

      {/* ------------------------------- Stats -------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Available balance" value={inr(balance)} tone="success" sub="Free to fund EMD or pay balances" />
        <Stat label="EMD locked" value={inr(locked)} tone="steel" sub="Held against shortlisted lots in play" />
        <Stat label="Total" value={inr(balance + locked)} sub="Available + locked" />
      </div>

      {/* ------------------------------- Ledger ------------------------------- */}
      <section className="mt-8">
        <Tabs<TabKey>
          tabs={[
            { key: 'all', label: 'All', count: counts.all },
            { key: 'locks', label: 'EMD locks', count: counts.locks },
            { key: 'releases', label: 'Releases & refunds', count: counts.releases },
            { key: 'topups', label: 'Top-ups', count: counts.topups },
            { key: 'payments', label: 'Payments', count: counts.payments },
          ]}
          value={tab}
          onChange={setTab}
          className="mb-4"
        />

        {rows.length === 0 ? (
          <EmptyState title="No entries here" body="Transactions of this type will appear as soon as they happen." />
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
      </section>

      {/* --------------------------- Add-funds picker -------------------------- */}
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
        amount={inr(amount)}
        onSuccess={(method) => {
          topUpWallet(amount, method)
          pushToast({ kind: 'success', title: 'Wallet top-up successful', body: `${inr(amount)} added via ${method}.` })
          setPayOpen(false)
        }}
      />
    </Page>
  )
}
