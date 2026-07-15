import { Search, SlidersHorizontal } from 'lucide-react';
import type { Auction, Lot } from '../types';
import { Toggle } from './ui';
import { cx } from '../utils';

export interface LotFilters {
  q: string;
  metal: string;
  grade: string;
  location: string;
  minQty: string;
  maxQty: string;
  minPrice: string;
  maxPrice: string;
  verifiedOnly: boolean;
  sort: 'closing' | 'price';
}

export const DEFAULT_LOT_FILTERS: LotFilters = {
  q: '', metal: 'All', grade: 'All', location: 'All',
  minQty: '', maxQty: '', minPrice: '', maxPrice: '',
  verifiedOnly: false, sort: 'closing',
};

/** Best-effort numeric read off a free-text quantity string like "25 MT" or "3.2 MT". */
const qtyNumber = (q: string) => parseFloat(q.replace(/,/g, '')) || 0;

export function applyLotFilters<T extends { lot: Lot; auction?: Auction }>(rows: T[], f: LotFilters): T[] {
  return rows
    .filter(({ lot }) => f.metal === 'All' || lot.metal === f.metal)
    .filter(({ lot }) => f.grade === 'All' || lot.grade === f.grade)
    .filter(({ lot }) => f.location === 'All' || lot.location === f.location)
    .filter(({ lot }) => !f.q || (lot.title + lot.id + lot.location + lot.grade + lot.quantity).toLowerCase().includes(f.q.toLowerCase()))
    .filter(({ lot }) => !f.minQty || qtyNumber(lot.quantity) >= Number(f.minQty))
    .filter(({ lot }) => !f.maxQty || qtyNumber(lot.quantity) <= Number(f.maxQty))
    .filter(({ lot }) => !f.minPrice || lot.basePrice >= Number(f.minPrice))
    .filter(({ lot }) => !f.maxPrice || lot.basePrice <= Number(f.maxPrice))
    .filter(({ lot }) => !f.verifiedOnly || lot.verification?.managerDecision === 'approved')
    .sort((x, y) => {
      if (f.sort === 'price') return x.lot.basePrice - y.lot.basePrice;
      const ax = x.auction?.endsAt ?? Infinity;
      const ay = y.auction?.endsAt ?? Infinity;
      return ax - ay;
    });
}

export function FilterBar({ lots, filters, onChange }: { lots: Lot[]; filters: LotFilters; onChange: (f: LotFilters) => void }) {
  const metals = ['All', ...Array.from(new Set(lots.map((l) => l.metal)))];
  const grades = ['All', ...Array.from(new Set(lots.map((l) => l.grade)))];
  const locations = ['All', ...Array.from(new Set(lots.map((l) => l.location)))];
  const set = (patch: Partial<LotFilters>) => onChange({ ...filters, ...patch });
  const selectCls = 'rounded-xl border border-line-strong bg-surface px-3 py-2 text-xs font-medium cursor-pointer';
  const numCls = 'w-20 rounded-xl border border-line-strong bg-surface px-2.5 py-2 text-xs';

  return (
    <div className="sticky top-0 z-10 -mx-1 mb-4 rounded-2xl bg-canvas/90 px-1 py-2 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-52">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={filters.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search lots, grades, locations…" className="w-full rounded-xl border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm focus:border-steel-500 focus:outline-none focus:ring-2 focus:ring-steel-500/25" />
        </div>
        <select value={filters.metal} onChange={(e) => set({ metal: e.target.value })} className={selectCls}>
          {metals.map((m) => <option key={m}>{m}</option>)}
        </select>
        <select value={filters.grade} onChange={(e) => set({ grade: e.target.value })} className={selectCls}>
          {grades.map((g) => <option key={g}>{g}</option>)}
        </select>
        <select value={filters.location} onChange={(e) => set({ location: e.target.value })} className={selectCls}>
          {locations.map((l) => <option key={l}>{l}</option>)}
        </select>
        <select value={filters.sort} onChange={(e) => set({ sort: e.target.value as LotFilters['sort'] })} className={selectCls}>
          <option value="closing">Closing soonest</option>
          <option value="price">Base price</option>
        </select>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted">
        <span className="flex items-center gap-1 font-bold uppercase tracking-wide text-faint"><SlidersHorizontal size={11} /> Filters</span>
        <span className="flex items-center gap-1.5">
          Qty <input value={filters.minQty} onChange={(e) => set({ minQty: e.target.value.replace(/[^\d.]/g, '') })} placeholder="Min" className={numCls} />
          – <input value={filters.maxQty} onChange={(e) => set({ maxQty: e.target.value.replace(/[^\d.]/g, '') })} placeholder="Max" className={numCls} />
        </span>
        <span className="flex items-center gap-1.5">
          Price ₹ <input value={filters.minPrice} onChange={(e) => set({ minPrice: e.target.value.replace(/[^\d]/g, '') })} placeholder="Min" className={numCls} />
          – <input value={filters.maxPrice} onChange={(e) => set({ maxPrice: e.target.value.replace(/[^\d]/g, '') })} placeholder="Max" className={numCls} />
        </span>
        <label className={cx('flex items-center gap-2 rounded-xl border border-line-strong px-2.5 py-1.5', filters.verifiedOnly && 'bg-emerald-50/60 dark:bg-emerald-400/10 border-emerald-200 dark:border-emerald-400/25')}>
          <Toggle on={filters.verifiedOnly} onChange={() => set({ verifiedOnly: !filters.verifiedOnly })} />
          Verified only
        </label>
      </div>
    </div>
  );
}
