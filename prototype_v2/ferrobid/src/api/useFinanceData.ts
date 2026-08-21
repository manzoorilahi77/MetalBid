/* ---------------------------------------------------------------------------
   Fetches the Finance Administrator's workspace and replaces those store slices.

   Unscoped like exec and auction, so replacing is correct throughout. Wallets
   are replaced rather than merged here — unlike useAuctionData — because this
   endpoint returns them WITH their ledger entries: the EMD ledger screen is a
   line-by-line audit, so the server's answer is complete and a merge would only
   let stale seeded entries survive beside it.
--------------------------------------------------------------------------- */
import { useEffect, useState } from 'react'
import { apiGet, ApiError } from './client'
import { hydrateStore } from './persist'
import type {
  AuditEvent, BankAccount, BankStatementLine, BuyerLotSelection, Catalogue,
  CeoApprovalRequest, CommissionSettlement, CompanyBankAccount, DeliveryOrder, DepositClaim,
  EmdForfeiture, FinanceConfig, Invoice, Lot, RefundRequest, User, Wallet,
  WithdrawalRequest, WithdrawalWindowConfig,
} from '../types'

interface FinancePayload {
  serverTime: string
  catalogues: Catalogue[]
  lots: Lot[]
  users: Partial<User>[]
  deliveryOrders: DeliveryOrder[]
  selections: BuyerLotSelection[]
  wallets: Wallet[]
  bankAccounts: BankAccount[]
  companyBankAccounts: CompanyBankAccount[]
  depositClaims: DepositClaim[]
  withdrawalRequests: WithdrawalRequest[]
  refundRequests: RefundRequest[]
  emdForfeitures: EmdForfeiture[]
  invoices: Invoice[]
  bankStatementLines: BankStatementLine[]
  commissionSettlements: CommissionSettlement[]
  ceoApprovals: CeoApprovalRequest[]
  auditEvents: AuditEvent[]
  financeConfig: FinanceConfig | null
  withdrawalWindow: WithdrawalWindowConfig | null
}

function mergeById<T extends { id: string }>(seeded: T[], incoming: Partial<T>[]): T[] {
  const byId = new Map(seeded.map((r) => [r.id, r]))
  for (const row of incoming) {
    const existing = byId.get(row.id as string)
    byId.set(row.id as string, (existing ? { ...existing, ...row } : row) as T)
  }
  return [...byId.values()]
}

export type FinanceDataState = { loading: boolean; error: string | null; source: 'api' | 'seed' }

export function useFinanceData(): FinanceDataState {
  const [state, setState] = useState<FinanceDataState>({ loading: true, error: null, source: 'seed' })

  useEffect(() => {
    const ac = new AbortController()
    apiGet<FinancePayload>('/api/finance', ac.signal)
      .then((d) => {
        hydrateStore((s) => ({
          catalogues: d.catalogues,
          lots: d.lots,
          deliveryOrders: d.deliveryOrders,
          selections: d.selections,
          wallets: d.wallets,
          bankAccounts: d.bankAccounts,
          companyBankAccounts: d.companyBankAccounts,
          depositClaims: d.depositClaims,
          withdrawalRequests: d.withdrawalRequests,
          refundRequests: d.refundRequests,
          emdForfeitures: d.emdForfeitures,
          invoices: d.invoices,
          bankStatementLines: d.bankStatementLines,
          commissionSettlements: d.commissionSettlements,
          ceoApprovals: d.ceoApprovals,
          auditEvents: d.auditEvents,
          users: mergeById(s.users, d.users as Partial<User>[]),
          ...(d.financeConfig ? { financeConfig: d.financeConfig } : {}),
          ...(d.withdrawalWindow ? { withdrawalWindow: d.withdrawalWindow } : {}),
        }))
        setState({ loading: false, error: null, source: 'api' })
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return
        setState({
          loading: false,
          source: 'seed',
          error: err instanceof ApiError ? err.message : 'Failed to load the books',
        })
      })
    return () => ac.abort()
  }, [])

  return state
}
