import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Gavel, Receipt, ArrowRight, Crown } from 'lucide-react';
import { useApp, DEMO_USER_ID } from '../../store';
import { SectionTitle, Card, Badge, Btn, Modal, Empty, LotImage } from '../../components/ui';
import { inr, inrCompact, dateTime } from '../../utils';

export default function MyBids() {
  const nav = useNavigate();
  const { auctions, lots, bids } = useApp();
  const [receipt, setReceipt] = useState<string | null>(null);

  const myAuctionIds = Array.from(new Set(bids.filter((b) => b.bidderId === DEMO_USER_ID).map((b) => b.auctionId)));
  const rows = myAuctionIds
    .map((id) => {
      const a = auctions.find((x) => x.id === id)!;
      const lot = lots.find((l) => l.id === a.lotId)!;
      const mine = bids.filter((b) => b.auctionId === id && b.bidderId === DEMO_USER_ID);
      const myBest = Math.max(...mine.map((b) => b.amount));
      const outcome: 'leading' | 'outbid' | 'won' | 'lost' =
        a.status === 'live' ? (a.leaderId === DEMO_USER_ID ? 'leading' : 'outbid') : a.leaderId === DEMO_USER_ID ? 'won' : 'lost';
      return { a, lot, mine, myBest, outcome };
    })
    .sort((x, y) => (x.a.status === 'live' ? -1 : 1) - (y.a.status === 'live' ? -1 : 1));

  const receiptRow = rows.find((r) => r.a.id === receipt);

  const OUTCOME_META = {
    leading: { badge: <Badge tone="bg-emerald-50 text-emerald-700 ring-emerald-200"><Crown size={11} /> Leading</Badge> },
    outbid: { badge: <Badge tone="bg-red-50 text-red-600 ring-red-200">Outbid</Badge> },
    won: { badge: <Badge tone="bg-emerald-50 text-emerald-700 ring-emerald-200"><Trophy size={11} /> Won</Badge> },
    lost: { badge: <Badge tone="bg-slate-100 text-slate-500 ring-slate-300">Lost · EMD refunded</Badge> },
  } as const;

  return (
    <div>
      <SectionTitle title="My Bids & Results" sub="Every auction you've participated in" />
      {rows.length === 0 && <Empty title="You haven't bid yet" sub="Lock an EMD on a live lot and join the bidding room." />}
      <div className="space-y-3">
        {rows.map(({ a, lot, mine, myBest, outcome }) => (
          <Card key={a.id} className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <LotImage hues={lot.imageHues} className="h-14 w-20 rounded-lg shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-slate-400">{lot.id} · {mine.length} bid{mine.length > 1 ? 's' : ''} placed</div>
                <div className="truncate text-sm font-bold text-steel-950">{lot.title}</div>
                <div className="mt-1">{OUTCOME_META[outcome].badge}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase text-slate-400">My best / current</div>
                <div className="text-sm font-extrabold text-steel-900">{inrCompact(myBest)} <span className="text-slate-300">/</span> {inrCompact(a.currentBid)}</div>
              </div>
              <div className="flex gap-2">
                {a.status === 'live' && <Btn size="sm" variant="accent" onClick={() => nav(`/bid/${a.id}`)}><Gavel size={13} /> Bid room</Btn>}
                {outcome === 'won' && (
                  <>
                    <Btn size="sm" variant="outline" onClick={() => setReceipt(a.id)}><Receipt size={13} /> Receipt</Btn>
                    <Btn size="sm" variant="primary" onClick={() => nav('/buyer/fulfilment')}>Track <ArrowRight size={13} /></Btn>
                  </>
                )}
              </div>
            </div>
            {/* bid history strip */}
            <div className="mt-3 flex gap-2 overflow-x-auto thin-scroll border-t border-slate-100 pt-3">
              {mine.slice().reverse().map((b) => (
                <div key={b.id} className="shrink-0 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] ring-1 ring-slate-200">
                  <span className="font-bold text-steel-900">{inrCompact(b.amount)}</span>
                  <span className="ml-1.5 text-slate-400">{dateTime(b.at)}{b.auto ? ' · auto' : ''}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Modal open={!!receiptRow} onClose={() => setReceipt(null)} title="Auction receipt (mock)">
        {receiptRow && (
          <div>
            <div className="rounded-2xl border border-dashed border-slate-300 p-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="text-lg font-extrabold text-steel-950">ferro<span className="text-ember-500">Bid</span></div>
                <Badge tone="bg-emerald-50 text-emerald-700 ring-emerald-200">WINNER</Badge>
              </div>
              {[
                ['Lot', `${receiptRow.lot.id} — ${receiptRow.lot.title}`],
                ['Auction', receiptRow.a.id],
                ['Winning bid', inr(receiptRow.a.currentBid)],
                ['EMD adjusted', inr(receiptRow.a.emd)],
                ['Balance payable', inr(receiptRow.a.currentBid - receiptRow.a.emd)],
                ['Winner', 'Arjun Mehta (u-buyer1)'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-slate-50 py-2 text-sm">
                  <span className="text-slate-400">{k}</span><span className="font-semibold text-steel-950 text-right">{v}</span>
                </div>
              ))}
              <p className="pt-3 text-[10px] text-slate-400">This is a simulated receipt generated by the ferroBid prototype.</p>
            </div>
            <Btn variant="outline" className="mt-4 w-full" onClick={() => useApp.getState().pushToast({ title: 'Receipt downloaded', body: 'receipt-' + receiptRow.a.id + '.pdf (mock)', tone: 'success' })}>
              <Receipt size={14} /> Download PDF
            </Btn>
          </div>
        )}
      </Modal>
    </div>
  );
}
