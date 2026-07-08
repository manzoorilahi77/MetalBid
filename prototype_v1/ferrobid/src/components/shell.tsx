import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Flame, Bell, ChevronDown, Menu, X, LayoutDashboard, Gavel, Wallet as WalletIcon,
  Package, Truck, BadgeCheck, ClipboardCheck, CalendarClock, Banknote, Handshake,
  Users, Settings, ScrollText, Megaphone, Store, KanbanSquare, LogOut, UserCircle2,
  CheckCircle2, AlertCircle, Info, TrendingUp, Radio, FilePlus2, Trophy, ShieldCheck,
} from 'lucide-react';
import { useApp, PERSONAS } from '../store';
import type { Role } from '../types';
import { cx, agoLabel, inrCompact } from '../utils';
import { Badge } from './ui';

const ROLE_LABEL: Record<Role, string> = {
  guest: 'Guest User', buyer: 'Buyer', seller: 'Buyer + Seller',
  exec: 'Executive Admin', subadmin: 'Sub-Admin', superadmin: 'Super Admin',
};

const ROLE_TONE: Record<Role, string> = {
  guest: 'bg-slate-100 text-slate-600 ring-slate-300',
  buyer: 'bg-sky-50 text-sky-700 ring-sky-200',
  seller: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  exec: 'bg-ember-50 text-ember-700 ring-ember-200',
  subadmin: 'bg-violet-50 text-violet-700 ring-violet-200',
  superadmin: 'bg-steel-100 text-steel-800 ring-steel-300',
};

interface NavItem { to: string; label: string; icon: React.ReactNode; badge?: number }

function navFor(role: Role, counts: { execQueue: number; liveCount: number }): { section: string; items: NavItem[] }[] {
  const live = counts.liveCount;
  switch (role) {
    case 'guest':
      return [{
        section: 'Explore',
        items: [
          { to: '/browse', label: 'Browse Auctions', icon: <Gavel size={17} />, badge: live },
          { to: '/noticeboard', label: 'Noticeboard', icon: <Megaphone size={17} /> },
        ],
      }];
    case 'buyer':
      return [
        {
          section: 'Marketplace',
          items: [
            { to: '/buyer', label: 'Dashboard', icon: <LayoutDashboard size={17} /> },
            { to: '/browse', label: 'Auctions', icon: <Gavel size={17} />, badge: live },
            { to: '/buyer/bids', label: 'My Bids & Results', icon: <Trophy size={17} /> },
            { to: '/buyer/fulfilment', label: 'Fulfilment Tracker', icon: <Truck size={17} /> },
          ],
        },
        {
          section: 'Account',
          items: [
            { to: '/buyer/wallet', label: 'Wallet & EMD', icon: <WalletIcon size={17} /> },
            { to: '/buyer/become-seller', label: 'Become a Seller', icon: <Store size={17} /> },
            { to: '/noticeboard', label: 'Noticeboard', icon: <Megaphone size={17} /> },
          ],
        },
      ];
    case 'seller':
      return [
        {
          section: 'Sell',
          items: [
            { to: '/seller', label: 'Seller Workspace', icon: <LayoutDashboard size={17} /> },
            { to: '/seller/create', label: 'List a Lot', icon: <FilePlus2 size={17} /> },
            { to: '/seller/lots', label: 'My Lots', icon: <Package size={17} /> },
            { to: '/seller/monitor', label: 'Live Monitor', icon: <Radio size={17} />, badge: live },
            { to: '/seller/results', label: 'Results & Reports', icon: <TrendingUp size={17} /> },
          ],
        },
        {
          section: 'Buy (retained)',
          items: [
            { to: '/browse', label: 'Auctions', icon: <Gavel size={17} /> },
            { to: '/buyer/wallet', label: 'Wallet & EMD', icon: <WalletIcon size={17} /> },
            { to: '/noticeboard', label: 'Noticeboard', icon: <Megaphone size={17} /> },
          ],
        },
      ];
    case 'exec':
      return [
        {
          section: 'Pipeline',
          items: [
            { to: '/exec', label: 'Pipeline Board', icon: <KanbanSquare size={17} /> },
            { to: '/exec/entities', label: 'Entity Verification', icon: <BadgeCheck size={17} />, badge: counts.execQueue },
            { to: '/exec/lots', label: 'Lot Verification', icon: <ClipboardCheck size={17} /> },
            { to: '/exec/auctions', label: 'Auction Setup', icon: <CalendarClock size={17} /> },
          ],
        },
        {
          section: 'Fulfilment',
          items: [
            { to: '/exec/settlement', label: 'Settlement', icon: <Banknote size={17} /> },
            { to: '/exec/logistics', label: 'Logistics', icon: <Truck size={17} /> },
            { to: '/exec/handover', label: 'Handover', icon: <Handshake size={17} /> },
            { to: '/noticeboard', label: 'Noticeboard', icon: <Megaphone size={17} /> },
          ],
        },
      ];
    case 'subadmin':
      return [{
        section: 'Operations',
        items: [
          { to: '/sub', label: 'Ops Console', icon: <LayoutDashboard size={17} /> },
          { to: '/sub/audit', label: 'Audit Log', icon: <ScrollText size={17} /> },
          { to: '/noticeboard', label: 'Noticeboard', icon: <Megaphone size={17} /> },
        ],
      }];
    case 'superadmin':
      return [
        {
          section: 'Governance',
          items: [
            { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={17} /> },
            { to: '/admin/team', label: 'Admins & Permissions', icon: <ShieldCheck size={17} /> },
            { to: '/admin/users', label: 'User Management', icon: <Users size={17} /> },
          ],
        },
        {
          section: 'Platform',
          items: [
            { to: '/admin/config', label: 'System Config', icon: <Settings size={17} /> },
            { to: '/admin/audit', label: 'Audit Trail', icon: <ScrollText size={17} /> },
            { to: '/noticeboard', label: 'Noticeboard', icon: <Megaphone size={17} /> },
          ],
        },
      ];
  }
}

export function roleHome(role: Role): string {
  return { guest: '/browse', buyer: '/buyer', seller: '/seller', exec: '/exec', subadmin: '/sub', superadmin: '/admin' }[role];
}

function Logo({ light }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-ember-500 to-ember-700 text-white shadow-sm">
        <Flame size={18} strokeWidth={2.5} />
      </div>
      <div className="leading-none">
        <div className={cx('text-[17px] font-extrabold tracking-tight', light ? 'text-white' : 'text-steel-950')}>
          ferro<span className="text-ember-500">Bid</span>
        </div>
        <div className={cx('text-[9px] font-semibold uppercase tracking-[0.14em]', light ? 'text-steel-300' : 'text-slate-400')}>Metal Auctions</div>
      </div>
    </div>
  );
}

function RoleSwitcher() {
  const { role, userName, switchRole } = useApp();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 hover:bg-slate-50 cursor-pointer"
      >
        <UserCircle2 size={20} className="text-steel-700" />
        <span className="hidden sm:block text-left leading-tight">
          <span className="block text-xs font-bold text-steel-950">{userName}</span>
          <span className="block text-[10px] font-medium text-slate-400">{ROLE_LABEL[role]}</span>
        </span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-slate-200 animate-toast-in">
          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Demo role switcher</div>
          {PERSONAS.map((p) => (
            <button
              key={p.role}
              onClick={() => { switchRole(p.role); setOpen(false); nav(roleHome(p.role)); }}
              className={cx('flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-slate-50 cursor-pointer', role === p.role && 'bg-steel-50')}
            >
              <span className={cx('mt-0.5 h-2 w-2 shrink-0 rounded-full', role === p.role ? 'bg-ember-500' : 'bg-slate-200')} />
              <span>
                <span className="flex items-center gap-2 text-sm font-semibold text-steel-950">{p.name} <Badge tone={ROLE_TONE[p.role]}>{p.label}</Badge></span>
                <span className="block text-[11px] text-slate-400">{p.sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationBell() {
  const { role, notifications, markAllRead, now } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const mine = notifications.filter((n) => n.audience === role || n.audience === 'all').slice(0, 12);
  const unread = mine.filter((n) => !n.read).length;
  if (role === 'guest') return null;
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative rounded-xl border border-slate-200 bg-white p-2 hover:bg-slate-50 cursor-pointer">
        <Bell size={17} className="text-steel-700" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-ember-500 px-1 text-[10px] font-bold text-white">{unread}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 animate-toast-in">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="text-sm font-bold text-steel-950">Notifications</span>
            <button onClick={() => markAllRead(role)} className="text-[11px] font-semibold text-steel-600 hover:underline cursor-pointer">Mark all read</button>
          </div>
          <div className="max-h-96 overflow-y-auto thin-scroll p-1.5">
            {mine.length === 0 && <div className="px-3 py-8 text-center text-xs text-slate-400">No notifications yet</div>}
            {mine.map((n) => (
              <div key={n.id} className={cx('rounded-xl px-3 py-2.5', !n.read && 'bg-ember-50/50')}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[13px] font-semibold text-steel-950 leading-snug">{n.title}</span>
                  {!n.read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-ember-500" />}
                </div>
                <div className="mt-0.5 text-xs text-slate-500 leading-snug">{n.body}</div>
                <div className="mt-1 text-[10px] font-medium text-slate-400">{agoLabel(n.at, now)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ToastHost() {
  const { toasts, dismissToast } = useApp();
  const icons = {
    success: <CheckCircle2 size={17} className="text-emerald-400" />,
    error: <AlertCircle size={17} className="text-red-400" />,
    info: <Info size={17} className="text-sky-400" />,
    bid: <Gavel size={17} className="text-ember-400" />,
  };
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto animate-toast-in rounded-xl bg-steel-950 p-3.5 text-white shadow-2xl ring-1 ring-white/10">
          <div className="flex items-start gap-2.5">
            {icons[t.tone]}
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold leading-snug">{t.title}</div>
              {t.body && <div className="mt-0.5 text-xs text-steel-200 leading-snug">{t.body}</div>}
            </div>
            <button onClick={() => dismissToast(t.id)} className="text-steel-400 hover:text-white cursor-pointer"><X size={14} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AppShell() {
  const { role, wallet, tick, entityRequests, auctions, logout, authenticated } = useApp();
  const [drawer, setDrawer] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();

  // simulation engine heartbeat (countdowns, bots, auto-extension, lifecycle)
  useEffect(() => {
    const iv = setInterval(() => useApp.getState().tick(), 1000);
    return () => clearInterval(iv);
  }, [tick]);

  useEffect(() => setDrawer(false), [loc.pathname]);

  // keep the demo persona coherent with deep links into role-specific areas
  useEffect(() => {
    const p = loc.pathname;
    const want: Role | null = p.startsWith('/exec') ? 'exec'
      : p.startsWith('/admin') ? 'superadmin'
      : p.startsWith('/sub') ? 'subadmin'
      : p.startsWith('/seller') ? 'seller'
      : p.startsWith('/buyer') || p.startsWith('/bid/') ? (role === 'seller' ? null : 'buyer')
      : null;
    if (want && role !== want) useApp.getState().switchRole(want);
  }, [loc.pathname, role]);

  const counts = {
    execQueue: entityRequests.filter((r) => r.status === 'pending').length,
    liveCount: auctions.filter((a) => a.status === 'live').length,
  };
  const sections = navFor(role, counts);

  const sidebar = (
    <div className="flex h-full flex-col bg-steel-950">
      <div className="flex items-center justify-between px-5 py-5">
        <Logo light />
        <button className="lg:hidden text-steel-300 cursor-pointer" onClick={() => setDrawer(false)}><X size={18} /></button>
      </div>
      <div className="mx-4 mb-3 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
        <Badge tone={ROLE_TONE[role]}>{ROLE_LABEL[role]}</Badge>
        <div className="mt-1 text-[10px] text-steel-300">Prototype · simulated data & roles</div>
      </div>
      <nav className="flex-1 overflow-y-auto thin-scroll px-3 pb-4">
        {sections.map((sec) => (
          <div key={sec.section} className="mb-4">
            <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-steel-400">{sec.section}</div>
            {sec.items.map((it) => (
              <NavLink
                key={it.to} to={it.to} end={it.to === roleHome(role) || it.to === '/browse'}
                className={({ isActive }) => cx(
                  'mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                  isActive ? 'bg-ember-600/90 text-white shadow-sm' : 'text-steel-200 hover:bg-white/5 hover:text-white'
                )}
              >
                {it.icon}
                <span className="flex-1">{it.label}</span>
                {!!it.badge && <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-bold">{it.badge}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        {authenticated ? (
          <button onClick={() => { logout(); nav('/'); }} className="flex items-center gap-2 text-xs font-semibold text-steel-300 hover:text-white cursor-pointer">
            <LogOut size={14} /> Sign out (demo)
          </button>
        ) : (
          <button onClick={() => nav('/auth/login')} className="w-full rounded-lg bg-ember-600 py-2 text-xs font-bold text-white hover:bg-ember-500 cursor-pointer">
            Register / Login to participate
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      {/* desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0">{sidebar}</aside>
      {/* mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-steel-950/60" onClick={() => setDrawer(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 animate-toast-in">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur">
          <button className="lg:hidden rounded-lg border border-slate-200 p-2 cursor-pointer" onClick={() => setDrawer(true)}><Menu size={17} /></button>
          <div className="lg:hidden"><Logo /></div>
          <div className="hidden lg:block text-sm font-semibold text-slate-400">
            {ROLE_LABEL[role]} <span className="mx-1 text-slate-300">/</span> <span className="text-steel-900">ferroBid Console</span>
          </div>
          <div className="flex-1" />
          {(role === 'buyer' || role === 'seller') && (
            <button onClick={() => nav('/buyer/wallet')} className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50 cursor-pointer">
              <WalletIcon size={15} className="text-emerald-600" />
              <span className="text-xs font-bold text-steel-950">{inrCompact(wallet.balance)}</span>
              <span className="text-[10px] font-medium text-slate-400">· EMD {inrCompact(wallet.emdLocked)}</span>
            </button>
          )}
          <NotificationBell />
          <RoleSwitcher />
        </header>
        <main className="flex-1 overflow-y-auto thin-scroll">
          <div key={loc.pathname} className="animate-page-in mx-auto max-w-7xl p-4 sm:p-6">
            <Outlet />
          </div>
        </main>
      </div>
      <ToastHost />
    </div>
  );
}
