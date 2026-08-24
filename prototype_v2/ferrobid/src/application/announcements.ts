/* ---------------------------------------------------------------------------
   Application layer — the platform/auction noticeboard. Moved verbatim from
   auctionFloorSlice.ts's sendAnnouncement; no rule, threshold, or wording
   changed.
--------------------------------------------------------------------------- */
import { uid } from '../lib/format'
import { checkAuth } from './authorization'
import type { Announcement, Catalogue, Role } from '../types'
import type { NotificationPlan } from './opsInspection'

export interface SendAnnouncementInput {
  scope: 'platform' | 'catalogue'
  catalogueId?: string
  title: string
  body: string
  severity: Announcement['severity']
}

export interface SendAnnouncementContext {
  role: Role
  cat: Catalogue | undefined
  now: number
}

export interface SendAnnouncementPlan {
  record: Announcement
  audit: { action: string; target: string; detail: string; severity: 'info' | 'warning' }
  notify:
    | { kind: 'participants'; catalogueId: string; plan: NotificationPlan }
    | { kind: 'broadcast'; plan: NotificationPlan & { userId: null } }
}

export type SendAnnouncementResult =
  | { ok: true; plan: SendAnnouncementPlan }
  | { ok: false; error: string }

export function planSendAnnouncement(input: SendAnnouncementInput, ctx: SendAnnouncementContext): SendAnnouncementResult {
  const roleError = checkAuth('sendAnnouncement', ctx.role)
  if (roleError) return { ok: false, error: roleError }
  if (!input.title.trim() || !input.body.trim()) return { ok: false, error: 'A title and a message are both required' }
  if (input.scope === 'catalogue' && !input.catalogueId) return { ok: false, error: 'Pick the auction this notice belongs to' }

  const record: Announcement = {
    id: uid('ann'), scope: input.scope, catalogueId: input.scope === 'catalogue' ? input.catalogueId : undefined,
    title: input.title.trim(), body: input.body.trim(),
    at: new Date(ctx.now).toISOString(), severity: input.severity,
  }
  const audit = {
    action: 'announcement.send', target: ctx.cat?.code ?? 'platform',
    detail: `${input.severity.toUpperCase()} · ${input.title.trim()}`,
    severity: (input.severity === 'critical' ? 'warning' : 'info') as 'info' | 'warning',
  }
  const notify: SendAnnouncementPlan['notify'] = input.scope === 'catalogue' && input.catalogueId
    ? { kind: 'participants', catalogueId: input.catalogueId, plan: { kind: 'system', title: input.title, body: input.body, href: `/catalogue/${input.catalogueId}` } }
    : { kind: 'broadcast', plan: { userId: null, kind: 'system', title: input.title, body: input.body, href: '/noticeboard' } }

  return { ok: true, plan: { record, audit, notify } }
}
