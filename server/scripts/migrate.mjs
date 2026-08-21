/* Applies migrations/*.sql in filename order, recording each in _migrations
   so re-running is a no-op.

   Comment lines are stripped BEFORE splitting on ';'. An earlier version split
   first and then discarded any chunk that began with '--', which silently threw
   away the first statement of every file that opens with a comment header — the
   migration was then recorded as applied having done nothing. The zero-statement
   guard below exists so that failure mode can never be silent again. */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pool, closePool } from '../src/db.mjs'
import { toDbDateTime, nowUtc, formatIst } from '../src/time.mjs'

/** Strip full-line `--` comments, then split on ';'. Adequate because we author
 *  every migration here; it would need a real lexer if `--` could appear inside
 *  a string literal. */
function statementsOf(sql) {
  return sql
    .replace(/^[ \t]*--.*$/gm, '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
}

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations')
const conn = await pool.getConnection()

await conn.query(`CREATE TABLE IF NOT EXISTS _migrations (
  name VARCHAR(191) NOT NULL PRIMARY KEY,
  applied_at DATETIME(3) NOT NULL,
  statements INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`)

const [cols] = await conn.query(`SELECT COUNT(*) n FROM information_schema.columns
  WHERE table_schema=DATABASE() AND table_name='_migrations' AND column_name='statements'`)
if (Number(cols[0].n) === 0) await conn.query('ALTER TABLE _migrations ADD COLUMN statements INT NOT NULL DEFAULT 0')

const [done] = await conn.query('SELECT name, applied_at FROM _migrations')
const applied = new Set(done.map((r) => r.name))
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
let ran = 0

for (const file of files) {
  if (applied.has(file)) {
    console.log(`  skip     ${file}  (applied ${formatIst(done.find((r) => r.name === file).applied_at)} IST)`)
    continue
  }
  const statements = statementsOf(readFileSync(join(dir, file), 'utf8'))
  if (statements.length === 0) throw new Error(`${file} parsed to 0 statements — refusing to record it as applied`)

  for (const [i, stmt] of statements.entries()) {
    try {
      await conn.query(stmt)
    } catch (err) {
      throw new Error(`${file} statement ${i + 1}/${statements.length} failed [${err.code}]: ${err.sqlMessage}\n  ${stmt.slice(0, 120)}...`)
    }
  }
  await conn.query('INSERT INTO _migrations (name, applied_at, statements) VALUES (?, ?, ?)',
    [file, toDbDateTime(nowUtc()), statements.length])
  console.log(`  applied  ${file}  (${statements.length} statement${statements.length === 1 ? '' : 's'})`)
  ran++
}

conn.release()
await closePool()
console.log(`\n${files.length} migration file(s) on disk, ${ran} newly applied.`)
