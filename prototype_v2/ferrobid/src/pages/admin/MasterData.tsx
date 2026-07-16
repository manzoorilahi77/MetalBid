/* Super Admin — master data: categories, UOMs, yards, T&C sets. */
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, Field, Input, Modal, PageHeader, Tabs } from '../../components/ui'
import { CATEGORY_META } from '../../components/domain'
import { useStore } from '../../store/store'
import type { TermsSet } from '../../types'

type TabKey = 'categories' | 'uoms' | 'yards' | 'terms'

const UOMS = [
  { code: 'MT', label: 'Metric tonne', decimals: 'Up to 3 decimals' },
  { code: 'KG', label: 'Kilogram', decimals: 'Whole numbers' },
  { code: 'PCS', label: 'Pieces / numbers', decimals: 'Whole numbers' },
  { code: 'LOT', label: 'Composite lot (one price)', decimals: 'Not applicable' },
]

export default function MasterData() {
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const termsSets = useStore((s) => s.termsSets)
  const pushToast = useStore((s) => s.pushToast)

  const [tab, setTab] = useState<TabKey>('categories')
  const [addOpen, setAddOpen] = useState<null | 'category' | 'yard'>(null)
  const [addName, setAddName] = useState('')
  const [viewTerms, setViewTerms] = useState<TermsSet | null>(null)

  const yards = [...new Map(catalogues.map((c) => [c.yardName, c])).values()]

  const th = 'text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-line'

  return (
    <Page>
      <PageHeader title="Master data" sub="The controlled vocabularies every catalogue is built from." />
      <Tabs<TabKey> value={tab} onChange={setTab} tabs={[
        { key: 'categories', label: 'Metal categories', count: CATEGORY_META.length },
        { key: 'uoms', label: 'Units of measurement', count: UOMS.length },
        { key: 'yards', label: 'Yards & regions', count: yards.length },
        { key: 'terms', label: 'T&C sets', count: termsSets.length },
      ]} />

      {tab === 'categories' && (
        <div className="card mt-5 overflow-x-auto">
          <div className="px-5 py-3 border-b border-line flex justify-between items-center">
            <span className="text-sm text-ink-muted">metaljunction-style taxonomy — assets, scrap, flats, longs, melting, coal, chemicals, minerals, ferro alloys.</span>
            <Button size="sm" variant="secondary" onClick={() => setAddOpen('category')}><Plus size={14} /> Add category</Button>
          </div>
          <table className="w-full text-sm">
            <thead><tr className={th}><th className="px-5 py-2.5">Category</th><th className="px-4 py-2.5">Slug</th><th className="px-4 py-2.5 text-right">Catalogued lots</th></tr></thead>
            <tbody className="divide-y divide-line">
              {CATEGORY_META.map((c) => (
                <tr key={c.key} className="hover:bg-surface-2/60">
                  <td className="px-5 py-2.5 font-semibold flex items-center gap-2.5">
                    <span className="size-6 rounded-lg" style={{ background: `linear-gradient(135deg, hsl(${c.hue} 35% 68%), hsl(${c.hue + 20} 42% 42%))` }} />
                    {c.label}
                  </td>
                  <td className="px-4 py-2.5 num text-ink-muted">{c.key}</td>
                  <td className="px-4 py-2.5 num text-right font-semibold">{lots.filter((l) => l.category === c.key && l.catalogueId).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'uoms' && (
        <div className="card mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className={th}><th className="px-5 py-2.5">Code</th><th className="px-4 py-2.5">Unit</th><th className="px-4 py-2.5">Precision</th><th className="px-4 py-2.5 text-right">Lots using</th></tr></thead>
            <tbody className="divide-y divide-line">
              {UOMS.map((u) => (
                <tr key={u.code} className="hover:bg-surface-2/60">
                  <td className="px-5 py-2.5 num font-bold">{u.code}</td>
                  <td className="px-4 py-2.5">{u.label}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{u.decimals}</td>
                  <td className="px-4 py-2.5 num text-right font-semibold">{lots.filter((l) => l.uom === u.code).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'yards' && (
        <div className="mt-5">
          <div className="flex justify-end mb-3">
            <Button size="sm" variant="secondary" onClick={() => setAddOpen('yard')}><Plus size={14} /> Add yard</Button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {yards.map((c) => (
              <div key={c.yardName} className="card p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">{c.yardName}</span>
                  <Chip tone="steel">{c.region}</Chip>
                </div>
                <p className="text-sm text-ink-muted mt-1">{c.yardAddress}</p>
                <p className="text-xs text-ink-faint mt-2">Contact: {c.inspectionContact.name} · <span className="num">{c.inspectionContact.phone}</span></p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'terms' && (
        <div className="mt-5 grid md:grid-cols-2 gap-3">
          {termsSets.map((t) => (
            <div key={t.id} className="card p-5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold">{t.name}</span>
                <Chip tone="steel" className="num">{t.version}</Chip>
              </div>
              <p className="num text-sm text-ink-muted mt-2">{t.general.length} general · {t.special.length} special clauses</p>
              <div className="flex gap-2 mt-4">
                <Button size="sm" variant="secondary" onClick={() => setViewTerms(t)}>View clauses</Button>
                <Button size="sm" variant="ghost" onClick={() => pushToast({ kind: 'info', title: 'New version drafted (demo)', body: `${t.name} → next minor version` })}>New version</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!addOpen} onClose={() => setAddOpen(null)} title={addOpen === 'category' ? 'Add metal category' : 'Add yard'}>
        <Field label={addOpen === 'category' ? 'Category name' : 'Yard name'}>
          <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder={addOpen === 'category' ? 'e.g. Refractories' : 'e.g. Dolvi Works Yard A'} />
        </Field>
        <Button className="w-full mt-4" disabled={!addName.trim()}
          onClick={() => { pushToast({ kind: 'success', title: `${addName} added (demo)` }); setAddName(''); setAddOpen(null) }}>
          Add
        </Button>
      </Modal>

      <Modal open={!!viewTerms} onClose={() => setViewTerms(null)} title={viewTerms?.name} wide>
        {viewTerms && (
          <div className="space-y-4 text-sm text-ink-muted">
            <div className="font-bold text-ink">General conditions</div>
            <ol className="list-decimal pl-5 space-y-1.5">{viewTerms.general.map((g, i) => <li key={i}>{g}</li>)}</ol>
            <div className="font-bold text-ink">Special conditions</div>
            <ol className="list-decimal pl-5 space-y-1.5">{viewTerms.special.map((g, i) => <li key={i}>{g}</li>)}</ol>
            <p className="text-xs italic">{viewTerms.lotSpecificNote}</p>
          </div>
        )}
      </Modal>
    </Page>
  )
}
