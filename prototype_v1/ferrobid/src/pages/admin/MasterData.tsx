import { useState } from 'react';
import { Layers, Boxes, Warehouse, FileBadge2, Plus } from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Card, Badge } from '../../components/ui';
import { GatedBtn, ScopeBadge } from '../../components/gate';

const KINDS = [
  { key: 'metals' as const, label: 'Metal categories', icon: <Layers size={15} />, hint: 'Drive lot classification, EMD % and Sub-Admin scope' },
  { key: 'categories' as const, label: 'Lot categories', icon: <Boxes size={15} />, hint: 'Form of the material being auctioned' },
  { key: 'yards' as const, label: 'Yards & locations', icon: <Warehouse size={15} />, hint: 'Pickup points used by logistics & regional scoping' },
  { key: 'docTypes' as const, label: 'Entity document types', icon: <FileBadge2 size={15} />, hint: 'Required papers in the verification policy' },
];

/** Master data registry — static screens with mock add (WBS v3.1 F48). */
export default function MasterData() {
  const { masterData, addMasterItem } = useApp();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  return (
    <div>
      <SectionTitle
        title="Master Data"
        sub="Platform reference data — categories, yards and document types every other module reads from"
        right={<ScopeBadge module="masterdata" />}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {KINDS.map((k) => {
          const items = masterData[k.key];
          const draft = drafts[k.key] ?? '';
          const add = () => {
            if (!draft.trim()) return;
            addMasterItem(k.key, draft.trim());
            setDrafts((d) => ({ ...d, [k.key]: '' }));
          };
          return (
            <Card key={k.key} className="p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><span className="text-steel-500">{k.icon}</span> {k.label}</h3>
                <Badge tone="bg-surface-3 text-muted ring-line-strong">{items.length}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-faint">{k.hint}</p>
              <div className="mt-3.5 flex flex-wrap gap-1.5">
                {items.map((v) => (
                  <span key={v} className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs font-semibold text-body ring-1 ring-line">{v}</span>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDrafts((d) => ({ ...d, [k.key]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && add()}
                  placeholder={`Add ${k.label.toLowerCase().replace(/s$/, '')}…`}
                  className="flex-1 rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-body placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-steel-500/25"
                />
                <GatedBtn module="masterdata" size="sm" variant="outline" disabled={!draft.trim()} onAllowed={add}><Plus size={13} /> Add</GatedBtn>
              </div>
            </Card>
          );
        })}
      </div>
      <p className="mt-4 text-[11px] text-faint">Prototype note: additions persist in memory for this session (mock save) — production would gate edits behind change approval.</p>
    </div>
  );
}
