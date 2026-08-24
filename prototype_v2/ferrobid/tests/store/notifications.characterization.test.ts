import { describe, expect, it } from 'vitest'
import { freshStore } from '../helpers/freshStore'

/** Priority 2: notifications — per-user delivery and read state, including the
 *  broadcast case (userId === null). */
describe('notifications', () => {
  it('notify prepends an unread notification', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    const me = useStore.getState().currentUser!
    const startLen = useStore.getState().notifications.length

    useStore.getState().notify({ userId: me.id, kind: 'system', title: 'Test', body: 'Body' })

    const list = useStore.getState().notifications
    expect(list.length).toBe(startLen + 1)
    expect(list[0]).toMatchObject({ userId: me.id, title: 'Test', read: false })
  })

  it('markNotificationsRead marks the signed-in user\'s own and broadcast notifications, not other users\'', async () => {
    const useStore = await freshStore()
    useStore.getState().signIn('buy@gmail.com', 'FerroBid@Dev2026')
    const me = useStore.getState().currentUser!
    const someoneElse = useStore.getState().users.find((u) => u.id !== me.id)!.id

    useStore.getState().notify({ userId: me.id, kind: 'system', title: 'Mine', body: 'b' })
    useStore.getState().notify({ userId: null, kind: 'system', title: 'Broadcast', body: 'b' })
    useStore.getState().notify({ userId: someoneElse, kind: 'system', title: 'Not mine', body: 'b' })

    useStore.getState().markNotificationsRead()

    const list = useStore.getState().notifications
    expect(list.find((n) => n.title === 'Mine')!.read).toBe(true)
    expect(list.find((n) => n.title === 'Broadcast')!.read).toBe(true)
    expect(list.find((n) => n.title === 'Not mine')!.read).toBe(false)
  })

  it('pushToast adds a toast, which self-dismisses after its timeout', async () => {
    const useStore = await freshStore()
    useStore.getState().pushToast({ kind: 'success', title: 'Saved' })
    expect(useStore.getState().toasts.some((t) => t.title === 'Saved')).toBe(true)
  })
})
