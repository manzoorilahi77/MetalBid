/* Results & reports — realisation across the seller's closed catalogues. */
import { Download } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Page } from '../../layout/Chrome'
import { Button, EmptyState, PageHeader, ProgressBar, Stat, StatusChip, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, inrCompact } from '../../lib/format'

export default function SellerReports() {
  const me = useStore((s) => s.currentUser)
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const pushToast = useStore((s) => s.pushToast)

  const closed = catalogues.filter((c) => c.sellerId === me?.id && c.status === 'closed')
  const allClosedLots = lots.filter((l) => closed.some((c) => c.id === l.catalogueId))
  const soldLots = allClosedLots.filter((l) => l.status === 'sold')
  const totalRealised = soldLots.reduce((s, l) => s + (l.resultH1Rate ?? 0) * l.indicativeQty, 0)
  const uplifts = soldLots.filter((l) => l.resultH1Rate).map((l) => ((l.resultH1Rate! - l.startRate) / l.startRate) * 100)
  const avgUplift = uplifts.length ? uplifts.reduce((a, b) => a + b, 0) / uplifts.length : 0
  const sellThrough = allClosedLots.length ? (soldLots.length / allClosedLots.length) * 100 : 0

  const chartData = closed.map((c) => ({
    name: c.code,
    value: lots.filter((l) => l.catalogueId === c.id && l.status === 'sold')
      .reduce((s, l) => s + (l.resultH1Rate ?? 0) * l.indicativeQty, 0) / 1e5,
  }))

  return (
    <Page>
      <PageHeader title="Results & reports" sub="Realisation across your closed catalogues. Values are H1 × indicative quantity — final invoices follow weighment."
        actions={<Button variant="secondary" onClick={() => pushToast({ kind: 'info', title: 'Exporting report', body: 'ferrobid_results.xlsx (demo)' })}><Download size={15} /> Export XLSX</Button>} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Total realised" value={inrCompact(totalRealised)} tone="ember" sub={`${soldLots.length} lots sold`} />
        <Stat label="Average uplift over start rate" value={`+${avgUplift.toFixed(1)}%`} tone="success" />
        <Stat label="Sell-through rate" value={`${sellThrough.toFixed(0)}%`} sub={`${soldLots.length} of ${allClosedLots.length} closed lots`} />
      </div>

      {closed.length === 0 ? (
        <div className="mt-6"><EmptyState title="No closed catalogues yet" body="Results appear here after your first auction closes." /></div>
      ) : (
        <>
          {chartData.some((d) => d.value > 0) && (
            <div className="card p-5 mt-6">
              <h2 className="font-bold mb-4">Realised value by catalogue <span className="text-xs text-ink-faint font-normal">(₹ lakh)</span></h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => [`₹${Number(v).toFixed(1)} L`, 'Realised']}
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 13 }} />
                    <Bar dataKey="value" fill="#E4572E" radius={[6, 6, 0, 0]} maxBarSize={56} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {closed.map((c) => {
            const cl = lots.filter((l) => l.catalogueId === c.id)
            const sold = cl.filter((l) => l.status === 'sold')
            const realised = sold.reduce((s, l) => s + (l.resultH1Rate ?? 0) * l.indicativeQty, 0)
            return (
              <div key={c.id} className="card mt-6 overflow-hidden">
                <div className="px-5 py-4 border-b border-line flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-60">
                    <span className="num text-xs font-bold text-ink-faint">{c.code}</span>
                    <div className="font-display font-bold">{c.title}</div>
                  </div>
                  <div className="w-48">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-ink-muted">Sell-through</span>
                      <span className="num font-bold">{sold.length}/{cl.length}</span>
                    </div>
                    <ProgressBar value={sold.length} max={cl.length} tone="success" />
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Realised</div>
                    <div className="num font-bold text-lg">{inrCompact(realised)}</div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-line">
                        <th className="px-5 py-2.5">Lot</th><th className="px-4 py-2.5">Grade</th>
                        <th className="px-4 py-2.5 text-right">Start rate</th><th className="px-4 py-2.5 text-right">H1 rate</th>
                        <th className="px-4 py-2.5 text-right">Uplift</th><th className="px-4 py-2.5">Result</th>
                        <th className="px-5 py-2.5 text-right">Realised value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {cl.map((l) => {
                        const uplift = l.resultH1Rate ? ((l.resultH1Rate - l.startRate) / l.startRate) * 100 : null
                        return (
                          <tr key={l.id} className="hover:bg-surface-2/60">
                            <td className="px-5 py-2.5 num font-bold">{l.lotNo}</td>
                            <td className="px-4 py-2.5">{l.grade}</td>
                            <td className="px-4 py-2.5 num text-right text-ink-muted">{inr(l.startRate)}</td>
                            <td className="px-4 py-2.5 num text-right font-semibold">{l.resultH1Rate ? inr(l.resultH1Rate) : '—'}</td>
                            <td className={cx('px-4 py-2.5 num text-right font-semibold', uplift != null && uplift > 0 ? 'text-success' : 'text-ink-faint')}>
                              {uplift != null ? `+${uplift.toFixed(1)}%` : '—'}
                            </td>
                            <td className="px-4 py-2.5"><StatusChip status={l.status} /></td>
                            <td className="px-5 py-2.5 num text-right font-semibold">
                              {l.status === 'sold' && l.resultH1Rate ? inrCompact(l.resultH1Rate * l.indicativeQty) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </>
      )}
    </Page>
  )
}
