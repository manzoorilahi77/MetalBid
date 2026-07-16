/* Live monitor — read-only view of the seller's live catalogues. */
import { useState } from 'react'
import { Eye, Gavel, TrendingUp } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Chip, Countdown, EmptyState, PageHeader, Segmented, StatusChip, cx } from '../../components/ui'
import { catalogueUiStatus, useStore } from '../../store/store'
import { inr, num } from '../../lib/format'
import { useNow } from '../../lib/useTick'

const mask = (bidderId: string | null) =>
  bidderId ? `Bidder #${(bidderId.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % 89) + 10}` : '—'

export default function LiveMonitor() {
  const now = useNow()
  const me = useStore((s) => s.currentUser)
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const bids = useStore((s) => s.bids)

  const liveCats = catalogues.filter((c) => c.sellerId === me?.id && c.status === 'live')
  const [sel, setSel] = useState<string>(liveCats[0]?.id ?? '')
  const cat = liveCats.find((c) => c.id === sel) ?? liveCats[0]

  if (!cat) {
    return (
      <Page>
        <PageHeader title="Live monitor" />
        <EmptyState icon={<Eye size={32} strokeWidth={1.5} />} title="No live catalogue right now"
          body="When your material goes under the hammer you can watch every lot's rate move here in real time." />
      </Page>
    )
  }

  const catLots = lots.filter((l) => l.catalogueId === cat.id)
  const catBids = bids.filter((b) => b.status === 'valid' && catLots.some((l) => l.id === b.lotId))
  const ui = catalogueUiStatus(cat, now, catLots)

  return (
    <Page>
      <PageHeader title="Live monitor" sub="Read-only — sellers cannot see bidder identities or intervene in a running auction." />
      {liveCats.length > 1 && (
        <Segmented className="mb-5" value={cat.id} onChange={setSel}
          options={liveCats.map((c) => ({ key: c.id, label: c.code }))} />
      )}
      <div className="card p-5 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-60">
          <div className="flex items-center gap-2">
            <StatusChip status={ui} />
            <span className="num text-xs font-bold text-ink-faint">{cat.code}</span>
          </div>
          <div className="font-display font-bold text-lg mt-1">{cat.title}</div>
        </div>
        <div className="num text-sm text-ink-muted flex items-center gap-5">
          <span><Gavel size={13} className="inline mr-1" />{catBids.length} bids</span>
          <span><TrendingUp size={13} className="inline mr-1" />{catLots.filter((l) => l.currentRate != null).length}/{catLots.length} lots active</span>
        </div>
        <Countdown endsAt={cat.endsAt} prefix="closes" size="lg" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
        {catLots.map((l) => {
          const uplift = l.currentRate ? ((l.currentRate - l.startRate) / l.startRate) * 100 : null
          return (
            <div key={l.id} className="card p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="num text-xs font-bold">{l.lotNo}</span>
                {l.status === 'live' ? <Countdown endsAt={l.endsAt} size="sm" /> : <StatusChip status={l.status} />}
              </div>
              <div className="font-semibold text-sm mt-1.5 truncate">{l.grade}</div>
              <div className="num text-[11px] text-ink-faint">{num(l.indicativeQty)} {l.uom} indicative</div>
              <div key={l.currentRate ?? 0} className="num text-2xl font-bold mt-2 animate-bid-in">
                {l.currentRate ? inr(l.currentRate) : <span className="text-ink-faint">{inr(l.startRate)}</span>}
                <span className="text-xs text-ink-faint font-medium">/{l.uom}</span>
              </div>
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="text-ink-muted num">{l.bidCount} bids · {mask(l.leadingBidderId)}</span>
                {uplift != null && uplift > 0 && <Chip tone="success" className="num h-5 text-[10px]">+{uplift.toFixed(1)}%</Chip>}
                {uplift == null && <Chip tone="neutral" className={cx('h-5 text-[10px]')}>no bids</Chip>}
              </div>
            </div>
          )
        })}
      </div>
    </Page>
  )
}
