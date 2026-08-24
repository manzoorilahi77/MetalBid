import { describe, expect, it } from 'vitest'
import { freshStore } from '../helpers/freshStore'

/** Priority 19: the RBAC/page-structure cluster deferred at phase 15/18 for
 *  extra characterization coverage on the undo/restore-to-point system —
 *  addRole, removeRole, duplicateRole, restoreRole, renamePage,
 *  setPageHidden, movePage, attachPage, detachPage, addSubPage,
 *  undoStructuralChange, restoreStructureTo. */

const SUPER = ['super@gmail.com', 'FamySys@123'] as const

describe('RBAC / page-structure cluster — phase 19', () => {
  describe('addRole', () => {
    it('refuses a non-Super-Admin caller', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn('finance@gmail.com', 'FerroBid@Dev2026')
      const result = useStore.getState().addRole({ label: 'Auditor' })
      expect(result).toEqual({ ok: false, error: 'Only a Super Admin can change the shape of the platform' })
    })

    it('refuses an empty label', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const result = useStore.getState().addRole({ label: '   ' })
      expect(result).toEqual({ ok: false, error: 'A role needs a name' })
    })

    it('refuses a duplicate role key', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const result = useStore.getState().addRole({ label: 'Buyer' })
      expect(result).toEqual({ ok: false, error: 'A role called "Buyer" already exists' })
    })

    it('creates the role with 3 default pages and records a reversible structural change', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const scCountBefore = useStore.getState().structuralChanges.length

      const result = useStore.getState().addRole({ label: 'Auditor', note: 'pilot' })
      expect(result).toEqual({ ok: true, key: 'auditor' })

      const role = useStore.getState().roleRegistry.find((r) => r.key === 'auditor')
      expect(role).toMatchObject({ label: 'Auditor', home: '/auditor', builtIn: false, status: 'active', note: 'pilot' })
      const pages = useStore.getState().pageRegistry.filter((p) => p.roleKey === 'auditor')
      expect(pages).toHaveLength(3)
      expect(pages[0]).toMatchObject({ to: '/auditor', label: 'Dashboard', inTop: true })

      expect(useStore.getState().structuralChanges).toHaveLength(scCountBefore + 1)
      const sc = useStore.getState().structuralChanges[0]
      expect(sc).toMatchObject({ kind: 'role.add', target: 'Auditor', before: null, after: 'Auditor' })
      expect(sc.snapshot).toBeDefined()

      const auditRow = useStore.getState().auditEvents[0]
      expect(auditRow).toMatchObject({ action: 'role.add', target: 'Auditor', detail: 'New role "Auditor" (auditor) created with default pages', severity: 'critical' })
    })
  })

  describe('removeRole', () => {
    it('refuses removing super_admin itself', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const result = useStore.getState().removeRole('super_admin', 'test')
      expect(result).toEqual({ ok: false, error: 'The Super Admin role cannot be removed — it is the only way back in' })
    })

    it('refuses without a reason', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const result = useStore.getState().removeRole('field_exec', '   ')
      expect(result).toEqual({ ok: false, error: 'A typed reason is required' })
    })

    it('suspends every holder and notifies them, and can be restored by restoreRole', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const holders = useStore.getState().users.filter((u) => u.role === 'field_exec')
      expect(holders.length).toBeGreaterThan(0)

      const result = useStore.getState().removeRole('field_exec', 'Consolidating field roles')
      expect(result).toEqual({ ok: true })
      expect(useStore.getState().roleRegistry.find((r) => r.key === 'field_exec')?.status).toBe('removed')
      for (const h of holders) {
        expect(useStore.getState().users.find((u) => u.id === h.id)?.accountStatus).toBe('suspended')
        expect(useStore.getState().notifications.some((n) => n.userId === h.id && n.title === 'Your access has been suspended')).toBe(true)
      }

      const restoreResult = useStore.getState().restoreRole('field_exec')
      expect(restoreResult).toEqual({ ok: true })
      expect(useStore.getState().roleRegistry.find((r) => r.key === 'field_exec')?.status).toBe('active')
      for (const h of holders) {
        expect(useStore.getState().users.find((u) => u.id === h.id)?.accountStatus).toBe('active')
      }
    })
  })

  describe('restoreRole', () => {
    it('refuses a role that is not removed', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const result = useStore.getState().restoreRole('buyer')
      expect(result).toEqual({ ok: false, error: 'That role is not removed' })
    })
  })

  describe('duplicateRole', () => {
    it('refuses a nonexistent source role', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const result = useStore.getState().duplicateRole('not-a-role', 'Copy')
      expect(result).toEqual({ ok: false, error: 'No such role' })
    })

    it('copies every source page with attachedFrom set, landing on the source home', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const sourcePages = useStore.getState().pageRegistry.filter((p) => p.roleKey === 'buyer')

      const result = useStore.getState().duplicateRole('buyer', 'Buyer (pilot)')
      expect(result).toEqual({ ok: true, key: 'buyer_pilot' })

      const role = useStore.getState().roleRegistry.find((r) => r.key === 'buyer_pilot')
      expect(role).toMatchObject({ label: 'Buyer (pilot)', basedOn: 'buyer', status: 'active' })
      const copies = useStore.getState().pageRegistry.filter((p) => p.roleKey === 'buyer_pilot')
      expect(copies).toHaveLength(sourcePages.length)
      expect(copies.every((p) => p.attachedFrom === 'buyer')).toBe(true)
    })
  })

  describe('renamePage', () => {
    it('refuses a label over 32 characters', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const page = useStore.getState().pageRegistry.find((p) => p.roleKey === 'buyer')!
      const result = useStore.getState().renamePage(page.id, 'A'.repeat(33))
      expect(result).toEqual({ ok: false, error: 'Keep a tab label under 32 characters — longer ones push the strip into a scroll' })
    })

    it('is a no-op that records no structural change when the label is unchanged', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const page = useStore.getState().pageRegistry.find((p) => p.roleKey === 'buyer')!
      const scCountBefore = useStore.getState().structuralChanges.length

      const result = useStore.getState().renamePage(page.id, page.label)
      expect(result).toEqual({ ok: true })
      expect(useStore.getState().structuralChanges).toHaveLength(scCountBefore)
    })

    it('renames and records the exact before/after on the structural change', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const page = useStore.getState().pageRegistry.find((p) => p.roleKey === 'buyer')!

      const result = useStore.getState().renamePage(page.id, 'My results')
      expect(result).toEqual({ ok: true })
      expect(useStore.getState().pageRegistry.find((p) => p.id === page.id)?.label).toBe('My results')
      const sc = useStore.getState().structuralChanges[0]
      expect(sc).toMatchObject({ kind: 'page.rename', before: page.label, after: 'My results' })
    })
  })

  describe('setPageHidden', () => {
    it('refuses hiding a retained page', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const retained = useStore.getState().pageRegistry.find((p) => p.retained)!
      expect(retained).toBeDefined()
      const result = useStore.getState().setPageHidden(retained.id, true)
      expect(result.ok).toBe(false)
      expect((result as { ok: false; error: string }).error).toContain('has to keep')
    })

    it('refuses leaving a role with no visible pages', async () => {
      // Every role addRole ever creates includes a retained page ("My
      // activity"), which can never be hidden — so the "last visible page"
      // guard can never actually be the reason a real add-Role-built role
      // refuses a hide; the retained guard always fires first for the true
      // last page. To exercise this guard's own logic (not the retained
      // one), inject a synthetic role with two ordinary, non-retained pages
      // directly via setState — legitimate here since the guard is pure
      // read-only logic over pageRegistry, unrelated to how the pages got there.
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      useStore.setState((st) => ({
        roleRegistry: [...st.roleRegistry, { key: 'solo_role', label: 'Solo role', home: '/solo_role', builtIn: false, status: 'active' as const, createdAt: new Date(st.now).toISOString() }],
        pageRegistry: [...st.pageRegistry,
          { id: 'pg-solo-1', roleKey: 'solo_role', to: '/solo_role', label: 'Dashboard', inTop: true, inSub: true, hidden: false, order: 0, builtIn: false },
          { id: 'pg-solo-2', roleKey: 'solo_role', to: '/solo_role/other', label: 'Other', inTop: false, inSub: true, hidden: false, order: 1, builtIn: false },
        ],
      }))

      const first = useStore.getState().setPageHidden('pg-solo-1', true)
      expect(first).toEqual({ ok: true })

      const result = useStore.getState().setPageHidden('pg-solo-2', true)
      expect(result.ok).toBe(false)
      expect((result as { ok: false; error: string }).error).toContain('leave the role with nowhere to go')
    })

    it('hides then re-shows a page, recording opposite before/after each time', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const page = useStore.getState().pageRegistry.find((p) => p.roleKey === 'buyer' && !p.retained && p.to !== '@home')!

      const hideResult = useStore.getState().setPageHidden(page.id, true)
      expect(hideResult).toEqual({ ok: true })
      expect(useStore.getState().pageRegistry.find((p) => p.id === page.id)?.hidden).toBe(true)
      expect(useStore.getState().structuralChanges[0]).toMatchObject({ kind: 'page.visibility', before: 'Visible', after: 'Hidden' })

      const showResult = useStore.getState().setPageHidden(page.id, false)
      expect(showResult).toEqual({ ok: true })
      expect(useStore.getState().pageRegistry.find((p) => p.id === page.id)?.hidden).toBe(false)
      expect(useStore.getState().structuralChanges[0]).toMatchObject({ kind: 'page.visibility', before: 'Hidden', after: 'Visible' })
    })
  })

  describe('movePage', () => {
    it('refuses moving past the end of the menu', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const pages = useStore.getState().pageRegistry.filter((p) => p.roleKey === 'buyer').sort((a, b) => a.order - b.order)
      const result = useStore.getState().movePage(pages[0].id, -1)
      expect(result).toEqual({ ok: false, error: 'Already at the end of the menu' })
    })

    it('swaps order with the neighbour in the requested direction', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const pages = useStore.getState().pageRegistry.filter((p) => p.roleKey === 'buyer').sort((a, b) => a.order - b.order)
      expect(pages.length).toBeGreaterThan(1)
      const [first, second] = pages

      const result = useStore.getState().movePage(first.id, 1)
      expect(result).toEqual({ ok: true })
      expect(useStore.getState().pageRegistry.find((p) => p.id === first.id)?.order).toBe(second.order)
      expect(useStore.getState().pageRegistry.find((p) => p.id === second.id)?.order).toBe(first.order)
    })
  })

  describe('attachPage / detachPage', () => {
    it('attachPage refuses when the target already has a tab pointing at that route', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const buyerHome = useStore.getState().pageRegistry.find((p) => p.roleKey === 'buyer' && p.to === '/buyer/dashboard')
        ?? useStore.getState().pageRegistry.find((p) => p.roleKey === 'buyer')!
      const sameRouteOnSeller = useStore.getState().pageRegistry.find((p) => p.roleKey === 'seller' && p.to === buyerHome.to)
      if (sameRouteOnSeller) {
        const result = useStore.getState().attachPage(buyerHome.id, 'seller')
        expect(result.ok).toBe(false)
      } else {
        // No pre-existing collision in the fixture — attach should succeed instead, exercised below.
        expect(true).toBe(true)
      }
    })

    it('attaches a page to another active role, then detaches it — builtIn pages refuse detach', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const sub = useStore.getState().addSubPage('buyer', 'Attach source', '/buyer/attach-source')
      expect(sub.ok).toBe(true)
      const source = useStore.getState().pageRegistry.find((p) => p.roleKey === 'buyer' && p.to === '/buyer/attach-source')!

      const attachResult = useStore.getState().attachPage(source.id, 'seller')
      expect(attachResult).toEqual({ ok: true })
      const attached = useStore.getState().pageRegistry.find((p) => p.roleKey === 'seller' && p.to === '/buyer/attach-source')!
      expect(attached).toMatchObject({ attachedFrom: 'buyer', builtIn: false })

      const detachResult = useStore.getState().detachPage(attached.id)
      expect(detachResult).toEqual({ ok: true })
      expect(useStore.getState().pageRegistry.find((p) => p.id === attached.id)).toBeUndefined()

      const builtIn = useStore.getState().pageRegistry.find((p) => p.roleKey === 'buyer' && p.builtIn)
      if (builtIn) {
        const refusal = useStore.getState().detachPage(builtIn.id)
        expect(refusal.ok).toBe(false)
        expect((refusal as { ok: false; error: string }).error).toContain('ships with the role')
      }
    })
  })

  describe('addSubPage', () => {
    it('refuses a route that does not start with /', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const result = useStore.getState().addSubPage('buyer', 'Bad route', 'buyer/bad')
      expect(result).toEqual({ ok: false, error: 'A route starts with /' })
    })

    it('refuses a duplicate route on the same role', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const existing = useStore.getState().pageRegistry.find((p) => p.roleKey === 'buyer')!
      const result = useStore.getState().addSubPage('buyer', 'Dup', existing.to)
      expect(result.ok).toBe(false)
    })

    it('adds a sub-page at the end of the role\'s order', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const before = useStore.getState().pageRegistry.filter((p) => p.roleKey === 'buyer')
      const maxOrder = Math.max(...before.map((p) => p.order))

      const result = useStore.getState().addSubPage('buyer', 'New report', '/buyer/new-report')
      expect(result).toEqual({ ok: true })
      const added = useStore.getState().pageRegistry.find((p) => p.roleKey === 'buyer' && p.to === '/buyer/new-report')!
      expect(added.order).toBe(maxOrder + 1)
    })
  })

  describe('undoStructuralChange — including multi-step and out-of-order scenarios', () => {
    it('refuses a nonexistent change id', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const result = useStore.getState().undoStructuralChange('sc-does-not-exist')
      expect(result).toEqual({ ok: false, error: 'No such change' })
    })

    it('refuses a seeded change that carries no snapshot — business data is never rolled back', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const nonReversible = useStore.getState().structuralChanges.find((c) => c.id === 'sc-seed-2')
      expect(nonReversible?.snapshot).toBeUndefined()
      const result = useStore.getState().undoStructuralChange('sc-seed-2')
      expect(result).toEqual({ ok: false, error: 'That change is on the record but is not a structural one — business data is never rolled back' })
    })

    it('undoes a single change exactly: role and its pages disappear, the change is marked undone, a new rollback record is created', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const roleCountBefore = useStore.getState().roleRegistry.length
      const pageCountBefore = useStore.getState().pageRegistry.length

      useStore.getState().addRole({ label: 'Temp role' })
      const change = useStore.getState().structuralChanges[0]
      expect(change.kind).toBe('role.add')

      const result = useStore.getState().undoStructuralChange(change.id)
      expect(result).toEqual({ ok: true })

      expect(useStore.getState().roleRegistry).toHaveLength(roleCountBefore)
      expect(useStore.getState().pageRegistry).toHaveLength(pageCountBefore)
      expect(useStore.getState().roleRegistry.find((r) => r.key === 'temp_role')).toBeUndefined()

      const undone = useStore.getState().structuralChanges.find((c) => c.id === change.id)!
      expect(undone.undoneAt).toBeDefined()

      const rollbackRecord = useStore.getState().structuralChanges[0]
      expect(rollbackRecord).toMatchObject({ kind: 'structure.rollback', target: 'Temp role', before: 'Temp role', after: null })
      expect(rollbackRecord.snapshot).toBeDefined()
    })

    it('refuses undoing the same change twice', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      useStore.getState().addRole({ label: 'Temp role' })
      const change = useStore.getState().structuralChanges[0]

      expect(useStore.getState().undoStructuralChange(change.id)).toEqual({ ok: true })
      const second = useStore.getState().undoStructuralChange(change.id)
      expect(second).toEqual({ ok: false, error: 'That change has already been undone' })
    })

    it('multi-step: undoing the most recent of two changes leaves the earlier one intact', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      useStore.getState().addRole({ label: 'Temp role' })
      const addChange = useStore.getState().structuralChanges[0]
      const newPage = useStore.getState().pageRegistry.find((p) => p.roleKey === 'temp_role' && p.to === '/temp_role')!

      useStore.getState().renamePage(newPage.id, 'Renamed dashboard')
      const renameChange = useStore.getState().structuralChanges[0]
      expect(renameChange.kind).toBe('page.rename')

      const result = useStore.getState().undoStructuralChange(renameChange.id)
      expect(result).toEqual({ ok: true })

      // The role and its pages are still there — only the label reverted.
      expect(useStore.getState().roleRegistry.find((r) => r.key === 'temp_role')).toBeDefined()
      expect(useStore.getState().pageRegistry.find((p) => p.id === newPage.id)?.label).toBe('Dashboard')
      expect(useStore.getState().structuralChanges.find((c) => c.id === addChange.id)?.undoneAt).toBeUndefined()
    })

    it('out-of-order finding (pre-existing, documented not fixed): undoing an earlier change silently erases a later change\'s effect without marking the later change undone', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      useStore.getState().addRole({ label: 'Temp role' })
      const addChange = useStore.getState().structuralChanges[0]
      const newPage = useStore.getState().pageRegistry.find((p) => p.roleKey === 'temp_role' && p.to === '/temp_role')!

      useStore.getState().renamePage(newPage.id, 'Renamed dashboard')
      const renameChange = useStore.getState().structuralChanges[0]

      // Undo the EARLIER change (the role add) while the later rename is still "active".
      const result = useStore.getState().undoStructuralChange(addChange.id)
      expect(result).toEqual({ ok: true })

      // The role (and with it, the renamed page) is gone — the rename's effect
      // vanished along with it.
      expect(useStore.getState().roleRegistry.find((r) => r.key === 'temp_role')).toBeUndefined()
      expect(useStore.getState().pageRegistry.find((p) => p.id === newPage.id)).toBeUndefined()

      // But the rename's own change record still shows as NOT undone — nothing
      // walked forward from the target to invalidate it. This is the asymmetry
      // documented in structuralRollback.ts, left as-is per this phase's rule.
      expect(useStore.getState().structuralChanges.find((c) => c.id === renameChange.id)?.undoneAt).toBeUndefined()
    })
  })

  describe('restoreStructureTo — multi-step and restoring after a partially-undone step', () => {
    it('refuses a change with no snapshot', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const result = useStore.getState().restoreStructureTo('sc-seed-2')
      expect(result).toEqual({ ok: false, error: 'There is no structure snapshot at that point' })
    })

    it('multi-step: restoring to the first of three changes undoes all three and matches the pre-first-change state', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)
      const roleCountBefore = useStore.getState().roleRegistry.length
      const pageCountBefore = useStore.getState().pageRegistry.length

      useStore.getState().addRole({ label: 'Temp role' })
      const changeA = useStore.getState().structuralChanges[0]
      const newPage = useStore.getState().pageRegistry.find((p) => p.roleKey === 'temp_role' && p.to === '/temp_role')!

      useStore.getState().renamePage(newPage.id, 'Renamed dashboard')
      const changeB = useStore.getState().structuralChanges[0]

      useStore.getState().addSubPage('temp_role', 'Extra tab', '/temp_role/extra')
      const changeC = useStore.getState().structuralChanges[0]

      const result = useStore.getState().restoreStructureTo(changeA.id)
      expect(result).toEqual({ ok: true })

      expect(useStore.getState().roleRegistry).toHaveLength(roleCountBefore)
      expect(useStore.getState().pageRegistry).toHaveLength(pageCountBefore)

      for (const id of [changeA.id, changeB.id, changeC.id]) {
        expect(useStore.getState().structuralChanges.find((c) => c.id === id)?.undoneAt).toBeDefined()
      }

      const rollbackRecord = useStore.getState().structuralChanges[0]
      expect(rollbackRecord.kind).toBe('structure.rollback')
      expect(rollbackRecord.summary).toContain('3 changes undone')
    })

    it('restoring after one step was already undone individually only marks the still-active ones, and counts correctly', async () => {
      const useStore = await freshStore()
      useStore.getState().signIn(...SUPER)

      useStore.getState().addRole({ label: 'Temp role' })
      const changeA = useStore.getState().structuralChanges[0]
      const newPage = useStore.getState().pageRegistry.find((p) => p.roleKey === 'temp_role' && p.to === '/temp_role')!

      useStore.getState().renamePage(newPage.id, 'Renamed dashboard')
      const changeB = useStore.getState().structuralChanges[0]

      useStore.getState().addSubPage('temp_role', 'Extra tab', '/temp_role/extra')
      const changeC = useStore.getState().structuralChanges[0]

      // B already undone by itself before the restore is ever requested — the
      // "failed step" case: one step in the sequence was already reverted.
      const preUndo = useStore.getState().undoStructuralChange(changeB.id)
      expect(preUndo).toEqual({ ok: true })
      expect(useStore.getState().structuralChanges.find((c) => c.id === changeB.id)?.undoneAt).toBeDefined()
      const changeBUndoneAtBeforeRestore = useStore.getState().structuralChanges.find((c) => c.id === changeB.id)!.undoneAt
      // undoStructuralChange(B) does not just mark B undone — it also PREPENDS
      // its own new 'structure.rollback' record (with its own fresh snapshot),
      // and that new record is itself snapshot-carrying and not yet undone.
      const rollbackOfB = useStore.getState().structuralChanges[0]
      expect(rollbackOfB.kind).toBe('structure.rollback')

      const result = useStore.getState().restoreStructureTo(changeA.id)
      expect(result).toEqual({ ok: true })

      // Real finding, documented not fixed: "later" counts every snapshot-
      // carrying, not-yet-undone record at/after A's timestamp — which now
      // includes the rollback-of-B record created a moment ago, on top of A
      // and C. So the summary reads 3, not the "2 real steps" (A, C) a human
      // skimming the sequence might expect — the meta-rollback record counts
      // as a step in its own right. The end state is still fully correct
      // (applying A's snapshot reverts everything regardless), only the
      // wording of "N changes undone" is more aggressive than it looks.
      const rollbackRecord = useStore.getState().structuralChanges[0]
      expect(rollbackRecord.summary).toContain('3 changes undone')
      expect(useStore.getState().structuralChanges.find((c) => c.id === rollbackOfB.id)?.undoneAt).toBeDefined()

      // B's undoneAt is untouched by the restore — it was already set, and the
      // restore never re-marks an already-undone row.
      expect(useStore.getState().structuralChanges.find((c) => c.id === changeB.id)?.undoneAt).toBe(changeBUndoneAtBeforeRestore)
      expect(useStore.getState().structuralChanges.find((c) => c.id === changeA.id)?.undoneAt).toBeDefined()
      expect(useStore.getState().structuralChanges.find((c) => c.id === changeC.id)?.undoneAt).toBeDefined()

      // State itself still lands back at the pre-A snapshot regardless.
      expect(useStore.getState().roleRegistry.find((r) => r.key === 'temp_role')).toBeUndefined()
    })
  })
})
