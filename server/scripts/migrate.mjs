/* Applies migrations/*.sql in filename order, recording each in _migrations
   so re-running is a no-op. Statements are split on ';' at end of line. */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pool, closePool } from '../src/db.mjs'
import { toDbDateTime, nowUtc, formatIst } from '../src/time.mjs'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations')
const conn = await pool.getConnection()

await conn.query(`CREATE TABLE IF NOT EXISTS _migrations (
  name VARCHAR(191) NOT NULL PRIMARY KEY,
  applied_at DATETIME(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`)

const [done] = await conn.query('SELECT name, applied_at FROM _migrations')
const applied = new Set(done.map((r) => r.name))
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()

for (const file of files) {
  if (applied.has(file)) {
    const at = done.find((r) => r.name === file).applied_at
    console.log(`  skip   ${file}  (applied ${formatIst(at)} IST)`)
    continue
  }
  const sql = readFileSync(join(dir, file), 'utf8')
  const statements = sql.split(/;\s*$/m).map((s) => s.trim()).filter((s) => s && !/^--/.test(s.replace(/\n--.*/g, '').trim()))
  for (const stmt of statements) await conn.query(stmt)
  await conn.query('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)', [file, toDbDateTime(nowUtc())])
  console.log(`  applied ${file}  (${statements.length} statement${statements.length === 1 ? '' : 's'})`)
}

conn.release()
await closePool()
console.log(`\n${files.length} migration file(s), ${files.length - applied.size} newly applied.`)
