import { planCreateLot } from '../../application/lotSubmission'
import type { StoreGet, StoreSet, InternalHelpers } from '../internal'
import type { State } from '../types'

export const createSellerSlice = (
  set: StoreSet, get: StoreGet, helpers: InternalHelpers,
): Pick<State, 'createLot'> => ({
  /* ------------------------------ seller ------------------------------ */
  createLot: (partial) => {
    const s = get()
    const result = planCreateLot(partial, { currentUser: s.currentUser, now: s.now })
    if (!result.ok) return result
    const { plan } = result

    set((st) => ({ lots: [...st.lots, plan.lot] }))
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail)
    // A submitted lot is work for Operations — it has to be taken into the
    // pipeline and assembled into a catalogue before any inspector can ever
    // see it, so it cannot be left to be noticed.
    helpers.notifyRole(['exec_manager', 'sub_admin'], plan.opsNotification)
    get().notify(plan.sellerNotification)
    return { ok: true, lotId: plan.lot.id }
  },
})
