# Field Inspection & Catalogue Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorder the ferroBid prototype's lot lifecycle so an Executive Manager catalogues and assigns lots to a Field Executive *before* inspection (not after), and rebuild both roles' screens around that order — a pure client-side, mock-data-only flow change.

**Architecture:** Additive changes to the shared `types.ts` model and the Zustand `store.ts`, three new/changed store actions, a rewritten deterministic mock-data generator (`scripts/generate-mock.mjs`) so seed data matches the new lifecycle, and page-level rewrites in `src/pages/exec/` and `src/pages/field/` (two brand-new field pages). No backend, no API — everything is local state over JSON fixtures.

**Tech Stack:** React 19, TypeScript, Vite, Zustand (hand-rolled store, `src/store/store.ts`), react-router-dom v7 (`HashRouter`), Tailwind v4. No test runner is configured in this repo (no Vitest/Jest, no `*.test.*` files anywhere).

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-08-08-field-inspection-catalogue-assignment-design.md` — every task below implements a section of it; consult it for the "why."
- **App root:** the actual app lives at `prototype_v2/ferrobid/` (nested under the git repo root). All file paths in this plan are relative to the git repo root, e.g. `prototype_v2/ferrobid/src/types.ts`. Run all `npm`/`node` commands from inside `prototype_v2/ferrobid/`.
- **No backend, mock data only.** This is a clickable prototype — all state lives in the in-memory Zustand store (`src/store/store.ts`), seeded from `src/data/mock/*.json`. Do not add API calls, persistence beyond `localStorage` (already used for theme/role), or a backend of any kind.
- **No test framework exists.** This plan substitutes the skill's usual "write failing test → make it pass" cycle with what this repo actually has: for logic-only changes (types, store actions, the mock generator), the verification step is `npm run build` (runs `tsc -b && vite build` — a real, strict type-check) plus a targeted `node -e` inspection of generated JSON where relevant. For UI-facing changes, the verification step is a manual click-through against `npm run dev` (Vite dev server, default `http://localhost:5173/`). Follow each task's steps literally — they are the closest equivalent this repo has to a test cycle.
- **`HashRouter` is in use** — dev-server routes are `http://localhost:5173/#/<route>` (e.g. `#/field`, `#/exec`).
- **Mock data source of truth is the generator, not the JSON.** `src/data/mock/*.json` is generated output (`npm run mock` → `node scripts/generate-mock.mjs`, see `prototype_v2/ferrobid/scripts/generate-mock.mjs`). Never hand-edit the JSON files — edit the generator and regenerate, or hand-edits will silently vanish the next time someone runs `npm run mock`.
- **Additive data model only** — no renamed or removed fields on `Catalogue` or `Lot` (per design spec §3).
- **Reuse existing UI primitives** from `prototype_v2/ferrobid/src/components/ui.tsx` (`Button`, `Chip`, `Field`, `Input`, `Select`, `EmptyState`, `PhotoThumb`, `StatusChip`, `PageHeader`, `Tabs`, `cx`). Do not introduce new styling primitives or a component library.
- **Role IDs used throughout:** demo field executive is `u-field-1` (Ravi Kumar), demo exec manager is `u-exec-1` (Meera Nair) — see `ROLE_DEMO_USER` in `prototype_v2/ferrobid/src/store/store.ts:20-27`. Switch roles in the running app via the role switcher in the header chrome.

---

### Task 1: Data model — `Catalogue.assignedFieldExecId` and `Lot` waiver/trust fields

**Files:**
- Modify: `prototype_v2/ferrobid/src/types.ts:51-73` (`Catalogue` interface), `prototype_v2/ferrobid/src/types.ts:75-102` (`Lot` interface)
- Modify: `prototype_v2/ferrobid/src/store/store.ts:748-764` (`createLot` — must satisfy the now-required `Lot` fields)
- Modify: `prototype_v2/ferrobid/src/pages/exec/CatalogueBuilder.tsx:144-169` (`publish` — must satisfy the now-required `Catalogue` field)

**Interfaces:**
- Produces: `Catalogue.assignedFieldExecId: string | null`; `Lot.knownSeller: boolean`, `Lot.inspectionWaived: boolean`, `Lot.waivedBy: string | null`, `Lot.waivedReason: string | null`, `Lot.waivedAt: string | null`. Every later task that constructs or reads a `Catalogue`/`Lot` relies on these exact names and types.

- [ ] **Step 1: Add `assignedFieldExecId` to `Catalogue`**

In `prototype_v2/ferrobid/src/types.ts`, change:

```ts
  documents: CatalogueDocument[]
  termsSetId: string
  description: string
}
```

to:

```ts
  documents: CatalogueDocument[]
  termsSetId: string
  description: string
  assignedFieldExecId: string | null // exec_manager sets this when assigning a draft catalogue for field inspection
}
```

- [ ] **Step 2: Add waiver/trust fields to `Lot`**

In the same file, change:

```ts
  endsAt: string // per-lot close; extends on anti-snipe
  extensions: number
  resultH1Rate?: number | null
}
```

to:

```ts
  endsAt: string // per-lot close; extends on anti-snipe
  extensions: number
  resultH1Rate?: number | null
  knownSeller: boolean // seeded trust flag — prototype-level, no real seller-identity link yet
  inspectionWaived: boolean // true if approved via waiver instead of a real field inspection
  waivedBy: string | null // exec_manager user id
  waivedReason: string | null
  waivedAt: string | null // ISO timestamp
}
```

- [ ] **Step 3: Run the type-checker to see it fail**

Run (from `prototype_v2/ferrobid/`): `npm run build`

Expected: FAIL — TypeScript errors at `src/store/store.ts:751` (`createLot`'s `Lot` literal missing the 5 new required properties) and `src/pages/exec/CatalogueBuilder.tsx:144` (the `Catalogue` literal in `publish` missing `assignedFieldExecId`).

- [ ] **Step 4: Satisfy `createLot`'s `Lot` literal**

In `prototype_v2/ferrobid/src/store/store.ts`, inside `createLot` (around line 758-760), change:

```ts
        inspectionReportId: null, status: 'pending_inspection',
        currentRate: null, leadingBidderId: null, bidCount: 0,
        endsAt: new Date(get().now + 30 * 86400_000).toISOString(), extensions: 0, resultH1Rate: null,
        ...partial,
```

to:

```ts
        inspectionReportId: null, status: 'pending_inspection',
        currentRate: null, leadingBidderId: null, bidCount: 0,
        endsAt: new Date(get().now + 30 * 86400_000).toISOString(), extensions: 0, resultH1Rate: null,
        knownSeller: false, inspectionWaived: false, waivedBy: null, waivedReason: null, waivedAt: null,
        ...partial,
```

- [ ] **Step 5: Satisfy the `Catalogue` literal in `CatalogueBuilder.tsx`**

In `prototype_v2/ferrobid/src/pages/exec/CatalogueBuilder.tsx`, inside `publish` (around line 149-150), change:

```ts
      sellerId: sellerFilter || 'u-seller-1',
      type: 'forward',
      status: mode === 'now' ? 'live' : 'upcoming',
```

to:

```ts
      sellerId: sellerFilter || 'u-seller-1',
      type: 'forward',
      status: mode === 'now' ? 'live' : 'upcoming',
      assignedFieldExecId: null,
```

(Task 5 rewrites this entire function — this is a minimal placeholder so the build passes until then.)

- [ ] **Step 6: Run the type-checker again to confirm it passes**

Run: `npm run build`

Expected: PASS — build completes with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add prototype_v2/ferrobid/src/types.ts prototype_v2/ferrobid/src/store/store.ts prototype_v2/ferrobid/src/pages/exec/CatalogueBuilder.tsx
git commit -m "$(cat <<'EOF'
Add assignedFieldExecId and waiver/trust fields to the data model

Additive-only changes to Catalogue and Lot so the store and pages can
carry field-exec assignment and known-seller waiver state.
EOF
)"
```

---

### Task 2: Seed data — draft catalogue, waiver-eligible lots, regenerate mock JSON

**Files:**
- Modify: `prototype_v2/ferrobid/scripts/generate-mock.mjs`
- Regenerate (do not hand-edit): `prototype_v2/ferrobid/src/data/mock/catalogues.json`, `prototype_v2/ferrobid/src/data/mock/lots.json`

**Interfaces:**
- Consumes: `Catalogue.assignedFieldExecId`, `Lot.knownSeller`/`inspectionWaived`/`waivedBy`/`waivedReason`/`waivedAt` (Task 1).
- Produces: at least one `catalogues.json` row with `status: "draft"` and `assignedFieldExecId: "u-field-1"`; that catalogue's lots all `status: "pending_inspection"` with `inspectionReportId: null`; ≥3 lots across the fixture set with `knownSeller: true`. Task 3's manual verification and every field-role page (Tasks 7-9) rely on this seeded draft catalogue existing.

- [ ] **Step 1: Add a `cat-8` yard entry**

In `prototype_v2/ferrobid/scripts/generate-mock.mjs`, in the `YARDS` map (ends around line 113), add a `cat-8` entry:

```js
  'cat-7': { name: 'BHEL Unit II Yard', addr: 'BHEL Tiruchirappalli, Kailasapuram, Tamil Nadu 620014', region: 'Trichy, TN' },
  'cat-8': { name: 'BSP Scrap Yard 3', addr: 'Gate 7, SAIL Bhilai Steel Plant, Bhilai, Chhattisgarh 490001', region: 'Bhilai, CG' },
}
```

- [ ] **Step 2: Add a `cat-8` draft catalogue definition, assigned to the demo field exec**

In the same file, in `cataloguesDef` (ends around line 124), add a new entry after `cat-7`:

```js
  { id: 'cat-7', code: 'AUC-2402', title: 'BHEL Trichy — Plant & Machinery, Condemned Assets', sellerId: 'u-seller-7', status: 'closed', start: -7 * DAY, end: -6 * DAY, pool: 'assets', count: 10, insp: [-10 * DAY, -8 * DAY], contact: { name: 'R. Elango', phone: '+91 94430 20951', role: 'Sr. Engineer (Disposals)' }, antiSnipe: 5, validity: 15 },
  { id: 'cat-8', code: 'AUC-2430', title: 'Bhilai Yard — Mixed Ferrous Scrap for Field Inspection', sellerId: 'u-seller-1', status: 'draft', assignedFieldExecId: 'u-field-1', start: 6 * DAY, end: 6 * DAY + 300, pool: 'msScrap', count: 5, insp: [2 * 60, 4 * DAY], contact: { name: 'S. K. Sahu', phone: '+91 94252 10883', role: 'Yard In-charge (Inspection & Lifting)' }, antiSnipe: 3, validity: 7 },
]
```

- [ ] **Step 3: Skip inspection-report generation for draft-catalogue lots, and stamp them `pending_inspection`**

In the same file, in the main per-catalogue loop (`for (const c of cataloguesDef) { ... }`, starting around line 131), the loop currently always pushes an `inspectionReports` entry and always stamps a resolved status — wrong for `cat-8`, whose lots haven't been inspected yet. Change:

```js
    const repId = `ir-${String(lotSeq).padStart(3, '0')}`
    const measured = Math.round(qty * between(0.93, 1.05) * 100) / 100
    const condition = pick(['good', 'good', 'fair', 'mixed'])
    inspectionReports.push({
      id: repId, lotId: id, inspectorId: pick(['u-field-1', 'u-field-2']),
      date: iso(c.insp[0] + Math.floor(between(0, Math.max(60, c.insp[1] - c.insp[0])))),
      measuredQty: measured, uom, condition,
      notes: pick([
        'Stack verified against yard register. Quantity indicative — final on weighment.',
        'Material matches description. Minor surface rust observed, within norms.',
        'Segregation acceptable. Access for 20 ft trucks confirmed at yard gate.',
        'Photos captured from all sides. Weighbridge within 2 km of the yard.',
      ]),
      checklist: [
        { item: 'Material matches declared grade', ok: true },
        { item: 'Quantity verified (visual/weighment)', ok: true },
        { item: 'No hazardous contamination', ok: !hazardous },
        { item: 'Loading access available', ok: true },
        { item: 'Photos captured', ok: true },
      ],
      photoCount: nPhotos, status: 'verified',
    })
    lots.push({
      id, lotNo: `LOT-${String(i + 1).padStart(2, '0')}`, catalogueId: c.id,
      metal, category, grade, indicativeQty: qty, uom,
      yard: yard.name, description: desc, startRate, increment, reserveRate,
      preBidEmd, saleBasis: 'as-is-where-is', hazardous,
      photos: Array.from({ length: nPhotos }, (_, p) => ({ id: `${id}-p${p}`, label: PHOTO_LABELS[p], hue: Math.floor(between(10, 40) + p * 8) })),
      inspectionReportId: repId,
      status: c.status === 'closed' ? 'sold' : c.status === 'live' ? 'live' : 'approved',
      currentRate: null, leadingBidderId: null, bidCount: 0,
      endsAt: iso(c.end), extensions: 0, resultH1Rate: null,
    })
```

to:

```js
    const isDraft = c.status === 'draft'
    const repId = `ir-${String(lotSeq).padStart(3, '0')}`
    const measured = Math.round(qty * between(0.93, 1.05) * 100) / 100
    const condition = pick(['good', 'good', 'fair', 'mixed'])
    if (!isDraft) {
      inspectionReports.push({
        id: repId, lotId: id, inspectorId: pick(['u-field-1', 'u-field-2']),
        date: iso(c.insp[0] + Math.floor(between(0, Math.max(60, c.insp[1] - c.insp[0])))),
        measuredQty: measured, uom, condition,
        notes: pick([
          'Stack verified against yard register. Quantity indicative — final on weighment.',
          'Material matches description. Minor surface rust observed, within norms.',
          'Segregation acceptable. Access for 20 ft trucks confirmed at yard gate.',
          'Photos captured from all sides. Weighbridge within 2 km of the yard.',
        ]),
        checklist: [
          { item: 'Material matches declared grade', ok: true },
          { item: 'Quantity verified (visual/weighment)', ok: true },
          { item: 'No hazardous contamination', ok: !hazardous },
          { item: 'Loading access available', ok: true },
          { item: 'Photos captured', ok: true },
        ],
        photoCount: nPhotos, status: 'verified',
      })
    }
    lots.push({
      id, lotNo: `LOT-${String(i + 1).padStart(2, '0')}`, catalogueId: c.id,
      metal, category, grade, indicativeQty: qty, uom,
      yard: yard.name, description: desc, startRate, increment, reserveRate,
      preBidEmd, saleBasis: 'as-is-where-is', hazardous,
      photos: Array.from({ length: nPhotos }, (_, p) => ({ id: `${id}-p${p}`, label: PHOTO_LABELS[p], hue: Math.floor(between(10, 40) + p * 8) })),
      inspectionReportId: isDraft ? null : repId,
      status: c.status === 'closed' ? 'sold' : c.status === 'live' ? 'live' : isDraft ? 'pending_inspection' : 'approved',
      currentRate: null, leadingBidderId: null, bidCount: 0,
      endsAt: iso(c.end), extensions: 0, resultH1Rate: null,
      knownSeller: false, inspectionWaived: false, waivedBy: null, waivedReason: null, waivedAt: null,
    })
```

- [ ] **Step 4: Add the same 5 fields to the pipeline (uncatalogued) lots**

In the same file, in the `pipelineDefs` loop (starting around line 198), change the `lots.push` call:

```js
  lots.push({
    id, lotNo: `UNL-${String(lotSeq).padStart(2, '0')}`, catalogueId: null,
    metal, category, grade, indicativeQty: qty, uom, yard: sellerYard.name,
    description: desc, startRate: rate, increment: uom === 'KG' ? 2 : round(rate * 0.005, 50) || 50,
    reserveRate: round(rate * 1.07, 10), preBidEmd: Math.max(10000, round(rate * qty * 0.05, 5000)),
    saleBasis: 'as-is-where-is', hazardous: false,
    photos: Array.from({ length: 3 }, (_, p) => ({ id: `${id}-p${p}`, label: PHOTO_LABELS[p], hue: 20 + p * 10 })),
    inspectionReportId: repId, status,
    currentRate: null, leadingBidderId: null, bidCount: 0,
    endsAt: iso(30 * DAY), extensions: 0, resultH1Rate: null,
  })
```

to:

```js
  lots.push({
    id, lotNo: `UNL-${String(lotSeq).padStart(2, '0')}`, catalogueId: null,
    metal, category, grade, indicativeQty: qty, uom, yard: sellerYard.name,
    description: desc, startRate: rate, increment: uom === 'KG' ? 2 : round(rate * 0.005, 50) || 50,
    reserveRate: round(rate * 1.07, 10), preBidEmd: Math.max(10000, round(rate * qty * 0.05, 5000)),
    saleBasis: 'as-is-where-is', hazardous: false,
    photos: Array.from({ length: 3 }, (_, p) => ({ id: `${id}-p${p}`, label: PHOTO_LABELS[p], hue: 20 + p * 10 })),
    inspectionReportId: repId, status,
    currentRate: null, leadingBidderId: null, bidCount: 0,
    endsAt: iso(30 * DAY), extensions: 0, resultH1Rate: null,
    knownSeller: false, inspectionWaived: false, waivedBy: null, waivedReason: null, waivedAt: null,
  })
```

- [ ] **Step 5: Mark a handful of lots `knownSeller: true` for the waiver demo**

In the same file, immediately after the `pipelineDefs` loop closes (right before the `/* -------------------------------- bids ----------------------------------- */` section, around line 232), add:

```js
// mark a few lots known-seller so the waiver path (§2.1 of the design spec)
// is demoable: two lots inside the new draft catalogue, and the first
// still-uncatalogued pending-inspection pipeline lot.
const cat8LotIds = lots.filter((l) => l.catalogueId === 'cat-8').map((l) => l.id)
const firstUncataloguedPending = lots.find((l) => l.catalogueId === null && l.status === 'pending_inspection')
for (const id of [...cat8LotIds.slice(0, 2), firstUncataloguedPending?.id].filter(Boolean)) {
  const lot = lots.find((l) => l.id === id)
  if (lot) lot.knownSeller = true
}
```

- [ ] **Step 6: Carry `assignedFieldExecId` into the written `catalogues.json`**

In the same file, in the final `catalogues` map (starting around line 473), change:

```js
const catalogues = cataloguesDef.map((c) => ({
  id: c.id, code: c.code, title: c.title, sellerId: c.sellerId, type: 'forward',
  status: c.status, startsAt: iso(c.start), endsAt: iso(c.end),
```

to:

```js
const catalogues = cataloguesDef.map((c) => ({
  id: c.id, code: c.code, title: c.title, sellerId: c.sellerId, type: 'forward',
  status: c.status, assignedFieldExecId: c.assignedFieldExecId ?? null, startsAt: iso(c.start), endsAt: iso(c.end),
```

- [ ] **Step 7: Regenerate the mock JSON**

Run (from `prototype_v2/ferrobid/`): `npm run mock`

Expected: `Wrote 16 files → src/data/mock/` with no errors.

- [ ] **Step 8: Verify the regenerated fixtures**

Run (from `prototype_v2/ferrobid/`):

```bash
node -e "
const cats = require('./src/data/mock/catalogues.json');
const lots = require('./src/data/mock/lots.json');
const draft = cats.find((c) => c.status === 'draft');
console.log('draft catalogue:', draft && { id: draft.id, code: draft.code, assignedFieldExecId: draft.assignedFieldExecId, lotCount: draft.lotIds.length });
const draftLots = lots.filter((l) => l.catalogueId === draft.id);
console.log('draft lots all pending_inspection:', draftLots.every((l) => l.status === 'pending_inspection' && l.inspectionReportId === null));
console.log('known-seller lot count:', lots.filter((l) => l.knownSeller).length);
console.log('every lot has waiver fields:', lots.every((l) => 'inspectionWaived' in l && 'waivedBy' in l && 'waivedReason' in l && 'waivedAt' in l));
"
```

Expected: prints a draft catalogue with `assignedFieldExecId: 'u-field-1'` and 5 lots, `draft lots all pending_inspection: true`, `known-seller lot count: 3`, `every lot has waiver fields: true`.

- [ ] **Step 9: Confirm the rest of the app still type-checks against the new fixtures**

Run: `npm run build`

Expected: PASS (unchanged from Task 1 — `seed.ts` loads the JSON via an `as unknown as` cast, so this step is a sanity check, not expected to catch fixture issues).

- [ ] **Step 10: Commit**

```bash
git add prototype_v2/ferrobid/scripts/generate-mock.mjs prototype_v2/ferrobid/src/data/mock/
git commit -m "$(cat <<'EOF'
Seed a draft catalogue assigned to the demo field exec

Adds cat-8 (draft, assigned to u-field-1) so the new field-executive
screens aren't empty on first load, and marks a few lots knownSeller
for the waiver-path demo. Regenerated via npm run mock.
EOF
)"
```

---

### Task 3: Store actions — `assignCatalogue`, `waiveInspection`, `publishDraftCatalogue`, draft-aware `publishCatalogue`

**Files:**
- Modify: `prototype_v2/ferrobid/src/store/store.ts` (`State` interface around line 176-194; implementations around line 786-802)

**Interfaces:**
- Consumes: `Catalogue.assignedFieldExecId`, `Lot.inspectionWaived`/`waivedBy`/`waivedReason`/`waivedAt` (Task 1).
- Produces: `assignCatalogue(catalogueId: string, fieldExecId: string): void`; `waiveInspection(lotId: string, managerId: string, reason: string): void`; `publishDraftCatalogue(catalogueId: string, mode: 'now' | 'schedule'): { ok: boolean; error?: string }`; `publishCatalogue` now leaves lots `pending_inspection` and skips the public `notify()` when `cat.status === 'draft'`. Tasks 4-9 call these by these exact names/signatures.

- [ ] **Step 1: Declare the three new actions on `State`**

In `prototype_v2/ferrobid/src/store/store.ts`, in the `State` interface, change:

```ts
  submitInspection: (lotId: string, report: Omit<InspectionReport, 'id' | 'lotId' | 'date'>, outcome: 'verified' | 'flagged' | 'rejected') => void
  setLotStatus: (lotId: string, status: LotStatus) => void
  publishCatalogue: (cat: Catalogue, lotIds: string[], overrides: Record<string, Partial<Lot>>) => void
```

to:

```ts
  submitInspection: (lotId: string, report: Omit<InspectionReport, 'id' | 'lotId' | 'date'>, outcome: 'verified' | 'flagged' | 'rejected') => void
  setLotStatus: (lotId: string, status: LotStatus) => void
  publishCatalogue: (cat: Catalogue, lotIds: string[], overrides: Record<string, Partial<Lot>>) => void
  assignCatalogue: (catalogueId: string, fieldExecId: string) => void
  waiveInspection: (lotId: string, managerId: string, reason: string) => void
  publishDraftCatalogue: (catalogueId: string, mode: 'now' | 'schedule') => { ok: boolean; error?: string }
```

- [ ] **Step 2: Make `publishCatalogue` draft-aware**

In the same file, change:

```ts
    publishCatalogue: (cat, lotIds, overrides) => {
      set((st) => ({
        catalogues: [...st.catalogues, { ...cat, lotIds }],
        lots: st.lots.map((l) => {
          if (!lotIds.includes(l.id)) return l
          const idx = lotIds.indexOf(l.id)
          return {
            ...l, ...overrides[l.id], catalogueId: cat.id,
            lotNo: `LOT-${String(idx + 1).padStart(2, '0')}`,
            status: cat.status === 'live' ? 'live' as LotStatus : 'approved' as LotStatus,
            endsAt: cat.endsAt,
          }
        }),
      }))
      get().audit('catalogue.publish', cat.code, `Published "${cat.title}" with ${lotIds.length} lots`, 'info')
      get().notify({ userId: null, kind: 'lifecycle', title: `New catalogue ${cat.code}`, body: cat.title, href: `/catalogue/${cat.id}` })
    },
```

to:

```ts
    publishCatalogue: (cat, lotIds, overrides) => {
      const isDraft = cat.status === 'draft'
      set((st) => ({
        catalogues: [...st.catalogues, { ...cat, lotIds }],
        lots: st.lots.map((l) => {
          if (!lotIds.includes(l.id)) return l
          const idx = lotIds.indexOf(l.id)
          return {
            ...l, ...overrides[l.id], catalogueId: cat.id,
            lotNo: `LOT-${String(idx + 1).padStart(2, '0')}`,
            status: cat.status === 'live' ? 'live' as LotStatus : isDraft ? 'pending_inspection' as LotStatus : 'approved' as LotStatus,
            endsAt: isDraft ? l.endsAt : cat.endsAt,
          }
        }),
      }))
      get().audit(
        isDraft ? 'catalogue.assign' : 'catalogue.publish',
        cat.code,
        isDraft ? `Assembled "${cat.title}" with ${lotIds.length} lots — assigned for field inspection` : `Published "${cat.title}" with ${lotIds.length} lots`,
        'info',
      )
      if (!isDraft) {
        get().notify({ userId: null, kind: 'lifecycle', title: `New catalogue ${cat.code}`, body: cat.title, href: `/catalogue/${cat.id}` })
      }
    },
```

- [ ] **Step 3: Add `assignCatalogue`, `waiveInspection`, `publishDraftCatalogue`**

In the same file, immediately after the `publishCatalogue` implementation (before `pauseCatalogue`), add:

```ts
    assignCatalogue: (catalogueId, fieldExecId) => {
      set((st) => ({
        catalogues: st.catalogues.map((c) => (c.id === catalogueId ? { ...c, assignedFieldExecId: fieldExecId } : c)),
      }))
      const cat = get().catalogues.find((c) => c.id === catalogueId)
      const exec = get().users.find((u) => u.id === fieldExecId)
      get().audit('catalogue.assign', cat?.code ?? catalogueId, `Assigned to ${exec?.name ?? fieldExecId} for field inspection`)
    },

    waiveInspection: (lotId, managerId, reason) => {
      const lot = get().lots.find((l) => l.id === lotId)
      set((st) => ({
        lots: st.lots.map((l) =>
          l.id === lotId
            ? { ...l, status: 'approved' as LotStatus, inspectionWaived: true, waivedBy: managerId, waivedReason: reason, waivedAt: new Date(st.now).toISOString() }
            : l,
        ),
      }))
      get().audit('inspection.waive', lot?.lotNo ?? lotId, `Inspection waived — known seller${reason ? `: ${reason}` : ''}`)
    },

    publishDraftCatalogue: (catalogueId, mode) => {
      const s = get()
      const cat = s.catalogues.find((c) => c.id === catalogueId)
      if (!cat) return { ok: false, error: 'Catalogue not found' }
      const catLots = s.lots.filter((l) => l.catalogueId === catalogueId)
      const unresolved = catLots.filter((l) => l.status !== 'approved')
      if (unresolved.length > 0) {
        return { ok: false, error: `${unresolved.length} lot${unresolved.length > 1 ? 's' : ''} still need${unresolved.length > 1 ? '' : 's'} approval` }
      }
      const nowMs = s.now
      let endsAt = Date.parse(cat.endsAt)
      if (mode === 'now' && endsAt <= nowMs) endsAt = nowMs + 3 * 3600_000
      const status = mode === 'now' ? ('live' as const) : ('upcoming' as const)
      const endsAtIso = new Date(endsAt).toISOString()
      set((st) => ({
        catalogues: st.catalogues.map((c) =>
          c.id === catalogueId
            ? { ...c, status, startsAt: new Date(mode === 'now' ? nowMs : Date.parse(c.startsAt)).toISOString(), endsAt: endsAtIso }
            : c,
        ),
        lots: st.lots.map((l) =>
          l.catalogueId === catalogueId
            ? { ...l, status: status === 'live' ? ('live' as LotStatus) : ('approved' as LotStatus), endsAt: endsAtIso }
            : l,
        ),
      }))
      get().audit('catalogue.publish', cat.code, `Published "${cat.title}" with ${catLots.length} lots`, 'info')
      get().notify({ userId: null, kind: 'lifecycle', title: `New catalogue ${cat.code}`, body: cat.title, href: `/catalogue/${cat.id}` })
      return { ok: true }
    },
```

- [ ] **Step 4: Type-check**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Smoke-check nothing regressed**

Run `npm run dev`, open `http://localhost:5173/#/exec` and `http://localhost:5173/#/field`: confirm both still render with no console errors (neither page calls the three new actions yet, so this only confirms the store change itself didn't break existing behavior — e.g. that `publishCatalogue`'s draft branch didn't change output for the non-draft catalogues already in `#/browse` and `#/catalogue/:id`). The three new actions (`assignCatalogue`, `waiveInspection`, `publishDraftCatalogue`) get their real functional verification in Tasks 4, 6, and 9, which call them directly from the UI — a Zustand store with no `window` binding can't be exercised from the console without adding debug-only code, so UI-driven verification is the correct check here, not a workaround.

- [ ] **Step 6: Commit**

```bash
git add prototype_v2/ferrobid/src/store/store.ts
git commit -m "$(cat <<'EOF'
Add assignCatalogue, waiveInspection, publishDraftCatalogue actions

publishCatalogue also gains a draft-aware branch: lots stay
pending_inspection and no public notification fires when the
catalogue being written is a draft (assignment, not a real publish).
EOF
)"
```

---

### Task 4: Catalogue builder — pool from `pending_inspection`, known-seller waiver toggle

**Files:**
- Modify: `prototype_v2/ferrobid/src/pages/exec/CatalogueBuilder.tsx`

**Interfaces:**
- Consumes: `waiveInspection` (Task 3), `Lot.knownSeller`/`inspectionWaived` (Task 1).

- [ ] **Step 1: Change the pool filter to source from `pending_inspection`, including already-waived-but-uncatalogued lots**

In `prototype_v2/ferrobid/src/pages/exec/CatalogueBuilder.tsx`, change:

```ts
  const pool = lots.filter((l) => l.status === 'approved' && !l.catalogueId)
```

to:

```ts
  // sourced from pending_inspection (cataloguing now happens before inspection);
  // a waived lot flips to 'approved' but must stay visible here until it's
  // actually placed into a catalogue.
  const pool = lots.filter((l) => !l.catalogueId && (l.status === 'pending_inspection' || (l.inspectionWaived && l.status === 'approved')))
```

- [ ] **Step 2: Update the empty-state copy**

In the same file, change:

```tsx
              <EmptyState title="No approved lots match" body="Approve lots from the lot approval desk, or loosen the filters above." />
```

to:

```tsx
              <EmptyState title="No submitted lots match" body="Wait for sellers to submit lots for inspection, or loosen the filters above." />
```

- [ ] **Step 3: Wire up `waiveInspection` and the current user**

In the same file, change:

```ts
  const publishCatalogue = useStore((s) => s.publishCatalogue)
  const pushToast = useStore((s) => s.pushToast)
```

to:

```ts
  const publishCatalogue = useStore((s) => s.publishCatalogue)
  const waiveInspection = useStore((s) => s.waiveInspection)
  const me = useStore((s) => s.currentUser)
  const pushToast = useStore((s) => s.pushToast)
```

- [ ] **Step 4: Add the waive toggle to the step-1 lot row**

In the same file, change the step-1 lot row:

```tsx
                  return (
                    <label key={l.id} className={cx('flex items-center gap-3 p-3.5 cursor-pointer transition-colors', on ? 'bg-ember-soft/40' : 'hover:bg-surface-2')}>
                      <input type="checkbox" checked={on} onChange={() => toggleLot(l.id)} className="size-4 accent-[var(--color-ember,#c2410c)]" />
                      <PhotoThumb hue={l.photos[0]?.hue ?? 24} category={l.category} className="w-14 h-11" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{l.grade} · {l.metal}</div>
                        <div className="text-xs text-ink-muted truncate">
                          <span className="num">{num(l.indicativeQty)} {l.uom}</span> · {l.yard} · start <span className="num">{inr(l.startRate)}/{l.uom}</span>
                        </div>
                      </div>
                      <span className="num text-xs text-ink-faint shrink-0">{l.lotNo}</span>
                    </label>
                  )
```

to:

```tsx
                  return (
                    <label key={l.id} className={cx('flex items-center gap-3 p-3.5 cursor-pointer transition-colors', on ? 'bg-ember-soft/40' : 'hover:bg-surface-2')}>
                      <input type="checkbox" checked={on} onChange={() => toggleLot(l.id)} className="size-4 accent-[var(--color-ember,#c2410c)]" />
                      <PhotoThumb hue={l.photos[0]?.hue ?? 24} category={l.category} className="w-14 h-11" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{l.grade} · {l.metal}</div>
                        <div className="text-xs text-ink-muted truncate">
                          <span className="num">{num(l.indicativeQty)} {l.uom}</span> · {l.yard} · start <span className="num">{inr(l.startRate)}/{l.uom}</span>
                        </div>
                      </div>
                      {l.knownSeller && (
                        l.inspectionWaived ? (
                          <Chip tone="success">Waived</Chip>
                        ) : (
                          <Button
                            type="button" size="sm" variant="secondary"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              waiveInspection(l.id, me?.id ?? 'u-exec-1', 'Known seller — trusted, skipping field inspection')
                              pushToast({ kind: 'success', title: `${l.lotNo} waived`, body: 'Approved without field inspection — known seller.' })
                            }}
                          >
                            Waive — known seller
                          </Button>
                        )
                      )}
                      <span className="num text-xs text-ink-faint shrink-0">{l.lotNo}</span>
                    </label>
                  )
```

- [ ] **Step 5: Type-check**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Manual verification**

Run `npm run dev`, open `http://localhost:5173/#/exec/catalogue-builder` as `exec_manager` (switch role via the header if needed). On step 1:
- Confirm the lot list now shows `pending_inspection` lots (not `approved` ones) — cross-check against `#/exec` (Pipeline)'s "Pending inspection" column count.
- Confirm at least one row shows a "Waive — known seller" button (the seeded known-seller lots from Task 2).
- Click it: confirm a success toast appears, the row now shows a "Waived" chip instead of the button, and the row is still checkable/selectable into the catalogue.
- Confirm clicking the "Waive" button does **not** also toggle the row's checkbox (the `preventDefault`/`stopPropagation` guard).

- [ ] **Step 7: Commit**

```bash
git add prototype_v2/ferrobid/src/pages/exec/CatalogueBuilder.tsx
git commit -m "$(cat <<'EOF'
Source the catalogue builder pool from pending_inspection lots

Cataloguing now happens before inspection, matching the real business
process. Adds a per-row known-seller waiver toggle in step 1.
EOF
)"
```

---

### Task 5: Catalogue builder — step 4 becomes assignment, not immediate publish

**Files:**
- Modify: `prototype_v2/ferrobid/src/pages/exec/CatalogueBuilder.tsx`

**Interfaces:**
- Consumes: `publishCatalogue` (Task 3's draft-aware version), `Catalogue.assignedFieldExecId` (Task 1).

- [ ] **Step 1: Add a field-exec picker and replace `publish` with `assign`**

In `prototype_v2/ferrobid/src/pages/exec/CatalogueBuilder.tsx`, change:

```ts
  const sellers = users.filter((u) => u.role === 'seller')
```

to:

```ts
  const sellers = users.filter((u) => u.role === 'seller')
  const fieldExecs = users.filter((u) => u.role === 'field_exec')
```

Then, in the step-4 state declarations, change:

```ts
  // step 4 — yard details (editable)
  const [yardName, setYardName] = useState('')
  const [yardAddress, setYardAddress] = useState('')
  const [region, setRegion] = useState('')
```

to:

```ts
  // step 4 — yard details (editable) + assignment
  const [yardName, setYardName] = useState('')
  const [yardAddress, setYardAddress] = useState('')
  const [region, setRegion] = useState('')
  const [fieldExecId, setFieldExecId] = useState('')
```

Then replace the entire `publish` function:

```ts
  const publish = (mode: 'now' | 'schedule') => {
    if (!firstLot) return
    const nowMs = Date.now()
    let endsAt = new Date(endLocal).getTime()
    if (mode === 'now' && endsAt <= nowMs) endsAt = nowMs + 3 * 3600_000
    const yard = yardName || firstLot.yard
    const cat: Catalogue = {
      id: uid('cat'),
      code,
      title: title.trim(),
      sellerId: sellerFilter || 'u-seller-1',
      type: 'forward',
      status: mode === 'now' ? 'live' : 'upcoming',
      assignedFieldExecId: null,
      startsAt: new Date(mode === 'now' ? nowMs : new Date(startLocal).getTime()).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      inspectionFrom: new Date(`${inspFrom}T10:00`).toISOString(),
      inspectionTo: new Date(`${inspTo}T16:00`).toISOString(),
      inspectionHours: inspHours,
      inspectionContact: { name: contactName, phone: contactPhone, role: 'Yard In-charge' },
      yardName: yard,
      yardAddress: yardAddress || `${yard}, Gate 2, weighbridge lane`,
      region: region || YARD_REGION[firstLot.yard] || 'Jamshedpur, JH',
      antiSnipeMinutes: Number(antiSnipe),
      bidValidityDays: Number(validityDays) || 7,
      lotIds: selectedIds,
      documents: [
        { id: uid('doc'), name: `${code} — Catalogue.pdf`, type: 'pdf', size: '2.4 MB' },
        ...attached,
      ],
      termsSetId,
      description: `${selected.length} lot${selected.length > 1 ? 's' : ''} of ${[...new Set(selected.map((l) => l.metal))].join(', ')} offered as-is-where-is from ${yard}. E-auction on ferroBid; quantity indicative — final on weighment.`,
    }
    publishCatalogue(cat, selectedIds, overrides)
    pushToast({
      kind: 'success',
      title: mode === 'now' ? `${code} is live` : `${code} scheduled`,
      body: mode === 'now'
        ? `${selected.length} lots are open for bidding until ${fmtDateTime(cat.endsAt)}.`
        : `Goes live ${fmtDateTime(cat.startsAt)} with ${selected.length} lots.`,
    })
    navigate(`/catalogue/${cat.id}`)
  }
```

with:

```ts
  const assign = () => {
    if (!firstLot || !fieldExecId) return
    const yard = yardName || firstLot.yard
    const cat: Catalogue = {
      id: uid('cat'),
      code,
      title: title.trim(),
      sellerId: sellerFilter || 'u-seller-1',
      type: 'forward',
      status: 'draft',
      assignedFieldExecId: fieldExecId,
      startsAt: new Date(startLocal).toISOString(),
      endsAt: new Date(endLocal).toISOString(),
      inspectionFrom: new Date(`${inspFrom}T10:00`).toISOString(),
      inspectionTo: new Date(`${inspTo}T16:00`).toISOString(),
      inspectionHours: inspHours,
      inspectionContact: { name: contactName, phone: contactPhone, role: 'Yard In-charge' },
      yardName: yard,
      yardAddress: yardAddress || `${yard}, Gate 2, weighbridge lane`,
      region: region || YARD_REGION[firstLot.yard] || 'Jamshedpur, JH',
      antiSnipeMinutes: Number(antiSnipe),
      bidValidityDays: Number(validityDays) || 7,
      lotIds: selectedIds,
      documents: [
        { id: uid('doc'), name: `${code} — Catalogue.pdf`, type: 'pdf', size: '2.4 MB' },
        ...attached,
      ],
      termsSetId,
      description: `${selected.length} lot${selected.length > 1 ? 's' : ''} of ${[...new Set(selected.map((l) => l.metal))].join(', ')} offered as-is-where-is from ${yard}. E-auction on ferroBid; quantity indicative — final on weighment.`,
    }
    publishCatalogue(cat, selectedIds, overrides)
    const exec = users.find((u) => u.id === fieldExecId)
    pushToast({
      kind: 'success',
      title: `${code} assigned`,
      body: `${selected.length} lots routed to ${exec?.name ?? 'the field executive'} for inspection.`,
    })
    navigate('/exec')
  }
```

- [ ] **Step 2: Update the step-4 label**

In the same file, change:

```tsx
          { key: 's4', label: '4 · Preview & publish' },
```

to:

```tsx
          { key: 's4', label: '4 · Preview & assign' },
```

- [ ] **Step 3: Replace the publish action bar with the assignment bar**

In the same file, change:

```tsx
          <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-ink-muted">
              Publishing notifies all registered buyers and locks lot numbering <span className="num">LOT-01…LOT-{String(selected.length).padStart(2, '0')}</span>.
            </div>
            <div className="flex gap-2">
              <Button variant="steel" onClick={() => publish('schedule')} disabled={!step2Done}>Schedule for start time</Button>
              <Button onClick={() => publish('now')} disabled={!step2Done}>Publish now</Button>
            </div>
          </div>
```

to:

```tsx
          <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Assign to field executive" className="w-56">
                <Select value={fieldExecId} onChange={(e) => setFieldExecId(e.target.value)}>
                  <option value="">Select field executive…</option>
                  {fieldExecs.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </Select>
              </Field>
              <div className="text-sm text-ink-muted max-w-sm">
                Assigning locks lot numbering <span className="num">LOT-01…LOT-{String(selected.length).padStart(2, '0')}</span> and routes this catalogue to the field executive's inspection queue. Bidding stays closed until you publish it later from the pipeline.
              </div>
            </div>
            <Button onClick={assign} disabled={!step2Done || !fieldExecId}>Save & assign for inspection</Button>
          </div>
```

- [ ] **Step 4: Type-check**

Run: `npm run build`

Expected: PASS. (If `fmtDateTime` is now unused in this file, TypeScript won't flag it as an error, but a lint pass would — leave the import; it's still used in the buyer-view preview panel above this block.)

- [ ] **Step 5: Manual verification**

Run `npm run dev`, open `http://localhost:5173/#/exec/catalogue-builder` as `exec_manager`. Select 2-3 lots in step 1, fill step 2's title, advance to step 4:
- Confirm the tab reads "4 · Preview & assign".
- Confirm the old "Schedule for start time" / "Publish now" buttons are gone, replaced by a field-executive `<Select>` and a "Save & assign for inspection" button.
- Confirm the button is disabled until a field executive is picked.
- Pick "Ravi Kumar", click "Save & assign for inspection": confirm a success toast, and that you land on `#/exec` (Pipeline), not the buyer-facing catalogue page.
- Open `#/field` as `field_exec` (Ravi Kumar / `u-field-1`): the new catalogue should not yet appear correctly-wired (Queue.tsx isn't rewritten until Task 7) — that's expected at this point; just confirm no console errors.

- [ ] **Step 6: Commit**

```bash
git add prototype_v2/ferrobid/src/pages/exec/CatalogueBuilder.tsx
git commit -m "$(cat <<'EOF'
Replace catalogue builder's immediate publish with field-exec assignment

Step 4 now saves the catalogue as draft + assignedFieldExecId instead
of opening it for bidding immediately — bidding opens later via the
publish gate (Pipeline) once every lot is inspected and approved.
EOF
)"
```

---

### Task 6: Pipeline — remove the per-lot assign stub, add the draft-catalogue publish gate

**Files:**
- Modify: `prototype_v2/ferrobid/src/pages/exec/Pipeline.tsx`

**Interfaces:**
- Consumes: `publishDraftCatalogue` (Task 3), `Catalogue.assignedFieldExecId` (Task 1).

- [ ] **Step 1: Remove the stub "Assign field exec" button**

In `prototype_v2/ferrobid/src/pages/exec/Pipeline.tsx`, change:

```ts
  const actions = (col: ColKey, l: Lot) => {
    switch (col) {
      case 'pending':
        return (
          <Button size="sm" variant="secondary" className="w-full"
            onClick={() => pushToast({ kind: 'success', title: 'Field executive assigned', body: `${l.lotNo} routed to the yard inspection queue.` })}>
            Assign field exec
          </Button>
        )
      case 'inspected':
```

to:

```ts
  const actions = (col: ColKey, l: Lot) => {
    switch (col) {
      case 'inspected':
```

- [ ] **Step 2: Pull in catalogues, users, and `publishDraftCatalogue`**

In the same file, change:

```ts
  const lots = useStore((s) => s.lots)
  const reports = useStore((s) => s.inspectionReports)
  const setLotStatus = useStore((s) => s.setLotStatus)
  const pushToast = useStore((s) => s.pushToast)
```

to:

```ts
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const users = useStore((s) => s.users)
  const reports = useStore((s) => s.inspectionReports)
  const setLotStatus = useStore((s) => s.setLotStatus)
  const publishDraftCatalogue = useStore((s) => s.publishDraftCatalogue)
  const pushToast = useStore((s) => s.pushToast)

  const draftCatalogues = catalogues.filter((c) => c.status === 'draft')
```

- [ ] **Step 3: Render the publish-gate section above the Kanban board**

In the same file, change:

```tsx
      <PageHeader title="Lot pipeline" sub="Every lot on the platform, from seller submission through inspection, approval, auction and resolution." />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
```

to:

```tsx
      <PageHeader title="Lot pipeline" sub="Every lot on the platform, from seller submission through inspection, approval, auction and resolution." />

      {draftCatalogues.length > 0 && (
        <div className="mb-6 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Draft catalogues awaiting publish</div>
          {draftCatalogues.map((c) => {
            const catLots = lots.filter((l) => l.catalogueId === c.id)
            const resolved = catLots.filter((l) => l.status === 'approved').length
            const ready = catLots.length > 0 && resolved === catLots.length
            const exec = users.find((u) => u.id === c.assignedFieldExecId)
            return (
              <div key={c.id} className="card p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="num text-sm font-bold">{c.code}</span>
                    <span className="font-semibold text-sm">{c.title}</span>
                  </div>
                  <div className="text-xs text-ink-muted mt-0.5">
                    Assigned to {exec?.name ?? 'unassigned'} · <span className="num">{resolved}/{catLots.length}</span> lots approved
                  </div>
                </div>
                <Button
                  size="sm" variant={ready ? 'success' : 'secondary'} disabled={!ready}
                  onClick={() => {
                    const res = publishDraftCatalogue(c.id, 'now')
                    pushToast(res.ok
                      ? { kind: 'success', title: `${c.code} is live`, body: `${catLots.length} lots are open for bidding.` }
                      : { kind: 'warning', title: 'Cannot publish yet', body: res.error })
                  }}
                >
                  {ready ? 'Publish catalogue' : `${resolved}/${catLots.length} lots approved`}
                </Button>
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
```

- [ ] **Step 4: Type-check**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Manual verification**

Run `npm run dev`, open `http://localhost:5173/#/exec` as `exec_manager`:
- Confirm the "Pending inspection" column's cards no longer show an "Assign field exec" button.
- Confirm a "Draft catalogues awaiting publish" section appears above the Kanban board, listing the seeded `AUC-2430` catalogue (assigned to Ravi Kumar) with a disabled "0/5 lots approved" button.
- (Full publish-gate exercise — approving all 5 lots and clicking "Publish catalogue" — happens in Task 12's end-to-end walkthrough, once the field-exec inspection flow exists.)

- [ ] **Step 6: Commit**

```bash
git add prototype_v2/ferrobid/src/pages/exec/Pipeline.tsx
git commit -m "$(cat <<'EOF'
Remove the per-lot assign stub, add the draft-catalogue publish gate

Assignment is catalogue-level now (via the builder), so the old
per-lot toast-only stub is gone. A new section above the Kanban board
lets a manager publish a draft catalogue once every lot in it is
approved or waived.
EOF
)"
```

---

### Task 7: Field executive queue — list assigned catalogues, not raw lots

**Files:**
- Modify: `prototype_v2/ferrobid/src/pages/field/Queue.tsx` (full rewrite)

**Interfaces:**
- Consumes: `Catalogue.assignedFieldExecId` (Task 1).
- Produces: links to `/field/catalogue/:catalogueId` — Task 8 must register that route for these links to resolve.

- [ ] **Step 1: Rewrite `Queue.tsx`**

Replace the full contents of `prototype_v2/ferrobid/src/pages/field/Queue.tsx` with:

```tsx
/* Field executive — inspection queue: catalogues assigned to me (mobile-first). */
import { Link } from 'react-router-dom'
import { ClipboardCheck, MapPin } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Chip, EmptyState, StatusChip } from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDate, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'

export default function FieldQueue() {
  const now = useNow()
  const me = useStore((s) => s.currentUser)
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const users = useStore((s) => s.users)
  const reports = useStore((s) => s.inspectionReports)

  const myCatalogues = catalogues.filter((c) => c.status === 'draft' && c.assignedFieldExecId === me?.id)
  const myReports = reports
    .filter((r) => r.inspectorId === me?.id)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  const done = myReports
    .map((r) => ({ r, lot: lots.find((l) => l.id === r.lotId) }))
    .filter((x) => x.lot && ['inspected', 'flagged', 'rejected', 'approved'].includes(x.lot.status))
    .slice(0, 6)

  return (
    <Page className="max-w-xl">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Inspection queue</h1>
          <p className="text-sm text-ink-muted mt-1">{me?.name ?? 'Field executive'} · {myCatalogues.length} catalogue{myCatalogues.length === 1 ? '' : 's'} assigned</p>
        </div>
        <Chip tone="ember" className="num h-7">{myCatalogues.length} assigned</Chip>
      </div>

      <div className="space-y-3">
        {myCatalogues.length === 0 && (
          <EmptyState icon={<ClipboardCheck size={32} strokeWidth={1.5} />} title="No catalogues assigned" body="Catalogues assigned to you by the Executive Manager will appear here." />
        )}
        {myCatalogues.map((c) => {
          const catLots = lots.filter((l) => l.catalogueId === c.id)
          const inspected = catLots.filter((l) => l.status !== 'pending_inspection').length
          const seller = users.find((u) => u.id === c.sellerId)
          return (
            <Link key={c.id} to={`/field/catalogue/${c.id}`} className="block">
              <article className="card card-hover p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="num font-bold">{c.code}</span>
                  <span className="font-semibold text-sm">{c.title}</span>
                </div>
                <div className="text-xs text-ink-muted mt-1 flex items-center gap-1">
                  <MapPin size={11} /> {c.yardName} · {c.region}
                </div>
                <div className="text-xs text-ink-faint mt-0.5">
                  {seller?.firm ?? 'Seller'} · {fmtDate(c.inspectionFrom)}–{fmtDate(c.inspectionTo)} · {c.inspectionHours}
                </div>
                <div className="num text-xs text-ink-muted mt-2 font-semibold">{inspected} of {catLots.length} lots inspected</div>
              </article>
            </Link>
          )
        })}
      </div>

      <h2 className="text-lg font-bold mt-10 mb-3">Recently completed</h2>
      <div className="space-y-2">
        {done.length === 0 && <p className="text-sm text-ink-faint">Your submitted reports will appear here.</p>}
        {done.map(({ r, lot }) => (
          <div key={r.id} className="card px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <span className="num font-bold text-sm">{lot!.lotNo}</span>
              <span className="text-sm text-ink-muted ml-2 truncate">{lot!.grade}</span>
              <div className="num text-[11px] text-ink-faint mt-0.5">measured {num(r.measuredQty)} {r.uom} · {relTime(r.date, now)}</div>
            </div>
            <StatusChip status={lot!.status} />
          </div>
        ))}
      </div>
    </Page>
  )
}
```

Notable changes from the original: `queue` (raw lots) becomes `myCatalogues` (catalogues assigned to `me`, filtered by `assignedFieldExecId`), each card links to `/field/catalogue/:id` instead of straight to an inspection form, and the "Recently completed" report filter drops the hardcoded `'u-field-1'` fallback (`r.inspectorId === me?.id || r.inspectorId === 'u-field-1'`) in favor of just `r.inspectorId === me?.id`.

- [ ] **Step 2: Type-check**

Run: `npm run build`

Expected: PASS (the route `/field/catalogue/:catalogueId` doesn't exist yet — that's fine, it's a plain string in a `<Link to>`, not type-checked against the route table; Task 8 registers it).

- [ ] **Step 3: Manual verification**

Run `npm run dev`, open `http://localhost:5173/#/field` as `field_exec` (Ravi Kumar):
- Confirm the page now shows a card for `AUC-2430` (the seeded draft catalogue) with "0 of 5 lots inspected", yard name, and inspection window — not a flat list of individual lots.
- Confirm clicking the card navigates to `#/field/catalogue/cat-8` and shows a 404 (`NotFound`) page — expected until Task 8 registers the route.
- Switch to `field_exec` Sunita Devi (`u-field-2`, not assigned to `AUC-2430`): confirm the empty state "No catalogues assigned" shows instead.

- [ ] **Step 4: Commit**

```bash
git add prototype_v2/ferrobid/src/pages/field/Queue.tsx
git commit -m "$(cat <<'EOF'
Rewrite the field queue to list assigned catalogues, not raw lots

Matches the new lifecycle: a field exec works off catalogues assigned
to them, not a flat platform-wide pending-inspection list. Also drops
the hardcoded u-field-1 fallback from the "recently completed" filter.
EOF
)"
```

---

### Task 8: Field executive — new Catalogue Detail page + route

**Files:**
- Create: `prototype_v2/ferrobid/src/pages/field/CatalogueDetail.tsx`
- Modify: `prototype_v2/ferrobid/src/App.tsx`

**Interfaces:**
- Consumes: `Catalogue.assignedFieldExecId`, `Lot.inspectionWaived` (Task 1).
- Produces: route `/field/catalogue/:catalogueId`; links to `/field/lot/:lotId` — Task 9 must register that route for these links to resolve.

- [ ] **Step 1: Create the page**

Write `prototype_v2/ferrobid/src/pages/field/CatalogueDetail.tsx`:

```tsx
/* Field executive — assigned catalogue context + lot list ("catalogue inside the catalogue"). */
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, MapPin, Phone } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, EmptyState, PhotoThumb, StatusChip, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDate, num } from '../../lib/format'
import type { Lot } from '../../types'

export default function FieldCatalogueDetail() {
  const { catalogueId } = useParams()
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const users = useStore((s) => s.users)

  const cat = catalogues.find((c) => c.id === catalogueId)
  if (!cat) {
    return (
      <Page className="max-w-xl">
        <EmptyState title="Catalogue not found" action={<Link to="/field"><Button variant="secondary">Back to queue</Button></Link>} />
      </Page>
    )
  }

  const seller = users.find((u) => u.id === cat.sellerId)
  const catLots = cat.lotIds.map((id) => lots.find((l) => l.id === id)).filter((l): l is Lot => !!l)

  return (
    <Page className="max-w-xl pb-16">
      <Link to="/field" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-ink mb-4">
        <ChevronLeft size={16} /> Queue
      </Link>

      <div className="card p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="num font-bold">{cat.code}</span>
          <Chip tone="steel">Assigned</Chip>
        </div>
        <h1 className="font-display text-xl font-bold mt-1">{cat.title}</h1>
        <div className="text-sm text-ink-muted mt-1">{seller?.firm ?? 'Seller'}</div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Yard</div>
            <div className="text-sm font-semibold mt-0.5 flex items-center gap-1"><MapPin size={12} /> {cat.yardName}</div>
            <div className="text-xs text-ink-faint mt-0.5">{cat.yardAddress}</div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Inspection window</div>
            <div className="num text-sm font-semibold mt-0.5">{fmtDate(cat.inspectionFrom)} – {fmtDate(cat.inspectionTo)}</div>
            <div className="text-xs text-ink-faint mt-0.5">{cat.inspectionHours}</div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Inspection contact</div>
            <div className="text-sm font-semibold mt-0.5">{cat.inspectionContact.name}</div>
            <div className="text-xs text-ink-faint mt-0.5 flex items-center gap-1"><Phone size={11} /> {cat.inspectionContact.phone}</div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Lots</div>
            <div className="num text-sm font-semibold mt-0.5">{catLots.length} total</div>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-bold mt-6 mb-3">Lots to inspect</h2>
      <div className="space-y-2">
        {catLots.map((l) => {
          const card = (
            <article className={cx('card p-3.5 flex items-center gap-3', !l.inspectionWaived && 'card-hover')}>
              <PhotoThumb hue={l.photos[0]?.hue ?? 24} category={l.category} className="w-16 h-12" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="num font-bold text-sm">{l.lotNo}</span>
                  <StatusChip status={l.status} />
                  {l.inspectionWaived && <Chip tone="success">Waived</Chip>}
                </div>
                <div className="text-sm font-semibold mt-0.5">{l.grade} · {l.metal}</div>
                <div className="num text-xs text-ink-faint mt-0.5">Declared {num(l.indicativeQty)} {l.uom}</div>
              </div>
            </article>
          )
          // waived lots are read-only context, not an actionable item — no link
          return l.inspectionWaived
            ? <div key={l.id}>{card}</div>
            : <Link key={l.id} to={`/field/lot/${l.id}`} className="block">{card}</Link>
        })}
      </div>
    </Page>
  )
}
```

- [ ] **Step 2: Register the route**

In `prototype_v2/ferrobid/src/App.tsx`, change:

```ts
/* field executive */
import FieldQueue from './pages/field/Queue'
import InspectLot from './pages/field/InspectLot'
```

to:

```ts
/* field executive */
import FieldQueue from './pages/field/Queue'
import FieldCatalogueDetail from './pages/field/CatalogueDetail'
import InspectLot from './pages/field/InspectLot'
```

and change:

```tsx
          <Route path="/field" element={<FieldQueue />} />
          <Route path="/field/inspect/:lotId" element={<InspectLot />} />
```

to:

```tsx
          <Route path="/field" element={<FieldQueue />} />
          <Route path="/field/catalogue/:catalogueId" element={<FieldCatalogueDetail />} />
          <Route path="/field/inspect/:lotId" element={<InspectLot />} />
```

- [ ] **Step 3: Type-check**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Manual verification**

Run `npm run dev`, open `http://localhost:5173/#/field` as `field_exec` (Ravi Kumar), click into the `AUC-2430` card:
- Confirm it now navigates to a real page showing the catalogue code, title, seller, yard, inspection window/contact, and a list of 5 lots.
- Confirm each lot row shows a status chip; clicking a non-waived row navigates to `#/field/lot/<id>` (404 expected until Task 9).
- If any lot shows a "Waived" badge (from the Task 2 seed or a Task 4 waiver), confirm that row is not a clickable link.

- [ ] **Step 5: Commit**

```bash
git add prototype_v2/ferrobid/src/pages/field/CatalogueDetail.tsx prototype_v2/ferrobid/src/App.tsx
git commit -m "$(cat <<'EOF'
Add the field-executive Catalogue Detail page

Shows the assigned catalogue's full context (yard, inspection window,
contact) and its lot list — the navigation hub between the queue and
per-lot inspection.
EOF
)"
```

---

### Task 9: Field executive — new Lot Detail page + route, InspectLot post-submit navigation

**Files:**
- Create: `prototype_v2/ferrobid/src/pages/field/LotDetail.tsx`
- Modify: `prototype_v2/ferrobid/src/App.tsx`
- Modify: `prototype_v2/ferrobid/src/pages/field/InspectLot.tsx`

**Interfaces:**
- Consumes: `Lot.knownSeller`/`inspectionWaived`/`waivedReason`, `Catalogue` fields (Task 1); `/field/catalogue/:catalogueId` (Task 8, for the back-link and post-submit navigation).
- Produces: route `/field/lot/:lotId`.

- [ ] **Step 1: Create the page**

Write `prototype_v2/ferrobid/src/pages/field/LotDetail.tsx`:

```tsx
/* Field executive — full lot context: specs, photos, logistics, checklist preview, seller trust. */
import { Link, useParams } from 'react-router-dom'
import { Check, ChevronLeft, ClipboardCheck, MapPin, Phone } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, EmptyState, PhotoThumb, StatusChip } from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDate, num } from '../../lib/format'

const CHECK_ITEMS = [
  'Material matches declared grade',
  'Quantity verified (visual/weighment)',
  'No hazardous contamination',
  'Loading access available',
  'Photos captured',
]

export default function FieldLotDetail() {
  const { lotId } = useParams()
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const users = useStore((s) => s.users)

  const lot = lots.find((l) => l.id === lotId)
  if (!lot) {
    return (
      <Page className="max-w-xl">
        <EmptyState title="Lot not found" action={<Link to="/field"><Button variant="secondary">Back to queue</Button></Link>} />
      </Page>
    )
  }
  const cat = catalogues.find((c) => c.id === lot.catalogueId)
  const seller = users.find((u) => u.id === cat?.sellerId)

  return (
    <Page className="max-w-xl pb-28">
      <Link to={cat ? `/field/catalogue/${cat.id}` : '/field'} className="inline-flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-ink mb-4">
        <ChevronLeft size={16} /> {cat?.code ?? 'Queue'}
      </Link>

      <div className="card p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="num font-bold">{lot.lotNo}</span>
          <Chip tone="steel">{lot.metal}</Chip>
          <StatusChip status={lot.status} />
          {lot.hazardous && <Chip tone="danger">Hazardous</Chip>}
        </div>
        <h1 className="font-display text-xl font-bold mt-1">{lot.grade}</h1>
        <div className="text-sm text-ink-muted mt-1">{lot.description}</div>
        <div className="num text-sm font-semibold mt-2">Declared {num(lot.indicativeQty)} {lot.uom}</div>
      </div>

      <div>
        <span className="block text-[13px] font-semibold mt-5 mb-2">Photos</span>
        <div className="grid grid-cols-2 gap-3">
          {lot.photos.map((p) => (
            <PhotoThumb key={p.id} hue={p.hue} category={lot.category} label={p.label} className="h-28 rounded-2xl w-full" />
          ))}
        </div>
      </div>

      {cat && (
        <div className="card p-4 mt-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint mb-2">Visit & logistics</div>
          <div className="text-sm font-semibold flex items-center gap-1"><MapPin size={13} /> {cat.yardName}</div>
          <div className="text-xs text-ink-faint mt-0.5">{cat.yardAddress}</div>
          <div className="num text-sm mt-2">{fmtDate(cat.inspectionFrom)} – {fmtDate(cat.inspectionTo)} · {cat.inspectionHours}</div>
          <div className="text-xs text-ink-faint mt-1 flex items-center gap-1"><Phone size={11} /> {cat.inspectionContact.name} · {cat.inspectionContact.phone}</div>
        </div>
      )}

      <div className="mt-5">
        <span className="block text-[13px] font-semibold mb-2">Inspection checklist preview</span>
        <div className="card divide-y divide-line">
          {CHECK_ITEMS.map((item) => (
            <div key={item} className="flex items-center gap-3 px-4 py-3">
              <span className="size-6 rounded-lg grid place-items-center border border-line-strong text-ink-faint shrink-0"><Check size={14} /></span>
              <span className="text-sm font-medium text-ink-muted">{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4 mt-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint mb-2">Seller trust</div>
        <div className="text-sm font-semibold">{seller?.firm ?? 'Seller'}</div>
        {lot.knownSeller && <Chip tone="success" className="mt-2">Known seller</Chip>}
      </div>

      {lot.inspectionWaived ? (
        <div className="card p-4 mt-5 bg-success-soft border-success/25">
          <div className="font-semibold text-success">Inspection waived</div>
          <div className="text-xs text-ink-muted mt-1">Approved as a known seller{lot.waivedReason ? ` — ${lot.waivedReason}` : ''}. No field inspection needed.</div>
        </div>
      ) : (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
          <div className="max-w-xl mx-auto px-4 py-3">
            <Link to={`/field/inspect/${lot.id}`} className="block">
              <Button className="w-full" size="lg"><ClipboardCheck size={17} /> Start inspection</Button>
            </Link>
          </div>
        </div>
      )}
    </Page>
  )
}
```

- [ ] **Step 2: Register the route**

In `prototype_v2/ferrobid/src/App.tsx`, change:

```ts
import FieldQueue from './pages/field/Queue'
import FieldCatalogueDetail from './pages/field/CatalogueDetail'
import InspectLot from './pages/field/InspectLot'
```

to:

```ts
import FieldQueue from './pages/field/Queue'
import FieldCatalogueDetail from './pages/field/CatalogueDetail'
import FieldLotDetail from './pages/field/LotDetail'
import InspectLot from './pages/field/InspectLot'
```

and change:

```tsx
          <Route path="/field" element={<FieldQueue />} />
          <Route path="/field/catalogue/:catalogueId" element={<FieldCatalogueDetail />} />
          <Route path="/field/inspect/:lotId" element={<InspectLot />} />
```

to:

```tsx
          <Route path="/field" element={<FieldQueue />} />
          <Route path="/field/catalogue/:catalogueId" element={<FieldCatalogueDetail />} />
          <Route path="/field/lot/:lotId" element={<FieldLotDetail />} />
          <Route path="/field/inspect/:lotId" element={<InspectLot />} />
```

- [ ] **Step 3: Change `InspectLot`'s post-submit navigation**

In `prototype_v2/ferrobid/src/pages/field/InspectLot.tsx`, change:

```ts
    submitInspection(lot.id, report, outcome)
    pushToast({
      kind: outcome === 'verified' ? 'success' : outcome === 'flagged' ? 'warning' : 'danger',
      title: `${lot.lotNo} ${outcome}`,
      body: outcome === 'verified' ? 'Report sent to Executive Manager for approval.' : 'Escalated with your notes.',
    })
    nav('/field')
```

to:

```ts
    submitInspection(lot.id, report, outcome)
    pushToast({
      kind: outcome === 'verified' ? 'success' : outcome === 'flagged' ? 'warning' : 'danger',
      title: `${lot.lotNo} ${outcome}`,
      body: outcome === 'verified' ? 'Report sent to Executive Manager for approval.' : 'Escalated with your notes.',
    })
    nav(lot.catalogueId ? `/field/catalogue/${lot.catalogueId}` : '/field')
```

- [ ] **Step 4: Type-check**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Manual verification**

Run `npm run dev`, open `http://localhost:5173/#/field` as `field_exec` (Ravi Kumar), drill into `AUC-2430` → click a non-waived lot:
- Confirm the Lot Detail page shows specs, photos, a "Visit & logistics" block sourced from the parent catalogue (yard, inspection window, contact — matching what Task 8's Catalogue Detail page showed), a read-only checklist preview, a "Seller trust" block, and (for the seeded known-seller lot in this catalogue) a "Known seller" badge.
- Confirm "Start inspection" is present and navigates to `#/field/inspect/<lotId>` (the existing form, unchanged).
- Submit the inspection (any outcome): confirm you land back on `#/field/catalogue/cat-8`, not `#/field`, and the lot's status chip in that list has updated.
- If a lot in this catalogue has `inspectionWaived: true` (from the Task 2 seed), open its Lot Detail via a direct URL (`#/field/lot/<id>`) and confirm the "Inspection waived" banner shows and the "Start inspection" CTA is hidden.

- [ ] **Step 6: Commit**

```bash
git add prototype_v2/ferrobid/src/pages/field/LotDetail.tsx prototype_v2/ferrobid/src/App.tsx prototype_v2/ferrobid/src/pages/field/InspectLot.tsx
git commit -m "$(cat <<'EOF'
Add the field-executive Lot Detail page; inspection returns to it

Full lot context (specs, photos, yard logistics from the parent
catalogue, checklist preview, seller trust) before "Start inspection".
Submitting an inspection now returns to the catalogue's lot list
instead of the flat queue, so the officer can continue to the next lot.
EOF
)"
```

---

### Task 10: End-to-end smoke test of the full lifecycle

**Files:** none (verification only)

**Interfaces:** exercises everything produced by Tasks 1-9 together.

- [ ] **Step 1: Full click-through as `exec_manager`**

Run `npm run dev`, open `http://localhost:5173/#/exec/catalogue-builder` as `exec_manager` (Meera Nair):
1. Step 1: confirm the pool shows `pending_inspection` lots; select 2-3, including at least one `knownSeller` lot if visible; waive it and confirm the "Waived" chip appears and it stays selected.
2. Step 2: fill in a title; advance through steps 2-3 without changes.
3. Step 4: pick "Ravi Kumar" as the field executive; click "Save & assign for inspection"; confirm the success toast and landing on `#/exec`.
4. On `#/exec`, confirm the new catalogue appears in "Draft catalogues awaiting publish" with a `0/N` or `1/N` (if one lot was waived) progress button, disabled.

- [ ] **Step 2: Full click-through as `field_exec`**

Switch role to `field_exec` (Ravi Kumar), open `#/field`:
1. Confirm both `AUC-2430` (seeded) and the catalogue just created in Step 1 appear as cards with correct "N of M lots inspected" counts.
2. Open the newly-created catalogue's detail page; confirm the waived lot (if any) shows read-only with a "Waived" badge and is not clickable; confirm the other lots are clickable.
3. Click into a non-waived lot's detail page, click "Start inspection", fill the form (measured qty, at least one photo, condition), click "Verify".
4. Confirm you land back on the catalogue detail page and the lot's status chip now reads "Inspected".
5. Repeat for the remaining non-waived lots in that catalogue until all are inspected.

- [ ] **Step 3: Full click-through as `exec_manager` again**

Switch role back to `exec_manager`:
1. Open `#/exec/approvals` (Lot Approval): confirm the newly-inspected lots appear; approve each one.
2. Open `#/exec`: confirm the draft catalogue's publish-gate button now reads "Publish catalogue" (enabled, since all lots are `approved` or `inspectionWaived`).
3. Click it; confirm a success toast ("… is live") and that the catalogue disappears from the "Draft catalogues awaiting publish" section.
4. Open `#/browse` or `#/catalogue/<id>` (as a `buyer`, switching role once more if needed): confirm the catalogue is now publicly visible and biddable, exactly like any other live catalogue — no visual or functional difference from catalogues created the old way.

- [ ] **Step 4: Confirm the build is still clean**

Run: `npm run build`

Expected: PASS — no TypeScript errors, production build succeeds.

- [ ] **Step 5: Final commit (only if Step 1-4 surfaced fixes)**

If the walkthrough above required any small fixes, stage and commit them individually with a description of what was wrong and why — do not bundle unrelated fixes into one commit. If no fixes were needed, there is nothing to commit for this task; it exists purely to verify Tasks 1-9 compose correctly end to end.
