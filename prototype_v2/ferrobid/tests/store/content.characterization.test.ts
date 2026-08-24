import { describe, expect, it } from 'vitest'
import { freshStore } from '../helpers/freshStore'

/** Priority 1 (this store's slice of "CMS"): the content-draft workflow — a
 *  Sub Admin drafts copy, a Super Admin publishes or returns it. This is
 *  distinct from the full CMS block/section system in server/src/api/cms.mjs,
 *  which the frontend reaches through useCmsPage, not through this store. */
describe('content drafts', () => {
  it('submitContentDraft refuses a caller who is not a Sub/Super Admin', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')

    const result = useStore.getState().submitContentDraft({
      page: 'Home', section: 'Hero', before: 'old copy', after: 'new copy', needsCeo: false,
    })
    expect(result.ok).toBe(false)
  })

  it('rejects a typed figure in the copy', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('sub@gmail.com', 'FerroBid@Dev2026')

    const result = useStore.getState().submitContentDraft({
      page: 'Pricing', section: 'Fees', before: 'old', after: 'Commission is 10% of the upside.', needsCeo: true,
    })
    expect(result).toEqual({ ok: false, error: 'Figures cannot be typed into copy — lot counts, rates and fees are read from the system that owns them' })
  })

  it('accepts a valid draft and notifies the Super Admin (and the CEO, when needsCeo)', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('sub@gmail.com', 'FerroBid@Dev2026')
    const startLen = useStore.getState().contentDrafts.length
    const startNotif = useStore.getState().notifications.length

    const result = useStore.getState().submitContentDraft({
      page: 'Help', section: 'FAQ', before: 'old copy', after: 'Updated help copy with no figures in it.', needsCeo: true,
    })
    expect(result).toEqual({ ok: true })

    expect(useStore.getState().contentDrafts.length).toBe(startLen + 1)
    expect(useStore.getState().contentDrafts[0]).toMatchObject({ status: 'submitted', needsCeo: true })
    // Notified: the Super Admin, and (needsCeo) the CEO — at least two new notifications.
    expect(useStore.getState().notifications.length).toBeGreaterThanOrEqual(startNotif + 2)
  })

  it('publishContent refuses anyone who is not a Super Admin', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('sub@gmail.com', 'FerroBid@Dev2026')
    const result0 = useStore.getState().submitContentDraft({
      page: 'Help', section: 'FAQ', before: 'old', after: 'A plain-language update with no figures.', needsCeo: false,
    })
    expect(result0.ok).toBe(true)
    const draftId = useStore.getState().contentDrafts[0].id

    const result = useStore.getState().publishContent(draftId)
    expect(result.ok).toBe(false)
  })

  it('publishContent blocks a needsCeo draft until the CEO has signed', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('sub@gmail.com', 'FerroBid@Dev2026')
    useStore.getState().submitContentDraft({
      page: 'Legal', section: 'Grievance', before: 'old', after: 'Updated grievance copy, no figures.', needsCeo: true,
    })
    const draftId = useStore.getState().contentDrafts[0].id

    useStore.getState().signIn('super@gmail.com', 'FamySys@123')
    const result = useStore.getState().publishContent(draftId)
    expect(result).toEqual({ ok: false, error: 'Pricing and legal copy needs the CEO as well. Send it for signature first.' })
    expect(useStore.getState().contentDrafts.find((d) => d.id === draftId)!.status).toBe('submitted')
  })

  it('publishContent succeeds for a draft that does not need the CEO', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('sub@gmail.com', 'FerroBid@Dev2026')
    useStore.getState().submitContentDraft({
      page: 'Help', section: 'FAQ', before: 'old', after: 'A plain-language update with no figures.', needsCeo: false,
    })
    const draftId = useStore.getState().contentDrafts[0].id

    useStore.getState().signIn('super@gmail.com', 'FamySys@123')
    const result = useStore.getState().publishContent(draftId)
    expect(result).toEqual({ ok: true })
    expect(useStore.getState().contentDrafts.find((d) => d.id === draftId)!.status).toBe('published')
  })
})
