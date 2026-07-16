/* Phone + OTP mock auth — premium centered card, any 4-digit code works. */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame, ShieldCheck, ArrowLeft, Phone } from 'lucide-react'
import { Page } from '../layout/Chrome'
import { Button, Field, Input, Segmented, cx } from '../components/ui'
import { useStore } from '../store/store'

type Mode = 'login' | 'register'
type Phase = 'phone' | 'otp'

export default function Login() {
  const nav = useNavigate()
  const login = useStore((s) => s.login)
  const switchRole = useStore((s) => s.switchRole)
  const pushToast = useStore((s) => s.pushToast)

  const [mode, setMode] = useState<Mode>('login')
  const [phase, setPhase] = useState<Phase>('phone')
  const [phone, setPhone] = useState('')
  const [firm, setFirm] = useState('')
  const [digits, setDigits] = useState(['', '', '', ''])
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const boxRefs = useRef<(HTMLInputElement | null)[]>([])
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const phoneOk = phone.replace(/\D/g, '').length === 10
  const otpOk = digits.every((d) => /^\d$/.test(d))

  const sendOtp = (e: React.FormEvent) => {
    e.preventDefault()
    if (!phoneOk) return
    setSending(true)
    timers.current.push(setTimeout(() => {
      setSending(false)
      setPhase('otp')
      setDigits(['', '', '', ''])
      pushToast({ kind: 'info', title: 'OTP sent', body: `4-digit code sent to +91 ${phone} (demo — any code works)` })
      timers.current.push(setTimeout(() => boxRefs.current[0]?.focus(), 50))
    }, 700))
  }

  const setDigit = (i: number, v: string) => {
    const c = v.replace(/\D/g, '').slice(-1)
    setDigits((d) => d.map((x, j) => (j === i ? c : x)))
    if (c && i < 3) boxRefs.current[i + 1]?.focus()
  }

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) boxRefs.current[i - 1]?.focus()
  }

  const verify = (e: React.FormEvent) => {
    e.preventDefault()
    if (!otpOk) return
    setVerifying(true)
    timers.current.push(setTimeout(() => {
      login(phone)
      pushToast({ kind: 'success', title: mode === 'register' ? 'Account created' : 'Welcome back', body: 'Signed in as demo buyer.' })
      nav('/buyer')
    }, 800))
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
          <h1 className="font-display text-2xl font-bold mt-3">
            {mode === 'register' ? 'Join ferroBid' : 'Welcome back'}
          </h1>
          <p className="text-sm text-ink-muted mt-1 text-center">
            {mode === 'register'
              ? 'Register with your business mobile to start bidding on verified lots.'
              : 'Sign in with your registered mobile number.'}
          </p>
        </div>

        <div className="card p-6 sm:p-7">
          <div className="flex justify-center mb-6">
            <Segmented<Mode>
              options={[{ key: 'register', label: 'Register' }, { key: 'login', label: 'Login' }]}
              value={mode}
              onChange={(m) => { setMode(m); setPhase('phone') }}
            />
          </div>

          {phase === 'phone' && (
            <form onSubmit={sendOtp} className="space-y-4">
              {mode === 'register' && (
                <Field label="Firm name" hint="As per GST registration">
                  <Input value={firm} onChange={(e) => setFirm(e.target.value)} placeholder="e.g. Mehta Metals Pvt Ltd" />
                </Field>
              )}
              <Field label="Mobile number" hint="We'll send a one-time password to this number">
                <div className="flex items-center gap-2">
                  <span className="num h-10 px-3 rounded-xl bg-surface-2 border border-line-strong text-sm font-semibold inline-flex items-center gap-1.5 text-ink-muted shrink-0">
                    <Phone size={13} /> +91
                  </span>
                  <Input
                    inputMode="numeric" autoComplete="tel" autoFocus
                    className="num"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="98200 12345"
                  />
                </div>
              </Field>
              <Button type="submit" size="lg" className="w-full" disabled={!phoneOk} loading={sending}>
                Send OTP
              </Button>
            </form>
          )}

          {phase === 'otp' && (
            <form onSubmit={verify} className="space-y-5">
              <button type="button" onClick={() => setPhase('phone')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink">
                <ArrowLeft size={13} /> <span className="num">+91 {phone}</span> — change
              </button>
              <div>
                <div className="text-[13px] font-semibold text-ink mb-2">Enter the 4-digit OTP</div>
                <div className="flex gap-2.5 justify-center" role="group" aria-label="OTP digits">
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => { boxRefs.current[i] = el }}
                      value={d}
                      onChange={(e) => setDigit(i, e.target.value)}
                      onKeyDown={(e) => onKeyDown(i, e)}
                      onFocus={(e) => e.target.select()}
                      inputMode="numeric" maxLength={1} aria-label={`OTP digit ${i + 1}`}
                      className={cx('num size-14 text-center text-2xl font-bold rounded-xl bg-surface border text-ink',
                        'focus:outline-2 focus:outline-ember/60',
                        d ? 'border-ember/50 bg-ember-soft/40' : 'border-line-strong')}
                    />
                  ))}
                </div>
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={!otpOk} loading={verifying}>
                {mode === 'register' ? 'Create account' : 'Verify & sign in'}
              </Button>
              <button type="button"
                onClick={() => pushToast({ kind: 'info', title: 'OTP re-sent', body: `Code sent again to +91 ${phone}` })}
                className="block mx-auto text-xs font-semibold text-steel hover:underline">
                Resend code
              </button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-line text-center">
            <button onClick={asGuest} className="text-sm font-semibold text-steel hover:underline">
              Continue as guest — just browsing
            </button>
          </div>
        </div>

        <p className="flex items-center justify-center gap-1.5 text-xs text-ink-faint mt-4 text-center">
          <ShieldCheck size={13} /> Demo — any 4-digit code works. No real SMS is sent.
        </p>
      </div>
    </Page>
  )
}
