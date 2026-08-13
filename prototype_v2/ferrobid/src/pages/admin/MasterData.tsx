/* ---------------------------------------------------------------------------
   Super Admin — Master data.

   The controlled vocabularies every catalogue is built from. This screen used
   to be a picture of them: "Add category" raised a toast and nothing existed
   afterwards. It now writes to the registries the rest of the product reads, so
   a category, unit or yard added here is a real option from that moment on, and
   every change is recorded in Change history.

   Retiring is the counterpart to adding, and it is guarded: a vocabulary entry
   that is on a catalogued lot or an open catalogue cannot be retired, because
   retiring it would leave those records pointing at nothing. Existing lots keep
   whatever they were built with either way — a retired entry stops being
   offered, it is never removed from history.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, Field, Input, Modal, PageHeader, Tabs, Textarea, cx } from '../../components/ui'
import { categoryImageUrl } from '../../data/categoryImages'
import { useStore } from '../../store/store'
import type { MasterYard, TermsSet } from '../../types'

type TabKey = 'categories' | 'uoms' | 'yards' | 'terms'

const blankYard = { id: '', name: '', region: '', address: '', contactName: '', contactPhone: '' }

export default function MasterData() {
  const role = useStore((s) => s.role)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const termsSets = useStore((s) => s.termsSets)
  const categories = useStore((s) => s.masterCategories)
  const uoms = useStore((s) => s.masterUoms)
  const yards = useStore((s) => s.masterYards)
  const addMasterCategory = useStore((s) => s.addMasterCategory)
  const addMasterUom = useStore((s) => s.addMasterUom)
  const upsertMasterYard = useStore((s) => s.upsertMasterYard)
  const setMasterActive = useStore((s) => s.setMasterActive)
  const renameMasterEntry = useStore((s) => s.renameMasterEntry)
  const addTermsVersion = useStore((s) => s.addTermsVersion)
  const pushToast = useStore((s) => s.pushToast)

  const [tab, setTab] = useState<TabKey>('categories')
  const [addOpen, setAddOpen] = useState<null | 'category' | 'uom'>(null)
  const [addName, setAddName] = useState('')
  const [newUom, setNewUom] = useState({ code: '', label: '', precision: '' })
  const [yardDraft, setYardDraft] = useState<typeof blankYard | null>(null)
  const [renaming, setRenaming] = useState<{ kind: 'category' | 'uom'; id: string; label: string } | null>(null)
  const [viewTerms, setViewTerms] = useState<TermsSet | null>(null)
  const [versioning, setVersioning] = useState<TermsSet | null>(null)
  const [versionNote, setVersionNote] = useState('')

  const canEdit = role === 'super_admin'
  const th = 'text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-line'

  const say = (r: { ok: boolean; error?: string }, title: string, body?: string) => {
    if (!r.ok) pushToast({ kind: 'danger', title: 'Not changed', body: r.error })
    else pushToast({ kind: 'success', title, body })
    return r.ok
  }

  return (
    <Page>
      <PageHeader
        title="Master data"
        sub={canEdit
          ? 'The controlled vocabularies every catalogue is built from. Anything added here is a real option in the catalogue builder from this moment on.'
          : 'The controlled vocabularies every catalogue is built from. Read-only for this role — Super Admin edits them.'}
      />
      <Tabs<TabKey> value={tab} onChange={setTab} tabs={[
        { key: 'categories', label: 'Metal categories', count: categories.length },
        { key: 'uoms', label: 'Units of measurement', count: uoms.length },
        { key: 'yards', label: 'Yards & regions', count: yards.length },
        { key: 'terms', label: 'T&C sets', count: termsSets.length },
      ]} />

      {/* ----------------------------- categories ----------------------------- */}
      {tab === 'categories' && (
        <div className="card mt-5 overflow-x-auto">
          <div className="px-5 py-3 border-b border-line flex flex-wrap justify-between items-center gap-2">
            <span className="text-sm text-ink-muted">Assets, scrap, flats, longs, melting, coal, chemicals, minerals, ferro alloys.</span>
            {canEdit && <Button size="sm" variant="secondary" onClick={() => { setAddName(''); setAddOpen('category') }}><Plus size={14} /> Add category</Button>}
          </div>
          <table className="w-full text-sm">
            <thead><tr className={th}>
              <th className="px-5 py-2.5">Category</th><th className="px-4 py-2.5">Slug</th>
              <th className="px-4 py-2.5">State</th><th className="px-4 py-2.5 text-right">Catalogued lots</th>
              <th className="px-4 py-2.5 text-right" />
            </tr></thead>
            <tbody className="divide-y divide-line">
              {categories.map((c) => {
                const inUse = lots.filter((l) => l.category === c.key && l.catalogueId).length
                return (
                  <tr key={c.key} className={cx('hover:bg-surface-2/60', !c.active && 'opacity-60')}>
                    <td className="px-5 py-2.5 font-semibold">
                      <span className="flex items-center gap-2.5">
                        <img src={categoryImageUrl(c.key, c.hue)} alt="" loading="lazy" className="size-6 rounded-lg object-cover" />
                        {c.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 num text-ink-muted">{c.key}</td>
                    <td className="px-4 py-2.5">
                      {c.active ? <Chip tone="success">In use</Chip> : <Chip tone="neutral">Retired</Chip>}
                      {!c.builtIn && <Chip tone="steel" className="ml-1.5">added here</Chip>}
                    </td>
                    <td className="px-4 py-2.5 num text-right font-semibold">{inUse}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => setRenaming({ kind: 'category', id: c.key, label: c.label })}>
                            <Pencil size={14} /> Rename
                          </Button>
                          <Button variant="ghost" size="sm"
                            title={c.active && inUse > 0 ? `On ${inUse} catalogued lot(s) — cannot be retired` : undefined}
                            onClick={() => say(setMasterActive('category', c.key, !c.active), c.active ? `${c.label} retired` : `${c.label} back in use`)}>
                            {c.active ? 'Retire' : 'Reinstate'}
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* -------------------------------- uoms -------------------------------- */}
      {tab === 'uoms' && (
        <div className="card mt-5 overflow-x-auto">
          <div className="px-5 py-3 border-b border-line flex flex-wrap justify-between items-center gap-2">
            <span className="text-sm text-ink-muted">A lot is priced per unit, so the unit decides what a bid means. Precision is not cosmetic.</span>
            {canEdit && <Button size="sm" variant="secondary" onClick={() => { setNewUom({ code: '', label: '', precision: '' }); setAddOpen('uom') }}><Plus size={14} /> Add unit</Button>}
          </div>
          <table className="w-full text-sm">
            <thead><tr className={th}>
              <th className="px-5 py-2.5">Code</th><th className="px-4 py-2.5">Unit</th><th className="px-4 py-2.5">Precision</th>
              <th className="px-4 py-2.5">State</th><th className="px-4 py-2.5 text-right">Lots using</th><th className="px-4 py-2.5 text-right" />
            </tr></thead>
            <tbody className="divide-y divide-line">
              {uoms.map((u) => {
                const inUse = lots.filter((l) => l.uom === u.code).length
                return (
                  <tr key={u.code} className={cx('hover:bg-surface-2/60', !u.active && 'opacity-60')}>
                    <td className="px-5 py-2.5 num font-bold">{u.code}</td>
                    <td className="px-4 py-2.5">{u.label}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{u.precision}</td>
                    <td className="px-4 py-2.5">{u.active ? <Chip tone="success">In use</Chip> : <Chip tone="neutral">Retired</Chip>}</td>
                    <td className="px-4 py-2.5 num text-right font-semibold">{inUse}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => setRenaming({ kind: 'uom', id: u.code, label: u.label })}>
                            <Pencil size={14} /> Rename
                          </Button>
                          <Button variant="ghost" size="sm"
                            onClick={() => say(setMasterActive('uom', u.code, !u.active), u.active ? `${u.code} retired` : `${u.code} back in use`)}>
                            {u.active ? 'Retire' : 'Reinstate'}
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* -------------------------------- yards -------------------------------- */}
      {tab === 'yards' && (
        <div className="mt-5">
          {canEdit && (
            <div className="flex justify-end mb-3">
              <Button size="sm" variant="secondary" onClick={() => setYardDraft({ ...blankYard })}><Plus size={14} /> Add yard</Button>
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-3">
            {yards.map((y) => {
              const open = catalogues.filter((c) => c.yardName === y.name && c.status !== 'closed').length
              return (
                <div key={y.id} className={cx('card p-4', !y.active && 'opacity-60')}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-bold">{y.name}</span>
                    <div className="flex items-center gap-1.5">
                      <Chip tone="steel">{y.region}</Chip>
                      {!y.active && <Chip tone="neutral">Retired</Chip>}
                    </div>
                  </div>
                  <p className="text-sm text-ink-muted mt-1">{y.address}</p>
                  <p className="text-xs text-ink-faint mt-2">
                    Inspection contact: {y.contactName} · <span className="num">{y.contactPhone}</span>
                    {open > 0 && <> · <span className="num font-semibold text-ink-muted">{open}</span> open catalogue{open === 1 ? '' : 's'}</>}
                  </p>
                  {canEdit && (
                    <div className="flex gap-2 mt-3 pt-2.5 border-t border-line">
                      <Button variant="ghost" size="sm" onClick={() => setYardDraft({ ...y })}><Pencil size={14} /> Edit</Button>
                      <Button variant="ghost" size="sm" className="ml-auto"
                        onClick={() => say(setMasterActive('yard', y.id, !y.active), y.active ? `${y.name} retired` : `${y.name} back in use`)}>
                        {y.active ? 'Retire' : 'Reinstate'}
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* -------------------------------- terms -------------------------------- */}
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
                {canEdit && (
                  <Button size="sm" variant="ghost" onClick={() => { setVersioning(t); setVersionNote('') }}>New version</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card border-l-4 border-l-steel p-4 mt-8 text-[13px] text-ink-muted">
        <strong className="text-ink">Retiring is not deleting.</strong> A category, unit or yard that is on a catalogued lot or an open
        catalogue cannot be retired at all, and one that is retired stays on every record that already used it — it simply stops being
        offered to the next catalogue. A new terms version never changes the terms a buyer already accepted: a published auction keeps
        the version it was listed under. Every change here appears in{' '}
        <Link to="/admin/change-history" className="text-ember font-semibold hover:underline">Change history</Link>.
      </div>

      {/* ------------------------------ add category ------------------------------ */}
      <Modal open={addOpen === 'category'} onClose={() => setAddOpen(null)} title="Add metal category">
        <Field label="Category name">
          <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="e.g. Refractories" />
        </Field>
        <Button className="w-full mt-4" disabled={!addName.trim()}
          onClick={() => { if (say(addMasterCategory(addName), `${addName.trim()} added`, 'Available to the catalogue builder now.')) { setAddName(''); setAddOpen(null) } }}>
          Add category
        </Button>
      </Modal>

      {/* -------------------------------- add uom -------------------------------- */}
      <Modal open={addOpen === 'uom'} onClose={() => setAddOpen(null)} title="Add unit of measurement">
        <div className="space-y-4">
          <Field label="Code"><Input className="num" value={newUom.code} onChange={(e) => setNewUom({ ...newUom, code: e.target.value.toUpperCase() })} placeholder="e.g. BDL" /></Field>
          <Field label="Unit"><Input value={newUom.label} onChange={(e) => setNewUom({ ...newUom, label: e.target.value })} placeholder="Bundle" /></Field>
          <Field label="Precision" hint="What a bid on this unit may be quoted to.">
            <Input value={newUom.precision} onChange={(e) => setNewUom({ ...newUom, precision: e.target.value })} placeholder="Whole numbers" />
          </Field>
          <Button className="w-full" disabled={!newUom.code.trim() || !newUom.label.trim()}
            onClick={() => { if (say(addMasterUom(newUom.code, newUom.label, newUom.precision), `${newUom.code.trim().toUpperCase()} added`)) setAddOpen(null) }}>
            Add unit
          </Button>
        </div>
      </Modal>

      {/* -------------------------------- yard form -------------------------------- */}
      <Modal open={!!yardDraft} onClose={() => setYardDraft(null)} title={yardDraft?.id ? `Edit ${yardDraft.name}` : 'Add yard'}>
        {yardDraft && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Yard name"><Input value={yardDraft.name} onChange={(e) => setYardDraft({ ...yardDraft, name: e.target.value })} placeholder="e.g. Dolvi Works Yard A" /></Field>
              <Field label="Region"><Input value={yardDraft.region} onChange={(e) => setYardDraft({ ...yardDraft, region: e.target.value })} placeholder="Raigad, MH" /></Field>
            </div>
            <Field label="Address"><Textarea value={yardDraft.address} onChange={(e) => setYardDraft({ ...yardDraft, address: e.target.value })} placeholder="Gate 3, Dolvi Works, Pen–Alibag Road…" /></Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Inspection contact"><Input value={yardDraft.contactName} onChange={(e) => setYardDraft({ ...yardDraft, contactName: e.target.value })} placeholder="Name" /></Field>
              <Field label="Phone"><Input className="num" value={yardDraft.contactPhone} onChange={(e) => setYardDraft({ ...yardDraft, contactPhone: e.target.value })} placeholder="+91 98200 00000" /></Field>
            </div>
            <Button className="w-full" disabled={!yardDraft.name.trim()}
              onClick={() => {
                const payload = { ...yardDraft, id: yardDraft.id || undefined } as Omit<MasterYard, 'builtIn' | 'active'> & { id?: string }
                if (say(upsertMasterYard(payload), yardDraft.id ? 'Yard updated' : `${yardDraft.name.trim()} added`)) setYardDraft(null)
              }}>
              {yardDraft.id ? 'Save yard' : 'Add yard'}
            </Button>
          </div>
        )}
      </Modal>

      {/* ------------------------------ terms viewer ------------------------------ */}
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

      {/* -------------------------------- rename -------------------------------- */}
      <Modal open={!!renaming} onClose={() => setRenaming(null)} title={renaming?.kind === 'category' ? 'Rename category' : 'Rename unit'}>
        {renaming && (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">
              This changes what people read. The {renaming.kind === 'category' ? 'slug' : 'code'}{' '}
              <span className="num font-bold text-ink">{renaming.id}</span> does not move, so every lot, catalogue and report already
              using it keeps resolving.
            </p>
            <Field label="Name">
              <Input value={renaming.label} onChange={(e) => setRenaming({ ...renaming, label: e.target.value })} />
            </Field>
            <Button className="w-full" disabled={!renaming.label.trim()}
              onClick={() => { if (say(renameMasterEntry(renaming.kind, renaming.id, renaming.label), 'Renamed')) setRenaming(null) }}>
              Save name
            </Button>
          </div>
        )}
      </Modal>

      {/* ------------------------------ new version ------------------------------ */}
      <Modal open={!!versioning} onClose={() => setVersioning(null)} title={versioning ? `New version of ${versioning.name}` : ''}>
        {versioning && (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">
              {versioning.version} becomes the next minor version. Auctions already published keep the version their buyers accepted —
              this applies to catalogues built from now on.
            </p>
            <Field label="What changed" hint="A buyer may ask months later why their terms differ. This is the answer.">
              <Textarea value={versionNote} onChange={(e) => setVersionNote(e.target.value)} placeholder="Ground rent now starts on the eighth day rather than the fourth…" />
            </Field>
            <Button className="w-full" disabled={versionNote.trim().length < 4}
              onClick={() => { if (say(addTermsVersion(versioning.id, versionNote), 'New terms version drafted')) setVersioning(null) }}>
              Create version
            </Button>
          </div>
        )}
      </Modal>
    </Page>
  )
}
