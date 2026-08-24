/* ---------------------------------------------------------------------------
   Application layer — the public-site copy workflow: a Sub Admin drafts,
   a Super Admin publishes or returns it. Moved verbatim from
   subAdminSlice.ts's submitContentDraft and superAdminSlice.ts's
   publishContent/returnContent; no rule, threshold, or wording changed.
   See opsInspection.ts for the pattern.
--------------------------------------------------------------------------- */
import { uid } from '../lib/format'
import { checkAuth } from './authorization'
import type { ContentDraft, Role, StructuralChangeKind } from '../types'
import type { NotificationPlan } from './opsInspection'

/* ------------------------------ submitContentDraft ------------------------------ */

export interface SubmitContentDraftInput {
  page: string
  section: string
  before: string
  after: string
  needsCeo: boolean
}

export interface SubmitContentDraftContext {
  role: Role
  actorId: string | undefined
  actorName: string | undefined
  now: number
}

export interface SubmitContentDraftPlan {
  draft: ContentDraft
  audit: { action: string; target: string; detail: string }
  superAdminNotification: NotificationPlan
  ceoNotification: NotificationPlan | null
}

export type SubmitContentDraftResult =
  | { ok: true; plan: SubmitContentDraftPlan }
  | { ok: false; error: string }

export function planSubmitContentDraft(input: SubmitContentDraftInput, ctx: SubmitContentDraftContext): SubmitContentDraftResult {
  const draftRoleError = checkAuth('submitContentDraft', ctx.role)
  if (draftRoleError) return { ok: false, error: draftRoleError }
  if (!input.page.trim() || !input.section.trim()) return { ok: false, error: 'Say which page and which section' }
  if (!input.after.trim()) return { ok: false, error: 'Write the new copy' }
  if (input.after.trim() === input.before.trim()) return { ok: false, error: 'The new copy is the same as what is live' }
  // Every public number comes from the system that owns it. A content
  // editor typing a lot count, a rate or a fee into a page is exactly how
  // the site ends up contradicting the books.
  if (/(₹|\bRs\.?\b|\d[\d,]*\s*(%|MT\b|lots?\b|crore|lakh))/i.test(input.after)) {
    return { ok: false, error: 'Figures cannot be typed into copy — lot counts, rates and fees are read from the system that owns them' }
  }
  const draft: ContentDraft = {
    id: uid('cnt'), page: input.page.trim(), section: input.section.trim(),
    authorId: ctx.actorId ?? 'system',
    submittedAt: new Date(ctx.now).toISOString(),
    before: input.before.trim(), after: input.after.trim(),
    status: 'submitted', needsCeo: input.needsCeo,
  }
  return {
    ok: true,
    plan: {
      draft,
      audit: { action: 'content.draft', target: `${draft.page} · ${draft.section}`, detail: `Submitted for publishing${input.needsCeo ? ' — pricing/legal copy, needs the CEO as well as us' : ''}` },
      /* Publishing is the Super Admin's, and pricing or legal copy needs the
         CEO too. Addressed to them — not broadcast to every buyer and
         seller, which is what a null userId does. */
      superAdminNotification: { kind: 'system', title: 'Content waiting to be published', body: `${draft.page} · ${draft.section} — drafted by ${ctx.actorName ?? 'a Sub Admin'}.`, href: '/admin/content' },
      ceoNotification: input.needsCeo
        ? { kind: 'system', title: 'Content needs your signature', body: `${draft.page} · ${draft.section} — pricing or legal copy, so it does not go live on our say-so alone.`, href: '/ceo/approvals' }
        : null,
    },
  }
}

/* -------------------------------- publishContent --------------------------------- */

export interface PublishContentContext {
  role: Role
  draft: ContentDraft | undefined
  ceoSigned: boolean
  now: number
}

export interface PublishContentPlan {
  publishedAt: string
  audit: { action: string; target: string; detail: string; severity: 'warning' }
  structural: { kind: StructuralChangeKind; target: string; summary: string; before: string; after: string }
  notification: NotificationPlan & { userId: string }
}

export type PublishContentResult =
  | { ok: true; plan: PublishContentPlan }
  | { ok: false; error: string }

export function planPublishContent(ctx: PublishContentContext): PublishContentResult {
  const platformRoleError = checkAuth('changePlatformShape', ctx.role)
  if (platformRoleError) return { ok: false, error: platformRoleError }
  const draft = ctx.draft
  if (!draft) return { ok: false, error: 'No such draft' }
  if (draft.status === 'published') return { ok: false, error: 'Already published' }
  if (draft.needsCeo && !ctx.ceoSigned) return { ok: false, error: 'Pricing and legal copy needs the CEO as well. Send it for signature first.' }
  return {
    ok: true,
    plan: {
      publishedAt: new Date(ctx.now).toISOString(),
      audit: { action: 'content.publish', target: `${draft.page} · ${draft.section}`, detail: 'Draft published to the public site', severity: 'warning' },
      structural: { kind: 'content.publish', target: `${draft.page} · ${draft.section}`, summary: 'Published — live on the public site now.', before: draft.before, after: draft.after },
      notification: { userId: draft.authorId, kind: 'system', title: 'Your copy is live', body: `${draft.page} — ${draft.section}`, href: '/sub' },
    },
  }
}

/* --------------------------------- returnContent ---------------------------------- */

export interface ReturnContentContext {
  role: Role
  draft: ContentDraft | undefined
  now: number
}

export interface ReturnContentPlan {
  decidedAt: string
  audit: { action: string; target: string; detail: string; severity: 'info' }
  structural: { kind: StructuralChangeKind; target: string; summary: string; before: string; after: string }
  notification: NotificationPlan & { userId: string }
}

export type ReturnContentResult =
  | { ok: true; plan: ReturnContentPlan }
  | { ok: false; error: string }

export function planReturnContent(note: string, ctx: ReturnContentContext): ReturnContentResult {
  const platformRoleError = checkAuth('changePlatformShape', ctx.role)
  if (platformRoleError) return { ok: false, error: platformRoleError }
  const draft = ctx.draft
  if (!draft) return { ok: false, error: 'No such draft' }
  if (!note.trim()) return { ok: false, error: 'Say what needs changing — a return without a comment is a dead end' }
  const trimmed = note.trim()
  return {
    ok: true,
    plan: {
      decidedAt: new Date(ctx.now).toISOString(),
      audit: { action: 'content.return', target: `${draft.page} · ${draft.section}`, detail: trimmed, severity: 'info' },
      structural: { kind: 'content.return', target: `${draft.page} · ${draft.section}`, summary: `Returned to the author — ${trimmed}`, before: draft.after, after: draft.before },
      notification: { userId: draft.authorId, kind: 'system', title: 'Copy returned with comments', body: trimmed, href: '/sub' },
    },
  }
}
