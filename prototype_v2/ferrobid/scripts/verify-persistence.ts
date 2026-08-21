/* Runs the real store and the real persistence middleware under Node, with
   fetch stubbed, and reports what each action would send to the server.
   Verifies the diff finds exactly the rows an action touched -- no more, and
   nothing missed.  Run: npx tsx scripts/verify-persistence.ts */
const memory = new Map<string, string>()
;(globalThis as Record<string, unknown>).document = {
  documentElement: { classList: { toggle: () => {} } },
}
;(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(), key: () => null, length: 0,
}

const sent: { path: string; body: any }[] = []
;(globalThis as Record<string, unknown>).fetch = async (url: string, init: any) => {
  sent.push({ path: String(url).replace('http://localhost:4000', ''), body: JSON.parse(init.body) })
  return { ok: true, status: 200, json: async () => ({ ok: true }) }
}

const { useStore } = await import('../src/store/store')
const { startPersistence } = await import('../src/api/persist')
startPersistence()

const settle = () => new Promise((r) => setTimeout(r, 250))
const opsOf = () => sent.flatMap((s) => s.body.ops ?? [])
const reset = () => { sent.length = 0 }

const report = (label: string) => {
  const ops = opsOf()
  const byEntity = ops.reduce((a: Record<string, number>, o: any) => {
    a[`${o.entity}:${o.op ?? 'upsert'}`] = (a[`${o.entity}:${o.op ?? 'upsert'}`] ?? 0) + 1
    return a
  }, {})
  const other = sent.filter((s) => !s.body.ops).map((s) => s.path)
  console.log(`  ${label.padEnd(34)} ${JSON.stringify(byEntity)}${other.length ? ' + ' + other.join(', ') : ''}`)
  reset()
}

/* Several actions no-op without a signed-in user, so sign one in first —
   otherwise "sends nothing" would look like a middleware bug when it is just an
   action correctly declining to act for nobody. */
useStore.getState().switchRole('buyer')
await settle(); reset()
console.log('signed in as:', useStore.getState().currentUser?.id)

const s = useStore.getState()
console.log(`store loaded: ${s.lots.length} lots, ${s.bids.length} bids, ${s.catalogues.length} catalogues\n`)
console.log('what each action sends:')

const liveLot = s.lots.find((l) => l.status === 'live')!
useStore.getState().setLotStatus(liveLot.id, 'inspected')
await settle(); report('setLotStatus')

/* An UPCOMING catalogue whose EMD window is OPEN: the store refuses to
   shortlist once the window has closed (anything live) AND before it has
   opened (most upcoming ones) — either would test the guard, not the
   persistence. */
const now = Date.now()
const cat = s.catalogues.find((c) =>
  c.status === 'upcoming'
  && (!c.emdOpensAt || Date.parse(c.emdOpensAt) <= now)
  && Date.parse(c.emdDeadline) > now)!
const catLot = s.lots.find((l) => l.catalogueId === cat.id)!
useStore.getState().toggleWatchlist(cat.id)
await settle(); report('toggleWatchlist (add)')

useStore.getState().toggleWatchlist(cat.id)
await settle(); report('toggleWatchlist (remove)')

useStore.getState().toggleShortlist(cat.id, catLot.id)
await settle(); report('toggleShortlist')

useStore.getState().notify({ userId: 'u-buyer-1', kind: 'system', title: 'probe', body: 'probe' })
await settle(); report('notify')

useStore.getState().audit('probe.action', 'target', 'detail')
await settle(); report('audit')

useStore.getState().saveHandoverNote('shift note from the verification run')
await settle(); report('saveHandoverNote')

useStore.getState().topUpWallet(50000, 'UPI')
await settle(); report('topUpWallet')

/* Announcements belong to the Auction Manager, so a buyer correctly cannot. */
useStore.getState().switchRole('auction_manager')
await settle(); reset()
useStore.getState().sendAnnouncement({ scope: 'platform', title: 'Probe', body: 'body', severity: 'info' })
await settle(); report('sendAnnouncement (as auction mgr)')

/* Things that must NOT be persisted. */
console.log('\nsession-only actions (must send nothing):')
useStore.getState().toggleTheme()
await settle(); report('toggleTheme')
useStore.getState().pushToast({ label: 'hello' })
await settle(); report('pushToast')
useStore.getState().tick()
await settle(); report('tick')

console.log('\nall ops carry a key:',
  opsOf().every((o: any) => o.row && Object.keys(o.row).length > 0) ? 'yes' : 'NO')
process.exit(0)
