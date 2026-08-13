/* ---------------------------------------------------------------------------
   Sub Admin — EMD & payment activity.

   Every rupee moving through the platform appears here as well as in Finance.
   The distinction the whole screen turns on: **Finance owns the money, this
   desk owns the operational picture.** A buyer whose EMD has not cleared cannot
   bid tomorrow — that is an operations problem before it is an accounting one,
   and this is where it is seen.

   So nothing here executes. There is no approve, no release, no forfeit. What
   there is instead is a route into Finance's own screen for each item, and a
   way to put a recommendation on the record where this desk has the operational
   context Finance does not.

   Money the platform is only *holding* is drawn in steel, never in a profit
   colour — EMD is a customer's money sitting in our account.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Banknote, Lock, Landmark, Wallet as WalletIcon } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Button, Chip, EmptyState, Field, Modal, PageHeader, Segmented, Select, Stat, Textarea,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDateTime, inr, inrCompact, num, relTime } from '../../lib/format'
import { doOutstanding } from '../../lib/money'
import { useNow } from '../../lib/useTick'
import { LinkButton, WatchOnlyBanner } from './shared'

type Tab = 'emd' | 'in' | 'out' | 'commission'

export default function PaymentActivity() {
  const now = useNow()
  const users = useStore((s) => s.users)
  const wallets = useStore((s) => s.wallets)
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const depositClaims = useStore((s) => s.depositClaims)
  const withdrawalRequests = useStore((s) => s.withdrawalRequests)
  const deliveryOrders = useStore((s) => s.deliveryOrders)
  const commissionSettlements = useStore((s) => s.commissionSettlements)
  const emdForfeitures = useStore((s) => s.emdForfeitures)
  const audit = useStore((s) => s.audit)
  const notify = useStore((s) => s.notify)
  const pushToast = useStore((s) => s.pushToast)

  const [tab, setTab] = useState<Tab>('emd')
  const [recommending, setRecommending] = useState<{ what: string; ref: string; href: string } | null>(null)
  const [stance, setStance] = useState<'approve' | 'reject' | 'hold'>('approve')
  const [note, setNote] = useState('')

  const firmOf = (id: string) => users.find((u) => u.id === id)?.firm ?? id
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? id

  /* -------------------------------- the totals --------------------------- */
  const emdHeld = wallets.reduce((t, w) => t + (w.emdLocked ?? 0), 0)
  const walletBalances = wallets.reduce((t, w) => t + (w.balance ?? 0), 0)
  const pendingIn = depositClaims.filter((c) => c.status === 'submitted')
  const pendingOut = withdrawalRequests.filter((r) => r.status === 'requested' || r.status === 'under_review')
  const outstandingDos = deliveryOrders.filter((d) => doOutstanding(d) > 0)
  const commissionUnconfirmed = commissionSettlements.filter((s) => s.status !== 'confirmed')

  /** Who is holding EMD right now, and against which sale. The operational
   *  question this answers: can this buyer bid tomorrow. */
  const emdRows = wallets
    .filter((w) => (w.emdLocked ?? 0) > 0)
    .map((w) => {
      const u = users.find((x) => x.id === w.userId)
      const live = catalogues.filter((c) =>
        (c.status === 'live' || c.status === 'upcoming')
        && lots.some((l) => l.catalogueId === c.id))
      return { wallet: w, user: u, live }
    })
    .sort((a, b) => (b.wallet.emdLocked ?? 0) - (a.wallet.emdLocked ?? 0))

  const recommend = () => {
    if (!recommending) return
    if (!note.trim()) {
      pushToast({ kind: 'warning', title: 'Nothing recorded', body: 'A recommendation without a reason is not one.' })
      return
    }
    const verb = stance === 'approve' ? 'Recommend approving' : stance === 'reject' ? 'Recommend refusing' : 'Recommend holding'
    audit('finance.recommend', recommending.ref, `${verb} — ${note.trim()}`, 'info')
    notify({
      userId: null, kind: 'system',
      title: `Sub Admin recommendation — ${recommending.what}`,
      body: `${verb}: ${note.trim()}`,
      href: recommending.href,
    })
    pushToast({
      kind: 'success',
      title: 'Recommendation sent to Finance',
      body: 'It is on the record against this item. Finance still decides.',
    })
    setRecommending(null)
    setNote('')
    setStance('approve')
  }

  const openRecommend = (what: string, ref: string, href: string) => {
    setRecommending({ what, ref, href })
    setStance('approve')
    setNote('')
  }

  return (
    <Page>
      <PageHeader
        title="EMD & payment activity"
        sub="Every rupee moving through the platform, from the operational side. Finance decides all of it — this is where you see what it means for the sale."
        actions={<Chip tone="steel"><Lock size={11} /> Finance owns the money</Chip>}
      />

      <WatchOnlyBanner>
        <strong className="text-ink">Nothing on this screen moves money.</strong> A Sub Admin sees every deposit,
        withdrawal, payment and commission and can put a recommendation on the record — Finance approves and processes
        every one of them, and no single desk holds both ends of a customer's money.{' '}
        <Link to="/finance" className="font-semibold text-ember hover:underline">Open the Finance desk</Link>.
      </WatchOnlyBanner>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        <Stat label="EMD held" value={inrCompact(emdHeld)} tone="steel" sub="Customers' money we are holding" />
        <Stat label="Wallet balances" value={inrCompact(walletBalances)} tone="steel" sub="Funded, not yet committed" />
        <Stat label="Deposits waiting" value={num(pendingIn.length)} tone={pendingIn.length ? 'ember' : undefined} sub={inrCompact(pendingIn.reduce((t, c) => t + c.amount, 0))} />
        <Stat label="Withdrawals waiting" value={num(pendingOut.length)} sub={inrCompact(pendingOut.reduce((t, r) => t + r.amount, 0))} />
        <Stat label="Commission unconfirmed" value={num(commissionUnconfirmed.length)} sub="Sellers who say they have paid" />
      </div>

      <div className="mb-4">
        <Segmented<Tab>
          options={[
            { key: 'emd', label: `EMD held (${emdRows.length})` },
            { key: 'in', label: `Money in (${pendingIn.length})` },
            { key: 'out', label: `Money out (${pendingOut.length})` },
            { key: 'commission', label: `Commission (${commissionUnconfirmed.length})` },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {/* ------------------------------- EMD held ---------------------------- */}
      {tab === 'emd' && (
        emdRows.length === 0 ? (
          <EmptyState title="No EMD locked" body="Nothing is committed to a sale right now. EMD locks automatically when a buyer funds against a catalogue and releases automatically at close." />
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-ink-faint border-b border-line">
                    <th className="px-5 py-2.5 font-semibold">Buyer</th>
                    <th className="px-3 py-2.5 font-semibold text-right">EMD locked</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Wallet free</th>
                    <th className="px-3 py-2.5 font-semibold">Standing</th>
                    <th className="px-5 py-2.5 font-semibold text-right">Ledger</th>
                  </tr>
                </thead>
                <tbody>
                  {emdRows.map(({ wallet, user }) => (
                    <tr key={wallet.userId} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                      <td className="px-5 py-3">
                        <div className="font-semibold">{user?.firm ?? wallet.userId}</div>
                        <div className="text-xs text-ink-faint mt-0.5">
                          {user?.name}{user?.bidderId && <span className="num"> · {user.bidderId}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right num font-bold text-steel">{inr(wallet.emdLocked ?? 0)}</td>
                      <td className="px-3 py-3 text-right num">{inr(wallet.balance ?? 0)}</td>
                      <td className="px-3 py-3">
                        <Chip tone={user?.standing === 'good' ? 'success' : user?.standing === 'watchlist' ? 'warning' : 'danger'}>
                          {user?.standing ?? 'good'}
                        </Chip>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <LinkButton to="/finance/emd">Open in Finance</LinkButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 bg-surface-2 border-t border-line text-xs text-ink-muted">
              EMD releases automatically at close and can <b>never</b> be forfeited automatically — one returns a
              customer's money, the other takes it. Forfeiture is raised by Finance and signed by the CEO above the
              configured value.
              {emdForfeitures.length > 0 && <> {num(emdForfeitures.length)} forfeiture{emdForfeitures.length === 1 ? '' : 's'} on record.</>}
            </div>
          </div>
        )
      )}

      {/* ------------------------------- money in ---------------------------- */}
      {tab === 'in' && (
        <div className="space-y-4">
          <section className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-bold text-lg flex items-center gap-2">
                <Landmark size={18} className="text-ember" /> Deposit claims awaiting Finance
              </h2>
              <LinkButton to="/finance/deposits">Open in Finance</LinkButton>
            </div>
            {pendingIn.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-muted">Nothing waiting. A buyer transfers, claims the deposit against a UTR, and Finance matches it to the bank.</p>
            ) : (
              <ul>
                {pendingIn.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-line last:border-0">
                    <div className="flex-1 min-w-48">
                      <div className="font-semibold text-sm">{firmOf(c.userId)} — {inr(c.amount)}</div>
                      <div className="text-xs text-ink-muted mt-0.5">
                        UTR <span className="num">{c.utr}</span> · transferred {fmtDateTime(c.transferDate)} · claimed {relTime(c.createdAt, now)}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm"
                      onClick={() => openRecommend(`Deposit claim ${inr(c.amount)}`, `${firmOf(c.userId)} · UTR ${c.utr}`, '/finance/deposits')}>
                      Recommend
                    </Button>
                    <LinkButton to="/finance/deposits" variant="ghost"><ArrowUpRight size={13} /> Finance</LinkButton>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-bold text-lg flex items-center gap-2">
                <Banknote size={18} className="text-steel" /> Buyers who have won and not yet paid
              </h2>
              <LinkButton to="/finance/payments">Open in Finance</LinkButton>
            </div>
            {outstandingDos.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-muted">Every delivery order is paid. Operations can schedule lifting on all of them.</p>
            ) : (
              <ul>
                {outstandingDos.slice(0, 8).map((d) => {
                  const lot = lots.find((l) => l.id === d.lotId)
                  return (
                    <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-line last:border-0">
                      <div className="flex-1 min-w-48">
                        <div className="font-semibold text-sm">
                          {firmOf(d.buyerId)} · <span className="num">{lot?.lotNo ?? d.lotId}</span>
                        </div>
                        <div className="text-xs text-ink-muted mt-0.5">
                          Delivery order <span className="num">{d.id.toUpperCase()}</span> · stage {d.stage.replace('_', ' ')}
                        </div>
                      </div>
                      <Chip tone="warning">Unpaid</Chip>
                      <LinkButton to="/finance/payments" variant="ghost"><ArrowUpRight size={13} /> Finance</LinkButton>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="px-5 py-3 bg-surface-2 border-t border-line text-xs text-ink-muted">
              Finance confirms the payment; Operations then releases the delivery order and schedules lifting. Until it
              is confirmed, nothing lifts —{' '}
              <Link to="/exec/logistics" className="font-semibold text-ember hover:underline">logistics</Link>.
            </div>
          </section>
        </div>
      )}

      {/* ------------------------------- money out --------------------------- */}
      {tab === 'out' && (
        pendingOut.length === 0 ? (
          <EmptyState title="No withdrawals waiting" body="A withdrawal is reviewed by one Finance user and processed by another — two people, always, and the audit names each of them." />
        ) : (
          <div className="card overflow-hidden">
            <ul>
              {pendingOut.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-line last:border-0">
                  <span className="size-9 rounded-xl bg-ember-soft text-ember-strong border border-line flex items-center justify-center shrink-0">
                    <WalletIcon size={16} />
                  </span>
                  <div className="flex-1 min-w-48">
                    <div className="font-semibold text-sm">{firmOf(r.userId)} — {inr(r.amount)}</div>
                    <div className="text-xs text-ink-muted mt-0.5">
                      Requested {relTime(r.requestedAt, now)} · {r.status === 'requested' ? 'awaiting Finance review' : 'reviewed, awaiting a second Finance user to process'}
                    </div>
                  </div>
                  <Chip tone={r.status === 'requested' ? 'warning' : 'steel'}>
                    {r.status === 'requested' ? 'Step 1 of 2' : 'Step 2 of 2'}
                  </Chip>
                  <Button variant="ghost" size="sm"
                    onClick={() => openRecommend(`Withdrawal ${inr(r.amount)}`, `${firmOf(r.userId)} · ${r.id.toUpperCase()}`, '/finance/withdrawals')}>
                    Recommend
                  </Button>
                  <LinkButton to="/finance/withdrawals" variant="ghost"><ArrowUpRight size={13} /> Finance</LinkButton>
                </li>
              ))}
            </ul>
            <div className="px-5 py-3 bg-surface-2 border-t border-line text-xs text-ink-muted">
              Maker–checker: the Finance user who reviews a withdrawal is never the one who pays it. A Sub Admin is
              neither.
            </div>
          </div>
        )
      )}

      {/* ------------------------------ commission --------------------------- */}
      {tab === 'commission' && (
        commissionUnconfirmed.length === 0 ? (
          <EmptyState title="Every settlement is confirmed" body="A seller pays commission by transfer or has it netted from EMD; Finance matches it against the bank and the auction closes." />
        ) : (
          <div className="card overflow-hidden">
            <ul>
              {commissionUnconfirmed.map((s) => {
                const cat = catalogues.find((c) => c.id === s.catalogueId)
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-line last:border-0">
                    <div className="flex-1 min-w-48">
                      <div className="font-semibold text-sm">
                        {nameOf(s.sellerId)} — {inr(s.amount)}
                        {cat && <span className="num text-xs font-bold text-ember ml-2">{cat.code}</span>}
                      </div>
                      <div className="text-xs text-ink-muted mt-0.5">
                        Paid by {s.mode === 'emd' ? 'netting from EMD' : 'bank transfer'}
                        {s.reference && <> · ref <span className="num">{s.reference}</span></>}
                        {' '}· recorded {relTime(s.at, now)}
                      </div>
                    </div>
                    <Chip tone={s.status === 'queried' ? 'danger' : 'warning'}>
                      {s.status === 'queried' ? 'Queried by Finance' : 'Awaiting Finance'}
                    </Chip>
                    <LinkButton to="/finance/commission" variant="ghost"><ArrowUpRight size={13} /> Finance</LinkButton>
                  </li>
                )
              })}
            </ul>
            <div className="px-5 py-3 bg-surface-2 border-t border-line text-xs text-ink-muted">
              An auction is not done until every sold lot has a seller decision and, where commission is owed, a
              settlement Finance has matched against the bank.
            </div>
          </div>
        )
      )}

      {/* --------------------------- recommendation --------------------------- */}
      <Modal open={!!recommending} onClose={() => setRecommending(null)} title="Recommend to Finance">
        {recommending && (
          <div className="space-y-4">
            <div className="card bg-surface-2 p-3.5 text-sm">
              <div className="font-semibold">{recommending.what}</div>
              <div className="text-xs text-ink-muted mt-0.5">{recommending.ref}</div>
            </div>
            <p className="text-sm text-ink-muted">
              This does not decide anything. It puts what you know operationally — the customer's history, a call you
              took, a lifting that has already happened — in front of the person who does.
            </p>
            <Field label="Your recommendation">
              <Select value={stance} onChange={(e) => setStance(e.target.value as typeof stance)}>
                <option value="approve">Recommend approving</option>
                <option value="reject">Recommend refusing</option>
                <option value="hold">Recommend holding until something else settles</option>
              </Select>
            </Field>
            <Field label="Why" hint="Finance sees this against the item.">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. this buyer's last two liftings were clean and they are bidding on AUC-2418 tomorrow…" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRecommending(null)}>Cancel</Button>
              <Button onClick={recommend}>Send to Finance</Button>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  )
}
