import { uid } from '../../lib/format'
import { apiPost, ApiError } from '../../api/client'
import { planPublishContent, planReturnContent } from '../../application/contentPublishing'
import {
  planAddMasterCategory, planAddMasterUom, planUpsertMasterYard, planSetMasterActive, planRenameMasterEntry, planAddTermsVersion,
} from '../../application/masterData'
import { planUpdateUserDetails } from '../../application/accountDetails'
import { planAddRole, planRemoveRole, planDuplicateRole, planRestoreRole } from '../../application/roleRegistry'
import {
  planRenamePage, planSetPageHidden, planMovePage, planAttachPage, planDetachPage, planAddSubPage,
} from '../../application/pageRegistry'
import { planUndoStructuralChange, planRestoreStructureTo } from '../../application/structuralRollback'
import { fmtStamp, generatePassword, hash } from '../constants'
import type { StoreGet, StoreSet, InternalHelpers } from '../internal'
import type { State } from '../types'
import type { AccountStatus, User } from '../../types'

export const createSuperAdminSlice = (
  set: StoreSet, get: StoreGet, helpers: InternalHelpers,
): Pick<State,
  'addRole' | 'removeRole' | 'duplicateRole' | 'restoreRole' | 'renamePage' | 'setPageHidden' | 'movePage'
  | 'attachPage' | 'detachPage' | 'addSubPage' | 'undoStructuralChange' | 'restoreStructureTo'
  | 'createSubAdmin' | 'setAccountStatus' | 'resetUserPassword'
  | 'publishContent' | 'returnContent'
  | 'addMasterCategory' | 'addMasterUom' | 'upsertMasterYard' | 'setMasterActive' | 'renameMasterEntry' | 'addTermsVersion' | 'updateUserDetails'
> => ({
  /* ------------------- Super Admin — the platform itself -----------------
     Structure, never business data. Everything here is recorded in
     `structuralChanges` with the snapshot that undoes it, which is what lets
     a bad change be reversed in a click instead of an emergency release.
     Auctions, bids, payments and audit entries are deliberately outside that
     snapshot and can never be rolled back. */

  addRole: (input) => {
    const s = get()
    const result = planAddRole(input, { permissionError: helpers.requireSuperAdmin(), roleRegistry: s.roleRegistry, actorId: s.currentUser?.id, now: s.now })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({
      roleRegistry: [...st.roleRegistry, plan.roleRecord],
      pageRegistry: [...st.pageRegistry, ...plan.pages],
    }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true, key: plan.key }
  },

  removeRole: (key, reason) => {
    const s = get()
    const result = planRemoveRole(key, reason, {
      permissionError: helpers.requireSuperAdmin(), role: s.roleRegistry.find((r) => r.key === key),
      liveOwned: helpers.liveAuctionsOwnedBy(key), users: s.users, now: s.now,
    })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({
      roleRegistry: st.roleRegistry.map((r) =>
        r.key === key ? { ...r, status: 'removed' as const, removedAt: plan.removedAt, removedBy: st.currentUser?.id, removedReason: reason } : r),
      // Accounts are suspended, never deleted — the history behind everything
      // they decided has to stay readable.
      users: st.users.map((u) => (u.role === key ? { ...u, accountStatus: 'suspended' as AccountStatus } : u)),
    }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    // Suspension is only real because it stops the sign-in — which means the
    // people it stops have to be told, rather than meeting a locked door.
    for (const n of plan.notifications) {
      get().notify({ userId: n.userId, kind: 'system', title: n.title, body: n.body })
    }
    return { ok: true }
  },

  duplicateRole: (key, label) => {
    const s = get()
    const result = planDuplicateRole(key, label, {
      permissionError: helpers.requireSuperAdmin(), source: s.roleRegistry.find((r) => r.key === key), roleRegistry: s.roleRegistry,
      sourcePages: s.pageRegistry.filter((p) => p.roleKey === key), actorId: s.currentUser?.id, now: s.now,
    })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({
      roleRegistry: [...st.roleRegistry, plan.roleRecord],
      pageRegistry: [...st.pageRegistry, ...plan.pageCopies],
    }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true, key: plan.newKey }
  },

  restoreRole: (key) => {
    const s = get()
    const result = planRestoreRole(key, { permissionError: helpers.requireSuperAdmin(), role: s.roleRegistry.find((r) => r.key === key), users: s.users })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({
      roleRegistry: st.roleRegistry.map((r) =>
        r.key === key ? { ...r, status: 'active' as const, removedAt: undefined, removedBy: undefined, removedReason: undefined } : r),
      users: st.users.map((u) => (u.role === key && u.accountStatus === 'suspended' ? { ...u, accountStatus: 'active' as AccountStatus } : u)),
    }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },

  renamePage: (id, label) => {
    const page = get().pageRegistry.find((p) => p.id === id)
    const result = planRenamePage(id, label, { permissionError: helpers.requireSuperAdmin(), page, roleLabel: page ? helpers.roleLabelFor(page.roleKey) : '' })
    if (!result.ok) return result
    const { plan } = result
    if (!plan.structural) return { ok: true }
    const snapshot = helpers.structureSnapshot()
    set((st) => ({ pageRegistry: st.pageRegistry.map((p) => (p.id === id ? { ...p, label: plan.label } : p)) }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit!.action, plan.audit!.target, plan.audit!.detail, plan.audit!.severity)
    return { ok: true }
  },

  setPageHidden: (id, hidden) => {
    const s = get()
    const page = s.pageRegistry.find((p) => p.id === id)
    const result = planSetPageHidden(id, hidden, {
      permissionError: helpers.requireSuperAdmin(), page, roleLabel: page ? helpers.roleLabelFor(page.roleKey) : '',
      hasLiveCatalogue: s.catalogues.some((c) => c.status === 'live'),
      visibleSiblingCount: page ? s.pageRegistry.filter((p) => p.roleKey === page.roleKey && !p.hidden).length : 0,
    })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({ pageRegistry: st.pageRegistry.map((p) => (p.id === id ? { ...p, hidden } : p)) }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },

  movePage: (id, direction) => {
    const s = get()
    const page = s.pageRegistry.find((p) => p.id === id)
    const result = planMovePage(id, direction, {
      permissionError: helpers.requireSuperAdmin(), page, roleLabel: page ? helpers.roleLabelFor(page.roleKey) : '',
      siblings: page ? s.pageRegistry.filter((p) => p.roleKey === page.roleKey) : [],
    })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({
      pageRegistry: st.pageRegistry.map((p) =>
        p.id === plan.pageId ? { ...p, order: plan.pageOrder } : p.id === plan.otherId ? { ...p, order: plan.otherOrder } : p),
    }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },

  attachPage: (id, roleKey) => {
    const s = get()
    const page = s.pageRegistry.find((p) => p.id === id)
    const target = s.roleRegistry.find((r) => r.key === roleKey && r.status === 'active')
    const result = planAttachPage(id, roleKey, {
      permissionError: helpers.requireSuperAdmin(), page, target, roleLabel: page ? helpers.roleLabelFor(page.roleKey) : '',
      targetPages: s.pageRegistry.filter((p) => p.roleKey === roleKey),
    })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({ pageRegistry: [...st.pageRegistry, plan.record] }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },

  detachPage: (id) => {
    const page = get().pageRegistry.find((p) => p.id === id)
    const result = planDetachPage(id, { permissionError: helpers.requireSuperAdmin(), page, roleLabel: page ? helpers.roleLabelFor(page.roleKey) : '' })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({ pageRegistry: st.pageRegistry.filter((p) => p.id !== id) }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },

  addSubPage: (roleKey, label, to) => {
    const s = get()
    const result = planAddSubPage(roleKey, label, to, {
      permissionError: helpers.requireSuperAdmin(), role: s.roleRegistry.find((r) => r.key === roleKey && r.status === 'active'),
      rolePages: s.pageRegistry.filter((p) => p.roleKey === roleKey),
    })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({ pageRegistry: [...st.pageRegistry, plan.record] }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },

  undoStructuralChange: (id) => {
    const s = get()
    const result = planUndoStructuralChange(id, {
      permissionError: helpers.requireSuperAdmin(), change: s.structuralChanges.find((c) => c.id === id),
      currentSnapshot: helpers.structureSnapshot(), now: s.now,
    })
    if (!result.ok) return result
    const { plan } = result
    set((st) => ({
      ...helpers.applySnapshot(plan.snapshotToApply),
      structuralChanges: st.structuralChanges.map((c) =>
        c.id === plan.changeId ? { ...c, undoneAt: plan.undoneAt, undoneBy: st.currentUser?.id } : c),
    }))
    helpers.recordStructural(plan.newRecord.kind, plan.newRecord.target, plan.newRecord.summary, plan.newRecord.before, plan.newRecord.after, plan.newRecord.snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },

  restoreStructureTo: (id) => {
    const s = get()
    const result = planRestoreStructureTo(id, {
      permissionError: helpers.requireSuperAdmin(), change: s.structuralChanges.find((c) => c.id === id),
      allChanges: s.structuralChanges, currentSnapshot: helpers.structureSnapshot(), fmtStamp, now: s.now,
    })
    if (!result.ok) return result
    const { plan } = result
    const laterIds = new Set(plan.laterChangeIds)
    set((st) => ({
      ...helpers.applySnapshot(plan.snapshotToApply),
      structuralChanges: st.structuralChanges.map((c) =>
        laterIds.has(c.id) ? { ...c, undoneAt: plan.undoneAt, undoneBy: st.currentUser?.id } : c),
    }))
    helpers.recordStructural(plan.newRecord.kind, plan.newRecord.target, plan.newRecord.summary, plan.newRecord.before, plan.newRecord.after, plan.newRecord.snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },

  /* ------------------- Super Admin — people --------------------------- */

  createSubAdmin: (input) => {
    const err = helpers.requireSuperAdmin()
    if (err) return err
    const s = get()
    const name = input.name.trim()
    const username = input.username.trim().toLowerCase()
    if (!name || !username) return { ok: false, error: 'Both a name and a sign-in ID are needed' }
    if (s.users.some((u) => u.username === username || u.email === input.email.trim())) {
      return { ok: false, error: 'Those sign-in details are already in use' }
    }
    const password = generatePassword()
    const id = uid('u-sub')
    const at = new Date(s.now).toISOString()
    const user: User = {
      id, name, firm: 'ferroBid Technologies', phone: input.phone.trim(), email: input.email.trim(),
      role: 'sub_admin', kycStatus: 'verified', sellerVerified: false, standing: 'good',
      city: input.city.trim() || 'Mumbai', gstin: '—', avatarHue: (hash(id) % 360),
      joinedAt: at, bidderId: null, sellerId: null,
      accountStatus: 'active', username, lastActiveAt: at,
    }
    set((st) => ({
      users: [...st.users, user],
      passwordResets: [{ id: uid('pwr'), userId: id, mode: 'auto', password, at, byId: st.currentUser?.id ?? 'system', consumed: false }, ...st.passwordResets],
    }))
    helpers.recordStructural('account.create', name, `Sub Admin account created — ${username}. Every Sub Admin account is identical; work is divided by assignment, not by capability.`, null, username)
    get().audit('account.create', username, `Sub Admin account created for ${name}`, 'critical')
    // The CEO is told, and does not approve it — Part 8.
    const ceo = s.users.find((u) => u.role === 'ceo')
    if (ceo) {
      get().notify({
        userId: ceo.id, kind: 'system', title: 'New Sub Admin account',
        body: `${name} (${username}) now has full operational access.`, href: '/admin/sub-admins',
      })
    }
    return { ok: true, password, userId: id }
  },

  setAccountStatus: (userId, status, reason) => {
    const s = get()
    if (s.role !== 'super_admin' && s.role !== 'sub_admin') return { ok: false, error: 'Accounts are administered by a Sub Admin or a Super Admin' }
    const user = s.users.find((u) => u.id === userId)
    if (!user) return { ok: false, error: 'No such account' }
    if (user.role === 'super_admin' && s.role !== 'super_admin') return { ok: false, error: 'Only another Super Admin can change a Super Admin account' }
    if (status === 'banned') {
      // Part 8 — a permanent ban is executed here but signed by the CEO.
      const signed = s.ceoApprovals.some((a) => a.kind === 'permanent_ban' && a.refId === userId && a.status === 'approved')
      if (!signed) return { ok: false, error: 'A permanent ban needs the CEO\'s signature first — raise it from Blacklist & defaulters' }
    }
    const before = user.accountStatus ?? 'active'
    if (before === status) return { ok: true }
    set((st) => ({ users: st.users.map((u) => (u.id === userId ? { ...u, accountStatus: status } : u)) }))
    helpers.recordStructural('account.status', `${user.name} · ${user.firm}`,
      reason?.trim() || `Account ${status}`, before, status)
    get().audit('account.status', user.name, `${before} → ${status}${reason ? ` — ${reason}` : ''}`, 'critical')
    get().notify({
      userId, kind: 'system',
      title: status === 'active' ? 'Your account is active again' : `Your account has been ${status}`,
      body: reason?.trim() || 'Contact support if you believe this is a mistake.',
    })
    return { ok: true }
  },

  resetUserPassword: async (userId, mode, manualPassword) => {
    const s = get()
    if (s.role !== 'super_admin' && s.role !== 'sub_admin') return { ok: false, error: 'Passwords are reset by a Sub Admin or a Super Admin' }
    const user = s.users.find((u) => u.id === userId)
    if (!user) return { ok: false, error: 'No such account' }
    // A Super Admin's password is only ever reset by another Super Admin.
    if (user.role === 'super_admin' && s.role !== 'super_admin') {
      return { ok: false, error: 'A Super Admin password can only be reset by another Super Admin' }
    }
    const manual = (manualPassword ?? '').trim()
    if (mode === 'manual') {
      if (manual.length < 8) return { ok: false, error: 'A password set by hand needs at least 8 characters' }
      if (!/[A-Z]/.test(manual) || !/[0-9]/.test(manual)) return { ok: false, error: 'Include at least one capital letter and one digit' }
    }

    /* The server sets the real scrypt hash — see issueTemporaryPassword in
       auth.mjs. This used to stop at the local row below and never call it,
       so the password shown here looked issued but could never sign in. */
    let password: string
    try {
      const res = await apiPost<{ temporaryPassword: string }>('/api/auth/reset', {
        userId, password: mode === 'manual' ? manual : undefined,
      })
      password = res.temporaryPassword
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : 'Could not reset the password' }
    }

    const at = new Date(s.now).toISOString()
    set((st) => ({
      passwordResets: [{ id: uid('pwr'), userId, mode, password, at, byId: st.currentUser?.id ?? 'system', consumed: false }, ...st.passwordResets],
    }))
    helpers.recordStructural('account.password_reset', `${user.name} · ${user.firm}`,
      `Password reset ${mode === 'auto' ? 'to a generated password' : 'by hand'}. Shown once; ${user.name.split(' ')[0]} is asked to keep it or set their own at next sign-in.`,
      null, mode)
    get().audit('account.password_reset', user.name, `Password reset (${mode}) for ${user.email}`, 'critical')
    get().notify({
      userId, kind: 'system', title: 'Your password was reset',
      body: 'Support issued a new password. Sign in with it, then keep it or set your own.',
    })
    return { ok: true, password }
  },

  /* ------------- Super Admin — content a Sub Admin drafted ------------ */

  publishContent: (id) => {
    const s = get()
    const draft = s.contentDrafts.find((d) => d.id === id)
    const result = planPublishContent({
      role: s.role, draft,
      ceoSigned: draft ? s.ceoApprovals.some((a) => a.kind === 'content_publish' && a.refId === id && a.status === 'approved') : false,
      now: s.now,
    })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({
      contentDrafts: st.contentDrafts.map((d) =>
        d.id === id ? { ...d, status: 'published' as const, decidedAt: plan.publishedAt, decidedBy: st.currentUser?.id, note: undefined } : d),
    }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    get().notify(plan.notification)
    return { ok: true }
  },

  returnContent: (id, note) => {
    const s = get()
    const draft = s.contentDrafts.find((d) => d.id === id)
    const result = planReturnContent(note, { role: s.role, draft, now: s.now })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({
      contentDrafts: st.contentDrafts.map((d) =>
        d.id === id ? { ...d, status: 'returned' as const, note: note.trim(), decidedAt: plan.decidedAt, decidedBy: st.currentUser?.id } : d),
    }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    get().notify(plan.notification)
    return { ok: true }
  },

  /* ------------------- Super Admin — master data ---------------------- */

  addMasterCategory: (label) => {
    const result = planAddMasterCategory(label, { permissionError: helpers.requireSuperAdmin(), categories: get().masterCategories })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({ masterCategories: [...st.masterCategories, plan.record] }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },

  addMasterUom: (code, label, precision) => {
    const result = planAddMasterUom(code, label, precision, { permissionError: helpers.requireSuperAdmin(), uoms: get().masterUoms })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({ masterUoms: [...st.masterUoms, plan.record] }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },

  upsertMasterYard: (yard) => {
    const existing = yard.id ? get().masterYards.find((y) => y.id === yard.id) : undefined
    const result = planUpsertMasterYard(yard, { permissionError: helpers.requireSuperAdmin(), existing })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({
      masterYards: plan.mode === 'edit'
        ? st.masterYards.map((y) => (y.id === plan.record.id ? plan.record : y))
        : [...st.masterYards, plan.record],
    }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },

  setMasterActive: (kind, id, active) => {
    const s = get()
    const result = planSetMasterActive(kind, id, active, {
      permissionError: helpers.requireSuperAdmin(),
      categories: s.masterCategories, uoms: s.masterUoms, yards: s.masterYards, lots: s.lots, catalogues: s.catalogues,
    })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    if (kind === 'category') set((st) => ({ masterCategories: st.masterCategories.map((c) => (c.key === id ? { ...c, active } : c)) }))
    else if (kind === 'uom') set((st) => ({ masterUoms: st.masterUoms.map((u) => (u.code === id ? { ...u, active } : u)) }))
    else set((st) => ({ masterYards: st.masterYards.map((y) => (y.id === id ? { ...y, active } : y)) }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },

  renameMasterEntry: (kind, id, label) => {
    const s = get()
    const result = planRenameMasterEntry(kind, id, label, { permissionError: helpers.requireSuperAdmin(), categories: s.masterCategories, uoms: s.masterUoms })
    if (!result.ok) return result
    const { plan } = result
    if (!plan.structural) return { ok: true }
    const snapshot = helpers.structureSnapshot()
    if (kind === 'category') set((st) => ({ masterCategories: st.masterCategories.map((c) => (c.key === id ? { ...c, label: plan.label } : c)) }))
    else set((st) => ({ masterUoms: st.masterUoms.map((u) => (u.code === id ? { ...u, label: plan.label } : u)) }))
    /* The slug/code stays put on purpose: every lot already catalogued points
       at it, so a rename changes what a buyer reads, never what a record holds. */
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    if (plan.audit) get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },

  updateUserDetails: (userId, patch) => {
    const s = get()
    const result = planUpdateUserDetails(userId, patch, { role: s.role, currentUserId: s.currentUser?.id, user: s.users.find((u) => u.id === userId), users: s.users })
    if (!result.ok) return result
    const { plan } = result
    if (plan.noop) return { ok: true }
    set((st) => ({
      users: st.users.map((u) => (u.id === userId ? { ...u, ...plan.next } : u)),
      currentUser: st.currentUser?.id === userId ? { ...st.currentUser, ...plan.next } : st.currentUser,
    }))
    /* Recorded, never reversed from Change history: putting a contact detail
       back is a correction of its own, made here, with its own entry. */
    helpers.recordStructural('account.edit', plan.structural!.target, plan.structural!.summary, plan.structural!.before, plan.structural!.after)
    get().audit(plan.audit!.action, plan.audit!.target, plan.audit!.detail, plan.audit!.severity)
    /* Support changed something on someone else's account. They are told what
       changed, which is what makes a wrong correction findable. */
    if (plan.notification) get().notify(plan.notification)
    return { ok: true }
  },

  addTermsVersion: (termsSetId, note) => {
    const result = planAddTermsVersion(termsSetId, note, { permissionError: helpers.requireSuperAdmin(), termsSets: get().termsSets })
    if (!result.ok) return result
    const { plan } = result
    const snapshot = helpers.structureSnapshot()
    set((st) => ({ termsSets: st.termsSets.map((t) => (t.id === termsSetId ? { ...t, version: plan.version } : t)) }))
    helpers.recordStructural(plan.structural.kind, plan.structural.target, plan.structural.summary, plan.structural.before, plan.structural.after, snapshot)
    get().audit(plan.audit.action, plan.audit.target, plan.audit.detail, plan.audit.severity)
    return { ok: true }
  },
})
