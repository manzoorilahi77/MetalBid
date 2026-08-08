import { lazy, Suspense } from 'react'
import { HashRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import Chrome, { NAV_BY_ROLE, Page, SubNav } from './layout/Chrome'
import type { Role } from './types'
import { ToastHost } from './components/ui'
import { useTick } from './lib/useTick'
import { useStore } from './store/store'

/* public + shared */
import Home from './pages/Home'
import Login from './pages/Login'
import Browse from './pages/Browse'
import AuctionDetail from './pages/AuctionDetail'
import BiddingRoom from './pages/BiddingRoom'
import Noticeboard from './pages/Noticeboard'
import Help from './pages/Help'
import Legal from './pages/Legal'
import Disputes from './pages/Disputes'
import NotificationPrefs from './pages/NotificationPrefs'
import Profile from './pages/Profile'

/* guest 2 — redesigned public site (code-split from the authenticated app;
   Phase 9). Each page loads on demand behind the Guest2Layout Suspense. */
const Guest2Home = lazy(() => import('./pages/guest2/Home'))
const Guest2SolutionsBuyers = lazy(() => import('./pages/guest2/SolutionsBuyers'))
const Guest2SolutionsSellers = lazy(() => import('./pages/guest2/SolutionsSellers'))
const Guest2HowItWorks = lazy(() => import('./pages/guest2/HowItWorks'))
const Guest2Contact = lazy(() => import('./pages/guest2/Contact'))
const Guest2ExitIntent = lazy(() => import('./pages/guest2/ExitIntentWhatsApp'))

/* Master switch for the exit-intent WhatsApp invite. Off for now — the modal
   and all its logic stay intact; flip this to `true` to bring it back. */
const SHOW_WHATSAPP_MODAL = false

/* buyer */
import BuyerDashboard from './pages/buyer/Dashboard'
import BuyerMarketplace from './pages/buyer/Marketplace'
import Shortlist from './pages/buyer/Shortlist'
import BuyerBids from './pages/buyer/Bids'
import Fulfilment from './pages/buyer/Fulfilment'
import Wallet from './pages/buyer/Wallet'
import BecomeSeller from './pages/buyer/BecomeSeller'

/* seller */
import SellerWorkspace from './pages/seller/Workspace'
import CreateLot from './pages/seller/CreateLot'
import MyLots from './pages/seller/MyLots'
import LiveMonitor from './pages/seller/LiveMonitor'
import SellerReports from './pages/seller/Reports'

/* field executive */
import FieldQueue from './pages/field/Queue'
import InspectLot from './pages/field/InspectLot'

/* executive manager */
import Pipeline from './pages/exec/Pipeline'
import LotApproval from './pages/exec/LotApproval'
import CatalogueBuilder from './pages/exec/CatalogueBuilder'
import AuctionSetup from './pages/exec/AuctionSetup'
import Settlement from './pages/exec/Settlement'
import Logistics from './pages/exec/Logistics'
import Handover from './pages/exec/Handover'

/* sub-admin */
import OpsConsole from './pages/sub/OpsConsole'
import BidMonitor from './pages/sub/BidMonitor'
import WorkQueue from './pages/sub/WorkQueue'
import SubApprovals from './pages/sub/Approvals'

/* super admin */
import AdminDashboard from './pages/admin/Dashboard'
import Team from './pages/admin/Team'
import Users from './pages/admin/Users'
import ControlTower from './pages/admin/ControlTower'
import Blacklist from './pages/admin/Blacklist'
import Finance from './pages/admin/Finance'
import MasterData from './pages/admin/MasterData'
import Audit from './pages/admin/Audit'

/* contextual module nav per area — tabs under the header, never a sidebar */
/** Derives a role's sub-nav tabs from the same NAV_BY_ROLE config the top nav uses,
 *  so the two surfaces can't drift out of sync. */
function subNavItems(role: Role) {
  return NAV_BY_ROLE[role]
    .filter((i) => i.in.includes('sub'))
    .map((i) => ({ to: i.to, label: i.subLabel ?? i.label, end: i.end, locked: i.locked }))
}

/** Browse and Noticeboard are shared pages that live outside every role's own
 *  route group, so the contextual sub-nav used to disappear the moment a
 *  signed-in user stepped into them. Whenever the active role links to the
 *  current page from its top nav, re-render that role's sub-nav here so the
 *  tab strip stays put across all of its top-level destinations. */
function SharedLayout() {
  const role = useStore((s) => s.role)
  const { pathname } = useLocation()
  const items = subNavItems(role)
  const fromTopNav = NAV_BY_ROLE[role].some((i) => i.in.includes('top') && i.to === pathname)
  return (
    <>
      {items.length > 0 && fromTopNav && <SubNav items={items} />}
      <Outlet />
    </>
  )
}

function ExecLayout() {
  return (
    <>
      <SubNav items={subNavItems('exec_manager')} />
      <Outlet />
    </>
  )
}

function SubAdminLayout() {
  return (
    <>
      <SubNav items={subNavItems('sub_admin')} />
      <Outlet />
    </>
  )
}

function AdminLayout() {
  return (
    <>
      <SubNav items={subNavItems('super_admin')} />
      <Outlet />
    </>
  )
}

function BuyerLayout() {
  return (
    <>
      <SubNav items={subNavItems('buyer')} />
      <Outlet />
    </>
  )
}

function SellerLayout() {
  return (
    <>
      <SubNav items={subNavItems('seller')} />
      <Outlet />
    </>
  )
}

/** Guest 2 public site — shared chrome like every other role. A lean top nav
 *  (no sub-nav) drives the few marketing pages; this layout is the Suspense
 *  boundary for the lazy pages and the single mount point for the exit-intent
 *  WhatsApp community invite (so it can fire from any Guest 2 page, once). */
function Guest2Layout() {
  return (
    <Suspense fallback={<Page className="py-24 text-center text-ink-faint">Loading…</Page>}>
      <Outlet />
      {SHOW_WHATSAPP_MODAL && <Guest2ExitIntent />}
    </Suspense>
  )
}

function NotFound() {
  return (
    <Page className="text-center py-24">
      <div className="font-display text-7xl font-bold text-ember">404</div>
      <p className="text-ink-muted mt-2">That page doesn't exist. Try the <a className="text-steel font-semibold" href="#/browse">auction browser</a>.</p>
    </Page>
  )
}

function Engine() {
  useTick()
  return null
}

export default function App() {
  // subscribing here keeps the theme class in sync on toggle
  useStore((s) => s.theme)
  return (
    <HashRouter>
      <Engine />
      <ToastHost />
      <Routes>
        <Route element={<Chrome />}>
          <Route index element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/catalogue/:id" element={<AuctionDetail />} />
          <Route path="/bidding/:catalogueId" element={<BiddingRoom />} />
          <Route path="/help" element={<Help />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/disputes" element={<Disputes />} />
          <Route path="/settings/notifications" element={<NotificationPrefs />} />
          <Route path="/profile" element={<Profile />} />

          {/* shared pages that keep the active role's sub-nav (Browse, Noticeboard) */}
          <Route element={<SharedLayout />}>
            <Route path="/browse" element={<Browse />} />
            <Route path="/noticeboard" element={<Noticeboard />} />
          </Route>

          {/* Guest 2 public site — shared chrome, lean top nav (Phase 3/6) */}
          <Route element={<Guest2Layout />}>
            <Route path="/g2" element={<Guest2Home />} />
            <Route path="/g2/solutions/buyers" element={<Guest2SolutionsBuyers />} />
            <Route path="/g2/solutions/sellers" element={<Guest2SolutionsSellers />} />
            <Route path="/g2/how-it-works" element={<Guest2HowItWorks />} />
            <Route path="/g2/contact" element={<Guest2Contact />} />
          </Route>

          <Route element={<BuyerLayout />}>
            <Route path="/buyer" element={<BuyerDashboard />} />
            <Route path="/buyermarketplace" element={<BuyerMarketplace />} />
            <Route path="/buyer/shortlist" element={<Shortlist />} />
            <Route path="/buyer/bids" element={<BuyerBids />} />
            <Route path="/buyer/fulfilment" element={<Fulfilment />} />
            <Route path="/buyer/wallet" element={<Wallet />} />
            <Route path="/buyer/kyc" element={<BecomeSeller />} />
          </Route>

          <Route element={<SellerLayout />}>
            <Route path="/seller" element={<SellerWorkspace />} />
            <Route path="/seller/create-lot" element={<CreateLot />} />
            <Route path="/seller/lots" element={<MyLots />} />
            <Route path="/seller/monitor" element={<LiveMonitor />} />
            <Route path="/seller/reports" element={<SellerReports />} />
          </Route>

          <Route path="/field" element={<FieldQueue />} />
          <Route path="/field/inspect/:lotId" element={<InspectLot />} />

          <Route element={<ExecLayout />}>
            <Route path="/exec" element={<Pipeline />} />
            <Route path="/exec/approvals" element={<LotApproval />} />
            <Route path="/exec/catalogue-builder" element={<CatalogueBuilder />} />
            <Route path="/exec/auction-setup" element={<AuctionSetup />} />
            <Route path="/exec/settlement" element={<Settlement />} />
            <Route path="/exec/logistics" element={<Logistics />} />
            <Route path="/exec/handover" element={<Handover />} />
          </Route>

          <Route element={<SubAdminLayout />}>
            <Route path="/sub" element={<OpsConsole />} />
            <Route path="/sub/bid-monitor" element={<BidMonitor />} />
            <Route path="/sub/queue" element={<WorkQueue />} />
            <Route path="/sub/approvals" element={<SubApprovals />} />
          </Route>

          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/team" element={<Team />} />
            <Route path="/admin/users" element={<Users />} />
            <Route path="/admin/control-tower" element={<ControlTower />} />
            <Route path="/admin/blacklist" element={<Blacklist />} />
            <Route path="/admin/finance" element={<Finance />} />
            <Route path="/admin/master-data" element={<MasterData />} />
            <Route path="/admin/audit" element={<Audit />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
