import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Smartphone, ShieldCheck, ArrowRight } from 'lucide-react';
import { useApp } from '../../store';
import { Btn, inputCls, Badge, ThemeToggle } from '../../components/ui';
import { cx } from '../../utils';

export default function Login() {
  const nav = useNavigate();
  const { loginAs, pushToast } = useApp();
  const [step, setStep] = useState<'phone' | 'otp' | 'done'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [mode, setMode] = useState<'login' | 'register'>('register');

  const sendOtp = () => {
    setStep('otp');
    pushToast({ title: 'OTP sent (simulated)', body: 'Any 4-digit code works in this prototype — try 1234.', tone: 'info' });
  };
  const verify = () => {
    setStep('done');
    setTimeout(() => {
      loginAs('buyer');
      nav('/buyer');
    }, 1200);
  };

  return (
    <div className="relative flex min-h-full items-center justify-center bg-canvas p-4"
      style={{ backgroundImage: 'radial-gradient(ellipse at top, rgba(254,97,16,0.12), transparent 55%)' }}>
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="w-full max-w-md">
        <button onClick={() => nav('/')} className="mx-auto mb-6 flex items-center gap-2 cursor-pointer">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-ember-500 to-ember-700 text-white shadow-lg shadow-ember-900/40">
            <Flame size={22} strokeWidth={2.5} />
          </div>
          <div className="text-2xl font-extrabold text-ink">ferro<span className="text-ember-500">Bid</span></div>
        </button>

        <div className="animate-toast-in rounded-3xl bg-surface p-7 shadow-2xl">
          <div className="mb-5 flex rounded-xl bg-surface-3 p-1">
            {(['register', 'login'] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={cx('flex-1 rounded-lg py-2 text-sm font-bold capitalize cursor-pointer transition-colors', mode === m ? 'bg-surface text-ink shadow-sm' : 'text-faint')}>
                {m === 'register' ? 'Register' : 'Login'}
              </button>
            ))}
          </div>

          {step === 'phone' && (
            <>
              <h1 className="text-lg font-extrabold text-ink">{mode === 'register' ? 'Create your Buyer account' : 'Welcome back'}</h1>
              <p className="mt-1 text-sm text-muted">
                {mode === 'register' ? 'Every account starts as a Buyer — you can unlock Seller later via entity verification.' : 'Sign in with your registered mobile number.'}
              </p>
              <div className="mt-5">
                <label className="mb-1 block text-xs font-semibold text-muted">Mobile number</label>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-sm font-semibold text-muted">+91</span>
                  <input className={inputCls} placeholder="98450 12345" value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, ''))} />
                </div>
              </div>
              <Btn variant="accent" className="mt-4 w-full" size="lg" disabled={phone.replace(/\D/g, '').length < 10} onClick={sendOtp}>
                <Smartphone size={16} /> Send OTP
              </Btn>
              <p className="mt-3 text-center text-[11px] text-faint">Simulated auth — no real SMS is sent.</p>
            </>
          )}

          {step === 'otp' && (
            <>
              <h1 className="text-lg font-extrabold text-ink">Enter verification code</h1>
              <p className="mt-1 text-sm text-muted">Sent to +91 {phone || '98450 12345'} · <b>any code works</b> in the prototype.</p>
              <div className="mt-5 flex justify-center gap-3">
                {otp.map((d, i) => (
                  <input
                    key={i} id={`otp-${i}`} value={d} maxLength={1} inputMode="numeric"
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '');
                      const next = [...otp]; next[i] = v; setOtp(next);
                      if (v && i < 3) document.getElementById(`otp-${i + 1}`)?.focus();
                    }}
                    className="h-14 w-12 rounded-xl border border-line-strong text-center text-xl font-extrabold text-ink focus:border-ember-500 focus:outline-none focus:ring-2 focus:ring-ember-500/25"
                  />
                ))}
              </div>
              <Btn variant="accent" className="mt-5 w-full" size="lg" disabled={otp.some((d) => !d)} onClick={verify}>
                Verify & continue <ArrowRight size={16} />
              </Btn>
              <button onClick={sendOtp} className="mt-3 w-full text-center text-xs font-semibold text-steel-600 dark:text-steel-400 hover:underline cursor-pointer">Resend OTP</button>
            </>
          )}

          {step === 'done' && (
            <div className="py-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-400/15 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck size={30} />
              </div>
              <h1 className="mt-4 text-lg font-extrabold text-ink">{mode === 'register' ? 'Account created!' : 'Verified!'}</h1>
              <p className="mt-1 text-sm text-muted">Signing you in as <b>Buyer — Arjun Mehta</b>…</p>
              <Badge tone="tone-sky" className="mt-3">Default role: Buyer</Badge>
            </div>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-muted">
          Just exploring? <button onClick={() => nav('/browse')} className="font-bold text-ember-600 dark:text-ember-400 hover:underline cursor-pointer">Continue as Guest →</button>
        </p>
      </div>
    </div>
  );
}
