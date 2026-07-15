import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Search } from 'lucide-react';
import { useApp, catalogueById, eventForCatalogue, lotsForCatalogue } from '../store';
import { SectionTitle, Empty } from '../components/ui';
import { Reveal } from '../components/fx';
import { LotCard } from '../components/LotCard';

export default function CatalogueDetail() {
  const { eventId, catalogueId } = useParams();
  const nav = useNavigate();
  const { auctionEvents, catalogues, lots, auctions, now } = useApp();
  const catalogue = catalogueById(catalogues, catalogueId ?? '');
  const event = catalogue ? eventForCatalogue(auctionEvents, catalogue.id) : undefined;

  const [q, setQ] = useState('');
  const [metal, setMetal] = useState('All');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState<'closing' | 'price'>('closing');

  const catalogueLots = catalogue ? lotsForCatalogue(lots, catalogue) : [];
  const metals = ['All', ...Array.from(new Set(catalogueLots.map((l) => l.metal)))];

  const rows = useMemo(() => {
    return catalogueLots
      .map((lot) => ({ lot, auction: auctions.find((a) => a.id === lot.auctionId) }))
      .filter(({ lot }) => metal === 'All' || lot.metal === metal)
      .filter(({ lot }) => !q || (lot.title + lot.id + lot.location + lot.grade + lot.quantity).toLowerCase().includes(q.toLowerCase()))
      .filter(({ lot }) => !minPrice || lot.basePrice >= Number(minPrice))
      .filter(({ lot }) => !maxPrice || lot.basePrice <= Number(maxPrice))
      .sort((x, y) => {
        if (sort === 'price') return x.lot.basePrice - y.lot.basePrice;
        const ax = x.auction?.endsAt ?? Infinity;
        const ay = y.auction?.endsAt ?? Infinity;
        return ax - ay;
      });
  }, [catalogueLots, auctions, metal, q, minPrice, maxPrice, sort]);

  if (!catalogue || !event) {
    return (
      <div className="text-sm text-muted">
        Catalogue not found. <button className="text-steel-700 dark:text-steel-300 font-semibold cursor-pointer" onClick={() => nav('/browse')}>Back to marketplace</button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-faint">
        <button className="hover:text-ink cursor-pointer" onClick={() => nav('/browse')}>Browse</button>
        <ChevronRight size={12} />
        <button className="hover:text-ink cursor-pointer" onClick={() => nav(`/events/${eventId}`)}>{event.name}</button>
        <ChevronRight size={12} />
        <span className="text-muted">{catalogue.title}</span>
      </div>

      <SectionTitle title={catalogue.title} sub={`${catalogueLots.length} lot${catalogueLots.length === 1 ? '' : 's'} in this catalogue`} />

      <div className="sticky top-0 z-10 -mx-1 mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-canvas/90 px-1 py-2 backdrop-blur">
        <div className="relative flex-1 min-w-52">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lots, grades, locations…" className="w-full rounded-xl border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm focus:border-steel-500 focus:outline-none focus:ring-2 focus:ring-steel-500/25" />
        </div>
        <select value={metal} onChange={(e) => setMetal(e.target.value)} className="rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm cursor-pointer">
          {metals.map((m) => <option key={m}>{m}</option>)}
        </select>
        <input value={minPrice} onChange={(e) => setMinPrice(e.target.value.replace(/[^\d]/g, ''))} placeholder="Min ₹" className="w-24 rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm" />
        <input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/[^\d]/g, ''))} placeholder="Max ₹" className="w-24 rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm" />
        <select value={sort} onChange={(e) => setSort(e.target.value as 'closing' | 'price')} className="rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm cursor-pointer">
          <option value="closing">Closing soonest</option>
          <option value="price">Base price</option>
        </select>
      </div>

      {rows.length === 0 && <Empty title="No lots match your filters" sub="Try a different metal, price range or search term." />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ lot, auction }, idx) => (
          <Reveal key={lot.id} delay={Math.min(idx, 8) * 60}>
            <LotCard lot={lot} auction={auction} now={now} onClick={() => nav(`/lot/${lot.id}`)} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
