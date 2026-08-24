import { describe, expect, it } from 'vitest'
import { freshStore } from '../helpers/freshStore'
import { inr } from '../../src/lib/format'
import { doDue } from '../../src/lib/money'

/** Phase 16b — the finance/eligibility cluster on auctionFloorSlice.ts, the
 *  Super Admin master-data cluster, account-detail correction, and the two
 *  remaining Sub Admin actions (reviewAction / saveHandoverNote). */

const FIN_EMAIL = 'finance@gmail.com'
const SUPER_EMAIL = 'super@gmail.com'
const SUPER_PASSWORD = 'FamySys@123'
const SUB_EMAIL = 'sub@gmail.com'
const PUBLISH_EMAIL = 'auction@gmail.com'
const BUYER_EMAIL = 'buy@gmail.com'
const PASSWORD = 'FerroBid@Dev2026'

describe('phase 16b — finance/eligibility desk (auctionFloorSlice)', () => {
  describe('sendAnnouncement', () => {
    it('refuses a caller not on ANNOUNCE_ROLES', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(BUYER_EMAIL, PASSWORD)
      const result = useStore.getState().sendAnnouncement({ scope: 'platform', title: 'Notice', body: 'Body text', severity: 'info' })
      expect(result).toEqual({ ok: false, error: 'Not permitted for this role' })
    })

    it('refuses an empty title or body', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(PUBLISH_EMAIL, PASSWORD)
      expect(useStore.getState().sendAnnouncement({ scope: 'platform', title: '  ', body: 'Body', severity: 'info' })).toEqual({ ok: false, error: 'A title and a message are both required' })
    })

    it('refuses catalogue scope without a catalogueId', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(PUBLISH_EMAIL, PASSWORD)
      expect(useStore.getState().sendAnnouncement({ scope: 'catalogue', title: 'T', body: 'B', severity: 'info' })).toEqual({ ok: false, error: 'Pick the auction this notice belongs to' })
    })

    it('platform broadcast — records, audits info, notifies userId null', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(PUBLISH_EMAIL, PASSWORD)
      const result = useStore.getState().sendAnnouncement({ scope: 'platform', title: 'Maintenance window', body: 'Site will be down 2am-3am IST', severity: 'info' })
      expect(result).toEqual({ ok: true })
      expect(useStore.getState().announcements[0]).toMatchObject({ scope: 'platform', title: 'Maintenance window' })
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'announcement.send', target: 'platform', detail: 'INFO · Maintenance window', severity: 'info' })
      const notif = useStore.getState().notifications.find((n) => n.userId === null && n.title === 'Maintenance window')
      expect(notif).toBeDefined()
    })

    it('catalogue scope critical severity — audits as warning, targets the catalogue code', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(PUBLISH_EMAIL, PASSWORD)
      const cat = useStore.getState().catalogues[0]
      const result = useStore.getState().sendAnnouncement({ scope: 'catalogue', catalogueId: cat.id, title: 'Reserve changed', body: 'Reserve raised on lot 4', severity: 'critical' })
      expect(result).toEqual({ ok: true })
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'announcement.send', target: cat.code, detail: 'CRITICAL · Reserve changed', severity: 'warning' })
    })
  })

  describe('issueDemandDraft — paid amount routed through doDue()', () => {
    it('refuses a role outside Finance/Sub Admin/Exec Manager', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(BUYER_EMAIL, PASSWORD)
      const before = useStore.getState().demandDrafts.length
      useStore.getState().issueDemandDraft('do-anything', { ddNumber: 'DD-1', issuingBank: 'HDFC', amount: 1000 })
      expect(useStore.getState().demandDrafts.length).toBe(before)
    })

    it('refuses a delivery order not in payment_pending', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(FIN_EMAIL, PASSWORD)
      const d = useStore.getState().deliveryOrders.find((x) => x.stage !== 'payment_pending')!
      const before = useStore.getState().demandDrafts.length
      useStore.getState().issueDemandDraft(d.id, { ddNumber: 'DD-2', issuingBank: 'HDFC', amount: 1000 })
      expect(useStore.getState().demandDrafts.length).toBe(before)
    })

    it('success — paidAmount equals materialValue+gstAmount+tcsAmount, exact audit and both notifications', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(FIN_EMAIL, PASSWORD)
      const target = useStore.getState().deliveryOrders[0]
      useStore.setState((s) => ({ deliveryOrders: s.deliveryOrders.map((x) => (x.id === target.id ? { ...x, stage: 'payment_pending' as const } : x)) }))
      const lot = useStore.getState().lots.find((l) => l.id === target.lotId)

      const result = useStore.getState().issueDemandDraft(target.id, { ddNumber: 'DD-9001', issuingBank: 'ICICI', amount: 500000 })
      expect(result).toBeUndefined()

      const updated = useStore.getState().deliveryOrders.find((x) => x.id === target.id)!
      expect(updated.stage).toBe('dd_issued')
      expect(updated.paidAmount).toBe(doDue(target))
      expect(updated.paidAmount).toBe(target.materialValue + target.gstAmount + target.tcsAmount)
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'dd.issue', target: lot?.lotNo ?? target.id, detail: `Demand Draft DD-9001 (ICICI) for ${inr(500000)} recorded` })
      const buyerNotif = useStore.getState().notifications.find((n) => n.userId === target.buyerId && n.title.startsWith('Payment recorded'))
      expect(buyerNotif?.body).toBe(`Demand Draft DD-9001 for ${inr(500000)} is on the record. Lifting can be scheduled.`)
    })

    it('sub_admin caller routes the desk notification to finance_admin, not exec/sub', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(SUB_EMAIL, PASSWORD)
      const target = useStore.getState().deliveryOrders[0]
      useStore.setState((s) => ({ deliveryOrders: s.deliveryOrders.map((x) => (x.id === target.id ? { ...x, stage: 'payment_pending' as const } : x)) }))
      useStore.getState().issueDemandDraft(target.id, { ddNumber: 'DD-9002', issuingBank: 'SBI', amount: 200000 })
      const desk = useStore.getState().notifications.find((n) => n.title.startsWith('Demand Draft recorded'))
      expect(desk?.href).toBe('/finance/payments')
    })
  })

  describe('verifyBankAccount / rejectBankAccount', () => {
    it('refuses a non-Finance role', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(BUYER_EMAIL, PASSWORD)
      const a = useStore.getState().bankAccounts[0]
      useStore.getState().verifyBankAccount(a.id)
      expect(useStore.getState().bankAccounts.find((x) => x.id === a.id)!.status).toBe(a.status)
    })

    it('verify — status verified, exact audit and notification', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(FIN_EMAIL, PASSWORD)
      const target = useStore.getState().bankAccounts[0]
      useStore.setState((s) => ({ bankAccounts: s.bankAccounts.map((x) => (x.id === target.id ? { ...x, status: 'pending' as const } : x)) }))
      useStore.getState().verifyBankAccount(target.id)
      const a = useStore.getState().bankAccounts.find((x) => x.id === target.id)!
      expect(a.status).toBe('verified')
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'bankaccount.verify', target: target.id, detail: `${target.bankName} account •••• ${target.last4} verified` })
      const notif = useStore.getState().notifications.find((n) => n.userId === target.userId && n.title === 'Bank account verified')
      expect(notif?.body).toBe(`${target.bankName} •••• ${target.last4} can now receive withdrawals.`)
    })

    it('reject — status rejected with reason, exact audit', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(FIN_EMAIL, PASSWORD)
      const target = useStore.getState().bankAccounts[0]
      useStore.setState((s) => ({ bankAccounts: s.bankAccounts.map((x) => (x.id === target.id ? { ...x, status: 'pending' as const } : x)) }))
      useStore.getState().rejectBankAccount(target.id, 'IFSC mismatch')
      const a = useStore.getState().bankAccounts.find((x) => x.id === target.id)!
      expect(a).toMatchObject({ status: 'rejected', rejectionReason: 'IFSC mismatch' })
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'bankaccount.reject', severity: 'warning', detail: `${target.bankName} account •••• ${target.last4} rejected — IFSC mismatch` })
    })
  })

  describe('approveDepositClaim / rejectDepositClaim', () => {
    it('approve — wallet credited exactly, ledger entry recorded, exact audit', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(FIN_EMAIL, PASSWORD)
      const target = useStore.getState().depositClaims[0]
      useStore.setState((s) => ({ depositClaims: s.depositClaims.map((c) => (c.id === target.id ? { ...c, status: 'submitted' as const } : c)) }))
      const wallet0 = useStore.getState().wallets.find((w) => w.userId === target.userId)
      const balanceBefore = wallet0?.balance ?? 0

      useStore.getState().approveDepositClaim(target.id)

      const claim = useStore.getState().depositClaims.find((c) => c.id === target.id)!
      expect(claim.status).toBe('approved')
      const wallet = useStore.getState().wallets.find((w) => w.userId === target.userId)!
      expect(wallet.balance).toBe(balanceBefore + target.amount)
      expect(wallet.ledger[0]).toMatchObject({ type: 'topup', amount: target.amount, ref: target.utr, note: `Deposit claim approved — UTR ${target.utr}` })
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'deposit.approve', target: target.id, detail: `Deposit claim approved — ${inr(target.amount)} credited (UTR ${target.utr})` })
    })

    it('reject — status rejected, no wallet change', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(FIN_EMAIL, PASSWORD)
      const target = useStore.getState().depositClaims[0]
      useStore.setState((s) => ({ depositClaims: s.depositClaims.map((c) => (c.id === target.id ? { ...c, status: 'submitted' as const } : c)) }))
      const balanceBefore = useStore.getState().wallets.find((w) => w.userId === target.userId)?.balance ?? 0

      useStore.getState().rejectDepositClaim(target.id, 'UTR not found')

      expect(useStore.getState().depositClaims.find((c) => c.id === target.id)!.status).toBe('rejected')
      expect(useStore.getState().wallets.find((w) => w.userId === target.userId)?.balance ?? 0).toBe(balanceBefore)
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'deposit.reject', severity: 'warning', detail: 'Deposit claim rejected — UTR not found' })
    })

    it('refuses a claim not in submitted status', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(FIN_EMAIL, PASSWORD)
      const target = useStore.getState().depositClaims[0]
      useStore.setState((s) => ({ depositClaims: s.depositClaims.map((c) => (c.id === target.id ? { ...c, status: 'approved' as const } : c)) }))
      const before = useStore.getState().auditEvents.length
      useStore.getState().approveDepositClaim(target.id)
      expect(useStore.getState().auditEvents.length).toBe(before)
    })
  })

  describe('approveEmdExemption / rejectEmdExemption', () => {
    it('refuses a role outside PUBLISH_ROLES', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(FIN_EMAIL, PASSWORD)
      const req = useStore.getState().emdExemptionRequests[0]
      const before = useStore.getState().auditEvents.length
      useStore.getState().approveEmdExemption(req.id)
      expect(useStore.getState().auditEvents.length).toBe(before)
    })

    it('approve — status approved, exact audit severity and notification body', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(PUBLISH_EMAIL, PASSWORD)
      const target = useStore.getState().emdExemptionRequests[0]
      useStore.setState((s) => ({ emdExemptionRequests: s.emdExemptionRequests.map((r) => (r.id === target.id ? { ...r, status: 'pending' as const } : r)) }))
      const cat = useStore.getState().catalogues.find((c) => c.id === target.catalogueId)

      useStore.getState().approveEmdExemption(target.id)

      expect(useStore.getState().emdExemptionRequests.find((r) => r.id === target.id)!.status).toBe('approved')
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'emd_exemption.approve', severity: 'warning', detail: 'EMD deadline exemption approved for buyer' })
      const notif = useStore.getState().notifications.find((n) => n.userId === target.buyerId && n.title === 'EMD exemption approved')
      expect(notif?.body).toBe(`You can now fund EMD for ${cat?.code ?? 'this catalogue'} and join the auction.`)
    })

    it('reject — status rejected with reason', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(PUBLISH_EMAIL, PASSWORD)
      const target = useStore.getState().emdExemptionRequests[0]
      useStore.setState((s) => ({ emdExemptionRequests: s.emdExemptionRequests.map((r) => (r.id === target.id ? { ...r, status: 'pending' as const } : r)) }))
      useStore.getState().rejectEmdExemption(target.id, 'Not enough history')
      expect(useStore.getState().emdExemptionRequests.find((r) => r.id === target.id)!).toMatchObject({ status: 'rejected', rejectionReason: 'Not enough history' })
    })
  })

  describe('setCompanyBankAccounts', () => {
    it('refuses a non-super_admin', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(FIN_EMAIL, PASSWORD)
      const before = useStore.getState().companyBankAccounts
      useStore.getState().setCompanyBankAccounts([])
      expect(useStore.getState().companyBankAccounts).toBe(before)
    })

    it('super_admin — replaces the list and audits the count', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(SUPER_EMAIL, SUPER_PASSWORD)
      const accounts = [{ id: 'cba-x', bank: 'Axis', accountNumberMasked: '•••• 1234', ifsc: 'UTIB0001', purpose: 'EMD pool' }]
      useStore.getState().setCompanyBankAccounts(accounts)
      expect(useStore.getState().companyBankAccounts).toEqual(accounts)
      expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'companybank.update', detail: 'Company bank account list updated — 1 account(s)' })
    })
  })
})

describe('phase 16b — withdrawal maker-checker desk', () => {
  function requestedWithdrawal(useStore: Awaited<ReturnType<typeof freshStore>>) {
    const target = useStore.getState().withdrawalRequests[0]
    useStore.setState((s) => ({ withdrawalRequests: s.withdrawalRequests.map((r) => (r.id === target.id ? { ...r, status: 'requested' as const, reviewedBy: undefined } : r)) }))
    return target
  }

  it('approveWithdrawal — reviews into processing, requester notified, exact audit', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(FIN_EMAIL, PASSWORD)
    const target = requestedWithdrawal(useStore)

    useStore.getState().approveWithdrawal(target.id)

    const req = useStore.getState().withdrawalRequests.find((r) => r.id === target.id)!
    expect(req.status).toBe('under_review')
    expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'withdrawal.review', target: target.id })
    const requesterNotif = useStore.getState().notifications.find((n) => n.userId === target.userId && n.title === 'Withdrawal under review')
    expect(requesterNotif?.body).toBe(`${inr(target.amount)} has passed review and is queued for release to your verified account.`)
  })

  it('processWithdrawal — same reviewer as processor is blocked above the second-signature threshold', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(FIN_EMAIL, PASSWORD)
    const target = requestedWithdrawal(useStore)
    const threshold = useStore.getState().financeConfig.withdrawalSecondSignatureFrom
    useStore.setState((s) => ({ withdrawalRequests: s.withdrawalRequests.map((r) => (r.id === target.id ? { ...r, status: 'under_review' as const, amount: threshold, reviewedBy: s.currentUser!.id } : r)) }))

    useStore.getState().processWithdrawal(target.id)

    expect(useStore.getState().withdrawalRequests.find((r) => r.id === target.id)!.status).toBe('under_review')
    expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'withdrawal.maker_checker_block', severity: 'warning' })
    expect(useStore.getState().toasts.some((t) => t.kind === 'danger' && t.title === 'A second pair of hands is required')).toBe(true)
  })

  it('processWithdrawal — a different Finance user releases it successfully', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(FIN_EMAIL, PASSWORD)
    const target = requestedWithdrawal(useStore)
    const threshold = useStore.getState().financeConfig.withdrawalSecondSignatureFrom
    useStore.setState((s) => ({ withdrawalRequests: s.withdrawalRequests.map((r) => (r.id === target.id ? { ...r, status: 'under_review' as const, amount: threshold, reviewedBy: 'someone-else' } : r)) }))

    useStore.getState().processWithdrawal(target.id)

    const req = useStore.getState().withdrawalRequests.find((r) => r.id === target.id)!
    expect(req.status).toBe('processed')
    expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'withdrawal.process' })
    const notif = useStore.getState().notifications.find((n) => n.userId === target.userId && n.title === 'Withdrawal processed')
    expect(notif?.body).toBe(`${inr(threshold)} sent to your bank account.`)
  })

  it('failWithdrawal — reverses the amount to the wallet with a refund-type ledger entry', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(FIN_EMAIL, PASSWORD)
    const target = useStore.getState().withdrawalRequests[0]
    useStore.setState((s) => ({ withdrawalRequests: s.withdrawalRequests.map((r) => (r.id === target.id ? { ...r, status: 'under_review' as const } : r)) }))
    const balanceBefore = useStore.getState().wallets.find((w) => w.userId === target.userId)?.balance ?? 0

    useStore.getState().failWithdrawal(target.id, 'Bank rejected the transfer')

    const req = useStore.getState().withdrawalRequests.find((r) => r.id === target.id)!
    expect(req).toMatchObject({ status: 'failed', reason: 'Bank rejected the transfer' })
    const wallet = useStore.getState().wallets.find((w) => w.userId === target.userId)!
    expect(wallet.balance).toBe(balanceBefore + target.amount)
    expect(wallet.ledger[0]).toMatchObject({ type: 'refund', amount: target.amount, ref: target.ref, note: `Withdrawal failed — reversed: Bank rejected the transfer` })
  })

  it('setWithdrawalWindow — super_admin only, exact audit detail', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(SUPER_EMAIL, SUPER_PASSWORD)
    const config = { days: [1, 2, 3, 4, 5], startHour: 10, startMinute: 0, endHour: 13, endMinute: 30 }
    useStore.getState().setWithdrawalWindow(config)
    expect(useStore.getState().withdrawalWindow).toEqual(config)
    expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'withdrawal.window_config', detail: 'Withdrawal window updated — 5 day(s)/week, 10:00–13:30 IST' })
  })
})

describe('phase 16b / Phase 22 — setUserStanding', () => {
  // This is finding #4 from the Phase 21 decision table, approved for a fix
  // in Phase 22. BEFORE Phase 22 (kept for the record, not deleted): the
  // action carried no role guard at all — any signed-in role, even 'buyer',
  // could flip another account's standing; only the page (`/admin/users`,
  // `/admin/blacklist`) gated who saw the control. Explicitly signed in as
  // buyer here (rather than relying on freshStore's unauthenticated
  // default) so the test deterministically demonstrates "any caller", not
  // an accident of which role happened to be left in localStorage by an
  // earlier test in this file. Skipped because it no longer reflects
  // current behavior — it would fail against the fixed code, which is the
  // point: the suite documents what changed.
  it.skip('BEFORE Phase 22: any signed-in role, including buyer, could set another account\'s standing', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(BUYER_EMAIL, PASSWORD)
    const target = useStore.getState().users.find((u) => u.role === 'buyer' && u.email !== useStore.getState().currentUser?.email)!
    useStore.getState().setUserStanding(target.id, 'good', undefined)
    expect(useStore.getState().users.find((u) => u.id === target.id)!.standing).toBe('good')
    const notif = useStore.getState().notifications.find((n) => n.userId === target.id && n.title === 'Your account standing has been restored')
    expect(notif?.body).toBe('Full access is back. Nothing further is needed from you.')
  })

  it('AFTER Phase 22: refuses a caller who is not sub_admin/super_admin', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(BUYER_EMAIL, PASSWORD)
    const buyer = useStore.getState().users.find((u) => u.role === 'buyer')!
    const before = buyer.standing

    const result = useStore.getState().setUserStanding(buyer.id, 'good', undefined)

    expect(result).toEqual({ ok: false, error: 'Only a Sub Admin or Super Admin changes account standing' })
    expect(useStore.getState().users.find((u) => u.id === buyer.id)!.standing).toBe(before)
  })

  it('AFTER Phase 22: good standing restores access for a sub_admin caller, no Finance notification', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(SUB_EMAIL, PASSWORD)
    const buyer = useStore.getState().users.find((u) => u.role === 'buyer')!

    const result = useStore.getState().setUserStanding(buyer.id, 'good', undefined)

    expect(result).toEqual({ ok: true })
    expect(useStore.getState().users.find((u) => u.id === buyer.id)!.standing).toBe('good')
    const notif = useStore.getState().notifications.find((n) => n.userId === buyer.id && n.title === 'Your account standing has been restored')
    expect(notif?.body).toBe('Full access is back. Nothing further is needed from you.')
  })

  it('AFTER Phase 22: defaulter standing is audited critical and notifies finance_admin, for a super_admin caller', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(SUPER_EMAIL, SUPER_PASSWORD)
    const buyer = useStore.getState().users.find((u) => u.role === 'buyer')!

    const result = useStore.getState().setUserStanding(buyer.id, 'defaulter', 'Repeated non-payment')

    expect(result).toEqual({ ok: true })
    expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'user.standing', severity: 'critical', detail: 'Standing set to defaulter — Repeated non-payment' })
    const finNotif = useStore.getState().notifications.find((n) => n.title.startsWith('Account restricted'))
    expect(finNotif?.body).toBe('Repeated non-payment Check any EMD held and open delivery orders against this account.')
  })
})

describe('phase 16b — master data cluster (superAdminSlice)', () => {
  it('addMasterCategory refuses a non-super_admin', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(FIN_EMAIL, PASSWORD)
    const result = useStore.getState().addMasterCategory('Copper')
    expect(result).toEqual({ ok: false, error: 'Only a Super Admin can change the shape of the platform' })
  })

  it('addMasterCategory refuses a duplicate slug', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(SUPER_EMAIL, SUPER_PASSWORD)
    useStore.getState().addMasterCategory('Palladium')
    const result = useStore.getState().addMasterCategory('Palladium')
    expect(result).toEqual({ ok: false, error: 'Palladium already exists' })
  })

  it('addMasterCategory success — recorded structural change and audit', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(SUPER_EMAIL, SUPER_PASSWORD)
    const structBefore = useStore.getState().structuralChanges.length
    const result = useStore.getState().addMasterCategory('Titanium')
    expect(result).toEqual({ ok: true })
    expect(useStore.getState().masterCategories.some((c) => c.label === 'Titanium')).toBe(true)
    expect(useStore.getState().structuralChanges.length).toBe(structBefore + 1)
    expect(useStore.getState().structuralChanges[0]).toMatchObject({ kind: 'master.add', target: 'Category · Titanium' })
    expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'master.add', target: 'Titanium', detail: 'Metal category added', severity: 'warning' })
  })

  it('addMasterUom refuses a blank code', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(SUPER_EMAIL, SUPER_PASSWORD)
    expect(useStore.getState().addMasterUom('  ', 'Kilograms', '0.01')).toEqual({ ok: false, error: 'A unit needs a code and a name' })
  })

  it('addMasterUom success', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(SUPER_EMAIL, SUPER_PASSWORD)
    const result = useStore.getState().addMasterUom('qtl', 'Quintal', '')
    expect(result).toEqual({ ok: true })
    const row = useStore.getState().masterUoms.find((u) => u.code === 'QTL')!
    expect(row).toMatchObject({ label: 'Quintal', precision: 'Whole numbers' })
  })

  it('upsertMasterYard adds a new yard when no id is given', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(SUPER_EMAIL, SUPER_PASSWORD)
    const result = useStore.getState().upsertMasterYard({ name: 'Test Yard', region: 'West', address: '123 Dock Rd', contactName: 'A', contactPhone: '9999999999' })
    expect(result).toEqual({ ok: true })
    expect(useStore.getState().masterYards.some((y) => y.name === 'Test Yard')).toBe(true)
  })

  it('upsertMasterYard edits an existing yard by id', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(SUPER_EMAIL, SUPER_PASSWORD)
    const existing = useStore.getState().masterYards[0]
    const result = useStore.getState().upsertMasterYard({ ...existing, address: '999 New Address' })
    expect(result).toEqual({ ok: true })
    expect(useStore.getState().masterYards.find((y) => y.id === existing.id)!.address).toBe('999 New Address')
    expect(useStore.getState().structuralChanges[0]).toMatchObject({ kind: 'master.edit', before: existing.address, after: '999 New Address' })
  })

  it('setMasterActive refuses retiring a category that is on a catalogued lot', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(SUPER_EMAIL, SUPER_PASSWORD)
    const lot = useStore.getState().lots.find((l) => l.catalogueId)!
    const result = useStore.getState().setMasterActive('category', lot.category, false)
    expect(result.ok).toBe(false)
  })

  it('setMasterActive retires a uom with none in use', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(SUPER_EMAIL, SUPER_PASSWORD)
    const unused = useStore.getState().masterUoms.find((u) => !useStore.getState().lots.some((l) => l.uom === u.code))
    if (!unused) return
    const result = useStore.getState().setMasterActive('uom', unused.code, false)
    expect(result).toEqual({ ok: true })
    expect(useStore.getState().masterUoms.find((u) => u.code === unused.code)!.active).toBe(false)
    expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'master.deactivate', target: unused.code })
  })

  it('renameMasterEntry is a no-op when the name is unchanged', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(SUPER_EMAIL, SUPER_PASSWORD)
    const row = useStore.getState().masterCategories[0]
    const structBefore = useStore.getState().structuralChanges.length
    const result = useStore.getState().renameMasterEntry('category', row.key, row.label)
    expect(result).toEqual({ ok: true })
    expect(useStore.getState().structuralChanges.length).toBe(structBefore)
  })

  it('renameMasterEntry renames a category, keeping its slug', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(SUPER_EMAIL, SUPER_PASSWORD)
    const row = useStore.getState().masterCategories[0]
    const result = useStore.getState().renameMasterEntry('category', row.key, 'Renamed Metal')
    expect(result).toEqual({ ok: true })
    const updated = useStore.getState().masterCategories.find((c) => c.key === row.key)!
    expect(updated.label).toBe('Renamed Metal')
    expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'master.edit', target: row.key, detail: `Category renamed "${row.label}" → "Renamed Metal"` })
  })

  it('addTermsVersion refuses an empty note', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(SUPER_EMAIL, SUPER_PASSWORD)
    const set0 = useStore.getState().termsSets[0]
    expect(useStore.getState().addTermsVersion(set0.id, '  ')).toEqual({ ok: false, error: 'Say what changed — a terms version without a note cannot be explained to a buyer later' })
  })

  it('addTermsVersion bumps the minor version and audits critical', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(SUPER_EMAIL, SUPER_PASSWORD)
    const set0 = useStore.getState().termsSets[0]
    const [major, minor] = String(set0.version).replace(/^v/i, '').split('.')
    const expected = `v${major}.${Number(minor ?? 0) + 1}`

    const result = useStore.getState().addTermsVersion(set0.id, 'Updated delivery clause')
    expect(result).toEqual({ ok: true })
    expect(useStore.getState().termsSets.find((t) => t.id === set0.id)!.version).toBe(expected)
    expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'master.terms_version', severity: 'critical', detail: `${set0.version} → ${expected} — Updated delivery clause` })
  })
})

describe('phase 16b — updateUserDetails', () => {
  it('refuses a role outside Sub Admin / Super Admin', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(BUYER_EMAIL, PASSWORD)
    const target = useStore.getState().users.find((u) => u.role === 'seller')!
    const result = useStore.getState().updateUserDetails(target.id, { city: 'Pune' })
    expect(result).toEqual({ ok: false, error: 'Accounts are administered by a Sub Admin or a Super Admin' })
  })

  it('refuses a Sub Admin editing a Super Admin account', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(SUB_EMAIL, PASSWORD)
    const target = useStore.getState().users.find((u) => u.role === 'super_admin')!
    const result = useStore.getState().updateUserDetails(target.id, { city: 'Pune' })
    expect(result).toEqual({ ok: false, error: 'Only another Super Admin can edit a Super Admin account' })
  })

  it('is a no-op when nothing actually changed', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(SUB_EMAIL, PASSWORD)
    const target = useStore.getState().users.find((u) => u.role === 'buyer')!
    const structBefore = useStore.getState().structuralChanges.length
    const result = useStore.getState().updateUserDetails(target.id, { city: target.city })
    expect(result).toEqual({ ok: true })
    expect(useStore.getState().structuralChanges.length).toBe(structBefore)
  })

  it('success — corrects a field, records structural change, notifies the account holder', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(SUB_EMAIL, PASSWORD)
    const target = useStore.getState().users.find((u) => u.role === 'buyer')!

    const result = useStore.getState().updateUserDetails(target.id, { city: 'Chennai' })
    expect(result).toEqual({ ok: true })

    expect(useStore.getState().users.find((u) => u.id === target.id)!.city).toBe('Chennai')
    expect(useStore.getState().auditEvents[0]).toMatchObject({ action: 'account.edit', target: target.name, detail: `city ${target.city || '—'} → city Chennai` })
    const notif = useStore.getState().notifications.find((n) => n.userId === target.id && n.title === 'Your account details were updated')
    expect(notif).toBeDefined()
  })

  it('does not notify when the caller is correcting their own account', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(SUB_EMAIL, PASSWORD)
    const me = useStore.getState().currentUser!
    useStore.getState().updateUserDetails(me.id, { city: 'Kolkata' })
    const notif = useStore.getState().notifications.find((n) => n.userId === me.id && n.title === 'Your account details were updated')
    expect(notif).toBeUndefined()
  })
})

describe('phase 16b — reviewAction / saveHandoverNote', () => {
  it('reviewAction refuses a non-Sub-Admin', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(BUYER_EMAIL, PASSWORD)
    const ev = useStore.getState().auditEvents[0]
    const result = useStore.getState().reviewAction(ev.id, 'confirmed', '')
    expect(result).toEqual({ ok: false, error: 'Only a Sub Admin reviews another role\'s work' })
  })

  it('reviewAction refuses a non-confirmed verdict with no note', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(SUB_EMAIL, PASSWORD)
    const ev = useStore.getState().auditEvents[0]
    const result = useStore.getState().reviewAction(ev.id, 'questioned', '  ')
    expect(result).toEqual({ ok: false, error: 'Say what is wrong with it — the person who did it is shown this word for word' })
  })

  it('reviewAction refuses reviewing the same event twice', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(SUB_EMAIL, PASSWORD)
    const ev = useStore.getState().auditEvents[0]
    useStore.getState().reviewAction(ev.id, 'confirmed', '')
    const result = useStore.getState().reviewAction(ev.id, 'confirmed', '')
    expect(result).toEqual({ ok: false, error: 'You have already reviewed this one' })
  })

  it('confirmed verdict — audits at info, no escalation', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(SUB_EMAIL, PASSWORD)
    const ev = useStore.getState().auditEvents.find((e) => e.actorId !== 'system' && e.actorId !== useStore.getState().currentUser!.id)!
    const result = useStore.getState().reviewAction(ev.id, 'confirmed', '')
    expect(result).toMatchObject({ ok: true, escalatedTo: undefined })
    expect(useStore.getState().auditEvents.find((e) => e.action === `review.confirmed`)).toMatchObject({ severity: 'info' })
  })

  it('reversed verdict on a bid.* action escalates to super_admin and notifies the desk', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(SUB_EMAIL, PASSWORD)
    useStore.setState((s) => ({
      auditEvents: [{ id: 'aud-test-bid', at: new Date(s.now).toISOString(), actorId: 'system', action: 'bid.place', target: 'LOT-1', detail: 'test', severity: 'info' as const }, ...s.auditEvents],
    }))

    const result = useStore.getState().reviewAction('aud-test-bid', 'reversed', 'Duplicate bid, reversing')
    expect(result).toMatchObject({ ok: true, escalatedTo: 'super_admin' })
    const escalation = useStore.getState().notifications.find((n) => n.title === 'Sub Admin review needs Super Admin — LOT-1')
    expect(escalation?.body).toBe('Duplicate bid, reversing')
    expect(escalation?.href).toBe('/admin/control-tower')
  })

  it('saveHandoverNote refuses an empty body', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(SUB_EMAIL, PASSWORD)
    expect(useStore.getState().saveHandoverNote('   ')).toEqual({ ok: false, error: 'Nothing to hand over yet' })
  })

  it('saveHandoverNote records the note and truncates the audit detail to 160 chars', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn(SUB_EMAIL, PASSWORD)
    const longBody = 'x'.repeat(200)
    const result = useStore.getState().saveHandoverNote(longBody)
    expect(result).toEqual({ ok: true })
    expect(useStore.getState().handoverNotes[0].body).toBe(longBody)
    expect(useStore.getState().auditEvents[0].detail).toBe('x'.repeat(160))
  })
})

/* ---------------------------------------------------------------------------
   Phase 16c — proof of equivalence for the one consolidation this phase made:
   issueDemandDraft's hand-rolled `materialValue + gstAmount + tcsAmount` sum
   is now routed through the existing `doDue()` in lib/money.ts (the same
   function confirmBuyerPayment already used, since phase 5). Byte-identical
   output required across representative and edge-case inputs before this
   was considered safe to consolidate.
--------------------------------------------------------------------------- */
describe('phase 16c — doDue() consolidation proof of equivalence', () => {
  const oldFormula = (d: { materialValue: number; gstAmount: number; tcsAmount: number }) => d.materialValue + d.gstAmount + d.tcsAmount

  const cases: { materialValue: number; gstAmount: number; tcsAmount: number }[] = [
    { materialValue: 500000, gstAmount: 90000, tcsAmount: 5000 }, // representative
    { materialValue: 0, gstAmount: 0, tcsAmount: 0 }, // all zero
    { materialValue: 123456.78, gstAmount: 22222.22, tcsAmount: 1234.5 }, // fractional paise
    { materialValue: 1_000_000_000, gstAmount: 180_000_000, tcsAmount: 10_000_000 }, // large
    { materialValue: 999.99, gstAmount: 0, tcsAmount: 0.01 }, // small fractional edge
  ]

  it.each(cases)('doDue(%o) matches the original inline sum exactly', (c) => {
    const d = { ...c, paidAmount: 0 } as never
    expect(doDue(d)).toBe(oldFormula(c))
  })
})
