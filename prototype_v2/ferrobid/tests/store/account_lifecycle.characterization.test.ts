import { describe, expect, it } from 'vitest'
import { freshStore } from '../helpers/freshStore'

/** Phase 20: the account/security cluster — createSubAdmin, setAccountStatus.
 *  resetUserPassword is audited but NOT migrated (see the phase 20 report) —
 *  its live /api/auth/reset call is the mutation itself (server bumps
 *  token_version and invalidates sessions), so there is no coverage gap this
 *  phase is closing for it and no new tests are added here for it. */

const SUPER = ['super@gmail.com', 'FamySys@123'] as const

describe('account/security cluster — phase 20', () => {
  describe('createSubAdmin', () => {
    it('refuses a non-Super-Admin caller (Sub Admin included)', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('sub@gmail.com', 'FerroBid@Dev2026')
      const result = useStore.getState().createSubAdmin({ name: 'New Person', username: 'newperson', email: 'new@ferrobid.in', phone: '+91 90000 00000', city: 'Pune' })
      expect(result).toEqual({ ok: false, error: 'Only a Super Admin can change the shape of the platform' })
    })

    it('refuses a blank name or sign-in ID', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const result = useStore.getState().createSubAdmin({ name: '  ', username: 'newperson', email: 'new@ferrobid.in', phone: '', city: '' })
      expect(result).toEqual({ ok: false, error: 'Both a name and a sign-in ID are needed' })
    })

    it('refuses a username already in use', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      useStore.getState().createSubAdmin({ name: 'First Person', username: 'takenname', email: 'first@ferrobid.in', phone: '', city: '' })
      const result = useStore.getState().createSubAdmin({ name: 'New Person', username: 'TakenName', email: 'unused@ferrobid.in', phone: '', city: '' })
      expect(result).toEqual({ ok: false, error: 'Those sign-in details are already in use' })
    })

    it('refuses an email already in use (exact match against the stored email)', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const existing = useStore.getState().users.find((u) => u.role === 'buyer')!
      const result = useStore.getState().createSubAdmin({ name: 'New Person', username: 'brandnewid', email: existing.email, phone: '', city: '' })
      expect(result).toEqual({ ok: false, error: 'Those sign-in details are already in use' })
    })

    // This is finding #7 from the Phase 21 decision table, approved for a
    // fix in Phase 22.
    describe('Phase 22 — email duplicate check case-sensitivity', () => {
      // BEFORE Phase 22 (kept for the record, not deleted): the email side
      // of the duplicate check compared exact/case-sensitive while the
      // username side was already trim+lowercase — so two accounts could be
      // created with the same email differing only in case, even though
      // signIn itself matches email case-insensitively. Skipped because it
      // no longer reflects current behavior — it would fail against the
      // fixed code, which is the point: the suite documents what changed.
      it.skip('BEFORE Phase 22: differently-cased emails were treated as distinct, letting a duplicate account through', async () => {
        const useStore = await freshStore()
        useStore.getState().signIn(...SUPER)
        useStore.getState().createSubAdmin({ name: 'Case First', username: 'casefirst', email: 'Duplicate@Ferrobid.in', phone: '', city: '' })

        const result = useStore.getState().createSubAdmin({ name: 'Case Second', username: 'casesecond', email: 'duplicate@ferrobid.in', phone: '', city: '' })

        expect(result.ok).toBe(true)
        expect(useStore.getState().users.filter((u) => u.email.toLowerCase() === 'duplicate@ferrobid.in')).toHaveLength(2)
      })

      it('AFTER Phase 22: differently-cased emails are recognized as the same address and refused', async () => {
        const useStore = await freshStore()
        useStore.getState().signIn(...SUPER)
        useStore.getState().createSubAdmin({ name: 'Case First', username: 'casefirst', email: 'Duplicate@Ferrobid.in', phone: '', city: '' })

        const result = useStore.getState().createSubAdmin({ name: 'Case Second', username: 'casesecond', email: 'duplicate@ferrobid.in', phone: '', city: '' })

        expect(result).toEqual({ ok: false, error: 'Those sign-in details are already in use' })
        expect(useStore.getState().users.filter((u) => u.email.toLowerCase() === 'duplicate@ferrobid.in')).toHaveLength(1)
      })
    })

    it('creates an active Sub Admin, issues an auto password reset row, records a structural change with no snapshot, and tells the CEO', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const scCountBefore = useStore.getState().structuralChanges.length
      const pwrCountBefore = useStore.getState().passwordResets.length

      const result = useStore.getState().createSubAdmin({ name: 'Priya New', username: '  PriyaN  ', email: 'priya.new@ferrobid.in', phone: '+91 90000 11111', city: '  ' })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.password).toMatch(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/)

      const user = useStore.getState().users.find((u) => u.id === result.userId)!
      expect(user).toMatchObject({ name: 'Priya New', username: 'priyan', role: 'sub_admin', firm: 'ferroBid Technologies', city: 'Mumbai', accountStatus: 'active' })

      expect(useStore.getState().passwordResets).toHaveLength(pwrCountBefore + 1)
      expect(useStore.getState().passwordResets[0]).toMatchObject({ userId: result.userId, mode: 'auto', password: result.password, consumed: false })

      expect(useStore.getState().structuralChanges).toHaveLength(scCountBefore + 1)
      const sc = useStore.getState().structuralChanges[0]
      expect(sc).toMatchObject({ kind: 'account.create', target: 'Priya New', before: null, after: 'priyan' })
      // Business/account action, not a reversible structural one — no snapshot.
      expect(sc.snapshot).toBeUndefined()

      const auditRow = useStore.getState().auditEvents[0]
      expect(auditRow).toMatchObject({ action: 'account.create', target: 'priyan', detail: 'Sub Admin account created for Priya New', severity: 'critical' })

      const ceo = useStore.getState().users.find((u) => u.role === 'ceo')!
      const notif = useStore.getState().notifications.find((n) => n.userId === ceo.id && n.title === 'New Sub Admin account')
      expect(notif?.body).toBe('Priya New (priyan) now has full operational access.')
    })

    it('city defaults to Mumbai when blank, and falls back to the trimmed value otherwise', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const result = useStore.getState().createSubAdmin({ name: 'City Person', username: 'citytest', email: 'city@ferrobid.in', phone: '', city: '  Nagpur  ' })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const user = useStore.getState().users.find((u) => u.id === result.userId)!
      expect(user.city).toBe('Nagpur')
    })
  })

  describe('setAccountStatus', () => {
    it('refuses a caller who is neither Super Admin nor Sub Admin', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
      const result = useStore.getState().setAccountStatus('u-buyer-1', 'suspended', 'test')
      expect(result).toEqual({ ok: false, error: 'Accounts are administered by a Sub Admin or a Super Admin' })
    })

    it('refuses a Sub Admin changing a Super Admin account', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('sub@gmail.com', 'FerroBid@Dev2026')
      const result = useStore.getState().setAccountStatus('u-super-1', 'suspended', 'test')
      expect(result).toEqual({ ok: false, error: 'Only another Super Admin can change a Super Admin account' })
    })

    it('refuses a permanent ban without a CEO-approved permanent_ban signoff', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const result = useStore.getState().setAccountStatus('u-buyer-1', 'banned', 'Non-payment')
      expect(result).toEqual({ ok: false, error: 'A permanent ban needs the CEO\'s signature first — raise it from Blacklist & defaulters' })
    })

    it('allows a banned status once the CEO has approved a matching permanent_ban signoff', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('finance@gmail.com', 'FerroBid@Dev2026')
      const req = useStore.getState().requestCeoSignoff({ kind: 'permanent_ban', refId: 'u-buyer-1', amount: 0, summary: 'Ban a defaulter', reason: 'Non-payment' })!
      useStore.getState().signIn('ceo@gmail.com', 'FerroBid@Dev2026')
      useStore.getState().decideCeoApproval(req.id, true, 'Confirmed')
      useStore.getState().signIn(...SUPER)

      const result = useStore.getState().setAccountStatus('u-buyer-1', 'banned', 'Confirmed pattern of default')
      expect(result).toEqual({ ok: true })
      expect(useStore.getState().users.find((u) => u.id === 'u-buyer-1')!.accountStatus).toBe('banned')
    })

    it('is a no-op when the status is already what it is set to — no structural change, no audit, no notification', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const before = useStore.getState().users.find((u) => u.id === 'u-buyer-1')!.accountStatus ?? 'active'
      const scCountBefore = useStore.getState().structuralChanges.length
      const auditCountBefore = useStore.getState().auditEvents.length

      const result = useStore.getState().setAccountStatus('u-buyer-1', before, 'no change')
      expect(result).toEqual({ ok: true })
      expect(useStore.getState().structuralChanges).toHaveLength(scCountBefore)
      expect(useStore.getState().auditEvents).toHaveLength(auditCountBefore)
    })

    it('suspends an account, records a structural change with no snapshot, audits the before/after, and notifies the account holder', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const scCountBefore = useStore.getState().structuralChanges.length

      const result = useStore.getState().setAccountStatus('u-buyer-1', 'suspended', 'Investigating a dispute')
      expect(result).toEqual({ ok: true })
      expect(useStore.getState().users.find((u) => u.id === 'u-buyer-1')!.accountStatus).toBe('suspended')

      expect(useStore.getState().structuralChanges).toHaveLength(scCountBefore + 1)
      const sc = useStore.getState().structuralChanges[0]
      expect(sc.kind).toBe('account.status')
      expect(sc.summary).toBe('Investigating a dispute')
      expect(sc.snapshot).toBeUndefined()

      const auditRow = useStore.getState().auditEvents[0]
      expect(auditRow).toMatchObject({ action: 'account.status', severity: 'critical' })
      expect(auditRow.detail).toContain('→ suspended — Investigating a dispute')

      const notif = useStore.getState().notifications.find((n) => n.userId === 'u-buyer-1' && n.title === 'Your account has been suspended')
      expect(notif?.body).toBe('Investigating a dispute')
    })

    it('reactivating an account uses the "active again" wording and falls back to the default body with no reason', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      useStore.getState().setAccountStatus('u-buyer-1', 'suspended', 'first')

      const result = useStore.getState().setAccountStatus('u-buyer-1', 'active', undefined)
      expect(result).toEqual({ ok: true })
      const notif = useStore.getState().notifications.find((n) => n.userId === 'u-buyer-1' && n.title === 'Your account is active again')
      expect(notif?.body).toBe('Contact support if you believe this is a mistake.')
    })
  })
})
