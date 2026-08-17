/* ---------------------------------------------------------------------------
   Profile design kit.

   Every role on ferroBid gets its own profile, but they are all the same
   object: a credential. So the page is built as one — an engraved identity
   plate at the top carrying the number you are known by, a ledger strip of the
   four figures that decide what you may do today, and below it a row of tabs
   opening onto panels rather than a settings list.

   The one thing that changes per role is the accent. It is published as CSS
   custom properties on the page root (`--accent`, `--accent-soft`,
   `--accent-ink`) so every primitive below can tint itself without a prop
   being threaded through, and so switching role visibly re-skins the page.
--------------------------------------------------------------------------- */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronRight, Copy } from 'lucide-react'
import { Avatar, cx } from '../../components/ui'
import type { Role } from '../../types'

/* --------------------------------- accent ---------------------------------- */

export type AccentName = 'ember' | 'steel' | 'success' | 'warning' | 'danger' | 'gold'

/** Which hue a role wears. Chosen by what the desk *does*, not by rank: the two
 *  roles that touch a live bid are ember, the two that assemble a sale are
 *  steel, money is green, oversight amber, root-level red, the signature gold. */
export const ROLE_ACCENT: Record<Role, AccentName> = {
  guest: 'ember',
  guest1: 'ember',
  guest_buyer: 'ember',
  buyer: 'ember',
  seller: 'steel',
  field_exec: 'success',
  exec_manager: 'steel',
  auction_manager: 'ember',
  finance_admin: 'success',
  sub_admin: 'warning',
  super_admin: 'danger',
  ceo: 'gold',
}

/** `--accent-ink` is the readable text colour *on* `--accent-soft`, which is not
 *  always the accent itself — ember and steel both have a darker companion that
 *  clears contrast on their own tint. */
const ACCENT_VARS: Record<AccentName, CSSProperties> = {
  ember: { '--accent': 'var(--ember)', '--accent-soft': 'var(--ember-soft)', '--accent-ink': 'var(--ember-strong)' } as CSSProperties,
  steel: { '--accent': 'var(--steel)', '--accent-soft': 'var(--steel-soft)', '--accent-ink': 'var(--steel-strong)' } as CSSProperties,
  success: { '--accent': 'var(--success)', '--accent-soft': 'var(--success-soft)', '--accent-ink': 'var(--success)' } as CSSProperties,
  warning: { '--accent': 'var(--warning)', '--accent-soft': 'var(--warning-soft)', '--accent-ink': 'var(--warning)' } as CSSProperties,
  danger: { '--accent': 'var(--danger)', '--accent-soft': 'var(--danger-soft)', '--accent-ink': 'var(--danger)' } as CSSProperties,
  gold: { '--accent': 'var(--gold)', '--accent-soft': 'var(--gold-soft)', '--accent-ink': 'var(--gold)' } as CSSProperties,
}

export const accentStyle = (role: Role): CSSProperties => ACCENT_VARS[ROLE_ACCENT[role]]

/* Shorthands. Written once here so a tint change is a one-line edit rather than
   a sweep through nine role files. */
export const A = {
  text: 'text-[var(--accent-ink)]',
  bg: 'bg-[var(--accent)]',
  soft: 'bg-[var(--accent-soft)]',
  border: 'border-[var(--accent)]/30',
  ring: 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]',
}

export const focusRing = A.ring

/* ------------------------------ small pieces ------------------------------- */

/** Micro-label. `ink-muted` rather than `ink-faint`: at 11px uppercase, faint
    does not clear 4.5:1 on the surface. */
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted', className)}>
      {children}
    </div>
  )
}

/** The engraving behind the identity plate: an accent wash falling from the top
    left, and a hairline grid too faint to read as a texture but enough to stop
    the panel looking like flat paint. Decorative — hidden from assistive tech. */
function Engraving({ id }: { id: string }) {
  return (
    <>
      <div aria-hidden className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(115% 130% at 0% 0%, var(--accent-soft) 0%, transparent 58%)' }} />
      <svg aria-hidden className="absolute inset-0 size-full pointer-events-none text-ink opacity-[0.045]">
        <defs>
          <pattern id={id} width="26" height="26" patternUnits="userSpaceOnUse">
            <path d="M26 0H0V26" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </>
  )
}

/** Completeness, as a ring rather than a bar. A bar reads as loading; a ring
    reads as a score, which is what this is. */
export function CompletenessRing({ done, total, size = 68 }: { done: number; total: number; size?: number }) {
  const pct = total === 0 ? 1 : done / total
  const r = size / 2 - 5
  const circ = 2 * Math.PI * r
  const complete = done === total
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img"
        aria-label={`Profile ${Math.round(pct * 100)} per cent complete`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="5"
          className="stroke-line" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="5" strokeLinecap="round"
          className={complete ? 'stroke-success' : 'stroke-[var(--accent)]'}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 700ms var(--ease-settle)' }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center num text-sm font-bold text-ink">
        {Math.round(pct * 100)}%
      </span>
    </div>
  )
}

/* ------------------------------ identity plate ----------------------------- */

export type PlateBadge = { label: ReactNode; tone: 'accent' | 'success' | 'warning' | 'danger' | 'neutral' }

const BADGE_TONE: Record<PlateBadge['tone'], string> = {
  accent: 'bg-[var(--accent-soft)] text-[var(--accent-ink)] border-[var(--accent)]/30',
  success: 'bg-success-soft text-success border-success/25',
  warning: 'bg-warning-soft text-warning border-warning/25',
  danger: 'bg-danger-soft text-danger border-danger/25',
  neutral: 'bg-surface-2 text-ink-muted border-line',
}

export function PlateBadge({ label, tone }: PlateBadge) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 h-7 px-3 rounded-full border text-xs font-bold whitespace-nowrap', BADGE_TONE[tone])}>
      {label}
    </span>
  )
}

/** The credential. Name and firm on the left, role and standing on the right,
    then a band carrying the number this account trades or signs under, how
    complete the record is, and what that clearance currently permits. */
export function IdentityPlate({
  name, hue, headline, sub, meta, badges, idLabel, idValue, idNote,
  done, total, gaps, onJumpToGap, clearance,
}: {
  name: string; hue: number
  headline: string; sub: ReactNode; meta: ReactNode
  badges: PlateBadge[]
  idLabel: string; idValue: string; idNote: string
  done: number; total: number
  gaps: { id: string; label: string }[]
  onJumpToGap: (id: string) => void
  clearance: { label: string; value: string; note: string; tone: 'success' | 'warning' | 'danger' }
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = () => {
    navigator.clipboard?.writeText(idValue)
    setCopied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 1600)
  }

  const clearanceTone = {
    success: 'text-success', warning: 'text-warning', danger: 'text-danger',
  }[clearance.tone]

  return (
    <div className="card relative overflow-hidden">
      <Engraving id="profile-plate-grid" />

      {/* one authored moment — light sweeping once across the plate on arrival */}
      <span aria-hidden className="absolute inset-y-0 -left-1/3 w-1/3 pointer-events-none animate-sheen"
        style={{ background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent) 14%, transparent), transparent)' }} />

      <div className="relative flex flex-wrap items-start justify-between gap-x-6 gap-y-5 px-5 sm:px-7 pt-7 pb-6">
        <div className="flex items-center gap-4 min-w-0">
          {/* the accent ring is the role, worn on the avatar */}
          <div className="relative shrink-0 rounded-full p-[3px] bg-[var(--accent)]/18">
            <div className="rounded-full ring-2 ring-surface">
              <Avatar name={name} hue={hue} size={64} />
            </div>
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-[26px] sm:text-3xl font-bold leading-[1.1] truncate">{headline}</h2>
            <div className="text-sm text-ink-muted mt-1 truncate">{sub}</div>
            <div className="text-xs text-ink-faint mt-1.5">{meta}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {badges.map((b, i) => <PlateBadge key={i} {...b} />)}
        </div>
      </div>

      <div className="relative border-t border-line bg-surface-2/40 grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.2fr)_minmax(0,1fr)] divide-y lg:divide-y-0 lg:divide-x divide-line">
        {/* the number */}
        <div className="px-5 sm:px-7 py-6 min-w-0">
          <Label>{idLabel}</Label>
          <div className="flex items-center gap-2.5 mt-2.5">
            <span className="num text-[30px] sm:text-[34px] font-bold text-ink tracking-[0.14em] leading-none truncate">
              {idValue}
            </span>
            <button type="button" onClick={copy} aria-label={`Copy ${idLabel}`}
              className={cx('size-8 shrink-0 rounded-lg grid place-items-center border border-line-strong bg-surface text-ink-muted hover:text-ink hover:border-ink/35 transition-colors', focusRing)}>
              {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            </button>
          </div>
          <p className="text-[13px] text-ink-muted mt-3 max-w-md leading-relaxed">{idNote}</p>
        </div>

        {/* how complete the record is — every gap is a shortcut, not a statistic */}
        <div className="px-5 sm:px-7 py-6">
          <Label>Record complete</Label>
          <div className="flex items-center gap-4 mt-2.5">
            <CompletenessRing done={done} total={total} />
            <div className="min-w-0">
              <div className="num text-sm font-bold text-ink">{done} of {total}</div>
              <div className="text-[13px] text-ink-muted mt-0.5 leading-snug">
                {gaps.length === 0 ? 'Nothing outstanding' : `${gaps.length} still to add`}
              </div>
            </div>
          </div>
          {gaps.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3.5">
              {gaps.slice(0, 4).map((g) => (
                <button key={g.id} type="button" onClick={() => onJumpToGap(g.id)}
                  className={cx('h-7 px-2.5 rounded-lg border border-line-strong bg-surface text-xs font-semibold text-ink-muted hover:text-ink hover:border-ink/35 transition-colors', focusRing)}>
                  Add {g.label}
                </button>
              ))}
              {gaps.length > 4 && (
                <span className="h-7 px-1.5 inline-flex items-center text-xs text-ink-faint font-semibold">
                  +{gaps.length - 4} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* what the credential currently permits */}
        <div className="px-5 sm:px-7 py-6">
          <Label>{clearance.label}</Label>
          <div className={cx('font-display text-lg font-bold mt-2.5 leading-tight', clearanceTone)}>
            {clearance.value}
          </div>
          <p className="text-[13px] text-ink-muted mt-2 leading-relaxed">{clearance.note}</p>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------- ledger rail ------------------------------ */

export type Metric = { label: string; value: string; sub: string; to?: string; tone?: 'default' | 'warning' | 'danger' | 'success' }

/** Four figures, label first and figure second, each one a doorway to the page
    that owns it. Deliberately not stat tiles: this is a ledger line. */
export function LedgerRail({ metrics }: { metrics: Metric[] }) {
  const toneCls = {
    default: 'text-ink', warning: 'text-warning', danger: 'text-danger', success: 'text-success',
  }
  return (
    <div className="card overflow-hidden mt-4 grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-line">
      {metrics.map((m) => {
        const body = (
          <>
            <Label>{m.label}</Label>
            <div className={cx('num text-xl font-bold mt-2', toneCls[m.tone ?? 'default'])}>{m.value}</div>
            <div className="text-xs text-ink-muted mt-1 flex items-center gap-1">
              {m.sub}
              {m.to && <ChevronRight size={12} className="-translate-x-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />}
            </div>
          </>
        )
        return m.to
          ? <Link key={m.label} to={m.to} className={cx('group px-5 sm:px-6 py-5 hover:bg-surface-2/60 transition-colors', focusRing)}>{body}</Link>
          : <div key={m.label} className="px-5 sm:px-6 py-5">{body}</div>
      })}
    </div>
  )
}

/* -------------------------------- section rail ----------------------------- */

export type TabDef<K extends string> = { key: K; label: string; icon: ReactNode; badge?: number }

/** The sections, stacked one under another and sticky beside the sheet, so the
    whole map of the profile is readable at a glance and the current place never
    scrolls out of sight. Below `lg` there is no room for a column, so the same
    list lies down into a strip that scrolls sideways. */
export function SectionRail<K extends string>({ tabs, value, onChange }: {
  tabs: TabDef<K>[]; value: K; onChange: (k: K) => void
}) {
  const badgeOf = (t: TabDef<K>, active: boolean) =>
    t.badge != null && t.badge > 0 ? (
      <span className={cx('num min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold grid place-items-center shrink-0',
        active ? 'bg-white/22 text-white' : 'bg-warning-soft text-warning')}>
        {t.badge}
      </span>
    ) : null

  return (
    <nav aria-label="Profile sections" className="min-w-0 lg:sticky lg:top-20">
      {/* stacked — one section per row */}
      <div role="tablist" aria-orientation="vertical"
        className="hidden lg:flex flex-col gap-1 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
        {tabs.map((t) => {
          const active = t.key === value
          return (
            <button key={t.key} role="tab" aria-selected={active} type="button"
              onClick={() => onChange(t.key)}
              className={cx('group shrink-0 h-11 pl-3 pr-2.5 rounded-xl flex items-center gap-2.5 text-left transition-colors', focusRing,
                active
                  ? 'bg-[var(--accent)] text-white shadow-[0_2px_10px_-3px_var(--accent)]'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-2')}>
              <span className={active ? 'text-white/85' : 'text-ink-faint group-hover:text-ink-muted'}>{t.icon}</span>
              <span className="text-[13.5px] font-bold flex-1 min-w-0 truncate">{t.label}</span>
              {badgeOf(t, active)}
            </button>
          )
        })}
      </div>

      {/* lying down — same order, scrolls sideways */}
      <div role="tablist" className="lg:hidden flex gap-1.5 overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6 py-1">
        {tabs.map((t) => {
          const active = t.key === value
          return (
            <button key={t.key} role="tab" aria-selected={active} type="button"
              onClick={() => onChange(t.key)}
              className={cx('group shrink-0 h-10 pl-3 pr-3.5 rounded-xl inline-flex items-center gap-2 text-[13px] font-bold transition-colors', focusRing,
                active
                  ? 'bg-[var(--accent)] text-white shadow-[0_2px_10px_-3px_var(--accent)]'
                  : 'bg-surface border border-line text-ink-muted hover:text-ink')}>
              <span className={active ? 'text-white/85' : 'text-ink-faint'}>{t.icon}</span>
              {t.label}
              {badgeOf(t, active)}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/* ---------------------------------- panels --------------------------------- */

/** A panel is one subject. Icon tile, title, one line of why it matters, then
    the controls — never a bare list of switches with no explanation of what
    turning one off costs you. */
export function Panel({ icon, title, desc, aside, children, wide, flush }: {
  icon: ReactNode; title: string; desc?: string; aside?: ReactNode
  children: ReactNode; wide?: boolean; flush?: boolean
}) {
  return (
    <section className={cx('card card-hover overflow-hidden self-start', wide && 'xl:col-span-2')}>
      <header className="flex items-start gap-3.5 px-5 sm:px-6 pt-5 pb-4">
        <span className={cx('grid place-items-center size-9 rounded-xl shrink-0', A.soft, A.text)}>{icon}</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[16px] font-bold leading-tight">{title}</h2>
          {desc && <p className="text-[13px] text-ink-muted mt-1 leading-relaxed">{desc}</p>}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </header>
      <div className={flush ? '' : 'px-5 sm:px-6 pb-5'}>{children}</div>
    </section>
  )
}

/** Settings row: what it is on the left, the one control on the right. */
export function Row({ icon, label, desc, control, onClick }: {
  icon?: ReactNode; label: ReactNode; desc?: ReactNode
  control?: ReactNode; onClick?: () => void
}) {
  const body = (
    <>
      <div className="flex items-start gap-3 min-w-0">
        {icon && <span className="text-ink-faint mt-0.5 shrink-0">{icon}</span>}
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink">{label}</div>
          {desc && <div className="text-[13px] text-ink-muted mt-0.5 leading-relaxed">{desc}</div>}
        </div>
      </div>
      {control && <div className="shrink-0">{control}</div>}
    </>
  )
  const cls = 'flex items-center justify-between gap-4 px-5 sm:px-6 py-4 border-t border-line'
  return onClick
    ? <button type="button" onClick={onClick} className={cx(cls, focusRing, 'w-full text-left hover:bg-surface-2/60 transition-colors')}>{body}</button>
    : <div className={cx(cls, 'items-start')}>{body}</div>
}

/** Selectable pill — categories, regions, districts, approval kinds. */
export function PillToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="checkbox" aria-checked={active} onClick={onClick}
      className={cx('h-9 px-3.5 rounded-full border text-[13px] font-semibold transition-colors', focusRing,
        active
          ? cx(A.soft, A.text, 'border-[var(--accent)]/35')
          : 'bg-surface text-ink-muted border-line hover:border-line-strong hover:text-ink')}>
      {children}
    </button>
  )
}

/** A read-only fact granted by somebody else — an approval ceiling, a
    maker-checker threshold, a role's own limits. Set elsewhere on purpose, so
    it renders as a plate rather than a field you can try to type into. */
export function Granted({ items, note }: {
  items: { label: string; value: ReactNode; sub?: string }[]
  note?: string
}) {
  return (
    <>
      <dl className="grid sm:grid-cols-2 gap-px bg-line rounded-xl overflow-hidden border border-line">
        {items.map((it) => (
          <div key={it.label} className="bg-surface-2/50 px-4 py-3.5">
            <dt><Label>{it.label}</Label></dt>
            <dd className="num text-sm font-bold text-ink mt-1.5">{it.value}</dd>
            {it.sub && <dd className="text-xs text-ink-muted mt-1 leading-relaxed font-sans">{it.sub}</dd>}
          </div>
        ))}
      </dl>
      {note && <p className="text-xs text-ink-muted mt-3 leading-relaxed">{note}</p>}
    </>
  )
}

/** What this desk may do, and what it must hand to somebody else. The single
    most useful thing a staff profile can carry: the permission model, written
    out, on the account it applies to. */
export function AuthorityList({ can, cannot }: { can: string[]; cannot: { what: string; who: string }[] }) {
  return (
    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-5">
      <div>
        <Label className="text-success">Acts directly</Label>
        <ul className="mt-2.5 space-y-2">
          {can.map((c) => (
            <li key={c} className="flex gap-2.5 text-[13px] text-ink leading-relaxed">
              <Check size={14} className="text-success shrink-0 mt-0.5" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <Label className="text-warning">Must be raised to</Label>
        <ul className="mt-2.5 space-y-2">
          {cannot.map((c) => (
            <li key={c.what} className="text-[13px] leading-relaxed">
              <span className="text-ink">{c.what}</span>
              <span className="text-ink-muted"> — {c.who}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** The unsaved-changes bar. Only exists once something changed: a permanent
    footer of disabled buttons is noise. */
export function SaveBar({ onDiscard, onSave, children }: {
  onDiscard: () => void; onSave: () => void; children?: ReactNode
}) {
  return (
    <div className="sticky bottom-4 z-20 card border-[var(--accent)]/35 bg-surface/95 backdrop-blur px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 xl:col-span-2">
      <span className="text-sm font-semibold text-ink flex items-center gap-2">
        <span className={cx('size-2 rounded-full', A.bg)} />
        {children ?? 'You have unsaved changes'}
      </span>
      <div className="flex gap-2">
        <button type="button" onClick={onDiscard}
          className={cx('h-8 px-3 rounded-lg text-[13px] font-semibold text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors', focusRing)}>
          Discard
        </button>
        <button type="button" onClick={onSave}
          className={cx('h-8 px-3.5 rounded-lg text-[13px] font-bold text-white transition-opacity hover:opacity-90', A.bg, focusRing)}>
          Save changes
        </button>
      </div>
    </div>
  )
}

/** The panel grid. One column until there is room for two; panels marked
    `wide` span both. */
export function PanelGrid({ children, sectionKey }: { children: ReactNode; sectionKey: string }) {
  return (
    <div key={sectionKey} className="min-w-0 grid xl:grid-cols-2 gap-5 items-start animate-fade-up"
      style={{ animationDuration: '280ms' }}>
      {children}
    </div>
  )
}
