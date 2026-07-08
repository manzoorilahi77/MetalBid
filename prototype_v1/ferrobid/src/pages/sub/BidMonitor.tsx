import { useState } from 'react';
import { Radio, Flag, PauseCircle, Users, TrendingUp, Timer } from 'lucide-react';
import { useApp } from '../../store';
import { useGate, ScopeBadge, LockedPanel } from '../../components/gate';
import { SectionTitle, Card, Badge, Btn, Empty, LotImage } from '../../components/ui';
import { inr, inrCompact, timeLeft, clockTime, cx } from '../../utils';

/** Read-only live-auction watch with flag → approval routing (WBS v3.1 F46). */
export default function BidMonitor() {
  const { auctions, lots, bids, now, role, approvals, requestApproval, pauseAuction } = useApp();
  const gate = useGate('monitor');
  const [sel, setSel] = useState<string | null>(null);

  if (gate.scopedRole && !gate.canView) return <LockedPanel label="Bid Monitor" />;

  const watch = auctions.filter((a) => a.status === 'live' || a.status === 'paused');
  const active = watch.find((a) => a.id === (sel ?? watch[0]?.id));
  const feed = active ? bids.filter((b) => b.auctionId === active.id).slice(-9).reverse() : [];
  const superAdmin = role === 'superadmin';

  const hasPending = (type: 'bid_flag' | 'auction_pause', refId: string) =>
    approvals.some((x) => x.status === 'pending' && x.type === type && x.refId === refId);

  return (
    <div>
      <SectionTitle
        title="Bid Monitor" sub="Watch live ladders and flag suspicious bidding — flags route through approvals"
        right={<ScopeBadge module="monitor" />}
      />
      {watch.length === 0 && <Empty title="No live auctions to watch" sub="Live and paused auctions appear here in real time." />}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          {watch.map((a) => {
            const lot = lots.find((l) => l.id === a.lotId)!;
            return (
              <Card key={a.id} onClick={() => setSel(a.id)}
                className={cx('flex items-center gap-3 p-3', active?.id === a.id && 'ring-2 ring-ember-500/60')}>
                <LotImage hues={lot.imageHues} className="h-11 w-14 rounded-lg shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold text-faint">{a.id}</div>
                  <div className="truncate text-xs font-bold text-ink">{lot.title}</div>
                  <div className="text-[11px] text-faint">{inrCompact(a.currentBid)} · {a.bidderCount} bidders</div>
                </div>
                {a.status === 'paused'
                  ? <Badge tone="bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-400/25"><PauseCircle size={11} /> Paused</Badge>
                  : <Badge tone="tone-ember"><Radio size={11} /> {timeLeft(a.endsAt, now)}</Badge>}
              </Card>
            );
          })}
        </div>

        {active && (() => {
          const lot = lots.find((l) => l.id === active.lotId)!;
          return (
            <Card className="p-5">
              <div className="flex flex-wrap items-center gap-4">
                <LotImage hues={lot.imageHues} label={lot.metal} className="h-14 w-20 rounded-lg shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-faint">{active.id} · {lot.id} · {lot.location}</div>
                  <div className="text-sm font-bold text-ink">{lot.title}</div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-faint">
                    <span className="flex items-center gap-1"><TrendingUp size={12} /> {inr(active.currentBid)}</span>
                    <span className="flex items-center gap-1"><Users size={12} /> {active.bidderCount} bidders</span>
                    <span className="flex items-center gap-1"><Timer size={12} /> {active.extensions} auto-extensions</span>
                  </div>
                </div>
                {active.status === 'live' && (
                  superAdmin ? (
                    <Btn size="sm" variant="outline" onClick={() => pauseAuction(active.id, 'Paused from Bid Monitor for review')}>
                      <PauseCircle size={13} /> Pause now
                    </Btn>
                  ) : hasPending('auction_pause', active.id) ? (
                    <Btn size="sm" variant="outline" disabled>Pause requested…</Btn>
                  ) : (
                    <Btn size="sm" variant="outline" onClick={() => requestApproval({
                      type: 'auction_pause',
                      title: `Pause request — ${active.id}`,
                      detail: `Sub-Admin requests a pause on ${lot.title} pending a bidding-pattern review.`,
                      refId: active.id,
                    })}>
                      <PauseCircle size={13} /> Request pause
                    </Btn>
                  )
                )}
              </div>

              {active.pauseReason && (
                <div className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-400/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 ring-1 ring-amber-200 dark:ring-amber-400/25">
                  <b>Paused:</b> {active.pauseReason}
                </div>
              )}

              <h4 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-faint">Live bid ladder (latest first)</h4>
              <div className="space-y-1.5">
                {feed.length === 0 && <div className="py-6 text-center text-xs text-faint">No bids yet on this auction.</div>}
                {feed.map((b, i) => {
                  const flagged = hasPending('bid_flag', b.id);
                  return (
                    <div key={b.id} className={cx('flex items-center gap-3 rounded-xl border px-3.5 py-2.5', i === 0 ? 'border-ember-200 dark:border-ember-400/25 bg-ember-50/50 dark:bg-ember-400/10' : 'border-line bg-surface')}>
                      <span className="w-14 shrink-0 text-[11px] font-semibold text-faint">{clockTime(b.at)}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                        {b.bidderName} {b.auto && <Badge tone="bg-surface-3 text-muted ring-line-strong" className="ml-1">auto</Badge>}
                      </span>
                      <span className="text-sm font-extrabold text-ink">{inr(b.amount)}</span>
                      {i === 0 && <Badge tone="tone-ember">Highest</Badge>}
                      {flagged ? (
                        <Badge tone="bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-400/25"><Flag size={10} /> Flagged</Badge>
                      ) : (
                        <button
                          title={superAdmin ? 'Flag & send to approvals' : 'Flag as suspicious — raises a void request for approval'}
                          onClick={() => requestApproval({
                            type: 'bid_flag',
                            title: `Suspicious bid — ${b.bidderName} on ${active.id}`,
                            detail: `Bid of ${inr(b.amount)} at ${clockTime(b.at)} looks anomalous (pattern flag). Approving voids the bid and recalculates the ladder.`,
                            refId: b.id,
                          })}
                          className="rounded-lg p-1.5 text-faint hover:bg-amber-50 dark:hover:bg-amber-400/10 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer"
                        >
                          <Flag size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-faint">
                Flagging a bid creates an approval request — an Executive/Super Admin decision voids the bid and recalculates the highest. Nothing changes until it's approved.
              </p>
            </Card>
          );
        })()}
      </div>
    </div>
  );
}
