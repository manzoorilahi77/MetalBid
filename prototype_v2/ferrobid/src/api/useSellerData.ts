/* ---------------------------------------------------------------------------
   Fetches the signed-in seller's workspace and merges it into the store.

   Same three-rule shape as useBuyerData, with one difference worth naming: the
   seller's LOTS are replaced wholesale, not merged. The endpoint returns every
   lot they own at any pipeline stage, so it is authoritative for that set — a
   lot it does not return is one they no longer own, and merging by id would
   leave a withdrawn lot sitting on their screen forever.

   Bids come back with real bidder ids here rather than the buyer endpoint's
   pseudonyms, because the seller screens map a bidder to their public bidder
   code and the payload carries nothing else about them. So bids merge by id
   normally, with no risk of overwriting real ids with tokens.

   As elsewhere, an unreachable API leaves the seeded data on screen.
--------------------------------------------------------------------------- */
import { useEffect, useState } from 'react'
import { useStore } from '../store/store'
import { apiGet, ApiError } from './client'
import { hydrateStore } from './persist'
import type {
  Bid, Catalogue, CommissionSettlement, CompanyBankAccount, FinanceConfig,
  InspectionReport, Lot, User,
} from '../types'

interface SellerPayload {
  serverTime: string
  sellerId: string
  lots: Lot[]
  catalogues: Catalogue[]
  bids: Bid[]
  inspectionReports: InspectionReport[]
  commissionSettlements: CommissionSettlement[]
  companyBankAccounts: CompanyBankAccount[]
  financeConfig: FinanceConfig | null
  users: Partial<User>[]
}

function mergeById<T extends { id: string }>(seeded: T[], incoming: Partial<T>[]): T[] {
  const byId = new Map(seeded.map((r) => [r.id, r]))
  for (const row of incoming) {
    const existing = byId.get(row.id as string)
    byId.set(row.id as string, (existing ? { ...existing, ...row } : row) as T)
  }
  return [...byId.values()]
}

function replaceOwned<T>(seeded: T[], incoming: T[], isOwn: (row: T) => boolean): T[] {
  return [...seeded.filter((r) => !isOwn(r)), ...incoming]
}

export type SellerDataState = { loading: boolean; error: string | null; source: 'api' | 'seed' }

export function useSellerData(): SellerDataState {
  const sellerId = useStore((s) => s.currentUser?.id)
  const [state, setState] = useState<SellerDataState>({ loading: true, error: null, source: 'seed' })

  useEffect(() => {
    if (!sellerId) {
      setState({ loading: false, error: null, source: 'seed' })
      return
    }
    const ac = new AbortController()
    apiGet<SellerPayload>(`/api/seller/${encodeURIComponent(sellerId)}`, ac.signal)
      .then((d) => {
        hydrateStore((s) => ({
          /* authoritative for everything this seller owns */
          lots: replaceOwned(s.lots, d.lots, (l) => l.sellerId === sellerId),
          commissionSettlements: replaceOwned(
            s.commissionSettlements, d.commissionSettlements, (c) => c.sellerId === sellerId),

          /* shared reference data */
          catalogues: mergeById(s.catalogues, d.catalogues),
          bids: mergeById(s.bids, d.bids),
          inspectionReports: mergeById(s.inspectionReports, d.inspectionReports),
          companyBankAccounts: mergeById(s.companyBankAccounts, d.companyBankAccounts),
          users: mergeById(s.users, d.users as Partial<User>[]),

          ...(d.financeConfig ? { financeConfig: d.financeConfig } : {}),
        }))
        setState({ loading: false, error: null, source: 'api' })
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return
        setState({
          loading: false,
          source: 'seed',
          error: err instanceof ApiError ? err.message : 'Failed to load your workspace',
        })
      })
    return () => ac.abort()
  }, [sellerId])

  return state
}
