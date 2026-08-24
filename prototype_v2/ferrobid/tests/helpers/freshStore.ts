import { vi } from 'vitest'

/** The store is a module-level singleton (`export const useStore = create(...)`),
 *  so importing it normally would leak mutations between test cases. Resetting
 *  the module registry and re-importing gives each test the same fresh,
 *  freshly-seeded store a real page load would — matching how
 *  scripts/verify-persistence.ts gets a clean store each run by being a fresh
 *  process. TypeScript infers the return type from the string-literal specifier,
 *  so it stays exactly `typeof useStore` with no manual type duplicated here. */
export async function freshStore() {
  vi.resetModules()
  const mod = await import('../../src/store/store')
  return mod.useStore
}
