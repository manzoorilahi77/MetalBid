/* ---------------------------------------------------------------------------
   Super Admin — Dashboard.

   A dashboard answers exactly two questions: **is anything wrong**, and **what
   needs me today**. Ours adds a third that belongs to no other role — *did
   somebody change the platform, and can I put it back*.

   So the screen reads top-down: the state of the platform, then the work lists
   (structural changes with a one-click undo, the escalations only we can clear,
   our Sub Admins and what they have been doing, and the critical audit events),
   then the door into everything a Sub Admin sees, and only then the
   marketplace-wide KPIs. Nothing here is edited in place — every row links to
   the screen where it is resolved.
--------------------------------------------------------------------------- */
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router-dom'
import {
  Activity, AlertTriangle, ArrowRight, FileText, History, KeyRound, LifeBuoy, Undo2, Users as UsersIcon, Zap,
} from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Avatar, Button, Chip, PageHeader, ProgressBar, Stat } from '../../components/ui'
import { CATEGORY_META } from '../../components/domain'
import { MarketInsights } from '../../components/MarketInsights'
import { useStore } from '../../store/store'
import { inrCompact, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'

const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 13 }

/* ------------------------- the platform, and the undo ---------------------- */

/** Roles, menus and accounts as they stand, plus the two counts that mean
 *  somebody has been changing them. */
function PlatformState() {
  const now = useNow()
  const users = useStore((s) => s.users)
  const roles = useStore((s) => s.roleRegistry)
  const pages = useStore((s) => s.pageRegistry)
  const changes = useStore((s) => s.structuralChanges)
  const auditEvents = useStore((s) => s.auditEvents)
  const passwordResets = useStore((s) => s.passwordResets)

  const dayAgo = now - 24 * 3600_000
  const recentPageChanges = changes.filter((c) => c.kind.startsWith('page.') && Date.parse(c.at) > dayAgo).length
  /* Sign-in failures are recorded like any other action. Nothing recorded is a
     real answer here, not a missing one — so it says so rather than showing 0. */
  const failedSignIns = auditEvents.filter((e) => e.action.startsWith('auth.fail') && Date.parse(e.at) > dayAgo).length
  const notSigningIn = users.filter((u) => (u.accountStatus ?? 'active') !== 'active').length

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <Stat label="Total users" value={num(users.length)} to="/admin/users"
        sub={notSigningIn > 0 ? `${notSigningIn} cannot sign in` : 'all able to sign in'} />
      <Stat label="Roles in use" value={num(roles.filter((r) => r.status === 'active').length)} to="/admin/roles"
        tone="ember" sub={`${pages.length} menu entries`} />
      <Stat label="Pages changed (24h)" value={num(recentPageChanges)} to="/admin/pages"
        tone={recentPageChanges ? 'warning' : undefined} sub="rename · hide · reorder" />
      <Stat label="Failed sign-ins (24h)" value={failedSignIns === 0 ? 'None' : num(failedSignIns)}
        tone={failedSignIns ? 'danger' : undefined} sub="none recorded is the answer" />
      <Stat label="Open password resets" value={num(passwordResets.filter((r) => !r.consumed).length)} to="/admin/users"
        tone={passwordResets.some((r) => !r.consumed) ? 'ember' : undefined} sub="issued, not yet used" />
    </div>
  )
}

/** Recent structural changes, each with the undo beside it — the whole reason
 *  a bad change to this platform is not an emergency release. */
function RecentChanges() {
  const now = useNow()
  const changes = useStore((s) => s.structuralChanges)
  const users = useStore((s) => s.users)
  const undoStructuralChange = useStore((s) => s.undoStructuralChange)
  const pushToast = useStore((s) => s.pushToast)

  const recent = changes.slice(0, 5)
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="font-bold flex items-center gap-2"><History size={16} className="text-ember" /> Recent changes</h2>
        <Link to="/admin/change-history" className="text-[13px] font-semibold text-ember hover:underline">All history</Link>
      </div>
      {recent.length === 0 && <p className="text-sm text-ink-faint">Nothing has been changed yet.</p>}
      <div className="divide-y divide-line">
        {recent.map((c) => (
          <div key={c.id} className="py-2.5 flex flex-wrap items-center gap-2 text-sm">
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate">{c.target}</div>
              <div className="text-xs text-ink-faint truncate">
                {users.find((u) => u.id === c.byId)?.name ?? c.byId} · {relTime(c.at, now)}
                {c.undoneAt && ' · undone'}
              </div>
            </div>
            {c.snapshot && !c.undoneAt && (
              <Button variant="ghost" size="sm"
                onClick={() => {
                  const r = undoStructuralChange(c.id)
                  pushToast(r.ok
                    ? { kind: 'success', title: 'Undone', body: `${c.target} is back as it was.` }
                    : { kind: 'danger', title: 'Not undone', body: r.error })
                }}>
                <Undo2 size={13} /> Undo
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/** What is waiting on us specifically — the escalations no other role can
 *  finish, and the copy no other role may publish. */
function NeedsUs() {
  const voidRequests = useStore((s) => s.bidVoidRequests)
  const cancellations = useStore((s) => s.cancellationRequests)
  const ceoApprovals = useStore((s) => s.ceoApprovals)
  const drafts = useStore((s) => s.contentDrafts)
  const disputes = useStore((s) => s.disputes)

  const rows = [
    {
      to: '/admin/control-tower', icon: <AlertTriangle size={15} className="text-danger" />,
      label: 'Bid voids and cancellations', n: voidRequests.filter((r) => r.status === 'pending' && r.stage === 'requested').length
        + cancellations.filter((r) => r.status === 'pending').length,
      note: 'only a Super Admin can finish these',
    },
    {
      to: '/admin/content', icon: <FileText size={15} className="text-steel" />,
      label: 'Copy waiting to be published', n: drafts.filter((d) => d.status === 'submitted').length,
      note: 'drafted by a Sub Admin',
    },
    {
      to: '/ceo/approvals', icon: <KeyRound size={15} className="text-warning" />,
      label: 'Awaiting the CEO\'s signature', n: ceoApprovals.filter((a) => a.status === 'pending' || a.status === 'info_requested').length,
      note: 'mirrored to us for support and recovery',
    },
    {
      to: '/sub/queue', icon: <LifeBuoy size={15} className="text-ember" />,
      label: 'Open support items', n: disputes.filter((d) => d.status !== 'resolved').length,
      note: 'the Sub Admin desk works these',
    },
  ]

  return (
    <div className="card p-5">
      <h2 className="font-bold mb-3">What needs us today</h2>
      <div className="divide-y divide-line">
        {rows.map((r) => (
          <Link key={r.to} to={r.to} className="py-2.5 flex items-center gap-3 text-sm hover:bg-surface-2/60 -mx-2 px-2 rounded-lg">
            {r.icon}
            <span className="flex-1 min-w-0">
              <span className="block font-semibold truncate">{r.label}</span>
              <span className="block text-xs text-ink-faint truncate">{r.note}</span>
            </span>
            <span className={`num font-bold ${r.n ? 'text-ember' : 'text-ink-faint'}`}>{r.n}</span>
            <ArrowRight size={14} className="text-ink-faint" />
          </Link>
        ))}
      </div>
    </div>
  )
}

/** Our Sub Admins and what they have been doing — the roster this role is
 *  accountable for. */
function SubAdminActivity() {
  const now = useNow()
  const users = useStore((s) => s.users)
  const auditEvents = useStore((s) => s.auditEvents)
  const subAdmins = users.filter((u) => u.role === 'sub_admin')

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="font-bold flex items-center gap-2"><UsersIcon size={16} className="text-steel" /> Sub Admins</h2>
        <Link to="/admin/sub-admins" className="text-[13px] font-semibold text-ember hover:underline">Manage</Link>
      </div>
      {subAdmins.length === 0 && <p className="text-sm text-ink-faint">No Sub Admin accounts yet.</p>}
      <div className="divide-y divide-line">
        {subAdmins.map((u) => {
          const acted = auditEvents.filter((e) => e.actorId === u.id)
          const status = u.accountStatus ?? 'active'
          return (
            <div key={u.id} className="py-2.5 flex items-center gap-3 text-sm">
              <Avatar name={u.name} hue={u.avatarHue} size={28} />
              <span className="flex-1 min-w-0">
                <span className="block font-semibold truncate">{u.name}</span>
                <span className="block text-xs text-ink-faint truncate">
                  {acted.length ? `${acted.length} actions · last ${relTime(acted[0].at, now)}` : 'nothing recorded yet'}
                </span>
              </span>
              {status === 'active' ? <Chip tone="success">Active</Chip> : <Chip tone="warning">{status}</Chip>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** The critical line of the audit trail, on the landing page, because a
 *  critical event nobody reads is the same as no audit trail at all. */
function CriticalEvents() {
  const now = useNow()
  const auditEvents = useStore((s) => s.auditEvents)
  const users = useStore((s) => s.users)
  const critical = auditEvents.filter((e) => e.severity === 'critical').slice(0, 6)

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="font-bold">Critical audit events</h2>
        <Link to="/admin/audit" className="text-[13px] font-semibold text-ember hover:underline">Audit trail</Link>
      </div>
      {critical.length === 0 && <p className="text-sm text-ink-faint">Nothing at critical severity.</p>}
      <div className="divide-y divide-line">
        {critical.map((e) => (
          <div key={e.id} className="py-2.5 text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <Chip tone="danger" className="num">{e.action}</Chip>
              <span className="num text-xs font-bold truncate">{e.target}</span>
              <span className="num text-[11px] text-ink-faint ml-auto">{relTime(e.at, now)}</span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5 line-clamp-2">{e.detail}</p>
            <p className="text-[11px] text-ink-faint">{users.find((u) => u.id === e.actorId)?.name ?? e.actorId}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Everything a Sub Admin sees is ours too. Rather than duplicating their
 *  eighteen tabs into our menu, this is the door into their workspace. */
function OperationsRail() {
  const links = [
    { to: '/sub', label: 'Ops console', note: 'the whole operation in one place' },
    { to: '/sub/queue', label: 'Work queue', note: 'assigned work, ranked by SLA' },
    { to: '/sub/approvals', label: 'Approvals — all roles', note: 'confirm, question or reverse' },
    { to: '/sub/bid-monitor', label: 'Bid monitor', note: 'flag a bid; we void it' },
    { to: '/finance', label: 'Finance desk', note: 'we read it; Finance moves the money' },
    { to: '/auction/live', label: 'Live auctions', note: 'the floor, as it runs' },
  ]
  return (
    <div className="card p-5 mt-6">
      <h2 className="font-bold mb-1">Everything a Sub Admin sees</h2>
      <p className="text-sm text-ink-muted mb-3">
        A Super Admin holds the whole operational workspace as well as this one. It is not copied into our menu — these are the same
        screens, and whoever acts on them is named in the audit entry.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="card bg-surface-2 border-0 p-3 hover:bg-surface-2/60 flex items-center gap-2">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-sm truncate">{l.label}</span>
              <span className="block text-xs text-ink-faint truncate">{l.note}</span>
            </span>
            <ArrowRight size={14} className="text-ink-faint shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const now = useNow()
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const bids = useStore((s) => s.bids)
  const users = useStore((s) => s.users)
  const wallets = useStore((s) => s.wallets)

  const sold = lots.filter((l) => l.status === 'sold' && l.resultH1Rate)
  const gmv = sold.reduce((s, l) => s + l.resultH1Rate! * l.indicativeQty, 0)
  const liveCats = catalogues.filter((c) => c.status === 'live')
  const liveLotIds = new Set(lots.filter((l) => l.status === 'live').map((l) => l.id))
  const activeBidders = new Set(bids.filter((b) => b.status === 'valid' && liveLotIds.has(b.lotId)).map((b) => b.bidderId)).size
  const resolved = lots.filter((l) => ['sold', 'sta', 'unsold'].includes(l.status))
  const sellThrough = resolved.length ? (sold.length / resolved.length) * 100 : 0
  const emdHeld = wallets.reduce((s, w) => s + w.emdLocked, 0)

  // synthesized weekly trend anchored to real GMV
  const gmvTrend = Array.from({ length: 8 }, (_, i) => ({
    week: `W${i + 1}`,
    gmv: Math.round((gmv / 1e5) * (0.45 + i * 0.08 + (i % 3) * 0.05)),
  }))
  const byCat = catalogues.filter((c) => c.status === 'closed').map((c) => ({
    name: c.code,
    value: Math.round(lots.filter((l) => l.catalogueId === c.id && l.status === 'sold')
      .reduce((s, l) => s + (l.resultH1Rate ?? 0) * l.indicativeQty, 0) / 1e5),
  }))

  const catalogued = lots.filter((l) => l.catalogueId)
  const categoryMix = CATEGORY_META
    .map((c) => ({ ...c, count: catalogued.filter((l) => l.category === c.key).length }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)

  const bidsPerMin = bids.filter((b) => now - Date.parse(b.at) < 10 * 60_000).length / 10
  const extensions = lots.reduce((s, l) => s + l.extensions, 0)

  const buyerTotals = users
    .filter((u) => u.role === 'buyer')
    .map((u) => ({
      u,
      won: sold.filter((l) => l.leadingBidderId === u.id),
    }))
    .map((x) => ({ ...x, value: x.won.reduce((s, l) => s + l.resultH1Rate! * l.indicativeQty, 0) }))
    .filter((x) => x.won.length > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  return (
    <Page>
      <PageHeader title="Platform dashboard"
        sub="Is anything wrong, what needs us today — and what has been changed, with the undo beside it." />

      <PlatformState />

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <NeedsUs />
        <RecentChanges />
        <SubAdminActivity />
        <CriticalEvents />
      </div>

      <OperationsRail />

      <h2 className="text-lg font-bold mt-10 mb-1">The marketplace itself</h2>
      <p className="text-sm text-ink-muted mb-4">
        Platform-wide KPIs across catalogues, bidders and settlement. The money view of the same business is{' '}
        <Link to="/finance/pnl" className="text-ember font-semibold hover:underline">Finance's profit &amp; loss</Link>; the CEO reads it{' '}
        <Link to="/ceo" className="text-ember font-semibold hover:underline">in their own words</Link>.
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="GMV (sold lots)" value={inrCompact(gmv)} tone="ember" sub="H1 × indicative qty" />
        <Stat label="Live catalogues" value={num(liveCats.length)} sub={`${lots.filter((l) => l.status === 'live').length} live lots`} />
        <Stat label="Active bidders" value={num(activeBidders)} sub="on live lots" />
        <Stat label="Sell-through" value={`${sellThrough.toFixed(0)}%`} tone="success" sub={`${sold.length}/${resolved.length} resolved lots`} />
        <Stat label="EMD held" value={inrCompact(emdHeld)} tone="steel" sub="locked across wallets" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-6">
        <div className="card p-5">
          <h2 className="font-bold mb-4">GMV trend <span className="text-xs text-ink-faint font-normal">(₹ lakh / week)</span></h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={gmvTrend}>
                <defs>
                  <linearGradient id="gmvFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E4572E" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#E4572E" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 12, fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [`₹${v} L`, 'GMV']} contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="gmv" stroke="#E4572E" strokeWidth={2.5} fill="url(#gmvFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-bold mb-4">Realisation by catalogue <span className="text-xs text-ink-faint font-normal">(closed, ₹ lakh)</span></h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCat}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [`₹${v} L`, 'Realised']} contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill="#2B4C7E" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-6">
        <div className="card p-5">
          <h2 className="font-bold mb-4">Category mix <span className="text-xs text-ink-faint font-normal">(catalogued lots)</span></h2>
          <div className="space-y-3">
            {categoryMix.map((c) => (
              <div key={c.key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{c.label}</span>
                  <span className="num text-ink-muted">{c.count}</span>
                </div>
                <ProgressBar value={c.count} max={categoryMix[0].count} tone="ember" />
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-bold mb-4">Platform health</h2>
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-ink-muted"><Activity size={15} className="text-success" /> Tick engine</span>
              <Chip tone="success" pulse>Running · 1s</Chip>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Bid velocity (10 min)</span>
              <span className="num font-bold">{bidsPerMin.toFixed(1)} bids/min</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Simulated competition</span>
              <Chip tone="steel">5 bot bidders active</Chip>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-ink-muted"><Zap size={15} className="text-warning" /> Anti-snipe extensions</span>
              <span className="num font-bold">{num(extensions)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Payment gateway</span>
              <Chip tone="success">Operational</Chip>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-bold mb-4">Top buyers <span className="text-xs text-ink-faint font-normal">(by won value)</span></h2>
          <div className="divide-y divide-line">
            {buyerTotals.map(({ u, won, value }) => (
              <div key={u.id} className="py-2.5 flex items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{u.firm}</div>
                  <div className="text-xs text-ink-faint">{u.city} · {won.length} lot{won.length === 1 ? '' : 's'} won</div>
                </div>
                <span className="num font-bold">{inrCompact(value)}</span>
              </div>
            ))}
            {buyerTotals.length === 0 && <p className="text-sm text-ink-faint py-3">No sold lots yet.</p>}
          </div>
        </div>
      </div>

      {/* Market context behind the KPIs above — benchmark prices, the clearing
          index, where demand sits geographically, and auction momentum. */}
      <div className="mt-6">
        <MarketInsights sellThrough={sellThrough} />
      </div>
    </Page>
  )
}
