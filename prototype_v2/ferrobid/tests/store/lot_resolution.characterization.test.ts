import { describe, expect, it } from 'vitest'
import { freshStore } from '../helpers/freshStore'

/** Phase 28b — the four real lot-status transitions that used to go through a
 *  raw, unguarded setter with no role or source-status check at all (Phase
 *  28's Step 1 audit finding), each now routed through a named, guarded
 *  application-layer action instead. */
describe('lot resolution — Phase 28b guarded lot-status transitions', () => {
  const signInOps = (useStore: Awaited<ReturnType<typeof freshStore>>) =>
    useStore.getState().signIn('executive@gmail.com', 'FerroBid@Dev2026')
  const signInWrongDesk = (useStore: Awaited<ReturnType<typeof freshStore>>) =>
    useStore.getState().signIn('auction@gmail.com', 'FerroBid@Dev2026')

  describe('resolveFlaggedLot (flagged -> inspected) — exec/Pipeline "Resolve"', () => {
    it('AFTER Phase 28b: refuses a caller who is not Operations or a Sub Admin', async () => {
      const useStore = await freshStore()
      const target = useStore.getState().lots[0]
      useStore.setState((s) => ({ lots: s.lots.map((l) => (l.id === target.id ? { ...l, status: 'flagged' } : l)) }))
      signInWrongDesk(useStore)

      const result = useStore.getState().resolveFlaggedLot(target.id)
      expect(result).toEqual({ ok: false, error: 'Only Operations or a Sub Admin resolves a flagged lot' })
      expect(useStore.getState().lots.find((l) => l.id === target.id)!.status).toBe('flagged')
    })

    it('AFTER Phase 28b: refuses a lot that is not flagged', async () => {
      const useStore = await freshStore()
      signInOps(useStore)
      const lot = useStore.getState().lots.find((l) => l.status === 'inspected')!

      const result = useStore.getState().resolveFlaggedLot(lot.id)
      expect(result).toEqual({ ok: false, error: 'Only a flagged lot can be returned to the inspected queue' })
      expect(useStore.getState().lots.find((l) => l.id === lot.id)!.status).toBe('inspected')
    })

    it('AFTER Phase 28b: Operations resolving a flagged lot moves it back to inspected', async () => {
      const useStore = await freshStore()
      const target = useStore.getState().lots[0]
      useStore.setState((s) => ({ lots: s.lots.map((l) => (l.id === target.id ? { ...l, status: 'flagged' } : l)) }))
      signInOps(useStore)

      const result = useStore.getState().resolveFlaggedLot(target.id)
      expect(result).toEqual({ ok: true })
      expect(useStore.getState().lots.find((l) => l.id === target.id)!.status).toBe('inspected')
    })
  })

  describe('approveStaSale / markStaUnsold (sta -> sold / sta -> unsold) — exec/Settlement STA decisions', () => {
    const setSta = (useStore: Awaited<ReturnType<typeof freshStore>>, closed: boolean) => {
      const lot = useStore.getState().lots.find((l) => l.catalogueId)!
      useStore.setState((s) => ({
        lots: s.lots.map((l) => (l.id === lot.id ? { ...l, status: 'sta' } : l)),
        catalogues: s.catalogues.map((c) => (c.id === lot.catalogueId ? { ...c, status: closed ? 'closed' : 'live' } : c)),
      }))
      return lot.id
    }

    it('AFTER Phase 28b: approveStaSale refuses a caller who is not Operations or a Sub Admin', async () => {
      const useStore = await freshStore()
      const lotId = setSta(useStore, true)
      signInWrongDesk(useStore)

      const result = useStore.getState().approveStaSale(lotId)
      expect(result).toEqual({ ok: false, error: 'Only Operations or a Sub Admin decides an STA lot' })
      expect(useStore.getState().lots.find((l) => l.id === lotId)!.status).toBe('sta')
    })

    it('AFTER Phase 28b: approveStaSale refuses a lot that is not STA', async () => {
      const useStore = await freshStore()
      signInOps(useStore)
      const lot = useStore.getState().lots.find((l) => l.status === 'live' && l.catalogueId)!
      useStore.setState((s) => ({
        catalogues: s.catalogues.map((c) => (c.id === lot.catalogueId ? { ...c, status: 'closed' } : c)),
      }))

      const result = useStore.getState().approveStaSale(lot.id)
      expect(result).toEqual({ ok: false, error: 'Only a lot cleared below reserve (STA) can be decided here' })
    })

    it('AFTER Phase 28b: approveStaSale refuses an STA lot whose auction has not closed', async () => {
      const useStore = await freshStore()
      const lotId = setSta(useStore, false)
      signInOps(useStore)

      const result = useStore.getState().approveStaSale(lotId)
      expect(result).toEqual({ ok: false, error: 'The auction has not closed yet' })
      expect(useStore.getState().lots.find((l) => l.id === lotId)!.status).toBe('sta')
    })

    it('AFTER Phase 28b: approveStaSale accepts H1 below reserve on a closed STA lot', async () => {
      const useStore = await freshStore()
      const lotId = setSta(useStore, true)
      signInOps(useStore)

      const result = useStore.getState().approveStaSale(lotId)
      expect(result).toEqual({ ok: true })
      expect(useStore.getState().lots.find((l) => l.id === lotId)!.status).toBe('sold')
    })

    it('AFTER Phase 28b: markStaUnsold refuses a caller who is not Operations or a Sub Admin', async () => {
      const useStore = await freshStore()
      const lotId = setSta(useStore, true)
      signInWrongDesk(useStore)

      const result = useStore.getState().markStaUnsold(lotId)
      expect(result).toEqual({ ok: false, error: 'Only Operations or a Sub Admin decides an STA lot' })
      expect(useStore.getState().lots.find((l) => l.id === lotId)!.status).toBe('sta')
    })

    it('AFTER Phase 28b: markStaUnsold marks a closed STA lot unsold', async () => {
      const useStore = await freshStore()
      const lotId = setSta(useStore, true)
      signInOps(useStore)

      const result = useStore.getState().markStaUnsold(lotId)
      expect(result).toEqual({ ok: true })
      expect(useStore.getState().lots.find((l) => l.id === lotId)!.status).toBe('unsold')
    })
  })

  describe('returnRefusedLotToPipeline (sold|sta -> unsold) — exec/Settlement "Return for re-auction"', () => {
    const setRefused = (useStore: Awaited<ReturnType<typeof freshStore>>, opts: { rejected: boolean; closed: boolean }) => {
      const lot = useStore.getState().lots.find((l) => l.catalogueId)!
      useStore.setState((s) => ({
        lots: s.lots.map((l) => (l.id === lot.id ? { ...l, status: 'sold', sellerDecision: opts.rejected ? 'rejected' : null } : l)),
        catalogues: s.catalogues.map((c) => (c.id === lot.catalogueId ? { ...c, status: opts.closed ? 'closed' : 'live' } : c)),
      }))
      return lot.id
    }

    it('AFTER Phase 28b: refuses a caller who is not Operations or a Sub Admin', async () => {
      const useStore = await freshStore()
      const lotId = setRefused(useStore, { rejected: true, closed: true })
      signInWrongDesk(useStore)

      const result = useStore.getState().returnRefusedLotToPipeline(lotId)
      expect(result).toEqual({ ok: false, error: 'Only Operations or a Sub Admin returns a lot to the pipeline' })
      expect(useStore.getState().lots.find((l) => l.id === lotId)!.status).toBe('sold')
    })

    it('AFTER Phase 28b: refuses a lot the seller has not refused a price on', async () => {
      const useStore = await freshStore()
      const lotId = setRefused(useStore, { rejected: false, closed: true })
      signInOps(useStore)

      const result = useStore.getState().returnRefusedLotToPipeline(lotId)
      expect(result).toEqual({ ok: false, error: 'The seller has not refused a price on this lot' })
    })

    it('AFTER Phase 28b: refuses a refused-price lot whose auction has not closed', async () => {
      const useStore = await freshStore()
      const lotId = setRefused(useStore, { rejected: true, closed: false })
      signInOps(useStore)

      const result = useStore.getState().returnRefusedLotToPipeline(lotId)
      expect(result).toEqual({ ok: false, error: 'The auction has not closed yet' })
      expect(useStore.getState().lots.find((l) => l.id === lotId)!.status).toBe('sold')
    })

    it('AFTER Phase 28b: returns a refused-price lot on a closed auction to the pipeline as unsold', async () => {
      const useStore = await freshStore()
      const lotId = setRefused(useStore, { rejected: true, closed: true })
      signInOps(useStore)

      const result = useStore.getState().returnRefusedLotToPipeline(lotId)
      expect(result).toEqual({ ok: true })
      expect(useStore.getState().lots.find((l) => l.id === lotId)!.status).toBe('unsold')
    })
  })
})
