import { useState, type ReactNode } from 'react';
import { X, UploadCloud, FileCheck2, Inbox, Check } from 'lucide-react';
import type { LotStatus } from '../types';
import { STATUS_LABEL, STATUS_TONE, LIFECYCLE_ORDER, stageIndex } from '../lifecycle';
import { cx } from '../utils';

/* ---------- Button ---------- */
export function Btn({
  children, onClick, variant = 'primary', size = 'md', disabled, className, type,
}: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string;
  variant?: 'primary' | 'accent' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg'; type?: 'button' | 'submit';
}) {
  const variants = {
    primary: 'bg-steel-800 text-white hover:bg-steel-700 shadow-sm',
    accent: 'bg-ember-600 text-white hover:bg-ember-500 shadow-sm',
    outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'bg-red-600 text-white hover:bg-red-500 shadow-sm',
    success: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm',
  };
  const sizes = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-base' };
  return (
    <button
      type={type ?? 'button'} onClick={onClick} disabled={disabled}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors cursor-pointer',
        'disabled:opacity-40 disabled:cursor-not-allowed', variants[variant], sizes[size], className
      )}
    >
      {children}
    </button>
  );
}

/* ---------- Card ---------- */
export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={cx('rounded-xl bg-white shadow-sm ring-1 ring-slate-200', onClick && 'cursor-pointer hover:ring-steel-300 transition-shadow hover:shadow-md', className)}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        <h1 className="text-xl font-bold text-steel-950">{title}</h1>
        {sub && <p className="text-sm text-slate-500 mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/* ---------- Badges ---------- */
export function Badge({ children, tone = 'bg-slate-100 text-slate-600 ring-slate-300', className }: { children: ReactNode; tone?: string; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset whitespace-nowrap', tone, className)}>{children}</span>;
}

export function StatusBadge({ status }: { status: LotStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]}>
      {status === 'live' && <span className="h-1.5 w-1.5 rounded-full bg-ember-500 animate-pulse" />}
      {STATUS_LABEL[status]}
    </Badge>
  );
}

/* ---------- Stat tile ---------- */
export function Stat({ label, value, hint, icon, accent }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode; accent?: string }) {
  return (
    <Card className="p-4 flex items-start gap-3">
      {icon && <div className={cx('rounded-lg p-2.5 shrink-0', accent ?? 'bg-steel-50 text-steel-700')}>{icon}</div>}
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
        <div className="text-xl font-bold text-steel-950 truncate">{value}</div>
        {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
      </div>
    </Card>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-steel-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx('relative w-full rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto thin-scroll animate-toast-in', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white/95 backdrop-blur px-5 py-3.5 rounded-t-2xl z-10">
          <h3 className="font-bold text-steel-950">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Form bits ---------- */
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-steel-500 focus:outline-none focus:ring-2 focus:ring-steel-100';

export function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange} disabled={disabled}
      className={cx('relative h-5.5 w-10 rounded-full transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed', on ? 'bg-steel-700' : 'bg-slate-300')}
    >
      <span className={cx('absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-all', on ? 'left-5' : 'left-0.5')} />
    </button>
  );
}

/* ---------- Mock file upload ---------- */
export function FileDrop({ label, done, onUpload }: { label: string; done?: boolean; onUpload?: () => void }) {
  const [uploading, setUploading] = useState(false);
  const handle = () => {
    if (done || uploading) return;
    setUploading(true);
    setTimeout(() => { setUploading(false); onUpload?.(); }, 900);
  };
  return (
    <button
      onClick={handle}
      className={cx(
        'flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors cursor-pointer',
        done ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-300 bg-slate-50 hover:border-steel-400 hover:bg-steel-50'
      )}
    >
      {done ? <FileCheck2 className="text-emerald-600" size={22} /> : <UploadCloud className={cx('text-slate-400', uploading && 'animate-bounce')} size={22} />}
      <span className={cx('text-xs font-medium', done ? 'text-emerald-700' : 'text-slate-500')}>
        {done ? 'Uploaded ✓ (mock)' : uploading ? 'Uploading…' : label}
      </span>
    </button>
  );
}

/* ---------- Checklist row ---------- */
export function CheckItem({ label, checked, onToggle }: { label: string; checked: boolean; onToggle?: () => void }) {
  return (
    <button onClick={onToggle} className={cx('flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors', onToggle && 'cursor-pointer', checked ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>
      <span className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white')}>
        {checked && <Check size={13} strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}

/* ---------- Empty state ---------- */
export function Empty({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 py-12 text-center">
      <Inbox className="text-slate-300" size={32} />
      <div className="text-sm font-semibold text-slate-500">{title}</div>
      {sub && <div className="text-xs text-slate-400 max-w-xs">{sub}</div>}
    </div>
  );
}

/* ---------- Lot image placeholder (gradient, self-contained) ---------- */
export function LotImage({ hues, label, className }: { hues: number[]; label?: string; className?: string }) {
  const [h1, h2] = [hues[0] ?? 210, hues[1] ?? hues[0] ?? 230];
  return (
    <div
      className={cx('relative flex items-end overflow-hidden', className)}
      style={{ background: `linear-gradient(135deg, hsl(${h1} 35% 38%), hsl(${h2} 45% 22%))` }}
    >
      <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.10) 0 2px, transparent 2px 14px)' }} />
      {label && <span className="relative m-2 rounded bg-black/35 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/90">{label}</span>}
    </div>
  );
}

/* ---------- Lifecycle stepper ---------- */
export function LifecycleTracker({ status, compact }: { status: LotStatus; compact?: boolean }) {
  const idx = stageIndex(status);
  const stages = compact
    ? (['submitted', 'under_verification', 'approved', 'live', 'won', 'in_settlement', 'in_logistics', 'closed'] as LotStatus[])
    : LIFECYCLE_ORDER;
  return (
    <div className="flex items-center gap-0 overflow-x-auto thin-scroll py-1">
      {stages.map((s, i) => {
        const si = stageIndex(s);
        const done = idx > si || status === 'closed';
        const current = si === idx && status !== 'closed';
        const rejected = status === 'rejected' && s === 'under_verification';
        return (
          <div key={s} className="flex items-center shrink-0">
            {i > 0 && <div className={cx('h-0.5 w-5 sm:w-7', done || current ? 'bg-steel-600' : 'bg-slate-200')} />}
            <div className="flex flex-col items-center gap-1 px-0.5">
              <div className={cx(
                'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ring-2',
                rejected ? 'bg-red-500 text-white ring-red-200'
                  : done ? 'bg-steel-700 text-white ring-steel-200'
                  : current ? 'bg-ember-500 text-white ring-ember-200 animate-pulse-ring'
                  : 'bg-white text-slate-400 ring-slate-200'
              )}>
                {done ? <Check size={12} strokeWidth={3} /> : i + 1}
              </div>
              <span className={cx('text-[9px] font-semibold uppercase tracking-wide whitespace-nowrap', current ? 'text-ember-600' : done ? 'text-steel-700' : 'text-slate-400')}>
                {rejected ? 'Rejected' : STATUS_LABEL[s]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Simple tabs ---------- */
export function Tabs({ tabs, active, onChange }: { tabs: { key: string; label: ReactNode }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-slate-200/60 p-1 w-fit">
      {tabs.map((t) => (
        <button
          key={t.key} onClick={() => onChange(t.key)}
          className={cx('rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors cursor-pointer', active === t.key ? 'bg-white text-steel-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
