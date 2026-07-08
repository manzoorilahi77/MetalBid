import { Radio, Users, Timer, Eye, Crown } from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Card, Badge, Empty, LotImage } from '../../components/ui';
import { FlipClock } from '../../components/fx';
import { inr, inrCompact, timeLeft, clockTime, cx } from '../../utils';

const SELLER_ID = 'u-seller1';

export default function Monitor() {
  const { lots, auctions, bids, now } = useApp();
  const liveMine = auctions.filter((a) => {
    const lot = lots.find((l) => l.id === a.lotId);
    return a.status === 'live' && lot?.sellerId === SELLER_ID;
  });

  return (
    <div>
      <SectionTitle
        title="Live Monitor" sub="Read-only view of bidding on your lots — sellers cannot bid on their own material"
        right={<Badge tone="bg-slate-100 text-slate-500 ring-slate-300"><Eye size={11} /> Read-only</Badge>}
      />
      {liveMine.length === 0 && <Empty title="None of your lots are live right now" sub="Scheduled lots appear here automatically when their auction opens." />}

      <div className="grid gap-5 lg:grid-cols-2">
        {liveMine.map((a) => {
          const lot = lots.find((l) => l.id === a.lotId)!;
          const ladder = bids.filter((b) => b.auctionId === a.id).sort((x, y) => y.at - x.at).slice(0, 8);
          const pctOverBase = Math.round(((a.currentBid - a.startPrice) / a.startPrice) * 100);
          return (
            <Card key={a.id} className="overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100 p-4">
                <LotImage hues={lot.imageHues} className="h-12 w-16 rounded-lg shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-slate-400">{lot.id}</div>
                  <div className="truncate text-sm font-bold text-steel-950">{lot.title}</div>
                </div>
                <Badge tone="bg-ember-50 text-ember-700 ring-ember-200"><Radio size={11} /> LIVE</Badge>
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-100 text-center">
                <div className="p-3">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Current bid</div>
                  <div className="text-lg font-extrabold text-steel-950">{inrCompact(a.currentBid)}</div>
                  <div className="text-[10px] font-bold text-emerald-600">+{pctOverBase}% over base</div>
                </div>
                <div className="p-3">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Bidders</div>
                  <div className="flex items-center justify-center gap-1 text-lg font-extrabold text-steel-950"><Users size={15} /> {a.bidderCount}</div>
                  <div className="text-[10px] text-slate-400">reserve {a.currentBid >= a.reserve ? 'met ✓' : 'not met'}</div>
                </div>
                <div className="p-3">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Closes in</div>
                  <div className="flex items-center justify-center gap-1 text-lg font-bold text-ember-600"><Timer size={14} /> <FlipClock text={timeLeft(a.endsAt, now)} /></div>
                  {a.extensions > 0 && <div className="text-[10px] font-semibold text-amber-600">extended ×{a.extensions}</div>}
                </div>
              </div>
              <div className="border-t border-slate-100 bg-slate-50/60 p-3">
                <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Bid feed</div>
                <div className="space-y-1">
                  {ladder.map((b, i) => (
                    <div key={b.id} className={cx('flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs ring-1 ring-slate-100', i === 0 && 'animate-bid-flash')}>
                      {i === 0 ? <Crown size={12} className="text-ember-500 shrink-0" /> : <span className="w-3" />}
                      <span className="flex-1 truncate font-semibold text-steel-950">{b.bidderName}</span>
                      <span className="text-slate-400">{clockTime(b.at)}</span>
                      <span className="font-extrabold text-steel-900">{inr(b.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
