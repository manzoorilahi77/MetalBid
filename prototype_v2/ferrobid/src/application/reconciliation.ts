/* ---------------------------------------------------------------------------
   Application layer — bank-statement reconciliation: match/unmatch a line,
   flag a break, escalate a break. Moved verbatim from financeSlice.ts; no
   rule, threshold, or wording changed. See opsInspection.ts for the pattern.
--------------------------------------------------------------------------- */
import { inr } from '../lib/format'
import { checkAuth } from './authorization'
import type { BankStatementLine, Role } from '../types'
import type { NotificationPlan } from './opsInspection'

export interface BankLineContext {
  role: Role
  line: BankStatementLine | undefined
}

/* --------------------------------- matchBankLine -------------------------------- */

export interface MatchBankLinePlan {
  matchedAt: string
  audit: { action: string; target: string; detail: string }
}

export function planMatchBankLine(
  matchedTo: string,
  ctx: BankLineContext & { now: number },
): MatchBankLinePlan | null {
  if (checkAuth('matchBankLine', ctx.role)) return null
  const line = ctx.line
  if (!line) return null
  return {
    matchedAt: new Date(ctx.now).toISOString(),
    audit: { action: 'recon.match', target: line.ref, detail: `${line.direction === 'credit' ? 'Credit' : 'Debit'} of ${inr(line.amount)} matched to ${matchedTo}` },
  }
}

/* -------------------------------- unmatchBankLine -------------------------------- */

export interface UnmatchBankLinePlan {
  audit: { action: string; target: string; detail: string; severity: 'warning' }
}

export function planUnmatchBankLine(ctx: BankLineContext): UnmatchBankLinePlan | null {
  if (checkAuth('unmatchBankLine', ctx.role)) return null
  const line = ctx.line
  if (!line) return null
  return { audit: { action: 'recon.unmatch', target: line.ref, detail: `Match reversed on ${inr(line.amount)}`, severity: 'warning' } }
}

/* --------------------------------- flagBankBreak --------------------------------- */

export interface FlagBankBreakPlan {
  audit: { action: string; target: string; detail: string; severity: 'warning' }
}

export function planFlagBankBreak(note: string, ctx: BankLineContext): FlagBankBreakPlan | null {
  if (checkAuth('flagBankBreak', ctx.role)) return null
  const line = ctx.line
  if (!line) return null
  return { audit: { action: 'recon.break', target: line.ref, detail: `Break flagged on ${inr(line.amount)} — ${note}`, severity: 'warning' } }
}

/* ------------------------------- escalateBankBreak -------------------------------- */

export interface EscalateBankBreakPlan {
  audit: { action: string; target: string; detail: string; severity: 'critical' }
  notification: NotificationPlan
}

export function planEscalateBankBreak(ctx: BankLineContext): EscalateBankBreakPlan | null {
  if (checkAuth('escalateBankBreak', ctx.role)) return null
  const line = ctx.line
  if (!line) return null
  return {
    audit: { action: 'recon.escalate', target: line.ref, detail: `Break of ${inr(line.amount)} escalated — ${line.breakNote ?? 'no note'}`, severity: 'critical' },
    notification: { kind: 'system', title: 'Reconciliation break escalated', body: `${inr(line.amount)} on ${line.ref} — ${line.breakNote ?? 'unmatched'}`, href: '/finance/reconciliation' },
  }
}
