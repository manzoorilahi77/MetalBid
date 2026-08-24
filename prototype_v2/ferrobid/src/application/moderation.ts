/* ---------------------------------------------------------------------------
   Application layer — public-site content moderation: a buyer/seller
   submitting a testimonial, a Sub Admin approving or rejecting it. Moved
   verbatim from miscSlice.ts; no rule, threshold, or wording changed. See
   opsInspection.ts for the pattern.
--------------------------------------------------------------------------- */
import { uid } from '../lib/format'
import { checkAuth } from './authorization'
import type { Testimonial, User } from '../types'
import type { NotificationPlan } from './opsInspection'

/* -------------------------------- submitTestimonial ------------------------------- */

export interface SubmitTestimonialContext {
  actor: User | null
  now: number
}

export interface SubmitTestimonialPlan {
  record: Testimonial
  notification: NotificationPlan
}

export type SubmitTestimonialResult =
  | { ok: true; plan: SubmitTestimonialPlan }
  | { ok: false; error: string }

export function planSubmitTestimonial(quote: string, rating: number | undefined, ctx: SubmitTestimonialContext): SubmitTestimonialResult {
  const me = ctx.actor
  if (!me) return { ok: false, error: 'Sign in to continue' }
  const submitRoleError = checkAuth('submitTestimonial', me.role)
  if (submitRoleError) {
    return { ok: false, error: submitRoleError }
  }
  const text = quote.trim()
  if (text.length < 20) return { ok: false, error: 'A few more words would help — at least 20 characters' }
  const record: Testimonial = {
    id: uid('tst'), userId: me.id, role: me.role as 'buyer' | 'seller', quote: text, rating,
    status: 'pending', submittedAt: new Date(ctx.now).toISOString(),
  }
  return {
    ok: true,
    plan: {
      record,
      notification: {
        kind: 'system', title: 'A testimonial is waiting to be moderated',
        body: `${me.firm} — "${text.slice(0, 100)}"`, href: '/cms/sections',
      },
    },
  }
}

/* -------------------------------- moderateTestimonial ------------------------------- */

export interface ModerateTestimonialContext {
  actor: User | null
  row: Testimonial | undefined
  now: number
}

export interface ModerateTestimonialPlan {
  status: 'approved' | 'rejected'
  moderatedAt: string
  audit: { action: string; target: string; detail: string; severity: 'info' }
}

export type ModerateTestimonialResult =
  | { ok: true; plan: ModerateTestimonialPlan }
  | { ok: false; error: string }

/** Approve publishes it to the public Home page; reject keeps it off without
 *  deleting it, the same "record stays, visibility changes" shape the CMS
 *  section switches use. */
export function planModerateTestimonial(id: string, approve: boolean, ctx: ModerateTestimonialContext): ModerateTestimonialResult {
  const me = ctx.actor
  if (!me) return { ok: false, error: 'Only a Sub Admin moderates testimonials' }
  const modRoleError = checkAuth('moderateTestimonial', me.role)
  if (modRoleError) return { ok: false, error: modRoleError }
  const row = ctx.row
  if (!row) return { ok: false, error: 'That testimonial no longer exists' }
  return {
    ok: true,
    plan: {
      status: approve ? 'approved' : 'rejected',
      moderatedAt: new Date(ctx.now).toISOString(),
      audit: {
        action: approve ? 'testimonial.approved' : 'testimonial.rejected', target: id.toUpperCase(),
        detail: `${me.name} ${approve ? 'approved' : 'declined'} a testimonial from ${row.userId}`,
        severity: 'info',
      },
    },
  }
}
