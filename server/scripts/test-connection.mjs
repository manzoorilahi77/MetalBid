/* Connectivity check for the FerroBid dev database.
   Reads server/.env, opens a connection, reports server version and table count. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import mysql from 'mysql2/promise'

const here = dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(join(here, '..', '.env'), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

if (!env.DB_HOST) {
  console.error('DB_HOST is empty in server/.env — set it to the database hostname or IP first.')
  process.exit(2)
}

console.log(`Connecting to ${env.DB_USER}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME} ...`)

try {
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    connectTimeout: 10_000,
  })
  const [[{ version }]] = await conn.query('SELECT VERSION() AS version')
  const [tables] = await conn.query(
    'SELECT table_name FROM information_schema.tables WHERE table_schema = ?',
    [env.DB_NAME],
  )
  console.log(`Connected. Server: ${version}`)
  console.log(`Tables in ${env.DB_NAME}: ${tables.length}`)
  if (tables.length) console.log(tables.map((t) => '  - ' + (t.table_name ?? t.TABLE_NAME)).join('\n'))
  await conn.end()
} catch (err) {
  console.error(`FAILED [${err.code ?? 'ERR'}] ${err.message}`)
  process.exit(1)
}
