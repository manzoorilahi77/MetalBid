import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Lock } from 'lucide-react';
import { useApp, eventMeta, catalogueMeta } from '../store';
import { SectionTitle, Tabs, Empty } from '../components/ui';
import { Reveal } from '../components/fx';
import { EventCard } from '../components/EventCard';

export default function Browse() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const { auctionEvents, catalogues, lots, role, now } = useApp();
  const [q, setQ] = useState('');
  const [metal, setMetal] = useState(searchParams.get('metal') ?? 'All');
  const [tab, setTab] = useState(searchParams.get('tab') ?? 'live');

  const metals = ['All', ...Array.from(new Set(lots.map((l) => l.metal)))];

  const eventMetals = (eventId: string) =>
    catalogues.filter((c) => c.eventId === eventId).flatMap((c) => catalogueMeta(lots, c).metals);

  const rows = useMemo(() => {
    return auctionEvents
      .filter((e) => e.status === (tab === 'live' ? 'live' : tab === 'upcoming' ? 'scheduled' : 'closed'))
      .filter((e) => metal === 'All' || eventMetals(e.id).includes(metal))
      .filter((e) => !q || (e.name + (e.location ?? '')).toLowerCase().includes(q.toLowerCase()));
  }, [auctionEvents, catalogues, lots, tab, metal, q]);

  return (
    <div>
      <SectionTitle
        title="Auction Marketplace"
        sub={role === 'guest' ? 'Browsing as guest — register to bid and transact' : 'Discover live and upcoming metal lots'}
      />

      {role === 'guest' && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-ember-200 dark:border-ember-400/25 bg-ember-50 dark:bg-ember-400/10 px-4 py-3">
          <Lock size={16} className="text-ember-600 dark:text-ember-400 shrink-0" />
          <p className="text-sm text-ember-800 dark:text-ember-200 flex-1">You're in <b>read-only guest mode</b>. Register as a Buyer to lock EMD and place bids.</p>
          <button onClick={() => nav('/auth/login')} className="rounded-lg bg-ember-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-ember-500 cursor-pointer whitespace-nowrap">Register now</button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs
          active={tab} onChange={setTab}
          tabs={[
            { key: 'live', label: <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-ember-500 animate-pulse" />Live</span> },
            { key: 'upcoming', label: 'Upcoming' },
            { key: 'closed', label: 'Closed' },
          ]}
        />
        <div className="relative flex-1 min-w-52">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lots, grades, locations…" className="w-full rounded-xl border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm focus:border-steel-500 focus:outline-none focus:ring-2 focus:ring-steel-500/25" />
        </div>
        <select value={metal} onChange={(e) => setMetal(e.target.value)} className="rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm cursor-pointer">
          {metals.map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>

      {rows.length === 0 && <Empty title="No auction events match your filters" sub="Try a different tab, metal type or search term." />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((e, idx) => (
          <Reveal key={e.id} delay={Math.min(idx, 8) * 60}>
            <EventCard event={e} meta={eventMeta(catalogues, e)} now={now} onClick={() => nav(`/events/${e.id}`)} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
