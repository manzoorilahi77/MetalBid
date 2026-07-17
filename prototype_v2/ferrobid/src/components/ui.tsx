/* ---------------------------------------------------------------------------
   Forge UI kit — every page composes these primitives so the theme stays
   cohesive. Flat surfaces, hairline borders, 16px radius, mono numerals.
--------------------------------------------------------------------------- */
import { useEffect, useMemo, useRef, useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { X, Loader2, Lock, Inbox, CheckCircle2, Minus, Plus } from 'lucide-react'
import { useStore } from '../store/store'
import { countdown } from '../lib/format'
import { useNow } from '../lib/useTick'
import type { CatalogueStatus, LotStatus } from '../types'

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')
export { cx }

/* -------------------------------- Button --------------------------------- */
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'steel'
type BtnSize = 'sm' | 'md' | 'lg'

export function Button({
  variant = 'primary', size = 'md', loading, className, children, disabled, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize; loading?: boolean }) {
  const v: Record<BtnVariant, string> = {
    primary: 'bg-ember text-white hover:bg-ember-strong border border-transparent',
    secondary: 'bg-surface text-ink border border-line-strong hover:border-ink/40 hover:bg-surface-2',
    ghost: 'bg-transparent text-ink-muted hover:text-ink hover:bg-surface-2 border border-transparent',
    danger: 'bg-danger text-white hover:opacity-90 border border-transparent',
    success: 'bg-success text-white hover:opacity-90 border border-transparent',
    steel: 'bg-steel text-white hover:bg-steel-strong border border-transparent',
  }
  const s: Record<BtnSize, string> = {
    sm: 'h-8 px-3 text-[13px] rounded-lg gap-1.5',
    md: 'h-10 px-4 text-sm rounded-xl gap-2',
    lg: 'h-12 px-6 text-base rounded-xl gap-2',
  }
  return (
    <button
      className={cx('inline-flex items-center justify-center font-semibold transition-colors select-none whitespace-nowrap',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember',
        'disabled:opacity-45 disabled:pointer-events-none', v[variant], s[size], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
}

/* --------------------------------- Chips ---------------------------------- */
export function Chip({ tone = 'neutral', children, className, pulse }: {
  tone?: 'neutral' | 'ember' | 'steel' | 'success' | 'warning' | 'danger'
  children: ReactNode; className?: string; pulse?: boolean
}) {
  const t = {
    neutral: 'bg-surface-2 text-ink-muted border-line',
    ember: 'bg-ember-soft text-ember-strong border-ember/25',
    steel: 'bg-steel-soft text-steel-strong border-steel/25',
    success: 'bg-success-soft text-success border-success/25',
    warning: 'bg-warning-soft text-warning border-warning/25',
    danger: 'bg-danger-soft text-danger border-danger/25',
  }[tone]
  return (
    <span className={cx('inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border text-xs font-semibold whitespace-nowrap', t, className)}>
      {pulse && <span className="size-1.5 rounded-full bg-current animate-live-pulse" />}
      {children}
    </span>
  )
}

/** Status system: Live = ember pulse · Upcoming = steel · Closing = amber · Closed = neutral. */
export function StatusChip({ status }: { status: CatalogueStatus | 'closing' | LotStatus }) {
  switch (status) {
    case 'live': return <Chip tone="ember" pulse>Live</Chip>
    case 'closing': return <Chip tone="warning" pulse>Closing soon</Chip>
    case 'upcoming': return <Chip tone="steel">Upcoming</Chip>
    case 'closed': return <Chip tone="neutral">Closed</Chip>
    case 'draft': return <Chip tone="neutral">Draft</Chip>
    case 'sold': return <Chip tone="success">Sold</Chip>
    case 'sta': return <Chip tone="warning">STA</Chip>
    case 'unsold': return <Chip tone="neutral">Unsold</Chip>
    case 'pending_inspection': return <Chip tone="steel">Pending inspection</Chip>
    case 'inspected': return <Chip tone="steel">Inspected</Chip>
    case 'approved': return <Chip tone="success">Approved</Chip>
    case 'flagged': return <Chip tone="warning">Flagged</Chip>
    case 'rejected': return <Chip tone="danger">Rejected</Chip>
    default: return <Chip>{status}</Chip>
  }
}

/** Sub-admin permission affordance. */
export function LockChip({ label = 'Restricted' }: { label?: string }) {
  return <Chip tone="neutral" className="opacity-80"><Lock size={11} /> {label}</Chip>
}

/* ------------------------------- Countdown -------------------------------- */
/** Compact digital countdown; red pulse under 2 minutes. */
export function Countdown({ endsAt, prefix, className, size = 'md' }: {
  endsAt: string; prefix?: string; className?: string; size?: 'sm' | 'md' | 'lg'
}) {
  const now = useNow()
  const left = Date.parse(endsAt) - now
  const urgent = left > 0 && left < 2 * 60_000
  const sizes = { sm: 'text-xs px-2 h-6', md: 'text-sm px-2.5 h-7', lg: 'text-xl px-3.5 h-10' }
  return (
    <span className={cx('num inline-flex items-center gap-1.5 rounded-lg font-semibold border',
      urgent ? 'bg-danger-soft text-danger border-danger/30 animate-urgent-pulse' : 'bg-surface-2 text-ink border-line',
      sizes[size], className)}>
      {prefix && <span className="font-sans font-medium text-ink-faint text-[0.82em]">{prefix}</span>}
      {left <= 0 ? 'Ended' : countdown(left)}
    </span>
  )
}

/* ------------------------------ Tabs & Segments --------------------------- */
export function Tabs<T extends string>({ tabs, value, onChange, className }: {
  tabs: { key: T; label: ReactNode; count?: number }[]
  value: T; onChange: (v: T) => void; className?: string
}) {
  return (
    <div className={cx('flex items-center gap-1 border-b border-line overflow-x-auto', className)} role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={value === t.key} onClick={() => onChange(t.key)}
          className={cx('h-11 px-4 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors',
            value === t.key ? 'border-ember text-ink' : 'border-transparent text-ink-muted hover:text-ink')}>
          {t.label}
          {t.count !== undefined && <span className={cx('num ml-2 text-xs px-1.5 py-0.5 rounded-md', value === t.key ? 'bg-ember-soft text-ember-strong' : 'bg-surface-2 text-ink-faint')}>{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange, className }: {
  options: { key: T; label: ReactNode }[]
  value: T; onChange: (v: T) => void; className?: string
}) {
  return (
    <div className={cx('inline-flex p-1 rounded-xl bg-surface-2 border border-line gap-0.5', className)}>
      {options.map((o) => (
        <button key={o.key} onClick={() => onChange(o.key)}
          className={cx('h-8 px-3.5 rounded-lg text-[13px] font-semibold transition-colors whitespace-nowrap',
            value === o.key ? 'bg-surface text-ink shadow-sm border border-line' : 'text-ink-muted hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ----------------------------- Amount stepper ------------------------------ */
/** Bid-step ladder — real rupee rungs, not multiples of the lot increment.
    Scaled to the lot's own rate so a ₹1k lot never offers a ₹10k rung. */
const STEP_LADDER = [200, 500, 1000, 2000, 5000, 10000]

export function stepOptionsFor(rate: number, increment: number): number[] {
  const opts = STEP_LADDER.filter((s) => s >= increment && s <= Math.max(rate * 0.5, increment))
  return opts.length ? opts : [increment]
}

const stepLabel = (n: number) => (n >= 1000 && n % 1000 === 0 ? `₹${n / 1000}k` : `₹${n}`)

/** −/+ bid builder with a selectable step-size ladder (₹200…₹10k, scaled to the lot). */
export function AmountStepper({ minNext, increment, value, onChange, size = 'md', className }: {
  minNext: number; increment: number; value: number; onChange: (v: number) => void
  size?: 'md' | 'lg'; className?: string
}) {
  const steps = useMemo(() => stepOptionsFor(minNext, increment), [minNext, increment])
  const [step, setStep] = useState(steps[0])
  const activeStep = steps.includes(step) ? step : steps[0]
  const lg = size === 'lg'
  return (
    <div className={cx('inline-flex flex-col gap-2', className)}>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Bid step size">
        {steps.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={s === activeStep} onClick={() => setStep(s)}
            className={cx('num rounded-full border font-bold transition-colors',
              lg ? 'h-7 px-3 text-xs' : 'h-6 px-2.5 text-[11px]',
              s === activeStep ? 'bg-ember text-white border-ember' : 'bg-surface-2 text-ink-muted border-line hover:border-line-strong')}>
            +{stepLabel(s)}
          </button>
        ))}
      </div>
      <div className="inline-flex items-stretch rounded-xl border border-line-strong bg-surface overflow-hidden w-fit">
        <button type="button" aria-label="Decrease bid" disabled={value <= minNext}
          onClick={() => onChange(Math.max(minNext, value - activeStep))}
          className={cx('grid place-items-center shrink-0 text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30 disabled:pointer-events-none',
            lg ? 'w-12' : 'w-9')}>
          <Minus size={lg ? 18 : 14} />
        </button>
        <input inputMode="numeric" aria-label="Bid amount" value={value.toLocaleString('en-IN')}
          onChange={(e) => { const n = Number(e.target.value.replace(/[^\d]/g, '')); onChange(n) }}
          className={cx('num font-bold text-center bg-transparent focus:outline-none border-x border-line',
            lg ? 'h-12 w-32 text-xl' : 'h-9 w-24 text-sm')} />
        <button type="button" aria-label="Increase bid" onClick={() => onChange(value + activeStep)}
          className={cx('grid place-items-center shrink-0 text-ink-muted hover:bg-surface-2 hover:text-ink', lg ? 'w-12' : 'w-9')}>
          <Plus size={lg ? 18 : 14} />
        </button>
      </div>
    </div>
  )
}

/* --------------------------------- Stat ----------------------------------- */
export function Stat({ label, value, sub, tone, className }: {
  label: ReactNode; value: ReactNode; sub?: ReactNode
  tone?: 'ember' | 'steel' | 'success' | 'warning' | 'danger'; className?: string
}) {
  const toneCls = tone ? { ember: 'text-ember', steel: 'text-steel', success: 'text-success', warning: 'text-warning', danger: 'text-danger' }[tone] : 'text-ink'
  return (
    <div className={cx('card p-4', className)}>
      <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{label}</div>
      <div className={cx('num text-2xl font-bold mt-1', toneCls)}>{value}</div>
      {sub && <div className="text-xs text-ink-muted mt-1">{sub}</div>}
    </div>
  )
}

/* -------------------------------- Fields ---------------------------------- */
export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="block text-[13px] font-semibold text-ink mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-faint mt-1">{hint}</span>}
    </label>
  )
}

const fieldCls = 'px-3 rounded-xl bg-surface border border-line-strong text-sm text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-ember/60 focus:outline-offset-0'
// default h-10/w-full only when the caller doesn't pass its own h-*/w-* utility,
// so overrides like className="h-9 w-32" win regardless of CSS order
const sized = (className?: string) => cx(
  !/(^|\s)h-\S/.test(className ?? '') && 'h-10',
  !/(^|\s)w-\S/.test(className ?? '') && 'w-full',
)

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(fieldCls, sized(className), className)} {...rest} />
}
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(fieldCls, sized(className), 'appearance-none pr-8 bg-no-repeat bg-[right_0.6rem_center] bg-[length:1em]', className)}
    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239c948c' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }} {...rest}>{children}</select>
}
export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(fieldCls, !/(^|\s)w-\S/.test(className ?? '') && 'w-full', 'py-2.5 min-h-24', className)} {...rest} />
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 select-none">
      <span className={cx('w-10 h-6 rounded-full p-0.5 transition-colors border', checked ? 'bg-ember border-ember' : 'bg-surface-2 border-line-strong')}>
        <span className={cx('block size-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-4')} />
      </span>
      {label && <span className="text-sm font-medium text-ink">{label}</span>}
    </button>
  )
}

/* --------------------------------- Modal ---------------------------------- */
export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx('relative card w-full max-h-[92vh] overflow-y-auto animate-toast-in rounded-b-none sm:rounded-b-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-line sticky top-0 bg-surface z-10">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-ink-muted hover:bg-surface-2"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

/* ------------------------------ EmptyState -------------------------------- */
export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card p-10 flex flex-col items-center text-center gap-2">
      <div className="text-ink-faint">{icon ?? <Inbox size={32} strokeWidth={1.5} />}</div>
      <div className="font-bold text-ink">{title}</div>
      {body && <p className="text-sm text-ink-muted max-w-sm">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/* ------------------------------ PhotoThumb -------------------------------- */
/** Photo placeholder — warm-industrial gradient keyed by hue. */
export function PhotoThumb({ hue, label, className }: { hue: number; label?: string; className?: string }) {
  return (
    <div className={cx('relative overflow-hidden rounded-lg border border-line shrink-0', className ?? 'w-16 h-12')}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 32% 72%), hsl(${hue + 18} 38% 46%))` }}
      title={label}>
      <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.25) 0 2px, transparent 2px 9px)' }} />
      {label && <span className="absolute bottom-0.5 left-1.5 text-[9px] font-semibold text-white/90 drop-shadow">{label}</span>}
    </div>
  )
}

/* -------------------------------- Avatar ---------------------------------- */
export function Avatar({ name, hue, size = 32 }: { name: string; hue: number; size?: number }) {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span className="inline-flex items-center justify-center rounded-full font-bold text-white shrink-0 select-none"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, hsl(${hue} 55% 48%), hsl(${hue + 24} 60% 34%))` }}>
      {initials}
    </span>
  )
}

/* ------------------------------ ProgressBar -------------------------------- */
export function ProgressBar({ value, max, tone = 'ember', className }: { value: number; max: number; tone?: 'ember' | 'steel' | 'success' | 'warning'; className?: string }) {
  const pct = max <= 0 ? 0 : Math.min(100, (value / max) * 100)
  const t = { ember: 'bg-ember', steel: 'bg-steel', success: 'bg-success', warning: 'bg-warning' }[tone]
  return (
    <div className={cx('h-2 rounded-full bg-surface-2 border border-line overflow-hidden', className)}>
      <div className={cx('h-full rounded-full transition-all duration-500', t)} style={{ width: `${pct}%` }} />
    </div>
  )
}

/* -------------------------------- Toasts ---------------------------------- */
export function ToastHost() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[min(92vw,380px)]">
      {toasts.map((t) => (
        <div key={t.id} className={cx('card p-3.5 pr-9 relative animate-toast-in shadow-lg border-l-4',
          { success: 'border-l-success', info: 'border-l-steel', warning: 'border-l-warning', danger: 'border-l-danger' }[t.kind])}>
          <div className="font-semibold text-sm">{t.title}</div>
          {t.body && <div className="text-xs text-ink-muted mt-0.5">{t.body}</div>}
          <button onClick={() => dismiss(t.id)} className="absolute top-2.5 right-2.5 text-ink-faint hover:text-ink" aria-label="Dismiss"><X size={14} /></button>
        </div>
      ))}
    </div>
  )
}

/* ------------------------- Mock payment modal ------------------------------ */
/** Fake UPI / NetBanking / RTGS picker with a processing delay, then succeeds. */
export function MockPayModal({ open, onClose, amount, title, onSuccess }: {
  open: boolean; onClose: () => void; amount: string; title: string
  onSuccess: (method: string) => void
}) {
  const [method, setMethod] = useState<'UPI' | 'NetBanking' | 'RTGS/NEFT'>('UPI')
  const [phase, setPhase] = useState<'pick' | 'processing' | 'done'>('pick')
  const timer = useRef<ReturnType<typeof setTimeout>>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  useEffect(() => { if (open) setPhase('pick') }, [open])

  const pay = () => {
    setPhase('processing')
    timer.current = setTimeout(() => {
      setPhase('done')
      timer.current = setTimeout(() => { onSuccess(method); onClose() }, 900)
    }, 1600)
  }

  return (
    <Modal open={open} onClose={phase === 'pick' ? onClose : () => {}} title={title}>
      {phase === 'pick' && (
        <div className="space-y-4">
          <div className="card bg-surface-2 p-4 flex items-baseline justify-between">
            <span className="text-sm text-ink-muted">Amount payable</span>
            <span className="num text-2xl font-bold">{amount}</span>
          </div>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Payment method">
            {(['UPI', 'NetBanking', 'RTGS/NEFT'] as const).map((m) => (
              <button key={m} role="radio" aria-checked={method === m} onClick={() => setMethod(m)}
                className={cx('h-16 rounded-xl border text-sm font-semibold transition-colors',
                  method === m ? 'border-ember bg-ember-soft text-ember-strong' : 'border-line bg-surface text-ink-muted hover:border-line-strong')}>
                {m}
              </button>
            ))}
          </div>
          {method === 'UPI' && <Input placeholder="yourname@upi" defaultValue="arvind@okhdfcbank" aria-label="UPI ID" />}
          {method === 'NetBanking' && <Select defaultValue="HDFC"><option>HDFC Bank</option><option>ICICI Bank</option><option>SBI</option><option>Axis Bank</option></Select>}
          {method === 'RTGS/NEFT' && <div className="text-xs text-ink-muted card bg-surface-2 p-3">Beneficiary: ferroBid Escrow A/c · 50200077881234 · IFSC HDFC0000060. Demo — payment simulates instantly.</div>}
          <Button className="w-full" size="lg" onClick={pay}>Pay {amount}</Button>
        </div>
      )}
      {phase === 'processing' && (
        <div className="py-10 flex flex-col items-center gap-3">
          <Loader2 size={36} className="animate-spin text-ember" />
          <div className="font-semibold">Processing via {method}…</div>
          <div className="text-xs text-ink-faint">Do not refresh — contacting the bank (simulated)</div>
        </div>
      )}
      {phase === 'done' && (
        <div className="py-10 flex flex-col items-center gap-3 text-success">
          <CheckCircle2 size={40} />
          <div className="font-bold text-ink">Payment successful</div>
        </div>
      )}
    </Modal>
  )
}

/* ------------------------------ PageHeader --------------------------------- */
export function PageHeader({ title, sub, actions, crumbs }: {
  title: ReactNode; sub?: ReactNode; actions?: ReactNode
  crumbs?: { label: string; to?: string }[]
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        {crumbs && (
          <nav className="text-xs text-ink-faint mb-1.5 flex items-center gap-1.5">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span>/</span>}
                {c.to ? <a href={`#${c.to}`} className="hover:text-ink">{c.label}</a> : <span className="text-ink-muted">{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
        {sub && <p className="text-sm text-ink-muted mt-1 max-w-2xl">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}
