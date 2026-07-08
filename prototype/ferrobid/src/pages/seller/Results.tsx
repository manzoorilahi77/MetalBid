import { Download, TrendingUp, Trophy } from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Card, Badge, Btn, Empty, Stat, LotImage } from '../../components/ui';
import { inr, inrCompact } from '../../utils';

const SELLER_ID = 'u-seller1';

export default function Results() {
  const { lots, auctions, bids, pushToast } = useApp();
  const rows = lots
    .filter((l) => l.sellerId === SELLER_ID && l.auctionId)
    .map((l) => ({ lot: l, a: auctions.find((x) => x.id === l.auctionId)! }))
    .filter(({ a }) => a?.status === 'closed');

  const total = rows.reduce((s, { a }) => s + (a.leaderId ? a.currentBid : 0), 0);
  const avgUplift = rows.length
    ? Math.round(rows.reduce((s, { a }) => s + ((a.currentBid - a.startPrice) / a.startPrice) * 100, 0) / rows.length)
    : 0;

  return (
    <div>
      <SectionTitle title="Results & Reports" sub="Auction outcomes for your lots" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Auctions completed" value={rows.length} icon={<Trophy size={18} />} accent="bg-steel-50 text-steel-700" />
        <Stat label="Total realised" value={inrCompact(total)} icon={<TrendingUp size={18} />} accent="bg-emerald-50 text-emerald-600" />
        <Stat label="Avg. uplift over start" value={`${avgUplift}%`} hint="Competitive bidding premium" icon={<TrendingUp size={18} />} accent="bg-ember-50 text-ember-600" />
      </div>

      {rows.length === 0 && <div className="mt-5"><Empty title="No completed auctions yet" /></div>}

      <div className="mt-5 space-y-3">
        {rows.map(({ lot, a }) => {
          const bidCount = bids.filter((b) => b.auctionId === a.id).length;
          return (
            <Card key={a.id} className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <LotImage hues={lot.imageHues} className="h-14 w-20 rounded-lg shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-slate-400">{lot.id} · {a.id}</div>
                  <div className="truncate text-sm font-bold text-steel-950">{lot.title}</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {a.leaderId
                      ? <Badge tone="bg-emerald-50 text-emerald-700 ring-emerald-200"><Trophy size={11} /> Sold to {a.leaderName}</Badge>
                      : <Badge tone="bg-red-50 text-red-600 ring-red-200">Reserve not met</Badge>}
                    <Badge tone="bg-slate-100 text-slate-500 ring-slate-300">{bidCount || a.bidderCount} bids · {a.bidderCount} bidders</Badge>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Final price</div>
                  <div className="text-lg font-extrabold text-steel-950">{inr(a.currentBid)}</div>
                  <div className="text-[11px] font-semibold text-emerald-600">+{Math.round(((a.currentBid - a.startPrice) / a.startPrice) * 100)}% vs start</div>
                </div>
                <Btn size="sm" variant="outline" onClick={() => pushToast({ title: 'Report downloaded', body: `auction-report-${a.id}.pdf (mock)`, tone: 'success' })}>
                  <Download size={13} /> Report
                </Btn>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
