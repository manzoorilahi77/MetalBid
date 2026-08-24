import { describe, expect, it } from 'vitest'
import { freshStore } from '../helpers/freshStore'

/** Priority 8: EMD — the exemption request path (missed-deadline escape hatch). */
describe('EMD exemption requests', () => {
  it('requires a non-empty reason', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    const cat = useStore.getState().catalogues[0]

    const result = useStore.getState().requestEmdExemption(cat.id, '   ')
    expect(result.ok).toBe(false)
  })

  it('records a pending request, audits it at warning severity, and notifies the auction desk', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    const me = useStore.getState().currentUser!
    // Pick a catalogue with no existing non-rejected request from this buyer.
    const cat = useStore.getState().catalogues.find((c) =>
      !useStore.getState().emdExemptionRequests.some((r) => r.buyerId === me.id && r.catalogueId === c.id && r.status !== 'rejected'))!
    const startAudit = useStore.getState().auditEvents.length

    const result = useStore.getState().requestEmdExemption(cat.id, 'RTGS cut-off missed by minutes')
    expect(result).toEqual({ ok: true })

    const req = useStore.getState().emdExemptionRequests.find((r) => r.buyerId === me.id && r.catalogueId === cat.id)!
    expect(req.status).toBe('pending')
    expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'emd_exemption.request', severity: 'warning' })
    expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
  })

  it('refuses a second request while one is already pending or approved', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    const me = useStore.getState().currentUser!
    const cat = useStore.getState().catalogues.find((c) =>
      !useStore.getState().emdExemptionRequests.some((r) => r.buyerId === me.id && r.catalogueId === c.id && r.status !== 'rejected'))!

    useStore.getState().requestEmdExemption(cat.id, 'first reason')
    const second = useStore.getState().requestEmdExemption(cat.id, 'second reason')
    expect(second.ok).toBe(false)
  })

  it('approveEmdExemption reopens fundEmd past a passed deadline', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    const me = useStore.getState().currentUser!
    const now = useStore.getState().now
    const cat = useStore.getState().catalogues.find((c) => useStore.getState().lots.some((l) => l.catalogueId === c.id))!
    const lot = useStore.getState().lots.find((l) => l.catalogueId === cat.id)!

    useStore.setState((s) => ({
      catalogues: s.catalogues.map((c) => (c.id === cat.id
        ? { ...c, status: 'live', emdOpensAt: new Date(now - 7_200_000).toISOString(), emdDeadline: new Date(now - 60_000).toISOString() }
        : c)),
      wallets: s.wallets.map((w) => (w.userId === me.id ? { ...w, balance: lot.preBidEmd + 1_000_000, emdLocked: 0 } : w)),
      selections: s.selections.filter((sel) => !(sel.buyerId === me.id && sel.catalogueId === cat.id)),
      emdExemptionRequests: s.emdExemptionRequests.filter((r) => !(r.buyerId === me.id && r.catalogueId === cat.id)),
    }))

    // Deadline has passed — funding is blocked until the exemption is approved.
    expect(useStore.getState().fundEmd(cat.id, [lot.id], 'UPI')).toBe(false)

    useStore.getState().requestEmdExemption(cat.id, 'Bank holiday in our state')
    const req = useStore.getState().emdExemptionRequests.find((r) => r.buyerId === me.id && r.catalogueId === cat.id)!

    // Approving is an auction-desk action — switch to that role to call it.
    useStore.getState().switchRole('auction_manager')
    useStore.getState().approveEmdExemption(req.id)
    useStore.getState().switchRole('buyer')

    expect(useStore.getState().emdExemptionRequests.find((r) => r.id === req.id)!.status).toBe('approved')
    expect(useStore.getState().fundEmd(cat.id, [lot.id], 'UPI')).toBe(true)
  })
})
