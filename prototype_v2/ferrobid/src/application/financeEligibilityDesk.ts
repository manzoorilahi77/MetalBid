/* ---------------------------------------------------------------------------
   Application layer — the buyer eligibility and bank/deposit administration
   actions that live on auctionFloorSlice.ts alongside the live bid ladder,
   even though none of them touch it. Moved verbatim; no rule, threshold, or
   wording changed. Structurally identical in shape to the phase 13 finance
   batch (financeSettlement.ts, refunds.ts, invoicing.ts, reconciliation.ts) —
   just filed under a different slice in the original code.

   issueDemandDraft's paid-amount sum was hand-rolled as
   `materialValue + gstAmount + tcsAmount` in the original, identical to what
   confirmBuyerPayment did before phase 5 routed it through the existing
   `doDue()` in lib/money.ts. Routed through `doDue()` here too — see the
   phase 16c consolidation note in this application layer's test suite for
   the equivalence proof.
--------------------------------------------------------------------------- */
import { uid, inr } from '../lib/format'
import { doDue } from '../lib/money'
import { FINANCE_ROLES } from '../store/constants'
import { checkAuth } from './authorization'
import type {
  BankAccount, CompanyBankAccount, Catalogue, DemandDraft, DeliveryOrder, DepositClaim,
  EmdExemptionRequest, Lot, Role,
} from '../types'
import type { NotificationPlan } from './opsInspection'

/* ------------------------------ issueDemandDraft ------------------------------ */

export interface IssueDemandDraftInput {
  ddNumber: string
  issuingBank: string
  amount: number
}

export interface IssueDemandDraftContext {
  role: Role
  actorId: string | undefined
  actorName: string | undefined
  d: DeliveryOrder | undefined
  lot: Lot | undefined
  now: number
}

export interface IssueDemandDraftPlan {
  draft: DemandDraft
  paidAmount: number
  audit: { action: string; target: string; detail: string }
  buyerNotification: NotificationPlan & { userId: string }
  deskNotification: { roles: Role[]; plan: NotificationPlan }
}

export function planIssueDemandDraft(input: IssueDemandDraftInput, ctx: IssueDemandDraftContext): IssueDemandDraftPlan | null {
  const { role } = ctx
  if (checkAuth('issueDemandDraft', role)) return null
  const d = ctx.d
  if (!d || d.stage !== 'payment_pending') return null

  const draft: DemandDraft = {
    id: uid('dd'), doId: d.id, ddNumber: input.ddNumber, issuingBank: input.issuingBank, amount: input.amount,
    issuedAt: new Date(ctx.now).toISOString(), issuedBy: ctx.actorId ?? 'system',
  }
  const paidAmount = doDue(d)
  const lotNo = ctx.lot?.lotNo ?? d.id

  return {
    draft, paidAmount,
    audit: { action: 'dd.issue', target: lotNo, detail: `Demand Draft ${input.ddNumber} (${input.issuingBank}) for ${inr(input.amount)} recorded` },
    buyerNotification: {
      userId: d.buyerId, kind: 'wallet', title: `Payment recorded — ${lotNo}`,
      body: `Demand Draft ${input.ddNumber} for ${inr(input.amount)} is on the record. Lifting can be scheduled.`,
      href: '/buyer/auction-status',
    },
    deskNotification: {
      roles: FINANCE_ROLES.includes(role) ? ['exec_manager', 'sub_admin'] : ['finance_admin'],
      plan: {
        kind: 'system', title: `Demand Draft recorded — ${lotNo}`,
        body: `${input.ddNumber} (${input.issuingBank}) for ${inr(input.amount)}, recorded by ${ctx.actorName ?? 'a colleague'}.`,
        href: FINANCE_ROLES.includes(role) ? '/exec/logistics' : '/finance/payments',
      },
    },
  }
}

/* ------------------------------ bank account verify/reject ------------------------------ */

export interface BankAccountContext {
  role: Role
  a: BankAccount | undefined
}

export interface VerifyBankAccountPlan {
  audit: { action: string; target: string; detail: string }
  notification: NotificationPlan & { userId: string }
}

export function planVerifyBankAccount(id: string, ctx: BankAccountContext): VerifyBankAccountPlan | null {
  if (checkAuth('verifyBankAccount', ctx.role)) return null
  const a = ctx.a
  if (!a || a.status !== 'pending') return null
  return {
    audit: { action: 'bankaccount.verify', target: id, detail: `${a.bankName} account •••• ${a.last4} verified` },
    notification: { userId: a.userId, kind: 'wallet', title: 'Bank account verified', body: `${a.bankName} •••• ${a.last4} can now receive withdrawals.`, href: '/buyer/wallet' },
  }
}

export interface RejectBankAccountPlan {
  audit: { action: string; target: string; detail: string; severity: 'warning' }
  notification: NotificationPlan & { userId: string }
}

export function planRejectBankAccount(id: string, reason: string | undefined, ctx: BankAccountContext): RejectBankAccountPlan | null {
  if (checkAuth('rejectBankAccount', ctx.role)) return null
  const a = ctx.a
  if (!a || a.status !== 'pending') return null
  return {
    audit: { action: 'bankaccount.reject', target: id, detail: `${a.bankName} account •••• ${a.last4} rejected${reason ? ` — ${reason}` : ''}`, severity: 'warning' },
    notification: { userId: a.userId, kind: 'wallet', title: 'Bank account rejected', body: reason || 'Please re-register with correct details.', href: '/buyer/wallet' },
  }
}

/* ------------------------------ deposit claim approve/reject ------------------------------ */

export interface DepositClaimContext {
  role: Role
  claim: DepositClaim | undefined
  actorId: string | undefined
  now: number
}

export interface ApproveDepositClaimPlan {
  decidedAt: string
  ledgerEntry: { amount: number; ref: string; note: string }
  audit: { action: string; target: string; detail: string }
  notification: NotificationPlan & { userId: string }
}

export function planApproveDepositClaim(id: string, ctx: DepositClaimContext): ApproveDepositClaimPlan | null {
  if (checkAuth('approveDepositClaim', ctx.role)) return null
  const claim = ctx.claim
  if (!claim || claim.status !== 'submitted') return null
  const decidedAt = new Date(ctx.now).toISOString()
  return {
    decidedAt,
    ledgerEntry: { amount: claim.amount, ref: claim.utr, note: `Deposit claim approved — UTR ${claim.utr}` },
    audit: { action: 'deposit.approve', target: id, detail: `Deposit claim approved — ${inr(claim.amount)} credited (UTR ${claim.utr})` },
    notification: { userId: claim.userId, kind: 'wallet', title: 'Deposit approved', body: `${inr(claim.amount)} credited to your wallet.`, href: '/buyer/wallet' },
  }
}

export interface RejectDepositClaimPlan {
  decidedAt: string
  audit: { action: string; target: string; detail: string; severity: 'warning' }
  notification: NotificationPlan & { userId: string }
}

export function planRejectDepositClaim(id: string, reason: string | undefined, ctx: DepositClaimContext): RejectDepositClaimPlan | null {
  if (checkAuth('rejectDepositClaim', ctx.role)) return null
  const claim = ctx.claim
  if (!claim || claim.status !== 'submitted') return null
  return {
    decidedAt: new Date(ctx.now).toISOString(),
    audit: { action: 'deposit.reject', target: id, detail: `Deposit claim rejected${reason ? ` — ${reason}` : ''}`, severity: 'warning' },
    notification: { userId: claim.userId, kind: 'wallet', title: 'Deposit claim rejected', body: reason || 'Contact support for details.', href: '/buyer/wallet' },
  }
}

/* ------------------------------ EMD exemption approve/reject ------------------------------ */

export interface EmdExemptionContext {
  role: Role
  req: EmdExemptionRequest | undefined
  cat: Catalogue | undefined
  actorId: string | undefined
  now: number
}

export interface ApproveEmdExemptionPlan {
  decidedAt: string
  audit: { action: string; target: string; detail: string; severity: 'warning' }
  notification: NotificationPlan & { userId: string }
}

export function planApproveEmdExemption(ctx: EmdExemptionContext): ApproveEmdExemptionPlan | null {
  // An eligibility call, not a payment one — Finance sees it, never decides it.
  if (checkAuth('approveEmdExemption', ctx.role)) return null
  const req = ctx.req
  if (!req || req.status !== 'pending') return null
  const catCode = ctx.cat?.code ?? req.catalogueId
  return {
    decidedAt: new Date(ctx.now).toISOString(),
    audit: { action: 'emd_exemption.approve', target: catCode, detail: 'EMD deadline exemption approved for buyer', severity: 'warning' },
    notification: { userId: req.buyerId, kind: 'system', title: 'EMD exemption approved', body: `You can now fund EMD for ${catCode} and join the auction.`, href: '/buyer/shortlist' },
  }
}

export interface RejectEmdExemptionPlan {
  decidedAt: string
  audit: { action: string; target: string; detail: string; severity: 'warning' }
  notification: NotificationPlan & { userId: string }
}

export function planRejectEmdExemption(reason: string | undefined, ctx: EmdExemptionContext): RejectEmdExemptionPlan | null {
  if (checkAuth('rejectEmdExemption', ctx.role)) return null
  const req = ctx.req
  if (!req || req.status !== 'pending') return null
  const catCode = ctx.cat?.code ?? req.catalogueId
  return {
    decidedAt: new Date(ctx.now).toISOString(),
    audit: { action: 'emd_exemption.reject', target: catCode, detail: `EMD deadline exemption rejected${reason ? ` — ${reason}` : ''}`, severity: 'warning' },
    notification: { userId: req.buyerId, kind: 'system', title: 'EMD exemption rejected', body: reason || `Your request for ${catCode} was not approved.`, href: '/buyer/shortlist' },
  }
}

/* ------------------------------ company bank accounts ------------------------------ */

export interface SetCompanyBankAccountsPlan {
  audit: { action: string; target: string; detail: string }
}

export function planSetCompanyBankAccounts(accounts: CompanyBankAccount[], role: Role): SetCompanyBankAccountsPlan | null {
  if (checkAuth('setCompanyBankAccounts', role)) return null
  return { audit: { action: 'companybank.update', target: 'company_bank_accounts', detail: `Company bank account list updated — ${accounts.length} account(s)` } }
}
