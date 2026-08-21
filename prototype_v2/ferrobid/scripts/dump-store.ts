/* ---------------------------------------------------------------------------
   Dumps the prototype store's fully-seeded state to JSON, for loading into the
   database.

   Why not read src/data/mock/*.json directly: the store does not just load
   those files. It synthesises records that exist in no fixture at all --
   seedEmdExemptions(), the seeded bank accounts, deposit claims and withdrawal
   requests, the bid flags, and the weighment witness stamped onto delivery
   orders. Seeding the database from the raw fixtures would silently drop every
   one of them, and the screens that read them would come up empty.

   So the store itself is the source of truth: we run its seed in Node and dump
   what it produced. Timestamps are already rebased to "now" by the store, so
   the loader must NOT shift them again.

   Run with:  npx tsx scripts/dump-store.ts
--------------------------------------------------------------------------- */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/* The store reads localStorage at module scope for the remembered theme and
   role. Both are browser-only; a minimal shim lets the module initialise under
   Node without touching the store's own code. */
const memory = new Map<string, string>()
const shim = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: () => null,
  length: 0,
}
;(globalThis as Record<string, unknown>).localStorage = shim

const { useStore } = await import('../src/store/store')
const state = useStore.getState() as unknown as Record<string, unknown>

/* Only data, never functions, the live clock, or transient UI state. */
const SKIP = new Set(['now', 'toasts', 'paused', 'theme', 'role', 'currentUser', 'workClaims', 'serverStatus'])

const data: Record<string, unknown> = {}
for (const [key, value] of Object.entries(state)) {
  if (typeof value === 'function' || SKIP.has(key)) continue
  data[key] = value
}

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', '..', '..', 'server', 'seed-data', 'store-dump.json')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(data, null, 1))

const rows = (v: unknown) => (Array.isArray(v) ? v.length : typeof v === 'object' && v ? 'object' : typeof v)
const widest = Math.max(...Object.keys(data).map((k) => k.length))
for (const [k, v] of Object.entries(data).sort()) console.log(`  ${k.padEnd(widest)}  ${rows(v)}`)
console.log(`\nwrote ${out}`)
