/* ---------------------------------------------------------------------------
   Application layer — the Super Admin financial-configuration desk (rates,
   thresholds, CEO sign-off cut-offs). Moved verbatim from financeSlice.ts's
   setFinanceConfig; no rule, threshold, or wording changed. See
   opsInspection.ts for the pattern.
--------------------------------------------------------------------------- */
import { FINANCE_FIELD_LABEL } from '../store/constants'
import type { FinanceConfig, Role, StructuralChangeKind } from '../types'

export interface SetFinanceConfigContext {
  role: Role
  before: FinanceConfig
}

export interface SetFinanceConfigPlan {
  next: FinanceConfig
  audit: { action: string; target: string; detail: string; severity: 'warning' }
  structural: { kind: StructuralChangeKind; target: string; summary: string; before: string; after: string }
}

export function planSetFinanceConfig(
  patch: Partial<FinanceConfig>,
  ctx: SetFinanceConfigContext,
): SetFinanceConfigPlan | null {
  if (ctx.role !== 'super_admin') return null
  const before = ctx.before
  const next = { ...before, ...patch }
  const moved = (Object.keys(patch) as (keyof FinanceConfig)[]).filter((k) => before[k] !== next[k])
  const changed = moved.map((k) => `${FINANCE_FIELD_LABEL[k]}: ${before[k]} → ${next[k]}`)
  if (changed.length === 0) return null
  return {
    next,
    audit: { action: 'finance.config', target: 'financial_configuration', detail: changed.join(' · '), severity: 'warning' },
    /* Recorded with no snapshot on purpose. A rate is not structure: the fee
       half only moves on the CEO's signature, and putting one back is itself
       a rate change needing the same signature. So Change history answers
       "what changed, when and by whom", and Financial config stays the one
       place a rate is actually set. */
    structural: {
      kind: 'config.update', target: 'Financial configuration',
      summary: `${moved.map((k) => FINANCE_FIELD_LABEL[k]).join(', ')} changed. Every screen reading these figures moved at the same moment.`,
      before: moved.map((k) => `${FINANCE_FIELD_LABEL[k]} ${before[k]}`).join(' · '),
      after: moved.map((k) => `${FINANCE_FIELD_LABEL[k]} ${next[k]}`).join(' · '),
    },
  }
}
