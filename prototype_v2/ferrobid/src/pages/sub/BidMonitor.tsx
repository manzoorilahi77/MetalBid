/* Sub-admin bid monitor — live surveillance of the bid stream across live lots.
   Sub-admin can FLAG a bid for Super Admin review, but cannot void it. */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Flag } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Button, Chip, EmptyState, Field, LockChip, Modal, PageHeader, Select, Textarea, Toggle,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, fmtDateTime, relTime, num } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type { Bid, BidType } from '../../types'

const TYPE_LABEL: Record<BidType, string> = { manual: 'Manual', auto: 'Auto', bot: 'Floor' }
const TYPE_TONE: Record<BidType, 'neutral' | 'steel' | 'ember'> = { manual: 'neutral', auto: 'steel', bot: 'ember' }

const FLAG_REASONS = [
  'Rapid-fire pattern',
  'Bid retraction request',
  'Suspected collusion',
  'Wallet mismatch',
]

export default function BidMonitor() {
  const now = useNow()
  const bids = useStore((s) => s.bids)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const users = useStore((s) => s.users)
  const audit = useStore((s) => s.audit)
  const pushToast = useStore((s) => s.pushToast)

  const [catFilter, setCatFilter] = useState('all')
  const [hotOnly, setHotOnly] = useState(false)
  const [holdFeed, setHoldFeed] = useState(false)
  const [frozen, setFrozen] = useState<Bid[] | null>(null)

  const [flagging, setFlagging] = useState<Bid | null>(null)
  const [reason, setReason] = useState(FLAG_REASONS[0])
  const [notes, setNotes] = useState('')
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set())

  const liveCats = catalogues.filter((c) => c.status === 'live')
  const liveCatIds = new Set(liveCats.map((c) => c.id))
  const lotById = new Map(lots.map((l) => [l.id, l]))
  const catById = new Map(catalogues.map((c) => [c.id, c]))

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

  const toggleHold = (v: boolean) => {
    setFrozen(v ? liveStream : null)
    setHoldFeed(v)
  }

  const submitFlag = () => {
    if (!flagging) return
    const lot = lotById.get(flagging.lotId)
    audit('bid.flag', flagging.id, `${reason} — ${inr(flagging.rate)} on ${lot?.lotNo ?? flagging.lotId}${notes.trim() ? ` · ${notes.trim()}` : ''}`, 'warning')
    setFlaggedIds((prev) => new Set(prev).add(flagging.id))
    pushToast({ kind: 'success', title: 'Flagged — sent to Super Admin for approval', body: `${lot?.lotNo ?? 'Bid'} · ${reason}` })
    setFlagging(null)
    setNotes('')
    setReason(FLAG_REASONS[0])
  }

  return (
    <Page>
      <PageHeader
        title="Bid monitor"
        sub="Real-time surveillance of the last 25 valid bids across live lots. Flag anomalies for Super Admin review — voiding is out of your scope."
        actions={
          holdFeed
            ? <Chip tone="warning">Feed held</Chip>
            : <Chip tone="ember" pulse><Activity size={12} /> Streaming</Chip>
        }
      />

      {/* ------------------------------ filters ------------------------------ */}
      <div className="card p-4 mb-4 flex flex-wrap items-end gap-x-6 gap-y-3">
        <Field label="Catalogue" className="w-64">
          <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            <option value="all">All live catalogues</option>
            {liveCats.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
          </Select>
        </Field>
        <div className="pb-2.5">
          <Toggle checked={hotOnly} onChange={setHotOnly} label="Only flagged-pattern lots (>6 bids)" />
        </div>
        <div className="pb-2.5">
          <Toggle checked={holdFeed} onChange={toggleHold} label="Pause updates" />
        </div>
      </div>

      {/* ------------------------------ stream ------------------------------- */}
      {rows.length === 0 ? (
        <EmptyState title="No bids match this view" body="Widen the catalogue filter or switch off the flagged-pattern toggle — the stream refreshes every second." />
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
                  const isFlagged = flaggedIds.has(b.id)
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
                            <Chip tone="steel" className="hover:opacity-80">{cat.code}</Chip>
                          </Link>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-medium">{bidder?.firm ?? b.bidderId}</span>
                        {lot && lot.bidCount > 6 && <Chip tone="warning" className="ml-2">{num(lot.bidCount)} bids</Chip>}
                      </td>
                      <td className="px-3 py-2.5 text-right num font-bold whitespace-nowrap">
                        {inr(b.rate)}<span className="text-xs text-ink-faint font-medium">/{lot?.uom ?? 'MT'}</span>
                      </td>
                      <td className="px-3 py-2.5"><Chip tone={TYPE_TONE[b.type]}>{TYPE_LABEL[b.type]}</Chip></td>
                      <td className="px-5 py-2.5 text-right">
                        {isFlagged
                          ? <Chip tone="warning"><Flag size={11} /> Flagged</Chip>
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
            <span>Showing the {num(rows.length)} most recent valid bids{holdFeed ? ' (feed held)' : ''}.</span>
            <LockChip label="Void requires Super Admin" />
          </div>
        </div>
      )}

      {/* ---------------------------- flag modal ------------------------------ */}
      <Modal open={!!flagging} onClose={() => setFlagging(null)} title="Flag bid for review">
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
            <Field label="Notes for Super Admin" hint="Attach context — timestamps, rival bids, anything the reviewer needs.">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. 4 bids inside 20 seconds from the same firm, each at exact minimum increment…" />
            </Field>
            <div className="card bg-surface-2 p-3 flex items-center justify-between gap-3">
              <span className="text-xs text-ink-muted">Flagging queues this bid for review. Only a Super Admin can void it.</span>
              <LockChip label="Void requires Super Admin" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setFlagging(null)}>Cancel</Button>
              <Button onClick={submitFlag}><Flag size={14} /> Submit flag</Button>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  )
}
