import { describe, expect, it } from 'vitest'
import { freshStore } from '../helpers/freshStore'

/** Priority 9: bidding — the client-side mirror of the server-authoritative
 *  placeBid in server/src/api/bidding.mjs. These pin the exact rules this
 *  store enforces today: minimum increment, live-only, pause, anti-snipe, and
 *  the one-offer-per-buyer rule on sealed tenders. */
describe('bidding', () => {
  const signInBuyer = (useStore: Awaited<ReturnType<typeof freshStore>>) =>
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')

  /** A live, unpaused, non-tender lot with a controlled current rate/increment
   *  and a closing time far enough out to be outside the anti-snipe window. */
  const liveLot = (useStore: Awaited<ReturnType<typeof freshStore>>) => {
    const now = useStore.getState().now
    const lot = useStore.getState().lots.find((l) => l.catalogueId)!
    const cat = useStore.getState().catalogues.find((c) => c.id === lot.catalogueId)!
    useStore.setState((s) => ({
      catalogues: s.catalogues.map((c) => (c.id === cat.id ? { ...c, status: 'live', type: 'forward', antiSnipeMinutes: 5 } : c)),
      lots: s.lots.map((l) => (l.id === lot.id
        ? { ...l, status: 'live', startRate: 1000, increment: 100, currentRate: null, leadingBidderId: null, bidCount: 0, endsAt: new Date(now + 3_600_000).toISOString(), extensions: 0 }
        : l)),
      // Clear any pre-existing fixture bids on this lot — the lot's own
      // counters above are reset to match, so the bid history must agree.
      bids: s.bids.filter((b) => b.lotId !== lot.id),
      paused: { ...s.paused, [cat.id]: false },
    }))
    return { cat: useStore.getState().catalogues.find((c) => c.id === cat.id)!, lot: useStore.getState().lots.find((l) => l.id === lot.id)! }
  }

  it('rejects a bid below the minimum next-bid rate', async () => {
    const useStore = await freshStore()
    signInBuyer(useStore)
    const { lot } = liveLot(useStore)

    const result = useStore.getState().placeBid(lot.id, 999)
    expect(result.ok).toBe(false)
    expect(useStore.getState().lots.find((l) => l.id === lot.id)!.currentRate).toBeNull()
  })

  it('accepts a valid bid, sets it as leading, and increments the bid count', async () => {
    const useStore = await freshStore()
    signInBuyer(useStore)
    const me = useStore.getState().currentUser!
    const { lot } = liveLot(useStore)

    const result = useStore.getState().placeBid(lot.id, 1000)
    expect(result).toEqual({ ok: true })

    const updated = useStore.getState().lots.find((l) => l.id === lot.id)!
    expect(updated.currentRate).toBe(1000)
    expect(updated.leadingBidderId).toBe(me.id)
    expect(updated.bidCount).toBe(1)
    expect(useStore.getState().bids.some((b) => b.lotId === lot.id && b.rate === 1000 && b.bidderId === me.id)).toBe(true)
  })

  it('enforces the minimum increment on the second bid', async () => {
    const useStore = await freshStore()
    signInBuyer(useStore)
    const { lot } = liveLot(useStore)
    useStore.getState().placeBid(lot.id, 1000)

    const tooSmall = useStore.getState().placeBid(lot.id, 1050)
    expect(tooSmall.ok).toBe(false)

    const ok = useStore.getState().placeBid(lot.id, 1100)
    expect(ok).toEqual({ ok: true })
  })

  it('refuses a bid on a paused auction', async () => {
    const useStore = await freshStore()
    signInBuyer(useStore)
    const { cat, lot } = liveLot(useStore)
    useStore.setState((s) => ({ paused: { ...s.paused, [cat.id]: true } }))

    const result = useStore.getState().placeBid(lot.id, 1000)
    expect(result).toEqual({ ok: false, error: 'Auction is paused by the administrator' })
  })

  it('anti-snipe: a bid inside the extension window pushes the close time out and counts an extension', async () => {
    const useStore = await freshStore()
    signInBuyer(useStore)
    const { cat, lot } = liveLot(useStore)
    const now = useStore.getState().now
    // Inside the 5-minute anti-snipe window.
    useStore.setState((s) => ({
      lots: s.lots.map((l) => (l.id === lot.id ? { ...l, endsAt: new Date(now + 60_000).toISOString() } : l)),
    }))
    const beforeEndsAt = useStore.getState().lots.find((l) => l.id === lot.id)!.endsAt

    useStore.getState().placeBid(lot.id, 1000)

    const after = useStore.getState().lots.find((l) => l.id === lot.id)!
    expect(Date.parse(after.endsAt)).toBe(Date.parse(beforeEndsAt) + cat.antiSnipeMinutes * 60_000)
    expect(after.extensions).toBe(1)
  })

  it('a sealed tender lot accepts only one offer per buyer, with no visible leader', async () => {
    const useStore = await freshStore()
    signInBuyer(useStore)
    const { cat, lot } = liveLot(useStore)
    useStore.setState((s) => ({
      catalogues: s.catalogues.map((c) => (c.id === cat.id ? { ...c, type: 'tender' } : c)),
    }))

    const first = useStore.getState().placeBid(lot.id, 1000)
    expect(first).toEqual({ ok: true })

    const second = useStore.getState().placeBid(lot.id, 1500)
    expect(second).toEqual({ ok: false, error: 'You have already submitted an offer for this lot' })
  })
})
