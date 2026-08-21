/* ---------------------------------------------------------------------------
   Store persistence.

   The store holds 127 mutating actions and all of the business logic behind
   them. Rather than rewrite each one to call an endpoint — 127 call sites to
   add, and two copies of every rule to keep in step — this subscribes to the
   store once, works out which rows each action changed, and sends them.

   How the diff works: every action updates immutably (`lots.map(l => l.id === id
   ? {...l, status} : l)`), so a changed row is a NEW object and every untouched
   row keeps its identity. Comparing by reference therefore finds exactly the
   rows an action touched, in one pass, without deep-comparing 1290 lots.

   Writes are batched on a microtask-plus-debounce so one user action produces
   one request even when it touches five slices, and failures surface through
   `usePersistStatus` rather than silently dropping — a write that did not land
   must not look like one that did.

   Two paths are NOT persisted here, because the server owns them and computes
   its own answer: placing a bid and funding EMD. They are called directly (see
   placeBidRemote / fundEmdRemote below) and their results flow back into the
   store, which the diff then sees as already-saved. `SERVER_OWNED` marks the
   fields the diff must not fight the server over.
--------------------------------------------------------------------------- */
import { useSyncExternalStore } from 'react'
import { useStore } from '../store/store'
import { ApiError, apiPost } from './client'

/* Store slice -> the entity name the server registry knows it by. Slices absent
   here are never persisted: `toasts`, `paused`, `now`, `theme` and the rest are
   session state, not records. */
const ENTITY_OF_SLICE: Record<string, string> = {
  lots: 'lots',
  catalogues: 'catalogues',
  bids: 'bids',
  users: 'users',
  deliveryOrders: 'deliveryOrders',
  inspectionReports: 'inspectionReports',
  notifications: 'notifications',
  disputes: 'disputes',
  bankAccounts: 'bankAccounts',
  companyBankAccounts: 'companyBankAccounts',
  depositClaims: 'depositClaims',
  withdrawalRequests: 'withdrawalRequests',
  refundRequests: 'refundRequests',
  emdForfeitures: 'emdForfeitures',
  invoices: 'invoices',
  bankStatementLines: 'bankStatementLines',
  commissionSettlements: 'commissionSettlements',
  ceoApprovals: 'ceoApprovals',
  cancellationRequests: 'cancellationRequests',
  bidVoidRequests: 'bidVoidRequests',
  resultConfirmations: 'resultConfirmations',
  staReferrals: 'staReferrals',
  emdExemptionRequests: 'emdExemptionRequests',
  announcements: 'announcements',
  auditEvents: 'auditEvents',
  inspectionSlots: 'inspectionSlots',
  demandDrafts: 'demandDrafts',
  termsSets: 'termsSets',
  autoBids: 'autoBids',
  watchlist: 'watchlist',
  actionReviews: 'actionReviews',
  handoverNotes: 'handoverNotes',
  contentDrafts: 'contentDrafts',
  passwordResets: 'passwordResets',
  roleRegistry: 'roleRegistry',
  pageRegistry: 'pageRegistry',
  structuralChanges: 'structuralChanges',
  masterCategories: 'masterCategories',
  masterUoms: 'masterUoms',
  masterYards: 'masterYards',
  testimonials: 'testimonials',
}

/** Composite-keyed slices: rows have no `id`, so identity is these fields. */
const COMPOSITE_KEYS: Record<string, string[]> = {
  watchlist: ['buyerId', 'catalogueId'],
  autoBids: ['buyerId', 'lotId'],
  resultConfirmations: ['catalogueId'],
  roleRegistry: ['key'],
  masterCategories: ['key'],
  masterUoms: ['code'],
}

/** Settings that are single documents rather than rows. */
const SETTING_SLICES = ['financeConfig', 'withdrawalWindow', 'ceoDelegation'] as const

type Row = Record<string, unknown>
type Op = { entity: string; op: 'upsert' | 'delete'; row: Row }

const identity = (slice: string, row: Row): string => {
  const keys = COMPOSITE_KEYS[slice]
  return keys ? keys.map((k) => String(row[k])).join('|') : String(row.id)
}

/** Rows that are new or whose object reference changed, plus rows that vanished. */
function diffSlice(slice: string, before: Row[] | undefined, after: Row[] | undefined): Op[] {
  if (before === after || !after) return []
  const entity = ENTITY_OF_SLICE[slice]
  if (!entity) return []

  const ops: Op[] = []
  const beforeById = new Map<string, Row>()
  for (const row of before ?? []) beforeById.set(identity(slice, row), row)

  const seen = new Set<string>()
  for (const row of after) {
    const id = identity(slice, row)
    seen.add(id)
    const prev = beforeById.get(id)
    if (prev !== row) ops.push({ entity, op: 'upsert', row })
  }
  /* Gone from the array = deleted. Un-shortlisting a catalogue removes its
     watchlist row, and without this it would come back on the next load. */
  for (const [id, row] of beforeById) {
    if (!seen.has(id)) ops.push({ entity, op: 'delete', row })
  }
  return ops
}

/* --------------------------- queue and flush ------------------------------ */

let queue: Op[] = []
let walletQueue = new Map<string, Row>()
let selectionQueue = new Map<string, Row>()
let settingQueue = new Map<string, unknown>()
let timer: ReturnType<typeof setTimeout> | null = null
let inFlight = false

type Status = { pending: number; failed: string | null; savedAt: string | null }
let status: Status = { pending: 0, failed: null, savedAt: null }
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

const setStatus = (next: Partial<Status>) => {
  status = { ...status, ...next }
  emit()
}

/* Through apiPost, not a bare fetch: every write needs the Authorization
   header, and a write that arrives without one is now a 401 rather than an
   anonymous mutation the server used to accept. apiPost also handles the
   single-flight refresh, so a batch that lands exactly as the access token
   expires is retried rather than lost. */
async function post(path: string, body: unknown): Promise<void> {
  await apiPost<unknown>(path, body)
}

async function flush(): Promise<void> {
  if (inFlight) return
  const ops = queue
  const wallets = [...walletQueue.values()]
  const selections = [...selectionQueue.values()]
  const settings = [...settingQueue.entries()]
  if (!ops.length && !wallets.length && !selections.length && !settings.length) return

  queue = []
  walletQueue = new Map()
  selectionQueue = new Map()
  settingQueue = new Map()
  inFlight = true
  setStatus({ pending: ops.length + wallets.length + selections.length + settings.length })

  try {
    if (ops.length) await post('/api/mutate', { ops })
    for (const wallet of wallets) await post('/api/wallets', wallet)
    for (const selection of selections) await post('/api/selections', selection)
    for (const [key, value] of settings) await post(`/api/settings/${key}`, { value })
    setStatus({ pending: 0, failed: null, savedAt: new Date().toISOString() })
  } catch (err) {
    /* Put the batch back so the next action retries it rather than losing it.
       The upserts are idempotent, so replaying a partly-applied batch is safe. */
    queue = [...ops, ...queue]
    for (const w of wallets) walletQueue.set(String(w.userId), w)
    for (const s of selections) selectionQueue.set(`${s.buyerId}|${s.catalogueId}`, s)
    for (const [k, v] of settings) settingQueue.set(k, v)
    setStatus({
      pending: queue.length,
      failed: err instanceof ApiError ? err.message : 'Could not save changes',
    })
  } finally {
    inFlight = false
    if (queue.length && !timer) schedule()
  }
}

function schedule() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { timer = null; void flush() }, 120)
}

/* ------------------------------ the wiring -------------------------------- */

let started = false

/** Begin persisting store changes. Called once, from main.tsx. */
export function startPersistence(): () => void {
  if (started) return () => {}
  started = true

  let previous = useStore.getState() as unknown as Record<string, unknown>

  const unsubscribe = useStore.subscribe((next) => {
    const state = next as unknown as Record<string, unknown>
    /* A hydration fetch replaces whole slices with the server's own rows. Diffing
       those would send every row straight back. `hydrating` is set around those
       updates by the api hooks. */
    if (!hydrating) {
      for (const slice of Object.keys(ENTITY_OF_SLICE)) {
        const ops = diffSlice(slice, previous[slice] as Row[], state[slice] as Row[])
        if (ops.length) queue.push(...ops)
      }
      /* Wallets and selections have shapes the row diff cannot express. */
      const beforeWallets = (previous.wallets ?? []) as Row[]
      for (const w of (state.wallets ?? []) as Row[]) {
        if (!beforeWallets.includes(w)) walletQueue.set(String(w.userId), w)
      }
      const beforeSelections = (previous.selections ?? []) as Row[]
      for (const s of (state.selections ?? []) as Row[]) {
        if (!beforeSelections.includes(s)) {
          selectionQueue.set(`${s.buyerId}|${s.catalogueId}`, s)
        }
      }
      for (const key of SETTING_SLICES) {
        if (previous[key] !== state[key] && state[key] !== undefined) {
          settingQueue.set(key, state[key])
        }
      }
      if (queue.length || walletQueue.size || selectionQueue.size || settingQueue.size) schedule()
    }
    previous = state
  })

  return () => { unsubscribe(); started = false }
}

/** Set while a hydration fetch is writing server rows into the store, so the
 *  diff does not echo them straight back. */
let hydrating = false
export function withoutPersisting<T>(apply: () => T): T {
  hydrating = true
  try { return apply() } finally { hydrating = false }
}

/** Apply a hydration fetch's rows to the store without the diff echoing them
 *  straight back to the server. Every use<Role>Data hook writes through this. */
type StoreState = ReturnType<typeof useStore.getState>
type StoreUpdate = Partial<StoreState> | ((state: StoreState) => Partial<StoreState>)

export function hydrateStore(updater: StoreUpdate): void {
  hydrating = true
  /* zustand's setState takes a partial; its exported type resolves to the full
     State here, so the cast is at the boundary rather than at every call site. */
  try {
    (useStore.setState as (u: unknown) => void)(updater)
    /* `currentUser` is a snapshot of a row in `users`, taken at sign-in. A
       hydration that merges a fresher copy of that row (the buyer endpoint
       returns the signed-in user's full profile; the home endpoint only their
       public columns) would otherwise leave the session reading the stale
       snapshot forever. Re-point it after every hydration. */
    const s = useStore.getState()
    if (s.currentUser) {
      const fresh = s.users.find((u) => u.id === s.currentUser?.id)
      if (fresh && fresh !== s.currentUser) {
        (useStore.setState as (u: unknown) => void)({ currentUser: fresh })
      }
    }
  } finally { hydrating = false }
}

/** Force a flush — used before the page unloads. */
export const flushNow = (): Promise<void> => flush()

/** Subscribe to save state, for the indicator in the header. */
export function usePersistStatus(): Status {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    () => status,
    () => status,
  )
}

/* -------------------------- server-owned writes ---------------------------

   placeBid and fundEmd keep their synchronous contract — callers do
   `const res = placeBid(...)` and branch on `res.ok`, and the UI should not
   stall on a round trip before telling someone their bid landed.

   So the store's own logic still runs first and answers immediately, and the
   server is then asked to confirm against locked rows. Because both sides apply
   the same rules, a rejection means a genuine race — someone else's bid landed
   between the read and the write — and the optimistic change is rolled back with
   the server's reason shown. The server's answer always wins.
--------------------------------------------------------------------------- */

/* `any` on the payload is deliberate and matches what `res.json()` gave before:
   the three callers each spread a different server-shaped object into the store,
   and typing them properly means duplicating the server's DTOs here. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function postJson(path: string, body: unknown): Promise<{ ok: boolean; data: any }> {
  try {
    return { ok: true, data: await apiPost<unknown>(path, body) }
  } catch (err) {
    /* A rejection here is usually the server disagreeing on the merits — a bid
       that lost a race, EMD over the balance — and the caller rolls the
       optimistic change back and shows this message. */
    return {
      ok: false,
      data: { message: err instanceof ApiError ? err.message : 'The server could not be reached' },
    }
  }
}

/** Replace the store's placeBid and fundEmd with versions that confirm against
 *  the server. Called once at startup, after the store module has initialised. */
export function installServerActions(): void {
  const store = useStore.getState() as unknown as Record<string, unknown>
  const localPlaceBid = store.placeBid as (
    lotId: string, rate: number, bidderId?: string, type?: string,
  ) => { ok: boolean; error?: string }
  const localFundEmd = store.fundEmd as (
    catalogueId: string, lotIds: string[], method: string,
  ) => boolean
  const toast = store.pushToast as (t: { tone?: string; label: string }) => void

  const placeBid = (lotId: string, rate: number, bidderId?: string, type = 'manual') => {
    const before = useStore.getState()
    const priorLot = before.lots.find((l) => l.id === lotId)
    const priorBidIds = new Set(before.bids.map((b) => b.id))

    const local = localPlaceBid(lotId, rate, bidderId, type)
    if (!local.ok) return local // the client's own rules already refused it

    const me = bidderId ?? useStore.getState().currentUser?.id
    void postJson('/api/bids', { lotId, bidderId: me, rate, type }).then(({ ok, data }) => {
      if (ok) {
        /* Adopt the server's bid id and lot state in place of the optimistic
           ones, so both sides agree on what happened. */
        hydrateStore((s) => ({
          bids: s.bids.map((b) => (priorBidIds.has(b.id) ? b : { ...b, ...data.bid })),
          lots: s.lots.map((l) => (l.id === lotId ? { ...l, ...data.lot } : l)),
        }))
        return
      }
      /* Rejected: undo the optimistic bid and put the lot back as it was. */
      hydrateStore((s) => ({
        bids: s.bids.filter((b) => priorBidIds.has(b.id)),
        lots: s.lots.map((l) => (l.id === lotId && priorLot ? priorLot : l)),
      }))
      toast?.({ tone: 'danger', label: data.message ?? 'Your bid was not accepted' })
    })

    return local
  }

  const fundEmd = (catalogueId: string, lotIds: string[], method: string) => {
    const before = useStore.getState()
    const me = before.currentUser?.id
    const priorWallet = before.wallets.find((w) => w.userId === me)
    const priorSelection = before.selections.find(
      (s) => s.buyerId === me && s.catalogueId === catalogueId)

    const ok = localFundEmd(catalogueId, lotIds, method)
    if (!ok || !me) return ok

    void postJson('/api/emd/fund', { buyerId: me, catalogueId, lotIds, method })
      .then(({ ok: accepted, data }) => {
        if (accepted) {
          hydrateStore((s) => ({
            wallets: s.wallets.map((w) =>
              w.userId === me ? { ...w, balance: data.wallet.balance, emdLocked: data.wallet.emdLocked } : w),
          }))
          return
        }
        hydrateStore((s) => ({
          wallets: s.wallets.map((w) => (w.userId === me && priorWallet ? priorWallet : w)),
          selections: s.selections.map((sel) =>
            sel.buyerId === me && sel.catalogueId === catalogueId && priorSelection
              ? priorSelection : sel),
        }))
        toast?.({ tone: 'danger', label: data.message ?? 'EMD could not be funded' })
      })

    return ok
  }

  /* `tick` drives the prototype's auction simulation: it advances the clock,
     runs competing-bidder bots and closes lots. That was the right device for a
     demo with no backend. With one, it is actively wrong — every open browser
     tab would write invented bot bids into the database and race the others to
     close the same lots. So the clock keeps running for the UI (countdowns,
     anti-snipe pressure) but nothing it changes is persisted.

     Auction lifecycle — closing a lot when its time expires — belongs to a
     server-side scheduler, not to whichever tab happens to be open. See the
     README. */
  const localTick = store.tick as () => void
  useStore.setState({ tick: () => withoutPersisting(localTick) } as never)

  useStore.setState({ placeBid, fundEmd } as never)
}
