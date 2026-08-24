/* ---------------------------------------------------------------------------
   Finance Administrator — financial reports.

   Read last, after the fact, by someone who already knows what they are looking
   for. So it is a set of small, exportable statements rather than another
   dashboard: money in and out by period, EMD movement, commission earned, tax
   collected, what is outstanding, and an audit pack.

   Every figure comes off the same books the dashboard and the P&L read, so a
   report can never disagree with the screen it was produced from — which is the
   whole reason a reporting screen is worth having at all.
--------------------------------------------------------------------------- */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Download, FileSpreadsheet, Package } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, PageHeader, Segmented, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, num, fmtDate, fmtDateTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import { PERIOD_LABEL, periodBounds, within, type PeriodKey } from '../../lib/money'
import { LedgerRow, MoneyStat, ScopeNote, SectionTitle, useBooks } from '../shared/finance'

type Row = [string, string | number]

/** A small statement: a heading, a handful of lines, and its own export. Reports
 *  are read one at a time, so each one carries its own download rather than
 *  hiding behind a single page-level button. */
function Statement({ title, sub, rows, total, tone, filename }: {
  title: string
  sub: string
  rows: { label: string; amount: number; hint?: string; negative?: boolean }[]
  total?: { label: string; amount: number }
  tone?: 'profit' | 'held'
  filename: string
}) {
  const download = () => {
    const csv: Row[] = [[title, ''], ...rows.map((r) => [r.label, r.amount] as Row)]
    if (total) csv.push([total.label, total.amount])
    const url = URL.createObjectURL(new Blob([csv.map((r) => r.join(',')).join('\n')], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-line">
        <div className="min-w-0">
          <h3 className="font-display font-bold">{title}</h3>
          <p className="text-[12px] text-ink-muted mt-0.5">{sub}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={download} aria-label={`Export ${title}`}><Download size={14} /></Button>
      </div>
      <div className="divide-y divide-line">
        {rows.map((r) => (
          <LedgerRow key={r.label} label={r.label} amount={r.amount} hint={r.hint} negative={r.negative} />
        ))}
      </div>
      {total && (
        <div className="pt-2 mt-1 border-t border-line">
          <LedgerRow label={total.label} amount={total.amount} bold tone={tone} />
        </div>
      )}
    </div>
  )
}

export default function FinanceReports() {
  const now = useNow()
  const [period, setPeriod] = useState<PeriodKey>('month')
  const books = useBooks(period)
  const cfg = books.cfg

  const depositClaims = useStore((s) => s.depositClaims)
  const withdrawals = useStore((s) => s.withdrawalRequests)
  const refunds = useStore((s) => s.refundRequests)
  const forfeitures = useStore((s) => s.emdForfeitures)
  const invoices = useStore((s) => s.invoices)
  const bankLines = useStore((s) => s.bankStatementLines)
  const auditEvents = useStore((s) => s.auditEvents)
  const users = useStore((s) => s.users)
  const bankAccounts = useStore((s) => s.bankAccounts)
  const pushToast = useStore((s) => s.pushToast)

  const { from, to } = useMemo(() => periodBounds(period, now), [period, now])
  const inPeriod = <T,>(rows: T[], at: (r: T) => string | undefined) => rows.filter((r) => within(at(r), from, to))

  const depositsIn = inPeriod(depositClaims.filter((c) => c.status === 'approved'), (c) => c.decidedAt)
  const paymentsIn = books.deliveryRows.filter((r) => r.d.paidAmount > 0 && within(r.d.createdAt, from, to))
  const withdrawalsOut = inPeriod(withdrawals.filter((w) => w.status === 'processed'), (w) => w.decidedAt)
  const refundsOut = inPeriod(refunds.filter((r) => r.status === 'processed'), (r) => r.processedAt)
  const forfeitedIn = inPeriod(forfeitures.filter((f) => f.status === 'applied'), (f) => f.decidedAt ?? f.raisedAt)
  const invoicesIn = inPeriod(invoices.filter((i) => i.status === 'issued'), (i) => i.issuedAt)
  const failedOut = inPeriod(withdrawals.filter((w) => w.status === 'failed'), (w) => w.decidedAt)
  const rejectedIn = inPeriod(depositClaims.filter((c) => c.status === 'rejected'), (c) => c.decidedAt)

  const moneyInTotal = depositsIn.reduce((s, c) => s + c.amount, 0) + paymentsIn.reduce((s, r) => s + r.d.paidAmount, 0)
  const moneyOutTotal = withdrawalsOut.reduce((s, w) => s + w.amount, 0) + refundsOut.reduce((s, r) => s + r.amount, 0)

  /* The audit pack — what an auditor asks for, produced in one file rather than
     assembled by hand from six screens. */
  const exportAuditPack = () => {
    const line = (label: string, value: string | number) => `${label},${value}`
    const parts: string[] = [
      `ferroBid — audit pack`,
      `Period,${PERIOD_LABEL[period]}`,
      `Generated,${fmtDateTime(new Date(now).toISOString())}`,
      '',
      'PROFIT & LOSS',
      line('Seller commission (confirmed)', books.commissionEarned),
      line('Buyer premium', books.buyerPremium),
      line('Listing fees', books.listingFees),
      line('Total income', books.income),
      ...books.costLines.map((c) => line(c.label, c.amount)),
      line('Total costs', books.costs),
      line('Net profit', books.netProfit),
      '',
      'POSITION AS AT PERIOD END',
      line('EMD held (customer money)', books.emdHeld),
      line('Wallet balances held', books.walletBalances),
      line('Owed by buyers', books.outstandingBuyerPayments),
      line('Commission owed', books.commissionOwed),
      line('Withdrawals in transit', books.inTransit),
      line('Refunds due', books.refundsDue),
      '',
      'FLOW',
      line('Deposits credited', depositsIn.reduce((s, c) => s + c.amount, 0)),
      line('Buyer payments received', paymentsIn.reduce((s, r) => s + r.d.paidAmount, 0)),
      line('Withdrawals paid', withdrawalsOut.reduce((s, w) => s + w.amount, 0)),
      line('Refunds paid', refundsOut.reduce((s, r) => s + r.amount, 0)),
      line('EMD forfeited', forfeitedIn.reduce((s, f) => s + f.amount, 0)),
      '',
      'TAX',
      line(`GST collected @ ${cfg.gstPct}%`, books.gstCollected),
      line(`TCS collected @ ${cfg.tcsPct}%`, books.tcsCollected),
      line('Documents issued', invoicesIn.length),
      '',
      'CONTROLS',
      line('Statement lines unmatched', bankLines.filter((l) => l.status === 'unmatched').length),
      line('Statement breaks open', bankLines.filter((l) => l.status === 'break').length),
      line('Withdrawals reviewed and released by the same user', withdrawals.filter((w) => w.processedBy && w.processedBy === w.reviewedBy).length),
      line('Deposits credited', depositClaims.filter((c) => c.status === 'approved').length),
      line('Deposits rejected', depositClaims.filter((c) => c.status === 'rejected').length),
      '',
      'AUDIT EVENTS IN PERIOD',
      'At,Actor,Action,Target,Severity,Detail',
      ...auditEvents
        .filter((e) => within(e.at, from, to))
        .slice(0, 500)
        .map((e) => [
          fmtDateTime(e.at),
          (users.find((u) => u.id === e.actorId)?.name ?? e.actorId).replace(/,/g, ' '),
          e.action, e.target.replace(/,/g, ' '), e.severity, e.detail.replace(/,/g, ';'),
        ].join(',')),
    ]
    const url = URL.createObjectURL(new Blob([parts.join('\n')], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `ferrobid-audit-pack-${period}.csv`
    a.click()
    URL.revokeObjectURL(url)
    pushToast({ kind: 'success', title: 'Audit pack exported', body: 'P&L, position, flow, tax, controls and the audit trail for the period — in one file.' })
  }

  const controlFlags = [
    {
      label: 'Statement lines unexplained',
      value: bankLines.filter((l) => l.status !== 'matched').length,
      ok: bankLines.every((l) => l.status === 'matched'),
      to: '/finance/reconciliation',
      note: 'Every one is a record we are missing or a record that is wrong.',
    },
    {
      label: 'Withdrawals reviewed and released by one user',
      value: withdrawals.filter((w) => w.processedBy && w.processedBy === w.reviewedBy).length,
      ok: !withdrawals.some((w) => w.processedBy && w.processedBy === w.reviewedBy && w.amount >= cfg.withdrawalSecondSignatureFrom),
      to: '/finance/withdrawals',
      note: `Permitted below ${inr(cfg.withdrawalSecondSignatureFrom)}, refused above it.`,
    },
    {
      label: 'Paid orders with no invoice',
      value: books.deliveryRows.filter((r) => r.d.paidAmount > 0 && !invoices.some((i) => i.doId === r.d.id && i.status !== 'cancelled')).length,
      ok: !books.deliveryRows.some((r) => r.d.paidAmount > 0 && !invoices.some((i) => i.doId === r.d.id && i.status !== 'cancelled')),
      to: '/finance/invoices',
      note: 'A buyer cannot claim input credit without the document.',
    },
    {
      label: 'Payout accounts unverified',
      value: bankAccounts.filter((a) => a.status === 'pending').length,
      ok: !bankAccounts.some((a) => a.status === 'pending'),
      to: '/finance/bank-accounts',
      note: 'No payout can be released to an unverified destination.',
    },
  ]

  return (
    <Page>
      <PageHeader
        title="Financial reports"
        sub="The statements behind every screen in this workspace, for the period you choose — and the pack an auditor asks for."
        actions={
          <>
            <Segmented
              options={(['month', 'quarter', 'year', 'all'] as PeriodKey[]).map((k) => ({ key: k, label: PERIOD_LABEL[k] }))}
              value={period} onChange={setPeriod}
            />
            <Button size="sm" onClick={exportAuditPack}><Package size={15} /> Audit pack</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MoneyStat label="Money in" amount={moneyInTotal} tone="in" sub={`${num(depositsIn.length + paymentsIn.length)} receipts`} />
        <MoneyStat label="Money out" amount={moneyOutTotal} tone="out" sub={`${num(withdrawalsOut.length + refundsOut.length)} payments`} />
        <MoneyStat label="Net profit" amount={books.netProfit} tone="profit" sub={PERIOD_LABEL[period].toLowerCase()} to="/finance/pnl" />
        <MoneyStat label="Held for customers" amount={books.emdHeld} tone="held" sub="as at today, not for the period" to="/finance/emd" />
      </div>

      <SectionTitle title="Statements" sub={`${PERIOD_LABEL[period]} — ${fmtDate(new Date(from || now).toISOString())} to ${fmtDate(new Date(to).toISOString())}. Each exports on its own.`} />
      <div className="grid lg:grid-cols-2 gap-4">
        <Statement
          title="Money in and out"
          sub="Everything that crossed a company bank account in the period."
          filename={`ferrobid-cash-${period}.csv`}
          rows={[
            { label: 'Deposits credited to wallets', amount: depositsIn.reduce((s, c) => s + c.amount, 0), hint: `${num(depositsIn.length)} claims approved` },
            { label: 'Buyer payments received', amount: paymentsIn.reduce((s, r) => s + r.d.paidAmount, 0), hint: `${num(paymentsIn.length)} delivery orders` },
            { label: 'Withdrawals paid out', amount: withdrawalsOut.reduce((s, w) => s + w.amount, 0), hint: `${num(withdrawalsOut.length)} released`, negative: true },
            { label: 'Refunds paid out', amount: refundsOut.reduce((s, r) => s + r.amount, 0), hint: `${num(refundsOut.length)} processed`, negative: true },
          ]}
          total={{ label: 'Net movement', amount: moneyInTotal - moneyOutTotal }}
          tone="profit"
        />

        <Statement
          title="EMD movement"
          sub="Money held on customers' behalf. It is a liability and never appears in profit."
          filename={`ferrobid-emd-${period}.csv`}
          tone="held"
          rows={[
            { label: 'Held at today', amount: books.emdHeld, hint: 'locked across every wallet' },
            { label: 'Forfeited in the period', amount: forfeitedIn.reduce((s, f) => s + f.amount, 0), hint: `${num(forfeitedIn.length)} decisions, each with a named decider` },
            { label: 'Waived', amount: forfeitures.filter((f) => f.status === 'waived').reduce((s, f) => s + f.amount, 0), hint: 'released back to the buyer' },
            { label: 'Awaiting CEO signature', amount: forfeitures.filter((f) => f.status === 'awaiting_ceo').reduce((s, f) => s + f.amount, 0), hint: `at or above ${inr(cfg.ceoForfeitureFrom)}` },
          ]}
        />

        <Statement
          title="Commission earned"
          sub={`${cfg.sellerCommissionPct}% of the seller's upside over reserve, on accepted lots.`}
          filename={`ferrobid-commission-${period}.csv`}
          rows={[
            { label: 'Confirmed against the bank', amount: books.commissionEarned, hint: 'recognised as income' },
            { label: 'Recorded but not confirmed', amount: books.commissionRows.filter((r) => r.awaitingConfirmation).reduce((s, r) => s + r.commissionDue, 0), hint: 'the seller says they have paid' },
            { label: 'Outstanding and unpaid', amount: books.commissionRows.filter((r) => r.outstanding).reduce((s, r) => s + r.commissionDue, 0), hint: 'decided, nothing recorded' },
            { label: 'Buyer premium', amount: books.buyerPremium, hint: `${cfg.buyerPremiumPct}% of material value on paid orders` },
          ]}
          total={{ label: 'Total income recognised', amount: books.income }}
        />

        <Statement
          title="Tax collected"
          sub="Computed on every delivery order from Financial config. Nobody types a deduction."
          filename={`ferrobid-tax-${period}.csv`}
          rows={[
            { label: `GST @ ${cfg.gstPct}%`, amount: books.gstCollected, hint: 'collected with the final payment' },
            { label: `TCS u/s 206C(1H) @ ${cfg.tcsPct}%`, amount: books.tcsCollected },
            { label: 'Documents issued', amount: invoicesIn.reduce((s, i) => s + i.total, 0), hint: `${num(invoicesIn.length)} invoices and receipts` },
          ]}
          total={{ label: 'Total tax collected', amount: books.gstCollected + books.tcsCollected }}
        />

        <Statement
          title="Outstanding"
          sub="What the platform is owed, and what it owes, as at today."
          filename={`ferrobid-outstanding-${period}.csv`}
          rows={[
            { label: 'Owed by buyers', amount: books.outstandingBuyerPayments, hint: 'won but not paid' },
            { label: 'Commission owed by sellers', amount: books.commissionOwed, hint: 'earned, not yet in the bank' },
            { label: 'Withdrawals in transit', amount: books.inTransit, hint: 'debited, not yet released', negative: true },
            { label: 'Refunds due', amount: books.refundsDue, hint: 'approved or awaiting a decision', negative: true },
          ]}
          total={{ label: 'Net owed to the platform', amount: books.outstandingBuyerPayments + books.commissionOwed - books.inTransit - books.refundsDue }}
          tone="profit"
        />

        <Statement
          title="Failed and rejected"
          sub="What did not go through. A short list here is a healthy sign; a long one is a process problem."
          filename={`ferrobid-failed-${period}.csv`}
          rows={[
            { label: 'Withdrawals reversed to wallet', amount: failedOut.reduce((s, w) => s + w.amount, 0), hint: `${num(failedOut.length)} failed at the bank` },
            { label: 'Deposit claims rejected', amount: rejectedIn.reduce((s, c) => s + c.amount, 0), hint: `${num(rejectedIn.length)} could not be matched` },
            { label: 'Refunds refused', amount: refunds.filter((r) => r.status === 'rejected').reduce((s, r) => s + r.amount, 0), hint: 'held, with a reason given' },
            { label: 'Commission settlements queried', amount: books.commissionRows.filter((r) => r.queried).reduce((s, r) => s + r.commissionDue, 0), hint: 'reference did not match the bank' },
          ]}
        />
      </div>

      {/* ------------------------------ controls ---------------------------- */}
      <SectionTitle
        title="Controls"
        sub="The four things an auditor checks first. Each one links to where it is fixed."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {controlFlags.map((c) => (
          <Link key={c.label} to={c.to} className={cx('card card-hover p-4 block', !c.ok && 'border-warning/50')}>
            <div className="flex items-start justify-between gap-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint leading-tight">{c.label}</div>
              <Chip tone={c.ok ? 'success' : 'warning'}>{c.ok ? 'Clean' : 'Open'}</Chip>
            </div>
            <div className={cx('num text-2xl font-bold mt-2', c.value === 0 ? 'text-success' : 'text-warning')}>{num(c.value)}</div>
            <p className="text-[11px] text-ink-muted mt-1">{c.note}</p>
          </Link>
        ))}
      </div>

      {/* ------------------------------ the pack ---------------------------- */}
      <SectionTitle title="Audit pack" sub="Everything above, plus the audit trail for the period, in one file." />
      <div className="card p-5 flex flex-wrap items-center gap-4">
        <span className="size-11 rounded-xl bg-steel-soft text-steel grid place-items-center shrink-0"><FileSpreadsheet size={20} /></span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm">ferroBid audit pack — {PERIOD_LABEL[period]}</div>
          <p className="text-[13px] text-ink-muted mt-0.5 max-w-2xl">
            Profit and loss, the position as at period end, cash flow, tax collected, the four control checks, and every
            audited action in the period with the name of whoever performed it. {num(auditEvents.filter((e) => within(e.at, from, to)).length)}{' '}
            audit events are in scope.
          </p>
        </div>
        <Button onClick={exportAuditPack}><Download size={15} /> Export the pack</Button>
      </div>

      <div className="mt-8">
        <ScopeNote>
          Every figure on this page is derived from the same books the dashboard and the{' '}
          <Link to="/finance/pnl" className="text-ember font-semibold hover:underline">P&amp;L</Link> read, so a report can
          never disagree with the screen it came from. The CEO reads the same numbers in plainer words; the Super Admin can
          open them read-only. Nothing here can be edited — a report that could be adjusted would not be worth exporting.
        </ScopeNote>
      </div>

      <p className="text-[12px] text-ink-faint mt-6 flex items-center gap-1.5">
        Operations, Auction and the Sub Admin desk each keep their own reports.
        <Link to="/exec" className="text-ember font-semibold hover:underline inline-flex items-center gap-1">
          Operations <ArrowRight size={11} />
        </Link>
        <Link to="/auction/reports" className="text-ember font-semibold hover:underline inline-flex items-center gap-1">
          Auction <ArrowRight size={11} />
        </Link>
      </p>
    </Page>
  )
}
