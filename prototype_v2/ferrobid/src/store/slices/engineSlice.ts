import type { StoreGet, StoreSet, InternalHelpers } from '../internal'
import type { State } from '../types'

export const createEngineSlice = (
  set: StoreSet, get: StoreGet, helpers: InternalHelpers,
): Pick<State, 'tick'> => ({
  /* ------------------------------ engine ------------------------------ */
  tick: () => {
    const now = Date.now()
    // paused catalogues freeze their countdowns: shift end times forward
    const s = get()
    const pausedIds = Object.keys(s.paused).filter((k) => s.paused[k])
    if (pausedIds.length) {
      const dms = now - s.now
      set((st) => ({
        catalogues: st.catalogues.map((c) => (pausedIds.includes(c.id) ? { ...c, endsAt: new Date(Date.parse(c.endsAt) + dms).toISOString() } : c)),
        lots: st.lots.map((l) => (l.catalogueId && pausedIds.includes(l.catalogueId) ? { ...l, endsAt: new Date(Date.parse(l.endsAt) + dms).toISOString() } : l)),
      }))
    }
    set({ now })
    helpers.runBots()
    helpers.runProxyBids()
    helpers.closeDueLots()
  },
})
