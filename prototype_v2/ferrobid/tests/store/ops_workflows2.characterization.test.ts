import { describe, expect, it } from 'vitest'
import { freshStore } from '../helpers/freshStore'
import { num } from '../../src/lib/format'
import type { Catalogue, DeliveryOrder, Lot } from '../../src/types'

/** Priority 10: remaining operations/inspection-desk actions migrated in
 *  Phase 12 — seller KYC decisions, delivery handover close-out, catalogue
 *  assembly/publish, and field-executive assignment. */
describe('ops workflows — phase 12', () => {
  const signInOps = (useStore: Awaited<ReturnType<typeof freshStore>>) =>
    useStore.getState().signIn('executive@gmail.com', 'FerroBid@Dev2026')

  describe('decideSellerKyc', () => {
    const targetId = (useStore: Awaited<ReturnType<typeof freshStore>>) => {
      useStore.getState().signIn('sell@gmail.com', 'FerroBid@Dev2026')
      return useStore.getState().currentUser!.id
    }

    it('refuses a caller who is not Operations or a Sub Admin', async () => {
      const useStore = await freshStore()
      const id = targetId(useStore)
      useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')

      const result = useStore.getState().decideSellerKyc(id, true)
      expect(result).toEqual({ ok: false, error: 'Only Operations or a Sub Admin verifies a seller' })
    })

    it('refuses an account that does not exist', async () => {
      const useStore = await freshStore()
      signInOps(useStore)

      const result = useStore.getState().decideSellerKyc('u-does-not-exist', true)
      expect(result).toEqual({ ok: false, error: 'Account not found' })
    })

    it('refuses a rejection with no reason', async () => {
      const useStore = await freshStore()
      const id = targetId(useStore)
      signInOps(useStore)

      const result = useStore.getState().decideSellerKyc(id, false)
      expect(result).toEqual({ ok: false, error: 'Say what has to be resubmitted' })
    })

    it('approves — sets kycStatus verified, sellerVerified true, audits at info, notifies the applicant', async () => {
      const useStore = await freshStore()
      const id = targetId(useStore)
      const target = useStore.getState().users.find((u) => u.id === id)!
      signInOps(useStore)
      const startAudit = useStore.getState().auditEvents.length

      const result = useStore.getState().decideSellerKyc(id, true)
      expect(result).toEqual({ ok: true })

      const updated = useStore.getState().users.find((u) => u.id === id)!
      expect(updated.kycStatus).toBe('verified')
      expect(updated.sellerVerified).toBe(true)
      expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'kyc.approve', target: target.firm, detail: 'Seller verified — may submit lots', severity: 'info' })
      const notif = useStore.getState().notifications.find((n) => n.userId === id && n.title === 'You are verified as a seller')!
      expect(notif).toMatchObject({ body: 'You can submit lots for inspection now. They stay private until Operations catalogues and publishes them.', href: '/seller/create-lot' })
    })

    it('rejects with a reason — audits at warning, notifies with the reason, does not flip sellerVerified', async () => {
      const useStore = await freshStore()
      const id = targetId(useStore)
      signInOps(useStore)
      useStore.setState((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, sellerVerified: false } : u)) }))

      const result = useStore.getState().decideSellerKyc(id, false, 'GSTIN does not match PAN')
      expect(result).toEqual({ ok: true })

      const updated = useStore.getState().users.find((u) => u.id === id)!
      expect(updated.kycStatus).toBe('rejected')
      expect(updated.sellerVerified).toBe(false)
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'kyc.reject', detail: 'Rejected — GSTIN does not match PAN', severity: 'warning' })
      const notif = useStore.getState().notifications.find((n) => n.userId === id && n.title === 'Your seller verification needs more')!
      expect(notif).toMatchObject({ body: 'GSTIN does not match PAN — resubmit and we will look again. You can appeal to the Operation Manager.', href: '/buyer/kyc' })
    })
  })

  describe('confirmHandover', () => {
    const makeOrder = (overrides: Partial<DeliveryOrder> & { id: string; lotId: string; catalogueId: string; buyerId: string }): DeliveryOrder => ({
      stage: 'completed', h1Rate: 45_000, awardedQty: 25, uom: 'MT', materialValue: 1_125_000,
      gstAmount: 202_500, tcsAmount: 1_125, paidAmount: 1_328_625, liftingBy: 'self', createdAt: new Date().toISOString(),
      liftingChecklist: [], weighedQty: 25, weighedById: 'u-exec-1',
      ...overrides,
    })

    it('refuses a caller who is not Operations or a Sub Admin', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
      const order = makeOrder({ id: 'do-p12-1', lotId: useStore.getState().lots[0].id, catalogueId: 'cat-x', buyerId: 'u-buyer-1' })
      useStore.setState((s) => ({ deliveryOrders: [...s.deliveryOrders, order] }))

      const result = useStore.getState().confirmHandover('do-p12-1')
      expect(result).toEqual({ ok: false, error: 'Only Operations or a Sub Admin closes a handover' })
    })

    it('refuses when the delivery order is not found', async () => {
      const useStore = await freshStore()
      signInOps(useStore)
      const result = useStore.getState().confirmHandover('do-does-not-exist')
      expect(result).toEqual({ ok: false, error: 'Delivery order not found' })
    })

    it('refuses when lifting is not yet complete', async () => {
      const useStore = await freshStore()
      signInOps(useStore)
      const order = makeOrder({ id: 'do-p12-2', lotId: useStore.getState().lots[0].id, catalogueId: 'cat-x', buyerId: 'u-buyer-1', stage: 'lifted' })
      useStore.setState((s) => ({ deliveryOrders: [...s.deliveryOrders, order] }))

      const result = useStore.getState().confirmHandover('do-p12-2')
      expect(result).toEqual({ ok: false, error: 'The material has not been lifted yet' })
    })

    it('refuses when already closed', async () => {
      const useStore = await freshStore()
      signInOps(useStore)
      const order = makeOrder({ id: 'do-p12-3', lotId: useStore.getState().lots[0].id, catalogueId: 'cat-x', buyerId: 'u-buyer-1', handoverConfirmedAt: new Date().toISOString() })
      useStore.setState((s) => ({ deliveryOrders: [...s.deliveryOrders, order] }))

      const result = useStore.getState().confirmHandover('do-p12-3')
      expect(result).toEqual({ ok: false, error: 'This handover is already closed' })
    })

    it('refuses a buyer-declared (unwitnessed) weighment', async () => {
      const useStore = await freshStore()
      signInOps(useStore)
      const order = makeOrder({ id: 'do-p12-4', lotId: useStore.getState().lots[0].id, catalogueId: 'cat-x', buyerId: 'u-buyer-1', weighedById: 'u-buyer-1' })
      useStore.setState((s) => ({ deliveryOrders: [...s.deliveryOrders, order] }))

      const result = useStore.getState().confirmHandover('do-p12-4')
      expect(result).toEqual({ ok: false, error: 'The weighment on this order was declared by the buyer. Record the witnessed figure on Logistics before closing the handover.' })
    })

    it('closes the handover, audits it, and notifies the buyer and Finance', async () => {
      const useStore = await freshStore()
      signInOps(useStore)
      const staff = useStore.getState().currentUser!
      const lot = useStore.getState().lots[0]
      const order = makeOrder({ id: 'do-p12-5', lotId: lot.id, catalogueId: 'cat-x', buyerId: 'u-buyer-1', weighedById: staff.id })
      useStore.setState((s) => ({ deliveryOrders: [...s.deliveryOrders, order] }))
      const startAudit = useStore.getState().auditEvents.length

      const result = useStore.getState().confirmHandover('do-p12-5', 'clean handover')
      expect(result).toEqual({ ok: true })

      const updated = useStore.getState().deliveryOrders.find((d) => d.id === 'do-p12-5')!
      expect(updated.handoverConfirmedAt).toBeTruthy()
      expect(updated.handoverConfirmedBy).toBe(staff.id)
      expect(updated.handoverNote).toBe('clean handover')
      expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
      expect(useStore.getState().auditEvents[0]).toMatchObject({
        action: 'delivery.handover', target: lot.lotNo, detail: `Handover closed at ${num(25)} MT weighment-final — clean handover`,
      })
      const buyerNotif = useStore.getState().notifications.find((n) => n.userId === 'u-buyer-1' && n.title === `Handover closed on ${lot.lotNo}`)!
      expect(buyerNotif.body).toBe(`Recorded at ${num(25)} MT, weighment-final. Your closure certificate is available.`)
      const financeNotif = useStore.getState().notifications.find((n) => n.href === '/finance/payments' && n.title === 'Delivery closed')!
      expect(financeNotif.body).toBe(`${lot.lotNo} handed over at ${num(25)} MT. Ready to book.`)
    })
  })

  describe('assignCatalogue', () => {
    it('assigns the field exec, audits it, and notifies them of the inspection window', async () => {
      const useStore = await freshStore()
      signInOps(useStore)
      const cat = useStore.getState().catalogues[0]
      const startAudit = useStore.getState().auditEvents.length

      useStore.getState().assignCatalogue(cat.id, 'u-field-1')

      expect(useStore.getState().catalogues.find((c) => c.id === cat.id)!.assignedFieldExecId).toBe('u-field-1')
      expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
      const exec = useStore.getState().users.find((u) => u.id === 'u-field-1')!
      expect(useStore.getState().auditEvents[0]).toMatchObject({
        action: 'catalogue.assign', target: cat.code, detail: `Assigned to ${exec.name} for field inspection`,
      })
      const notif = useStore.getState().notifications.find((n) => n.userId === 'u-field-1' && n.title === `${cat.code} assigned to you`)!
      expect(notif.href).toBe(`/field/catalogue/${cat.id}`)
    })
  })

  describe('publishCatalogue', () => {
    const cloneLot = (base: Lot, overrides: Partial<Lot>): Lot => ({ ...base, ...overrides })

    it('draft assembly: assigns lot numbers, sets pending_inspection status, audits, and notifies the field exec', async () => {
      const useStore = await freshStore()
      signInOps(useStore)
      const baseLot = useStore.getState().lots[0]
      const baseCat = useStore.getState().catalogues[0]
      const lotA = cloneLot(baseLot, { id: 'lot-p12-a', catalogueId: null as unknown as string, status: 'pending_inspection', inspectionWaived: false, overrides: undefined })
      const lotB = cloneLot(baseLot, { id: 'lot-p12-b', catalogueId: null as unknown as string, status: 'pending_inspection', inspectionWaived: false, overrides: undefined })
      useStore.setState((s) => ({ lots: [...s.lots, lotA, lotB] }))
      const draftCat: Catalogue = { ...baseCat, id: 'cat-p12-draft', code: 'AUC-P12-D', status: 'draft', lotIds: [], assignedFieldExecId: 'u-field-1' }
      const startAudit = useStore.getState().auditEvents.length

      useStore.getState().publishCatalogue(draftCat, ['lot-p12-a', 'lot-p12-b'], {})

      const a = useStore.getState().lots.find((l) => l.id === 'lot-p12-a')!
      const b = useStore.getState().lots.find((l) => l.id === 'lot-p12-b')!
      expect(a.lotNo).toBe('LOT-01')
      expect(b.lotNo).toBe('LOT-02')
      expect(a.status).toBe('pending_inspection')
      expect(a.catalogueId).toBe('cat-p12-draft')
      expect(useStore.getState().catalogues.some((c) => c.id === 'cat-p12-draft')).toBe(true)

      expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
      expect(useStore.getState().auditEvents[0]).toMatchObject({
        action: 'catalogue.assign', target: 'AUC-P12-D', detail: 'Assembled "' + draftCat.title + '" with 2 lots — assigned for field inspection',
      })
      const fieldNotif = useStore.getState().notifications.find((n) => n.userId === 'u-field-1' && n.title === 'AUC-P12-D assigned to you')!
      expect(fieldNotif.href).toBe('/field/catalogue/cat-p12-draft')
    })

    it('draft assembly with an override: audits the override separately and notifies the seller', async () => {
      const useStore = await freshStore()
      signInOps(useStore)
      const baseLot = useStore.getState().lots[0]
      const baseCat = useStore.getState().catalogues[0]
      const lotA = cloneLot(baseLot, { id: 'lot-p12-c', catalogueId: null as unknown as string, status: 'pending_inspection', inspectionWaived: false, increment: 500, overrides: undefined })
      useStore.setState((s) => ({ lots: [...s.lots, lotA] }))
      const draftCat: Catalogue = { ...baseCat, id: 'cat-p12-draft2', code: 'AUC-P12-D2', status: 'draft', lotIds: [], sellerId: lotA.sellerId, assignedFieldExecId: null }
      const startAudit = useStore.getState().auditEvents.length

      useStore.getState().publishCatalogue(draftCat, ['lot-p12-c'], { 'lot-p12-c': { increment: 1000 } })

      expect(useStore.getState().auditEvents.length).toBe(startAudit + 2)
      expect(useStore.getState().auditEvents[1]).toMatchObject({ action: 'catalogue.assign' })
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'catalogue.override', target: 'AUC-P12-D2', severity: 'warning' })
      const updated = useStore.getState().lots.find((l) => l.id === 'lot-p12-c')!
      expect(updated.increment).toBe(1000)
      expect(updated.overrides).toHaveLength(1)
      expect(updated.overrides![0]).toMatchObject({ field: 'increment', label: 'Bid increment' })
      const sellerNotif = useStore.getState().notifications.find((n) => n.userId === lotA.sellerId && n.title === 'Terms adjusted on AUC-P12-D2')!
      expect(sellerNotif.href).toBe('/seller/lots')
    })

    it('direct live publish: sets lots live, broadcasts, and does not touch the field exec', async () => {
      const useStore = await freshStore()
      signInOps(useStore)
      const baseLot = useStore.getState().lots[0]
      const baseCat = useStore.getState().catalogues[0]
      const lotA = cloneLot(baseLot, { id: 'lot-p12-d', catalogueId: null as unknown as string, status: 'approved', inspectionWaived: false, overrides: undefined })
      useStore.setState((s) => ({ lots: [...s.lots, lotA] }))
      const liveCat: Catalogue = { ...baseCat, id: 'cat-p12-live', code: 'AUC-P12-L', status: 'live', lotIds: [], assignedFieldExecId: 'u-field-1' }
      const startNotif = useStore.getState().notifications.length

      useStore.getState().publishCatalogue(liveCat, ['lot-p12-d'], {})

      const a = useStore.getState().lots.find((l) => l.id === 'lot-p12-d')!
      expect(a.status).toBe('live')
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'catalogue.publish', target: 'AUC-P12-L' })
      const broadcast = useStore.getState().notifications.find((n) => n.userId === null && n.title === 'New catalogue AUC-P12-L')!
      expect(broadcast.href).toBe('/catalogue/cat-p12-live')
      expect(useStore.getState().notifications.length).toBeGreaterThan(startNotif)
      expect(useStore.getState().notifications.some((n) => n.title === 'AUC-P12-L assigned to you')).toBe(false)
    })
  })
})
