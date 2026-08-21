/* ---------------------------------------------------------------------------
   Seed the section registry and the CMS's opening content.

     node scripts/seed-cms.mjs            apply the inventory
     node scripts/seed-cms.mjs --check    report what would change, write nothing
     node scripts/seed-cms.mjs --reset    delete every section and block first

   Idempotent by default. Re-running updates the *definition* of a section — its
   title, its source class, whether it can be switched off — and deliberately
   does NOT touch `enabled`. An operator who switched a section off did that on
   purpose, and a deploy that turns it back on because the seed file says
   `enabled: true` would be a deploy that silently overrides them.

   Content is seeded once and never overwritten. The blocks in inventory.mjs are
   the copy the site already shows; once a person has edited one, the seed file
   is out of date by definition and must not win.
--------------------------------------------------------------------------- */
import { pool, closePool } from '../src/db.mjs'
import { toDbDateTime } from '../src/time.mjs'
import { newId } from '../src/auth/tokens.mjs'
import { SECTIONS, BLOCKS } from '../src/cms/inventory.mjs'

const flags = new Set(process.argv.slice(2))
const CHECK = flags.has('--check')
const RESET = flags.has('--reset')

/* Seeded rows are attributed to the system, not to whoever ran the script:
   nobody authored them, and pinning them on an operator would put a name
   against copy that person never wrote. */
const SEEDER = 'system'

try {
  if (RESET && !CHECK) {
    const [b] = await pool.query('DELETE FROM cms_block')
    const [r] = await pool.query('DELETE FROM section_registry')
    console.log(`  reset: removed ${r.affectedRows} sections and ${b.affectedRows} blocks`)
  }

  const sections = await seedSections()
  const blocks = await seedBlocks()

  console.log(`\n${CHECK ? 'Would apply' : 'Applied'}:`)
  console.log(`  sections  ${sections.added} added, ${sections.updated} updated, ${sections.unchanged} unchanged`)
  console.log(`  blocks    ${blocks.added} added, ${blocks.skipped} left alone (already edited)`)

  if (!CHECK) {
    const [[counts]] = await pool.query(`
      SELECT COUNT(*) AS total,
             SUM(enabled = 0) AS off,
             SUM(toggleable = 0) AS locked,
             COUNT(DISTINCT page_route) AS routes
        FROM section_registry`)
    console.log(`\n  ${counts.total} sections across ${counts.routes} routes`)
    console.log(`  ${Number(counts.off)} switched off, ${Number(counts.locked)} cannot be switched off\n`)
  }
} catch (err) {
  console.error(`\n✗ ${err.message}\n`)
  process.exitCode = 1
} finally {
  await closePool()
}

/* ------------------------------- sections -------------------------------- */

async function seedSections() {
  const [existing] = await pool.query(
    'SELECT page_route, section_key, role, title, source_class, toggleable, locked_reason, review_required, sort_order FROM section_registry')
  const seen = new Map(existing.map((r) => [`${r.page_route}|${r.section_key}|${r.role}`, r]))

  let added = 0, updated = 0, unchanged = 0
  const now = toDbDateTime(new Date())

  for (const sec of SECTIONS) {
    if (!sec.toggleable && !sec.lockedReason) {
      throw new Error(`${sec.route} § ${sec.key} cannot be switched off but gives no reason`)
    }

    const key = `${sec.route}|${sec.key}|${sec.role}`
    const prior = seen.get(key)

    if (!prior) {
      added += 1
      if (!CHECK) {
        await pool.execute(
          `INSERT INTO section_registry
             (section_key, page_route, role, title, description, source_class, enabled,
              toggleable, locked_reason, review_required, sort_order, updated_by, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [sec.key, sec.route, sec.role, sec.title, sec.description, sec.source,
           sec.enabled ? 1 : 0, sec.toggleable ? 1 : 0, sec.lockedReason,
           sec.reviewRequired ? 1 : 0, sec.sortOrder, SEEDER, now])
      }
      continue
    }

    const same =
      prior.title === sec.title &&
      prior.source_class === sec.source &&
      Number(prior.toggleable) === (sec.toggleable ? 1 : 0) &&
      (prior.locked_reason ?? null) === sec.lockedReason &&
      Number(prior.review_required) === (sec.reviewRequired ? 1 : 0) &&
      Number(prior.sort_order) === sec.sortOrder

    if (same) { unchanged += 1; continue }

    updated += 1
    if (!CHECK) {
      /* `enabled` is absent from this UPDATE on purpose — see the header. */
      await pool.execute(
        `UPDATE section_registry
            SET title = ?, description = ?, source_class = ?, toggleable = ?,
                locked_reason = ?, review_required = ?, sort_order = ?,
                updated_by = ?, updated_at = ?
          WHERE page_route = ? AND section_key = ? AND role = ?`,
        [sec.title, sec.description, sec.source, sec.toggleable ? 1 : 0,
         sec.lockedReason, sec.reviewRequired ? 1 : 0, sec.sortOrder, SEEDER, now,
         sec.route, sec.key, sec.role])
    }
  }

  /* A section in the database that the inventory no longer names is reported,
     never deleted: it may hold published copy, and a seeder that silently
     removes a live section is a seeder that takes the site down. */
  const inventoryKeys = new Set(SECTIONS.map((x) => `${x.route}|${x.key}|${x.role}`))
  const orphans = existing.filter((r) => !inventoryKeys.has(`${r.page_route}|${r.section_key}|${r.role}`))
  if (orphans.length) {
    console.log(`\n  ${orphans.length} section(s) in the database are not in the inventory:`)
    for (const o of orphans) console.log(`    ${o.page_route} § ${o.section_key}${o.role === '*' ? '' : ` (${o.role})`}`)
    console.log('  Left in place — remove them by hand if they are genuinely dead.')
  }

  return { added, updated, unchanged }
}

/* -------------------------------- blocks --------------------------------- */

async function seedBlocks() {
  const [existing] = await pool.query('SELECT page_key, section_key, block_key, locale FROM cms_block')
  const seen = new Set(existing.map((r) => `${r.page_key}|${r.section_key}|${r.block_key}|${r.locale}`))

  let added = 0, skipped = 0
  const now = toDbDateTime(new Date())

  for (const b of BLOCKS) {
    const key = `${b.pageKey}|${b.sectionKey}|${b.blockKey}|en`
    if (seen.has(key)) { skipped += 1; continue }

    added += 1
    if (CHECK) continue

    const json = JSON.stringify(b.value)
    const id = newId('cms')

    /* Seeded straight to `published`, at version 1, with the version row that
       a rollback would need. The point of seeding is that the site keeps
       rendering exactly what it rendered before — content that arrived as an
       unpublished draft would blank the page instead. */
    await pool.execute(
      `INSERT INTO cms_block
         (id, page_key, section_key, block_key, kind, locale, draft_value, published_value,
          status, version, authored_by, published_by, sort_order, created_at, updated_at, published_at)
       VALUES (?, ?, ?, ?, ?, 'en', ?, ?, 'published', 1, ?, ?, ?, ?, ?, ?)`,
      [id, b.pageKey, b.sectionKey, b.blockKey, b.kind, json, json,
       SEEDER, SEEDER, b.sortOrder, now, now, now])

    await pool.execute(
      `INSERT INTO cms_block_versions (id, block_id, version, value, published_by, published_at, note)
       VALUES (?, ?, 1, ?, ?, ?, 'Seeded from the copy already on the site')`,
      [newId('cmsv'), id, json, SEEDER, now])
  }

  return { added, skipped }
}
