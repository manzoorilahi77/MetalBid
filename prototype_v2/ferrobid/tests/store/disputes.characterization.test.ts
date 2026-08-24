import { describe, expect, it } from 'vitest'
import { freshStore } from '../helpers/freshStore'
import { inr } from '../../src/lib/format'

/** Priority 4: disputes — open, reply, resolve (with and without a refund). */
describe('disputes', () => {
  it('createDispute opens a ticket, audits it, and notifies support', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    const me = useStore.getState().currentUser!
    const startAudit = useStore.getState().auditEvents.length

    useStore.getState().createDispute('Weighment variance', 'quantity', 'The lifted quantity looks short.')

    const dispute = useStore.getState().disputes[0]
    expect(dispute).toMatchObject({ userId: me.id, subject: 'Weighment variance', category: 'quantity', status: 'open' })
    expect(dispute.messages).toEqual([{ from: 'user', body: 'The lifted quantity looks short.', at: dispute.createdAt }])
    expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
    expect(useStore.getState().auditEvents[0]).toMatchObject({
      action: 'dispute.open', target: dispute.id.toUpperCase(), severity: 'warning',
      detail: `${me.firm} raised "Weighment variance" (quantity)`,
    })

    const supportNotif = useStore.getState().notifications.find((n) => n.href === '/sub/disputes')!
    expect(supportNotif).toMatchObject({ kind: 'system', title: 'New ticket — Weighment variance' })
    expect(supportNotif.body).toBe(`${me.firm} · quantity — The lifted quantity looks short.`)
    const customerNotif = useStore.getState().notifications.find((n) => n.userId === me.id && n.href === '/disputes')!
    expect(customerNotif).toMatchObject({
      title: 'Your ticket is with support', body: 'Someone on the support desk will pick it up and reply here.',
    })
  })

  it('createDispute includes the lot number in the support notification body when a lotId is given', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    const me = useStore.getState().currentUser!
    const lot = useStore.getState().lots[0]

    useStore.getState().createDispute('Short weighment', 'quantity', 'Off by 200kg', lot.id)

    const dispute = useStore.getState().disputes[0]
    expect(dispute.lotId).toBe(lot.id)
    const supportNotif = useStore.getState().notifications.find((n) => n.href === '/sub/disputes')!
    expect(supportNotif.body).toBe(`${me.firm} · quantity · ${lot.lotNo} — Off by 200kg`)
  })

  it('createDispute is a no-op when nobody is signed in', async () => {
    const useStore = await freshStore()
    const startDisputes = useStore.getState().disputes.length
    const startAudit = useStore.getState().auditEvents.length

    useStore.getState().createDispute('x', 'other', 'y')

    expect(useStore.getState().disputes.length).toBe(startDisputes)
    expect(useStore.getState().auditEvents.length).toBe(startAudit)
  })

  it('replyToDispute refuses a caller outside the support desk', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    useStore.getState().createDispute('Test', 'other', 'body')
    const id = useStore.getState().disputes[0].id

    const result = useStore.getState().replyToDispute(id, 'We are looking into it')
    expect(result).toEqual({ ok: false, error: 'Only the support desk replies on a ticket' })
  })

  it('replyToDispute posts the reply, assigns the ticket on first touch, audits, and notifies the customer', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    const buyer = useStore.getState().currentUser!
    useStore.getState().createDispute('Weighment variance', 'quantity', 'The lifted quantity looks short.')
    const id = useStore.getState().disputes[0].id
    const startAudit = useStore.getState().auditEvents.length
    const startNotif = useStore.getState().notifications.length

    useStore.getState().switchRole('sub_admin')
    const longReply = 'x'.repeat(200)
    const result = useStore.getState().replyToDispute(id, longReply)
    expect(result).toEqual({ ok: true })

    const dispute = useStore.getState().disputes.find((d) => d.id === id)!
    expect(dispute.status).toBe('in_review')
    expect(dispute.assignedToId).toBe(buyer.id) // first touch — currentUser stays the signed-in buyer under switchRole
    expect(dispute.messages[dispute.messages.length - 1]).toMatchObject({ from: 'support', body: longReply })

    expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
    expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'dispute.reply', target: id.toUpperCase(), detail: `Replied on "Weighment variance"` })

    expect(useStore.getState().notifications.length).toBe(startNotif + 1)
    const notif = useStore.getState().notifications[0]
    expect(notif).toMatchObject({ userId: buyer.id, kind: 'system', title: 'Support replied to your ticket', href: '/disputes' })
    expect(notif.body).toBe(longReply.slice(0, 140)) // notify body is truncated at 140 chars
    expect(notif.body.length).toBe(140)
  })

  it('replyToDispute refuses on an already-resolved ticket', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    useStore.getState().createDispute('Test', 'other', 'body')
    const id = useStore.getState().disputes[0].id
    useStore.getState().switchRole('sub_admin')
    useStore.getState().resolveDispute(id, 'upheld', 'Resolved.')

    const result = useStore.getState().replyToDispute(id, 'Another reply')
    expect(result).toEqual({ ok: false, error: 'This ticket is closed' })
  })

  it('resolveDispute without a refund closes the ticket', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    useStore.getState().createDispute('Late delivery', 'lifting', 'body')
    const id = useStore.getState().disputes[0].id

    useStore.getState().switchRole('sub_admin')
    const result = useStore.getState().resolveDispute(id, 'upheld', 'Lifting was rescheduled and completed.')
    expect(result).toEqual({ ok: true, refundRaised: false })
    expect(useStore.getState().disputes.find((d) => d.id === id)!.status).toBe('resolved')
  })

  it('resolveDispute with refund_due raises a refund and keeps the ticket open until Finance pays it', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    useStore.getState().createDispute('Weighment shortfall', 'quantity', 'body')
    const id = useStore.getState().disputes[0].id
    const startRefunds = useStore.getState().refundRequests.length

    useStore.getState().switchRole('sub_admin')
    const result = useStore.getState().resolveDispute(id, 'refund_due', 'Shortfall confirmed at the weighbridge.', 5_000)
    expect(result).toEqual({ ok: true, refundRaised: true })

    const dispute = useStore.getState().disputes.find((d) => d.id === id)!
    expect(dispute.status).toBe('in_review') // not resolved — stays open until Finance pays
    expect(dispute.refundId).toBeTruthy()
    expect(useStore.getState().refundRequests.length).toBe(startRefunds + 1)
    expect(useStore.getState().refundRequests[0]).toMatchObject({ amount: 5_000, source: 'dispute', disputeId: id })
  })

  it('resolveDispute refuses without an amount when the outcome is refund_due', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    useStore.getState().createDispute('Test', 'other', 'body')
    const id = useStore.getState().disputes[0].id

    useStore.getState().switchRole('sub_admin')
    const result = useStore.getState().resolveDispute(id, 'refund_due', 'agreed')
    expect(result.ok).toBe(false)
    expect(useStore.getState().disputes.find((d) => d.id === id)!.status).toBe('open')
  })

  it('resolveDispute refuses a caller outside the support desk', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    useStore.getState().createDispute('Test', 'other', 'body')
    const id = useStore.getState().disputes[0].id

    const result = useStore.getState().resolveDispute(id, 'upheld', 'Resolved.')
    expect(result).toEqual({ ok: false, error: 'Only the support desk closes a ticket' })
  })

  it('resolveDispute refuses when the ticket does not exist', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    useStore.getState().switchRole('sub_admin')

    const result = useStore.getState().resolveDispute('dsp-does-not-exist', 'upheld', 'x')
    expect(result).toEqual({ ok: false, error: 'Ticket not found' })
  })

  it('resolveDispute refuses without a written resolution', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    useStore.getState().createDispute('Test', 'other', 'body')
    const id = useStore.getState().disputes[0].id
    useStore.getState().switchRole('sub_admin')

    const result = useStore.getState().resolveDispute(id, 'upheld', '   ')
    expect(result).toEqual({ ok: false, error: 'Say how it was resolved — the customer is shown this' })
  })

  it('resolveDispute refuses on an already-resolved ticket', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    useStore.getState().createDispute('Test', 'other', 'body')
    const id = useStore.getState().disputes[0].id
    useStore.getState().switchRole('sub_admin')
    useStore.getState().resolveDispute(id, 'upheld', 'First resolution.')

    const result = useStore.getState().resolveDispute(id, 'declined', 'Second attempt.')
    expect(result).toEqual({ ok: false, error: 'Already closed' })
  })

  it('resolveDispute closing (upheld) audits at info severity and notifies the customer word for word', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    const buyer = useStore.getState().currentUser!
    useStore.getState().createDispute('Late delivery', 'lifting', 'body')
    const id = useStore.getState().disputes[0].id
    useStore.getState().switchRole('sub_admin')
    const startAudit = useStore.getState().auditEvents.length

    useStore.getState().resolveDispute(id, 'upheld', 'Lifting was rescheduled and completed.')

    expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
    expect(useStore.getState().auditEvents[0]).toMatchObject({
      action: 'dispute.resolve', target: id.toUpperCase(), severity: 'info',
      detail: '"Late delivery" — upheld: Lifting was rescheduled and completed.',
    })
    const notif = useStore.getState().notifications.find((n) => n.userId === buyer.id && n.href === '/disputes')!
    expect(notif).toMatchObject({ title: 'Your ticket has been resolved', body: 'Lifting was rescheduled and completed.' })
    const dispute = useStore.getState().disputes.find((d) => d.id === id)!
    expect(dispute.resolvedAt).toBeTruthy()
    expect(dispute.messages[dispute.messages.length - 1]).toMatchObject({ from: 'support', body: 'Lifting was rescheduled and completed.' })
  })

  it('resolveDispute declined audits at warning severity', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    useStore.getState().createDispute('Test', 'other', 'body')
    const id = useStore.getState().disputes[0].id
    useStore.getState().switchRole('sub_admin')

    useStore.getState().resolveDispute(id, 'declined', 'Not a platform error.')

    expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'dispute.resolve', severity: 'warning' })
  })

  it('resolveDispute with refund_due quotes the exact refund amount in the audit detail and notification body', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    const buyer = useStore.getState().currentUser!
    useStore.getState().createDispute('Weighment shortfall', 'quantity', 'body')
    const id = useStore.getState().disputes[0].id
    useStore.getState().switchRole('sub_admin')

    useStore.getState().resolveDispute(id, 'refund_due', 'Shortfall confirmed at the weighbridge.', 5_000)

    expect(useStore.getState().auditEvents[0]).toMatchObject({
      detail: `"Weighment shortfall" — refund due, refund of ${inr(5_000)} raised with Finance: Shortfall confirmed at the weighbridge.`,
    })
    const notif = useStore.getState().notifications.find((n) => n.userId === buyer.id && n.href === '/disputes')!
    expect(notif).toMatchObject({ title: 'Your ticket has been decided — refund with Finance' })
    expect(notif.body).toBe(`Shortfall confirmed at the weighbridge. A refund of ${inr(5_000)} is with Finance; the ticket stays open until it has been paid.`)
  })

  it('resolveDispute with refund_due propagates raiseRefund\'s own refusal (caller not Finance or Sub Admin) and leaves the ticket untouched', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    useStore.getState().createDispute('Test', 'other', 'body')
    const id = useStore.getState().disputes[0].id
    // exec_manager is on SUPPORT_ROLES (can resolve tickets) but NOT on
    // FINANCE_ROLES and is not sub_admin, so raiseRefund's own role check
    // refuses it — resolveDispute must surface that refusal untouched.
    useStore.getState().switchRole('exec_manager')
    const startRefunds = useStore.getState().refundRequests.length

    const result = useStore.getState().resolveDispute(id, 'refund_due', 'agreed', 5_000)

    expect(result).toEqual({ ok: false, error: 'Only Finance can raise a refund' })
    expect(useStore.getState().disputes.find((d) => d.id === id)!.status).toBe('open')
    expect(useStore.getState().refundRequests.length).toBe(startRefunds)
  })
})
