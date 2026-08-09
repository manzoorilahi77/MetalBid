/* ---------------------------------------------------------------------------
   Shared "star lots to shortlist" picker — every lot in a catalogue, star to
   shortlist/unshortlist, tagged Not shortlisted / EMD pending / EMD paid.
   Used both by the Bid Now flow (BidroomGate's lot-review step) and by the
   Browse & Shortlist page's per-card "Shortlist lots" action, so the two
   surfaces can't drift into two different lot lists.
--------------------------------------------------------------------------- */
import type { ReactNode } from 'react'
import { Star } from 'lucide-react'
import { Chip, Modal } from './ui'
import { selectionSummary, useStore } from '../store/store'
import { inr, num } from '../lib/format'
import type { Catalogue } from '../types'

export function LotShortlistModal({ open, cat, onClose, footer }: {
  open: boolean
  cat: Catalogue | null
  onClose: () => void
  /** Renders below the lot list — callers own their own actions (Back + Enter
   *  bidding room for the bidroom gate; a plain Done button from Browse). */
  footer?: (summary: ReturnType<typeof selectionSummary>) => ReactNode
}) {
  const me = useStore((s) => s.currentUser)
  const lots = useStore((s) => s.lots)
  const selections = useStore((s) => s.selections)
  const toggleShortlist = useStore((s) => s.toggleShortlist)
  const pushToast = useStore((s) => s.pushToast)
  if (!cat) return null

  const catLots = lots.filter((l) => l.catalogueId === cat.id)
  const summary = selectionSummary({ selections, lots }, me?.id, cat.id)

  return (
    <Modal open={open} onClose={onClose} wide
      title={<span className="flex items-center gap-2"><span className="num text-sm text-ink-faint">{cat.code}</span> Lots in this auction</span>}>
      <p className="text-sm text-ink-muted">
        Star the lots you want to bid on. Pre-bid EMD is locked per lot — only starred lots enter the room with you.
      </p>

      <div className="mt-3 card bg-surface-2 border-0 divide-y divide-line max-h-[45vh] overflow-y-auto">
        {catLots.map((l) => {
          const shortlisted = summary.lotIds.includes(l.id)
          const funded = summary.fundedLotIds.includes(l.id)
          return (
            <div key={l.id} className="flex items-center gap-3 px-3 py-2.5">
              <button
                onClick={() => {
                  if (funded) {
                    pushToast({ kind: 'info', title: `${l.lotNo} stays shortlisted`, body: 'EMD is locked on this lot until the auction closes.' })
                    return
                  }
                  toggleShortlist(cat.id, l.id)
                }}
                aria-label={shortlisted ? `Remove ${l.lotNo} from shortlist` : `Shortlist ${l.lotNo}`}
                aria-pressed={shortlisted}
                className={`p-1.5 rounded-lg shrink-0 transition-colors ${shortlisted ? 'text-ember' : 'text-ink-faint hover:text-ink'} ${funded ? 'cursor-default' : 'hover:bg-surface'}`}
              >
                <Star size={18} fill={shortlisted ? 'currentColor' : 'none'} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="num text-sm font-bold">{l.lotNo}</span>
                  <Chip tone="neutral">{l.metal}</Chip>
                </div>
                <div className="text-xs text-ink-muted line-clamp-1 mt-0.5">{l.description}</div>
                <div className="text-[11px] text-ink-faint mt-0.5 num">
                  {num(l.indicativeQty)} {l.uom} · start {inr(l.startRate)}/{l.uom} · EMD {inr(l.preBidEmd)}
                </div>
              </div>
              {funded
                ? <Chip tone="success">EMD paid</Chip>
                : shortlisted
                  ? <Chip tone="warning">EMD pending</Chip>
                  : <Chip tone="neutral">Not shortlisted</Chip>}
            </div>
          )
        })}
      </div>

      {footer?.(summary)}
    </Modal>
  )
}
