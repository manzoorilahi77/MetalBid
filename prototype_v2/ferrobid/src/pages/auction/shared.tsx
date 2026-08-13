/* ---------------------------------------------------------------------------
   Auction Manager workspace — shared derivations and primitives.

   This desk is the most time-critical in the product: the same auction is read
   on six screens while it is running, so the row it is read from is computed in
   exactly one place. Every intervention (pause, extend, cancellation, void,
   referral) also collects a typed reason before it commits, so that lives here
   too rather than being re-implemented per page.
--------------------------------------------------------------------------- */
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { Button, Chip, Field, Modal, Textarea, cx } from '../../components/ui'
import { catalogueUiStatus, useStore } from '../../store/store'
import { useNow } from '../../lib/useTick'
import type { Bid, Catalogue, Lot, User } from '../../types'

/* ------------------------------ derived rows ------------------------------ */

export interface AuctionRow {
  cat: Catalogue
  lots: Lot[]
  liveLots: Lot[]
  soldLots: Lot[]
  staLots: Lot[]
  bids: Bid[]
  /** Live / closing / upcoming / closed as the UI reads it, not as stored. */
  ui: 'live' | 'closing' | 'upcoming' | 'closed'
  isPaused: boolean
  extensions: number
  /** Distinct firms with a valid bid on this auction. */
  participants: number
  /** Firms that got through the door: EMD funded on at least one lot, or
   *  already bidding — placing a bid means they cleared the gate, so counting
   *  funding alone would report an empty room that is visibly full. */
  admitted: number
  bidsLastHour: number
  /** Sum of every lot's reserve — internal only, never rendered to a buyer. */
  reserveValue: number
  /** What the sold lots actually cleared for. */
  realisation: number
  seller?: User
  resultsConfirmed: boolean
  cancellationPending: boolean
}

/** Every catalogue as one row, computed once per render of whichever screen
 *  asks. Ordered soonest-closing first — the order this desk works in. */
export function useAuctionRows(): AuctionRow[] {
  const now = useNow()
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const bids = useStore((s) => s.bids)
  const users = useStore((s) => s.users)
  const paused = useStore((s) => s.paused)
  const resultConfirmations = useStore((s) => s.resultConfirmations)
  const cancellationRequests = useStore((s) => s.cancellationRequests)
  const selections = useStore((s) => s.selections)

  return useMemo(() => {
    const lotsByCat = new Map<string, Lot[]>()
    for (const l of lots) {
      const arr = lotsByCat.get(l.catalogueId)
      if (arr) arr.push(l)
      else lotsByCat.set(l.catalogueId, [l])
    }
    const bidsByCat = new Map<string, Bid[]>()
    for (const b of bids) {
      if (b.status !== 'valid') continue
      const arr = bidsByCat.get(b.catalogueId)
      if (arr) arr.push(b)
      else bidsByCat.set(b.catalogueId, [b])
    }
    const confirmed = new Set(resultConfirmations.map((r) => r.catalogueId))
    const pendingCancel = new Set(cancellationRequests.filter((r) => r.status === 'pending').map((r) => r.catalogueId))
    const hourAgo = now - 3600_000

    return catalogues
      .map<AuctionRow>((cat) => {
        const catLots = lotsByCat.get(cat.id) ?? []
        const catBids = bidsByCat.get(cat.id) ?? []
        return {
          cat,
          lots: catLots,
          liveLots: catLots.filter((l) => l.status === 'live'),
          soldLots: catLots.filter((l) => l.status === 'sold'),
          staLots: catLots.filter((l) => l.status === 'sta'),
          bids: catBids,
          ui: catalogueUiStatus(cat, now, catLots),
          isPaused: !!paused[cat.id],
          extensions: catLots.reduce((s, l) => s + l.extensions, 0),
          participants: new Set(catBids.map((b) => b.bidderId)).size,
          admitted: new Set([
            ...selections.filter((x) => x.catalogueId === cat.id && x.emdFundedLotIds.length > 0).map((x) => x.buyerId),
            ...catBids.map((b) => b.bidderId),
          ]).size,
          bidsLastHour: catBids.filter((b) => Date.parse(b.at) >= hourAgo).length,
          reserveValue: catLots.reduce((s, l) => s + l.reserveRate * l.indicativeQty, 0),
          realisation: catLots
            .filter((l) => l.status === 'sold')
            .reduce((s, l) => s + (l.resultH1Rate ?? l.currentRate ?? 0) * l.indicativeQty, 0),
          seller: users.find((u) => u.id === cat.sellerId),
          resultsConfirmed: confirmed.has(cat.id),
          cancellationPending: pendingCancel.has(cat.id),
        }
      })
      .sort((a, b) => Date.parse(a.cat.endsAt) - Date.parse(b.cat.endsAt))
  }, [catalogues, lots, bids, users, paused, resultConfirmations, cancellationRequests, selections, now])
}

/** Catalogues a buyer can already see — live or upcoming, past the publish gate. */
export const isPublished = (r: AuctionRow) => r.cat.status === 'live' || r.cat.status === 'upcoming'

/** Assembled by Operations, not yet public. This desk's inbox. */
export const isAwaitingPublish = (r: AuctionRow) => r.cat.status === 'draft'

/* --------------------------------- pieces --------------------------------- */

/** Section heading with a hairline that runs to the edge — used instead of a
 *  card wrapper where the content below is already carded, so the page reads as
 *  chapters rather than a stack of boxes. */
export function SectionTitle({ title, count, sub, action }: {
  title: ReactNode; count?: number; sub?: ReactNode; action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-3 mt-9 first:mt-0">
      <div className="min-w-0">
        <h2 className="font-display text-lg font-bold flex items-center gap-2">
          {title}
          {count !== undefined && (
            <span className="num text-xs font-bold px-1.5 py-0.5 rounded-md bg-surface-2 text-ink-muted border border-line">{count}</span>
          )}
        </h2>
        {sub && <p className="text-[13px] text-ink-muted mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

/** The auction's identity line — status, code, title, seller, yard. Identical
 *  on every screen so an auction is recognisable at a glance wherever it turns
 *  up, which matters when the same sale is being read on three tabs at once. */
export function AuctionIdentity({ row, to, children }: { row: AuctionRow; to?: string; children?: ReactNode }) {
  const { cat, seller } = row
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2 flex-wrap">
        <FloorStatus row={row} />
        <span className="num text-xs font-bold text-ember">{cat.code}</span>
        {children}
      </div>
      <div className="font-display font-bold text-lg mt-1 truncate">
        {to ? <Link to={to} className="hover:text-ember">{cat.title}</Link> : cat.title}
      </div>
      <div className="text-xs text-ink-muted mt-0.5 truncate">
        {seller?.firm ?? 'Unknown seller'} · {cat.yardName}, {cat.region}
      </div>
    </div>
  )
}

/** Status as this desk needs to read it: paused outranks everything, because a
 *  paused sale looks alive on every other surface and is not. */
export function FloorStatus({ row }: { row: AuctionRow }) {
  if (row.isPaused) return <Chip tone="danger" pulse>Paused</Chip>
  if (row.cancellationPending) return <Chip tone="danger">Cancellation with Super Admin</Chip>
  switch (row.ui) {
    case 'live': return <Chip tone="ember" pulse>Live</Chip>
    case 'closing': return <Chip tone="warning" pulse>Closing soon</Chip>
    case 'upcoming': return <Chip tone="steel">Scheduled</Chip>
    default: return row.cat.status === 'draft'
      ? <Chip tone="neutral">Private — not published</Chip>
      : <Chip tone="neutral">Closed</Chip>
  }
}

/** A paused auction is drawn with hazard stripes rather than a colour change
 *  alone — the one state on this desk that must never be mistaken for running. */
export function PausedOverlay() {
  return (
    <div aria-hidden className="absolute inset-x-0 top-0 h-1 opacity-70"
      style={{ backgroundImage: 'repeating-linear-gradient(135deg, var(--danger) 0 10px, transparent 10px 20px)' }} />
  )
}

/** States plainly what this desk is not allowed to do, next to the place a
 *  button for it would otherwise sit. The separation is a feature, so it is
 *  shown rather than left as an absence. */
export function ScopeNote({ children }: { children: ReactNode }) {
  return (
    <div className="card bg-surface-2/60 border-dashed px-4 py-3 flex items-start gap-2.5 text-[13px] text-ink-muted">
      <Lock size={14} className="mt-0.5 shrink-0 text-ink-faint" />
      <p className="max-w-3xl">{children}</p>
    </div>
  )
}

/* ------------------------------- reason gate ------------------------------- */

/** Every intervention on this desk is reason-mandatory and lands in the audit
 *  trail under the name of whoever pressed it. One dialog enforces that for all
 *  of them, so no screen can quietly skip it. */
export function ReasonModal({
  open, onClose, title, intent = 'warning', confirmLabel, summary, hint, placeholder, presets, onConfirm,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  intent?: 'warning' | 'danger' | 'primary'
  confirmLabel: string
  /** What is about to happen, in the user's terms. */
  summary: ReactNode
  hint?: ReactNode
  placeholder?: string
  /** Common reasons, one tap each — typing stays available and is not replaced. */
  presets?: string[]
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const close = () => { setReason(''); onClose() }
  return (
    <Modal open={open} onClose={close} title={title}>
      <div className="space-y-4">
        <div className={cx('card border-0 p-4 text-sm',
          intent === 'danger' ? 'bg-danger-soft text-ink' : intent === 'warning' ? 'bg-warning-soft text-ink' : 'bg-surface-2')}>
          {summary}
        </div>
        {presets && presets.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button key={p} type="button" onClick={() => setReason(p)}
                className={cx('h-7 px-2.5 rounded-lg border text-xs font-semibold transition-colors',
                  reason === p ? 'border-ember bg-ember-soft text-ember-strong' : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink')}>
                {p}
              </button>
            ))}
          </div>
        )}
        <Field label="Reason" hint={hint ?? 'Recorded in the audit trail against your name, and shown to whoever it affects.'}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant={intent === 'danger' ? 'danger' : intent === 'warning' ? 'steel' : 'primary'}
            disabled={reason.trim().length < 4}
            onClick={() => { onConfirm(reason.trim()); close() }}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
