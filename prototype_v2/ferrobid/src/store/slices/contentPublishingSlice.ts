import { planPublishContent, planReturnContent } from '../../application/contentPublishing'
import type { StoreGet, StoreSet, InternalHelpers } from '../internal'
import type { State } from '../types'

export const createContentPublishingSlice = (
  set: StoreSet, get: StoreGet, helpers: InternalHelpers,
): Pick<State, 'publishContent' | 'returnContent'> => ({
  /* ------------- Super Admin — content a Sub Admin drafted ------------ */

  publishContent: (id) => {
    const s = get()
    const draft = s.contentDrafts.find((d) => d.id === id)
    const result = planPublishContent({
      role: s.role, draft,
      ceoSigned: draft ? s.ceoApprovals.some((a) => a.kind === 'content_publish' && a.refId === id && a.status === 'approved') : false,
      now: s.now,
    })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({
      contentDrafts: st.contentDrafts.map((d) =>
        d.id === id ? { ...d, status: 'published' as const, decidedAt: plan.publishedAt, decidedBy: st.currentUser?.id, note: undefined } : d),
    }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    get().notify(plan.notification)
    return { ok: true }
  },

  returnContent: (id, note) => {
    const s = get()
    const draft = s.contentDrafts.find((d) => d.id === id)
    const result = planReturnContent(note, { role: s.role, draft, now: s.now })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({
      contentDrafts: st.contentDrafts.map((d) =>
        d.id === id ? { ...d, status: 'returned' as const, note: note.trim(), decidedAt: plan.decidedAt, decidedBy: st.currentUser?.id } : d),
    }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    get().notify(plan.notification)
    return { ok: true }
  },
})
