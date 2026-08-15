/* ---------------------------------------------------------------------------
   CEO / MD — auction performance. Still the second question, from the other
   side: growth says how much trade we carried, this says **how well the sales
   themselves worked**.

   Four things decide whether an auction was any good, and they are not the same
   as whether it was big: did the lots sell, did competition push the price
   above the seller's floor, did enough people turn up to make that competition
   real, and did we have to intervene to keep it clean. A sale that clears
   everything with one bidder per lot is not a healthy sale.

   Nothing on this page is actionable by the CEO — running an auction belongs to
   the Auction Manager. It is here so the pattern across sales is visible in one
   place, which is the only view nobody else has.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Gavel, Timer } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Chip, EmptyState, PageHeader, Segmented, StatusChip } from '../../components/ui'
import { inr, inrCompact, num, relTime } from '../../lib/format'
import { PERIOD_LABEL, delta, type PeriodKey } from '../../lib/money'
import { Headline, NotMyDecision, PlainStat, Question, Ranked, useAuctionPerformance, useGrowth } from './shared'

export default function CeoAuctionPerformance() {
  const [period, setPeriod] = useState<PeriodKey>('quarter')
  const g = useGrowth(period)
  // The same derivation the dashboard summarises — one measurement of a sale,
  // read by two screens.
  const { rows, live, upcoming, totals, now } = useAuctionPerformance(period)

  const prevSellThrough = g.previous.lotsOffered > 0 ? (g.previous.lotsSold / g.previous.lotsOffered) * 100 : 0

  return (
    <Page>
      <PageHeader
        title="Auction performance"
        sub="How well the sales worked, not how big they were. Every figure is counted from the bids that were actually placed."
        actions={
          <Segmented
            options={(['month', 'quarter', 'year', 'all'] as PeriodKey[]).map((k) => ({ key: k, label: PERIOD_LABEL[k] }))}
            value={period} onChange={setPeriod}
          />
        }
      />

      <div className="grid md:grid-cols-2 gap-3">
        <Headline
          label={`Sell-through · ${PERIOD_LABEL[period].toLowerCase()}`}
          value={`${totals.sellThrough.toFixed(0)}%`}
          trend={period === 'all' ? undefined : delta(totals.sellThrough, prevSellThrough)}
          prev={prevSellThrough > 0 ? <>previous period {prevSellThrough.toFixed(0)}%</> : undefined}
          sub={`${num(totals.soldLots)} of ${num(totals.totalLots)} lots offered found a buyer across ${num(totals.auctions)} closed auction${totals.auctions === 1 ? '' : 's'}. An unsold lot costs a seller their time and costs us the inspection.`}
        />
        <Headline
          label="Average price over reserve"
          value={`${g.current.avgUplift.toFixed(1)}%`}
          trend={period === 'all' ? undefined : delta(g.current.avgUplift, g.previous.avgUplift)}
          prev={g.previous.avgUplift > 0 ? <>previous period {g.previous.avgUplift.toFixed(1)}%</> : undefined}
          sub="How far competition pushed the winning price above the seller's own floor. It is the seller's gain first — and the base our commission is charged on, so it is the single most important number on this page."
        />
      </div>

      <Question
        q="Was there real competition?"
        a="Depth is what makes an auction an auction. One bidder per lot is a private sale with extra steps, and the price shows it."
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <PlainStat label="Bids per lot sold" value={totals.bidsPerLot.toFixed(1)} sub="across the whole period" />
        <PlainStat label="Bidders per auction" value={totals.biddersPerAuction.toFixed(1)} sub="distinct firms that placed a bid" />
        <PlainStat label="Last-minute extensions" value={num(totals.extensions)}
          sub={`${totals.extensionRate.toFixed(0)}% of sold lots ran past their close`} />
        <PlainStat label="Total realisation" value={inrCompact(totals.realisation)} sub="what the material sold for" />
      </div>

      <Question
        q="Did we have to step in?"
        a="Interventions are not failures in themselves — catching a bad bid is the system working. A rising rate is the signal, not the count."
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <PlainStat label="Bids flagged" value={num(totals.flags)} sub="put on the record by surveillance" to="/ceo/issues" />
        <PlainStat label="Bids struck off" value={num(totals.voids)} tone={totals.voids > 0 ? 'risk' : 'plain'}
          sub="voided by a Super Admin" to="/ceo/issues" />
        <PlainStat label="Auctions cancelled" value={num(totals.cancellations)} tone={totals.cancellations > 0 ? 'risk' : 'plain'}
          sub="every bid voided, all EMD released" to="/ceo/issues" />
        <PlainStat label="Results not yet confirmed" value={num(rows.filter((r) => !r.confirmed).length)}
          sub="sellers cannot accept a price until they are" />
      </div>

      {/* ------------------------------ per auction ---------------------------- */}
      <Question q="Every auction that closed" a="Newest first. Uplift is the winning price against the seller's reserve on the lots that sold." />
      {rows.length === 0 ? (
        <EmptyState
          icon={<Gavel size={32} strokeWidth={1.5} />}
          title={`No auction closed ${PERIOD_LABEL[period].toLowerCase()}`}
          body="Widen the period, or look at what is live and scheduled below."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-[13px] min-w-[840px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-ink-faint border-b border-line">
                <th className="px-4 py-2.5 font-bold">Auction</th>
                <th className="px-3 py-2.5 font-bold text-right">Lots sold</th>
                <th className="px-3 py-2.5 font-bold text-right">Sell-through</th>
                <th className="px-3 py-2.5 font-bold text-right">Realisation</th>
                <th className="px-3 py-2.5 font-bold text-right">Over reserve</th>
                <th className="px-3 py-2.5 font-bold text-right">Bidders</th>
                <th className="px-3 py-2.5 font-bold text-right">Extensions</th>
                <th className="px-4 py-2.5 font-bold">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const st = r.lotsOffered > 0 ? (r.lotsSold / r.lotsOffered) * 100 : 0
                return (
                  <tr key={r.id} className="hover:bg-surface-2/60">
                    <td className="px-4 py-2.5">
                      <Link to={`/catalogue/${r.id}`} className="font-semibold hover:text-ember">{r.title}</Link>
                      <div className="text-[11px] text-ink-faint num">{r.code} · {r.region} · closed {relTime(r.closedAt, now)}</div>
                    </td>
                    <td className="px-3 py-2.5 num text-right">{num(r.lotsSold)}<span className="text-ink-faint">/{num(r.lotsOffered)}</span></td>
                    <td className="px-3 py-2.5 num text-right font-semibold">{st.toFixed(0)}%</td>
                    <td className="px-3 py-2.5 num text-right font-semibold">{inrCompact(r.realisation)}</td>
                    <td className="px-3 py-2.5 num text-right">
                      {r.uplift == null ? <span className="text-ink-faint">—</span> : (
                        <span className={r.uplift >= 0 ? 'text-success font-semibold' : 'text-danger font-semibold'}>
                          {r.uplift >= 0 ? '+' : ''}{r.uplift.toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 num text-right">{num(r.bidders)}</td>
                    <td className="px-3 py-2.5 num text-right">{r.extensions > 0 ? num(r.extensions) : <span className="text-ink-faint">—</span>}</td>
                    <td className="px-4 py-2.5">
                      {r.confirmed
                        ? <Chip tone="success">Confirmed</Chip>
                        : <Chip tone="warning">Awaiting the Auction Manager</Chip>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ------------------------------ right now ------------------------------ */}
      <Question q="What is running now" a="Read-only. Pausing, extending or closing a sale belongs to the Auction Manager." />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-line bg-surface-2/60 flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Live now</span>
            <Chip tone={live.length ? 'ember' : 'neutral'} pulse={live.length > 0}>{num(live.length)}</Chip>
          </div>
          {live.length === 0 ? (
            <p className="px-4 py-6 text-[13px] text-ink-muted text-center">No auction is live at the moment.</p>
          ) : (
            <div className="divide-y divide-line">
              {live.slice(0, 6).map((c) => (
                <Link key={c.id} to={`/catalogue/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                  <StatusChip status="live" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold truncate">{c.title}</div>
                    <div className="text-[11px] text-ink-faint num">{c.code} · closes {relTime(c.endsAt, now)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-line bg-surface-2/60 flex items-center gap-2">
            <Timer size={13} className="text-ink-faint" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Scheduled</span>
            <Chip tone="steel">{num(upcoming.length)}</Chip>
          </div>
          {upcoming.length === 0 ? (
            <p className="px-4 py-6 text-[13px] text-ink-muted text-center">Nothing is scheduled. That is a pipeline problem before it is a revenue one.</p>
          ) : (
            <div className="divide-y divide-line">
              {upcoming.slice(0, 6).map((c) => (
                <Link key={c.id} to={`/catalogue/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                  <StatusChip status="upcoming" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold truncate">{c.title}</div>
                    <div className="text-[11px] text-ink-faint num">{c.code} · opens {relTime(c.startsAt, now)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <Question q="Which sales earned most" />
      <div className="grid md:grid-cols-2 gap-4">
        <Ranked
          title="Biggest auctions by realisation"
          rows={rows.map((r) => ({ key: r.id, label: r.title, sub: `${r.code} · ${num(r.lotsSold)} lots · ${num(r.bidders)} bidders`, amount: r.realisation }))}
          empty="No auction closed in this period."
        />
        <Ranked title="By region" rows={g.byRegion} empty="No auction closed in this period." />
      </div>

      <div className="mt-8">
        <NotMyDecision>
          Everything here is a reading. Publishing a sale, pausing it, extending it and confirming its results belong to
          the Auction Manager; voiding a bid or cancelling a sale is a Super Admin decision. The one auction decision
          that reaches you is a catalogue worth more than{' '}
          <Link to="/ceo/approvals" className="text-ember font-semibold hover:underline">the publish threshold</Link>,
          and it arrives as a request rather than as a screen you have to watch. Total realisation across this period was{' '}
          <span className="num font-semibold text-ink">{inr(totals.realisation)}</span>.
        </NotMyDecision>
      </div>
    </Page>
  )
}
