import { Timer, MapPin, Layers } from 'lucide-react';
import type { AuctionEvent } from '../types';
import { LotImage, Badge } from './ui';
import { FlipClock } from './fx';
import { timeLeft, clockTime } from '../utils';

export function EventCard({
  event, meta, now, onClick,
}: {
  event: AuctionEvent;
  meta: { catalogueCount: number; lotCount: number };
  now: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="lift group relative w-full overflow-hidden rounded-3xl bg-surface text-left ring-1 ring-line shadow-soft backdrop-blur transition-colors hover:ring-ember-500/40 cursor-pointer"
    >
      <div className="relative overflow-hidden">
        <LotImage hues={event.coverHues} className="h-32 w-full transition-transform duration-500 group-hover:scale-[1.04]" />
        {event.status === 'live' && (
          <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-steel-950/70 px-2.5 py-1 text-[10px] font-bold text-ember-300 ring-1 ring-white/10 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-ember-500 animate-pulse" /> LIVE
          </div>
        )}
      </div>
      <div className="p-5">
        {event.location && (
          <div className="flex items-center gap-1 text-[11px] font-bold text-faint"><MapPin size={11} />{event.location}</div>
        )}
        <div className="mt-1 font-display text-base font-bold leading-snug text-ink">{event.name}</div>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          <Layers size={12} /> {meta.catalogueCount} catalogue{meta.catalogueCount === 1 ? '' : 's'} · {meta.lotCount} lot{meta.lotCount === 1 ? '' : 's'}
        </div>
        <div className="mt-4 flex items-center justify-between">
          {event.status === 'live' && (
            <div className="rounded-xl bg-surface-2 px-3 py-2 text-right ring-1 ring-line">
              <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-faint"><Timer size={10} /> closes in</div>
              <FlipClock text={timeLeft(event.endsAt, now)} className="text-sm font-bold text-ember-600 dark:text-ember-400" />
            </div>
          )}
          {event.status === 'scheduled' && (
            <Badge tone="bg-indigo-50 dark:bg-indigo-400/10 text-indigo-700 dark:text-indigo-300 ring-indigo-200 dark:ring-indigo-400/25">Starts {clockTime(event.startsAt)}</Badge>
          )}
          {(event.status === 'closed' || event.status === 'cancelled') && (
            <Badge tone="tone-slate">{event.status === 'cancelled' ? 'Cancelled' : 'Closed'}</Badge>
          )}
        </div>
      </div>
    </button>
  );
}
