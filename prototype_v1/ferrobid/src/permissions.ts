import type { ModulePermission, PermLevel, ScopedPermissions } from './types';

/** Demo Sub-Admin persona whose scoped permissions drive the gated console. */
export const DEMO_SUB_ADMIN_ID = 'adm-03';

/** Operational modules a Sub-Admin can be granted (WBS v3.1 §5.2). */
export const OPS_MODULES: { key: string; label: string; group: 'Pipeline' | 'Fulfilment' | 'Operations' }[] = [
  { key: 'pipeline',   label: 'Pipeline Board',      group: 'Pipeline' },
  { key: 'entities',   label: 'Entity Verification', group: 'Pipeline' },
  { key: 'lots',       label: 'Lot Verification',    group: 'Pipeline' },
  { key: 'auctions',   label: 'Auction Setup',       group: 'Pipeline' },
  { key: 'settlement', label: 'Settlement',          group: 'Fulfilment' },
  { key: 'logistics',  label: 'Logistics',           group: 'Fulfilment' },
  { key: 'handover',   label: 'Handover',            group: 'Fulfilment' },
  { key: 'monitor',    label: 'Bid Monitor',         group: 'Operations' },
  { key: 'users',      label: 'User Directory',      group: 'Operations' },
  { key: 'masterdata', label: 'Master Data',         group: 'Operations' },
];

export const LEVEL_LABEL: Record<PermLevel, string> = {
  hidden: 'Hidden', view: 'View', act: 'Act', approve: 'Act + Approve',
};

const LEVEL_RANK: Record<PermLevel, number> = { hidden: 0, view: 1, act: 2, approve: 3 };

export const atLeast = (p: ModulePermission | undefined, level: PermLevel) =>
  !!p && LEVEL_RANK[p.level] >= LEVEL_RANK[level];

/** True when a ₹ value exceeds the granted ceiling (0 = no limit). */
export const overCeiling = (p: ModulePermission | undefined, value?: number) =>
  !!p && p.ceiling > 0 && (value ?? 0) > p.ceiling;

export const METAL_SCOPES = ['All', 'Ferrous', 'Copper', 'Aluminium', 'Non-ferrous'];
export const REGION_SCOPES = ['All', 'Chennai', 'Mumbai', 'Pune', 'Delhi NCR'];
export const CEILINGS = [
  { value: 0, label: 'No limit' },
  { value: 1_000_000, label: '≤ ₹10 L' },
  { value: 5_000_000, label: '≤ ₹50 L' },
  { value: 10_000_000, label: '≤ ₹1 Cr' },
];

const P = (level: PermLevel, metals = 'All', region = 'All', ceiling = 0): ModulePermission =>
  ({ level, metals, region, ceiling });

/** Reusable role templates the Super Admin can apply in one click (WBS v3.1 §5.1). */
export const PERM_TEMPLATES: { key: string; label: string; desc: string; perms: ScopedPermissions }[] = [
  {
    key: 'verification',
    label: 'Verification Officer',
    desc: 'Entity & lot verification within scope; everything else view/hidden',
    perms: {
      pipeline: P('view'), entities: P('act'), lots: P('act', 'All', 'All', 5_000_000),
      auctions: P('view'), settlement: P('hidden'), logistics: P('hidden'), handover: P('hidden'),
      monitor: P('view'), users: P('view'), masterdata: P('hidden'),
    },
  },
  {
    key: 'settlement',
    label: 'Settlement Officer',
    desc: 'Fulfilment focus — settlement/logistics act; pipeline view-only',
    perms: {
      pipeline: P('view'), entities: P('hidden'), lots: P('view'),
      auctions: P('view'), settlement: P('act', 'All', 'All', 5_000_000), logistics: P('act'), handover: P('act'),
      monitor: P('view'), users: P('view'), masterdata: P('hidden'),
    },
  },
  {
    key: 'fullops',
    label: 'Senior Ops',
    desc: 'Act everywhere with a ₹1 Cr ceiling; approvals still route up',
    perms: Object.fromEntries(OPS_MODULES.map((m) => [m.key, P('act', 'All', 'All', 10_000_000)])),
  },
];

export const DEFAULT_SUB_SCOPED: ScopedPermissions =
  PERM_TEMPLATES.find((t) => t.key === 'verification')!.perms;
