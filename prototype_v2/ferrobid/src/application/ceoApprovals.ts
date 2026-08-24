/* ---------------------------------------------------------------------------
   Application layer — the CEO sign-off queue: raising a request, asking a
   question, delegating the queue, and deciding a request. Moved verbatim
   from ceoSlice.ts; no rule, threshold, or wording changed.

   `decideCeoApproval`'s emd_forfeiture-refuse branch calls the real,
   independently-validated `waiveEmdForfeiture` action (not a plan) — same
   cross-action pattern as Phase 9's `resolveDispute` calling `raiseRefund`:
   its own role/status checks must run for real, not be predicted. Every
   other side effect (apply a forfeiture, decide a refund, apply a fee
   change, ban a user) is a plain mutation with no independent validation of
   its own, so those stay inline in the plan. See opsInspection.ts for the
   general pattern.
--------------------------------------------------------------------------- */
import { inr } from '../lib/format'
import { CEO_REQUEST_HREF, isAnonymousRole } from '../store/constants'
import type { CeoApprovalRequest, CeoDelegation, EmdForfeiture, FinanceConfig, RefundRequest, Role, User } from '../types'
import type { NotificationPlan } from './opsInspection'

/* ------------------------------ requestCeoSignoff ------------------------------ */

export interface RequestCeoSignoffContext {
  role: Role
  existing: CeoApprovalRequest | undefined
}

export type RequestCeoSignoffPlan =
  | { action: 'refused' }
  | { action: 'existing'; record: CeoApprovalRequest }
  | { action: 'create'; audit: { action: string; target: string; detail: string; severity: 'warning' } }

export function planRequestCeoSignoff(summary: string, reason: string, ctx: RequestCeoSignoffContext): RequestCeoSignoffPlan {
  // Customers never raise one of these; every kind comes off a staff desk.
  if (isAnonymousRole(ctx.role) || ctx.role === 'buyer' || ctx.role === 'seller') return { action: 'refused' }
  if (ctx.existing) return { action: 'existing', record: ctx.existing }
  return { action: 'create', audit: { action: 'ceo.request', target: summary, detail: `Sent for the CEO's signature — ${reason}`, severity: 'warning' } }
}

/* ------------------------------- requestCeoInfo -------------------------------- */

export interface RequestCeoInfoContext {
  canSign: boolean
  req: CeoApprovalRequest | undefined
  now: number
}

export interface RequestCeoInfoPlan {
  infoAskedAt: string
  audit: { action: string; target: string; detail: string }
  notification: NotificationPlan & { userId: string }
}

export function planRequestCeoInfo(note: string, ctx: RequestCeoInfoContext): RequestCeoInfoPlan | null {
  if (!ctx.canSign) return null
  const req = ctx.req
  if (!req || (req.status !== 'pending' && req.status !== 'info_requested')) return null
  return {
    infoAskedAt: new Date(ctx.now).toISOString(),
    audit: { action: 'ceo.query', target: req.summary, detail: `More information asked for — ${note}` },
    notification: { userId: req.requestedBy, kind: 'system', title: 'The CEO has a question', body: `${req.summary} — ${note}`, href: CEO_REQUEST_HREF[req.kind] },
  }
}

/* ---------------------------- delegateCeoApprovals ------------------------------ */

export interface DelegateCeoApprovalsContext {
  role: Role
  actorId: string | undefined
  to: User | undefined
  now: number
}

export interface DelegateCeoApprovalsPlan {
  record: CeoDelegation
  audit: { action: string; target: string; detail: string; severity: 'critical' }
  notification: NotificationPlan & { userId: string }
}

export type DelegateCeoApprovalsResult =
  | { ok: true; plan: DelegateCeoApprovalsPlan }
  | { ok: false; error: string }

export function planDelegateCeoApprovals(
  toUserId: string,
  until: string,
  note: string | undefined,
  ctx: DelegateCeoApprovalsContext,
): DelegateCeoApprovalsResult {
  if (ctx.role !== 'ceo') return { ok: false, error: 'Only the CEO can hand this queue to someone else.' }
  const to = ctx.to
  if (!to) return { ok: false, error: 'That account no longer exists.' }
  if (to.id === ctx.actorId) return { ok: false, error: 'The queue is already yours.' }
  if (Date.parse(`${until}T23:59:59`) <= ctx.now) return { ok: false, error: 'Pick a date in the future — a delegation with no time left changes nothing.' }
  const record: CeoDelegation = { toUserId, until, note, setBy: ctx.actorId ?? 'u-ceo-1', setAt: new Date(ctx.now).toISOString() }
  return {
    ok: true,
    plan: {
      record,
      audit: { action: 'ceo.delegate', target: to.name, detail: `Approval queue delegated until ${until}${note ? ` — ${note}` : ''}`, severity: 'critical' },
      notification: {
        userId: toUserId, kind: 'system', title: 'You are holding the CEO approval queue',
        body: `Until ${until}. Every decision you sign is recorded under your own name.${note ? ` ${note}` : ''}`,
        href: '/ceo/approvals',
      },
    },
  }
}

/* ----------------------------- clearCeoDelegation ------------------------------- */

export interface ClearCeoDelegationContext {
  role: Role
  current: CeoDelegation | null
  to: User | undefined
}

export interface ClearCeoDelegationPlan {
  audit: { action: string; target: string; detail: string; severity: 'critical' }
  // This notification has no `href` in the original — kept exactly as-is.
  notification: { userId: string; kind: 'system'; title: string; body: string }
}

export function planClearCeoDelegation(ctx: ClearCeoDelegationContext): ClearCeoDelegationPlan | null {
  if (ctx.role !== 'ceo') return null
  const current = ctx.current
  if (!current) return null
  return {
    audit: { action: 'ceo.delegate_end', target: ctx.to?.name ?? current.toUserId, detail: 'Delegation ended — the queue is back with the CEO', severity: 'critical' },
    notification: { userId: current.toUserId, kind: 'system', title: 'Approval queue handed back', body: 'The CEO has taken the signature queue back. Anything you signed stands, under your name.' },
  }
}

/* ------------------------------ decideCeoApproval -------------------------------- */

export interface DecideCeoApprovalContext {
  canSign: boolean
  req: CeoApprovalRequest | undefined
  emdForfeiture: EmdForfeiture | undefined
  refund: RefundRequest | undefined
  financeConfigBefore: FinanceConfig
  now: number
}

export interface DecideCeoApprovalPlan {
  decidedAt: string
  mainStatus: 'approved' | 'refused'
  mainAudit: { action: string; target: string; detail: string; severity: 'critical' }
  /** Approve + emd_forfeiture + still awaiting: adapter marks it applied and
   *  calls `helpers.applyForfeiture(record)`. */
  applyForfeitureRecord: EmdForfeiture | null
  /** Refuse + emd_forfeiture + still awaiting: adapter calls the real
   *  `get().waiveEmdForfeiture(forfeitureId, reason)` action. */
  waiveForfeiture: { forfeitureId: string; reason: string } | null
  /** refund + still awaiting: adapter sets the refund's status directly (this
   *  is a decision, not a payment — `processRefund` still has to run after). */
  refundOutcome: { refundId: string; status: 'approved' | 'rejected' } | null
  /** fee_change + approved + payload present: adapter merges `payload` into
   *  the live `financeConfig` and audits the exact before → after values. */
  feeChange: { payload: Partial<FinanceConfig>; audit: { action: string; target: string; detail: string; severity: 'critical' } } | null
  /** permanent_ban + approved: adapter sets the user's standing. */
  banUserId: string | null
  blacklistReason: string | undefined
  finalNotification: NotificationPlan & { userId: string }
}

export function planDecideCeoApproval(
  approve: boolean,
  note: string | undefined,
  ctx: DecideCeoApprovalContext,
): DecideCeoApprovalPlan | null {
  if (!ctx.canSign) return null
  const req = ctx.req
  if (!req || (req.status !== 'pending' && req.status !== 'info_requested')) return null
  const at = new Date(ctx.now).toISOString()

  // A signature completes the movement it was holding, or releases it.
  let applyForfeitureRecord: EmdForfeiture | null = null
  let waiveForfeiture: { forfeitureId: string; reason: string } | null = null
  if (req.kind === 'emd_forfeiture') {
    const record = ctx.emdForfeiture
    if (record && record.status === 'awaiting_ceo') {
      if (approve) applyForfeitureRecord = record
      else waiveForfeiture = { forfeitureId: record.id, reason: note || 'Refused at CEO sign-off — EMD released back to the buyer' }
    }
  }

  let refundOutcome: DecideCeoApprovalPlan['refundOutcome'] = null
  if (req.kind === 'refund') {
    const record = ctx.refund
    if (record && record.status === 'awaiting_ceo') {
      refundOutcome = { refundId: record.id, status: approve ? 'approved' : 'rejected' }
    }
  }

  // A fee change is the one kind where the signature *is* the change: the
  // proposed rates are held on the request and never touch the config until
  // they are signed, so no sale is ever priced by an unapproved rate.
  let feeChange: DecideCeoApprovalPlan['feeChange'] = null
  if (req.kind === 'fee_change' && approve && req.payload) {
    const before = ctx.financeConfigBefore
    const payload = req.payload as Partial<FinanceConfig>
    const changed = (Object.keys(payload) as (keyof FinanceConfig)[])
      .map((k) => `${k} ${String(before[k])} → ${String(payload[k])}`)
      .join(', ')
    feeChange = { payload, audit: { action: 'config.fee_change', target: 'Financial configuration', detail: `Signed by the CEO — ${changed}`, severity: 'critical' } }
  }

  // A ban closes the account's standing; it is never deleted, so the
  // history behind the decision stays readable.
  const banUserId = req.kind === 'permanent_ban' && approve ? req.refId : null

  return {
    decidedAt: at,
    mainStatus: approve ? 'approved' : 'refused',
    mainAudit: { action: approve ? 'ceo.approve' : 'ceo.refuse', target: req.summary, detail: `${inr(req.amount)}${note ? ` — ${note}` : ''}`, severity: 'critical' },
    applyForfeitureRecord,
    waiveForfeiture,
    refundOutcome,
    feeChange,
    banUserId,
    blacklistReason: note || req.reason,
    // 'auction_publish' applies nothing here by design — the catalogue is
    // still Operations' to publish. The signature only removes the block.
    finalNotification: { userId: req.requestedBy, kind: 'system', title: approve ? 'Signed off' : 'Refused', body: `${req.summary}${note ? ` — ${note}` : ''}`, href: CEO_REQUEST_HREF[req.kind] },
  }
}
