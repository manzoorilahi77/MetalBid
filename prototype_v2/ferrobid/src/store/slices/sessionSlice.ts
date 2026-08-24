import {
  signIn as remoteSignIn, signOut as remoteSignOut, fetchMe,
  impersonate as remoteImpersonate, endImpersonation as remoteEndImpersonation,
} from '../../api/auth'
import { readImpersonatorSnapshot } from '../../api/client'
import { withoutPersisting } from '../../api/persist'
import { uid, genBidderId, genSellerId } from '../../lib/format'
import {
  BREAK_GLASS_ID, BREAK_GLASS_PASSWORD, DEMO_LOGINS, DEMO_PASSWORD, ENFORCE_LOGIN_PASSWORD,
  ROLE_DEMO_USER, ROLE_LABEL, isAnonymousRole, rememberRole, userFromMe,
} from '../constants'
import type { StoreGet, StoreSet, InternalHelpers } from '../internal'
import type { State } from '../types'
import type { Role, User } from '../../types'

export const createSessionSlice = (
  set: StoreSet, get: StoreGet, helpers: InternalHelpers,
): Pick<State,
  'toggleTheme' | 'switchRole' | 'signIn' | 'signInRemote' | 'adoptSession' | 'sessionResolved'
  | 'impersonateUser' | 'endImpersonation' | 'login' | 'logout' | 'registerAccount'
> => ({
  /* ------------------------------ session ----------------------------- */
  toggleTheme: () => {
    const theme = get().theme === 'dark' ? 'light' : 'dark'
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
    set({ theme })
  },
  switchRole: (role) => {
    rememberRole(role)
    // The public shells are unauthenticated — no demo identity behind them
    if (isAnonymousRole(role)) {
      set({ role, currentUser: null })
      return
    }
    /* Changing which workspace is on screen must never change WHO you are.
       This used to look up ROLE_DEMO_USER[role] and adopt that person —
       which handed the caller a real account's name and id with no session
       behind it, so every request made as them came back 401 while the
       header cheerfully greeted them by the borrowed name. Whoever is
       actually signed in stays signed in; if that is nobody, it stays
       nobody, and the screen honestly says so. */
    withoutPersisting(() => set({ role }))
  },
  signIn: (username, password) => {
    const id = username.trim().toLowerCase()
    /* Break-glass is checked first and always returns, so the hidden account
       never falls through to the ordinary lookup: a wrong password reads
       exactly like an email nobody has ever registered. */
    if (id === BREAK_GLASS_ID) {
      if (password !== BREAK_GLASS_PASSWORD) return { ok: false, error: 'Unknown user ID' }
      rememberRole('super_admin')
      set({ role: 'super_admin', currentUser: get().users.find((u) => u.id === ROLE_DEMO_USER['super_admin']) ?? null })
      return { ok: true, role: 'super_admin' }
    }
    const demoRole = DEMO_LOGINS[id]
    /* Accounts a Super Admin created sign in by their own ID, not by the demo
       map — otherwise "create a Sub Admin" would create somebody who cannot
       get in. */
    /* `?? ''`: rows hydrated from the API carry only the public columns, so a
       rival buyer's email is genuinely absent — never crash the lookup on it. */
    const account = demoRole
      ? get().users.find((u) => u.id === ROLE_DEMO_USER[demoRole]) ?? null
      : get().users.find((u) => u.username === id || (u.email ?? '').toLowerCase() === id) ?? null
    const role = demoRole ?? account?.role
    if (!role || (!demoRole && !account)) return { ok: false, error: 'Unknown user ID' }
    /* The only door into Super Admin is the break-glass pair above. Signing in
       as the seeded HQ account by its own email would leak that the role is
       there at all, so that path is closed with the same blank answer. */
    if (role === 'super_admin') return { ok: false, error: 'Unknown user ID' }
    // Password check is disabled for now (ENFORCE_LOGIN_PASSWORD = false).
    if (ENFORCE_LOGIN_PASSWORD && password !== DEMO_PASSWORD) {
      return { ok: false, error: 'Incorrect password' }
    }
    /* Suspending an account is only real if it stops the sign-in. Removing a
       role suspends everyone holding it, so this is also what makes a role
       removal take effect for the people who held it. */
    const status = account?.accountStatus ?? 'active'
    if (status !== 'active') {
      return {
        ok: false,
        error: status === 'banned'
          ? 'This account has been closed. Contact support if you believe that is a mistake.'
          : `This account is ${status}. Ask a Super Admin to reinstate it.`,
      }
    }
    /* Adopting the demo user is spelled out here rather than left to
       switchRole, which deliberately no longer changes identity — see its
       comment. This action is the offline demo path and is the one place
       that borrowing is intended. */
    if (demoRole) {
      rememberRole(demoRole)
      const demoUser = get().users.find((u) => u.id === ROLE_DEMO_USER[demoRole]) ?? null
      set({ role: demoRole, currentUser: demoUser })
    } else if (account) { rememberRole(account.role); set({ role: account.role, currentUser: account }) }

    /* A password issued by support is spent the moment it is used. Whether
       they keep it or set their own is their choice, on the next screen. */
    const openReset = get().passwordResets.find((r) => r.userId === account?.id && !r.consumed)
    if (openReset) {
      set((st) => ({ passwordResets: st.passwordResets.map((r) => (r.id === openReset.id ? { ...r, consumed: true } : r)) }))
      get().pushToast({
        kind: 'info', title: 'You signed in with a password support issued',
        body: 'Keep it, or set your own from Profile & settings.',
      })
    }
    if (account) {
      set((st) => ({
        users: st.users.map((u) => (u.id === account.id ? { ...u, lastActiveAt: new Date(st.now).toISOString() } : u)),
      }))
    }
    return { ok: true, role }
  },
  signInRemote: async (identifier, password) => {
    const result = await remoteSignIn(identifier, password)
    if (!result.ok || !result.role) return { ok: false, error: result.error }

    /* The server is the authority on who this is. Ask it, rather than
       trusting the role that came back with the token — the token says what
       the account was when it was minted, `me` says what it is now. */
    const me = await fetchMe().catch(() => null)
    if (!me) return { ok: false, error: 'Signed in, but your profile could not be loaded' }

    const user = userFromMe(me)
    get().adoptSession(user)
    return { ok: true, role: user.role, mustChangePassword: !!me.user.mustChangePassword }
  },
  impersonateUser: async (userId) => {
    if (!get().currentUser) return { ok: false, error: 'Sign in first' }

    /* remoteImpersonate stashes the admin's own session to sessionStorage
       before swapping — see stashCurrentAsImpersonator in client.ts — so by
       the time adoptSession runs below, readImpersonatorSnapshot() already
       finds it and sets `impersonatedBy` on its own. */
    const result = await remoteImpersonate(userId)
    if (!result.ok || !result.role) return { ok: false, error: result.error }

    const me = await fetchMe().catch(() => null)
    if (!me) return { ok: false, error: 'Signed in as that account, but its profile could not be loaded' }

    get().adoptSession(userFromMe(me))
    return { ok: true }
  },
  endImpersonation: async () => {
    /* remoteEndImpersonation removes the sessionStorage stash before handing
       back the restored admin session, so adoptSession below finds nothing
       parked and clears `impersonatedBy` on its own. */
    const admin = await remoteEndImpersonation()
    if (!admin) return { ok: false }

    const me = await fetchMe().catch(() => null)
    if (!me) {
      /* The token already switched back inside remoteEndImpersonation even
         though this couldn't confirm the profile — don't leave the banner
         pointing at a session that no longer exists. A reload finishes the
         job via the normal boot restore. */
      withoutPersisting(() => set({ impersonatedBy: null }))
      return { ok: false }
    }

    get().adoptSession(userFromMe(me))
    return { ok: true }
  },
  sessionResolved: () => withoutPersisting(() => set({ sessionStatus: 'ready' })),
  adoptSession: (user) => {
    rememberRole(user.role)
    /* Sourced from sessionStorage, not tracked separately: whether this
       session is a borrowed one is exactly whether an admin session is
       parked to return to, and that is true after impersonateUser, after a
       reload mid-impersonation, and false right after endImpersonation —
       which is also exactly when this needs to be true, true and false. */
    const parked = readImpersonatorSnapshot()
    withoutPersisting(() => set((st) => ({
      role: user.role,
      currentUser: user,
      sessionStatus: 'ready' as const,
      impersonatedBy: parked ? { id: parked.user.id, name: parked.user.name, role: parked.user.role as Role } : null,
      /* Merge rather than append: the workspace fetch will have loaded this
         account already on a reload, and two rows for one person would show
         up as a duplicate everywhere a user list is rendered. */
      users: st.users.some((u) => u.id === user.id)
        ? st.users.map((u) => (u.id === user.id ? { ...u, ...user } : u))
        : [...st.users, user],
    })))
  },
  login: (phone) => {
    const existing = get().users.find((u) => (u.phone ?? '').replace(/\D/g, '').endsWith(phone.replace(/\D/g, '').slice(-10)))
    const user = existing ?? get().users.find((u) => u.id === 'u-buyer-1')
    /* An empty store means the server never answered — there is nobody to
       sign in as, and crashing on it would turn "offline" into "broken". */
    if (!user) return
    rememberRole(user.role)
    set({ role: user.role, currentUser: user })
  },
  logout: () => {
    /* Fire and forget: the local state must clear whether or not the server
       acknowledges, so that "sign out" always signs the person out of the
       screen in front of them. The server call revokes the refresh token so
       the session cannot be resumed from storage. */
    void remoteSignOut()
    rememberRole('guest')
    set({ role: 'guest', currentUser: null })
  },
  registerAccount: ({ name, email, phone, firm, role, city = '', gstin = '' }) => {
    const s = get()
    const existingBidderIds = s.users.map((u) => u.bidderId).filter((v): v is string => !!v)
    const existingSellerIds = s.users.map((u) => u.sellerId).filter((v): v is string => !!v)
    const user: User = {
      id: uid('u'),
      name, email, phone, firm, role,
      /* Signing up *as a seller* is itself the application to sell: the
         account lands on the verification desk straight away. It used to be
         created at 'none', which no queue looks for — and the only screen that
         could move it to 'pending' lived on the buyer's menu, so a direct
         seller signup could never be verified by anybody. */
      kycStatus: role === 'seller' ? 'pending' : 'none',
      sellerVerified: false,
      standing: 'good',
      accountStatus: 'active',
      city, gstin,
      avatarHue: Math.floor(Math.random() * 360),
      joinedAt: new Date(s.now).toISOString(),
      bidderId: role === 'buyer' ? genBidderId(existingBidderIds) : null,
      sellerId: role === 'seller' ? genSellerId(existingSellerIds) : null,
    }
    /* This account has no server-side row — there is no real registration
       endpoint yet (see server/README's "not yet built" list) — so nothing
       here has a legitimate write to send. Without this guard every field
       above queues a save no role is allowed to make, and it retries
       forever exactly like the adoptSession bug this mirrors. */
    withoutPersisting(() => {
      set((st) => ({ users: [...st.users, user], wallets: [...st.wallets, { userId: user.id, balance: 0, emdLocked: 0, ledger: [] }] }))
      rememberRole(role)
      set({ role, currentUser: user })
      get().audit('account.register', firm, `New ${ROLE_LABEL[role].toLowerCase()} account — ${name}, ${city || 'city not given'}`)
      if (role === 'seller') {
        helpers.notifyRole(['exec_manager', 'sub_admin'], {
          kind: 'system', title: `New seller to verify — ${firm}`,
          body: `${name} registered as a seller${gstin ? ` with GSTIN ${gstin}` : ''}. They cannot submit lots until you verify them.`,
          href: '/sub/seller-verification',
        })
        get().notify({
          userId: user.id, kind: 'system', title: 'Your seller account is with our team',
          body: 'We verify your firm details before you can submit lots. You will hear from us within one business day.',
          href: '/seller',
        })
      }
    })
    return user
  },
})
