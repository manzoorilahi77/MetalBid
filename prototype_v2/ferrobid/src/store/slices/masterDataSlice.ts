import {
  planAddMasterCategory, planAddMasterUom, planUpsertMasterYard, planSetMasterActive, planRenameMasterEntry, planAddTermsVersion,
} from '../../application/masterData'
import type { StoreGet, StoreSet, InternalHelpers } from '../internal'
import type { State } from '../types'

export const createMasterDataSlice = (
  set: StoreSet, get: StoreGet, helpers: InternalHelpers,
): Pick<State,
  'addMasterCategory' | 'addMasterUom' | 'upsertMasterYard' | 'setMasterActive' | 'renameMasterEntry' | 'addTermsVersion'
> => ({
  /* ------------------- Super Admin — master data ---------------------- */

  addMasterCategory: (label) => {
    const result = planAddMasterCategory(label, { permissionError: helpers.requireSuperAdmin(), categories: get().masterCategories })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({ masterCategories: [...st.masterCategories, plan.record] }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },

  addMasterUom: (code, label, precision) => {
    const result = planAddMasterUom(code, label, precision, { permissionError: helpers.requireSuperAdmin(), uoms: get().masterUoms })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({ masterUoms: [...st.masterUoms, plan.record] }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },

  upsertMasterYard: (yard) => {
    const existing = yard.id ? get().masterYards.find((y) => y.id === yard.id) : undefined
    const result = planUpsertMasterYard(yard, { permissionError: helpers.requireSuperAdmin(), existing })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({
      masterYards: plan.mode === 'edit'
        ? st.masterYards.map((y) => (y.id === plan.record.id ? plan.record : y))
        : [...st.masterYards, plan.record],
    }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },

  setMasterActive: (kind, id, active) => {
    const s = get()
    const result = planSetMasterActive(kind, id, active, {
      permissionError: helpers.requireSuperAdmin(),
      categories: s.masterCategories, uoms: s.masterUoms, yards: s.masterYards, lots: s.lots, catalogues: s.catalogues,
    })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    if (kind === 'category') set((st) => ({ masterCategories: st.masterCategories.map((c) => (c.key === id ? { ...c, active } : c)) }))
    else if (kind === 'uom') set((st) => ({ masterUoms: st.masterUoms.map((u) => (u.code === id ? { ...u, active } : u)) }))
    else set((st) => ({ masterYards: st.masterYards.map((y) => (y.id === id ? { ...y, active } : y)) }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },

  renameMasterEntry: (kind, id, label) => {
    const s = get()
    const result = planRenameMasterEntry(kind, id, label, { permissionError: helpers.requireSuperAdmin(), categories: s.masterCategories, uoms: s.masterUoms })
    if (!result.ok) return result
    const { plan } = result
    if (!plan.structural) return { ok: true }
    const snapshot = helpers.structureSnapshot()
    if (kind === 'category') set((st) => ({ masterCategories: st.masterCategories.map((c) => (c.key === id ? { ...c, label: plan.label } : c)) }))
    else set((st) => ({ masterUoms: st.masterUoms.map((u) => (u.code === id ? { ...u, label: plan.label } : u)) }))
    /* The slug/code stays put on purpose: every lot already catalogued points
       at it, so a rename changes what a buyer reads, never what a record holds. */
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    if (plan.audit) get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },

  addTermsVersion: (termsSetId, note) => {
    const result = planAddTermsVersion(termsSetId, note, { permissionError: helpers.requireSuperAdmin(), termsSets: get().termsSets })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({ termsSets: st.termsSets.map((t) => (t.id === termsSetId ? { ...t, version: plan.version } : t)) }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },
})
