/* ---------------------------------------------------------------------------
   API client.

   The store starts EMPTY in the browser and the database is the only source of
   data: the bootstrap fetch (useHomeData, mounted in App) fills the public
   surface, and each role layout's hook fetches its own workspace and merges it
   in. No server means empty screens that say so — never fixture data.

   This module also owns the session, because every request needs it:

   * The ACCESS token is short-lived and sent as `Authorization: Bearer`. It is
     held in memory, not in storage, so a script that reads localStorage cannot
     lift a working credential.

   * The REFRESH token is long-lived and therefore has to survive a reload, so
     it does live in localStorage. That is a real trade — an XSS could steal it
     — and the mitigations are on the server: it rotates on every use, and a
     token presented twice kills the whole family (see auth/sessions.mjs). If
     the API is ever served same-origin with this app, move it to an httpOnly
     cookie and delete `readStoredRefresh` below.

   * A 401 triggers ONE refresh, shared by every request that hit the wall at
     the same time, and the original requests are then retried once. Without the
     single-flight, a page that fires eight parallel fetches on mount would fire
     eight refreshes, and rotation would make seven of them look like replays —
     which would sign the user out for loading a page.
--------------------------------------------------------------------------- */

/* Optional chaining because this module is also imported by the Node-based
   persistence test, where import.meta.env does not exist. */
export const API_BASE: string =
  (import.meta.env?.VITE_API_URL as string | undefined) ?? 'http://localhost:4000'

const REFRESH_KEY = 'ferrobid.refresh'

export class ApiError extends Error {
  /* Declared explicitly rather than as a constructor parameter property —
     tsconfig runs with erasableSyntaxOnly, which forbids that shorthand. */
  status: number
  code: string | undefined
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/* ------------------------------- session --------------------------------- */

export interface Session {
  accessToken: string
  refreshToken: string
  expiresAt: number          // epoch ms, for the access token
  user: { id: string; role: string; name: string }
}

let session: Session | null = null
const sessionListeners = new Set<(s: Session | null) => void>()

export function getSession(): Session | null { return session }

export function setSession(next: Session | null): void {
  session = next
  try {
    if (next?.refreshToken) localStorage.setItem(REFRESH_KEY, next.refreshToken)
    else localStorage.removeItem(REFRESH_KEY)
  } catch {
    /* Private browsing, or storage disabled. The session still works for this
       tab; it just will not survive a reload. */
  }
  sessionListeners.forEach((l) => l(next))
}

export function onSessionChange(fn: (s: Session | null) => void): () => void {
  sessionListeners.add(fn)
  return () => sessionListeners.delete(fn)
}

export function readStoredRefresh(): string | null {
  try { return localStorage.getItem(REFRESH_KEY) } catch { return null }
}

/* ---------------------------- impersonation -------------------------------
   "Log in as" swaps the live session for the target's, but the admin who did
   it has to get back without typing a password again. Their own session is
   saved here — sessionStorage, not localStorage, so it never survives past
   this tab and can't be lifted by anything that reads the persisted refresh
   token — and restored on exit. Surviving a reload mid-impersonation is the
   whole reason this isn't just a JS variable: a support person hitting F5
   should not be stranded as the account they were checking. */

const IMPERSONATOR_KEY = 'ferrobid.impersonator'

export interface ImpersonatorSnapshot {
  refreshToken: string
  user: { id: string; role: string; name: string }
}

export function readImpersonatorSnapshot(): ImpersonatorSnapshot | null {
  try {
    const raw = sessionStorage.getItem(IMPERSONATOR_KEY)
    return raw ? (JSON.parse(raw) as ImpersonatorSnapshot) : null
  } catch { return null }
}

/** Save the current session as the one to return to, then adopt the target's.
 *  Call sites are expected to have already set `session` to the target via
 *  `setSession` — see `impersonate()` in `auth.ts`, the one place this runs. */
export function stashCurrentAsImpersonator(): void {
  if (!session) return
  try {
    sessionStorage.setItem(IMPERSONATOR_KEY,
      JSON.stringify({ refreshToken: session.refreshToken, user: session.user }))
  } catch { /* private browsing, or storage disabled — exit will fall back to a real sign-out */ }
}

/** Exchange the saved admin session for a fresh one and adopt it. Null means
 *  there was nothing to return to, or the saved token no longer works — either
 *  way the caller falls back to signing out. */
export async function restoreImpersonator(): Promise<Session | null> {
  const saved = readImpersonatorSnapshot()
  if (!saved) return null
  try { sessionStorage.removeItem(IMPERSONATOR_KEY) } catch { /* best effort */ }

  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: saved.refreshToken }),
  })
  if (!res.ok) return null
  const data = await res.json()
  const next: Session = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + (data.expiresIn ?? 900) * 1000,
    user: data.user,
  }
  setSession(next)
  return next
}

/* ------------------------------- refresh --------------------------------- */

let refreshInFlight: Promise<Session | null> | null = null

/** Exchange the stored refresh token for a new session. Single-flight. */
export function refreshSession(): Promise<Session | null> {
  if (refreshInFlight) return refreshInFlight

  const token = session?.refreshToken ?? readStoredRefresh()
  if (!token) return Promise.resolve(null)

  /* Snapshot so a stale exchange can tell it has been overtaken. A manual
     sign-in can complete while this request is still on the wire — most often
     the boot-time restore below racing a real sign-in made from Login before
     it resolves. If the session changed while we were waiting, that other
     result is the one that actually happened; applying ours on top (success
     or failure alike) would silently discard a session that is live and
     working, and a failure would sign the person straight back out again. */
  const startedWith = session

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
      })
      if (session !== startedWith) return session
      if (!res.ok) { setSession(null); return null }
      const data = await res.json()
      const next: Session = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: Date.now() + (data.expiresIn ?? 900) * 1000,
        user: data.user,
      }
      setSession(next)
      return next
    } catch {
      /* A network failure is not an expired session — keep what we have and let
         the caller surface the outage. Clearing here would sign somebody out
         because their wifi dropped. */
      return session
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

/** Called once at boot: turn a stored refresh token back into a live session. */
export async function restoreSession(): Promise<Session | null> {
  if (session) return session
  if (!readStoredRefresh()) return null
  return refreshSession()
}

/* ------------------------------- requests -------------------------------- */

async function authHeaders(): Promise<Record<string, string>> {
  /* Refresh a few seconds early rather than waiting for the 401: it saves a
     round trip on every request made near the expiry boundary. */
  if (session && session.expiresAt - Date.now() < 5_000) await refreshSession()
  return session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}
}

async function request<T>(path: string, init: RequestInit, retry = true): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...(await authHeaders()), ...(init.headers ?? {}) },
    })
  } catch {
    // Network-level failure: server down, DNS, CORS rejection.
    throw new ApiError(`Cannot reach the API at ${API_BASE}`, 0)
  }

  if (res.status === 401 && retry) {
    const refreshed = await refreshSession()
    if (refreshed) return request<T>(path, init, false)
  }

  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new ApiError(
      detail?.message ?? `${path} returned ${res.status}`,
      res.status,
      detail?.error,
    )
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { method: 'GET', signal })
}

export function apiPost<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' })
}

/**
 * Upload one file.
 *
 * Raw bytes with the name in a header — the server takes uploads that way so it
 * needs no multipart parser. See api/uploads.mjs.
 */
export async function apiUpload(
  file: File,
  opts: { kind: string; entityType?: string; entityId?: string; altText?: string },
): Promise<{ id: string; url: string; filename: string; mime: string; bytes: number }> {
  const params = new URLSearchParams({ kind: opts.kind })
  if (opts.entityType) params.set('entityType', opts.entityType)
  if (opts.entityId) params.set('entityId', opts.entityId)
  if (opts.altText) params.set('altText', opts.altText)

  return request(`/api/uploads?${params}`, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      /* Header values must be latin-1; a filename with an em dash or Devanagari
         in it would otherwise throw before the request is even sent. */
      'X-Filename': file.name.replace(/[^\x20-\x7E]/g, '_'),
    },
    body: file,
  })
}
