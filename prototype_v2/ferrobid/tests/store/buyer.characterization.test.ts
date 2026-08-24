import { describe, expect, it } from 'vitest'
import { freshStore } from '../helpers/freshStore'

/** Priority 7: buyer workflows — shortlist, EMD funding, wallet top-up.
 *
 *  The demo buyer (u-buyer-1) ships with a pre-seeded "showcase" selection —
 *  several lots already shortlisted and EMD-funded (see ARCHITECTURE.md's
 *  "seeded data facts") — so every test here explicitly resets that buyer's
 *  wallet/selection state to a known baseline before acting, rather than
 *  asserting on absolute numbers that would drift with the fixture. */
describe('buyer workflows', () => {
  const signInBuyer = (useStore: Awaited<ReturnType<typeof freshStore>>) =>
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')

  /** Puts one catalogue (and returns one of its lots) into a controlled,
   *  EMD-window-open, live state, and clears the signed-in buyer's wallet and
   *  selection for it — so each test starts from a known, deterministic point
   *  regardless of what the fixture pre-seeded for the demo showcase. */
  const cleanSlate = (useStore: Awaited<ReturnType<typeof freshStore>>, balance: number) => {
    const me = useStore.getState().currentUser!
    const now = useStore.getState().now
    const cat = useStore.getState().catalogues.find((c) => useStore.getState().lots.some((l) => l.catalogueId === c.id))!
    const lot = useStore.getState().lots.find((l) => l.catalogueId === cat.id)!
    useStore.setState((s) => ({
      catalogues: s.catalogues.map((c) => (c.id === cat.id
        ? { ...c, status: 'live', emdOpensAt: new Date(now - 3_600_000).toISOString(), emdDeadline: new Date(now + 3_600_000).toISOString() }
        : c)),
      selections: s.selections.filter((sel) => !(sel.buyerId === me.id && sel.catalogueId === cat.id)),
      wallets: s.wallets.map((w) => (w.userId === me.id ? { ...w, balance, emdLocked: 0 } : w)),
    }))
    return { cat, lot }
  }

  it('toggleShortlist adds then removes a lot from the buyer selection', async () => {
    const useStore = await freshStore()
    signInBuyer(useStore)
    const me = useStore.getState().currentUser!
    const { cat, lot } = cleanSlate(useStore, 0)

    useStore.getState().toggleShortlist(cat.id, lot.id)
    let sel = useStore.getState().selections.find((s) => s.buyerId === me.id && s.catalogueId === cat.id)
    expect(sel?.lotIds).toContain(lot.id)

    useStore.getState().toggleShortlist(cat.id, lot.id)
    sel = useStore.getState().selections.find((s) => s.buyerId === me.id && s.catalogueId === cat.id)
    expect(sel?.lotIds ?? []).not.toContain(lot.id)
  })

  it('topUpWallet increases balance and records a ledger entry', async () => {
    const useStore = await freshStore()
    signInBuyer(useStore)
    const before = useStore.getState().wallets.find((w) => w.userId === useStore.getState().currentUser!.id)!
    const startBalance = before.balance
    const startLedgerLen = before.ledger.length

    useStore.getState().topUpWallet(50_000, 'UPI')

    const after = useStore.getState().wallets.find((w) => w.userId === useStore.getState().currentUser!.id)!
    expect(after.balance).toBe(startBalance + 50_000)
    expect(after.ledger.length).toBe(startLedgerLen + 1)
    expect(after.ledger[0]).toMatchObject({ type: 'topup', amount: 50_000 })
  })

  it('fundEmd refuses when the wallet balance is insufficient and changes nothing', async () => {
    const useStore = await freshStore()
    signInBuyer(useStore)
    const me = useStore.getState().currentUser!
    const { cat, lot } = cleanSlate(useStore, 0)

    const ok = useStore.getState().fundEmd(cat.id, [lot.id], 'UPI')
    expect(ok).toBe(false)
    const wallet = useStore.getState().wallets.find((w) => w.userId === me.id)!
    expect(wallet.balance).toBe(0)
    expect(wallet.emdLocked).toBe(0)
  })

  it('fundEmd locks the EMD amount, updates the selection, and notifies the buyer', async () => {
    const useStore = await freshStore()
    signInBuyer(useStore)
    const me = useStore.getState().currentUser!
    const { cat, lot } = cleanSlate(useStore, 0)
    // Top up exactly enough, via the real action, after the lot (and its
    // preBidEmd) is known.
    useStore.getState().topUpWallet(lot.preBidEmd + 1_000_000, 'UPI')
    const startBalance = useStore.getState().wallets.find((w) => w.userId === me.id)!.balance
    const startNotifCount = useStore.getState().notifications.length

    const ok = useStore.getState().fundEmd(cat.id, [lot.id], 'UPI')
    expect(ok).toBe(true)

    const wallet = useStore.getState().wallets.find((w) => w.userId === me.id)!
    expect(wallet.balance).toBe(startBalance - lot.preBidEmd)
    expect(wallet.emdLocked).toBe(lot.preBidEmd)
    const sel = useStore.getState().selections.find((s) => s.buyerId === me.id && s.catalogueId === cat.id)!
    expect(sel.emdFundedLotIds).toContain(lot.id)
    expect(useStore.getState().notifications.length).toBe(startNotifCount + 1)
  })

  it('fundEmd refuses once the EMD deadline has passed, without an approved exemption', async () => {
    const useStore = await freshStore()
    signInBuyer(useStore)
    const me = useStore.getState().currentUser!
    const { cat, lot } = cleanSlate(useStore, 0)
    const now = useStore.getState().now

    useStore.getState().topUpWallet(lot.preBidEmd + 1_000_000, 'UPI')
    // Force the deadline into the past.
    useStore.setState((s) => ({
      catalogues: s.catalogues.map((c) => (c.id === cat.id ? { ...c, emdDeadline: new Date(now - 60_000).toISOString() } : c)),
    }))

    const ok = useStore.getState().fundEmd(cat.id, [lot.id], 'UPI')
    expect(ok).toBe(false)
    expect(useStore.getState().wallets.find((w) => w.userId === me.id)!.emdLocked).toBe(0)
  })
})
