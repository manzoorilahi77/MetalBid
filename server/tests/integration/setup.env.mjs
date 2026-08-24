/* Preloaded via `node --import` before any test file (and therefore before
 * src/env.mjs or src/db.mjs) runs — see the test:integration script in
 * package.json. Points the whole process at .env.test's local, disposable
 * MySQL instance instead of the real server/.env, without touching anything
 * env.mjs did before this phase beyond the ENV_FILE override itself. */
process.env.ENV_FILE = '.env.test'
