/* ---------------------------------------------------------------------------
   Phase 29 — the shared authorization primitive and registry for every ad hoc
   "if role not in X, refuse" check found across application/*.ts and the
   store slices (excluding the nine lot-status writers, already centralized
   in lotTransitions.ts's LOT_WRITER_RULES — that table now delegates its own
   role check to checkRole below, so there is one comparison happening
   everywhere, not two parallel mechanisms).

   checkRole is the one primitive: given an allowed role list, the caller's
   role, and the exact message this check has always returned, it returns
   that message or null. AUTH_RULES is a registry of every such check found,
   each entry's role list and message copied verbatim from where it lived —
   this is a DRY consolidation of the CHECK LOGIC, not a re-decision of who
   may do what. Two calling conventions coexist because the codebase already
   had two before this phase: most plan functions receive `ctx.role` directly
   and check it inline; a pre-existing minority (23 super-admin-only actions)
   receive a pre-computed `permissionError` from the store's own
   `requireSuperAdmin()` helper. Both now resolve through this same registry
   entry ('changePlatformShape') — see store/internal.ts.

   Deliberately excluded, and left exactly as they were (documented, not
   silently reshaped):
   - Compound eligibility rules where a role check is ANDed/ORed with a
     non-role condition (refunds.ts raiseRefund's disputeId carve-out,
     emdForfeiture.ts's ceoQueueAuthorized bypass, deliveryHandover.ts's
     buyer-or-staff checks, lotSubmission.ts's KYC-tied gate) — forcing these
     through a single role-list check would either lose the compound
     condition or bloat this primitive into a rule DSL for one caller each.
   - accountDetails.ts/accountLifecycle.ts's super-admin-escalation guard
     (only another Super Admin may edit/change a Super Admin account) — this
     checks the *target* account's role against the actor's, not a plain
     role-membership gate, so it does not fit this primitive's shape either.
   - The permanently-excluded live-sale floor controls (pauseCatalogue,
     resumeCatalogue, extendCatalogue, cancelCatalogue, voidBid) — per
     CLAUDE.md's standing exclusions, not touched by any phase in this
     methodology regardless of how ad hoc their role checks look.
--------------------------------------------------------------------------- */
import type { Role } from '../types'

export function checkRole(roles: Role[], role: Role, error: string): string | null {
  return roles.includes(role) ? null : error
}

export type AuthCheckKey =
  | 'sendAnnouncement' | 'submitContentDraft' | 'changePlatformShape' | 'setFinanceConfig'
  | 'closeDispute' | 'replyToDispute' | 'forfeitEmd'
  | 'issueDemandDraft' | 'verifyBankAccount' | 'rejectBankAccount' | 'approveDepositClaim' | 'rejectDepositClaim'
  | 'approveEmdExemption' | 'rejectEmdExemption' | 'setCompanyBankAccounts'
  | 'confirmBuyerPayment' | 'confirmCommissionSettlement' | 'queryCommissionSettlement' | 'flagOverduePayment'
  | 'issueInvoice' | 'reissueInvoice' | 'cancelInvoice'
  | 'decideSellerKyc' | 'confirmHandover'
  | 'matchBankLine' | 'unmatchBankLine' | 'flagBankBreak' | 'escalateBankBreak'
  | 'decideRefund' | 'processRefund'
  | 'setSellerLotDecision' | 'recordCommissionSettlement'
  | 'reviewAction' | 'setUserStanding'
  | 'approveWithdrawal' | 'processWithdrawal' | 'failWithdrawal' | 'setWithdrawalWindow'
  | 'administerAccounts' | 'resetUserPassword'
  | 'ceoOnly' | 'submitTestimonial' | 'moderateTestimonial'
  | 'rescheduleCatalogue' | 'returnCatalogueToOps' | 'requestCancellation' | 'decideCancellationRequest'
  | 'flagBid' | 'requestBidVoid' | 'dismissBidFlag' | 'decideBidVoidRequest'
  | 'confirmAuctionResults' | 'referStaLot'
  | 'claimWorkItem'

export interface AuthRule {
  roles: Role[]
  error: string
}

const NOT_PERMITTED = 'Not permitted for this role'
const FINANCE_ROLES: Role[] = ['finance_admin', 'super_admin']
const SUB_ADMIN_ROLES: Role[] = ['sub_admin', 'super_admin']
const SUPPORT_ROLES: Role[] = ['sub_admin', 'exec_manager', 'super_admin']
const LOT_GATE_ROLES: Role[] = ['exec_manager', 'sub_admin', 'super_admin']
const PUBLISH_ROLES: Role[] = ['auction_manager', 'exec_manager', 'sub_admin', 'super_admin']
const AUCTION_FLOOR_ROLES: Role[] = ['auction_manager', 'sub_admin', 'super_admin']
const SURVEILLANCE_ROLES: Role[] = ['auction_manager', 'sub_admin', 'super_admin']
const RESULT_ROLES: Role[] = ['auction_manager', 'sub_admin', 'super_admin']
const ANNOUNCE_ROLES: Role[] = ['auction_manager', 'exec_manager', 'sub_admin', 'super_admin']

export const AUTH_RULES: Record<AuthCheckKey, AuthRule> = {
  sendAnnouncement: { roles: ANNOUNCE_ROLES, error: NOT_PERMITTED },
  submitContentDraft: { roles: SUB_ADMIN_ROLES, error: 'Only a Sub Admin drafts platform copy' },
  changePlatformShape: { roles: ['super_admin'], error: 'Only a Super Admin can change the shape of the platform' },
  setFinanceConfig: { roles: ['super_admin'], error: 'Only a Super Admin sets the financial configuration' },
  closeDispute: { roles: SUPPORT_ROLES, error: 'Only the support desk closes a ticket' },
  replyToDispute: { roles: SUPPORT_ROLES, error: 'Only the support desk replies on a ticket' },
  forfeitEmd: { roles: FINANCE_ROLES, error: 'Only Finance can forfeit an EMD' },
  issueDemandDraft: { roles: ['finance_admin', 'super_admin', 'sub_admin', 'exec_manager'], error: 'Only Finance, Operations or a Sub Admin issues a Demand Draft' },
  verifyBankAccount: { roles: FINANCE_ROLES, error: 'Only Finance verifies a bank account' },
  rejectBankAccount: { roles: FINANCE_ROLES, error: 'Only Finance rejects a bank account' },
  approveDepositClaim: { roles: FINANCE_ROLES, error: 'Only Finance approves a deposit claim' },
  rejectDepositClaim: { roles: FINANCE_ROLES, error: 'Only Finance rejects a deposit claim' },
  approveEmdExemption: { roles: PUBLISH_ROLES, error: 'Not permitted for this role' },
  rejectEmdExemption: { roles: PUBLISH_ROLES, error: 'Not permitted for this role' },
  setCompanyBankAccounts: { roles: ['super_admin'], error: 'Only a Super Admin sets the company bank accounts' },
  confirmBuyerPayment: { roles: FINANCE_ROLES, error: 'Only Finance can confirm a receipt' },
  confirmCommissionSettlement: { roles: FINANCE_ROLES, error: 'Only Finance can confirm a settlement' },
  queryCommissionSettlement: { roles: FINANCE_ROLES, error: 'Only Finance queries a commission settlement' },
  flagOverduePayment: { roles: FINANCE_ROLES, error: 'Only Finance flags an overdue payment' },
  issueInvoice: { roles: FINANCE_ROLES, error: 'Only Finance issues an invoice' },
  reissueInvoice: { roles: FINANCE_ROLES, error: 'Only Finance reissues an invoice' },
  cancelInvoice: { roles: FINANCE_ROLES, error: 'Only Finance cancels an invoice' },
  decideSellerKyc: { roles: LOT_GATE_ROLES, error: 'Only Operations or a Sub Admin verifies a seller' },
  confirmHandover: { roles: LOT_GATE_ROLES, error: 'Only Operations or a Sub Admin closes a handover' },
  matchBankLine: { roles: FINANCE_ROLES, error: 'Only Finance matches a bank line' },
  unmatchBankLine: { roles: FINANCE_ROLES, error: 'Only Finance unmatches a bank line' },
  flagBankBreak: { roles: FINANCE_ROLES, error: 'Only Finance flags a bank break' },
  escalateBankBreak: { roles: FINANCE_ROLES, error: 'Only Finance escalates a bank break' },
  decideRefund: { roles: FINANCE_ROLES, error: 'Only Finance decides a refund' },
  processRefund: { roles: FINANCE_ROLES, error: 'Only Finance can process a refund' },
  setSellerLotDecision: { roles: ['seller'], error: 'Only a seller decides on their own cleared price' },
  recordCommissionSettlement: { roles: ['seller'], error: 'Only a seller records their own commission settlement' },
  reviewAction: { roles: SUB_ADMIN_ROLES, error: 'Only a Sub Admin reviews another role\'s work' },
  setUserStanding: { roles: SUB_ADMIN_ROLES, error: 'Only a Sub Admin or Super Admin changes account standing' },
  approveWithdrawal: { roles: FINANCE_ROLES, error: 'Only Finance approves a withdrawal' },
  processWithdrawal: { roles: FINANCE_ROLES, error: 'Only Finance processes a withdrawal' },
  failWithdrawal: { roles: FINANCE_ROLES, error: 'Only Finance fails a withdrawal' },
  setWithdrawalWindow: { roles: ['super_admin'], error: 'Only a Super Admin sets the withdrawal window' },
  administerAccounts: { roles: SUB_ADMIN_ROLES, error: 'Accounts are administered by a Sub Admin or a Super Admin' },
  resetUserPassword: { roles: SUB_ADMIN_ROLES, error: 'Passwords are reset by a Sub Admin or a Super Admin' },
  ceoOnly: { roles: ['ceo'], error: 'Only the CEO can hand this queue to someone else.' },
  submitTestimonial: { roles: ['buyer', 'seller'], error: 'Only a buyer or seller account can submit a testimonial' },
  moderateTestimonial: { roles: SUB_ADMIN_ROLES, error: 'Only a Sub Admin moderates testimonials' },
  rescheduleCatalogue: { roles: PUBLISH_ROLES, error: NOT_PERMITTED },
  returnCatalogueToOps: { roles: PUBLISH_ROLES, error: NOT_PERMITTED },
  requestCancellation: { roles: AUCTION_FLOOR_ROLES, error: NOT_PERMITTED },
  decideCancellationRequest: { roles: ['super_admin'], error: NOT_PERMITTED },
  flagBid: { roles: SURVEILLANCE_ROLES, error: NOT_PERMITTED },
  requestBidVoid: { roles: SURVEILLANCE_ROLES, error: NOT_PERMITTED },
  dismissBidFlag: { roles: SURVEILLANCE_ROLES, error: NOT_PERMITTED },
  decideBidVoidRequest: { roles: ['super_admin'], error: NOT_PERMITTED },
  confirmAuctionResults: { roles: RESULT_ROLES, error: NOT_PERMITTED },
  referStaLot: { roles: RESULT_ROLES, error: NOT_PERMITTED },
  claimWorkItem: { roles: SUB_ADMIN_ROLES, error: 'Only a Sub Admin claims from this board' },
}

/** Returns the registered error for this check, or null if the role is
 *  allowed. Void-return and null-return call sites simply discard the
 *  message on failure, same as they always did — this only centralizes the
 *  role-membership comparison and its exact wording. */
export function checkAuth(key: AuthCheckKey, role: Role): string | null {
  const rule = AUTH_RULES[key]
  return checkRole(rule.roles, role, rule.error)
}
