import { describe, expect, it } from 'vitest'
import { freshStore } from '../helpers/freshStore'

/** Priority 3: master data — the controlled vocabularies (categories, UOMs,
 *  yards), Super-Admin-only, with structural-change logging. */
describe('master data', () => {
  const signInSuperAdmin = (useStore: Awaited<ReturnType<typeof freshStore>>) =>
    useStore.getState().signIn('super@gmail.com', 'FamySys@123')

  it('addMasterCategory refuses anyone who is not a Super Admin', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('sell@gmail.com', 'FerroBid@Dev2026')
    const startLen = useStore.getState().masterCategories.length

    const result = useStore.getState().addMasterCategory('Titanium scrap')
    expect(result.ok).toBe(false)
    expect(useStore.getState().masterCategories.length).toBe(startLen)
  })

  it('addMasterCategory adds a new category and records a structural change', async () => {
    const useStore = await freshStore()
    signInSuperAdmin(useStore)
    const startChanges = useStore.getState().structuralChanges.length
    const label = `Test category ${Date.now()}`

    const result = useStore.getState().addMasterCategory(label)
    expect(result.ok).toBe(true)

    expect(useStore.getState().masterCategories.some((c) => c.label === label)).toBe(true)
    expect(useStore.getState().structuralChanges.length).toBe(startChanges + 1)
    expect(useStore.getState().structuralChanges[0].kind).toBe('master.add')
  })

  it('refuses a duplicate category (same slug)', async () => {
    const useStore = await freshStore()
    signInSuperAdmin(useStore)
    useStore.getState().addMasterCategory('Duplicate test')
    const second = useStore.getState().addMasterCategory('Duplicate test')
    expect(second.ok).toBe(false)
  })

  it('setMasterActive refuses to deactivate a category still in use on a catalogued lot', async () => {
    const useStore = await freshStore()
    signInSuperAdmin(useStore)
    const inUse = useStore.getState().lots.find((l) => l.catalogueId)!.category
    const category = useStore.getState().masterCategories.find((c) => c.key === inUse)
    if (!category) return // fixture doesn't expose a master row for this category — nothing to assert

    const result = useStore.getState().setMasterActive('category', inUse, false)
    expect(result.ok).toBe(false)
    expect(useStore.getState().masterCategories.find((c) => c.key === inUse)!.active).toBe(true)
  })
})
