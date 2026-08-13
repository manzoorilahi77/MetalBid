/* ---------------------------------------------------------------------------
   Sub Admin — Bid monitor.

   Live surveillance of the bid stream, and the one place a bid is put on the
   record. The escalation is deliberately two steps: **flag** it here, then
   **request the void** with the evidence attached — and only a Super Admin
   voids it. A bid, once placed, is a commitment another buyer priced against;
   removing one is never a routine correction.

   The flag itself used to be a toast and a local `Set`. It now writes a real
   record that the Super Admin's Emergency override reads, so a flag raised here
   still exists after a refresh and still exists for the person who has to act
   on it.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowUpRight, Flag, Gavel, ShieldAlert } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Button, Chip, EmptyState, Field, LockChip, Modal, PageHeader, Select, Stat, Textarea, Toggle,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, fmtDateTime, relTime, num } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type { Bid, BidType } from '../../types'

const TYPE_LABEL: Record<BidType, string> = { manual: 'Manual', auto: 'Auto', bot: 'Floor', tender: 'Tender offer' }
const TYPE_TONE: Record<BidType, 'neutral' | 'steel' | 'ember'> = { manual: 'neutral', auto: 'steel', bot: 'ember', tender: 'neutral' }

const FLAG_REASONS = [
  'Rapid-fire pattern',
  'Bid retraction request',
  'Suspected collusion',
  'Wallet mismatch',
  'Rate entered an order of magnitude out',
]

export default function BidMonitor() {
  const now = useNow()
  const bids = useStore((s) => s.bids)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const users = useStore((s) => s.users)
  const flags = useStore((s) => s.bidVoidRequests)
  const flagBid = useStore((s) => s.flagBid)
  const requestBidVoid = useStore((s) => s.requestBidVoid)
  const dismissBidFlag = useStore((s) => s.dismissBidFlag)
  const pushToast = useStore((s) => s.pushToast)

  const [catFilter, setCatFilter] = useState('all')
  const [hotOnly, setHotOnly] = useState(false)
  const [holdFeed, setHoldFeed] = useState(false)
  const [frozen, setFrozen] = useState<Bid[] | null>(null)

  const [flagging, setFlagging] = useState<Bid | null>(null)
  const [reason, setReason] = useState(FLAG_REASONS[0])
  const [notes, setNotes] = useState('')
  const [escalating, setEscalating] = useState<string | null>(null)
  const [escalationNote, setEscalationNote] = useState('')

  const liveCats = catalogues.filter((c) => c.status === 'live')
  const liveCatIds = new Set(liveCats.map((c) => c.id))
  const lotById = new Map(lots.map((l) => [l.id, l]))
  const catById = new Map(catalogues.map((c) => [c.id, c]))
  const flagByBid = new Map(flags.map((f) => [f.bidId, f]))

  const liveStream = bids
    .filter((b) => {
      if (b.status !== 'valid' || !liveCatIds.has(b.catalogueId)) return false
      if (catFilter !== 'all' && b.catalogueId !== catFilter) return false
      if (hotOnly && (lotById.get(b.lotId)?.bidCount ?? 0) <= 6) return false
      return true
    })
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 25)

  const rows = holdFeed && frozen ? frozen : liveStream

  const openFlags = flags.filter((f) => f.status === 'pending' && f.stage === 'flagged')
  const withSuper = flags.filter((f) => f.status === 'pending' && f.stage === 'requested')
  const decided = flags.filter((f) => f.status !== 'pending')

  const toggleHold = (v: boolean) => {
    setFrozen(v ? liveStream : null)
    setHoldFeed(v)
  }

  const submitFlag = () => {
    if (!flagging) return
    flagBid(flagging.id, reason, notes.trim() || undefined)
    const lot = lotById.get(flagging.lotId)
    pushToast({
      kind: 'success',
      title: 'Flagged and on the record',
      body: `${lot?.lotNo ?? 'Bid'} · ${reason}. The bid still stands — decide next whether to ask for a void.`,
    })
    setFlagging(null)
    setNotes('')
    setReason(FLAG_REASONS[0])
  }

  const escalate = () => {
    if (!escalating) return
    requestBidVoid(escalating, escalationNote.trim() || undefined)
    setEscalating(null)
    setEscalationNote('')
    pushToast({
      kind: 'info',
      title: 'Void requested — with the Super Admin',
      body: 'The bid stands until they decide. If they refuse, the flag stays on record.',
    })
  }

  const dismiss = (id: string) => {
    dismissBidFlag(id, 'Reviewed on the monitor — the pattern is explained, the bid stands')
    pushToast({ kind: 'success', title: 'Flag cleared', body: 'The bid stands and the flag stays on the record.' })
  }

  return (
    <Page>
      <PageHeader
        title="Bid monitor"
        sub="The last 25 valid bids across every live lot. Flag what looks wrong; a void is the Super Admin's, always."
        actions={
          holdFeed
            ? <Chip tone="warning">Feed held</Chip>
            : <Chip tone="ember" pulse><Activity size={12} /> Streaming</Chip>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Bids on screen" value={num(rows.length)} sub={`${num(liveCats.length)} live catalogues`} />
        <Stat label="Flagged, yours to judge" value={num(openFlags.length)} tone={openFlags.length ? 'warning' : undefined} sub="Ask for a void, or clear it" />
        <Stat label="With the Super Admin" value={num(withSuper.length)} tone="steel" sub="Void requested" to="/admin/control-tower" />
        <Stat label="Decided" value={num(decided.length)} sub="Voided or refused" />
      </div>

      {/* ---------------------- flags this desk is holding -------------------- */}
      {(openFlags.length > 0 || withSuper.length > 0) && (
        <section className="card overflow-hidden mb-4">
          <div className="px-5 py-4 border-b border-line flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display font-bold text-lg flex items-center gap-2">
              <ShieldAlert size={18} className="text-warning" /> Flags on the record
            </h2>
            <LockChip label="Voiding is Super Admin only" />
          </div>
          <ul>
            {[...openFlags, ...withSuper].map((f) => {
              const lot = lotById.get(f.lotId)
              const cat = catById.get(f.catalogueId)
              const bid = bids.find((b) => b.id === f.bidId)
              const bidder = users.find((u) => u.id === bid?.bidderId)
              return (
                <li key={f.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-line last:border-0">
                  <span className="size-9 rounded-xl bg-warning-soft text-warning border border-line flex items-center justify-center shrink-0">
                    <Gavel size={16} />
                  </span>
                  <div className="flex-1 min-w-52">
                    <div className="font-semibold text-sm">
                      <span className="num">{lot?.lotNo ?? f.lotId}</span>
                      {cat && <span className="num text-xs font-bold text-ember ml-2">{cat.code}</span>}
                      {bid && <span className="text-ink-muted"> · {bidder?.firm ?? bid.bidderId} at <span className="num">{inr(bid.rate)}</span></span>}
                    </div>
                    <div className="text-xs text-ink-muted mt-0.5">
                      {f.reason}{f.notes && ` — ${f.notes}`} · raised {relTime(f.raisedAt, now)}
                    </div>
                  </div>
                  {f.stage === 'requested' ? (
                    <>
                      <Chip tone="steel">With Super Admin</Chip>
                      <Link to="/admin/control-tower" className="text-xs font-semibold text-ink-faint hover:underline">
                        Where it landed <ArrowUpRight size={11} className="inline" />
                      </Link>
                    </>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => dismiss(f.id)}>The bid stands</Button>
                      <Button variant="secondary" size="sm" onClick={() => { setEscalating(f.id); setEscalationNote('') }}>
                        Ask for a void
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* ------------------------------ filters ------------------------------ */}
      <div className="card p-4 mb-4 flex flex-wrap items-end gap-x-6 gap-y-3">
        <Field label="Catalogue" className="w-64">
          <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            <option value="all">All live catalogues</option>
            {liveCats.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
          </Select>
        </Field>
        <div className="pb-2.5">
          <Toggle checked={hotOnly} onChange={setHotOnly} label="Only heavily-bid lots (>6 bids)" />
        </div>
        <div className="pb-2.5">
          <Toggle checked={holdFeed} onChange={toggleHold} label="Hold the feed" />
        </div>
      </div>

      {/* ------------------------------ the stream ---------------------------- */}
      {rows.length === 0 ? (
        <EmptyState
          title="No bids match this view"
          body="Widen the catalogue filter or switch off the heavily-bid toggle — the stream refreshes every second."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-ink-faint border-b border-line">
                  <th className="px-5 py-2.5 font-semibold">Time</th>
                  <th className="px-3 py-2.5 font-semibold">Lot</th>
                  <th className="px-3 py-2.5 font-semibold">Bidder firm</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Rate</th>
                  <th className="px-3 py-2.5 font-semibold">Type</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const lot = lotById.get(b.lotId)
                  const cat = catById.get(b.catalogueId)
                  const bidder = users.find((u) => u.id === b.bidderId)
                  const flag = flagByBid.get(b.id)
                  return (
                    <tr key={b.id} className="animate-bid-in border-b border-line last:border-0 hover:bg-surface-2/60">
                      <td className="px-5 py-2.5 whitespace-nowrap">
                        <span className="num text-xs">{fmtDateTime(b.at)}</span>
                        <span className="text-xs text-ink-faint ml-2">{relTime(b.at, now)}</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="num font-semibold mr-2">{lot?.lotNo ?? b.lotId}</span>
                        {cat && (
                          <Link to={`/catalogue/${cat.id}`}>
                            <Chip tone="ember" className="hover:opacity-80">{cat.code}</Chip>
                          </Link>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-medium">{bidder?.firm ?? b.bidderId}</span>
                        {bidder?.bidderId && <Chip tone="steel" className="num ml-2">{bidder.bidderId}</Chip>}
                        {lot && lot.bidCount > 6 && <Chip tone="warning" className="ml-2">{num(lot.bidCount)} bids</Chip>}
                      </td>
                      <td className="px-3 py-2.5 text-right num font-bold whitespace-nowrap">
                        {inr(b.rate)}<span className="text-xs text-ink-faint font-medium">/{lot?.uom ?? 'MT'}</span>
                      </td>
                      <td className="px-3 py-2.5"><Chip tone={TYPE_TONE[b.type]}>{TYPE_LABEL[b.type]}</Chip></td>
                      <td className="px-5 py-2.5 text-right">
                        {flag
                          ? (
                            <Chip tone={flag.status !== 'pending' ? 'neutral' : flag.stage === 'requested' ? 'steel' : 'warning'}>
                              <Flag size={11} /> {flag.status !== 'pending' ? flag.status : flag.stage === 'requested' ? 'Void requested' : 'Flagged'}
                            </Chip>
                          )
                          : (
                            <Button variant="ghost" size="sm" onClick={() => setFlagging(b)}>
                              <Flag size={13} /> Flag
                            </Button>
                          )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-surface-2 border-t border-line text-xs text-ink-muted flex items-center justify-between gap-3 flex-wrap">
            <span>
              The {num(rows.length)} most recent valid bids{holdFeed ? ' (feed held)' : ''}. Flagging never removes a
              bid — it puts it on the record.
            </span>
            <LockChip label="Void requires Super Admin" />
          </div>
        </div>
      )}

      {/* ------------------------------ flag a bid ---------------------------- */}
      <Modal open={!!flagging} onClose={() => setFlagging(null)} title="Flag this bid">
        {flagging && (
          <div className="space-y-4">
            <div className="card bg-surface-2 p-3.5 text-sm flex flex-wrap items-baseline justify-between gap-2">
              <span>
                <span className="num font-semibold">{lotById.get(flagging.lotId)?.lotNo ?? flagging.lotId}</span>
                <span className="text-ink-muted"> · {users.find((u) => u.id === flagging.bidderId)?.firm ?? flagging.bidderId}</span>
              </span>
              <span className="num font-bold">{inr(flagging.rate)}/{lotById.get(flagging.lotId)?.uom ?? 'MT'}</span>
            </div>
            <Field label="Reason">
              <Select value={reason} onChange={(e) => setReason(e.target.value)}>
                {FLAG_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            </Field>
            <Field label="What you saw" hint="Timestamps, rival bids, anything whoever reviews this will need.">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. four bids inside 20 seconds from the same firm, each at the exact minimum increment…"
              />
            </Field>
            <div className="card bg-surface-2 p-3 text-xs text-ink-muted">
              Flagging records it and leaves the bid standing. Asking for a void is the next step, and only a Super
              Admin can grant one.
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setFlagging(null)}>Cancel</Button>
              <Button onClick={submitFlag}><Flag size={14} /> Flag it</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------------------- request a void -------------------------- */}
      <Modal open={!!escalating} onClose={() => setEscalating(null)} title="Ask for this bid to be voided">
        <div className="space-y-4">
          <div className="card bg-warning-soft/50 border-0 p-3.5 text-sm text-ink-muted">
            A bid is a commitment other buyers priced against. Voiding one moves the whole ladder, so it is never a
            routine correction — the Super Admin decides, and the bid stands in the meantime.
          </div>
          <Field label="Why it should be voided" hint="Goes across with the flag and everything already recorded on it.">
            <Textarea
              value={escalationNote}
              onChange={(e) => setEscalationNote(e.target.value)}
              rows={3}
              placeholder="e.g. the buyer called within a minute of the bid; the rate is 10× the ladder and every other bid on the lot sits inside 3%…"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEscalating(null)}>Cancel</Button>
            <Button onClick={escalate}>Send to Super Admin</Button>
          </div>
        </div>
      </Modal>
    </Page>
  )
}
