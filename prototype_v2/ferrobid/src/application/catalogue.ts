/* ---------------------------------------------------------------------------
   Application layer — publishing a catalogue off the Operations desk. Moved
   verbatim from opsSlice.ts's publishDraftCatalogue; no rule, threshold,
   wording, or recipient changed. See opsInspection.ts for the pattern.
--------------------------------------------------------------------------- */
import { defaultEmdDeadline } from '../lib/emd'
import { catalogueReserveValue } from '../lib/money'
import { inr } from '../lib/format'
import { LOT_GATE_ROLES, PUBLISH_ROLES } from '../store/constants'
import type { Catalogue, CeoApprovalRequest, Lot, LotOverride, LotStatus, Role, User } from '../types'
import type { NotificationPlan } from './opsInspection'

export type PublishMode = 'now' | 'schedule'

export interface PublishDraftCatalogueContext {
  role: Role
  catalogue: Catalogue | undefined
  catalogueLots: Lot[]
  ceoPublishValueFrom: number
  ceoApprovals: CeoApprovalRequest[]
  now: number
}

export interface PublishDraftCataloguePlan {
  catalogueId: string
  catalogueStatus: 'live' | 'upcoming'
  startsAt: string
  endsAt: string
  emdOpensAt: string | undefined
  emdDeadline: string
  lotStatus: LotStatus
  audit: { action: string; target: string; detail: string }
  broadcastNotification: NotificationPlan & { userId: null }
  roleNotification: NotificationPlan
  sellerNotification: (NotificationPlan & { userId: string }) | null
}

export type PublishDraftCatalogueResult =
  | { ok: true; plan: PublishDraftCataloguePlan }
  | { ok: false; error: string }

export function planPublishDraftCatalogue(
  catalogueId: string,
  mode: PublishMode,
  ctx: PublishDraftCatalogueContext,
): PublishDraftCatalogueResult {
  // The publish gate is a state boundary, not a role boundary: four roles
  // may press it, and whoever does is named in the audit entry.
  if (!PUBLISH_ROLES.includes(ctx.role)) return { ok: false, error: 'Not permitted for this role' }
  const cat = ctx.catalogue
  if (!cat) return { ok: false, error: 'Catalogue not found' }
  const catLots = ctx.catalogueLots
  const unresolved = catLots.filter((l) => l.status !== 'approved')
  if (unresolved.length > 0) {
    return { ok: false, error: `${unresolved.length} lot${unresolved.length > 1 ? 's' : ''} still need${unresolved.length > 1 ? '' : 's'} approval` }
  }
  /* The CEO threshold is a rule about the sale, not about the button that
     starts it — so it is enforced here rather than only by a disabled
     control on one screen. Anything at or above the configured value stays
     private until a signature is on record. */
  const reserveValue = catalogueReserveValue(catLots)
  if (reserveValue >= ctx.ceoPublishValueFrom) {
    const signed = ctx.ceoApprovals.some(
      (a) => a.kind === 'auction_publish' && a.refId === catalogueId && a.status === 'approved',
    )
    if (!signed) {
      const pending = ctx.ceoApprovals.find(
        (a) => a.kind === 'auction_publish' && a.refId === catalogueId
          && (a.status === 'pending' || a.status === 'info_requested'),
      )
      return {
        ok: false,
        error: pending
          ? `${cat.code} is with the CEO for signature — ${inr(reserveValue)} at reserve is above the ${inr(ctx.ceoPublishValueFrom)} threshold.`
          : `${inr(reserveValue)} at reserve is above the ${inr(ctx.ceoPublishValueFrom)} publish threshold. Send it for the CEO's signature first.`,
      }
    }
  }

  const nowMs = ctx.now
  let endsAt = Date.parse(cat.endsAt)
  if (mode === 'now' && endsAt <= nowMs) endsAt = nowMs + 3 * 3600_000
  const status = mode === 'now' ? ('live' as const) : ('upcoming' as const)
  const endsAtIso = new Date(endsAt).toISOString()
  const startsAt = new Date(mode === 'now' ? nowMs : Date.parse(cat.startsAt)).toISOString()
  const nowIso = new Date(nowMs).toISOString()
  /* Going live now leaves no pre-auction window, so the window is shut at
     "now". A scheduled sale keeps the times the desk set on Schedule &
     publish — recomputing them here would quietly overwrite a cut-off
     somebody chose. */
  const emdOpensAt = mode === 'now' && cat.emdOpensAt && Date.parse(cat.emdOpensAt) > nowMs ? nowIso : cat.emdOpensAt
  const emdDeadline = mode === 'now' ? nowIso : (cat.emdDeadline || defaultEmdDeadline(startsAt))

  const lotCountLabel = `${catLots.length} lot${catLots.length === 1 ? '' : 's'}`
  const roleTitle = `${cat.code} is ${status === 'live' ? 'live' : 'scheduled'}`

  return {
    ok: true,
    plan: {
      catalogueId,
      catalogueStatus: status,
      startsAt, endsAt: endsAtIso, emdOpensAt, emdDeadline,
      lotStatus: status === 'live' ? 'live' : 'approved',
      audit: {
        action: 'catalogue.publish', target: cat.code,
        detail: `Published "${cat.title}" with ${catLots.length} lots`,
      },
      // Public from here: the marketplace notice is genuinely for everyone.
      broadcastNotification: {
        userId: null, kind: 'lifecycle', title: `New catalogue ${cat.code}`, body: cat.title, href: `/catalogue/${cat.id}`,
      },
      // Publishing hands the sale to the auction floor.
      roleNotification: {
        kind: 'lifecycle', title: roleTitle,
        body: `${lotCountLabel} at ${cat.yardName}. ${status === 'live' ? 'It is on the floor now.' : `Opens ${new Date(Date.parse(cat.startsAt)).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}.`}`,
        href: status === 'live' ? '/auction/live' : '/auction/schedule',
      },
      // Tells the seller their material is on the market — this used not to
      // be said.
      sellerNotification: cat.sellerId
        ? {
          userId: cat.sellerId, kind: 'lifecycle', title: roleTitle,
          body: status === 'live'
            ? `Your ${catLots.length} lot${catLots.length === 1 ? ' is' : 's are'} on the marketplace and EMD funding is open.`
            : `Your ${lotCountLabel} go to market on schedule. Buyers can see the catalogue and fund EMD now.`,
          href: '/seller/monitor',
        }
        : null,
    },
  }
}

/* -------------------------------- assignCatalogue ------------------------------ */

export interface AssignCatalogueContext {
  catalogue: Catalogue | undefined
  fieldExec: User | undefined
}

export interface AssignCataloguePlan {
  audit: { action: string; target: string; detail: string }
  notification: (NotificationPlan & { userId: string }) | null
}

export function planAssignCatalogue(
  catalogueId: string,
  fieldExecId: string,
  ctx: AssignCatalogueContext,
): AssignCataloguePlan {
  const cat = ctx.catalogue
  const exec = ctx.fieldExec
  return {
    audit: { action: 'catalogue.assign', target: cat?.code ?? catalogueId, detail: `Assigned to ${exec?.name ?? fieldExecId} for field inspection` },
    // Work never lands silently on the field executive's queue.
    notification: cat
      ? {
        userId: fieldExecId, kind: 'system', title: `${cat.code} assigned to you`,
        body: `${cat.lotIds.length} lot${cat.lotIds.length === 1 ? '' : 's'} at ${cat.yardName} — inspection window ${new Date(cat.inspectionFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}–${new Date(cat.inspectionTo).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}.`,
        href: `/field/catalogue/${cat.id}`,
      }
      : null,
  }
}

/* -------------------------------- publishCatalogue ------------------------------ */
/* This is the direct catalogue-assembly/publish action (draft assembly for field
   inspection, or a direct live publish) — distinct from publishDraftCatalogue
   above, which is the CEO-gated "go live" step run from an already-assembled
   draft. Phase 28c: added the role guard its one caller (exec/CatalogueBuilder,
   route-gated to LOT_GATE_ROLES) always implied but the action itself never
   checked. The target-status branching below (live/approved/pending_inspection
   depending on catalogue state) is real business logic, not a single fixed
   transition, and stays untouched — no status precondition added. */

export interface PublishCatalogueLotResult {
  lotId: string
  lotNo: string
  status: LotStatus
  endsAt: string
  overrideRows: LotOverride[]
}

export interface PublishCataloguePlan {
  isDraft: boolean
  lotResults: PublishCatalogueLotResult[]
  changed: LotOverride[]
  mainAudit: { action: string; target: string; detail: string; severity: 'info' }
  overrideAudit: { action: string; target: string; detail: string; severity: 'warning' } | null
  sellerOverrideNotification: (NotificationPlan & { userId: string }) | null
  broadcastNotification: (NotificationPlan & { userId: null }) | null
  fieldExecNotification: (NotificationPlan & { userId: string }) | null
}

export interface PublishCatalogueContext {
  role: Role
  now: number
  actorId: string | undefined
  lots: Lot[]
}

export type PublishCatalogueResult =
  | { ok: true; plan: PublishCataloguePlan }
  | { ok: false; error: string }

export function planPublishCatalogue(
  cat: Catalogue,
  lotIds: string[],
  overrides: Record<string, Partial<Lot>>,
  ctx: PublishCatalogueContext,
): PublishCatalogueResult {
  if (!LOT_GATE_ROLES.includes(ctx.role)) return { ok: false, error: 'Only Operations or a Sub Admin builds or publishes a catalogue' }
  const isDraft = cat.status === 'draft'
  const at = new Date(ctx.now).toISOString()
  const by = ctx.actorId ?? 'u-exec-1'
  /* Bulk-setting an increment, an EMD or a unit across a catalogue changes
     terms the seller submitted. The new value applies, but the original is
     kept on the lot rather than overwritten, the change is audited, and the
     seller is told — see the role architecture, Part 4.4. */
  const changesFor = (l: Lot): LotOverride[] => {
    const o = overrides[l.id]
    if (!o) return []
    const rows: LotOverride[] = []
    const add = (field: LotOverride['field'], label: string, from: string, to: string) =>
      rows.push({ field, label, from, to, by, at, catalogueCode: cat.code })
    if (o.increment != null && o.increment !== l.increment) add('increment', 'Bid increment', inr(l.increment), inr(o.increment))
    if (o.preBidEmd != null && o.preBidEmd !== l.preBidEmd) add('preBidEmd', 'Pre-bid EMD', inr(l.preBidEmd), inr(o.preBidEmd))
    if (o.uom && o.uom !== l.uom) add('uom', 'Unit of measure', l.uom, o.uom)
    return rows
  }
  const included = ctx.lots.filter((l) => lotIds.includes(l.id))
  const changed = included.flatMap(changesFor)

  const lotResults: PublishCatalogueLotResult[] = included.map((l) => {
    const idx = lotIds.indexOf(l.id)
    return {
      lotId: l.id,
      lotNo: `LOT-${String(idx + 1).padStart(2, '0')}`,
      status: cat.status === 'live'
        ? ('live' as LotStatus)
        : isDraft
          ? (l.inspectionWaived ? ('approved' as LotStatus) : ('pending_inspection' as LotStatus))
          : ('approved' as LotStatus),
      endsAt: isDraft ? l.endsAt : cat.endsAt,
      overrideRows: changesFor(l),
    }
  })

  return {
    ok: true,
    plan: {
      isDraft,
      lotResults,
      changed,
      mainAudit: {
        action: isDraft ? 'catalogue.assign' : 'catalogue.publish', target: cat.code,
        detail: isDraft ? `Assembled "${cat.title}" with ${lotIds.length} lots — assigned for field inspection` : `Published "${cat.title}" with ${lotIds.length} lots`,
        severity: 'info',
      },
      overrideAudit: changed.length > 0
        ? {
          action: 'catalogue.override', target: cat.code,
          detail: `${changed.length} seller term${changed.length === 1 ? '' : 's'} overridden — ${changed.map((c) => `${c.label} ${c.from} → ${c.to}`).join('; ')}`,
          severity: 'warning',
        }
        : null,
      sellerOverrideNotification: changed.length > 0 && cat.sellerId
        ? {
          userId: cat.sellerId, kind: 'system', title: `Terms adjusted on ${cat.code}`,
          body: `${changed.map((c) => `${c.label}: ${c.from} → ${c.to}`).join(' · ')}. Your original values are kept on the lot record.`,
          href: '/seller/lots',
        }
        : null,
      broadcastNotification: !isDraft
        ? { userId: null, kind: 'lifecycle', title: `New catalogue ${cat.code}`, body: cat.title, href: `/catalogue/${cat.id}` }
        : null,
      // Assembled as a draft and routed for inspection — the field executive is
      // told, rather than left to discover it on their queue.
      fieldExecNotification: isDraft && cat.assignedFieldExecId
        ? {
          userId: cat.assignedFieldExecId, kind: 'system', title: `${cat.code} assigned to you`,
          body: `${lotIds.length} lot${lotIds.length === 1 ? '' : 's'} at ${cat.yardName} — ${cat.title}.`,
          href: `/field/catalogue/${cat.id}`,
        }
        : null,
    },
  }
}
