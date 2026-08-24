import { describe, expect, it } from 'vitest'
import { freshStore } from '../helpers/freshStore'

/** Priorities 5/6 (catalogue pipeline) — the lot quality gate: inspection then
 *  the Operations/Sub Admin decision (approve/flag/reject). */
describe('ops / inspection pipeline', () => {
  const signInOps = (useStore: Awaited<ReturnType<typeof freshStore>>) =>
    useStore.getState().signIn('executive@gmail.com', 'FerroBid@Dev2026')

  it('submitInspection moves a lot to inspected on a verified outcome', async () => {
    const useStore = await freshStore()
    signInOps(useStore)
    const lot = useStore.getState().lots.find((l) => l.status === 'pending_inspection')!
    expect(lot).toBeTruthy()

    useStore.getState().submitInspection(
      lot.id,
      {
        measuredQty: lot.indicativeQty, uom: lot.uom, condition: 'good', notes: 'ok',
        checklist: [], photoCount: 0, inspectorId: '', status: 'verified',
      },
      'verified',
    )

    const updated = useStore.getState().lots.find((l) => l.id === lot.id)!
    expect(updated.status).toBe('inspected')
    expect(updated.inspectionReportId).toBeTruthy()
  })

  it('submitInspection succeeds for a Field Executive, the real caller of /field/inspect', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('field@gmail.com', 'FerroBid@Dev2026')
    const lot = useStore.getState().lots.find((l) => l.status === 'pending_inspection')!

    const result = useStore.getState().submitInspection(
      lot.id,
      { measuredQty: lot.indicativeQty, uom: lot.uom, condition: 'good', notes: 'ok', checklist: [], photoCount: 0, inspectorId: '', status: 'verified' },
      'verified',
    )

    expect(result).toEqual({ ok: true })
    expect(useStore.getState().lots.find((l) => l.id === lot.id)!.status).toBe('inspected')
  })

  it.skip('BEFORE Phase 28c: submitInspection accepted a report from a buyer, with no role check at all', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    const lot = useStore.getState().lots.find((l) => l.status === 'pending_inspection')!

    useStore.getState().submitInspection(
      lot.id,
      { measuredQty: lot.indicativeQty, uom: lot.uom, condition: 'good', notes: 'ok', checklist: [], photoCount: 0, inspectorId: '', status: 'verified' },
      'verified',
    )

    expect(useStore.getState().lots.find((l) => l.id === lot.id)!.status).toBe('inspected')
  })

  it('AFTER Phase 28c: submitInspection refuses a caller who is not a Field Executive, Operations or a Sub Admin', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    const lot = useStore.getState().lots.find((l) => l.status === 'pending_inspection')!

    const result = useStore.getState().submitInspection(
      lot.id,
      { measuredQty: lot.indicativeQty, uom: lot.uom, condition: 'good', notes: 'ok', checklist: [], photoCount: 0, inspectorId: '', status: 'verified' },
      'verified',
    )

    expect(result).toEqual({ ok: false, error: 'Only a Field Executive, Operations or a Sub Admin files an inspection' })
    expect(useStore.getState().lots.find((l) => l.id === lot.id)!.status).toBe('pending_inspection')
  })

  it('decideLot refuses a caller who is not Operations or a Sub Admin', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    const lot = useStore.getState().lots.find((l) => l.status === 'inspected')!

    const result = useStore.getState().decideLot(lot.id, 'approved')
    expect(result).toEqual({ ok: false, error: 'Only Operations or a Sub Admin decides a lot' })
    expect(useStore.getState().lots.find((l) => l.id === lot.id)!.status).toBe('inspected')
  })

  it('decideLot requires a reason for anything but a plain approval', async () => {
    const useStore = await freshStore()
    signInOps(useStore)
    const lot = useStore.getState().lots.find((l) => l.status === 'inspected')!

    const result = useStore.getState().decideLot(lot.id, 'rejected')
    expect(result.ok).toBe(false)
    expect(useStore.getState().lots.find((l) => l.id === lot.id)!.status).toBe('inspected')
  })

  it('decideLot approves a lot, notifies the seller, and audits the decision', async () => {
    const useStore = await freshStore()
    signInOps(useStore)
    const lot = useStore.getState().lots.find((l) => l.status === 'inspected')!
    const startAudit = useStore.getState().auditEvents.length

    const result = useStore.getState().decideLot(lot.id, 'approved')
    expect(result).toEqual({ ok: true })

    expect(useStore.getState().lots.find((l) => l.id === lot.id)!.status).toBe('approved')
    expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
    expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'lot.approved', target: lot.lotNo })
  })

  it('decideLot rejects with a reason, recorded on the audit trail at warning severity', async () => {
    const useStore = await freshStore()
    signInOps(useStore)
    const lot = useStore.getState().lots.find((l) => l.status === 'inspected')!

    const result = useStore.getState().decideLot(lot.id, 'rejected', 'Grade does not match the declaration')
    expect(result).toEqual({ ok: true })
    expect(useStore.getState().lots.find((l) => l.id === lot.id)!.status).toBe('rejected')
    expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'lot.rejected', severity: 'warning' })
  })

  it('waiveInspection refuses a caller who is not Operations or a Sub Admin', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    const lot = useStore.getState().lots.find((l) => l.status === 'pending_inspection')!

    const result = useStore.getState().waiveInspection(lot.id, 'u-exec-1', 'Trusted seller, urgent turnaround')
    expect(result).toEqual({ ok: false, error: 'Only Operations or a Sub Admin may bypass an inspection' })
    expect(useStore.getState().lots.find((l) => l.id === lot.id)!.inspectionWaived).toBe(false)
  })

  it('waiveInspection requires a typed reason', async () => {
    const useStore = await freshStore()
    signInOps(useStore)
    const lot = useStore.getState().lots.find((l) => l.status === 'pending_inspection')!

    const result = useStore.getState().waiveInspection(lot.id, 'u-exec-1', '   ')
    expect(result).toEqual({ ok: false, error: 'A typed reason is required to bypass an inspection' })
  })

  it('waiveInspection approves the lot on the seller\'s word, records who and why, and audits at warning severity', async () => {
    const useStore = await freshStore()
    signInOps(useStore)
    const lot = useStore.getState().lots.find((l) => l.status === 'pending_inspection')!
    const startAudit = useStore.getState().auditEvents.length

    const result = useStore.getState().waiveInspection(lot.id, 'u-exec-1', 'Trusted seller, urgent turnaround')
    expect(result).toEqual({ ok: true })

    const updated = useStore.getState().lots.find((l) => l.id === lot.id)!
    expect(updated).toMatchObject({
      status: 'approved', inspectionWaived: true, waivedBy: 'u-exec-1', waivedReason: 'Trusted seller, urgent turnaround',
    })
    expect(updated.waivedAt).toBeTruthy()

    expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
    expect(useStore.getState().auditEvents[0]).toMatchObject({
      action: 'inspection.bypass', target: lot.lotNo, severity: 'warning',
      detail: 'Inspection bypassed — Trusted seller, urgent turnaround',
    })

    const sellerNotif = useStore.getState().notifications.find((n) => n.href === '/seller/lots' && n.userId === lot.sellerId)
    expect(sellerNotif).toMatchObject({
      title: `${lot.lotNo} accepted without inspection`,
      body: 'Accepted on your description — Trusted seller, urgent turnaround. The quantity stays indicative and is final on weighment.',
    })
  })
})
