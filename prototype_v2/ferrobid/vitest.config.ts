import { defineConfig } from 'vite'

/* Separate from vite.config.ts on purpose: the app build must not carry test-only
   settings, and tests must not carry the app's plugins (react/tailwind) it does not
   need. VITE_LOCAL_SEED is forced on so the store seeds itself with real data under
   test, the same path scripts/verify-persistence.ts and scripts/dump-store.ts already
   rely on when run under plain Node — vitest instead runs files through Vite, where
   `import.meta.env` is always defined, so the store's own `typeof import.meta.env ===
   'undefined'` local-seed check would otherwise read false and every test would see
   an empty, unseeded store. */
export default defineConfig({
  define: {
    'import.meta.env.VITE_LOCAL_SEED': JSON.stringify('1'),
  },
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
    // Each test file re-imports and re-transforms the ~5,500-line store module
    // per test case (see tests/helpers/freshStore.ts). Running many files'
    // worker forks at once starves this machine rather than speeding things up
    // — sequential file execution is slower per-file but far more reliable.
    fileParallelism: false,
  },
})
