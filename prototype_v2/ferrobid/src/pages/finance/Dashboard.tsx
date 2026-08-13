/* ---------------------------------------------------------------------------
   Finance Administrator — dashboard.

   The role had no landing surface at all: money work was discovered by opening
   somebody else's queue and looking. This answers two questions and nothing
   else — is anything wrong, and what needs me today — and every row opens the
   screen where the thing is actually resolved.

   The layout follows the money rather than the org chart: what came in, what we
   are holding, what has to go out, and only then whether any of it made a
   profit. Held money is drawn in steel throughout and never in a profit colour;
   EMD is a customer's money sitting in our account.
--------------------------------------------------------------------------- */
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, BadgeIndianRupee, Banknote, CheckCircle2, FileWarning, Landmark,
  Receipt, RotateCcw, Scale, ShieldAlert, Signature, Wallet as WalletIcon,
} from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Chip, EmptyState, PageHeader, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, inrCompact, num, relTime } from '../../lib/format'
import { delta } from '../../lib/money'
import { Ageing, MoneyStat, SectionTitle, ScopeNote, useBooks, useFinanceQueues } from './shared'

/* ------------------------------- work rows --------------------------------- */
function WorkRow({ icon, tone, title, body, meta, amount, to, cta }: {
  icon: React.ReactNode
  tone: 'danger' | 'warning' | 'steel' | 'success'
  title: React.ReactNode
  body: React.ReactNode
  meta?: React.ReactNode
  amount?: number
  to: string
  cta: string
}) {
  const toneCls = {
    danger: 'bg-danger-soft text-danger',
    warning: 'bg-warning-soft text-warning',
    steel: 'bg-steel-soft text-steel',
    success: 'bg-success-soft text-success',
  }[tone]
  return (
    <Link to={to} className="group flex items-start gap-3.5 px-4 py-3.5 hover:bg-surface-2 transition-colors">
      <span className={cx('size-9 rounded-xl grid place-items-center shrink-0 mt-0.5', toneCls)}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-sm leading-snug">{title}</span>
        <span className="block text-[13px] text-ink-muted leading-snug mt-0.5">{body}</span>
        {meta && <span className="block text-[11px] text-ink-faint mt-1">{meta}</span>}
      </span>
      {amount != null && (
        <span className="num text-sm font-bold shrink-0 self-center tabular-nums hidden sm:block">{inrCompact(amount)}</span>
      )}
      <span className="shrink-0 self-center text-[12px] font-bold text-ember opacity-0 group-hover:opacity-100 transition-opacity hidden md:inline-flex items-center gap-1">
        {cta} <ArrowRight size={12} />
      </span>
    </Link>
  )
}

export default function FinanceDashboard() {
  const books = useBooks('month')
  const q = useFinanceQueues()
  const users = useStore((s) => s.users)
  const firm = (id: string) => users.find((u) => u.id === id)?.firm ?? 'Unknown firm'

  const netTrend = delta(books.netProfit, books.prevNetProfit)

  /* Ranked by what it costs the business to leave it — a customer waiting on
     their own money outranks a reconciliation break, which outranks a chase. */
  const attention = [
    ...q.withdrawalsToProcess.map((r) => ({
      key: `wdp-${r.id}`, weight: 0,
      icon: <Banknote size={16} />, tone: 'danger' as const,
      title: <>{firm(r.userId)} is waiting on {inr(r.amount)}</>,
      body: 'Reviewed and cleared for release. It needs a second Finance user to actually pay it.',
      meta: `Reviewed ${relTime(r.reviewedAt ?? r.requestedAt, books.now)}`,
      amount: r.amount, to: '/finance/withdrawals', cta: 'Process',
    })),
    ...q.depositsToVerify.map((c) => ({
      key: `dep-${c.id}`, weight: 1,
      icon: <Landmark size={16} />, tone: 'warning' as const,
      title: <>{firm(c.userId)} claims a deposit of {inr(c.amount)}</>,
      body: `UTR ${c.utr} — match it to the statement before crediting the wallet. Their EMD cannot be funded until it lands.`,
      meta: `Claimed ${relTime(c.createdAt, books.now)}`,
      amount: c.amount, to: '/finance/deposits', cta: 'Verify',
    })),
    ...q.withdrawalsToReview.map((r) => ({
      key: `wdr-${r.id}`, weight: 2,
      icon: <WalletIcon size={16} />, tone: 'warning' as const,
      title: <>Withdrawal of {inr(r.amount)} from {firm(r.userId)}</>,
      body: 'Awaiting review. Check the balance, the EMD exposure and that the payout account is verified.',
      meta: `Requested ${relTime(r.requestedAt, books.now)}`,
      amount: r.amount, to: '/finance/withdrawals', cta: 'Review',
    })),
    ...q.commissionsToConfirm.map((r) => ({
      key: `com-${r.cat.id}`, weight: 3,
      icon: <BadgeIndianRupee size={16} />, tone: 'steel' as const,
      title: <>{r.seller?.firm ?? 'A seller'} says they have settled {r.cat.code}</>,
      body: `${inr(r.commissionDue)} ${r.settlement?.mode === 'emd' ? 'netted from their held EMD' : `by transfer, reference ${r.settlement?.reference ?? '—'}`}. The auction stays open until you confirm it arrived.`,
      meta: `Recorded ${relTime(r.settlement?.at ?? r.closedAt, books.now)}`,
      amount: r.commissionDue, to: '/finance/commission', cta: 'Confirm',
    })),
    ...q.refundsToProcess.map((r) => ({
      key: `refp-${r.id}`, weight: 3,
      icon: <RotateCcw size={16} />, tone: 'steel' as const,
      title: <>Approved refund of {inr(r.amount)} to {firm(r.userId)}</>,
      body: r.reason,
      meta: `Approved ${relTime(r.decidedAt ?? r.raisedAt, books.now)} — not yet credited`,
      amount: r.amount, to: '/finance/refunds', cta: 'Process',
    })),
    ...q.refundsToDecide.map((r) => ({
      key: `refd-${r.id}`, weight: 4,
      icon: <RotateCcw size={16} />, tone: 'warning' as const,
      title: <>Refund of {inr(r.amount)} raised for {firm(r.userId)}</>,
      body: r.reason,
      meta: `Raised ${relTime(r.raisedAt, books.now)}`,
      amount: r.amount, to: '/finance/refunds', cta: 'Decide',
    })),
    ...q.accountsToVerify.map((a) => ({
      key: `ba-${a.id}`, weight: 5,
      icon: <Landmark size={16} />, tone: 'steel' as const,
      title: <>{firm(a.userId)} registered a payout account</>,
      body: `${a.bankName} ${a.accountNumberMasked} · ${a.ifsc}. No withdrawal can be paid to it until it is verified.`,
      meta: `Registered ${relTime(a.createdAt, books.now)}`,
      amount: undefined as number | undefined, to: '/finance/bank-accounts', cta: 'Verify',
    })),
    ...(q.reconExceptions.length > 0 ? [{
      key: 'recon', weight: 6,
      icon: <Scale size={16} />, tone: 'danger' as const,
      title: <>{num(q.reconExceptions.length)} statement line{q.reconExceptions.length === 1 ? '' : 's'} do not match the ledger</>,
      body: 'Unmatched credits and debits on the company accounts. Every one is either a record we are missing or a record that is wrong.',
      meta: 'The weakest control in the money flow',
      amount: q.reconExceptions.reduce((s, l) => s + l.amount, 0),
      to: '/finance/reconciliation', cta: 'Reconcile',
    }] : []),
    ...q.commissionsOverdue.map((r) => ({
      key: `ovd-${r.cat.id}`, weight: 7,
      icon: <FileWarning size={16} />, tone: 'warning' as const,
      title: <>{r.seller?.firm ?? 'A seller'} owes {inr(r.commissionDue)} on {r.cat.code}</>,
      body: 'Every sold lot is decided and nothing has been recorded against the commission. Chase it.',
      meta: `Auction closed ${relTime(r.closedAt, books.now)}`,
      amount: r.commissionDue, to: '/finance/commission', cta: 'Chase',
    })),
  ].sort((a, b) => a.weight - b.weight)

  return (
    <Page>
      <PageHeader
        title="Finance desk"
        sub="Money in, money we are holding, money that has to go out — and whether any of it left a profit."
        actions={
          q.total === 0
            ? <Chip tone="success"><CheckCircle2 size={12} /> Desk clear</Chip>
            : <Chip tone="warning">{num(q.total)} item{q.total === 1 ? '' : 's'} on the desk</Chip>
        }
      />

      {/* ------------------------- the position ------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <MoneyStat
          label="Net profit · this month" amount={books.netProfit} tone="profit" trend={netTrend}
          sub="income less costs" to="/finance/pnl"
        />
        <MoneyStat label="Money in · this month" amount={books.moneyIn} tone="in" sub="deposits + buyer payments" to="/finance/deposits" />
        <MoneyStat label="Money out · this month" amount={books.moneyOut} tone="out" sub="withdrawals + refunds" to="/finance/withdrawals" />
        <MoneyStat label="EMD held" amount={books.emdHeld} tone="held" sub="customers' money, not ours" to="/finance/emd" />
        <MoneyStat label="Owed by buyers" amount={books.outstandingBuyerPayments} tone="risk" sub="won but unpaid" to="/finance/payments" />
        <MoneyStat label="Commission owed" amount={books.commissionOwed} tone="risk" sub="earned, not yet in the bank" to="/finance/commission" />
      </div>

      {/* ----------------------- what needs you ------------------------- */}
      <SectionTitle
        title="What needs you"
        count={attention.length}
        sub="Ranked by what it costs to leave it. A customer waiting on their own money comes first."
      />
      {attention.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={32} strokeWidth={1.5} />}
          title="Nothing is waiting on Finance"
          body="No deposit to verify, no withdrawal to release, no commission to confirm and the statement reconciles. Anything new will appear here."
        />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {attention.map((a) => (
            <WorkRow key={a.key} icon={a.icon} tone={a.tone} title={a.title} body={a.body} meta={a.meta} amount={a.amount} to={a.to} cta={a.cta} />
          ))}
        </div>
      )}

      {/* --------------------- away for signature ----------------------- */}
      {q.awaitingSignature.length > 0 && (
        <>
          <SectionTitle
            title="Away for signature"
            count={q.awaitingSignature.length}
            sub="Above the configured threshold, so it left this desk. It has not vanished — it completes the moment it is signed."
          />
          <div className="card divide-y divide-line overflow-hidden">
            {q.awaitingSignature.map((a) => (
              <div key={a.id} className="flex items-start gap-3.5 px-4 py-3.5">
                <span className="size-9 rounded-xl grid place-items-center shrink-0 mt-0.5 bg-steel-soft text-steel"><Signature size={16} /></span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm leading-snug">{a.summary}</div>
                  <div className="text-[13px] text-ink-muted leading-snug mt-0.5">{a.reason}</div>
                  <div className="text-[11px] text-ink-faint mt-1">Sent {relTime(a.requestedAt, books.now)} · with the CEO</div>
                </div>
                <span className="num text-sm font-bold shrink-0 self-center tabular-nums">{inrCompact(a.amount)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* --------------------------- exposure ---------------------------- */}
      <SectionTitle
        title="What the platform is exposed to"
        sub="Money that is not yet settled, from every direction at once. Nobody else sees these side by side."
      />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-steel">
            <ShieldAlert size={13} /> Held for customers
          </div>
          <div className="num text-xl font-bold text-steel mt-1.5">{inr(books.emdHeld)}</div>
          <p className="text-[12px] text-ink-muted mt-1.5">EMD locked across every wallet. This is not the company's money and never appears in profit.</p>
          <Link to="/finance/emd" className="text-[12px] font-bold text-ember hover:underline mt-2 inline-flex items-center gap-1">EMD ledger <ArrowRight size={11} /></Link>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-warning">
            <AlertTriangle size={13} /> Owed to us
          </div>
          <div className="num text-xl font-bold text-warning mt-1.5">{inr(books.outstandingBuyerPayments + books.commissionOwed)}</div>
          <p className="text-[12px] text-ink-muted mt-1.5">
            {inrCompact(books.outstandingBuyerPayments)} from buyers who have won but not paid, {inrCompact(books.commissionOwed)} of commission not yet in the bank.
          </p>
          <Link to="/finance/payments" className="text-[12px] font-bold text-ember hover:underline mt-2 inline-flex items-center gap-1">Buyer payments <ArrowRight size={11} /></Link>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            <Banknote size={13} /> In transit
          </div>
          <div className="num text-xl font-bold mt-1.5">{inr(books.inTransit + books.refundsDue)}</div>
          <p className="text-[12px] text-ink-muted mt-1.5">
            {inrCompact(books.inTransit)} of withdrawals debited but not yet paid out, {inrCompact(books.refundsDue)} of refunds due.
          </p>
          <Link to="/finance/refunds" className="text-[12px] font-bold text-ember hover:underline mt-2 inline-flex items-center gap-1">Refunds <ArrowRight size={11} /></Link>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            <Receipt size={13} /> Tax collected · this month
          </div>
          <div className="num text-xl font-bold mt-1.5">{inr(books.gstCollected + books.tcsCollected)}</div>
          <p className="text-[12px] text-ink-muted mt-1.5">
            GST {inrCompact(books.gstCollected)} · TCS {inrCompact(books.tcsCollected)}. Computed on every delivery order, never typed.
          </p>
          <Link to="/finance/invoices" className="text-[12px] font-bold text-ember hover:underline mt-2 inline-flex items-center gap-1">Invoices &amp; receipts <ArrowRight size={11} /></Link>
        </div>
      </div>

      {/* ---------------------- oldest on the desk ---------------------- */}
      {q.commissionsOverdue.length > 0 && (
        <>
          <SectionTitle title="Commission ageing" count={q.commissionsOverdue.length} sub="Auctions that are decided and unpaid, oldest first." />
          <div className="card divide-y divide-line overflow-hidden">
            {q.commissionsOverdue.slice(0, 6).map((r) => (
              <Link key={r.cat.id} to="/finance/commission" className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors">
                <Ageing since={r.closedAt} now={books.now} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{r.seller?.firm ?? 'Unknown seller'}</div>
                  <div className="text-[12px] text-ink-muted truncate"><span className="num">{r.cat.code}</span> · {r.billable.length} lot{r.billable.length === 1 ? '' : 's'} accepted</div>
                </div>
                <span className="num text-sm font-bold tabular-nums shrink-0">{inr(r.commissionDue)}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="mt-8">
        <ScopeNote>
          Finance owns the money and nothing else. This desk never approves a lot, publishes an auction, decides
          who is eligible to bid or voids a bid — an EMD exemption is an eligibility call made by the Auction Manager,
          and Finance only ever sees the money side of it. Anything above the configured threshold leaves here for
          the CEO's signature before it takes effect.
        </ScopeNote>
      </div>
    </Page>
  )
}
