/* ---------------------------------------------------------------------------
   Application layer — buyer-initiated registration/eligibility actions:
   seller-KYC application, bank account registration, deposit claim, and the
   EMD-deadline exemption request. Moved verbatim from buyerSlice.ts; no rule,
   threshold, or wording changed. See opsInspection.ts for the pattern.
--------------------------------------------------------------------------- */
import { uid, inr } from '../lib/format'
import { maskAccountNumber } from '../store/constants'
import type { BankAccount, Catalogue, DepositClaim, EmdExemptionRequest, User } from '../types'
import type { NotificationPlan } from './opsInspection'

/* ---------------------------------- submitKyc -------------------------------- */

export interface SubmitKycContext {
  actor: User
}

export interface SubmitKycPlan {
  audit: { action: string; target: string; detail: string }
  selfNotification: NotificationPlan & { userId: string }
  opsNotification: NotificationPlan
}

export function planSubmitKyc(ctx: SubmitKycContext): SubmitKycPlan {
  const me = ctx.actor
  return {
    audit: { action: 'kyc.submit', target: me.firm, detail: `${me.name} applied to sell — GSTIN ${me.gstin || 'not given'}` },
    selfNotification: {
      userId: me.id, kind: 'system', title: 'Seller KYC submitted',
      body: 'Our team will verify your GSTIN and bank details within 1 business day.', href: '/buyer/kyc',
    },
    // The desk that has to act on it is told, rather than left to find it.
    opsNotification: {
      kind: 'system', title: `Seller verification — ${me.firm}`,
      body: `${me.name} applied to sell${me.gstin ? ` with GSTIN ${me.gstin}` : ''}. Verify before they can submit lots.`,
      href: '/sub/seller-verification',
    },
  }
}

/* ----------------------------- registerBankAccount ---------------------------- */

export interface RegisterBankAccountContext {
  actorId: string
  actorFirm: string
  now: number
}

export interface RegisterBankAccountPlan {
  account: BankAccount
  audit: { action: string; target: string; detail: string }
  notification: NotificationPlan
}

export function planRegisterBankAccount(
  bankName: string,
  accountNumber: string,
  ifsc: string,
  accountHolderName: string,
  ctx: RegisterBankAccountContext,
): RegisterBankAccountPlan {
  const { last4, masked } = maskAccountNumber(accountNumber)
  const acc: BankAccount = {
    id: uid('bank'), userId: ctx.actorId, bankName, ifsc, accountHolderName,
    last4, accountNumberMasked: masked, status: 'pending', createdAt: new Date(ctx.now).toISOString(),
  }
  return {
    account: acc,
    audit: { action: 'bankaccount.register', target: acc.id, detail: `${bankName} account ${masked} registered for verification` },
    // Verification is Finance's decision, so Finance is told it is waiting.
    notification: {
      kind: 'system', title: `Payout account to verify — ${ctx.actorFirm}`,
      body: `${bankName} ${masked}, held by ${accountHolderName}. Nothing can be withdrawn to it until you verify it.`,
      href: '/finance/bank-accounts',
    },
  }
}

/* ----------------------------- submitDepositClaim ------------------------------ */

export interface SubmitDepositClaimContext {
  actor: User | null
  existingUtrs: string[]
  now: number
}

export interface SubmitDepositClaimPlan {
  claim: DepositClaim
  audit: { action: string; target: string; detail: string }
  notification: NotificationPlan
}

export type SubmitDepositClaimResult =
  | { ok: true; plan: SubmitDepositClaimPlan }
  | { ok: false; error: string }

export function planSubmitDepositClaim(
  amount: number,
  utr: string,
  transferDate: string,
  proofFilename: string | undefined,
  ctx: SubmitDepositClaimContext,
): SubmitDepositClaimResult {
  const me = ctx.actor
  if (!me) return { ok: false, error: 'Sign in to submit a claim' }
  const norm = utr.trim().toLowerCase()
  if (!norm) return { ok: false, error: 'Enter the UTR / reference number' }
  if (ctx.existingUtrs.includes(norm)) return { ok: false, error: 'A claim with this reference already exists' }
  const claim: DepositClaim = {
    id: uid('dep'), userId: me.id, amount, utr: utr.trim(), transferDate, proofFilename,
    status: 'submitted', createdAt: new Date(ctx.now).toISOString(),
  }
  return {
    ok: true,
    plan: {
      claim,
      audit: { action: 'deposit.submit', target: claim.id, detail: `Deposit claim of ${inr(amount)} submitted — UTR ${claim.utr}` },
      // Nothing is credited until Finance matches it to the bank, so Finance
      // hears about it the moment the buyer claims it.
      notification: {
        kind: 'system', title: `Deposit claimed — ${inr(amount)}`,
        body: `${me.firm} · UTR ${claim.utr} dated ${transferDate}. Match it against the statement before crediting the wallet.`,
        href: '/finance/deposits',
      },
    },
  }
}

/* ---------------------------- requestEmdExemption ------------------------------ */

export interface RequestEmdExemptionContext {
  actor: User | null
  catalogue: Catalogue | undefined
  hasExisting: boolean
  now: number
}

export interface RequestEmdExemptionPlan {
  request: EmdExemptionRequest
  audit: { action: string; target: string; detail: string; severity: 'warning' }
  selfNotification: NotificationPlan & { userId: string }
  deskNotification: NotificationPlan
}

export type RequestEmdExemptionResult =
  | { ok: true; plan: RequestEmdExemptionPlan }
  | { ok: false; error: string }

export function planRequestEmdExemption(
  catalogueId: string,
  reason: string,
  ctx: RequestEmdExemptionContext,
): RequestEmdExemptionResult {
  const me = ctx.actor
  if (!me) return { ok: false, error: 'Sign in to request an exemption' }
  const cat = ctx.catalogue
  if (!cat) return { ok: false, error: 'Catalogue not found' }
  if (!reason.trim()) return { ok: false, error: 'Enter a reason for missing the EMD deadline' }
  if (ctx.hasExisting) return { ok: false, error: 'A request is already pending or approved for this catalogue' }
  const req: EmdExemptionRequest = {
    id: uid('exm'), buyerId: me.id, catalogueId, reason: reason.trim(),
    status: 'pending', createdAt: new Date(ctx.now).toISOString(),
  }
  return {
    ok: true,
    plan: {
      request: req,
      audit: { action: 'emd_exemption.request', target: cat.code, detail: `${me.firm} requested an EMD deadline exemption — ${req.reason}`, severity: 'warning' },
      selfNotification: {
        userId: me.id, kind: 'system', title: 'EMD exemption requested',
        body: `Your request for ${cat.code} is with the auction desk. You will be told either way before bidding opens.`,
        href: '/buyer/shortlist',
      },
      // This expires with the auction, so the three roles that can decide it
      // are told rather than left to find it on a queue.
      deskNotification: { kind: 'system', title: `EMD exemption — ${me.firm}`, body: `${cat.code} · ${req.reason}`, href: '/auction/emd-eligibility' },
    },
  }
}
