import { Timer, MapPin } from 'lucide-react';
import type { Auction, Lot } from '../types';
import { Card, Badge, StatusBadge, LotImage } from './ui';
import { FlipClock } from './fx';
import { inrCompact, timeLeft, clockTime } from '../utils';

export function LotCard({
  lot, auction, now, onClick,
}: {
  lot: Lot;
  auction?: Auction;
  now: number;
  onClick: () => void;
}) {
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
        </div>
        {auction && (
          <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
            <div>
              <div className="text-[10px] font-bold uppercase text-faint">{auction.status === 'scheduled' ? 'Start price' : auction.status === 'closed' ? 'Final bid' : 'Current bid'}</div>
              <div className="text-lg font-extrabold text-ink">{inrCompact(auction.currentBid)}</div>
            </div>
            {auction.status === 'live' && <Badge tone="bg-ember-50 dark:bg-ember-400/10 text-ember-700 dark:text-ember-300 ring-ember-200 dark:ring-ember-400/25"><Timer size={11} /> <FlipClock text={timeLeft(auction.endsAt, now)} /></Badge>}
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
      </div>
    </Card>
  );
}
