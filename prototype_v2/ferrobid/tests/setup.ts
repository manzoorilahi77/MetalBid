/* ---------------------------------------------------------------------------
   Minimal browser shim for running the real store under Node, matching the
   pattern already used by scripts/verify-persistence.ts and scripts/dump-store.ts
   (which are what produce the database's seeded contents in the first place).
   Characterization tests import the actual store — not a mock of it — so this
   is the same shim, just reusable across test files via vitest's setupFiles.
--------------------------------------------------------------------------- */
const memory = new Map<string, string>()

;(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: () => null,
  length: 0,
}

;(globalThis as Record<string, unknown>).document = {
  documentElement: { classList: { toggle: () => {} } },
}

/* Nothing in a characterization test should reach the network — the store's
   actions that do (signInRemote, adoptSession's callers, etc.) are exercised
   with the offline `switchRole`/`login` paths instead, exactly as
   verify-persistence.ts does. A stub is still provided so an unexpected call
   fails loudly in the test rather than hanging or throwing an unrelated error. */
;(globalThis as Record<string, unknown>).fetch = async () => {
  throw new Error('characterization tests must not reach the network — use switchRole/login, not signInRemote')
}
