import { useState } from 'react';
import { Timer, MapPin, Gavel, Crown, BellRing, ShieldCheck } from 'lucide-react';
import type { Auction, Lot } from '../types';
import { Card, Badge, StatusBadge, LotImage, Btn } from './ui';
import { FlipClock } from './fx';
import { inr, inrCompact, timeLeft, clockTime } from '../utils';

export function LotCard({
  lot, auction, now, onClick, inlineBid, iAmLeading, iHaveBid, onBid,
}: {
  lot: Lot;
  auction?: Auction;
  now: number;
  onClick: () => void;
  /** Bid-room mode: adds a quick-bid widget + leading/outbid position, no click-through required. */
  inlineBid?: boolean;
  iAmLeading?: boolean;
  iHaveBid?: boolean;
  onBid?: (amount: number) => void;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const nextBid = auction ? auction.currentBid + auction.increment : 0;

  return (
    <Card onClick={onClick} className="group overflow-hidden">
      <div className="overflow-hidden">
        <LotImage hues={lot.imageHues} label={lot.metal} className="h-36 w-full transition-transform duration-500 group-hover:scale-[1.05]" />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] font-bold text-faint">{lot.id}</div>
            <div className="text-sm font-bold text-ink leading-snug">{lot.title}</div>
          </div>
          <StatusBadge status={lot.status} />
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-xs text-faint">
          <span>{lot.quantity}</span><span>· {lot.grade}</span>
          <span className="flex items-center gap-0.5"><MapPin size={11} />{lot.location}</span>
          {lot.verification?.managerDecision === 'approved' && <span title="Physically verified"><ShieldCheck size={12} className="text-emerald-500" /></span>}
        </div>
        {auction && (
          <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
            <div>
              <div className="text-[10px] font-bold uppercase text-faint">{auction.status === 'scheduled' ? 'Start price' : auction.status === 'closed' ? 'Final bid' : 'Current bid'}</div>
              <div className="text-lg font-extrabold text-ink">{inrCompact(auction.currentBid)}</div>
            </div>
            {auction.status === 'live' && !inlineBid && <Badge tone="bg-ember-50 dark:bg-ember-400/10 text-ember-700 dark:text-ember-300 ring-ember-200 dark:ring-ember-400/25"><Timer size={11} /> <FlipClock text={timeLeft(auction.endsAt, now)} /></Badge>}
            {auction.status === 'scheduled' && <Badge tone="bg-indigo-50 dark:bg-indigo-400/10 text-indigo-700 dark:text-indigo-300 ring-indigo-200 dark:ring-indigo-400/25">Starts {clockTime(auction.startsAt)}</Badge>}
            {auction.status === 'closed' && auction.leaderName && <Badge tone="bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-400/25">Won · {auction.leaderName.split(' ')[0]}</Badge>}
          </div>
        )}
        {!auction && (
          <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
            <div>
              <div className="text-[10px] font-bold uppercase text-faint">Base price</div>
              <div className="text-lg font-extrabold text-ink">{inrCompact(lot.basePrice)}</div>
            </div>
            <Badge tone="tone-slate">Not scheduled</Badge>
          </div>
        )}

        {inlineBid && auction?.status === 'live' && (
          <div className="mt-3 border-t border-line pt-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-[10px] font-bold text-ember-600 dark:text-ember-400"><Timer size={11} /> <FlipClock text={timeLeft(auction.endsAt, now)} /></span>
              {iAmLeading
                ? <Badge tone="bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-400/25"><Crown size={10} /> Leading</Badge>
                : iHaveBid
                  ? <Badge tone="bg-red-50 dark:bg-red-400/10 text-red-600 dark:text-red-400 ring-red-200 dark:ring-red-400/25"><BellRing size={10} /> Outbid</Badge>
                  : null}
            </div>
            {!customOpen ? (
              <div className="mt-2 flex items-center gap-1.5">
                <Btn size="sm" variant="accent" className="flex-1" onClick={() => onBid?.(nextBid)}>
                  <Gavel size={12} /> Bid {inr(nextBid)}
                </Btn>
                <Btn size="sm" variant="outline" onClick={() => setCustomOpen(true)}>Custom</Btn>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-1.5">
                <input
                  autoFocus value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder={`Min ${inr(nextBid)}`}
                  className="h-8 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-2 text-xs font-bold text-ink focus:outline-none focus:ring-2 focus:ring-steel-500/25"
                />
                <Btn size="sm" variant="accent" disabled={!custom || Number(custom) < nextBid} onClick={() => { onBid?.(Number(custom)); setCustom(''); setCustomOpen(false); }}>Bid</Btn>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
