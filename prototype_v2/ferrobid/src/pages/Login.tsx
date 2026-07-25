/* User ID + password sign-in (demo). Validates against DEMO_LOGINS and drops
   the user into the matching role portal. */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame, ShieldCheck, User as UserIcon, Lock, ArrowRight } from 'lucide-react'
import { Page } from '../layout/Chrome'
import { Button, Field, Input } from '../components/ui'
import { DEMO_LOGINS, DEMO_PASSWORD, ROLE_HOME, ROLE_LABEL, useStore } from '../store/store'

export default function Login() {
  const nav = useNavigate()
  const signIn = useStore((s) => s.signIn)
  const switchRole = useStore((s) => s.switchRole)
  const pushToast = useStore((s) => s.pushToast)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const res = signIn(username, password)
    if (!res.ok || !res.role) {
      setError(res.error ?? 'Invalid credentials')
      return
    }
    setBusy(true)
    pushToast({ kind: 'success', title: 'Signed in', body: `Welcome — ${ROLE_LABEL[res.role]} portal.` })
    nav(ROLE_HOME[res.role])
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
          <span className="size-12 rounded-2xl bg-ember grid place-items-center text-white shadow-sm">
            <Flame size={26} strokeWidth={2.5} />
          </span>
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
                  placeholder="e.g. buy"
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
                  placeholder="••••"
                />
              </div>
            </Field>

            {error && (
              <div className="text-[13px] font-semibold text-danger bg-danger-soft border border-danger/20 rounded-xl px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={!username} loading={busy}>
              Sign in <ArrowRight size={16} />
            </Button>
          </form>

          {/* demo credential reference */}
          <div className="mt-6 pt-5 border-t border-line">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-2">Demo accounts</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
              {Object.entries(DEMO_LOGINS).map(([id, role]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setUsername(id); setPassword(DEMO_PASSWORD); setError('') }}
                  className="flex items-center justify-between gap-2 text-left rounded-lg px-2 py-1 hover:bg-surface-2"
                  title={`Fill ${ROLE_LABEL[role]} credentials`}
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
          <ShieldCheck size={13} /> Demo sign-in — no real authentication is performed.
        </p>
      </div>
    </Page>
  )
}
