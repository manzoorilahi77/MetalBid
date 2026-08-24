import { describe, expect, it } from 'vitest'
import { freshStore } from '../helpers/freshStore'
import { inr } from '../../src/lib/format'

/** Phase 5 — pure domain extraction of financial calculations (EMD totals,
 *  catalogue reserve value, EMD forfeiture amount) and the inspection-outcome
 *  → lot-status mapping. These tests were written FIRST, against the
 *  pre-extraction inline calculations, and must pass unchanged after the
 *  calculations move into src/lib/{money,emd,lotStatus}.ts — including the
 *  exact notification/audit body text, not just the numbers, since a prior
 *  transcription pass dropped an `inr()` call that only body-text assertions
 *  would have caught. */
describe('financial calculations — before/after extraction', () => {
  const signInFinance = (useStore: Awaited<ReturnType<typeof freshStore>>) =>
    useStore.getState().signIn('finance@gmail.com', 'FerroBid@Dev2026')
  const signInExec = (useStore: Awaited<ReturnType<typeof freshStore>>) =>
    useStore.getState().signIn('executive@gmail.com', 'FerroBid@Dev2026')

  describe('fundEmd — EMD total required', () => {
    it('locks the sum of preBidEmd across every selected lot, and says so in the notification body', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
      const me = useStore.getState().currentUser!
      const now = useStore.getState().now
      const cat = useStore.getState().catalogues.find((c) => useStore.getState().lots.filter((l) => l.catalogueId === c.id).length >= 2)!
      const lots = useStore.getState().lots.filter((l) => l.catalogueId === cat.id).slice(0, 2)
      useStore.setState((s) => ({
        catalogues: s.catalogues.map((c) => (c.id === cat.id
          ? { ...c, status: 'live', emdOpensAt: new Date(now - 3_600_000).toISOString(), emdDeadline: new Date(now + 3_600_000).toISOString() }
          : c)),
        selections: s.selections.filter((sel) => !(sel.buyerId === me.id && sel.catalogueId === cat.id)),
        wallets: s.wallets.map((w) => (w.userId === me.id ? { ...w, balance: 10_000_000, emdLocked: 0 } : w)),
      }))
      const expectedTotal = lots[0].preBidEmd + lots[1].preBidEmd

      const ok = useStore.getState().fundEmd(cat.id, lots.map((l) => l.id), 'UPI')
      expect(ok).toBe(true)

      const wallet = useStore.getState().wallets.find((w) => w.userId === me.id)!
      expect(wallet.emdLocked).toBe(expectedTotal)
      const notif = useStore.getState().notifications[0]
      expect(notif.title).toBe(`EMD locked for ${lots.length} lots`)
      expect(notif.body).toBe(`${inr(expectedTotal)} locked against ${cat.code} via UPI.`)
    })
  })

  describe('raiseEmdForfeiture — forfeiture amount is min(lot EMD, wallet EMD locked)', () => {
    it('refuses a caller outside Finance', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
      const lot = useStore.getState().lots[0]
      const buyer = useStore.getState().users.find((u) => u.role === 'buyer')!
      const startCount = useStore.getState().emdForfeitures.length

      const result = useStore.getState().raiseEmdForfeiture(lot.id, buyer.id, 'x')
      expect(result).toEqual({ ok: false, error: 'Only Finance can forfeit an EMD' })
      expect(useStore.getState().emdForfeitures.length).toBe(startCount)
    })

    it('refuses when the lot does not exist', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const buyer = useStore.getState().users.find((u) => u.role === 'buyer')!

      const result = useStore.getState().raiseEmdForfeiture('lot-does-not-exist', buyer.id, 'x')
      expect(result).toEqual({ ok: false, error: 'Lot not found' })
    })

    it('refuses a second forfeiture on the same lot/buyer while one is already active', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const lot = useStore.getState().lots[0]
      const buyer = useStore.getState().users.find((u) => u.role === 'buyer')!
      useStore.setState((s) => ({
        lots: s.lots.map((l) => (l.id === lot.id ? { ...l, preBidEmd: 50_000 } : l)),
        wallets: s.wallets.map((w) => (w.userId === buyer.id ? { ...w, emdLocked: 50_000 } : w)),
        emdForfeitures: [{
          id: 'emf-existing', buyerId: buyer.id, lotId: lot.id, catalogueId: lot.catalogueId,
          amount: 50_000, reason: 'earlier', status: 'applied',
          raisedBy: 'u-fin-1', raisedAt: new Date(s.now).toISOString(),
        }],
      }))

      const result = useStore.getState().raiseEmdForfeiture(lot.id, buyer.id, 'again')
      expect(result).toEqual({ ok: false, error: 'A forfeiture already exists on this lot for this buyer' })
      expect(useStore.getState().emdForfeitures.length).toBe(1)
    })

    it('does NOT refuse a new forfeiture when the only prior one on the lot was waived', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const lot = useStore.getState().lots[0]
      const buyer = useStore.getState().users.find((u) => u.role === 'buyer')!
      useStore.setState((s) => ({
        lots: s.lots.map((l) => (l.id === lot.id ? { ...l, preBidEmd: 50_000 } : l)),
        wallets: s.wallets.map((w) => (w.userId === buyer.id ? { ...w, emdLocked: 50_000 } : w)),
        emdForfeitures: [{
          id: 'emf-waived', buyerId: buyer.id, lotId: lot.id, catalogueId: lot.catalogueId,
          amount: 50_000, reason: 'earlier, waived', status: 'waived',
          raisedBy: 'u-fin-1', raisedAt: new Date(s.now).toISOString(),
        }],
        financeConfig: { ...s.financeConfig, ceoForfeitureFrom: 150_000 },
      }))

      const result = useStore.getState().raiseEmdForfeiture(lot.id, buyer.id, 'second attempt')
      expect(result).toEqual({ ok: true })
      expect(useStore.getState().emdForfeitures.length).toBe(2)
    })

    it('refuses when no EMD is held against the lot (wallet has zero locked)', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const lot = useStore.getState().lots[0]
      const buyer = useStore.getState().users.find((u) => u.role === 'buyer')!
      useStore.setState((s) => ({
        lots: s.lots.map((l) => (l.id === lot.id ? { ...l, preBidEmd: 50_000 } : l)),
        wallets: s.wallets.map((w) => (w.userId === buyer.id ? { ...w, emdLocked: 0 } : w)),
        emdForfeitures: [],
      }))

      const startCount = useStore.getState().emdForfeitures.length
      const result = useStore.getState().raiseEmdForfeiture(lot.id, buyer.id, 'x')
      expect(result).toEqual({ ok: false, error: 'No EMD is held against this lot' })
      expect(useStore.getState().emdForfeitures.length).toBe(startCount)
    })

    it('an amount exactly equal to the CEO threshold requires sign-off (boundary is >=, not >)', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const lot = useStore.getState().lots[0]
      const buyer = useStore.getState().users.find((u) => u.role === 'buyer')!
      useStore.setState((s) => ({
        lots: s.lots.map((l) => (l.id === lot.id ? { ...l, preBidEmd: 150_000 } : l)),
        wallets: s.wallets.map((w) => (w.userId === buyer.id ? { ...w, emdLocked: 150_000 } : w)),
        emdForfeitures: [],
        financeConfig: { ...s.financeConfig, ceoForfeitureFrom: 150_000 },
      }))

      const result = useStore.getState().raiseEmdForfeiture(lot.id, buyer.id, 'boundary case')
      expect(result).toEqual({ ok: true, awaitingCeo: true })
      expect(useStore.getState().emdForfeitures[0]).toMatchObject({ amount: 150_000, status: 'awaiting_ceo' })
    })

    it('below the CEO threshold, forfeits the capped amount immediately and records it word for word', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const lot = useStore.getState().lots[0]
      const buyer = useStore.getState().users.find((u) => u.role === 'buyer')!
      // Wallet has less locked than the lot's preBidEmd — the forfeiture is
      // capped at what is actually held, not the lot's nominal EMD.
      useStore.setState((s) => ({
        lots: s.lots.map((l) => (l.id === lot.id ? { ...l, preBidEmd: 100_000 } : l)),
        wallets: s.wallets.map((w) => (w.userId === buyer.id ? { ...w, emdLocked: 60_000 } : w)),
        emdForfeitures: [],
        financeConfig: { ...s.financeConfig, ceoForfeitureFrom: 150_000 },
      }))
      const startAudit = useStore.getState().auditEvents.length

      const result = useStore.getState().raiseEmdForfeiture(lot.id, buyer.id, 'Non-payment past the window')
      expect(result).toEqual({ ok: true })

      const record = useStore.getState().emdForfeitures[0]
      expect(record).toMatchObject({ amount: 60_000, status: 'applied' })
      const wallet = useStore.getState().wallets.find((w) => w.userId === buyer.id)!
      expect(wallet.emdLocked).toBe(0)
      expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
      expect(useStore.getState().auditEvents[0]).toMatchObject({
        action: 'emd.forfeit',
        detail: `EMD of ${inr(60_000)} forfeited — Non-payment past the window`,
        severity: 'critical',
      })
      const notif = useStore.getState().notifications.find((n) => n.userId === buyer.id)!
      expect(notif.body).toBe(`${inr(60_000)} held against ${lot.lotNo} has been forfeited. Non-payment past the window`)
    })

    it('at/above the CEO threshold, sends it for sign-off instead of applying it, quoting the capped amount', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const lot = useStore.getState().lots[1]
      const buyer = useStore.getState().users.find((u) => u.role === 'buyer')!
      useStore.setState((s) => ({
        lots: s.lots.map((l) => (l.id === lot.id ? { ...l, preBidEmd: 500_000 } : l)),
        wallets: s.wallets.map((w) => (w.userId === buyer.id ? { ...w, emdLocked: 200_000 } : w)),
        emdForfeitures: [],
        financeConfig: { ...s.financeConfig, ceoForfeitureFrom: 150_000 },
      }))

      const result = useStore.getState().raiseEmdForfeiture(lot.id, buyer.id, 'Buyer defaulted')
      expect(result).toEqual({ ok: true, awaitingCeo: true })

      const record = useStore.getState().emdForfeitures[0]
      // Capped at what the wallet actually holds (200,000), not the lot's
      // preBidEmd (500,000).
      expect(record).toMatchObject({ amount: 200_000, status: 'awaiting_ceo' })
      expect(useStore.getState().auditEvents[0]).toMatchObject({
        action: 'emd.forfeit_request',
        detail: `Forfeiture of ${inr(200_000)} sent for CEO sign-off — Buyer defaulted`,
      })
      const notif = useStore.getState().notifications.find((n) => n.userId === buyer.id)!
      expect(notif.title).toBe(`EMD held pending review — ${lot.lotNo}`)
      expect(notif.body).toBe(`${inr(200_000)} stays locked while a forfeiture is decided. Buyer defaulted`)
      // Wallet is untouched while the CEO decides.
      expect(useStore.getState().wallets.find((w) => w.userId === buyer.id)!.emdLocked).toBe(200_000)
    })
  })

  describe('waiveEmdForfeiture', () => {
    it('waives a pending-CEO forfeiture, withdraws its CEO approval, and credits nothing back automatically', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const buyer = useStore.getState().users.find((u) => u.role === 'buyer')!
      useStore.setState((s) => ({
        emdForfeitures: [{
          id: 'emf-test-1', buyerId: buyer.id, lotId: s.lots[0].id, catalogueId: s.lots[0].catalogueId,
          amount: 200_000, reason: 'Buyer defaulted', status: 'awaiting_ceo',
          raisedBy: 'u-fin-1', raisedAt: new Date(s.now).toISOString(),
        }],
        ceoApprovals: [...s.ceoApprovals, {
          id: 'ceo-test-2', kind: 'emd_forfeiture', refId: 'emf-test-1', amount: 200_000,
          summary: 'test', reason: 'test', requestedBy: 'u-fin-1', requestedAt: new Date(s.now).toISOString(), status: 'pending',
        }],
      }))
      const startAudit = useStore.getState().auditEvents.length

      useStore.getState().waiveEmdForfeiture('emf-test-1', 'Buyer paid before the CEO decided')

      const record = useStore.getState().emdForfeitures.find((f) => f.id === 'emf-test-1')!
      expect(record.status).toBe('waived')
      const approval = useStore.getState().ceoApprovals.find((a) => a.id === 'ceo-test-2')!
      expect(approval.status).toBe('refused')
      expect(approval.decisionNote).toBe('Withdrawn by Finance')

      expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
      expect(useStore.getState().auditEvents[0]).toMatchObject({
        action: 'emd.forfeit_waive', severity: 'warning',
        detail: `Forfeiture of ${inr(200_000)} waived — Buyer paid before the CEO decided`,
      })
      const notif = useStore.getState().notifications.find((n) => n.userId === buyer.id)!
      expect(notif).toMatchObject({ kind: 'wallet', title: 'EMD forfeiture waived' })
      expect(notif.body).toBe(`${inr(200_000)} stays with you. Buyer paid before the CEO decided`)
    })

    it('refuses to waive an already-applied forfeiture', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      useStore.setState((s) => ({
        emdForfeitures: [{
          id: 'emf-test-2', buyerId: s.users.find((u) => u.role === 'buyer')!.id, lotId: s.lots[0].id,
          catalogueId: s.lots[0].catalogueId, amount: 50_000, reason: 'x', status: 'applied',
          raisedBy: 'u-fin-1', raisedAt: new Date(s.now).toISOString(),
        }],
      }))
      const startAudit = useStore.getState().auditEvents.length

      useStore.getState().waiveEmdForfeiture('emf-test-2', 'too late')

      expect(useStore.getState().emdForfeitures.find((f) => f.id === 'emf-test-2')!.status).toBe('applied')
      expect(useStore.getState().auditEvents.length).toBe(startAudit) // no-op, nothing recorded
    })
  })

  describe('publishDraftCatalogue — catalogue reserve value gates the CEO sign-off', () => {
    // perLotReserve is chosen so `perLotReserve * catLots.length` lands
    // exactly on a round number regardless of how many lots the picked
    // catalogue has, keeping the expected formatted string deterministic.
    const setUpDraft = async (perLotReserve: number) => {
      const useStore = await freshStore()
      signInExec(useStore)
      const cat = useStore.getState().catalogues.find((c) => useStore.getState().lots.some((l) => l.catalogueId === c.id))!
      const catLots = useStore.getState().lots.filter((l) => l.catalogueId === cat.id)
      useStore.setState((s) => ({
        catalogues: s.catalogues.map((c) => (c.id === cat.id ? { ...c, status: 'draft' } : c)),
        lots: s.lots.map((l) => (l.catalogueId === cat.id
          ? { ...l, status: 'approved', reserveRate: perLotReserve, indicativeQty: 1 }
          : l)),
        ceoApprovals: s.ceoApprovals.filter((a) => a.refId !== cat.id),
        financeConfig: { ...s.financeConfig, ceoPublishValueFrom: 5_000_000 },
      }))
      return { useStore, cat, expectedReserve: perLotReserve * catLots.length, lotCount: catLots.length }
    }

    it('publishes directly when the reserve total is below the CEO threshold', async () => {
      const { useStore, cat } = await setUpDraft(1_000)

      const result = useStore.getState().publishDraftCatalogue(cat.id, 'now')
      expect(result).toEqual({ ok: true })
      expect(useStore.getState().catalogues.find((c) => c.id === cat.id)!.status).toBe('live')
    })

    it('refuses to publish at/above the threshold without a CEO signature, quoting the reserve value', async () => {
      // 6,000,000 per lot comfortably clears the 5,000,000 threshold even for
      // a catalogue with just one lot.
      const { useStore, cat, expectedReserve } = await setUpDraft(6_000_000)

      const result = useStore.getState().publishDraftCatalogue(cat.id, 'now')
      expect(result.ok).toBe(false)
      expect(result).toMatchObject({
        error: `${inr(expectedReserve)} at reserve is above the ${inr(5_000_000)} publish threshold. Send it for the CEO's signature first.`,
      })
      expect(useStore.getState().catalogues.find((c) => c.id === cat.id)!.status).toBe('draft')
    })
  })

  describe('confirmBuyerPayment — delivery order due amount', () => {
    it('accepts material value + GST + TCS as the due amount, and quotes it exactly', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const s0 = useStore.getState()
      const d = s0.deliveryOrders.find((x) => x.paidAmount < x.materialValue + x.gstAmount + x.tcsAmount)!
      const due = d.materialValue + d.gstAmount + d.tcsAmount

      const result = useStore.getState().confirmBuyerPayment(d.id, 'NEFT', 'UTR-TEST-1')
      expect(result).toEqual({ ok: true })

      const updated = useStore.getState().deliveryOrders.find((x) => x.id === d.id)!
      expect(updated.paidAmount).toBe(due)
      const lot = useStore.getState().lots.find((l) => l.id === d.lotId)
      expect(useStore.getState().auditEvents[0]).toMatchObject({
        action: 'payment.confirm',
        detail: `Receipt of ${inr(due)} confirmed via NEFT (UTR-TEST-1) — delivery order released to Operations`,
      })
      const buyerNotif = useStore.getState().notifications.find((n) => n.userId === d.buyerId)!
      expect(buyerNotif.body).toBe(`We have received ${inr(due)} for ${lot?.lotNo ?? 'your lot'}. Lifting will be scheduled.`)
    })
  })
})

describe('inspection outcome → lot status mapping — before/after extraction', () => {
  const signInOps = (useStore: Awaited<ReturnType<typeof freshStore>>) =>
    useStore.getState().signIn('executive@gmail.com', 'FerroBid@Dev2026')

  const submit = async (outcome: 'verified' | 'flagged' | 'rejected') => {
    const useStore = await freshStore()
    signInOps(useStore)
    const lot = useStore.getState().lots.find((l) => l.status === 'pending_inspection')!
    useStore.getState().submitInspection(
      lot.id,
      { measuredQty: lot.indicativeQty - 1, uom: lot.uom, condition: 'fair', notes: 'n', checklist: [], photoCount: 0, inspectorId: '', status: outcome },
      outcome,
    )
    return { useStore, lot }
  }

  it('verified -> inspected', async () => {
    const { useStore, lot } = await submit('verified')
    expect(useStore.getState().lots.find((l) => l.id === lot.id)!.status).toBe('inspected')
  })

  it('flagged -> flagged, and the seller is told what was measured against what was declared', async () => {
    const { useStore, lot } = await submit('flagged')
    expect(useStore.getState().lots.find((l) => l.id === lot.id)!.status).toBe('flagged')
    const sellerNotif = useStore.getState().notifications.find((n) => n.href === '/seller/lots')
    expect(sellerNotif?.body).toBe(`${lot.indicativeQty - 1} ${lot.uom} measured against ${lot.indicativeQty} ${lot.uom} declared. Operations decides the lot next.`)
  })

  it('rejected -> rejected', async () => {
    const { useStore, lot } = await submit('rejected')
    expect(useStore.getState().lots.find((l) => l.id === lot.id)!.status).toBe('rejected')
  })
})
