/* ---------------------------------------------------------------------------
   Auction Manager — auction history.

   Every sale that has finished, and what happened inside it: what it realised,
   how many times it extended, and every intervention anyone made while it ran.
   The interventions are read straight out of the audit trail rather than kept
   as a second list, so history and audit can never disagree.
--------------------------------------------------------------------------- */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Ban, ChevronDown, Clock, Download, History as HistoryIcon, Megaphone, Pause, Search, ShieldAlert, Zap,
} from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Button, Chip, EmptyState, Field, Input, PageHeader, Segmented, Stat, cx,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDate, fmtDateTime, inr, inrCompact, num } from '../../lib/format'
import { SectionTitle, useAuctionRows, type AuctionRow } from './shared'

/** Audit actions that count as somebody stepping into a running sale. */
const INTERVENTION_ICON: Record<string, React.ReactNode> = {
  'auction.pause': <Pause size={12} />,
  'auction.resume': <Pause size={12} />,
  'auction.extend': <Clock size={12} />,
  'auction.cancel': <Ban size={12} />,
  'auction.cancel_request': <Ban size={12} />,
  'auction.cancel_approve': <Ban size={12} />,
  'auction.cancel_refuse': <Ban size={12} />,
  'auction.reschedule': <Clock size={12} />,
  'announcement.send': <Megaphone size={12} />,
  'auction.sta_refer': <ShieldAlert size={12} />,
}

/** Downloads text as a file without leaving the page — no server round trip. */
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

export default function AuctionHistory() {
  const rows = useAuctionRows()
  const auditEvents = useStore((s) => s.auditEvents)
  const cancellationRequests = useStore((s) => s.cancellationRequests)
  const users = useStore((s) => s.users)
  const pushToast = useStore((s) => s.pushToast)

  const [q, setQ] = useState('')
  const [scope, setScope] = useState<'all' | 'completed' | 'cancelled'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const cancelledIds = new Set(cancellationRequests.filter((r) => r.status === 'approved').map((r) => r.catalogueId))

  const closed = useMemo(
    () => rows
      .filter((r) => r.cat.status === 'closed' && r.lots.length > 0)
      .sort((a, b) => Date.parse(b.cat.endsAt) - Date.parse(a.cat.endsAt)),
    [rows],
  )

  const filtered = closed.filter((r) => {
    const isCancelled = cancelledIds.has(r.cat.id)
    if (scope === 'completed' && isCancelled) return false
    if (scope === 'cancelled' && !isCancelled) return false
    if (!q.trim()) return true
    const needle = q.trim().toLowerCase()
    return [r.cat.code, r.cat.title, r.seller?.firm, r.cat.yardName, r.cat.region]
      .some((v) => v?.toLowerCase().includes(needle))
  })

  const interventionsFor = (r: AuctionRow) =>
    auditEvents.filter((e) => e.target === r.cat.code && e.action in INTERVENTION_ICON)

  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? 'system'

  const exportCsv = () => {
    downloadCsv(`ferrobid-auction-history-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Code', 'Title', 'Seller', 'Yard', 'Region', 'Closed', 'Lots', 'Sold', 'Below reserve', 'Unsold', 'Sell-through %', 'Reserve value', 'Realised', 'Extensions', 'Bidders', 'Valid bids', 'Interventions', 'Outcome'],
      ...filtered.map((r) => [
        r.cat.code, r.cat.title, r.seller?.firm ?? '', r.cat.yardName, r.cat.region,
        fmtDate(r.cat.endsAt), r.lots.length, r.soldLots.length, r.staLots.length,
        r.lots.filter((l) => l.status === 'unsold').length,
        r.lots.length ? ((r.soldLots.length / r.lots.length) * 100).toFixed(1) : '0',
        Math.round(r.reserveValue), Math.round(r.realisation), r.extensions, r.participants, r.bids.length,
        interventionsFor(r).length, cancelledIds.has(r.cat.id) ? 'Cancelled' : 'Completed',
      ]),
    ])
    pushToast({ kind: 'success', title: 'History exported', body: `${num(filtered.length)} auction${filtered.length === 1 ? '' : 's'} written to CSV.` })
  }

  const totals = {
    realised: filtered.reduce((s, r) => s + r.realisation, 0),
    lots: filtered.reduce((s, r) => s + r.lots.length, 0),
    sold: filtered.reduce((s, r) => s + r.soldLots.length, 0),
    interventions: filtered.reduce((s, r) => s + interventionsFor(r).length, 0),
  }

  return (
    <Page>
      <PageHeader
        title="Auction history"
        sub="Every finished sale, what it realised, and everything anyone did to it while it ran."
        actions={
          <div className="flex items-center gap-2">
            <Segmented value={scope} onChange={setScope} options={[
              { key: 'all', label: 'All' },
              { key: 'completed', label: 'Completed' },
              { key: 'cancelled', label: 'Cancelled' },
            ]} />
            <Button variant="secondary" size="sm" disabled={filtered.length === 0} onClick={exportCsv}>
              <Download size={14} /> Export CSV
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Auctions in view" value={num(filtered.length)} sub={scope === 'all' ? 'All finished sales' : scope === 'cancelled' ? 'Cancelled by the Super Admin' : 'Ran to their close'} />
        <Stat label="Lots offered" value={num(totals.lots)} sub={`${num(totals.sold)} sold`} />
        <Stat label="Realised" value={inrCompact(totals.realised)} tone="success" sub="What the material cleared for" />
        <Stat label="Interventions" value={num(totals.interventions)} tone={totals.interventions ? 'warning' : undefined} sub="Pauses, extensions, cancellations, notices" />
      </div>

      <div className="card p-3 mb-4">
        <Field label="">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-9"
              placeholder="Search by auction code, title, seller, yard or region…" />
          </div>
        </Field>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<HistoryIcon size={32} strokeWidth={1.5} />}
          title={closed.length === 0 ? 'No sale has finished yet' : 'Nothing matches this view'}
          body={closed.length === 0
            ? 'Auctions move here once every lot in them has closed.'
            : 'Clear the search or widen the filter.'}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((r, i) => {
            const cancelled = cancelledIds.has(r.cat.id)
            const interventions = interventionsFor(r)
            const sellThrough = r.lots.length ? (r.soldLots.length / r.lots.length) * 100 : 0
            const vsReserve = r.reserveValue > 0 ? ((r.realisation - r.reserveValue) / r.reserveValue) * 100 : 0
            return (
              <div key={r.cat.id} className="card overflow-hidden animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <div className="p-4 flex flex-wrap items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {cancelled
                        ? <Chip tone="danger"><Ban size={11} /> Cancelled</Chip>
                        : <Chip tone={r.resultsConfirmed ? 'success' : 'neutral'}>{r.resultsConfirmed ? 'Confirmed' : 'Closed'}</Chip>}
                      <span className="num text-xs font-bold text-ember">{r.cat.code}</span>
                      {r.extensions > 0 && <Chip tone="warning" className="num"><Zap size={10} /> {r.extensions}</Chip>}
                      {interventions.length > 0 && <Chip tone="steel" className="num">{interventions.length} intervention{interventions.length === 1 ? '' : 's'}</Chip>}
                    </div>
                    <div className="font-display font-bold text-base mt-1 truncate">{r.cat.title}</div>
                    <div className="text-xs text-ink-muted mt-0.5 truncate">
                      {r.seller?.firm ?? 'Unknown seller'} · {r.cat.yardName}, {r.cat.region} · closed {fmtDate(r.cat.endsAt)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2">
                    {[
                      { label: 'Lots', value: `${num(r.soldLots.length)}/${num(r.lots.length)}`, tone: '' },
                      { label: 'Sell-through', value: `${sellThrough.toFixed(0)}%`, tone: sellThrough >= 70 ? 'text-success' : sellThrough >= 40 ? '' : 'text-warning' },
                      { label: 'Realised', value: inrCompact(r.realisation), tone: 'text-success' },
                      { label: 'vs reserve', value: `${vsReserve >= 0 ? '+' : ''}${vsReserve.toFixed(0)}%`, tone: vsReserve >= 0 ? 'text-success' : 'text-danger' },
                    ].map((m) => (
                      <div key={m.label}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">{m.label}</div>
                        <div className={cx('num text-base font-bold mt-0.5', m.tone)}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={() => setExpanded(expanded === r.cat.id ? null : r.cat.id)}
                  className="w-full px-4 py-2.5 border-t border-line text-[13px] font-semibold text-ink-muted hover:bg-surface-2 flex items-center justify-center gap-1.5">
                  What happened during this sale
                  <ChevronDown size={14} className={cx('transition-transform', expanded === r.cat.id && 'rotate-180')} />
                </button>

                {expanded === r.cat.id && (
                  <div className="border-t border-line bg-surface-2/30">
                    {interventions.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-ink-faint">
                        Nobody stepped in. The sale ran, extended on its own where a bid landed inside the anti-snipe window, and closed.
                      </div>
                    ) : (
                      <div className="divide-y divide-line">
                        {interventions.map((e) => (
                          <div key={e.id} className="px-4 py-2.5 flex items-start gap-3 text-[13px]">
                            <span className={cx('size-6 rounded-lg grid place-items-center shrink-0 mt-0.5',
                              e.severity === 'critical' ? 'bg-danger-soft text-danger'
                                : e.severity === 'warning' ? 'bg-warning-soft text-warning' : 'bg-surface-2 text-ink-muted')}>
                              {INTERVENTION_ICON[e.action]}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block">{e.detail}</span>
                              <span className="block text-[11px] text-ink-faint mt-0.5">
                                {nameOf(e.actorId)} · {fmtDateTime(e.at)}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="px-4 py-2.5 border-t border-line bg-surface-2/60 flex flex-wrap items-center gap-3 text-[12px]">
                      <span className="text-ink-muted num">
                        {num(r.participants)} bidder{r.participants === 1 ? '' : 's'} · {num(r.bids.length)} valid bids · reserve {inr(Math.round(r.reserveValue))}
                      </span>
                      <Link to="/auction/results" className="ml-auto font-bold text-ember hover:underline">Result sheet →</Link>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <SectionTitle title="What this list is for" sub="" />
      <div className="card p-4 text-[13px] text-ink-muted">
        The interventions above are read directly from the audit trail, so this page and the audit can never tell different
        stories. Exporting gives you the same rows as a spreadsheet — one line per auction, including cancelled ones.
      </div>
    </Page>
  )
}
