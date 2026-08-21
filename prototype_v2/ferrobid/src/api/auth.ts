/* ---------------------------------------------------------------------------
   Signing in, for real.

   The prototype's sign-in was a lookup in `DEMO_LOGINS` with the password check
   switched off, which was right for a prototype and is not right for anything
   holding money. This talks to /api/auth, which hashes with scrypt, throttles by
   account and by address, and hands back a token.

   The store still owns "who is signed in" for rendering — every screen reads
   `currentUser` and `role` from it. What changes is where those values come
   from: the server's answer, rather than a map in the bundle.
--------------------------------------------------------------------------- */
import {
  apiGet, apiPost, setSession, getSession, restoreSession, ApiError,
  stashCurrentAsImpersonator, restoreImpersonator, readImpersonatorSnapshot,
} from './client'
import type { Session } from './client'

export interface AuthResult {
  ok: boolean
  role?: string
  userId?: string
  mustChangePassword?: boolean
  error?: string
}

interface LoginResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: { id: string; name: string; role: string }
  mustChangePassword?: boolean
}

export interface MeResponse {
  user: {
    id: string; name: string; firm: string | null; phone: string | null; email: string | null
    role: string; status: string; kycStatus: string; sellerVerified: boolean; standing: string
    city: string | null; gstin: string | null; avatarHue: number; bidderId: string | null
    joinedAt: string | null; lastLoginAt: string | null
    mustChangePassword: boolean; passwordSetAt: string | null
  }
  sessions: {
    id: string; issuedAt: string; lastUsedAt: string | null; expiresAt: string
    userAgent: string | null; ip: string | null
  }[]
}

/** Sign in. On success the session is live and every later request carries it. */
export async function signIn(identifier: string, password: string): Promise<AuthResult> {
  try {
    const data = await apiPost<LoginResponse>('/api/auth/login', {
      identifier: identifier.trim().toLowerCase(),
      password,
    })
    setSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: Date.now() + data.expiresIn * 1000,
      user: data.user,
    })
    return {
      ok: true,
      role: data.user.role,
      userId: data.user.id,
      mustChangePassword: !!data.mustChangePassword,
    }
  } catch (err) {
    /* The server deliberately returns one message for every way a sign-in can
       fail. Pass it through rather than inventing a more specific one here —
       "no such account" would undo the whole point of that. */
    const message = err instanceof ApiError
      ? (err.status === 0
        ? 'Cannot reach the server. Check your connection and try again.'
        : err.message)
      : 'Something went wrong signing in'
    return { ok: false, error: message }
  }
}

/**
 * "Log in as" — a Sub/Super Admin opening another account's session, minted
 * by the server with no password involved. See auth.mjs's `impersonate` for
 * which roles may be a target; the server is the one enforcing it, this is
 * only where the current tab's session gets swapped.
 */
export async function impersonate(userId: string): Promise<AuthResult> {
  try {
    const data = await apiPost<LoginResponse>('/api/auth/impersonate', { userId })
    /* Save the admin's own session before overwriting it — stashCurrentAsImpersonator
       reads whatever `getSession()` currently returns, so this has to run first. */
    stashCurrentAsImpersonator()
    setSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: Date.now() + data.expiresIn * 1000,
      user: data.user,
    })
    return { ok: true, role: data.user.role, userId: data.user.id }
  } catch (err) {
    const message = err instanceof ApiError
      ? (err.status === 0 ? 'Cannot reach the server. Check your connection and try again.' : err.message)
      : 'Something went wrong signing in as that account'
    return { ok: false, error: message }
  }
}

/** Whether the tab is mid-impersonation right now — an admin session is
 *  parked, waiting to be restored. */
export const isImpersonating = (): boolean => !!readImpersonatorSnapshot()

/** End impersonation: restore the admin's own session and sign the borrowed
 *  one out everywhere else it might still be live. Returns the restored
 *  session's user, or null if there was nothing to restore (the caller should
 *  fall back to a real sign-out). */
export async function endImpersonation(): Promise<{ id: string; role: string; name: string } | null> {
  const borrowed = getSession()
  const restored = await restoreImpersonator()
  if (!restored) return null
  /* Best-effort: the admin is already back in their own session by this
     point, so a failure here leaves an orphaned but harmless refresh token
     rather than blocking the return. */
  if (borrowed) void apiPost('/api/auth/logout', { refreshToken: borrowed.refreshToken }).catch(() => {})
  return restored.user
}

/** Sign out. `everywhere` also ends the sessions on other devices. */
export async function signOut(everywhere = false): Promise<void> {
  const session = getSession()
  try {
    await apiPost('/api/auth/logout', { refreshToken: session?.refreshToken, everywhere })
  } catch {
    /* A failed sign-out on the server must still clear the client: the user
       asked to be signed out, and leaving a token in the browser because the
       network blipped is the wrong way to fail. */
  }
  setSession(null)
}

/** The signed-in account, from the server. Used at boot and after a change. */
export const fetchMe = (): Promise<MeResponse> => apiGet<MeResponse>('/api/auth/me')

/** Change a password. Ends other sessions unless asked not to. */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
  keepOtherSessions = false,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const data = await apiPost<LoginResponse>('/api/auth/password', {
      currentPassword, newPassword, keepOtherSessions,
    })
    /* The server rotates the token version on a password change, so the token
       we are holding is already dead. Adopt the one it just handed back. */
    setSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: Date.now() + data.expiresIn * 1000,
      user: data.user,
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : 'Could not change the password' }
  }
}

/**
 * Restore a session at boot, then confirm it is still good.
 *
 * `restoreSession` only proves the refresh token was accepted; `fetchMe` proves
 * the account behind it is still active and returns what the store needs to
 * render as that person.
 */
export async function bootstrapSession(): Promise<MeResponse | null> {
  const session: Session | null = await restoreSession()
  if (!session) return null
  try {
    return await fetchMe()
  } catch {
    setSession(null)
    return null
  }
}
