import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Smartphone, ShieldCheck, ArrowRight } from 'lucide-react';
import { useApp } from '../../store';
import { Btn, inputCls, Badge } from '../../components/ui';
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
    <div className="flex min-h-full items-center justify-center bg-steel-950 p-4"
      style={{ backgroundImage: 'radial-gradient(ellipse at top, rgba(254,97,16,0.12), transparent 55%)' }}>
      <div className="w-full max-w-md">
        <button onClick={() => nav('/')} className="mx-auto mb-6 flex items-center gap-2 cursor-pointer">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-ember-500 to-ember-700 text-white shadow-lg shadow-ember-900/40">
            <Flame size={22} strokeWidth={2.5} />
          </div>
          <div className="text-2xl font-extrabold text-white">ferro<span className="text-ember-500">Bid</span></div>
        </button>

        <div className="animate-toast-in rounded-3xl bg-white p-7 shadow-2xl">
          <div className="mb-5 flex rounded-xl bg-slate-100 p-1">
            {(['register', 'login'] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={cx('flex-1 rounded-lg py-2 text-sm font-bold capitalize cursor-pointer transition-colors', mode === m ? 'bg-white text-steel-950 shadow-sm' : 'text-slate-400')}>
                {m === 'register' ? 'Register' : 'Login'}
              </button>
            ))}
          </div>

          {step === 'phone' && (
            <>
              <h1 className="text-lg font-extrabold text-steel-950">{mode === 'register' ? 'Create your Buyer account' : 'Welcome back'}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {mode === 'register' ? 'Every account starts as a Buyer — you can unlock Seller later via entity verification.' : 'Sign in with your registered mobile number.'}
              </p>
              <div className="mt-5">
                <label className="mb-1 block text-xs font-semibold text-slate-600">Mobile number</label>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-500">+91</span>
                  <input className={inputCls} placeholder="98450 12345" value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, ''))} />
                </div>
              </div>
              <Btn variant="accent" className="mt-4 w-full" size="lg" disabled={phone.replace(/\D/g, '').length < 10} onClick={sendOtp}>
                <Smartphone size={16} /> Send OTP
              </Btn>
              <p className="mt-3 text-center text-[11px] text-slate-400">Simulated auth — no real SMS is sent.</p>
            </>
          )}

          {step === 'otp' && (
            <>
              <h1 className="text-lg font-extrabold text-steel-950">Enter verification code</h1>
              <p className="mt-1 text-sm text-slate-500">Sent to +91 {phone || '98450 12345'} · <b>any code works</b> in the prototype.</p>
              <div className="mt-5 flex justify-center gap-3">
                {otp.map((d, i) => (
                  <input
                    key={i} id={`otp-${i}`} value={d} maxLength={1} inputMode="numeric"
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '');
                      const next = [...otp]; next[i] = v; setOtp(next);
                      if (v && i < 3) document.getElementById(`otp-${i + 1}`)?.focus();
                    }}
                    className="h-14 w-12 rounded-xl border border-slate-300 text-center text-xl font-extrabold text-steel-950 focus:border-ember-500 focus:outline-none focus:ring-2 focus:ring-ember-100"
                  />
                ))}
              </div>
              <Btn variant="accent" className="mt-5 w-full" size="lg" disabled={otp.some((d) => !d)} onClick={verify}>
                Verify & continue <ArrowRight size={16} />
              </Btn>
              <button onClick={sendOtp} className="mt-3 w-full text-center text-xs font-semibold text-steel-600 hover:underline cursor-pointer">Resend OTP</button>
            </>
          )}

          {step === 'done' && (
            <div className="py-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <ShieldCheck size={30} />
              </div>
              <h1 className="mt-4 text-lg font-extrabold text-steel-950">{mode === 'register' ? 'Account created!' : 'Verified!'}</h1>
              <p className="mt-1 text-sm text-slate-500">Signing you in as <b>Buyer — Arjun Mehta</b>…</p>
              <Badge tone="bg-sky-50 text-sky-700 ring-sky-200" className="mt-3">Default role: Buyer</Badge>
            </div>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-steel-300">
          Just exploring? <button onClick={() => nav('/browse')} className="font-bold text-ember-400 hover:underline cursor-pointer">Continue as Guest →</button>
        </p>
      </div>
    </div>
  );
}
