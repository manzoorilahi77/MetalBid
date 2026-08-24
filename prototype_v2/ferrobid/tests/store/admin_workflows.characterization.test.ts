import { describe, expect, it } from 'vitest'
import { freshStore } from '../helpers/freshStore'
import { inr } from '../../src/lib/format'

/** Priority 12: admin-desk actions migrated in Phase 14 — testimonial
 *  moderation, the CEO sign-off queue, and returning a content draft. */
describe('admin workflows — phase 14', () => {
  describe('submitTestimonial / moderateTestimonial', () => {
    it('submitTestimonial refuses a caller who is not signed in', async () => {
      const useStore = await freshStore()
      const result = useStore.getState().submitTestimonial('This platform made our scrap sales so much easier', 5)
      expect(result).toEqual({ ok: false, error: 'Sign in to continue' })
    })

    it('submitTestimonial refuses a staff account', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('executive@gmail.com', 'FerroBid@Dev2026')
      const result = useStore.getState().submitTestimonial('This platform made our scrap sales so much easier', 5)
      expect(result).toEqual({ ok: false, error: 'Only a buyer or seller account can submit a testimonial' })
    })

    it('submitTestimonial refuses fewer than 20 characters', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
      const result = useStore.getState().submitTestimonial('too short', 5)
      expect(result).toEqual({ ok: false, error: 'A few more words would help — at least 20 characters' })
    })

    it('submitTestimonial records it pending and notifies Sub Admin', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
      const me = useStore.getState().currentUser!
      const startCount = useStore.getState().testimonials.length

      const result = useStore.getState().submitTestimonial('This platform made our scrap sales so much easier and faster', 5)
      expect(result).toEqual({ ok: true })

      expect(useStore.getState().testimonials.length).toBe(startCount + 1)
      const row = useStore.getState().testimonials[0]
      expect(row).toMatchObject({ userId: me.id, role: 'buyer', rating: 5, status: 'pending' })
      const notif = useStore.getState().notifications.find((n) => n.title === 'A testimonial is waiting to be moderated')!
      expect(notif.body).toBe(`${me.firm} — "This platform made our scrap sales so much easier and faster"`)
      expect(notif.href).toBe('/cms/sections')
    })

    it('moderateTestimonial refuses a caller who is not a Sub Admin', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
      useStore.getState().submitTestimonial('This platform made our scrap sales so much easier and faster', 5)
      const id = useStore.getState().testimonials[0].id
      useStore.getState().signIn('executive@gmail.com', 'FerroBid@Dev2026')

      const result = useStore.getState().moderateTestimonial(id, true)
      expect(result).toEqual({ ok: false, error: 'Only a Sub Admin moderates testimonials' })
    })

    it('moderateTestimonial approves — status approved, audited at info', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
      const buyer = useStore.getState().currentUser!
      useStore.getState().submitTestimonial('This platform made our scrap sales so much easier and faster', 5)
      const id = useStore.getState().testimonials[0].id
      useStore.getState().signIn('sub@gmail.com', 'FerroBid@Dev2026')
      const mod = useStore.getState().currentUser!
      const startAudit = useStore.getState().auditEvents.length

      const result = useStore.getState().moderateTestimonial(id, true)
      expect(result).toEqual({ ok: true })

      const row = useStore.getState().testimonials.find((t) => t.id === id)!
      expect(row).toMatchObject({ status: 'approved', moderatedBy: mod.id })
      expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
      expect(useStore.getState().auditEvents[0]).toMatchObject({
        action: 'testimonial.approved', target: id.toUpperCase(),
        detail: `${mod.name} approved a testimonial from ${buyer.id}`, severity: 'info',
      })
    })

    it('moderateTestimonial rejects with a note recorded on the row', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
      useStore.getState().submitTestimonial('This platform made our scrap sales so much easier and faster', 5)
      const id = useStore.getState().testimonials[0].id
      useStore.getState().signIn('sub@gmail.com', 'FerroBid@Dev2026')

      useStore.getState().moderateTestimonial(id, false, 'Reads like spam')

      const row = useStore.getState().testimonials.find((t) => t.id === id)!
      expect(row).toMatchObject({ status: 'rejected', moderationNote: 'Reads like spam' })
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'testimonial.rejected' })
    })

    it('moderateTestimonial refuses a testimonial that no longer exists', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('sub@gmail.com', 'FerroBid@Dev2026')
      const result = useStore.getState().moderateTestimonial('tst-does-not-exist', true)
      expect(result).toEqual({ ok: false, error: 'That testimonial no longer exists' })
    })
  })

  describe('returnContent', () => {
    it('refuses anyone who is not a Super Admin', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('sub@gmail.com', 'FerroBid@Dev2026')
      useStore.getState().submitContentDraft({ page: 'Help', section: 'FAQ', before: 'old', after: 'A plain-language update with no figures.', needsCeo: false })
      const draftId = useStore.getState().contentDrafts[0].id

      const result = useStore.getState().returnContent(draftId, 'Needs a rewrite')
      expect(result.ok).toBe(false)
    })

    it('requires a typed note', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('sub@gmail.com', 'FerroBid@Dev2026')
      useStore.getState().submitContentDraft({ page: 'Help', section: 'FAQ', before: 'old', after: 'A plain-language update with no figures.', needsCeo: false })
      const draftId = useStore.getState().contentDrafts[0].id
      useStore.getState().signIn('super@gmail.com', 'FamySys@123')

      const result = useStore.getState().returnContent(draftId, '   ')
      expect(result).toEqual({ ok: false, error: 'Say what needs changing — a return without a comment is a dead end' })
    })

    it('marks the draft returned with the note, audits at info, and notifies the author', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('sub@gmail.com', 'FerroBid@Dev2026')
      const author = useStore.getState().currentUser!
      useStore.getState().submitContentDraft({ page: 'Help', section: 'FAQ', before: 'old', after: 'A plain-language update with no figures.', needsCeo: false })
      const draftId = useStore.getState().contentDrafts[0].id
      useStore.getState().signIn('super@gmail.com', 'FamySys@123')
      const startAudit = useStore.getState().auditEvents.length

      const result = useStore.getState().returnContent(draftId, 'Tighten the second paragraph')
      expect(result).toEqual({ ok: true })

      const draft = useStore.getState().contentDrafts.find((d) => d.id === draftId)!
      expect(draft).toMatchObject({ status: 'returned', note: 'Tighten the second paragraph' })
      expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'content.return', detail: 'Tighten the second paragraph', severity: 'info' })
      const notif = useStore.getState().notifications.find((n) => n.userId === author.id && n.title === 'Copy returned with comments')!
      expect(notif.body).toBe('Tighten the second paragraph')
    })
  })

  describe('CEO approval queue', () => {
    it('requestCeoSignoff refuses a buyer/seller/anonymous caller', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
      const result = useStore.getState().requestCeoSignoff({ kind: 'fee_change', refId: 'financeConfig', amount: 0, summary: 'Test', reason: 'x' })
      expect(result).toBeNull()
    })

    it('requestCeoSignoff returns the existing pending request instead of duplicating it', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('finance@gmail.com', 'FerroBid@Dev2026')
      const first = useStore.getState().requestCeoSignoff({ kind: 'permanent_ban', refId: 'u-buyer-1', amount: 0, summary: 'Ban a defaulter', reason: 'Non-payment' })
      const startCount = useStore.getState().ceoApprovals.length

      const second = useStore.getState().requestCeoSignoff({ kind: 'permanent_ban', refId: 'u-buyer-1', amount: 0, summary: 'Ban a defaulter', reason: 'Non-payment' })

      expect(second!.id).toBe(first!.id)
      expect(useStore.getState().ceoApprovals.length).toBe(startCount)
    })

    it('requestCeoInfo asks a question, audits it, and notifies the requester', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('finance@gmail.com', 'FerroBid@Dev2026')
      const requester = useStore.getState().currentUser!
      const req = useStore.getState().requestCeoSignoff({ kind: 'fee_change', refId: 'financeConfig-test-1', amount: 0, summary: 'Raise GST handling', reason: 'Compliance update', payload: { gstPct: 19 } })!
      useStore.getState().signIn('ceo@gmail.com', 'FerroBid@Dev2026')

      useStore.getState().requestCeoInfo(req.id, 'Which invoices does this affect?')

      expect(useStore.getState().ceoApprovals.find((a) => a.id === req.id)!.status).toBe('info_requested')
      const notif = useStore.getState().notifications.find((n) => n.userId === requester.id && n.title === 'The CEO has a question')!
      expect(notif.body).toBe('Raise GST handling — Which invoices does this affect?')
      expect(notif.href).toBe('/admin/finance')
    })

    it('decideCeoApproval refuses a caller who cannot sign', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('finance@gmail.com', 'FerroBid@Dev2026')
      const req = useStore.getState().requestCeoSignoff({ kind: 'permanent_ban', refId: 'u-buyer-1', amount: 0, summary: 'Ban', reason: 'x' })!
      const startAudit = useStore.getState().auditEvents.length

      useStore.getState().decideCeoApproval(req.id, true)

      expect(useStore.getState().ceoApprovals.find((a) => a.id === req.id)!.status).toBe('pending')
      expect(useStore.getState().auditEvents.length).toBe(startAudit)
    })

    it('decideCeoApproval approving a fee_change merges the payload into financeConfig and audits the exact before/after', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('finance@gmail.com', 'FerroBid@Dev2026')
      const before = useStore.getState().financeConfig.gstPct
      const req = useStore.getState().requestCeoSignoff({ kind: 'fee_change', refId: 'financeConfig-test-2', amount: 0, summary: 'Raise GST handling', reason: 'Compliance update', payload: { gstPct: 19 } })!
      useStore.getState().signIn('ceo@gmail.com', 'FerroBid@Dev2026')

      useStore.getState().decideCeoApproval(req.id, true)

      expect(useStore.getState().financeConfig.gstPct).toBe(19)
      expect(useStore.getState().ceoApprovals.find((a) => a.id === req.id)!.status).toBe('approved')
      const feeAudit = useStore.getState().auditEvents.find((e) => e.action === 'config.fee_change')!
      expect(feeAudit.detail).toBe(`Signed by the CEO — gstPct ${before} → 19`)
    })

    it('decideCeoApproval approving a permanent_ban sets the account to defaulter with the reason', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('finance@gmail.com', 'FerroBid@Dev2026')
      const req = useStore.getState().requestCeoSignoff({ kind: 'permanent_ban', refId: 'u-buyer-1', amount: 0, summary: 'Ban a defaulter', reason: 'Repeated non-payment' })!
      useStore.getState().signIn('ceo@gmail.com', 'FerroBid@Dev2026')

      useStore.getState().decideCeoApproval(req.id, true, 'Confirmed pattern of default')

      const user = useStore.getState().users.find((u) => u.id === 'u-buyer-1')!
      expect(user.standing).toBe('defaulter')
      expect(user.blacklistReason).toBe('Confirmed pattern of default')
    })

    it('decideCeoApproval refusing a permanent_ban leaves standing untouched', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('finance@gmail.com', 'FerroBid@Dev2026')
      const before = useStore.getState().users.find((u) => u.id === 'u-buyer-1')!.standing
      const req = useStore.getState().requestCeoSignoff({ kind: 'permanent_ban', refId: 'u-buyer-1', amount: 0, summary: 'Ban a defaulter', reason: 'x' })!
      useStore.getState().signIn('ceo@gmail.com', 'FerroBid@Dev2026')

      useStore.getState().decideCeoApproval(req.id, false, 'Not enough evidence')

      expect(useStore.getState().users.find((u) => u.id === 'u-buyer-1')!.standing).toBe(before)
      expect(useStore.getState().ceoApprovals.find((a) => a.id === req.id)!.status).toBe('refused')
    })

    it('decideCeoApproval approving an over-threshold EMD forfeiture applies it and locks the wallet delta', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('finance@gmail.com', 'FerroBid@Dev2026')
      const lot = useStore.getState().lots[0]
      const buyer = useStore.getState().users.find((u) => u.role === 'buyer')!
      const ceoFrom = useStore.getState().financeConfig.ceoForfeitureFrom
      useStore.setState((s) => ({
        lots: s.lots.map((l) => (l.id === lot.id ? { ...l, preBidEmd: ceoFrom } : l)),
        wallets: s.wallets.map((w) => (w.userId === buyer.id ? { ...w, emdLocked: ceoFrom } : w)),
        emdForfeitures: [],
      }))
      const raised = useStore.getState().raiseEmdForfeiture(lot.id, buyer.id, 'Buyer defaulted on payment')
      expect(raised).toEqual({ ok: true, awaitingCeo: true })
      const forfeiture = useStore.getState().emdForfeitures[0]
      const ceoReq = useStore.getState().ceoApprovals.find((a) => a.kind === 'emd_forfeiture' && a.refId === forfeiture.id)!
      const walletBefore = useStore.getState().wallets.find((w) => w.userId === buyer.id)!.emdLocked
      useStore.getState().signIn('ceo@gmail.com', 'FerroBid@Dev2026')

      useStore.getState().decideCeoApproval(ceoReq.id, true)

      expect(useStore.getState().emdForfeitures.find((f) => f.id === forfeiture.id)!.status).toBe('applied')
      expect(useStore.getState().wallets.find((w) => w.userId === buyer.id)!.emdLocked).toBe(Math.max(0, walletBefore - ceoFrom))
      expect(useStore.getState().ceoApprovals.find((a) => a.id === ceoReq.id)!.status).toBe('approved')
    })

    it('decideCeoApproval refusing an over-threshold EMD forfeiture waives it via the real waiveEmdForfeiture action, when the decider also holds a Finance role', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('finance@gmail.com', 'FerroBid@Dev2026')
      const lot = useStore.getState().lots[0]
      const buyer = useStore.getState().users.find((u) => u.role === 'buyer')!
      const ceoFrom = useStore.getState().financeConfig.ceoForfeitureFrom
      useStore.setState((s) => ({
        lots: s.lots.map((l) => (l.id === lot.id ? { ...l, preBidEmd: ceoFrom } : l)),
        wallets: s.wallets.map((w) => (w.userId === buyer.id ? { ...w, emdLocked: ceoFrom } : w)),
        emdForfeitures: [],
      }))
      useStore.getState().raiseEmdForfeiture(lot.id, buyer.id, 'Buyer defaulted on payment')
      const forfeiture = useStore.getState().emdForfeitures[0]
      const ceoReq = useStore.getState().ceoApprovals.find((a) => a.kind === 'emd_forfeiture' && a.refId === forfeiture.id)!
      // Before Phase 22, canSignForCeo admitted 'ceo' and 'super_admin' while
      // waiveEmdForfeiture's own guard admitted only FINANCE_ROLES
      // ('finance_admin', 'super_admin') — the only role in both sets was
      // super_admin, so that's what this test exercises. Since Phase 22,
      // 'ceo' works too (see the AFTER test below) — this one is left as-is
      // to keep covering the super_admin path specifically.
      useStore.getState().signIn('super@gmail.com', 'FamySys@123')

      useStore.getState().decideCeoApproval(ceoReq.id, false)

      const updated = useStore.getState().emdForfeitures.find((f) => f.id === forfeiture.id)!
      expect(updated.status).toBe('waived')
      expect(updated.decisionNote).toBe('Refused at CEO sign-off — EMD released back to the buyer')
      expect(useStore.getState().auditEvents.some((e) => e.action === 'emd.forfeit_waive')).toBe(true)
    })

    /* This is finding #2 from the Phase 21 decision table, approved for a fix
       in Phase 22. BEFORE Phase 22 (kept for the record, not deleted):
       waiveEmdForfeiture's own guard only admitted FINANCE_ROLES
       ('finance_admin', 'super_admin'). 'ceo' is not in that set, so when
       the actual CEO — not a super_admin, not a delegate holding a finance
       role — refused an EMD-forfeiture sign-off, the ceoApprovals record
       correctly flipped to 'refused', but the cascaded waiveEmdForfeiture
       call was called and its result discarded: the underlying forfeiture
       silently stayed stuck at 'awaiting_ceo' and the buyer's EMD was never
       released, while the CEO saw what looked like a normal refusal.
       Skipped because it no longer reflects current behavior — it would
       fail against the fixed code, which is the point: the suite documents
       what changed. See the AFTER test right below for current behavior. */
    it.skip('BEFORE Phase 22: decideCeoApproval refusing an EMD forfeiture as the literal CEO left the forfeiture stuck at awaiting_ceo', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('finance@gmail.com', 'FerroBid@Dev2026')
      const lot = useStore.getState().lots[0]
      const buyer = useStore.getState().users.find((u) => u.role === 'buyer')!
      const ceoFrom = useStore.getState().financeConfig.ceoForfeitureFrom
      useStore.setState((s) => ({
        lots: s.lots.map((l) => (l.id === lot.id ? { ...l, preBidEmd: ceoFrom } : l)),
        wallets: s.wallets.map((w) => (w.userId === buyer.id ? { ...w, emdLocked: ceoFrom } : w)),
        emdForfeitures: [],
      }))
      useStore.getState().raiseEmdForfeiture(lot.id, buyer.id, 'Buyer defaulted on payment')
      const forfeiture = useStore.getState().emdForfeitures[0]
      const ceoReq = useStore.getState().ceoApprovals.find((a) => a.kind === 'emd_forfeiture' && a.refId === forfeiture.id)!
      useStore.getState().signIn('ceo@gmail.com', 'FerroBid@Dev2026')

      useStore.getState().decideCeoApproval(ceoReq.id, false)

      expect(useStore.getState().ceoApprovals.find((a) => a.id === ceoReq.id)!.status).toBe('refused')
      expect(useStore.getState().emdForfeitures.find((f) => f.id === forfeiture.id)!.status).toBe('awaiting_ceo')
    })

    it('AFTER Phase 22: decideCeoApproval refusing an EMD forfeiture as the literal CEO actually waives it — no more silent stuck state', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('finance@gmail.com', 'FerroBid@Dev2026')
      const lot = useStore.getState().lots[0]
      const buyer = useStore.getState().users.find((u) => u.role === 'buyer')!
      const ceoFrom = useStore.getState().financeConfig.ceoForfeitureFrom
      useStore.setState((s) => ({
        lots: s.lots.map((l) => (l.id === lot.id ? { ...l, preBidEmd: ceoFrom } : l)),
        wallets: s.wallets.map((w) => (w.userId === buyer.id ? { ...w, emdLocked: ceoFrom } : w)),
        emdForfeitures: [],
      }))
      useStore.getState().raiseEmdForfeiture(lot.id, buyer.id, 'Buyer defaulted on payment')
      const forfeiture = useStore.getState().emdForfeitures[0]
      const ceoReq = useStore.getState().ceoApprovals.find((a) => a.kind === 'emd_forfeiture' && a.refId === forfeiture.id)!
      useStore.getState().signIn('ceo@gmail.com', 'FerroBid@Dev2026')

      const result = useStore.getState().decideCeoApproval(ceoReq.id, false)

      expect(result).toBeUndefined()
      expect(useStore.getState().ceoApprovals.find((a) => a.id === ceoReq.id)!.status).toBe('refused')
      const updated = useStore.getState().emdForfeitures.find((f) => f.id === forfeiture.id)!
      expect(updated.status).toBe('waived')
      expect(updated.decisionNote).toBe('Refused at CEO sign-off — EMD released back to the buyer')
      expect(useStore.getState().auditEvents.some((e) => e.action === 'emd.forfeit_waive')).toBe(true)
    })

    it('AFTER Phase 22: a non-Finance, non-CEO delegate cannot waive via the Finance desk button — the widened guard is scoped to the CEO-queue call path only', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('finance@gmail.com', 'FerroBid@Dev2026')
      const lot = useStore.getState().lots[0]
      const buyer = useStore.getState().users.find((u) => u.role === 'buyer')!
      const ceoFrom = useStore.getState().financeConfig.ceoForfeitureFrom
      useStore.setState((s) => ({
        lots: s.lots.map((l) => (l.id === lot.id ? { ...l, preBidEmd: ceoFrom } : l)),
        wallets: s.wallets.map((w) => (w.userId === buyer.id ? { ...w, emdLocked: ceoFrom } : w)),
        emdForfeitures: [],
      }))
      useStore.getState().raiseEmdForfeiture(lot.id, buyer.id, 'Buyer defaulted on payment')
      const forfeiture = useStore.getState().emdForfeitures[0]
      // exec_manager calling the Finance desk's own waive button directly —
      // not via decideCeoApproval, so no ceoQueueAuthorized is passed.
      useStore.getState().switchRole('exec_manager')

      const result = useStore.getState().waiveEmdForfeiture(forfeiture.id, 'Trying the direct button')

      expect(result).toEqual({ ok: false })
      expect(useStore.getState().emdForfeitures.find((f) => f.id === forfeiture.id)!.status).toBe('awaiting_ceo')
    })

    it('decideCeoApproval approving an over-threshold refund marks it approved (not yet processed)', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('finance@gmail.com', 'FerroBid@Dev2026')
      const ceoFrom = useStore.getState().financeConfig.ceoRefundFrom
      const raised = useStore.getState().raiseRefund({ userId: 'u-buyer-1', amount: ceoFrom, source: 'overpayment', reason: 'Large overpayment' })
      expect(raised).toEqual({ ok: true, awaitingCeo: true })
      const refund = useStore.getState().refundRequests[0]
      const ceoReq = useStore.getState().ceoApprovals.find((a) => a.kind === 'refund' && a.refId === refund.id)!
      useStore.getState().signIn('ceo@gmail.com', 'FerroBid@Dev2026')

      useStore.getState().decideCeoApproval(ceoReq.id, true)

      expect(useStore.getState().refundRequests.find((r) => r.id === refund.id)!.status).toBe('approved')
    })

    it('decideCeoApproval refusing an over-threshold refund marks it rejected', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('finance@gmail.com', 'FerroBid@Dev2026')
      const ceoFrom = useStore.getState().financeConfig.ceoRefundFrom
      useStore.getState().raiseRefund({ userId: 'u-buyer-1', amount: ceoFrom, source: 'overpayment', reason: 'Large overpayment' })
      const refund = useStore.getState().refundRequests[0]
      const ceoReq = useStore.getState().ceoApprovals.find((a) => a.kind === 'refund' && a.refId === refund.id)!
      useStore.getState().signIn('ceo@gmail.com', 'FerroBid@Dev2026')

      useStore.getState().decideCeoApproval(ceoReq.id, false, 'Not substantiated')

      expect(useStore.getState().refundRequests.find((r) => r.id === refund.id)!.status).toBe('rejected')
    })

    it('decideCeoApproval always audits the exact amount and notifies the requester at the request-kind href', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('finance@gmail.com', 'FerroBid@Dev2026')
      const requester = useStore.getState().currentUser!
      const ceoFrom = useStore.getState().financeConfig.ceoRefundFrom
      useStore.getState().raiseRefund({ userId: 'u-buyer-1', amount: ceoFrom, source: 'overpayment', reason: 'Large overpayment' })
      const refund = useStore.getState().refundRequests[0]
      const ceoReq = useStore.getState().ceoApprovals.find((a) => a.kind === 'refund' && a.refId === refund.id)!
      useStore.getState().signIn('ceo@gmail.com', 'FerroBid@Dev2026')

      useStore.getState().decideCeoApproval(ceoReq.id, true, 'Approved on review')

      const mainAudit = useStore.getState().auditEvents.find((e) => e.action === 'ceo.approve')!
      expect(mainAudit.detail).toBe(`${inr(ceoFrom)} — Approved on review`)
      const notif = useStore.getState().notifications.find((n) => n.userId === requester.id && n.title === 'Signed off')!
      expect(notif.href).toBe('/finance/refunds')
    })

    it('delegateCeoApprovals lets the delegate sign', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('ceo@gmail.com', 'FerroBid@Dev2026')
      const until = new Date(useStore.getState().now + 5 * 86_400_000).toISOString().slice(0, 10)

      const delegateResult = useStore.getState().delegateCeoApprovals('u-exec-1', until, 'Out of office')
      expect(delegateResult).toEqual({ ok: true })
      expect(useStore.getState().ceoDelegation).toMatchObject({ toUserId: 'u-exec-1', until })

      useStore.getState().signIn('finance@gmail.com', 'FerroBid@Dev2026')
      const req = useStore.getState().requestCeoSignoff({ kind: 'permanent_ban', refId: 'u-buyer-1', amount: 0, summary: 'Ban', reason: 'x' })!

      useStore.getState().signIn('executive@gmail.com', 'FerroBid@Dev2026')
      useStore.getState().decideCeoApproval(req.id, true, 'Delegate signature')
      expect(useStore.getState().ceoApprovals.find((a) => a.id === req.id)!.status).toBe('approved')
    })

    it('clearCeoDelegation ends the delegation, after which the former delegate can no longer sign', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('ceo@gmail.com', 'FerroBid@Dev2026')
      const until = new Date(useStore.getState().now + 5 * 86_400_000).toISOString().slice(0, 10)
      useStore.getState().delegateCeoApprovals('u-exec-1', until, 'Out of office')

      useStore.getState().clearCeoDelegation()
      expect(useStore.getState().ceoDelegation).toBeNull()

      useStore.getState().signIn('finance@gmail.com', 'FerroBid@Dev2026')
      const req = useStore.getState().requestCeoSignoff({ kind: 'permanent_ban', refId: 'u-buyer-1', amount: 0, summary: 'Ban', reason: 'x' })!
      useStore.getState().signIn('executive@gmail.com', 'FerroBid@Dev2026')

      useStore.getState().decideCeoApproval(req.id, true, 'No longer delegated')

      expect(useStore.getState().ceoApprovals.find((a) => a.id === req.id)!.status).toBe('pending')
    })

    it('delegateCeoApprovals refuses a caller who is not the CEO', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('executive@gmail.com', 'FerroBid@Dev2026')
      const result = useStore.getState().delegateCeoApprovals('u-exec-1', '2099-01-01', undefined)
      expect(result).toEqual({ ok: false, error: 'Only the CEO can hand this queue to someone else.' })
    })

    it('delegateCeoApprovals refuses a past date', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('ceo@gmail.com', 'FerroBid@Dev2026')
      const result = useStore.getState().delegateCeoApprovals('u-exec-1', '2020-01-01', undefined)
      expect(result).toEqual({ ok: false, error: 'Pick a date in the future — a delegation with no time left changes nothing.' })
    })
  })
})
