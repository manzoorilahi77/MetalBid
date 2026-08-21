/* ---------------------------------------------------------------------------
   Sub Admin, Super Admin, and the CEO queue.

   All three read across the whole platform. Sub Admin and Super Admin read the
   identical payload — operations, the supervisory records, and the platform's
   own structure (roles, pages, change history, password resets, master data)
   — because the company runs day to day on the Sub Admin account; Super
   Admin's exclusive ground is four screens gated at the route (`/api/admin`
   itself), not a wider read here. CEO stays deliberately narrower: a
   commercial read plus the approval queue.

   Composed from platform.mjs rather than written out three times, so that
   nesting stays visible in the code.

   None of the three carries `reserve_rate` — see the note in platform.mjs for
   why that costs them nothing.
--------------------------------------------------------------------------- */
import { query } from '../db.mjs'
import { iso } from './dto.mjs'
import {
  loadAuditEvents, loadBids, loadCataloguesAndLots, loadDeliveryOrders, loadDisputes,
  loadEscalations, loadFinanceRecords, loadInspectionReports, loadSelections,
  loadSettings, loadSupervision, loadTermsSets, loadTestimonials, loadUsers, loadWallets,
} from './platform.mjs'

/** Everything the operational supervisor sees. Super Admin builds on this. */
async function loadOperational() {
  const [
    { catalogues, lots }, users, bids, deliveryOrders, inspectionReports, termsSets,
    wallets, selections, disputes, auditEvents, finance, escalations, supervision, settings,
    testimonials,
  ] = [
    await loadCataloguesAndLots(), await loadUsers(), await loadBids(),
    await loadDeliveryOrders(), await loadInspectionReports(), await loadTermsSets(),
    await loadWallets(), await loadSelections(), await loadDisputes(), await loadAuditEvents(),
    await loadFinanceRecords(), await loadEscalations(), await loadSupervision(),
    await loadSettings(), await loadTestimonials(),
  ]
  return {
    catalogues, lots, users, bids, deliveryOrders, inspectionReports, termsSets,
    wallets, selections, disputes, auditEvents, testimonials,
    ...finance, ...escalations, ...supervision,
    financeConfig: settings.financeConfig,
    withdrawalWindow: settings.withdrawalWindow,
  }
}

/* The platform's own shape: roles, the page registry, the structural change
   log, password resets, and the master reference data. Both admin roles read
   this — Financial config, Master data, Page manager, Change history and
   Blacklist are company business-configuration screens the Sub Admin runs
   day to day, not the developer break-glass surface (Roles, Sub Admin
   accounts, Emergency override, Audit trail stay behind `/api/admin` and
   `super_admin` alone). The write side already treated both roles as one
   admin (see ADMIN_ONLY in policy.mjs); this only catches the read side up. */
async function loadStructure() {
  const [roles, pages, changes, resets, categories, uoms, yards] = [
    await query(`SELECT role_key, label, home, built_in, status, created_at, created_by,
                        removed_at, removed_by, removed_reason, based_on, note
                   FROM role_registry`),
    await query(`SELECT id, role_key, destination, label, sub_label, is_end, locked, in_top,
                        in_sub, active_match, hidden, sort_order, built_in, retained,
                        attached_from, category
                   FROM page_registry ORDER BY role_key, sort_order`),
    await query(`SELECT id, at, by_id, kind, target, summary, before_val, after_val, snapshot,
                        undone_at, undone_by FROM structural_changes ORDER BY at DESC`),
    await query('SELECT id, user_id, mode, password, at, by_id, consumed FROM password_resets ORDER BY at DESC'),
    await query('SELECT category_key, label, hue, built_in, active FROM master_categories'),
    await query('SELECT code, label, precision_note, built_in, active FROM master_uoms'),
    await query(`SELECT id, name, region, address, contact_name, contact_phone, built_in, active
                   FROM master_yards`),
  ]

  return {
    roleRegistry: roles.map((r) => ({
      key: r.role_key, label: r.label, home: r.home, builtIn: !!r.built_in, status: r.status,
      createdAt: iso(r.created_at), createdBy: r.created_by ?? undefined,
      removedAt: iso(r.removed_at) ?? undefined, removedBy: r.removed_by ?? undefined,
      removedReason: r.removed_reason ?? undefined, basedOn: r.based_on ?? undefined,
      note: r.note ?? undefined,
    })),
    pageRegistry: pages.map((p) => ({
      id: p.id, roleKey: p.role_key, to: p.destination, label: p.label,
      subLabel: p.sub_label ?? undefined, end: !!p.is_end, locked: !!p.locked,
      inTop: !!p.in_top, inSub: !!p.in_sub, activeMatch: p.active_match ?? undefined,
      hidden: !!p.hidden, order: p.sort_order, builtIn: !!p.built_in,
      retained: !!p.retained, attachedFrom: p.attached_from ?? undefined,
      category: p.category ?? undefined,
    })),
    structuralChanges: changes.map((c) => ({
      id: c.id, at: iso(c.at), byId: c.by_id, kind: c.kind, target: c.target,
      summary: c.summary, before: c.before_val, after: c.after_val,
      snapshot: c.snapshot ?? undefined, undoneAt: iso(c.undone_at) ?? undefined,
      undoneBy: c.undone_by ?? undefined,
    })),
    passwordResets: resets.map((r) => ({
      id: r.id, userId: r.user_id, mode: r.mode, password: r.password,
      at: iso(r.at), byId: r.by_id, consumed: !!r.consumed,
    })),
    masterCategories: categories.map((c) => ({
      key: c.category_key, label: c.label, hue: c.hue, builtIn: !!c.built_in, active: !!c.active,
    })),
    masterUoms: uoms.map((u) => ({
      code: u.code, label: u.label, precision: u.precision_note,
      builtIn: !!u.built_in, active: !!u.active,
    })),
    masterYards: yards.map((y) => ({
      id: y.id, name: y.name, region: y.region, address: y.address,
      contactName: y.contact_name, contactPhone: y.contact_phone,
      builtIn: !!y.built_in, active: !!y.active,
    })),
  }
}

export async function getSubAdminData() {
  const [operational, structure] = [await loadOperational(), await loadStructure()]
  return { serverTime: new Date().toISOString(), ...operational, ...structure }
}

/* Super Admin reads everything Sub Admin does, plus nothing extra today — the
   two payloads are the same shape. What Super Admin alone holds is the four
   screens `/api/admin`'s guard keeps exclusive: Roles, Sub Admin accounts,
   Emergency override and Audit trail are gated at the route, not by a
   narrower read here. */
export async function getSuperAdminData() {
  const [operational, structure] = [await loadOperational(), await loadStructure()]
  return { serverTime: new Date().toISOString(), ...operational, ...structure }
}

/* ---------------------------------------------------------------------------
   CEO. Reads the business and clears one approval queue — deliberately narrower
   than the two admin roles. No inspection reports, no audit trail, no page
   registry: this desk decides on money and risk, not on operations or platform
   structure.
--------------------------------------------------------------------------- */
export async function getCeoData() {
  const [
    { catalogues, lots }, users, bids, deliveryOrders, wallets,
    disputes, finance, escalations, settings,
  ] = [
    await loadCataloguesAndLots(), await loadUsers(), await loadBids(),
    await loadDeliveryOrders(), await loadWallets(), await loadDisputes(),
    await loadFinanceRecords(), await loadEscalations(), await loadSettings(),
  ]

  return {
    serverTime: new Date().toISOString(),
    catalogues, lots, users, bids, deliveryOrders, wallets, disputes,
    ...finance,
    ...escalations,
    financeConfig: settings.financeConfig,
    withdrawalWindow: settings.withdrawalWindow,
    ceoDelegation: settings.ceoDelegation,
  }
}
