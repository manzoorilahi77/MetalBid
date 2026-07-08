import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Timer, MapPin, Lock } from 'lucide-react';
import { useApp } from '../store';
import { SectionTitle, Card, Badge, LotImage, Tabs, Empty, StatusBadge } from '../components/ui';
import { Reveal, FlipClock } from '../components/fx';
import { inrCompact, timeLeft, clockTime } from '../utils';

export default function Browse() {
  const nav = useNavigate();
  const { lots, auctions, role, now } = useApp();
  const [q, setQ] = useState('');
  const [metal, setMetal] = useState('All');
  const [tab, setTab] = useState('live');

  const metals = ['All', ...Array.from(new Set(lots.map((l) => l.metal)))];

  const rows = useMemo(() => {
    return auctions
      .map((a) => ({ a, lot: lots.find((l) => l.id === a.lotId)! }))
      .filter(({ a, lot }) => lot && a.status === (tab === 'live' ? 'live' : tab === 'upcoming' ? 'scheduled' : 'closed'))
      .filter(({ lot }) => metal === 'All' || lot.metal === metal)
      .filter(({ lot }) => !q || (lot.title + lot.id + lot.location + lot.grade).toLowerCase().includes(q.toLowerCase()));
  }, [auctions, lots, tab, metal, q]);

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

      {rows.length === 0 && <Empty title="No lots match your filters" sub="Try a different tab, metal type or search term." />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ a, lot }, idx) => (
          <Reveal key={a.id} delay={Math.min(idx, 8) * 60}>
          <Card onClick={() => nav(`/lot/${lot.id}`)} className="group overflow-hidden">
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
              <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
                <div>
                  <div className="text-[10px] font-bold uppercase text-faint">{a.status === 'scheduled' ? 'Start price' : a.status === 'closed' ? 'Final bid' : 'Current bid'}</div>
                  <div className="text-lg font-extrabold text-ink">{inrCompact(a.currentBid)}</div>
                </div>
                {a.status === 'live' && <Badge tone="bg-ember-50 dark:bg-ember-400/10 text-ember-700 dark:text-ember-300 ring-ember-200 dark:ring-ember-400/25"><Timer size={11} /> <FlipClock text={timeLeft(a.endsAt, now)} /></Badge>}
                {a.status === 'scheduled' && <Badge tone="bg-indigo-50 dark:bg-indigo-400/10 text-indigo-700 dark:text-indigo-300 ring-indigo-200 dark:ring-indigo-400/25">Starts {clockTime(a.startsAt)}</Badge>}
                {a.status === 'closed' && a.leaderName && <Badge tone="bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-400/25">Won · {a.leaderName.split(' ')[0]}</Badge>}
              </div>
            </div>
          </Card>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
