import { describe, expect, it } from 'vitest'
import { freshStore } from '../helpers/freshStore'

/** Phase 29 — the shared authorization module (application/authorization.ts)
 *  consolidates every ad hoc role check found across the codebase. Most
 *  already had a wrong-role test somewhere; these four had none before this
 *  phase (grepped for their exact error string across tests/, zero hits) —
 *  closing that gap rather than leaving it uncovered by the consolidation
 *  the same way Phase 28 closed gaps it found while centralizing. Each
 *  action's role check runs before any record lookup, so a placeholder id
 *  is enough to isolate the role dimension. */
describe('authorization — Phase 29 previously-uncovered wrong-role cases', () => {
  const signInBuyer = (useStore: Awaited<ReturnType<typeof freshStore>>) =>
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')

  it('confirmBuyerPayment refuses a caller who is not Finance', async () => {
    const useStore = await freshStore()
    signInBuyer(useStore)

    const result = useStore.getState().confirmBuyerPayment('do-does-not-matter', 'NEFT', 'UTR-1')
    expect(result).toEqual({ ok: false, error: 'Only Finance can confirm a receipt' })
  })

  it('processRefund refuses a caller who is not Finance', async () => {
    const useStore = await freshStore()
    signInBuyer(useStore)

    const result = useStore.getState().processRefund('refund-does-not-matter')
    expect(result).toEqual({ ok: false, error: 'Only Finance can process a refund' })
  })

  it('claimWorkItem refuses a caller who is not a Sub Admin', async () => {
    const useStore = await freshStore()
    signInBuyer(useStore)

    const result = useStore.getState().claimWorkItem('item-does-not-matter')
    expect(result).toEqual({ ok: false, error: 'Only a Sub Admin claims from this board' })
  })

  it('submitContentDraft refuses a caller who is not a Sub Admin', async () => {
    const useStore = await freshStore()
    signInBuyer(useStore)

    const result = useStore.getState().submitContentDraft({ page: '/faqs', section: 'intro', before: '', after: 'New copy', needsCeo: false })
    expect(result).toEqual({ ok: false, error: 'Only a Sub Admin drafts platform copy' })
  })
})
