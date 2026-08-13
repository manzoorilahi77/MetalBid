/* ---------------------------------------------------------------------------
   Auction Manager — bid monitor.

   Two things on one screen: the flags waiting on a decision, and the live
   stream they come from. Flagging a bid used to produce a message that reached
   nobody — the escalation had no destination. Here a flag becomes a record with
   two ways out: dismissed with a reason, or sent to the Super Admin as a void
   request. Either way it stays on the record.

   Voiding a bid itself is never done here. It takes a win away from a customer,
   so it belongs to one role only.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowUpRight, CheckCircle2, Flag, Flame, ShieldAlert, X } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Button, Chip, EmptyState, Field, LockChip, PageHeader, Select, Stat, Toggle, cx,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDateTime, fmtTime, inr, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import { ReasonModal, ScopeNote, SectionTitle } from './shared'
import type { Bid, BidType, BidVoidRequest } from '../../types'

const TYPE_LABEL: Record<BidType, string> = { manual: 'Manual', auto: 'Auto', bot: 'Floor', tender: 'Tender offer' }
const TYPE_TONE: Record<BidType, 'neutral' | 'steel' | 'ember'> = { manual: 'neutral', auto: 'steel', bot: 'ember', tender: 'neutral' }
const FLAG_REASONS = ['Rapid-fire pattern', 'Suspected collusion', 'Bid retraction request', 'Wallet mismatch']
const HOT_LOT_BIDS = 6

export default function AuctionBidMonitor() {
  const now = useNow()
  const bids = useStore((s) => s.bids)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const users = useStore((s) => s.users)
  const voidRequests = useStore((s) => s.bidVoidRequests)
  const flagBid = useStore((s) => s.flagBid)
  const requestBidVoid = useStore((s) => s.requestBidVoid)
  const dismissBidFlag = useStore((s) => s.dismissBidFlag)
  const pushToast = useStore((s) => s.pushToast)

  const [catFilter, setCatFilter] = useState('all')
  const [hotOnly, setHotOnly] = useState(false)
  const [holdFeed, setHoldFeed] = useState(false)
  const [frozen, setFrozen] = useState<Bid[] | null>(null)
  const [flagging, setFlagging] = useState<Bid | null>(null)
  const [escalating, setEscalating] = useState<BidVoidRequest | null>(null)
  const [dismissing, setDismissing] = useState<BidVoidRequest | null>(null)

  const liveCats = catalogues.filter((c) => c.status === 'live')
  const liveCatIds = new Set(liveCats.map((c) => c.id))
  const lotById = new Map(lots.map((l) => [l.id, l]))
  const catById = new Map(catalogues.map((c) => [c.id, c]))
  const bidById = new Map(bids.map((b) => [b.id, b]))

  const liveStream = bids
    .filter((b) => {
      if (b.status !== 'valid' || !liveCatIds.has(b.catalogueId)) return false
      if (catFilter !== 'all' && b.catalogueId !== catFilter) return false
      if (hotOnly && (lotById.get(b.lotId)?.bidCount ?? 0) <= HOT_LOT_BIDS) return false
      return true
    })
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 25)

  const rows = holdFeed && frozen ? frozen : liveStream
  const flaggedBidIds = new Set(voidRequests.filter((r) => r.status === 'pending').map((r) => r.bidId))

  const awaitingReview = voidRequests.filter((r) => r.status === 'pending' && r.stage === 'flagged')
  const withSuperAdmin = voidRequests.filter((r) => r.status === 'pending' && r.stage === 'requested')
  const settled = voidRequests.filter((r) => r.status !== 'pending')

  const firm = (id: string) => users.find((u) => u.id === id)?.firm ?? 'Unknown firm'
  const nameOf = (id?: string) => (id ? users.find((u) => u.id === id)?.name ?? 'the desk' : 'the desk')

  const toggleHold = (v: boolean) => { setFrozen(v ? liveStream : null); setHoldFeed(v) }

  /* one flag row, shared between the two open queues */
  const FlagCard = ({ r, stage }: { r: BidVoidRequest; stage: 'flagged' | 'requested' }) => {
    const bid = bidById.get(r.bidId)
    const lot = lotById.get(r.lotId)
    const cat = catById.get(r.catalogueId)
    return (
      <div className={cx('card overflow-hidden', stage === 'requested' && 'border-danger/40')}>
        <div className="p-4 flex flex-wrap items-start gap-4">
          <span className={cx('size-9 rounded-xl grid place-items-center shrink-0',
            stage === 'requested' ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning')}>
            {stage === 'requested' ? <ShieldAlert size={17} /> : <Flag size={17} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm">{r.reason}</span>
              <Chip tone={stage === 'requested' ? 'danger' : 'warning'}>
                {stage === 'requested' ? 'With Super Admin' : 'Awaiting your review'}
              </Chip>
              {cat && <span className="num text-xs font-bold text-ember">{cat.code}</span>}
            </div>
            <div className="text-[13px] text-ink-muted mt-1">
              <span className="num font-semibold text-ink">{lot?.lotNo ?? r.lotId}</span>
              {bid && <> · <b className="num text-ink">{inr(bid.rate)}</b>/{lot?.uom ?? 'MT'} from <b className="text-ink">{firm(bid.bidderId)}</b></>}
              {bid && <> · placed {fmtDateTime(bid.at)}</>}
            </div>
            {r.notes && <p className="text-[13px] text-ink-muted italic mt-1.5">“{r.notes}”</p>}
            <div className="text-[11px] text-ink-faint mt-1.5">
              Raised by {nameOf(r.raisedBy)} {relTime(r.raisedAt, now)}
              {r.requestedAt && <> · escalated by {nameOf(r.requestedBy)} {relTime(r.requestedAt, now)}</>}
            </div>
          </div>
          {lot && (
            <Link to={`/auction/rooms/${r.catalogueId}`} className="shrink-0">
              <Button variant="ghost" size="sm">Open room <ArrowUpRight size={13} /></Button>
            </Link>
          )}
        </div>
        {stage === 'flagged' ? (
          <div className="px-4 py-3 border-t border-line bg-surface-2/50 flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-ink-muted mr-auto">
              Dismissing leaves the bid standing and the flag on record. Escalating asks the Super Admin to void it.
            </span>
            <Button variant="ghost" size="sm" onClick={() => setDismissing(r)}>
              <X size={14} /> Dismiss — bidding was legitimate
            </Button>
            <Button variant="danger" size="sm" onClick={() => setEscalating(r)}>
              <ShieldAlert size={14} /> Request a void
            </Button>
          </div>
        ) : (
          <div className="px-4 py-3 border-t border-danger/20 bg-danger-soft/40 flex items-center gap-2 text-[13px]">
            <LockChip label="Only a Super Admin can void" />
            <span className="text-ink-muted">The bid stands and the ladder is unchanged until they decide.</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <Page>
      <PageHeader
        title="Bid monitor"
        sub="The live bid stream, and every flag raised on it. Review each one, then dismiss it or send it to the Super Admin as a void request."
        actions={holdFeed
          ? <Chip tone="warning">Feed held</Chip>
          : <Chip tone="ember" pulse><Activity size={12} /> Streaming</Chip>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Awaiting your review" value={num(awaitingReview.length)} tone={awaitingReview.length ? 'warning' : 'success'} sub="Flags with nowhere to go until you act" />
        <Stat label="With the Super Admin" value={num(withSuperAdmin.length)} tone={withSuperAdmin.length ? 'danger' : undefined} sub="Void requests you have escalated" />
        <Stat label="Bids on the stream" value={num(liveStream.length)} tone="steel" sub="Most recent valid bids, live sales" />
        <Stat label="Closed flags" value={num(settled.length)} sub="Voided or let stand — both on record" />
      </div>

      {/* -------------------------- the queues --------------------------- */}
      {(awaitingReview.length > 0 || withSuperAdmin.length > 0) ? (
        <>
          {awaitingReview.length > 0 && (
            <>
              <SectionTitle title="Flags to review" count={awaitingReview.length} sub="Surveillance put these on the record. They need a decision from this desk." />
              <div className="space-y-3">
                {awaitingReview.map((r) => <FlagCard key={r.id} r={r} stage="flagged" />)}
              </div>
            </>
          )}
          {withSuperAdmin.length > 0 && (
            <>
              <SectionTitle title="Escalated — waiting on the Super Admin" count={withSuperAdmin.length} sub="Out of this desk's hands. Nothing changes on the ladder until they rule." />
              <div className="space-y-3">
                {withSuperAdmin.map((r) => <FlagCard key={r.id} r={r} stage="requested" />)}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <SectionTitle title="Flags to review" sub="Anything anomalous you or surveillance flag lands here." />
          <EmptyState
            icon={<CheckCircle2 size={32} strokeWidth={1.5} />}
            title="Nothing is flagged"
            body="The stream below is clean. Flag a bid from here or from a bidding room and it will appear at the top of this page."
          />
        </>
      )}

      {/* --------------------------- the stream --------------------------- */}
      <SectionTitle
        title="Live bid stream"
        sub={`The ${num(rows.length)} most recent valid bids across running sales. Holding the feed is a deliberate feature — it is not a failure state.`}
      />

      <div className="card p-4 mb-4 flex flex-wrap items-end gap-x-6 gap-y-3">
        <Field label="Auction" className="w-64">
          <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            <option value="all">All running auctions</option>
            {liveCats.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
          </Select>
        </Field>
        <div className="pb-2.5"><Toggle checked={hotOnly} onChange={setHotOnly} label={`Only contested lots (over ${HOT_LOT_BIDS} bids)`} /></div>
        <div className="pb-2.5"><Toggle checked={holdFeed} onChange={toggleHold} label="Hold the feed" /></div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No bids match this view"
          body="Widen the auction filter or switch off the contested-lots toggle. The stream refreshes every second while a sale is running."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
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
                  const isFlagged = flaggedBidIds.has(b.id)
                  const hot = (lot?.bidCount ?? 0) > HOT_LOT_BIDS
                  return (
                    <tr key={b.id} className={cx('animate-bid-in border-b border-line last:border-0 hover:bg-surface-2/60', isFlagged && 'bg-warning-soft/30')}>
                      <td className="px-5 py-2.5 whitespace-nowrap">
                        <span className="num text-xs">{fmtTime(b.at)}</span>
                        <span className="text-xs text-ink-faint ml-2">{relTime(b.at, now)}</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Link to={`/auction/rooms/${b.catalogueId}`} className="num font-semibold mr-2 hover:text-ember">{lot?.lotNo ?? b.lotId}</Link>
                        {cat && <Chip tone="ember" className="num">{cat.code}</Chip>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-medium">{bidder?.firm ?? b.bidderId}</span>
                        {bidder?.bidderId && <Chip tone="steel" className="num ml-2">{bidder.bidderId}</Chip>}
                        {hot && <Chip tone="warning" className="num ml-2"><Flame size={10} /> {num(lot?.bidCount ?? 0)} bids</Chip>}
                      </td>
                      <td className="px-3 py-2.5 text-right num font-bold whitespace-nowrap">
                        {inr(b.rate)}<span className="text-xs text-ink-faint font-medium">/{lot?.uom ?? 'MT'}</span>
                      </td>
                      <td className="px-3 py-2.5"><Chip tone={TYPE_TONE[b.type]}>{TYPE_LABEL[b.type]}</Chip></td>
                      <td className="px-5 py-2.5 text-right">
                        {isFlagged
                          ? <Chip tone="warning"><Flag size={11} /> On the record</Chip>
                          : <Button variant="ghost" size="sm" onClick={() => setFlagging(b)}><Flag size={13} /> Flag</Button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-surface-2 border-t border-line text-xs text-ink-muted flex items-center justify-between gap-3 flex-wrap">
            <span>Showing the {num(rows.length)} most recent valid bids{holdFeed ? ' — feed held, values are not updating' : ''}.</span>
            <LockChip label="Voiding requires a Super Admin" />
          </div>
        </div>
      )}

      {/* ------------------------- closed flags --------------------------- */}
      {settled.length > 0 && (
        <>
          <SectionTitle title="Closed flags" count={settled.length} sub="A refused void keeps its flag — the record is never rewritten." />
          <div className="card divide-y divide-line overflow-hidden">
            {settled.map((r) => {
              const lot = lotById.get(r.lotId)
              const voided = r.status === 'approved'
              return (
                <div key={r.id} className="px-4 py-3 flex flex-wrap items-center gap-3 text-[13px]">
                  <Chip tone={voided ? 'danger' : 'neutral'}>{voided ? 'Bid voided' : 'Bid stands'}</Chip>
                  <span className="num font-semibold">{lot?.lotNo ?? r.lotId}</span>
                  <span className="text-ink-muted">{r.reason}</span>
                  <span className="text-ink-faint ml-auto">
                    {r.decisionNote && <>“{r.decisionNote}” · </>}
                    {nameOf(r.decidedBy)}{r.decidedAt && <> · {fmtDateTime(r.decidedAt)}</>}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="mt-6">
        <ScopeNote>
          A flag never changes the ladder. Only a Super Admin can void a bid, and when they do the leader is recomputed from
          the remaining valid bids — which is exactly why the decision does not sit with the desk running the sale.
        </ScopeNote>
      </div>

      {/* ------------------------------ dialogs ------------------------------ */}
      <ReasonModal
        open={!!flagging}
        onClose={() => setFlagging(null)}
        title="Put this bid on the record"
        intent="warning"
        confirmLabel="Flag for review"
        summary={flagging ? (
          <>
            <b className="num">{inr(flagging.rate)}</b> from <b>{firm(flagging.bidderId)}</b> on{' '}
            <b className="num">{lotById.get(flagging.lotId)?.lotNo}</b>. The bid stands — flagging records it and puts it in
            the queue above.
          </>
        ) : null}
        placeholder="e.g. Four bids inside 20 seconds, each at the exact minimum increment, immediately after a rival firm's bid."
        presets={FLAG_REASONS}
        onConfirm={(reason) => {
          if (!flagging) return
          flagBid(flagging.id, reason)
          pushToast({ kind: 'warning', title: 'Bid flagged', body: 'It is on the record and waiting at the top of this page.' })
          setFlagging(null)
        }}
      />

      <ReasonModal
        open={!!escalating}
        onClose={() => setEscalating(null)}
        title="Request a void from the Super Admin"
        intent="danger"
        confirmLabel="Send the request"
        summary={
          <>
            <b>This does not void the bid.</b> It sends the flag, your evidence and this note to the Super Admin, who decides.
            The bid stands and the ladder is unchanged in the meantime — and if they refuse, it stays standing with the flag
            still on record.
          </>
        }
        hint="Whatever you write is what the Super Admin rules on. Attach the specifics."
        placeholder="e.g. Same beneficiary account behind both firms per the bank-account records; bidding alternates at 12-second intervals across three lots."
        onConfirm={(note) => {
          if (!escalating) return
          requestBidVoid(escalating.id, note)
          pushToast({ kind: 'warning', title: 'Void requested', body: 'The Super Admin has it. The bid stands until they rule.' })
          setEscalating(null)
        }}
      />

      <ReasonModal
        open={!!dismissing}
        onClose={() => setDismissing(null)}
        title="Dismiss this flag"
        intent="primary"
        confirmLabel="Dismiss — the bid stands"
        summary={<>The bid stays exactly as it is. The flag is not erased: it stays on the record with your reason, so the pattern is still visible if it repeats.</>}
        placeholder="e.g. Checked the ladder — the firm was responding to a proxy bid, not driving the price. Normal bidding."
        presets={['Normal competitive bidding', 'Explained by an auto-bid ceiling', 'Firms verified as unrelated', 'Bidder contacted and satisfied']}
        onConfirm={(reason) => {
          if (!dismissing) return
          dismissBidFlag(dismissing.id, reason)
          pushToast({ kind: 'success', title: 'Flag dismissed', body: 'The bid stands. The flag remains on record.' })
          setDismissing(null)
        }}
      />
    </Page>
  )
}
