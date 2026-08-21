/* User ID + password sign-in.
   Posts to /api/auth/login — scrypt on the server, account and address
   throttling, a real lockout — and drops the user into the portal for whatever
   role the server says they hold. There is no offline fallback: signing
   somebody in without a password because the API is unreachable would be a
   hole dressed up as resilience. */
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ShieldCheck, User as UserIcon, Lock, ArrowRight } from 'lucide-react'
import { Page } from '../layout/Chrome'
import { Button, Field, Input } from '../components/ui'
import { DEMO_LOGINS, DEMO_PASSWORD, ROLE_HOME, ROLE_LABEL, useStore } from '../store/store'

export default function Login() {
  const nav = useNavigate()
  /* Where they were going when the guard stopped them. Sending them on rather
     than to their dashboard is the difference between signing in and losing
     your place. A stale or wrong-role `from` is safe: the same guard that set
     it will bounce them home, so this never opens a door on its own. */
  const [params] = useSearchParams()
  const from = params.get('from')
  const signIn = useStore((s) => s.signInRemote)
  const switchRole = useStore((s) => s.switchRole)
  const pushToast = useStore((s) => s.pushToast)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  /* Shared by the form and the demo-account buttons below — a demo account is
     a real account, signed into the same way, not a shortcut around signing
     in. Filling the fields without this second step used to be all the demo
     buttons did, which read as "click Buyer, land in Arvind's portal" but
     actually needed a second click on Sign in that nothing on the button
     itself said was still required. */
  const doSignIn = async (id: string, pass: string) => {
    setError('')
    setBusy(true)
    try {
      const res = await signIn(id, pass)
      if (!res.ok || !res.role) {
        setError(res.error ?? 'Invalid credentials')
        return
      }
      pushToast({ kind: 'success', title: 'Signed in', body: `Welcome — ${ROLE_LABEL[res.role]} portal.` })
      /* A password support issued is spent on first use, and the account cannot
         do anything else until it is replaced. */
      if (res.mustChangePassword) {
        pushToast({
          kind: 'info', title: 'Set your own password',
          body: 'You signed in with a password support issued. Choose your own now.',
        })
        nav('/profile?password=1')
        return
      }
      nav(from || ROLE_HOME[res.role])
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    void doSignIn(username, password)
  }

  const asGuest = () => {
    switchRole('guest')
    nav('/browse')
  }

  return (
    <Page>
      <div className="max-w-md mx-auto pt-6 sm:pt-14 animate-fade-up">
        {/* brand mark */}
        <div className="flex flex-col items-center mb-6">
          <img
            src={`${import.meta.env.BASE_URL}headericon.png`}
            alt="ferroBid"
            className="h-11 w-auto object-contain dark:hidden"
          />
          <img
            src={`${import.meta.env.BASE_URL}footericon.png`}
            alt="ferroBid"
            className="h-11 w-auto object-contain hidden dark:block"
          />
          <h1 className="font-display text-2xl font-bold mt-3">Sign in to ferroBid</h1>
          <p className="text-sm text-ink-muted mt-1 text-center">
            Enter your user ID and password to open your portal.
          </p>
        </div>

        <div className="card p-6 sm:p-7">
          <form onSubmit={submit} className="space-y-4">
            <Field label="User ID">
              <div className="flex items-center gap-2">
                <span className="h-10 px-3 rounded-xl bg-surface-2 border border-line-strong text-sm inline-flex items-center text-ink-muted shrink-0">
                  <UserIcon size={14} />
                </span>
                <Input
                  autoFocus autoComplete="username"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError('') }}
                  placeholder="you@company.com"
                />
              </div>
            </Field>

            <Field label="Password">
              <div className="flex items-center gap-2">
                <span className="h-10 px-3 rounded-xl bg-surface-2 border border-line-strong text-sm inline-flex items-center text-ink-muted shrink-0">
                  <Lock size={14} />
                </span>
                <Input
                  type="password" autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••••••"
                />
              </div>
            </Field>

            {error && (
              <div className="text-[13px] font-semibold text-danger bg-danger-soft border border-danger/20 rounded-xl px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={!username || !password || busy} loading={busy}>
              Sign in <ArrowRight size={16} />
            </Button>
          </form>

          {/* demo accounts — one click signs in for real, same as the form above */}
          <div className="mt-6 pt-5 border-t border-line">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-2">Demo accounts</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
              {Object.entries(DEMO_LOGINS).map(([id, role]) => (
                <button
                  key={id}
                  type="button"
                  disabled={busy}
                  onClick={() => { setUsername(id); setPassword(DEMO_PASSWORD); void doSignIn(id, DEMO_PASSWORD) }}
                  className="flex items-center justify-between gap-2 text-left rounded-lg px-2 py-1 hover:bg-surface-2 disabled:opacity-50"
                  title={`Sign in as this ${ROLE_LABEL[role]} demo account`}
                >
                  <span className="text-ink-muted">{ROLE_LABEL[role]}</span>
                  <span className="num font-semibold text-ink">{id}</span>
                </button>
              ))}
            </div>
            <p className="num text-[12px] text-ink-faint mt-2">Password for all: {DEMO_PASSWORD}</p>
          </div>

          <div className="mt-5 pt-5 border-t border-line text-center">
            <button onClick={asGuest} className="text-sm font-semibold text-steel hover:underline">
              Continue as guest — just browsing
            </button>
          </div>
        </div>

        <p className="flex items-center justify-center gap-1.5 text-xs text-ink-faint mt-4 text-center">
          <ShieldCheck size={13} /> Your password is hashed with scrypt and never stored in the clear.
        </p>
      </div>
    </Page>
  )
}
