/* ---------------------------------------------------------------------------
   Auction Manager — results.

   A closed sale is not finished until this desk says the outcomes are right.
   Confirmation is the hand-off that opens the seller's accept-or-reject step,
   so an unconfirmed auction is a seller who cannot settle.

   Lots that cleared below reserve are the exception, and deliberately not this
   desk's call: accepting a price below the seller's reserve is a commercial
   decision. They are referred to Operations with a note, and the sale can only
   be confirmed once every one of them has been.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CheckCircle2, Gavel, Send, TrendingDown, TrendingUp } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Button, Chip, EmptyState, PageHeader, Stat, StatusChip, cx,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDateTime, inr, inrCompact, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import { ReasonModal, ScopeNote, SectionTitle, useAuctionRows, type AuctionRow } from './shared'
import type { Lot } from '../../types'

/** Uplift over the opening rate — the number that says whether the sale worked. */
const upliftPct = (l: Lot) => {
  const cleared = l.resultH1Rate ?? l.currentRate ?? 0
  return l.startRate > 0 ? ((cleared - l.startRate) / l.startRate) * 100 : 0
}
const vsReservePct = (l: Lot) => {
  const cleared = l.resultH1Rate ?? l.currentRate ?? 0
  return l.reserveRate > 0 ? ((cleared - l.reserveRate) / l.reserveRate) * 100 : 0
}

export default function AuctionResults() {
  const now = useNow()
  const rows = useAuctionRows()
  const users = useStore((s) => s.users)
  const staReferrals = useStore((s) => s.staReferrals)
  const resultConfirmations = useStore((s) => s.resultConfirmations)
  const confirmAuctionResults = useStore((s) => s.confirmAuctionResults)
  const referStaLot = useStore((s) => s.referStaLot)
  const pushToast = useStore((s) => s.pushToast)

  const [referring, setReferring] = useState<Lot | null>(null)

  const closed = rows.filter((r) => r.cat.status === 'closed' && r.lots.length > 0)
  const awaiting = closed.filter((r) => !r.resultsConfirmed)
  const confirmed = closed.filter((r) => r.resultsConfirmed)

  const referredLotIds = new Set(staReferrals.map((r) => r.lotId))
  const firm = (id: string | null) => (id ? users.find((u) => u.id === id)?.firm ?? 'Unknown bidder' : '—')
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? 'the auction desk'

  const openStaCount = awaiting.reduce((s, r) => s + r.staLots.filter((l) => !referredLotIds.has(l.id)).length, 0)

  const confirm = (r: AuctionRow) => {
    const res = confirmAuctionResults(r.cat.id)
    pushToast(res.ok
      ? { kind: 'success', title: `${r.cat.code} results confirmed`, body: 'The seller can now accept or reject each cleared price and settle commission.' }
      : { kind: 'danger', title: 'Not confirmed', body: res.error })
  }

  /* one auction's outcome sheet */
  const ResultSheet = ({ r }: { r: AuctionRow }) => {
    const openSta = r.staLots.filter((l) => !referredLotIds.has(l.id))
    const unsold = r.lots.filter((l) => l.status === 'unsold')
    const sellThrough = r.lots.length ? (r.soldLots.length / r.lots.length) * 100 : 0
    const avgUplift = r.soldLots.length
      ? r.soldLots.reduce((s, l) => s + upliftPct(l), 0) / r.soldLots.length
      : 0
    const record = resultConfirmations.find((c) => c.catalogueId === r.cat.id)

    return (
      <div className={cx('card overflow-hidden', openSta.length > 0 && 'border-warning/40')}>
        {/* identity + headline outcome */}
        <div className="p-4 flex flex-wrap items-start gap-4 border-b border-line">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {r.resultsConfirmed
                ? <Chip tone="success"><CheckCircle2 size={11} /> Confirmed</Chip>
                : <Chip tone="warning">Awaiting confirmation</Chip>}
              <span className="num text-xs font-bold text-ember">{r.cat.code}</span>
              <span className="text-[11px] text-ink-faint num">closed {relTime(r.cat.endsAt, now)}</span>
            </div>
            <div className="font-display font-bold text-lg mt-1">{r.cat.title}</div>
            <div className="text-xs text-ink-muted mt-0.5">{r.seller?.firm ?? 'Unknown seller'} · {r.cat.yardName}, {r.cat.region}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Realised</div>
            <div className="num text-2xl font-bold text-success">{inrCompact(r.realisation)}</div>
            <div className="text-[11px] text-ink-faint num">{inrCompact(r.reserveValue)} at reserve</div>
          </div>
        </div>

        <div className="p-4 grid grid-cols-2 sm:grid-cols-5 gap-4 border-b border-line">
          {[
            { label: 'Sold', value: num(r.soldLots.length), tone: 'text-success' },
            { label: 'Below reserve', value: num(r.staLots.length), tone: r.staLots.length ? 'text-warning' : '' },
            { label: 'Unsold', value: num(unsold.length), tone: '' },
            { label: 'Sell-through', value: `${sellThrough.toFixed(0)}%`, tone: '' },
            { label: 'Avg uplift', value: `${avgUplift >= 0 ? '+' : ''}${avgUplift.toFixed(1)}%`, tone: avgUplift >= 0 ? 'text-success' : 'text-danger' },
          ].map((m) => (
            <div key={m.label}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">{m.label}</div>
              <div className={cx('num text-lg font-bold mt-0.5', m.tone)}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* lot-by-lot outcomes */}
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[680px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-ink-faint border-b border-line bg-surface-2/50">
                <th className="px-4 py-2.5 font-bold">Lot</th>
                <th className="px-3 py-2.5 font-bold">Material</th>
                <th className="px-3 py-2.5 font-bold">Outcome</th>
                <th className="px-3 py-2.5 font-bold">H1 bidder</th>
                <th className="px-3 py-2.5 font-bold text-right">Cleared</th>
                <th className="px-3 py-2.5 font-bold text-right">vs reserve</th>
                <th className="px-4 py-2.5 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {r.lots.map((l) => {
                const cleared = l.resultH1Rate ?? l.currentRate ?? 0
                const delta = vsReservePct(l)
                const referral = staReferrals.find((x) => x.lotId === l.id)
                return (
                  <tr key={l.id} className={cx('border-b border-line last:border-0', l.status === 'sta' && !referral && 'bg-warning-soft/25')}>
                    <td className="px-4 py-2.5 num font-semibold whitespace-nowrap">{l.lotNo}</td>
                    <td className="px-3 py-2.5 text-ink-muted truncate max-w-44">{l.grade} · {l.metal}</td>
                    <td className="px-3 py-2.5"><StatusChip status={l.status} /></td>
                    <td className="px-3 py-2.5 truncate max-w-40">{l.status === 'unsold' ? <span className="text-ink-faint">—</span> : firm(l.leadingBidderId)}</td>
                    <td className="px-3 py-2.5 num text-right font-semibold whitespace-nowrap">
                      {cleared ? <>{inr(cleared)}<span className="text-[10px] text-ink-faint font-medium">/{l.uom}</span></> : <span className="text-ink-faint">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {cleared ? (
                        <span className={cx('num font-semibold inline-flex items-center gap-1', delta >= 0 ? 'text-success' : 'text-danger')}>
                          {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
                        </span>
                      ) : <span className="text-ink-faint">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {l.status === 'sta' && (referral ? (
                        <Chip tone="steel" className="whitespace-nowrap"><Send size={10} /> With Operations</Chip>
                      ) : (
                        <Button variant="secondary" size="sm" onClick={() => setReferring(l)}>
                          <ArrowUpRight size={13} /> Refer to Ops
                        </Button>
                      ))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* confirmation */}
        {r.resultsConfirmed && record ? (
          <div className="px-4 py-3 border-t border-success/20 bg-success-soft/40 text-[13px] flex flex-wrap items-center gap-2">
            <CheckCircle2 size={15} className="text-success shrink-0" />
            <span>
              Confirmed by <b>{nameOf(record.confirmedBy)}</b> on {fmtDateTime(record.confirmedAt)} —{' '}
              <span className="num">{num(record.lotsSold)}</span> sold, <span className="num">{inr(record.realisation)}</span> realised.
            </span>
            <Link to="/auction/history" className="ml-auto text-[12px] font-bold text-ember hover:underline">History →</Link>
          </div>
        ) : (
          <div className="px-4 py-3 border-t border-line bg-surface-2/50 flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-ink-muted mr-auto">
              {openSta.length > 0 ? (
                <>
                  <b className="text-warning">{num(openSta.length)} lot{openSta.length === 1 ? '' : 's'} cleared below reserve</b> —
                  refer {openSta.length === 1 ? 'it' : 'them'} to Operations before this sale can be confirmed.
                </>
              ) : (
                <>Confirming hands the results to {r.seller?.firm ?? 'the seller'}, who then accepts or rejects each cleared price.</>
              )}
            </span>
            <Button size="sm" disabled={openSta.length > 0} onClick={() => confirm(r)}>
              <CheckCircle2 size={14} /> Confirm results
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <Page>
      <PageHeader
        title="Results"
        sub="Sign off what each closed sale actually achieved. Until you do, the seller cannot accept a price or settle commission."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Awaiting confirmation" value={num(awaiting.length)} tone={awaiting.length ? 'warning' : 'success'} sub="Sellers waiting on you" />
        <Stat label="Below reserve, undecided" value={num(openStaCount)} tone={openStaCount ? 'warning' : undefined} sub="Not this desk's call — refer them" />
        <Stat label="Confirmed" value={num(confirmed.length)} tone="success" sub="Handed to the seller" />
        <Stat
          label="Realised, confirmed sales"
          value={inrCompact(confirmed.reduce((s, r) => s + r.realisation, 0))}
          tone="success"
          sub="What the material actually cleared for"
        />
      </div>

      <SectionTitle
        title="Waiting on you"
        count={awaiting.length}
        sub="Closed sales whose outcomes have not yet been signed off."
      />
      {awaiting.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={32} strokeWidth={1.5} />}
          title="Every closed sale is confirmed"
          body="Auctions land here the moment their last lot closes."
        />
      ) : (
        <div className="space-y-4">
          {awaiting.map((r) => <ResultSheet key={r.cat.id} r={r} />)}
        </div>
      )}

      {confirmed.length > 0 && (
        <>
          <SectionTitle title="Confirmed" count={confirmed.length} sub="Signed off and handed to the seller for settlement." />
          <div className="space-y-4">
            {confirmed.map((r) => <ResultSheet key={r.cat.id} r={r} />)}
          </div>
        </>
      )}

      {closed.length === 0 && (
        <EmptyState icon={<Gavel size={32} strokeWidth={1.5} />} title="No sale has closed yet" body="Results appear here as auctions finish." />
      )}

      <div className="mt-6">
        <ScopeNote>
          A lot that cleared below the seller&apos;s reserve is a commercial decision, not an auction one — this desk refers
          it, and the Operation Manager or Sub Admin decides whether to accept the price or return the material. Nothing here
          changes a rate, a reserve or a buyer&apos;s obligation.
        </ScopeNote>
      </div>

      <ReasonModal
        open={!!referring}
        onClose={() => setReferring(null)}
        title={`Refer ${referring?.lotNo ?? ''} to Operations`}
        intent="warning"
        confirmLabel="Refer with a note"
        summary={
          referring ? (
            <>
              <b className="num">{referring.lotNo}</b> cleared at <b className="num">{inr(referring.resultH1Rate ?? referring.currentRate ?? 0)}</b>/{referring.uom} against a
              reserve of <b className="num">{inr(referring.reserveRate)}</b> — <b>{vsReservePct(referring).toFixed(1)}%</b>.
              The Operation Manager decides whether to accept it or return the material. Nothing changes for the bidder yet.
            </>
          ) : null
        }
        hint="Operations reads this alongside the bid history. Say what you saw in the room."
        placeholder="e.g. Only two bidders funded EMD on this lot and both stopped early — the reserve looks high for the grade rather than the bidding being weak."
        presets={['Thin bidding — only one or two funded bidders', 'Reserve looks high for the grade', 'H1 close to reserve, worth accepting', 'Material description may have deterred bidders']}
        onConfirm={(note) => {
          if (!referring) return
          referStaLot(referring.id, note)
          pushToast({ kind: 'info', title: `${referring.lotNo} referred to Operations`, body: 'They decide whether to accept the price or return the material.' })
          setReferring(null)
        }}
      />
    </Page>
  )
}
