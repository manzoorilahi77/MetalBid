/* Minimal .env reader — no dependency, no mutation of process.env.
 *
 * ENV_FILE overrides which file is read, relative to the server/ directory —
 * used by the integration test runner to point at .env.test instead of the
 * real .env, without touching anything else here. Unset in every other
 * context, so normal behavior (always reads server/.env) is unchanged. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const serverDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(serverDir, process.env.ENV_FILE ?? '.env')

export const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)
