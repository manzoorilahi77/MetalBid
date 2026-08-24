import { describe, expect, it } from 'vitest'
import { freshStore } from '../helpers/freshStore'
import { inr } from '../../src/lib/format'

/** Phase 7 — application/use-case extraction of publishDraftCatalogue.
 *  Written FIRST against the pre-extraction implementation to close a real
 *  coverage gap: the only existing tests (Phase 5) checked the CEO-threshold
 *  gate, but nothing exercised the lots-unapproved guard, the 'schedule' mode
 *  path, the CEO-pending-vs-none error variant, or any of the three
 *  notifications' recipients/bodies — exactly what this extraction moves. */
describe('publishDraftCatalogue — before/after extraction', () => {
  const signInExec = (useStore: Awaited<ReturnType<typeof freshStore>>) =>
    useStore.getState().signIn('executive@gmail.com', 'FerroBid@Dev2026')

  const setUpDraft = async (perLotReserve: number) => {
    const useStore = await freshStore()
    signInExec(useStore)
    const cat = useStore.getState().catalogues.find((c) => useStore.getState().lots.some((l) => l.catalogueId === c.id))!
    useStore.setState((s) => ({
      catalogues: s.catalogues.map((c) => (c.id === cat.id ? { ...c, status: 'draft' } : c)),
      lots: s.lots.map((l) => (l.catalogueId === cat.id
        ? { ...l, status: 'approved', reserveRate: perLotReserve, indicativeQty: 1 }
        : l)),
      ceoApprovals: s.ceoApprovals.filter((a) => a.refId !== cat.id),
      financeConfig: { ...s.financeConfig, ceoPublishValueFrom: 5_000_000 },
    }))
    return { useStore, cat: useStore.getState().catalogues.find((c) => c.id === cat.id)! }
  }

  it('refuses when not every lot in the catalogue is approved', async () => {
    const { useStore, cat } = await setUpDraft(100_000)
    const someLot = useStore.getState().lots.find((l) => l.catalogueId === cat.id)!
    useStore.setState((s) => ({
      lots: s.lots.map((l) => (l.id === someLot.id ? { ...l, status: 'inspected' } : l)),
    }))

    const result = useStore.getState().publishDraftCatalogue(cat.id, 'now')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/still needs? approval/)
    expect(useStore.getState().catalogues.find((c) => c.id === cat.id)!.status).toBe('draft')
  })

  it('at/above the CEO threshold with a request already pending, names the pending state', async () => {
    const { useStore, cat } = await setUpDraft(6_000_000)
    useStore.setState((s) => ({
      ceoApprovals: [...s.ceoApprovals, {
        id: 'ceo-test-1', kind: 'auction_publish', refId: cat.id, amount: 1,
        summary: 'test', reason: 'test', requestedBy: 'u-exec-1', requestedAt: new Date().toISOString(), status: 'pending',
      }],
    }))

    const result = useStore.getState().publishDraftCatalogue(cat.id, 'now')
    expect(result.ok).toBe(false)
    expect(result.error).toBe(`${cat.code} is with the CEO for signature — ${inr(6_000_000 * useStore.getState().lots.filter((l) => l.catalogueId === cat.id).length)} at reserve is above the ${inr(5_000_000)} threshold.`)
  })

  it("'now' mode: catalogue goes live, lots go live, and all three notifications fire with the live wording", async () => {
    const { useStore, cat } = await setUpDraft(100_000)
    const catLots = useStore.getState().lots.filter((l) => l.catalogueId === cat.id)
    const startNotifCount = useStore.getState().notifications.length

    const result = useStore.getState().publishDraftCatalogue(cat.id, 'now')
    expect(result).toEqual({ ok: true })

    const updatedCat = useStore.getState().catalogues.find((c) => c.id === cat.id)!
    expect(updatedCat.status).toBe('live')
    const updatedLots = useStore.getState().lots.filter((l) => l.catalogueId === cat.id)
    expect(updatedLots.every((l) => l.status === 'live')).toBe(true)

    expect(useStore.getState().auditEvents[0]).toMatchObject({
      action: 'catalogue.publish', target: cat.code,
      detail: `Published "${cat.title}" with ${catLots.length} lots`,
    })

    const newNotifs = useStore.getState().notifications.slice(0, useStore.getState().notifications.length - startNotifCount)
    const broadcast = newNotifs.find((n) => n.userId === null)!
    expect(broadcast).toMatchObject({ kind: 'lifecycle', title: `New catalogue ${cat.code}`, body: cat.title, href: `/catalogue/${cat.id}` })

    const roleNotif = newNotifs.find((n) => {
      const u = useStore.getState().users.find((x) => x.id === n.userId)
      return u && (u.role === 'auction_manager' || u.role === 'sub_admin')
    })!
    expect(roleNotif).toMatchObject({
      kind: 'lifecycle', title: `${cat.code} is live`,
      body: `${catLots.length} lot${catLots.length === 1 ? '' : 's'} at ${cat.yardName}. It is on the floor now.`,
      href: '/auction/live',
    })

    const sellerNotif = newNotifs.find((n) => n.userId === cat.sellerId)!
    expect(sellerNotif).toMatchObject({
      kind: 'lifecycle', title: `${cat.code} is live`,
      body: `Your ${catLots.length} lot${catLots.length === 1 ? ' is' : 's are'} on the marketplace and EMD funding is open.`,
      href: '/seller/monitor',
    })
  })

  it("'schedule' mode: catalogue goes upcoming, lots stay approved, and notifications use the scheduled wording", async () => {
    const { useStore, cat } = await setUpDraft(100_000)
    const catLots = useStore.getState().lots.filter((l) => l.catalogueId === cat.id)

    const result = useStore.getState().publishDraftCatalogue(cat.id, 'schedule')
    expect(result).toEqual({ ok: true })

    const updatedCat = useStore.getState().catalogues.find((c) => c.id === cat.id)!
    expect(updatedCat.status).toBe('upcoming')
    const updatedLots = useStore.getState().lots.filter((l) => l.catalogueId === cat.id)
    expect(updatedLots.every((l) => l.status === 'approved')).toBe(true)

    const sellerNotif = useStore.getState().notifications.find((n) => n.userId === cat.sellerId)!
    expect(sellerNotif.title).toBe(`${cat.code} is scheduled`)
    // Scheduled-mode bodies embed a locale-formatted date/time — asserted by
    // prefix only, since the exact rendering is environment (TZ) dependent.
    expect(sellerNotif.body).toBe(
      `Your ${catLots.length} lot${catLots.length === 1 ? '' : 's'} go to market on schedule. Buyers can see the catalogue and fund EMD now.`,
    )
    const roleNotif = useStore.getState().notifications.find((n) => {
      const u = useStore.getState().users.find((x) => x.id === n.userId)
      return u && (u.role === 'auction_manager' || u.role === 'sub_admin') && n.title === `${cat.code} is scheduled`
    })!
    expect(roleNotif.body.startsWith(`${catLots.length} lot${catLots.length === 1 ? '' : 's'} at ${cat.yardName}. Opens `)).toBe(true)
    expect(roleNotif.href).toBe('/auction/schedule')
  })
})
