/* ---------------------------------------------------------------------------
   Marketplace chrome — the SAME sticky top-nav shell wraps every page
   (home, buyer, seller and all admin tiers). No left sidebars anywhere.
--------------------------------------------------------------------------- */
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell, Check, ChevronDown, Flame, Globe, LogOut, Menu, Moon, Search, Sun, User as UserIcon,
  Wallet as WalletIcon, X, ShieldCheck, LifeBuoy, FileText, SlidersHorizontal,
} from 'lucide-react'
import { ALL_ROLES, ROLE_HOME, ROLE_LABEL, useStore } from '../store/store'
import { inrCompact, relTime } from '../lib/format'
import { requestExitInterstitial } from '../lib/exitInterstitial'
import { useClientIp } from '../lib/useClientIp'
import { Avatar, Chip, cx } from '../components/ui'
import type { Role } from '../types'

/** A single source of truth per role: which nav item(s) appear on the top
 *  nav and/or the contextual sub-nav, so the two surfaces can't drift apart. */
export type NavItem = {
  to: string
  label: string
  subLabel?: string
  end?: boolean
  locked?: boolean
  in: ('top' | 'sub')[]
}

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  guest: [
    { to: '/browse', label: 'Browse auctions', in: ['top'] },
    { to: '/noticeboard', label: 'Noticeboard', in: ['top'] },
    { to: '/help', label: 'How it works', in: ['top'] },
  ],
  // Guest 2 (public-site role) — uses the shared chrome like every other role.
  // Lean top nav, no sub-nav (like the guest role); deeper content lives on the
  // home page and the two solution pages.
  guest2: [
    { to: '/g2', label: 'Home', end: true, in: ['top'] },
    { to: '/g2/solutions/buyers', label: 'For buyers', in: ['top'] },
    { to: '/g2/solutions/sellers', label: 'For sellers', in: ['top'] },
    { to: '/g2/how-it-works', label: 'How it works', in: ['top'] },
    { to: '/g2/contact', label: 'Contact', in: ['top'] },
  ],
  buyer: [
    { to: '/buyer', label: 'Dashboard', end: true, in: ['top', 'sub'] },
    { to: '/browse', label: 'Browse', in: ['top'] },
    { to: '/buyer/shortlist', label: 'Shortlist', subLabel: 'Shortlist & EMD', in: ['sub'] },
    { to: '/buyer/bids', label: 'My bids', subLabel: 'Bids & results', in: ['sub'] },
    { to: '/buyer/fulfilment', label: 'Fulfilment', in: ['sub'] },
    { to: '/noticeboard', label: 'Noticeboard', in: ['top'] },
    { to: '/buyer/wallet', label: 'Wallet & ledger', in: ['sub'] },
    { to: '/buyer/kyc', label: 'Become a seller', in: ['sub'] },
  ],
  seller: [
    { to: '/seller', label: 'Workspace', end: true, in: ['top', 'sub'] },
    { to: '/seller/create-lot', label: 'Create lot', in: ['sub'] },
    { to: '/seller/lots', label: 'My lots', subLabel: 'My lots & batches', in: ['sub'] },
    { to: '/seller/monitor', label: 'Live monitor', in: ['sub'] },
    { to: '/seller/reports', label: 'Results & reports', in: ['sub'] },
    { to: '/browse', label: 'Browse', in: ['top'] },
  ],
  field_exec: [
    { to: '/field', label: 'Inspection queue', in: ['top'] },
    { to: '/browse', label: 'Browse', in: ['top'] },
    { to: '/noticeboard', label: 'Noticeboard', in: ['top'] },
  ],
  exec_manager: [
    { to: '/exec', label: 'Pipeline', end: true, in: ['top', 'sub'] },
    { to: '/exec/approvals', label: 'Lot approval', in: ['sub'] },
    { to: '/exec/catalogue-builder', label: 'Catalogue builder', in: ['sub'] },
    { to: '/exec/auction-setup', label: 'Auction setup', in: ['sub'] },
    { to: '/exec/settlement', label: 'Settlement', in: ['sub'] },
    { to: '/exec/logistics', label: 'Logistics', in: ['sub'] },
    { to: '/exec/handover', label: 'Handover', in: ['sub'] },
    { to: '/browse', label: 'Browse', in: ['top'] },
  ],
  sub_admin: [
    { to: '/sub', label: 'Ops console', end: true, in: ['top', 'sub'] },
    { to: '/sub/bid-monitor', label: 'Bid monitor', in: ['sub'] },
    { to: '/sub/queue', label: 'Work queue', in: ['sub'] },
    { to: '/sub/approvals', label: 'Approvals', in: ['sub'] },
    { to: '/admin/finance', label: 'Financial config', locked: true, in: ['sub'] },
    { to: '/admin/master-data', label: 'Master data', locked: true, in: ['sub'] },
  ],
  super_admin: [
    { to: '/admin', label: 'Dashboard', end: true, in: ['top', 'sub'] },
    { to: '/admin/control-tower', label: 'Control tower', in: ['sub'] },
    { to: '/admin/users', label: 'Users', subLabel: 'User management', in: ['sub'] },
    { to: '/admin/team', label: 'Team', subLabel: 'Team & permissions', in: ['sub'] },
    { to: '/admin/blacklist', label: 'Blacklist & defaulters', in: ['sub'] },
    { to: '/admin/finance', label: 'Financial config', in: ['sub'] },
    { to: '/admin/master-data', label: 'Master data', in: ['sub'] },
    { to: '/admin/audit', label: 'Audit trail', in: ['sub'] },
  ],
}

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="ferroBid home">
      <span className="size-8 rounded-lg bg-ember grid place-items-center text-white">
        <Flame size={18} strokeWidth={2.5} />
      </span>
      <span className="font-display text-xl font-bold tracking-tight hidden sm:block">
        ferro<span className="text-ember">Bid</span>
      </span>
    </Link>
  )
}

/* ------------------------- dropdown helper ------------------------------ */
function useClickAway(onAway: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onAway()
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [onAway])
  return ref
}

function RoleSwitcher() {
  const role = useStore((s) => s.role)
  const switchRole = useStore((s) => s.switchRole)
  const [open, setOpen] = useState(false)
  const ref = useClickAway(() => setOpen(false))
  const nav = useNavigate()
  const roles = ALL_ROLES
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="h-9 pl-3 pr-2 rounded-xl border border-dashed border-ember/50 bg-ember-soft/60 text-ember-strong text-xs font-bold inline-flex items-center gap-1.5 hover:bg-ember-soft"
        title="Demo role switcher">
        <ShieldCheck size={13} />
        <span className="hidden md:inline">Demo:</span> {ROLE_LABEL[role]}
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="absolute right-0 top-11 card shadow-xl w-56 p-1.5 z-50 animate-toast-in">
          <div className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Jump to role</div>
          {roles.map((r) => (
            <button key={r}
              onClick={() => {
                setOpen(false)
                const go = () => { switchRole(r); nav(ROLE_HOME[r]) }
                /* Jumping out of a public marketing site is a genuine exit, so
                   give the current page a chance to show its leave-interstitial
                   (Guest 2's WhatsApp invite) and finish the switch afterwards.
                   No interstitial registered → switches immediately. */
                if (r !== role && requestExitInterstitial(go)) return
                go()
              }}
              className={cx('w-full text-left px-2.5 py-2 rounded-lg text-sm font-medium hover:bg-surface-2',
                r === role ? 'text-ember-strong bg-ember-soft/60' : 'text-ink')}>
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function NotificationBell() {
  const me = useStore((s) => s.currentUser)
  const notifications = useStore((s) => s.notifications)
  const markRead = useStore((s) => s.markNotificationsRead)
  const [open, setOpen] = useState(false)
  const ref = useClickAway(() => setOpen(false))
  const nav = useNavigate()
  const mine = notifications.filter((n) => n.userId === null || n.userId === me?.id).slice(0, 12)
  const unread = mine.filter((n) => !n.read).length
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        className="relative size-9 rounded-xl grid place-items-center text-ink-muted hover:bg-surface-2 hover:text-ink">
        <Bell size={18} />
        {unread > 0 && <span className="num absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-ember text-white text-[10px] font-bold grid place-items-center">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-11 card shadow-xl w-[min(92vw,380px)] z-50 animate-toast-in overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
            <span className="font-bold text-sm">Notifications</span>
            {unread > 0 && <button onClick={markRead} className="text-xs font-semibold text-steel hover:underline">Mark all read</button>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {mine.length === 0 && <div className="p-6 text-center text-sm text-ink-faint">Nothing yet.</div>}
            {mine.map((n) => (
              <button key={n.id}
                onClick={() => { if (n.href) nav(n.href); setOpen(false) }}
                className={cx('w-full text-left px-4 py-3 border-b border-line last:border-0 hover:bg-surface-2 flex gap-2.5',
                  !n.read && 'bg-ember-soft/30')}>
                <span className={cx('mt-1.5 size-1.5 rounded-full shrink-0', !n.read ? 'bg-ember' : 'bg-transparent')} />
                <span>
                  <span className="block text-sm font-semibold leading-snug">{n.title}</span>
                  <span className="block text-xs text-ink-muted leading-snug mt-0.5">{n.body}</span>
                  <span className="block text-[11px] text-ink-faint mt-1">{relTime(n.at, Date.now())}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ProfileMenu() {
  const me = useStore((s) => s.currentUser)
  const role = useStore((s) => s.role)
  const logout = useStore((s) => s.logout)
  const [open, setOpen] = useState(false)
  const ref = useClickAway(() => setOpen(false))
  const nav = useNavigate()
  if (!me) {
    return <Link to="/login" className="h-9 px-4 rounded-xl bg-ember text-white text-sm font-semibold inline-flex items-center hover:bg-ember-strong">Sign in</Link>
  }
  const items = [
    { icon: <UserIcon size={15} />, label: 'Profile & settings', to: '/profile' },
    { icon: <SlidersHorizontal size={15} />, label: 'Notification preferences', to: '/settings/notifications' },
    { icon: <LifeBuoy size={15} />, label: 'Help & disputes', to: '/help' },
    { icon: <FileText size={15} />, label: 'Terms & privacy', to: '/legal' },
  ]
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-surface-2" aria-label="Profile menu">
        <Avatar name={me.name} hue={me.avatarHue} size={30} />
        <ChevronDown size={14} className="text-ink-faint" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 card shadow-xl w-64 z-50 animate-toast-in overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <div className="font-bold text-sm">{me.name}</div>
            <div className="text-xs text-ink-muted">{me.firm}</div>
            <Chip tone="steel" className="mt-1.5">{ROLE_LABEL[role]}</Chip>
          </div>
          <div className="p-1.5">
            {items.map((it) => (
              <button key={it.to} onClick={() => { nav(it.to); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-ink hover:bg-surface-2">
                {it.icon} {it.label}
              </button>
            ))}
            <button onClick={() => { logout(); setOpen(false); nav('/') }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-danger hover:bg-danger-soft">
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * SessionIp — the visitor's public IP, in the slot the catalogue search used to
 * occupy. Reads as an enterprise session/audit marker, so it's styled as a
 * static readout (not a control) and never shifts width while resolving.
 *
 * IPv6 addresses are far wider than the chip, so the value truncates and the
 * full address lives in the tooltip + copy action.
 */
function SessionIp({ className }: { className?: string }) {
  const { ip, state } = useClientIp()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(t)
  }, [copied])

  const copy = async () => {
    if (!ip) return
    try {
      await navigator.clipboard.writeText(ip)
      setCopied(true)
    } catch {
      /* clipboard blocked (insecure origin / denied) — the tooltip still shows it */
    }
  }

  const label =
    state === 'ready' ? ip : state === 'loading' ? 'Resolving…' : 'Unavailable'

  return (
    <button
      type="button"
      onClick={copy}
      disabled={state !== 'ready'}
      title={state === 'ready' ? `Session IP ${ip} — click to copy` : 'Session IP unavailable'}
      aria-label={state === 'ready' ? `Session IP ${ip}. Click to copy.` : 'Session IP unavailable'}
      className={cx(
        'h-9 px-3 rounded-xl bg-surface-2 border border-line inline-flex items-center gap-2 max-w-[13rem] shrink-0',
        state === 'ready'
          ? 'hover:border-line-strong cursor-pointer'
          : 'cursor-default opacity-70',
        className,
      )}
    >
      {copied ? (
        <Check size={13} className="text-success shrink-0" />
      ) : (
        <Globe size={13} className={cx('shrink-0', state === 'ready' ? 'text-steel' : 'text-ink-faint')} />
      )}
      <span className="flex flex-col items-start leading-none min-w-0">
        <span className="text-[9px] font-bold uppercase tracking-wider text-ink-faint">
          {copied ? 'Copied' : 'Session IP'}
        </span>
        <span className={cx('num text-[12px] font-bold mt-0.5 truncate max-w-full', state === 'ready' ? 'text-ink' : 'text-ink-faint')}>
          {label}
        </span>
      </span>
    </button>
  )
}

function TopNav() {
  const role = useStore((s) => s.role)
  const me = useStore((s) => s.currentUser)
  const wallets = useStore((s) => s.wallets)
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [q, setQ] = useState('')
  const nav = useNavigate()
  const location = useLocation()
  useEffect(() => setMobileOpen(false), [location.pathname])

  const links = NAV_BY_ROLE[role].filter((i) => i.in.includes('top'))
  const wallet = wallets.find((w) => w.userId === me?.id)
  const showWallet = role === 'buyer' || role === 'seller'
  /* Guest 2 is the public marketing site: no catalogue search in its chrome —
     it shows the session IP readout instead. Every other role keeps search. */
  const isGuest2 = role === 'guest2'

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (q.trim()) nav(`/browse?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <header className="sticky top-0 z-40 bg-canvas/90 backdrop-blur border-b border-line">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
        <button className="lg:hidden p-2 -ml-2 text-ink-muted" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <Logo />
        <nav className="hidden lg:flex items-center gap-0.5 ml-4">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === ROLE_HOME[role] || l.to === '/browse'}
              className={({ isActive }) => cx('h-9 px-3 rounded-lg text-sm font-semibold inline-flex items-center whitespace-nowrap transition-colors',
                isActive ? 'text-ember-strong bg-ember-soft/70' : 'text-ink-muted hover:text-ink hover:bg-surface-2')}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        {isGuest2 ? (
          <div className="ml-auto hidden md:block">
            <SessionIp />
          </div>
        ) : (
          <form onSubmit={submitSearch} className="ml-auto hidden md:flex items-center relative">
            <Search size={15} className="absolute left-3 text-ink-faint pointer-events-none" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search catalogues…"
              className="h-9 w-40 xl:w-52 pl-9 pr-3 rounded-xl bg-surface-2 border border-line text-sm placeholder:text-ink-faint focus:outline-2 focus:outline-ember/50 focus:bg-surface" />
          </form>
        )}
        {showWallet && wallet && (
          <Link to="/buyer/wallet" className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-surface-2 border border-line hover:border-line-strong whitespace-nowrap shrink-0" title="Wallet & EMD">
            <WalletIcon size={14} className="text-ember" />
            <span className="num text-[13px] font-bold">{inrCompact(wallet.balance)}</span>
            <span className="num text-[11px] text-ink-faint hidden xl:inline">·&nbsp;EMD {inrCompact(wallet.emdLocked)}</span>
          </Link>
        )}
        <button onClick={toggleTheme} className="size-9 rounded-xl grid place-items-center text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        {me && <NotificationBell />}
        <RoleSwitcher />
        <ProfileMenu />
      </div>
      {mobileOpen && (
        <nav className="lg:hidden border-t border-line bg-surface px-4 py-3 space-y-1 animate-fade-up">
          {isGuest2 ? (
            <div className="mb-2">
              <SessionIp />
            </div>
          ) : (
            <form onSubmit={submitSearch} className="relative mb-2">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search catalogues, lots…"
                className="h-10 w-full pl-9 pr-3 rounded-xl bg-surface-2 border border-line text-sm" />
            </form>
          )}
          {links.map((l) => (
            <NavLink key={l.to} to={l.to}
              className={({ isActive }) => cx('block px-3 py-2.5 rounded-lg text-sm font-semibold',
                isActive ? 'text-ember-strong bg-ember-soft/70' : 'text-ink-muted')}>
              {l.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  )
}

/* --------------------------------- Footer ---------------------------------- */
function Footer() {
  const year = new Date().getFullYear()
  const col = 'space-y-2 text-sm text-ink-muted'
  const h = 'text-xs font-bold uppercase tracking-wider text-ink-faint mb-3'
  return (
    <footer className="border-t border-line mt-16 bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 md:col-span-1">
          <Logo />
          <p className="text-sm text-ink-muted mt-3 max-w-xs">
            India's B2B marketplace for industrial metal auctions. Physically inspected, catalogued and sold as-is-where-is.
          </p>
        </div>
        <div>
          <div className={h}>Marketplace</div>
          <div className={col}>
            <Link to="/browse" className="block hover:text-ink">Live auctions</Link>
            <Link to="/browse?tab=upcoming" className="block hover:text-ink">Upcoming</Link>
            <Link to="/noticeboard" className="block hover:text-ink">Noticeboard</Link>
            <Link to="/buyer/kyc" className="block hover:text-ink">Become a seller</Link>
          </div>
        </div>
        <div>
          <div className={h}>Categories</div>
          <div className={col}>
            {['scrap', 'flat-products', 'long-products', 'ferro-alloys'].map((c) => (
              <Link key={c} to={`/browse?category=${c}`} className="block hover:text-ink capitalize">{c.replace('-', ' ')}</Link>
            ))}
          </div>
        </div>
        <div>
          <div className={h}>Support</div>
          <div className={col}>
            <Link to="/help" className="block hover:text-ink">Help & FAQ</Link>
            <Link to="/disputes" className="block hover:text-ink">Raise a dispute</Link>
            <Link to="/legal" className="block hover:text-ink">Terms & privacy</Link>
            <a href="tel:+911800419000" className="block hover:text-ink num">1800-419-000 (toll free)</a>
          </div>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-faint">
          <span>© {year} ferroBid Technologies Pvt Ltd. Prototype — all data is simulated.</span>
          <span>GSTIN 27AAICF9021P1ZX · CIN U74999MH2024PTC431180</span>
        </div>
      </div>
    </footer>
  )
}

/* ------------------------- contextual sub-nav ------------------------------ */
/** Secondary nav under the header for multi-section areas — never a sidebar. */
export function SubNav({ items }: { items: { to: string; label: string; end?: boolean; locked?: boolean }[] }) {
  return (
    <div className="border-b border-line bg-surface/60 sticky top-16 z-30 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto">
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end}
            className={({ isActive }) => cx('h-11 px-3.5 text-[13px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 -mb-px transition-colors',
              isActive ? 'border-ember text-ink' : 'border-transparent text-ink-muted hover:text-ink')}>
            {it.label}
            {it.locked && <span className="text-ink-faint" title="Restricted for this role">🔒</span>}
          </NavLink>
        ))}
      </div>
    </div>
  )
}

/* --------------------------------- Shell ----------------------------------- */
export default function Chrome() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

/** Standard full-width content container. */
export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('max-w-7xl mx-auto px-4 sm:px-6 py-8', className)}>{children}</div>
}
