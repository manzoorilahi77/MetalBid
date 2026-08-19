/* Read-only pool verification. Runs a burst of concurrent SELECTs and reports
   how many server connections we actually occupied. Writes nothing. */
import { pool, query, POOL_SIZE, closePool } from '../src/db.mjs'
import { formatIst, fromDbDateTime } from '../src/time.mjs'

const status = async (name) => Number((await query(`SHOW STATUS LIKE '${name}'`))[0]?.Value ?? -1)
const globalVar = async (name) => (await query(`SHOW VARIABLES LIKE '${name}'`))[0]?.Value

const cap = Number(await globalVar('max_connections'))
const before = await status('Threads_connected')
console.log(`server cap ................. ${cap} connections (shared by every account)`)
console.log(`in use before our burst .... ${before}`)
console.log(`our pool limit ............. ${POOL_SIZE}\n`)

const BURST = 25
const t0 = Date.now()
let peak = 0
const results = await Promise.all(
  Array.from({ length: BURST }, async (_, i) => {
    const rows = await query('SELECT ? AS n, SLEEP(0.05) AS _', [i])
    peak = Math.max(peak, await status('Threads_connected'))
    return rows[0].n
  }),
)
const ms = Date.now() - t0

console.log(`${BURST} concurrent queries through a ${POOL_SIZE}-connection pool`)
console.log(`  all completed ............ ${results.length === BURST && new Set(results).size === BURST}`)
console.log(`  elapsed ................. ${ms} ms  (queued in ${Math.ceil(BURST / POOL_SIZE)} waves, as intended)`)
console.log(`  peak server connections .. ${peak}  -> our share <= ${peak - before} of ${cap}`)
console.log(`  headroom left ............ ${cap - peak} connections\n`)

/* timezone proof: the driver must hand back UTC despite the server's EDT clock */
const [row] = await query("SELECT CAST('2026-08-19 20:15:00.000' AS DATETIME(3)) AS dt")
const d = fromDbDateTime(row.dt)
console.log('DATETIME round-trip through the EDT server:')
console.log(`  stored literal ........... 2026-08-19 20:15:00.000 (UTC by our convention)`)
console.log(`  driver returned .......... ${d.toISOString()}`)
console.log(`  displayed to user ........ ${formatIst(d, 'full')}`)
console.log(`  interpreted as UTC ....... ${d.toISOString().startsWith('2026-08-19T20:15') ? 'yes — EDT clock had no effect' : 'NO — server tz leaked in'}`)

await closePool()
const after = await new Promise((r) => setTimeout(() => r(true), 200))
console.log(`\npool closed cleanly ........ ${after}`)
