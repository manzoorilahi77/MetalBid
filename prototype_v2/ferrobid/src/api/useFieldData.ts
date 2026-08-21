/* ---------------------------------------------------------------------------
   Fetches the signed-in field executive's workspace and merges it into the store.

   Everything here merges by id, with none of the replace-wholesale rules the
   buyer and seller hooks need. A field executive owns no records: they read
   catalogues assigned to them and lots inside those catalogues, and the one
   thing they create — an inspection report — is written through submitInspection
   rather than arriving from this fetch. So there is no set this endpoint is
   authoritative for, and merging is the honest rule.

   As elsewhere, an unreachable API leaves the seeded data on screen.
--------------------------------------------------------------------------- */
import { useEffect, useState } from 'react'
import { useStore } from '../store/store'
import { apiGet, ApiError } from './client'
import { hydrateStore } from './persist'
import type { Catalogue, InspectionReport, Lot, User } from '../types'

interface FieldPayload {
  serverTime: string
  fieldExecId: string
  catalogues: Catalogue[]
  lots: Lot[]
  inspectionReports: InspectionReport[]
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

export type FieldDataState = { loading: boolean; error: string | null; source: 'api' | 'seed' }

export function useFieldData(): FieldDataState {
  const userId = useStore((s) => s.currentUser?.id)
  const [state, setState] = useState<FieldDataState>({ loading: true, error: null, source: 'seed' })

  useEffect(() => {
    if (!userId) {
      setState({ loading: false, error: null, source: 'seed' })
      return
    }
    const ac = new AbortController()
    apiGet<FieldPayload>(`/api/field/${encodeURIComponent(userId)}`, ac.signal)
      .then((d) => {
        hydrateStore((s) => ({
          catalogues: mergeById(s.catalogues, d.catalogues),
          lots: mergeById(s.lots, d.lots),
          inspectionReports: mergeById(s.inspectionReports, d.inspectionReports),
          users: mergeById(s.users, d.users as Partial<User>[]),
        }))
        setState({ loading: false, error: null, source: 'api' })
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return
        setState({
          loading: false,
          source: 'seed',
          error: err instanceof ApiError ? err.message : 'Failed to load your queue',
        })
      })
    return () => ac.abort()
  }, [userId])

  return state
}
