import { uid } from '../../lib/format'
import { planCreateDispute } from '../../application/disputeLifecycle'
import { planSubmitTestimonial, planModerateTestimonial } from '../../application/moderation'
import type { StoreGet, StoreSet, InternalHelpers } from '../internal'
import type { State } from '../types'

export const createMiscSlice = (
  set: StoreSet, get: StoreGet, helpers: InternalHelpers,
): Pick<State,
  'pushToast' | 'dismissToast' | 'notify' | 'markNotificationsRead' | 'createDispute'
  | 'submitTestimonial' | 'moderateTestimonial'
> => ({
  /* ------------------------------- misc ------------------------------- */
  pushToast: (t) => {
    const toast = { ...t, id: uid('toast') }
    set((st) => ({ toasts: [...st.toasts, toast] }))
    setTimeout(() => get().dismissToast(toast.id), 4200)
  },
  dismissToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),

  notify: (n) => {
    set((st) => ({
      notifications: [
        { ...n, id: uid('ntf'), at: new Date(st.now).toISOString(), read: false },
        ...st.notifications,
      ],
    }))
  },
  markNotificationsRead: () => {
    const me = get().currentUser
    set((st) => ({
      notifications: st.notifications.map((n) => (n.userId === null || n.userId === me?.id ? { ...n, read: true } : n)),
    }))
  },

  createDispute: (subject, category, body, lotId) => {
    const s = get()
    const result = planCreateDispute(subject, category, body, lotId, {
      currentUser: s.currentUser,
      lotNo: lotId ? s.lots.find((l) => l.id === lotId)?.lotNo : undefined,
      now: s.now,
    })
    if (!result.ok) return
    const { plan } = result

    set((st) => ({ disputes: [plan.dispute, ...st.disputes] }))
    /* A ticket is a customer waiting. It used to be the one customer-initiated
       action in the store that wrote no audit entry and told nobody — so the
       Sub Admin's own Approvals screen, which reviews the audit trail, could
       not see that support had been asked for anything. */
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    helpers.notifyRole(['sub_admin', 'exec_manager'], plan.supportNotification)
    get().notify(plan.customerNotification)
  },

  submitTestimonial: (quote, rating) => {
    const result = planSubmitTestimonial(quote, rating, { actor: get().currentUser, now: get().now })
    if (!result.ok) return result
    const { plan } = result
    set((st) => ({ testimonials: [plan.record, ...st.testimonials] }))
    helpers.notifyRole(['sub_admin'], plan.notification)
    return { ok: true }
  },

  /** Approve publishes it to the public Home page; reject keeps it off
   *  without deleting it, the same "record stays, visibility changes"
   *  shape the CMS section switches use. */
  moderateTestimonial: (id, approve, note) => {
    const s = get()
    const result = planModerateTestimonial(id, approve, { actor: s.currentUser, row: s.testimonials.find((t) => t.id === id), now: s.now })
    if (!result.ok) return result
    const { plan } = result
    set((st) => ({
      testimonials: st.testimonials.map((t) => (t.id === id ? {
        ...t, status: plan.status,
        moderatedBy: s.currentUser!.id, moderatedAt: plan.moderatedAt, moderationNote: note,
      } : t)),
    }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },
})
