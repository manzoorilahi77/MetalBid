/* ---------------------------------------------------------------------------
   Application layer — the Super Admin master-data catalogue (metal
   categories, units of measurement, yards, terms versions). Moved verbatim
   from superAdminSlice.ts; no rule, threshold, or wording changed.

   Every one of these already goes through the structural-change
   snapshot/undo system (`helpers.structureSnapshot()` /
   `helpers.recordStructural()`), the same mechanism phase 14's
   publishContent/returnContent used — that stays an adapter-side call here
   too, exactly as it did there, since it captures live state immediately
   before the mutation and a pure function has no state to capture.

   Role permission is likewise computed once by the adapter via the existing
   `helpers.requireSuperAdmin()` and passed in as `permissionError`, rather
   than re-implemented here — avoids a second copy of that check drifting
   from the original.
--------------------------------------------------------------------------- */
import { uid } from '../lib/format'
import { hash, slugKey } from '../store/constants'
import type { Catalogue, Lot, MasterCategory, MasterUom, MasterYard, StructuralChangeKind, TermsSet } from '../types'

export type PermissionError = { ok: false; error: string } | null
type Result<T> = { ok: true; plan: T } | { ok: false; error: string }

export interface StructuralPlan {
  kind: StructuralChangeKind
  target: string
  summary: string
  before: string | null
  after: string | null
}

/* ------------------------------ addMasterCategory ------------------------------ */

export interface AddMasterCategoryPlan {
  record: MasterCategory
  structural: StructuralPlan
  audit: { action: string; target: string; detail: string; severity: 'warning' }
}

export function planAddMasterCategory(label: string, ctx: { permissionError: PermissionError; categories: MasterCategory[] }): Result<AddMasterCategoryPlan> {
  if (ctx.permissionError) return ctx.permissionError
  const name = label.trim()
  if (!name) return { ok: false, error: 'A category needs a name' }
  const key = slugKey(name)
  if (ctx.categories.some((c) => c.key === key)) return { ok: false, error: `${name} already exists` }
  const record: MasterCategory = { key, label: name, hue: hash(key) % 360, builtIn: false, active: true }
  return {
    ok: true,
    plan: {
      record,
      structural: { kind: 'master.add', target: `Category · ${name}`, summary: 'Added to the metal taxonomy. Available to the catalogue builder from now on.', before: null, after: name },
      audit: { action: 'master.add', target: name, detail: 'Metal category added', severity: 'warning' },
    },
  }
}

/* ------------------------------ addMasterUom ------------------------------ */

export interface AddMasterUomPlan {
  record: MasterUom
  structural: StructuralPlan
  audit: { action: string; target: string; detail: string; severity: 'warning' }
}

export function planAddMasterUom(code: string, label: string, precision: string, ctx: { permissionError: PermissionError; uoms: MasterUom[] }): Result<AddMasterUomPlan> {
  if (ctx.permissionError) return ctx.permissionError
  const c = code.trim().toUpperCase()
  if (!c || !label.trim()) return { ok: false, error: 'A unit needs a code and a name' }
  if (ctx.uoms.some((u) => u.code === c)) return { ok: false, error: `${c} already exists` }
  const record: MasterUom = { code: c, label: label.trim(), precision: precision.trim() || 'Whole numbers', builtIn: false, active: true }
  return {
    ok: true,
    plan: {
      record,
      structural: { kind: 'master.add', target: `Unit · ${c}`, summary: `${label.trim()} — ${precision.trim() || 'Whole numbers'}`, before: null, after: c },
      audit: { action: 'master.add', target: c, detail: 'Unit of measurement added', severity: 'warning' },
    },
  }
}

/* ------------------------------ upsertMasterYard ------------------------------ */

export interface UpsertMasterYardPlan {
  mode: 'edit' | 'add'
  record: MasterYard
  structural: StructuralPlan
  audit: { action: string; target: string; detail: string; severity: 'info' | 'warning' }
}

export function planUpsertMasterYard(yard: Partial<MasterYard> & { name: string; region: string; address: string; contactName: string; contactPhone: string }, ctx: { permissionError: PermissionError; existing: MasterYard | undefined }): Result<UpsertMasterYardPlan> {
  if (ctx.permissionError) return ctx.permissionError
  if (!yard.name.trim()) return { ok: false, error: 'A yard needs a name' }
  const existing = ctx.existing
  if (existing) {
    const record: MasterYard = { ...existing, ...yard, id: existing.id }
    return {
      ok: true,
      plan: {
        mode: 'edit', record,
        structural: { kind: 'master.edit', target: `Yard · ${existing.name}`, summary: 'Yard details updated', before: existing.address, after: yard.address ?? existing.address },
        audit: { action: 'master.edit', target: existing.name, detail: 'Yard details updated', severity: 'info' },
      },
    }
  }
  const id = uid('yard')
  const record: MasterYard = { ...yard, id, builtIn: false, active: true } as MasterYard
  return {
    ok: true,
    plan: {
      mode: 'add', record,
      structural: { kind: 'master.add', target: `Yard · ${yard.name}`, summary: `${yard.region} — available to the catalogue builder`, before: null, after: yard.name },
      audit: { action: 'master.add', target: yard.name, detail: 'Yard added', severity: 'warning' },
    },
  }
}

/* ------------------------------ setMasterActive ------------------------------ */

export type MasterKind = 'category' | 'uom' | 'yard'

export interface SetMasterActiveContext {
  permissionError: PermissionError
  categories: MasterCategory[]
  uoms: MasterUom[]
  yards: MasterYard[]
  lots: Lot[]
  catalogues: Catalogue[]
}

export interface SetMasterActivePlan {
  kind: MasterKind
  id: string
  active: boolean
  structural: StructuralPlan
  audit: { action: string; target: string; detail: string; severity: 'warning' }
}

export function planSetMasterActive(kind: MasterKind, id: string, active: boolean, ctx: SetMasterActiveContext): Result<SetMasterActivePlan> {
  if (ctx.permissionError) return ctx.permissionError
  let structural: StructuralPlan
  if (kind === 'category') {
    const row = ctx.categories.find((c) => c.key === id)
    if (!row) return { ok: false, error: 'No such category' }
    const inUse = ctx.lots.filter((l) => l.category === id && l.catalogueId).length
    if (!active && inUse > 0) return { ok: false, error: `${row.label} is on ${inUse} catalogued lot${inUse === 1 ? '' : 's'}. Retiring it would orphan them.` }
    structural = { kind: active ? 'master.edit' : 'master.deactivate', target: `Category · ${row.label}`, summary: active ? 'Back in use' : 'Retired — existing lots keep it, new ones cannot pick it', before: String(!active), after: String(active) }
  } else if (kind === 'uom') {
    const row = ctx.uoms.find((u) => u.code === id)
    if (!row) return { ok: false, error: 'No such unit' }
    const inUse = ctx.lots.filter((l) => l.uom === id).length
    if (!active && inUse > 0) return { ok: false, error: `${row.code} is on ${inUse} lot${inUse === 1 ? '' : 's'}` }
    structural = { kind: active ? 'master.edit' : 'master.deactivate', target: `Unit · ${row.code}`, summary: active ? 'Back in use' : 'Retired', before: String(!active), after: String(active) }
  } else {
    const row = ctx.yards.find((y) => y.id === id)
    if (!row) return { ok: false, error: 'No such yard' }
    const inUse = ctx.catalogues.filter((c) => c.yardName === row.name && c.status !== 'closed').length
    if (!active && inUse > 0) return { ok: false, error: `${row.name} has ${inUse} open catalogue${inUse === 1 ? '' : 's'}` }
    structural = { kind: active ? 'master.edit' : 'master.deactivate', target: `Yard · ${row.name}`, summary: active ? 'Back in use' : 'Retired', before: String(!active), after: String(active) }
  }
  return {
    ok: true,
    plan: { kind, id, active, structural, audit: { action: active ? 'master.activate' : 'master.deactivate', target: id, detail: `${kind} ${active ? 'reactivated' : 'retired'}`, severity: 'warning' } },
  }
}

/* ------------------------------ renameMasterEntry ------------------------------ */

export type RenameableMasterKind = 'category' | 'uom'

export interface RenameMasterEntryPlan {
  kind: RenameableMasterKind
  id: string
  label: string
  structural: StructuralPlan | null
  audit: { action: string; target: string; detail: string; severity: 'warning' } | null
}

export function planRenameMasterEntry(kind: RenameableMasterKind, id: string, label: string, ctx: { permissionError: PermissionError; categories: MasterCategory[]; uoms: MasterUom[] }): Result<RenameMasterEntryPlan> {
  if (ctx.permissionError) return ctx.permissionError
  const next = label.trim()
  if (!next) return { ok: false, error: 'A name is required' }
  if (kind === 'category') {
    const row = ctx.categories.find((c) => c.key === id)
    if (!row) return { ok: false, error: 'No such category' }
    if (row.label === next) return { ok: true, plan: { kind, id, label: next, structural: null, audit: null } }
    return {
      ok: true,
      plan: {
        kind, id, label: next,
        structural: { kind: 'master.edit', target: `Category · ${next}`, summary: `Renamed. The slug "${row.key}" is unchanged, so every lot already using it is unaffected.`, before: row.label, after: next },
        audit: { action: 'master.edit', target: row.key, detail: `Category renamed "${row.label}" → "${next}"`, severity: 'warning' },
      },
    }
  }
  const row = ctx.uoms.find((u) => u.code === id)
  if (!row) return { ok: false, error: 'No such unit' }
  if (row.label === next) return { ok: true, plan: { kind, id, label: next, structural: null, audit: null } }
  return {
    ok: true,
    plan: {
      kind, id, label: next,
      structural: { kind: 'master.edit', target: `Unit · ${row.code}`, summary: `Renamed. The code "${row.code}" is unchanged, so every lot priced in it is unaffected.`, before: row.label, after: next },
      audit: { action: 'master.edit', target: row.code, detail: `Unit renamed "${row.label}" → "${next}"`, severity: 'warning' },
    },
  }
}

/* ------------------------------ addTermsVersion ------------------------------ */

export interface AddTermsVersionPlan {
  version: string
  structural: StructuralPlan
  audit: { action: string; target: string; detail: string; severity: 'critical' }
}

export function planAddTermsVersion(termsSetId: string, note: string, ctx: { permissionError: PermissionError; termsSets: TermsSet[] }): Result<AddTermsVersionPlan> {
  if (ctx.permissionError) return ctx.permissionError
  const set0 = ctx.termsSets.find((t) => t.id === termsSetId)
  if (!set0) return { ok: false, error: 'No such terms set' }
  if (!note.trim()) return { ok: false, error: 'Say what changed — a terms version without a note cannot be explained to a buyer later' }
  const [major, minor] = String(set0.version).replace(/^v/i, '').split('.')
  const next = `v${major}.${Number(minor ?? 0) + 1}`
  return {
    ok: true,
    plan: {
      version: next,
      structural: { kind: 'master.terms_version', target: set0.name, summary: note.trim(), before: String(set0.version), after: next },
      audit: { action: 'master.terms_version', target: set0.name, detail: `${set0.version} → ${next} — ${note.trim()}`, severity: 'critical' },
    },
  }
}
