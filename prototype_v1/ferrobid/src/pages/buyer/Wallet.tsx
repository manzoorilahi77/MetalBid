import { useState } from 'react';
import { Wallet as WalletIcon, Lock, Download, Plus, ArrowUpRight, ArrowDownLeft, CreditCard } from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Card, Stat, Btn, Modal, Field, inputCls, Badge } from '../../components/ui';
import { inr, inrCompact, cx } from '../../utils';

const TYPE_META: Record<string, { label: string; tone: string; in: boolean }> = {
  topup: { label: 'Top-up', tone: 'bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-400/25', in: true },
  emd_lock: { label: 'EMD Lock', tone: 'bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-400/25', in: false },
  emd_release: { label: 'EMD Refund', tone: 'bg-sky-50 dark:bg-sky-400/10 text-sky-700 dark:text-sky-300 ring-sky-200 dark:ring-sky-400/25', in: true },
  emd_forfeit: { label: 'EMD Forfeit', tone: 'bg-red-50 dark:bg-red-400/10 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-400/25', in: false },
  payment: { label: 'Payment', tone: 'tone-steel', in: false },
  refund: { label: 'Refund', tone: 'bg-sky-50 dark:bg-sky-400/10 text-sky-700 dark:text-sky-300 ring-sky-200 dark:ring-sky-400/25', in: true },
};

export default function WalletPage() {
  const { wallet, topUp, pushToast } = useApp();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('100000');
  const [method, setMethod] = useState('Razorpay');
  const [processing, setProcessing] = useState(false);

  const doTopUp = () => {
    setProcessing(true);
    setTimeout(() => {
      topUp(Number(amount), method);
      setProcessing(false);
      setOpen(false);
    }, 1400);
  };

  return (
    <div>
      <SectionTitle
        title="Wallet & EMD" sub="Simulated payments — no real money moves"
        right={
          <div className="flex gap-2">
            <Btn variant="outline" size="sm" onClick={() => pushToast({ title: 'Statement downloaded', body: 'wallet-statement-jul-2026.pdf (mock)', tone: 'success' })}>
              <Download size={14} /> Statement
            </Btn>
            <Btn variant="accent" size="sm" onClick={() => setOpen(true)}><Plus size={14} /> Top up</Btn>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Available balance" value={inr(wallet.balance)} hint="Ready for bids & EMD" icon={<WalletIcon size={18} />} accent="bg-emerald-50 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400" />
        <Stat label="EMD locked" value={inr(wallet.emdLocked)} hint="Auto-refunded when you lose an auction" icon={<Lock size={18} />} accent="bg-amber-50 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400" />
        <Stat label="Total wallet" value={inr(wallet.balance + wallet.emdLocked)} hint="Available + locked" icon={<CreditCard size={18} />} accent="bg-steel-500/10 text-steel-700 dark:text-steel-300" />
      </div>

      <Card className="mt-5 overflow-hidden">
        <div className="border-b border-line px-5 py-3.5 text-sm font-bold text-ink">Transaction ledger</div>
        <div className="overflow-x-auto thin-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-bold uppercase tracking-wide text-faint">
                <th className="px-5 py-2.5">Type</th>
                <th className="px-5 py-2.5">Description</th>
                <th className="px-5 py-2.5">Date</th>
                <th className="px-5 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {wallet.ledger.map((l) => {
                const m = TYPE_META[l.type];
                return (
                  <tr key={l.id} className="border-b border-line hover:bg-surface-2/60">
                    <td className="px-5 py-3"><Badge tone={m.tone}>{m.in ? <ArrowDownLeft size={11} /> : <ArrowUpRight size={11} />} {m.label}</Badge></td>
                    <td className="px-5 py-3 text-muted">{l.note}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-xs text-faint">{l.at}</td>
                    <td className={cx('px-5 py-3 text-right font-bold whitespace-nowrap', l.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-body')}>
                      {l.amount > 0 ? '+' : ''}{inr(l.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Top up wallet">
        <div className="space-y-4">
          <Field label="Amount (₹)">
            <input className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} />
          </Field>
          <div className="flex flex-wrap gap-2">
            {[50000, 100000, 250000, 500000].map((a) => (
              <button key={a} onClick={() => setAmount(String(a))} className={cx('rounded-lg border px-3 py-1.5 text-xs font-bold cursor-pointer', amount === String(a) ? 'border-ember-500 bg-ember-50 dark:bg-ember-400/10 text-ember-700 dark:text-ember-300' : 'border-line text-muted hover:bg-surface-2')}>
                {inrCompact(a)}
              </button>
            ))}
          </div>
          <Field label="Payment method (simulated)">
            <div className="grid grid-cols-3 gap-2">
              {['Razorpay', 'UPI', 'NetBanking'].map((m) => (
                <button key={m} onClick={() => setMethod(m)} className={cx('rounded-xl border px-3 py-2.5 text-xs font-bold cursor-pointer', method === m ? 'border-steel-600 bg-steel-500/10 text-steel-800 dark:text-steel-200' : 'border-line text-muted hover:bg-surface-2')}>
                  {m}
                </button>
              ))}
            </div>
          </Field>
          <Btn variant="accent" className="w-full" size="lg" disabled={!Number(amount) || processing} onClick={doTopUp}>
            {processing ? 'Processing payment…' : `Pay ${inr(Number(amount || '0'))} via ${method}`}
          </Btn>
          <p className="text-center text-[11px] text-faint">A fake payment gateway response is returned after ~1.5s.</p>
        </div>
      </Modal>
    </div>
  );
}
