import {
  planRenamePage, planSetPageHidden, planMovePage, planAttachPage, planDetachPage, planAddSubPage,
} from '../../application/pageRegistry'
import type { StoreGet, StoreSet, InternalHelpers } from '../internal'
import type { State } from '../types'

export const createPageRegistrySlice = (
  set: StoreSet, get: StoreGet, helpers: InternalHelpers,
): Pick<State, 'renamePage' | 'setPageHidden' | 'movePage' | 'attachPage' | 'detachPage' | 'addSubPage'> => ({
  renamePage: (id, label) => {
    const page = get().pageRegistry.find((p) => p.id === id)
    const result = planRenamePage(id, label, { permissionError: helpers.requireSuperAdmin(), page, roleLabel: page ? helpers.roleLabelFor(page.roleKey) : '' })
    if (!result.ok) return result
    const { plan } = result
    if (!plan.structural) return { ok: true }
    const snapshot = helpers.structureSnapshot()
    set((st) => ({ pageRegistry: st.pageRegistry.map((p) => (p.id === id ? { ...p, label: plan.label } : p)) }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit!.action, plan.audit!.target, plan.audit!.detail, plan.audit!.severity)
    return { ok: true }
  },

  setPageHidden: (id, hidden) => {
    const s = get()
    const page = s.pageRegistry.find((p) => p.id === id)
    const result = planSetPageHidden(id, hidden, {
      permissionError: helpers.requireSuperAdmin(), page, roleLabel: page ? helpers.roleLabelFor(page.roleKey) : '',
      hasLiveCatalogue: s.catalogues.some((c) => c.status === 'live'),
      visibleSiblingCount: page ? s.pageRegistry.filter((p) => p.roleKey === page.roleKey && !p.hidden).length : 0,
    })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({ pageRegistry: st.pageRegistry.map((p) => (p.id === id ? { ...p, hidden } : p)) }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },

  movePage: (id, direction) => {
    const s = get()
    const page = s.pageRegistry.find((p) => p.id === id)
    const result = planMovePage(id, direction, {
      permissionError: helpers.requireSuperAdmin(), page, roleLabel: page ? helpers.roleLabelFor(page.roleKey) : '',
      siblings: page ? s.pageRegistry.filter((p) => p.roleKey === page.roleKey) : [],
    })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({
      pageRegistry: st.pageRegistry.map((p) =>
        p.id === plan.pageId ? { ...p, order: plan.pageOrder } : p.id === plan.otherId ? { ...p, order: plan.otherOrder } : p),
    }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },

  attachPage: (id, roleKey) => {
    const s = get()
    const page = s.pageRegistry.find((p) => p.id === id)
    const target = s.roleRegistry.find((r) => r.key === roleKey && r.status === 'active')
    const result = planAttachPage(id, roleKey, {
      permissionError: helpers.requireSuperAdmin(), page, target, roleLabel: page ? helpers.roleLabelFor(page.roleKey) : '',
      targetPages: s.pageRegistry.filter((p) => p.roleKey === roleKey),
    })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({ pageRegistry: [...st.pageRegistry, plan.record] }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },

  detachPage: (id) => {
    const page = get().pageRegistry.find((p) => p.id === id)
    const result = planDetachPage(id, { permissionError: helpers.requireSuperAdmin(), page, roleLabel: page ? helpers.roleLabelFor(page.roleKey) : '' })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({ pageRegistry: st.pageRegistry.filter((p) => p.id !== id) }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },

  addSubPage: (roleKey, label, to) => {
    const s = get()
    const result = planAddSubPage(roleKey, label, to, {
      permissionError: helpers.requireSuperAdmin(), role: s.roleRegistry.find((r) => r.key === roleKey && r.status === 'active'),
      rolePages: s.pageRegistry.filter((p) => p.roleKey === roleKey),
    })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({ pageRegistry: [...st.pageRegistry, plan.record] }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },
})
