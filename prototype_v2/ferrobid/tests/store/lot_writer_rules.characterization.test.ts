import { describe, expect, it } from 'vitest'
import { freshStore } from '../helpers/freshStore'
import type { Catalogue, Lot, LotStatus } from '../../src/types'

/** Phase 28, Step 2 — equivalence proof for the shared lot-writer table
 *  (application/lotTransitions.ts). Run once against the pre-table code
 *  (inline guards, "old-way") and again unmodified after Step 3 wires the
 *  nine writers to the shared table ("new-way") — identical results both
 *  times is what proves the table matches the enumeration exactly rather
 *  than silently narrowing or widening any writer's rule.
 *
 *  Four writers (decideLot, waiveInspection, submitInspection,
 *  publishCatalogue) accept every lot status by design — Step 1 confirmed
 *  this, not assumed it — so their loops assert success on all nine
 *  statuses, not just the ones existing tests happened to cover. */
const ALL_STATUSES: LotStatus[] = [
  'pending_inspection', 'inspected', 'approved', 'live', 'sold', 'sta', 'unsold', 'flagged', 'rejected',
]

const signInOps = (useStore: Awaited<ReturnType<typeof freshStore>>) =>
  useStore.getState().signIn('executive@gmail.com', 'FerroBid@Dev2026')
const signInField = (useStore: Awaited<ReturnType<typeof freshStore>>) =>
  useStore.getState().signIn('field@gmail.com', 'FerroBid@Dev2026')
const signInWrongDesk = (useStore: Awaited<ReturnType<typeof freshStore>>) =>
  useStore.getState().signIn('auction@gmail.com', 'FerroBid@Dev2026')

const setLotStatus = (useStore: Awaited<ReturnType<typeof freshStore>>, lotId: string, status: LotStatus, patch: Partial<Lot> = {}) =>
  useStore.setState((s) => ({ lots: s.lots.map((l) => (l.id === lotId ? { ...l, status, ...patch } : l)) }))

describe('lot writer rules — Phase 28 Step 2 equivalence (all nine discretionary writers)', () => {
  describe('decideLot — role: LOT_GATE_ROLES, status: any', () => {
    it.each(ALL_STATUSES)('accepts a call from status %s', async (status) => {
      const useStore = await freshStore()
      const lot = useStore.getState().lots[0]
      setLotStatus(useStore, lot.id, status)
      signInOps(useStore)

      const result = useStore.getState().decideLot(lot.id, 'approved')
      expect(result).toEqual({ ok: true })
    })

    it('refuses a caller who is not Operations or a Sub Admin', async () => {
      const useStore = await freshStore()
      const lot = useStore.getState().lots[0]
      signInWrongDesk(useStore)

      const result = useStore.getState().decideLot(lot.id, 'approved')
      expect(result).toEqual({ ok: false, error: 'Only Operations or a Sub Admin decides a lot' })
    })
  })

  describe('waiveInspection — role: LOT_GATE_ROLES, status: any', () => {
    it.each(ALL_STATUSES)('accepts a call from status %s', async (status) => {
      const useStore = await freshStore()
      const lot = useStore.getState().lots[0]
      setLotStatus(useStore, lot.id, status)
      signInOps(useStore)

      const result = useStore.getState().waiveInspection(lot.id, 'u-exec-1', 'Trusted seller, urgent turnaround')
      expect(result).toEqual({ ok: true })
    })

    it('refuses a caller who is not Operations or a Sub Admin', async () => {
      const useStore = await freshStore()
      const lot = useStore.getState().lots[0]
      signInWrongDesk(useStore)

      const result = useStore.getState().waiveInspection(lot.id, 'u-exec-1', 'Trusted seller, urgent turnaround')
      expect(result).toEqual({ ok: false, error: 'Only Operations or a Sub Admin may bypass an inspection' })
    })
  })

  describe('submitInspection — role: FIELD_INSPECTION_ROLES, status: any', () => {
    it.each(ALL_STATUSES)('accepts a call from status %s', async (status) => {
      const useStore = await freshStore()
      const lot = useStore.getState().lots[0]
      setLotStatus(useStore, lot.id, status)
      signInField(useStore)

      const result = useStore.getState().submitInspection(
        lot.id,
        { measuredQty: lot.indicativeQty, uom: lot.uom, condition: 'good', notes: 'ok', checklist: [], photoCount: 0, inspectorId: '', status: 'verified' },
        'verified',
      )
      expect(result).toEqual({ ok: true })
    })

    it('refuses a caller who is not a Field Executive, Operations or a Sub Admin', async () => {
      const useStore = await freshStore()
      const lot = useStore.getState().lots[0]
      useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')

      const result = useStore.getState().submitInspection(
        lot.id,
        { measuredQty: lot.indicativeQty, uom: lot.uom, condition: 'good', notes: 'ok', checklist: [], photoCount: 0, inspectorId: '', status: 'verified' },
        'verified',
      )
      expect(result).toEqual({ ok: false, error: 'Only a Field Executive, Operations or a Sub Admin files an inspection' })
    })
  })

  describe('publishCatalogue — role: LOT_GATE_ROLES, status: any (the writer overwrites status; the lot\'s starting status never gates it)', () => {
    it.each(ALL_STATUSES)('accepts an included lot starting from status %s', async (status) => {
      const useStore = await freshStore()
      const baseLot = useStore.getState().lots[0]
      const baseCat = useStore.getState().catalogues[0]
      const lotId = `lot-lwr-${status}`
      const lot: Lot = { ...baseLot, id: lotId, catalogueId: null as unknown as string, status, inspectionWaived: false, overrides: undefined }
      useStore.setState((s) => ({ lots: [...s.lots, lot] }))
      const cat: Catalogue = { ...baseCat, id: `cat-lwr-${status}`, code: `AUC-LWR-${status}`, status: 'draft', lotIds: [] }
      signInOps(useStore)

      const result = useStore.getState().publishCatalogue(cat, [lotId], {})
      expect(result).toEqual({ ok: true })
    })

    it('refuses a caller who is not Operations or a Sub Admin', async () => {
      const useStore = await freshStore()
      const baseLot = useStore.getState().lots[0]
      const baseCat = useStore.getState().catalogues[0]
      const lot: Lot = { ...baseLot, id: 'lot-lwr-wrongrole', catalogueId: null as unknown as string, status: 'pending_inspection' }
      useStore.setState((s) => ({ lots: [...s.lots, lot] }))
      const cat: Catalogue = { ...baseCat, id: 'cat-lwr-wrongrole', code: 'AUC-LWR-WR', status: 'draft', lotIds: [] }
      signInWrongDesk(useStore)

      const result = useStore.getState().publishCatalogue(cat, ['lot-lwr-wrongrole'], {})
      expect(result).toEqual({ ok: false, error: 'Only Operations or a Sub Admin builds or publishes a catalogue' })
    })
  })

  describe('publishDraftCatalogue — role: PUBLISH_ROLES, status: restrictive (every lot must be approved)', () => {
    const buildSingleLotCatalogue = async (status: LotStatus) => {
      const useStore = await freshStore()
      const baseLot = useStore.getState().lots[0]
      const baseCat = useStore.getState().catalogues[0]
      const lot: Lot = { ...baseLot, id: `lot-pdc-${status}`, catalogueId: `cat-pdc-${status}`, status, reserveRate: 100, indicativeQty: 1 }
      const cat: Catalogue = {
        ...baseCat, id: `cat-pdc-${status}`, code: `AUC-PDC-${status}`, status: 'draft', lotIds: [lot.id],
        startsAt: new Date(Date.now() + 3600_000).toISOString(), endsAt: new Date(Date.now() + 7200_000).toISOString(),
      }
      useStore.setState((s) => ({
        lots: [...s.lots, lot],
        catalogues: [...s.catalogues, cat],
        // guarantee the CEO-threshold gate never trips on this tiny synthetic lot
        financeConfig: { ...s.financeConfig, ceoPublishValueFrom: 999_999_999_999 },
      }))
      return { useStore, catId: cat.id }
    }

    it.each(ALL_STATUSES)('status %s: only "approved" is accepted, everything else names the count', async (status) => {
      const { useStore, catId } = await buildSingleLotCatalogue(status)
      signInOps(useStore)

      const result = useStore.getState().publishDraftCatalogue(catId, 'now')
      if (status === 'approved') {
        expect(result).toEqual({ ok: true })
      } else {
        expect(result).toEqual({ ok: false, error: '1 lot still needs approval' })
      }
    })

    it('refuses a caller who is not permitted to publish', async () => {
      const { useStore, catId } = await buildSingleLotCatalogue('approved')
      signInWrongDesk(useStore)
      useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')

      const result = useStore.getState().publishDraftCatalogue(catId, 'now')
      expect(result).toEqual({ ok: false, error: 'Not permitted for this role' })
    })
  })

  describe('resolveFlaggedLot — role: LOT_GATE_ROLES, status: only "flagged"', () => {
    it.each(ALL_STATUSES)('status %s', async (status) => {
      const useStore = await freshStore()
      const lot = useStore.getState().lots[0]
      setLotStatus(useStore, lot.id, status)
      signInOps(useStore)

      const result = useStore.getState().resolveFlaggedLot(lot.id)
      if (status === 'flagged') {
        expect(result).toEqual({ ok: true })
      } else {
        expect(result).toEqual({ ok: false, error: 'Only a flagged lot can be returned to the inspected queue' })
      }
    })

    it('refuses a caller who is not Operations or a Sub Admin', async () => {
      const useStore = await freshStore()
      const lot = useStore.getState().lots[0]
      setLotStatus(useStore, lot.id, 'flagged')
      signInWrongDesk(useStore)

      const result = useStore.getState().resolveFlaggedLot(lot.id)
      expect(result).toEqual({ ok: false, error: 'Only Operations or a Sub Admin resolves a flagged lot' })
    })
  })

  describe('approveStaSale / markStaUnsold — role: LOT_GATE_ROLES, status: only "sta" (plus catalogue closed, checked separately)', () => {
    const setStaFixture = (useStore: Awaited<ReturnType<typeof freshStore>>, status: LotStatus) => {
      const lot = useStore.getState().lots.find((l) => l.catalogueId)!
      useStore.setState((s) => ({
        lots: s.lots.map((l) => (l.id === lot.id ? { ...l, status } : l)),
        catalogues: s.catalogues.map((c) => (c.id === lot.catalogueId ? { ...c, status: 'closed' } : c)),
      }))
      return lot.id
    }

    it.each(ALL_STATUSES)('approveStaSale status %s', async (status) => {
      const useStore = await freshStore()
      const lotId = setStaFixture(useStore, status)
      signInOps(useStore)

      const result = useStore.getState().approveStaSale(lotId)
      if (status === 'sta') {
        expect(result).toEqual({ ok: true })
      } else {
        expect(result).toEqual({ ok: false, error: 'Only a lot cleared below reserve (STA) can be decided here' })
      }
    })

    it.each(ALL_STATUSES)('markStaUnsold status %s', async (status) => {
      const useStore = await freshStore()
      const lotId = setStaFixture(useStore, status)
      signInOps(useStore)

      const result = useStore.getState().markStaUnsold(lotId)
      if (status === 'sta') {
        expect(result).toEqual({ ok: true })
      } else {
        expect(result).toEqual({ ok: false, error: 'Only a lot cleared below reserve (STA) can be decided here' })
      }
    })

    it('refuses a caller who is not Operations or a Sub Admin (both actions)', async () => {
      const useStore = await freshStore()
      const lotId = setStaFixture(useStore, 'sta')
      signInWrongDesk(useStore)

      expect(useStore.getState().approveStaSale(lotId)).toEqual({ ok: false, error: 'Only Operations or a Sub Admin decides an STA lot' })
      expect(useStore.getState().markStaUnsold(lotId)).toEqual({ ok: false, error: 'Only Operations or a Sub Admin decides an STA lot' })
    })
  })

  describe('returnRefusedLotToPipeline — role: LOT_GATE_ROLES, status: any (real precondition is sellerDecision, not status)', () => {
    it.each(ALL_STATUSES)('accepts a refused-price lot starting from status %s', async (status) => {
      const useStore = await freshStore()
      const lot = useStore.getState().lots.find((l) => l.catalogueId)!
      useStore.setState((s) => ({
        lots: s.lots.map((l) => (l.id === lot.id ? { ...l, status, sellerDecision: 'rejected' } : l)),
        catalogues: s.catalogues.map((c) => (c.id === lot.catalogueId ? { ...c, status: 'closed' } : c)),
      }))
      signInOps(useStore)

      const result = useStore.getState().returnRefusedLotToPipeline(lot.id)
      expect(result).toEqual({ ok: true })
    })

    it('refuses a caller who is not Operations or a Sub Admin', async () => {
      const useStore = await freshStore()
      const lot = useStore.getState().lots.find((l) => l.catalogueId)!
      useStore.setState((s) => ({
        lots: s.lots.map((l) => (l.id === lot.id ? { ...l, status: 'sold', sellerDecision: 'rejected' } : l)),
        catalogues: s.catalogues.map((c) => (c.id === lot.catalogueId ? { ...c, status: 'closed' } : c)),
      }))
      signInWrongDesk(useStore)

      const result = useStore.getState().returnRefusedLotToPipeline(lot.id)
      expect(result).toEqual({ ok: false, error: 'Only Operations or a Sub Admin returns a lot to the pipeline' })
    })
  })
})
