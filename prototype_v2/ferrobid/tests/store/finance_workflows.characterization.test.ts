import { describe, expect, it } from 'vitest'
import { freshStore } from '../helpers/freshStore'
import { inr } from '../../src/lib/format'
import type { BankStatementLine, CommissionSettlement, DeliveryOrder, RefundRequest } from '../../src/types'

/** Priority 11: Finance-desk actions migrated in Phase 13 — settlement
 *  bookkeeping, refunds, invoicing, and bank reconciliation. Exact numerical
 *  behavior (thresholds, boundaries) is asserted throughout, per the extra
 *  conservatism this phase requires for financial correctness. */
describe('finance workflows — phase 13', () => {
  const signInFinance = (useStore: Awaited<ReturnType<typeof freshStore>>) =>
    useStore.getState().signIn('finance@gmail.com', 'FerroBid@Dev2026')
  const signInSuper = (useStore: Awaited<ReturnType<typeof freshStore>>) =>
    useStore.getState().signIn('super@gmail.com', 'FamySys@123')

  describe('setFinanceConfig', () => {
    it('refuses a caller who is not Super Admin — config unchanged', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const before = useStore.getState().financeConfig

      useStore.getState().setFinanceConfig({ ceoRefundFrom: 500_000 })

      expect(useStore.getState().financeConfig).toEqual(before)
    })

    it('is a no-op when the patch changes nothing', async () => {
      const useStore = await freshStore()
      signInSuper(useStore)
      const before = useStore.getState().financeConfig
      const startAudit = useStore.getState().auditEvents.length

      useStore.getState().setFinanceConfig({ ceoRefundFrom: before.ceoRefundFrom })

      expect(useStore.getState().auditEvents.length).toBe(startAudit)
    })

    it('applies the patch exactly, audits the exact before → after values, and records a structural change', async () => {
      const useStore = await freshStore()
      signInSuper(useStore)
      const before = useStore.getState().financeConfig
      const startAudit = useStore.getState().auditEvents.length
      const startStructural = useStore.getState().structuralChanges.length

      useStore.getState().setFinanceConfig({ ceoRefundFrom: 300_000, gstPct: 19 })

      const next = useStore.getState().financeConfig
      expect(next.ceoRefundFrom).toBe(300_000)
      expect(next.gstPct).toBe(19)
      expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
      expect(useStore.getState().auditEvents[0]).toMatchObject({
        action: 'finance.config', target: 'financial_configuration', severity: 'warning',
        detail: `Refund needs the CEO from: ${before.ceoRefundFrom} → 300000 · GST on scrap (%): ${before.gstPct} → 19`,
      })
      expect(useStore.getState().structuralChanges.length).toBe(startStructural + 1)
      expect(useStore.getState().structuralChanges[0]).toMatchObject({
        kind: 'config.update', target: 'Financial configuration',
        before: `Refund needs the CEO from ${before.ceoRefundFrom} · GST on scrap (%) ${before.gstPct}`,
        after: `Refund needs the CEO from 300000 · GST on scrap (%) 19`,
      })
    })
  })

  describe('confirmCommissionSettlement / queryCommissionSettlement', () => {
    const makeSettlement = (overrides: Partial<CommissionSettlement> & { id: string; catalogueId: string; sellerId: string }): CommissionSettlement => ({
      amount: 75_000, mode: 'transfer', at: new Date().toISOString(), status: 'recorded', reference: 'UTR555',
      ...overrides,
    })

    it('confirmCommissionSettlement refuses a caller who is not Finance', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
      const settlement = makeSettlement({ id: 'set-p13-1', catalogueId: 'cat-x', sellerId: 'u-seller-1' })
      useStore.setState((s) => ({ commissionSettlements: [...s.commissionSettlements, settlement] }))

      const result = useStore.getState().confirmCommissionSettlement('set-p13-1', 'bl-1')
      expect(result).toEqual({ ok: false, error: 'Only Finance can confirm a settlement' })
    })

    it('confirmCommissionSettlement refuses a transfer with no bank line matched', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const settlement = makeSettlement({ id: 'set-p13-2', catalogueId: 'cat-x', sellerId: 'u-seller-1', mode: 'transfer' })
      useStore.setState((s) => ({ commissionSettlements: [...s.commissionSettlements, settlement] }))

      const result = useStore.getState().confirmCommissionSettlement('set-p13-2')
      expect(result).toEqual({ ok: false, error: 'Match the transfer to a credit on the statement before confirming it' })
    })

    it('confirmCommissionSettlement refuses an already-confirmed settlement', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const settlement = makeSettlement({ id: 'set-p13-3', catalogueId: 'cat-x', sellerId: 'u-seller-1', status: 'confirmed' })
      useStore.setState((s) => ({ commissionSettlements: [...s.commissionSettlements, settlement] }))

      const result = useStore.getState().confirmCommissionSettlement('set-p13-3', 'bl-1')
      expect(result).toEqual({ ok: false, error: 'This settlement is already confirmed' })
    })

    it('confirmCommissionSettlement confirms a transfer matched to a bank line, and notifies the seller', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const cat = useStore.getState().catalogues[0]
      const settlement = makeSettlement({ id: 'set-p13-4', catalogueId: cat.id, sellerId: 'u-seller-1' })
      const line: BankStatementLine = { id: 'bl-p13-1', at: new Date().toISOString(), accountId: 'acc-1', direction: 'credit', amount: 75_000, ref: 'UTR555', narration: 'x', status: 'unmatched' }
      useStore.setState((s) => ({ commissionSettlements: [...s.commissionSettlements, settlement], bankStatementLines: [...s.bankStatementLines, line] }))

      const result = useStore.getState().confirmCommissionSettlement('set-p13-4', 'bl-p13-1')
      expect(result).toEqual({ ok: true })

      const updated = useStore.getState().commissionSettlements.find((r) => r.id === 'set-p13-4')!
      expect(updated.status).toBe('confirmed')
      const updatedLine = useStore.getState().bankStatementLines.find((l) => l.id === 'bl-p13-1')!
      expect(updatedLine).toMatchObject({ status: 'matched', matchedTo: 'set-p13-4', matchedKind: 'commission' })
      const notif = useStore.getState().notifications.find((n) => n.userId === 'u-seller-1' && n.title === 'Commission confirmed')!
      expect(notif.body).toBe(`We have matched your ${inr(75_000)} settlement for ${cat.code}. It now appears in your History.`)
    })

    it('confirmCommissionSettlement confirms an EMD-netted settlement without a bank line', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const settlement = makeSettlement({ id: 'set-p13-5', catalogueId: 'cat-x', sellerId: 'u-seller-1', mode: 'emd', reference: 'EMD-NET-cat-x' })
      useStore.setState((s) => ({ commissionSettlements: [...s.commissionSettlements, settlement] }))

      const result = useStore.getState().confirmCommissionSettlement('set-p13-5')
      expect(result).toEqual({ ok: true })
      expect(useStore.getState().commissionSettlements.find((r) => r.id === 'set-p13-5')!.status).toBe('confirmed')
    })

    it('queryCommissionSettlement records the query note, audits at warning, and notifies the seller', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const settlement = makeSettlement({ id: 'set-p13-6', catalogueId: 'cat-x', sellerId: 'u-seller-1' })
      useStore.setState((s) => ({ commissionSettlements: [...s.commissionSettlements, settlement] }))
      const startAudit = useStore.getState().auditEvents.length

      useStore.getState().queryCommissionSettlement('set-p13-6', 'Reference does not match the statement')

      expect(useStore.getState().commissionSettlements.find((r) => r.id === 'set-p13-6')!.status).toBe('queried')
      expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'commission.query', severity: 'warning' })
      const notif = useStore.getState().notifications.find((n) => n.userId === 'u-seller-1' && n.title === 'Commission payment queried')!
      expect(notif.body).toBe('Reference does not match the statement')
    })
  })

  describe('flagOverduePayment', () => {
    it('audits at warning and notifies the buyer, with no role guard side effects for a valid order', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const lot = useStore.getState().lots[0]
      const order: DeliveryOrder = {
        id: 'do-p13-1', lotId: lot.id, catalogueId: 'cat-x', buyerId: 'u-buyer-1', stage: 'payment_pending',
        h1Rate: 45_000, awardedQty: 25, uom: 'MT', materialValue: 1_125_000, gstAmount: 202_500, tcsAmount: 1_125,
        paidAmount: 0, liftingBy: 'self', createdAt: new Date().toISOString(), liftingChecklist: [],
      }
      useStore.setState((s) => ({ deliveryOrders: [...s.deliveryOrders, order] }))
      const startAudit = useStore.getState().auditEvents.length

      useStore.getState().flagOverduePayment('do-p13-1', 'Payment window closed 3 days ago')

      expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'payment.overdue', target: lot.lotNo, detail: 'Payment chased — Payment window closed 3 days ago', severity: 'warning' })
      const notif = useStore.getState().notifications.find((n) => n.userId === 'u-buyer-1' && n.title === 'Payment overdue')!
      expect(notif.body).toBe('Payment window closed 3 days ago')
    })

    it('does nothing for a caller who is not Finance', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
      const startAudit = useStore.getState().auditEvents.length

      useStore.getState().flagOverduePayment('do-does-not-exist', 'x')

      expect(useStore.getState().auditEvents.length).toBe(startAudit)
    })
  })

  describe('raiseRefund / decideRefund / processRefund', () => {
    it('raiseRefund refuses a caller who is neither Finance nor a Sub Admin with a dispute', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')

      const result = useStore.getState().raiseRefund({ userId: 'u-buyer-1', amount: 1_000, source: 'overpayment', reason: 'x' })
      expect(result).toEqual({ ok: false, error: 'Only Finance can raise a refund' })
    })

    it('raiseRefund refuses a non-positive amount', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)

      const result = useStore.getState().raiseRefund({ userId: 'u-buyer-1', amount: 0, source: 'overpayment', reason: 'x' })
      expect(result).toEqual({ ok: false, error: 'Enter the amount to return' })
    })

    it('raiseRefund below the CEO threshold: pending status, info-severity audit, notifies Finance', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const startAudit = useStore.getState().auditEvents.length

      const result = useStore.getState().raiseRefund({ userId: 'u-buyer-1', amount: 249_999, source: 'overpayment', reason: 'Overpaid at checkout' })
      expect(result).toEqual({ ok: true })

      const record = useStore.getState().refundRequests[0]
      expect(record).toMatchObject({ userId: 'u-buyer-1', amount: 249_999, status: 'pending' })
      expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'refund.raise', severity: 'info', detail: `Refund of ${inr(249_999)} raised — Overpaid at checkout` })
    })

    it('raiseRefund at exactly the CEO threshold requires sign-off (boundary is >=, not >)', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const ceoFrom = useStore.getState().financeConfig.ceoRefundFrom

      const result = useStore.getState().raiseRefund({ userId: 'u-buyer-1', amount: ceoFrom, source: 'overpayment', reason: 'Exactly at threshold' })
      expect(result).toEqual({ ok: true, awaitingCeo: true })

      const record = useStore.getState().refundRequests[0]
      expect(record).toMatchObject({ amount: ceoFrom, status: 'awaiting_ceo' })
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'refund.raise', severity: 'warning' })
      expect(useStore.getState().ceoApprovals[0]).toMatchObject({ kind: 'refund', refId: record.id, amount: ceoFrom })
    })

    it('a Sub Admin may raise a refund only when it carries a disputeId', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('sub@gmail.com', 'FerroBid@Dev2026')

      const withoutDispute = useStore.getState().raiseRefund({ userId: 'u-buyer-1', amount: 1_000, source: 'overpayment', reason: 'x' })
      expect(withoutDispute).toEqual({ ok: false, error: 'Only Finance can raise a refund' })

      const withDispute = useStore.getState().raiseRefund({ userId: 'u-buyer-1', amount: 1_000, source: 'dispute', reason: 'x', disputeId: 'dsp-1' })
      expect(withDispute).toEqual({ ok: true })
    })

    it('decideRefund approves — status approved, info severity, no notification', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      useStore.getState().raiseRefund({ userId: 'u-buyer-1', amount: 5_000, source: 'overpayment', reason: 'x' })
      const id = useStore.getState().refundRequests[0].id
      const startNotif = useStore.getState().notifications.length

      useStore.getState().decideRefund(id, true)

      expect(useStore.getState().refundRequests.find((r) => r.id === id)!.status).toBe('approved')
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'refund.approve', severity: 'info' })
      expect(useStore.getState().notifications.length).toBe(startNotif)
    })

    it('decideRefund rejects — status rejected, warning severity, notifies the customer', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      useStore.getState().raiseRefund({ userId: 'u-buyer-1', amount: 5_000, source: 'overpayment', reason: 'x' })
      const id = useStore.getState().refundRequests[0].id

      useStore.getState().decideRefund(id, false, 'Not eligible')

      expect(useStore.getState().refundRequests.find((r) => r.id === id)!.status).toBe('rejected')
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'refund.reject', severity: 'warning', detail: `Refund refused — ${inr(5_000)} · Not eligible` })
      const notif = useStore.getState().notifications.find((n) => n.userId === 'u-buyer-1' && n.title === 'Refund not approved')!
      expect(notif.body).toBe('Not eligible')
    })

    it('decideRefund does nothing for a request that is neither pending nor awaiting_ceo', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const record: RefundRequest = { id: 'ref-p13-1', userId: 'u-buyer-1', amount: 5_000, source: 'overpayment', reason: 'x', status: 'processed', raisedBy: 'system', raisedAt: new Date().toISOString() }
      useStore.setState((s) => ({ refundRequests: [...s.refundRequests, record] }))
      const startAudit = useStore.getState().auditEvents.length

      useStore.getState().decideRefund('ref-p13-1', true)

      expect(useStore.getState().refundRequests.find((r) => r.id === 'ref-p13-1')!.status).toBe('processed')
      expect(useStore.getState().auditEvents.length).toBe(startAudit)
    })

    it('processRefund refuses when not approved', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const record: RefundRequest = { id: 'ref-p13-2', userId: 'u-buyer-1', amount: 5_000, source: 'overpayment', reason: 'x', status: 'pending', raisedBy: 'system', raisedAt: new Date().toISOString() }
      useStore.setState((s) => ({ refundRequests: [...s.refundRequests, record] }))

      const result = useStore.getState().processRefund('ref-p13-2')
      expect(result).toEqual({ ok: false, error: 'Approve the refund before processing it' })
    })

    it('processRefund credits the exact amount to the wallet, appends a ledger entry, and audits/notifies', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const buyer = useStore.getState().users.find((u) => u.id === 'u-buyer-1')!
      const record: RefundRequest = { id: 'ref-p13-3', userId: buyer.id, amount: 12_345, source: 'overpayment', reason: 'Overpaid', status: 'approved', raisedBy: 'system', raisedAt: new Date().toISOString() }
      useStore.setState((s) => ({ refundRequests: [...s.refundRequests, record] }))
      const startBalance = useStore.getState().wallets.find((w) => w.userId === buyer.id)?.balance ?? 0
      const startLedger = useStore.getState().wallets.find((w) => w.userId === buyer.id)?.ledger.length ?? 0

      const result = useStore.getState().processRefund('ref-p13-3')
      expect(result).toEqual({ ok: true })

      const wallet = useStore.getState().wallets.find((w) => w.userId === buyer.id)!
      expect(wallet.balance).toBe(startBalance + 12_345)
      expect(wallet.ledger.length).toBe(startLedger + 1)
      expect(wallet.ledger[0]).toMatchObject({ type: 'refund', amount: 12_345, ref: 'ref-p13-3', note: 'Refund — Overpaid' })
      expect(useStore.getState().refundRequests.find((r) => r.id === 'ref-p13-3')!.status).toBe('processed')
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'refund.process', detail: `Refund of ${inr(12_345)} credited to wallet — Overpaid` })
      const notif = useStore.getState().notifications.find((n) => n.userId === buyer.id && n.title === 'Refund credited')!
      expect(notif.body).toBe(`${inr(12_345)} has been returned to your wallet.`)
    })

    it('processRefund closes the linked open dispute with an exact closing message and audit', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const buyer = useStore.getState().users.find((u) => u.id === 'u-buyer-1')!
      const dispute = {
        id: 'dsp-p13-1', userId: buyer.id, subject: 'Shortfall', category: 'quantity' as const,
        status: 'in_review' as const, createdAt: new Date().toISOString(),
        messages: [{ from: 'user' as const, body: 'x', at: new Date().toISOString() }],
        assignedToId: 'u-sub-1',
      }
      const record: RefundRequest = { id: 'ref-p13-4', userId: buyer.id, amount: 8_000, source: 'dispute', reason: 'Shortfall payout', status: 'approved', raisedBy: 'system', raisedAt: new Date().toISOString(), disputeId: dispute.id }
      useStore.setState((s) => ({ refundRequests: [...s.refundRequests, record], disputes: [...s.disputes, dispute] }))

      useStore.getState().processRefund('ref-p13-4')

      const updated = useStore.getState().disputes.find((d) => d.id === dispute.id)!
      expect(updated.status).toBe('resolved')
      expect(updated.resolvedById).toBe('u-sub-1')
      expect(updated.messages[updated.messages.length - 1]).toMatchObject({
        from: 'support', body: `${inr(8_000)} has been returned to your wallet. This closes the ticket — reply here if anything is still outstanding.`,
      })
      const disputeAudit = useStore.getState().auditEvents.find((e) => e.action === 'dispute.closed')!
      expect(disputeAudit.detail).toBe(`Closed on payment of the ${inr(8_000)} refund`)
    })

    it('processRefund does not touch an already-resolved dispute a second time', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const buyer = useStore.getState().users.find((u) => u.id === 'u-buyer-1')!
      const dispute = {
        id: 'dsp-p13-2', userId: buyer.id, subject: 'x', category: 'other' as const,
        status: 'resolved' as const, createdAt: new Date().toISOString(),
        messages: [], resolvedAt: '2020-01-01T00:00:00.000Z', resolvedById: 'u-sub-1',
      }
      const record: RefundRequest = { id: 'ref-p13-5', userId: buyer.id, amount: 1_000, source: 'dispute', reason: 'x', status: 'approved', raisedBy: 'system', raisedAt: new Date().toISOString(), disputeId: dispute.id }
      useStore.setState((s) => ({ refundRequests: [...s.refundRequests, record], disputes: [...s.disputes, dispute] }))
      const startAudit = useStore.getState().auditEvents.length

      useStore.getState().processRefund('ref-p13-5')

      expect(useStore.getState().auditEvents.slice(0, useStore.getState().auditEvents.length - startAudit).some((e) => e.action === 'dispute.closed')).toBe(false)
      expect(useStore.getState().disputes.find((d) => d.id === dispute.id)!.resolvedAt).toBe('2020-01-01T00:00:00.000Z')
    })
  })

  describe('issueInvoice / reissueInvoice / cancelInvoice', () => {
    it('issueInvoice returns null for a caller who is not Finance', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')

      const result = useStore.getState().issueInvoice({ kind: 'buyer_invoice', partyId: 'u-buyer-1', catalogueId: 'cat-x', taxable: 100_000, gst: 18_000, tcs: 100, note: '' })
      expect(result).toBeNull()
    })

    it('issueInvoice numbers sequentially from 1001 + current invoice count, and sums the exact total', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const startCount = useStore.getState().invoices.length

      const result = useStore.getState().issueInvoice({ kind: 'buyer_invoice', partyId: 'u-buyer-1', catalogueId: 'cat-x', taxable: 100_000, gst: 18_000, tcs: 1_000 })
      expect(result).not.toBeNull()
      expect(result!.number).toBe(`FB/INV/26/${1001 + startCount}`)
      expect(result!.total).toBe(119_000)
      expect(result!.status).toBe('issued')

      const notif = useStore.getState().notifications.find((n) => n.userId === 'u-buyer-1' && n.title === 'Invoice issued')!
      expect(notif.body).toBe(`${result!.number} — ${inr(119_000)}.`)
    })

    it('issueInvoice numbers a commission receipt with the RCP prefix and the seller-settlement href', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)

      const result = useStore.getState().issueInvoice({ kind: 'commission_receipt', partyId: 'u-seller-1', catalogueId: 'cat-x', taxable: 50_000, gst: 0, tcs: 0 })
      expect(result!.number).toMatch(/^FB\/RCP\/26\/\d+$/)
      const notif = useStore.getState().notifications.find((n) => n.userId === 'u-seller-1' && n.title === 'Commission receipt issued')!
      expect(notif.href).toBe('/seller/settlement')
    })

    it('reissueInvoice supersedes the original and keeps it on record', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const original = useStore.getState().issueInvoice({ kind: 'buyer_invoice', partyId: 'u-buyer-1', catalogueId: 'cat-x', taxable: 100_000, gst: 18_000, tcs: 100 })!

      useStore.getState().reissueInvoice(original.id, 'Corrected GST rate')

      const replacement = useStore.getState().invoices[0]
      expect(replacement).toMatchObject({ number: `${original.number}-R`, status: 'issued', supersedesId: original.id, note: 'Corrected GST rate' })
      expect(useStore.getState().invoices.find((i) => i.id === original.id)!.status).toBe('superseded')
      const notif = useStore.getState().notifications.find((n) => n.userId === 'u-buyer-1' && n.title === 'Document reissued')!
      expect(notif.body).toBe(`${replacement.number} replaces ${original.number}. Corrected GST rate`)
      expect(notif.href).toBeUndefined()
    })

    it('reissueInvoice refuses an already-superseded original', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const original = useStore.getState().issueInvoice({ kind: 'buyer_invoice', partyId: 'u-buyer-1', catalogueId: 'cat-x', taxable: 100_000, gst: 18_000, tcs: 100 })!
      useStore.getState().reissueInvoice(original.id, 'first reissue')
      const startCount = useStore.getState().invoices.length

      useStore.getState().reissueInvoice(original.id, 'second reissue')

      expect(useStore.getState().invoices.length).toBe(startCount)
    })

    it('cancelInvoice marks it cancelled, audits at warning, and notifies the party', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const original = useStore.getState().issueInvoice({ kind: 'buyer_invoice', partyId: 'u-buyer-1', catalogueId: 'cat-x', taxable: 100_000, gst: 18_000, tcs: 100 })!

      useStore.getState().cancelInvoice(original.id, 'Duplicate issue')

      expect(useStore.getState().invoices.find((i) => i.id === original.id)!.status).toBe('cancelled')
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'invoice.cancel', target: original.number, severity: 'warning' })
      const notif = useStore.getState().notifications.find((n) => n.userId === 'u-buyer-1' && n.title === `Invoice ${original.number} cancelled`)!
      expect(notif.body).toBe('Duplicate issue A corrected document follows if one is due.')
    })

    it('cancelInvoice does nothing for an already-cancelled invoice', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const original = useStore.getState().issueInvoice({ kind: 'buyer_invoice', partyId: 'u-buyer-1', catalogueId: 'cat-x', taxable: 100_000, gst: 18_000, tcs: 100 })!
      useStore.getState().cancelInvoice(original.id, 'first')
      const startAudit = useStore.getState().auditEvents.length

      useStore.getState().cancelInvoice(original.id, 'second')

      expect(useStore.getState().auditEvents.length).toBe(startAudit)
    })
  })

  describe('bank reconciliation', () => {
    const makeLine = (overrides: Partial<BankStatementLine> & { id: string }): BankStatementLine => ({
      at: new Date().toISOString(), accountId: 'acc-1', direction: 'credit', amount: 40_000, ref: 'UTR777', narration: 'x', status: 'unmatched',
      ...overrides,
    })

    it('matchBankLine matches, clears any prior break, and audits the exact amount', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const line = makeLine({ id: 'bl-p13-2', status: 'break', breakNote: 'was unmatched', escalated: true })
      useStore.setState((s) => ({ bankStatementLines: [...s.bankStatementLines, line] }))

      useStore.getState().matchBankLine('bl-p13-2', 'dep-1', 'deposit')

      const updated = useStore.getState().bankStatementLines.find((l) => l.id === 'bl-p13-2')!
      expect(updated).toMatchObject({ status: 'matched', matchedTo: 'dep-1', matchedKind: 'deposit', breakNote: undefined, escalated: false })
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'recon.match', target: 'UTR777', detail: `Credit of ${inr(40_000)} matched to dep-1` })
    })

    it('matchBankLine labels a debit line correctly', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const line = makeLine({ id: 'bl-p13-3', direction: 'debit', amount: 15_000 })
      useStore.setState((s) => ({ bankStatementLines: [...s.bankStatementLines, line] }))

      useStore.getState().matchBankLine('bl-p13-3', 'wdr-1', 'withdrawal')

      expect(useStore.getState().auditEvents[0].detail).toBe(`Debit of ${inr(15_000)} matched to wdr-1`)
    })

    it('unmatchBankLine reverses a match and audits at warning', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const line = makeLine({ id: 'bl-p13-4', status: 'matched', matchedTo: 'dep-1', matchedKind: 'deposit', matchedBy: 'u-finance-1', matchedAt: new Date().toISOString() })
      useStore.setState((s) => ({ bankStatementLines: [...s.bankStatementLines, line] }))

      useStore.getState().unmatchBankLine('bl-p13-4')

      const updated = useStore.getState().bankStatementLines.find((l) => l.id === 'bl-p13-4')!
      expect(updated).toMatchObject({ status: 'unmatched', matchedTo: undefined, matchedKind: undefined, matchedBy: undefined, matchedAt: undefined })
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'recon.unmatch', severity: 'warning' })
    })

    it('flagBankBreak marks the line broken with the note, audits at warning', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const line = makeLine({ id: 'bl-p13-5' })
      useStore.setState((s) => ({ bankStatementLines: [...s.bankStatementLines, line] }))

      useStore.getState().flagBankBreak('bl-p13-5', 'No matching claim')

      const updated = useStore.getState().bankStatementLines.find((l) => l.id === 'bl-p13-5')!
      expect(updated).toMatchObject({ status: 'break', breakNote: 'No matching claim' })
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'recon.break', severity: 'warning', detail: `Break flagged on ${inr(40_000)} — No matching claim` })
    })

    it('escalateBankBreak sets escalated, audits at critical, and notifies Super Admin', async () => {
      const useStore = await freshStore()
      signInFinance(useStore)
      const line = makeLine({ id: 'bl-p13-6', status: 'break', breakNote: 'Unexplained credit' })
      useStore.setState((s) => ({ bankStatementLines: [...s.bankStatementLines, line] }))
      const startNotif = useStore.getState().notifications.length

      useStore.getState().escalateBankBreak('bl-p13-6')

      expect(useStore.getState().bankStatementLines.find((l) => l.id === 'bl-p13-6')!.escalated).toBe(true)
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'recon.escalate', severity: 'critical', detail: `Break of ${inr(40_000)} escalated — Unexplained credit` })
      expect(useStore.getState().notifications.length).toBeGreaterThan(startNotif)
      const notif = useStore.getState().notifications.find((n) => n.title === 'Reconciliation break escalated')!
      expect(notif.body).toBe(`${inr(40_000)} on UTR777 — Unexplained credit`)
    })

    it('does nothing for a caller who is not Finance across all four reconciliation actions', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
      const line = makeLine({ id: 'bl-p13-7' })
      useStore.setState((s) => ({ bankStatementLines: [...s.bankStatementLines, line] }))
      const startAudit = useStore.getState().auditEvents.length

      useStore.getState().matchBankLine('bl-p13-7', 'x', 'deposit')
      useStore.getState().unmatchBankLine('bl-p13-7')
      useStore.getState().flagBankBreak('bl-p13-7', 'x')
      useStore.getState().escalateBankBreak('bl-p13-7')

      expect(useStore.getState().auditEvents.length).toBe(startAudit)
      expect(useStore.getState().bankStatementLines.find((l) => l.id === 'bl-p13-7')!.status).toBe('unmatched')
    })
  })
})
