/* ---------------------------------------------------------------------------
   Auction Manager — auction reports.

   How well the sales themselves are running: did the material clear, did it
   clear above the opening rate, did enough people compete for it, and how often
   did somebody have to step in. Money questions are not answered here — those
   belong to Finance.
--------------------------------------------------------------------------- */
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Ban, Download, Flag, Gauge, TrendingUp, Users, Zap } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, EmptyState, PageHeader, ProgressBar, Segmented, Stat, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDate, inrCompact, num } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import { SectionTitle, useAuctionRows } from './shared'

/** Reporting periods. `days: 0` means "everything, no cut-off". */
const WINDOWS = [
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 90 days', days: 90 },
  { key: 'all', label: 'All time', days: 0 },
] as const
type WindowKey = (typeof WINDOWS)[number]['key']

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** A labelled bar with its own scale — used where a chart would be overkill but
 *  a bare number hides the distribution. */
function MeterRow({ label, value, max, display, tone }: {
  label: string; value: number; max: number; display: string; tone?: 'ember' | 'steel' | 'success' | 'warning'
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-[13px] text-ink-muted truncate">{label}</span>
        <span className="num text-[13px] font-bold shrink-0">{display}</span>
      </div>
      <ProgressBar value={value} max={Math.max(max, 1)} tone={tone ?? 'ember'} />
    </div>
  )
}

export default function AuctionReports() {
  const now = useNow()
  const rows = useAuctionRows()
  const voidRequests = useStore((s) => s.bidVoidRequests)
  const cancellationRequests = useStore((s) => s.cancellationRequests)
  const pushToast = useStore((s) => s.pushToast)

  const [win, setWin] = useState<WindowKey>('90')

  const closed = useMemo(() => {
    const days = WINDOWS.find((w) => w.key === win)?.days ?? 90
    const cutoff = days === 0 ? 0 : now - days * 86_400_000
    return rows
      .filter((r) => r.cat.status === 'closed' && r.lots.length > 0 && Date.parse(r.cat.endsAt) >= cutoff)
      .sort((a, b) => Date.parse(a.cat.endsAt) - Date.parse(b.cat.endsAt))
  }, [rows, win, now])

  const allLots = closed.flatMap((r) => r.lots)
  const soldLots = allLots.filter((l) => l.status === 'sold')
  const sellThrough = allLots.length ? (soldLots.length / allLots.length) * 100 : 0

  const uplifts = soldLots
    .filter((l) => l.startRate > 0)
    .map((l) => (((l.resultH1Rate ?? l.currentRate ?? 0) - l.startRate) / l.startRate) * 100)
  const avgUplift = uplifts.length ? uplifts.reduce((a, b) => a + b, 0) / uplifts.length : 0

  /* Participation depth — how many distinct firms competed for a lot. One
     bidder is not an auction; the shape of this distribution is the single
     best indicator of whether the sales are actually competitive. */
  const bids = useStore((s) => s.bids)
  const depthBuckets = useMemo(() => {
    const byLot = new Map<string, Set<string>>()
    for (const b of bids) {
      if (b.status !== 'valid') continue
      const set = byLot.get(b.lotId) ?? new Set<string>()
      set.add(b.bidderId)
      byLot.set(b.lotId, set)
    }
    const buckets = [
      { label: 'No bidders', min: 0, max: 0, count: 0 },
      { label: '1 bidder', min: 1, max: 1, count: 0 },
      { label: '2–3 bidders', min: 2, max: 3, count: 0 },
      { label: '4–6 bidders', min: 4, max: 6, count: 0 },
      { label: '7 or more', min: 7, max: Infinity, count: 0 },
    ]
    for (const l of allLots) {
      const n = byLot.get(l.id)?.size ?? 0
      const bucket = buckets.find((b) => n >= b.min && n <= b.max)
      if (bucket) bucket.count += 1
    }
    return buckets
  }, [bids, allLots])

  const contested = depthBuckets.filter((b) => b.min >= 2).reduce((s, b) => s + b.count, 0)
  const contestedPct = allLots.length ? (contested / allLots.length) * 100 : 0

  const extensions = closed.reduce((s, r) => s + r.extensions, 0)
  const lotsExtended = allLots.filter((l) => l.extensions > 0).length
  const antiSnipeRate = allLots.length ? (lotsExtended / allLots.length) * 100 : 0

  const closedIds = new Set(closed.map((r) => r.cat.id))
  const cancelled = cancellationRequests.filter((r) => r.status === 'approved' && closedIds.has(r.catalogueId)).length
  const cancelRate = closed.length ? (cancelled / closed.length) * 100 : 0
  const voidsApproved = voidRequests.filter((r) => r.status === 'approved').length
  const totalValidBids = closed.reduce((s, r) => s + r.bids.length, 0)
  const voidRate = totalValidBids ? (voidsApproved / totalValidBids) * 100 : 0

  const chartData = closed.slice(-12).map((r) => ({
    name: r.cat.code,
    sellThrough: r.lots.length ? Number(((r.soldLots.length / r.lots.length) * 100).toFixed(1)) : 0,
    realised: r.realisation,
    lots: r.lots.length,
  }))

  const exportCsv = () => {
    downloadCsv(`ferrobid-auction-performance-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Code', 'Title', 'Closed', 'Lots', 'Sold', 'Sell-through %', 'Avg uplift %', 'Bidders', 'Valid bids', 'Extensions', 'Realised'],
      ...closed.map((r) => {
        const u = r.soldLots.filter((l) => l.startRate > 0)
          .map((l) => (((l.resultH1Rate ?? l.currentRate ?? 0) - l.startRate) / l.startRate) * 100)
        return [
          r.cat.code, r.cat.title, fmtDate(r.cat.endsAt), r.lots.length, r.soldLots.length,
          r.lots.length ? ((r.soldLots.length / r.lots.length) * 100).toFixed(1) : '0',
          u.length ? (u.reduce((a, b) => a + b, 0) / u.length).toFixed(1) : '0',
          r.participants, r.bids.length, r.extensions, Math.round(r.realisation),
        ]
      }),
    ])
    pushToast({ kind: 'success', title: 'Performance exported', body: `${num(closed.length)} auction${closed.length === 1 ? '' : 's'} written to CSV.` })
  }

  return (
    <Page>
      <PageHeader
        title="Auction reports"
        sub="Whether the sales are working: did the material clear, did competition push the price, and how often did somebody have to step in."
        actions={
          <div className="flex items-center gap-2">
            <Segmented value={win} onChange={setWin}
              options={WINDOWS.map((w) => ({ key: w.key, label: w.label }))} />
            <Button variant="secondary" size="sm" disabled={closed.length === 0} onClick={exportCsv}>
              <Download size={14} /> Export
            </Button>
          </div>
        }
      />

      {closed.length === 0 ? (
        <EmptyState
          icon={<Gauge size={32} strokeWidth={1.5} />}
          title="No finished sales in this window"
          body="Widen the period, or wait for a running auction to close. Reports only ever count sales that have finished."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Stat label="Sell-through" value={`${sellThrough.toFixed(0)}%`}
              tone={sellThrough >= 70 ? 'success' : sellThrough >= 40 ? 'warning' : 'danger'}
              sub={`${num(soldLots.length)} of ${num(allLots.length)} lots sold`} />
            <Stat label="Average uplift" value={`${avgUplift >= 0 ? '+' : ''}${avgUplift.toFixed(1)}%`}
              tone={avgUplift >= 0 ? 'success' : 'danger'} sub="Cleared rate over the opening rate" />
            <Stat label="Lots with real competition" value={`${contestedPct.toFixed(0)}%`}
              tone={contestedPct >= 50 ? 'success' : 'warning'} sub="Two or more firms bidding" />
            <Stat label="Realised" value={inrCompact(closed.reduce((s, r) => s + r.realisation, 0))}
              tone="success" sub={`Across ${num(closed.length)} finished sale${closed.length === 1 ? '' : 's'}`} />
          </div>

          {/* ------------------------- sell-through by sale ------------------------ */}
          <SectionTitle
            title="Sell-through, sale by sale"
            sub="The last twelve finished auctions. A short bar is material that did not find a buyer, not a reporting problem."
          />
          <div className="card p-4">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'var(--surface-2)' }}
                    formatter={(v, _n, item) => [`${v}% of ${item.payload.lots} lots`, 'Sell-through']}
                    labelFormatter={(l) => `Auction ${l}`}
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 13, color: 'var(--ink)' }} />
                  <Bar dataKey="sellThrough" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {chartData.map((d) => (
                      <Cell key={d.name}
                        fill={d.sellThrough >= 70 ? 'var(--success)' : d.sellThrough >= 40 ? 'var(--ember)' : 'var(--warning)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 pt-3 border-t border-line text-[12px] text-ink-muted">
              {[
                ['var(--success)', '70% and above — strong'],
                ['var(--ember)', '40–69% — acceptable'],
                ['var(--warning)', 'Under 40% — reserves or reach need a look'],
              ].map(([c, label]) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm" style={{ background: c }} /> {label}
                </span>
              ))}
            </div>
          </div>

          {/* -------------------------- participation depth ------------------------ */}
          <div className="grid lg:grid-cols-2 gap-5 mt-9">
            <div className="card p-4">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-display font-bold text-base flex items-center gap-2"><Users size={16} className="text-steel" /> Participation depth</h3>
                  <p className="text-[13px] text-ink-muted mt-0.5">How many firms actually competed for each lot.</p>
                </div>
                <Chip tone={contestedPct >= 50 ? 'success' : 'warning'}>{contestedPct.toFixed(0)}% contested</Chip>
              </div>
              <div className="space-y-3">
                {depthBuckets.map((b) => (
                  <MeterRow key={b.label} label={b.label} value={b.count} max={allLots.length}
                    display={`${num(b.count)} lot${b.count === 1 ? '' : 's'}`}
                    tone={b.min === 0 ? 'warning' : b.min === 1 ? 'steel' : 'success'} />
                ))}
              </div>
              <p className="text-[12px] text-ink-faint mt-4 pt-3 border-t border-line">
                A lot with one bidder cleared at the opening rate — it sold, but the auction did no work. Those two rows are
                where reach, timing or reserve is worth changing.
              </p>
            </div>

            {/* ------------------------- anti-snipe frequency ---------------------- */}
            <div className="card p-4">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-display font-bold text-base flex items-center gap-2"><Zap size={16} className="text-warning" /> Anti-snipe activity</h3>
                  <p className="text-[13px] text-ink-muted mt-0.5">Extensions the system made on its own, with nobody involved.</p>
                </div>
                <Chip tone="neutral" className="num">{num(extensions)} total</Chip>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Lots extended</div>
                  <div className="num text-2xl font-bold mt-0.5">{antiSnipeRate.toFixed(0)}%</div>
                  <div className="text-[12px] text-ink-muted">{num(lotsExtended)} of {num(allLots.length)} lots</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Extensions per extended lot</div>
                  <div className="num text-2xl font-bold mt-0.5">{lotsExtended ? (extensions / lotsExtended).toFixed(1) : '0'}</div>
                  <div className="text-[12px] text-ink-muted">How hard the ending was fought</div>
                </div>
              </div>
              <ProgressBar value={lotsExtended} max={Math.max(allLots.length, 1)} tone="warning" />
              <p className="text-[12px] text-ink-faint mt-4 pt-3 border-t border-line">
                Extensions are a sign of health, not trouble — they mean bidders were still competing at the close. A rate
                near zero more often means the lots closed uncontested.
              </p>
            </div>
          </div>

          {/* ---------------------------- interventions -------------------------- */}
          <SectionTitle
            title="How often we had to step in"
            sub="Both of these should stay near zero. A platform that regularly cancels sales or voids bids is one buyers stop trusting."
          />
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                icon: <Ban size={16} />, label: 'Cancellation rate', value: `${cancelRate.toFixed(1)}%`,
                detail: `${num(cancelled)} of ${num(closed.length)} finished sales cancelled`,
                tone: cancelRate > 5 ? 'danger' : 'success',
              },
              {
                icon: <Flag size={16} />, label: 'Void rate', value: `${voidRate.toFixed(2)}%`,
                detail: `${num(voidsApproved)} bids voided of ${num(totalValidBids)} placed`,
                tone: voidRate > 1 ? 'danger' : 'success',
              },
              {
                icon: <TrendingUp size={16} />, label: 'Flags raised', value: num(voidRequests.length),
                detail: `${num(voidRequests.filter((r) => r.status === 'rejected').length)} reviewed and let stand`,
                tone: 'steel',
              },
            ].map((m) => (
              <div key={m.label} className="card p-4">
                <div className={cx('size-9 rounded-xl grid place-items-center mb-3',
                  m.tone === 'danger' ? 'bg-danger-soft text-danger' : m.tone === 'success' ? 'bg-success-soft text-success' : 'bg-steel-soft text-steel')}>
                  {m.icon}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">{m.label}</div>
                <div className={cx('num text-2xl font-bold mt-0.5',
                  m.tone === 'danger' ? 'text-danger' : m.tone === 'success' ? 'text-success' : 'text-ink')}>
                  {m.value}
                </div>
                <div className="text-[12px] text-ink-muted mt-1">{m.detail}</div>
              </div>
            ))}
          </div>

          <p className="text-xs text-ink-faint mt-6">
            Every figure on this page is computed from finished auctions and valid bids. Commission, profit and anything else
            with a rupee sign against the business rather than the material belongs to Finance, not here.
          </p>
        </>
      )}
    </Page>
  )
}
