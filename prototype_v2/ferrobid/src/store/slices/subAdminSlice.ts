import { uid } from '../../lib/format'
import { planReplyToDispute } from '../../application/disputeReply'
import { planResolveDisputeGuards, planResolveDisputeOutcome } from '../../application/disputeLifecycle'
import { planSubmitContentDraft } from '../../application/contentPublishing'
import { planReviewAction, planSaveHandoverNote } from '../../application/subAdminWorkflow'
import { SUB_ADMIN_ROLES } from '../constants'
import type { StoreGet, StoreSet, InternalHelpers } from '../internal'
import type { State } from '../types'

export const createSubAdminSlice = (
  set: StoreSet, get: StoreGet, helpers: InternalHelpers,
): Pick<State,
  'claimWorkItem' | 'releaseWorkItem' | 'reviewAction' | 'assignDispute' | 'replyToDispute' | 'resolveDispute'
  | 'submitContentDraft' | 'saveHandoverNote' | 'clearWinFlag' | 'audit'
> => ({
  /* ================= Sub Admin — supervision, support, shift =============
     Every Sub Admin account is identical: the same full menu, the same
     powers. So nothing below asks what an account is *allowed* to do — it
     asks who has picked a piece of work up, which is the only thing that
     actually divides this desk. */

  claimWorkItem: (itemId) => {
    const s = get()
    if (!SUB_ADMIN_ROLES.includes(s.role)) return { ok: false, error: 'Only a Sub Admin claims from this board' }
    const me = s.currentUser
    if (!me) return { ok: false, error: 'Sign in first' }
    const held = s.workClaims[itemId]
    if (held && held.byId !== me.id) {
      const who = s.users.find((u) => u.id === held.byId)
      return { ok: false, error: `${who?.name ?? 'Another Sub Admin'} is already on this one` }
    }
    set((st) => ({ workClaims: { ...st.workClaims, [itemId]: { byId: me.id, at: new Date(st.now).toISOString() } } }))
    return { ok: true }
  },

  releaseWorkItem: (itemId) => {
    set((st) => {
      const next = { ...st.workClaims }
      delete next[itemId]
      return { workClaims: next }
    })
  },

  reviewAction: (eventId, verdict, note) => {
    const s = get()
    const ev = s.auditEvents.find((e) => e.id === eventId)
    const result = planReviewAction(eventId, verdict, note, {
      role: s.role,
      ev,
      alreadyReviewed: s.actionReviews.some((r) => r.eventId === eventId),
      actorId: s.currentUser?.id,
      actorName: ev ? s.users.find((u) => u.id === ev.actorId)?.name : undefined,
      now: s.now,
    })
    if (!result.ok) return result
    const { plan } = result
    set((st) => ({ actionReviews: [plan.review, ...st.actionReviews] }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    // The role that did the work hears about it, not just the record.
    if (plan.actorNotification) {
      get().notify({ userId: plan.actorNotification.userId, kind: 'system', title: plan.actorNotification.title, body: plan.actorNotification.body })
    }
    if (plan.escalationNotification) {
      /* Addressed to the desk that can act on it. This used to be a
         null-addressed notice, which every buyer and seller received. */
      helpers.notifyRole('super_admin', {
        kind: 'system', title: plan.escalationNotification.title, body: plan.escalationNotification.body, href: '/admin/control-tower',
      })
    }
    return { ok: true, escalatedTo: result.escalatedTo }
  },

  assignDispute: (id) => {
    const me = get().currentUser
    if (!me) return
    set((st) => ({
      disputes: st.disputes.map((d) => (d.id === id
        ? { ...d, assignedToId: me.id, status: d.status === 'open' ? ('in_review' as const) : d.status }
        : d)),
    }))
  },

  replyToDispute: (id, body) => {
    const s = get()
    const result = planReplyToDispute(id, body, {
      role: s.role, actorId: s.currentUser?.id,
      dispute: s.disputes.find((x) => x.id === id),
      now: s.now,
    })
    if (!result.ok) return result
    const { plan } = result

    set((st) => ({
      disputes: st.disputes.map((x) => (x.id === plan.disputeId
        ? { ...x, status: 'in_review' as const, assignedToId: plan.assignedToId, messages: [...x.messages, plan.message] }
        : x)),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
    get().notify(plan.notification)
    return { ok: true }
  },

  resolveDispute: (id, outcome, resolution, amount) => {
    const s = get()
    const d = s.disputes.find((x) => x.id === id)
    const guard = planResolveDisputeGuards(outcome, resolution, amount, { role: s.role, dispute: d })
    if (!guard.ok) return guard

    // Money owed is where this desk stops. The refund is raised here so the
    // customer sees a decision immediately, but it is Finance that approves
    // and pays it — and until they have, the ticket stays open. This calls
    // the real, independently-validated raiseRefund action — not a plan —
    // because its role/threshold checks must run for real, not be predicted.
    let refundRaised = false
    let refundId: string | undefined
    if (outcome === 'refund_due') {
      const before = get().refundRequests.length
      const res = get().raiseRefund({
        userId: d!.userId, amount: amount!, source: 'dispute', reason: resolution.trim(), disputeId: d!.id, lotId: d!.lotId,
      })
      if (!res.ok) return { ok: false, error: res.error }
      refundRaised = true
      if (get().refundRequests.length > before) refundId = get().refundRequests[0].id
    }

    const plan = planResolveDisputeOutcome(outcome, resolution, amount, {
      dispute: d!, actorId: s.currentUser?.id, now: s.now, refundRaised, refundId,
    })
    set((st) => ({
      disputes: st.disputes.map((x) => (x.id === plan.disputeId
        ? {
          ...x,
          status: plan.closes ? ('resolved' as const) : ('in_review' as const),
          outcome, resolution: resolution.trim(), refundId: plan.refundId,
          assignedToId: plan.assignedToId,
          ...(plan.closes ? { resolvedAt: plan.resolvedAt, resolvedById: plan.resolvedById } : {}),
          messages: [...x.messages, plan.message],
        }
        : x)),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    get().notify(plan.notification)
    return { ok: true, refundRaised }
  },

  submitContentDraft: ({ page, section, before, after, needsCeo }) => {
    const s = get()
    const result = planSubmitContentDraft({ page, section, before, after, needsCeo }, { role: s.role, actorId: s.currentUser?.id, actorName: s.currentUser?.name, now: s.now })
    if (!result.ok) return result
    const { plan } = result
    set((st) => ({ contentDrafts: [plan.draft, ...st.contentDrafts] }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
    helpers.notifyRole('super_admin', plan.superAdminNotification)
    if (plan.ceoNotification) helpers.notifyRole('ceo', plan.ceoNotification)
    return { ok: true }
  },

  saveHandoverNote: (body) => {
    const s = get()
    const result = planSaveHandoverNote(body, { actorId: s.currentUser?.id, now: s.now })
    if (!result.ok) return result
    const { plan } = result
    set((st) => ({ handoverNotes: [plan.note, ...st.handoverNotes] }))
    get().audit('shift.handover', s.currentUser?.name ?? 'Sub Admin', plan.auditDetail)
    return { ok: true }
  },

  clearWinFlag: () => set({ lastWonLotId: null }),

  audit: (action, target, detail, severity = 'info') => {
    const me = get().currentUser
    set((st) => ({
      auditEvents: [{
        id: uid('aud'), at: new Date(st.now).toISOString(),
        actorId: me?.id ?? 'system', action, target, detail, severity,
      }, ...st.auditEvents],
    }))
  },
})
