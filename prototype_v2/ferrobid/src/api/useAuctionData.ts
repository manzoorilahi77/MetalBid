/* ---------------------------------------------------------------------------
   Fetches the Auction Manager's workspace and replaces those store slices.

   Like useExecData this endpoint is unscoped — every catalogue, lot, bid and
   escalation — so replacing is correct and makes the screens show exactly what
   is in the database.

   Wallets are the exception, and the reason is worth keeping. This endpoint
   returns wallets for EMD eligibility, which needs balances but not statements,
   so every wallet arrives with `ledger: []`. Replacing wholesale would blank the
   ledgers that useBuyerData or useFinanceData had already loaded — the Wallet
   and EMD Ledger screens would go empty the moment someone visited an auction
   page. So wallets merge by userId, and an incoming empty ledger is treated as
   "not fetched" rather than "no entries".
--------------------------------------------------------------------------- */
import { useEffect, useState } from 'react'
import { apiGet, ApiError } from './client'
import { hydrateStore } from './persist'
import type {
  Announcement, Bid, BidVoidRequest, BuyerLotSelection, CancellationRequest, Catalogue,
  EmdExemptionRequest, Lot, ResultConfirmation, StaReferral, TermsSet, User, Wallet,
} from '../types'

interface AuctionPayload {
  serverTime: string
  catalogues: Catalogue[]
  lots: Lot[]
  bids: Bid[]
  users: Partial<User>[]
  termsSets: TermsSet[]
  selections: BuyerLotSelection[]
  wallets: Wallet[]
  announcements: Announcement[]
  cancellationRequests: CancellationRequest[]
  bidVoidRequests: BidVoidRequest[]
  resultConfirmations: ResultConfirmation[]
  staReferrals: StaReferral[]
  emdExemptionRequests: EmdExemptionRequest[]
}

function mergeById<T extends { id: string }>(seeded: T[], incoming: Partial<T>[]): T[] {
  const byId = new Map(seeded.map((r) => [r.id, r]))
  for (const row of incoming) {
    const existing = byId.get(row.id as string)
    byId.set(row.id as string, (existing ? { ...existing, ...row } : row) as T)
  }
  return [...byId.values()]
}

/** Balances from the server, ledgers from whatever already had them. */
function mergeWallets(seeded: Wallet[], incoming: Wallet[]): Wallet[] {
  const byUser = new Map(seeded.map((w) => [w.userId, w]))
  for (const w of incoming) {
    const existing = byUser.get(w.userId)
    byUser.set(w.userId, {
      ...w,
      ledger: w.ledger.length > 0 ? w.ledger : (existing?.ledger ?? []),
    })
  }
  return [...byUser.values()]
}

export type AuctionDataState = { loading: boolean; error: string | null; source: 'api' | 'seed' }

export function useAuctionData(): AuctionDataState {
  const [state, setState] = useState<AuctionDataState>({ loading: true, error: null, source: 'seed' })

  useEffect(() => {
    const ac = new AbortController()
    apiGet<AuctionPayload>('/api/auction', ac.signal)
      .then((d) => {
        hydrateStore((s) => ({
          catalogues: d.catalogues,
          lots: d.lots,
          bids: d.bids,
          termsSets: d.termsSets,
          selections: d.selections,
          announcements: d.announcements,
          cancellationRequests: d.cancellationRequests,
          bidVoidRequests: d.bidVoidRequests,
          resultConfirmations: d.resultConfirmations,
          staReferrals: d.staReferrals,
          emdExemptionRequests: d.emdExemptionRequests,
          wallets: mergeWallets(s.wallets, d.wallets),
          users: mergeById(s.users, d.users as Partial<User>[]),
        }))
        setState({ loading: false, error: null, source: 'api' })
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return
        setState({
          loading: false,
          source: 'seed',
          error: err instanceof ApiError ? err.message : 'Failed to load the auction floor',
        })
      })
    return () => ac.abort()
  }, [])

  return state
}
