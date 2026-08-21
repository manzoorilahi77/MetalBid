/* ---------------------------------------------------------------------------
   Sub Admin, Super Admin and CEO hydration.

   Kept in one file because the three payloads nest the same way the endpoints
   do — Super Admin is Sub Admin plus the platform's own structure — and three
   files would have hidden that behind three copies of the same merge logic.

   All three endpoints are unscoped, so their slices are replaced rather than
   merged: the server's answer is complete, and merging would only let stale
   seeded rows survive beside it. Wallets are safe to replace here (unlike
   useAuctionData) because these endpoints return them with their ledgers.

   One slice deserves care. `pageRegistry` is not ordinary data — the app builds
   both navigation bars from it, so replacing it rewrites the menus live. That
   is correct: the Super Admin's Page Manager edits those rows, and the whole
   point is that a rename or reorder takes effect. It does mean the nav renders
   from the seeded registry until this fetch resolves, then re-renders from the
   database. Identical today because both come from the same source, but a
   divergence would show up as a menu that shifts a moment after load.
--------------------------------------------------------------------------- */
import { useEffect, useState } from 'react'
import { apiGet, ApiError } from './client'
import { hydrateStore } from './persist'
import type { User } from '../types'

export type AdminDataState = { loading: boolean; error: string | null; source: 'api' | 'seed' }

function mergeById<T extends { id: string }>(seeded: T[], incoming: Partial<T>[]): T[] {
  const byId = new Map(seeded.map((r) => [r.id, r]))
  for (const row of incoming) {
    const existing = byId.get(row.id as string)
    byId.set(row.id as string, (existing ? { ...existing, ...row } : row) as T)
  }
  return [...byId.values()]
}

/** Slices every one of the three endpoints returns, replaced wholesale.
 *  Users are merged so a richer row from a role-specific fetch survives. */
function applyCommon(payload: Record<string, unknown>, seededUsers: User[]) {
  const take = (key: string) => (Array.isArray(payload[key]) ? { [key]: payload[key] } : {})
  return {
    ...take('catalogues'), ...take('lots'), ...take('bids'), ...take('deliveryOrders'),
    ...take('inspectionReports'), ...take('termsSets'), ...take('wallets'),
    ...take('selections'), ...take('disputes'), ...take('auditEvents'),
    ...take('depositClaims'), ...take('withdrawalRequests'), ...take('refundRequests'),
    ...take('emdForfeitures'), ...take('commissionSettlements'), ...take('bankStatementLines'),
    ...take('ceoApprovals'), ...take('cancellationRequests'), ...take('bidVoidRequests'),
    ...take('resultConfirmations'), ...take('staReferrals'), ...take('emdExemptionRequests'),
    ...take('announcements'), ...take('actionReviews'), ...take('handoverNotes'),
    ...take('contentDrafts'), ...take('roleRegistry'), ...take('pageRegistry'),
    ...take('structuralChanges'), ...take('passwordResets'), ...take('masterCategories'),
    ...take('masterUoms'), ...take('masterYards'), ...take('testimonials'),
    users: mergeById(seededUsers, (payload.users ?? []) as Partial<User>[]),
    ...(payload.financeConfig ? { financeConfig: payload.financeConfig } : {}),
    ...(payload.withdrawalWindow ? { withdrawalWindow: payload.withdrawalWindow } : {}),
    /* Delegation is legitimately null — "nobody is standing in for the CEO" —
       so it is set whenever the key is present, not only when truthy. */
    ...('ceoDelegation' in payload ? { ceoDelegation: payload.ceoDelegation } : {}),
  }
}

function usePlatformData(path: string, whatFailed: string): AdminDataState {
  const [state, setState] = useState<AdminDataState>({ loading: true, error: null, source: 'seed' })

  useEffect(() => {
    const ac = new AbortController()
    apiGet<Record<string, unknown>>(path, ac.signal)
      .then((d) => {
        hydrateStore((s) => applyCommon(d, s.users) as never)
        setState({ loading: false, error: null, source: 'api' })
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return
        setState({
          loading: false,
          source: 'seed',
          error: err instanceof ApiError ? err.message : `Failed to load ${whatFailed}`,
        })
      })
    return () => ac.abort()
  }, [path, whatFailed])

  return state
}

export const useSubAdminData = () => usePlatformData('/api/sub', 'the operations console')
export const useSuperAdminData = () => usePlatformData('/api/admin', 'the platform')
export const useCeoData = () => usePlatformData('/api/ceo', 'the business view')
