/* ---------------------------------------------------------------------------
   Application layer — the per-role page/menu registry (rename, hide/show,
   reorder, attach, detach, add a sub-page). Moved verbatim from
   superAdminSlice.ts; no rule, threshold, or wording changed. Same
   structural-snapshot/permission-error pattern as roleRegistry.ts.
--------------------------------------------------------------------------- */
import { uid } from '../lib/format'
import { isLiveAuctionRoute } from '../store/constants'
import type { PageDef, RoleDef, StructuralChangeKind } from '../types'

export type PermissionError = { ok: false; error: string } | null
type Result<T> = { ok: true; plan: T } | { ok: false; error: string }

export interface StructuralPlan {
  kind: StructuralChangeKind
  target: string
  summary: string
  before: string | null
  after: string | null
}

/* ------------------------------ renamePage ------------------------------ */

export interface RenamePagePlan {
  label: string
  structural: StructuralPlan | null
  audit: { action: string; target: string; detail: string; severity: 'warning' } | null
}

export function planRenamePage(_id: string, label: string, ctx: { permissionError: PermissionError; page: PageDef | undefined; roleLabel: string }): Result<RenamePagePlan> {
  if (ctx.permissionError) return ctx.permissionError
  const page = ctx.page
  if (!page) return { ok: false, error: 'No such page' }
  const next = label.trim()
  if (!next) return { ok: false, error: 'A tab needs a label' }
  if (next.length > 32) return { ok: false, error: 'Keep a tab label under 32 characters — longer ones push the strip into a scroll' }
  if (next === page.label) return { ok: true, plan: { label: next, structural: null, audit: null } }
  return {
    ok: true,
    plan: {
      label: next,
      structural: { kind: 'page.rename', target: `${ctx.roleLabel} · ${page.to}`, summary: 'Menu tab renamed. What the page does is unchanged.', before: page.label, after: next },
      audit: { action: 'page.rename', target: page.to, detail: `${ctx.roleLabel}: "${page.label}" → "${next}"`, severity: 'warning' },
    },
  }
}

/* ------------------------------ setPageHidden ------------------------------ */

export interface SetPageHiddenPlan {
  hidden: boolean
  structural: StructuralPlan
  audit: { action: string; target: string; detail: string; severity: 'warning' }
}

export function planSetPageHidden(_id: string, hidden: boolean, ctx: {
  permissionError: PermissionError
  page: PageDef | undefined
  roleLabel: string
  hasLiveCatalogue: boolean
  visibleSiblingCount: number
}): Result<SetPageHiddenPlan> {
  if (ctx.permissionError) return ctx.permissionError
  const page = ctx.page
  if (!page) return { ok: false, error: 'No such page' }
  if (hidden && page.retained) {
    return { ok: false, error: `${ctx.roleLabel} has to keep "${page.label}" — a role that must retain its record cannot have it hidden` }
  }
  if (hidden && isLiveAuctionRoute(page) && ctx.hasLiveCatalogue) {
    return { ok: false, error: `An auction is live. "${page.label}" is ${ctx.roleLabel}'s route to it and cannot be hidden while it is running.` }
  }
  if (hidden && ctx.visibleSiblingCount <= 1) {
    return { ok: false, error: `That is the last visible page for ${ctx.roleLabel} — hiding it would leave the role with nowhere to go` }
  }
  return {
    ok: true,
    plan: {
      hidden,
      structural: {
        kind: 'page.visibility', target: `${ctx.roleLabel} · ${page.label}`,
        summary: hidden ? 'Hidden from this role\'s menu. The route still exists and the page is unchanged.' : 'Shown on this role\'s menu again.',
        before: hidden ? 'Visible' : 'Hidden', after: hidden ? 'Hidden' : 'Visible',
      },
      audit: { action: 'page.visibility', target: page.to, detail: `${ctx.roleLabel}: "${page.label}" ${hidden ? 'hidden' : 'shown'}`, severity: 'warning' },
    },
  }
}

/* ------------------------------ movePage ------------------------------ */

export interface MovePagePlan {
  pageId: string
  otherId: string
  pageOrder: number
  otherOrder: number
  structural: StructuralPlan
  audit: { action: string; target: string; detail: string; severity: 'info' }
}

export function planMovePage(id: string, direction: -1 | 1, ctx: { permissionError: PermissionError; page: PageDef | undefined; roleLabel: string; siblings: PageDef[] }): Result<MovePagePlan> {
  if (ctx.permissionError) return ctx.permissionError
  const page = ctx.page
  if (!page) return { ok: false, error: 'No such page' }
  const siblings = [...ctx.siblings].sort((a, b) => a.order - b.order)
  const i = siblings.findIndex((p) => p.id === id)
  const j = i + direction
  if (j < 0 || j >= siblings.length) return { ok: false, error: 'Already at the end of the menu' }
  const other = siblings[j]
  return {
    ok: true,
    plan: {
      pageId: page.id, otherId: other.id, pageOrder: other.order, otherOrder: page.order,
      structural: {
        kind: 'page.reorder', target: `${ctx.roleLabel} · ${page.label}`,
        summary: `Moved ${direction === -1 ? 'before' : 'after'} "${other.label}"`,
        before: `position ${i + 1}`, after: `position ${j + 1}`,
      },
      audit: { action: 'page.reorder', target: page.to, detail: `${ctx.roleLabel}: "${page.label}" → position ${j + 1}`, severity: 'info' },
    },
  }
}

/* ------------------------------ attachPage ------------------------------ */

export interface AttachPagePlan {
  record: PageDef
  structural: StructuralPlan
  audit: { action: string; target: string; detail: string; severity: 'warning' }
}

export function planAttachPage(_id: string, roleKey: string, ctx: {
  permissionError: PermissionError
  page: PageDef | undefined
  target: RoleDef | undefined
  roleLabel: string
  targetPages: PageDef[]
}): Result<AttachPagePlan> {
  if (ctx.permissionError) return ctx.permissionError
  const page = ctx.page
  const target = ctx.target
  if (!page || !target) return { ok: false, error: 'Pick a page and an active role' }
  if (page.roleKey === roleKey) return { ok: false, error: `${target.label} already has that page` }
  if (ctx.targetPages.some((p) => p.to === page.to)) {
    return { ok: false, error: `${target.label} already has a tab pointing at ${page.to}` }
  }
  const order = Math.max(-1, ...ctx.targetPages.map((p) => p.order)) + 1
  const record: PageDef = {
    ...page, id: uid('pg'), roleKey, order, builtIn: false, hidden: false,
    inTop: false, inSub: true, retained: undefined, attachedFrom: page.roleKey,
    // The heading belonged to the menu it came from. It lands at the end
    // of the target's strip as a plain tab rather than dragging a stray
    // category across from another role's workflow.
    category: undefined,
  }
  return {
    ok: true,
    plan: {
      record,
      structural: {
        kind: 'page.attach', target: `${target.label} · ${page.label}`,
        summary: `Attached from ${ctx.roleLabel}. One screen, two menus — whoever acts is still named in the audit entry.`,
        before: null, after: target.label,
      },
      audit: { action: 'page.attach', target: page.to, detail: `"${page.label}" attached to ${target.label}`, severity: 'warning' },
    },
  }
}

/* ------------------------------ detachPage ------------------------------ */

export interface DetachPagePlan {
  structural: StructuralPlan
  audit: { action: string; target: string; detail: string; severity: 'warning' }
}

export function planDetachPage(_id: string, ctx: { permissionError: PermissionError; page: PageDef | undefined; roleLabel: string }): Result<DetachPagePlan> {
  if (ctx.permissionError) return ctx.permissionError
  const page = ctx.page
  if (!page) return { ok: false, error: 'No such page' }
  if (page.builtIn) return { ok: false, error: 'That page ships with the role. Hide it instead — detaching is only for pages attached here.' }
  if (page.retained) return { ok: false, error: 'That page is a record this role must retain' }
  return {
    ok: true,
    plan: {
      structural: {
        kind: 'page.detach', target: `${ctx.roleLabel} · ${page.label}`,
        summary: 'Detached from this role\'s menu. The page itself is untouched.',
        before: page.label, after: null,
      },
      audit: { action: 'page.detach', target: page.to, detail: `"${page.label}" detached from ${ctx.roleLabel}`, severity: 'warning' },
    },
  }
}

/* ------------------------------ addSubPage ------------------------------ */

export interface AddSubPagePlan {
  record: PageDef
  structural: StructuralPlan
  audit: { action: string; target: string; detail: string; severity: 'warning' }
}

export function planAddSubPage(roleKey: string, label: string, to: string, ctx: { permissionError: PermissionError; role: RoleDef | undefined; rolePages: PageDef[] }): Result<AddSubPagePlan> {
  if (ctx.permissionError) return ctx.permissionError
  const role = ctx.role
  if (!role) return { ok: false, error: 'Pick an active role' }
  if (!label.trim()) return { ok: false, error: 'The sub-page needs a label' }
  const route = to.trim()
  if (!route.startsWith('/')) return { ok: false, error: 'A route starts with /' }
  if (ctx.rolePages.some((p) => p.to === route)) {
    return { ok: false, error: `${role.label} already has a tab pointing at ${route}` }
  }
  const order = Math.max(-1, ...ctx.rolePages.map((p) => p.order)) + 1
  const record: PageDef = { id: uid('pg'), roleKey, to: route, label: label.trim(), inTop: false, inSub: true, hidden: false, order, builtIn: false }
  return {
    ok: true,
    plan: {
      record,
      structural: { kind: 'page.add', target: `${role.label} · ${label.trim()}`, summary: `Sub-page added, pointing at ${route}`, before: null, after: label.trim() },
      audit: { action: 'page.add', target: route, detail: `Sub-page "${label.trim()}" added to ${role.label}`, severity: 'warning' },
    },
  }
}
