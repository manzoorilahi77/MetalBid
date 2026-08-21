/* ---------------------------------------------------------------------------
   Fetches the signed-in buyer's workspace and merges it into the store.

   Three different merge rules apply here, because "server wins" is only correct
   for some of these slices:

   1. Reference data (catalogues, lots, sellers, terms) — merge by id, server
      wins. These are shared rows the buyer only reads.

   2. The buyer's own records (wallet, watchlist, shortlists, auto-bids,
      delivery orders, EMD exemptions) — REPLACE this buyer's rows wholesale.
      The server is authoritative for them, so a row it did not return is a row
      that no longer exists; merging by id would resurrect deleted shortlists.
      Rows belonging to other users are left untouched.

   3. Bids — the buyer's own bids merge by id, but rival bids are only inserted
      when absent. The API pseudonymises rival bidder ids (see server
      src/api/buyer.mjs), which is right for an endpoint with no auth in front
      of it, but those tokens must not overwrite the real ids that the seeded
      Auction Manager and Sub Admin screens still read. Rank is computed per
      lot from rates, so pseudonymous rivals rank identically either way.

   The store starts empty, so an unreachable API means empty screens and the
   layout's "server not connected" notice — never fixture data.
--------------------------------------------------------------------------- */
import { useEffect, useState } from 'react'
import { useStore } from '../store/store'
import { apiGet, ApiError } from './client'
import { hydrateStore } from './persist'
import type {
  AppNotification, AutoBidSetting, BankAccount, Bid, BuyerLotSelection, Catalogue,
  CompanyBankAccount, DeliveryOrder, DepositClaim, Dispute, EmdExemptionRequest,
  FinanceConfig, InspectionSlot, Lot, TermsSet, User, Wallet, WatchlistEntry,
  WithdrawalRequest, WithdrawalWindowConfig,
} from '../types'

interface BuyerPayload {
  serverTime: string
  buyerId: string
  wallet: Wallet
  watchlist: WatchlistEntry[]
  selections: BuyerLotSelection[]
  bids: Bid[]
  autoBids: AutoBidSetting[]
  emdExemptionRequests: EmdExemptionRequest[]
  deliveryOrders: DeliveryOrder[]
  termsSets: TermsSet[]
  catalogues: Catalogue[]
  lots: Lot[]
  users: Partial<User>[]
  notifications: AppNotification[]
  disputes: Dispute[]
  bankAccounts: BankAccount[]
  depositClaims: DepositClaim[]
  withdrawalRequests: WithdrawalRequest[]
  inspectionSlots: InspectionSlot[]
  companyBankAccounts: CompanyBankAccount[]
  withdrawalWindow: WithdrawalWindowConfig | null
  financeConfig: FinanceConfig | null
}

/** Shared reference rows: server wins, seeded rows without a counterpart stay. */
function mergeById<T extends { id: string }>(seeded: T[], incoming: Partial<T>[]): T[] {
  const byId = new Map(seeded.map((r) => [r.id, r]))
  for (const row of incoming) {
    const existing = byId.get(row.id as string)
    byId.set(row.id as string, (existing ? { ...existing, ...row } : row) as T)
  }
  return [...byId.values()]
}

/** The buyer's own rows: drop every row that belongs to them, then take the
 *  server's. Rows belonging to anyone else are preserved untouched. */
function replaceOwned<T>(seeded: T[], incoming: T[], isOwn: (row: T) => boolean): T[] {
  return [...seeded.filter((r) => !isOwn(r)), ...incoming]
}

export type BuyerDataState = { loading: boolean; error: string | null; source: 'api' | 'seed' }

export function useBuyerData(): BuyerDataState {
  const buyerId = useStore((s) => s.currentUser?.id)
  const [state, setState] = useState<BuyerDataState>({ loading: true, error: null, source: 'seed' })

  useEffect(() => {
    if (!buyerId) {
      setState({ loading: false, error: null, source: 'seed' })
      return
    }
    const ac = new AbortController()
    apiGet<BuyerPayload>(`/api/buyer/${encodeURIComponent(buyerId)}`, ac.signal)
      .then((d) => {
        hydrateStore((s) => {
          const knownBidIds = new Set(s.bids.map((b) => b.id))
          const ownBids = d.bids.filter((b) => b.bidderId === buyerId)
          const newRivalBids = d.bids.filter((b) => b.bidderId !== buyerId && !knownBidIds.has(b.id))

          return {
            /* 1 — shared reference data */
            catalogues: mergeById(s.catalogues, d.catalogues),
            lots: mergeById(s.lots, d.lots),
            users: mergeById(s.users, d.users as Partial<User>[]),
            termsSets: mergeById(s.termsSets, d.termsSets),

            /* 2 — the buyer's own records */
            wallets: replaceOwned(s.wallets, [d.wallet], (w) => w.userId === buyerId),
            watchlist: replaceOwned(s.watchlist, d.watchlist, (w) => w.buyerId === buyerId),
            selections: replaceOwned(s.selections, d.selections, (x) => x.buyerId === buyerId),
            autoBids: replaceOwned(s.autoBids, d.autoBids, (a) => a.buyerId === buyerId),
            deliveryOrders: replaceOwned(s.deliveryOrders, d.deliveryOrders, (o) => o.buyerId === buyerId),
            emdExemptionRequests: replaceOwned(
              s.emdExemptionRequests, d.emdExemptionRequests, (e) => e.buyerId === buyerId),

            /* 3 — bids: own by id, rivals only when new */
            bids: [...mergeById(s.bids, ownBids), ...newRivalBids],

            /* Wallet and Dashboard slices. Notifications are the exception to
               rule 2: the payload includes broadcasts addressed to nobody, so
               "rows belonging to this buyer" would not describe the set. They
               merge by id instead. */
            notifications: mergeById(s.notifications, d.notifications),
            disputes: replaceOwned(s.disputes, d.disputes, (x) => x.userId === buyerId),
            bankAccounts: replaceOwned(s.bankAccounts, d.bankAccounts, (x) => x.userId === buyerId),
            depositClaims: replaceOwned(s.depositClaims, d.depositClaims, (x) => x.userId === buyerId),
            withdrawalRequests: replaceOwned(
              s.withdrawalRequests, d.withdrawalRequests, (x) => x.userId === buyerId),
            inspectionSlots: replaceOwned(
              s.inspectionSlots, d.inspectionSlots ?? [], (x) => x.userId === buyerId),
            companyBankAccounts: mergeById(s.companyBankAccounts, d.companyBankAccounts),
            ...(d.withdrawalWindow ? { withdrawalWindow: d.withdrawalWindow } : {}),
            ...(d.financeConfig ? { financeConfig: d.financeConfig } : {}),
          }
        })
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
  }, [buyerId])

  return state
}
