import { describe, expect, it } from 'vitest'
import { freshStore } from '../helpers/freshStore'

/** Priority 0 (foundation for every other suite): session / sign-in. */
describe('session', () => {
  it('signs a demo account in with the shared demo password', async () => {
    const useStore = await freshStore()
    const result = useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    expect(result).toEqual({ ok: true, role: 'buyer' })
    expect(useStore.getState().currentUser?.id).toBe('u-buyer-1')
    expect(useStore.getState().role).toBe('buyer')
  })

  it('rejects the wrong password without revealing anything else', async () => {
    const useStore = await freshStore()
    const result = useStore.getState().signIn('buy@gmail.com', 'wrong-password')
    expect(result).toEqual({ ok: false, error: 'Incorrect password' })
    expect(useStore.getState().currentUser).toBeNull()
  })

  it('rejects an unknown account', async () => {
    const useStore = await freshStore()
    const result = useStore.getState().signIn('nobody@example.com', 'anything')
    expect(result).toEqual({ ok: false, error: 'Unknown user ID' })
  })

  it('refuses super_admin by its own seeded email — only break-glass opens it', async () => {
    const useStore = await freshStore()
    // u-super-1's own email, not the break-glass id — must read exactly like an
    // unregistered email, per the store's own comment on this branch.
    const superUser = useStore.getState().users.find((u) => u.role === 'super_admin')
    expect(superUser).toBeTruthy()
    expect(superUser!.email).toBeTruthy()
    const result = useStore.getState().signIn(superUser!.email, 'FerroBid@Dev2026')
    expect(result).toEqual({ ok: false, error: 'Unknown user ID' })
  })

  it('signs super_admin in only through the break-glass pair', async () => {
    const useStore = await freshStore()
    const wrong = useStore.getState().signIn('super@gmail.com', 'wrong')
    expect(wrong).toEqual({ ok: false, error: 'Unknown user ID' })

    const right = useStore.getState().signIn('super@gmail.com', 'FamySys@123')
    expect(right.ok).toBe(true)
    expect(right.role).toBe('super_admin')
    expect(useStore.getState().currentUser?.id).toBeTruthy()
  })

  it('switchRole changes which workspace is shown but never fabricates an identity', async () => {
    const useStore = await freshStore()
    // Nobody is signed in yet.
    expect(useStore.getState().currentUser).toBeNull()
    useStore.getState().switchRole('buyer')
    // The role used for nav/routing changes...
    expect(useStore.getState().role).toBe('buyer')
    // ...but currentUser stays null: switching the visible workspace is not signing in.
    expect(useStore.getState().currentUser).toBeNull()

    // Once actually signed in, switching role again does not change who is signed in.
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    const signedInId = useStore.getState().currentUser?.id
    useStore.getState().switchRole('seller')
    expect(useStore.getState().role).toBe('seller')
    expect(useStore.getState().currentUser?.id).toBe(signedInId)
  })
})
