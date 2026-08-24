/* ---------------------------------------------------------------------------
   Application layer — a Sub Admin reviewing another role's audited action,
   and the shift handover note. Moved verbatim from subAdminSlice.ts's
   reviewAction/saveHandoverNote; no rule, threshold, or wording changed.
--------------------------------------------------------------------------- */
import { uid } from '../lib/format'
import { REVERSAL_NEEDS_SUPER } from '../store/constants'
import { checkAuth } from './authorization'
import type { ActionReview, AuditEvent, HandoverNote, Role } from '../types'

/* ------------------------------ reviewAction ------------------------------ */

export interface ReviewActionContext {
  role: Role
  ev: AuditEvent | undefined
  alreadyReviewed: boolean
  actorId: string | undefined
  actorName: string | undefined
  now: number
}

export interface ReviewActionPlan {
  review: ActionReview
  audit: { action: string; target: string; detail: string; severity: 'info' | 'warning' }
  actorNotification: { userId: string; title: string; body: string } | null
  escalationNotification: { title: string; body: string } | null
}

export type ReviewActionResult =
  | { ok: true; escalatedTo: Role | undefined; plan: ReviewActionPlan }
  | { ok: false; error: string }

export function planReviewAction(eventId: string, verdict: ActionReview['verdict'], note: string, ctx: ReviewActionContext): ReviewActionResult {
  const roleError = checkAuth('reviewAction', ctx.role)
  if (roleError) return { ok: false, error: roleError }
  const ev = ctx.ev
  if (!ev) return { ok: false, error: 'That entry is no longer on the record' }
  if (ctx.alreadyReviewed) return { ok: false, error: 'You have already reviewed this one' }
  if (verdict !== 'confirmed' && !note.trim()) {
    return { ok: false, error: 'Say what is wrong with it — the person who did it is shown this word for word' }
  }

  // Questioning or reversing a finding does not rewind the action: whoever
  // holds the lever does that. What this decides is where the finding goes.
  const escalatedTo: Role | undefined = verdict === 'reversed'
    ? (REVERSAL_NEEDS_SUPER.some((a) => ev.action.startsWith(a)) ? 'super_admin' : undefined)
    : undefined

  const trimmedNote = note.trim()
  const review: ActionReview = {
    id: uid('rev'), eventId, verdict, note: trimmedNote,
    at: new Date(ctx.now).toISOString(), byId: ctx.actorId ?? 'system', escalatedTo,
  }

  return {
    ok: true, escalatedTo,
    plan: {
      review,
      audit: {
        action: `review.${verdict}`, target: ev.target,
        detail: `${ev.action} by ${ctx.actorName ?? 'system'} — ${verdict}${trimmedNote ? `: ${trimmedNote}` : ''}`,
        severity: verdict === 'confirmed' ? 'info' : 'warning',
      },
      // The role that did the work hears about it, not just the record.
      actorNotification: ev.actorId !== 'system' && ev.actorId !== review.byId
        ? {
          userId: ev.actorId,
          title: verdict === 'confirmed' ? `${ev.target} — reviewed and confirmed`
            : verdict === 'questioned' ? `A question about ${ev.target}`
              : `${ev.target} — sent back`,
          body: trimmedNote || 'Reviewed by a Sub Admin. No change needed.',
        }
        : null,
      // Addressed to the desk that can act on it.
      escalationNotification: escalatedTo
        ? { title: `Sub Admin review needs Super Admin — ${ev.target}`, body: trimmedNote }
        : null,
    },
  }
}

/* ------------------------------ saveHandoverNote ------------------------------ */

export interface SaveHandoverNoteContext {
  actorId: string | undefined
  now: number
}

export interface SaveHandoverNotePlan {
  note: HandoverNote
  auditDetail: string
}

export type SaveHandoverNoteResult =
  | { ok: true; plan: SaveHandoverNotePlan }
  | { ok: false; error: string }

export function planSaveHandoverNote(body: string, ctx: SaveHandoverNoteContext): SaveHandoverNoteResult {
  if (!body.trim()) return { ok: false, error: 'Nothing to hand over yet' }
  const trimmed = body.trim()
  const note: HandoverNote = { id: uid('hn'), byId: ctx.actorId ?? 'system', at: new Date(ctx.now).toISOString(), body: trimmed }
  return { ok: true, plan: { note, auditDetail: trimmed.slice(0, 160) } }
}
