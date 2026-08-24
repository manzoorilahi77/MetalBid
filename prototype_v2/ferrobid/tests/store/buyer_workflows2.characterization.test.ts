import { describe, expect, it } from 'vitest'
import { freshStore } from '../helpers/freshStore'
import { inr, num } from '../../src/lib/format'
import type { DeliveryOrder } from '../../src/types'

/** Priority 9: remaining buyer-side actions migrated in Phase 11 — yard
 *  inspection booking, seller-KYC application, weighment/lifting handover,
 *  bank account registration, and deposit claims. */
describe('buyer workflows — phase 11', () => {
  const signInBuyer = (useStore: Awaited<ReturnType<typeof freshStore>>) =>
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')

  const makeDeliveryOrder = (overrides: Partial<DeliveryOrder> & { id: string; lotId: string; catalogueId: string; buyerId: string }): DeliveryOrder => ({
    stage: 'lifted', h1Rate: 45_000, awardedQty: 25, uom: 'MT', materialValue: 1_125_000,
    gstAmount: 202_500, tcsAmount: 1_125, paidAmount: 1_328_625, liftingBy: 'self', createdAt: new Date().toISOString(),
    liftingChecklist: [
      { key: 'vehicle_at_weighbridge', label: 'Vehicle at weighbridge', done: true },
      { key: 'loading_complete', label: 'Loading complete', done: true },
      { key: 'gross_weighment', label: 'Gross weighment', done: false },
    ],
    ...overrides,
  })

  describe('bookInspectionSlot', () => {
    it('books the slot, audits it, and notifies Ops (plus the assigned field exec when there is one)', async () => {
      const useStore = await freshStore()
      signInBuyer(useStore)
      const me = useStore.getState().currentUser!
      const cat = useStore.getState().catalogues[0]
      useStore.setState((s) => ({ catalogues: s.catalogues.map((c) => (c.id === cat.id ? { ...c, assignedFieldExecId: 'u-field-1', yardName: 'Bhiwandi Yard' } : c)) }))
      const startAudit = useStore.getState().auditEvents.length
      const startNotif = useStore.getState().notifications.length
      const startSlots = useStore.getState().inspectionSlots.length

      useStore.getState().bookInspectionSlot(cat.id, '2026-09-01', '10:00-12:00', 2)

      expect(useStore.getState().inspectionSlots.length).toBe(startSlots + 1)
      const slot = useStore.getState().inspectionSlots[useStore.getState().inspectionSlots.length - 1]
      expect(slot).toMatchObject({ catalogueId: cat.id, userId: me.id, date: '2026-09-01', window: '10:00-12:00', persons: 2, status: 'booked' })
      expect(slot.passCode).toMatch(/^FB-GATE-/)

      expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
      expect(useStore.getState().auditEvents[0]).toMatchObject({
        action: 'inspection.slot_book', target: cat.code, detail: `${me.firm} booked a yard visit for 2 on 2026-09-01 (10:00-12:00)`,
      })
      expect(useStore.getState().notifications.length).toBeGreaterThan(startNotif)
      const opsNotif = useStore.getState().notifications.find((n) => n.href === '/exec/logistics')!
      expect(opsNotif.title).toBe(`Yard visit booked — ${cat.code}`)
      expect(opsNotif.body).toBe(`${me.firm} · 2 visitors on 2026-09-01, 10:00-12:00, at Bhiwandi Yard.`)
      const fieldNotif = useStore.getState().notifications.find((n) => n.userId === 'u-field-1')!
      expect(fieldNotif).toMatchObject({ title: 'Buyer visiting Bhiwandi Yard', href: `/field/catalogue/${cat.id}` })
    })

    it('sends no field-exec notification when no field exec is assigned', async () => {
      const useStore = await freshStore()
      signInBuyer(useStore)
      const cat = useStore.getState().catalogues[0]
      useStore.setState((s) => ({ catalogues: s.catalogues.map((c) => (c.id === cat.id ? { ...c, assignedFieldExecId: undefined } : c)) }))

      useStore.getState().bookInspectionSlot(cat.id, '2026-09-01', '10:00-12:00', 1)

      expect(useStore.getState().notifications.some((n) => n.title.startsWith('Buyer visiting'))).toBe(false)
    })
  })

  describe('submitKyc', () => {
    it('sets kycStatus to pending, audits it, and notifies the buyer and the verification desk', async () => {
      const useStore = await freshStore()
      signInBuyer(useStore)
      const me = useStore.getState().currentUser!
      const startAudit = useStore.getState().auditEvents.length

      useStore.getState().submitKyc()

      expect(useStore.getState().currentUser!.kycStatus).toBe('pending')
      expect(useStore.getState().users.find((u) => u.id === me.id)!.kycStatus).toBe('pending')
      expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
      expect(useStore.getState().auditEvents[0]).toMatchObject({
        action: 'kyc.submit', target: me.firm, detail: `${me.name} applied to sell — GSTIN ${me.gstin || 'not given'}`,
      })
      const selfNotif = useStore.getState().notifications.find((n) => n.userId === me.id && n.title === 'Seller KYC submitted')!
      expect(selfNotif.body).toBe('Our team will verify your GSTIN and bank details within 1 business day.')
      const opsNotif = useStore.getState().notifications.find((n) => n.href === '/sub/seller-verification')!
      expect(opsNotif.title).toBe(`Seller verification — ${me.firm}`)
    })
  })

  describe('recordWeighment', () => {
    it('a staff witness records the weighment at info severity and confirms the buyer', async () => {
      const useStore = await freshStore()
      signInBuyer(useStore)
      const buyer = useStore.getState().currentUser!
      const lot = useStore.getState().lots[0]
      const doId = 'do-test-1'
      const order = makeDeliveryOrder({ id: doId, lotId: lot.id, catalogueId: lot.catalogueId ?? 'cat-x', buyerId: buyer.id })
      useStore.setState((s) => ({ deliveryOrders: [...s.deliveryOrders, order] }))
      useStore.getState().signIn('executive@gmail.com', 'FerroBid@Dev2026')
      const staff = useStore.getState().currentUser!
      const startAudit = useStore.getState().auditEvents.length

      useStore.getState().recordWeighment(doId, 25)

      const updated = useStore.getState().deliveryOrders.find((d) => d.id === doId)!
      expect(updated.weighedQty).toBe(25)
      expect(updated.weighedById).toBe(staff.id)
      expect(updated.liftingChecklist.find((i) => i.key === 'gross_weighment')!.done).toBe(true)
      expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
      expect(useStore.getState().auditEvents[0]).toMatchObject({
        action: 'do.weighment', target: lot.lotNo,
        detail: `Gross weighment ${num(25)} MT recorded by ${staff.name} against ${num(25)} MT awarded — +0.0%`,
        severity: 'info',
      })
      const confirmNotif = useStore.getState().notifications.find((n) => n.userId === buyer.id && n.title.startsWith('Weighment confirmed'))!
      expect(confirmNotif.body).toBe(`Recorded at ${num(25)} MT, witnessed by ${staff.name}. This is the quantity your invoice is raised on.`)
    })

    it('a buyer self-declaration audits at warning severity for >=1% variance and notifies Ops, not the buyer', async () => {
      const useStore = await freshStore()
      signInBuyer(useStore)
      const buyer = useStore.getState().currentUser!
      const lot = useStore.getState().lots[0]
      const doId = 'do-test-2'
      const order = makeDeliveryOrder({ id: doId, lotId: lot.id, catalogueId: lot.catalogueId ?? 'cat-x', buyerId: buyer.id })
      useStore.setState((s) => ({ deliveryOrders: [...s.deliveryOrders, order] }))
      const startNotif = useStore.getState().notifications.length

      useStore.getState().recordWeighment(doId, 24)

      const updated = useStore.getState().deliveryOrders.find((d) => d.id === doId)!
      expect(updated.weighedById).toBe(buyer.id)
      expect(useStore.getState().auditEvents[0]).toMatchObject({ severity: 'warning' })
      expect(useStore.getState().notifications.length).toBeGreaterThan(startNotif)
      const opsNotif = useStore.getState().notifications.find((n) => n.href === '/exec/logistics')!
      expect(opsNotif.title).toBe(`Weighment declared — ${lot.lotNo}`)
      expect(useStore.getState().notifications.some((n) => n.userId === buyer.id && n.title.startsWith('Weighment confirmed'))).toBe(false)
    })

    it('a >=1% shortfall also notifies Finance', async () => {
      const useStore = await freshStore()
      signInBuyer(useStore)
      const buyer = useStore.getState().currentUser!
      const lot = useStore.getState().lots[0]
      const doId = 'do-test-3'
      const order = makeDeliveryOrder({ id: doId, lotId: lot.id, catalogueId: lot.catalogueId ?? 'cat-x', buyerId: buyer.id })
      useStore.setState((s) => ({ deliveryOrders: [...s.deliveryOrders, order] }))

      useStore.getState().recordWeighment(doId, 24)

      const shortfallNotif = useStore.getState().notifications.find((n) => n.href === '/finance/refunds')!
      expect(shortfallNotif.title).toBe(`Weighment shortfall — ${lot.lotNo}`)
    })

    it('does nothing when the delivery order is not in the lifted stage', async () => {
      const useStore = await freshStore()
      signInBuyer(useStore)
      const buyer = useStore.getState().currentUser!
      const lot = useStore.getState().lots[0]
      const doId = 'do-test-4'
      const order = makeDeliveryOrder({ id: doId, lotId: lot.id, catalogueId: lot.catalogueId ?? 'cat-x', buyerId: buyer.id, stage: 'lifting_scheduled' })
      useStore.setState((s) => ({ deliveryOrders: [...s.deliveryOrders, order] }))
      const startAudit = useStore.getState().auditEvents.length

      useStore.getState().recordWeighment(doId, 25)

      expect(useStore.getState().deliveryOrders.find((d) => d.id === doId)!.weighedQty).toBeUndefined()
      expect(useStore.getState().auditEvents.length).toBe(startAudit)
    })

    it('does nothing when the caller is neither the buyer nor a witnessing role', async () => {
      const useStore = await freshStore()
      signInBuyer(useStore)
      const otherBuyerOrder = makeDeliveryOrder({ id: 'do-test-5', lotId: useStore.getState().lots[0].id, catalogueId: 'cat-x', buyerId: 'u-someone-else' })
      useStore.setState((s) => ({ deliveryOrders: [...s.deliveryOrders, otherBuyerOrder] }))
      const startAudit = useStore.getState().auditEvents.length

      useStore.getState().recordWeighment('do-test-5', 25)

      expect(useStore.getState().deliveryOrders.find((d) => d.id === 'do-test-5')!.weighedQty).toBeUndefined()
      expect(useStore.getState().auditEvents.length).toBe(startAudit)
    })
  })

  describe('completeLifting', () => {
    it('closes the delivery order, audits it, and tells Ops to close the handover', async () => {
      const useStore = await freshStore()
      signInBuyer(useStore)
      const buyer = useStore.getState().currentUser!
      const lot = useStore.getState().lots[0]
      const doId = 'do-test-6'
      const order = makeDeliveryOrder({
        id: doId, lotId: lot.id, catalogueId: lot.catalogueId ?? 'cat-x', buyerId: buyer.id, weighedQty: 25,
        liftingChecklist: [
          { key: 'vehicle_at_weighbridge', label: 'Vehicle at weighbridge', done: true },
          { key: 'loading_complete', label: 'Loading complete', done: true },
          { key: 'gross_weighment', label: 'Gross weighment', done: true },
        ],
      })
      useStore.setState((s) => ({ deliveryOrders: [...s.deliveryOrders, order] }))
      const startAudit = useStore.getState().auditEvents.length

      useStore.getState().completeLifting(doId)

      expect(useStore.getState().deliveryOrders.find((d) => d.id === doId)!.stage).toBe('completed')
      expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
      expect(useStore.getState().auditEvents[0]).toMatchObject({
        action: 'do.complete', target: lot.lotNo, detail: `Lifting completed — ${num(25)} MT weighed vs ${num(25)} MT indicative`,
      })
      const notif = useStore.getState().notifications.find((n) => n.href === '/exec/handover')!
      expect(notif.title).toBe(`Lifting complete — ${lot.lotNo}`)
    })

    it('does nothing while the checklist is incomplete', async () => {
      const useStore = await freshStore()
      signInBuyer(useStore)
      const buyer = useStore.getState().currentUser!
      const lot = useStore.getState().lots[0]
      const doId = 'do-test-7'
      const order = makeDeliveryOrder({ id: doId, lotId: lot.id, catalogueId: lot.catalogueId ?? 'cat-x', buyerId: buyer.id })
      useStore.setState((s) => ({ deliveryOrders: [...s.deliveryOrders, order] }))
      const startAudit = useStore.getState().auditEvents.length

      useStore.getState().completeLifting(doId)

      expect(useStore.getState().deliveryOrders.find((d) => d.id === doId)!.stage).toBe('lifted')
      expect(useStore.getState().auditEvents.length).toBe(startAudit)
    })
  })

  describe('registerBankAccount', () => {
    it('registers the account pending verification, audits it, and tells Finance', async () => {
      const useStore = await freshStore()
      signInBuyer(useStore)
      const me = useStore.getState().currentUser!
      const startAudit = useStore.getState().auditEvents.length

      useStore.getState().registerBankAccount('HDFC Bank', '123456789012', 'HDFC0001234', 'Test Trading Co')

      const acc = useStore.getState().bankAccounts[useStore.getState().bankAccounts.length - 1]
      expect(acc).toMatchObject({ userId: me.id, bankName: 'HDFC Bank', ifsc: 'HDFC0001234', accountHolderName: 'Test Trading Co', status: 'pending', last4: '9012' })
      expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
      expect(useStore.getState().auditEvents[0]).toMatchObject({
        action: 'bankaccount.register', target: acc.id, detail: `HDFC Bank account ${acc.accountNumberMasked} registered for verification`,
      })
      const notif = useStore.getState().notifications.find((n) => n.href === '/finance/bank-accounts' && n.title === `Payout account to verify — ${me.firm}`)!
      expect(notif.body).toBe(`HDFC Bank ${acc.accountNumberMasked}, held by Test Trading Co. Nothing can be withdrawn to it until you verify it.`)
    })
  })

  describe('submitDepositClaim', () => {
    it('records the claim, audits it, and tells Finance to match it', async () => {
      const useStore = await freshStore()
      signInBuyer(useStore)
      const me = useStore.getState().currentUser!
      const startAudit = useStore.getState().auditEvents.length

      const result = useStore.getState().submitDepositClaim(200_000, 'UTR999888', '2026-08-20', 'proof.pdf')
      expect(result).toEqual({ ok: true })

      const claim = useStore.getState().depositClaims[useStore.getState().depositClaims.length - 1]
      expect(claim).toMatchObject({ userId: me.id, amount: 200_000, utr: 'UTR999888', transferDate: '2026-08-20', proofFilename: 'proof.pdf', status: 'submitted' })
      expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
      expect(useStore.getState().auditEvents[0]).toMatchObject({
        action: 'deposit.submit', target: claim.id, detail: `Deposit claim of ${inr(200_000)} submitted — UTR UTR999888`,
      })
      const notif = useStore.getState().notifications.find((n) => n.href === '/finance/deposits')!
      expect(notif.title).toBe(`Deposit claimed — ${inr(200_000)}`)
      expect(notif.body).toBe(`${me.firm} · UTR ${claim.utr} dated 2026-08-20. Match it against the statement before crediting the wallet.`)
    })

    it('refuses an empty UTR and changes nothing', async () => {
      const useStore = await freshStore()
      signInBuyer(useStore)
      const startCount = useStore.getState().depositClaims.length

      const result = useStore.getState().submitDepositClaim(100_000, '   ', '2026-08-20')
      expect(result).toEqual({ ok: false, error: 'Enter the UTR / reference number' })
      expect(useStore.getState().depositClaims.length).toBe(startCount)
    })

    it('refuses a duplicate UTR (case/whitespace-insensitive)', async () => {
      const useStore = await freshStore()
      signInBuyer(useStore)
      useStore.getState().submitDepositClaim(100_000, 'UTR-DUP-1', '2026-08-20')
      const startCount = useStore.getState().depositClaims.length

      const result = useStore.getState().submitDepositClaim(50_000, '  utr-dup-1  ', '2026-08-21')
      expect(result).toEqual({ ok: false, error: 'A claim with this reference already exists' })
      expect(useStore.getState().depositClaims.length).toBe(startCount)
    })
  })

  describe('cancelWithdrawal', () => {
    it('cancels a requested withdrawal, reverses the wallet ledger, and notifies Finance and the buyer', async () => {
      const useStore = await freshStore()
      signInBuyer(useStore)
      const me = useStore.getState().currentUser!
      const req = { id: 'wdr-test-1', userId: me.id, amount: 40_000, bankAccountId: 'bank-1', ref: 'WDR-TEST-1', status: 'requested' as const, requestedAt: new Date().toISOString() }
      useStore.setState((s) => ({ withdrawalRequests: [...s.withdrawalRequests, req] }))
      const wallet = useStore.getState().wallets.find((w) => w.userId === me.id)!
      const startBalance = wallet.balance
      const startAudit = useStore.getState().auditEvents.length

      useStore.getState().cancelWithdrawal('wdr-test-1')

      expect(useStore.getState().withdrawalRequests.find((r) => r.id === 'wdr-test-1')!.status).toBe('cancelled')
      expect(useStore.getState().wallets.find((w) => w.userId === me.id)!.balance).toBe(startBalance + 40_000)
      expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
      expect(useStore.getState().auditEvents[0]).toMatchObject({
        action: 'withdrawal.cancel', target: 'wdr-test-1', detail: `Withdrawal of ${inr(40_000)} cancelled by buyer — reversed`,
      })
      const deskNotif = useStore.getState().notifications.find((n) => n.href === '/finance/withdrawals' && n.title === `Withdrawal withdrawn — ${inr(40_000)}`)!
      expect(deskNotif.body).toBe(`${me.firm} cancelled their request before it was released. The balance is back in their wallet; nothing to process.`)
      const selfNotif = useStore.getState().notifications.find((n) => n.userId === me.id && n.title === 'Withdrawal cancelled')!
      expect(selfNotif.body).toBe(`${inr(40_000)} is back in your available balance.`)
    })

    it('does nothing for another buyer\'s withdrawal request', async () => {
      const useStore = await freshStore()
      signInBuyer(useStore)
      const req = { id: 'wdr-test-2', userId: 'u-someone-else', amount: 40_000, bankAccountId: 'bank-1', ref: 'WDR-TEST-2', status: 'requested' as const, requestedAt: new Date().toISOString() }
      useStore.setState((s) => ({ withdrawalRequests: [...s.withdrawalRequests, req] }))
      const startAudit = useStore.getState().auditEvents.length

      useStore.getState().cancelWithdrawal('wdr-test-2')

      expect(useStore.getState().withdrawalRequests.find((r) => r.id === 'wdr-test-2')!.status).toBe('requested')
      expect(useStore.getState().auditEvents.length).toBe(startAudit)
    })

    it('does nothing for a request that is not in the requested status', async () => {
      const useStore = await freshStore()
      signInBuyer(useStore)
      const me = useStore.getState().currentUser!
      const req = { id: 'wdr-test-3', userId: me.id, amount: 40_000, bankAccountId: 'bank-1', ref: 'WDR-TEST-3', status: 'processed' as const, requestedAt: new Date().toISOString() }
      useStore.setState((s) => ({ withdrawalRequests: [...s.withdrawalRequests, req] }))
      const startAudit = useStore.getState().auditEvents.length

      useStore.getState().cancelWithdrawal('wdr-test-3')

      expect(useStore.getState().withdrawalRequests.find((r) => r.id === 'wdr-test-3')!.status).toBe('processed')
      expect(useStore.getState().auditEvents.length).toBe(startAudit)
    })
  })
})
