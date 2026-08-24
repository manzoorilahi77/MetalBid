import { describe, expect, it } from 'vitest'
import { freshStore } from '../helpers/freshStore'

/** Priority 10: the client-side "scheduler" — tick() closes lots past their
 *  end time. (The real, always-on scheduler is server-side, in
 *  server/src/jobs/scheduler.mjs — see that file's README section. This is
 *  the store's own mirror, which the README says deliberately does not
 *  persist, only drives the prototype's countdowns/bots/closing locally.) */
describe('tick — lot & catalogue closing', () => {
  const signInBuyer = (useStore: Awaited<ReturnType<typeof freshStore>>) =>
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')

  it('closes a due lot as sold when the current rate is at or above reserve, and raises a delivery order', async () => {
    const useStore = await freshStore()
    signInBuyer(useStore)
    const me = useStore.getState().currentUser!
    const lot = useStore.getState().lots.find((l) => l.catalogueId)!
    const cat = useStore.getState().catalogues.find((c) => c.id === lot.catalogueId)!

    useStore.setState((s) => ({
      catalogues: s.catalogues.map((c) => (c.id === cat.id ? { ...c, status: 'live' } : c)),
      lots: s.lots.map((l) => (l.id === lot.id
        ? { ...l, status: 'live', reserveRate: 1000, currentRate: 1200, leadingBidderId: me.id, endsAt: new Date(Date.now() - 1000).toISOString() }
        : l)),
      paused: { ...s.paused, [cat.id]: false },
    }))

    useStore.getState().tick()

    const closed = useStore.getState().lots.find((l) => l.id === lot.id)!
    expect(closed.status).toBe('sold')
    expect(closed.resultH1Rate).toBe(1200)
    const raised = useStore.getState().deliveryOrders.find((d) => d.lotId === lot.id)!
    expect(raised).toBeTruthy()
    expect(raised.buyerId).toBe(me.id)
    expect(raised.stage).toBe('payment_pending')
  })

  it('closes a due lot as STA when the current rate is below reserve', async () => {
    const useStore = await freshStore()
    signInBuyer(useStore)
    const lot = useStore.getState().lots.find((l) => l.catalogueId)!
    const cat = useStore.getState().catalogues.find((c) => c.id === lot.catalogueId)!

    useStore.setState((s) => ({
      catalogues: s.catalogues.map((c) => (c.id === cat.id ? { ...c, status: 'live' } : c)),
      lots: s.lots.map((l) => (l.id === lot.id
        ? { ...l, status: 'live', reserveRate: 5000, currentRate: 4000, endsAt: new Date(Date.now() - 1000).toISOString() }
        : l)),
      paused: { ...s.paused, [cat.id]: false },
    }))

    useStore.getState().tick()
    expect(useStore.getState().lots.find((l) => l.id === lot.id)!.status).toBe('sta')
  })

  it('closes a due lot with no bids as unsold', async () => {
    const useStore = await freshStore()
    signInBuyer(useStore)
    const lot = useStore.getState().lots.find((l) => l.catalogueId)!
    const cat = useStore.getState().catalogues.find((c) => c.id === lot.catalogueId)!

    useStore.setState((s) => ({
      catalogues: s.catalogues.map((c) => (c.id === cat.id ? { ...c, status: 'live' } : c)),
      lots: s.lots.map((l) => (l.id === lot.id
        ? { ...l, status: 'live', currentRate: null, leadingBidderId: null, endsAt: new Date(Date.now() - 1000).toISOString() }
        : l)),
      paused: { ...s.paused, [cat.id]: false },
    }))

    useStore.getState().tick()
    expect(useStore.getState().lots.find((l) => l.id === lot.id)!.status).toBe('unsold')
  })

  it('releases EMD for a funder who did not win, the moment the lot closes', async () => {
    const useStore = await freshStore()
    signInBuyer(useStore)
    const me = useStore.getState().currentUser!
    const lot = useStore.getState().lots.find((l) => l.catalogueId)!
    const cat = useStore.getState().catalogues.find((c) => c.id === lot.catalogueId)!
    const otherWinnerId = useStore.getState().users.find((u) => u.role === 'buyer' && u.id !== me.id)!.id

    useStore.setState((s) => ({
      catalogues: s.catalogues.map((c) => (c.id === cat.id ? { ...c, status: 'live' } : c)),
      lots: s.lots.map((l) => (l.id === lot.id
        ? { ...l, status: 'live', reserveRate: 1000, currentRate: 1200, leadingBidderId: otherWinnerId, preBidEmd: 20_000, endsAt: new Date(Date.now() - 1000).toISOString() }
        : l)),
      paused: { ...s.paused, [cat.id]: false },
      wallets: s.wallets.map((w) => (w.userId === me.id ? { ...w, balance: 0, emdLocked: 20_000 } : w)),
      // Isolate this buyer's other pre-seeded selections entirely, so a
      // fixture lot resolving elsewhere in the same tick cannot also touch
      // this wallet and break the exact-balance assertion below.
      selections: [
        ...s.selections.filter((sel) => sel.buyerId !== me.id),
        { buyerId: me.id, catalogueId: cat.id, lotIds: [lot.id], emdFundedLotIds: [lot.id] },
      ],
    }))

    useStore.getState().tick()

    const wallet = useStore.getState().wallets.find((w) => w.userId === me.id)!
    expect(wallet.balance).toBe(20_000)
    expect(wallet.emdLocked).toBe(0)
    const sel = useStore.getState().selections.find((s) => s.buyerId === me.id && s.catalogueId === cat.id)!
    expect(sel.emdFundedLotIds).not.toContain(lot.id)
  })

  it('is idempotent — ticking an already-closed lot again changes nothing further', async () => {
    const useStore = await freshStore()
    signInBuyer(useStore)
    const lot = useStore.getState().lots.find((l) => l.catalogueId)!
    const cat = useStore.getState().catalogues.find((c) => c.id === lot.catalogueId)!
    useStore.setState((s) => ({
      catalogues: s.catalogues.map((c) => (c.id === cat.id ? { ...c, status: 'live' } : c)),
      lots: s.lots.map((l) => (l.id === lot.id
        ? { ...l, status: 'live', reserveRate: 1000, currentRate: 1200, endsAt: new Date(Date.now() - 1000).toISOString() }
        : l)),
      paused: { ...s.paused, [cat.id]: false },
    }))
    useStore.getState().tick()
    const dosForLotAfterFirst = useStore.getState().deliveryOrders.filter((d) => d.lotId === lot.id).length
    expect(dosForLotAfterFirst).toBe(1)

    useStore.getState().tick()
    expect(useStore.getState().lots.find((l) => l.id === lot.id)!.status).toBe('sold')
    expect(useStore.getState().deliveryOrders.filter((d) => d.lotId === lot.id).length).toBe(1)
  })
})
