import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import Chrome, { Page, SubNav } from './layout/Chrome'
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

/* buyer */
import BuyerDashboard from './pages/buyer/Dashboard'
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
function ExecLayout() {
  return (
    <>
      <SubNav items={[
        { to: '/exec', label: 'Pipeline', end: true },
        { to: '/exec/approvals', label: 'Lot approval' },
        { to: '/exec/catalogue-builder', label: 'Catalogue builder' },
        { to: '/exec/auction-setup', label: 'Auction setup' },
        { to: '/exec/settlement', label: 'Settlement' },
        { to: '/exec/logistics', label: 'Logistics' },
        { to: '/exec/handover', label: 'Handover' },
      ]} />
      <Outlet />
    </>
  )
}

function SubAdminLayout() {
  return (
    <>
      <SubNav items={[
        { to: '/sub', label: 'Ops console', end: true },
        { to: '/sub/bid-monitor', label: 'Bid monitor' },
        { to: '/sub/queue', label: 'Work queue' },
        { to: '/sub/approvals', label: 'Approvals' },
        { to: '/admin/finance', label: 'Financial config', locked: true },
        { to: '/admin/master-data', label: 'Master data', locked: true },
      ]} />
      <Outlet />
    </>
  )
}

function AdminLayout() {
  return (
    <>
      <SubNav items={[
        { to: '/admin', label: 'Dashboard', end: true },
        { to: '/admin/control-tower', label: 'Control tower' },
        { to: '/admin/users', label: 'User management' },
        { to: '/admin/team', label: 'Team & permissions' },
        { to: '/admin/blacklist', label: 'Blacklist & defaulters' },
        { to: '/admin/finance', label: 'Financial config' },
        { to: '/admin/master-data', label: 'Master data' },
        { to: '/admin/audit', label: 'Audit trail' },
      ]} />
      <Outlet />
    </>
  )
}

function BuyerLayout() {
  return (
    <>
      <SubNav items={[
        { to: '/buyer', label: 'Dashboard', end: true },
        { to: '/buyer/shortlist', label: 'Shortlist & EMD' },
        { to: '/buyer/bids', label: 'Bids & results' },
        { to: '/buyer/fulfilment', label: 'Fulfilment' },
        { to: '/buyer/wallet', label: 'Wallet & ledger' },
        { to: '/buyer/kyc', label: 'Become a seller' },
      ]} />
      <Outlet />
    </>
  )
}

function SellerLayout() {
  return (
    <>
      <SubNav items={[
        { to: '/seller', label: 'Workspace', end: true },
        { to: '/seller/create-lot', label: 'Create lot' },
        { to: '/seller/lots', label: 'My lots & batches' },
        { to: '/seller/monitor', label: 'Live monitor' },
        { to: '/seller/reports', label: 'Results & reports' },
      ]} />
      <Outlet />
    </>
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
          <Route path="/browse" element={<Browse />} />
          <Route path="/catalogue/:id" element={<AuctionDetail />} />
          <Route path="/bidding/:catalogueId" element={<BiddingRoom />} />
          <Route path="/noticeboard" element={<Noticeboard />} />
          <Route path="/help" element={<Help />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/disputes" element={<Disputes />} />
          <Route path="/settings/notifications" element={<NotificationPrefs />} />
          <Route path="/profile" element={<Profile />} />

          <Route element={<BuyerLayout />}>
            <Route path="/buyer" element={<BuyerDashboard />} />
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

          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
