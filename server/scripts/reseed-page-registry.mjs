/* ---------------------------------------------------------------------------
   Refreshes ONLY the page_registry table from the prototype store's current
   nav config (src/layout/nav.ts). Scoped sibling of seed.mjs, which reseeds
   every table -- too destructive to run against the shared dev DB just to
   sync a nav change (e.g. adding the CMS category).

   Source is seed-data/store-dump.json, produced by
   `npx tsx scripts/dump-store.ts` in the frontend. Re-run that first if
   nav.ts changed since the last dump.

   Run with --dry-run to see what would be written without touching the DB.
--------------------------------------------------------------------------- */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const DRY = process.argv.includes('--dry-run')
const here = dirname(fileURLToPath(import.meta.url))
const dump = JSON.parse(readFileSync(join(here, '..', 'seed-data', 'store-dump.json'), 'utf8'))

const bool = (v) => (v ? 1 : 0)
const json = (v) => JSON.stringify(v ?? null)

const columns = ['id', 'role_key', 'destination', 'label', 'sub_label', 'is_end', 'locked',
  'in_top', 'in_sub', 'active_match', 'hidden', 'sort_order', 'built_in', 'retained',
  'attached_from', 'category']

const rows = dump.pageRegistry.map((p) => ({
  id: p.id, role_key: p.roleKey, destination: p.to, label: p.label,
  sub_label: p.subLabel ?? null, is_end: bool(p.end), locked: bool(p.locked),
  in_top: bool(p.inTop), in_sub: bool(p.inSub),
  active_match: p.activeMatch ? json(p.activeMatch) : null,
  hidden: bool(p.hidden), sort_order: p.order ?? 0, built_in: bool(p.builtIn),
  retained: bool(p.retained), attached_from: p.attachedFrom ?? null,
  category: p.category ?? null,
}))

const undef = rows.find((r) => columns.some((c) => r[c] === undefined))
if (undef) {
  const cols = columns.filter((c) => undef[c] === undefined)
  throw new Error(`page_registry: column(s) ${cols.join(', ')} are undefined for row ` +
    `${undef.id ?? JSON.stringify(undef).slice(0, 80)} -- map them explicitly to null`)
}

const cmsRows = rows.filter((r) => r.category === 'CMS')
console.log(`page_registry: ${rows.length} rows total, ${cmsRows.length} in the CMS category`)
if (cmsRows.length) {
  console.log('  CMS rows:', cmsRows.map((r) => `${r.role_key}/${r.id}`).join(', '))
}

if (DRY) {
  console.log('\n--dry-run: nothing written.')
  process.exit(0)
}

const { pool, closePool } = await import('../src/db.mjs')
const conn = await pool.getConnection()
await conn.beginTransaction()
try {
  const [del] = await conn.query('DELETE FROM page_registry')
  console.log(`  cleared page_registry (${del.affectedRows})`)
  for (let i = 0; i < rows.length; i += 400) {
    const slice = rows.slice(i, i + 400)
    await conn.query(`INSERT INTO page_registry (${columns.join(', ')}) VALUES ?`,
      [slice.map((r) => columns.map((c) => r[c]))])
  }
  await conn.commit()
  console.log(`  page_registry  ${rows.length} inserted`)
} catch (err) {
  await conn.rollback()
  conn.release()
  await closePool()
  throw err
}
conn.release()
await closePool()
