/* ---------------------------------------------------------------------------
   Sub Admin — Reports.

   Read last, deliberately. Everything above this in the menu is work waiting to
   be done; this is the shape of the work already done, which is what you take
   into a review rather than into a shift.

   Operational, not financial. Money totals appear here only as counts and
   liabilities — how much EMD we are holding, how many settlements are still
   unconfirmed — never as profit. The books belong to Finance and the CEO reads
   them there, so that there is exactly one place each number is arrived at.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Download, Gauge, Layers, Users2 } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, PageHeader, ProgressBar, Segmented, Stat } from '../../components/ui'
import { useStore } from '../../store/store'
import { inrCompact, num } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import { periodBounds, within, type PeriodKey } from '../../lib/money'
import { useWorkBoard } from './shared'

export default function SubReports() {
  const now = useNow()
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const bids = useStore((s) => s.bids)
  const users = useStore((s) => s.users)
  const wallets = useStore((s) => s.wallets)
  const disputes = useStore((s) => s.disputes)
  const auditEvents = useStore((s) => s.auditEvents)
  const inspectionReports = useStore((s) => s.inspectionReports)
  const commissionSettlements = useStore((s) => s.commissionSettlements)
  const pushToast = useStore((s) => s.pushToast)

  const [period, setPeriod] = useState<PeriodKey>('month')
  const board = useWorkBoard()

  const { from, to } = periodBounds(period, now)
  const inPeriod = (iso?: string) => within(iso, from, to)

  /* ----------------------------- the pipeline ---------------------------- */
  const byStatus = (s: string) => lots.filter((l) => l.status === s).length
  const pipeline = [
    { label: 'Awaiting a yard visit', value: byStatus('pending_inspection'), tone: 'ember' as const },
    { label: 'Inspected, awaiting a decision', value: byStatus('inspected'), tone: 'steel' as const },
    { label: 'Sent back', value: byStatus('flagged'), tone: 'warning' as const },
    { label: 'Approved', value: byStatus('approved'), tone: 'success' as const },
    { label: 'Rejected', value: byStatus('rejected'), tone: 'warning' as const },
  ]
  const pipelineTotal = pipeline.reduce((t, r) => t + r.value, 0)

  const bypassed = auditEvents.filter((e) => e.action === 'inspection.bypass')
  const bypassedInPeriod = bypassed.filter((e) => inPeriod(e.at))
  const decisions = auditEvents.filter((e) =>
    ['lot.approved', 'lot.rejected', 'lot.send_back'].includes(e.action) && inPeriod(e.at))

  /* ------------------------------ the sale ------------------------------- */
  const closed = catalogues.filter((c) => c.status === 'closed')
  const sold = lots.filter((l) => l.status === 'sold')
  const sta = lots.filter((l) => l.status === 'sta')
  const unsold = lots.filter((l) => l.status === 'unsold')
  const decided = sold.length + sta.length + unsold.length
  const conversion = decided ? Math.round((sold.length / decided) * 100) : 0
  const bidsInPeriod = bids.filter((b) => b.status === 'valid' && inPeriod(b.at))
  const activeBidders = new Set(bidsInPeriod.map((b) => b.bidderId)).size

  /* ------------------------------ the desk ------------------------------- */
  const resolvedDisputes = disputes.filter((d) => d.status === 'resolved')
  const openDisputes = disputes.filter((d) => d.status !== 'resolved')
  const kycDecisions = auditEvents.filter((e) => ['kyc.approve', 'kyc.reject'].includes(e.action) && inPeriod(e.at))
  const emdHeld = wallets.reduce((t, w) => t + (w.emdLocked ?? 0), 0)
  const overdue = board.filter((i) => i.overdue)

  /* ---------------------------- the field team --------------------------- */
  const execs = users.filter((u) => u.role === 'field_exec')
  const execRows = execs.map((e) => ({
    user: e,
    reports: inspectionReports.filter((r) => r.inspectorId === e.id).length,
    open: catalogues.filter((c) => c.assignedFieldExecId === e.id && c.status !== 'closed').length,
  })).sort((a, b) => b.reports - a.reports)
  const mostReports = execRows[0]?.reports ?? 0

  const exportPack = (what: string) => {
    pushToast({
      kind: 'info',
      title: `${what} — prepared`,
      body: 'In the prototype this is where the CSV downloads. The figures are exactly the ones on this screen.',
    })
  }

  return (
    <Page>
      <PageHeader
        title="Reports"
        sub="What the operation has actually done. Operational figures only — the books are Finance's, so every money number here is one we are holding, never one we have earned."
        actions={
          <div className="flex items-center gap-2">
            <Segmented<PeriodKey>
              options={[
                { key: 'month', label: 'This month' },
                { key: 'quarter', label: 'This quarter' },
                { key: 'year', label: 'This year' },
                { key: 'all', label: 'All time' },
              ]}
              value={period}
              onChange={setPeriod}
            />
            <Button variant="secondary" onClick={() => exportPack('Operations pack')}>
              <Download size={15} /> Export
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <Stat label="Lots in the pipeline" value={num(pipelineTotal)} sub="Not yet in an auction" to="/exec" />
        <Stat label="Decisions made" value={num(decisions.length)} tone="steel" sub="Approve, send back, reject" />
        <Stat label="Bypassed" value={num(bypassedInPeriod.length)} tone={bypassedInPeriod.length ? 'warning' : undefined} sub="Skipped the yard visit" />
        <Stat label="Sold" value={`${conversion}%`} tone="success" sub={`${num(sold.length)} of ${num(decided)} decided lots`} />
        <Stat label="Active bidders" value={num(activeBidders)} sub={`${num(bidsInPeriod.length)} valid bids`} />
        <Stat label="EMD held" value={inrCompact(emdHeld)} tone="steel" sub="Customers' money" to="/sub/payments" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* --------------------------- the pipeline --------------------------- */}
        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display font-bold text-lg flex items-center gap-2">
              <Layers size={18} className="text-ember" /> Where the material is
            </h2>
            <Chip tone="neutral" className="num">{num(pipelineTotal)} lots</Chip>
          </div>
          <ul className="px-5 py-4 space-y-3.5">
            {pipeline.map((r) => (
              <li key={r.label}>
                <div className="flex items-baseline justify-between text-sm mb-1">
                  <span>{r.label}</span>
                  <span className="num font-semibold">{num(r.value)}</span>
                </div>
                <ProgressBar value={r.value} max={Math.max(pipelineTotal, 1)} tone={r.tone} />
              </li>
            ))}
          </ul>
          <div className="px-5 py-3 bg-surface-2 border-t border-line text-xs text-ink-muted">
            {bypassed.length > 0
              ? <>{num(bypassed.length)} lot{bypassed.length === 1 ? ' has' : 's have'} gone in without a yard visit, all time.
                A bypass is controlled by a typed reason and an audit entry, never by a second approver —{' '}
                <Link to="/sub/approvals" className="font-semibold text-ember hover:underline">review them</Link>.</>
              : <>No lot has gone into a catalogue without a yard visit.</>}
          </div>
        </section>

        {/* ----------------------------- the sale ----------------------------- */}
        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display font-bold text-lg flex items-center gap-2">
              <BarChart3 size={18} className="text-steel" /> How the sales went
            </h2>
            <Chip tone="neutral" className="num">{num(closed.length)} closed</Chip>
          </div>
          <div className="grid grid-cols-2 gap-px bg-line">
            {[
              ['Sold', sold.length, 'Cleared at or above reserve'],
              ['Subject to approval', sta.length, 'H1 below reserve — the seller decides'],
              ['Unsold', unsold.length, 'No bid worth taking'],
              ['Settlements unconfirmed', commissionSettlements.filter((s) => s.status !== 'confirmed').length, 'Finance has not matched them yet'],
            ].map(([label, value, sub]) => (
              <div key={label as string} className="bg-surface px-5 py-4">
                <div className="num font-display text-2xl font-bold">{num(value as number)}</div>
                <div className="text-sm font-semibold mt-0.5">{label}</div>
                <div className="text-xs text-ink-faint mt-0.5">{sub}</div>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 bg-surface-2 border-t border-line text-xs text-ink-muted">
            A sale is only finished when every sold lot has a seller decision and, where commission is owed, a
            settlement Finance has confirmed —{' '}
            <Link to="/sub/payments" className="font-semibold text-ember hover:underline">payment activity</Link>.
          </div>
        </section>

        {/* ----------------------------- the desk ----------------------------- */}
        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <h2 className="font-display font-bold text-lg flex items-center gap-2">
              <Gauge size={18} className="text-danger" /> How this desk is holding up
            </h2>
          </div>
          <ul className="divide-y divide-line">
            {[
              ['Open work items', num(board.filter((i) => i.mine).length), 'Waiting on a Sub Admin'],
              ['Past their SLA', num(overdue.length), overdue.length ? 'Clear these first' : 'Nothing overdue'],
              ['Sellers verified or rejected', num(kycDecisions.length), 'This period'],
              ['Disputes resolved', num(resolvedDisputes.length), `${num(openDisputes.length)} still open`],
            ].map(([label, value, sub]) => (
              <li key={label} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex-1">
                  <div className="text-sm font-semibold">{label}</div>
                  <div className="text-xs text-ink-faint mt-0.5">{sub}</div>
                </div>
                <span className="num font-display text-xl font-bold">{value}</span>
              </li>
            ))}
          </ul>
          <div className="px-5 py-3 bg-surface-2 border-t border-line text-xs">
            <Link to="/sub/queue" className="font-semibold text-ember hover:underline">Open the work queue →</Link>
          </div>
        </section>

        {/* --------------------------- the field team ------------------------- */}
        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display font-bold text-lg flex items-center gap-2">
              <Users2 size={18} className="text-steel" /> The field team
            </h2>
            <Link to="/sub/field-executives" className="text-xs font-semibold text-ember hover:underline">Assign work →</Link>
          </div>
          {execRows.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-muted">No field executives on the roster.</p>
          ) : (
            <ul className="px-5 py-4 space-y-3.5">
              {execRows.map((r) => (
                <li key={r.user.id}>
                  <div className="flex items-baseline justify-between text-sm mb-1">
                    <span className="font-semibold">{r.user.name}</span>
                    <span className="text-xs text-ink-muted">
                      <span className="num font-semibold text-ink">{num(r.reports)}</span> reports ·
                      {' '}<span className="num">{num(r.open)}</span> open
                    </span>
                  </div>
                  <ProgressBar value={r.reports} max={Math.max(mostReports, 1)} tone="steel" />
                </li>
              ))}
            </ul>
          )}
          <div className="px-5 py-3 bg-surface-2 border-t border-line text-xs text-ink-muted">
            Reports filed, all time. An executive visits a yard once and inspects everything in it, so the load that
            matters is catalogues rather than lots.
          </div>
        </section>
      </div>
    </Page>
  )
}
