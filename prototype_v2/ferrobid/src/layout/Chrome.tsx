/* ---------------------------------------------------------------------------
   Marketplace chrome — the SAME sticky top-nav shell wraps every page
   (home, buyer, seller and all admin tiers). No left sidebars anywhere.
--------------------------------------------------------------------------- */
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell, Check, ChevronDown, Flame, Globe, LogOut, Mail, Menu, Moon, Search, Sun, User as UserIcon,
  Wallet as WalletIcon, X, LifeBuoy, FileText, SlidersHorizontal,
} from 'lucide-react'
import { ROLE_HOME, ROLE_LABEL, useStore } from '../store/store'
import { inrCompact, relTime } from '../lib/format'
import { useClientIp } from '../lib/useClientIp'
import { AppComingSoonModal, Avatar, Chip, cx } from '../components/ui'
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
  // guest1 renders its own standalone app (Guest1App) outside this Chrome
  // shell, so it needs no top/sub nav items here — the map only requires a key.
  guest1: [],
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
    { to: '/buyer', label: 'Home', subLabel: 'Dashboard', end: true, in: ['top', 'sub'] },
    { to: '/buyermarketplace', label: 'Browse Catalogues', in: ['top'] },
    { to: '/buyer/shortlist', label: 'Shortlist', subLabel: 'Shortlist & EMD', in: ['sub'] },
    { to: '/buyer/bids', label: 'My bids', subLabel: 'Bids & results', in: ['sub'] },
    { to: '/buyer/fulfilment', label: 'Fulfilment', in: ['sub'] },
    { to: '/noticeboard', label: 'Noticeboard', in: ['top'] },
    { to: '/buyer/wallet', label: 'Wallet & ledger', in: ['sub'] },
    { to: '/buyer/kyc', label: 'Become a seller', in: ['sub'] },
  ],
  seller: [
    { to: '/seller', label: 'Workspace', end: true, in: ['sub'] },
    { to: '/seller/create-lot', label: 'Create lot', in: ['sub'] },
    { to: '/seller/lots', label: 'My lots', subLabel: 'My lots & batches', in: ['sub'] },
    { to: '/seller/monitor', label: 'Live monitor', in: ['sub'] },
    { to: '/seller/reports', label: 'Results & reports', in: ['sub'] },
  ],
  field_exec: [
    { to: '/field', label: 'Inspection queue', in: ['top'] },
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
    if (!q.trim()) return
    const dest = role === 'buyer' ? '/buyermarketplace' : '/browse'
    nav(`${dest}?q=${encodeURIComponent(q.trim())}`)
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
            <NavLink key={l.to} to={l.to} end={l.to === ROLE_HOME[role] || l.to === '/browse' || l.to === '/buyermarketplace'}
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
/** Copyright/GSTIN strip shared by every footer variant below. */
function FooterBottom() {
  const year = new Date().getFullYear()
  return (
    <div className="border-t border-line">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-faint">
        <span>© {year} ferroBid Technologies Pvt Ltd. Prototype — all data is simulated.</span>
        <span>GSTIN 27AAICF9021P1ZX · CIN U74999MH2024PTC431180</span>
      </div>
    </div>
  )
}

function DefaultFooter() {
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
      <FooterBottom />
    </footer>
  )
}

/** The public homepage's (guest1, #/home) footer, ported to Chrome's Tailwind
 *  tokens — guest1 ships its own isolated CSS that's disabled outside guest1
 *  (see Guest1Gate), so its markup can't be reused verbatim here. Guest1-only
 *  destinations (calendar, pricing, about-us, …) link out via native <a
 *  href="#/home/…"> rather than <Link>, since those routes live in guest1's
 *  own HashRouter, not this app's. */
function HomeFooter() {
  const col = 'space-y-2 text-sm text-ink-muted'
  const h = 'text-xs font-bold uppercase tracking-wider text-ink-faint mb-3'
  const [appModalOpen, setAppModalOpen] = useState(false)
  return (
    <footer className="border-t border-line mt-16 bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8">
        <div className="col-span-2 sm:col-span-3 lg:col-span-1">
          <Logo />
          <p className="text-sm text-ink-muted mt-3 max-w-xs">India's Trusted Digital Metal Auction Platform</p>
          <div className="flex items-center gap-3 mt-3 text-xs text-ink-faint">
            <a href="#/home/privacy" className="hover:text-ink">Privacy Policy</a>
            <a href="#/home/terms" className="hover:text-ink">Terms and Conditions</a>
          </div>
        </div>
        <div>
          <div className={h}>Marketplace</div>
          <div className={col}>
            <a href="#/home/marketplace" className="block hover:text-ink">Browse All Auctions</a>
            <a href="#/home/calendar" className="block hover:text-ink">Auction Calendar</a>
            <a href="#/home/pricing" className="block hover:text-ink">Pricing & Plans</a>
          </div>
        </div>
        <div>
          <div className={h}>Company</div>
          <div className={col}>
            <a href="#/home/about-us" className="block hover:text-ink">About Us</a>
            <a href="#/home/how-it-works" className="block hover:text-ink">How it works</a>
            <a href="#/home/contact" className="block hover:text-ink">Contact Us</a>
          </div>
        </div>
        <div>
          <div className={h}>Resources</div>
          <div className={col}>
            <a href="#/home/blog" className="block hover:text-ink">Blog</a>
            <a href="#/home/knowledge-center" className="block hover:text-ink">Knowledge Center</a>
            <a href="#/home/market-reports" className="block hover:text-ink">Market Reports</a>
          </div>
        </div>
        <div>
          <div className={h}>Support</div>
          <div className={col}>
            <a href="#/home/help-center" className="block hover:text-ink">Help Center</a>
            <a href="#/home/faqs" className="block hover:text-ink">Help & FAQs</a>
            <a href="#/home/grievance" className="block hover:text-ink">Grievance Redressal</a>
          </div>
        </div>
        <div>
          <div className={h}>Download App</div>
          <div className="flex flex-wrap gap-2">
            {/* Vite doesn't rewrite string-literal src paths, so public/ assets
                need BASE_URL or they 404 when served from a sub-path (GitHub Pages). */}
            <button type="button" onClick={() => setAppModalOpen(true)} aria-label="Get it on Google Play" className="p-0 border-0 bg-transparent leading-none cursor-pointer rounded-lg transition-opacity hover:opacity-80">
              <img src={`${import.meta.env.BASE_URL}badges/google-play.svg`} alt="" className="h-6 w-auto" />
            </button>
            <button type="button" onClick={() => setAppModalOpen(true)} aria-label="Download on the App Store" className="p-0 border-0 bg-transparent leading-none cursor-pointer rounded-lg transition-opacity hover:opacity-80">
              <img src={`${import.meta.env.BASE_URL}badges/app-store.svg`} alt="" className="h-6 w-auto" />
            </button>
          </div>
          <div className="flex items-center gap-3 mt-4 text-ink-faint">
            <a href="mailto:contact@ferrobid.in" aria-label="Email" className="hover:text-ink"><Mail size={16} /></a>
            <a href="https://www.linkedin.com/company/ferrobid" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="hover:text-ink">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                <rect x="2" y="9" width="4" height="12" />
                <circle cx="4" cy="4" r="2" />
              </svg>
            </a>
          </div>
        </div>
      </div>
      <FooterBottom />
      <AppComingSoonModal open={appModalOpen} onClose={() => setAppModalOpen(false)} />
    </footer>
  )
}

/** Roles whose entire section (dashboard + sub-pages) shows the home page's
 *  footer instead of the default one — per product decision, not every
 *  Chrome-wrapped page (login, catalogue, browse, g2, …) gets it. */
const HOME_FOOTER_PATH_PREFIXES = ['/buyer', '/buyermarketplace', '/seller', '/exec', '/field', '/sub', '/admin']

function Footer() {
  const { pathname } = useLocation()
  const showHomeFooter = HOME_FOOTER_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  return showHomeFooter ? <HomeFooter /> : <DefaultFooter />
}

/* ------------------------- contextual sub-nav ------------------------------ */
/** Secondary nav under the header for multi-section areas — never a sidebar. */
export function SubNav({ items }: { items: { to: string; label: string; end?: boolean; locked?: boolean }[] }) {
  return (
    <div className="border-b border-line bg-surface/60 sticky top-16 z-30 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto overflow-y-hidden">
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
