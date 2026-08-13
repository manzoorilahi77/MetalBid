/* ---------------------------------------------------------------------------
   EMD fund-by reminder — the nag a buyer gets when a shortlisted catalogue's
   pre-bid EMD deadline is inside 24 hours and lots are still unfunded. Miss it
   and that auction can't be joined at all (see src/lib/emd.ts).
--------------------------------------------------------------------------- */
import { Link } from 'react-router-dom'
import { AlertTriangle, Clock } from 'lucide-react'
import { Button } from './ui'
import { selectionSummary, useStore } from '../store/store'
import { emdDeadlineMs, emdDeadlineSoon } from '../lib/emd'
import { countdown, inr } from '../lib/format'
import { useNow } from '../lib/useTick'

export function EmdReminderBanner({ className }: { className?: string }) {
  const me = useStore((s) => s.currentUser)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const selections = useStore((s) => s.selections)
  const now = useNow()

  if (!me) return null

  const due = catalogues
    .filter((c) => emdDeadlineSoon(c, now))
    .map((c) => ({ cat: c, summary: selectionSummary({ selections, lots }, me.id, c.id) }))
    .filter((x) => x.summary.count > 0 && x.summary.shortfall > 0)
    .sort((a, b) => emdDeadlineMs(a.cat) - emdDeadlineMs(b.cat))

  if (due.length === 0) return null

  return (
    <div className={className}>
      <div className="card border-l-4 border-l-warning p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-warning shrink-0" />
          <span className="font-semibold text-sm">
            EMD closing soon on {due.length} auction{due.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {due.map(({ cat, summary }) => (
            <div key={cat.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="num font-semibold text-ember">{cat.code}</span>
                <span className="text-ink-muted"> · {summary.unfundedLotIds.length} of {summary.count} lots unfunded · </span>
                <span className="num font-semibold text-warning">{inr(summary.shortfall)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-warning num whitespace-nowrap">
                <Clock size={13} /> {countdown(emdDeadlineMs(cat) - now)} left to fund
              </span>
              <Link to="/buyer/emd-shortlisted-catalogue">
                <Button size="sm">Fund EMD</Button>
              </Link>
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-faint">
          Pre-bid EMD has to be funded before the deadline — once it passes, the auction can no longer be joined.
        </p>
      </div>
    </div>
  )
}
