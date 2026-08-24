import { describe, expect, it } from 'vitest'
import { freshStore } from '../helpers/freshStore'
import { inr } from '../../src/lib/format'

/** Batch DDD refactor — application/use-case extraction of
 *  buyerSlice.requestWithdrawal. No prior test existed for this action, so
 *  this baseline was written first, run green against the pre-extraction
 *  implementation, then re-run unchanged after extraction. */
describe('requestWithdrawal', () => {
  const ALWAYS_OPEN = { days: [0, 1, 2, 3, 4, 5, 6], startHour: 0, startMinute: 0, endHour: 23, endMinute: 59 }
  const NEVER_OPEN = { days: [], startHour: 0, startMinute: 0, endHour: 0, endMinute: 0 }

  const setUp = async (balance: number, accountStatus: 'verified' | 'pending' = 'verified') => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    const me = useStore.getState().currentUser!
    const account = {
      id: 'ba-test-1', userId: me.id, bankName: 'Test Bank', ifsc: 'TEST0001234',
      accountHolderName: me.name, last4: '4321', accountNumberMasked: '•••• •••• 4321',
      status: accountStatus, createdAt: new Date(useStore.getState().now).toISOString(),
    } as const
    useStore.setState((s) => ({
      bankAccounts: [...s.bankAccounts, account],
      wallets: s.wallets.map((w) => (w.userId === me.id ? { ...w, balance, emdLocked: 0 } : w)),
      withdrawalWindow: ALWAYS_OPEN,
    }))
    return { useStore, me, account }
  }

  it('refuses when not signed in', async () => {
    const useStore = await freshStore()
    const result = useStore.getState().requestWithdrawal(1000, 'ba-x')
    expect(result).toEqual({ ok: false, error: 'Sign in to request a withdrawal' })
  })

  it('refuses an unverified or unknown bank account', async () => {
    const { useStore } = await setUp(100_000, 'pending')
    const result = useStore.getState().requestWithdrawal(1000, 'ba-test-1')
    expect(result).toEqual({ ok: false, error: 'Select a verified bank account' })
  })

  it('refuses a non-positive amount', async () => {
    const { useStore } = await setUp(100_000)
    expect(useStore.getState().requestWithdrawal(0, 'ba-test-1')).toEqual({ ok: false, error: 'Enter an amount to withdraw' })
    expect(useStore.getState().requestWithdrawal(-5, 'ba-test-1')).toEqual({ ok: false, error: 'Enter an amount to withdraw' })
  })

  it('refuses when the amount exceeds the wallet balance', async () => {
    const { useStore } = await setUp(1_000)
    const result = useStore.getState().requestWithdrawal(5_000, 'ba-test-1')
    expect(result).toEqual({ ok: false, error: 'Insufficient available balance' })
  })

  it('refuses outside the withdrawal processing window, quoting the next window', async () => {
    const { useStore } = await setUp(100_000)
    useStore.setState({ withdrawalWindow: NEVER_OPEN })
    const result = useStore.getState().requestWithdrawal(5_000, 'ba-test-1')
    expect(result).toEqual({ ok: false, error: 'Outside the withdrawal processing window. Withdrawals are currently disabled.' })
  })

  it('below the second-signature threshold: debits the wallet, ledgers it, audits it, and notifies Finance without the extra sentence', async () => {
    const { useStore, me, account } = await setUp(100_000)
    useStore.setState((s) => ({ financeConfig: { ...s.financeConfig, withdrawalSecondSignatureFrom: 200_000 } }))
    const startAudit = useStore.getState().auditEvents.length
    const startNotif = useStore.getState().notifications.length

    const result = useStore.getState().requestWithdrawal(50_000, account.id)
    expect(result).toEqual({ ok: true })

    const wallet = useStore.getState().wallets.find((w) => w.userId === me.id)!
    expect(wallet.balance).toBe(50_000)
    expect(wallet.ledger[0]).toMatchObject({ type: 'withdraw', amount: -50_000, note: `Withdrawal requested to •••• ${account.last4}` })

    const req = useStore.getState().withdrawalRequests.find((r) => r.ref === wallet.ledger[0].ref)!
    expect(req).toMatchObject({ amount: 50_000, bankAccountId: account.id, status: 'requested' })

    expect(useStore.getState().auditEvents.length).toBe(startAudit + 1)
    expect(useStore.getState().auditEvents[0]).toMatchObject({
      action: 'withdrawal.request', target: req.id,
      detail: `Withdrawal of ${inr(50_000)} requested to •••• ${account.last4}`,
    })

    expect(useStore.getState().notifications.length).toBeGreaterThan(startNotif) // finance_admin role-notify, possibly >1 recipient
    const notif = useStore.getState().notifications.find((n) => {
      const u = useStore.getState().users.find((x) => x.id === n.userId)
      return u?.role === 'finance_admin'
    })!
    expect(notif.title).toBe(`Withdrawal to review — ${inr(50_000)}`)
    expect(notif.body).toBe(`${me.firm} to ${account.bankName} •••• ${account.last4}.`)
    expect(notif.href).toBe('/finance/withdrawals')
  })

  it('at/above the second-signature threshold, appends the second-signature sentence', async () => {
    const { useStore, me, account } = await setUp(1_000_000)
    useStore.setState((s) => ({ financeConfig: { ...s.financeConfig, withdrawalSecondSignatureFrom: 200_000 } }))

    const result = useStore.getState().requestWithdrawal(250_000, account.id)
    expect(result).toEqual({ ok: true })

    const notif = useStore.getState().notifications.find((n) => {
      const u = useStore.getState().users.find((x) => x.id === n.userId)
      return u?.role === 'finance_admin' && n.title === `Withdrawal to review — ${inr(250_000)}`
    })!
    expect(notif.body).toBe(`${me.firm} to ${account.bankName} •••• ${account.last4}. Above the second-signature threshold — a different Finance user must release it.`)
  })
})
