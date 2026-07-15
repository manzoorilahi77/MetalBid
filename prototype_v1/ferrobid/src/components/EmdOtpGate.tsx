import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Modal, Btn, OtpInput } from './ui';
import { useCountdown } from './fx';
import { inrCompact } from '../utils';

/** One-time OTP confirmation gate shown before an EMD lock takes effect. */
export function EmdOtpGate({
  open, onClose, amount, phone, email, onVerified,
}: {
  open: boolean;
  onClose: () => void;
  amount: number;
  phone: string;
  email: string;
  onVerified: () => void;
}) {
  const [otp, setOtp] = useState(['', '', '', '']);
  const [resendLeft, resetResend] = useCountdown(30);

  const verify = () => {
    onVerified();
    setOtp(['', '', '', '']);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Confirm EMD lock">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-steel-500/10 text-steel-700 dark:text-steel-300">
          <Lock size={22} />
        </div>
        <p className="mt-3 text-sm text-muted">
          Enter the OTP sent to <b className="text-ink">{phone}</b> and <b className="text-ink">{email}</b> to lock <b className="text-ink">{inrCompact(amount)}</b> EMD for this lot.
        </p>
        <div className="mt-4"><OtpInput value={otp} onChange={setOtp} idPrefix="emd-otp" /></div>
        <Btn variant="accent" size="lg" className="mt-5 w-full" disabled={otp.some((d) => !d)} onClick={verify}>
          Verify &amp; lock EMD
        </Btn>
        <button
          onClick={resetResend} disabled={resendLeft > 0}
          className="mt-3 w-full text-center text-xs font-semibold text-steel-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline dark:text-steel-400 cursor-pointer"
        >
          {resendLeft > 0 ? `Resend in ${resendLeft}s` : 'Resend OTP'}
        </button>
        <p className="mt-3 text-[11px] text-faint">Simulated auth — any 4-digit code works in this prototype.</p>
      </div>
    </Modal>
  );
}
