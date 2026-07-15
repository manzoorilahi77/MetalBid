import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useApp } from '../store';
import { Btn, OtpInput } from './ui';
import { useCountdown } from './fx';

export function SessionExpiredModal() {
  const nav = useNavigate();
  const { sessionExpired, userName, reauth, logout } = useApp();
  const [otp, setOtp] = useState(['', '', '', '']);
  const [resendLeft, resetResend] = useCountdown(30);

  if (!sessionExpired) return null;

  const verify = () => {
    reauth();
    setOtp(['', '', '', '']);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-steel-950/70 p-4 backdrop-blur-sm">
      <div className="animate-toast-in w-full max-w-sm rounded-3xl bg-surface p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400">
          <Lock size={26} />
        </div>
        <h2 className="mt-4 text-lg font-extrabold text-ink">Session expired</h2>
        <p className="mt-1 text-sm text-muted">
          For your security, re-verify via the code sent to your registered mobile &amp; email to continue as <b>{userName}</b>.
        </p>
        <div className="mt-5"><OtpInput value={otp} onChange={setOtp} idPrefix="reauth-otp" /></div>
        <Btn variant="accent" size="lg" className="mt-5 w-full" disabled={otp.some((d) => !d)} onClick={verify}>
          Verify &amp; continue
        </Btn>
        <button
          onClick={resetResend} disabled={resendLeft > 0}
          className="mt-3 w-full text-center text-xs font-semibold text-steel-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline dark:text-steel-400 cursor-pointer"
        >
          {resendLeft > 0 ? `Resend in ${resendLeft}s` : 'Resend OTP'}
        </button>
        <button
          onClick={() => { logout(); nav('/'); }}
          className="mt-4 block w-full text-xs font-semibold text-muted hover:text-ink cursor-pointer"
        >
          Sign out instead
        </button>
        <p className="mt-3 text-[11px] text-faint">Simulated auth — any 4-digit code works in this prototype.</p>
      </div>
    </div>
  );
}
