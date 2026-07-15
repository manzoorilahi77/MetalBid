import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Layers, Timer, MapPin } from 'lucide-react';
import { useApp, eventById, catalogueMeta } from '../store';
import { SectionTitle, Card, Badge, LotImage } from '../components/ui';
import { Reveal, FlipClock } from '../components/fx';
import { dateTime, timeLeft } from '../utils';

export default function AuctionDetail() {
  const { eventId } = useParams();
  const nav = useNavigate();
  const { auctionEvents, catalogues, lots, now } = useApp();
  const event = eventById(auctionEvents, eventId ?? '');

  if (!event) {
    return (
      <div className="text-sm text-muted">
        Auction event not found. <button className="text-steel-700 dark:text-steel-300 font-semibold cursor-pointer" onClick={() => nav('/browse')}>Back to marketplace</button>
      </div>
    );
  }

  const eventCatalogues = catalogues.filter((c) => event.catalogueIds.includes(c.id));

  return (
    <div>
      <button onClick={() => nav('/browse')} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-steel-800 cursor-pointer">
        <ArrowLeft size={15} /> Back to marketplace
      </button>

      <Card className="mb-6 overflow-hidden">
        <LotImage hues={event.coverHues} className="h-40 w-full" />
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              {event.location && <div className="flex items-center gap-1 text-[11px] font-bold text-faint"><MapPin size={11} />{event.location}</div>}
              <h1 className="mt-0.5 text-xl font-extrabold text-ink">{event.name}</h1>
              <div className="mt-1 text-sm text-muted">{dateTime(event.startsAt)} — {dateTime(event.endsAt)}</div>
            </div>
            {event.status === 'live' && (
              <div className="rounded-xl bg-steel-950 px-4 py-2.5 text-center text-white">
                <div className="text-[10px] font-bold uppercase tracking-wider text-steel-300 flex items-center justify-center gap-1"><Timer size={11} /> Closes in</div>
                <FlipClock text={timeLeft(event.endsAt, now)} className="text-lg font-bold text-ember-400" />
              </div>
            )}
            {event.status === 'scheduled' && <Badge tone="bg-indigo-50 dark:bg-indigo-400/10 text-indigo-700 dark:text-indigo-300 ring-indigo-200 dark:ring-indigo-400/25">Scheduled</Badge>}
            {(event.status === 'closed' || event.status === 'cancelled') && <Badge tone="tone-slate">{event.status === 'cancelled' ? 'Cancelled' : 'Closed'}</Badge>}
          </div>
        </div>
      </Card>

      <SectionTitle title="Catalogues in this event" sub={`${eventCatalogues.length} catalogue${eventCatalogues.length === 1 ? '' : 's'} grouping the lots up for auction`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {eventCatalogues.map((c, idx) => {
          const meta = catalogueMeta(lots, c);
          return (
            <Reveal key={c.id} delay={Math.min(idx, 8) * 60}>
              <Card onClick={() => nav(`/events/${event.id}/catalogue/${c.id}`)} className="p-5">
                <div className="text-[11px] font-bold text-faint">{c.id}</div>
                <div className="mt-0.5 text-sm font-bold text-ink leading-snug">{c.title}</div>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted"><Layers size={12} /> {meta.lotCount} lot{meta.lotCount === 1 ? '' : 's'}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {meta.metals.map((m) => <Badge key={m} tone="tone-steel">{m}</Badge>)}
                </div>
                <div className="mt-3 border-t border-line pt-3 text-xs text-faint">
                  {c.status === 'closed' ? 'Closed' : `Closes ${dateTime(c.closingAt)}`}
                </div>
              </Card>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
