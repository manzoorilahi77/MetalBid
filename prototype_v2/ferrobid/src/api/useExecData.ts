/* ---------------------------------------------------------------------------
   Fetches the Operation Manager's workspace and replaces those store slices.

   This is the one hook that REPLACES rather than merges, and it is safe here
   precisely because the endpoint is unscoped: it returns every catalogue, every
   lot, every inspection report and every delivery order, so it is authoritative
   for all four. Merging would only let a stale seeded row survive alongside the
   server's answer; replacing makes what this role sees exactly what is in the
   database.

   That also makes this the closest thing to a bootstrap the app has. Once the
   remaining roles are migrated, the seeded fixtures can be dropped and a fetch
   of this shape can populate the store at startup instead.

   Users are still merged, not replaced: the payload carries the public user
   columns, and merging preserves anything a role-specific fetch added earlier
   in the session.
--------------------------------------------------------------------------- */
import { useEffect, useState } from 'react'
import { apiGet, ApiError } from './client'
import { hydrateStore } from './persist'
import type { Catalogue, DeliveryOrder, InspectionReport, Lot, TermsSet, User } from '../types'

interface ExecPayload {
  serverTime: string
  catalogues: Catalogue[]
  lots: Lot[]
  inspectionReports: InspectionReport[]
  deliveryOrders: DeliveryOrder[]
  termsSets: TermsSet[]
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

export type ExecDataState = { loading: boolean; error: string | null; source: 'api' | 'seed' }

export function useExecData(): ExecDataState {
  const [state, setState] = useState<ExecDataState>({ loading: true, error: null, source: 'seed' })

  useEffect(() => {
    const ac = new AbortController()
    apiGet<ExecPayload>('/api/exec', ac.signal)
      .then((d) => {
        hydrateStore((s) => ({
          /* authoritative — the endpoint returns the complete set of each */
          catalogues: d.catalogues,
          lots: d.lots,
          inspectionReports: d.inspectionReports,
          deliveryOrders: d.deliveryOrders,
          termsSets: d.termsSets,
          users: mergeById(s.users, d.users as Partial<User>[]),
        }))
        setState({ loading: false, error: null, source: 'api' })
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return
        setState({
          loading: false,
          source: 'seed',
          error: err instanceof ApiError ? err.message : 'Failed to load the pipeline',
        })
      })
    return () => ac.abort()
  }, [])

  return state
}
