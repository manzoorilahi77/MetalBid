/* Operation Manager â€” lot pipeline as a horizontal Kanban board.

   Six columns from pending inspection through to resolved, plus an attention
   column for anything flagged or rejected. The board decides lots; it no longer
   publishes catalogues â€” that moved to Auction schedule, which is the only
   screen with the buyer preview and the CEO value threshold on it. */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronLeft, ChevronRight, ShieldOff } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { PageHeader, Button, Chip, StatusChip, Stat, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { num } from '../../lib/format'
import type { Lot } from '../../types'

type ColKey = 'pending' | 'inspected' | 'approved' | 'live' | 'resolved' | 'attention'

const COLS: { key: ColKey; title: string; match: (l: Lot) => boolean; amber?: boolean }[] = [
  { key: 'pending', title: 'Pending inspection', match: (l) => l.status === 'pending_inspection' },
  { key: 'inspected', title: 'Inspected', match: (l) => l.status === 'inspected' },
  { key: 'approved', title: 'Approved', match: (l) => l.status === 'approved' },
  { key: 'live', title: 'In auction', match: (l) => l.status === 'live' },
  { key: 'resolved', title: 'Resolved', match: (l) => ['sold', 'sta', 'unsold'].includes(l.status) },
  { key: 'attention', title: 'Attention', match: (l) => ['flagged', 'rejected'].includes(l.status), amber: true },
]

const CARD_CAP = 8

/* w-72 column + gap-4 â€” one press of an arrow lands the next column flush. */
const COL_STEP = 288 + 16

export default function Pipeline() {
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const users = useStore((s) => s.users)
  const reports = useStore((s) => s.inspectionReports)
  const setLotStatus = useStore((s) => s.setLotStatus)
  const decideLot = useStore((s) => s.decideLot)
  const pushToast = useStore((s) => s.pushToast)

  const draftCatalogues = catalogues.filter((c) => c.status === 'draft')

  const byCol = COLS.map((c) => ({ ...c, lots: lots.filter(c.match) }))

  const measured = (l: Lot) => reports.find((r) => r.id === l.inspectionReportId)?.measuredQty ?? null

  /* Six columns rarely fit, and a hidden scrollbar makes the board read as
     "this is all there is". Track which edges have more board behind them so
     the fades, the arrows and the hint can all say so. */
  const scroller = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState({ left: false, right: false })

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const sync = () => {
      const max = el.scrollWidth - el.clientWidth
      setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 })
    }
    sync()
    el.addEventListener('scroll', sync, { passive: true })
    // The scroller's own box never changes when columns fill up â€” watch the
    // track inside it, which is what actually grows.
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    if (track.current) ro.observe(track.current)
    return () => { el.removeEventListener('scroll', sync); ro.disconnect() }
  }, [])

  const nudge = (dir: -1 | 1) => scroller.current?.scrollBy({ left: dir * COL_STEP, behavior: 'smooth' })

  const scrollable = edge.left || edge.right

  const actions = (col: ColKey, l: Lot) => {
    switch (col) {
      case 'pending':
        // Bypass is the only decision available before a yard visit, and it
        // needs a typed reason â€” so the board hands off to the approval desk
        // rather than offering a one-click skip from a Kanban card.
        return l.knownSeller ? (
          <Link to="/exec/approvals" className="block">
            <Button size="sm" variant="ghost" className="w-full text-warning hover:text-warning">
              <ShieldOff size={13} /> Bypass inspection
            </Button>
          </Link>
        ) : null
      case 'inspected':
        return (
          <div className="flex gap-1.5">
            <Button size="sm" variant="success" className="flex-1"
              onClick={() => {
                const res = decideLot(l.id, 'approved')
                pushToast(res.ok
                  ? { kind: 'success', title: `${l.lotNo} approved`, body: 'Cleared for auction, pending the rest of its catalogue.' }
                  : { kind: 'danger', title: 'Not approved', body: res.error })
              }}>
              Approve
            </Button>
            <Link to="/exec/approvals" className="flex-1">
              <Button size="sm" variant="ghost" className="w-full">Review</Button>
            </Link>
          </div>
        )
      case 'approved':
        // Under the catalogue-before-inspection lifecycle, a lot only reaches
        // 'approved' after already being catalogued (or via waiver on an
        // already-catalogue-eligible lot) â€” there's nothing actionable here.
        return null
      case 'live':
        return l.catalogueId ? (
          <Link to={`/catalogue/${l.catalogueId}`} className="block">
            <Button size="sm" variant="ghost" className="w-full">Open auction</Button>
          </Link>
        ) : null
      case 'attention':
        return l.status === 'rejected' ? null : (
          <Button size="sm" variant="secondary" className="w-full"
            onClick={() => { setLotStatus(l.id, 'inspected'); pushToast({ kind: 'success', title: `${l.lotNo} resolved`, body: 'Returned to the inspected queue for approval.' }) }}>
            Resolve
          </Button>
        )
      default:
        return null
    }
  }

  return (
    <Page>
      <PageHeader title="Lot pipeline" sub="Every lot on the platform, from seller submission through inspection, approval, auction and resolution." />

      {draftCatalogues.length > 0 && (
        <div className="mb-6 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Private catalogues â€” not visible to any buyer or seller
          </div>
          {draftCatalogues.map((c) => {
            const catLots = lots.filter((l) => l.catalogueId === c.id)
            const resolved = catLots.filter((l) => l.status === 'approved').length
            const ready = catLots.length > 0 && resolved === catLots.length
            const exec = users.find((u) => u.id === c.assignedFieldExecId)
            return (
              <div key={c.id} className="card p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="num text-sm font-bold text-ember">{c.code}</span>
                    <span className="font-semibold text-sm">{c.title}</span>
                    {ready && <Chip tone="success">Ready for market</Chip>}
                  </div>
                  <div className="text-xs text-ink-muted mt-0.5">
                    Assigned to {exec?.name ?? 'unassigned'} Â· <span className="num">{resolved}/{catLots.length}</span> lots decided
                  </div>
                </div>
                {/* Publish deliberately does not live here any more. It is one
                    press on Auction schedule, where the buyer preview, the
                    schedule and the CEO value threshold all sit together â€”
                    publishing from a pipeline board skipped every one of them. */}
                <Link to="/auction/schedule">
                  <Button size="sm" variant={ready ? 'success' : 'secondary'}>
                    {ready ? 'Take to Auction schedule' : `${resolved}/${catLots.length} lots decided`}
                    <ArrowRight size={14} />
                  </Button>
                </Link>
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <Stat label="Pending inspection" value={byCol[0].lots.length} tone="steel" />
        <Stat label="Inspected" value={byCol[1].lots.length} tone="steel" />
        <Stat label="Approved" value={byCol[2].lots.length} tone="success" />
        <Stat label="In auction" value={byCol[3].lots.length} tone="ember" />
        <Stat label="Resolved" value={byCol[4].lots.length} />
        <Stat label="Attention" value={byCol[5].lots.length} tone="warning" />
      </div>

      <div className={cx('flex items-center justify-between gap-3 mb-2 transition-opacity',
        scrollable ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
        <div className="text-xs text-ink-faint">
          Scroll sideways for all <span className="num">{COLS.length}</span> stages
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => nudge(-1)} disabled={!edge.left}
            aria-label="Scroll pipeline left"
            className="h-7 w-7 grid place-items-center rounded-full border border-line bg-surface text-ink-muted hover:text-ink hover:border-line-strong disabled:opacity-35 disabled:hover:text-ink-muted disabled:hover:border-line transition-colors">
            <ChevronLeft size={15} />
          </button>
          <button type="button" onClick={() => nudge(1)} disabled={!edge.right}
            aria-label="Scroll pipeline right"
            className="h-7 w-7 grid place-items-center rounded-full border border-line bg-surface text-ink-muted hover:text-ink hover:border-line-strong disabled:opacity-35 disabled:hover:text-ink-muted disabled:hover:border-line transition-colors">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div className="relative">
        {/* Fades sit above the board and only on the side that still has
            columns behind it â€” a cut-off card edge under a fade is the cue
            that the row keeps going. */}
        <div aria-hidden className={cx('pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-canvas to-transparent transition-opacity duration-200',
          edge.left ? 'opacity-100' : 'opacity-0')} />
        <div aria-hidden className={cx('pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-canvas to-transparent transition-opacity duration-200',
          edge.right ? 'opacity-100' : 'opacity-0')} />

        <div ref={scroller} className="overflow-x-auto scroll-visible pb-3 -mx-1 px-1 snap-x">
          <div ref={track} className="flex gap-4">
            {byCol.map((col) => (
              <div key={col.key} className="w-72 shrink-0 snap-start">
                <div className={cx('flex items-center justify-between px-3 py-2 rounded-t-2xl border border-b-0',
                  col.amber ? 'bg-warning-soft border-warning/25' : 'bg-surface-2 border-line')}>
                  <span className={cx('text-sm font-bold', col.amber ? 'text-warning' : 'text-ink')}>{col.title}</span>
                  <span className={cx('num text-xs font-bold px-2 py-0.5 rounded-full', col.amber ? 'bg-warning text-white' : 'bg-surface text-ink-muted border border-line')}>
                    {col.lots.length}
                  </span>
                </div>
                <div className={cx('rounded-b-2xl border border-t-0 p-2 space-y-2 min-h-32 bg-canvas',
                  col.amber ? 'border-warning/25' : 'border-line')}>
                  {col.lots.length === 0 && (
                    <div className="text-xs text-ink-faint text-center py-8">Nothing here</div>
                  )}
                  {col.lots.slice(0, CARD_CAP).map((l) => {
                    const m = measured(l)
                    return (
                      <div key={l.id} className="card p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="num text-xs font-bold text-ink">{l.lotNo}</span>
                          <div className="flex items-center gap-1">
                            {/* The bypass marker travels with the lot everywhere it
                                appears â€” Ops, Auction and Finance all see it. */}
                            {l.inspectionWaived && (
                              <span title={l.waivedReason ?? 'Accepted without a yard visit'}>
                                <Chip tone="warning"><ShieldOff size={10} /> Bypassed</Chip>
                              </span>
                            )}
                            <StatusChip status={l.status} />
                          </div>
                        </div>
                        <div className="text-sm font-semibold leading-tight">{l.grade} <span className="text-ink-muted font-normal">Â· {l.metal}</span></div>
                        <div className="text-xs text-ink-muted">
                          <span className="num">{num(l.indicativeQty)} {l.uom}</span> Â· {l.yard}
                        </div>
                        {m != null && (
                          <div className="text-xs text-ink-faint">Measured <span className="num text-ink-muted">{num(m)} {l.uom}</span> on inspection</div>
                        )}
                        {actions(col.key, l)}
                      </div>
                    )
                  })}
                  {col.lots.length > CARD_CAP && (
                    <div className="text-xs text-ink-faint text-center py-1.5">
                      <Chip tone="neutral">+{col.lots.length - CARD_CAP} more lots</Chip>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Page>
  )
}
