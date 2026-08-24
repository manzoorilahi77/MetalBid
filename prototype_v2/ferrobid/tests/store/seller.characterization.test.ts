import { describe, expect, it } from 'vitest'
import { freshStore } from '../helpers/freshStore'
import { inr } from '../../src/lib/format'

/** Priority 6: seller workflows — lot submission gated on KYC/verification. */
describe('seller workflows', () => {
  it('refuses createLot for a seller whose verification is not approved', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('sell@gmail.com', 'FerroBid@Dev2026')
    const me = useStore.getState().currentUser!
    useStore.setState((s) => ({
      users: s.users.map((u) => (u.id === me.id ? { ...u, sellerVerified: false, kycStatus: 'none' } : u)),
      currentUser: { ...s.currentUser!, sellerVerified: false, kycStatus: 'none' },
    }))

    const result = useStore.getState().createLot({ metal: 'MS', indicativeQty: 10 })
    expect(result.ok).toBe(false)
    expect(result.lotId).toBeUndefined()
  })

  it('createLot succeeds for a verified seller, landing in the pipeline uncatalogued', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('sell@gmail.com', 'FerroBid@Dev2026')
    const me = useStore.getState().currentUser!
    useStore.setState((s) => ({
      users: s.users.map((u) => (u.id === me.id ? { ...u, sellerVerified: true, kycStatus: 'verified' } : u)),
      currentUser: { ...s.currentUser!, sellerVerified: true, kycStatus: 'verified' },
    }))
    const startCount = useStore.getState().lots.length
    const startAudit = useStore.getState().auditEvents.length
    const startNotif = useStore.getState().notifications.length

    const result = useStore.getState().createLot({ metal: 'MS', grade: 'HMS 1&2', indicativeQty: 25, uom: 'MT' })
    expect(result.ok).toBe(true)
    expect(result.lotId).toBeTruthy()

    const lots = useStore.getState().lots
    expect(lots.length).toBe(startCount + 1)
    const lot = lots.find((l) => l.id === result.lotId)!
    expect(lot.status).toBe('pending_inspection')
    expect(lot.catalogueId).toBeNull()
    expect(lot.sellerId).toBe(me.id)

    expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
    expect(useStore.getState().auditEvents[0]).toMatchObject({
      action: 'lot.create', target: lot.lotNo, detail: `${me.firm} submitted HMS 1&2 for inspection`,
    })
    expect(useStore.getState().notifications.length).toBeGreaterThan(startNotif) // ops role-notify (possibly >1 recipient) + seller notify
    const opsNotif = useStore.getState().notifications.find((n) => n.href === '/exec')!
    expect(opsNotif.title).toBe(`New lot from ${me.firm}`)
    expect(opsNotif.body).toBe('HMS 1&2 · 25 MT at a yard — take it into the pipeline and assign an inspection.')
    const sellerNotif = useStore.getState().notifications.find((n) => n.userId === me.id)!
    expect(sellerNotif).toMatchObject({
      title: `${lot.lotNo} submitted`,
      body: 'Operations will assemble it into a catalogue and book a yard inspection. It stays private until then.',
      href: '/seller/lots',
    })
  })

  it.each([
    ['pending', 'Your seller verification is still with our team. You can submit lots as soon as it is approved.'],
    ['rejected', 'Your seller verification was not approved. Resubmit your details, or appeal to the Operation Manager.'],
    ['none', 'Complete seller verification before submitting a lot.'],
  ] as const)('createLot refuses with the %s-specific message when kycStatus is %s', async (kycStatus, expectedError) => {
    const useStore = await freshStore()
    useStore.getState().signIn('sell@gmail.com', 'FerroBid@Dev2026')
    const me = useStore.getState().currentUser!
    useStore.setState((s) => ({
      users: s.users.map((u) => (u.id === me.id ? { ...u, sellerVerified: false, kycStatus } : u)),
      currentUser: { ...s.currentUser!, sellerVerified: false, kycStatus },
    }))

    const result = useStore.getState().createLot({ metal: 'MS' })
    expect(result).toEqual({ ok: false, error: expectedError })
  })

  describe('setSellerLotDecision', () => {
    const setUp = async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('sell@gmail.com', 'FerroBid@Dev2026')
      const seller = useStore.getState().currentUser!
      const lot = useStore.getState().lots[0]
      const cat = useStore.getState().catalogues.find((c) => c.id === lot.catalogueId)!
      useStore.setState((s) => ({
        lots: s.lots.map((l) => (l.id === lot.id ? { ...l, resultH1Rate: 45_000, currentRate: 45_000, uom: 'MT' } : l)),
        catalogues: s.catalogues.map((c) => (c.id === cat.id ? { ...c, sellerId: seller.id, code: cat.code } : c)),
      }))
      return { useStore, seller, lot, cat }
    }

    it('rejected: audits at warning severity, no commission due, and tells Ops', async () => {
      const { useStore, seller, lot, cat } = await setUp()
      const startAudit = useStore.getState().auditEvents.length

      useStore.getState().setSellerLotDecision(lot.id, 'rejected')

      expect(useStore.getState().lots.find((l) => l.id === lot.id)!.sellerDecision).toBe('rejected')
      expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
      expect(useStore.getState().auditEvents[0]).toMatchObject({
        action: 'lot.seller_decision', target: lot.lotNo, detail: 'Seller rejected the cleared price', severity: 'warning',
      })
      const notif = useStore.getState().notifications.find((n) => n.href === '/exec/settlement')!
      expect(notif.title).toBe(`${lot.lotNo} — seller refused the cleared price`)
      expect(notif.body).toBe(`${seller.firm} refused ${inr(45_000)}/MT on ${cat.code}. No commission is due — decide what happens to the material.`)
    })

    it('accepted: audits at info severity, commission becomes due, and tells Finance', async () => {
      const { useStore, seller, lot, cat } = await setUp()

      useStore.getState().setSellerLotDecision(lot.id, 'accepted')

      expect(useStore.getState().lots.find((l) => l.id === lot.id)!.sellerDecision).toBe('accepted')
      expect(useStore.getState().auditEvents[0]).toMatchObject({
        detail: 'Seller accepted the cleared price', severity: 'info',
      })
      const notif = useStore.getState().notifications.find((n) => n.href === '/finance/commission')!
      expect(notif.title).toBe(`Cleared price accepted — ${lot.lotNo}`)
      expect(notif.body).toBe(`${seller.firm} accepted ${inr(45_000)}/MT on ${cat.code}. Commission becomes due on this lot.`)
    })

    it('null (reset to pending): audits at info severity and sends neither notification', async () => {
      const { useStore, lot } = await setUp()
      const startNotif = useStore.getState().notifications.length

      useStore.getState().setSellerLotDecision(lot.id, null)

      expect(useStore.getState().lots.find((l) => l.id === lot.id)!.sellerDecision).toBeNull()
      expect(useStore.getState().auditEvents[0]).toMatchObject({ detail: 'Seller decision reset to pending', severity: 'info' })
      expect(useStore.getState().notifications.length).toBe(startNotif)
    })
  })

  describe('recordCommissionSettlement', () => {
    it('records the settlement, audits it, and hands it to Finance to confirm — by transfer', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('sell@gmail.com', 'FerroBid@Dev2026')
      const seller = useStore.getState().currentUser!
      const cat = useStore.getState().catalogues[0]
      const startAudit = useStore.getState().auditEvents.length
      const startSettlements = useStore.getState().commissionSettlements.length

      useStore.getState().recordCommissionSettlement(cat.id, 75_000, 'transfer', 'UTR12345')

      const settlements = useStore.getState().commissionSettlements
      expect(settlements.length).toBe(startSettlements + 1)
      const record = settlements[settlements.length - 1]
      expect(record).toMatchObject({ catalogueId: cat.id, sellerId: seller.id, amount: 75_000, mode: 'transfer', reference: 'UTR12345', status: 'recorded' })

      expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
      expect(useStore.getState().auditEvents[0]).toMatchObject({
        action: 'lot.commission_settled', target: cat.code, detail: `Commission paid by transfer — ${inr(75_000)}`,
      })
      const notif = useStore.getState().notifications.find((n) => n.href === '/finance/commission' && n.title === `Commission recorded — ${cat.code}`)!
      expect(notif.body).toBe(`${seller.firm} settled ${inr(75_000)} by transfer. Confirm it against the bank.`)
    })

    it('records an EMD-netted settlement with the internal reference when none is given', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('sell@gmail.com', 'FerroBid@Dev2026')
      const cat = useStore.getState().catalogues[0]

      useStore.getState().recordCommissionSettlement(cat.id, 30_000, 'emd')

      const settlements = useStore.getState().commissionSettlements
      const record = settlements[settlements.length - 1]
      expect(record).toMatchObject({ mode: 'emd', reference: `EMD-NET-${cat.id}` })
      expect(useStore.getState().auditEvents[0].detail).toBe(`Commission netted from EMD — ${inr(30_000)}`)
    })
  })
})
